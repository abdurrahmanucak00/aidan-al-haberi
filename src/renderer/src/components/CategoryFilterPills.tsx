import React from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { CategoryType, SearchResult } from '../types'

interface CategoryFilterPillsProps {
  selectedCategory: CategoryType | 'all'
  setSelectedCategory: (cat: CategoryType | 'all') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  results: SearchResult[]
}

export const CategoryFilterPills: React.FC<CategoryFilterPillsProps> = ({
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  results
}) => {
  const getCount = (cat: CategoryType | 'all'): number => {
    if (cat === 'all') return results.length
    return results.filter((r) => r.category === cat).length
  }

  const categories: Array<{ id: CategoryType | 'all'; label: string; icon: string }> = [
    { id: 'all', label: 'Tüm Gelişmeler', icon: '⚡' },
    { id: 'new_model', label: 'Yeni Modeller', icon: '🤖' },
    { id: 'new_paper', label: 'Yeni Makaleler', icon: '📄' },
    { id: 'model_update', label: 'Güncellemeler', icon: '⚡' },
    { id: 'tool_library', label: 'Araçlar & Kod', icon: '🛠️' },
    { id: 'news', label: 'Haberler', icon: '📰' }
  ]

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 my-5">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id
          const count = getCount(cat.id)

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="category-active-pill"
                  className="absolute inset-0 bg-slate-800 border border-slate-700 rounded-xl -z-0 shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="z-10 text-sm">{cat.icon}</span>
              <span className="z-10">{cat.label}</span>
              <span
                className={`z-10 ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search Input */}
      <div className="relative min-w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Sonuçlar içinde filtrele..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-[#11131c] border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:border-slate-600 focus:outline-none transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
