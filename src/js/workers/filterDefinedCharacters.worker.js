let bitmap = null;

self.addEventListener('message', event => {
  const { type } = event.data;

  if (type === 'init') {
    bitmap = new Uint32Array(event.data.buffer);
    return;
  }

  if (type === 'filter') {
    const { characters } = event.data;

    const isDefined = cp =>
      cp >= 0 && cp < 0x110000 && (bitmap[cp >>> 5] & (1 << (cp & 31))) !== 0;

    const isRange = item =>
      item !== null && typeof item === 'object' && item.__range === true;

    const filteredCharacters = [];

    for (const item of characters) {
      if (Array.isArray(item)) {
        // 连字数组原样保留
        filteredCharacters.push(item);
      } else if (isRange(item)) {
        // 区间：扫描并切分，仅保留已定义码位组成的子区间
        let start = item.start;
        let end = item.end;
        if (start < 0) start = 0;
        if (end > 0x10ffff) end = 0x10ffff;

        let runStart = -1;
        for (let cp = start; cp <= end; cp++) {
          if (isDefined(cp)) {
            if (runStart === -1) runStart = cp;
          } else if (runStart !== -1) {
            filteredCharacters.push({
              __range: true,
              start: runStart,
              end: cp - 1
            });
            runStart = -1;
          }
        }
        if (runStart !== -1) {
          filteredCharacters.push({
            __range: true,
            start: runStart,
            end
          });
        }
      } else if (isDefined(item)) {
        filteredCharacters.push(item);
      }
    }

    self.postMessage(filteredCharacters);
  }
});