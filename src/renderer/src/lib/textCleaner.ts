/**
 * Cleans messy raw search titles from GitHub, ArXiv, Hugging Face, etc.
 * e.g. "ReadMe_intro_Andrej_Karpathy_nanoCHAT_COLAB_v at main · MartialTerran/..."
 * -> "Andrej Karpathy - nanoCHAT"
 */
export function cleanRawTitle(title: string, queryLabel?: string): string {
  if (!title) return queryLabel || 'AI Gelişmesi'

  let cleaned = title

  // Remove GitHub branches / repo noise
  cleaned = cleaned.replace(/\s*at\s+main\s*·\s*.*$/i, '')
  cleaned = cleaned.replace(/\s*at\s+master\s*·\s*.*$/i, '')
  cleaned = cleaned.replace(/^GitHub\s*-\s*[^:]+:\s*/i, '')
  cleaned = cleaned.replace(/^ReadMe(_intro)?_/i, '')
  cleaned = cleaned.replace(/_COLAB_v.*/i, '')
  cleaned = cleaned.replace(/_/g, ' ')

  // Remove ArXiv noise
  cleaned = cleaned.replace(/\[\d{4}\.\d{4,5}(v\d+)?\]\s*/i, '')
  cleaned = cleaned.replace(/\.pdf$/i, '')

  // Remove trailing website names
  cleaned = cleaned.replace(/\s*[-|–—]\s*(Hugging\s*Face|TechCrunch|arXiv|Medium|GitHub|Reddit|Twitter|X)\s*$/i, '')

  cleaned = cleaned.trim()

  // If title was completely mangled, use query label
  if (cleaned.length < 5 && queryLabel) {
    return `${queryLabel} - Yeni AI Gelişmesi`
  }

  return cleaned
}
