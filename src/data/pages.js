const pages = {
  charTools: {
    charDisplay: '字符显示器',
    ziSrc: '字源查找',
    randStr: '随机字符生成器',
    idsAST: 'IDS 抽象语法树',
    textToImg: '文字转图片',
    strokes: '84-30 画的汉字',
    styleLetter: '字母样式生成器',
    zalog: 'zalog 文本生成器',
    ogham: '欧甘文字转换器',
    rot180deg: '倒立字符生成器',
    seeker: '字形检索'
  },
  otherTools: {
    morse: '莫尔斯电报机',
    CPStest: 'CPS 测试器',
    SIprefix: 'SI 词头',
    audioFFT: '音频 FFT'
  },
  fun: {
    GuClock: '“骨”钟',
    DouCompass: '“<span class="font-idc">&#xE100;</span>”指南针',
    HuAccelerometer: '“户”加速度计',
    lifeGame: '生命游戏',
    speakLikeBook: '咬文嚼字',
    fuckToFly: '全部草飞！',
    pointMoveWithSeg: '点在移动时的连线',
    typewriter: '打字机',
    randFuck: '随机草人器',
    chaoticCanvas: '瞎眼特效'
  }
};

const flatPages = {}
for (const type in pages) {
  for (const fileName in pages[type]) {
    flatPages[fileName] = pages[type][fileName]
  }
}

module.exports = { pages, flatPages };
