import properties from 'regenerate-unicode-properties';

import getLigaturesWorker from '@js/workers/getLigatures.worker.js';
import processLigaturesWorker from '@js/workers/processLigatures.worker.js';

import decompress from '@js/mpZlibDecompresser.js';
import decompositionsData from '@data/mp.zlib/decompositions.mp.zlib';
import variationsData from '@data/mp.zlib/variations.mp.zlib';
import namedSequencesData from '@data/mp.zlib/named_sequences.mp.zlib';

const ligaturesData = [
  ...decompress(decompositionsData),
  ...decompress(variationsData),
  ...decompress(namedSequencesData)
];

const getLigatures = async () => {
  return new Promise((resolve, reject) => {
    const worker = new getLigaturesWorker();

    worker.addEventListener('message', event => {
      const { ligatures, ligatureStrings } = event.data;
      resolve({ ligatures, ligatureStrings });
      worker.terminate();
    });

    worker.addEventListener('error', error => {
      reject(error);
      worker.terminate();
    });

    worker.postMessage({ properties, data: ligaturesData });
  });
};

export default (async () => {
  const { ligatures, ligatureStrings } = await getLigatures();

  const worker1 = new processLigaturesWorker();
  const worker2 = new processLigaturesWorker();

  worker1.postMessage({ type: 'init', data: { ligatures, ligatureStrings } });
  worker2.postMessage({ type: 'init', data: { ligatures, ligatureStrings } });

  async function processLigatures(codeArr) {
    return new Promise(resolve => {
      worker1.addEventListener('message', event => {
        resolve(event.data);
      });
      worker1.postMessage({ type: 'processLigatures', data: codeArr });
    });
  }

  async function processLigaturesString(charArr) {
    return new Promise(resolve => {
      worker2.addEventListener('message', event => {
        resolve(event.data);
      });
      worker2.postMessage({ type: 'processLigaturesString', data: charArr });
    });
  }

  return { processLigatures, processLigaturesString };
})();
