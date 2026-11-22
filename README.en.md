<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="dsh-jobs-progress">
</p>

<h1 align="center">dsh-jobs-progress</h1>

<p align="center">
  Let <b>DeepSeek Harness</b> background jobs explain what they are doing, right above the composer<br>
  automatic observation · percentage / fraction progress · output tail · two-press stop · <b>zero dependencies, no build</b>
</p>

<p align="center">
  <a href="https://github.com/hchao3335-maker/dsh-jobs-progress/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/hchao3335-maker/dsh-jobs-progress/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-4f7cff.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%E2%89%A5%2020-339933?logo=node.js&amp;logoColor=white">
  <img alt="dsh" src="https://img.shields.io/badge/dsh-0.2.2--rc.5-7a5cff">
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen">
  <a href="https://github.com/hchao3335-maker/dsh-jobs-progress/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/hchao3335-maker/dsh-jobs-progress?style=social"></a>
  <a href="https://github.com/hchao3335-maker/dsh-jobs-progress/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/hchao3335-maker/dsh-jobs-progress"></a>
</p>

<p align="center"><a href="README.md">中文</a> · English</p>

<p align="center">
  <a href="#why"><img src="assets/icons/target.svg" width="14" height="14" alt=""> Why</a> ·
  <a href="#features"><img src="assets/icons/bolt.svg" width="14" height="14" alt=""> Features</a> ·
  <a href="#panel"><img src="assets/icons/monitor.svg" width="14" height="14" alt=""> Panel</a> ·
  <a href="#arch"><img src="assets/icons/topology.svg" width="14" height="14" alt=""> Architecture</a> ·
  <a href="#install"><img src="assets/icons/download.svg" width="14" height="14" alt=""> Install</a> ·
  <a href="#usage"><img src="assets/icons/terminal.svg" width="14" height="14" alt=""> Usage</a> ·
  <a href="#compat"><img src="assets/icons/check.svg" width="14" height="14" alt=""> Compatibility</a> ·
  <a href="#verification"><img src="assets/icons/flask.svg" width="14" height="14" alt=""> Verification</a> ·
  <a href="#dev"><img src="assets/icons/code.svg" width="14" height="14" alt=""> Development</a> ·
  <a href="#contributing"><img src="assets/icons/users.svg" width="14" height="14" alt=""> Contributing</a> ·
  <a href="#license"><img src="assets/icons/book.svg" width="14" height="14" alt=""> License</a>
</p>

> **TL;DR**: DSH's built-in job list is good at "inspect and manage history"; this plugin answers "what is the running script doing right now?" at a glance.
>
> The panel lives in `conversation.input.dock` and only reads the built-in client `ctx.jobs` service. It adds no Host routes, never writes `document.body`, and needs no build step.

---

<a id="why"></a>
## <img src="assets/icons/target.svg" width="20" height="20" alt=""> Why

DSH already has background jobs, but the progress story is broken:

- The built-in list hides behind a **14 px icon** in the session header.
- `pwsh` / `bash` jobs have no `progress` field, so a row only shows a label, elapsed time, and a terminal code.
- Live output is only subscribed **after a row is expanded**.

The common result: a spinner with no idea what it is doing or how far it has gone.

| | Built-in list | dsh-jobs-progress |
| --- | --- | --- |
| Entry point | Small header icon | Persistent card above the composer |
| Output subscription | Only after expanding a row | Automatic for running jobs |
| Progress | Label / elapsed / terminal code | Percentage or fraction bar + output tail |
| Stop | Open the list first | Two-press stop in the row |
| History | Retains settled records | 30-second grace; history stays in the built-in list |

---

<a id="features"></a>
## <img src="assets/icons/bolt.svg" width="20" height="20" alt=""> Features

| | Capability | Details |
| :--: | --- | --- |
| <img src="assets/icons/monitor.svg" width="18" height="18" alt=""> | **Persistent panel** | Full-width above the composer; visible as soon as a job appears |
| <img src="assets/icons/bolt.svg" width="18" height="18" alt=""> | **Automatic observation** | Running jobs are observed without expanding; up to 4 live + 2 recently settled |
| <img src="assets/icons/gauge.svg" width="18" height="18" alt=""> | **Percentage / fraction parsing** | `job.progress` first, otherwise the last `78%`, `[7/9]`, or `3 of 10` in the latest 8 KiB; rejects `150%` and `2024/11` |
| <img src="assets/icons/terminal.svg" width="18" height="18" alt=""> | **Output tail** | Expandable `<pre>`, 240 px max, inner scroll, auto-follows the bottom by default |
| <img src="assets/icons/clock.svg" width="18" height="18" alt=""> | **Elapsed time and bytes** | Updated every second, plus the latest non-empty output line |
| <img src="assets/icons/stop.svg" width="18" height="18" alt=""> | **Two-press stop** | First press arms "confirm", a second press within 3 s sends the kill; failures are visible |
| <img src="assets/icons/panel.svg" width="18" height="18" alt=""> | **Collapse memory** | Header folds; state persisted in `localStorage` |
| <img src="assets/icons/shield.svg" width="18" height="18" alt=""> | **Quiet by default** | Jobs younger than 1.5 s stay hidden; settled rows leave after 30 s |
| <img src="assets/icons/code.svg" width="18" height="18" alt=""> | **Zero dependencies, no build** | Only `react` from the page module table; no Host routes, no Client package imports, no bundler |
| <img src="assets/icons/users.svg" width="18" height="18" alt=""> | **Bilingual and accessible** | `role=progressbar`, `aria-valuenow`, labelled buttons, keyboard reachable, reduced-motion aware |

---

<a id="panel"></a>
## <img src="assets/icons/monitor.svg" width="20" height="20" alt=""> Panel

<p align="center">
  <img src="assets/panel.svg" alt="Panel illustration: header, a running row with a 78% bar and output line, and a settled row" width="900">
</p>

<p align="center"><sub>Illustration · the real look follows the active theme, window width, and output length</sub></p>

| Element | Behavior |
| --- | --- |
| **Status dot** | running / stopping / completed / killed / failed, with matching theme colors |
| **Kind badge** | `pwsh`, `bash`, or another producer kind |
| **Command first line** | Monospace, single-line ellipsis; hover for the full command |
| **Duration / bytes** | `mm:ss` or `h:mm:ss`, B / KB / MB, refreshed every second |
| **Progress zone** | Determinate bar, or indeterminate shimmer plus `streaming · N B`; latest output line below |
| **Expand** | Available when output exists; auto-follows until the reader scrolls up |
| **Stop** | Only on `running` rows; two-press confirmation, `stopping` shows "stopping" |

---

<a id="arch"></a>
## <img src="assets/icons/topology.svg" width="20" height="20" alt=""> Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="Architecture: shell job → Host job registry → Client ctx.jobs → composer dock panel" width="900">
</p>

- Data comes only from the built-in client `ctx.jobs` service: `watchRows` keeps the roster current, `observe` is a non-destructive output read, and `kill` is passed through.
- Both `watchRows` and `observe` are reference-counted; unmount, session switch, or a row leaving the visible set releases them and clears the output cache.
- The panel holds no transport state and does not reimplement the job list; settlement history stays in the built-in list.
- See [docs/architecture.md](docs/architecture.md) for the full flow and trade-offs.

---

<a id="install"></a>
## <img src="assets/icons/download.svg" width="20" height="20" alt=""> Install

### Requirements

| Item | Requirement |
| --- | --- |
| DSH | `0.2.2-rc.5` or a compatible 0.2.x (uses the built-in `ctx.jobs` and `conversation.input.dock`) |
| Environment | Web client (Desktop or `dsh web`) |
| Dependencies | None; no `npm install`, no build |

### Step 1: get the code

```powershell
git clone https://github.com/hchao3335-maker/dsh-jobs-progress.git
```

### Step 2: install into the profile

Ask your DSH agent to install the directory:

```text
Use plugin_manager install_bundle with /path/to/dsh-jobs-progress
```

Or pack it first:

```powershell
npm pack
# then install the generated dsh-jobs-progress-1.0.0.tgz
```

> `private: true` is intentional: the plugin is not published to npm. Install it from the checkout or the tarball.

### Step 3: confirm activation

The install result should be `application: applied`. The client bundle usually hot-swaps through HMR; refresh the page if it does not appear immediately. There is no configuration, and the plugin applies to every session.

---

<a id="usage"></a>
## <img src="assets/icons/terminal.svg" width="20" height="20" alt=""> Usage

### When a row appears

| Status | Condition |
| --- | --- |
| `running` / `stopping` | More than **1.5 s** after start |
| `completed` / `killed` / `failed` | Within **30 s** after settling, with output |

The 1.5 s grace filters the short-lived registry entries created by every foreground command. Longer foreground commands still appear because they are real jobs. When no row is visible, the panel renders nothing and releases all observation streams.

### How progress is parsed

1. The producer's `job.progress` line wins.
2. Otherwise scan the latest 8 KiB of output for the **last** valid figure.
3. Accept `78%`, `[7/9]`, `7/9`, or `3 of 10`.
4. Clamp percentages to `0..100`; require `b > 0` and `a <= b` for fractions.
5. Reject figures cut out of a longer number or a date (`150%`, `2024/11`).

### Controls

- **Stop**: first press arms a three-second confirmation; the second press sends the kill, then the row converges through the roster.
- **Expand**: rows with output expand to a scrolling `<pre>`; it follows the bottom until you scroll up.
- **Collapse**: click the header; the state is stored in `localStorage` under `dsh-background-monitor.collapsed`.
- **Keyboard**: every control is tabbable; the bar exposes `aria-valuenow` / `aria-busy`.

```powershell
# See it immediately: start a background job that prints progress
1..120 | ForEach-Object {
  "[{0}/120] {1}%  processing block {0}" -f $_, [math]::Round($_ / 120 * 100)
  Start-Sleep -Seconds 1
}
```

Run it with `run_in_background`, return to the session, and the panel appears above the composer.

---

<a id="compat"></a>
## <img src="assets/icons/check.svg" width="20" height="20" alt=""> Compatibility

| Item | Value |
| --- | --- |
| **Tested DSH** | `@deepseek-ai/dsh` **0.2.2-rc.5** (Desktop, Windows) |
| **Runtime location** | Web client · `conversation.input.dock` (order 15) |
| **Data source** | Built-in client `ctx.jobs` (`watchRows` / `observe` / `kill`) |
| **Runtime dependencies** | 0 (React comes from the page module table) |
| **Build step** | None |
| **Install** | Profile bundle (local directory / tarball) |
| **Node** | ≥ 20 (development and CI only) |

---

<a id="verification"></a>
## <img src="assets/icons/flask.svg" width="20" height="20" alt=""> Verification

Version 1.0.0 was exercised on a real DSH `0.2.2-rc.5` Desktop instance:

| Scenario | Result |
| --- | --- |
| 240-second background job | Bar `RangeValue` moved from `39/100` to `42/100`; row `28% → 42%`, `1:07 → 1:42`, `1.8 KB → 3.2 KB` |
| Expand output | The `<pre>` received the full retained tail; the button switched to "collapse" |
| Two-press stop | "Confirm stop" → job `killed`; row showed `cancelled by the user` and the registry reported `killed` |
| Settled grace | A completed row stayed 30 s, then left; the panel disappeared when no rows were visible |
| Collapse persistence | Stayed collapsed across a session switch and component remount |
| CI | `npm run check`: syntax checks + **9 unit tests**, green in GitHub Actions |

> Verification used Windows UI Automation to read the real rendered tree and invoke the real buttons. There was no screenshot-level visual verification, and the English UI was not switched at runtime. Details and gaps: [docs/verification.md](docs/verification.md).

---

<a id="dev"></a>
## <img src="assets/icons/code.svg" width="20" height="20" alt=""> Development

```powershell
npm run check    # node --check index.js client.js + node --test test/client.test.mjs
```

No runtime dependencies and no build step; `client.js` is a single-file client plugin that only takes `react` from the page module table.

```text
.
├── client.js                 # dock panel, parsing, stop state machine, styles
├── index.js                  # empty Host half
├── cordis.patch.yml          # bundle row
├── icon.svg                  # plugin-page icon
├── assets/                   # README logo / panel illustration / architecture / icons
├── locale/{zh,en}.json       # plugin-page metadata
├── test/client.test.mjs      # parser, formatter, dictionary, registration tests
├── docs/                     # architecture and verification notes
└── .github/workflows/ci.yml  # GitHub Actions
```

Rules of thumb:

- Keep the browser half single-file and buildless; do not import Harness Client packages such as `@deepseek-ai/dsh-client-ui-*` (they can crash the slot entry).
- Never write `document.body`, replace the app root, or build a floating overlay.
- Use theme tokens only, prefix classes with `dshbg-`, and render the scoped `<style>` inside the component.
- Add every visible string to both `zh` and `en`, and keep the key-parity test green.

---

<a id="limits"></a>
## <img src="assets/icons/warning.svg" width="20" height="20" alt=""> Scope and limitations

- **No shell `Write-Progress` parsing**: it is not on stdout; only text output is parsed.
- **Not a replacement for the built-in list**: history, clearing, and cross-session views stay there; this panel only covers a 30-second grace.
- **Foreground commands appear too**: every foreground command is registered as a job; those longer than 1.5 s show up, shorter ones are filtered. That is registry behavior, not a bug.
- **No notifications, sound, floating window, or history search**: intentionally out of scope for v1.
- **Limited visual verification**: no screenshot-level check, and neither a 340 px window nor the English UI was exercised at runtime.

---

<a id="contributing"></a>
## <img src="assets/icons/users.svg" width="20" height="20" alt=""> Contributing

Issues and pull requests are welcome:

1. Open an issue first for larger changes so the direction stays aligned.
2. Run `npm run check` before submitting; syntax checks and all 9 unit tests must pass.
3. If you change parsing, add boundary cases to `test/client.test.mjs` (especially false positives).
4. Use `feat:`, `fix:`, `docs:` prefixes in commit messages.

A Star is the best support if this plugin helps you.

---

<a id="license"></a>
## <img src="assets/icons/book.svg" width="20" height="20" alt=""> License

[MIT](LICENSE) © 2026 xianyiliang

<p align="center">
  <a href="https://star-history.com/#hchao3335-maker/dsh-jobs-progress&amp;Date">
    <img src="https://api.star-history.com/svg?repos=hchao3335-maker/dsh-jobs-progress&amp;type=Date" alt="Star History" width="620">
  </a>
</p>
