import assert from 'node:assert/strict'
import test from 'node:test'

// The browser module loader is the only global client.js expects at import
// time. Capture the factory, then give it a React stub: these tests exercise
// the pure helpers and the slot wiring, never component rendering.
let definition
globalThis.window = {
  __ModuleLoader__: {
    load(candidate) {
      definition = candidate
    },
  },
}
await import('../client.js')

assert.ok(definition, 'client.js must register a module with the page loader')
assert.equal(definition.id, 'dsh-jobs-progress')

const ReactStub = {
  createElement() {},
  useRef() {},
  useEffect() {},
  useState() {},
}
const plugin = definition.factory(() => ReactStub)
const helpers = plugin.__test

test('exports the slot plugin contract', () => {
  assert.deepEqual(plugin.inject, ['jobs', 'slots', 'locale'])
  assert.equal(typeof plugin.apply, 'function')
})

test('parses the last percentage in a line', () => {
  assert.equal(helpers.matchProgress('50%').percent, 50)
  assert.equal(helpers.matchProgress('12.5% done').percent, 12.5)
  assert.equal(helpers.matchProgress('100%').percent, 100)
  assert.equal(helpers.matchProgress('[7/9] 78%').percent, 78)
})

test('parses fractions and picks the last valid figure', () => {
  assert.equal(helpers.matchProgress('[7/9] working').percent, (7 / 9) * 100)
  assert.equal(helpers.matchProgress('3 of 10').percent, 30)
  assert.equal(helpers.matchProgress('1/10, then 9/10').percent, 90)
  assert.equal(helpers.matchProgress('step 7⁄9').percent, (7 / 9) * 100)
  assert.equal(helpers.matchProgress('42%')?.percent, 42)
})

test('rejects numbers that only look like progress', () => {
  assert.equal(helpers.matchProgress('2024/11 20:16'), null)
  assert.equal(helpers.matchProgress('150%'), null)
  assert.equal(helpers.matchProgress('12/0'), null)
  assert.equal(helpers.matchProgress('12.4 KB'), null)
  assert.equal(helpers.matchProgress('no progress here'), null)
  assert.equal(helpers.matchProgress(''), null)
})

test('resolves progress from the producer line before the output tail', () => {
  assert.equal(helpers.resolveProgress({ progress: '3/10' }, undefined).percent, 30)
  assert.equal(
    helpers.resolveProgress({}, { text: '[2/4] 50% working' }).percent,
    50,
  )
  assert.equal(
    helpers.resolveProgress({ progress: 'starting' }, { text: '4/8' }).percent,
    50,
  )
})

test('builds the one-line progress description', () => {
  assert.equal(helpers.progressLine({ progress: '  phase 2  ' }, undefined), 'phase 2')
  assert.equal(
    helpers.progressLine({}, { text: 'first\n\n  last line  \n' }),
    'last line',
  )
  assert.equal(helpers.progressLine({}, { text: '' }), '')
})

test('formats durations and byte counts', () => {
  assert.equal(helpers.formatDuration(0), '0:00')
  assert.equal(helpers.formatDuration(1_000), '0:01')
  assert.equal(helpers.formatDuration(61_000), '1:01')
  assert.equal(helpers.formatDuration(3_600_000), '1:00:00')
  assert.equal(helpers.formatDuration(3_725_000), '1:02:05')

  assert.equal(helpers.formatBytes(0), '0 B')
  assert.equal(helpers.formatBytes(1_023), '1023 B')
  assert.equal(helpers.formatBytes(1_024), '1.0 KB')
  assert.equal(helpers.formatBytes(12_697), '12.4 KB')
  assert.equal(helpers.formatBytes(1_048_576), '1.0 MB')
  assert.equal(helpers.formatBytes(1_073_741_824), '1.00 GB')
})

test('keeps the Chinese and English dictionaries key-identical', () => {
  const zhKeys = Object.keys(helpers.dicts.zh).sort()
  const enKeys = Object.keys(helpers.dicts.en).sort()
  assert.deepEqual(zhKeys, enKeys)
  assert.equal(zhKeys.length, 30)
})

test('registers the dock, dictionaries, and injected job controls', async () => {
  const calls = []
  const fakeJobs = {
    state: {
      getSnapshot: () => ({ rows: {}, observed: {} }),
      subscribe: () => () => {},
    },
    watchRows: () => () => {},
    observe: () => () => {},
    kill: async () => ({ ok: true }),
  }
  const ctx = {
    jobs: fakeJobs,
    locale: {
      register(ns, dicts) {
        calls.push({ kind: 'locale', ns, dicts })
        return () => {}
      },
    },
    slots: {
      inject(slot, callback) {
        assert.equal(slot, 'conversation.input.dock')
        callback()
        return () => {}
      },
      register(options, component) {
        calls.push({ kind: 'slot', options, component })
        return () => {}
      },
    },
    effect(factory) {
      const dispose = factory()
      return typeof dispose === 'function' ? dispose : () => {}
    },
  }

  plugin.apply(ctx)

  const localeCall = calls.find(entry => entry.kind === 'locale')
  assert.equal(localeCall.ns, 'background-monitor')
  assert.ok(localeCall.dicts.zh)
  assert.ok(localeCall.dicts.en)

  const slotCall = calls.find(entry => entry.kind === 'slot')
  assert.equal(slotCall.options.name, 'conversation.input.dock')
  assert.equal(slotCall.options.id, 'background-jobs-monitor')
  assert.equal(slotCall.options.order, 15)
  assert.equal(slotCall.options.locale, 'background-monitor')
  assert.equal(typeof slotCall.component, 'function')

  const face = slotCall.options.inject()
  assert.equal(face.hooks.jobs, fakeJobs.state)
  assert.equal(typeof face.watchRows, 'function')
  assert.equal(typeof face.observe, 'function')
  assert.equal(typeof face.killJob, 'function')
  assert.equal(await face.killJob('session-1', 'job-1'), true)
})
