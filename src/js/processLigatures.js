import processLigaturesWorker from '@js/workers/processLigatures.worker.js';

import decompress from '@js/mpZlibDecompresser.js';
import ligaturesData from '@data/mp.zlib/ligatures.mp.zlib';

export default (async () => {
  const ligatures = await decompress(ligaturesData);

  const ligatureStrings = ligatures.map(ligature =>
    ligature.map(code => String.fromCodePoint(code))
  );

  const worker1 = new processLigaturesWorker();
  const worker2 = new processLigaturesWorker();

  worker1.postMessage({ type: 'init', data: { ligatures, ligatureStrings } });
  worker2.postMessage({ type: 'init', data: { ligatures, ligatureStrings } });

  async function processLigatures(codeArr) {
    return new Promise(resolve => {
      const handler = event => {
        worker1.removeEventListener('message', handler);
        resolve(event.data);
      };
      worker1.addEventListener('message', handler);
      worker1.postMessage({ type: 'processLigatures', data: codeArr });
    });
  }

  async function processLigaturesString(charArr) {
    return new Promise(resolve => {
      const handler = event => {
        worker2.removeEventListener('message', handler);
        resolve(event.data);
      };
      worker2.addEventListener('message', handler);
      worker2.postMessage({ type: 'processLigaturesString', data: charArr });
    });
  }

  return { processLigatures, processLigaturesString };
})();