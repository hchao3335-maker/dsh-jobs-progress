/**
 * dsh-jobs-progress — browser half.
 *
 * A persistent progress card docked above the composer. Unlike the built-in
 * session-header job list, it does not wait for a click: every "worth watching"
 * job is observed automatically, the latest percentage or `[7/9]` fraction in
 * that output drives a progress bar, and a running row can be stopped from the
 * card itself.
 *
 * Data comes exclusively from the built-in client `ctx.jobs` service
 * (`@deepseek-ai/dsh-api-job-controller`): `watchRows` keeps this session's
 * roster current, `observe` streams a job's output non-destructively, and
 * `kill` asks the registry to stop a job. The slot is
 * `conversation.input.dock`, the full-width band above the composer card.
 *
 * The module has no build step: it is a CommonJS-style factory registered with
 * the page's module loader, with React taken from the loader's module table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-jobs-progress',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Client locale namespace owned by this plugin. */
    const NS = 'background-monitor'

    /** Collapse preference; the header state survives a reload. */
    const STORAGE_KEY = 'dsh-background-monitor.collapsed'

    /** A live job must have been running this long before it earns a row. */
    const LIVE_GRACE_MS = 1500
    /** A settled job stays visible this long after it finished. */
    const SETTLED_GRACE_MS = 30000
    /** Two-press stop: the armed state waits this long for the confirming press. */
    const KILL_ARM_MS = 3000
    /** A rejected stop keeps its hint this long before the button resets. */
    const KILL_FAILED_MS = 4000
    /** Automatic observation limits: four live rows plus two recently settled rows. */
    const MAX_LIVE_OBSERVERS = 4
    const MAX_SETTLED_OBSERVERS = 2
    /** Only the tail of the output is scanned for progress figures. */
    const PARSE_TAIL = 8192
    /** Progress line text is clipped to this many characters. */
    const PROGRESS_LINE_MAX = 200
    /** Auto-follow stops when the reader scrolls this far from the bottom. */
    const FOLLOW_SLACK_PX = 24

    /** One stable empty array: an unwatched session has no rows key. */
    const NO_JOBS = []

    /** Simplified Chinese copy (the key-set source of truth). */
    const zh = {
      'panel.aria': '后台任务进度',
      'title': '后台任务',
      'header.summary': '共 {total} 个 · 运行中 {running} · 已结束 {done}',
      'header.expandAria': '展开后台任务面板',
      'header.collapseAria': '收起后台任务面板',
      'list.aria': '后台任务列表',
      'status.running': '运行中',
      'status.stopping': '正在停止',
      'status.completed': '已完成',
      'status.killed': '已取消',
      'status.failed': '已失败',
      'duration.live': '已运行 {duration}',
      'duration.done': '耗时 {duration}',
      'bytes.title': '累计输出 {size}',
      'progress.aria': '任务进度',
      'progress.ariaFor': '{label} 的进度',
      'progress.streaming': '输出中 · {size}',
      'row.expand': '展开输出',
      'row.collapse': '收起输出',
      'row.expandAria': '展开 {label} 的输出',
      'row.collapseAria': '收起 {label} 的输出',
      'row.stop': '停止任务 {label}',
      'row.stop.confirm': '再次点击确认停止',
      'row.stop.action': '确认停止',
      'row.stop.pending': '正在停止',
      'row.stop.failed': '停止失败',
      'output.aria': '任务输出',
      'output.gap': '……较早的输出已丢弃……',
      'output.error': '实时输出流中断：{error}',
      'output.empty': '（暂无输出）',
    }

    /** English copy, key-identical to the Chinese source of truth. */
    const en = {
      'panel.aria': 'Background task progress',
      'title': 'Background tasks',
      'header.summary': '{total} total · {running} running · {done} finished',
      'header.expandAria': 'Expand background task panel',
      'header.collapseAria': 'Collapse background task panel',
      'list.aria': 'Background task list',
      'status.running': 'running',
      'status.stopping': 'stopping',
      'status.completed': 'completed',
      'status.killed': 'cancelled',
      'status.failed': 'failed',
      'duration.live': 'Running for {duration}',
      'duration.done': 'Took {duration}',
      'bytes.title': 'Output so far {size}',
      'progress.aria': 'Task progress',
      'progress.ariaFor': 'Progress of {label}',
      'progress.streaming': 'streaming · {size}',
      'row.expand': 'Show output',
      'row.collapse': 'Hide output',
      'row.expandAria': 'Show output of {label}',
      'row.collapseAria': 'Hide output of {label}',
      'row.stop': 'Stop task {label}',
      'row.stop.confirm': 'Click again to confirm stop',
      'row.stop.action': 'Confirm stop',
      'row.stop.pending': 'Stopping',
      'row.stop.failed': 'Stop failed',
      'output.aria': 'Task output',
      'output.gap': '… earlier output dropped …',
      'output.error': 'live output stream interrupted: {error}',
      'output.empty': '(no output)',
    }

    // ------------------------------------------------------------------
    // Job predicates and formatting
    // ------------------------------------------------------------------

    /** @param {object} job @returns {boolean} true while the job is live. */
    function isLive(job) {
      return job.status === 'running' || job.status === 'stopping'
    }

    /** @param {object} job @returns {boolean} true when an output panel would have data. */
    function isObservable(job) {
      return isLive(job) || (Number.isFinite(job.output.total) && job.output.total > 0)
    }

    /**
     * Localized lifecycle label.
     * @param {string} status wire status.
     * @param {Function} t namespace translator.
     * @returns {string} label, falling back to the raw status.
     */
    function statusLabel(status, t) {
      switch (status) {
        case 'running': return t('status.running')
        case 'stopping': return t('status.stopping')
        case 'completed': return t('status.completed')
        case 'killed': return t('status.killed')
        case 'failed': return t('status.failed')
        default: return String(status)
      }
    }

    /**
     * Elapsed time in `m:ss` / `h:mm:ss` (at most two adjacent units).
     * @param {number} ms elapsed milliseconds.
     * @returns {string} compact duration.
     */
    function formatDuration(ms) {
      const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
      const seconds = total % 60
      const minutes = Math.floor(total / 60) % 60
      const hours = Math.floor(total / 3600)
      const ss = String(seconds).padStart(2, '0')
      if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
      return `${minutes}:${ss}`
    }

    /**
     * Byte count with a compact binary-prefix unit.
     * @param {number} bytes raw byte count.
     * @returns {string} e.g. `0 B`, `12.4 KB`, `3.1 MB`.
     */
    function formatBytes(bytes) {
      const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
      if (value < 1024) return `${Math.round(value)} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
      if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
      return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
    }

    /** @param {string} label full producer label @returns {string} its first non-empty line. */
    function firstLine(label) {
      const text = String(label === undefined || label === null ? '' : label)
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed !== '') return trimmed
      }
      return text.trim()
    }

    /** @param {string} text @returns {string} text clipped to the progress-line budget. */
    function truncate(text) {
      return text.length > PROGRESS_LINE_MAX ? `${text.slice(0, PROGRESS_LINE_MAX)}…` : text
    }

    // A progress figure never starts in the middle of another number: `150%`
    // and the date `2024/11` must not be read as `50%` or `4/11`.
    const PERCENT_RE = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/g
    const FRACTION_RE = /(?<![\d.])(\d{1,6})\s*(?:[/⁄]|\bof\b)\s*(\d{1,6})(?![\d])/g

    /** @param {string} text @returns {{index:number,percent:number}|null} last valid `n%`. */
    function lastPercent(text) {
      PERCENT_RE.lastIndex = 0
      let best = null
      let match
      while ((match = PERCENT_RE.exec(text)) !== null) {
        const value = Number(match[1])
        if (Number.isFinite(value) && value >= 0 && value <= 100) {
          best = { index: match.index, percent: value }
        }
      }
      return best
    }

    /** @param {string} text @returns {{index:number,percent:number}|null} last valid `a/b` or `a of b`. */
    function lastFraction(text) {
      FRACTION_RE.lastIndex = 0
      let best = null
      let match
      while ((match = FRACTION_RE.exec(text)) !== null) {
        const done = Number(match[1])
        const total = Number(match[2])
        // A progress fraction never exceeds its total; `2024/11` is a date, not progress.
        if (Number.isFinite(done) && Number.isFinite(total) && total > 0 && done <= total) {
          best = { index: match.index, percent: Math.max(0, Math.min(100, (done / total) * 100)) }
        }
      }
      return best
    }

    /**
     * Last progress figure in one text, preferring whichever match appears later.
     * @param {string} text candidate text.
     * @returns {{index:number,percent:number}|null} parsed figure.
     */
    function matchProgress(text) {
      if (typeof text !== 'string' || text === '') return null
      const percent = lastPercent(text)
      const fraction = lastFraction(text)
      if (percent === null && fraction === null) return null
      if (percent !== null && fraction !== null) return percent.index >= fraction.index ? percent : fraction
      return percent === null ? fraction : percent
    }

    /**
     * Progress figure for one row: the producer's `progress` line wins; otherwise
     * the observation tail is scanned.
     * @param {object} job roster row.
     * @param {object|undefined} view observed output.
     * @returns {{index:number,percent:number}|null} parsed figure.
     */
    function resolveProgress(job, view) {
      if (typeof job.progress === 'string' && job.progress.trim() !== '') {
        const fromJob = matchProgress(job.progress)
        if (fromJob !== null) return fromJob
      }
      if (view === undefined || typeof view.text !== 'string' || view.text === '') return null
      const tail = view.text.length > PARSE_TAIL ? view.text.slice(-PARSE_TAIL) : view.text
      return matchProgress(tail)
    }

    /**
     * The one-line progress description: the producer's own line when present,
     * otherwise the latest non-empty output line.
     * @param {object} job roster row.
     * @param {object|undefined} view observed output.
     * @returns {string} display line, possibly empty.
     */
    function progressLine(job, view) {
      if (typeof job.progress === 'string' && job.progress.trim() !== '') {
        return truncate(job.progress.trim())
      }
      if (view === undefined || typeof view.text !== 'string' || view.text === '') return ''
      const tail = view.text.length > PARSE_TAIL ? view.text.slice(-PARSE_TAIL) : view.text
      const lines = tail.split(/\r?\n/)
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index].replace(/\s+$/, '').replace(/^\s+/, '')
        if (line !== '') return truncate(line)
      }
      return ''
    }

    /** @returns {boolean} the persisted collapse preference (default: expanded). */
    function readCollapsed() {
      try {
        return globalThis.localStorage !== undefined
          && globalThis.localStorage.getItem(STORAGE_KEY) === '1'
      } catch {
        return false
      }
    }

    /** @param {boolean} collapsed next state @returns {void} */
    function writeCollapsed(collapsed) {
      try {
        if (globalThis.localStorage !== undefined) {
          globalThis.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
        }
      } catch {
        /* private mode or a blocked store: the in-memory state still works */
      }
    }

    /**
     * Live rows first in start order, then settled rows newest-first.
     * @param {readonly object[]} jobs roster rows.
     * @returns {object[]} display order.
     */
    function orderVisible(jobs) {
      return jobs.slice().sort((left, right) => {
        const liveLeft = isLive(left)
        if (liveLeft !== isLive(right)) return liveLeft ? -1 : 1
        if (liveLeft) return left.startedAt - right.startedAt
        return (right.finishedAt ?? right.startedAt) - (left.finishedAt ?? left.startedAt)
      })
    }

    // ------------------------------------------------------------------
    // Inline icons (no Client package imports)
    // ------------------------------------------------------------------

    function LeadIcon() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
      },
      h('rect', {
        x: 1.75, y: 2.75, width: 12.5, height: 10.5, rx: 2.25,
        stroke: 'currentColor', strokeWidth: 1.3,
      }),
      h('path', {
        d: 'M4.5 6.5h5M4.5 9.25h7',
        stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
      }))
    }

    function ChevronIcon(props) {
      const open = props.open === true
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
        style: { display: 'block', transform: open ? 'rotate(180deg)' : undefined },
      },
      h('path', {
        d: 'M4 6.5 8 10.5 12 6.5',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    function StopIcon() {
      return h('svg', {
        width: 10, height: 10, viewBox: '0 0 10 10', 'aria-hidden': true,
      }, h('rect', { x: 1.5, y: 1.5, width: 7, height: 7, rx: 1.5, fill: 'currentColor' }))
    }

    // ------------------------------------------------------------------
    // Components
    // ------------------------------------------------------------------

    /** @param {{percent:number|null, status:string, t:Function}} props bar inputs. */
    function ProgressBar(props) {
      const determinate = typeof props.percent === 'number' && Number.isFinite(props.percent)
      const value = determinate ? Math.max(0, Math.min(100, props.percent)) : 0
      return h('div', {
        className: 'dshbg-bar',
        role: 'progressbar',
        'aria-label': props.label === undefined
          ? props.t('progress.aria')
          : props.t('progress.ariaFor', { label: props.label }),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': determinate ? Math.round(value) : undefined,
        'aria-busy': determinate ? undefined : 'true',
        'data-status': props.status,
      },
      determinate
        ? h('div', { className: 'dshbg-barFill', style: { width: `${value}%` } })
        : h('div', { className: 'dshbg-barIndeterminate' }))
    }

    /**
     * One job row: identity, timing, output size, controls, and the progress zone.
     * @param {object} props row inputs and callbacks.
     */
    function JobRow(props) {
      const { job, view, expanded, now, killState, onToggle, onKill, t } = props
      const live = isLive(job)
      const observable = isObservable(job)
      const total = Number.isFinite(job.output.total) ? job.output.total : 0
      const elapsed = live
        ? now - job.startedAt
        : (job.finishedAt ?? now) - job.startedAt
      const duration = formatDuration(elapsed)
      const bytes = formatBytes(total)
      const percent = live ? resolveProgress(job, view) : null
      const line = live ? progressLine(job, view) : ''
      const label = firstLine(job.label)
      const ariaLabel = label === '' ? String(job.kind) : truncate(label)
      const status = statusLabel(job.status, t)

      const preRef = React.useRef(null)
      const followRef = React.useRef(true)

      React.useEffect(() => {
        if (expanded) followRef.current = true
      }, [expanded])

      React.useEffect(() => {
        if (!expanded) return
        const element = preRef.current
        if (element !== null && followRef.current) element.scrollTop = element.scrollHeight
      }, [expanded, view === undefined ? '' : view.text])

      const onOutputScroll = () => {
        const element = preRef.current
        if (element === null) return
        followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK_PX
      }

      let stopTitle = t('row.stop', { label: ariaLabel })
      if (killState === 'armed') stopTitle = t('row.stop.confirm')
      else if (killState === 'pending') stopTitle = t('row.stop.pending')
      else if (killState === 'failed') stopTitle = t('row.stop.failed')

      const stopButton = live && job.status === 'running'
        ? h('button', {
          type: 'button',
          className: killState === 'armed' ? 'dshbg-iconBtn dshbg-stop dshbg-stopArmed' : 'dshbg-iconBtn dshbg-stop',
          'data-kill-state': killState,
          'aria-label': stopTitle,
          title: stopTitle,
          disabled: killState === 'pending',
          onClick: () => { onKill(job) },
        },
        h(StopIcon),
        killState === 'armed'
          ? h('span', { className: 'dshbg-stopText' }, t('row.stop.action'))
          : killState === 'failed'
            ? h('span', { className: 'dshbg-stopText' }, t('row.stop.failed'))
            : null)
        : null

      const expandButton = observable
        ? h('button', {
          type: 'button',
          className: 'dshbg-iconBtn',
          'aria-expanded': expanded,
          'aria-label': expanded
            ? t('row.collapseAria', { label: ariaLabel })
            : t('row.expandAria', { label: ariaLabel }),
          title: expanded ? t('row.collapse') : t('row.expand'),
          onClick: onToggle,
        }, h(ChevronIcon, { open: expanded }))
        : null

      const identity = [
        h('span', {
          key: 'dot',
          className: 'dshbg-dot',
          'data-status': job.status,
          role: 'img',
          'aria-label': status,
        }),
        h('span', { key: 'kind', className: 'dshbg-kind', title: String(job.kind) }, String(job.kind)),
        h('span', { key: 'label', className: 'dshbg-label', title: String(job.label) }, label),
      ]

      const metrics = live
        ? [
          h('span', {
            key: 'duration',
            className: 'dshbg-metric',
            title: t('duration.live', { duration }),
          }, duration),
          h('span', {
            key: 'bytes',
            className: 'dshbg-metric',
            title: t('bytes.title', { size: bytes }),
          }, bytes),
        ]
        : [
          h('span', {
            key: 'status',
            className: 'dshbg-settledText',
            'data-status': job.status,
            title: job.detail === undefined ? status : `${status} · ${job.detail}`,
          }, job.detail === undefined || job.detail === '' ? status : `${status} · ${job.detail}`),
          h('span', {
            key: 'duration',
            className: 'dshbg-metric',
            title: t('duration.done', { duration }),
          }, duration),
          h('span', {
            key: 'bytes',
            className: 'dshbg-metric',
            title: t('bytes.title', { size: bytes }),
          }, bytes),
        ]

      const progressZone = live
        ? h('div', { className: 'dshbg-progressZone' },
          h('div', { className: 'dshbg-progress' },
            h(ProgressBar, {
              percent: percent === null ? null : percent.percent,
              status: job.status,
              label: ariaLabel,
              t,
            }),
            job.status === 'stopping'
              ? h('span', { className: 'dshbg-streaming dshbg-stopping' }, t('status.stopping'))
              : percent === null
                ? h('span', { className: 'dshbg-streaming' }, t('progress.streaming', { size: bytes }))
                : h('span', { className: 'dshbg-pct' }, `${Math.round(percent.percent)}%`)),
          line === ''
            ? null
            : h('div', { className: 'dshbg-progressLine', title: line }, line))
        : null

      const outputPanel = expanded && observable
        ? h('div', { className: 'dshbg-output' },
          view !== undefined && view.gapBefore === true
            ? h('div', { className: 'dshbg-notice' }, t('output.gap'))
            : null,
          view !== undefined && view.error !== undefined
            ? h('div', { className: 'dshbg-noticeError' }, t('output.error', { error: view.error }))
            : null,
          h('pre', {
            ref: preRef,
            className: 'dshbg-pre',
            tabIndex: 0,
            onScroll: onOutputScroll,
            'aria-label': t('output.aria'),
          }, view === undefined || typeof view.text !== 'string' || view.text === ''
            ? t('output.empty')
            : view.text))
        : null

      return h('li', { className: 'dshbg-row', 'data-status': job.status },
        h('div', { className: 'dshbg-rowTop' },
          identity,
          metrics,
          expandButton,
          stopButton),
        progressZone,
        outputPanel)
    }

    /**
     * The dock entry. Mounting it keeps this session's roster stream open; rows
     * worth watching are observed automatically, and every stream is released
     * when its row leaves or the panel unmounts.
     * @param {object} props slot runtime, injected jobs controls, and translator.
     */
    function Monitor(props) {
      const { sessionId, useJobs, watchRows, observe, killJob, t } = props
      const rows = useJobs(state => state.rows[sessionId]) ?? NO_JOBS
      const observed = useJobs(state => state.observed)

      const [now, setNow] = React.useState(() => Date.now())
      const [collapsed, setCollapsed] = React.useState(readCollapsed)
      const [expandedId, setExpandedId] = React.useState(null)
      const [kill, setKill] = React.useState(null)
      const observersRef = React.useRef(new Map())

      // The roster follows the mounted session; release on unmount or switch.
      React.useEffect(() => {
        if (sessionId === undefined) return undefined
        return watchRows(sessionId)
      }, [sessionId, watchRows])

      // A one-second clock drives elapsed time, the settle grace, and row expiry.
      // Rows worth watching: live past the grace, or settled with output inside the grace.
      const visible = []
      for (const job of rows) {
        if (isLive(job)) {
          if (now - job.startedAt >= LIVE_GRACE_MS) visible.push(job)
          continue
        }
        const finishedAt = job.finishedAt
        if (finishedAt !== undefined
          && now - finishedAt <= SETTLED_GRACE_MS
          && Number.isFinite(job.output.total)
          && job.output.total > 0) {
          visible.push(job)
        }
      }
      const ordered = orderVisible(visible)
      const visibleKey = ordered.map(job => String(job.id)).join('|')

      // The clock runs only while a row can still change: a live job (including one
      // still inside its 1.5s grace) or a settled row inside its 30s grace. Old
      // settlement records stay in the roster, so gating on rows.length would keep
      // ticking forever after every visible row expired.
      const needsClock = rows.some((job) => {
        if (isLive(job)) return true
        return job.finishedAt !== undefined
          && now - job.finishedAt <= SETTLED_GRACE_MS
          && Number.isFinite(job.output.total)
          && job.output.total > 0
      })

      React.useEffect(() => {
        if (!needsClock) return undefined
        setNow(Date.now())
        const timer = setInterval(() => { setNow(Date.now()) }, 1000)
        return () => { clearInterval(timer) }
      }, [needsClock])

      // Automatic observation: the first four live rows plus two recently settled
      // rows, plus any visible row the reader explicitly expanded.
      const autoObserved = []
      let liveCount = 0
      let settledCount = 0
      for (const job of ordered) {
        if (!isObservable(job)) continue
        if (isLive(job)) {
          if (liveCount < MAX_LIVE_OBSERVERS) {
            autoObserved.push(String(job.id))
            liveCount += 1
          }
        } else if (settledCount < MAX_SETTLED_OBSERVERS) {
          autoObserved.push(String(job.id))
          settledCount += 1
        }
      }
      if (expandedId !== null
        && ordered.some(job => String(job.id) === expandedId)
        && !autoObserved.includes(expandedId)) {
        autoObserved.push(expandedId)
      }
      const observeKey = autoObserved.join('|')

      // Reconcile observation streams against the desired set. Stops are held in
      // a ref so a grace expiry, an unmount, or a session switch releases them.
      React.useEffect(() => {
        if (sessionId === undefined) return
        const active = observersRef.current
        const desired = observeKey === '' ? [] : observeKey.split('|')
        for (const [id, stop] of active) {
          if (!desired.includes(id)) {
            stop()
            active.delete(id)
          }
        }
        for (const id of desired) {
          if (active.has(id)) continue
          try {
            active.set(id, observe(sessionId, id))
          } catch (error) {
            console.warn('dsh-jobs-progress: could not observe job', id, error)
          }
        }
      }, [sessionId, observe, observeKey])

      React.useEffect(() => () => {
        for (const stop of observersRef.current.values()) stop()
        observersRef.current.clear()
      }, [])

      // A row that left the visible list cannot stay expanded: clearing it also
      // releases its observation stream and its retained output.
      React.useEffect(() => {
        if (expandedId === null) return
        if (!visibleKey.split('|').includes(expandedId)) setExpandedId(null)
      }, [visibleKey, expandedId])

      // A stop control only describes a row that is still killable.
      React.useEffect(() => {
        if (kill === null) return
        if (!rows.some(job => String(job.id) === kill.id && job.status === 'running')) setKill(null)
      }, [rows, kill])

      // An armed kill disarms on a timer; a rejected one clears its hint.
      React.useEffect(() => {
        if (kill === null || kill.phase === 'pending') return undefined
        const delay = kill.phase === 'armed' ? KILL_ARM_MS : KILL_FAILED_MS
        const timer = setTimeout(() => {
          setKill(current => current !== null
            && current.id === kill.id
            && current.phase === kill.phase ? null : current)
        }, delay)
        return () => { clearTimeout(timer) }
      }, [kill])

      const toggleCollapsed = () => {
        const next = !collapsed
        setCollapsed(next)
        writeCollapsed(next)
      }

      const pressKill = (job) => {
        const id = String(job.id)
        if (kill === null || kill.id !== id || kill.phase !== 'armed') {
          setKill({ id, phase: 'armed' })
          return
        }
        setKill({ id, phase: 'pending' })
        Promise.resolve()
          .then(() => killJob(sessionId, id))
          .then((ok) => {
            if (!ok) {
              setKill(current => current !== null && current.id === id && current.phase === 'pending'
                ? { id, phase: 'failed' }
                : current)
            }
          })
          .catch((error) => {
            console.warn('dsh-jobs-progress: stop request failed', error)
            setKill(current => current !== null && current.id === id ? { id, phase: 'failed' } : current)
          })
      }

      if (sessionId === undefined || ordered.length === 0) return null

      const runningCount = ordered.filter(isLive).length
      const doneCount = ordered.length - runningCount
      const summary = t('header.summary', {
        total: ordered.length,
        running: runningCount,
        done: doneCount,
      })

      return h('section', {
        className: 'dshbg-root',
        'data-jobs-progress': '',
        'aria-label': t('panel.aria'),
      },
      h('style', null, CSS_TEXT),
      h('button', {
        type: 'button',
        className: 'dshbg-header',
        'aria-expanded': !collapsed,
        title: collapsed ? t('header.expandAria') : t('header.collapseAria'),
        onClick: toggleCollapsed,
      },
      h('span', { className: 'dshbg-lead' }, h(LeadIcon)),
      h('span', { className: 'dshbg-title' }, t('title')),
      h('span', { className: 'dshbg-summary' }, summary),
      h('span', { className: 'dshbg-chevron' }, h(ChevronIcon, { open: collapsed }))),
      collapsed
        ? null
        : h('ul', { className: 'dshbg-list', 'aria-label': t('list.aria') },
          ordered.map(job => h(JobRow, {
            key: String(job.id),
            job,
            view: observed[String(job.id)],
            expanded: expandedId === String(job.id),
            now,
            killState: kill !== null && kill.id === String(job.id) ? kill.phase : 'idle',
            onToggle: () => {
              setExpandedId(current => current === String(job.id) ? null : String(job.id))
            },
            onKill: pressKill,
            t,
          }))))
    }

    // ------------------------------------------------------------------
    // Scoped stylesheet: unique prefix, theme tokens only, motion opt-in
    // ------------------------------------------------------------------

    const CSS_TEXT = `
.dshbg-root {
  box-sizing: border-box;
  flex: none;
  overflow: hidden;
  margin: 0 auto;
  width: calc(
    100% -
    var(--dsh-composer-side-clearance) -
    var(--dsh-composer-side-clearance) -
    var(--dsh-composer-dock-inset) -
    var(--dsh-composer-dock-inset) -
    var(--dsh-composer-dock-inset) -
    var(--dsh-composer-dock-inset)
  );
  max-width: calc(
    var(--dsh-composer-card-max-width) -
    var(--dsh-composer-dock-inset) -
    var(--dsh-composer-dock-inset) -
    var(--dsh-composer-dock-inset) -
    var(--dsh-composer-dock-inset)
  );
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-specific-menu);
  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  box-shadow: var(--dsw-elevation-panel);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 13px;
}
.dshbg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.dshbg-header:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshbg-header:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}
.dshbg-lead {
  display: grid;
  flex: none;
  place-items: center;
  color: var(--dsw-alias-label-tertiary);
}
.dshbg-title {
  flex: none;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}
.dshbg-summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshbg-chevron {
  display: grid;
  flex: none;
  place-items: center;
  color: var(--dsw-alias-label-tertiary);
}
.dshbg-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0 8px 6px;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
}
.dshbg-row {
  padding: 6px 4px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dshbg-rowTop {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
}
.dshbg-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
.dshbg-dot[data-status=running] { background: var(--dsw-alias-state-success-primary); }
.dshbg-dot[data-status=stopping] { background: var(--dsw-alias-state-warn-primary); }
.dshbg-dot[data-status=completed] { background: var(--dsw-alias-state-success-primary); }
.dshbg-dot[data-status=killed] { background: var(--dsw-alias-state-warn-primary); }
.dshbg-dot[data-status=failed] { background: var(--dsw-alias-state-error-primary); }
.dshbg-kind {
  flex: none;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  line-height: 16px;
}
.dshbg-label {
  flex: 1 1 120px;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshbg-metric {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.dshbg-settledText {
  flex: 1 1 100px;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshbg-settledText[data-status=killed] { color: var(--dsw-alias-state-warn-primary); }
.dshbg-settledText[data-status=failed] { color: var(--dsw-alias-state-error-primary); }
.dshbg-iconBtn {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--dsw-radius-xs);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font: inherit;
}
.dshbg-iconBtn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dshbg-iconBtn:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
.dshbg-iconBtn:disabled { cursor: default; opacity: .65; }
.dshbg-stopArmed {
  background: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-state-error-primary);
}
.dshbg-iconBtn.dshbg-stopArmed:hover {
  background: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-state-error-primary);
}
.dshbg-iconBtn[data-kill-state=failed] {
  background: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-state-error-primary);
}
.dshbg-stopText {
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.dshbg-progressZone {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin-top: 4px;
  padding-left: 16px;
}
.dshbg-progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}
.dshbg-bar {
  position: relative;
  flex: 0 1 180px;
  min-width: 56px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2);
}
.dshbg-barFill {
  height: 100%;
  border-radius: 999px;
  background: var(--dsw-alias-state-success-primary);
  transition: width .3s var(--ds-ease-in-out, ease-in-out);
}
.dshbg-bar[data-status=stopping] .dshbg-barFill { background: var(--dsw-alias-state-warn-primary); }
.dshbg-barIndeterminate {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 38%;
  border-radius: 999px;
  background: var(--dsw-alias-state-business-primary);
  animation: dshbg-slide 1.4s var(--ds-ease-in-out, ease-in-out) infinite;
}
.dshbg-pct {
  flex: none;
  min-width: 36px;
  color: var(--dsw-alias-state-success-primary);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  line-height: 18px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.dshbg-streaming {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.dshbg-stopping { color: var(--dsw-alias-state-warn-primary); }
.dshbg-progressLine {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshbg-output {
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-2);
}
.dshbg-pre {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.dshbg-pre:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.dshbg-notice {
  margin: 0 0 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
}
.dshbg-noticeError {
  margin: 0 0 6px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 18px;
  word-break: break-word;
}
@keyframes dshbg-slide {
  from { transform: translateX(-120%); }
  to { transform: translateX(320%); }
}
@media (prefers-reduced-motion: no-preference) {
  .dshbg-dot[data-status=running] { animation: dshbg-breathe 2s var(--ds-ease-in-out, ease-in-out) infinite; }
  @keyframes dshbg-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: .45; }
  }
}
@media (prefers-reduced-motion: reduce) {
  .dshbg-barIndeterminate {
    width: 100%;
    transform: none;
    opacity: .5;
    animation: dshbg-pulse 1.6s ease-in-out infinite;
  }
  .dshbg-barFill { transition: none; }
  @keyframes dshbg-pulse {
    0%, 100% { opacity: .25; }
    50% { opacity: .6; }
  }
}
`

    // ------------------------------------------------------------------
    // Client plugin
    // ------------------------------------------------------------------

    return {
      inject: ['jobs', 'slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en }),
          'jobs-progress: dictionaries',
        )
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'background-jobs-monitor',
          // Between the goal dock (10) and the queue dock (20): the queue tucks
          // under the composer card with a negative bottom margin, so this panel
          // must stay above it rather than break that attached seam.
          order: 15,
          locale: NS,
          inject: () => ({
            hooks: { jobs: ctx.jobs.state },
            watchRows: sessionId => ctx.jobs.watchRows(sessionId),
            observe: (sessionId, jobId) => ctx.jobs.observe(sessionId, jobId),
            killJob: async (sessionId, jobId) => (await ctx.jobs.kill(sessionId, jobId)).ok,
          }),
        }, Monitor))
      },
      // Pure helpers for the repository's unit tests. The page module loader
      // ignores unknown exports; nothing in the running UI reads this.
      __test: {
        matchProgress,
        resolveProgress,
        progressLine,
        formatDuration,
        formatBytes,
        dicts: { zh, en },
      },
    }
  },
})
