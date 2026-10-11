'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createHash } = require('node:crypto')

const projectRoot = path.resolve(__dirname, '..')
const sourcePath = path.join(projectRoot, 'src/renderer/src/lib/gemini.ts')
const ts = require(path.join(projectRoot, 'node_modules/typescript'))
// Read once: concurrent application edits must not change the source halfway through a run.
const source = fs.readFileSync(sourcePath, 'utf8')
const sourceHash = createHash('sha256').update(source).digest('hex')
const compiled = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText

const PRIMARY = 'offline-primary'
const BACKUP = 'offline-backup'
const REQUIRED = ['index', 'category', 'ai_headline', 'what_is_it', 'why_it_matters', 'software_impact', 'importance_score']
const CATEGORIES = ['new_model', 'new_paper', 'model_update', 'tool_library', 'news']
const plain = (value) => JSON.parse(JSON.stringify(value))

class MockHeaders {
  constructor(headers = {}) {
    this.values = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)]))
  }
  get(name) { return this.values.get(name.toLowerCase()) ?? null }
}

class MockResponse {
  constructor(body = '', { status = 200, headers = {} } = {}) {
    this.body = String(body)
    this.status = status
    this.ok = status >= 200 && status < 300
    this.headers = new MockHeaders(headers)
  }
  async text() { return this.body }
  async json() { return JSON.parse(this.body) }
  static json(value, init) { return new MockResponse(JSON.stringify(value), init) }
}

function listed(names) {
  return MockResponse.json({
    models: names.map((name) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] }))
  })
}

function generated(entries, finishReason = 'STOP') {
  return generatedText(JSON.stringify(entries), finishReason)
}

function generatedText(text, finishReason = 'STOP') {
  return MockResponse.json({ candidates: [{ finishReason, content: { parts: [{ text }] } }] })
}

function apiError(status, details = [], headers = {}) {
  return MockResponse.json({ error: { code: status, message: `Offline HTTP ${status}`, details } }, { status, headers })
}

function inputs(count) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Source story ${i}`,
    snippet: `Source evidence ${i}: this test fixture describes a software library and its documented behavior.`,
    url: `https://example.invalid/story/${i}`,
    query: 'Offline software fixtures'
  }))
}

function story(index, label = `Story ${index}`, overrides = {}) {
  return {
    index,
    category: 'tool_library',
    ai_headline: `${label} analysis headline`,
    what_is_it: `${label} explains the documented software behavior in the supplied source. This fixture contains a complete analysis long enough for validation.`,
    why_it_matters: `${label} documents a concrete change relevant to developers.`,
    software_impact: `${label} affects how developers integrate the documented library.`,
    importance_score: 72,
    ...overrides
  }
}

function storiesFor(request) {
  return request.sources.map((item) => story(item.index, item.title))
}

function assertPending(item, input) {
  assert.equal(item.summary_status, 'pending')
  assert.equal(item.ai_headline, input.title)
  assert.equal(item.ai_headline_en, input.title)
  assert.equal(item.ai_summary_en, input.snippet)
  assert.equal(item.importance_score, 0)
  for (const field of ['ai_summary', 'ai_takeaway', 'what_is_it', 'why_it_matters', 'software_impact', 'ai_takeaway_en']) {
    assert.equal(item[field], '', `${field} must not contain fabricated AI prose`)
  }
  assert.equal(typeof item.summary_error, 'string')
  assert.ok(item.summary_error.length > 0)
  assert.equal(item.summary_model, undefined)
}

function loadGemini(handler) {
  let now = Date.UTC(2030, 0, 1)
  let timerId = 0
  let cryptoCounter = 0
  const calls = []
  const timers = []
  const timeouts = []
  const violations = []
  const cancelled = new Set()
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const fakeMath = Object.create(Math)
  fakeMath.random = () => 0
  const exports = {}
  const sandbox = {
    exports,
    module: { exports },
    require(name) { throw new Error(`Unexpected runtime import: ${name}`) },
    URL,
    TextEncoder,
    TextDecoder,
    Response: MockResponse,
    Headers: MockHeaders,
    Date: FakeDate,
    Math: fakeMath,
    AbortSignal: {
      timeout(ms) {
        timeouts.push(ms)
        return Object.freeze({ aborted: false, offlineTimeoutMs: ms })
      }
    },
    crypto: {
      randomUUID() {
        return `00000000-0000-4000-8000-${String(++cryptoCounter).padStart(12, '0')}`
      },
      getRandomValues(array) {
        for (let i = 0; i < array.length; i++) array[i] = (++cryptoCounter) % 256
        return array
      }
    },
    setTimeout(callback, delay = 0, ...args) {
      const ms = Number(delay)
      assert.ok(Number.isFinite(ms) && ms >= 0, 'Timer delays must be finite and nonnegative')
      assert.ok(timers.length < 500, 'Unexpected unbounded timer loop')
      const id = ++timerId
      timers.push(ms)
      queueMicrotask(() => {
        if (!cancelled.has(id)) {
          now += ms
          callback(...args)
        }
      })
      return id
    },
    clearTimeout(id) { cancelled.add(id) },
    setInterval() { throw new Error('Real or repeated timers are not supported by the offline harness') },
    clearInterval() {},
    async fetch(url, init = {}) {
      try {
        assert.ok(calls.length < 200, 'Unexpected unbounded API retry loop')
        const parsed = new URL(String(url))
        assert.equal(parsed.origin, 'https://generativelanguage.googleapis.com')
        assert.equal(parsed.searchParams.has('key'), false, 'Credentials must not appear in query strings')
        const headers = new MockHeaders(init.headers)
        const key = headers.get('x-goog-api-key')
        assert.ok([PRIMARY, BACKUP].includes(key), 'Only offline fixture credentials are accepted')
        assert.equal(String(url).includes(key), false)
        const generation = parsed.pathname.endsWith(':generateContent')
        const body = init.body ? JSON.parse(init.body) : undefined
        const request = {
          url: String(url), key, body, at: now, signal: init.signal,
          kind: generation ? 'generate' : 'list',
          model: generation ? decodeURIComponent(parsed.pathname.split('/').pop().replace(':generateContent', '')) : undefined,
          version: parsed.pathname.split('/')[1]
        }
        calls.push(request)
        if (generation) {
          assert.equal(init.method, 'POST')
          assert.equal(headers.get('content-type'), 'application/json')
          const config = body.generationConfig
          assert.equal(config.responseMimeType, 'application/json')
          assert.equal(Object.hasOwn(config, 'maxOutputTokens'), false, 'Use the model default output limit')
          assert.equal(JSON.stringify(body).includes('"maxOutputTokens"'), false)
          const prompt = body.contents[0].parts[0].text
          // Use the final prompt line instead of Array/Map instanceof across VM realms.
          request.sources = JSON.parse(prompt.trim().split('\n').pop())
          assert.ok(Array.isArray(request.sources))
          assert.deepEqual(request.sources.map((item) => item.index), request.sources.map((_, i) => i + 1))
        } else {
          assert.match(parsed.pathname, /^\/v1(?:beta)?\/models$/)
          assert.equal(init.body, undefined)
        }
        const response = await handler(request)
        assert.ok(response && typeof response.text === 'function' && typeof response.json === 'function', 'Every API call must be explicitly mocked')
        return response
      } catch (error) {
        // Production wraps fetch failures; preserve mock assertion failures for the test as well.
        violations.push(error)
        throw error
      }
    }
  }
  const context = vm.createContext(sandbox)
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 })
  return {
    api: sandbox.module.exports,
    calls,
    timers,
    timeouts,
    generations: () => calls.filter((request) => request.kind === 'generate'),
    listings: () => calls.filter((request) => request.kind === 'list'),
    advance(ms) { assert.ok(ms >= 0); now += ms },
    assertClean() {
      assert.deepEqual(violations.map((error) => error.stack || String(error)), [], 'Offline mock contract was violated')
      assert.equal(timeouts.length, calls.length)
      assert.ok(timeouts.every((ms) => ms === 120000))
    }
  }
}

function checkpointCallbacks() {
  const saved = []
  const progress = []
  return {
    saved,
    progress,
    callbacks: {
      onItem(item) { saved.push(plain(item)) },
      onProgress(completed, total) { progress.push([completed, total]) }
    }
  }
}

test('source snapshot and public exports load without imports, network, or real timers', (t) => {
  t.diagnostic(`gemini.ts SHA-256: ${sourceHash}; TypeScript ${ts.version}; all API responses are mocks`)
  const harness = loadGemini(() => { throw new Error('No API calls expected') })
  for (const name of ['GeminiError', 'classifyGeminiError', 'extractJsonEntries', 'detectCategoryFromContent', 'hasCompleteSummary', 'analyzeAndCategorizeBatchWithGemini', 'summarizeSingleStoryWithGemini', 'summarizeItemWithGemini']) {
    assert.equal(typeof harness.api[name], 'function', `${name} must remain public`)
  }
  const error = new harness.api.GeminiError('SERVER', 'Offline failure', 503, 1234)
  assert.equal(error.name, 'GeminiError')
  assert.equal(error.kind, 'SERVER')
  assert.equal(error.status, 503)
  assert.equal(error.retryAfterMs, 1234)
  harness.assertClean()
})

test('classifyGeminiError distinguishes SERVER, per-minute QuotaFailure, and daily quota', () => {
  const { api } = loadGemini(() => { throw new Error('No API calls expected') })
  assert.equal(api.classifyGeminiError(503, '{"error":{"status":"UNAVAILABLE"}}'), 'SERVER')
  for (const marker of ['GenerateRequestsPerMinutePerProjectPerModel-FreeTier', 'requests_per_minute', 'tokens per minute']) {
    const body = JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: marker }] }] } })
    assert.equal(api.classifyGeminiError(429, body), 'RATE_LIMIT', marker)
  }
  for (const marker of ['GenerateRequestsPerDayPerProjectPerModel-FreeTier', 'requests_per_day', 'PER_DAY', 'requests per day']) {
    assert.equal(api.classifyGeminiError(429, JSON.stringify({ quotaId: marker })), 'QUOTA', marker)
  }
  assert.equal(api.classifyGeminiError(429, 'QuotaFailure without a daily marker'), 'RATE_LIMIT')
  assert.equal(api.classifyGeminiError(404, ''), 'BAD_MODEL')
  assert.equal(api.classifyGeminiError(403, ''), 'FATAL')
})

test('extractJsonEntries preserves complete truncated objects, escaped quotes, braces, and backslashes', () => {
  const { api } = loadGemini(() => { throw new Error('No API calls expected') })
  const first = { index: 1, text: 'A literal } and {, a quote " and escaped backslashes \\ remain unchanged.', nested: { note: '{not structure inside a string}' } }
  const second = { index: 2, text: 'The sequence \\"} must not end this object.' }
  const truncated = `[${JSON.stringify(first)},${JSON.stringify(second)},{"index":3,"text":"incomplete } { \\"`
  assert.deepEqual(plain(api.extractJsonEntries(truncated)), [first, second])
  assert.deepEqual(plain(api.extractJsonEntries(`\n\x60\x60\x60json\n${JSON.stringify([first, second])}\n\x60\x60\x60`)), [first, second])
  assert.deepEqual(plain(api.extractJsonEntries(JSON.stringify({ results: [first, second] }))), [first, second])
  assert.deepEqual(plain(api.extractJsonEntries(JSON.stringify(first))), [first])
  assert.deepEqual(plain(api.extractJsonEntries('[{"index":1,"text":"never closed }')), [])
  assert.deepEqual(plain(api.extractJsonEntries(`[${JSON.stringify(first)},{invalid json},${JSON.stringify(second)},`)), [first, second])
  assert.deepEqual(plain(api.extractJsonEntries('[{"text":"\\u007Bescaped braces\\u007D"},')), [{ text: '{escaped braces}' }])
})

test('empty batch returns no records and performs no API calls or callbacks', async () => {
  const harness = loadGemini(() => { throw new Error('No API calls expected') })
  const checkpoint = checkpointCallbacks()
  assert.deepEqual(plain(await harness.api.analyzeAndCategorizeBatchWithGemini([], PRIMARY, BACKUP, undefined, checkpoint.callbacks)), [])
  assert.deepEqual(checkpoint.saved, [])
  assert.deepEqual(checkpoint.progress, [])
  assert.equal(harness.calls.length, 0)
  harness.assertClean()
})

test('single-story public wrappers accept indexed JSON arrays and preserve source fields', async () => {
  const harness = loadGemini((request) => request.kind === 'list' ? listed(['gemini-offline-flash-1']) : generated(storiesFor(request)))
  const input = inputs(1)[0]
  const result = await harness.api.summarizeSingleStoryWithGemini({ ...input, query_label: input.query }, PRIMARY)
  assert.equal(result.summary_status, 'complete')
  assert.equal(result.summary_model, 'gemini-offline-flash-1')
  assert.equal(result.ai_summary, result.what_is_it)
  assert.equal(result.ai_takeaway, result.why_it_matters)
  assert.equal(result.ai_headline_en, input.title)
  assert.equal(result.ai_summary_en, input.snippet)
  assert.equal(await harness.api.summarizeItemWithGemini(input, PRIMARY), result.what_is_it)
  assert.equal(harness.listings().length, 1)
  assert.equal(harness.generations().length, 2)
  assert.ok(harness.generations()[1].at - harness.generations()[0].at >= 4500)
  assert.ok(harness.timers.includes(4500), 'The shared request gap must use virtual time')
  harness.assertClean()
})

test('model discovery caches separately per credential and expires after ten virtual minutes', async () => {
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed([request.key === PRIMARY ? 'gemini-primary-flash' : 'gemini-backup-flash'])
    assert.equal(request.model, request.key === PRIMARY ? 'gemini-primary-flash' : 'gemini-backup-flash')
    return generated(storiesFor(request))
  })
  const input = inputs(1)[0]
  for (const key of [PRIMARY, PRIMARY, BACKUP, BACKUP, PRIMARY]) {
    const result = await harness.api.summarizeSingleStoryWithGemini(input, key)
    assert.equal(result.summary_status, 'complete')
    assert.equal(result.summary_model, key === PRIMARY ? 'gemini-primary-flash' : 'gemini-backup-flash')
  }
  const listCount = (key) => harness.listings().filter((request) => request.key === key).length
  assert.equal(listCount(PRIMARY), 1, 'Repeated primary requests must reuse its discovery cache')
  assert.equal(listCount(BACKUP), 1, 'Backup discovery must use a separate cache')
  harness.advance(10 * 60 * 1000 + 1)
  for (const key of [PRIMARY, BACKUP]) {
    const result = await harness.api.summarizeSingleStoryWithGemini(input, key)
    assert.equal(result.summary_status, 'complete')
    assert.equal(result.summary_model, key === PRIMARY ? 'gemini-primary-flash' : 'gemini-backup-flash')
    assert.equal(listCount(key), 2, 'Expired models must be rediscovered for this credential')
    await harness.api.summarizeSingleStoryWithGemini(input, key)
    assert.equal(listCount(key), 2, 'Refreshed discovery must be cached again')
  }
  harness.assertClean()
})

// Check complete records without depending on request order or a particular retry budget.
function assertComplete(item, input, expected) {
  assert.equal(item.summary_status, 'complete')
  assert.equal(item.category, expected.category)
  for (const field of ['ai_headline', 'what_is_it', 'why_it_matters', 'software_impact', 'importance_score']) {
    assert.equal(item[field], expected[field], `${field} must preserve the validated response`)
  }
  assert.equal(item.ai_summary, expected.what_is_it)
  assert.equal(item.ai_takeaway, expected.why_it_matters)
  assert.equal(item.ai_headline_en, input.title)
  assert.equal(item.ai_summary_en, input.snippet)
  assert.equal(item.ai_takeaway_en, '')
  assert.equal(item.summary_error, undefined)
  assert.equal(typeof item.summary_model, 'string')
  assert.ok(item.summary_model.length > 0)
}

function assertCheckpoints(checkpoint, result) {
  assert.equal(checkpoint.saved.length, result.length, 'Each final record must be checkpointed exactly once')
  assert.deepEqual(checkpoint.saved.map((item) => item.id).sort((a, b) => a - b), plain(result.map((item) => item.id)))
  for (const item of result) {
    assert.deepEqual(checkpoint.saved.find((saved) => saved.id === item.id), plain(item))
  }
  assert.equal(checkpoint.progress.length, result.length)
  let previous = 0
  for (const [completed, total] of checkpoint.progress) {
    assert.equal(total, result.length)
    assert.ok(completed >= previous && completed <= previous + 1, 'Only complete summaries may advance progress')
    previous = completed
  }
  assert.equal(previous, result.filter((item) => item.summary_status === 'complete').length)
}

test('503 falls back to another discovered model without reusing the unavailable model', async (t) => {
  const models = ['gemini-offline-flash-2', 'gemini-offline-flash-1']
  let unavailable
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed(models)
    assert.ok(models.includes(request.model), 'Only discovered models may be generated with')
    if (!unavailable) {
      unavailable = request.model
      return apiError(503)
    }
    assert.notEqual(request.model, unavailable, 'A 503 should move to a different model, not just another key')
    return generated(storiesFor(request))
  })
  t.after(() => harness.assertClean())
  const input = inputs(1)[0]
  const result = await harness.api.summarizeSingleStoryWithGemini(input, PRIMARY, BACKUP)
  assertComplete(result, input, story(1, input.title))
  assert.ok(models.includes(result.summary_model))
  assert.notEqual(result.summary_model, unavailable)
  assert.equal(harness.generations().filter((request) => request.model === unavailable).length, 1)
  assert.ok(harness.generations().length >= 2)
  assert.ok(harness.generations().every((request) => request.key === PRIMARY), 'A healthy alternative on primary should avoid backup')
})

test('backup discovery and generation never inherit primary-only models or credentials', async (t) => {
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed([request.key === PRIMARY ? 'gemini-primary-only-flash' : 'gemini-backup-only-flash'])
    assert.equal(request.model, request.key === PRIMARY ? 'gemini-primary-only-flash' : 'gemini-backup-only-flash')
    return request.key === PRIMARY ? apiError(403) : generated(storiesFor(request))
  })
  t.after(() => harness.assertClean())
  const input = inputs(1)[0]
  const result = await harness.api.summarizeSingleStoryWithGemini(input, PRIMARY, BACKUP)
  assertComplete(result, input, story(1, input.title))
  assert.equal(result.summary_model, 'gemini-backup-only-flash')
  assert.deepEqual([...new Set(harness.listings().map((request) => request.key))].sort(), [BACKUP, PRIMARY].sort())
  assert.ok(harness.generations().some((request) => request.key === PRIMARY))
  assert.ok(harness.generations().some((request) => request.key === BACKUP))
})

test('a primary credential failure does not disable the same discovered model for backup', async (t) => {
  const model = 'gemini-shared-offline-flash'
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed([model])
    assert.equal(request.model, model)
    return request.key === PRIMARY ? apiError(403) : generated(storiesFor(request))
  })
  t.after(() => harness.assertClean())
  const input = inputs(1)[0]
  const result = await harness.api.summarizeSingleStoryWithGemini(input, PRIMARY, BACKUP)
  assertComplete(result, input, story(1, input.title))
  assert.equal(result.summary_model, model)
  assert.ok(harness.listings().some((request) => request.key === BACKUP))
  assert.ok(harness.generations().some((request) => request.key === BACKUP && request.model === model))
})

test('truncated batches preserve completed stories and retry only missing stories across later groups', async (t) => {
  const input = inputs(7)
  const checkpoint = checkpointCallbacks()
  const preserved = new Map([
    [0, story(1, 'Preserved first', { what_is_it: 'A quote " and literal braces { } and backslashes \\ survive a truncated response. The source analysis is complete and must never be regenerated.' })],
    [2, story(3, 'Preserved third')],
    [4, story(2, 'Preserved later group')]
  ])
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed(['gemini-offline-flash-1'])
    const titles = request.sources.map((item) => item.title)
    if (titles.length > 1) {
      if (titles.includes(input[0].title)) {
        assert.deepEqual(titles, input.slice(0, 3).map((item) => item.title))
        return generatedText(`[${JSON.stringify(preserved.get(2))},${JSON.stringify(preserved.get(0))},{"index":2,"what_is_it":"cut off`, 'MAX_TOKENS')
      }
      assert.deepEqual(titles, input.slice(3, 6).map((item) => item.title))
      assert.ok(checkpoint.saved.some((item) => item.id === 0), 'Earlier completed work must already be saved')
      return generatedText(`[${JSON.stringify(preserved.get(4))},{"index":3,"what_is_it":"cut off`, 'MAX_TOKENS')
    }
    const id = input.findIndex((item) => item.title === titles[0])
    assert.ok(id >= 0)
    assert.equal(preserved.has(id), false, 'Completed stories must never be sent for missing-only retry')
    for (const savedId of id < 3 ? [0, 2] : [0, 2, 4]) {
      assert.ok(checkpoint.saved.some((item) => item.id === savedId), 'Completed objects must be checkpointed before retry')
    }
    if (id === 3) return generatedText('', 'SAFETY')
    return generated(storiesFor(request))
  })
  t.after(() => harness.assertClean())
  const result = await harness.api.analyzeAndCategorizeBatchWithGemini(input, PRIMARY, undefined, undefined, checkpoint.callbacks)
  assert.deepEqual(plain(result.map((item) => item.id)), input.map((_, id) => id))
  for (let id = 0; id < input.length; id++) {
    if (id === 3) assertPending(result[id], input[id])
    else assertComplete(result[id], input[id], preserved.get(id) || story(1, input[id].title))
  }
  assert.ok(harness.generations().some((request) => request.sources.length === 1 && request.sources[0].title === input[6].title), 'A failure in one group must not stop the final group')
  assert.deepEqual(harness.generations().filter((request) => request.sources.length === 1).map((request) => request.sources[0].title).sort(), [1, 3, 5, 6].map((id) => input[id].title).sort())
  assertCheckpoints(checkpoint, result)
})

async function checkRejectedBatchEntry(t, entries) {
  const input = inputs(3)
  const checkpoint = checkpointCallbacks()
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed(['gemini-offline-flash-1'])
    if (request.sources.length > 1) {
      assert.equal(request.sources.length, 3)
      return generated([...entries, story(2, input[1].title), story(3, input[2].title)])
    }
    assert.equal(request.sources[0].title, input[0].title, 'Only the invalid or ambiguous index may be retried')
    assert.deepEqual(checkpoint.saved.map((item) => item.id).sort(), [1, 2], 'Valid neighbors must be saved before retry')
    return generated([story(1, 'Recovered rejected entry')])
  })
  t.after(() => harness.assertClean())
  const result = await harness.api.analyzeAndCategorizeBatchWithGemini(input, PRIMARY, undefined, undefined, checkpoint.callbacks)
  assertComplete(result[0], input[0], story(1, 'Recovered rejected entry'))
  for (const id of [1, 2]) assertComplete(result[id], input[id], story(id + 1, input[id].title))
  assert.equal(harness.generations().filter((request) => request.sources.length === 1).length, 1)
  assertCheckpoints(checkpoint, result)
}

test('duplicate indices are ambiguous even when one duplicate has an invalid category', async (t) => {
  const valid = story(1, 'Duplicate must not survive')
  const invalid = story(1, 'Invalid duplicate', { category: 'not_a_category' })
  for (const [name, entries] of [
    ['two valid duplicates', [valid, story(1, 'Conflicting duplicate')]],
    ['valid followed by invalid', [valid, invalid]],
    ['invalid followed by valid', [invalid, valid]]
  ]) {
    await t.test(name, (subtest) => checkRejectedBatchEntry(subtest, entries))
  }
})

test('invalid indices cannot be coerced, clamped, or matched by array position', async (t) => {
  const cases = [
    ['zero', 0], ['negative', -1], ['out of range', 4], ['fractional', 1.5],
    ['numeric string', '1'], ['null', null], ['boolean', true], ['object', {}], ['missing', undefined]
  ]
  for (const [name, index] of cases) {
    await t.test(name, (subtest) => checkRejectedBatchEntry(subtest, [story(index, 'Invalid index must not survive')]))
  }
})

test('invalid categories remain missing instead of silently defaulting to news', async (t) => {
  const cases = [
    ['unknown', 'other'], ['wrong case', 'TOOL_LIBRARY'], ['empty', ''], ['whitespace', ' news '],
    ['null', null], ['number', 1], ['array', ['news']], ['object', {}], ['missing', undefined]
  ]
  for (const [name, category] of cases) {
    await t.test(name, (subtest) => checkRejectedBatchEntry(subtest, [story(1, 'Invalid category must not survive', { category })]))
  }
})

test('all documented categories are accepted without relying on a request schema', async (t) => {
  const input = inputs(CATEGORIES.length)
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed(['gemini-offline-flash-1'])
    return generated(request.sources.map((item) => {
      const id = input.findIndex((source) => source.title === item.title)
      return story(item.index, item.title, { category: CATEGORIES[id] })
    }))
  })
  t.after(() => harness.assertClean())
  const result = await harness.api.analyzeAndCategorizeBatchWithGemini(input, PRIMARY)
  for (let id = 0; id < input.length; id++) {
    assert.equal(result[id].summary_status, 'complete')
    assert.equal(result[id].category, CATEGORIES[id])
  }
  assert.ok(harness.generations().every((request) => !Object.hasOwn(request.body.generationConfig, 'maxOutputTokens')))
})

test('generation uses the required JSON schema without explicit maxOutputTokens', async (t) => {
  const harness = loadGemini((request) => request.kind === 'list' ? listed(['gemini-offline-flash-1']) : generated(storiesFor(request)))
  t.after(() => harness.assertClean())
  const input = inputs(1)[0]
  const result = await harness.api.summarizeSingleStoryWithGemini(input, PRIMARY)
  assertComplete(result, input, story(1, input.title))
  const config = harness.generations()[0].body.generationConfig
  assert.equal(Object.hasOwn(config, 'maxOutputTokens'), false)
  assert.equal(config.responseMimeType, 'application/json')
  assert.equal(config.responseSchema.type, 'ARRAY')
  assert.equal(config.responseSchema.items.type, 'OBJECT')
  assert.deepEqual([...config.responseSchema.items.required].sort(), [...REQUIRED].sort())
  assert.deepEqual(config.responseSchema.items.properties.category.enum, CATEGORIES)
  assert.equal(config.responseSchema.items.properties.index.type, 'INTEGER')
})

test('exhausting both credentials leaves every story pending with empty AI analysis fields', async (t) => {
  for (const [name, status, details] of [
    ['fatal authentication failure', 403, []],
    ['daily quota exhaustion', 429, [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }]]
  ]) {
    await t.test(name, async (subtest) => {
      const input = inputs(7)
      const checkpoint = checkpointCallbacks()
      const harness = loadGemini((request) => request.kind === 'list'
        ? listed([request.key === PRIMARY ? 'gemini-primary-flash' : 'gemini-backup-flash'])
        : apiError(status, details))
      subtest.after(() => harness.assertClean())
      const result = await harness.api.analyzeAndCategorizeBatchWithGemini(input, PRIMARY, BACKUP, undefined, checkpoint.callbacks)
      assert.equal(result.length, input.length)
      assert.deepEqual(plain(result.map((item) => item.id)), input.map((_, id) => id))
      result.forEach((item, id) => assertPending(item, input[id]))
      assert.deepEqual([...new Set(harness.generations().map((request) => request.key))].sort(), [PRIMARY, BACKUP].sort(), 'Both credentials must be tried before giving up')
      assertCheckpoints(checkpoint, result)
      assert.ok(checkpoint.progress.every(([completed]) => completed === 0))
      assert.ok(harness.timers.every((ms) => ms < 60000), 'Daily quota must not be retried as a per-minute cooldown')
    })
  }
})

test('FORMAT on a batch can recover every single story using the same healthy model', async (t) => {
  const input = inputs(3)
  const checkpoint = checkpointCallbacks()
  const harness = loadGemini((request) => {
    if (request.kind === 'list') return listed(['gemini-offline-flash-1'])
    if (request.sources.length > 1) return generatedText('This batch was not valid JSON.')
    return generated(storiesFor(request))
  })
  t.after(() => harness.assertClean())
  const result = await harness.api.analyzeAndCategorizeBatchWithGemini(input, PRIMARY, undefined, undefined, checkpoint.callbacks)
  result.forEach((item, id) => assertComplete(item, input[id], story(1, input[id].title)))
  assert.deepEqual(harness.generations().filter((request) => request.sources.length === 1).map((request) => request.sources[0].title).sort(), input.map((item) => item.title).sort())
  assertCheckpoints(checkpoint, result)
})

test('429 respects Retry-After and RetryInfo with virtual time and retries the primary model', async (t) => {
  for (const [name, retryAfterMs, retryInfoMs] of [
    ['numeric Retry-After', 75000, 0],
    ['HTTP-date Retry-After', 80000, 0],
    ['RetryInfo longer than header', 65000, 85000],
    ['per-minute floor without hints', 0, 0]
  ]) {
    await t.test(name, async (subtest) => {
      let limitedAt
      const expectedWait = Math.max(60000, retryAfterMs, retryInfoMs)
      const harness = loadGemini((request) => {
        if (request.kind === 'list') return listed(['gemini-offline-flash-1'])
        assert.equal(request.key, PRIMARY, 'A temporary rate limit should be retried without claiming independent backup quota')
        if (limitedAt === undefined) {
          limitedAt = request.at
          const details = [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }]
          if (retryInfoMs) details.push({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${retryInfoMs / 1000}s` })
          const headers = retryAfterMs ? { 'Retry-After': name.startsWith('HTTP-date') ? new Date(request.at + retryAfterMs).toUTCString() : String(retryAfterMs / 1000) } : {}
          return apiError(429, details, headers)
        }
        assert.ok(request.at - limitedAt >= expectedWait, `Retry must wait at least ${expectedWait} virtual milliseconds`)
        return generated(storiesFor(request))
      })
      subtest.after(() => harness.assertClean())
      const input = inputs(1)[0]
      const result = await harness.api.summarizeSingleStoryWithGemini(input, PRIMARY, BACKUP)
      assertComplete(result, input, story(1, input.title))
      assert.equal(harness.generations().length, 2)
      assert.equal(harness.generations()[0].model, harness.generations()[1].model)
      assert.ok(harness.timers.some((ms) => ms >= expectedWait), 'Cooldown must run through the fake clock, not real timers')
      assert.ok(harness.listings().every((request) => request.key === PRIMARY))
    })
  }
})

test('legacy placeholder summaries are not mistaken for completed AI analysis', () => {
  const harness = loadGemini(() => { throw new Error('No API calls expected') })
  const complete = story(1, 'Legacy genuine analysis')
  const summary = {
    what_is_it: complete.what_is_it,
    ai_summary: complete.what_is_it,
    why_it_matters: complete.why_it_matters,
    software_impact: complete.software_impact
  }
  assert.equal(harness.api.hasCompleteSummary(summary), true)
  assert.equal(harness.api.hasCompleteSummary({ ...summary, what_is_it: '', ai_summary: complete.what_is_it }), true)
  assert.equal(harness.api.hasCompleteSummary({ ...summary, summary_status: 'pending' }), false)
  assert.equal(harness.api.hasCompleteSummary({ ...summary, summary_status: 'complete' }), true)
  for (const marker of [
    'alanında yeni bir teknik ilerleme paylaşıldı',
    'hakkında yeni bir gelişme paylaşıldı',
    'odaklı yeni bir teknik gelişme paylaşıldı'
  ]) {
    const placeholder = `Source story ${marker}. ${'Generic filler without source-specific AI analysis. '.repeat(3)}`
    assert.equal(harness.api.hasCompleteSummary({ ...summary, what_is_it: placeholder, ai_summary: placeholder }), false, marker)
    assert.equal(harness.api.hasCompleteSummary({ ...summary, what_is_it: '', ai_summary: placeholder }), false, `ai_summary fallback: ${marker}`)
  }
  for (const missing of [
    { what_is_it: '', ai_summary: '' },
    { what_is_it: 'Too short', ai_summary: '' },
    { why_it_matters: '' },
    { software_impact: '' }
  ]) {
    assert.equal(harness.api.hasCompleteSummary({ ...summary, ...missing }), false)
  }
  harness.assertClean()
})
