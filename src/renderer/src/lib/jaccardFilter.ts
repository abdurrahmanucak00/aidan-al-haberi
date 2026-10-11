// Common multilingual stop-words (English + Turkish)

const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'what', 'which', 'who', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just', 'now',
  'release', 'new', 'announcing', 'introducing', 'updates', 'v1', 'v2', 'v3', 'guide', 'tutorial',
  // Turkish
  'bir', 've', 'veya', 'ile', 'icin', 'için', 'bu', 'su', 'şu', 'o', 'da', 'de', 'ta', 'te',
  'ki', 'mi', 'mu', 'mu', 'mü', 'gibi', 'kadar', 'daha', 'en', 'cok', 'çok', 'ama', 'fakat',
  'ancak', 'lakin', 'ise', 'olan', 'olarak', 'yeni', 'duyuruldu', 'tanitildi', 'tanıtıldı',
  'hakkinda', 'hakkında', 'sonra', 'once', 'önce', 'uzerine', 'üzerine', 'gore', 'göre'
])

/**
 * Normalizes text: converts to lowercase, handles Turkish characters, removes special chars.
 */
export function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extracts normalized tokens (unigrams + bigrams) excluding stop-words.
 */
export function tokenizeText(text: string, includeBigrams: boolean = true): Set<string> {
  const normalized = normalizeText(text)
  if (!normalized) return new Set()

  const words = normalized
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

  const tokenSet = new Set<string>()

  // Unigrams
  for (const word of words) {
    tokenSet.add(word)
  }

  // Bigrams for phrasing preservation (e.g., "reasoning model", "vision agent")
  if (includeBigrams && words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      tokenSet.add(`${words[i]}_${words[i + 1]}`)
    }
  }

  return tokenSet
}

/**
 * Calculates Jaccard Similarity Coefficient between two sets of tokens.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 * Returns a value between 0.0 (no overlap) and 1.0 (exact match).
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = tokenizeText(textA)
  const tokensB = tokenizeText(textB)

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersectionSize = 0
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      intersectionSize++
    }
  })

  const unionSize = tokensA.size + tokensB.size - intersectionSize
  if (unionSize === 0) return 0

  return intersectionSize / unionSize
}

/**
 * Checks if two search result items or titles are semantic duplicates based on threshold (default 0.70 or 70%).
 */
export function isSemanticDuplicate(
  textA: string,
  textB: string,
  threshold: number = 0.70
): boolean {
  return calculateJaccardSimilarity(textA, textB) >= threshold
}

/**
 * Extracts a normalized GitHub repo identifier from a URL if present.
 * Example: "https://github.com/karpathy/nanochat/issues" -> "karpathy/nanochat"
 */
export function extractGitHubRepoKey(url: string): string | null {
  if (!url) return null
  const match = url.match(/github\.com\/([^/#?]+\/[^/#?]+)/i)
  return match ? match[1].toLowerCase() : null
}
