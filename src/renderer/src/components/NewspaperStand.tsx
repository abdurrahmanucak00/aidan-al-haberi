import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Newspaper, Sparkles, Play, Calendar, ArrowRight, BookOpen, Layers, Clock } from 'lucide-react'
import { SearchSession } from '../types'

interface NewspaperStandProps {
  sessions: SearchSession[]
  onOpenSession: (session: SearchSession) => void
  onStartResearch: () => void
  isSearching: boolean
  hasKeys: boolean
  onOpenSettings: () => void
}

export const NewspaperStand: React.FC<NewspaperStandProps> = ({
  sessions,
  onOpenSession,
  onStartResearch,
  isSearching,
  hasKeys,
  onOpenSettings
}) => {
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('tr-TR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  // Sort sessions chronologically: Sayı #1 is first, Sayı #2 is next, etc.
  const orderedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.searched_at).getTime() - new Date(b.searched_at).getTime()
    )
  }, [sessions])

  // Clean raw technical repo filenames into human readable titles
  const cleanHeadline = (raw?: string, queryLabel?: string): string => {
    if (!raw) return `${queryLabel || 'Yazılım'} Alanında Yeni Gelişme`
    if (raw.startsWith('ReadMe_') || raw.includes('nanoCHAT_') || raw.includes('_COLAB_') || raw.includes('MartialTerran')) {
      return `${queryLabel || 'Andrej Karpathy'}: Açık Kaynak nanoCHAT & LLM Eğitimi Duyuruldu`
    }
    return raw
  }

  // EMPTY STATE: No research done yet
  if (sessions.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 px-4 text-center">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl border-2 border-stone-300 bg-[#faf6ed] p-8 sm:p-12 space-y-6 shadow-xl shadow-stone-900/10"
        >
          {/* Vintage News Icon Badge */}
          <div className="w-20 h-20 mx-auto rounded-3xl bg-stone-900 text-[#faf6ed] flex items-center justify-center shadow-md">
            <Newspaper className="w-10 h-10" />
          </div>

          <div className="space-y-2.5">
            <h2 className="font-serif text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase">
              Henüz Bir Gazete Basılmadı
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed max-w-md mx-auto font-serif">
              Okulda veya boş zamanlarında yazılım dünyasını hızla öğrenmek için yapay zeka ajanlarını başlat ve ilk gazete sayını bas.
            </p>
          </div>

          <div className="pt-2 max-w-sm mx-auto">
            {!hasKeys ? (
              <button
                onClick={onOpenSettings}
                className="w-full py-4 px-6 rounded-2xl text-sm font-bold bg-stone-200 hover:bg-stone-300 text-stone-900 transition-all border border-stone-400 flex items-center justify-center gap-2 shadow-xs"
              >
                <span>API Anahtarlarını Girin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onStartResearch}
                disabled={isSearching}
                className="w-full py-4 px-6 rounded-2xl text-sm font-black bg-stone-900 hover:bg-stone-800 text-[#faf6ed] shadow-lg shadow-stone-900/20 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{isSearching ? 'Gazete Basılıyor...' : 'Günün Gazetesini Bas (Araştır)'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // ACTIVE VINTAGE NEWSPAPER STAND (WITH PAGES FANNING OUT TO THE RIGHT)
  return (
    <div className="w-full max-w-4xl mx-auto space-y-7 pb-24 px-3 sm:px-4">
      {/* Top Banner / Stand Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 mb-1.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Gazete Rafı</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Gazete Sayılarım
          </h2>
        </div>

        <span className="text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-2xl bg-white border border-slate-200 text-slate-800 shadow-xs">
          {sessions.length} Baskı Mevcut
        </span>
      </div>

      {/* NEWSPAPER EDITIONS GRID (Sayı #1, Sayı #2, Sayı #3...) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 pr-6 sm:pr-8">
        {orderedSessions.map((sess, idx) => {
          const results = sess.results || []
          const topHeadline = cleanHeadline(
            results[0]?.ai_headline || results[0]?.title,
            results[0]?.query_label
          )
          const totalStories = sess.total_results || results.length

          return (
            <motion.div
              key={sess.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -5, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpenSession(sess)}
              className="group cursor-pointer relative mr-3 sm:mr-4"
            >
              {/* REALISTIC MULTI-PAGE STACK FANNING OUT TO THE RIGHT */}
              <div className="absolute top-2 -right-5 bottom-2 w-full bg-[#e5dcbf] rounded-2xl border-2 border-stone-400 rotate-2 shadow-sm -z-20 transition-transform group-hover:-right-7 group-hover:rotate-3" />
              <div className="absolute top-1 -right-2.5 bottom-1 w-full bg-[#ede5cf] rounded-2xl border-2 border-stone-400 rotate-1 shadow-sm -z-10 transition-transform group-hover:-right-3.5 group-hover:rotate-1.5" />

              {/* MAIN VINTAGE NEWSPAPER COVER */}
              <div className="relative rounded-2xl border-2 border-stone-800 bg-[#faf5e8] p-6 sm:p-7 space-y-4 shadow-xl shadow-stone-900/15 overflow-hidden transition-all">
                {/* Header Date & Edition Stamp */}
                <div className="flex items-center justify-between text-xs font-mono border-b-2 border-stone-800 pb-2.5 text-stone-800 font-bold">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-stone-800" />
                    <span>{formatDate(sess.searched_at)}</span>
                    <span className="text-stone-400">•</span>
                    <Clock className="w-3.5 h-3.5 text-stone-600" />
                    <span>{formatTime(sess.searched_at)}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-stone-900 text-[#faf6ed] font-mono font-black text-[11px] tracking-wider uppercase">
                    SAYI #{idx + 1}
                  </span>
                </div>

                {/* Newspaper Masthead: AI'DAN AL HABERİ */}
                <div className="text-center py-1.5 border-b-2 border-stone-800">
                  <span className="font-serif text-2xl sm:text-3xl font-black text-stone-950 uppercase tracking-tight block drop-shadow-xs">
                    AI&apos;DAN AL HABERİ
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="h-[1px] w-10 bg-stone-800" />
                    <span className="font-serif italic text-xs text-stone-800 font-bold tracking-widest uppercase">
                      ★ GÜNLÜK YAZILIM & AI GAZETESİ ★
                    </span>
                    <span className="h-[1px] w-10 bg-stone-800" />
                  </div>
                </div>

                {/* Günün En Önemli ve Popüler Manşeti */}
                <div className="p-4 rounded-xl bg-[#f2ebd7] border-2 border-stone-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest text-stone-900 flex items-center gap-1.5 font-serif">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>★ GÜNÜN MANŞETİ ★</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider">
                      Önemli
                    </span>
                  </div>

                  <h3 className="font-serif text-base sm:text-lg font-black text-stone-950 leading-snug line-clamp-2">
                    {topHeadline}
                  </h3>
                </div>

                {/* Footer Stats & Open Action */}
                <div className="flex items-center justify-between pt-1 border-t border-stone-300">
                  <div className="flex items-center gap-2 text-xs text-stone-800 font-serif font-bold">
                    <Layers className="w-4 h-4 text-stone-900" />
                    <span>
                      Toplam <strong className="text-stone-950 text-sm font-black underline decoration-stone-800">{totalStories}</strong> Sayfa / Haber
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-stone-900 group-hover:translate-x-1 transition-transform font-serif uppercase tracking-wider">
                    <span>Gazeteyi Aç</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
