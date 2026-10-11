import React, { useState } from 'react'
import {
  KeyRound,
  ShieldCheck,
  Users,
  Tag,
  Plus,
  X,
  Save,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'
import { UserSettings } from '../types'

interface RadarSettingsProps {
  settings: UserSettings
  onSaveSettings: (newSettings: UserSettings) => Promise<void>
}

const PRESET_PEOPLE = [
  'Sam Altman',
  'Demis Hassabis',
  'Andrej Karpathy',
  'Yann LeCun',
  'Ilya Sutskever',
  'Jensen Huang',
  'Dario Amodei'
]

const PRESET_INTERESTS = [
  'LLM Agents',
  'Reasoning Models',
  'RAG Systems',
  'Vision & Multimodal AI',
  'Open-Source AI Models'
]

export const RadarSettings: React.FC<RadarSettingsProps> = ({
  settings,
  onSaveSettings
}) => {
  const [formData, setFormData] = useState<UserSettings>({
    ...settings,
    search_months: settings.search_months || 6,
    results_per_query: settings.results_per_query || 8
  })
  const [newPerson, setNewPerson] = useState('')
  const [newInterest, setNewInterest] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  const handleTestKey = async (key: string, isBackup: boolean) => {
    if (!key) {
      alert('Lütfen test etmek için önce key alanını doldurun.')
      return
    }
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
      if (res.ok) {
        alert(`${isBackup ? 'YEDEK' : 'ANA'} KEY BAŞARILI! ✅\nGoogle AI Studio erişimi aktif.`)
      } else if (res.status === 429) {
        alert(`${isBackup ? 'YEDEK' : 'ANA'} KEY KOTASI DOLU! ⚠️\nGünlük 1500 istek limiti aşılmış veya hesap kısıtlanmış.`)
      } else {
        alert(`${isBackup ? 'YEDEK' : 'ANA'} KEY GEÇERSİZ ❌\nGoogle reddetti (HTTP ${res.status}). Yeni bir key almayı deneyin.`)
      }
    } catch (e: any) {
      alert('Bağlantı başarısız: ' + e.message)
    }
  }

  const handleAddPerson = (name: string): void => {
    const trimmed = name.trim()
    if (!trimmed || formData.tracked_people.includes(trimmed)) return
    setFormData((prev) => ({
      ...prev,
      tracked_people: [...prev.tracked_people, trimmed]
    }))
    setNewPerson('')
  }

  const handleRemovePerson = (name: string): void => {
    setFormData((prev) => ({
      ...prev,
      tracked_people: prev.tracked_people.filter((p) => p !== name)
    }))
  }

  const handleAddInterest = (tag: string): void => {
    const trimmed = tag.trim()
    if (!trimmed || formData.interests.includes(trimmed)) return
    setFormData((prev) => ({
      ...prev,
      interests: [...prev.interests, trimmed]
    }))
    setNewInterest('')
  }

  const handleRemoveInterest = (tag: string): void => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.filter((i) => i !== tag)
    }))
  }

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSaveSettings(formData)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24 px-2">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200 mb-1.5 shadow-2xs">
          <KeyRound className="w-3.5 h-3.5 text-sky-600" />
          <span>Ayarlar & Yapılandırma</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
          AI&apos;dan Al Haberi Ayarları
        </h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: API KEYS */}
        <div className="rounded-3xl border border-sky-100 bg-white p-6 sm:p-8 space-y-5 shadow-xl shadow-sky-900/5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">API Anahtarları</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowKeys(!showKeys)}
              className="text-xs text-sky-600 font-bold hover:underline"
            >
              {showKeys ? 'Gizle' : 'Göster'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Tavily Search API Key</label>
                <a
                  href="https://tavily.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-sky-600 flex items-center gap-0.5 hover:underline"
                >
                  <span>Key Al</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type={showKeys ? 'text' : 'password'}
                value={formData.tavily_key}
                onChange={(e) => setFormData({ ...formData, tavily_key: e.target.value })}
                placeholder="tvly-..."
                className="w-full px-4 py-3 rounded-2xl bg-sky-50/50 border border-sky-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
              />
            </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Google Gemini API Key (Ana Key)</label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleTestKey(formData.gemini_key, false)} className="text-[11px] font-bold text-emerald-600 hover:underline">
                      Durumu Test Et
                    </button>
                    <a
                      href="https://aistudio.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-600 flex items-center gap-0.5 hover:underline"
                    >
                      <span>Key Al (Ücretsiz)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <input
                  type={showKeys ? 'text' : 'password'}
                  value={formData.gemini_key}
                  onChange={(e) => setFormData({ ...formData, gemini_key: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-3 rounded-2xl bg-sky-50/50 border border-sky-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Google Gemini API Key (Yedek Key - Opsiyonel)</label>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md font-semibold border border-emerald-200">Failover</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleTestKey(formData.gemini_backup_key || '', true)} className="text-[11px] font-bold text-emerald-600 hover:underline">
                      Durumu Test Et
                    </button>
                    <span className="text-[11px] text-slate-400">Ana key kotası dolunca devreye girer</span>
                  </div>
                </div>
                <input
                  type={showKeys ? 'text' : 'password'}
                  value={formData.gemini_backup_key || ''}
                  onChange={(e) => setFormData({ ...formData, gemini_backup_key: e.target.value })}
                  placeholder="2. Farklı Google Hesabı API Key (AIzaSy...)"
                  className="w-full px-4 py-3 rounded-2xl bg-sky-50/50 border border-sky-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                />
              </div>
            </div>
          </div>

        {/* SECTION 2: TRACKED PEOPLE */}
        <div className="rounded-3xl border border-sky-100 bg-white p-6 sm:p-8 space-y-4 shadow-xl shadow-sky-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Takip Edilen Kişiler</h3>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              placeholder="Örn: Andrej Karpathy, Ilya Sutskever..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddPerson(newPerson)
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleAddPerson(newPerson)}
              className="px-4 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Ekle</span>
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-bold self-center mr-1">Öneriler:</span>
            {PRESET_PEOPLE.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleAddPerson(p)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>

          {/* Active List */}
          <div className="flex flex-wrap gap-2 pt-2">
            {formData.tracked_people.map((person) => (
              <span
                key={person}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
              >
                <span>{person}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePerson(person)}
                  className="hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* SECTION 4: INTERESTS & TOPICS */}
        <div className="rounded-3xl border border-sky-100 bg-white p-6 sm:p-8 space-y-4 shadow-xl shadow-sky-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Tag className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">İlgi Alanları & Konular</h3>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              placeholder="Örn: LLM Agents, Open-Source AI..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddInterest(newInterest)
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleAddInterest(newInterest)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Ekle</span>
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-bold self-center mr-1">Öneriler:</span>
            {PRESET_INTERESTS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAddInterest(i)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors"
              >
                + {i}
              </button>
            ))}
          </div>

          {/* Active List */}
          <div className="flex flex-wrap gap-2 pt-2">
            {formData.interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <span>{interest}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveInterest(interest)}
                  className="hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* SAVE BUTTON */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-stone-900 hover:bg-stone-800 text-[#faf6ed] shadow-lg shadow-stone-900/20 transition-all flex items-center justify-center gap-2 font-serif"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Ayarlar Başarıyla Kaydedildi!</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>{isSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
