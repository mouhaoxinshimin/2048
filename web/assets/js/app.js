/* 2048 · 界面层
 * 负责渲染、动画、键盘与触摸交互、遮罩与提示。
 * 逻辑全部来自 game.js，这里不重复写规则。
 * 作者：某好心市民
 */
(function () {
  'use strict';

  var G = window.Game2048;
  var SIZE = G.SIZE;

  /* 棋盘几何，必须与 style.css 里的 --pad / --gap / --cell 保持一致 */
  var PAD = 3.2;
  var GAP = 2.2;
  var CELL = 21.75;
  var SLIDE_MS = 130;

  /* 方块配色：2 到 8192 逐级升温，4096 起换色 */
  var COLORS = {
    2:    { bg: '#FFF1E0', fg: '#4A3B32' },
    4:    { bg: '#FFE3C4', fg: '#4A3B32' },
    8:    { bg: '#FFD1A1', fg: '#4A3B32' },
    16:   { bg: '#FFBE80', fg: '#4A3B32' },
    32:   { bg: '#FFA76B', fg: '#FFF8F0' },
    64:   { bg: '#FF8B5C', fg: '#FFF8F0' },
    128:  { bg: '#FF9EC4', fg: '#FFF8F0' },
    256:  { bg: '#FF7AA8', fg: '#FFF8F0' },
    512:  { bg: '#8FC9FF', fg: '#FFF8F0' },
    1024: { bg: '#5FA8F0', fg: '#FFF8F0' },
    2048: { bg: '#FFC93C', fg: '#4A3B32' },
    4096: { bg: '#C4A8FF', fg: '#FFF8F0' },
    8192: { bg: '#7ED9A0', fg: '#4A3B32' }
  };
  var FALLBACK = { bg: '#E8D9C8', fg: '#4A3B32' };

  /* ---------- DOM ---------- */

  var board = document.getElementById('board');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var btnNew = document.getElementById('btnNew');
  var btnUndo = document.getElementById('btnUndo');
  var mask = document.getElementById('mask');
  var maskBig = document.getElementById('maskBig');
  var maskSub = document.getElementById('maskSub');
  var btnMaskMain = document.getElementById('btnMaskMain');
  var btnMaskSub = document.getElementById('btnMaskSub');
  var modal = document.getElementById('modal');
  var btnCancel = document.getElementById('btnCancel');
  var btnConfirm = document.getElementById('btnConfirm');
  var toastEl = document.getElementById('toast');

  /* ---------- 状态 ---------- */

  var game = new G.Game();
  var tileEls = {};       // id -> element
  var busy = false;       // 动画进行中，屏蔽输入
  var best = 0;

  try {
    best = parseInt(window.localStorage.getItem('g2048.best') || '0', 10) || 0;
  } catch (e) {
    best = 0;
  }

  /* ---------- 基础绘制 ---------- */

  /* 底板 16 个空格 */
  function buildSlots() {
    var r, c, el;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        el = document.createElement('div');
        el.className = 'slot';
        el.style.left = (PAD + c * (CELL + GAP)) + '%';
        el.style.top = (PAD + r * (CELL + GAP)) + '%';
        board.appendChild(el);
      }
    }
  }

  function place(el, r, c) {
    el.style.left = (PAD + c * (CELL + GAP)) + '%';
    el.style.top = (PAD + r * (CELL + GAP)) + '%';
  }

  function createTile(id) {
    var el = document.createElement('div');
    el.className = 'tile';
    el.setAttribute('data-id', id);
    // 刚建出来的方块不要从左上角滑进来
    el.style.transition = 'none';
    board.appendChild(el);
    tileEls[id] = el;
    requestAnimationFrame(function () {
      el.style.transition = '';
    });
    return el;
  }

  function paint(el, v) {
    var st = COLORS[v] || FALLBACK;
    el.textContent = String(v);
    el.style.background = st.bg;
    el.style.color = st.fg;
    el.className = 'tile len' + String(v).length + (v >= 2048 ? ' royal' : '');
  }

  function paintKeepAnim(el, v) {
    var hadAppear = el.classList.contains('appear');
    paint(el, v);
    if (hadAppear) el.classList.add('appear');
  }

  function pop(el) {
    el.classList.remove('pop');
    // 强制回流，让动画能重新触发
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function scanPositions() {
    var map = {}, r, c, t;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        t = game.grid[r][c];
        if (t) map[t.id] = [r, c];
      }
    }
    return map;
  }

  /* 全部重建：新开局、撤销之后用 */
  function renderAll() {
    Object.keys(tileEls).forEach(function (id) {
      var el = tileEls[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    tileEls = {};

    var r, c, t, el;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        t = game.grid[r][c];
        if (!t) continue;
        el = createTile(t.id);
        place(el, r, c);
        paint(el, t.v);
      }
    }

    updateHUD(0);
    updateButtons();
    hideMask();
  }

  /* ---------- 状态栏 ---------- */

  function updateHUD(gained) {
    scoreEl.textContent = String(game.score);
    if (game.score > best) {
      best = game.score;
      try {
        window.localStorage.setItem('g2048.best', String(best));
      } catch (e) { /* 本地存储不可用时忽略 */ }
    }
    bestEl.textContent = String(best);
    if (gained > 0) popGain(gained);
  }

  function popGain(n) {
    var box = scoreEl.parentNode;
    var rect = box.getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'gain';
    el.textContent = '+' + n;
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top - 4) + 'px';
    document.body.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }

  function updateButtons() {
    btnUndo.disabled = busy || !game.canUndo();
  }

  /* ---------- 走一步 ---------- */

  function doMove(dir) {
    if (busy) return;
    if (!mask.hidden) return;

    var res = game.move(dir);
    if (!res.moved) return;

    busy = true;
    btnUndo.disabled = true;

    var posMap = scanPositions();
    var i, id, el, target;

    // 被吃掉的方块先滑到合并位置
    for (i = 0; i < res.pairs.length; i++) {
      target = posMap[res.pairs[i].into.id];
      el = tileEls[res.pairs[i].dead.id];
      if (el && target) place(el, target[0], target[1]);
    }

    // 活着的方块移动到位，新生成的先跳过
    var ids = Object.keys(posMap);
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      if (res.spawned && id === res.spawned.id) continue;
      el = tileEls[id] || createTile(id);
      place(el, posMap[id][0], posMap[id][1]);
    }

    updateHUD(res.gained);

    window.setTimeout(function () {
      // 清掉被吃掉的，更新合并后的
      for (var k = 0; k < res.pairs.length; k++) {
        var deadId = res.pairs[k].dead.id;
        var deadEl = tileEls[deadId];
        if (deadEl && deadEl.parentNode) deadEl.parentNode.removeChild(deadEl);
        delete tileEls[deadId];

        var intoEl = tileEls[res.pairs[k].into.id];
        if (intoEl) {
          paintKeepAnim(intoEl, res.pairs[k].into.v);
          pop(intoEl);
        }
      }

      // 新方块冒出来
      if (res.spawned) {
        var p = scanPositions()[res.spawned.id];
        if (p) {
          var newEl = createTile(res.spawned.id);
          place(newEl, p[0], p[1]);
          paint(newEl, res.spawned.v);
          newEl.classList.add('appear');
        }
      }

      busy = false;
      updateButtons();

      if (res.won) {
        showMask('win');
      } else if (game.over) {
        showMask('lose');
      }
    }, SLIDE_MS);
  }

  /* ---------- 遮罩 ---------- */

  function showMask(kind) {
    mask.hidden = false;
    mask.classList.remove('win', 'lose');

    if (kind === 'win') {
      mask.classList.add('win');
      maskBig.textContent = '到 2048 了';
      maskSub.textContent = '还早，要不要接着往上堆？';
      btnMaskMain.textContent = '接着玩';
      btnMaskMain.onclick = function () {
        game.keepPlaying = true;
        hideMask();
      };
      btnMaskSub.textContent = '重开一局';
      btnMaskSub.onclick = function () {
        hideMask();
        startNew();
      };
    } else {
      mask.classList.add('lose');
      maskBig.textContent = '没格子了';
      maskSub.textContent = '再来一局，或者撤回上一步救回来';
      btnMaskMain.textContent = '再来一局';
      btnMaskMain.onclick = function () {
        hideMask();
        startNew();
      };
      btnMaskSub.textContent = '撤回一步';
      btnMaskSub.style.display = game.canUndo() ? '' : 'none';
      btnMaskSub.onclick = function () {
        doUndo();
      };
    }
  }

  function hideMask() {
    mask.hidden = true;
    btnMaskMain.onclick = null;
    btnMaskSub.onclick = null;
    btnMaskSub.style.display = '';
  }

  /* ---------- 开局 / 撤销 ---------- */

  function startNew() {
    game.start();
    renderAll();
  }

  function doUndo() {
    if (!game.undo()) {
      toast('没有可以撤回的步了');
      return;
    }
    renderAll();
    toast('已撤回上一步');
  }

  /* ---------- 轻提示 ---------- */

  var toastTimer = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('on');
    }, 1600);
  }

  /* ---------- 输入：键盘 ---------- */

  var KEY_MAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down'
  };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    doMove(dir);
  });

  /* ---------- 输入：触摸与鼠标拖动 ---------- */

  var startX = 0, startY = 0;
  var touching = false;
  var THRESHOLD = 24;

  function beginSwipe(x, y) {
    startX = x;
    startY = y;
    touching = true;
  }

  function endSwipe(x, y) {
    if (!touching) return;
    touching = false;

    var dx = x - startX;
    var dy = y - startY;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      doMove(dx > 0 ? 'right' : 'left');
    } else {
      doMove(dy > 0 ? 'down' : 'up');
    }
  }

  board.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    beginSwipe(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  board.addEventListener('touchend', function (e) {
    if (e.changedTouches.length !== 1) return;
    endSwipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: true });

  board.addEventListener('touchmove', function (e) {
    // 滑动时不要让页面跟着滚
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  /* 桌面端鼠标拖动也能走 */
  board.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    beginSwipe(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', function (e) {
    endSwipe(e.clientX, e.clientY);
  });

  /* ---------- 按钮 ---------- */

  btnNew.addEventListener('click', function () {
    // 还没动过局，直接重开；动过了就确认一下
    if (game.canUndo() || game.score > 0) {
      modal.hidden = false;
      btnConfirm.focus();
    } else {
      startNew();
    }
  });

  btnCancel.addEventListener('click', function () {
    modal.hidden = true;
  });

  btnConfirm.addEventListener('click', function () {
    modal.hidden = true;
    startNew();
  });

  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.hidden = true;
  });

  btnUndo.addEventListener('click', doUndo);

  /* 窗口尺寸变化时不用重算，位置全是百分比 */

  /* ---------- 启动 ---------- */

  buildSlots();
  renderAll();

}());
