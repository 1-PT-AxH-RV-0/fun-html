import { unpack } from 'msgpackr';

const DB_SCHEMA = 1;
let ready = false;
let metadata = null;
let sourceOrder = [];
let sourceComments = {};
let sourceStrings = [];
let characters = new Uint32Array();
let sourceMatrix = new Uint32Array();
let reverseKeys = [];
let reverseOffsets = new Uint32Array();
let reverseIds = new Uint32Array();

const toU32 = value =>
  value instanceof Uint32Array ? value : Uint32Array.from(value ?? []);

async function inflateNative(compressed) {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([compressed]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function initialize(databaseUrl) {
  const response = await fetch(databaseUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Database HTTP ${response.status}`);
  const compressed = new Uint8Array(await response.arrayBuffer());
  const db = unpack(await inflateNative(compressed));
  if (db.schema !== DB_SCHEMA) {
    throw new Error(`Unsupported ziSrc database schema ${db.schema}`);
  }

  metadata = db.metadata ?? {};
  sourceOrder = Array.from(db.sourceOrder ?? []);
  sourceComments = db.sourceComments ?? {};
  sourceStrings = Array.from(db.sourceStrings ?? []);
  characters = toU32(db.characters);
  sourceMatrix = toU32(db.sourceMatrix);
  reverseKeys = Array.from(db.reverseKeys ?? []);
  reverseOffsets = toU32(db.reverseOffsets);
  reverseIds = toU32(db.reverseIds);
  ready = true;

  return {
    ...metadata,
    databaseBytes: compressed.byteLength,
    sourceOrder,
    sourceComments
  };
}

function binarySearchNumbers(array, value) {
  let low = 0;
  let high = array.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (array[mid] === value) return mid;
    if (array[mid] < value) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

function binarySearchStrings(array, value) {
  let low = 0;
  let high = array.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const current = array[mid];
    if (current === value) return mid;
    if (current < value) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

function queryChars(payload) {
  const result = [];
  for (const rawChar of payload.chars ?? []) {
    const char = Array.from(rawChar ?? '')[0];
    if (!char) continue;
    const id = binarySearchNumbers(characters, char.codePointAt(0));
    if (id < 0) continue;

    const sources = [];
    const base = id * sourceOrder.length;
    for (let column = 0; column < sourceOrder.length; column++) {
      const stringId = sourceMatrix[base + column] ?? 0;
      const value = sourceStrings[stringId] ?? '';
      if (value) sources.push({ field: sourceOrder[column], value });
    }
    result.push({ char, sources });
  }
  return result;
}

function querySources(payload) {
  const result = [];
  for (const rawSource of payload.sources ?? []) {
    const query = String(rawSource ?? '').trim().toUpperCase();
    if (!query) continue;
    const index = binarySearchStrings(reverseKeys, query);
    if (index < 0) {
      result.push({ query, chars: [] });
      continue;
    }
    const start = reverseOffsets[index];
    const end = reverseOffsets[index + 1];
    const chars = [];
    for (let i = start; i < end; i++) {
      chars.push(String.fromCodePoint(characters[reverseIds[i]]));
    }
    result.push({ query, chars });
  }
  return result;
}

async function respond(id, type, payload) {
  try {
    if (!ready) throw new Error('ziSrc database is not ready');
    let result;
    if (type === 'query-chars') result = queryChars(payload);
    else if (type === 'query-sources') result = querySources(payload);
    else throw new Error(`Unknown ziSrc message: ${type}`);
    self.postMessage({ type: 'response', id, result });
  } catch (error) {
    self.postMessage({
      type: 'response',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

self.addEventListener('message', event => {
  const { type, id = 0, payload = {} } = event.data ?? {};
  if (type === 'init') {
    initialize(payload.databaseUrl)
      .then(stats => self.postMessage({ type: 'ready', stats }))
      .catch(error => {
        self.postMessage({
          type: 'init-error',
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return;
  }
  void respond(id, type, payload);
});
