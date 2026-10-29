# MAG Ambalaj • Pazar Analiz — Proje Notları

**Site:** https://mag-pazar-analiz.pages.dev (Cloudflare Pages, GitHub `xfranerx53/mag-pazar-analiz` → `main` dalına her yüklemede otomatik yayınlanır)
**Yapı:** Tek dosya `index.html` + `sw.js` (çevrimdışı önbellek) + `manifest.webmanifest` + `icon.svg`. Derleme yok.
**Bulut:** Firebase projesi `mag-pazar` — Realtime Database (europe-west1), giriş: E-posta/Şifre. Ayarlar `index.html` içine gömülü.
Veri yolları: `mag_pazar/leads/{id}` (kayıtlar), `mag_pazar/ayar` (firma bilgisi, hedefler, şablonlar).
Güvenlik kuralı: sadece sahibin UID'si okuyup yazabilir (kural metni sitede ☁ → giriş sonrası çıkar).

## Sürüm geçmişi
- **v1** — Kayıt listesi, sektör/durum filtresi, CSV içe/dışa aktarma (yalnızca tarayıcıda).
- **v2 (29.10.2026)** — Bulut eşitleme, yetkili/kaynak/öncelik/sonraki arama alanları, görüşme geçmişi, Bugün sekmesi, Teklifler sekmesi, Analiz sekmesi, JSON yedek.
- **v2.1** — Firebase ayarları koda gömüldü; pencerelerin dışına (boşluğa) tıklayınca kapanma.
- **v3 (29.10.2026)**
  - Toplu işlem: kartlardaki kutucuk / "Görünenleri seç" → durum, öncelik, sektör, sonraki arama tarihini toplu değiştir veya sil.
  - Mükerrer kontrol: aynı firma adı veya telefon girilince uyarı; CSV içe aktarmada tekrarlar atlanır.
  - Bugün sekmesi: "Arama listesini yazdır" (sonuç sütunlu tablo) ve "Ziyaret rotası" (Google Haritalar, en fazla 10 durak).
  - WhatsApp şablonları: {firma} {yetkili} otomatik dolar; şablonla açılınca görüşme geçmişine yazılır, "Yeni" → "İletişim kuruldu".
  - Açık adres alanı + kartta "Harita" düğmesi.
  - Teklif çıktısı: "Yazdır / PDF" (firma bilgileri ⚙ Ayarlar'dan), teklif notu/koşullar alanı, "Kaydet ve yazdır".
  - Aylık hedefler (görüşme, yeni müşteri, kabul edilen teklif ₺) → Analiz sekmesinin en üstünde ilerleme çubuğu.
  - Tema düğmesi: ◐ otomatik / ☀ açık / ☾ koyu (cihaz başına hatırlanır).
  - ⚙ Ayarlar ekranı: firma bilgileri, hedefler, şablonlar (bulutla eşitlenir).

## Otomatik kurallar
- Teklif eklenince firma durumu "Teklif verildi" olur (Yeni / İletişim kuruldu / İlgileniyor ise).
- Teklif "Kabul" yapılınca firma "Müşteri" olur; müşteri olma tarihi hedef hesabında kullanılır.

## Güncelleme nasıl yapılır
GitHub → depo → Add file → Upload files → değişen dosyaları sürükle → Commit changes → 1-2 dk sonra sitede Ctrl+F5.
