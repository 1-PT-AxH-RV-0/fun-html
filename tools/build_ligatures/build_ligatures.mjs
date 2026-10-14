import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { deflate } from 'node:zlib';
import { pack } from 'msgpackr';

const deflateAsync = promisify(deflate);

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- 1. 从 regenerate-unicode-properties 收集 ----
async function collectFromProperties() {
  const properties = (await import('regenerate-unicode-properties')).default;

  const propNames = [...properties.get('Property_of_Strings')];

  const modules = await Promise.all(
    propNames.map(name =>
      import(`regenerate-unicode-properties/Property_of_Strings/${name}.js`)
    )
  );

  const result = [];
  for (const mod of modules) {
    for (const s of mod.strings) result.push(toCodePoints(s));
  }
  return result;
}

function toCodePoints(str) {
  const arr = [];
  for (let i = 0; i < str.length; ) {
    const cp = str.codePointAt(i);
    i += cp > 0xffff ? 2 : 1;
    arr.push(cp);
  }
  return arr;
}

// ---- 2. 读取三个 JSON（number[][]）----
function loadJson(name) {
  return JSON.parse(readFileSync(join(__dirname, name), 'utf8'));
}

// ---- 3. 合并 + 去重 + 排序 ----
function buildLigatures(...sources) {
  const seen = new Set();
  const ligatures = [];

  for (const source of sources) {
    for (const codeArr of source) {
      const key = codeArr.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      ligatures.push(codeArr);
    }
  }

  ligatures.sort((a, b) => b.length - a.length);
  return ligatures;
}

// ---- 4. msgpack → deflate ----
async function packToMpZlib(value) {
  const packed = pack(value);
  return deflateAsync(packed, { level: 9 });
}

// ---- 5. main ----
const fromProperties = await collectFromProperties();
const decompositions = loadJson('decompositions.json');
const variations = loadJson('variations.json');
const namedSequences = loadJson('named_sequences.json');

console.log('from properties:', fromProperties.length);
console.log('decompositions:', decompositions.length);
console.log('variations:', variations.length);
console.log('named_sequences:', namedSequences.length);

const ligatures = buildLigatures(
  fromProperties,
  decompositions,
  variations,
  namedSequences
);

console.log('ligatures (after dedup):', ligatures.length);

const compressed = await packToMpZlib(ligatures);
writeFileSync(
  join(__dirname, '../..', 'src/data/mp.zlib/ligatures.mp.zlib'),
  compressed
);
console.log('written ligatures.mp.zlib:', compressed.length, 'bytes');