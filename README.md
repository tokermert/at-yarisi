# At Yarışı 🏇

Lunaparkların klasik at yarışı oyununun tarayıcı versiyonu. Herkes kendi telefonundan oynar:
ekranda tüm atlar koşar, altta yalnızca **senin** atış masan ve güç çubuğun görünür.

## Nasıl oynanır

1. Biri **Oda kur** der; 4 harfli oda kodu ve QR çıkar.
2. Diğerleri kodu yazar ya da QR'ı okutur (en fazla 4 at). Boş yerlere bot eklenebilir.
3. Topu yukarı kaydır ya da sapan gibi aşağı çekip bırak. Sağdaki güç çubuğu atış hızını,
   beyaz ok son atışını gösterir. Bilgisayarda **Boşluk** tuşunu basılı tutup bırak.
4. Sarı delik +1, mavi +2, kırmızı +3 adım. Bitişe ilk varan kazanır.

Bir cihazı **pist ekranı** (TV / tablet) olarak da açabilirsin; o cihaz atış masası göstermez.

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
