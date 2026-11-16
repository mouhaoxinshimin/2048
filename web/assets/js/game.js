/* 2048 · 逻辑层
 * 只负责棋盘、移动、合并、计分，完全不碰 DOM。
 * 暴露 window.Game2048
 *
 * 棋盘里每一格存的是方块对象 { id, v }，移动时对象本身跟着走，
 * 这样界面层可以靠 id 跟踪同一个方块，做出连续的滑动动画。
 */
(function (global) {
  'use strict';

  var SIZE = 4;

  /* ---------- 基础工具 ---------- */

  function newGrid() {
    var g = [], r;
    for (r = 0; r < SIZE; r++) g.push([null, null, null, null]);
    return g;
  }

  var seq = 0;
  function makeTile(v) {
    seq += 1;
    return { id: 't' + seq, v: v };
  }

  function emptyCells(grid) {
    var list = [], r, c;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        if (!grid[r][c]) list.push([r, c]);
      }
    }
    return list;
  }

  function addRandom(grid) {
    var cells = emptyCells(grid);
    if (!cells.length) return null;
    var pick = cells[Math.floor(Math.random() * cells.length)];
    var tile = makeTile(Math.random() < 0.9 ? 2 : 4);
    grid[pick[0]][pick[1]] = tile;
    return tile;
  }

  function cloneGrid(grid) {
    return grid.map(function (row) {
      return row.map(function (t) { return t ? { id: t.id, v: t.v } : null; });
    });
  }

  function clearMergeFlags(grid) {
    var r, c, t;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        t = grid[r][c];
        if (t) t.justMerged = false;
      }
    }
  }

  /* ---------- 每条线的坐标 ----------
   * 返回该线上 4 个格子，按「移动方向的前端 -> 后端」排序
   */
  function lineOf(dir, index) {
    var coords = [], i;
    if (dir === 'left' || dir === 'right') {
      for (i = 0; i < SIZE; i++) coords.push([index, i]);
      if (dir === 'right') coords.reverse();
    } else {
      for (i = 0; i < SIZE; i++) coords.push([i, index]);
      if (dir === 'down') coords.reverse();
    }
    return coords;
  }

  /* ---------- 压缩一条线 ----------
   * tiles: 该线现有的方块，已按方向排序
   * 返回 line: 压缩后的 4 格；pairs: 被吃掉的方块 -> 吃它的方块
   */
  function compressLine(tiles) {
    var out = [], pairs = [], i, last;
    for (i = 0; i < tiles.length; i++) {
      last = out[out.length - 1];
      if (last && last.v === tiles[i].v && !last.justMerged) {
        last.v *= 2;
        last.justMerged = true;
        pairs.push({ dead: tiles[i], into: last });
      } else {
        out.push(tiles[i]);
      }
    }
    while (out.length < SIZE) out.push(null);
    return { line: out, pairs: pairs };
  }

  /* ---------- 游戏对象 ---------- */

  function Game() {
    this.grid = newGrid();
    this.score = 0;
    this.won = false;
    this.over = false;
    this.keepPlaying = false;
    this.undoData = null;
    this.start();
  }

  Game.prototype.start = function () {
    this.grid = newGrid();
    this.score = 0;
    this.won = false;
    this.over = false;
    this.keepPlaying = false;
    this.undoData = null;
    addRandom(this.grid);
    addRandom(this.grid);
  };

  Game.prototype.maxTile = function () {
    var max = 0, r, c, t;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        t = this.grid[r][c];
        if (t && t.v > max) max = t.v;
      }
    }
    return max;
  };

  Game.prototype.canUndo = function () {
    return !!this.undoData;
  };

  /* 走一步。返回：
   * { moved, gained, pairs:[{dead,into}], spawned, won }
   * moved === false 表示这个方向推不动，状态没有任何变化
   */
  Game.prototype.move = function (dir) {
    if (this.over) return { moved: false, pairs: [], gained: 0, spawned: null, won: false };

    var snapshot = {
      grid: cloneGrid(this.grid),
      score: this.score,
      won: this.won,
      over: this.over
    };

    var gained = 0;
    var deadPairs = [];
    var moved = false;
    var i, r, pm;

    clearMergeFlags(this.grid);

    for (i = 0; i < SIZE; i++) {
      var coords = lineOf(dir, i);
      var line = [];

      for (r = 0; r < coords.length; r++) {
        var t = this.grid[coords[r][0]][coords[r][1]];
        if (t) line.push(t);
      }

      var res = compressLine(line);
      for (r = 0; r < res.pairs.length; r++) deadPairs.push(res.pairs[r]);

      var changed = false;
      for (r = 0; r < coords.length; r++) {
        pm = coords[r];
        if (this.grid[pm[0]][pm[1]] !== res.line[r]) changed = true;
        this.grid[pm[0]][pm[1]] = res.line[r];
      }
      if (changed) moved = true;
    }

    if (!moved) {
      clearMergeFlags(this.grid);
      return { moved: false, pairs: [], gained: 0, spawned: null, won: false };
    }

    for (i = 0; i < deadPairs.length; i++) gained += deadPairs[i].dead.v * 2;
    this.score += gained;

    this.undoData = snapshot;

    var spawned = addRandom(this.grid);

    var wonNow = false;
    if (!this.won && this.maxTile() >= 2048) {
      this.won = true;
      wonNow = true;
    }

    this.over = !this.hasMoves();

    return {
      moved: true,
      gained: gained,
      pairs: deadPairs,
      spawned: spawned,
      won: wonNow
    };
  };

  Game.prototype.hasMoves = function () {
    var r, c, t, right, down;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        t = this.grid[r][c];
        if (!t) return true;
        right = c + 1 < SIZE ? this.grid[r][c + 1] : null;
        down = r + 1 < SIZE ? this.grid[r + 1][c] : null;
        if (right && right.v === t.v) return true;
        if (down && down.v === t.v) return true;
      }
    }
    return false;
  };

  Game.prototype.undo = function () {
    if (!this.undoData) return false;
    this.grid = cloneGrid(this.undoData.grid);
    this.score = this.undoData.score;
    this.won = this.undoData.won;
    this.over = this.undoData.over;
    this.undoData = null;
    return true;
  };

  /* ---------- 对外 ---------- */

  global.Game2048 = {
    SIZE: SIZE,
    Game: Game,
    newGrid: newGrid
  };

}(window));
