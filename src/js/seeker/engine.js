import { unpack } from 'msgpackr';
import SEEKER_CONFIG, {
  ALL_BLOCK_MASK,
  BLOCK_BY_MARKER,
  getBlockByCodePoint,
  getBlockByKey,
  isTangutSearchCodePoint
} from './config.js';

let ready = false;
let metadata = null;
let characters = new Uint32Array();
let standardWords = new Uint32Array();
let levels = null;
let blockIndexes = new Uint8Array();
let searchEpoch = 0;

const EMPTY_U32 = new Uint32Array();
const toChars = value => Array.from(value ?? '');
const toU32 = value =>
  value instanceof Uint32Array ? value : Uint32Array.from(value ?? []);

function normalizePostings(postings) {
  return {
    components: toU32(postings.components),
    offsets: toU32(postings.offsets),
    ids: toU32(postings.ids)
  };
}

function normalizeLevel(level) {
  return {
    decomp: {
      charBranchOffsets: toU32(level.decomp.charBranchOffsets),
      branchComponentOffsets: toU32(level.decomp.branchComponentOffsets),
      branchComponents: toU32(level.decomp.branchComponents),
      branchToChar: toU32(level.decomp.branchToChar)
    },
    directPostings: normalizePostings(level.directPostings),
    directBranchPostings: normalizePostings(level.directBranchPostings),
    recursiveBranchPostings: normalizePostings(level.recursiveBranchPostings)
  };
}

async function inflateNative(compressed) {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([compressed]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function reportInitProgress(phase, loaded = 0, total = 0) {
  self.postMessage({
    type: 'init-progress',
    phase,
    loaded,
    total,
    percent: total > 0
      ? Math.min(100, Math.round((loaded / total) * 100))
      : null
  });
}

async function downloadDatabase(databaseUrl) {
  reportInitProgress('download', 0, 0);

  const response = await fetch(databaseUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Database HTTP ${response.status}`);

  const contentLength = Number(response.headers.get('content-length'));
  const total =
    Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;

  if (!response.body) {
    const compressed = new Uint8Array(await response.arrayBuffer());
    reportInitProgress(
      'download',
      compressed.byteLength,
      total || compressed.byteLength
    );
    return compressed;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastPercent = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    chunks.push(value);
    loaded += value.byteLength;

    const percent = total > 0
      ? Math.min(100, Math.round((loaded / total) * 100))
      : null;
    if (percent === null || percent !== lastPercent) {
      lastPercent = percent;
      reportInitProgress('download', loaded, total);
    }
  }

  const compressed = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.byteLength;
  }

  reportInitProgress('download', loaded, total || loaded);
  return compressed;
}

async function initialize(databaseUrl) {
  const compressed = await downloadDatabase(databaseUrl);
  reportInitProgress('loading');
  const db = unpack(await inflateNative(compressed));

  if (db.schema !== SEEKER_CONFIG.database.schema) {
    throw new Error(`Unsupported Seeker database schema ${db.schema}`);
  }

  metadata = db.metadata ?? {};
  characters = toU32(db.characters);
  standardWords = toU32(db.standardWords);
  levels = {
    lv1: normalizeLevel(db.lv1),
    lv2: normalizeLevel(db.lv2)
  };

  const blockIndexByKey = new Map(
    SEEKER_CONFIG.blocks.map((block, index) => [block.key, index])
  );
  blockIndexes = new Uint8Array(characters.length);
  for (let id = 0; id < characters.length; id++) {
    blockIndexes[id] = blockIndexByKey.get(getBlockByCodePoint(characters[id]).key) ?? 0;
  }

  ready = true;

  return {
    ...metadata,
    validCharacterCount: characters.length,
    databaseBytes: compressed.byteLength
  };
}

function binarySearch(array, value) {
  let low = 0;
  let high = array.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const current = array[mid];
    if (current === value) return mid;
    if (current < value) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

function getCharacterId(codePoint) {
  return binarySearch(characters, codePoint);
}

function getPostingFrom(postings, component) {
  const index = binarySearch(postings.components, component);
  if (index < 0) return EMPTY_U32;
  return postings.ids.subarray(postings.offsets[index], postings.offsets[index + 1]);
}

function getPosting(level, component) {
  return getPostingFrom(level.directPostings, component);
}

function getBranchPosting(level, component, recursive) {
  return getPostingFrom(
    recursive ? level.recursiveBranchPostings : level.directBranchPostings,
    component
  );
}

function isStandard(id) {
  const word = standardWords[id >>> 5] ?? 0;
  return Boolean(word & (1 << (id & 31)));
}

function getLevel(useVariant) {
  return useVariant ? levels.lv2 : levels.lv1;
}

function getBranches(level, id) {
  const decomp = level.decomp;
  const startBranch = decomp.charBranchOffsets[id];
  const endBranch = decomp.charBranchOffsets[id + 1];
  const branches = [];

  for (let branch = startBranch; branch < endBranch; branch++) {
    branches.push(
      decomp.branchComponents.subarray(
        decomp.branchComponentOffsets[branch],
        decomp.branchComponentOffsets[branch + 1]
      )
    );
  }
  return branches;
}

function parseQuery(input) {
  const components = [];
  let requestedBlockMask = 0;
  let hasExplicitBlock = false;

  for (const char of toChars(input)) {
    const block = BLOCK_BY_MARKER.get(char);
    if (block) {
      requestedBlockMask |= block.bit;
      hasExplicitBlock = true;
      continue;
    }

    const codePoint = char.codePointAt(0);
    if (
      codePoint >= SEEKER_CONFIG.syntax.idcStart &&
      codePoint <= SEEKER_CONFIG.syntax.idcEnd
    ) {
      continue;
    }
    if (codePoint <= 0x7f) continue;
    components.push(codePoint);
  }

  components.sort((a, b) => a - b);
  return { components, requestedBlockMask, hasExplicitBlock };
}

function resolveBlockMask({ force, requestedBlockMask, hasExplicitBlock, components }) {
  if (hasExplicitBlock) return requestedBlockMask;
  if (force) return ALL_BLOCK_MASK;
  if (components?.some(isTangutSearchCodePoint)) {
    return getBlockByKey('TAN').bit;
  }
  return getBlockByKey(SEEKER_CONFIG.search.defaultLiveBlockKey).bit;
}

function uniqueSorted(values) {
  const result = [];
  let previous = -1;
  for (const value of values) {
    if (value !== previous) result.push(value);
    previous = value;
  }
  return result;
}

function intersectTwoSorted(a, b) {
  const result = new Uint32Array(Math.min(a.length, b.length));
  let i = 0;
  let j = 0;
  let w = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result[w++] = a[i];
      i++;
      j++;
    } else if (a[i] < b[j]) i++;
    else j++;
  }
  return result.subarray(0, w);
}

function intersectPostingLists(lists) {
  if (lists.some(list => !list.length)) return EMPTY_U32;
  lists.sort((a, b) => a.length - b.length);

  let result = lists[0];
  for (let i = 1; i < lists.length && result.length; i++) {
    result = intersectTwoSorted(result, lists[i]);
  }
  return result;
}

function branchIdsToCharacterIds(level, branchIds, selfCodePoint = null) {
  const extraId = selfCodePoint === null ? -1 : getCharacterId(selfCodePoint);
  const result = new Uint32Array(branchIds.length + (extraId >= 0 ? 1 : 0));
  let write = 0;
  let previous = -1;
  let extraWritten = extraId < 0;

  const writeId = id => {
    if (id === previous) return;
    result[write++] = id;
    previous = id;
  };

  for (const branchId of branchIds) {
    const charId = level.decomp.branchToChar[branchId];
    if (!extraWritten && extraId < charId) {
      writeId(extraId);
      extraWritten = true;
    }
    writeId(charId);
    if (!extraWritten && extraId === charId) extraWritten = true;
  }

  if (!extraWritten) writeId(extraId);
  return result.subarray(0, write);
}

function candidateIntersection(components, useVariant, recursive) {
  const level = getLevel(useVariant);
  const unique = uniqueSorted(components);

  if (!recursive && components.length === 1) {
    return getPosting(level, components[0]);
  }

  const branchIds = intersectPostingLists(
    unique.map(component => getBranchPosting(level, component, recursive))
  );
  if (!branchIds.length) {
    if (recursive && components.length === 1) {
      const selfId = getCharacterId(components[0]);
      return selfId >= 0 ? Uint32Array.of(selfId) : EMPTY_U32;
    }
    return EMPTY_U32;
  }

  const required = requiredCounts(components);
  const hasDuplicates = [...required.values()].some(count => count > 1);
  if (!hasDuplicates) {
    return branchIdsToCharacterIds(
      level,
      branchIds,
      recursive && components.length === 1 ? components[0] : null
    );
  }

  const qualifyingBranches = new Uint32Array(branchIds.length);
  let branchWrite = 0;
  const recursiveMemo = recursive ? new Map() : null;
  for (const branchId of branchIds) {
    const branch = getBranch(level, branchId);
    const matches = recursive
      ? recursiveBranchMatches(level, branch, required, recursiveMemo)
      : directBranchMatches(branch, required);
    if (matches) qualifyingBranches[branchWrite++] = branchId;
  }

  return branchIdsToCharacterIds(
    level,
    qualifyingBranches.subarray(0, branchWrite),
    null
  );
}
function getBranch(level, branchId) {
  const decomp = level.decomp;
  return decomp.branchComponents.subarray(
    decomp.branchComponentOffsets[branchId],
    decomp.branchComponentOffsets[branchId + 1]
  );
}

function requiredCounts(components) {
  const counts = new Map();
  for (const cp of components) counts.set(cp, (counts.get(cp) ?? 0) + 1);
  return counts;
}

function directBranchMatches(branch, required) {
  if (!required.size) return true;
  const counts = new Map();
  for (const cp of branch) {
    if (!required.has(cp)) continue;
    counts.set(cp, (counts.get(cp) ?? 0) + 1);
  }
  for (const [cp, needed] of required) {
    if ((counts.get(cp) ?? 0) < needed) return false;
  }
  return true;
}

function countRecursiveOccurrence(level, part, needle, stack, memo) {
  if (part === needle) return 1;
  const key = `${part}:${needle}`;
  if (memo.has(key)) return memo.get(key);
  if (stack.has(part)) return 0;

  const id = getCharacterId(part);
  if (id < 0) return 0;
  const branches = getBranches(level, id);
  if (!branches.length) return 0;

  stack.add(part);
  let best = 0;
  for (const branch of branches) {
    let count = 0;
    for (const child of branch) {
      count += countRecursiveOccurrence(level, child, needle, stack, memo);
    }
    if (count > best) best = count;
  }
  stack.delete(part);
  memo.set(key, best);
  return best;
}

function recursiveBranchMatches(level, branch, required, memo) {
  for (const [needle, needed] of required) {
    let count = 0;
    for (const part of branch) {
      count += countRecursiveOccurrence(level, part, needle, new Set(), memo);
      if (count >= needed) break;
    }
    if (count < needed) return false;
  }
  return true;
}

function isSearchCancelled(token) {
  return token !== searchEpoch;
}

const yieldResolvers = [];
let yieldChannel = null;

function yieldToWorker() {
  if (typeof MessageChannel !== 'undefined') {
    if (!yieldChannel) {
      yieldChannel = new MessageChannel();
      yieldChannel.port1.onmessage = () => {
        const resolve = yieldResolvers.shift();
        if (resolve) resolve();
      };
    }
    return new Promise(resolve => {
      yieldResolvers.push(resolve);
      yieldChannel.port2.postMessage(0);
    });
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function search(payload, token) {
  const startedAt = performance.now();
  const {
    query: input = '',
    ignore = '',
    variant = false,
    divide = false,
    force = false,
    standardOnly = false
  } = payload;

  const parsed = parseQuery(input);
  if (!parsed.components.length) {
    return {
      found: [],
      meta: {
        force,
        candidateCount: 0,
        durationMs: performance.now() - startedAt
      }
    };
  }

  const candidates = candidateIntersection(parsed.components, variant, divide);
  if (isSearchCancelled(token)) return { cancelled: true };

  const ignoreSet = new Set(toChars(ignore).map(char => char.codePointAt(0)));
  const blockMask = resolveBlockMask({
    force,
    requestedBlockMask: parsed.requestedBlockMask,
    hasExplicitBlock: parsed.hasExplicitBlock,
    components: parsed.components
  });
  const found = [];

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0 && i % SEEKER_CONFIG.search.cooperativeYieldEvery === 0) {
      await yieldToWorker();
      if (isSearchCancelled(token)) return { cancelled: true };
    }

    const id = candidates[i];
    const unicode = characters[id];
    if (ignoreSet.has(unicode)) continue;
    if (standardOnly && !isStandard(id)) continue;

    const block = SEEKER_CONFIG.blocks[blockIndexes[id]];
    if (!(blockMask & block.bit)) continue;

    found.push({
      char: String.fromCodePoint(unicode),
      unicode,
      blockKey: block.key
    });
  }

  return {
    found,
    meta: {
      force,
      candidateCount: candidates.length,
      durationMs: performance.now() - startedAt,
      blockMask,
      database: metadata?.source ?? 'yi-bai/ids',
      recursiveIndex: Boolean(divide)
    }
  };
}

function decompose(payload) {
  const char = toChars(payload.char)[0];
  if (!char) return '';
  const id = getCharacterId(char.codePointAt(0));
  if (id < 0) return '';
  const level = getLevel(Boolean(payload.variant));
  const branches = getBranches(level, id);
  if (!branches.length) return '';

  const first = branches[0];
  if (!payload.recursive) {
    return Array.from(first, cp => String.fromCodePoint(cp)).join('');
  }

  const flatten = (cp, stack, depth) => {
    if (depth >= SEEKER_CONFIG.search.maxTreeDepth || stack.has(cp)) {
      return String.fromCodePoint(cp);
    }
    const childId = getCharacterId(cp);
    if (childId < 0) return String.fromCodePoint(cp);
    const childBranches = getBranches(level, childId);
    if (!childBranches.length || !childBranches[0].length) {
      return String.fromCodePoint(cp);
    }
    stack.add(cp);
    const text = Array.from(childBranches[0], child =>
      flatten(child, stack, depth + 1)
    ).join('');
    stack.delete(cp);
    return text || String.fromCodePoint(cp);
  };

  return Array.from(first, cp =>
    flatten(cp, new Set([char.codePointAt(0)]), 0)
  ).join('');
}

function tree(payload) {
  const char = toChars(payload.char)[0];
  if (!char) return [];
  const root = char.codePointAt(0);
  const id = getCharacterId(root);
  if (id < 0) return [];
  const level = getLevel(Boolean(payload.variant));
  const maxBranches = 8;

  const formatPart = (cp, stack, depth) => {
    const glyph = String.fromCodePoint(cp);
    if (depth >= SEEKER_CONFIG.search.maxTreeDepth || stack.has(cp)) return glyph;
    const childId = getCharacterId(cp);
    if (childId < 0) return glyph;
    const childBranches = getBranches(level, childId);
    if (!childBranches.length) return glyph;

    stack.add(cp);
    const nested = childBranches
      .slice(0, maxBranches)
      .map(branch =>
        Array.from(branch, child => formatPart(child, stack, depth + 1)).join('')
      )
      .filter(Boolean);
    stack.delete(cp);
    return nested.length ? `${glyph}(${nested.join('┇')})` : glyph;
  };

  return getBranches(level, id)
    .slice(0, maxBranches)
    .map(branch =>
      Array.from(branch, cp => formatPart(cp, new Set([root]), 0)).join('')
    );
}

function ensureReady(type) {
  if (!ready && type !== 'init') throw new Error('Seeker database is not ready');
}

async function respond(id, type, payload) {
  try {
    ensureReady(type);
    if (type === 'search') {
      const token = ++searchEpoch;
      const result = await search(payload, token);
      self.postMessage({ type: 'response', id, result });
      return;
    }

    let result;
    if (type === 'decompose') result = decompose(payload);
    else if (type === 'tree') result = tree(payload);
    else throw new Error(`Unknown Seeker message: ${type}`);
    self.postMessage({ type: 'response', id, result });
  } catch (error) {
    self.postMessage({
      type: 'response',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

self.addEventListener('message', event => {
  const { type, id = 0, payload = {} } = event.data ?? {};

  if (type === 'cancel-search') {
    searchEpoch++;
    return;
  }

  if (type === 'init') {
    initialize(payload.databaseUrl)
      .then(stats => self.postMessage({ type: 'ready', stats }))
      .catch(error => {
        self.postMessage({
          type: 'init-error',
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return;
  }

  void respond(id, type, payload);
});
