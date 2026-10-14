import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { deflateSync, inflateRawSync } from 'node:zlib';
import { pack } from 'msgpackr';
import HAN_DATA_CONFIG from './han-data.config.mjs';

const DB_SCHEMA = 1;
const repoRoot = process.cwd();
const args = new Map(
  process.argv.slice(2).map(arg => {
    const index = arg.indexOf('=');
    return index >= 0 ? [arg.slice(0, index), arg.slice(index + 1)] : [arg, '1'];
  })
);

const unicodeVersion =
  args.get('--unicode') || process.env.HAN_UNICODE_VERSION || HAN_DATA_CONFIG.unicode.version;
const unihanUrl =
  args.get('--unihan-url') ||
  (unicodeVersion === HAN_DATA_CONFIG.unicode.version
    ? HAN_DATA_CONFIG.unicode.unihanUrl
    : `https://www.unicode.org/Public/${unicodeVersion}/ucd/Unihan.zip`);
const cacheDir = path.resolve(
  repoRoot,
  args.get('--cache-dir') || path.join('.han-data-cache', 'unicode', unicodeVersion)
);
const outputFile = path.resolve(
  repoRoot,
  args.get('--output') || path.join('src', 'data', 'zisrc', 'irg-sources.zisrcdb')
);
const metadataFile = path.resolve(
  repoRoot,
  args.get('--metadata') || path.join('src', 'data', 'zisrc', 'irg-sources.metadata.json')
);
const licenseFile = path.resolve(
  repoRoot,
  args.get('--unicode-license') || path.join('src', 'data', 'zisrc', 'LICENSE.Unicode.txt')
);
const UNICODE_LICENSE_URL = 'https://www.unicode.org/license.txt';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'fun-html-han-data-builder/2.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function ensureUnicodeLicense() {
  if (fs.existsSync(licenseFile) && args.get('--refresh') !== '1') return;
  try {
    const response = await fetch(UNICODE_LICENSE_URL, {
      headers: { 'User-Agent': 'fun-html-han-data-builder/2.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    ensureDir(licenseFile);
    fs.writeFileSync(licenseFile, await response.text(), 'utf8');
  } catch (error) {
    if (fs.existsSync(licenseFile)) return;
    ensureDir(licenseFile);
    fs.writeFileSync(
      licenseFile,
      'Unicode data is licensed under Unicode License v3 (SPDX: Unicode-3.0).\n' +
        `Official license: ${UNICODE_LICENSE_URL}\n`,
      'utf8'
    );
    log(`Warning: could not download Unicode license text (${error.message}).`);
  }
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset--) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error('Invalid ZIP: end-of-central-directory record not found');
}

function extractZipEntry(buffer, targetName) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let entry = 0; entry < entryCount; entry++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP: central directory entry missing');
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');

    if (name === targetName || name.endsWith(`/${targetName}`)) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Invalid ZIP local header for ${name}`);
      }
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      let output;
      if (method === 0) output = Buffer.from(compressed);
      else if (method === 8) output = inflateRawSync(compressed);
      else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);

      if (output.length !== uncompressedSize) {
        throw new Error(
          `ZIP size mismatch for ${name}: expected ${uncompressedSize}, got ${output.length}`
        );
      }
      return output;
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`ZIP entry not found: ${targetName}`);
}

async function loadUnihanIrgSources() {
  const directFile = args.get('--unihan-file');
  if (directFile) {
    const filePath = path.resolve(repoRoot, directFile);
    log(`Reading ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  const zipFileArg = args.get('--unihan-zip');
  let zipBuffer;
  if (zipFileArg) {
    const zipPath = path.resolve(repoRoot, zipFileArg);
    log(`Reading ${zipPath}`);
    zipBuffer = fs.readFileSync(zipPath);
  } else {
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachedZip = path.join(cacheDir, 'Unihan.zip');
    if (fs.existsSync(cachedZip) && args.get('--refresh') !== '1') {
      log(`Using cached ${cachedZip}`);
      zipBuffer = fs.readFileSync(cachedZip);
    } else {
      log(`Downloading ${unihanUrl}`);
      zipBuffer = await fetchBuffer(unihanUrl);
      fs.writeFileSync(cachedZip, zipBuffer);
    }
  }

  return extractZipEntry(zipBuffer, 'Unihan_IRGSources.txt').toString('utf8');
}

function addReverse(reverseMap, key, id) {
  if (!key) return;
  let ids = reverseMap.get(key);
  if (!ids) {
    ids = [];
    reverseMap.set(key, ids);
  }
  if (ids.length === 0 || ids[ids.length - 1] !== id) ids.push(id);
}

function parseIrgSources(text) {
  const sourceOrder = HAN_DATA_CONFIG.irgSourceOrder;
  const fieldIndex = new Map(sourceOrder.map((name, index) => [`kIRG_${name}`, index]));
  const rows = new Map();

  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const [codePointText, keyType] = parts;
    const index = fieldIndex.get(keyType);
    if (index === undefined || !codePointText.startsWith('U+')) continue;

    const codePoint = Number.parseInt(codePointText.slice(2), 16);
    if (!Number.isFinite(codePoint)) continue;
    const value = parts.slice(2).join('\t').trim();
    if (!value) continue;

    let row = rows.get(codePoint);
    if (!row) {
      row = new Array(sourceOrder.length).fill('');
      rows.set(codePoint, row);
    }
    row[index] = value;
  }

  return rows;
}

function buildDatabase(rows) {
  const sourceOrder = HAN_DATA_CONFIG.irgSourceOrder;
  const characters = [...rows.keys()].sort((a, b) => a - b);
  const sourceStrings = [''];
  const sourceStringIndex = new Map([['', 0]]);
  const sourceMatrix = new Array(characters.length * sourceOrder.length).fill(0);
  const reverseMap = new Map();

  function intern(value) {
    let index = sourceStringIndex.get(value);
    if (index !== undefined) return index;
    index = sourceStrings.length;
    sourceStrings.push(value);
    sourceStringIndex.set(value, index);
    return index;
  }

  for (let id = 0; id < characters.length; id++) {
    const row = rows.get(characters[id]);
    for (let column = 0; column < sourceOrder.length; column++) {
      const value = row[column] || '';
      sourceMatrix[id * sourceOrder.length + column] = intern(value);
      if (!value) continue;

      for (const token of value.split(/\s+/).filter(Boolean)) {
        addReverse(reverseMap, token, id);
        const dash = token.indexOf('-');
        if (dash > 0) addReverse(reverseMap, token.slice(0, dash), id);
      }
    }
  }

  const reverseKeys = [...reverseMap.keys()].sort();
  const reverseOffsets = new Array(reverseKeys.length + 1).fill(0);
  const reverseIds = [];
  for (let i = 0; i < reverseKeys.length; i++) {
    reverseOffsets[i] = reverseIds.length;
    reverseIds.push(...reverseMap.get(reverseKeys[i]));
  }
  reverseOffsets[reverseKeys.length] = reverseIds.length;

  return {
    characters,
    sourceOrder: [...sourceOrder],
    sourceComments: { ...HAN_DATA_CONFIG.sourceComments },
    sourceStrings,
    sourceMatrix,
    reverseKeys,
    reverseOffsets,
    reverseIds
  };
}

export async function buildZiSrcDatabase() {
  log(`Building ziSrc IRG source database from Unicode ${unicodeVersion}`);
  await ensureUnicodeLicense();
  const text = await loadUnihanIrgSources();
  const rows = parseIrgSources(text);
  if (rows.size < 90000 && args.get('--allow-small') !== '1') {
    throw new Error(`Unexpectedly small IRG source repertoire: ${rows.size}`);
  }

  const data = buildDatabase(rows);
  const builtAt = new Date().toISOString();
  const metadata = {
    source: 'Unicode Unihan_IRGSources.txt',
    sourceUrl: unihanUrl,
    unicode: unicodeVersion,
    builtAt,
    characterCount: data.characters.length,
    sourceColumnCount: data.sourceOrder.length,
    internedSourceValueCount: data.sourceStrings.length,
    reverseKeyCount: data.reverseKeys.length,
    reversePostingCount: data.reverseIds.length
  };

  const db = {
    schema: DB_SCHEMA,
    metadata,
    ...data
  };

  log('Encoding ziSrc MessagePack + zlib…');
  const compressed = deflateSync(pack(db), { level: 9 });
  ensureDir(outputFile);
  fs.writeFileSync(outputFile, compressed);
  ensureDir(metadataFile);
  fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  log(
    `Wrote ${path.relative(repoRoot, outputFile)} (${(compressed.length / 1024 / 1024).toFixed(2)} MiB)`
  );
  log(
    `ziSrc characters: ${data.characters.length}; reverse keys: ${data.reverseKeys.length}; refs: ${data.reverseIds.length}`
  );
  return metadata;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildZiSrcDatabase().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
