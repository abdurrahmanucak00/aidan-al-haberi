import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SearchSession } from '../types'

let cachedClient: SupabaseClient | null = null
let lastConfig = ''

export function getSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  const finalUrl = url || import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  const finalKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

export async function syncSessionToSupabase(session: SearchSession, supabase: SupabaseClient): Promise<void> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) throw new Error('Bulut kaydı için oturum açılması gerekiyor; gazete yerel olarak korunuyor.')
    const { data: sessionData, error: sessionErr } = await supabase
      .from('search_sessions')
      .insert({
        user_id: auth.user.id,
        searched_at: session.searched_at,
        date_from: session.date_from,
        date_to: session.date_to,
        total_results: session.total_results
      })
      .select('id')
      .single()

    if (sessionErr || !sessionData) {
      throw new Error(sessionErr?.message || 'Bulut gazete kaydı oluşturulamadı.')
    }

    const sessionId = sessionData.id

    if (session.results && session.results.length > 0) {
      const records = session.results.map((r) => ({
        session_id: sessionId,
        category: r.category,
        query_label: r.query_label,
        query_type: r.query_type,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
        published_date: r.published_date,
        ai_summary: r.ai_summary || null
      }))

      const { error: resultsError } = await supabase.from('search_results').insert(records)
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
    const { data: sessionsData, error: sessErr } = await supabase
      .from('search_sessions')
      .select('*')
      .order('searched_at', { ascending: false })
      .limit(limit)

    if (sessErr || !sessionsData) {
      console.warn('Supabase fetch sessions error:', sessErr)
      return []
    }

    const sessions: SearchSession[] = []

    for (const s of sessionsData) {
      const { data: resultsData } = await supabase
        .from('search_results')
        .select('*')
        .eq('session_id', s.id)

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
          category: r.category,
          query_label: r.query_label,
          query_type: r.query_type,
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
          published_date: r.published_date,
          ai_summary: r.ai_summary,
          what_is_it: r.ai_summary,
          created_at: r.created_at || s.searched_at
        }))
      })
    }

    return sessions
  } catch (err) {
    console.error('Supabase fetch exception:', err)
    return []
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

