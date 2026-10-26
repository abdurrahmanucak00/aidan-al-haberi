# Supabase Kurulumu — AI'dan Al Haberi

Uygulama **yerel öncelikli** çalışır: Supabase olmadan da her şey çalışır, sadece
gazeteler yalnızca bu bilgisayarda kalır. Supabase'i bağlarsan her araştırma buluta da
yedeklenir.

Toplam süre: ~10 dakika. Ücretsiz plan yeterli.

---

## 1. Hesap ve proje oluştur

1. https://supabase.com → **Start your project** → GitHub veya e-posta ile giriş yap.
2. **New project**:
   - **Name:** `aidan-al-haberi`
   - **Database Password:** güçlü bir şifre gir ve bir yere not et (uygulama bunu kullanmıyor ama panelde lazım olabilir).
   - **Region:** sana en yakın olan (Türkiye için `Central EU (Frankfurt)` iyi).
3. **Create new project** → 1-2 dakika kurulum bekle.

## 2. Tabloları oluştur (şema)

1. Sol menüden **SQL Editor** → **New query**.
2. Bu repodaki `DevRadar/supabase-schema.sql` dosyasının **tamamını** kopyala, editöre yapıştır.
3. **Run** (Ctrl+Enter). "Success. No rows returned" görmelisin.
4. Kontrol: sol menü **Table Editor** → `search_sessions` ve `search_results` tabloları görünmeli.

## 3. Anonim girişi aç (kritik)

Uygulamada giriş ekranı yok; oturum anonim olarak açılıyor. Bu ayar kapalıysa bulut
yedekleme çalışmaz.

1. Sol menü **Authentication** → **Sign In / Providers** (yeni arayüzde **Providers**).
2. Listeden **Anonymous sign-ins** seçeneğini bul.
3. **Enable anonymous sign-ins** anahtarını aç → **Save**.

## 4. Anahtarları al

1. Sol menü **Project Settings** (dişli) → **API** (yeni arayüzde **API Keys**).
2. İki değeri kopyala:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon / public** key → `eyJhbGciOi...` (uzun)

> ⚠️ **service_role** key'ini asla kullanma. O key RLS'i atlar ve tüm veriye erişir.
> Uygulama sadece **anon/public** key ister.

## 5. Uygulamaya gir

1. Uygulamayı aç → **Ayarlar** sekmesi.
2. **Bulut Yedekleme (Supabase)** bölümü:
   - **Supabase Project URL:** 4. adımdaki URL
   - **Supabase Anon Key:** 4. adımdaki anon key
3. **Bağlantıyı Test Et** → "Bulut bağlantısı BAŞARILI ✅" mesajını görmelisin.
4. **Ayarları Kaydet**.
5. Bir araştırma çalıştır → panelde **Table Editor → search_sessions** içinde satır oluşmalı.

---

## Sorun giderme

| Hata | Sebep / çözüm |
| --- | --- |
| "Supabase anonim girişi kapalı" | 3. adımı yap: Authentication → Providers → Anonymous açık değil. |
| "relation ... does not exist" | 2. adımı yap: `supabase-schema.sql` çalıştırılmamış. |
| "new row violates row-level security policy" | Anonim giriş kapalı veya URL/key yanlış projeye ait. |
| "Failed to fetch" / bağlantı hatası | URL yanlış (başında `https://`, sonunda `/` olmasın) veya proje duraklatılmış. |
| Ücretsiz plan duraklaması | 1 hafta işlem olmazsa proje duraklar; panelden **Restore** ile geri açılır. |

## Notlar

- **Ücretsiz plan:** 500 MB veritabanı, 2 aktif proje. Bu uygulama için fazlasıyla yeterli.
- **Veri nerede:** `search_sessions` (her gazete) + `search_results` (haberler/analizler).
  Ayarlar ve API anahtarları **buluta gitmez**, sadece cihazda şifreli saklanır.
- **Gizlilik:** RLS sayesinde anon key ile başka kullanıcıların satırları okunamaz; her
  anonim oturum yalnızca kendi kayıtlarını görür.
- **Not:** Anonim oturum cihaza bağlıdır. Uygulama verisi silinirse (ya da başka cihaza
  geçilirse) aynı anonim kimlik geri gelmez; bu yüzden bulut yedek şu an "arşiv" gibi
  çalışır, cihazlar arası senkron değil.
