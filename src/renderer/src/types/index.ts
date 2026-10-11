export type CategoryType = 'new_model' | 'new_paper' | 'model_update' | 'tool_library' | 'news'

export interface SearchResult {
  id: string
  session_id?: string
  category: CategoryType
  query_label: string
  query_type: 'person' | 'interest'
  title: string
  url: string
  snippet: string
  source: string
  published_date?: string
  ai_summary?: string
  ai_headline?: string
  ai_takeaway?: string
  what_is_it?: string
  why_it_matters?: string
  software_impact?: string
  importance_score?: number
  summary_status?: 'complete' | 'pending'
  summary_error?: string
  summary_model?: string
  /** Full source text retained for retries without repeating Tavily searches. */
  full_content?: string
  ai_summary_en?: string
  ai_headline_en?: string
  ai_takeaway_en?: string
  created_at: string
  /** Kullanıcı tarafından yıldızlanmış mı */
  is_favorite?: boolean
  /** Ücretsiz arama modunda üretilen geçici sonuç mu */
  is_ad_hoc?: boolean
}

/** Favorilere eklenen bir haber kaydı (kaynak oturumdan bağımsız) */
export interface FavoriteItem {
  result: SearchResult
  session_id: string
  session_searched_at: string
  saved_at: string
}

export interface SearchSession {
  id: string
  user_id?: string
  searched_at: string
  date_from: string
  date_to: string
  total_results: number
  results: SearchResult[]
  /** Serbest arama modu ile üretilen tek seferlik oturum mu */
  ad_hoc_query?: string
}

export interface UserSettings {
  tracked_people: string[]
  interests: string[]
  tavily_key: string
  gemini_key: string
  gemini_backup_key?: string
  search_months?: number
  results_per_query?: number
  supabase_url?: string
  supabase_anon_key?: string
  updated_at: string
}

export interface ResearchLog {
  id: string
  timestamp: string
  type: 'info' | 'search' | 'ai' | 'success' | 'warning' | 'error'
  message: string
}

export type NewspaperViewMode = 'reader' | 'broadsheet'

export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

export interface CategoryMeta {
  label: string
  icon: string
  color: string
  badgeColor: string
  description: string
}

