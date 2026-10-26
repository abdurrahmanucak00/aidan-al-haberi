import React from 'react'
import { motion } from 'framer-motion'
import {
  History,
  Calendar,
  ArrowRight,
  Trash2,
  CheckCircle2,
  BookOpen,
  CloudDownload,
  Loader2
} from 'lucide-react'
import { SearchSession } from '../types'

export interface RestoreResult {
  ok: boolean
  message: string
}

interface HistoryViewProps {
  sessions: SearchSession[]
  activeSessionId?: string
  onSelectSession: (session: SearchSession) => void
  onClearHistory: () => void
  /** Defined only when cloud backup is configured; pulls editions from Supabase. */
  onRestoreFromCloud?: () => Promise<RestoreResult>
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onClearHistory,
  onRestoreFromCloud
}) => {
  const [isRestoring, setIsRestoring] = React.useState(false)
  const [restoreResult, setRestoreResult] = React.useState<RestoreResult | null>(null)

  const handleRestore = async (): Promise<void> => {
    if (!onRestoreFromCloud) return
    setIsRestoring(true)
    setRestoreResult(null)
    try {
      setRestoreResult(await onRestoreFromCloud())
    } catch (err) {
      setRestoreResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Buluttan geri yükleme başarısız oldu.'
      })
    } finally {
      setIsRestoring(false)
    }
  }

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr)
    return `${d.toLocaleDateString('tr-TR')} - ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24 px-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200 mb-1.5 shadow-2xs">
            <History className="w-3.5 h-3.5 text-sky-600" />
            <span>Oturum Kayıtları</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Geçmiş Gazeteler
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onRestoreFromCloud && (
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-sky-700 hover:bg-sky-50 border border-sky-200 transition-colors shadow-2xs disabled:opacity-60"
            >
              {isRestoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              <span>{isRestoring ? 'Yükleniyor...' : 'Buluttan Geri Yükle'}</span>
            </button>
          )}

          {sessions.length > 0 && (
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Tümünü Temizle</span>
            </button>
          )}
        </div>
      </div>

      {restoreResult && (
        <div
          role="status"
          className={`rounded-2xl border p-3.5 text-xs font-medium ${
            restoreResult.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {restoreResult.message}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-sky-100 bg-white p-10 text-center space-y-3 shadow-xl shadow-sky-900/5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <History className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Henüz geçmiş gazete yok</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Yeni bir gazete basarak yapay zeka ve yazılım takibine başlayın.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sessions.map((sess, idx) => {
            const isActive = sess.id === activeSessionId
            const topHeadline =
              sess.results?.[0]?.ai_headline || sess.results?.[0]?.title || 'Gelişme Özeti'

            return (
              <motion.div
                key={sess.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => onSelectSession(sess)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer bg-white shadow-xs ${
                  isActive
                    ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/40'
                    : 'border-sky-100 hover:border-sky-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-700">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(sess.searched_at)}</span>
                  </div>

                  <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700">
                    {sess.total_results} Sayfa
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-600 shrink-0" />
                  <p className="text-sm font-bold text-slate-800 line-clamp-1">
                    {topHeadline}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1 text-slate-600 font-medium">
                    <span>Sayı #{sessions.length - idx}</span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-sky-600 font-bold ml-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Açık</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 font-bold text-sky-600">
                    <span>Aç ve Oku</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
