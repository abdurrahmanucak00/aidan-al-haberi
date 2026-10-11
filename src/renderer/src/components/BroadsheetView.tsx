import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ExternalLink,
  Share2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Lightbulb,
  Zap,
  Check
} from 'lucide-react'
import { SearchResult } from '../types'
import { CATEGORY_CONFIG } from './categoryConstants'
import { hasCompleteSummary } from '../lib/gemini'

interface BroadsheetViewProps {
  results: SearchResult[]
  sessionId?: string
  searchedAt?: string
  onSelectStory?: (index: number) => void
}

export const BroadsheetView: React.FC<BroadsheetViewProps> = ({
  results,
  searchedAt,
  onSelectStory
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const formatDate = (dateStr?: string): string => {
    const d = dateStr ? new Date(dateStr) : new Date()
    return d.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!results || results.length === 0) {
    return null
  }

  const heroStory = results[0]
  const secondaryStories = results.slice(1, 3)
  const otherStories = results.slice(3)

  const handleShare = (story: SearchResult) => {
    const shareText = `📰 ${story.ai_headline || story.title}\n\n📌 NE ANLATILIYOR?:\n${hasCompleteSummary(story) ? story.what_is_it || story.ai_summary : 'Özet bekliyor; orijinal kaynak korunuyor.'}\n\n💡 NEDEN ÖNEMLİ?:\n${story.why_it_matters || story.ai_takeaway}\n\n🔗 ${story.url}\n(AI'dan Al Haberi Gazetesi)`
    navigator.clipboard.writeText(shareText)
    setCopiedId(story.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleOpenSource = (url: string) => {
    if (window.api && typeof window.api.openExternal === 'function') {
      window.api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-20">
      {/* VINTAGE BROADSHEET NEWSPAPER CONTAINER */}
      <div className="rounded-3xl border-4 border-stone-900 bg-[#faf5e8] p-6 sm:p-10 shadow-2xl space-y-8 text-stone-900">
        {/* MASTHEAD HEADER */}
        <header className="border-b-4 border-double border-stone-900 pb-5 text-center space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-bold border-b-2 border-stone-800 pb-2 text-stone-800 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(searchedAt)}</span>
            </div>
            <span className="bg-stone-900 text-[#faf5e8] px-2.5 py-0.5 rounded font-black text-[11px]">
              ÖZEL YAZILIM & AI BASKISI
            </span>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>{results.length} GELİŞME</span>
            </div>
          </div>

          <div>
            <h1 className="font-serif text-4xl sm:text-6xl font-black text-stone-950 uppercase tracking-tight drop-shadow-xs">
              AI&apos;DAN AL HABERİ
            </h1>
            <p className="font-serif italic text-xs sm:text-sm font-bold text-stone-700 tracking-widest uppercase mt-1">
              ★ GÜNLÜK YAPAY ZEKA, MODEL & AÇIK KAYNAK GELİŞMELERİ GAZETESİ ★
            </p>
          </div>
        </header>

        {/* HERO LEAD STORY (GÜNÜN BİRİNCİ MANŞETİ) */}
        {heroStory && (
          <section className="border-b-2 border-stone-800 pb-8 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-stone-900 text-[#faf5e8] text-xs font-mono font-black uppercase">
                <Sparkles className="w-3 h-3 text-amber-400 fill-current" />
                <span>GÜNÜN 1. MANŞETİ</span>
              </span>
              <span className="text-xs font-mono font-bold text-stone-600 uppercase">
                {heroStory.query_label} • {heroStory.source}
              </span>
            </div>

            <h2
              onClick={() => onSelectStory && onSelectStory(0)}
              className="font-serif text-2xl sm:text-4xl font-black text-stone-950 leading-tight hover:text-stone-700 cursor-pointer transition-colors"
            >
              {heroStory.ai_headline || heroStory.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {/* 1. Ne Anlatılıyor */}
              <div className="p-4 rounded-2xl bg-white/90 border border-stone-400 space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-stone-900 flex items-center gap-1 font-serif">
                  <Info className="w-3.5 h-3.5" />
                  <span>NE ANLATILIYOR?</span>
                </span>
                <p className="font-serif text-xs sm:text-sm leading-relaxed text-stone-800">
                  {hasCompleteSummary(heroStory) ? heroStory.what_is_it || heroStory.ai_summary : 'Özet bekliyor. Kaynak metni korunuyor; okuyucu görünümünden yeniden deneyebilirsiniz.'}
                </p>
              </div>

              {/* 2. Neden Önemli */}
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1 font-serif">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                  <span>NEDEN ÖNEMLİ?</span>
                </span>
                <p className="font-serif text-xs sm:text-sm leading-relaxed text-stone-800">
                  {hasCompleteSummary(heroStory) ? heroStory.why_it_matters || heroStory.ai_takeaway : 'Doğrulanmış değerlendirme henüz yok.'}
                </p>
              </div>

              {/* 3. Yazılım Etkisi & Aksiyon */}
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1 font-serif">
                    <Zap className="w-3.5 h-3.5 text-emerald-700" />
                    <span>YAZILIM ETKİSİ</span>
                  </span>
                  <p className="font-serif text-xs sm:text-sm leading-relaxed text-stone-800">
                    {hasCompleteSummary(heroStory) ? heroStory.software_impact : 'Teknik etki henüz analiz edilmedi.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-emerald-200">
                  <button
                    onClick={() => handleShare(heroStory)}
                    className="p-2 rounded-xl bg-white border border-stone-400 hover:bg-stone-100 text-stone-800 transition-all"
                  >
                    {copiedId === heroStory.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleOpenSource(heroStory.url)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-[#faf5e8] text-xs font-serif font-bold uppercase flex items-center justify-center gap-1"
                  >
                    <span>Kaynağı Oku</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECONDARY STORIES (2-SÜTUNLU İKİNCİ MANŞETLER) */}
        {secondaryStories.length > 0 && (
          <section className="border-b-2 border-stone-800 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x-2 divide-stone-400">
              {secondaryStories.map((story, sIdx) => {
                const globalIdx = sIdx + 1
                const meta = CATEGORY_CONFIG[story.category] || CATEGORY_CONFIG.news

                return (
                  <div key={story.id} className={`${sIdx === 1 ? 'md:pl-8' : 'md:pr-8'} pt-4 md:pt-0 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-stone-600 uppercase">
                        {story.query_label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                        {meta.label}
                      </span>
                    </div>

                    <h3
                      onClick={() => onSelectStory && onSelectStory(globalIdx)}
                      className="font-serif text-xl font-black text-stone-950 leading-snug hover:text-stone-700 cursor-pointer"
                    >
                      {story.ai_headline || story.title}
                    </h3>

                    <p className="font-serif text-xs sm:text-sm leading-relaxed text-stone-800 line-clamp-4">
                      {hasCompleteSummary(story) ? story.what_is_it || story.ai_summary : 'Özet bekliyor; orijinal kaynak korunuyor.'}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => handleShare(story)}
                        className="text-xs font-serif font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1"
                      >
                        {copiedId === story.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
                        <span>Paylaş</span>
                      </button>

                      <button
                        onClick={() => handleOpenSource(story.url)}
                        className="text-xs font-serif font-bold text-stone-900 hover:underline flex items-center gap-1"
                      >
                        <span>Detay & Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* COMPACT STORIES (3-SÜTUNLU DİĞER HABERLER) */}
        {otherStories.length > 0 && (
          <section className="space-y-4">
            <h4 className="font-serif font-black text-sm uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1">
              DİĞER ÖNEMLİ TEKNİK GELİŞMELER
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {otherStories.map((story, oIdx) => {
                const globalIdx = oIdx + 3
                return (
                  <motion.div
                    key={story.id}
                    whileHover={{ y: -2 }}
                    className="p-4 rounded-2xl bg-white/80 border border-stone-300 space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 uppercase">
                        <span>{story.query_label}</span>
                        <span>{story.source}</span>
                      </div>
                      <h5
                        onClick={() => onSelectStory && onSelectStory(globalIdx)}
                        className="font-serif text-sm font-black text-stone-950 leading-snug hover:text-stone-700 cursor-pointer line-clamp-2"
                      >
                        {story.ai_headline || story.title}
                      </h5>
                      <p className="font-serif text-xs text-stone-700 line-clamp-3 leading-relaxed">
                        {hasCompleteSummary(story) ? story.what_is_it || story.ai_summary : 'Özet bekliyor; orijinal kaynak korunuyor.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] font-serif font-bold text-stone-800">
                      <button
                        onClick={() => handleShare(story)}
                        className="hover:text-stone-950"
                      >
                        {copiedId === story.id ? 'Kopyalandı' : 'Paylaş'}
                      </button>
                      <button
                        onClick={() => handleOpenSource(story.url)}
                        className="hover:underline flex items-center gap-0.5"
                      >
                        <span>Kaynak</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
