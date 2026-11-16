/* 2048 逻辑层单元测试
 * 运行方式：node web/test/game.test.js
 * 不依赖任何测试框架，纯 assert。
 */
'use strict';

const assert = require('assert');

// game.js 是挂到 window 上的，这里给它一个假的 window
global.window = global;
require('../assets/js/game.js');

const Game2048 = global.Game2048;
const Game = Game2048.Game;

let idc = 0;

/** 按 [2,2,null,null] 这种结构铺一个棋盘，方便构造测试局面 */
function setGrid(game, spec) {
  let r, c;
  game.grid = [];
  for (r = 0; r < 4; r++) {
    const row = [];
    for (c = 0; c < 4; c++) {
      const v = spec[r][c];
      row.push(v ? { id: 'x' + (++idc), v: v } : null);
    }
    game.grid.push(row);
  }
  game.score = 0;
  game.won = false;
  game.over = false;
  game.keepPlaying = false;
  game.undoData = null;
}

/** 把整个棋盘读成数字矩阵，空格记 0 */
function readGrid(game) {
  return game.grid.map(function (row) {
    return row.map(function (t) { return t ? t.v : 0; });
  });
}

/** 棋盘上所有方块的值，按降序 */
function allValues(game) {
  const out = [];
  game.grid.forEach(function (row) {
    row.forEach(function (t) { if (t) out.push(t.v); });
  });
  return out.sort(function (a, b) { return b - a; });
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, ok: true });
  } catch (err) {
    results.push({ name: name, ok: false, msg: err.message });
  }
}

/* ============ 用例 ============ */

test('开局放置两个方块', function () {
  const g = new Game();
  assert.strictEqual(allValues(g).length, 2, '开局应只有两个方块');
  allValues(g).forEach(function (v) {
    assert.ok(v === 2 || v === 4, '开局的方块只能是 2 或 4，实际 ' + v);
  });
  assert.strictEqual(g.score, 0, '开局分数应为 0');
});

test('左移合并一对 2 → 4，得 4 分', function () {
  const g = new Game();
  setGrid(g, [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = g.move('left');
  assert.strictEqual(res.moved, true, '应当发生移动');
  assert.strictEqual(g.score, 4, '合并出 4 应得 4 分');
  assert.ok(allValues(g).indexOf(4) >= 0, '棋盘上应出现 4');
  assert.strictEqual(g.grid[0][0].v, 4, '合并结果应贴在最左');
});

test('一行四个 2 → 两个 4，得 8 分', function () {
  const g = new Game();
  setGrid(g, [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  g.move('left');
  assert.strictEqual(g.score, 8, '两组各得 4 分，共 8 分');
  assert.strictEqual(g.grid[0][0].v, 4);
  assert.strictEqual(g.grid[0][1].v, 4);
});

test('隔一个空格的 2 也能合并', function () {
  const g = new Game();
  setGrid(g, [[2, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  g.move('left');
  assert.strictEqual(g.score, 4);
  assert.strictEqual(g.grid[0][0].v, 4);
});

test('一步之内不连锁：4 2 2 左移得到 4 4', function () {
  const g = new Game();
  setGrid(g, [[4, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  g.move('left');
  assert.strictEqual(g.score, 4, '只应有一组合并');
  assert.strictEqual(g.grid[0][0].v, 4);
  assert.strictEqual(g.grid[0][1].v, 4);
  assert.strictEqual(g.grid[0][2], null, '第三格应为空');
});

test('右移方向正确', function () {
  const g = new Game();
  setGrid(g, [[0, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  g.move('right');
  assert.strictEqual(g.grid[0][3].v, 2, '右移后方块应贴到最右');
});

test('下移方向正确', function () {
  const g = new Game();
  setGrid(g, [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  g.move('down');
  assert.strictEqual(g.grid[3][0].v, 2, '下移后方块应贴到最下');
});

test('满盘且无相邻同值时不算可移动', function () {
  const g = new Game();
  setGrid(g, [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ]);
  const res = g.move('left');
  assert.strictEqual(res.moved, false, '这种盘面往左推不动');
  assert.strictEqual(g.score, 0);
});

test('死局判定：满盘无相邻同值应判 over', function () {
  const g = new Game();
  setGrid(g, [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ]);
  assert.strictEqual(g.hasMoves(), false, '应判定无路可走');
});

test('有空格时不算死局', function () {
  const g = new Game();
  setGrid(g, [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 0]
  ]);
  assert.strictEqual(g.hasMoves(), true);
});

test('撤销能把棋盘和分数一起恢复', function () {
  const g = new Game();
  setGrid(g, [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const before = readGrid(g);
  g.move('left');
  assert.strictEqual(g.score, 4);
  assert.ok(g.canUndo(), '走完一步应可撤销');

  const ok = g.undo();
  assert.strictEqual(ok, true);
  assert.strictEqual(g.score, 0, '分数应回到 0');
  assert.deepStrictEqual(readGrid(g), before, '棋盘应完全回到走之前');
  assert.strictEqual(g.canUndo(), false, '只能撤一步');
});

test('无效移动不产生撤销点', function () {
  const g = new Game();
  setGrid(g, [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ]);
  g.move('left');
  assert.strictEqual(g.canUndo(), false, '推不动的一步不该留撤销点');
});

test('合并后总数守恒：一行 2 2 2 2 合并后仍是 4 个方块（1 个被吃）', function () {
  const g = new Game();
  setGrid(g, [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = g.move('left');
  assert.strictEqual(res.pairs.length, 2, '应有两对被合并');
  // 4 个原始方块 + 1 个新生成 - 2 个被吃 = 3
  assert.strictEqual(allValues(g).length, 3);
});

test('合成 2048 时给出胜利标记', function () {
  const g = new Game();
  setGrid(g, [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const res = g.move('left');
  assert.strictEqual(res.won, true, '首次合成 2048 应报胜');
  assert.strictEqual(g.won, true);
  assert.strictEqual(g.maxTile(), 2048);
});

/* ============ 输出 ============ */

let passed = 0;
let failed = 0;

results.forEach(function (r) {
  if (r.ok) {
    passed += 1;
    console.log('  PASS  ' + r.name);
  } else {
    failed += 1;
    console.log('  FAIL  ' + r.name + '  ->  ' + r.msg);
  }
});

console.log('\n通过 ' + passed + ' 项，失败 ' + failed + ' 项');

if (failed > 0) process.exitCode = 1;
