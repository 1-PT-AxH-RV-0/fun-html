let bitmap = null;

self.addEventListener('message', event => {
  const { type } = event.data;

  if (type === 'init') {
    bitmap = new Uint32Array(event.data.buffer);
    return;
  }

  if (type === 'filter') {
    const { characters } = event.data;

    const filteredCharacters = characters.filter(
      i =>
        Array.isArray(i) ||
        (i >= 0 && i < 0x110000 && (bitmap[i >>> 5] & (1 << (i & 31))) !== 0)
    );

    self.postMessage(filteredCharacters);
  }
});