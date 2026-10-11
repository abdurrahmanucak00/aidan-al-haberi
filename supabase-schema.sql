-- ==============================================================================
-- DEVRADAR: Kişiselleştirilmiş AI & Teknoloji Araştırma Ajanı - Supabase Şeması
-- ==============================================================================

-- 1. Kullanıcılar Tablosu (Users)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  tavily_key_encrypted TEXT,
  gemini_key_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Kullanıcı Takip Ayarları Tablosu (User Settings)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tracked_people JSONB DEFAULT '["Sam Altman", "Demis Hassabis", "Andrej Karpathy", "Yann LeCun", "Ilya Sutskever"]',
  interests JSONB DEFAULT '["LLM Agents", "Reasoning Models", "RAG Systems", "Multimodal AI", "Robotics Foundation Models"]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Arama Oturumları (Zaman Aralıklı Takip İçin - Search Sessions)
CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  searched_at TIMESTAMPTZ DEFAULT now(),
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ,
  total_results INT DEFAULT 0
);

-- 4. Arama ve Analiz Sonuçları (Search Results)
CREATE TABLE IF NOT EXISTS search_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES search_sessions(id) ON DELETE CASCADE,
  category TEXT,           -- 'new_model', 'new_paper', 'model_update', 'tool_library', 'news'
  query_label TEXT,        -- Arama yapılan kişi veya konu başlığı
  query_type TEXT,         -- 'person' veya 'interest'
  title TEXT,
  url TEXT,
  snippet TEXT,
  source TEXT,             -- arxiv.org, github.com vb.
  published_date TEXT,
  ai_summary TEXT,         -- Gemini tarafından üretilen Türkçe özet
  created_at TIMESTAMPTZ DEFAULT now()
);

-- İndeksler (Hızlı sorgulama için)
CREATE INDEX IF NOT EXISTS idx_search_results_session ON search_results(session_id);
CREATE INDEX IF NOT EXISTS idx_search_results_category ON search_results(category);
CREATE INDEX IF NOT EXISTS idx_search_sessions_user ON search_sessions(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Anon key istemci tarafında bulunduğu için erişim mutlaka RLS ile kısıtlanmalıdır.
-- Bu politikalar, kullanıcıların yalnızca kendi verilerine erişmesini sağlar.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

-- users: kullanıcı yalnızca kendi satırını okuyabilir/güncelleyebilir
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_settings: kullanıcı yalnızca kendi ayarları
DROP POLICY IF EXISTS "settings_all_own" ON user_settings;
CREATE POLICY "settings_all_own" ON user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- search_sessions: kullanıcı yalnızca kendi oturumları
DROP POLICY IF EXISTS "sessions_all_own" ON search_sessions;
CREATE POLICY "sessions_all_own" ON search_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- search_results: yalnızca kendi oturumlarına ait sonuçlar
DROP POLICY IF EXISTS "results_all_own" ON search_results;
CREATE POLICY "results_all_own" ON search_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM search_sessions s
      WHERE s.id = search_results.session_id AND s.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM search_sessions s
      WHERE s.id = search_results.session_id AND s.user_id = auth.uid()
    )
  );
