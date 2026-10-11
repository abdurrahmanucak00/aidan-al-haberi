import { ResearchLog, SearchResult, SearchSession, UserSettings } from '../types'
import { searchTavily, TavilyRawResult, isContentSubstantial, extractContentFromUrls } from './tavily'
import { analyzeAndCategorizeBatchWithGemini, detectCategoryFromContent, hasCompleteSummary, NewspaperAnalysisItem } from './gemini'
import { getSupabaseClient, syncSessionToSupabase } from './supabase'
import { isSemanticDuplicate, extractGitHubRepoKey } from './jaccardFilter'

export function applyAnalysis(result: SearchResult, analysis: NewspaperAnalysisItem): SearchResult {
  return {
    ...result,
    category: analysis.category,
    ai_headline: analysis.ai_headline,
    ai_summary: analysis.ai_summary,
    ai_takeaway: analysis.ai_takeaway,
    what_is_it: analysis.what_is_it,
    why_it_matters: analysis.why_it_matters,
    software_impact: analysis.software_impact,
    importance_score: analysis.importance_score,
    ai_headline_en: analysis.ai_headline_en,
    ai_summary_en: analysis.ai_summary_en,
    ai_takeaway_en: analysis.ai_takeaway_en,
    summary_status: analysis.summary_status,
    summary_error: analysis.summary_error,
    summary_model: analysis.summary_model
  }
}

function createSourceResult(raw: TavilyRawResult, query: string, type: 'person' | 'interest', createdAt: string): SearchResult {
  let source = 'web'
  try { source = new URL(raw.url).hostname.replace(/^www\./, '') } catch { /* Keep unknown sources readable. */ }
  return {
    id: crypto.randomUUID(), category: detectCategoryFromContent(raw.url, raw.title, raw.content),
    query_label: query, query_type: type, title: raw.title, url: raw.url,
    snippet: raw.content, full_content: raw.raw_content || raw.content, source,
    ai_headline: raw.title, importance_score: 0, summary_status: 'pending',
    created_at: createdAt
  }
}

export interface ResearchProgressCallback {
  onLog: (log: ResearchLog) => void
  onProgress: (percent: number, status: string) => void
  onCheckpoint?: (session: SearchSession) => void
}

export interface CustomDateRange {
  startDate: string
  endDate: string
  resultsLimit?: number
}

/** Tek seferlik serbest arama (takip listesinden bağımsız) */
export interface AdHocSearchOptions {
  query: string
  resultsLimit?: number
  days?: number
}

export async function runIncrementalResearch(
  settings: UserSettings,
  lastSession: SearchSession | null,
  callbacks: ResearchProgressCallback,
  existingSessions: SearchSession[] = [],
  customRange?: CustomDateRange
): Promise<SearchSession> {
  const { onLog, onProgress } = callbacks

  const addLog = (type: ResearchLog['type'], message: string): void => {
    onLog({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('tr-TR'),
      type,
      message
    })
  }

  if (!settings.tavily_key) {
    throw new Error('Tavily API anahtarı eksik! Lütfen Ayarlar sekmesinden API anahtarınızı kaydedin.')
  }

  const now = new Date()
  let searchMonths = settings.search_months || 6

  let dateFrom: Date
  let days: number

  if (customRange && customRange.startDate && customRange.endDate) {
    dateFrom = new Date(customRange.startDate)
    const endD = new Date(customRange.endDate)
    days = Math.max(1, Math.ceil((endD.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)))
    addLog('info', `Takvimden seçilen özel tarih aralığı: ${dateFrom.toLocaleDateString('tr-TR')} - ${endD.toLocaleDateString('tr-TR')} (${days} gün).`)
  } else if (lastSession && lastSession.searched_at) {
    const lastDate = new Date(lastSession.searched_at)
    days = Math.max(1, Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)))
    dateFrom = lastDate
    addLog('info', `Son arama: ${lastDate.toLocaleDateString('tr-TR')} (${days} gün önce). Sadece o tarihten bugüne olan yeni gelişmeler taranıyor...`)
  } else {
    days = searchMonths * 30
    dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    addLog('info', `İlk araştırma oturumu: Son ${searchMonths} aylık (${days} gün) yazılım ve AI gelişmeleri taranıyor...`)
  }

  // Collect all URLs and Titles published in earlier editions to prevent duplicate news
  const previouslyPublishedUrls = new Set<string>()
  const previouslyPublishedTitles: string[] = []
  existingSessions.forEach((s) => {
    s.results?.forEach((r) => {
      if (r.url) {
        previouslyPublishedUrls.add(r.url.toLowerCase().trim().replace(/\/$/, ''))
      }
      if (r.title) {
        previouslyPublishedTitles.push(r.title)
      }
    })
  })

  // Helper to normalize and compute token overlap similarity using Jaccard index
  const areTitlesDuplicate = (t1: string, t2: string): boolean => {
    return isSemanticDuplicate(t1, t2, 0.70)
  }


  const people = settings.tracked_people || []
  const interests = settings.interests || []
  const totalQueries = people.length + interests.length

  if (totalQueries === 0) {
    throw new Error('Takip edilen kişi veya konu bulunamadı. Lütfen radar ayarlarına en az bir kişi veya konu ekleyin.')
  }

  // Set smart limit per query (default to 2-3 high quality results)
  const queryLimit = customRange?.resultsLimit || 3
  addLog('info', `Radar Listesi: ${people.length} kişi, ${interests.length} ilgi alanı (Her biri için en kaliteli ${queryLimit} sonuç taranacak).`)

  interface QueryItem {
    label: string
    type: 'person' | 'interest'
  }

  const queryItems: QueryItem[] = [
    ...people.map((p) => ({ label: p, type: 'person' as const })),
    ...interests.map((i) => ({ label: i, type: 'interest' as const }))
  ]

  /**
   * Akıllı Sorgu Oluşturucu
   * Kişi veya konu için alanından bağımsız, dinamik bir Tavily arama sorgusu üretir.
   * - Kişiler: o kişinin yayınları, projeleri, duyuruları (AI varsayımı YOK)
   * - Konular: o alandaki yeni modeller, araçlar, çerçeveler, araştırmalar ve popüler gelişmeler
   */
  function buildSmartQuery(label: string, type: 'person' | 'interest'): string {
    const year = new Date().getFullYear()

    if (type === 'person') {
      // Kişinin son çalışmaları: makale, proje, duyuru, araştırma - alan kısıtlaması yok
      return `"${label}" new paper research project release announcement ${year}`
    } else {
      // Konudaki yeni gelişmeler: model, araç, çerçeve, makale, popüler trend
      return `${label} new release model tool framework paper breakthrough ${year}`
    }
  }

  const rawResultsWithMeta: Array<{
    raw: TavilyRawResult
    query_label: string
    query_type: 'person' | 'interest'
  }> = []

  let completedQueries = 0

  for (const item of queryItems) {
    onProgress(
      Math.round((completedQueries / totalQueries) * 60),
      `Tarama yapılıyor: ${item.label}...`
    )

    const searchQuery = buildSmartQuery(item.label, item.type)
    addLog('search', `[Tavily] "${item.label}" taranıyor: "${searchQuery}"`)

    try {
      const results = await searchTavily({
        query: searchQuery,
        apiKey: settings.tavily_key,
        days: days <= 30 ? days : undefined,
        maxResults: queryLimit
      })

      addLog('info', `✓ "${item.label}" için ${results.length} sonuç bulundu.`)

      results.forEach((r) => {
        rawResultsWithMeta.push({
          raw: r,
          query_label: item.label,
          query_type: item.type
        })
      })
    } catch (err: any) {
      addLog('warning', `⚠ "${item.label}" aranırken hata: ${err.message || err}`)
    }

    completedQueries++
    // Small delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 350))
  }

  onProgress(65, 'Önceki sayılarda basılmış haberler ve mükerrerler semantik olarak eleniyor...')
  addLog('info', `Toplam ${rawResultsWithMeta.length} ham sonuç toplandı. URL, Repo ve Semantik Başlık benzerlikleri filtreleniyor...`)

  // Deduplicate against self and all previous sessions (URL + Repo Key + Title Similarity)
  const uniqueItems: typeof rawResultsWithMeta = []
  const seenUrls = new Set<string>()
  const seenRepos = new Set<string>()
  const seenTitles: string[] = []

  for (const item of rawResultsWithMeta) {
    const urlClean = item.raw.url.toLowerCase().trim().replace(/\/$/, '')
    const repoKey = extractGitHubRepoKey(item.raw.url)
    const titleClean = item.raw.title || ''

    // 1. Check direct URL match (in current batch or past editions)
    if (seenUrls.has(urlClean) || previouslyPublishedUrls.has(urlClean)) {
      continue
    }

    // 2. Check GitHub repo match (avoid multiple articles about the same repository)
    if (repoKey && seenRepos.has(repoKey)) {
      continue
    }

    // 3. Check Title Semantic Duplication against past editions
    const duplicateInPast = previouslyPublishedTitles.some((pastTitle) => areTitlesDuplicate(pastTitle, titleClean))
    if (duplicateInPast) {
      continue
    }

    // 4. Check Title Semantic Duplication within current batch
    const duplicateInCurrent = seenTitles.some((currTitle) => areTitlesDuplicate(currTitle, titleClean))
    if (duplicateInCurrent) {
      continue
    }

    // Item passed all filters
    seenUrls.add(urlClean)
    if (repoKey) seenRepos.add(repoKey)
    seenTitles.push(titleClean)
    uniqueItems.push(item)
  }

  addLog('info', `Filtreleme tamamlandı: ${uniqueItems.length} yeni, benzersiz ve seçkin AI gelişmesi belirlendi.`)

  if (uniqueItems.length === 0) {
    onProgress(100, 'Tamamlandı.')
    addLog('info', 'Bu zaman aralığında radarınız için daha önce basılmamış yeni bir gelişme bulunamadı.')

    const emptySession: SearchSession = {
      id: 'sess_' + Date.now(),
      searched_at: now.toISOString(),
      date_from: dateFrom.toISOString(),
      date_to: now.toISOString(),
      total_results: 0,
      results: []
    }
    return emptySession
  }

  // Phase 2.5: Enrich content with full article text (Tavily raw_content check & Extract API fallback)
  onProgress(68, 'Makale ve haber tam metinleri çekiliyor ve temizleniyor...')
  addLog('info', `[İçerik Zenginleştirme] ${uniqueItems.length} haberin tam metinleri kontrol ediliyor...`)

  // Find URLs that need full content extraction (raw_content is missing or not substantial)
  const urlsNeedingExtraction: string[] = []
  uniqueItems.forEach((u) => {
    const currentSubstantial = isContentSubstantial(u.raw.raw_content)
    if (!currentSubstantial && u.raw.url) {
      urlsNeedingExtraction.push(u.raw.url)
    }
  })

  if (urlsNeedingExtraction.length > 0) {
    addLog('info', `[Tavily Extract] ${urlsNeedingExtraction.length} bağlantı için doğrudan tam makale/repo metni çekiliyor...`)
    try {
      const extractedMap = await extractContentFromUrls(urlsNeedingExtraction, settings.tavily_key)
      let enrichedCount = 0
      uniqueItems.forEach((u) => {
        const cleanUrl = u.raw.url.toLowerCase().trim().replace(/\/$/, '')
        if (extractedMap[cleanUrl] && extractedMap[cleanUrl].length > 200) {
          u.raw.raw_content = extractedMap[cleanUrl]
          enrichedCount++
        }
      })
      addLog('success', `✓ ${enrichedCount} haberin tam makale içeriği başarıyla çıkarıldı ve zenginleştirildi.`)
    } catch (extractErr: any) {
      addLog('warning', `Tavily Extract aşamasında uyarı: ${extractErr.message || extractErr}`)
    }
  } else {
    addLog('info', `✓ Tüm haberlerin tam metinleri doğrudan taramadan eksiksiz alındı.`)
  }

  // AI batch categorization and Turkish deep analysis
  onProgress(75, 'Yapay zeka baş editörü tam metinleri inceliyor ve Türkçe gazeteyi hazırlıyor...')
  addLog('ai', 'Gemini ile tam makale metinleri okunuyor, analiz ediliyor ve profesyonel Türkçe haberler yazılıyor...')

  const newSession: SearchSession = {
    id: crypto.randomUUID(), searched_at: now.toISOString(), date_from: dateFrom.toISOString(),
    date_to: customRange?.endDate ? new Date(customRange.endDate).toISOString() : now.toISOString(),
    total_results: uniqueItems.length,
    results: uniqueItems.map((u) => createSourceResult(u.raw, u.query_label, u.query_type, now.toISOString()))
  }
  callbacks.onCheckpoint?.(newSession)
  try {
    const newspaperItems = await analyzeAndCategorizeBatchWithGemini(
      uniqueItems.map((u) => {
        // Prefer rich full article text over short snippet
        const textToAnalyze =
          u.raw.raw_content && u.raw.raw_content.length > 200
            ? u.raw.raw_content
            : u.raw.content
        return {
          query: u.query_label,
          title: u.raw.title,
          snippet: textToAnalyze,
          url: u.raw.url
        }
      }),
      settings.gemini_key,
      settings.gemini_backup_key,
      addLog,
      {
        onItem: (analysis) => {
          newSession.results = newSession.results.map((result, i) => i === analysis.id ? applyAnalysis(result, analysis) : result)
          callbacks.onCheckpoint?.({ ...newSession })
        },
        onProgress: (completed, total) => onProgress(75 + Math.round(12 * completed / total), `${completed}/${total} haber özetlendi...`)
      }
    )
    const count = newspaperItems.filter((item) => item.summary_status === 'complete').length
    addLog(count === newspaperItems.length ? 'success' : 'warning', `${count}/${newspaperItems.length} haber Türkçe analiz edildi; eksik özetler kaynaklarıyla kaydedildi.`)
  } catch (geminiErr: any) {
    const errorMsg = geminiErr.message || String(geminiErr)
    addLog('error', `AI analizi kritik hata: ${errorMsg}`)
    addLog('warning', 'Başarılı özetler ve bekleyen haberlerin kaynak metinleri korunuyor.')
  }

  newSession.results = [...newSession.results].sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0))
  callbacks.onCheckpoint?.({ ...newSession })

  onProgress(90, 'Veriler kaydediliyor ve senkronize ediliyor...')

  // Supabase sync if credentials available
  const supabase = getSupabaseClient(settings.supabase_url, settings.supabase_anon_key)
  if (supabase) {
    addLog('info', 'Supabase bulut veritabanına senkronize ediliyor...')
    try {
      await syncSessionToSupabase(newSession, supabase)
      addLog('success', '✓ Supabase senkronizasyonu tamamlandı.')
    } catch (err: any) {
      addLog('warning', `Supabase senkronizasyonunda hata: ${err.message}`)
    }
  }

  onProgress(100, 'Araştırma tamamlandı!')
  const completed = newSession.results.filter(hasCompleteSummary).length
  addLog(completed === newSession.results.length ? 'success' : 'warning', `Gazete kaydedildi: ${newSession.results.length} haber, ${completed} hazır özet, ${newSession.results.length - completed} bekleyen özet.`)

  return newSession
}

/* -------------------------------------------------------------------------- */
/*                        AD-HOC (FREE) SEARCH MODE                           */
/* -------------------------------------------------------------------------- */

/**
 * Runs a single one-off search for a free-form query, bypassing the tracked
 * people/interests list. Reuses the same Tavily → dedup → Gemini pipeline.
 * The produced session is transient (is_ad_hoc) and is not added to the stand.
 */
export async function runAdHocSearch(
  settings: UserSettings,
  options: AdHocSearchOptions,
  callbacks: ResearchProgressCallback
): Promise<SearchSession> {
  const { onLog, onProgress } = callbacks
  const query = options.query.trim()

  const addLog = (type: ResearchLog['type'], message: string): void => {
    onLog({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('tr-TR'),
      type,
      message
    })
  }

  if (!settings.tavily_key) {
    throw new Error('Tavily API anahtarı eksik! Lütfen Ayarlar sekmesinden API anahtarınızı kaydedin.')
  }
  if (!query) {
    throw new Error('Arama sorgusu boş olamaz.')
  }

  const now = new Date()
  const days = options.days || 90
  const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const limit = Math.max(1, Math.min(options.resultsLimit || 8, 15))

  onProgress(10, 'Serbest arama başlatılıyor...')
  addLog('info', `🔍 Serbest arama: "${query}" (son ${days} gün, en fazla ${limit} sonuç)`)

  const results = await searchTavily({
    query,
    apiKey: settings.tavily_key,
    days: days <= 30 ? days : undefined,
    maxResults: limit
  })

  addLog('info', `✓ Tavily ${results.length} sonuç döndürdü.`)

  if (results.length === 0) {
    onProgress(100, 'Sonuç bulunamadı.')
    return {
      id: 'adhoc_' + Date.now(),
      searched_at: now.toISOString(),
      date_from: dateFrom.toISOString(),
      date_to: now.toISOString(),
      total_results: 0,
      results: [],
      ad_hoc_query: query
    }
  }

  // Deduplicate within the batch (URL + title similarity)
  onProgress(40, 'Mükerrer sonuçlar eleniyor...')
  const unique: typeof results = []
  const seenUrls = new Set<string>()
  const seenTitles: string[] = []

  for (const r of results) {
    const urlClean = r.url.toLowerCase().trim().replace(/\/$/, '')
    if (seenUrls.has(urlClean)) continue
    if (seenTitles.some((t) => isSemanticDuplicate(t, r.title || '', 0.70))) continue
    seenUrls.add(urlClean)
    seenTitles.push(r.title || '')
    unique.push(r)
  }

  addLog('info', `✓ ${unique.length} benzersiz sonuç kaldı.`)

  // Enrich thin content via Tavily Extract
  onProgress(55, 'İçerikler zenginleştiriliyor...')
  const urlsNeedingExtraction = unique.filter((r) => !isContentSubstantial(r.raw_content)).map((r) => r.url)
  if (urlsNeedingExtraction.length > 0) {
    try {
      const extractedMap = await extractContentFromUrls(urlsNeedingExtraction, settings.tavily_key)
      unique.forEach((r) => {
        const key = r.url.toLowerCase().trim().replace(/\/$/, '')
        if (extractedMap[key] && extractedMap[key].length > 200) {
          r.raw_content = extractedMap[key]
        }
      })
      addLog('success', `✓ ${urlsNeedingExtraction.length} bağlantı için tam metin çekildi.`)
    } catch (err: any) {
      addLog('warning', `⚠️ İçerik zenginleştirme uyarısı: ${err.message || err}`)
    }
  }

  // Gemini analysis
  onProgress(70, 'Gemini haberleri analiz ediyor...')
  const session: SearchSession = {
    id: crypto.randomUUID(), searched_at: now.toISOString(), date_from: dateFrom.toISOString(), date_to: now.toISOString(),
    total_results: unique.length, ad_hoc_query: query,
    results: unique.map((r) => ({ ...createSourceResult(r, query, 'interest', now.toISOString()), is_ad_hoc: true }))
  }
  try {
    const newspaperItems = await analyzeAndCategorizeBatchWithGemini(
      unique.map((r) => ({
        query,
        title: r.title,
        snippet: r.raw_content && r.raw_content.length > 200 ? r.raw_content : r.content,
        url: r.url
      })),
      settings.gemini_key,
      settings.gemini_backup_key,
      addLog,
      {
        onItem: (analysis) => {
          session.results = session.results.map((r, i) => i === analysis.id ? applyAnalysis(r, analysis) : r)
        },
        onProgress: (completed, total) => onProgress(70 + Math.round(20 * completed / total), `${completed}/${total} haber özetlendi...`)
      }
    )
    const count = newspaperItems.filter((item) => item.summary_status === 'complete').length
    addLog(count === unique.length ? 'success' : 'warning', `${count}/${unique.length} sonuç Türkçe analiz edildi.`)
  } catch (err: any) {
    const msg = err?.message || String(err)
    addLog('warning', `⚠️ AI analizi başarısız (${msg}). Sonuçlar temel başlıklarla gösteriliyor.`)
  }

  session.results = [...session.results].sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0))
  onProgress(100, 'Serbest arama tamamlandı!')
  const completed = session.results.filter(hasCompleteSummary).length
  addLog(completed === session.results.length ? 'success' : 'warning', `${session.results.length} sonuç: ${completed} hazır özet, ${session.results.length - completed} bekleyen özet.`)
  return session
}

/** Retry only unfinished stories using retained sources; never repeat Tavily searches. */
export async function retryPendingSummaries(
  session: SearchSession,
  settings: UserSettings,
  callbacks: ResearchProgressCallback
): Promise<SearchSession> {
  const pending = session.results.filter((item) => !hasCompleteSummary(item))
  const next = { ...session, results: [...session.results] }
  const log = (type: ResearchLog['type'], message: string): void => callbacks.onLog({
    id: crypto.randomUUID(), timestamp: new Date().toLocaleTimeString('tr-TR'), type, message
  })
  log('info', `${pending.length} bekleyen özet kaynak metinlerinden yeniden hazırlanacak; hazır özetlere dokunulmayacak.`)
  await analyzeAndCategorizeBatchWithGemini(
    pending.map((item) => ({ title: item.title, snippet: item.full_content || item.snippet, url: item.url, query: item.query_label })),
    settings.gemini_key, settings.gemini_backup_key, log,
    {
      onItem: (analysis) => {
        const original = pending[analysis.id]
        next.results = next.results.map((item) => item.id === original.id ? applyAnalysis(item, analysis) : item)
        callbacks.onCheckpoint?.({ ...next })
      },
      onProgress: (completed, total) => callbacks.onProgress(Math.round(100 * completed / total), `${completed}/${total} bekleyen özet tamamlandı...`)
    }
  )
  callbacks.onProgress(100, 'Özet denemesi tamamlandı.')
  return next
}
