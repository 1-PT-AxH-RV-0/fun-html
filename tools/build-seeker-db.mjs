import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';
import { pack, unpack } from 'msgpackr';
import HAN_DATA_CONFIG from './han-data.config.mjs';

const DEFAULT_COMMIT = HAN_DATA_CONFIG.ids.commit;
const DEFAULT_SOURCE = HAN_DATA_CONFIG.ids.rawBase;
const EXPECTED_ROWS = 102033;
const DB_SCHEMA = 4;
const TANGUT_CONFIG = HAN_DATA_CONFIG.tangutIds;

const repoRoot = process.cwd();
const args = new Map(
  process.argv.slice(2).map(arg => {
    const index = arg.indexOf('=');
    return index >= 0 ? [arg.slice(0, index), arg.slice(index + 1)] : [arg, '1'];
  })
);

const commit =
  args.get('--commit') ||
  args.get('--ids-commit') ||
  process.env.SEEKER_IDS_COMMIT ||
  DEFAULT_COMMIT;
const unicodeVersion =
  args.get('--unicode') || process.env.HAN_UNICODE_VERSION || HAN_DATA_CONFIG.unicode.version;
const unicodeShortVersion = unicodeVersion.split('.').slice(0, 2).join('.');
const sourceDir = args.get('--source-dir') || '';
const tangutCommit =
  args.get('--tangut-commit') ||
  process.env.SEEKER_TANGUT_IDS_COMMIT ||
  TANGUT_CONFIG.commit;
const tangutSourceDir = args.get('--tangut-source-dir') || '';
const tangutInputFile = args.get('--tangut-file') || '';
const cacheDir = path.resolve(
  repoRoot,
  args.get('--cache-dir') || path.join('.han-data-cache', 'yi-bai-ids', commit)
);
const tangutCacheDir = path.resolve(
  repoRoot,
  args.get('--tangut-cache-dir') ||
    path.join('.han-data-cache', 'tangut-ids', tangutCommit)
);
const outputFile = path.resolve(
  repoRoot,
  args.get('--output') || path.join('src', 'data', 'seeker', 'yiids.seekerdb')
);
const metadataFile = path.resolve(
  repoRoot,
  args.get('--metadata') || path.join('src', 'data', 'seeker', 'yiids.metadata.json')
);
const standardTextFile = path.resolve(
  repoRoot,
  args.get('--standard') || path.join('src', 'data', 'seeker', 'standard-8105.txt')
);
const legacyStandardFile = path.resolve(
  repoRoot,
  path.join('src', 'data', 'mp.zlib', 'handata_uni.sc.mp.zlib')
);

const IDS_OPERATORS = new Set(Array.from('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿㇯'));
const OPEN_TO_CLOSE = new Map([
  ['(', ')'],
  ['[', ']'],
  ['{', '}']
]);

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function compareCodePointStrings(a, b) {
  return a.codePointAt(0) - b.codePointAt(0);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'fun-html-han-data-builder/2.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function loadTangutSourceFile() {
  if (tangutInputFile) {
    const filePath = path.resolve(repoRoot, tangutInputFile);
    log(`Reading ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  if (tangutSourceDir) {
    const filePath = path.resolve(repoRoot, tangutSourceDir, TANGUT_CONFIG.file);
    log(`Reading ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  fs.mkdirSync(tangutCacheDir, { recursive: true });
  const cached = path.join(tangutCacheDir, TANGUT_CONFIG.file);
  if (fs.existsSync(cached) && args.get('--refresh') !== '1') {
    log(`Using cached ${cached}`);
    return fs.readFileSync(cached, 'utf8');
  }

  const url = `${TANGUT_CONFIG.rawBase}/${tangutCommit}/${TANGUT_CONFIG.file}`;
  log(`Downloading ${url}`);
  const text = await fetchText(url);
  fs.writeFileSync(cached, text, 'utf8');
  return text;
}

async function loadSourceFile(name) {
  if (sourceDir) {
    const filePath = path.resolve(repoRoot, sourceDir, name);
    log(`Reading ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const cached = path.join(cacheDir, name);
  if (fs.existsSync(cached) && args.get('--refresh') !== '1') {
    log(`Using cached ${cached}`);
    return fs.readFileSync(cached, 'utf8');
  }

  const url = `${DEFAULT_SOURCE}/${commit}/${name}`;
  log(`Downloading ${url}`);
  const text = await fetchText(url);
  fs.writeFileSync(cached, text, 'utf8');
  return text;
}

function splitTopLevel(text, delimiter = ';') {
  const result = [];
  let start = 0;
  const stack = [];
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (OPEN_TO_CLOSE.has(char)) {
      stack.push(OPEN_TO_CLOSE.get(char));
      continue;
    }
    if (stack.length && char === stack[stack.length - 1]) {
      stack.pop();
      continue;
    }
    if (char === delimiter && stack.length === 0) {
      result.push(chars.slice(start, i).join(''));
      start = i + 1;
    }
  }

  result.push(chars.slice(start).join(''));
  return result.filter(Boolean);
}

function skipBalanced(chars, index, openChar) {
  const closeChar = OPEN_TO_CLOSE.get(openChar);
  let depth = 1;
  for (let i = index + 1; i < chars.length; i++) {
    if (chars[i] === openChar) depth++;
    else if (chars[i] === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return chars.length - 1;
}

function isAsciiNoise(char) {
  return char.codePointAt(0) <= 0x7f;
}

function extractComponents(sequence) {
  const result = [];
  const chars = Array.from(sequence);

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === '{' || char === '[' || char === '(') {
      i = skipBalanced(chars, i, char);
      continue;
    }

    if (char === '#' && chars[i + 1] === '(') {
      const end = skipBalanced(chars, i + 1, '(');
      const inner = chars.slice(i + 2, end);
      for (const part of inner) {
        if (isAsciiNoise(part) || IDS_OPERATORS.has(part)) continue;
        if ('()[]{}'.includes(part)) continue;
        result.push(part.codePointAt(0));
      }
      i = end;
      continue;
    }

    if (isAsciiNoise(char) || IDS_OPERATORS.has(char)) continue;
    if (')]}'.includes(char)) continue;
    result.push(char.codePointAt(0));
  }

  return result;
}

function inRanges(codePoint, ranges) {
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function parseTangutIdsText(text) {
  const byChar = new Map();
  let invalidRows = 0;
  let emptyIds = 0;
  let unknownOperands = 0;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const line of lines) {
    if (!line) continue;
    const columns = line.split('\t');
    if (columns.length !== 3) {
      invalidRows++;
      continue;
    }

    const declared = Number.parseInt(columns[0], 16);
    const char = Array.from(columns[1] ?? '')[0];
    if (!Number.isFinite(declared) || !char || char.codePointAt(0) !== declared) {
      invalidRows++;
      continue;
    }

    const ids = columns[2] ?? '';
    if (!ids) {
      emptyIds++;
      byChar.set(declared, []);
      continue;
    }

    const components = [];
    for (const token of Array.from(ids)) {
      if (IDS_OPERATORS.has(token)) continue;
      const codePoint = token.codePointAt(0);
      if (inRanges(codePoint, TANGUT_CONFIG.componentRanges)) {
        components.push(codePoint);
      } else {
        // TangutIDS currently contains one unknown placeholder (FULLWIDTH QUESTION MARK).
        // Unknown operands are deliberately ignored instead of becoming searchable keys.
        unknownOperands++;
      }
    }
    byChar.set(declared, components.length ? [components] : []);
  }

  log(
    `TangutIDS: ${byChar.size} rows, ${invalidRows} invalid rows, ` +
      `${emptyIds} empty IDS, ${unknownOperands} unknown operands ignored`
  );
  return { byChar, invalidRows, emptyIds, unknownOperands };
}

function parseIdsText(text, label) {
  const byChar = new Map();
  let invalidRows = 0;
  let emptyBranchCount = 0;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const line of lines) {
    if (!line) continue;
    const columns = line.split('\t');
    if (columns.length < 2 || !columns[0]) {
      invalidRows++;
      continue;
    }

    const char = Array.from(columns[0])[0];
    if (!char) {
      invalidRows++;
      continue;
    }

    const branches = [];
    const seen = new Set();
    for (const field of columns.slice(1, 3)) {
      if (!field) continue;
      for (const sequence of splitTopLevel(field)) {
        const components = extractComponents(sequence);
        const key = components.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        branches.push(components);
        if (!components.length) emptyBranchCount++;
      }
    }

    byChar.set(char.codePointAt(0), branches);
  }

  log(
    `${label}: ${byChar.size} rows, ${invalidRows} invalid rows, ${emptyBranchCount} empty component branches`
  );
  return byChar;
}

function flattenDecompositions(characters, byChar) {
  const charBranchOffsets = new Array(characters.length + 1).fill(0);
  const branchComponentOffsets = [0];
  const branchComponents = [];
  const branchToChar = [];
  let branchCount = 0;

  for (let id = 0; id < characters.length; id++) {
    charBranchOffsets[id] = branchCount;
    const branches = byChar.get(characters[id]) || [];
    for (const branch of branches) {
      branchComponents.push(...branch);
      branchComponentOffsets.push(branchComponents.length);
      branchToChar.push(id);
      branchCount++;
    }
  }
  charBranchOffsets[characters.length] = branchCount;

  return {
    charBranchOffsets,
    branchComponentOffsets,
    branchComponents,
    branchToChar
  };
}

function buildDirectPostings(characters, decompositions) {
  const map = new Map();

  function add(component, id) {
    let ids = map.get(component);
    if (!ids) {
      ids = [];
      map.set(component, ids);
    }
    if (ids.length === 0 || ids[ids.length - 1] !== id) ids.push(id);
  }

  for (let id = 0; id < characters.length; id++) {
    add(characters[id], id);

    const startBranch = decompositions.charBranchOffsets[id];
    const endBranch = decompositions.charBranchOffsets[id + 1];
    const seen = new Set();

    for (let branch = startBranch; branch < endBranch; branch++) {
      const start = decompositions.branchComponentOffsets[branch];
      const end = decompositions.branchComponentOffsets[branch + 1];
      for (let i = start; i < end; i++) seen.add(decompositions.branchComponents[i]);
    }

    for (const component of seen) add(component, id);
  }

  return packPostingMap(map);
}

function buildDirectBranchPostings(characters, decompositions) {
  const map = new Map();

  function add(component, branchId) {
    let ids = map.get(component);
    if (!ids) {
      ids = [];
      map.set(component, ids);
    }
    ids.push(branchId);
  }

  for (let branchId = 0; branchId < decompositions.branchToChar.length; branchId++) {
    const seen = new Set();
    const start = decompositions.branchComponentOffsets[branchId];
    const end = decompositions.branchComponentOffsets[branchId + 1];
    for (let i = start; i < end; i++) seen.add(decompositions.branchComponents[i]);
    for (const component of seen) add(component, branchId);
  }

  return packPostingMap(map);
}

function buildRecursiveBranchPostings(characters, decompositions, label) {
  const idByCodePoint = new Map(characters.map((cp, id) => [cp, id]));
  const closureMemo = new Map();

  function componentClosure(codePoint, stack = new Set()) {
    const cached = closureMemo.get(codePoint);
    if (cached) return cached;

    const result = new Set([codePoint]);
    if (stack.has(codePoint)) return result;

    const id = idByCodePoint.get(codePoint);
    if (id === undefined) {
      closureMemo.set(codePoint, result);
      return result;
    }

    stack.add(codePoint);
    const startBranch = decompositions.charBranchOffsets[id];
    const endBranch = decompositions.charBranchOffsets[id + 1];
    for (let branchId = startBranch; branchId < endBranch; branchId++) {
      const start = decompositions.branchComponentOffsets[branchId];
      const end = decompositions.branchComponentOffsets[branchId + 1];
      for (let i = start; i < end; i++) {
        const child = decompositions.branchComponents[i];
        for (const nested of componentClosure(child, stack)) result.add(nested);
      }
    }
    stack.delete(codePoint);
    closureMemo.set(codePoint, result);
    return result;
  }

  const map = new Map();
  function add(component, branchId) {
    let ids = map.get(component);
    if (!ids) {
      ids = [];
      map.set(component, ids);
    }
    ids.push(branchId);
  }

  for (let branchId = 0; branchId < decompositions.branchToChar.length; branchId++) {
    const seen = new Set();
    const start = decompositions.branchComponentOffsets[branchId];
    const end = decompositions.branchComponentOffsets[branchId + 1];
    for (let i = start; i < end; i++) {
      const child = decompositions.branchComponents[i];
      for (const nested of componentClosure(child)) seen.add(nested);
    }
    for (const component of seen) add(component, branchId);

    if ((branchId + 1) % 50000 === 0) {
      log(`${label}: recursive branch postings ${branchId + 1}/${decompositions.branchToChar.length}`);
    }
  }

  return packPostingMap(map);
}

function packPostingMap(map) {
  const components = [...map.keys()].sort((a, b) => a - b);
  const offsets = new Array(components.length + 1).fill(0);
  const ids = [];

  for (let i = 0; i < components.length; i++) {
    offsets[i] = ids.length;
    ids.push(...map.get(components[i]));
  }
  offsets[components.length] = ids.length;
  return { components, offsets, ids };
}

function loadStandard8105() {
  if (fs.existsSync(standardTextFile)) {
    const chars = fs
      .readFileSync(standardTextFile, 'utf8')
      .split(/\r?\n/)
      .map(line => Array.from(line.trim())[0])
      .filter(Boolean);
    return new Set(chars.map(char => char.codePointAt(0)));
  }

  if (!fs.existsSync(legacyStandardFile)) {
    log('Warning: no standard-8105.txt or legacy handata_uni.sc.mp.zlib found; 8105 set will be empty.');
    return new Set();
  }

  log('Migrating legacy 8105 list into src/data/seeker/standard-8105.txt');
  const compressed = fs.readFileSync(legacyStandardFile);
  const decoded = unpack(inflateSync(compressed));
  const chars = Array.from(decoded, value => Array.from(String(value))[0]).filter(Boolean);
  chars.sort(compareCodePointStrings);
  ensureDir(standardTextFile);
  fs.writeFileSync(standardTextFile, `${chars.join('\n')}\n`, 'utf8');
  return new Set(chars.map(char => char.codePointAt(0)));
}

function buildStandardBitset(characters, standardSet) {
  const words = new Array(Math.ceil(characters.length / 32)).fill(0);
  for (let id = 0; id < characters.length; id++) {
    if (!standardSet.has(characters[id])) continue;
    words[id >>> 5] = (words[id >>> 5] | (1 << (id & 31))) >>> 0;
  }
  return words;
}

function levelStats(level) {
  return {
    branchCount: level.decomp.branchComponentOffsets.length - 1,
    componentReferenceCount: level.decomp.branchComponents.length,
    indexedComponentCount: level.directPostings.components.length,
    directPostingCount: level.directPostings.ids.length,
    directBranchPostingCount: level.directBranchPostings.ids.length,
    recursiveBranchPostingCount: level.recursiveBranchPostings.ids.length
  };
}

export async function buildSeekerDatabase() {
  log(`Building Seeker database from yi-bai/ids @ ${commit}`);
  log(`Adding Tangut IDS from JLHwung/TangutIDS @ ${tangutCommit}`);
  const [lv1Text, lv2Text, tangutText] = await Promise.all([
    loadSourceFile('ids_lv1.txt'),
    loadSourceFile('ids_lv2.txt'),
    loadTangutSourceFile()
  ]);

  const lv1Map = parseIdsText(lv1Text, 'lv1');
  const lv2Map = parseIdsText(lv2Text, 'lv2');
  const hanLv1Count = lv1Map.size;
  const hanLv2Count = lv2Map.size;
  const tangut = parseTangutIdsText(tangutText);

  if (tangut.byChar.size < TANGUT_CONFIG.expectedRows && args.get('--allow-small') !== '1') {
    throw new Error(`Unexpectedly small Tangut IDS repertoire: ${tangut.byChar.size}`);
  }
  if (tangut.byChar.size !== TANGUT_CONFIG.expectedRows) {
    log(
      `Note: pinned Tangut source expected ${TANGUT_CONFIG.expectedRows} rows; ` +
        `got ${tangut.byChar.size}.`
    );
  }

  // Tangut has one structural level. Add the same decomposition to both Han levels so
  // the existing variant switch remains a Han-only concern at runtime.
  for (const [codePoint, branches] of tangut.byChar) {
    lv1Map.set(codePoint, branches);
    lv2Map.set(codePoint, branches);
  }

  const charSet = new Set([...lv1Map.keys(), ...lv2Map.keys()]);
  const characters = [...charSet].sort((a, b) => a - b);

  if (characters.length < 100000 && args.get('--allow-small') !== '1') {
    throw new Error(`Unexpectedly small IDS repertoire: ${characters.length}`);
  }
  if (hanLv1Count !== EXPECTED_ROWS || hanLv2Count !== EXPECTED_ROWS) {
    log(
      `Note: pinned Han source expected ${EXPECTED_ROWS} rows; ` +
        `got lv1=${hanLv1Count}, lv2=${hanLv2Count}.`
    );
  }

  log('Flattening decompositions…');
  const lv1Decomp = flattenDecompositions(characters, lv1Map);
  const lv2Decomp = flattenDecompositions(characters, lv2Map);

  log('Building direct reverse postings…');
  const lv1Direct = buildDirectPostings(characters, lv1Decomp);
  const lv2Direct = buildDirectPostings(characters, lv2Decomp);

  log('Building branch-level reverse postings…');
  const lv1DirectBranches = buildDirectBranchPostings(characters, lv1Decomp);
  const lv2DirectBranches = buildDirectBranchPostings(characters, lv2Decomp);

  log('Precomputing recursive branch postings for strong subdivision…');
  const lv1RecursiveBranches = buildRecursiveBranchPostings(characters, lv1Decomp, 'lv1');
  const lv2RecursiveBranches = buildRecursiveBranchPostings(characters, lv2Decomp, 'lv2');

  const standardSet = loadStandard8105();
  const standardWords = buildStandardBitset(characters, standardSet);

  const builtAt = new Date().toISOString();
  const db = {
    schema: DB_SCHEMA,
    metadata: {
      source: 'yi-bai/ids + JLHwung/TangutIDS',
      unicode: unicodeShortVersion,
      tangutUnicode: TANGUT_CONFIG.unicode,
      builtAt,
      characterCount: characters.length,
      hanCharacterCount: hanLv1Count,
      tangutCharacterCount: tangut.byChar.size,
      standard8105Count: standardSet.size,
      parser: 'fun-html permissive IDS projection v4',
      recursiveIndex: 'precomputed branch transitive postings',
      sources: {
        han: {
          repository: HAN_DATA_CONFIG.ids.repository,
          commit,
          url: 'https://github.com/yi-bai/ids',
          license: 'MIT'
        },
        tangut: {
          repository: TANGUT_CONFIG.repository,
          commit: tangutCommit,
          url: 'https://github.com/JLHwung/TangutIDS',
          unicode: TANGUT_CONFIG.unicode,
          license: null
        }
      },
      tangutUnknownOperandsIgnored: tangut.unknownOperands
    },
    characters,
    standardWords,
    lv1: {
      decomp: lv1Decomp,
      directPostings: lv1Direct,
      directBranchPostings: lv1DirectBranches,
      recursiveBranchPostings: lv1RecursiveBranches
    },
    lv2: {
      decomp: lv2Decomp,
      directPostings: lv2Direct,
      directBranchPostings: lv2DirectBranches,
      recursiveBranchPostings: lv2RecursiveBranches
    }
  };

  const metadata = {
    ...db.metadata,
    lv1: levelStats(db.lv1),
    lv2: levelStats(db.lv2)
  };

  log('Encoding MessagePack + zlib…');
  const packed = pack(db);
  const compressed = deflateSync(packed, { level: 9 });

  ensureDir(outputFile);
  fs.writeFileSync(outputFile, compressed);
  ensureDir(metadataFile);
  fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  log(
    `Wrote ${path.relative(repoRoot, outputFile)} (${(compressed.length / 1024 / 1024).toFixed(2)} MiB)`
  );
  log(
    `Characters: ${characters.length} (${hanLv1Count} Han + ${tangut.byChar.size} Tangut); ` +
      `8105 entries: ${standardSet.size}`
  );
  log(
    `lv1 refs: char-direct ${lv1Direct.ids.length}; branch direct/recursive ` +
      `${lv1DirectBranches.ids.length}/${lv1RecursiveBranches.ids.length}`
  );
  log(
    `lv2 refs: char-direct ${lv2Direct.ids.length}; branch direct/recursive ` +
      `${lv2DirectBranches.ids.length}/${lv2RecursiveBranches.ids.length}`
  );
  return metadata;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSeekerDatabase().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
