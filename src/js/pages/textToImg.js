import '@css/mainStyles.css';
import '@css/nerd-fonts-generated.min.css';
import '@css/pages/textToImg.css';

import '@js/changeHeader.js';
import '@js/iframeColorSchemeSync.js';
import '@js/m3ui.js';

import notoColorEmojiFP from '@assets/fonts/display/Noto-COLRv1.woff2';
import plgo1FP from '@assets/fonts/display/Plgo1.woff2';
import plgo2FP from '@assets/fonts/display/Plgo2.woff2';
import notoSansSuperFP from '@assets/fonts/display/NotoSansSuper.woff2';
import notoFP from '@assets/fonts/display/NotoUnicode.woff2';
import wenYuanSansSCVFFP from '@assets/fonts/display/NotoSansSC.woff2';
import seshFP from '@assets/fonts/display/UnicodiaSesh.woff2';
import newGardinerFP from '@assets/fonts/display/NewGardiner.woff2';
import monuFP from '@assets/fonts/display/Monu Temp.woff2';
import lastFP from '@assets/fonts/display/Last ResortHE.woff2';

const textInput = document.getElementById('text');
const fontSizeInput = document.getElementById('fontSize');
const lineHeightInput = document.getElementById('lineHeight');
const paddingInput = document.getElementById('padding');
const maxWidthInput = document.getElementById('maxWidth');
const downloadBtn = document.getElementById('downloadBtn');
const uploadFontBtn = document.getElementById('uploadFont');
const fileInput = document.getElementById('fileInput');
const container = document.getElementById('sortableListContainer');
let itemsOrder = [];
let currentFontFamilies = [];
let fontLoaded = false;

String.prototype.toCharArray = function () {
  let arr = [];
  for (let i = 0; i < this.length; ) {
    const codePoint = this.codePointAt(i);
    i += codePoint > 0xffff ? 2 : 1;
    arr.push(String.fromCodePoint(codePoint));
  }
  return arr;
};

async function generateFontfamiliesStr(fontFamilies, fontSize) {
  if (!fontLoaded) {
    await loadFont('Plgo1', plgo1FP);
    await loadFont('Noto-Color-Emoji', notoColorEmojiFP);
    await loadFont('Plgo2', plgo2FP);
    await loadFont('NotoSansSuper', notoSansSuperFP);
    await loadFont('Noto', notoFP);
    await loadFont('WenYuanSansSCVF', wenYuanSansSCVFFP);
    await loadFont('Sesh', seshFP);
    await loadFont('NewGardiner', newGardinerFP);
    await loadFont('Monu', `'${monuFP}'`);
    await loadFont('Last', `'${lastFP}'`);
    fontLoaded = true;
  }
  const fallbackedFontFamilies = fontFamilies.concat([
    'Plgo1',
    'Noto-Color-Emoji',
    'Plgo2',
    'NotoSansSuper',
    'Noto',
    'WenYuanSansSCVF',
    'Sesh',
    'NewGardiner',
    'Monu',
    'sans-serif',
    'Last'
  ]);
  return `${fontSize}px ${fallbackedFontFamilies.join(', ')}`;
}


function wrapText(text, maxWidth, fontFamily) {
  if (maxWidth === 0) return text;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = fontFamily;

  const measureText = text => ctx.measureText(text).width;

  const originalLines = text.split('\n');
  const resultLines = [];

  for (const line of originalLines) {
    if (measureText(line) <= maxWidth) {
      resultLines.push(line);
      continue;
    }

    const chars = line.toCharArray();
    let currentLine = '';

    for (const char of chars) {
      const testLine = currentLine + char;
      const testWidth = measureText(testLine);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
        }
        currentLine = char;
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines.join('\n');
}

async function generateImage(
  text,
  fontFamilies,
  fontSize,
  lineHeight,
  padding,
  maxWidth
) {
  const dpr = window.devicePixelRatio || 1;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCtx.font = await generateFontfamiliesStr(fontFamilies, fontSize);
  const lines = wrapText(text, maxWidth, tempCtx.font).split('\n');

  const canvasWidth = calculateMaxLineWidth(lines, tempCtx);

  const textHeight = lines.length * lineHeight;

  tempCanvas.width = Math.ceil(canvasWidth * dpr + fontSize * dpr * 0.5);
  tempCanvas.height = Math.ceil(textHeight * dpr + fontSize * dpr * 0.5);
  tempCtx.scale(dpr, dpr);

  tempCtx.fillStyle = 'white';
  tempCtx.fillRect(0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
  tempCtx.fillStyle = 'black';
  tempCtx.font = await generateFontfamiliesStr(fontFamilies, fontSize);
  tempCtx.textBaseline = 'top';

  renderText(tempCtx, lines, lineHeight, fontSize * 0.25, fontSize * 0.25);
  return addCanvasPadding(tempCanvas, padding);
}

function renderText(ctx, lines, lineHeight, initialX, initialY) {
  let y = initialY;
  lines.forEach(line => {
    ctx.fillText(line, initialX, y);
    y += lineHeight;
  });
}

function calculateMaxLineWidth(lines, ctx) {
  let maxWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    if (metrics.width > maxWidth) {
      maxWidth = metrics.width;
    }
  }
  return maxWidth;
}

function addCanvasPadding(originalCanvas, padding) {
  const newCanvas = document.createElement('canvas');
  const ctx = newCanvas.getContext('2d');

  newCanvas.width = originalCanvas.width + padding * 2;
  newCanvas.height = originalCanvas.height + padding * 2;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

  ctx.drawImage(
    originalCanvas,
    padding,
    padding,
    originalCanvas.width,
    originalCanvas.height
  );

  return newCanvas;
}

downloadBtn.addEventListener('click', async () => {
  const text = textInput.value;
  const fontFamilies = currentFontFamilies;
  const fontSize = parseInt(fontSizeInput.value);
  const lineHeight = parseFloat(lineHeightInput.value);
  const padding = parseInt(paddingInput.value);
  const maxWidth = parseInt(maxWidthInput.value);

  const canvas = await generateImage(
    text,
    fontFamilies,
    fontSize,
    lineHeight,
    padding,
    maxWidth
  );
  if (!canvas) return;

  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'text-image.png';
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

uploadFontBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', event => {
  const file = event.target.files[0];
  if (file) {
    const isFont = isFontFile(file);
    if (!isFont) {
      alert('仅支持上传字体文件。');
      return;
    }

    const fontObjectURL = URL.createObjectURL(file);

    const fileName = file.name;

    insertItem(fileName, -1, fontObjectURL);
    updateInputFont();
    updateListVisibility();

    event.target.value = '';
  }
});

updateListVisibility();
container.addEventListener('click', event => {
  const button = event.target;
  const item = button.closest('.sortable-item');

  if (button.classList.contains('move-up')) {
    const prevItem = item.previousElementSibling;
    if (prevItem) {
      if (item.dataset.animating || prevItem.dataset.animating) return;
      flipAnimation(item, prevItem, 'up');
      updateOrderArray(item, prevItem);
      updateButtonStates();
      updateInputFont();
    }
  } else if (button.classList.contains('move-down')) {
    const nextItem = item.nextElementSibling;
    if (nextItem) {
      if (item.dataset.animating || nextItem.dataset.animating) return;
      flipAnimation(item, nextItem, 'down');
      updateOrderArray(item, nextItem);
      updateButtonStates();
      updateInputFont();
    }
  } else if (button.classList.contains('rem-button')) {
    deleteItem(item);
    updateInputFont();
    updateListVisibility();
  }
});

function isFontFile(file) {
  const fontMimeTypes = [
    'font/ttf',
    'font/otf',
    'font/woff',
    'font/woff2',
    'application/vnd.ms-fontobject',
    'font/collection'
  ];

  return fontMimeTypes.includes(file.type);
}

function updateListVisibility() {
  if (itemsOrder.length === 0) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
  }
}

function insertItem(text, index, fontObjectURL) {
  if (index < 0) {
    index = container.children.length + index + 1;
  }

  const newItem = document.createElement('div');
  newItem.className = 'sortable-item';

  const newItemText = document.createElement('span');
  newItemText.textContent = text;
  newItem.appendChild(newItemText);

  const moveUpButton = document.createElement('md-filled-tonal-icon-button');
  moveUpButton.className = 'move-up';

  const moveUpIcon = document.createElement('md-icon');
  moveUpIcon.className = 'nf nf-cod-arrow_up';

  moveUpButton.appendChild(moveUpIcon);
  newItem.appendChild(moveUpButton);

  const moveDownButton = document.createElement('md-filled-tonal-icon-button');
  moveDownButton.className = 'move-down';

  const moveDownIcon = document.createElement('md-icon');
  moveDownIcon.className = 'nf nf-cod-arrow_down';

  moveDownButton.appendChild(moveDownIcon);
  newItem.appendChild(moveDownButton);

  const deleteButton = document.createElement('md-filled-tonal-icon-button');
  deleteButton.className = 'rem-button';

  const deleteIcon = document.createElement('md-icon');
  deleteIcon.className = 'nf nf-fa-times';

  deleteButton.appendChild(deleteIcon);
  newItem.appendChild(deleteButton);

  if (fontObjectURL) {
    newItem.dataset.fontUrl = fontObjectURL;
  }

  if (index >= container.children.length) {
    container.appendChild(newItem);
  } else {
    container.insertBefore(newItem, container.children[index]);
  }

  itemsOrder.splice(index, 0, text);

  updateButtonStates();
}

function deleteItem(item) {
  const itemText = item.querySelector('span').textContent;
  const itemIndex = itemsOrder.indexOf(itemText);
  if (itemIndex !== -1) {
    itemsOrder.splice(itemIndex, 1);
  }

  item.remove();

  updateButtonStates();
}

async function loadFont(fontName, fontUrl) {
  const font = new FontFace(fontName, `url(${fontUrl})`);
  await font.load();
  document.fonts.add(font);
  await document.fonts.ready;

  return;
}

function updateInputFont() {
  const items = Array.from(container.children);

  items.forEach(async item => {
    const fontUrl = item.dataset.fontUrl;
    const fontName = item.querySelector('span').textContent;

    await loadFont(fontName, fontUrl);
  });

  currentFontFamilies = items.map(
    item => `'${item.querySelector('span').textContent}'`
  );
}

function flipAnimation(item, targetItem, direction) {
  item.style.zIndex = '1';
  item.dataset.animating = 'true';
  targetItem.dataset.animating = 'true';

  const firstRectItem = item.getBoundingClientRect();
  const firstRectTarget = targetItem.getBoundingClientRect();

  if (direction === 'up') {
    container.insertBefore(item, targetItem);
  } else if (direction === 'down') {
    container.insertBefore(targetItem, item);
  }

  const lastRectItem = item.getBoundingClientRect();
  const lastRectTarget = targetItem.getBoundingClientRect();

  const deltaXItem = firstRectItem.left - lastRectItem.left;
  const deltaYItem = firstRectItem.top - lastRectItem.top;
  const deltaXTarget = firstRectTarget.left - lastRectTarget.left;
  const deltaYTarget = firstRectTarget.top - lastRectTarget.top;

  applyFlipAnimation(item, deltaXItem, deltaYItem);
  applyFlipAnimation(targetItem, deltaXTarget, deltaYTarget);

  item.addEventListener(
    'transitionend',
    e => {
      if (e.srcElement !== item) return;
      item.style.zIndex = null;
      delete item.dataset.animating;
      delete targetItem.dataset.animating;
    },
    { once: true }
  );
}

function applyFlipAnimation(element, deltaX, deltaY) {
  const animation = element.animate(
    [
      {
        transform: `translate(${deltaX}px, ${deltaY}px)`
      },
      {
        transform: ''
      }
    ],
    { duration: 500, easing: 'ease' }
  );
  animation.addEventListener('finish', () => {
    element.style.zIndex = null;
    delete element.dataset.animating;
  });
}

function updateOrderArray(item, targetItem) {
  const itemIndex = itemsOrder.indexOf(item.querySelector('span').textContent);
  const targetIndex = itemsOrder.indexOf(
    targetItem.querySelector('span').textContent
  );

  [itemsOrder[itemIndex], itemsOrder[targetIndex]] = [
    itemsOrder[targetIndex],
    itemsOrder[itemIndex]
  ];
}

function updateButtonStates() {
  const items = Array.from(container.children);

  items.forEach((item, index) => {
    const moveUpButton = item.querySelector('.move-up');
    const moveDownButton = item.querySelector('.move-down');

    if (index === 0) {
      moveUpButton.disabled = true;
    } else {
      moveUpButton.disabled = false;
    }

    if (index === items.length - 1) {
      moveDownButton.disabled = true;
    } else {
      moveDownButton.disabled = false;
    }
  });
}
