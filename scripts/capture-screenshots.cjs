/**
 * Regenerates the README screenshots from the built renderer.
 *
 * It loads the production bundle in an offscreen window, injects clearly
 * synthetic demo data into localStorage, and captures only the application
 * window (never the desktop). Screenshots therefore contain no personal data.
 *
 * Usage:  npm run build && npx electron scripts/capture-screenshots.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

// Documentation capture must also work on headless/GPU-less machines.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('no-sandbox')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots')

const STORY = (index, overrides) => ({
  id: `demo-${index}`,
  category: 'new_model',
  query_label: 'Open-Source AI Models',
  query_type: 'interest',
  title: `Demo source ${index}`,
  url: `https://example.com/demo/${index}`,
  snippet: 'Demo snippet used only to render the interface for documentation.',
  source: 'example.com',
  ai_headline: `Demo headline ${index}`,
  ai_summary: 'Demo summary text.',
  ai_takeaway: 'Demo takeaway text.',
  what_is_it:
    'Bu bir ekran görüntüsü için hazırlanmış örnek metindir. Gerçek bir haber iddiası taşımaz; yalnızca arayüzün tipografi ve yerleşim düzenini göstermek amacıyla kullanılır.',
  why_it_matters:
    'Örnek içerik: arayüzün "Neden Önemli?" bölümünün nasıl göründüğünü göstermek için kullanılan açıklama metnidir.',
  software_impact:
    'Örnek içerik: yazılım etkisi bölümünün görsel düzenini göstermek amacıyla yazılmış kısa bir metindir.',
  importance_score: 90 - index * 5,
  ai_headline_en: `Demo headline ${index}`,
  ai_summary_en: 'Demo English summary used for documentation screenshots.',
  ai_takeaway_en: 'Demo English takeaway.',
  summary_status: 'complete',
  summary_model: 'demo-model',
  created_at: new Date('2026-10-11T12:00:00Z').toISOString(),
  ...overrides
})

const SESSION = {
  id: 'demo-session',
  searched_at: '2026-10-11T12:00:00.000Z',
  date_from: '2026-10-04T00:00:00.000Z',
  date_to: '2026-10-11T00:00:00.000Z',
  total_results: 5,
  results: [
    STORY(0, {
      category: 'new_model',
      query_label: 'Open-Source AI Models',
      ai_headline: 'Açık Kaynak Model Ailesi Yeni Sürümünü Yayınladı',
      importance_score: 92
    }),
    STORY(1, {
      category: 'new_paper',
      query_label: 'Reasoning Models',
      ai_headline: 'Akıl Yürütme Modelleri Üzerine Yeni Bir Değerlendirme Yayınlandı',
      importance_score: 78
    }),
    STORY(2, {
      category: 'tool_library',
      query_label: 'RAG Systems',
      ai_headline: 'RAG Boru Hattı İçin Açık Kaynak Bir Araç Kütüphanesi Çıktı',
      importance_score: 71
    }),
    STORY(3, {
      category: 'model_update',
      query_label: 'LLM Agents',
      ai_headline: 'Ajan Çerçevesine Yeni Araç Çağırma Desteği Eklendi',
      importance_score: 64
    }),
    STORY(4, {
      category: 'news',
      query_label: 'Vision & Multimodal AI',
      ai_headline: 'Çok Modlu Modellerde Dağıtım Maliyeti Üzerine Bir Rapor',
      importance_score: 55
    })
  ]
}

const SETTINGS = {
  tracked_people: ['Andrej Karpathy', 'Harrison Chase'],
  interests: ['LLM Agents', 'RAG Systems', 'Open-Source AI Models'],
  tavily_key: '',
  gemini_key: '',
  gemini_backup_key: '',
  supabase_url: '',
  supabase_anon_key: '',
  search_months: 6,
  updated_at: '2026-10-11T12:00:00.000Z'
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits until an element whose text contains `text` is clickable, or times out. */
async function waitForButton(window, text, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = await window.webContents.executeJavaScript(`
      (() => {
        const wanted = ${JSON.stringify(text)}.toLocaleLowerCase('tr')
        return Array.from(document.querySelectorAll('button, a, [role="button"], div[class]'))
          .some((n) => (n.textContent || '').toLocaleLowerCase('tr').includes(wanted))
      })()
    `)
    if (found) return true
    await sleep(500)
  }
  return false
}

async function dumpButtons(window) {
  const texts = await window.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('button'))
      .map((n) => (n.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60))
      .filter(Boolean)
  `)
  console.log('buttons on screen:', JSON.stringify(texts, null, 1))
}

async function capture(window, file) {
  // Framer Motion entrance transitions start at opacity 0, so let the view settle
  // before grabbing the frame, otherwise the screenshot is captured mid-fade.
  await sleep(2200)
  const image = await window.webContents.capturePage()
  const target = path.join(OUT_DIR, file)
  fs.writeFileSync(target, image.toPNG())
  const { width, height } = image.getSize()
  console.log(`saved ${file} (${width}x${height}, ${Math.round(fs.statSync(target).size / 1024)} kB)`)
}

/**
 * Clicks the tightest visible element containing `text`. The interface mixes
 * real <button>s with clickable cards, so a button-only query would miss them.
 * Script/style tags also contain the same strings, so they must be excluded.
 */
async function clickByText(window, text) {
  return window.webContents.executeJavaScript(`
    (() => {
      const wanted = ${JSON.stringify(text)}.toLocaleLowerCase('tr')
      const matches = Array.from(document.querySelectorAll('*'))
        .filter((n) => !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(n.tagName))
        .filter((n) => n.offsetParent !== null || n.tagName === 'BODY')
        .filter((n) => (n.textContent || '').toLocaleLowerCase('tr').includes(wanted))
      if (!matches.length) return false
      // Tightest subtree that still contains the text is the real click target.
      matches.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
      const target = matches[0]
      target.click()
      return { clicked: true, tag: target.tagName, text: (target.textContent || '').trim().slice(0, 50) }
    })()
  `)
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const window = new BrowserWindow({
    width: 1280,
    height: 960,
    show: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(ROOT, 'out', 'preload', 'index.js'),
      sandbox: false,
      contextIsolation: true,
      offscreen: false
    }
  })

  const rendererEntry = path.join(ROOT, 'out', 'renderer', 'index.html')
  if (!fs.existsSync(rendererEntry)) {
    console.error('Renderer bundle missing. Run "npm run build" first.')
    app.exit(1)
    return
  }

  // Documentation capture is fully offline; the app does not need the network to render.
  await window.loadFile(rendererEntry)
  await window.webContents.executeJavaScript(`
    localStorage.setItem('devradar_user_settings_v1', ${JSON.stringify(JSON.stringify(SETTINGS))})
    localStorage.setItem('devradar_search_sessions_v1', ${JSON.stringify(JSON.stringify([SESSION]))})
    true
  `)

  // localStorage writes can race the renderer's initial read, so reload until the
  // injected edition is actually on screen.
  let ready = false
  for (let attempt = 1; attempt <= 5 && !ready; attempt++) {
    await window.webContents.reload()
    await sleep(2000)
    ready = await waitForButton(window, 'gazeteyi', 6000)
    console.log(`stand ready on attempt ${attempt}: ${ready}`)
  }

  await capture(window, '01-newspaper-stand.png')

  if (!ready) {
    await dumpButtons(window)
    throw new Error('The injected demo edition never rendered on the newspaper stand.')
  }

  console.log("open edition:", JSON.stringify(await clickByText(window, "gazeteyi")))
  await sleep(2000)
  await capture(window, '02-reader-view.png')

  // Broadsheet layout
  if (await waitForButton(window, 'manşet', 8000)) {
    await clickByText(window, 'manşet')
    await sleep(2000)
    await capture(window, '03-broadsheet.png')
    await clickByText(window, 'sayfa')
    await sleep(1200)
  }

  // Analytics tab
  if (await waitForButton(window, 'trend', 8000)) {
    await clickByText(window, 'trend')
    await sleep(2000)
    await capture(window, '04-trends.png')
  } else {
    await dumpButtons(window)
  }

  window.destroy()
  app.exit(0)
})

app.on('window-all-closed', () => app.exit(0))
