# DSH 后台任务进度监视器

[中文](README.md) | [English](README.en.md)

[![check](https://github.com/hchao3335-maker/dsh-jobs-progress/actions/workflows/check.yml/badge.svg)](https://github.com/hchao3335-maker/dsh-jobs-progress/actions/workflows/check.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH 0.2.2-rc.5](https://img.shields.io/badge/DSH-0.2.2--rc.5-4f7cff)](https://github.com/deepseek-ai/deepseek-harness)
[![no build step](https://img.shields.io/badge/build-none-success)](package.json)

DeepSeek Harness（DSH）插件：在输入框上方常驻显示当前会话后台任务的实时进度。不用再点标题栏那个小图标，也不用先展开某一行才看得到输出。

## 为什么

DSH 内置的后台任务列表入口是会话标题栏里的一个小图标；`pwsh` / `bash` 任务默认没有 `progress` 字段，实时输出又必须手动展开某一行才会开始订阅。结果是：上面在转圈，但不知道在干什么、跑到哪了。

这个插件把「常驻、自动、可读」的进度补上：面板自动订阅正在运行的任务，从输出里解析百分比/分数并画进度条，同时给出耗时、字节数和最近一行输出。

## 面板

```text
┌──────────────────────────────────────────────────────────────┐
│ ▤ 后台任务   共 2 个 · 运行中 1 · 已结束 1              ⌄    │
│ ● pwsh  pnpm build            1:32  12.4 KB      ⌄  ■       │
│   ████████████████░░░░  78%                                  │
│   [7/9] 正在压缩 dist/assets                                 │
│ ✓ pwsh  pnpm test   已完成 · exit code: 0   0:41       ⌄     │
└──────────────────────────────────────────────────────────────┘
```

## 功能

- **自动订阅**：运行中的任务不必展开，直接显示输出尾部。
- **百分比进度**：优先读任务自身的 `progress` 行；否则从输出尾部 8 KiB 解析最后一个 `78%`、`[7/9]` 或 `3 of 10`，画确定进度条。
- **不定进度**：解析不到百分比时显示 shimmer 进度条与「输出中 · N B」。
- **可读指标**：已运行时长（每秒刷新）、累计输出字节数、最近一行输出（单行省略，悬停看全文）。
- **展开输出**：`<pre>` 显示尾部，最多 240 px 高、内部滚动，默认自动跟随到底部；手动上滚后不再强拉。
- **两段式停止**：第一次点击变成「确认停止」，3 秒内再点才真正请求停止；失败有可见反馈。
- **折叠记忆**：header 可折叠，状态写入 `localStorage`（`dsh-background-monitor.collapsed`）。
- **不闪烁**：运行不足 1.5 秒的前台命令不会出现；结算行 30 秒后自动消失。
- **可访问性**：`role="progressbar"`、`aria-valuenow`、按钮 `aria-label`、键盘可达、`prefers-reduced-motion` 友好；中英文文案。

## 安装

要求 DSH `0.2.2-rc.5` 或兼容的 0.2.x（使用内置客户端 `ctx.jobs` 与 `conversation.input.dock`）。

```powershell
git clone https://github.com/hchao3335-maker/dsh-jobs-progress.git
```

然后在 DSH 会话里让 agent 把本目录安装进 profile：

```text
用 plugin_manager install_bundle 安装 C:\path\to\dsh-jobs-progress
```

也可以先打包再安装：

```powershell
npm pack
# 然后安装生成的 dsh-jobs-progress-1.0.0.tgz
```

安装结果是 `application: applied` 即生效；客户端 bundle 通常经 HMR 热换，必要时刷新页面。插件没有配置项，也不需要 `npm install` 或构建步骤。

> `private: true` 是有意的：本插件未发布到 npm，请从仓库目录或 tarball 安装。

## 使用

- 面板固定在输入框上方（`conversation.input.dock`），只在有值得看的任务时渲染。
- **出现条件**：运行中且已启动超过 1.5 秒；或结算后 30 秒内且确有输出。
- **进度来源**：`job.progress` → 输出尾部最后一个合法百分比或分数。`150%`、`2024/11` 这类数字不会被误判。
- **停止**：只有 `running` 行有停止按钮；`stopping` 时显示「正在停止」。
- **展开**：有输出的行才能展开；展开后自动滚到底部。
- **折叠**：点 header 折叠/展开，刷新后保持。
- 最长的 4 个运行中任务 + 2 个刚结算任务会自动观察；展开的行额外观察，离开可见集即释放。

## 工作方式

- 只使用内置客户端服务 `ctx.jobs`：`watchRows` / `observe` / `kill`，不新建 Host 路由。
- 不写 `document.body`、不替换 app root、不做浮层。
- 槽位 `conversation.input.dock`，order **15**（goal 10 与 queue 20 之间；`QueueDock` 需要贴住输入卡，面板在它上方）。
- 样式只用主题 token，前缀 `dshbg-`；组件内 `<style>` 随卸载移除。
- 具体数据流与设计取舍见 [docs/architecture.md](docs/architecture.md)。

## 开发

```powershell
npm run check    # node --check index.js client.js + node --test
```

没有运行时依赖：`client.js` 只从页面模块表取 `react`，Host 半边是空的 `apply()`。

```text
.
├── client.js                 # dock 面板、解析、停止状态机、样式
├── index.js                  # Host 半边（空）
├── cordis.patch.yml          # bundle 行
├── locale/{zh,en}.json       # 插件页元数据
├── test/client.test.mjs      # 解析/格式化/字典/注册单元测试
├── docs/                     # 架构与验证记录
└── .github/workflows/check.yml
```

## 已知范围

- 不解析 shell 的 `Write-Progress`（它不在 stdout 里），只解析文本输出。
- 不替换内置任务列表；不做历史持久化、通知、跨会话总览。
- 前台命令也会注册为 job；超过 1.5 秒会出现在面板，短命令被过滤，这是注册表本身的行为，不是 bug。
- 1.0.0 的真实界面验证见 [docs/verification.md](docs/verification.md)：百分比进度、展开输出、两次点击停止、30 秒消失、折叠持久化、无任务不渲染。没有截图级视觉验证，也没有切换英文界面。

## License

[MIT](LICENSE) © 2026 xianyiliang
