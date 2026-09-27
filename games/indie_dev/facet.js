/* 卡面生成器：孟菲斯波普几何拼贴
 * 左半区湖蓝、右半区朱红，中央留一条奶白排版区（锯齿黑线收边）
 * 完全扁平：3px 黑描边 + 黑色硬投影，无渐变无发光
 *
 * 用法：
 *   drawFacet(cv, seed);                 // seed 相同则画面相同
 *   drawFacet(cv, seed, pal);            // pal={blues,reds,accents,base}
 */
(function (global) {
  'use strict';

  var W = 768, H = 432;
  var INK = '#1A1A1A', CREAM = '#FFF8EE';

  var DEF_BLUES = ['#2EC4FF', '#1DA3DB', '#5ED6FF', '#0E82B5', '#8FE6FF'];
  var DEF_REDS  = ['#FF4B3E', '#DB2E22', '#FF7A70', '#B31E14', '#FFA79F'];
  var DEF_ACC   = ['#FFD400', '#3DDC97', '#FF6FB1'];

  /* 中央奶白排版区（逻辑坐标） */
  var CX0 = 236, CX1 = 532;

  /* mulberry32：种子随机，保证同一 seed 画面一致 */
  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function rr(rnd, a, b) { return a + rnd() * (b - a); }
  function shuffled(rnd, n) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function trace(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.closePath(); }
  function rect(c, x, y, w, h) { trace(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }

  /* 硬投影 + 填充 + 黑描边（孟菲斯三件套） */
  function block(c, pathFn, color, dx, dy) {
    c.save();
    c.translate(dx === undefined ? 7 : dx, dy === undefined ? 7 : dy);
    c.fillStyle = INK; pathFn(c); c.fill();
    c.restore();
    c.fillStyle = color; pathFn(c); c.fill();
    c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    pathFn(c); c.stroke();
  }

  /* 半调网点 */
  function halftone(c, x0, y0, x1, y1, color, rnd) {
    c.fillStyle = color;
    for (var y = y0; y < y1; y += 18)
      for (var x = x0; x < x1; x += 18)
        if (rnd() > 0.35) { c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill(); }
  }

  /* ===== 构图母题（每个占一个区域，刻意互不相同） ===== */

  /* 大斜切三角 + 放射线 */
  function mTri(c, a, rnd, cols) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var p = [
      [a.x0 + rr(rnd, 0, .15) * w, a.y1 - 8],
      [a.x0 + rr(rnd, .35, .6) * w, a.y0 + rr(rnd, .12, .3) * h],
      [a.x1 - 8, a.y1 - 8]
    ];
    block(c, function (cc) { trace(cc, p); }, pick(rnd, cols));
    var cx = a.x1 - rr(rnd, .12, .35) * w, cy = a.y0 + rr(rnd, .18, .38) * h;
    c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      var ang = -Math.PI / 2 + (i - 2) * 0.3 + rr(rnd, -.05, .05);
      var l = rr(rnd, 45, 95);
      c.beginPath();
      c.moveTo(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 20);
      c.lineTo(cx + Math.cos(ang) * l, cy + Math.sin(ang) * l);
      c.stroke();
    }
  }

  /* 半圆 + 锯齿波浪条 + 点阵 */
  function mSemi(c, a, rnd, cols, acc) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var cx = a.x0 + rr(rnd, .3, .6) * w, cy = a.y0 + rr(rnd, .45, .72) * h;
    var r = Math.min(w, h) * rr(rnd, .3, .45);
    block(c, function (cc) { cc.beginPath(); cc.arc(cx, cy, r, Math.PI, Math.PI * 2); cc.closePath(); }, pick(rnd, cols));
    var y = a.y0 + rr(rnd, .12, .28) * h, pts = [], x, k = 0;
    for (x = a.x0 + 6; x <= a.x1 - 6; x += 20, k++) pts.push([x, y + (k % 2 ? 7 : -7)]);
    pts.push([a.x1 - 6, y + 12]); pts.push([a.x0 + 6, y + 12]);
    block(c, function (cc) { trace(cc, pts); }, pick(rnd, acc));
    halftone(c, a.x0 + 10, a.y1 - h * .34, a.x1 - 10, a.y1 - 10, pick(rnd, cols), rnd);
  }

  /* 圆日 + 闪电 */
  function mSun(c, a, rnd, cols, acc) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var cx = a.x0 + rr(rnd, .35, .65) * w, cy = a.y0 + rr(rnd, .35, .6) * h;
    block(c, function (cc) { circle(cc, cx, cy, Math.min(w, h) * rr(rnd, .22, .32)); }, pick(rnd, cols));
    var bx = a.x0 + rr(rnd, .15, .45) * w, by = a.y0 + rr(rnd, .15, .4) * h;
    var s = Math.min(w, h) * rr(rnd, .2, .3);
    var p = [
      [bx, by], [bx + s * .5, by], [bx + s * .15, by + s * .5],
      [bx + s * .7, by + s * .5], [bx, by + s * 1.1],
      [bx + s * .3, by + s * .5], [bx - s * .05, by + s * .5]
    ];
    block(c, function (cc) { trace(cc, p); }, pick(rnd, acc));
  }

  /* 梯形 + 斜条纹方块 */
  function mTrap(c, a, rnd, cols) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var y0 = a.y0 + h * rr(rnd, .1, .26), y1 = a.y1 - h * rr(rnd, .08, .2);
    var t = [
      [a.x0 + rr(rnd, .05, .2) * w, y1], [a.x0 + rr(rnd, .3, .5) * w, y0],
      [a.x1 - rr(rnd, .05, .2) * w, y0], [a.x1 - rr(rnd, .02, .1) * w, y1]
    ];
    block(c, function (cc) { trace(cc, t); }, pick(rnd, cols));
    var s = Math.min(w, h) * rr(rnd, .18, .26);
    var bx = a.x0 + rr(rnd, .12, .55) * w, by = a.y1 - h * rr(rnd, .3, .52);
    block(c, function (cc) { rect(cc, bx, by, s, s); }, pick(rnd, cols));
    c.save();
    c.beginPath(); c.rect(bx, by, s, s); c.clip();
    c.strokeStyle = INK; c.lineWidth = 3;
    for (var i = -s; i < s * 2; i += 13) {
      c.beginPath(); c.moveTo(bx + i, by); c.lineTo(bx + i + s, by + s); c.stroke();
    }
    c.restore();
  }

  /* 同心圆环 */
  function mRings(c, a, rnd, cols) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var cx = a.x0 + rr(rnd, .3, .6) * w, cy = a.y0 + rr(rnd, .35, .65) * h;
    var R = Math.min(w, h) * rr(rnd, .28, .4);
    block(c, function (cc) { circle(cc, cx, cy, R); }, pick(rnd, cols));
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, R * .58, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, R * .28, 0, Math.PI * 2); c.stroke();
  }

  /* 阶梯方块群 */
  function mStair(c, a, rnd, cols) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var n = 3 + Math.floor(rnd() * 2), s = Math.min(w / (n + 1), h * .3), i, x, y;
    for (i = 0; i < n; i++) {
      x = a.x0 + rr(rnd, .06, .5) * w; y = a.y0 + rr(rnd, .12, .6) * h;
      block(c, (function (x, y) { return function (cc) { rect(cc, x, y, s, s); }; })(x, y), pick(rnd, cols));
    }
  }

  /* 十字星 + 点阵 */
  function mStar(c, a, rnd, cols, acc) {
    var w = a.x1 - a.x0, h = a.y1 - a.y0;
    var cx = a.x0 + rr(rnd, .3, .65) * w, cy = a.y0 + rr(rnd, .3, .65) * h;
    var s = Math.min(w, h) * rr(rnd, .18, .28), m = s * .32;
    var p = [
      [cx - m, cy - s], [cx + m, cy - s], [cx + m, cy - m], [cx + s, cy - m],
      [cx + s, cy + m], [cx + m, cy + m], [cx + m, cy + s], [cx - m, cy + s],
      [cx - m, cy + m], [cx - s, cy + m], [cx - s, cy - m], [cx - m, cy - m]
    ];
    block(c, function (cc) { trace(cc, p); }, pick(rnd, acc));
    halftone(c, a.x0 + 10, a.y0 + 10, a.x1 - 10, a.y0 + h * .38, pick(rnd, cols), rnd);
  }

  var MOTIFS = [mTri, mSemi, mSun, mTrap, mRings, mStair, mStar];

  /* 几何块拼成的小骑士剪影 */
  function knight(c, x, y, s, color) {
    var head = [[x, y - 15 * s], [x + 9 * s, y - 15 * s], [x + 11 * s, y - 8 * s], [x + 5 * s, y - 4 * s], [x, y - 8 * s]];
    var body = [[x - 4 * s, y - 4 * s], [x + 13 * s, y - 4 * s], [x + 10 * s, y + 11 * s], [x - 1 * s, y + 11 * s]];
    var sword = [[x + 15 * s, y - 17 * s], [x + 18 * s, y - 17 * s], [x + 18 * s, y + 2 * s], [x + 15 * s, y + 2 * s]];
    var guard = [[x + 12 * s, y + 2 * s], [x + 21 * s, y + 2 * s], [x + 21 * s, y + 5 * s], [x + 12 * s, y + 5 * s]];
    block(c, function (cc) { trace(cc, head); }, color, 4, 4);
    block(c, function (cc) { trace(cc, body); }, color, 4, 4);
    block(c, function (cc) { trace(cc, sword); }, INK, 3, 3);
    block(c, function (cc) { trace(cc, guard); }, INK, 3, 3);
  }

  /* 单侧：上下两个区域各取一种母题，且互不相同 */
  function drawSide(c, x0, x1, rnd, cols, acc) {
    var mid = H * 0.52;
    var m = shuffled(rnd, MOTIFS.length);
    MOTIFS[m[0]](c, { x0: x0, y0: 0, x1: x1, y1: mid }, rnd, cols, acc);
    MOTIFS[m[1]](c, { x0: x0, y0: mid, x1: x1, y1: H }, rnd, cols, acc);
    knight(c, x0 + (x1 - x0) * rr(rnd, .12, .5), H - rr(rnd, 26, 54), rr(rnd, 1.5, 2.3), pick(rnd, cols));
  }

  /* 中央奶白排版区：锯齿黑线收边 */
  function zig(c, x, y0, y1) {
    c.beginPath();
    var y = y0, up = true, first = true;
    while (y < y1) {
      var px = x + (up ? 9 : -9);
      if (first) { c.moveTo(px, y); first = false; } else { c.lineTo(px, y); }
      y += 24; up = !up;
    }
    c.stroke();
  }
  function drawChannel(c) {
    c.fillStyle = CREAM;
    c.fillRect(CX0 - 14, 0, (CX1 - CX0) + 28, H);
    c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
    zig(c, CX0, 26, H - 26);
    zig(c, CX1, 26, H - 26);
  }

  /* 主入口 */
  function drawFacet(canvas, seed, pal) {
    if (!canvas) return;
    var dpr = global.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || canvas.parentNode.clientWidth || W;
    var cssH = canvas.clientHeight || Math.round(cssW * H / W);
    var pw = Math.max(1, Math.round(cssW * dpr));
    var ph = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }

    var ctx = canvas.getContext('2d');
    var s = canvas.width / W;                     // 逻辑坐标 768x432，等比缩放
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var blues = (pal && pal.blues) || DEF_BLUES;
    var reds = (pal && pal.reds) || DEF_REDS;
    var acc = (pal && pal.accents) || DEF_ACC;
    var base = (pal && pal.base) || CREAM;

    var rnd = rngFrom(seed);

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    drawSide(ctx, 0, CX0 - 16, rnd, blues, acc);      // 左：湖蓝
    drawSide(ctx, CX1 + 16, W, rnd, reds, acc);       // 右：朱红
    drawChannel(ctx);                                  // 中央：奶白排版区

    return { blues: blues, reds: reds, accents: acc, base: base };
  }

  global.drawFacet = drawFacet;
  global.FACET = { W: W, H: H, CHANNEL: [CX0, CX1], BLUES: DEF_BLUES, REDS: DEF_REDS, ACCENTS: DEF_ACC, rngFrom: rngFrom };
})(window);
