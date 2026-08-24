import '@css/mainStyles.css';
import '@css/refuse.css';
import '@css/pages/chaoticCanvas.css';

import '@js/m3ui.js';
import '@js/changeHeader.js';
import '@js/iframeColorSchemeSync.js';

class Effect {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.running = false;
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  update(dt) {}

  draw() {}
}

class EffectManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = [];
    this.lastTime = 0;
    this.animationId = null;
    this.isVisible = !document.hidden;  // 初始可见性状态
    this._loop = this._loop.bind(this);
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    
    // 监听可见性变化
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }

  _handleVisibilityChange() {
    this.isVisible = !document.hidden;
    
    if (this.isVisible && this.effects.length > 0 && this.animationId === null) {
      // 页面重新可见，恢复动画循环
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this._loop);
    } else if (!this.isVisible && this.animationId !== null) {
      // 页面不可见，停止动画循环
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  addEffect(effect) {
    this.effects.push(effect);
    effect.start();
    if (this.effects.length === 1 && this.isVisible) {
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this._loop);
    }
  }

  removeEffect(effect) {
    const index = this.effects.indexOf(effect);
    if (index > -1) {
      this.effects[index].stop();
      this.effects.splice(index, 1);
    }
    if (this.effects.length === 0 && this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  _loop(timestamp) {
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 更新和绘制所有效果
    for (const effect of this.effects) {
      if (effect.running) {
        effect.update(dt);
        effect.draw();
      }
    }

    this.animationId = requestAnimationFrame(this._loop);
  }
}

class GridEffect extends Effect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.cellSize = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.rotation = 0;
    this.scale = 1;
    this.time = 0;
    this.hue = 0;
    this._resize();
  }

  _resize() {
    // 单元格边长：min(10dvh, 10dvw)
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    this.cellSize = Math.min(10 * vh, 10 * vw);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const cell = this.cellSize;

    // —— 平移：使用 tan 与 cos 组合，产生不规则的利萨如式轨迹 ——
    const radius = cell * 0.5;
    this.offsetX = Math.tan(t * 0.7) * radius * 0.3;
    this.offsetY = Math.cos(t * 1.3) * (1 / Math.tan(t * 0.9 + 0.5)) * radius * 0.3;

    // —— 旋转：使用多个三角函数叠加，产生非匀速且方向变化的旋转 ——
    this.rotation = 
      Math.sin(t * 0.8) * 0.8 + 
      Math.cos(t * 1.7) * 0.5 + 
      Math.sin(t * 3.1) * 0.3;

    // —— 缩放：通过三角函数构造值域 [0.3, 2.2] 的平滑变化 ——
    const scaleRaw = 
      Math.sin(t * 1.1) * 0.6 + 
      Math.cos(t * 2.3) * 0.4 + 
      Math.sin(t * 4.7) * 0.2;
    const normalized = Math.tanh(scaleRaw);
    this.scale = 1.25 + 0.95 * normalized;

    // —— 色相：1.2秒内从0线性到360，循环 ——
    this.hue = (t % 1.2) / 1.2 * 360;
  }

  draw() {
    const { ctx, canvas, cellSize, offsetX, offsetY, rotation, scale, hue } = this;
    const width = canvas.width;
    const height = canvas.height;

    ctx.save();

    ctx.strokeStyle = `hsl(${hue}deg, 100%, 50%)`;
    ctx.lineWidth = Math.max(1, canvas.width * 0.0015);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    const startX = offsetX % cellSize;
    const startY = offsetY % cellSize;

    const extendX = Math.ceil(width / scale) + cellSize;
    const extendY = Math.ceil(height / scale) + cellSize;

    for (let x = startX - extendX; x <= width + extendX; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, -extendY);
      ctx.lineTo(x, height + extendY);
      ctx.stroke();
    }

    for (let y = startY - extendY; y <= height + extendY; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(-extendX, y);
      ctx.lineTo(width + extendX, y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class BlockFlashEffect extends Effect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.blocks = [];
    this.spawnTimer = 0;
    this.nextSpawnDelay = this._randomDelay();
    this._resize();
  }

  _resize() {
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    this.dvmin = Math.min(vw, vh);
  }

  _randomDelay() {
    return Math.random() * 0.3;
  }

  _randomBlock() {
    const minSize = 10 * this.dvmin;
    const maxSize = 20 * this.dvmin;
    
    const dpr = window.devicePixelRatio || 1;
    
    const block = {
      x: Math.random() * this.canvas.width / dpr,
      y: Math.random() * this.canvas.height / dpr,
      width: minSize + Math.random() * (maxSize - minSize),
      height: minSize + Math.random() * (maxSize - minSize),
      hue: Math.random() * 360,
      saturation: 80 + Math.random() * 20,   // 80~100%
      lightness: 40 + Math.random() * 20,     // 40~60%
      age: 0,
      lifetime: 0.2 + Math.random() * 0.4,    // 0.2~0.6秒
    };
    
    return block;
  }

  update(dt) {
    this.spawnTimer += dt;
    while (this.spawnTimer >= this.nextSpawnDelay) {
      this.spawnTimer -= this.nextSpawnDelay;
      this.nextSpawnDelay = this._randomDelay();
      
      const count = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        this.blocks.push(this._randomBlock());
      }
    }

    for (let i = this.blocks.length - 1; i >= 0; i--) {
      this.blocks[i].age += dt;
      if (this.blocks[i].age >= this.blocks[i].lifetime) {
        this.blocks.splice(i, 1);
      }
    }
  }

  draw() {
    const { ctx } = this;
    
    for (const block of this.blocks) {
      const remaining = 1 - block.age / block.lifetime;
      const alpha = Math.max(0, Math.min(1, remaining));
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${block.hue}deg, ${block.saturation}%, ${block.lightness}%)`;
      
      const halfW = block.width / 2;
      const halfH = block.height / 2;
      ctx.fillRect(block.x - halfW, block.y - halfH, block.width, block.height);
      
      ctx.restore();
    }
  }
}

class TriangleFlashEffect extends Effect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.triangles = [];
    this.spawnTimer = 0;
    this.nextSpawnDelay = this._randomDelay();
    this._resize();
  }

  _resize() {
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    this.dvmin = Math.min(vw, vh);
  }

  _randomDelay() {
    // 0.3~0.6秒
    return 0.3 + Math.random() * 0.3;
  }

  _rotatePoint(px, py, cx, cy, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }

  _randomTriangle() {
    const minSize = 10 * this.dvmin;
    const maxSize = 20 * this.dvmin;
    
    const dpr = window.devicePixelRatio || 1;
    
    const rotationDirection = Math.random() < 0.5 ? 1 : -1;
    
    const triangle = {
      x: Math.random() * this.canvas.width / dpr,
      y: Math.random() * this.canvas.height / dpr,
      sideLength: minSize + Math.random() * (maxSize - minSize),
      baseRotation: Math.random() * Math.PI * 2,  // 初始随机旋转角度
      targetRotation: (60 + Math.random() * 260) * (Math.PI / 180) * rotationDirection,  // 60~320度，随机方向
      targetScale: 1.2 + Math.random() * 0.8,  // 1.2~2倍
      hue: Math.random() * 360,
      saturation: 80 + Math.random() * 20,   // 80~100%
      lightness: 40 + Math.random() * 20,     // 40~60%
      lineWidth: 3 + Math.random() * 5,       // 粗边框，3~8px
      age: 0,
      lifetime: 1 + Math.random() * 0.2,      // 1~1.2秒
    };
    
    return triangle;
  }

  _easeOutSine(t) {
    return Math.sin((t * Math.PI) / 2);
  }

  update(dt) {
    this.spawnTimer += dt;
    while (this.spawnTimer >= this.nextSpawnDelay) {
      this.spawnTimer -= this.nextSpawnDelay;
      this.nextSpawnDelay = this._randomDelay();
      
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.triangles.push(this._randomTriangle());
      }
    }

    for (let i = this.triangles.length - 1; i >= 0; i--) {
      this.triangles[i].age += dt;
      if (this.triangles[i].age >= this.triangles[i].lifetime) {
        this.triangles.splice(i, 1);
      }
    }
  }

  draw() {
    const { ctx } = this;
    
    for (const tri of this.triangles) {
      const remaining = 1 - tri.age / tri.lifetime;
      const alpha = Math.max(0, Math.min(1, remaining));
      
      const progress = Math.min(1, tri.age / tri.lifetime);
      const easedProgress = this._easeOutSine(progress);
      
      const currentRotation = tri.baseRotation + tri.targetRotation * easedProgress;
      const currentScale = 1 + (tri.targetScale - 1) * easedProgress;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `hsl(${tri.hue}deg, ${tri.saturation}%, ${tri.lightness}%)`;
      ctx.lineWidth = tri.lineWidth * currentScale;  // 线粗同步缩放
      ctx.lineCap = 'miter';
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 10;
      
      const halfSide = tri.sideLength / 2;
      const height = tri.sideLength * Math.sqrt(3) / 2;
      const centerToVertex = height * 2 / 3;
      const centerToBase = height / 3;
      
      // 顶角
      const topX = tri.x;
      const topY = tri.y - centerToVertex;
      
      // 左下角
      const leftX = tri.x - halfSide;
      const leftY = tri.y + centerToBase;
      
      // 右下角
      const rightX = tri.x + halfSide;
      const rightY = tri.y + centerToBase;
      
      // 先应用缩放
      const scaledTop = {
        x: tri.x + (topX - tri.x) * currentScale,
        y: tri.y + (topY - tri.y) * currentScale
      };
      const scaledLeft = {
        x: tri.x + (leftX - tri.x) * currentScale,
        y: tri.y + (leftY - tri.y) * currentScale
      };
      const scaledRight = {
        x: tri.x + (rightX - tri.x) * currentScale,
        y: tri.y + (rightY - tri.y) * currentScale
      };
      
      // 应用旋转
      const rotatedTop = this._rotatePoint(scaledTop.x, scaledTop.y, tri.x, tri.y, currentRotation);
      const rotatedLeft = this._rotatePoint(scaledLeft.x, scaledLeft.y, tri.x, tri.y, currentRotation);
      const rotatedRight = this._rotatePoint(scaledRight.x, scaledRight.y, tri.x, tri.y, currentRotation);
      
      // 绘制三角形边框
      ctx.beginPath();
      ctx.moveTo(rotatedTop.x, rotatedTop.y);
      ctx.lineTo(rotatedLeft.x, rotatedLeft.y);
      ctx.lineTo(rotatedRight.x, rotatedRight.y);
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    }
  }
}

// 随机圆形移动效果
class CircleMoveEffect extends Effect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.circles = [];
    this.spawnTimer = 0;
    this.nextSpawnDelay = this._randomDelay();
    this._resize();
  }

  _resize() {
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    this.dvmin = Math.min(vw, vh);
  }

  _randomDelay() {
    return 0.3 + Math.random() * 0.3;
  }

  _randomCircle() {
    const minSize = 10 * this.dvmin;
    const maxSize = 20 * this.dvmin;
    
    const dpr = window.devicePixelRatio || 1;
    const minDistance = 10 * this.dvmin;
    
    let startX, startY, targetX, targetY;
    let distance = 0;
    
    do {
      startX = Math.random() * this.canvas.width / dpr;
      startY = Math.random() * this.canvas.height / dpr;
      targetX = Math.random() * this.canvas.width / dpr;
      targetY = Math.random() * this.canvas.height / dpr;
      
      const dx = targetX - startX;
      const dy = targetY - startY;
      distance = Math.sqrt(dx * dx + dy * dy);
    } while (distance < minDistance);
    
    const circle = {
      // 起始位置
      startX: startX,
      startY: startY,
      // 目标位置
      targetX: targetX,
      targetY: targetY,
      // 当前实际位置
      x: startX,
      y: startY,
      radius: minSize + Math.random() * (maxSize - minSize),
      targetScale: 0.2 + Math.random() * 0.3,  // 0.2~0.5倍（越来越小）
      hue: Math.random() * 360,
      saturation: 80 + Math.random() * 20,   // 80~100%
      lightness: 40 + Math.random() * 20,     // 40~60%
      age: 0,
      lifetime: 1 + Math.random() * 0.2,      // 1~1.2秒
    };
    
    return circle;
  }

  _easeOutSine(t) {
    return Math.sin((t * Math.PI) / 2);
  }

  update(dt) {
    this.spawnTimer += dt;
    while (this.spawnTimer >= this.nextSpawnDelay) {
      this.spawnTimer -= this.nextSpawnDelay;
      this.nextSpawnDelay = this._randomDelay();
      
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.circles.push(this._randomCircle());
      }
    }

    for (let i = this.circles.length - 1; i >= 0; i--) {
      const circle = this.circles[i];
      circle.age += dt;
      
      const progress = Math.min(1, circle.age / circle.lifetime);
      const easedProgress = this._easeOutSine(progress);
      
      circle.x = circle.startX + (circle.targetX - circle.startX) * easedProgress;
      circle.y = circle.startY + (circle.targetY - circle.startY) * easedProgress;
      
      if (circle.age >= circle.lifetime) {
        this.circles.splice(i, 1);
      }
    }
  }

  draw() {
    const { ctx } = this;
    
    for (const circle of this.circles) {
      const remaining = 1 - circle.age / circle.lifetime;
      const alpha = Math.max(0, Math.min(1, remaining));
      
      const progress = Math.min(1, circle.age / circle.lifetime);
      const easedProgress = this._easeOutSine(progress);
      
      const currentScale = 1 + (circle.targetScale - 1) * easedProgress;
      const currentRadius = circle.radius * currentScale;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${circle.hue}deg, ${circle.saturation}%, ${circle.lightness}%)`;
      
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }
}

class EdgeGradientEffect extends Effect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.time = 0;
    this.gradientLength = 0;
    this._resize();
  }

  _resize() {
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    this.dvmin = Math.min(vw, vh);
    this.gradientLength = 10 * this.dvmin;
  }

  update(dt) {
    this.time += dt;
  }

  draw() {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    const cycleTime = this.time % 1.2;
    const colorValue = cycleTime / 1.2;
    const grayValue = Math.floor((Math.sin(colorValue * Math.PI * 2 - Math.PI / 2) + 1) / 2 * 255);
    const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    
    const lengthCycleTime = this.time % 2.4;  // 波长2.4秒
    const lengthValue = lengthCycleTime / 2.4;
    const lengthSin = (Math.sin(lengthValue * Math.PI * 2 + Math.PI / 3) + 1) / 2;  // 相位偏移π/3
    const gradientLength = (10 + 10 * lengthSin) * this.dvmin;  // 10~20dvmin
    
    ctx.save();
    
    // 上边渐变（从上往下）
    const topGradient = ctx.createLinearGradient(0, 0, 0, gradientLength);
    topGradient.addColorStop(0, color);
    topGradient.addColorStop(1, '#00000000');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, width, gradientLength);
    
    // 下边渐变（从下往上）
    const bottomGradient = ctx.createLinearGradient(0, height, 0, height - gradientLength);
    bottomGradient.addColorStop(0, color);
    bottomGradient.addColorStop(1, '#00000000');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, height - gradientLength, width, gradientLength);
    
    // 左边渐变（从左往右）
    const leftGradient = ctx.createLinearGradient(0, 0, gradientLength, 0);
    leftGradient.addColorStop(0, color);
    leftGradient.addColorStop(1, '#00000000');
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, 0, gradientLength, height);
    
    // 右边渐变（从右往左）
    const rightGradient = ctx.createLinearGradient(width, 0, width - gradientLength, 0);
    rightGradient.addColorStop(0, color);
    rightGradient.addColorStop(1, '#00000000');
    ctx.fillStyle = rightGradient;
    ctx.fillRect(width - gradientLength, 0, gradientLength, height);
    
    ctx.restore();
  }
}

// 初始化
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const manager = new EffectManager(canvas);

const gridEffect = new GridEffect(canvas, ctx);
const blockFlashEffect = new BlockFlashEffect(canvas, ctx);
const triangleFlashEffect = new TriangleFlashEffect(canvas, ctx);
const circleMoveEffect = new CircleMoveEffect(canvas, ctx);
const edgeGradientEffect = new EdgeGradientEffect(canvas, ctx);
manager.addEffect(gridEffect);
manager.addEffect(blockFlashEffect);
manager.addEffect(triangleFlashEffect);
manager.addEffect(circleMoveEffect);
manager.addEffect(edgeGradientEffect);

const dpr = window.devicePixelRatio || 1;
const resizeCanvas = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 通知效果更新尺寸相关参数
  for (const effect of manager.effects) {
    effect._resize?.();
  }
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
