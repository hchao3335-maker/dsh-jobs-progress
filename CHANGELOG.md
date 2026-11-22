# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
semantic versioning.

## [1.0.0] - 2026-11-22

### Added

- Persistent background-job panel in `conversation.input.dock` (order 15).
- Automatic output observation for up to four live jobs and two recently
  settled jobs; expanded rows are observed on demand.
- Progress-line precedence: the producer's `progress` field first, otherwise the
  last valid `n%`, `[a/b]`, or `a of b` figure in the latest 8 KiB of output.
- Determinate and indeterminate progress bars, elapsed time, output byte count,
  and the latest non-empty output line.
- Expandable output tail with auto-follow, gap and stream-error notices.
- Two-press stop button with a three-second confirmation window and visible
  failure feedback.
- Collapsible header persisted in `localStorage`; Chinese and English locales;
  `prefers-reduced-motion` support.

### Fixed

- Release observation streams when an expanded row leaves the visible set.
- Use "finished" instead of "completed" for all settled states in the header.
- Keep the queue dock's attached bottom seam intact by registering above it.
- Reject percentages that start inside a longer number (`150%`) and dates such
  as `2024/11` when parsing progress.
- Restore the TodoPanel elevation-stroke and scrollbar theme tokens.

### Verified

- DSH `0.2.2-rc.5` Desktop on Windows: live percentage progression, expandable
  output, two-press kill, 30-second settled-row removal, collapsed-state
  persistence, and no panel when no row is visible. See
  [`docs/verification.md`](docs/verification.md).
