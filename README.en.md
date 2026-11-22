# DSH Background Job Progress Monitor

[中文](README.md) | [English](README.en.md)

[![check](https://github.com/hchao3335-maker/dsh-jobs-progress/actions/workflows/check.yml/badge.svg)](https://github.com/hchao3335-maker/dsh-jobs-progress/actions/workflows/check.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH 0.2.2-rc.5](https://img.shields.io/badge/DSH-0.2.2--rc.5-4f7cff)](https://github.com/deepseek-ai/deepseek-harness)
[![no build step](https://img.shields.io/badge/build-none-success)](package.json)

A DeepSeek Harness (DSH) plugin that keeps a live progress card above the composer for this session's background jobs. No more clicking the tiny header icon, and no need to expand a row before seeing what a job is doing.

## Why

DSH's built-in job list lives behind a 14 px icon in the session header. Shell jobs (`pwsh` / `bash`) have no `progress` field, and live output is only subscribed when a row is expanded. The result is a spinner with no readable progress.

This plugin adds the missing ambient layer: running jobs are observed automatically, the latest percentage or fraction is parsed into a progress bar, and elapsed time, output bytes, and the latest output line stay visible.

## Panel

```text
┌──────────────────────────────────────────────────────────────┐
│ ▤ Background tasks   2 total · 1 running · 1 finished   ⌄    │
│ ● pwsh  pnpm build            1:32  12.4 KB      ⌄  ■       │
│   ████████████████░░░░  78%                                  │
│   [7/9] compressing dist/assets                              │
│ ✓ pwsh  pnpm test   completed · exit code: 0  0:41     ⌄     │
└──────────────────────────────────────────────────────────────┘
```

## Features

- **Automatic observation** for up to four live jobs and two recently settled jobs.
- **Progress parsing**: the producer's `progress` field first, otherwise the last valid `78%`, `[7/9]`, or `3 of 10` in the latest 8 KiB of output.
- **Determinate and indeterminate bars**, with `输出中 · N B` when no figure is available.
- **Elapsed time**, output bytes, and the latest non-empty output line.
- **Expandable output tail** with auto-follow and gap/stream-error notices.
- **Two-press stop**: the first press arms a three-second confirmation; failures are visible in the button.
- **Collapsible header** persisted in `localStorage`.
- **Quiet by default**: jobs younger than 1.5 s are hidden, settled rows leave after 30 s.
- **Accessible and localized**: progressbar semantics, labelled buttons, keyboard operation, reduced-motion support, Chinese and English copy.

## Install

Requires DSH `0.2.2-rc.5` or a compatible 0.2.x (it uses the built-in `ctx.jobs` client service and the `conversation.input.dock` slot).

```powershell
git clone https://github.com/hchao3335-maker/dsh-jobs-progress.git
```

Then ask your DSH agent to install the directory into the profile:

```text
Use plugin_manager install_bundle with C:\path\to\dsh-jobs-progress
```

Or pack it first:

```powershell
npm pack
# then install the generated dsh-jobs-progress-1.0.0.tgz
```

`application: applied` means the bundle is live. The client half usually hot-swaps through HMR; refresh the page if needed. There is no configuration, no `npm install`, and no build step.

> `private: true` is intentional: the plugin is not published to npm. Install it from the checkout or the tarball.

## Usage

- The card is registered in `conversation.input.dock` and renders only when a row is worth watching.
- **Visibility**: live for more than 1.5 s, or settled within the last 30 s with output.
- **Progress source**: `job.progress`, otherwise the last valid percentage or fraction in the output tail. Dates such as `2024/11` and malformed values such as `150%` are rejected.
- **Stop**: only `running` rows offer the button; a stopping row shows "正在停止".
- **Expand**: rows with output can be expanded; the tail follows the bottom until you scroll up.
- **Collapse**: click the header; the state survives reloads.

## How it works

- Data comes only from the built-in client `ctx.jobs` service (`watchRows` / `observe` / `kill`); there are no Host routes.
- The browser half never writes `document.body` and never replaces the app root.
- Slot order is **15**, between the goal dock (10) and the queue dock (20). The queue tucks under the composer, so this panel registers above it.
- Styles use theme tokens only and are scoped under `dshbg-`.
- See [docs/architecture.md](docs/architecture.md) for the data flow and design choices.

## Development

```powershell
npm run check    # node --check index.js client.js + node --test
```

No runtime dependencies: `client.js` gets `react` from the page module table, and the Host half is an empty `apply()`.

```text
.
├── client.js                 # dock panel, parsing, stop state machine, styles
├── index.js                  # empty Host half
├── cordis.patch.yml          # bundle row
├── locale/{zh,en}.json       # plugin-page metadata
├── test/client.test.mjs      # parser, formatter, dictionary, registration tests
├── docs/                     # architecture and verification notes
└── .github/workflows/check.yml
```

## Scope and limitations

- Does not parse shell `Write-Progress` (it is not on stdout); only text output is parsed.
- Does not replace the built-in job list, persist history, or send notifications.
- Foreground shell commands are also registered as jobs; those longer than 1.5 s appear by design, shorter ones are filtered by the grace period.
- See [docs/verification.md](docs/verification.md) for the 1.0.0 verification record. There was no screenshot-level visual verification and the English UI was not switched at runtime.

## License

[MIT](LICENSE) © 2026 xianyiliang
