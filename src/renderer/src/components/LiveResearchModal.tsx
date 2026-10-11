import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radar,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  Sparkles,
  X
} from 'lucide-react'
import { ResearchLog } from '../types'

interface LiveResearchModalProps {
  isOpen: boolean
  isSearching: boolean
  progress: number
  progressStatus: string
  logs: ResearchLog[]
  onClose: () => void
}

export const LiveResearchModal: React.FC<LiveResearchModalProps> = ({
  isOpen,
  isSearching,
  progress,
  progressStatus,
  logs,
  onClose
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isOpen])

  if (!isOpen) return null

  const getLogIcon = (type: ResearchLog['type']) => {
    switch (type) {
      case 'search':
        return <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      case 'ai':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      case 'warning':
      case 'error':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      default:
        return <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    }
  }

  const getLogColor = (type: ResearchLog['type']) => {
    switch (type) {
      case 'search':
        return 'text-indigo-300'
      case 'ai':
        return 'text-emerald-300 font-medium'
      case 'success':
        return 'text-emerald-300 font-bold'
      case 'warning':
        return 'text-amber-300'
      case 'error':
        return 'text-rose-400 font-bold'
      default:
        return 'text-slate-300'
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-xs">
                <Radar className={`w-5 h-5 text-emerald-400 ${isSearching ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>AI&apos;dan Al Haberi Otonom Ajan Konsolu</span>
                  {isSearching && (
                    <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40 animate-pulse">
                      ● Canlı Tarama
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {progressStatus || 'Tavily & Gemini motoru devrede...'}
                </p>
              </div>
            </div>

            {!isSearching && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-900 h-1.5">
            <motion.div
              className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Terminal Logs Window */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-2 bg-[#050911] custom-scrollbar min-h-[260px] max-h-[400px]">
            <div className="text-slate-500 text-[11px] pb-2 border-b border-slate-800/80 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              <span>Canlı Araştırma Logları</span>
            </div>

            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">
                  [{log.timestamp}]
                </span>
                {getLogIcon(log.type)}
                <span className={getLogColor(log.type)}>{log.message}</span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {isSearching ? 'Tarama devam ediyor, lütfen bekleyin...' : 'İşlem tamamlandı.'}
            </span>
            <button
              onClick={onClose}
              disabled={isSearching}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isSearching
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-white text-slate-950 hover:bg-slate-100 shadow-xs'
              }`}
            >
              Kapat
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
