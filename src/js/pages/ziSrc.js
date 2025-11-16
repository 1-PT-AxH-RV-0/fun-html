import '@css/mainStyles.css';
import '@css/fontFallback.css';
import '@css/pages/ziSrc.css';

import '@js/changeHeader.js';
import '@js/iframeColorSchemeSync.js';
import '@js/m3ui.js';

import decompress from '@js/mpZlibDecompresser.js';
import sourceData from '@data/mp.zlib/source.mp.zlib';
const source = decompress(sourceData);

function loadZiSrc() {
  const { sourceDict, sourceComments } = source;
  const reverseDict = buildReverse(sourceDict);

  function buildReverse(sourceDict) {
    const result = {};
    for (const [key, sources] of Object.entries(sourceDict)) {
      sources.forEach(source => {
        if (source) {
          if (source in result) {
            result[source] += key;
          } else {
            result[source] = key;
          }
          let big = source.split('-');
          if (big[0] !== source) {
            big = big[0];
            if (big in result) {
              result[big] += key;
            } else {
              result[big] = key;
            }
          }
        }
      });
    }
    return result;
  }

  return {
    sourceDict,
    sourceComments,
    reverseDict
  };
}

const { sourceDict, sourceComments, reverseDict } = loadZiSrc();

String.prototype.toCharArray = function () {
  const arr = [];
  for (let i = 0; i < this.length; ) {
    const codePoint = this.codePointAt(i);
    i += codePoint > 0xffff ? 2 : 1;
    arr.push(String.fromCodePoint(codePoint));
  }
  return arr;
};

const input = document.getElementById('input');
const searchBtn = document.getElementById('searchBtn');
const peggingBtn = document.getElementById('peggingBtn');
const resultEle = document.getElementById('result');
const sourceCommentsEle = document.getElementById('sourceComments');

for (const [source, comment] of Object.entries(sourceComments)) {
  const li = document.createElement('li');
  li.innerHTML = `${source}：${comment}`;
  sourceCommentsEle.appendChild(li);
}

searchBtn.addEventListener('click', () => {
  resultEle.innerHTML = '';
  const queryArr = input.value.toCharArray();

  for (const char of queryArr) {
    let sources = sourceDict[char];
    if (Array.isArray(sources)) {
      sources = sources.filter(Boolean);
      const li = document.createElement('li');

      li.innerHTML = `<span class="font-without-ctrlctrl">${char}</span>：${sources.join('，')}`;
      resultEle.appendChild(li);
    }
  }
});

peggingBtn.addEventListener('click', () => {
  const queryArr = input.value.split(',');
  resultEle.innerHTML = '';
  for (const query of queryArr) {
    let chars = reverseDict[query];
    if (typeof chars === 'string') {
      const li = document.createElement('li');

      li.innerHTML = `${query}：<span class="font-without-ctrlctrl">${chars}</span>`;
      resultEle.appendChild(li);
    }
  }
});
