-- ==============================================================================
-- AI'dan Al Haberi — Supabase şeması
-- ==============================================================================
-- Uygulama yerel-öncelikli çalışır; Supabase yalnızca bulut yedekleme içindir.
--
-- KURULUM
--   1) Supabase panelinde yeni proje oluştur.
--   2) SQL Editor'e bu dosyanın tamamını yapıştırıp çalıştır.
--   3) Authentication → Providers → Anonymous seçeneğini AÇ.
--      (Uygulamada giriş ekranı yok; oturum anonim olarak açılıyor.)
--   4) Settings → API ekranındaki Project URL + anon/public key'i uygulamanın
--      Ayarlar → Bulut Yedekleme bölümüne gir.
--
-- GÜVENLİK
--   Anon key herkese açık bir istemci anahtarıdır. Erişim, aşağıdaki
--   Row Level Security politikalarıyla kullanıcı bazında kısıtlanır.
--   service_role key'i ASLA istemciye koymayın.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Arama oturumları (her gazete = bir oturum)
CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  searched_at TIMESTAMPTZ DEFAULT now(),
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ,
  total_results INT DEFAULT 0
);

-- 2) Oturuma bağlı haber/analiz kayıtları
CREATE TABLE IF NOT EXISTS search_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES search_sessions(id) ON DELETE CASCADE,
  category TEXT,        -- 'new_model' | 'new_paper' | 'model_update' | 'tool_library' | 'news'
  query_label TEXT,     -- aranan kişi veya konu
  query_type TEXT,      -- 'person' | 'interest'
  title TEXT,
  url TEXT,
  snippet TEXT,
  source TEXT,
  published_date TEXT,
  ai_summary TEXT,      -- Gemini'nin ürettiği Türkçe analiz
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Şema yükseltmesi: daha önce kurulmuş projelerde eksik sütunları ekler.
-- (Yeniden çalıştırmak güvenlidir; mevcut veriyi silmez.)
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS ai_headline TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS ai_takeaway TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS software_impact TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS importance_score INT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS summary_status TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS summary_model TEXT;

CREATE INDEX IF NOT EXISTS idx_search_results_session ON search_results(session_id);
CREATE INDEX IF NOT EXISTS idx_search_results_category ON search_results(category);
CREATE INDEX IF NOT EXISTS idx_search_sessions_user ON search_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_searched_at ON search_sessions(searched_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

-- search_sessions: kullanıcı yalnızca kendi oturumlarını görür/yönetir
DROP POLICY IF EXISTS "sessions_all_own" ON search_sessions;
CREATE POLICY "sessions_all_own" ON search_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- search_results: yalnızca kendi oturumlarına ait sonuçlar
DROP POLICY IF EXISTS "results_all_own" ON search_results;
CREATE POLICY "results_all_own" ON search_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM search_sessions s
      WHERE s.id = search_results.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM search_sessions s
      WHERE s.id = search_results.session_id AND s.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- ESKİ ŞEMADAN GELEN KULLANILMAYAN TABLOLAR
-- ==============================================================================
-- Önceki sürüm `users` ve `user_settings` tablolarını da oluşturuyordu; uygulama
-- bu tabloları hiç okumuyor (ayarlar yerel olarak saklanıyor). Temizlemek istersen:
--
-- DROP TABLE IF EXISTS user_settings;
-- DROP TABLE IF EXISTS users;
