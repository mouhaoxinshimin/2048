# 2048

> 创建于 2026-11-16 · 一次原型，两套外壳：Windows 桌面版 + 安卓版
>
> 作者：某好心市民

---

## 一、项目定位

2048 数字合并游戏。沿用「猜拳对决」验证过的路径：

**一份 HTML 原型做唯一视觉基准 → Windows 外壳（WebView2）→ 安卓外壳（WebView）**

两份外壳都只负责窗口、图标、返回键这类平台差异，玩法逻辑和界面只有一份，永远改 `web/` 里的那套。

---

## 二、目录约定

| 目录 | 用途 | 状态 |
|---|---|---|
| `web/` | 游戏本体，唯一逻辑源 | 待开发 |
| `web/assets/js/` | 脚本，按职责分文件 | 待开发 |
| `web/assets/css/` | 样式 | 待开发 |
| `win/` | Windows 外壳（WebView2 + Win32） | 待开发 |
| `android/` | 安卓工程（WebView 套壳） | 待开发 |
| `docs/` | 设计说明、开发日志、复盘 | 待开发 |

**硬规矩**：JS、CSS 一律放 `assets/` 下对应目录，不内联进 HTML。

---

## 三、当前状态

**只有骨架，没有代码。**

目录、`.gitignore`、本 README 已就位，等视觉方向定了再动手写原型。

---

## 四、待确认的三件事

动手之前需要先定下来，否则后面返工成本很高：

1. **视觉风格**
   - A：经典 Material 风（米白底 + 2/4/8 递增暖橙到金），认清度最高，一眼就是 2048
   - B：Q 版可爱卡通（沿用猜拳的马卡龙配色 + 粗描边 + 实心投影），有家族感但与原生 2048 差异大

2. **棋盘尺寸**：4×4 标准，还是要不要给个 3×3 / 5×5 可选（安卓端小屏 4×4 手指按压面积够用）

3. **得分与记录**：只做当局得分 + 最高分，还是加撤销一步、跨会话保存最高分

---

## 五、开发环境

本机为命令行工具链，未装 Android Studio：

| 项 | 路径 / 值 |
|---|---|
| JDK | `G:\dev\jdk-17`（构建时必须设 `JAVA_HOME`） |
| Android SDK | `G:\dev\android-sdk`（platforms `android-35`，build-tools `34.0.0` / `35.0.0`） |
| Gradle | `G:\dev\gradle-8.9\bin\gradle.bat`，缓存目录 `G:\dev\gradle-home` |
| 模拟器 | `G:\dev\LDPlayer9`（`dnplayer.exe` / `adb.exe` / `ldconsole.exe`） |

构建命令模板：

```powershell
$env:JAVA_HOME = "G:\dev\jdk-17"
$env:GRADLE_USER_HOME = "G:\dev\gradle-home"
& "G:\dev\gradle-8.9\bin\gradle.bat" -p "F:\Trae\doubao\2048\android" assembleDebug --no-daemon --console=plain
```

---

## 六、变更记录

| 日期 | 内容 |
|---|---|
| 2026-11-16 | 建项目骨架：目录结构、`.gitignore`、本 README |
