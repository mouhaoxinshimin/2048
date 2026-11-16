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

*本日志随开发进展追加，不覆盖历史记录。*
