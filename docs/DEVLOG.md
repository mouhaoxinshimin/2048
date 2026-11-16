# 2048 · 开发日志

> 记录每一步做了什么、踩了什么坑、为什么这么定。
>
> 作者：某好心市民

---

## 2026-11-16 · v0.1 项目启动

按「猜拳对决」验证过的路子立项：**先写一份 HTML 原型做唯一视觉基准，再套 Windows / 安卓两套外壳**。

建目录 `F:\Trae\doubao\2048`，分 `web/`（游戏本体）、`win/`（Windows 外壳）、`android/`（安卓外壳）、`docs/`（文档）。写 `.gitignore` 忽略编译中间产物、`build/`、`local.properties`。首次提交 `bf1c0ea`。

三个方向当场定死：
- 视觉：Q 版可爱卡通，配色和描边直接对齐猜拳那套
- 功能：标准版（基础玩法 + 撤销一步 + 新游戏二次确认 + 合并动效）
- 安卓：只做 WebView 套壳，不写原生

---

## 2026-11-16 · v0.2 写完 web 原型

### 逻辑层 `game.js`

核心决定：**棋盘格子里存的不是数字，是对象 `{id, v}`**。

一开始按常规只存数字，写完发现动画做不出来——界面上没有任何东西能证明「这一块刚才就是那一块」，每次走完只能整体重绘，没有滑动过程。改成对象之后，方块跟着数据一起搬位置，界面层靠 `id` 认出同一块，动画才成立。

第二个坑：`move()` 最初只返回被吃掉的方块列表 `dead[]`，界面层知道「谁没了」，但不知道「它该滑到哪去消失」，动画还是接不上。补成 `pairs: [{dead, into}]`，让被吃的块先滑到吃它的那一格再消失。

规则上守住了经典 2048 的一条：**一步之内不连锁合并**。`4 2 2` 左移得到 `4 4` 而不是 `8`，靠 `justMerged` 标记实现。

- 撤销只留一步，快照存 `grid / score / won / over`
- 首次合成 2048 报胜，可以「接着玩」继续
- 无空格且无相邻同值判死局
- 最高分存 `localStorage` 的 `g2048.best`

### 界面层 `app.js`

坐标全用百分比（`PAD=3.2 / GAP=2.2 / CELL=21.75`），跟 CSS 里的 `--pad / --gap / --cell` 一一对应。这是整套代码里**唯一需要人工同步的地方**，改棋盘边距必须两边一起改。

动画切两段：
1. 所有方块（包括马上要消失的）改 `left/top`，走 130ms
2. 时间片到了，删掉被吃的、更新合并值并弹一下、再新建方块淡入

新方块必须先 `transition: none` 落位，下一帧再恢复过渡，否则会从棋盘左上角一路滑进来。

加分飘字一开始写成 `position: absolute` + `translateX(-50%)`，结果 CSS animation 的 `transform` 把居中位移盖掉了，数字跑到右边去。改法是把 `translate(-50%, ...)` 直接写进关键帧。

### 验证

本机没有 Chrome / Edge，`App Paths` 三项都未注册，`Program Files` 下也没有，`ms-playwright` 里同样没有预装 Chromium。所以先只验逻辑：用 Node 跑 `web/test/game.test.js`，14 项全通过（开局方块、各种合并、方向、不连锁、死局、撤销、2048 判胜）。

**UI 渲染这一刻还没真正看到过**，推迟到外壳阶段解决。

---

## 2026-11-16 · v0.3 Windows 外壳

发现系统里装了 WebView2 运行时 `140.0.3485.81`，于是照猜拳的 `win/` 做法写了一套 C++ + WebView2 宿主。

和猜拳的区别：猜拳把 HTML 打进 exe 的 RCDATA 资源，运行时解出来写到 `%LOCALAPPDATA%`。2048 是三四个文件（html + css + 两个 js），打包进资源很别扭，所以改成 **`SetVirtualHostNameToFolderMapping` 把 `web/` 目录直接挂成 `https://game2048.local`**。

这么干好处有三条：
- `localStorage` 有正常来源，最高分能落盘（`file://` 下不同内核行为不一致）
- 改页面不用重编译 exe，重开程序就生效
- 分发时只要 `exe + web` 放一起

`FindWebDir()` 先找 exe 同级的 `web`，找不到再往上一级找，这样开发期（exe 在 `win\`）和发布期（exe 和 `web` 平级）都能跑。

编译一次通过，产出 `Game2048.exe` 163 KB。**跑起来截屏确认渲染正常**：标题、双分数盒、粉色新游戏按钮、黄色撤销按钮（禁用态）、4×4 棋盘、两个起始方块、底部提示、天空渐变背景，全部到位。这是这套 UI 第一次真正被看到。

---

## 2026-11-16 · v0.4 安卓外壳

探测工具链：`JAVA_HOME=G:\dev\jdk-17`（17.0.21）、`ANDROID_HOME=G:\dev\android-sdk`（platforms `android-35`、build-tools `34/35`）、Gradle `8.9`、缓存目录 `G:\dev\gradle-home` 里已经有 AGP `8.7.2`。模拟器是 `G:\dev\LDPlayer9`。

工程结构：单模块 `app`，`minSdk 21 / targetSdk 35`，`MainActivity` 只做一件事——开一个全屏 WebView 加载 `file:///android_asset/web/index.html`。

**关键设计：`syncWeb` 任务**。`app/build.gradle` 里注册了一个 `Copy` 任务，`preBuild` 依赖它，每次构建前把项目的 `web/` 整个拷进 `src/main/assets/web`（排除 `.gitkeep` 和 `test/`）。这样三端永远共用同一份页面代码，不存在「安卓那份忘了同步」的问题。

第一次 `assembleDebug` 49 秒通过，APK 只有 24.7 KB（纯套壳，没有多余依赖）。

### 老内核兼容

安卓系统 WebView 版本可能很旧，`aspect-ratio` 要 Chromium 88+ 才支持，`inset` 要 87+。两条都补了：
- `inset: 0` 一律展开成 `top/right/bottom/left: 0`
- 棋盘加了 `@supports not (aspect-ratio: 1/1)` 的 `padding-bottom` 兜底，老内核下也能撑成正方形

### 模拟器实测

`ldconsole launch --index 0` 起雷电，等 adb 上线后装包、启动、截图。**渲染正常**：渐变背景、两朵云、Q 版棋盘、两个起始方块都对。

功能验证：
- 单次滑动 → 两个 2 合并成 4（得分 4），新方块生成 → 状态正确
- 键盘 `keyevent 21`（左）→ 方块左移合并，分数正确
- 最高分 52 在重启后仍然显示，说明 `localStorage` 在 `file:///android_asset/` 下工作正常

**踩到一个坑**：第一次连续发 3 次 `input swipe`（其中一次位移 400px），结果棋盘上冒出 12 个方块、得分 52，远超 3 步该有的量。换成「重启 + 单次滑动」复测就完全正常，说明代码没问题，是雷电的 `input swipe` 把长距离滑动拆成了多段触摸序列。**结论：自动化测试时单次发一个手势，别连发。**

**顺手修的小问题**：键盘操作后焦点会落到按钮上，浏览器默认的橙色 `outline` 很难看。`.btn` 统一加 `outline: none`。

### 顺带放大棋盘

`.app` 的 `max-width` 从 `460px` 放到 `520px`，`.board` 的 `max-width` 从 `420px` 放到 `480px`。PC 端窗口只有 430 宽，这两个值不生效，画面不变；手机和平板竖屏时棋盘能大一圈。

顺手把 Windows 窗口高度从 `790` 收到 `730`。原本 790 高时棋盘下面空出一大截，现在内容刚好铺满。

### 打包分发

`dist/` 下放两份可直接用的产物（不入库）：
- `Game2048-win-x64.zip`：exe + `web/` 目录，解压双击即玩
- `Game2048-android-debug.apk`：调试签名，可直接安装

---

## 遗留

- 两端都还没有应用图标
- release APK 没做签名
- 没有 LICENSE

---

## v0.6 · 字号修复、三端尺寸统一、应用图标（2026-11-16）

### 一、格子数字太小：根因不是系数，是单位用错

原写法：

```css
.tile { font-size: calc(var(--cell) * 1.02); }   /* --cell: 21.75% */
```

`--cell` 是百分比。**同一个百分比在 `width` 和 `font-size` 两个上下文里含义不同**：

- 用在 `width/height` 上，按**包含块宽度**解析 → 得到 480×21.75% ≈ 103px，正确；
- 用在 `font-size` 上，按**父元素字号**解析 → 得到 16px×21.75% ≈ 3.5px，而且父元素字号一变就跟着漂。

`.board` 没有设置 `font-size`，继承 `body` 的 16px。所以数字被压到 3~4px 量级，这就是「字太小」和「三端不一致」的共同来源——不是比例算错了，是**百分比不能参与字号计算**。

修法不给字号留任何百分比，单独推真实像素值：

```css
:root {
  --cell-px: 103px;                                            /* 老内核兜底 */
  --cell-px: min(calc((100vw - 39px) * 0.2175), 103px);         /* 真实值 */
}
```

- `39px` = `.app` 左右 padding 32px + `.board` 边框 7px
- `0.2175` 与 `--cell: 21.75%` 严格对应
- `103px` = 480 棋盘内容盒 473px × 21.75% 取整

用 `100vw` 而不是 JS 注入，避免多一套运行时依赖和 resize 监听漏挂。游戏本身 `overflow: hidden` 无滚动条，`100vw` 无误差。`min()` 需 Chromium 79+，故先写 `103px` 兜底，老内核忽略第二条声明自动退回。

字号档位全部改为真实像素倍数，并补上六位数档：

| 位数 | 倍数 | 480 棋盘下的实际字号 |
|---|---:|---:|
| 1（2/4/8） | 0.52 | ≈54px |
| 2（16~64） | 0.46 | ≈47px |
| 3（128~512） | 0.37 | ≈38px |
| 4（1024~8192） | 0.29 | ≈30px |
| 5（16384~） | 0.235 | ≈24px |
| 6（131072~） | 0.19 | ≈20px |

按 `tabular-nums` 下每字符约 `0.6em` 推算，格子可用宽约 97px：4 位约 72px、5 位约 73px、6 位约 71px，均不溢出。

### 二、三端显示大小不一致：棋盘宽度被窗口卡住

棋盘宽度链路是 `min(容器宽, 480px)`，容器宽是 `min(视口宽, 520px) - 32px`。

- 安卓 WebView CSS 宽 600 → 棋盘 480
- 桌面浏览器窗口够宽 → 棋盘 480
- **原 PC 外壳窗口客户区只有 430** → 棋盘约 398，比另两端小一圈

所以不是渲染差异，是**外壳窗口尺寸没跟着设计稿**。改 `win/main.cpp` 窗口尺寸 `430×730 → 520×740`（520 - 32 ≈ 488 → 棋盘正好 480）。

改后三端棋盘一律 480，格子 ≈102.9px，一格数字约 53px。

验证手法（免重编译）：外壳用 `SetVirtualHostNameToFolderMapping` 把 `web/` 挂成 `https://game2048.local`，**CSS 改动重开即生效**。直接把现有 exe 跑起来，用 `SetWindowPos` 撑到 560×800 并临时置顶再 `CopyFromScreen` 截图，即可确认字号已放大。

### 三、应用图标

按 `doubao-creative-design` 的 pure-image 轨道做，配色与线条全部取自 `web/assets/css/style.css` 的 `:root`，不另起一套视觉：

- 墨色描边 `#4A3B32`，粗描边 + 硬边偏移投影（对应原型 `0 7px 0`）
- 主色粉 `#FF9EC4`，奶油底 `#FFF8F0`
- 大圆角方块 + 居中粗圆数字「2048」
- 一色一墨一表面，共 3 个色角色，无渐变

产出（`assets/icon/`）：

| 文件 | 用途 |
|---|---|
| `icon-1024.png` | 图标母版 1024×1024 |
| `app.ico` | Windows 可执行文件图标，含 16/24/32/48/64/128/256 |
| `android/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` | 安卓 48/72/96/144/192 |
| `favicon-32.png` / `favicon-16.png` | 网页标签图标 |

设计 Brief 见 `.creative-design/2048-icon/brief.md`，画布 Workspace `cws_62069030561775106`，母版 Item `VWl0XoC2-4aEmBHJ6Ju-0201`。

**本轮只出图标源文件，尚未把它们嵌进 exe / APK**，等原型确认后再做。

### 四、本轮未做（等确认后再动）

- `win/main.cpp` 的 520×740 改了源码但**没有重新编译**，`Game2048.exe` 仍是旧窗口尺寸
- APK 未重建、未重装，仍是旧字号
- `dist/` 两份产物均已过时
- 图标未嵌入 exe（需 `.rc` 资源 + 重编译）与 APK（需改 mipmap 目录 + adaptive icon 分层）

## v0.7 · 撞击动效、音效、粒子、彩带、署名（2026-11-16）

### 一、音效用合成，不加载音频文件

新增 `web/assets/js/sound.js`，全部靠 Web Audio 现场生成：

| 时机 | 做法 | 听感 |
|---|---|---|
| 移动 | 三角波 260Hz→130Hz，75ms，低通 1400 | 很轻的「嗖」 |
| 合并 | 正弦 + 三角泛音，基频 `360 + log2(值) × 62` | 越合越大，音高跟着升 |
| 胜利 | 523.25 / 659.25 / 783.99 / 1046.5 递进 | 上行琶音 |
| 失败 | 392 / 311 / 233→200，低通逐级压暗 | 下沉、收得干脆 |

为什么不放 mp3：三端共用同一份 `web/`，加音频文件会让 Windows 版和 APK 各自多一份二进制资源，还得处理路径与解码差异；合成音零体积、零依赖、离线必然可用。

两个必须处理的坑：

1. **浏览器要求音频由用户手势启动**。首次 `pointerdown` / `keydown` / `touchstart` 调一次 `unlock()`，之后再响就不会被拒。
2. **没有声卡时 `AudioContext` 构造会抛异常**，`ensure()` 外面包了 `try`，失败就静默降级成无声，不影响玩法。

顶部工具栏加了「声音 / 静音」按钮，状态存 `localStorage` 的 `g2048.sound`。

### 二、撞击动效

原来合并只是 `scale(1.18)` 放大一下。改成**先横向压扁再回弹**：

```css
@keyframes tileBump {
  0%   { transform: scale(1, 1); }
  30%  { transform: scale(1.16, .84); }
  58%  { transform: scale(.92, 1.1); }
  100% { transform: scale(1, 1); }
}
```

横向涨、纵向缩，才像「撞上去变形了」；单纯的等比放大看着像呼吸灯。

同时整块棋盘 `translate` 抖 3px 以内、220ms 收住。幅度压在 3px 是因为格子才 103px，抖多了会显脏。

### 三、粒子与彩带

- 合并：在合并格中心喷 8 颗小圆点，`--dx / --dy` 走 CSS 变量，由 `@keyframes ptFly` 飞散并缩到 0.25 倍
- 胜利：屏幕上方落 30 条彩带，`translateY(104vh)` + `rotate(560deg)`，`--sway` 控制左右摆

**一个必须记的教训**：粒子最初取的是**合并方块自己的背景色**，结果粒子一出生就在同色方块里，肉眼完全看不见，飞出方块外也没剩几颗。后来改成白 / 金交替 + 深棕描边才跳得出来。**动效元素的配色不能从它要离开的那个物体上取。**

粒子总量上限 80，单次合并 8 颗，避免长局连续合并时堆积几十个节点拖慢渲染。

### 四、底部署名

`.foot` 从单行居中改成 `flex` 双段：左边操作提示、右边「某好心市民」，中间一道 1px 竖线分隔，透明度降到 .78 不抢棋盘。

### 五、验证情况（如实记录）

已验证：

- 14 项逻辑测试仍全过，三个 JS 文件 `node --check` 全过
- PC 外壳重启加载新 CSS 后：三个按钮（新游戏 / 撤销 / 声音）齐全，底部「某好心市民」署名正常显示，棋盘完整不裁切
- 逐帧抓拍确认方块位移与挤压过渡在真实运行

**未能通过截图验证**：粒子、彩带、音效。原因分别是粒子生命周期只有 520ms 且触发点随机（`CopyFromScreen` 单帧约 40ms，很难卡在合并那一刻）、彩带要打到 2048 才出现、音效本就没有画面证据。

这三项目前是**代码级正确 + 语法通过**，需要实机跑一局确认听感和视觉效果。这是本轮唯一没有画面证据的部分，不当作已验证。

### 六、本轮仍未打包

- `win/main.cpp` 520×740 仍未编译
- 图标未嵌入 exe / APK
- APK 未重建，`dist/` 两份产物仍过时

---

## v0.8 · 修「动效看不见」：CSS 动画在这台机器上根本不出画面（2026-11-16）

实机反馈：**碰撞没有特效动画，合并后也没有粒子、彩带动画**。查下来不是参数没调好，是整条 CSS 动画路径在本机 WebView2 里失效。

### 一、症状与第一轮误判

现象很怪：节点全在、属性全对、就是画面上没有。

| 对象 | 报告值 | 画面 |
|---|---|---|
| `.pt` 粒子 | `rect 9×9`、`opacity 1`、`z-index 15`、`background rgb(255,158,196)` | 0 个粉色像素 |
| `.confetti` 彩带 | 30 条全在 DOM、`opacity 1`、`fixed`、`z 40`、`rect (75,193)` | 该区域只有绿色文字像素 |
| `.tile.bump` | 探针 `sawBump=true`（class 已挂上） | 用户看不到挤压 |

一度怀疑是「系统开了减少动效，媒体查询把动画删掉了」，还查过注册表 `HKCU\Control Panel\Accessibility\Animation\Flags`（为空）。**这个判断是错的**——后来用探针页直接读媒体查询，`prefers-reduced-motion: reduce` 匹配结果为 `true`，系统确实关了动画效果，但把降级规则改成「减小幅度而不是删除」之后，依然看不见。

### 二、决定性对照实验

抓一个粒子，把它原样复制成一份完全静止的副本：

```js
copy.style.animation = 'none';
copy.style.opacity = '1';
```

同一帧截图上：**静止副本清清楚楚是个粉色圆点压在「4」方块左上角，带动画的原件一个像素都没有。**

`animation: none` 能画，有动画就不画 —— 元素、坐标、颜色、层级全都没问题，问题在动画本身。

顺带踩到两个坑，记下来省下次的时间：

1. **`animation-play-state: paused` 时 Chromium 也不绘制该元素**，想用「暂停」取证是取不到的，必须用 `animation: none` 的静态副本。
2. 粒子最初 `appendChild` 到 `.board` 内部，会被 16 个 `.slot` 和方块盖住，这是「看不见」的**次要**原因。改成 `document.body` + `position: fixed` + `z-index: 60` 后层级问题解决，但动画依然不出画面，说明主因不在层级。

### 三、根因（两个独立的坑叠在一起）

**坑一：被提升为合成层的 CSS `animation` 在本机 WebView2 不出画面。**

Chromium 140、`devicePixelRatio 1`。`transform` / `opacity` 类动画会被交给合成器线程做离线绘制，而这台机器的 WebView2 合成链路有问题——动画元素画不出来，但 `transition` 和静态样式正常（方块滑动一直是能看见的）。

**坑二：`performance.now()` 和 `requestAnimationFrame` 的时间戳不是同一条时间轴。**

改成 rAF 驱动之后彩带仍然 250ms 内全部消失。查出来是 `start` 用 `performance.now()` 记录、帧里拿到的是 rAF 的 `now`，两者相减得到一个很大的数，`t` 直接被算成 ≥1，第一帧就判定动画结束、删掉了节点。

修法：**起点不自己记，等第一帧到来时用那一帧的 `now` 赋值。**

```js
if (e.start < 0) e.start = now;
var t = (now - e.start) / e.dur;
```

### 四、改造：全部动效改 rAF 逐帧写样式

`style.css` 里删掉全部相关 `animation` 与 `@keyframes`（`tileBump` / `boardShake` / `ptFly` / `confettiFall`），`will-change` 也一并去掉——那同样会把它提到合成层。

`app.js` 新增一个极小的动效引擎：一条 `effects` 队列 + 一个 rAF 循环，每项自带时长和 `render(t)` 回调，跑完自动出队。

```js
function addEffect(dur, render) {
  effects.push({ start: -1, dur: dur, render: render });
  if (rafId === 0) rafId = requestAnimationFrame(runEffects);
}
```

四种效果全部改成「按 t 算状态」：

| 效果 | 逐帧写什么 | 时长 |
|---|---|---|
| 合并粒子 `spray` | `left/top/width/height/opacity`，沿圆周飞散并缩到 0.28 倍 | 520ms |
| 撞击 `bump` | `transform: scale(sx, sy)`，1 → 1.16/.84 → .92/1.1 → 1 | 240ms |
| 棋盘抖动 `shakeBoard` | `transform: translate(dx, dy)`，正弦衰减到 0 | 220ms |
| 胜利彩带 `confetti` | `top` 下落、`left` 横摆、`rotate(560deg)`、末段淡出 | 1.6~3.0s |

rAF 写样式走主线程布局与绘制，不经过合成层，也就绕开了坑一。

### 五、验证情况（如实记录）

已获得画面证据：

- **粒子**：连拍 48 帧（每步棋后 6 帧 × 8 步），按「粉色像素数」打分，最高一帧 `pink=252`。截图上清晰可见十几个粉色圆点撒在合并方块上。
- **撞击**：探针实测 `tile w=85 h=85` → 触发后 `w=97 h=73`，`transform: matrix(1.138, 0, 0, 0.862, 0, 0)`，横涨纵缩成立。

**未获得画面证据：**

- **彩带**：需要真实打到 2048 才触发，本轮没打到。用调试入口直接调 `confetti()` 时，节点数从 `n=30` 变成 `n=0` 卡在时间基准 bug 上，修掉该 bug 后窗口又被别的程序占住前台、`SetForegroundWindow` 抢不回来（`fg_matches=False`），连截 4 次都拍到无关窗口，标题通道也不通（外壳窗口标题是 `2048` 固定字符串，不跟 `document.title`）。
- **抖动**：机制与撞击完全一致（同样 rAF 写 `transform: translate`），未单独出图。

彩带这一项**不当作已验证**。它和粒子共用同一套 `addEffect` 引擎、同样的 `position: fixed` + `z-index 40` + 挂 `body`，粒子既已证明能画，彩带在逻辑上应当成立；但没看到就是没看到，需要实机打到一次 2048 再确认。

### 六、清理

排查期间在 `web/` 下留下 6 个探针页（`probe*.html`）和一个 `index.keep.html` 备份，**已全部删除**，未进仓库。`app.js` 里的 `window.PROBE_FX` 调试钩子也已移除。

### 七、本轮仍未打包

- `win/main.cpp` 520×740 仍未编译
- 图标未嵌入 exe / APK
- APK 未重建，`dist/` 两份产物仍过时

---

*本日志随开发进展追加，不覆盖历史记录。*
