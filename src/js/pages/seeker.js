import '@css/mainStyles.css';
import '@css/pages/seeker.css';

import '@js/iframeColorSchemeSync.js';
import '@js/changeHeader.js';
import '@js/m3ui.js';

import SEEKER_CONFIG, {
  getBlockByCodePoint,
  getBlockByKey,
  getCharacterUrlTemplate
} from '@js/seeker/config.js';
import SeekerClient from '@js/seeker/client.js';
import STROKE_KEYBOARD from '@js/seeker/keyboard.js';

const elements = {
  app: document.getElementById('seekerApp'),
  input: document.getElementById('queryInput'),
  clearButton: document.getElementById('clearButton'),
  decomposeButton: document.getElementById('decomposeButton'),
  searchButton: document.getElementById('searchButton'),
  variantSwitch: document.getElementById('variantSwitch'),
  subdivideSwitch: document.getElementById('subdivideSwitch'),
  standardOnlySwitch: document.getElementById('standardOnlySwitch'),
  keypadSwitch: document.getElementById('keypadSwitch'),
  datasetStatus: document.getElementById('datasetStatus'),
  version: document.getElementById('version'),
  shortcutPanel: document.getElementById('shortcutPanel'),
  shortcutBar: document.getElementById('shortcutBar'),
  keyboardPanel: document.getElementById('keyboardPanel'),
  keypad: document.getElementById('keypad'),
  searchStatus: document.getElementById('searchStatus'),
  blockLegend: document.getElementById('blockLegend'),
  treeResult: document.getElementById('treeResult'),
  resultSections: document.getElementById('resultSections'),
  charMenu: document.getElementById('charMenu'),
  menuChar: document.getElementById('menuChar'),
  menuCode: document.getElementById('menuCode'),
  menuExternal: document.getElementById('menuExternal'),
  copyToast: document.getElementById('copyToast'),
  copyToastChar: document.getElementById('copyToastChar')
};

const client = new SeekerClient();
const resultViews = new Map();

const state = {
  ime: false,
  searchTimer: null,
  toastTimer: null,
  menuHideTimer: null,
  menuAnchor: null,
  menuChar: '',
  shortcuts: [],
  keyboardBuilt: false
};

let menuAnimation = null;
let toastAnimation = null;
let menuLayoutFrame = 0;
let lastScrollAt = -Infinity;

const menuAnchorObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (
      entry.target === state.menuAnchor &&
      (!entry.isIntersecting || entry.intersectionRatio === 0)
    ) {
      hideCharMenu();
    }
  }
}, { threshold: 0 });

function getStored(key, fallback = '0') {
  return localStorage.getItem(key) ?? fallback;
}

function setStoredSwitch(element, key) {
  localStorage.setItem(key, element.selected ? '1' : '0');
}

function charArray(value) {
  return Array.from(value ?? '');
}

function formatCharacterUrl(template, char) {
  const unicode = char.codePointAt(0);
  return template
    .replace('$CHR$', char)
    .replace('$ENC$', encodeURIComponent(char))
    .replace('$UCD$', String(unicode))
    .replace('$UCh$', unicode.toString(16))
    .replace('$UCH$', unicode.toString(16).toUpperCase());
}

function getCursorPosition() {
  const position = elements.input.selectionStart;
  return Number.isInteger(position) ? position : elements.input.value.length;
}

function setCursorPosition(position) {
  elements.input.focus();
  elements.input.setSelectionRange?.(position, position);
}

function selectedText() {
  const start = elements.input.selectionStart;
  const end = elements.input.selectionEnd;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return '';
  return elements.input.value.slice(start, end);
}

function deleteSelection() {
  const start = elements.input.selectionStart;
  const end = elements.input.selectionEnd;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start === end) {
    return getCursorPosition();
  }

  elements.input.value =
    elements.input.value.slice(0, start) + elements.input.value.slice(end);
  setCursorPosition(start);
  return start;
}

function insertAtCursor(text, runSearch = true) {
  const position = deleteSelection();
  const value = elements.input.value;
  elements.input.value =
    value.slice(0, position) + text + value.slice(position);
  setCursorPosition(position + text.length);
  if (runSearch) scheduleSearch(false);
}

function replaceQuery(text) {
  elements.input.value = text;
  setCursorPosition(text.length);
  scheduleSearch(false);
}

function clearResults() {
  hideCharMenu();
  elements.treeResult.hidden = true;
  elements.treeResult.replaceChildren();

  for (const view of resultViews.values()) {
    view.section.hidden = true;
    view.grid.replaceChildren();
    view.count.textContent = '0';
    view.entries = [];
    view.rendered = 0;
    view.moreButton.hidden = true;
  }
}

function applyBlockTheme(element, block) {
  element.style.setProperty('--block-color', `var(${block.colorVar})`);
  element.style.setProperty('--block-foreground', `var(${block.foregroundVar})`);
}

function buildBlockLegend() {
  const fragment = document.createDocumentFragment();

  for (const block of SEEKER_CONFIG.blocks) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `block-chip ${block.key}`;
    button.dataset.marker = block.marker;
    button.title = `插入区块标记 ${block.marker}：${block.label}`;
    applyBlockTheme(button, block);

    const symbol = document.createElement('span');
    symbol.className = 'block-chip-symbol';
    symbol.textContent = block.shortLabel;

    const label = document.createElement('span');
    label.className = 'block-chip-label';
    label.textContent = block.label;

    button.append(symbol, label);
    fragment.appendChild(button);
  }

  elements.blockLegend.replaceChildren(fragment);
}

function buildResultSections() {
  const fragment = document.createDocumentFragment();

  for (const block of SEEKER_CONFIG.blocks) {
    const section = document.createElement('section');
    section.className = 'result-section';
    section.dataset.block = block.key;
    section.hidden = true;

    const heading = document.createElement('div');
    heading.className = 'result-section-heading';

    const title = document.createElement('span');
    title.textContent = block.label;

    const count = document.createElement('span');
    count.textContent = '0';

    const grid = document.createElement('div');
    grid.className = 'result-grid han';

    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'load-more-button';
    moreButton.dataset.loadMore = block.key;
    moreButton.hidden = true;

    heading.append(title, count);
    section.append(heading, grid, moreButton);
    fragment.appendChild(section);
    resultViews.set(block.key, {
      section,
      count,
      grid,
      moreButton,
      entries: [],
      rendered: 0
    });
  }

  elements.resultSections.replaceChildren(fragment);
}

function makeComponentButton(char) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'component-key han';
  button.dataset.char = char;
  button.textContent = char;
  return button;
}

function appendKeyboardText(container, text) {
  for (const char of charArray(text)) {
    if (char === ',') {
      container.appendChild(document.createElement('br'));
      continue;
    }

    const button = makeComponentButton(char);
    if (button) container.appendChild(button);
  }
}

function buildKeyboard() {
  const table = document.createElement('table');
  table.className = STROKE_KEYBOARD.className;
  const tbody = document.createElement('tbody');

  for (const [label, value] of Object.entries(STROKE_KEYBOARD.groups)) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    const content = document.createElement('td');
    heading.scope = 'row';
    heading.textContent = label;

    if (typeof value === 'string') {
      appendKeyboardText(content, value);
    } else {
      for (const [subLabel, subText] of Object.entries(value)) {
        const subgroup = document.createElement('span');
        subgroup.className = 'sub';

        const subgroupLabel = document.createElement('span');
        subgroupLabel.className = 'tag';
        subgroupLabel.textContent = subLabel;
        subgroup.appendChild(subgroupLabel);
        appendKeyboardText(subgroup, subText);
        content.appendChild(subgroup);
      }
    }

    row.append(heading, content);
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  elements.keypad.replaceChildren(table);
  state.keyboardBuilt = true;
}

function ensureKeyboardBuilt() {
  if (!state.keyboardBuilt) buildKeyboard();
}

function loadShortcuts() {
  const raw = getStored(SEEKER_CONFIG.storage.shortcuts, '');
  state.shortcuts = raw ? raw.split(' ').filter(Boolean) : [];
  renderShortcuts();
}

function saveShortcuts() {
  if (state.shortcuts.length) {
    localStorage.setItem(
      SEEKER_CONFIG.storage.shortcuts,
      state.shortcuts.join(' ')
    );
  } else {
    localStorage.removeItem(SEEKER_CONFIG.storage.shortcuts);
  }
}

function renderShortcuts() {
  const fragment = document.createDocumentFragment();

  for (const char of state.shortcuts) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shortcut-key han';
    button.dataset.char = char;
    button.textContent = char;
    fragment.appendChild(button);
  }

  elements.shortcutBar.replaceChildren(fragment);
  elements.shortcutPanel.hidden = state.shortcuts.length === 0;
}

function toggleShortcut(char) {
  const index = state.shortcuts.indexOf(char);
  if (index >= 0) {
    state.shortcuts.splice(index, 1);
  } else {
    if (state.shortcuts.length >= SEEKER_CONFIG.ui.shortcutLimit) {
      state.shortcuts.shift();
    }
    state.shortcuts.push(char);
  }
  saveShortcuts();
  renderShortcuts();
  updateFavoriteAction();
}

function updateFavoriteAction() {
  const button = elements.charMenu.querySelector('[data-action="favorite"]');
  if (!button || !state.menuChar) return;
  button.textContent = state.shortcuts.includes(state.menuChar)
    ? '移出收藏栏'
    : '加入收藏栏';
}

function createResultButton(entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'result-char han';
  button.dataset.char = entry.char;
  applyBlockTheme(button, getBlockByKey(entry.blockKey));
  button.title = `U+${entry.unicode.toString(16).toUpperCase()}`;
  button.textContent = entry.char;

  return button;
}

function appendResultPage(view) {
  const start = view.rendered;
  const end = Math.min(start + SEEKER_CONFIG.ui.resultPageSize, view.entries.length);
  if (start >= end) return;

  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    fragment.appendChild(createResultButton(view.entries[i]));
  }
  view.grid.appendChild(fragment);
  view.rendered = end;
  view.moreButton.hidden = end >= view.entries.length;
  if (!view.moreButton.hidden) {
    view.moreButton.textContent = `显示更多（${view.entries.length - end}）`;
  }
}

function renderResults(found) {
  clearResults();
  const grouped = new Map();

  for (const entry of found) {
    let list = grouped.get(entry.blockKey);
    if (!list) {
      list = [];
      grouped.set(entry.blockKey, list);
    }
    list.push(entry);
  }

  for (const [blockKey, entries] of grouped) {
    const view = resultViews.get(blockKey);
    if (!view) continue;
    view.entries = entries;
    view.rendered = 0;
    view.grid.replaceChildren();
    view.count.textContent = String(entries.length);
    view.section.hidden = false;
    appendResultPage(view);
  }
}

function renderTree(char, branches) {
  clearResults();
  elements.treeResult.hidden = false;

  const title = document.createElement('span');
  title.className = 'tree-result-title';
  title.textContent = `${char} 的拆分`;
  elements.treeResult.appendChild(title);

  if (!branches?.length) {
    const line = document.createElement('div');
    line.textContent = '(无法再分解)';
    elements.treeResult.appendChild(line);
    return;
  }

  for (const branch of branches) {
    const line = document.createElement('div');
    line.textContent = branch || '(无法再分解)';
    elements.treeResult.appendChild(line);
  }
}

function statusText(foundCount) {
  return `找到 ${foundCount} 字`;
}

async function runSearch(force) {
  if (state.ime) return;
  clearTimeout(state.searchTimer);
  client.cancelSearch();

  let value = (selectedText() || elements.input.value).replace(/\s/g, '');
  clearResults();

  if (!value) {
    elements.searchStatus.textContent = '';
    return;
  }

  const divide = elements.subdivideSwitch.selected;

  if (value.startsWith(SEEKER_CONFIG.syntax.treePrefix)) {
    const char = charArray(value.slice(SEEKER_CONFIG.syntax.treePrefix.length))[0];
    if (!char) return;

    elements.searchStatus.textContent = '正在分解…';
    try {
      const tree = await client.tree({
        char,
        variant: elements.variantSwitch.selected
      });
      renderTree(char, tree);
      elements.searchStatus.textContent = '分解完成';
    } catch (error) {
      elements.searchStatus.textContent = `分解失败：${error.message}`;
      console.error(error);
    }
    return;
  }

  let ignore = '';
  const separator = value.indexOf(SEEKER_CONFIG.syntax.ignoreSeparator);
  if (separator >= 0) {
    ignore = value.slice(separator + SEEKER_CONFIG.syntax.ignoreSeparator.length);
    value = value.slice(0, separator);
  }

  if (!value) return;

  elements.searchStatus.textContent = '正在检索…';

  try {
    const response = await client.search({
      query: value,
      ignore,
      variant: elements.variantSwitch.selected,
      divide,
      force: Boolean(force),
      standardOnly: elements.standardOnlySwitch.selected
    });

    if (response.stale) return;
    renderResults(response.found);
    elements.searchStatus.textContent = statusText(response.found.length);
  } catch (error) {
    elements.searchStatus.textContent = `检索失败：${error.message}`;
    console.error(error);
  }
}

function scheduleSearch(force = false) {
  clearTimeout(state.searchTimer);
  if (force) {
    runSearch(true);
    return;
  }

  state.searchTimer = setTimeout(
    () => runSearch(false),
    SEEKER_CONFIG.search.inputDebounceMs
  );
}

async function decomposeBeforeCursor() {
  const cursor = getCursorPosition();
  if (cursor <= 0) return;

  const before = elements.input.value.slice(0, cursor);
  const chars = charArray(before);
  const char = chars.at(-1);
  if (!char) return;

  try {
    const decomposition = await client.decompose({
      char,
      variant: elements.variantSwitch.selected,
      recursive: elements.subdivideSwitch.selected
    });
    if (!decomposition) return;

    const head = before.slice(0, before.length - char.length);
    const tail = elements.input.value.slice(cursor).replace(/\\/g, '');
    elements.input.value = head + decomposition + tail;
    setCursorPosition(head.length + decomposition.length);
    scheduleSearch(false);
  } catch (error) {
    elements.searchStatus.textContent = `拆分失败：${error.message}`;
    console.error(error);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  clearTimeout(state.toastTimer);
  toastAnimation?.cancel();
  elements.copyToastChar.textContent = text;
  elements.copyToast.hidden = false;

  if (prefersReducedMotion()) {
    state.toastTimer = setTimeout(() => {
      elements.copyToast.hidden = true;
    }, SEEKER_CONFIG.ui.toastDurationMs);
    return;
  }

  const animation = elements.copyToast.animate(
    [
      { opacity: 0, transform: 'translate(-50%, 8px)' },
      { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.15 },
      { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%, 0)' }
    ],
    { duration: SEEKER_CONFIG.ui.toastDurationMs, easing: 'ease' }
  );
  toastAnimation = animation;
  animation.onfinish = () => {
    if (toastAnimation !== animation) return;
    elements.copyToast.hidden = true;
    toastAnimation = null;
  };
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hideCharMenu() {
  clearTimeout(state.menuHideTimer);
  if (elements.charMenu.hidden || state.menuAnchor === null) return;

  menuAnchorObserver.disconnect();
  if (menuLayoutFrame) {
    cancelAnimationFrame(menuLayoutFrame);
    menuLayoutFrame = 0;
  }
  const currentOpacity = getComputedStyle(elements.charMenu).opacity;
  state.menuAnchor = null;
  menuAnimation?.cancel();

  if (prefersReducedMotion()) {
    elements.charMenu.hidden = true;
    return;
  }

  const animation = elements.charMenu.animate(
    [{ opacity: currentOpacity }, { opacity: 0 }],
    { duration: 300, easing: 'ease' }
  );
  menuAnimation = animation;
  animation.onfinish = () => {
    if (menuAnimation !== animation) return;
    elements.charMenu.hidden = true;
    menuAnimation = null;
  };
}

function scheduleHideCharMenu() {
  clearTimeout(state.menuHideTimer);
  state.menuHideTimer = setTimeout(
    hideCharMenu,
    SEEKER_CONFIG.ui.hideMenuDelayMs
  );
}

function positionCharMenu(anchor = state.menuAnchor) {
  if (!anchor?.isConnected) return null;

  const menuRect = elements.charMenu.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const margin = 8;
  let left = anchorRect.left;
  let top = anchorRect.bottom + margin;

  if (top + menuRect.height > window.innerHeight - margin) {
    top = anchorRect.top - menuRect.height - margin;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - menuRect.height - margin));
  elements.charMenu.style.left = `${left}px`;
  elements.charMenu.style.top = `${top}px`;
  return { left, top };
}

function scheduleCharMenuPositionUpdate() {
  clearTimeout(state.menuHideTimer);
  if (!state.menuAnchor || menuLayoutFrame) return;

  menuLayoutFrame = requestAnimationFrame(() => {
    menuLayoutFrame = 0;
    if (!state.menuAnchor) return;
    if (!positionCharMenu()) hideCharMenu();
  });
}

function onCharMenuScroll() {
  lastScrollAt = performance.now();
  scheduleCharMenuPositionUpdate();
}

function showCharMenu(anchor, char) {
  if (!anchor || !char) return;
  clearTimeout(state.menuHideTimer);
  if (
    !elements.charMenu.hidden &&
    state.menuAnchor === anchor &&
    state.menuChar === char
  ) return;

  const previousAnchor = state.menuAnchor;
  const wasVisible = !elements.charMenu.hidden;
  const previousRect = wasVisible
    ? elements.charMenu.getBoundingClientRect()
    : null;
  menuAnimation?.cancel();

  menuAnchorObserver.disconnect();
  state.menuAnchor = anchor;
  state.menuChar = char;
  menuAnchorObserver.observe(anchor);

  const unicode = char.codePointAt(0);
  const block = getBlockByCodePoint(unicode);
  elements.menuChar.textContent = char;
  elements.menuChar.className = 'char-preview-glyph han';

  elements.menuCode.textContent = `U+${unicode.toString(16).toUpperCase()}\n${block.label}`;
  elements.menuCode.style.whiteSpace = 'pre-line';
  elements.menuExternal.href = formatCharacterUrl(
    getCharacterUrlTemplate(),
    char
  );
  updateFavoriteAction();

  elements.charMenu.hidden = false;
  const position = positionCharMenu(anchor);
  if (!position) {
    hideCharMenu();
    return;
  }
  const { left, top } = position;

  if (prefersReducedMotion()) return;

  let frames = null;
  if (wasVisible && previousAnchor && previousAnchor !== anchor) {
    frames = [
      {
        transform: `translate(${previousRect.left - left}px, ${previousRect.top - top}px)`
      },
      { transform: 'translate(0, 0)' }
    ];
  } else if (!wasVisible || !previousAnchor) {
    frames = [
      { opacity: 0, transform: 'translateY(6px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ];
  }

  if (frames) {
    const animation = elements.charMenu.animate(frames, {
      duration: 300,
      easing: 'ease'
    });
    menuAnimation = animation;
    animation.onfinish = () => {
      if (menuAnimation === animation) menuAnimation = null;
    };
  }
}

function setExcludedChar(char) {
  const separator = SEEKER_CONFIG.syntax.ignoreSeparator;
  if (!elements.input.value.includes(separator)) {
    elements.input.value += separator;
  }
  elements.input.value += char;
  setCursorPosition(elements.input.value.length);
  scheduleSearch(false);
}

function handleCharMenuAction(action) {
  const char = state.menuChar;
  if (!char) return;

  if (action === 'insert') insertAtCursor(char);
  else if (action === 'query') replaceQuery(char);
  else if (action === 'copy') copyText(char);
  else if (action === 'exclude') setExcludedChar(char);
  else if (action === 'favorite') toggleShortcut(char);

  if (action !== 'favorite') hideCharMenu();
}

function closestCharTarget(event) {
  const target = event.target.closest?.('[data-char]');
  if (!target || !elements.app.contains(target)) return null;
  return target;
}

function bindCharSurface(container, clickAction) {
  container.addEventListener('pointerover', event => {
    const target = closestCharTarget(event);
    if (target) showCharMenu(target, target.dataset.char);
  });

  container.addEventListener('pointerout', event => {
    const target = closestCharTarget(event);
    if (!target) return;
    if (elements.charMenu.contains(event.relatedTarget)) return;
    if (performance.now() - lastScrollAt < 200) return;
    scheduleHideCharMenu();
  });

  container.addEventListener('click', event => {
    const target = closestCharTarget(event);
    if (!target) return;
    clickAction(target.dataset.char, target);
  });
}

function bindEvents() {
  elements.input.addEventListener('compositionstart', () => {
    state.ime = true;
  });

  elements.input.addEventListener('compositionend', () => {
    state.ime = false;
    scheduleSearch(false);
  });

  elements.input.addEventListener('input', () => scheduleSearch(false));

  elements.input.addEventListener('keydown', event => {
    if (event.isComposing) return;

    if (event.code === 'Enter') {
      event.preventDefault();
      scheduleSearch(true);
    } else if (event.code === 'Escape') {
      elements.input.value = '';
      clearResults();
      elements.searchStatus.textContent = '';
    } else if (event.code === 'Backslash') {
      event.preventDefault();
      decomposeBeforeCursor();
    }
  });

  elements.clearButton.addEventListener('click', () => {
    elements.input.value = '';
    clearResults();
    elements.searchStatus.textContent = '';
    elements.input.focus();
  });

  elements.decomposeButton.addEventListener('click', decomposeBeforeCursor);
  elements.searchButton.addEventListener('click', () => scheduleSearch(true));

  const switches = [
    [elements.variantSwitch, SEEKER_CONFIG.storage.variant],
    [elements.subdivideSwitch, SEEKER_CONFIG.storage.subdivide],
    [elements.standardOnlySwitch, SEEKER_CONFIG.storage.standardOnly]
  ];

  for (const [element, key] of switches) {
    element.addEventListener('change', () => {
      setStoredSwitch(element, key);
      scheduleSearch(false);
    });
  }

  elements.keypadSwitch.addEventListener('change', () => {
    setStoredSwitch(elements.keypadSwitch, SEEKER_CONFIG.storage.showKeypad);
    elements.keyboardPanel.hidden = !elements.keypadSwitch.selected;
    if (elements.keypadSwitch.selected) ensureKeyboardBuilt();
  });

  elements.blockLegend.addEventListener('click', event => {
    const button = event.target.closest?.('[data-marker]');
    if (!button) return;
    insertAtCursor(button.dataset.marker);
  });

  elements.resultSections.addEventListener('click', event => {
    const button = event.target.closest?.('[data-load-more]');
    if (!button) return;
    const view = resultViews.get(button.dataset.loadMore);
    if (view) appendResultPage(view);
  });

  bindCharSurface(elements.keypad, char => insertAtCursor(char));
  bindCharSurface(elements.shortcutBar, char => insertAtCursor(char));
  bindCharSurface(elements.resultSections, (char, target) => {
    copyText(char);
    showCharMenu(target, char);
  });

  elements.charMenu.addEventListener('pointerenter', () => {
    clearTimeout(state.menuHideTimer);
  });
  elements.charMenu.addEventListener('pointerleave', () => {
    if (performance.now() - lastScrollAt >= 200) scheduleHideCharMenu();
  });
  elements.charMenu.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset.action;
    if (action) handleCharMenuAction(action);
  });

  document.addEventListener('pointerdown', event => {
    if (
      elements.charMenu.contains(event.target) ||
      event.target.closest?.('[data-char]')
    ) return;
    hideCharMenu();
  });

  window.addEventListener('resize', scheduleCharMenuPositionUpdate);
  window.addEventListener('scroll', onCharMenuScroll, {
    capture: true,
    passive: true
  });
  window.addEventListener('beforeunload', () => client.terminate());
}

function restoreSettings() {
  elements.variantSwitch.selected =
    getStored(SEEKER_CONFIG.storage.variant) === '1';
  elements.subdivideSwitch.selected =
    getStored(SEEKER_CONFIG.storage.subdivide) === '1';
  elements.standardOnlySwitch.selected =
    getStored(SEEKER_CONFIG.storage.standardOnly) === '1';
  elements.keypadSwitch.selected =
    getStored(SEEKER_CONFIG.storage.showKeypad) === '1';
  elements.keyboardPanel.hidden = !elements.keypadSwitch.selected;
  if (elements.keypadSwitch.selected) ensureKeyboardBuilt();
}

function initReadyState() {
  elements.datasetStatus.dataset.state = 'loading';
  elements.datasetStatus.textContent = '正在加载字形数据…';

  client.ready
    .then(stats => {
      elements.datasetStatus.dataset.state = 'ready';
      const tangutVersion = stats.tangutUnicode
        ? ` · 西夏 IDS ${stats.tangutUnicode}`
        : '';
      elements.datasetStatus.textContent =
        `可检索 ${Number(stats.validCharacterCount ?? 0).toLocaleString()} 字 · ` +
        `Unicode ${stats.unicode ?? '18.0'}${tangutVersion}`;
    })
    .catch(error => {
      elements.datasetStatus.dataset.state = 'error';
      elements.datasetStatus.textContent = '字形数据加载失败';
      elements.searchStatus.textContent = `初始化失败：${error.message}`;
      console.error(error);
    });
}

function init() {
  elements.version.textContent = SEEKER_CONFIG.version.label;
  buildBlockLegend();
  buildResultSections();
  restoreSettings();
  loadShortcuts();
  bindEvents();
  initReadyState();
}

init();
