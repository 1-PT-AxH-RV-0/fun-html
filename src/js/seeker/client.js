import { seekerDatabaseUrl } from './data.js';

export default class SeekerClient {
  constructor() {
    this.worker = new Worker(new URL('./engine.js', import.meta.url));
    this.requestId = 0;
    this.searchGeneration = 0;
    this.pending = new Map();
    this.closed = false;
    this.initProgressListeners = new Set();
    this.lastInitProgress = null;

    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.worker.addEventListener('message', event => {
      const message = event.data ?? {};

      if (message.type === 'init-progress') {
        this.lastInitProgress = message;
        for (const listener of this.initProgressListeners) {
          listener(message);
        }
        return;
      }

      if (message.type === 'ready') {
        this.resolveReady(message.stats);
        return;
      }

      if (message.type === 'init-error') {
        this.rejectReady(new Error(message.error || 'Seeker initialization failed'));
        return;
      }

      if (message.type !== 'response') return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);

      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });

    this.worker.addEventListener('error', error => {
      this.rejectReady(error);
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
    });

    this.worker.postMessage({
      type: 'init',
      payload: { databaseUrl: seekerDatabaseUrl }
    });
  }

  onInitProgress(listener) {
    if (typeof listener !== 'function') return () => {};
    this.initProgressListeners.add(listener);
    if (this.lastInitProgress) listener(this.lastInitProgress);
    return () => {
      this.initProgressListeners.delete(listener);
    };
  }

  async request(type, payload = {}) {
    if (this.closed) throw new Error('Seeker worker has been terminated');
    await this.ready;

    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, payload });
    });
  }

  cancelSearch() {
    this.searchGeneration++;
    if (!this.closed) this.worker.postMessage({ type: 'cancel-search' });
  }

  async search(payload) {
    const generation = ++this.searchGeneration;
    const result = await this.request('search', payload);
    if (generation !== this.searchGeneration || result?.cancelled) {
      return { stale: true };
    }
    return { ...result, stale: false };
  }

  decompose(payload) {
    return this.request('decompose', payload);
  }

  tree(payload) {
    return this.request('tree', payload);
  }

  terminate() {
    if (this.closed) return;
    this.closed = true;
    this.initProgressListeners.clear();
    this.worker.terminate();
    for (const { reject } of this.pending.values()) {
      reject(new Error('Seeker worker has been terminated'));
    }
    this.pending.clear();
  }
}
