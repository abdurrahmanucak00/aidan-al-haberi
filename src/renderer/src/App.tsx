import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radar } from 'lucide-react'
import { FavoriteItem, ResearchLog, SearchResult, SearchSession, UserSettings } from './types'
import {
  loadFavorites,
  loadSearchSessions,
  loadUserSettings,
  saveActiveResults,
  saveFavorites,
  saveSearchSessions,
  saveUserSettings,
  toggleFavorite
} from './lib/storage'
import { runIncrementalResearch, runAdHocSearch, retryPendingSummaries } from './lib/researchEngine'
import { fetchSessionsFromSupabase, getSupabaseClient, mergeSessionsLWW } from './lib/supabase'
import type { RestoreResult } from './components/HistoryView'
import { Navbar } from './components/Navbar'
import { MobileBottomNav } from './components/MobileBottomNav'
import { NewspaperStand } from './components/NewspaperStand'
import { NewspaperView } from './components/NewspaperView'
import { LiveResearchModal } from './components/LiveResearchModal'
import { DateRangeModal } from './components/DateRangeModal'
import { RadarSettings } from './components/RadarSettings'
import { HistoryView } from './components/HistoryView'
import { FavoritesView } from './components/FavoritesView'
import { TrendView } from './components/TrendView'

export type AppTab = 'stand' | 'favorites' | 'trends' | 'history' | 'settings'

export function App(): React.JSX.Element {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [sessions, setSessions] = useState<SearchSession[]>([])
  const [openedSession, setOpenedSession] = useState<SearchSession | null>(null)
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const sessionsRef = useRef<SearchSession[]>([])
  const openedSessionRef = useRef<SearchSession | null>(null)
  const operationRef = useRef(false)
  const [storageWarning, setStorageWarning] = useState('')
  openedSessionRef.current = openedSession

  const persistEdition = (session: SearchSession): void => {
    if (session.ad_hoc_query) {
      if (openedSessionRef.current?.id === session.id) {
        openedSessionRef.current = session
        setOpenedSession(session)
      }
      return
    }
    const next = [session, ...sessionsRef.current.filter((item) => item.id !== session.id)].slice(0, 30)
    const saved = saveSearchSessions(next)
    setStorageWarning(saved ? '' : 'Yerel kayıt başarısız: depolama alanı dolu veya erişilemiyor. Haberler şu anda bellekte; uygulamayı kapatmayın.')
    sessionsRef.current = next
    setSessions(next)
    if (openedSessionRef.current?.id === session.id) {
      openedSessionRef.current = session
      setOpenedSession(session)
    }
  }

  const [activeTab, setActiveTab] = useState<AppTab>('stand')

  // Live Research Engine State
  const [isSearching, setIsSearching] = useState(false)
  const [researchProgress, setResearchProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [researchLogs, setResearchLogs] = useState<ResearchLog[]>([])
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)

  // Initialize data on mount
  useEffect(() => {
    async function initData(): Promise<void> {
      const loadedSettings = await loadUserSettings()
      const loadedSessions = loadSearchSessions()
      const loadedFavorites = loadFavorites()

      setSettings(loadedSettings)
      sessionsRef.current = loadedSessions
      setSessions(loadedSessions)
      setFavorites(loadedFavorites)
    }

    initData()
  }, [])

  const handleToggleFavorite = (result: SearchResult): void => {
    const sessionId = openedSession?.id || ''
    const searchedAt = openedSession?.searched_at || new Date().toISOString()
    const next = toggleFavorite(favorites, result, sessionId, searchedAt)
    setFavorites(next)
    saveFavorites(next)
  }

  const handleOpenDateModal = (): void => {
    if (!settings) return
    if (!settings.tavily_key) {
      setActiveTab('settings')
      return
    }
    setIsDateModalOpen(true)
  }

  // Start incremental research execution with custom range
  const executeResearch = async (startDate?: string, endDate?: string, limit?: number): Promise<void> => {
    if (!settings || operationRef.current) return
    operationRef.current = true

    setIsSearching(true)
    setIsLiveModalOpen(true)
    setResearchProgress(5)
    setProgressStatus('Radar başlatılıyor...')
    setResearchLogs([])

    try {
      const customRange = startDate && endDate ? { startDate, endDate, resultsLimit: limit } : undefined

      const newSession = await runIncrementalResearch(
        settings,
        sessions.length > 0 ? sessions[0] : null,
        {
          onLog: (log) => {
            setResearchLogs((prev) => [...prev, log])
          },
          onProgress: (percent, status) => {
            setResearchProgress(percent)
            setProgressStatus(status)
          },
          onCheckpoint: persistEdition
        },
        sessionsRef.current,
        customRange
      )

      if (newSession.results.length > 0) {
        persistEdition(newSession)
        saveActiveResults(newSession.results)
        // Automatically open newly published newspaper edition
        setOpenedSession(newSession)
        setActiveTab('stand')
      }
    } catch (err: any) {
      setResearchLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36),
          timestamp: new Date().toLocaleTimeString('tr-TR'),
          type: 'error',
          message: `Hata: ${err.message || err}`
        }
      ])
    } finally {
      operationRef.current = false
      setIsSearching(false)
    }
  }

  // Resolve the owning edition by stable result id, even if the reader navigated away.
  const handleUpdateResult = (updated: SearchResult): void => {
    const owner = sessionsRef.current.find((session) => session.results.some((r) => r.id === updated.id))
      || (openedSessionRef.current?.results.some((r) => r.id === updated.id) ? openedSessionRef.current : null)
    if (!owner) return
    persistEdition({ ...owner, results: owner.results.map((r) => r.id === updated.id ? updated : r) })
    setFavorites((previous) => {
      const next = previous.map((favorite) => favorite.result.id === updated.id ? { ...favorite, result: updated } : favorite)
      saveFavorites(next)
      return next
    })
  }

  const executeSummaryRetry = async (): Promise<void> => {
    const session = openedSessionRef.current
    if (!session || !settings || operationRef.current) return
    operationRef.current = true
    setIsSearching(true)
    setIsLiveModalOpen(true)
    setResearchLogs([])
    setResearchProgress(0)
    setProgressStatus('Bekleyen özetler hazırlanıyor...')
    try {
      const updated = await retryPendingSummaries(session, settings, {
        onLog: (log) => setResearchLogs((previous) => [...previous, log]),
        onProgress: (percent, status) => { setResearchProgress(percent); setProgressStatus(status) },
        onCheckpoint: persistEdition
      })
      persistEdition(updated)
    } catch (err) {
      setResearchLogs((previous) => [...previous, {
        id: crypto.randomUUID(), timestamp: new Date().toLocaleTimeString('tr-TR'), type: 'error',
        message: err instanceof Error ? err.message : 'Özetler yeniden hazırlanamadı.'
      }])
    } finally {
      operationRef.current = false
      setIsSearching(false)
    }
  }

  // Save settings from Settings tab
  const handleSaveSettings = async (newSettings: UserSettings): Promise<void> => {
    setSettings(newSettings)
    await saveUserSettings(newSettings)
  }

  // Pull cloud editions and merge them into the local history (local wins on ties).
  const handleRestoreFromCloud = async (): Promise<RestoreResult> => {
    const client = getSupabaseClient(settings?.supabase_url, settings?.supabase_anon_key)
    if (!client) {
      return {
        ok: false,
        message: 'Bulut yapılandırılmamış. Ayarlar → Bulut Yedekleme bölümünden Supabase URL ve anon key gir.'
      }
    }

    const cloudSessions = await fetchSessionsFromSupabase(client, 30)
    if (cloudSessions.length === 0) {
      return {
        ok: false,
        message: 'Bulutta kayıtlı gazete bulunamadı. Bu cihazın anonim oturumuna ait yedek yok.'
      }
    }

    const localSessions = sessionsRef.current
    const merged = mergeSessionsLWW(localSessions, cloudSessions).slice(0, 30)
    const added = merged.filter((s) => !localSessions.some((l) => l.id === s.id)).length

    const saved = saveSearchSessions(merged)
    sessionsRef.current = merged
    setSessions(merged)

    if (!saved) {
      return {
        ok: false,
        message: `${cloudSessions.length} gazete buluttan okundu ama yerel kayıt başarısız (depolama dolu olabilir).`
      }
    }

    return {
      ok: true,
      message:
        added > 0
          ? `Buluttan ${cloudSessions.length} gazete okundu, ${added} yeni gazete eklendi. Toplam ${merged.length}.`
          : `Buluttan ${cloudSessions.length} gazete okundu; hepsi zaten yerelde vardı.`
    }
  }

  // One-off free-form search (bypasses the tracked list, not added to the stand)
  const executeFreeSearch = async (query: string): Promise<void> => {
    if (!settings || operationRef.current) return
    operationRef.current = true

    setIsSearching(true)
    setIsLiveModalOpen(true)
    setResearchProgress(5)
    setProgressStatus(`Serbest arama: ${query}`)
    setResearchLogs([])

    try {
      const session = await runAdHocSearch(
        settings,
        { query, resultsLimit: 8, days: 90 },
        {
          onLog: (log) => setResearchLogs((prev) => [...prev, log]),
          onProgress: (percent, status) => {
            setResearchProgress(percent)
            setProgressStatus(status)
          }
        }
      )

      if (session.results.length > 0) {
        setOpenedSession(session)
        setActiveTab('stand')
      }
    } catch (err: any) {
      setResearchLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36),
          timestamp: new Date().toLocaleTimeString('tr-TR'),
          type: 'error',
          message: `Hata: ${err.message || err}`
        }
      ])
    } finally {
      operationRef.current = false
      setIsSearching(false)
    }
  }

  const hasKeys = Boolean(settings?.tavily_key && settings?.gemini_key)

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090d] text-slate-100">
        <div className="flex items-center gap-3">
          <Radar className="w-6 h-6 text-emerald-400 animate-spin" />
          <span className="text-sm font-bold text-white">AI&apos;dan Al Haberi başlatılıyor...</span>
        </div>
      </div>

    )
  }

  return (
    <div className="min-h-screen bg-[#ffffff] text-slate-900 flex flex-col selection:bg-slate-500/20 selection:text-slate-900">
      {/* Top Header */}
      <Navbar
        settings={settings}
        isSearching={isSearching}
        onStartResearch={handleOpenDateModal}
        onOpenSettings={() => setActiveTab('settings')}
        onFreeSearch={executeFreeSearch}
      />

      {storageWarning && <div role="alert" className="mx-auto mt-4 max-w-5xl rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950">{storageWarning}</div>}

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {/* TAB 1: Newspaper Stand / Reader */}
          {activeTab === 'stand' && (
            <motion.div
              key="stand-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {openedSession ? (
                <NewspaperView
                  key={openedSession.id}
                  results={openedSession.results}
                  sessionId={openedSession.id}
                  searchedAt={openedSession.searched_at}
                  geminiKey={settings.gemini_key}
                  geminiBackupKey={settings.gemini_backup_key}
                  summariesBusy={isSearching}
                  onRetryPending={executeSummaryRetry}
                  onUpdateResult={handleUpdateResult}
                  onBackToStand={() => setOpenedSession(null)}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  adHocQuery={openedSession.ad_hoc_query}
                />

              ) : (
                <NewspaperStand
                  sessions={sessions}
                  onOpenSession={(sess) => setOpenedSession(sess)}
                  onStartResearch={handleOpenDateModal}
                  isSearching={isSearching}
                  hasKeys={hasKeys}
                  onOpenSettings={() => setActiveTab('settings')}
                />
              )}
            </motion.div>
          )}

          {/* TAB 2: Favorites */}
          {activeTab === 'favorites' && (
            <motion.div
              key="favorites-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <FavoritesView
                favorites={favorites}
                onRemoveFavorite={(item) => {
                  const next = favorites.filter(
                    (f) => f.result.url !== item.result.url || f.saved_at !== item.saved_at
                  )
                  setFavorites(next)
                  saveFavorites(next)
                }}
                onOpenSource={(url) => {
                  if (window.api && typeof window.api.openExternal === 'function') {
                    window.api.openExternal(url)
                  } else {
                    window.open(url, '_blank')
                  }
                }}
              />
            </motion.div>
          )}

          {/* TAB 3: Trends */}
          {activeTab === 'trends' && (
            <motion.div
              key="trends-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TrendView sessions={sessions} />
            </motion.div>
          )}

          {/* TAB 4: History */}
          {activeTab === 'history' && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <HistoryView
                sessions={sessions}
                activeSessionId={openedSession?.id}
                onSelectSession={(sess) => {
                  setOpenedSession(sess)
                  setActiveTab('stand')
                }}
                onClearHistory={() => {
                  sessionsRef.current = []
                  setSessions([])
                  saveSearchSessions([])
                  setOpenedSession(null)
                }}
                onRestoreFromCloud={handleRestoreFromCloud}
              />
            </motion.div>
          )}

          {/* TAB 5: Settings */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <RadarSettings settings={settings} onSaveSettings={handleSaveSettings} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Tab Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
        }}
        unreadCount={sessions.length}
        favoritesCount={favorites.length}
        hasMissingKeys={!hasKeys}
      />

      {/* Interactive Date Range & News Density Mini Calendar Modal */}
      <DateRangeModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        defaultMonths={settings.search_months || 6}
        defaultLimit={settings.results_per_query || 8}
        onConfirm={(startDate, endDate, limit) => {
          executeResearch(startDate, endDate, limit)
        }}
      />

      {/* Live Research Terminal Modal */}
      <LiveResearchModal
        isOpen={isLiveModalOpen}
        isSearching={isSearching}
        progress={researchProgress}
        progressStatus={progressStatus}
        logs={researchLogs}
        onClose={() => setIsLiveModalOpen(false)}
      />
    </div>
  )
}

export default App
