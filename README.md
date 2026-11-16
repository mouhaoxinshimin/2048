# 2048

> 创建于 2026-11-16 · 一份原型，两套外壳：Windows 桌面版 + 安卓版
>
> 作者：某好心市民

---

## 一、项目定位

2048 数字合并游戏，玩法走标准版：4×4 棋盘、方向键或滑动合并同数字、撤销一步、新游戏二次确认、合并动效、最高分本地保存。

沿用「猜拳对决」验证过的跨端路径：

**一份 HTML 原型做唯一视觉基准 → Windows 外壳（WebView2）→ 安卓外壳（WebView）**

两套外壳只处理窗口、全屏、返回键这类平台差异，玩法和界面只有一份，永远改 `web/` 里的那套。

---

## 二、已定方案

| 项 | 决定 |
|---|---|
| 视觉 | Q 版可爱卡通，配色与描边规范对齐「猜拳对决」（马卡龙色 + 3px 粗描边 + 实心偏移投影） |
| 功能 | 标准版：基础玩法 + 撤销一步 + 新游戏页面内二次确认 + 合并动效 |
| 安卓 | 只做 WebView 套壳，不写原生绘制 |

---

## 三、目录结构

```
2048/
├── web/                      游戏本体，唯一逻辑源
│   ├── index.html            页面结构
│   ├── assets/css/style.css  样式（Q 版规范）
│   ├── assets/js/game.js     纯逻辑：棋盘、移动、合并、计分、撤销
│   ├── assets/js/app.js      界面层：渲染、动画、键盘与滑动、遮罩、提示
│   └── test/game.test.js     逻辑单元测试，14 项
├── win/                      Windows 外壳（C++ + WebView2）
│   ├── main.cpp              开窗口、挂虚拟域名、加载页面
│   ├── build.bat             一键编译
│   └── Game2048.exe          构建产物
├── android/                  安卓外壳（WebView 套壳）
│   ├── settings.gradle
│   ├── build.gradle
│   ├── gradle.properties
│   ├── local.properties      sdk.dir，不入库
│   └── app/
│       ├── build.gradle      构建时自动把 web/ 同步进 assets
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── java/com/mhxsm/game2048/MainActivity.java
│           ├── res/values/{strings,themes}.xml
│           └── assets/web/   由 syncWeb 任务生成，不入库
├── assets/icon/               应用图标源文件（1024 母版 + app.ico + 安卓 mipmap + favicon）
├── .creative-design/          图标设计 Brief 与画布记录
└── docs/
    └── DEVLOG.md             开发日志
```

**硬规矩**：JS、CSS 一律放 `assets/` 下对应目录，不内联进 HTML。

---

## 四、玩法与规则

- 4×4 棋盘，开局随机放两个方块（2 或 4）
- 方向键或滑动，整行整列一起挤，相同数字撞上就合并，得分等于合并后的值
- **一步之内不连锁**：`4 2 2` 左移得到 `4 4`，不会变成 `8`
- 只保留**一步**撤销，撤销连棋盘、分数、胜负状态一起回退
- 首次合成 2048 弹胜利遮罩，可以选「接着玩」继续往上堆
- 无空格且无相邻同值判为死局，遮罩里可以直接撤回一步救回来
- 最高分存 `localStorage` 的 `g2048.best`

---

## 五、三端怎么跑

### 网页原型

直接用浏览器打开 `web/index.html`。不用 ES module，两个普通 `<script>` 引脚本，`file://` 下也能跑。

### Windows 版

```powershell
cd F:\Trae\doubao\2048\win
cmd /c build.bat
```

产物是 `win\Game2048.exe`。程序启动后会把 `web/` 目录挂成 `https://game2048.local` 再加载页面，所以：

- `localStorage` 有正常来源，最高分能落盘
- 改 HTML / CSS / JS 不用重新编译 exe，直接重开程序就能看到
- `web/` 目录要和 exe 同级（开发时 exe 在 `win\`，程序会自动往上一级找）

依赖：VS2022 BuildTools、WebView2 SDK（`G:\dev\DuiLib_Ultimate-master\3rd\WebView2`）、系统 WebView2 运行时。

### 安卓版

```powershell
$env:JAVA_HOME = "G:\dev\jdk-17"
$env:GRADLE_USER_HOME = "G:\dev\gradle-home"
& "G:\dev\gradle-8.9\bin\gradle.bat" -p "F:\Trae\doubao\2048\android" assembleDebug --no-daemon --console=plain
```

产物是 `android\app\build\outputs\apk\debug\app-debug.apk`。

`assembleDebug` 之前会自动跑 `syncWeb`，把 `web/` 整体同步进 `app/src/main/assets/web`，不用手工复制。

装到设备：

```powershell
& "G:\dev\android-sdk\platform-tools\adb.exe" install -r "F:\Trae\doubao\2048\android\app\build\outputs\apk\debug\app-debug.apk"
& "G:\dev\android-sdk\platform-tools\adb.exe" shell am start -n com.mhxsm.game2048/.MainActivity
```

---

## 六、技术要点（可复用到后续项目）

1. **玩家看到的每一块都是对象，不是数字**
   `game.js` 的棋盘格子存 `{id, v}`，移动时对象跟着走。界面层靠 `id` 认出「还是原来那一块」，才能做出连续的滑动动画；只存数字的话，每次走完都只能整体重绘，动效无从谈起。

2. **移动结果要带上「谁被谁吃掉」**
   `move()` 返回 `{moved, gained, pairs:[{dead, into}], spawned, won}`。`pairs` 让界面层能把被合并的方块先滑到目标位置、再消失，而不是原地凭空不见。

3. **动画分两段，中间靠时间片切开**
   第一段只改所有方块的 `left/top`（含即将消失的），走 `SLIDE_MS`；第二段删掉被吃掉的、更新合并值并弹一下、再新建新方块并淡入。新建方块时先置 `transition: none`，下一帧再恢复，否则会从棋盘左上角滑进来。

4. **坐标全用百分比，不用像素**
   `PAD / GAP / CELL` 三个常量同时写在 `app.js` 和 CSS 的 `--pad / --gap / --cell` 里，这是唯一需要人工同步的地方。好处是窗口怎么缩放、手机上什么分辨率，方块位置都不用重算。

5. **百分比不能拿来算字号**（本轮踩的坑，值得记住）
   同一个 `21.75%` 用在 `width` 上按包含块宽度解析（得到 103px，对的），用在 `font-size` 上却按**父元素字号**解析（16px×21.75% ≈ 3.5px）。`calc(var(--cell) * 1.02)` 这种写法看起来合理，实际会把字号压成个位数像素，而且父元素字号一变就跟着漂。
   字号必须有一套独立的真实像素来源。本项目用 `var(--cell-px)`：先给 `103px` 兜底，再用 `min(calc((100vw - 39px) * 0.2175), 103px)` 由视口推算，全程不依赖 JS 和 resize 监听。

6. **窗口尺寸要向设计稿看齐，别让外壳决定棋盘大小**
   棋盘是 `min(容器宽, 480px)`，所以外壳客户区一旦小于 512px，棋盘就会被它截小，表现成「三端不一样大」而其实样式完全没错。写外壳时按 `棋盘宽 + 页边 + 边框` 反推窗口尺寸（本项目 480 + 32 + 8 = 520 × 740）。

7. **两端外壳都不内嵌资源，共用同一份 `web/`**
   Windows 用 `SetVirtualHostNameToFolderMapping` 把目录挂成 https 源，安卓用 Gradle 的 `syncWeb` 任务在构建前拷贝。两处都保证「改一次页面，三端同时生效」。

8. **老内核的兼容写法**
   `aspect-ratio` 和 `inset` 在 Chromium 88 以下的 WebView 上会失效，棋盘会塌成一条线。CSS 里给了 `@supports not (aspect-ratio: 1/1)` 的 padding 兜底，`inset: 0` 一律写成 `top/right/bottom/left`。

---

## 七、开发环境

本机为命令行工具链，未装 Android Studio：

| 项 | 路径 / 值 |
|---|---|
| JDK | `G:\dev\jdk-17`（构建时必须设 `JAVA_HOME`） |
| Android SDK | `G:\dev\android-sdk`（platforms `android-35`，build-tools `34.0.0` / `35.0.0`） |
| Gradle | `G:\dev\gradle-8.9\bin\gradle.bat`，缓存目录 `G:\dev\gradle-home`（已缓存 AGP 8.7.2） |
| 模拟器 | `G:\dev\LDPlayer9`（`dnplayer.exe` / `adb.exe` / `ldconsole.exe`） |
| 编译器 | `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools` |
| WebView2 SDK | `G:\dev\DuiLib_Ultimate-master\3rd\WebView2` |

---

## 八、已知待补

- 图标源文件已备好（`assets/icon/`），但**还没嵌进 exe 和 APK**，两端现在仍用系统默认图标
- release 版 APK 还没做签名配置，现在只有 debug 包
- 安卓还没做 adaptive icon（目前只有传统方形 mipmap）
- 没有 `LICENSE` 文件

---

## 九、变更记录

| 日期 | 版本 | 内容 |
|---|---|---|
| 2026-11-16 | v0.1 | 建项目骨架：目录结构、`.gitignore`、README |
| 2026-11-16 | v0.2 | 写完整套 `web/`：页面、Q 版样式、逻辑层、界面层、14 项逻辑测试 |
| 2026-11-16 | v0.3 | Windows 外壳：`win/main.cpp` + `build.bat`，编译出 `Game2048.exe` 并实测渲染正常 |
| 2026-11-16 | v0.4 | 安卓外壳：Gradle 工程 + `MainActivity`，`assembleDebug` 通过，产出 24.7 KB APK |
| 2026-11-16 | v0.5 | 模拟器实测：滑动、键盘、合并、计分、撤销、最高分落盘、新游戏二次确认全部通过；补老内核兼容写法，去掉按钮焦点描边，棋盘放大到 480px |
| 2026-11-16 | v0.6 | 修字号：`--cell-px` 独立推算真实像素，字号不再吃百分比；PC 窗口 430×730 → 520×740 让棋盘在三端都是 480；出应用图标（1024 母版 + `.ico` 多尺寸 + 安卓 5 档 mipmap + favicon），图标未嵌入两端 |
