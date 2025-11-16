import pako from 'pako';
import { decode } from '@msgpack/msgpack';

export default function decompress(compressedData) {
  const compressedArray =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);
  const decompressedData = pako.inflate(compressedArray);

  return decode(decompressedData);
}
