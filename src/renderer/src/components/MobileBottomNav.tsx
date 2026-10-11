import React from 'react'
import { motion } from 'framer-motion'
import { Newspaper, History, Settings, Star, TrendingUp } from 'lucide-react'
import type { AppTab } from '../App'

interface MobileBottomNavProps {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
  unreadCount?: number
  favoritesCount?: number
  hasMissingKeys?: boolean
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  unreadCount = 0,
  favoritesCount = 0,
  hasMissingKeys = false
}) => {
  const tabs = [
    {
      id: 'stand' as const,
      label: 'Gazetelerim',
      icon: Newspaper,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    {
      id: 'favorites' as const,
      label: 'Favoriler',
      icon: Star,
      badge: favoritesCount > 0 ? favoritesCount : undefined
    },
    {
      id: 'trends' as const,
      label: 'Trend',
      icon: TrendingUp
    },
    {
      id: 'history' as const,
      label: 'Geçmiş',
      icon: History
    },
    {
      id: 'settings' as const,
      label: 'Ayarlar',
      icon: Settings,
      dot: hasMissingKeys
    }
  ]

  return (
    <nav className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-md border-t border-sky-100 px-2 py-2 shadow-lg shadow-sky-900/5">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
                isActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-bottom-nav-active"
                  className="absolute inset-0 bg-sky-50 border border-sky-200 rounded-2xl -z-0"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}

              <div className="relative z-10">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />

                {/* Badge Count */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-sky-600 text-white shadow-2xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {/* Alert Dot */}
                {tab.dot && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </div>

              <span className="text-[10px] tracking-tight mt-0.5 z-10">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
