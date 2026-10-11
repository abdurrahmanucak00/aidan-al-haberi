import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, ExternalLink, Search, Trash2, Calendar } from 'lucide-react'
import { FavoriteItem, CategoryType } from '../types'
import { CATEGORY_CONFIG } from './categoryConstants'

interface FavoritesViewProps {
  favorites: FavoriteItem[]
  onRemoveFavorite: (item: FavoriteItem) => void
  onOpenSource: (url: string) => void
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  onRemoveFavorite,
  onOpenSource
}) => {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryType | 'all'>('all')

  const availableCategories = useMemo(() => {
    const set = new Set<CategoryType>()
    favorites.forEach((f) => set.add(f.result.category))
    return Array.from(set)
  }, [favorites])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return favorites.filter((f) => {
      if (categoryFilter !== 'all' && f.result.category !== categoryFilter) return false
      if (!q) return true
      const haystack = [
        f.result.ai_headline || '',
        f.result.title,
        f.result.query_label,
        f.result.what_is_it || f.result.ai_summary || ''
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [favorites, query, categoryFilter])

  if (favorites.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] p-10 space-y-4 shadow-xl">
          <Star className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="font-serif text-2xl font-black text-stone-900">
            Henüz Favori Haberiniz Yok
          </h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto font-serif">
            Gazete okurken beğendiğiniz haberlerin sağ üstündeki{' '}
            <Star className="w-3.5 h-3.5 inline text-amber-500 fill-current" /> yıldız ikonuna
            tıklayarak buraya kaydedebilirsiniz.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-24 px-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 mb-1.5 shadow-2xs">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>Arşivim</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
            Favori Haberlerim
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-serif">
            Kaydettiğiniz {favorites.length} haber arşivde saklanıyor.
          </p>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Favorilerimde ara..."
            className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:border-stone-800 focus:outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
              categoryFilter === 'all'
                ? 'bg-stone-900 text-[#faf6ed]'
                : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-100'
            }`}
          >
            Tümü
          </button>
          {availableCategories.map((cat) => {
            const meta = CATEGORY_CONFIG[cat]
            const isActive = categoryFilter === cat
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                  isActive
                    ? 'bg-stone-900 text-[#faf6ed]'
                    : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-100'
                }`}
              >
                {meta?.icon} {meta?.label || cat}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500 font-serif">Bu filtreyle eşleşen favori bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fav) => {
            const meta = CATEGORY_CONFIG[fav.result.category] || CATEGORY_CONFIG.news
            const headline = fav.result.ai_headline || fav.result.title
            const summary = fav.result.what_is_it || fav.result.ai_summary || fav.result.snippet

            return (
              <motion.article
                key={fav.result.id + fav.result.url}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border-2 border-stone-800 bg-[#faf6ed] p-5 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border"
                      style={{ backgroundColor: meta?.color, borderColor: meta?.color }}
                    >
                      {meta?.icon} {meta?.label}
                    </span>
                    <span className="text-[10px] font-bold text-stone-500 font-serif">
                      📍 {fav.result.query_label}
                    </span>
                    {fav.result.importance_score !== undefined && (
                      <span className="text-[10px] font-mono font-bold text-stone-500">
                        ⚡ {fav.result.importance_score}/100
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveFavorite(fav)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                    title="Favorilerden çıkar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-serif text-lg font-black text-stone-900 leading-snug mt-2.5">
                  {headline}
                </h3>

                <p className="text-xs text-stone-700 leading-relaxed mt-2 line-clamp-3 font-serif">
                  {summary}
                </p>

                <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-stone-300">
                  <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(fav.saved_at).toLocaleDateString('tr-TR')}
                  </span>
                  <button
                    onClick={() => onOpenSource(fav.result.url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-stone-900 text-[#faf6ed] hover:bg-stone-800 transition-colors"
                  >
                    <span>Kaynağı Oku</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}
    </div>
  )
}
