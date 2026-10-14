import { unpack } from 'msgpackr';

async function inflateNative(compressed) {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([compressed]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export default async function decompress(compressedData) {
  const compressedArray =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);
  const decompressedData = await inflateNative(compressedArray);

  return unpack(decompressedData);
}
