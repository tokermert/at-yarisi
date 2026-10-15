# At Yarışı 🏇

Panayırların klasik at yarışı oyununun tarayıcı versiyonu. Herkes kendi telefonundan oynar:
ekranda tüm atlar koşar, altta yalnızca **senin** atış masan görünür.

## Nasıl oynanır

1. Biri **Oda kur** der; 4 harfli oda kodu ve QR çıkar.
2. Diğerleri kodu yazar ya da QR'ı okutur (en fazla 4 at). Boş yerlere bot eklenebilir.
3. Topu yukarı kaydır ya da sapan gibi aşağı çekip bırak. Toptan çıkan ok yönü ve gücü gösterir;
   masa pürüzlü olduğu için aynı atış hep aynı deliğe gitmez. Bilgisayarda **Boşluk** tuşunu basılı tutup bırak.
4. Sarı delik +1, mavi +2, kırmızı +3 adım. Bitişe ilk varan kazanır.

## Teknik

- Next.js 16 + Tailwind 4, oyun tamamen `<canvas>` üzerinde çizilir (görsel dosya yok).
- Çok oyunculu bağlantı WebRTC (PeerJS) ile cihazdan cihaza kurulur; sunucu gerekmez.
  Oda sahibinin cihazı yarışın yetkili durumunu tutar, her oyuncu kendi topunun fiziğini
  kendi cihazında çalıştırıp yalnızca kazandığı puanı bildirir.
- Varsayılan olarak PeerJS'in ücretsiz bulut sinyal sunucusu ve TURN sunucuları kullanılır.
  Kendi PeerServer'ını kullanmak istersen `.env.example` dosyasına bak.

## Geliştirme

```bash
npm install
npm run dev
```

## Yayınlama

Vercel'de **Add New → Project** ile bu repoyu içe aktarman yeterli; ek ayar gerekmez.

## İstatistikler (Supabase)

Oyun anonim kullanım olaylarını (ziyaret, oda kurma, katılma, yarış başlangıcı/bitişi) Supabase'e yazar.
İsim ya da kişisel veri gönderilmez; her cihaz rastgele bir kimlikle sayılır.

1. Supabase'de proje aç, **SQL Editor**'de `supabase/schema.sql` dosyasını çalıştır.
2. **Project Settings → API**'den proje URL'sini ve `anon` / publishable anahtarını al.
3. Vercel'de **Settings → Environment Variables**'a ekle ve yeniden deploy et:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Rakamlar için SQL Editor'de `supabase/istatistik.sql` içindeki sorguları çalıştır.

Değişkenler tanımlı değilse oyun hiçbir veri göndermez.

### İstatistik paneli (`/istatistik`)

Şifreli bir dashboard: ziyaretçi, oynayan, oda, yarış sayıları, günlük grafik, cihaz ve yarış türü kırılımları.

1. SQL Editor'de `supabase/dashboard.sql` dosyasını çalıştır (özet fonksiyonunu kurar).
2. Vercel'e iki gizli değişken ekle (önek **yok**, "Sensitive" işaretle):
   - `SUPABASE_SECRET_KEY`: Supabase'deki **secret / service_role** anahtarı
   - `STATS_PASSWORD`: panel şifresi
3. Redeploy et ve `https://<site>/istatistik` adresine git.

## Yol haritası (v2 fikirleri)

İlk haftanın verisine göre öncelik verilecek:

- **Altın delik:** Yarış ortasında rastgele bir delik birkaç saniyeliğine parlar; girerse +4.
- **Seri bonusu:** Üst üste 3 isabette "Seri! 🔥" ve atın kısa bir hızlanması.
- **Emoji tepkileri:** Yarış sırasında 😂🔥😱 butonları; emoji herkesin pistinde atının üstünde uçar.
