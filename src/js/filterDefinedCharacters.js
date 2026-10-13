import decompress from '@js/mpZlibDecompresser.js';
import filterDefinedCharactersWorker from '@js/workers/filterDefinedCharacters.worker.js';
import definedCharacterListData from '@data/mp.zlib/DefinedCharacterList.mp.zlib';

const MAX_CODEPOINT = 0x110000;

const workerReady = decompress(definedCharacterListData).then(list => {
  const bitmap = new Uint32Array(MAX_CODEPOINT >>> 5);
  for (const cp of list) {
    bitmap[cp >>> 5] |= (1 << (cp & 31));
  }

  const worker = new filterDefinedCharactersWorker();
  worker.postMessage({ type: 'init', buffer: bitmap.buffer }, [bitmap.buffer]);
  return worker;
});

async function filterDefinedCharacters(characters) {
  const w = await workerReady;

  return new Promise(resolve => {
    w.addEventListener('message', event => resolve(event.data), { once: true });
    w.postMessage({ type: 'filter', characters });
  });
}

export default filterDefinedCharacters;