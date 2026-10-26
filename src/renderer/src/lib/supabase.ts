import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SearchResult, SearchSession } from '../types'

let cachedClient: SupabaseClient | null = null
let lastConfig = ''

/** Rejects empty values and the placeholder strings shipped in `.env.example`. */
export function sanitizeSupabaseConfig(url?: string, anonKey?: string): { url: string; anonKey: string } {
  const cleanUrl = (url || '').trim()
  const cleanKey = (anonKey || '').trim()
  const isPlaceholder =
    !cleanUrl ||
    !cleanKey ||
    /your-project|xxxx|example\.com/i.test(cleanUrl) ||
    /your-anon|xxxx|placeholder/i.test(cleanKey)
  if (isPlaceholder) return { url: '', anonKey: '' }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cleanUrl)) return { url: '', anonKey: '' }
  return { url: cleanUrl, anonKey: cleanKey }
}

export function getSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  const { url: finalUrl, anonKey: finalKey } = sanitizeSupabaseConfig(
    url || import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  if (!finalUrl || !finalKey) return null

  const configKey = `${finalUrl}:${finalKey}`
  if (cachedClient && lastConfig === configKey) {
    return cachedClient
  }

  try {
    cachedClient = createClient(finalUrl, finalKey)
    lastConfig = configKey
    return cachedClient
  } catch (err) {
    console.error('Supabase initialization failed:', err)
    return null
  }
}

/**
 * Ensures there is an authenticated Supabase user.
 *
 * Row-level security policies rely on `auth.uid()`, so cloud sync needs a real
 * session. The app has no login screen by design (local-first), therefore we
 * fall back to Supabase anonymous sign-in. Anonymous sign-ins must be enabled
 * once in the Supabase dashboard: Authentication → Providers → Anonymous.
 */
export async function ensureSupabaseSession(
  supabase: SupabaseClient
): Promise<{ userId?: string; error?: string }> {
  try {
    const { data } = await supabase.auth.getUser()
    if (data?.user) return { userId: data.user.id }
  } catch {
    // No session yet — try anonymous below.
  }

  try {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      const disabled = /anonymous/i.test(error.message) && /disabled|not enabled/i.test(error.message)
      return {
        error: disabled
          ? 'Supabase anonim girişi kapalı. Dashboard → Authentication → Providers → Anonymous seçeneğini açın.'
          : `Bulut oturumu açılamadı: ${error.message}`
      }
    }
    if (data?.user) return { userId: data.user.id }
    return { error: 'Bulut oturumu oluşturulamadı; gazete yerel olarak korunuyor.' }
  } catch (err) {
    return {
      error: err instanceof Error
        ? `Bulut oturumu açılamadı: ${err.message}`
        : 'Bulut oturumu açılamadı.'
    }
  }
}

export async function syncSessionToSupabase(session: SearchSession, supabase: SupabaseClient): Promise<void> {
  try {
    const auth = await ensureSupabaseSession(supabase)
    if (!auth.userId) {
      throw new Error(auth.error || 'Bulut kaydı için oturum açılması gerekiyor; gazete yerel olarak korunuyor.')
    }

    // Keep the local id as the cloud id so a later restore can match editions
    // instead of duplicating them. Upsert makes re-syncing the same edition safe.
    const { error: sessionErr } = await supabase
      .from('search_sessions')
      .upsert(
        {
          id: session.id,
          user_id: auth.userId,
          searched_at: session.searched_at,
          date_from: session.date_from,
          date_to: session.date_to,
          total_results: session.total_results
        },
        { onConflict: 'id' }
      )

    if (sessionErr) {
      throw new Error(sessionErr.message || 'Bulut gazete kaydı oluşturulamadı.')
    }

    if (session.results && session.results.length > 0) {
      const records = session.results.map((r) => ({
        id: r.id,
        session_id: session.id,
        category: r.category,
        query_label: r.query_label,
        query_type: r.query_type,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
        published_date: r.published_date ?? null,
        ai_summary: r.ai_summary || null,
        ai_headline: r.ai_headline || null,
        ai_takeaway: r.ai_takeaway || null,
        why_it_matters: r.why_it_matters || null,
        software_impact: r.software_impact || null,
        importance_score: r.importance_score ?? null,
        summary_status: r.summary_status || null,
        summary_model: r.summary_model || null
      }))

      const { error: resultsError } = await supabase
        .from('search_results')
        .upsert(records, { onConflict: 'id' })
      if (resultsError) throw new Error(`Haberler buluta yazılamadı: ${resultsError.message}`)
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Bulut senkronizasyonu tamamlanamadı.')
  }
}

/**
 * Fetches latest sessions from Supabase cloud database
 */
export async function fetchSessionsFromSupabase(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<SearchSession[]> {
  try {
    const auth = await ensureSupabaseSession(supabase)
    if (!auth.userId) {
      console.warn('Supabase fetch skipped:', auth.error)
      return []
    }

    const { data: sessionsData, error: sessErr } = await supabase
      .from('search_sessions')
      .select('*')
      .order('searched_at', { ascending: false })
      .limit(limit)

    if (sessErr) {
      throw new Error(`Bulut kayıtları okunamadı: ${sessErr.message}`)
    }
    if (!sessionsData || sessionsData.length === 0) return []

    const sessions: SearchSession[] = []

    for (const s of sessionsData) {
      const { data: resultsData, error: resultsErr } = await supabase
        .from('search_results')
        .select('*')
        .eq('session_id', s.id)

      if (resultsErr) {
        throw new Error(`Bulut haberleri okunamadı: ${resultsErr.message}`)
      }

      sessions.push({
        id: s.id,
        user_id: s.user_id,
        searched_at: s.searched_at,
        date_from: s.date_from,
        date_to: s.date_to,
        total_results: s.total_results || resultsData?.length || 0,
        results: (resultsData || []).map((r) => ({
          id: r.id,
          session_id: r.session_id,
          category: (r.category || 'news') as SearchResult['category'],
          query_label: r.query_label || '',
          query_type: (r.query_type === 'person' ? 'person' : 'interest') as SearchResult['query_type'],
          title: r.title || '',
          url: r.url || '',
          snippet: r.snippet || '',
          source: r.source || '',
          published_date: r.published_date || undefined,
          ai_summary: r.ai_summary || undefined,
          // Older rows only stored `ai_summary`; treat it as the "what is it" body.
          what_is_it: r.ai_summary || undefined,
          ai_headline: r.ai_headline || undefined,
          ai_takeaway: r.ai_takeaway || undefined,
          why_it_matters: r.why_it_matters || undefined,
          software_impact: r.software_impact || undefined,
          importance_score: r.importance_score ?? undefined,
          summary_status: (r.summary_status === 'pending' ? 'pending' : 'complete') as SearchResult['summary_status'],
          summary_model: r.summary_model || undefined,
          created_at: r.created_at || s.searched_at
        }))
      })
    }

    return sessions
  } catch (err) {
    throw err instanceof Error ? err : new Error('Bulut kayıtları okunamadı.')
  }
}

/**
 * Last-Write-Wins bidirectional sync: Merges local and cloud sessions seamlessly
 */
export function mergeSessionsLWW(
  localSessions: SearchSession[],
  cloudSessions: SearchSession[]
): SearchSession[] {
  const sessionMap = new Map<string, SearchSession>()

  // Insert local sessions
  for (const local of localSessions) {
    sessionMap.set(local.id, local)
  }

  // Merge cloud sessions with Last-Write-Wins based on searched_at
  for (const cloud of cloudSessions) {
    if (!sessionMap.has(cloud.id)) {
      sessionMap.set(cloud.id, cloud)
    } else {
      const existing = sessionMap.get(cloud.id)!
      const existingTime = new Date(existing.searched_at).getTime()
      const cloudTime = new Date(cloud.searched_at).getTime()
      if (cloudTime > existingTime) {
        sessionMap.set(cloud.id, cloud)
      }
    }
  }

  // Sort descending by searched_at
  return Array.from(sessionMap.values()).sort(
    (a, b) => new Date(b.searched_at).getTime() - new Date(a.searched_at).getTime()
  )
}

