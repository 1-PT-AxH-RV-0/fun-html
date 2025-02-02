import '../../css/mainStyles.css';
import '../../css/tools/seeker.css';

import '../iframeColorSchemeSync.js';
import '../changeHeader.js';
import '../m3ui.js';

import { dt, vt } from '../../data/handata_uni.js';
import { parts } from '../../data/parts.js';

const inputEle = document.getElementById('input');
const counter = document.getElementById('counter');
const versionEle = document.getElementById('version');
const datasizeEle = document.getElementById('datasize');
const keypad = document.getElementById('keypad');
const scKey = document.getElementById('scKey');

const buttClear = document.getElementById('buttClear');
const buttDecompose = document.getElementById('buttDecompose');
const buttGo = document.getElementById('buttGo');

const subdivideSwitch = document.getElementById('subdivide');
const variantSwitch = document.getElementById('variant');
const keypadSwitch = document.getElementById('showkeypad');

const popupEle = document.querySelector('.set-v2-popup');
const popupSym = document.querySelector('.set-v2-popup-symbol');

const outputElements = {
  BSC: document.getElementById('outputBSC'),
  ExA: document.getElementById('outputExA'),
  ExB: document.getElementById('outputExB'),
  ExC: document.getElementById('outputExC'),
  ExD: document.getElementById('outputExD'),
  ExE: document.getElementById('outputExE'),
  ExF: document.getElementById('outputExF'),
  ExG: document.getElementById('outputExG'),
  ExH: document.getElementById('outputExH'),
  ExI: document.getElementById('outputExI'),
  ExJ: document.getElementById('outputExJ'),
  CMP: document.getElementById('outputCMP'),
  SUP: document.getElementById('outputSUP'),
  OTH: document.getElementById('outputOTH')
};

const popviewElements = {
  popview: document.getElementById('popview'),
  bigchar: document.getElementById('bigchar'),
  codetag: document.getElementById('codetag'),
  menuKey: document.getElementById('menu_key'),
  menuGo: document.getElementById('menu_go'),
  menuQuery: document.getElementById('menu_query'),
  menuCopy: document.getElementById('menu_copy'),
  menuSkip: document.getElementById('menu_skip'),
  menuAdd: document.getElementById('menu_add'),
  menuDel: document.getElementById('menu_del')
};

const popViewVisibility = observeElementVisibility(popviewElements.popview);

let animation;
function popCopyMsg(char) {
  animation?.cancel();
  popupSym.innerHTML = char;
  animation = popupEle.animate(
    [
      { opacity: '0' },
      { opacity: '0.8', offset: 0.1 },
      { opacity: '0.8', offset: 0.9 },
      { opacity: '0' }
    ],
    { duration: 1200, easing: 'ease' }
  );
  setTimeout(() => (popupEle.style.display = 'block'), 16);
  animation.addEventListener('finish', () => {
    popupEle.style.display = 'none';
  });
}

function observeElementVisibility(element) {
  const visibilityState = {
    isVisible: false,
  };

  const options = {
    threshold: 0.01,
  };

  const callback = (entries) => {
    entries.forEach(entry => {
      visibilityState.isVisible = entry.isIntersecting;
    });
  };

  const observer = new IntersectionObserver(callback, options);

  observer.observe(element);

  return visibilityState;
}

const Config = {
  // $CHR$ 表示未经编码的汉字变量
  // $ENC$ 表示经URI编码的汉字变量
  // $UCD$ 表示汉字的10进制Unicode变量
  // $UCh$ 表示汉字的16进制小写Unicode变量
  // $UCH$ 表示汉字的16进制大写Unicode变量
  url: 'https://zi.tools/zi/$ENC$',

  // GlyphWiki网站的图片网址，默认输出uxxxxx.svg
  glyphwiki: 'https://seeki.vistudium.top/SVG/',

  // 指定哪个Range要采用图片显示 (true=图片显示，false=文本显示)
  useImage: {
    '-2': false,
    '-1': false,
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false,
    9: false,
    10: false,
    11: false
  },
  resultStep1: 299,
  resultStep2: 1999
};

const Seeker = {
  dataIndex: null,
  seg: 1000,
  interval: 50,
  totalmsec: 0,
  segcnt: 0,
  worker: null,
  result: null,
  groups: null,
  blockFlagMap: {
    '%': 1 << 30,
    $: 1 << 29,
    '&': 1 << 28,
    '#': 1 << 0,
    A: 1 << 1,
    B: 1 << 2,
    C: 1 << 3,
    D: 1 << 4,
    E: 1 << 5,
    F: 1 << 6,
    G: 1 << 7,
    H: 1 << 8,
    I: 1 << 9,
    J: 1 << 10
  },
  blockMap: {
    '-2': 1 << 30,
    '-1': 1 << 29,
    0: 1 << 28,
    1: 1 << 0,
    2: 1 << 1,
    3: 1 << 2,
    4: 1 << 3,
    5: 1 << 4,
    6: 1 << 5,
    7: 1 << 6,
    8: 1 << 7,
    9: 1 << 8,
    10: 1 << 9,
    11: 1 << 10
  },
  parts,
  get blockFlagAll() {
    return Object.values(Seeker.blockFlagMap).reduce(
      (acc, curr) => acc | curr,
      0
    );
  },
  getVersion() {
    return '版本：2.0.0.0   (2025年1月)';
  },
  variant(w, v) {
    return v && vt[w] ? vt[w] : w;
  },
  arraylize(s, v, a) {
    let blockFlag = 0;
    for (let w of s.toCharArray()) {
      if (Seeker.blockFlagMap[w]) {
        blockFlag |= Seeker.blockFlagMap[w];
      } else {
        const c = w.charCodeAt(0);
        if (c >= 0x2ff0 && c <= 0x2fff) break; // CJK description
        a.push(Seeker.variant(w, v));
      }
    }
    return blockFlag || Seeker.blockFlagAll;
  },
  getCJKBlock(c) {
    if (c >= 0x4e00 && c <= 0x9fff) return 1;
    if (c >= 0x3400 && c <= 0x4dbf) return 2;
    if (c >= 0x20000 && c <= 0x2a6df) return 3;
    if (c >= 0x2a700 && c <= 0x2b739) return 4;
    if (c >= 0x2b740 && c <= 0x2b81d) return 5;
    if (c >= 0x2b820 && c <= 0x2cea1) return 6;
    if (c >= 0x2ceb0 && c <= 0x2ebe0) return 7;
    if (c >= 0x30000 && c <= 0x3134a) return 8;
    if (c >= 0x31350 && c <= 0x323af) return 9;
    if (c >= 0x2ebf0 && c <= 0x2ee5d) return 10;
    if (c >= 0x323b0 && c <= 0x3347b) return 11;
    if (c >= 0xf900 && c <= 0xfad9) return -1;
    if (c >= 0x2f800 && c <= 0x2fa1d) return -1;
    if (c >= 0xf0270 && c <= 0xfae7a) return -2;
    return 0;
  },
  getData(c) {
    if (Seeker.dataIndex === null) {
      Seeker.dataIndex = {};
      for (let d of dt) {
        const code = d.codePointAt(0);
        Seeker.dataIndex[code] = d.substring(code > 0xffff ? 2 : 1);
      }
    }
    return Seeker.dataIndex[c];
  },
  eliminate(query, str, ignore, divide, variant) {
    // query: 搜尋字串的陣列(已排序)
    // str: 正要媒合的樹枝
    // divide: 硬拆
    // variant: 包容異體
    if (str === '@') return null; // 如果此字已無法再分解

    const backup = query.concat(); // b: 備份搜尋陣列a
    let res = false;
    for (let w of str.toCharArray()) {
      if (ignore && ignore.indexOf(w) >= 0) {
        continue;
      }

      if (w === '!' && !divide) break;
      if (w === '@' || w === '!') {
        if (!query.length) break;
        query.length = 0;
        for (let j of backup) query.push(j);
      } else if (query.length) {
        // 搜尋陣列還有值
        const pos = query.indexOf(Seeker.variant(w, variant)); // 在搜尋陣列中尋找這個字的位置
        if (pos >= 0) {
          query.splice(pos, 1); // 找到了：從搜尋陣列刪除這個字
          res |= true;
        }
      }
    }
    return res;
  },
  stopMatch() {
    clearTimeout(Seeker.worker);
  },
  getMatch(s, ignore, variant, divide, force) {
    // string, variant?, divide?, max, href
    clearTimeout(Seeker.worker);

    const x = [];
    const blockFlag = Seeker.arraylize(s, variant, x);
    x.sort();
    s = x.join('');
    if (s === '') return;

    const found = [];
    function work(j) {
      if (j + Seeker.seg < dt.length)
        Seeker.worker = setTimeout(
          () => {
            work(j + Seeker.seg);
          },
          Seeker.segcnt > 10
            ? Math.floor(Seeker.totalmsec / Seeker.segcnt + 5)
            : Seeker.interval
        );
      const st = new Date();
      let i;
      for (i = j; i < j + Seeker.seg && i < dt.length; i++) {
        const query = x.concat(); // 複製陣列 (因為eliminate函式內會直接操作，故用concat的副作用進行複製)
        const w = dt[i].charPointAt(0); // 目前測試的字
        const c = w.codePointAt(0); //            的unicode
        const block = Seeker.getCJKBlock(c);
        if (ignore && ignore.indexOf(w) >= 0) continue;

        if (blockFlag) {
          // 篩選要包含的Unicode分區
          const f = Seeker.blockMap[block];
          if (!(blockFlag & f)) continue;
        }

        const groups = [];
        if (Seeker.variant(w, variant) !== s) {
          Seeker.eliminate(
            query,
            dt[i].slice(w.length),
            ignore,
            divide,
            variant
          );
          if (query.length) continue; // 沒命中
          groups.unshift(w);
        }

        const hitData = {
          char: w,
          unicode: c,
          groups: groups,
          order: found.length
        };
        if (force || block === 1) found.push(hitData);
      }
      UI.setResult(found, i, force);
      Seeker.totalmsec += new Date() - st;
      Seeker.segcnt++;

      if (j + Seeker.seg >= dt.length) UI.finished(found);
    }
    Seeker.worker = setTimeout(() => {
      work(0);
    }, 10);
  },
  exhaust(s, divide, recursive) {
    let res = '';
    if (s.length) {
      let w = s.charPointAt(0);
      const c = w.codePointAt(0);
      const def = Seeker.getData(c); //.substring(w.length);
      let k = 0;
      for (let w of def.toCharArray()) {
        if (w === '!' && !divide) break;
        if (w === '@' || w === '!') {
          if (k) res += recursive === -1 ? '┇' : '‖';
          k++;
        } else {
          res += w;
          if (recursive) {
            const subRes = Seeker.exhaust(w, divide, -1);
            if (subRes.length) res += '(' + subRes + ')';
          }
        }
      }
    }
    return res;
  },
  getTree(str, divide) {
    const Eles = [];
    if (str.length) {
      const w = str.charPointAt(0);
      const c = w.codePointAt(0);
      const p = Seeker.exhaust(w, divide, true)
        .replace(
          /([\ud800-\udbff][\udc00-\udfff]|[^\ud800-\udfff])\(/g,
          '<span class="line">$1(<span class="sub">'
        )
        .replace(/\)/g, '</span>)</span>');

      if (p === '') {
        Eles.push(UI.addCell({ char: w, unicode: c, text: '(无法再分解)' }));
      } else {
        const strs = p.split('‖');
        for (let s of strs) {
          Eles.push(
            UI.addCell({
              char: w,
              unicode: c,
              text: s.length ? s : '(无法再分解)'
            })
          );
        }
      }
    }
    return Eles;
  }
};

const UI = {
  shortcuts: [],
  keypadMode: null,
  demonstratedChars: new Set(),
  strokeKeyboard: {
    className: 'strokeKB',
    groups: {
      '01畫': '一丨丶丿乙亅乚㇄㇁㇂𠄌𠃊𠃋𡿨乛㇇𠃍㇏乀⺄𠃌㇆㇉𠃑㇊㇒㇣㇀',
      '02畫':
        '二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又亻𠆢丷刂⺈㔾讠𢎘𠂉〢𠂊𠂇㐅乂𠘧𠘨⺆丂𠀁龴𠂆𠄎㇋㇌⺀𠂈丩⺊丄丅丆𠃎𠄟𠄠𠄐𠃏乁𠙴七𠤎九',
      '03畫':
        '口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳川⺌𡭔䶹彑忄扌氵犭⺾阝⻖⻏⺕⻌丬纟飞饣䒑卄𭕄𠀆𠔼𠫓𣥂𡳾𠂎乇𫝀㐄𡕒乡𠚤习亼三丈也于上下兀丌卂亇万刄',
      '04畫':
        '心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬⺗攵朩毌灬爫爫牜𠂒尣⺩礻龰罓冈㓁⺼艹辶⻍耂⺳𦉪𠔿⺝艹卝龷廿丰丯𧘇𣎳𥘅龶⺜厃𠃜肀旡冘夬兂龵𦉫𠬝㸦𤓰𠃛夨仌王五六卅不丐及丑丹刅井开𠬛尺巨巴𣎴冃冄𠬞𠬜丮巿𠃚',
      '05畫':
        '玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立𤴓𤴔罒𦉰歺母氺衤⺬钅𢆉𦍍业𠀎㠯𠕁𡗗圥𠮠犮𢎨𦘒⺻龸𣦵丱𤕫𥝌𦫳𣎵屵𫇦四卌夗㐱乍乎冉册史央戉戊冋本民永北',
      '06畫':
        '竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾𥫗糹𦍌⺶西覀齐冎龹𠂤𧰨乑𢦏产巩𦈢𠂭𠂢𠦃䇂㐆甶囟幵厽𠃨𠬪朿亙兆州年曲曳朱关',
      '07畫':
        '見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里訁𧮫𧾷𦥑镸⺸𦍋夋𦉶㒳㐬𠦒𦣞𦣝丣戼𠃬㕯㫃囧𦣻囱囪㡀严𠦑㳄我巠甹皀夆亜来',
      '08畫': '金長門阜隶隹雨青非釒⻗靑飠叀亝𣏟㣇甾幷𨸏𣶒罙忝匋奄東疌黾靣',
      '09畫': '面革韋韭音頁風飛食首香𩙿叚壴复亲枼昜亯𡿺𠧪県𥄉㲋𢑚㢴𢏚咢奐禺南',
      其他: {
        '10畫': '馬骨高髟鬥鬯鬲鬼𤇾丵𠂹𣆪𩠐𡸁隺尃𧴪𥁕臽䍃芻皋',
        '11畫': '魚鳥鹵鹿麥麻㒼𦰩𠦬𠁁桼啇袞翏啚悤粛',
        '12畫': '黃黍黑黹菐巽粦尌朁尞厤肅𤔔𠥓',
        '13畫': '黽鼎鼓鼠𦥯𦝠𢊁廌𠌶亶嗇睘',
        '14畫': '鼻齊𨛜㥯熏',
        '15畫': '齒嘼廛巤',
        '16畫': '龍龜',
        '17畫': '龠𩫖毚韱'
      }
    }
  },
  blockClasses: {
    '-2': 'SUP',
    '-1': 'CMP',
    0: 'OTH',
    1: 'BSC',
    2: 'ExA',
    3: 'ExB',
    4: 'ExC',
    5: 'ExD',
    6: 'ExE',
    7: 'ExF',
    8: 'ExG',
    9: 'ExH',
    10: 'ExI',
    11: 'ExJ'
  },
  isMobile() {
    if (navigator.userAgentData) {
      return navigator.userAgentData.mobile;
    }
    const userAgent = navigator.userAgent;
    const mobileKeywords = [
      'iPhone',
      'Android',
      'Windows Phone',
      'BlackBerry',
      'Opera Mini',
      'Mobile'
    ];
    return mobileKeywords.some(keyword => userAgent.includes(keyword));
  },
  initKeyboard(kbType) {
    const table = document.createElement('table');
    table.className = kbType.className;

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    for (let g in kbType.groups) {
      const row = document.createElement('tr');

      const th = document.createElement('th');
      th.textContent = g;
      row.appendChild(th);

      const cell = document.createElement('td');
      row.appendChild(cell);

      if (typeof kbType.groups[g] === 'string') {
        const text = kbType.groups[g].toCharArray();
        for (let w of text) {
          if (w === ',') {
            const br = document.createElement('br');
            cell.appendChild(br);
            continue;
          }

          const z = Seeker.parts[w];
          if (z) {
            const button = document.createElement('button');
            button.className = `han K${z}`;
            button.dataset.char = w;
            button.textContent = w;
            cell.appendChild(button);
          }
        }
      } else {
        for (let gg in kbType.groups[g]) {
          const subSpan = document.createElement('span');
          subSpan.className = 'sub';

          const tagSpan = document.createElement('span');
          tagSpan.className = 'tag';
          tagSpan.textContent = gg;
          subSpan.appendChild(tagSpan);

          const subText = kbType.groups[g][gg].toCharArray();
          for (let w of subText) {
            if (w === ',') {
              const br = document.createElement('br');
              subSpan.appendChild(br);
              continue;
            }

            const z = Seeker.parts[w];
            if (z) {
              const button = document.createElement('button');
              button.className = `han K${z}`;
              button.dataset.char = w;
              button.textContent = w;
              subSpan.appendChild(button);
            }
          }

          cell.appendChild(subSpan);
        }
      }

      tbody.appendChild(row);
    }

    const keypad = document.getElementById('keypad');
    keypad.appendChild(table);
  },
  copy(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    popCopyMsg(text);
  },
  getPos() {
    const prevScrollY = window.scrollY;
    inputEle.focus();
    const selectionStart = inputEle.selectionStart;
    inputEle.blur();
    window.scrollTo({
      top: prevScrollY,
      behavior: 'instant'
    });
    return selectionStart;
  },
  setPos(n) {
    inputEle.setSelectionRange(n, n);
  },
  getSel() {
    return inputEle.value.substring(
      inputEle.selectionStart,
      inputEle.selectionEnd
    );
  },
  delSel() {
    const m = inputEle.selectionStart;
    const n = inputEle.selectionEnd;
    if (m !== n) {
      inputEle.value =
        inputEle.value.substring(0, m) + inputEle.value.substring(n);
      inputEle.setSelectionRange(m, m);
    }
  },
  key(w, hidePop = false) {
    UI.delSel();
    const n = UI.getPos();
    const s = inputEle.value;
    inputEle.value = s.slice(0, n) + w + s.slice(n);
    UI.setPos(w.length > 1 ? n + 2 : n + 1);
    UI.go(false, hidePop);
  },
  clearFind() {
    inputEle.value = '';
    UI.go(true);
  },
  decompose() {
    const n = UI.getPos();
    if (n > 0) {
      const s = inputEle.value;
      let m = n - 1;
      let w = s.charPointAt(m);
      if (w === '\\') {
        m--;
        w = s.charPointAt(m);
      }
      if (w.length > 1) m--;

      const d = subdivideSwitch.selected;
      const t = Seeker.exhaust(w, d, false);
      if (t.length) {
        inputEle.value = s.slice(0, m) + t + s.slice(n).replace(/\\/g, '');
        UI.setPos(m + t.length);
        UI.go();
      }
    }
  },
  go(force, hidePop = true) {
    Object.values(outputElements).forEach(e => (e.innerHTML = ''));
    UI.demonstratedChars.clear();

    if (UI.ime) return;
    //if (!force && !_('onthefly').checked) return;
    if (hidePop) UI.hidePop();
    Seeker.groups = null;
    Seeker.result = null;
    let s = (UI.getSel() || inputEle.value).replace(/\s/g, '');
    Seeker.stopMatch();
    if (!s) {
      counter.innerHTML = '';
      Object.values(outputElements).forEach(e => (e.innerHTML = ''));
    } else {
      const divide = subdivideSwitch.selected;
      const variant = variantSwitch.selected;
      if (s.charAt(0) === ':') {
        for (let Ele of Seeker.getTree(s.slice(1), divide)) {
          for (let outputEle of Object.values(outputElements)) {
            outputEle.appendChild(Ele);
          }
        }
      } else {
        let ignore = null;
        const tmp = s.split('-');
        if (tmp.length === 2) {
          s = tmp[0];
          ignore = tmp[1];
        }
        Seeker.getMatch(s, ignore, variant, divide, force);
      }
    }
  },
  setMode(chk, key) {
    setTimeout(() => {
      localStorage.setItem(key, chk.selected ? '1' : '0');
      UI.go();
    }, 0);
  },
  updatePad() {
    setTimeout(() => {
      const showkeypad = !!+UI.getItem('showkeypad');
      UI.keypadMode = showkeypad;
      localStorage.setItem('keypad', UI.keypadMode ? '1' : '0');
      if (UI.keypadMode) {
        keypad.style.display = 'block';
      } else {
        keypad.style.display = null;
      }
    }, 0);
  },
  replaceFind(s) {
    if (!UI.getSel()) inputEle.value = '';
    UI.key(s);
  },
  addShortcut(w, d) {
    if (w) {
      let ex = false;
      for (let i in UI.shortcuts) {
        if (UI.shortcuts[i] === w) {
          ex = true;
          if (d) UI.shortcuts.splice(i, 1);
        }
      }
      if (!ex) {
        if (UI.shortcuts.length >= 20) UI.shortcuts.splice(0, 1);
        UI.shortcuts.push(w);
      }
      if (UI.shortcuts.length) {
        localStorage.setItem('shortcuts', UI.shortcuts.join(' '));
      } else {
        localStorage.removeItem('shortcuts');
      }
    } else {
      const s = UI.getItem('shortcuts', '');
      if (s) UI.shortcuts = s.split(' ');
    }
    scKey.innerHTML = UI.shortcuts.length ? '收藏栏：' : '';

    for (let shortcut of UI.shortcuts)
      scKey.appendChild(UI.createTag(shortcut, 'button', 'han', null, true));
  },
  showPopTest() {
    popviewElements.popview.style.display = 'block';

    popviewElements.codetag.textContent = 'U+0000';
    popviewElements.bigchar.textContent = '0';

    popviewElements.menuKey.style.display = 'block';
    popviewElements.menuGo.style.display = 'none';

    popviewElements.menuAdd.style.display = 'block';
    popviewElements.menuDel.style.display = 'none';
  },
  showPop(event) {
    const targetElement = event.target;

    if (targetElement.tagName !== 'BUTTON' && targetElement.tagName !== 'A')
      return;

    const maxX = document.body.scrollWidth - 10;
    const maxY = document.body.scrollHeight - 10;
    const rect = targetElement.getBoundingClientRect();
    const x =
      window.scrollX + rect.left + UI.popviewRect.width < maxX
        ? window.scrollX + rect.left
        : maxX - UI.popviewRect.width;
    const y =
      window.scrollY + rect.bottom + UI.popviewRect.height + 5 < maxY
        ? window.scrollY + rect.bottom + 5
        : window.scrollY + rect.top - UI.popviewRect.height - 5;

    UI.popviewAnimation?.cancel();
    if (UI.popTrigger && popViewVisibility.isVisible) {
      const rect = popviewElements.popview.getBoundingClientRect();
      UI.popviewMoveAnimation?.cancel();
      UI.popviewAnimation?.cancel();
      UI.popviewMoveAnimation = popviewElements.popview.animate(
        [
          {
            left: `${window.scrollX + rect.left}px`,
            top: `${window.scrollY + rect.top}px`
          },
          {
            left: `${x}px`,
            top: `${y}px`
          }
        ],
        { duration: 300, easing: 'ease' }
      );
      UI.popviewMoveAnimation.addEventListener('finish', () => {
        popviewElements.popview.style.left = `${x}px`;
        popviewElements.popview.style.top = `${y}px`;
      });
    } else {
      UI.popviewMoveAnimation?.cancel();
      UI.popviewAnimation = popviewElements.popview.animate(
        [{ opacity: '0' }, { opacity: '0.9' }],
        { duration: 300, easing: 'ease' }
      );
      UI.popviewAnimation.addEventListener('finish', () => {
        popviewElements.popview.style.opacity = '0.9';
      });
      popviewElements.popview.style.left = `${x}px`;
      popviewElements.popview.style.top = `${y}px`;
    }
    setTimeout(() => (popviewElements.popview.style.display = 'block'), 0);

    const character = targetElement.dataset.char ?? targetElement.innerText;
    const codePoint = character.codePointAt(0);
    const cjkBlock = Seeker.getCJKBlock(codePoint);

    popviewElements.codetag.textContent = `U+${codePoint.toString(16).toUpperCase()}`;
    popviewElements.bigchar.textContent = character;
    popviewElements.bigchar.className = 'han';
    popviewElements.bigchar.style = '';

    if (Config.useImage[cjkBlock]) {
      popviewElements.bigchar.classList.add('img');
      popviewElements.bigchar.style.backgroundImage = `url(${Config.glyphwiki}${codePoint.toString(16)}.svg)`;
    }

    popviewElements.menuKey.style.display =
      targetElement.tagName === 'BUTTON' ? 'block' : 'none';
    popviewElements.menuGo.style.display =
      targetElement.tagName === 'A' ? 'block' : 'none';

    if (targetElement.tagName.toUpperCase() === 'A') {
      popviewElements.menuGo.href = targetElement.href;
    }

    const isInScKey =
      targetElement.parentElement && targetElement.parentElement.id === 'scKey';
    popviewElements.menuAdd.style.display = isInScKey ? 'none' : 'block';
    popviewElements.menuDel.style.display = isInScKey ? 'block' : 'none';

    UI.popTrigger = targetElement;
  },
  hidePop(event = true) {
    if (event !== true && event.target !== UI.popTrigger) {
      return;
    }

    setTimeout(() => {
      const prevOpacity = getComputedStyle(popviewElements.popview).opacity;
      UI.popviewAnimation?.cancel();
      UI.popviewAnimation = popviewElements.popview.animate(
        [{ opacity: prevOpacity }, { opacity: '0' }],
        { duration: 300, easing: 'ease' }
      );
      UI.popviewAnimation.addEventListener(
        'finish',
        () => (popviewElements.popview.style.display = 'none')
      );
      UI.popTrigger = null;
    }, 0);
  },
  setSkipChar(chr) {
    if (inputEle.value.indexOf('-') < 0) inputEle.value += '-';
    inputEle.value += chr;
    UI.go();
  },
  eventMoniter() {
    inputEle.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.code === 'Enter') UI.go(true);
      if (e.code === 'Escape') UI.clearFind();
    });

    inputEle.addEventListener('keyup', e => {
      if (e.isComposing) return;
      if (e.code === 'Backslash') UI.decompose();
    });

    inputEle.addEventListener('compositionstart', () => {
      UI.ime = true;
    });

    inputEle.addEventListener('compositionend', () => {
      setTimeout(() => {
        UI.ime = false;
        UI.go();
      }, 0);
    });

    inputEle.addEventListener('input', () => {
      UI.go(false);
    });

    buttClear.addEventListener('click', UI.clearFind);
    buttDecompose.addEventListener('click', UI.decompose);
    buttGo.addEventListener('click', () => {
      UI.go(true);
    });

    popviewElements.popview.addEventListener('mouseenter', e => {
      e.stopPropagation();
    });

    popviewElements.popview.addEventListener('mouseleave', e => {
      e.stopPropagation();
      popviewElements.popview.style.display = 'none';
      UI.popTrigger = null;
    });

    popviewElements.popview.addEventListener('mouseenter', () => {
      if (UI.hidePopTimer) clearTimeout(UI.hidePopTimer);
    });

    popviewElements.popview.addEventListener('mouseleave', e => {
      UI.hidePopTimer = setTimeout(() => UI.hidePop(e), 16);
    });

    keypad.addEventListener('mouseover', e => {
      if (e.target.tagName === 'BUTTON') UI.showPop(e);
    });

    keypad.addEventListener('mouseout', e => {
      if (e.target.tagName === 'BUTTON')
        UI.hidePopTimer = setTimeout(() => UI.hidePop(e), 16);
    });

    scKey.addEventListener('mouseover', e => {
      if (e.target.tagName === 'BUTTON') UI.showPop(e);
    });

    scKey.addEventListener('mouseout', e => {
      if (e.target.tagName === 'BUTTON')
        UI.hidePopTimer = setTimeout(() => UI.hidePop(e), 16);
    });

    Object.values(outputElements).forEach(output => {
      output.addEventListener('mouseover', e => {
        if (e.target.tagName === 'A') UI.showPop(e);
      });

      output.addEventListener('mouseout', e => {
        if (e.target.tagName === 'A')
          UI.hidePopTimer = setTimeout(() => UI.hidePop(e), 16);
      });
    });

    keypad.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') {
        if (UI.hidePopTimer) clearTimeout(UI.hidePopTimer);
        UI.key(e.target.innerText, false);
        e.preventDefault();
      }
    });

    scKey.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') {
        if (UI.hidePopTimer) clearTimeout(UI.hidePopTimer);
        UI.key(e.target.innerText, false);
        e.preventDefault();
      }
    });

    Object.values(outputElements).forEach(output => {
      output.addEventListener('click', e => {
        if (e.target.tagName === 'A') {
          if (UI.hidePopTimer) clearTimeout(UI.hidePopTimer);
          e.preventDefault();
        }
      });
    });

    Object.values(outputElements).forEach(output => {
      output.addEventListener('mouseover', e => {
        if (e.target.classList.contains('line')) {
          e.target.classList.add('hover');
          e.stopPropagation();
        }
      });

      output.addEventListener('mouseout', e => {
        if (e.target.classList.contains('line')) {
          e.target.classList.remove('hover');
        }
      });
    });

    popviewElements.menuGo.addEventListener('click', () => {
      UI.popTrigger.click();
    });

    popviewElements.menuKey.addEventListener('click', () => {
      UI.key(UI.popTrigger.dataset.char);
    });

    popviewElements.menuCopy.addEventListener('click', () => {
      UI.copy(UI.popTrigger.dataset.char);
      UI.hidePop();
    });

    popviewElements.menuQuery.addEventListener('click', () => {
      UI.replaceFind(UI.popTrigger.dataset.char);
      UI.hidePop();
    });

    popviewElements.menuSkip.addEventListener('click', () => {
      UI.setSkipChar(UI.popTrigger.dataset.char);
      UI.hidePop();
    });

    popviewElements.menuAdd.addEventListener('click', () => {
      UI.addShortcut(UI.popTrigger.dataset.char);
      UI.hidePop();
    });

    popviewElements.menuDel.addEventListener('click', () => {
      UI.addShortcut(UI.popTrigger.dataset.char, true);
      UI.hidePop();
    });
  },
  createTag(c, tagName, cls, extraOpts, hideChar, running) {
    const code = c.codePointAt(0);
    const tag = document.createElement(tagName);
    tag.className = cls || '';
    if (extraOpts) {
      for (let extraOpt in extraOpts) {
        tag.setAttribute(extraOpt, extraOpts[extraOpt]);
      }
    }

    tag.dataset.char = c;
    if (Config.useImage[Seeker.getCJKBlock(code)] && !running) {
      tag.style.backgroundImage = `url(${Config.glyphwiki}${code.toString(16)}.svg)`;
      tag.innerHTML = hideChar ? '&nbsp;' : c;
      tag.classList.add('img');
    } else {
      tag.innerHTML = c;
    }
    return tag;
  },
  addCell(entry, running) {
    const block = Seeker.getCJKBlock(entry.unicode);
    const cls = UI.blockClasses[block];

    const url = Config.url
      .replace('$CHR$', entry.char)
      .replace('$ENC$', encodeURI(entry.char))
      .replace('$UCD$', entry.unicode.toString())
      .replace('$UCh$', entry.unicode.toString(16))
      .replace('$UCH$', entry.unicode.toString(16).toUpperCase());

    if (entry.text) {
      const res = document.createElement('span');
      res.className = cls;
      res.innerHTML = entry.text;
      return res;
    } else {
      return UI.createTag(
        entry.char,
        'a',
        cls,
        {
          target: '_blank',
          href: url
        },
        false,
        running
      );
    }
  },
  setResult(founds, i, force) {
    Seeker.result = founds;
    const msg = force
      ? `找到 ${founds.length} 字 ${Math.floor((i * 100) / dt.length)}%`
      : `<span style="color:red">（基本区）</span>找到 ${founds.length} 字`;
    counter.innerHTML = msg;
    UI.showOutput();
  },
  showOutput() {
    for (let j in Seeker.result) {
      if (UI.demonstratedChars.has(Seeker.result[j].char)) continue;
      UI.demonstratedChars.add(Seeker.result[j].char);
      const cjkBlock = Seeker.getCJKBlock(Seeker.result[j].unicode);

      const willAddEle = UI.addCell(Seeker.result[j], Seeker.groups === null);
      outputElements[UI.blockClasses[cjkBlock]].appendChild(willAddEle);
      willAddEle.addEventListener('click', () =>
        UI.copy(willAddEle.dataset.char)
      );
    }
  },
  finished(founds) {
    Seeker.result = founds;
    const groups = {};
    for (let found of founds) {
      if (found.groups) {
        for (let group in found.groups) {
          if (!groups[group]) groups[group] = 0;
          groups[group]++;
        }
      }
    }
    Seeker.groups = [];
    for (let g in groups)
      if (groups[g] >= 3)
        Seeker.groups.push({
          char: g,
          unicode: g.codePointAt(0),
          count: groups[g]
        });
    Seeker.groups.sort((a, b) => {
      return b.count - a.count;
    });
    UI.showOutput();
  },
  getItem(k, defaultValue = '0') {
    return localStorage.getItem(k) ?? defaultValue;
  },
  init() {
    UI.showPopTest();
    UI.popviewRect = popviewElements.popview.getBoundingClientRect();
    popviewElements.popview.style.display = 'none';

    UI.initKeyboard(UI.strokeKeyboard);

    Object.values(outputElements).forEach(element => {
      if (element.innerText === '') {
        element.style.display = 'none';
      }

      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          const target = mutation.target;
          if (target.innerText !== '') {
            target.style.display = '';
          } else {
            target.style.display = 'none';
          }
        });
      });

      const config = { childList: true, subtree: true, characterData: true };
      observer.observe(element, config);
    });

    versionEle.innerHTML = Seeker.getVersion();

    const validCharacterCount = dt.filter(entry => !entry.endsWith('╳')).length;
    datasizeEle.innerHTML = validCharacterCount;

    variantSwitch.selected = UI.getItem('variant') === '1';
    subdivideSwitch.selected = UI.getItem('subdivide') === '1';
    keypadSwitch.selected = UI.getItem('showkeypad') === '1';

    UI.addShortcut();

    UI.eventMoniter();
    UI.updatePad();

    document.querySelector('.BSC').addEventListener('click', () => UI.key('#'));
    document.querySelector('.CMP').addEventListener('click', () => UI.key('$'));
    document.querySelector('.SUP').addEventListener('click', () => UI.key('%'));
    document.querySelector('.OTH').addEventListener('click', () => UI.key('&'));

    const extKeyBtns = document.querySelectorAll('[class^="Ex"]');
    for (let extKeyBtn of extKeyBtns) {
      extKeyBtn.addEventListener('click', () => UI.key(extKeyBtn.className[2]));
    }

    variantSwitch.addEventListener('click', () =>
      UI.setMode(variantSwitch, 'variant')
    );
    subdivideSwitch.addEventListener('click', () =>
      UI.setMode(subdivideSwitch, 'subdivide')
    );
    keypadSwitch.addEventListener('click', () => {
      UI.setMode(keypadSwitch, 'showkeypad');
      UI.updatePad();
    });
  }
};

String.prototype.charPointAt = function (i) {
  return String.fromCodePoint(this.codePointAt(i));
};

String.prototype.toCharArray = function () {
  const arr = [];
  for (let i = 0; i < this.length; ) {
    const codePoint = this.codePointAt(i);
    i += codePoint > 0xffff ? 2 : 1;
    arr.push(codePoint);
  }
  return arr.map(i => String.fromCodePoint(i));
};

UI.init();
