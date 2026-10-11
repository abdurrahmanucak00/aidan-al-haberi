import { CategoryType, CategoryMeta } from '../types'

export const CATEGORY_CONFIG: Record<CategoryType, CategoryMeta> = {
  new_model: {
    label: 'Yeni Modeller',
    icon: '🤖',
    color: 'text-indigo-600',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs',
    description: 'Yeni nesil temel modeller, LLM release ve mimariler'
  },
  new_paper: {
    label: 'Yeni Makaleler',
    icon: '📄',
    color: 'text-emerald-600',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs',
    description: 'ArXiv ve akademik AI araştırmaları, bilimsel yayınlar'
  },
  model_update: {
    label: 'Güncellemeler',
    icon: '⚡',
    color: 'text-amber-600',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 shadow-xs',
    description: 'Benchmarklar, versiyon güncellemeleri ve optimizasyonlar'
  },
  tool_library: {
    label: 'Araçlar & Kod',
    icon: '🛠️',
    color: 'text-sky-600',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200 shadow-xs',
    description: 'Yeni GitHub kütüphaneleri, CLI ve açık kaynak agent araçları'
  },
  news: {
    label: 'Sektör & Haberler',
    icon: '📰',
    color: 'text-purple-600',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 shadow-xs',
    description: 'Şirket duyuruları, yatırımlar ve sektör gelişmeleri'
  }
}
