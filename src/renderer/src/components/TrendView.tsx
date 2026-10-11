import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, BarChart3, Award, Hash } from 'lucide-react'
import { CategoryType, SearchSession } from '../types'
import { CATEGORY_CONFIG } from './categoryConstants'

interface TrendViewProps {
  sessions: SearchSession[]
}

const CATEGORY_ORDER: CategoryType[] = [
  'new_model',
  'new_paper',
  'model_update',
  'tool_library',
  'news'
]

export const TrendView: React.FC<TrendViewProps> = ({ sessions }) => {
  // Chronological order (oldest → newest) for time-series charts
  const ordered = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(a.searched_at).getTime() - new Date(b.searched_at).getTime()
      ),
    [sessions]
  )

  const allResults = useMemo(() => sessions.flatMap((s) => s.results || []), [sessions])

  // 1. Category distribution
  const categoryStats = useMemo(() => {
    const counts: Record<CategoryType, number> = {
      new_model: 0,
      new_paper: 0,
      model_update: 0,
      tool_library: 0,
      news: 0
    }
    allResults.forEach((r) => {
      if (counts[r.category] !== undefined) counts[r.category]++
    })
    const total = allResults.length || 1
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      count: counts[cat],
      percent: Math.round((counts[cat] / total) * 100)
    }))
  }, [allResults])

  // 2. Top sources (tracked people / interests)
  const topSources = useMemo(() => {
    const counts = new Map<string, { count: number; type: 'person' | 'interest' }>()
    allResults.forEach((r) => {
      if (!r.query_label) return
      const existing = counts.get(r.query_label)
      if (existing) existing.count++
      else counts.set(r.query_label, { count: 1, type: r.query_type })
    })
    return Array.from(counts.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [allResults])

  // 3. Average importance per edition (time series)
  const importanceSeries = useMemo(() => {
    return ordered.map((s) => {
      const scores = (s.results || [])
        .map((r) => r.importance_score)
        .filter((n): n is number => typeof n === 'number')
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      return {
        id: s.id,
        date: new Date(s.searched_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
        avg,
        count: s.results?.length || 0
      }
    })
  }, [ordered])

  // 4. Highest-impact stories of all time
  const topStories = useMemo(
    () =>
      [...allResults]
        .filter((r) => typeof r.importance_score === 'number')
        .sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
        .slice(0, 5),
    [allResults]
  )

  const totalStories = allResults.length

  if (sessions.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] p-10 space-y-4 shadow-xl">
          <BarChart3 className="w-12 h-12 text-stone-800 mx-auto" />
          <h3 className="font-serif text-2xl font-black text-stone-900">Henüz Veri Yok</h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto font-serif">
            En az bir gazete sayısı bastıktan sonra trend analizi burada görünecek.
          </p>
        </div>
      </div>
    )
  }

  const maxSourceCount = Math.max(...topSources.map((s) => s.count), 1)
  const maxSeriesValue = Math.max(...importanceSeries.map((s) => s.avg), 1)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24 px-2">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-1.5 shadow-2xs">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Analiz</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
          Trend Analizi
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-serif">
          {sessions.length} sayı · {totalStories} haber üzerinden hesaplandı.
        </p>
      </div>

      {/* SUMMARY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Haber', value: totalStories },
          { label: 'Gazete Sayısı', value: sessions.length },
          {
            label: 'Ort. Önem Puanı',
            value: allResults.length
              ? Math.round(
                  allResults.reduce((a, r) => a + (r.importance_score || 0), 0) / allResults.length
                )
              : 0
          },
          { label: 'Takip Edilen Kaynak', value: topSources.length }
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border-2 border-stone-800 bg-[#faf6ed] p-4 text-center shadow-sm"
          >
            <div className="text-2xl font-black font-mono text-stone-900">{m.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mt-1">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* CATEGORY DISTRIBUTION */}
      <section className="rounded-3xl border-2 border-stone-800 bg-white p-6 shadow-md">
        <h3 className="font-serif text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Kategori Dağılımı
        </h3>
        <div className="space-y-3">
          {categoryStats.map((stat) => {
            const meta = CATEGORY_CONFIG[stat.category]
            return (
              <div key={stat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-stone-700 font-serif">
                    {meta?.icon} {meta?.label || stat.category}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-stone-500">
                    {stat.count} haber · %{stat.percent}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.percent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-stone-800"
                    style={meta?.color ? { backgroundColor: meta.color } : undefined}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* IMPORTANCE TREND (SVG line chart) */}
      <section className="rounded-3xl border-2 border-stone-800 bg-white p-6 shadow-md">
        <h3 className="font-serif text-lg font-black text-stone-900 mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Sayı Bazında Ortalama Önem Puanı
        </h3>
        <p className="text-[11px] text-stone-500 mb-4 font-serif">
          Her gazete sayısındaki haberlerin ortalama önem puanı (0-100).
        </p>

        {importanceSeries.length === 0 ? (
          <p className="text-xs text-stone-400 font-serif">Veri yok.</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${Math.max(importanceSeries.length * 60, 320)} 160`}
              className="w-full min-w-[320px] h-40"
              preserveAspectRatio="none"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = 140 - (pct / 100) * 120
                return (
                  <g key={pct}>
                    <line x1="0" y1={y} x2="100%" y2={y} stroke="#e7e5e4" strokeWidth="1" />
                    <text x="2" y={y - 3} fontSize="9" fill="#a8a29e" fontFamily="monospace">
                      {pct}
                    </text>
                  </g>
                )
              })}

              {/* Area + line */}
              {(() => {
                const step = 60
                const points = importanceSeries.map((s, i) => {
                  const x = i * step + 30
                  const y = 140 - (s.avg / maxSeriesValue) * 110
                  return { x, y, s }
                })
                const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                const areaPath =
                  points.length > 0
                    ? `${linePath} L ${points[points.length - 1].x} 140 L ${points[0].x} 140 Z`
                    : ''

                return (
                  <>
                    <path d={areaPath} fill="#fef3c7" opacity="0.7" />
                    <path d={linePath} fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinejoin="round" />
                    {points.map((p) => (
                      <g key={p.s.id}>
                        <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#b45309" strokeWidth="2.5" />
                        <text x={p.x} y={p.y - 10} fontSize="9.5" fill="#78350f" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                          {p.s.avg}
                        </text>
                      </g>
                    ))}
                    {points.map((p) => (
                      <text key={p.s.id + '-lbl'} x={p.x} y="155" fontSize="9" fill="#78716c" textAnchor="middle" fontFamily="monospace">
                        {p.s.date}
                      </text>
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>
        )}
      </section>

      {/* TOP SOURCES */}
      <section className="rounded-3xl border-2 border-stone-800 bg-white p-6 shadow-md">
        <h3 className="font-serif text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
          <Hash className="w-5 h-5" />
          En Çok Haber Getiren Kaynaklar
        </h3>
        <div className="space-y-2.5">
          {topSources.map((src, idx) => (
            <div key={src.label} className="flex items-center gap-3">
              <span className="w-5 text-center text-[11px] font-mono font-black text-stone-400">
                {idx + 1}
              </span>
              <span className="text-xs font-bold text-stone-800 w-32 sm:w-44 shrink-0 truncate font-serif">
                {src.type === 'person' ? '👤' : '🏷️'} {src.label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(src.count / maxSourceCount) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full bg-emerald-600"
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-stone-500 w-8 text-right">
                {src.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* TOP STORIES */}
      <section className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] p-6 shadow-md">
        <h3 className="font-serif text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-600" />
          Tüm Zamanların En Önemli Haberleri
        </h3>
        <div className="space-y-2">
          {topStories.map((story, idx) => {
            const meta = CATEGORY_CONFIG[story.category]
            return (
              <div
                key={story.id}
                className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-stone-300"
              >
                <span className="text-lg font-black font-serif text-stone-400 w-6 text-center shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-stone-900 font-serif leading-snug line-clamp-2">
                    {story.ai_headline || story.title}
                  </p>
                  <p className="text-[10px] text-stone-500 mt-1 font-serif">
                    {meta?.icon} {meta?.label} · 📍 {story.query_label}
                  </p>
                </div>
                <span className="text-sm font-black font-mono text-amber-700 shrink-0">
                  {story.importance_score}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
