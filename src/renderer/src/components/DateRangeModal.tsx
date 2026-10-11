import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon,
  Play,
  X,
  Layers
} from 'lucide-react'

interface DateRangeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (startDate: string, endDate: string, resultLimit: number) => void
  defaultMonths?: number
  defaultLimit?: number
}

export const DateRangeModal: React.FC<DateRangeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultMonths = 6,
  defaultLimit = 8
}) => {
  // Preset quick selections (Days ago)
  const todayStr = new Date().toISOString().split('T')[0]

  const getPastDateStr = (daysAgo: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().split('T')[0]
  }

  const [startDate, setStartDate] = useState(() => getPastDateStr(defaultMonths * 30))
  const [endDate, setEndDate] = useState(todayStr)
  const [resultLimit, setResultLimit] = useState(defaultLimit)
  const [activePreset, setActivePreset] = useState<string>('custom')

  const presets = [
    { id: '1d', label: 'Son 24 Saat', days: 1 },
    { id: '3d', label: 'Son 3 Gün', days: 3 },
    { id: '1w', label: 'Son 1 Hafta', days: 7 },
    { id: '1m', label: 'Son 1 Ay', days: 30 },
    { id: '3m', label: 'Son 3 Ay', days: 90 }
  ]

  const handleSelectPreset = (p: typeof presets[0]) => {
    setActivePreset(p.id)
    setStartDate(getPastDateStr(p.days))
    setEndDate(todayStr)
  }

  const handleStart = () => {
    onConfirm(startDate, endDate, resultLimit)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl border border-stone-300 shadow-2xl p-6 sm:p-8 space-y-6 text-stone-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-stone-100 border border-stone-300 flex items-center justify-center text-stone-900">
                <CalendarIcon className="w-5 h-5 text-stone-800" />
              </div>
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-stone-900">
                  Gazete Basım & Zaman Aralığı
                </h3>
                <p className="text-xs text-stone-600 font-serif">
                  Taranmasını istediğin tarih aralığını ve haber yoğunluğunu seç
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-serif font-bold text-stone-700 block">
              Hızlı Tarih Seçimi:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {presets.map((p) => {
                const isSelected = activePreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-serif font-bold transition-all text-center ${
                      isSelected
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-serif font-bold text-stone-700 block">
                Başlangıç Tarihi:
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate || todayStr}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setActivePreset('custom')
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 border border-stone-300 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-stone-800 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-serif font-bold text-stone-700 block">
                Bitiş Tarihi:
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayStr}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setActivePreset('custom')
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 border border-stone-300 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-stone-800 focus:bg-white"
              />
            </div>
          </div>

          {/* Results per Query Density */}
          <div className="space-y-2 pt-1 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-serif font-bold text-stone-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-stone-700" />
                <span>Konu Başına Çekilecek Haber Sayısı:</span>
              </label>
              <span className="text-xs font-mono font-black text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-300">
                {resultLimit} Sonuç / Konu
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 5, 10].map((lim) => (
                <button
                  key={lim}
                  type="button"
                  onClick={() => setResultLimit(lim)}
                  className={`py-2 px-1 sm:px-2 rounded-xl text-xs font-serif font-bold transition-all ${
                    resultLimit === lim
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                  }`}
                >
                  {lim === 1 ? '1 (Sadece Önemli)' : `${lim} Sonuç`}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button: Start Research */}
          <div className="pt-3">
            <button
              onClick={handleStart}
              className="w-full py-4 px-6 rounded-2xl font-serif font-black text-sm bg-stone-900 hover:bg-stone-800 text-[#faf6ed] shadow-lg shadow-stone-900/20 transition-all flex items-center justify-center gap-2 tracking-wide uppercase"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Gazeteyi Bu Aralık İçin Bas</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
