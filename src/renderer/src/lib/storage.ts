import { SearchSession, UserSettings, SearchResult, FavoriteItem } from '../types'
import { decryptApiKey, encryptApiKey } from './crypto'

const STORAGE_KEYS = {
  SETTINGS: 'devradar_user_settings_v1',
  SESSIONS: 'devradar_search_sessions_v1',
  ACTIVE_RESULTS: 'devradar_active_results_v1',
  FAVORITES: 'devradar_favorites_v1'
}

// Supabase credentials are injected at build time from .env (see .env.example).
// Never hardcode real project keys in source control.
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const DEFAULT_SETTINGS: UserSettings = {
  tracked_people: [
    'Sam Altman',
    'Demis Hassabis',
    'Andrej Karpathy',
    'Yann LeCun',
    'Ilya Sutskever',
    'Jensen Huang'
  ],
  interests: [
    'LLM Agents',
    'Reasoning Models',
    'RAG Systems',
    'Vision & Multimodal AI',
    'Open-Source AI Models'
  ],
  tavily_key: '',
  gemini_key: '',
  supabase_url: ENV_SUPABASE_URL,
  supabase_anon_key: ENV_SUPABASE_ANON_KEY,
  updated_at: new Date().toISOString()
}

export async function loadUserSettings(): Promise<UserSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as UserSettings

    // Decrypt keys if stored encrypted
    const tavily = parsed.tavily_key ? await decryptApiKey(parsed.tavily_key) : ''
    const gemini = parsed.gemini_key ? await decryptApiKey(parsed.gemini_key) : ''
    const geminiBackup = parsed.gemini_backup_key ? await decryptApiKey(parsed.gemini_backup_key) : ''

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      supabase_url: parsed.supabase_url || DEFAULT_SETTINGS.supabase_url,
      supabase_anon_key: parsed.supabase_anon_key || DEFAULT_SETTINGS.supabase_anon_key,
      tavily_key: tavily,
      gemini_key: gemini,
      gemini_backup_key: geminiBackup
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    // Encrypt sensitive API keys before saving
    const encryptedTavily = settings.tavily_key ? await encryptApiKey(settings.tavily_key) : ''
    const encryptedGemini = settings.gemini_key ? await encryptApiKey(settings.gemini_key) : ''
    const encryptedBackup = settings.gemini_backup_key
      ? await encryptApiKey(settings.gemini_backup_key)
      : ''

    const toStore: UserSettings = {
      ...settings,
      tavily_key: encryptedTavily,
      gemini_key: encryptedGemini,
      gemini_backup_key: encryptedBackup,
      updated_at: new Date().toISOString()
    }

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(toStore))
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

export function loadSearchSessions(): SearchSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (!raw) return []
    return JSON.parse(raw) as SearchSession[]
  } catch {
    return []
  }
}

export function saveSearchSessions(sessions: SearchSession[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.slice(0, 30)))
    return true
  } catch (err) {
    console.error('Failed to save sessions:', err)
    return false
  }
}

export function loadActiveResults(): SearchResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_RESULTS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SearchResult[]
    // Filter out any leftover demo sample items
    return parsed.filter((item) => !item.id.startsWith('sample-'))
  } catch {
    return []
  }
}

export function saveActiveResults(results: SearchResult[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_RESULTS, JSON.stringify(results))
  } catch (err) {
    console.error('Failed to save active results:', err)
  }
}

/* -------------------------------------------------------------------------- */
/*                                FAVORITES                                   */
/* -------------------------------------------------------------------------- */

export function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES)
    if (!raw) return []
    return JSON.parse(raw) as FavoriteItem[]
  } catch {
    return []
  }
}

export function saveFavorites(favorites: FavoriteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites))
  } catch (err) {
    console.error('Failed to save favorites:', err)
  }
}

export function isFavoriteUrl(favorites: FavoriteItem[], url: string): boolean {
  const norm = url.toLowerCase().trim().replace(/\/$/, '')
  return favorites.some((f) => f.result.url.toLowerCase().trim().replace(/\/$/, '') === norm)
}

/** Adds or removes a favorite. Returns the updated list. */
export function toggleFavorite(
  favorites: FavoriteItem[],
  result: SearchResult,
  sessionId: string,
  sessionSearchedAt: string
): FavoriteItem[] {
  const norm = result.url.toLowerCase().trim().replace(/\/$/, '')
  const exists = favorites.some(
    (f) => f.result.url.toLowerCase().trim().replace(/\/$/, '') === norm
  )

  if (exists) {
    return favorites.filter((f) => f.result.url.toLowerCase().trim().replace(/\/$/, '') !== norm)
  }

  return [
    { result, session_id: sessionId, session_searched_at: sessionSearchedAt, saved_at: new Date().toISOString() },
    ...favorites
  ]
}
