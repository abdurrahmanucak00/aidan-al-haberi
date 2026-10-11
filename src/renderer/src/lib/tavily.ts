export const TARGET_AI_DOMAINS = [
  'arxiv.org',
  'github.com',
  'huggingface.co',
  'openai.com',
  'deepmind.com',
  'anthropic.com',
  'mistral.ai',
  'meta.com',
  'venturebeat.com',
  'techcrunch.com',
  'blog.google',
  'research.google'
]

export interface TavilyRawResult {
  title: string
  url: string
  content: string
  raw_content?: string
  score?: number
  published_date?: string
}

export interface TavilySearchOptions {
  query: string
  apiKey: string
  searchDepth?: 'basic' | 'advanced'
  days?: number
  includeDomains?: string[]
  maxResults?: number
}

/**
 * Clean extracted web page text — soft cleaning that preserves useful content.
 * Only removes truly useless elements (HTML tags, badge URLs, navigation text).
 * Keeps code examples and README content since they contain useful descriptions.
 */
export function cleanExtractedText(text: string): string {
  if (!text) return ''

  let cleaned = text
    // Remove markdown image/badge syntax ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    // Remove markdown links but keep the text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove shield.io / badge URLs
    .replace(/https?:\/\/[^\s]*(?:shields\.io|badge|img\.shields)[^\s]*/g, ' ')
    // Remove GitHub-specific UI chrome
    .replace(/\b(Repository files navigation|Skip to content|Toggle navigation|Footer|Breadcrumbs)\b/gi, ' ')
    // Remove lines that are just URLs
    .replace(/^https?:\/\/[^\s]+$/gm, ' ')
    // Collapse multiple newlines
    .replace(/\n{4,}/g, '\n\n')
    // Collapse multiple spaces
    .replace(/[ \t]{3,}/g, ' ')
    .trim()

  return cleaned
}

/**
 * Check if content has enough substance to produce a meaningful summary.
 * Returns false for garbage/thin content that would produce bad summaries.
 */
export function isContentSubstantial(text?: string): boolean {
  if (!text || text.length < 400) return false
  const lower = text.toLowerCase()

  // Count real sentences (containing a verb-like pattern or ending with period)
  const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 20)
  if (sentences.length < 3) return false

  // If dominated by garbage patterns
  const garbagePatterns = [
    'sign in to view',
    'sign up to continue',
    'enable cookies',
    'access denied',
    '403 forbidden',
    'page not found',
    'subscribe to read',
    'create an account',
    'javascript is required'
  ]
  const garbageCount = garbagePatterns.filter((p) => lower.includes(p)).length
  if (garbageCount >= 2) return false
  if (garbageCount >= 1 && text.length < 800) return false

  return true
}

export async function searchTavily(options: TavilySearchOptions): Promise<TavilyRawResult[]> {
  const {
    query,
    apiKey,
    searchDepth = 'advanced',
    days = 180,
    includeDomains = TARGET_AI_DOMAINS,
    maxResults = 7
  } = options

  if (!apiKey) {
    throw new Error('Tavily API Key girilmedi. Lütfen Ayarlar sekmesinden API anahtarınızı kaydedin.')
  }

  const payload: Record<string, any> = {
    api_key: apiKey,
    query: `${query} latest artificial intelligence LLM model research release news`,
    search_depth: searchDepth,
    include_answer: false,
    include_raw_content: true,
    max_results: maxResults,
    include_domains: includeDomains
  }

  if (days && days <= 30) {
    payload.days = days
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Tavily API Hatası (${response.status}): ${errorText || response.statusText}`)
  }

  const data = await response.json()
  const results: any[] = data.results || []

  return results.map((item) => {
    const rawContentClean = item.raw_content ? cleanExtractedText(item.raw_content) : ''
    return {
      title: item.title || 'Başlıksız Gelişme',
      url: item.url,
      content: item.content || '',
      raw_content: rawContentClean,
      score: item.score,
      published_date: item.published_date || new Date().toISOString().split('T')[0]
    }
  })
}

/**
 * Extract full clean article text from specific URLs using Tavily Extract API.
 * Used as fallback when search raw_content is missing or garbage.
 * Processes up to 20 URLs per batch, costs 1 credit per 5 successful URLs.
 */
export async function extractContentFromUrls(
  urls: string[],
  apiKey: string
): Promise<Record<string, string>> {
  if (!urls.length || !apiKey) return {}

  const resultMap: Record<string, string> = {}

  const batchSize = 20
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    try {
      const response = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: apiKey,
          urls: batch,
          extract_depth: 'basic',
          format: 'markdown'
        })
      })

      if (response.ok) {
        const data = await response.json()
        const results = data.results || []
        results.forEach((r: any) => {
          if (r.url && r.raw_content) {
            resultMap[r.url.toLowerCase().trim().replace(/\/$/, '')] = cleanExtractedText(
              r.raw_content
            )
          }
        })
      }
    } catch (e) {
      console.warn('Tavily extract batch error:', e)
    }
  }

  return resultMap
}

// URL deduplication utility
export function deduplicateResults<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    let normalized = item.url.toLowerCase().trim().replace(/\/$/, '')
    try {
      const u = new URL(normalized)
      u.searchParams.delete('utm_source')
      u.searchParams.delete('utm_medium')
      u.searchParams.delete('utm_campaign')
      normalized = u.origin + u.pathname
    } catch {}

    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}
