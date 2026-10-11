import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ExternalLink,
  Sparkles,
  User,
  Tag,
  Calendar,
  Globe,
  Copy,
  Check,
  Loader2
} from 'lucide-react'
import { SearchResult } from '../types'
import { CATEGORY_CONFIG } from './categoryConstants'
import { summarizeItemWithGemini } from '../lib/gemini'

interface SearchResultCardProps {
  result: SearchResult
  geminiKey: string
  onUpdateResult: (updated: SearchResult) => void
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  geminiKey,
  onUpdateResult
}) => {
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const catMeta = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG.news

  const handleOpenLink = (e: React.MouseEvent): void => {
    e.preventDefault()
    if (window.api && typeof window.api.openExternal === 'function') {
      window.api.openExternal(result.url)
    } else {
      window.open(result.url, '_blank')
    }
  }

  const handleSummarize = async (): Promise<void> => {
    if (result.ai_summary) {
      setIsExpanded(!isExpanded)
      return
    }

    if (!geminiKey) {
      setSummaryError('Lütfen Ayarlar sekmesinden Gemini API anahtarınızı girin.')
      return
    }

    setIsSummarizing(true)
    setSummaryError(null)

    try {
      const summary = await summarizeItemWithGemini(
        {
          title: result.title,
          snippet: result.snippet,
          url: result.url,
          query_label: result.query_label,
          category: catMeta.label
        },
        geminiKey
      )

      const updated: SearchResult = {
        ...result,
        ai_summary: summary
      }

      onUpdateResult(updated)
      setIsExpanded(true)
    } catch (err: any) {
      setSummaryError(err.message || 'Özetleme işlemi sırasında bir hata oluştu.')
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleCopySummary = (text: string): void => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group relative rounded-2xl border border-cyan-500/20 bg-[#091322]/70 hover:bg-[#0b192c]/90 transition-all hover:border-emerald-400/40 hover:shadow-xl hover:shadow-cyan-950/30 overflow-hidden flex flex-col justify-between"
    >
      {/* Top Card Header */}
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {/* Category Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${catMeta.badgeColor}`}
            >
              <span>{catMeta.icon}</span>
              <span>{catMeta.label}</span>
            </span>

            {/* Query context tag */}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-[#070e1a] text-slate-300 border border-slate-700/80">
              {result.query_type === 'person' ? (
                <User className="w-3 h-3 text-emerald-400" />
              ) : (
                <Tag className="w-3 h-3 text-cyan-400" />
              )}
              <span>{result.query_label}</span>
            </span>
          </div>

          {/* Source Domain & Date */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 bg-[#050b14] px-2 py-0.5 rounded-md border border-slate-800 text-slate-300 font-mono text-[11px]">
              <Globe className="w-3 h-3 text-cyan-400" />
              {result.source}
            </span>
            {result.published_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                {result.published_date}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors leading-snug line-clamp-2">
          <a
            href={result.url}
            onClick={handleOpenLink}
            className="hover:underline flex items-start gap-1"
          >
            <span>{result.title}</span>
          </a>
        </h3>

        {/* Snippet */}
        <p className="mt-2 text-xs sm:text-sm text-slate-300/90 line-clamp-3 leading-relaxed">
          {result.snippet}
        </p>

        {/* AI Summary Section */}
        <AnimatePresence>
          {(result.ai_summary || isSummarizing || summaryError) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 pt-3 border-t border-emerald-500/20"
            >
              <div className="rounded-2xl p-4 bg-gradient-to-r from-emerald-950/30 via-teal-950/20 to-[#06101c] border border-emerald-500/30 shadow-inner">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Gemini 2.0 Flash AI Özeti (Türkçe)</span>
                  </div>

                  {result.ai_summary && (
                    <button
                      onClick={() => handleCopySummary(result.ai_summary!)}
                      className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 hover:text-emerald-100 transition-colors"
                      title="Özeti Kopyala"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {isSummarizing && (
                  <div className="flex items-center gap-2 py-2 text-xs text-emerald-300">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Gemini 2.0 Flash gelişmeyi analiz ediyor ve Türkçe özet üretiyor...</span>
                  </div>
                )}

                {summaryError && (
                  <div className="text-xs text-rose-400 py-1">
                    ⚠ {summaryError}
                  </div>
                )}

                {result.ai_summary && (
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans font-normal">
                    {result.ai_summary}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card Actions Footer */}
      <div className="px-5 py-3 bg-[#060c16]/80 border-t border-cyan-500/15 flex items-center justify-between gap-3 text-xs">
        {/* Left button: AI ile Özetle */}
        <button
          onClick={handleSummarize}
          disabled={isSummarizing}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
            result.ai_summary
              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
              : 'bg-[#091526] text-cyan-300 hover:text-white hover:bg-cyan-950/60 border border-cyan-500/30'
          }`}
        >
          {isSummarizing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{result.ai_summary ? 'AI Özetini Göster' : 'AI ile Özetle'}</span>
        </button>

        {/* Right button: Kaynağa Git */}
        <button
          onClick={handleOpenLink}
          className="flex items-center gap-1.5 text-cyan-400 hover:text-emerald-300 font-bold transition-colors"
        >
          <span>Kaynağı İncele</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}
