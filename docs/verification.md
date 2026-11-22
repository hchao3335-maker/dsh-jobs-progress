# Verification

## Environment

- DSH `0.2.2-rc.5` Desktop, profile `desktop`, Windows.
- Real background jobs started with the `pwsh` tool using
  `run_in_background: true`.
- No BrowserSkill extension or Chrome DevTools port was available, so no
  screenshot was taken. Instead the running DSH window was inspected through
  Windows UI Automation: the accessibility tree supplied the real rendered
  labels, row structure, and progress-bar range values, and the real stop and
  expand buttons were invoked through their UIA patterns.

No mock page or custom renderer was used.

## Scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Start `1..240` one-line-per-second background job | Panel appeared above the composer after the 1.5 s grace |
| 2 | Read the live row | `pwsh`, command first line, `1:07` → `1:42`, `1.8 KB` → `3.2 KB`, `28%` → `42%`, progress line `[102/240] 42% 正在处理块 102` |
| 3 | Read the progress bar | UIA `RangeValue` was `39/100`, then `42/100`; the accessible name included the task label |
| 4 | Expand the row | Button changed to "collapse"; a `<pre>` contained the complete retained tail from `[1/240]` to `[102/240]` |
| 5 | Two-press stop | First press showed "确认停止"; the second press changed the row to `已取消 · killed before exit; cancelled by the user`, and the job registry reported `killed` |
| 6 | Settled-row grace | A completed row stayed for 30 s and then left the panel; a completed job showed `已完成 · exit code: 0` and `Took 2:02` |
| 7 | No visible rows | An external delayed dump, made 40 s after the last job row expired, contained no `dshbg-root` element |
| 8 | Collapse persistence | Collapsing, switching sessions away and back (remount), and reopening the panel kept it collapsed (`localStorage` key `dsh-background-monitor.collapsed`) |
| 9 | Long foreground command | A foreground command that ran longer than 1.5 s appeared as a row with the indeterminate bar and `输出中 · N B`; short commands were filtered by the grace period |
| 10 | Header counts | Accessible header name read `后台任务 共 2 个 · 运行中 2 · 已结束 0`; settled rows counted as "已结束" |

## Not verified

- Pixel-level appearance, light/dark color contrast, and reduced-motion animation
  (no screenshot-capable browser control was available).
- A 340 px narrow window.
- The English UI was not switched at runtime; the Chinese and English
  dictionaries are checked for identical key sets in `test/client.test.mjs`.
- A full page reload; collapse persistence was exercised through a component
  remount by switching sessions.

## Reproducing

```powershell
# unit tests and syntax checks
npm run check

# launch a job with recognizable progress lines
1..120 | ForEach-Object {
  "[{0}/120] {1}%  正在处理块 {0}" -f $_, [math]::Round($_ / 120 * 100)
  Start-Sleep -Seconds 1
}
```

Run the job with `run_in_background: true` and open a session whose composer is
visible. The panel should appear after roughly 1.5 seconds.
