String.prototype.toArray = function () {
  var arr = [];
  for (let i = 0; i < this.length; ) {
    const codePoint = this.codePointAt(i);
    i += codePoint > 0xffff ? 2 : 1;
    arr.push(codePoint);
  }
  return arr;
};

Object.defineProperty(String.prototype, 'codePointLength', {
  get() {
    let len = 0;
    for (let i = 0; i < this.length; ) {
      const codePoint = this.codePointAt(i);
      i += codePoint > 0xffff ? 2 : 1;
      len++;
    }
    return len;
  },
  enumerable: false,
  configurable: false,
});

Array.prototype.removeAll = function (value) {
  for (let i = 0; i < this.length; i++) {
    if (this[i] === value) {
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};

const validCode = /^([0-9a-fA-F]|10)?[0-9a-fA-F]{0,4}$/;
const resultTextarea = document.getElementById('resultTextarea');
const customCharEle = document.getElementById('customChar');
const slider = document.getElementById('countSlider');
const countInput = document.getElementById('countInput');
const customIntervalContainer = document.getElementById(
  'customIntervalContainer'
);
const customBlocksContainer = document.getElementById(
  'customBlocksContainer'
);
const selectBlocks = document.getElementById('select-blocks');
let selectedBlocks = []

const definedCharacterStartList = [0, 890, 900, 908, 910, 931, 1329, 1369, 1421, 1425, 1488, 1519, 1536, 1807, 1869, 1984, 2045, 2096, 2112, 2142, 2144, 2160, 2192, 2199, 2437, 2447, 2451, 2474, 2482, 2486, 2492, 2503, 2507, 2519, 2524, 2527, 2561, 2565, 2575, 2579, 2602, 2610, 2613, 2616, 2620, 2622, 2631, 2635, 2641, 2649, 2654, 2660, 2689, 2693, 2703, 2707, 2730, 2738, 2741, 2748, 2759, 2763, 2768, 2784, 2809, 2817, 2821, 2831, 2835, 2858, 2866, 2869, 2876, 2887, 2891, 2901, 2908, 2911, 2946, 2949, 2958, 2962, 2969, 2972, 2974, 2979, 2984, 2990, 3006, 3014, 3018, 3024, 3031, 3044, 3072, 3086, 3090, 3114, 3132, 3142, 3146, 3157, 3160, 3165, 3168, 3191, 3214, 3218, 3242, 3253, 3260, 3270, 3274, 3285, 3293, 3296, 3313, 3328, 3342, 3346, 3398, 3402, 3412, 3457, 3461, 3482, 3507, 3517, 3520, 3530, 3535, 3542, 3544, 3558, 3570, 3585, 3647, 3713, 3716, 3718, 3724, 3749, 3751, 3776, 3782, 3784, 3792, 3804, 3840, 3913, 3953, 3993, 4030, 4046, 4096, 4295, 4301, 4304, 4682, 4688, 4696, 4698, 4704, 4746, 4752, 4786, 4792, 4800, 4802, 4808, 4824, 4882, 4888, 4957, 4992, 5024, 5112, 5120, 5792, 5888, 5919, 5952, 5984, 5998, 6002, 6016, 6112, 6128, 6144, 6176, 6272, 6320, 6400, 6432, 6448, 6464, 6468, 6512, 6528, 6576, 6608, 6622, 6686, 6752, 6783, 6800, 6816, 6832, 6912, 6990, 7164, 7227, 7245, 7312, 7357, 7376, 7424, 7960, 7968, 8008, 8016, 8025, 8027, 8029, 8031, 8064, 8118, 8134, 8150, 8157, 8178, 8182, 8192, 8294, 8336, 8352, 8400, 8448, 8592, 9280, 9312, 11126, 11159, 11513, 11559, 11565, 11568, 11631, 11647, 11680, 11688, 11696, 11704, 11712, 11720, 11728, 11736, 11744, 11904, 12032, 12272, 12353, 12441, 12549, 12593, 12688, 12783, 12832, 42128, 42192, 42560, 42752, 42960, 42963, 42965, 42994, 43056, 43072, 43136, 43214, 43232, 43359, 43392, 43471, 43486, 43520, 43584, 43600, 43612, 43739, 43777, 43785, 43793, 43808, 43816, 43824, 43888, 44016, 44032, 55216, 55243, 63744, 64112, 64256, 64275, 64285, 64312, 64318, 64320, 64323, 64326, 64467, 64914, 64975, 65008, 65056, 65108, 65128, 65136, 65142, 65279, 65281, 65474, 65482, 65490, 65498, 65504, 65512, 65529, 65536, 65549, 65576, 65596, 65599, 65616, 65664, 65792, 65799, 65847, 65936, 65952, 66000, 66176, 66208, 66272, 66304, 66349, 66384, 66432, 66463, 66504, 66560, 66720, 66736, 66776, 66816, 66864, 66927, 66940, 66956, 66964, 66967, 66979, 66995, 67003, 67008, 67072, 67392, 67424, 67456, 67463, 67506, 67584, 67592, 67594, 67639, 67644, 67647, 67671, 67751, 67808, 67828, 67835, 67871, 67903, 67968, 68028, 68050, 68101, 68108, 68117, 68121, 68152, 68159, 68176, 68192, 68288, 68331, 68352, 68409, 68440, 68472, 68505, 68521, 68608, 68736, 68800, 68858, 68912, 68928, 68969, 69006, 69216, 69248, 69291, 69296, 69314, 69372, 69424, 69488, 69552, 69600, 69632, 69714, 69759, 69837, 69840, 69872, 69888, 69942, 69968, 70016, 70113, 70144, 70163, 70272, 70280, 70282, 70287, 70303, 70320, 70384, 70400, 70405, 70415, 70419, 70442, 70450, 70453, 70459, 70471, 70475, 70480, 70487, 70493, 70502, 70512, 70528, 70539, 70542, 70544, 70583, 70594, 70597, 70599, 70604, 70615, 70625, 70656, 70749, 70784, 70864, 71040, 71096, 71168, 71248, 71264, 71296, 71360, 71376, 71424, 71453, 71472, 71680, 71840, 71935, 71945, 71948, 71957, 71960, 71991, 71995, 72016, 72096, 72106, 72154, 72192, 72272, 72368, 72448, 72640, 72688, 72704, 72714, 72760, 72784, 72816, 72850, 72873, 72960, 72968, 72971, 73018, 73020, 73023, 73040, 73056, 73063, 73066, 73104, 73107, 73120, 73440, 73472, 73490, 73534, 73648, 73664, 73727, 74752, 74864, 74880, 77712, 77824, 78944, 82944, 90368, 92160, 92736, 92768, 92782, 92864, 92880, 92912, 92928, 93008, 93019, 93027, 93053, 93504, 93760, 93952, 94031, 94095, 94176, 94192, 94208, 100352, 101631, 110576, 110581, 110589, 110592, 110898, 110928, 110933, 110948, 110960, 113664, 113776, 113792, 113808, 113820, 117760, 118016, 118528, 118576, 118608, 118784, 119040, 119296, 119488, 119520, 119552, 119648, 119808, 120488, 120782, 121499, 121505, 122624, 122661, 122880, 122888, 122907, 122915, 122918, 122928, 123023, 123136, 123184, 123200, 123214, 123536, 123584, 123647, 124112, 124368, 124415, 124896, 124904, 124909, 124912, 124928, 125127, 125184, 125264, 125278, 126065, 126209, 126464, 126469, 126497, 126500, 126503, 126505, 126516, 126521, 126523, 126530, 126535, 126537, 126539, 126541, 126545, 126548, 126551, 126553, 126555, 126557, 126559, 126561, 126564, 126567, 126572, 126580, 126585, 126590, 126592, 126603, 126625, 126629, 126635, 126704, 126976, 127024, 127136, 127153, 127169, 127185, 127232, 127462, 127504, 127552, 127568, 127584, 127744, 128732, 128752, 128768, 128891, 128992, 129008, 129024, 129040, 129104, 129120, 129168, 129200, 129216, 129280, 129632, 129648, 129664, 129679, 129742, 129759, 129776, 129792, 129940, 131072, 173824, 177984, 178208, 183984, 191472, 194560, 196608, 201552, 917505, 917536, 917760];
const definedCharacterEndList = [887, 895, 906, 908, 929, 1327, 1366, 1418, 1423, 1479, 1514, 1524, 1805, 1866, 1969, 2042, 2093, 2110, 2139, 2142, 2154, 2190, 2193, 2435, 2444, 2448, 2472, 2480, 2482, 2489, 2500, 2504, 2510, 2519, 2525, 2558, 2563, 2570, 2576, 2600, 2608, 2611, 2614, 2617, 2620, 2626, 2632, 2637, 2641, 2652, 2654, 2678, 2691, 2701, 2705, 2728, 2736, 2739, 2745, 2757, 2761, 2765, 2768, 2801, 2815, 2819, 2828, 2832, 2856, 2864, 2867, 2873, 2884, 2888, 2893, 2903, 2909, 2935, 2947, 2954, 2960, 2965, 2970, 2972, 2975, 2980, 2986, 3001, 3010, 3016, 3021, 3024, 3031, 3066, 3084, 3088, 3112, 3129, 3140, 3144, 3149, 3158, 3162, 3165, 3183, 3212, 3216, 3240, 3251, 3257, 3268, 3272, 3277, 3286, 3294, 3311, 3315, 3340, 3344, 3396, 3400, 3407, 3455, 3459, 3478, 3505, 3515, 3517, 3526, 3530, 3540, 3542, 3551, 3567, 3572, 3642, 3675, 3714, 3716, 3722, 3747, 3749, 3773, 3780, 3782, 3790, 3801, 3807, 3911, 3948, 3991, 4028, 4044, 4058, 4293, 4295, 4301, 4680, 4685, 4694, 4696, 4701, 4744, 4749, 4784, 4789, 4798, 4800, 4805, 4822, 4880, 4885, 4954, 4988, 5017, 5109, 5117, 5788, 5880, 5909, 5942, 5971, 5996, 6000, 6003, 6109, 6121, 6137, 6169, 6264, 6314, 6389, 6430, 6443, 6459, 6464, 6509, 6516, 6571, 6601, 6618, 6683, 6750, 6780, 6793, 6809, 6829, 6862, 6988, 7155, 7223, 7241, 7306, 7354, 7367, 7418, 7957, 7965, 8005, 8013, 8023, 8025, 8027, 8029, 8061, 8116, 8132, 8147, 8155, 8175, 8180, 8190, 8292, 8334, 8348, 8384, 8432, 8587, 9257, 9290, 11123, 11157, 11507, 11557, 11559, 11565, 11623, 11632, 11670, 11686, 11694, 11702, 11710, 11718, 11726, 11734, 11742, 11869, 12019, 12245, 12351, 12438, 12543, 12591, 12686, 12773, 12830, 42124, 42182, 42539, 42743, 42957, 42961, 42963, 42972, 43052, 43065, 43127, 43205, 43225, 43347, 43388, 43469, 43481, 43518, 43574, 43597, 43609, 43714, 43766, 43782, 43790, 43798, 43814, 43822, 43883, 44013, 44025, 55203, 55238, 55291, 64109, 64217, 64262, 64279, 64310, 64316, 64318, 64321, 64324, 64450, 64911, 64967, 64975, 65049, 65106, 65126, 65131, 65140, 65276, 65279, 65470, 65479, 65487, 65495, 65500, 65510, 65518, 65533, 65547, 65574, 65594, 65597, 65613, 65629, 65786, 65794, 65843, 65934, 65948, 65952, 66045, 66204, 66256, 66299, 66339, 66378, 66426, 66461, 66499, 66517, 66717, 66729, 66771, 66811, 66855, 66915, 66938, 66954, 66962, 66965, 66977, 66993, 67001, 67004, 67059, 67382, 67413, 67431, 67461, 67504, 67514, 67589, 67592, 67637, 67640, 67644, 67669, 67742, 67759, 67826, 67829, 67867, 67897, 67903, 68023, 68047, 68099, 68102, 68115, 68119, 68149, 68154, 68168, 68184, 68255, 68326, 68342, 68405, 68437, 68466, 68497, 68508, 68527, 68680, 68786, 68850, 68903, 68921, 68965, 68997, 69007, 69246, 69289, 69293, 69297, 69316, 69415, 69465, 69513, 69579, 69622, 69709, 69749, 69826, 69837, 69864, 69881, 69940, 69959, 70006, 70111, 70132, 70161, 70209, 70278, 70280, 70285, 70301, 70313, 70378, 70393, 70403, 70412, 70416, 70440, 70448, 70451, 70457, 70468, 70472, 70477, 70480, 70487, 70499, 70508, 70516, 70537, 70539, 70542, 70581, 70592, 70594, 70597, 70602, 70613, 70616, 70626, 70747, 70753, 70855, 70873, 71093, 71133, 71236, 71257, 71276, 71353, 71369, 71395, 71450, 71467, 71494, 71739, 71922, 71942, 71945, 71955, 71958, 71989, 71992, 72006, 72025, 72103, 72151, 72164, 72263, 72354, 72440, 72457, 72673, 72697, 72712, 72758, 72773, 72812, 72847, 72871, 72886, 72966, 72969, 73014, 73018, 73021, 73031, 73049, 73061, 73064, 73102, 73105, 73112, 73129, 73464, 73488, 73530, 73562, 73648, 73713, 74649, 74862, 74868, 75075, 77810, 78933, 82938, 83526, 90425, 92728, 92766, 92777, 92862, 92873, 92909, 92917, 92997, 93017, 93025, 93047, 93071, 93561, 93850, 94026, 94087, 94111, 94180, 94193, 100343, 101589, 101640, 110579, 110587, 110590, 110882, 110898, 110930, 110933, 110951, 111355, 113770, 113788, 113800, 113817, 113827, 118009, 118451, 118573, 118598, 118723, 119029, 119274, 119365, 119507, 119539, 119638, 119672, 120485, 120779, 121483, 121503, 121519, 122654, 122666, 122886, 122904, 122913, 122916, 122922, 122989, 123023, 123180, 123197, 123209, 123215, 123566, 123641, 123647, 124153, 124410, 124415, 124902, 124907, 124910, 124926, 125124, 125142, 125259, 125273, 125279, 126132, 126269, 126467, 126495, 126498, 126500, 126503, 126514, 126519, 126521, 126523, 126530, 126535, 126537, 126539, 126543, 126546, 126548, 126551, 126553, 126555, 126557, 126559, 126562, 126564, 126570, 126578, 126583, 126588, 126590, 126601, 126619, 126627, 126633, 126651, 126705, 127019, 127123, 127150, 127167, 127183, 127221, 127405, 127490, 127547, 127560, 127569, 127589, 128727, 128748, 128764, 128886, 128985, 129003, 129008, 129035, 129095, 129113, 129159, 129197, 129211, 129217, 129619, 129645, 129660, 129673, 129734, 129756, 129769, 129784, 129938, 130041, 173791, 177976, 178205, 183969, 191456, 192093, 195101, 201546, 205743, 917505, 917631, 917999];

let id = 0;
const getAddEle = () => {
  id++;
  return `
    U+
    <div class="material-input-container" style="margin-top: 5px;">
      <input id="${id}-1" type="text" class="uni" oninput="inspect(this)">
      <label for="${id}-1" class="placeholder">起始码位</label>
      <span></span>
    </div>
    ~U+
    <div class="material-input-container" style="margin-top: 5px;">
      <input id="${id}-2" type="text" class="uni" oninput="inspect(this)">
      <label for="${id}-2" class="placeholder">结束码位</label>
      <span></span>
    </div>
    <button onclick="remove(this.parentNode)" class="rem-button">×</button>
  `;
};

const characterSets = {
  includeDigits: '0123456789'.toArray(),
  includeLowercase: 'abcdefghijklmnopqrstuvwxyz'.toArray(),
  includeUppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.toArray(),
  includeSpecialSymbols: "!'#$%&'()*+,-./:;<=>?@[]^_`{|}~".toArray(),
  includeBasicChinese: rangeArr(0x4e00, 0x9fff),
  includeExtendedAChinese: rangeArr(0x3400, 0x4dbf),
  includeExtendedBChinese: rangeArr(0x20000, 0x2a6df),
  includeExtendedCChinese: rangeArr(0x2a700, 0x2b73a),
  includeExtendedDChinese: rangeArr(0x2b740, 0x2b81d),
  includeExtendedEChinese: rangeArr(0x2b820, 0x2cea1),
  includeExtendedFChinese: rangeArr(0x2ceb0, 0x2ebe0),
  includeExtendedGChinese: rangeArr(0x30000, 0x3134a),
  includeExtendedHChinese: rangeArr(0x31350, 0x323af),
  includeExtendedIChinese: rangeArr(0x2ebf0, 0x2ee5d),
  includeExtendedJChinese: rangeArr(0x323b0, 0x3347b),
  includeCompatibleChinese: [
    ...rangeArr(0xf900, 0xfa6d),
    ...rangeArr(0xfa70, 0xfad9),
  ],
  includeCompatibleSupplementChinese: rangeArr(0x2f800, 0x2fa1d),
};
const dom = {};

[
  'includeDigits',
  'includeLowercase',
  'includeUppercase',
  'includeSpecialSymbols',
  'includeBasicChinese',
  'includeExtendedAChinese',
  'includeExtendedBChinese',
  'includeExtendedCChinese',
  'includeExtendedDChinese',
  'includeExtendedEChinese',
  'includeExtendedFChinese',
  'includeExtendedGChinese',
  'includeExtendedHChinese',
  'includeExtendedIChinese',
  'includeCompatibleChinese',
  'includeCompatibleSupplementChinese',
  'includeCustomChar',
  'includeCustomInterval',
  'includeCustomUnicodeBlocks',
  'noRepeat',
  'containsNoUndefinedCharacters',
].forEach((name) => (dom[name] = document.getElementById(name)));

function inspect(ele) {
  const inputValue = ele.value;

  if (!validCode.test(inputValue)) {
    ele.value = '';
  }
}

function add(ele, content) {
  const div = document.createElement('div');
  div.innerHTML = content;
  ele.appendChild(div);
  ele.style.display = 'flex';
}

function remove(ele) {
  if (!(ele.parentNode.children.length - 1)) {
    ele.parentNode.style.display = null;
  }
  ele.remove();
}

function updateInputValue() {
  countInput.value = slider.value;
  countInput.dispatchEvent(new Event('focus'));
}

function updateSliderValue() {
  if (+countInput.value > 1000) countInput.value = 1000;
  slider.value = countInput.value;
}

function isDefinedChar(code) {
  const startCodeIndex = definedCharacterStartList.findIndex(startCode => startCode > code) - 1;
  const endCode = definedCharacterEndList[startCodeIndex];
  if (code <= endCode) return true;
  return false;
}

function cancelSelect(targetSelect, targetSelectVisible, ele) {
  selectBlocks.dispatchEvent(
    new CustomEvent('cancelSelect', {
      detail: { targetSelect: targetSelect, targetSelectVisible: targetSelectVisible },
    })
  );
}

function generateRandomCharacters() {
  let count = parseInt(countInput.value);
  if (count > 1000) count = 1000;
  const options = {};

  for (const key in dom) {
    if (Object.hasOwnProperty.call(dom, key)) {
      options[key] = dom[key].checked;
    }
  }

  var characters = [];
  characterSets.includeCustomChar = customCharEle.value.toArray();
  for (const option in options) {
    if (options[option] && characterSets[option]) {
      characters.push(...characterSets[option]);
    }
  }

  if (options.includeCustomInterval) {
    [...customIntervalContainer.children].forEach((chi) => {
      const [inpu, inpu2] = chi.getElementsByTagName('input');
      if (inpu.value && inpu2.value)
        characters = characters.concat(
          rangeArr(parseInt(inpu.value, 16), parseInt(inpu2.value, 16))
        );
    });
  }

  if (options.includeCustomUnicodeBlocks) {
    for (selectedBlock of selectedBlocks) {
      characters = characters.concat(rangeArr(...selectedBlock));
    }
  }

  if (options.containsNoUndefinedCharacters) {
    characters = characters.filter(isDefinedChar);
  }

  let result = '';

  if (!characters.length) {
    result = '';
  } else if (!options.noRepeat) {
    for (let i = 0; i < count; i++) {
      const chart = String.fromCodePoint(
        characters[getRandomNumber(0, characters.length - 1)]
      );
      result += chart;
    }
  } else {
    for (let i = 0; i < count && characters.length; i++) {
      const index = characters[getRandomNumber(0, characters.length - 1)];
      const chart = String.fromCodePoint(index);
      result += chart;
      characters.removeAll(index);
    }
  }
  resultTextarea.value = result;
  resultTextarea.dispatchEvent(new Event('input'));
}

function rangeArr(start, end) {
  return new Array(end - start + 1).fill(0).map((_, i) => i + start);
}

function getRandomNumber(min, max) {
  if (min > max) return;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function copy(text) {
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
}

function clearText() {
  resultTextarea.value = '';
  resultTextarea.dispatchEvent(new Event('input'));
}

selectBlocks.addEventListener('select', (e) => {
  const selections = e.detail.select;
  const visibleSelections = e.detail.selectVisible;
  selectedBlocks = selections.map((selection) => selection.split(',').map((e) => parseInt(e, 16)))

  customBlocksContainer.innerHTML = '';
  customBlocksContainer.style.display = null;

  selections.forEach((selection, i) => {
    add(customBlocksContainer, `
      ${visibleSelections[i]}<button onclick="cancelSelect('${selection}', '${visibleSelections[i]}', this.parentNode)" class="rem-button">×</button>
    `)
  });
});
