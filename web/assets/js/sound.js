/* 2048 · 音效层
 * 全部用 Web Audio 现场合成，不加载任何音频文件：
 * 离线可用、三端一致、不增加包体。
 * 作者：某好心市民
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;
  var unlocked = false;

  /* 读取用户上次的开关状态 */
  try {
    var saved = root.localStorage.getItem('g2048.sound');
    if (saved === 'off') enabled = false;
  } catch (e) { /* 本地存储不可用就用默认开 */ }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return ctx;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  /* 浏览器要求音频必须由用户手势启动，第一次交互时解锁 */
  function unlock() {
    if (unlocked) return;
    var c = ensure();
    if (!c) return;
    unlocked = true;
    if (c.state === 'suspended' && c.resume) c.resume();
  }

  function ok() {
    if (!enabled) return null;
    var c = ensure();
    if (!c) return null;
    if (c.state === 'suspended' && c.resume) c.resume();
    return c;
  }

  /* 一个会衰减的音符 */
  function tone(c, opt) {
    var t0 = c.currentTime + (opt.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.from, t0);
    if (opt.to && opt.to !== opt.from) {
      osc.frequency.exponentialRampToValueAtTime(opt.to, t0 + opt.dur);
    }

    var peak = (opt.vol === undefined ? 0.3 : opt.vol);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, opt.dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);

    var tail = gain;
    if (opt.lowpass) {
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = opt.lowpass;
      gain.connect(filter);
      tail = filter;
    }

    osc.connect(gain);
    tail.connect(master);
    osc.start(t0);
    osc.stop(t0 + opt.dur + 0.02);
  }

  /* ---------- 具体音效 ---------- */

  /* 移动：一声很轻的「嗖」，靠快速下滑加低通做出来 */
  function move() {
    var c = ok();
    if (!c) return;
    tone(c, { type: 'triangle', from: 260, to: 130, dur: 0.075, vol: 0.05, lowpass: 1400 });
  }

  /* 合并：音高随数值变大而升高，听得出「越合越大」 */
  function merge(value) {
    var c = ok();
    if (!c) return;
    var base = 360 + Math.log2(value) * 62;
    tone(c, { type: 'sine', from: base, to: base * 1.06, dur: 0.13, vol: 0.16 });
    tone(c, { type: 'triangle', from: base * 2, to: base * 2.1, dur: 0.09, vol: 0.07, delay: 0.01 });
  }

  /* 胜利：三个音上行，最后加一下亮的高音 */
  function win() {
    var c = ok();
    if (!c) return;
    tone(c, { type: 'sine', from: 523.25, to: 523.25, dur: 0.20, vol: 0.22, delay: 0.00 });
    tone(c, { type: 'sine', from: 659.25, to: 659.25, dur: 0.20, vol: 0.22, delay: 0.11 });
    tone(c, { type: 'sine', from: 783.99, to: 783.99, dur: 0.26, vol: 0.24, delay: 0.22 });
    tone(c, { type: 'triangle', from: 1046.5, to: 1100, dur: 0.30, vol: 0.14, delay: 0.34 });
  }

  /* 失败：三个音下行，低通压暗，收得干脆 */
  function lose() {
    var c = ok();
    if (!c) return;
    tone(c, { type: 'triangle', from: 392, to: 392, dur: 0.22, vol: 0.18, delay: 0.00, lowpass: 1600 });
    tone(c, { type: 'triangle', from: 311, to: 311, dur: 0.22, vol: 0.18, delay: 0.13, lowpass: 1400 });
    tone(c, { type: 'triangle', from: 233, to: 200, dur: 0.34, vol: 0.20, delay: 0.26, lowpass: 1100 });
  }

  /* ---------- 开关 ---------- */

  function isOn() {
    return enabled;
  }

  function toggle() {
    enabled = !enabled;
    if (enabled) unlock();
    try {
      root.localStorage.setItem('g2048.sound', enabled ? 'on' : 'off');
    } catch (e) { /* 忽略 */ }
    return enabled;
  }

  root.Sound2048 = {
    unlock: unlock,
    move: move,
    merge: merge,
    win: win,
    lose: lose,
    isOn: isOn,
    toggle: toggle
  };

}(window));
