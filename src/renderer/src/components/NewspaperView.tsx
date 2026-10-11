import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Share2,
  RefreshCw,
  BookOpen,
  ArrowLeft,
  List,
  Check,
  Zap,
  Info,
  Lightbulb,
  Filter,
  LayoutGrid,
  FileText,
  Star,
  User,
  Hash
} from 'lucide-react'
import { SearchResult, CategoryType, NewspaperViewMode } from '../types'
import { CATEGORY_CONFIG } from './categoryConstants'
import { hasCompleteSummary, summarizeSingleStoryWithGemini } from '../lib/gemini'
import { BroadsheetView } from './BroadsheetView'
import { FavoriteItem } from '../types'
import { isFavoriteUrl } from '../lib/storage'

interface NewspaperViewProps {
  results: SearchResult[]
  sessionId?: string
  searchedAt?: string
  geminiKey: string
  geminiBackupKey?: string
  summariesBusy?: boolean
  onRetryPending?: () => Promise<void>
  onUpdateResult?: (updated: SearchResult) => void
  onBackToStand?: () => void
  favorites?: FavoriteItem[]
  onToggleFavorite?: (result: SearchResult) => void
  adHocQuery?: string
}

export const NewspaperView: React.FC<NewspaperViewProps> = ({
  results,
  sessionId = 'default_session',
  searchedAt,
  geminiKey,
  geminiBackupKey,
  summariesBusy = false,
  onRetryPending,
  onUpdateResult,
  onBackToStand,
  favorites = [],
  onToggleFavorite,
  adHocQuery
}) => {
  const [viewMode, setViewMode] = useState<NewspaperViewMode>('reader')
  // Load saved reading page for this session
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_al_haberi_last_page_' + sessionId)
      if (saved !== null) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 0 && parsed < results.length) {
          return parsed
        }
      }
    } catch {}
    return 0
  })


  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'all'>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [lang, setLang] = useState<'tr' | 'en'>('tr')
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<{ id: string; message: string } | null>(null)
  const pendingCount = results.filter((item) => !hasCompleteSummary(item)).length
  const [showToc, setShowToc] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showRawSource, setShowRawSource] = useState(false)

  // Save reading page to localStorage when currentPage changes
  useEffect(() => {
    if (sessionId) {
      try {
        localStorage.setItem('ai_al_haberi_last_page_' + sessionId, String(currentPage))
      } catch {}
    }
  }, [currentPage, sessionId])

  // Available sources (tracked people / interests) present in this edition
  const availableSources = useMemo(() => {
    const map = new Map<string, 'person' | 'interest'>()
    results.forEach((r) => {
      if (r.query_label && !map.has(r.query_label)) {
        map.set(r.query_label, r.query_type)
      }
    })
    return Array.from(map.entries()).map(([label, type]) => ({ label, type }))
  }, [results])

  const favoriteUrls = useMemo(
    () => new Set(favorites.map((f) => f.result.url.toLowerCase().trim().replace(/\/$/, ''))),
    [favorites]
  )

  // Filter results based on selected category, source and favorite-only toggle
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false
      if (selectedSource !== 'all' && item.query_label !== selectedSource) return false
      if (onlyFavorites) {
        const norm = item.url.toLowerCase().trim().replace(/\/$/, '')
        if (!favoriteUrls.has(norm)) return false
      }
      return true
    })
  }, [results, selectedCategory, selectedSource, onlyFavorites, favoriteUrls])

  // Count items per category for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: results.length }
    results.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1
    })
    return counts
  }, [results])

  const totalPages = filteredResults.length
  const currentItem = filteredResults[currentPage] || filteredResults[0]

  // Reset page index if any filter changes
  useEffect(() => {
    setCurrentPage(0)
  }, [selectedCategory, selectedSource, onlyFavorites])

  const cleanHeadlineText = (raw?: string, queryLabel?: string): string => {
    if (!raw) return `${queryLabel || 'AI'} Alanında Yeni Gelişme`
    // GitHub readme / notebook dosya adlarını okunabilir bir başlığa çevir
    const repoLikeMatch = raw.match(/^ReadMe[_-]?(.+?)(?:\.md)?$/i) || raw.match(/^(.+?)_COLAB$/i)
    if (repoLikeMatch && repoLikeMatch[1]) {
      const name = repoLikeMatch[1].replace(/[_-]+/g, ' ').trim()
      return `${queryLabel || 'AI'}: "${name}" Açık Kaynak Projesi Yayınlandı`
    }
    return raw
  }

  // Reading and page navigation never issue API requests. Retries are explicit actions.

  const handleTranslateCurrent = async (): Promise<void> => {
    if (!currentItem || (!geminiKey && !geminiBackupKey) || isTranslating || summariesBusy) return

    try {
      setIsTranslating(true)
      setTranslatingId(currentItem.id)
      setRetryError(null)
      const analysis = await summarizeSingleStoryWithGemini(
        {
          title: currentItem.title,
          snippet: currentItem.full_content || currentItem.snippet,
          url: currentItem.url,
          query_label: currentItem.query_label,
          category: currentItem.category
        },
        geminiKey,
        geminiBackupKey
      )

      const updated: SearchResult = {
        ...currentItem,
        ...analysis,
        ai_headline: analysis.ai_headline,
        ai_summary: analysis.what_is_it || analysis.ai_summary,
        ai_takeaway: analysis.why_it_matters || analysis.ai_takeaway,
        what_is_it: analysis.what_is_it,
        why_it_matters: analysis.why_it_matters,
        software_impact: analysis.software_impact,
        ai_headline_en: analysis.ai_headline_en,
        ai_summary_en: analysis.ai_summary_en,
        ai_takeaway_en: analysis.ai_takeaway_en
      }

      if (onUpdateResult) {
        onUpdateResult(updated)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gemini yanıt vermedi.'
      setRetryError({ id: currentItem.id, message })
      // Failed refreshes never overwrite an existing successful summary.
      if (!hasCompleteSummary(currentItem)) onUpdateResult?.({ ...currentItem, summary_status: 'pending', summary_error: message })
    } finally {
      setIsTranslating(false)
      setTranslatingId(null)
    }
  }

  const handlePrev = (): void => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNext = (): void => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages])

  if (!currentItem || totalPages === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] p-8 space-y-4 shadow-xl">
          <Filter className="w-10 h-10 text-stone-800 mx-auto" />
          <h3 className="font-serif text-xl font-bold text-stone-900">
            Bu kategoride ({selectedCategory}) henüz bir haber bulunamadı.
          </h3>
          <button
            onClick={() => setSelectedCategory('all')}
            className="px-5 py-2.5 rounded-2xl bg-stone-900 text-[#faf6ed] font-serif text-xs font-bold uppercase"
          >
            Tüm Sayfaları Göster ({results.length})
          </button>
        </div>
      </div>
    )
  }

  const catMeta = CATEGORY_CONFIG[currentItem.category] || CATEGORY_CONFIG.news

  // Dynamic Headline and Summaries based on active Language (TR / EN)
  const rawHead = lang === 'tr' ? currentItem.ai_headline || currentItem.title : currentItem.ai_headline_en || currentItem.title
  const headline = lang === 'tr' ? cleanHeadlineText(rawHead, currentItem.query_label) : rawHead

  const complete = hasCompleteSummary(currentItem)
  const loadingCurrent = translatingId === currentItem.id
  const whatIsIt = lang === 'tr'
    ? loadingCurrent ? 'Gemini kaynak metnini okuyor ve Türkçe özet hazırlıyor...'
      : complete ? currentItem.what_is_it || currentItem.ai_summary : 'Türkçe özet henüz hazır değil. Orijinal kaynak metni aşağıda korunuyor.'
    : currentItem.ai_summary_en || currentItem.snippet
  const whyItMatters = lang === 'tr'
    ? loadingCurrent ? 'Teknik değerlendirme hazırlanıyor...'
      : complete ? currentItem.why_it_matters || currentItem.ai_takeaway : 'Özet bekliyor; doğrulanmış teknik değerlendirme henüz yok.'
    : 'No English AI analysis was generated; the original source text is shown above.'
  const softwareImpact = lang === 'tr'
    ? loadingCurrent ? 'Yazılım etkisi değerlendiriliyor...'
      : complete ? currentItem.software_impact : 'Özet tamamlanmadan teknik etki veya önem puanı atanmıyor.'
    : 'No English impact assessment is available.'

  const handleOpenSource = (): void => {
    if (window.api && typeof window.api.openExternal === 'function') {
      window.api.openExternal(currentItem.url)
    } else {
      window.open(currentItem.url, '_blank')
    }
  }

  const handleShare = (): void => {
    const shareText = `📰 ${headline}\n\n📌 NE ANLATILIYOR?:\n${whatIsIt}\n\n💡 NEDEN ÖNEMLİ?:\n${whyItMatters}\n\n⚡ YAZILIM DÜNYASINA ETKİLERİ:\n${softwareImpact}\n\n🔗 Kaynak: ${currentItem.url}\n(AI'dan Al Haberi Gazetesi)`
    navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filterTabs: Array<{ id: CategoryType | 'all'; label: string; icon: string }> = [
    { id: 'all', label: 'Tüm Sayfalar', icon: '📰' },
    { id: 'new_model', label: 'Modeller', icon: '🤖' },
    { id: 'new_paper', label: 'Makaleler', icon: '📄' },
    { id: 'tool_library', label: 'Araçlar & Kod', icon: '🛠️' },
    { id: 'model_update', label: 'Güncellemeler', icon: '⚡' },
    { id: 'news', label: 'Haberler', icon: '🌐' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-4xl mx-auto space-y-4 pb-24 px-3 sm:px-4"
    >
      {/* TOP NAVIGATION BAR */}
      <div className="flex items-center justify-between gap-2">
        {onBackToStand && (
          <button
            onClick={onBackToStand}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-[#faf6ed] text-stone-800 hover:bg-[#f3ebd7] border-2 border-stone-800 transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-stone-900" />
            <span className="font-serif font-black uppercase tracking-wider">
              {adHocQuery ? 'Aramayı Kapat' : 'Gazetelerim'}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Reader vs Broadsheet */}
          <div className="flex items-center bg-[#faf6ed] p-0.5 rounded-2xl border-2 border-stone-800 shadow-xs">
            <button
              onClick={() => setViewMode('reader')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-serif font-bold transition-all ${
                viewMode === 'reader'
                  ? 'bg-stone-900 text-[#faf6ed] shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
              title="Sayfa Çevirmeli Okuyucu"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sayfa</span>
            </button>
            <button
              onClick={() => setViewMode('broadsheet')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-serif font-bold transition-all ${
                viewMode === 'broadsheet'
                  ? 'bg-stone-900 text-[#faf6ed] shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
              title="Geniş Gazete Manşeti"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manşet</span>
            </button>
          </div>

          {/* Table of Contents Trigger */}
          <button
            onClick={() => setShowToc(!showToc)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-[#faf6ed] text-stone-800 hover:bg-[#f3ebd7] border-2 border-stone-800 transition-all shadow-xs"
          >
            <List className="w-3.5 h-3.5 text-stone-900" />
            <span className="font-serif font-bold">İçindekiler</span>
          </button>

          {/* TR / ENG Toggle Button */}
          <button
            onClick={() => setLang((prev) => (prev === 'tr' ? 'en' : 'tr'))}
            className="px-3 py-2 rounded-2xl text-xs font-black bg-[#faf6ed] border-2 border-stone-800 text-stone-900 hover:bg-stone-900 hover:text-[#faf6ed] transition-all shadow-xs font-mono flex items-center gap-1"
            title="Dili Değiştir (TR / ENG)"
          >
            <span>🌐</span>
            <span>{lang.toUpperCase()}</span>
          </button>

          {/* Favorite Current Story */}
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(currentItem)}
              className={`p-2 rounded-2xl border-2 transition-all shadow-xs ${
                isFavoriteUrl(favorites, currentItem.url)
                  ? 'bg-amber-100 border-amber-500 text-amber-600'
                  : 'bg-[#faf6ed] border-stone-800 text-stone-900 hover:bg-[#f3ebd7]'
              }`}
              title={
                isFavoriteUrl(favorites, currentItem.url)
                  ? 'Favorilerden Çıkar'
                  : 'Favorilere Ekle'
              }
            >
              <Star
                className={`w-4 h-4 ${
                  isFavoriteUrl(favorites, currentItem.url) ? 'fill-current' : ''
                }`}
              />
            </button>
          )}

          {/* Gemini Re-analyze Trigger */}
          <button
            onClick={handleTranslateCurrent}
            disabled={isTranslating || summariesBusy || (!geminiKey && !geminiBackupKey)}
            className="p-2 rounded-2xl bg-[#faf6ed] border-2 border-stone-800 text-stone-900 hover:bg-[#f3ebd7] transition-all shadow-xs"
            title="Detaylı Türkçe Yeniden Özetle"
          >
            <RefreshCw className={`w-4 h-4 ${isTranslating ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>


      {/* AD-HOC SEARCH BANNER */}
      {adHocQuery && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-50 border-2 border-sky-300 shadow-2xs">
          <Filter className="w-4 h-4 text-sky-700 shrink-0" />
          <p className="text-[11px] font-serif text-sky-900">
            <span className="font-black">Serbest arama sonucu:</span>{' '}
            &ldquo;{adHocQuery}&rdquo; · Bu sonuçlar kaydedilmedi, sadece inceleme amaçlıdır.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 text-sm text-stone-900 space-y-2" aria-live="polite">
        <p className="font-bold">{results.length - pendingCount}/{results.length} özet hazır · {pendingCount} özet bekliyor</p>
        {pendingCount > 0 && onRetryPending && (
          <button onClick={onRetryPending} disabled={isTranslating || summariesBusy || (!geminiKey && !geminiBackupKey)}
            className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 font-bold text-amber-900 disabled:opacity-50">
            Bekleyen Özetleri Tamamla ({pendingCount})
          </button>
        )}
        {!complete && <p>Bu haberin özeti henüz hazır değil. Kaynak korunuyor; sayfa değiştirmek otomatik API isteği göndermez.</p>}
        {(retryError?.id === currentItem.id || (!complete && currentItem.summary_error)) && (
          <p role="alert" className="break-words text-amber-900">Son deneme: {retryError?.id === currentItem.id ? retryError.message : currentItem.summary_error}</p>
        )}
        {complete && currentItem.summary_model && <p className="text-xs text-stone-600">Özet modeli: {currentItem.summary_model}</p>}
      </div>

      {/* CATEGORY FILTER TABS (Makaleler, Modeller, Araçlar, Tümü) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {filterTabs.map((tab) => {
          const count = categoryCounts[tab.id] || 0
          if (tab.id !== 'all' && count === 0) return null
          const isActive = selectedCategory === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-serif font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-stone-900 text-[#faf6ed] shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* SOURCE FILTER (Kişi / Konu) */}
      {availableSources.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 shrink-0 pl-0.5">
            Kaynak:
          </span>
          <button
            onClick={() => setSelectedSource('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
              selectedSource === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-300'
            }`}
          >
            Tümü
          </button>
          {availableSources.map((src) => {
            const isActive = selectedSource === src.label
            return (
              <button
                key={src.label}
                onClick={() => setSelectedSource(src.label)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-300'
                }`}
              >
                {src.type === 'person' ? <User className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                <span>{src.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* FAVORITES TOGGLE */}
      {favorites.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyFavorites((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              onlyFavorites
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-300'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
            <span>Sadece Favorilerim</span>
            <span className="font-mono">({favorites.length})</span>
          </button>
        </div>
      )}

      {/* TABLE OF CONTENTS MODAL (WITH CATEGORY FILTERING) */}
      <AnimatePresence>
        {showToc && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] p-5 sm:p-6 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-stone-900 flex items-center gap-1.5 font-serif">
                <BookOpen className="w-4 h-4 text-stone-900" />
                <span>Gazete İndeksi ({filteredResults.length} Sayfa)</span>
              </span>
              <button
                onClick={() => setShowToc(false)}
                className="text-xs font-bold text-stone-600 hover:text-stone-950 font-serif"
              >
                ✕ Kapat
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredResults.map((item, idx) => {
                const itemHead = cleanHeadlineText(
                  lang === 'tr' ? item.ai_headline || item.title : item.ai_headline_en || item.title,
                  item.query_label
                )
                const isSelected = idx === currentPage
                const meta = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.news

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentPage(idx)
                      setShowToc(false)
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-2 border-stone-900 bg-stone-900 text-[#faf6ed] font-bold shadow-xs'
                        : 'border-stone-300 bg-white/80 text-stone-800 hover:border-stone-800 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                        isSelected ? 'bg-[#faf6ed] text-stone-900' : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold font-mono text-stone-500 uppercase">{item.query_label}</span>
                        <span className="text-[10px] text-stone-400">•</span>
                        <span className="text-[10px] text-stone-600 font-bold">{meta.label}</span>
                      </div>
                      <p className="line-clamp-1 leading-snug font-serif">{itemHead}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {viewMode === 'broadsheet' ? (
        <BroadsheetView
          results={filteredResults}
          sessionId={sessionId}
          searchedAt={searchedAt}
          onSelectStory={(idx) => {
            setCurrentPage(idx)
            setViewMode('reader')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      ) : (
        /* VINTAGE NEWSPAPER SINGLE STORY PAGE */
        <div className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] shadow-2xl p-6 sm:p-9 space-y-6">
          {/* Top Header Badge & Category */}
          <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3.5">
            <span className="px-3 py-1 rounded-md text-xs font-mono font-black bg-stone-900 text-[#faf6ed] tracking-wider uppercase">
              SAYFA {String(currentPage + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${catMeta.badgeColor}`}
            >
              <span>{catMeta.icon}</span>
              <span>{catMeta.label}</span>
            </span>
          </div>

          {/* Newspaper Headline */}
          <motion.div
            key={`headline-${currentPage}-${lang}-${selectedCategory}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2.5 border-b-2 border-stone-300 pb-4"
          >
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-700 uppercase tracking-wider">
              <span>{currentItem.query_label}</span>
              <span className="text-stone-400">•</span>
              <span className="text-stone-600 font-normal">{currentItem.source}</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black text-stone-950 leading-tight tracking-tight drop-shadow-2xs">
              {headline}
            </h2>
          </motion.div>

          {/* 3 STRUCTURED INSIGHT CARDS */}
          <motion.div
            key={`content-${currentPage}-${lang}-${selectedCategory}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* 1. NE ANLATILIYOR? */}
            <div className="rounded-2xl border-2 border-stone-400 bg-white/90 p-5 sm:p-6 space-y-2.5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-black text-stone-900 uppercase tracking-wider font-serif border-b border-stone-200 pb-1.5">
                <Info className="w-4 h-4 text-stone-900" />
                <span>{lang === 'tr' ? '📌 NE ANLATILIYOR?' : '📌 WHAT IS IT?'}</span>
              </div>
              <p className="font-serif text-sm sm:text-base leading-relaxed text-stone-900 whitespace-pre-line font-medium">
                {whatIsIt}
              </p>
            </div>

            {/* 2. NEDEN ÖNEMLİ? */}
            <div className="rounded-2xl border-l-4 border-amber-600 bg-amber-50/80 border border-amber-300 p-5 sm:p-6 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider font-serif">
                <Lightbulb className="w-4 h-4 text-amber-700" />
                <span>{lang === 'tr' ? '💡 NEDEN ÖNEMLİ?' : '💡 WHY IT MATTERS'}</span>
              </div>
              <p className="font-serif text-sm sm:text-base leading-relaxed text-stone-900 whitespace-pre-line font-medium">
                {whyItMatters}
              </p>
            </div>

            {/* 3. YAZILIM DÜNYASINA ETKİLERİ (ENDÜSTRİYEL ETKİ) */}
            <div className="rounded-2xl border-l-4 border-emerald-600 bg-emerald-50/80 border border-emerald-300 p-5 sm:p-6 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-900 uppercase tracking-wider font-serif">
                <Zap className="w-4 h-4 text-emerald-700" />
                <span>{lang === 'tr' ? '⚡ YAZILIM DÜNYASINA ETKİLERİ' : '⚡ SOFTWARE & ECOSYSTEM IMPACT'}</span>
              </div>
              <p className="font-serif text-sm sm:text-base text-stone-900 leading-relaxed font-medium">
                {softwareImpact}
              </p>
            </div>

            {/* ACTION BUTTONS: DETAYLI İNCELE / KAYNAĞA GİT & PAYLAŞ */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={handleShare}
                className="px-4 py-3.5 rounded-2xl text-xs font-bold bg-white text-stone-800 hover:bg-stone-100 border-2 border-stone-800 flex items-center gap-1.5 transition-all shadow-xs font-serif"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span className="text-emerald-800 font-bold">Kopyalandı</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-stone-800" />
                    <span>Paylaş</span>
                  </>
                )}
              </button>

              <button
                onClick={handleOpenSource}
                className="flex-1 py-3.5 px-6 rounded-2xl text-xs sm:text-sm font-black bg-stone-900 hover:bg-stone-800 text-[#faf6ed] flex items-center justify-center gap-2 shadow-lg shadow-stone-900/20 transition-all font-serif uppercase tracking-wider"
              >
                <span>{lang === 'tr' ? 'Detaylı İncele (Orijinal Kaynak)' : 'Visit Original Source'}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {/* Raw snippet toggle */}
            <div className="pt-1">
              <button
                onClick={() => setShowRawSource(!showRawSource)}
                className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-mono"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{showRawSource ? 'Ham Alıntıyı Gizle' : 'Ham Kaynak Metnini Göster'}</span>
              </button>

              <AnimatePresence>
                {showRawSource && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden rounded-2xl border border-stone-300 bg-white p-4 mt-2 font-mono text-xs text-stone-700 leading-relaxed"
                  >
                    <p className="font-sans text-xs">{currentItem.full_content || currentItem.snippet}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* BOTTOM PAGE TURNER CONTROLS */}
          <div className="pt-5 border-t-2 border-stone-800 flex items-center justify-between gap-3">
            <button
              onClick={handlePrev}
              disabled={currentPage === 0}
              className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold border-2 flex items-center justify-center gap-1.5 transition-all font-serif ${
                currentPage === 0
                  ? 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed'
                  : 'bg-white text-stone-900 hover:bg-stone-100 border-stone-800 shadow-xs'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Önceki Sayfa</span>
            </button>

            <span className="font-mono text-xs font-black text-stone-900 px-3 py-1 bg-stone-200 rounded-lg">
              {currentPage + 1} / {totalPages}
            </span>

            <button
              onClick={handleNext}
              disabled={currentPage === totalPages - 1}
              className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all font-serif ${
                currentPage === totalPages - 1
                  ? 'bg-stone-200 text-stone-400 border-2 border-stone-300 cursor-not-allowed'
                  : 'bg-stone-900 hover:bg-stone-800 text-[#faf6ed] border-2 border-stone-900 shadow-md shadow-stone-900/20'
              }`}
            >
              <span>Sonraki Sayfa</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

