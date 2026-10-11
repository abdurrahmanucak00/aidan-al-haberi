import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Radar, KeyRound, Sparkles, Search, Loader2 } from 'lucide-react'
import { UserSettings } from '../types'

interface NavbarProps {
  settings: UserSettings
  isSearching: boolean
  onStartResearch: () => void
  onOpenSettings: () => void
  onFreeSearch?: (query: string) => void
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  isSearching,
  onStartResearch,
  onOpenSettings,
  onFreeSearch
}) => {
  const hasKeys = Boolean(settings.tavily_key && settings.gemini_key)
  const [freeQuery, setFreeQuery] = useState('')
  const [showFreeSearch, setShowFreeSearch] = useState(false)

  const handleFreeSearchSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const q = freeQuery.trim()
    if (!q || isSearching || !onFreeSearch) return
    onFreeSearch(q)
    setFreeQuery('')
    setShowFreeSearch(false)
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs">
      <div className="max-w-5xl mx-auto space-y-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Brand: AI'dan Al Haberi */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-stone-900 text-white shadow-xs">
              <Radar className={`w-4 h-4 text-amber-300 ${isSearching ? 'animate-spin' : ''}`} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            </div>

            <div>
              <h1 className="text-base sm:text-lg font-serif font-black tracking-tight text-stone-900 flex items-center gap-1.5">
                <span>AI&apos;dan Al Haberi</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                  GAZETE
                </span>
              </h1>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            {hasKeys && onFreeSearch && (
              <button
                onClick={() => setShowFreeSearch((v) => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-2xs transition-colors ${
                  showFreeSearch
                    ? 'bg-stone-900 text-[#faf6ed] border-stone-800'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
                title="Takip listesinden bağımsız tek seferlik arama"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Serbest Ara</span>
              </button>
            )}

            {!hasKeys ? (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>API Gir</span>
              </button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onStartResearch}
                disabled={isSearching}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-serif font-bold transition-all shadow-xs ${
                  isSearching
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
                    : 'bg-stone-900 hover:bg-stone-800 text-[#faf6ed] shadow-stone-900/10 border border-stone-800'
                }`}
              >
                {isSearching ? (
                  <>
                    <Radar className="w-3.5 h-3.5 animate-spin" />
                    <span>Basılıyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    <span>Yeni Sayı Bas</span>
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Free-form search bar */}
        {showFreeSearch && hasKeys && onFreeSearch && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            onSubmit={handleFreeSearchSubmit}
            className="overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                autoFocus
                type="text"
                value={freeQuery}
                onChange={(e) => setFreeQuery(e.target.value)}
                placeholder="Örn: Qwen yeni model duyurusu, MCP protokolü, vLLM optimizasyon..."
                disabled={isSearching}
                className="w-full pl-10 pr-28 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-2xl text-stone-900 placeholder-stone-400 focus:border-stone-800 focus:bg-white focus:outline-none transition-all font-serif disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!freeQuery.trim() || isSearching}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold bg-stone-900 text-[#faf6ed] hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Aranıyor</span>
                  </>
                ) : (
                  <span>Ara</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-1.5 ml-1 font-serif">
              Son 90 gün içinde tek seferlik arama yapar, takip listenizi değiştirmez.
            </p>
          </motion.form>
        )}
      </div>
    </header>
  )
}
