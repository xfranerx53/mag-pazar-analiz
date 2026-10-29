# MAG Ambalaj • Pazar Analiz — Proje Notları

**Site:** https://mag-pazar-analiz.pages.dev (Cloudflare Pages; GitHub `xfranerx53/mag-pazar-analiz` → `main` dalına her yüklemede otomatik yayınlanır)
**Yapı:** Tek dosya `index.html` + `sw.js` (çevrimdışı önbellek) + `manifest.webmanifest` + `icon.svg`. Derleme yok.
**Bulut:** Firebase projesi `mag-pazar` — Realtime Database (europe-west1), giriş: E-posta/Şifre. Ayarlar `index.html` içine gömülü.
**Dış kütüphaneler (gerektiğinde yüklenir):** Firebase 10.12.2 (gstatic), Leaflet 1.9.4 (harita, cdnjs), SheetJS xlsx 0.18.5 (Excel, cdnjs). Harita altlığı: OpenStreetMap.

## Veri yapısı (`mag_pazar/...`)
| Yol | İçerik | Kim okur / yazar |
|---|---|---|
| `users/{uid}` | ad, email, rol (admin / satis / beklemede) | Yönetici hepsini; kişi kendini |
| `leads/{id}` | firma kaydı + gorus[], teklif[], siparis[], odeme[], sahip (uid) | Yönetici hepsi; satış yalnızca `sahip` = kendisi olanlar |
| `ayar` | firma bilgisi, logo, hedefler, şablonlar, uyku günü, ownerUid, sonYedek | Herkes okur, yönetici yazar |
| `katalog` | ürünler (ad, tür, ebat, mikron, birim, fiyat, maliyet) | Herkes okur, yönetici yazar |
| `sayac` | teklif / sipariş numara sayaçları (T-YYYY-0001, S-YYYY-0001) | Onaylı kullanıcılar |
| `medya/{key}` | kartvizit fotoğrafları (f_{id}), sesli notlar (s_…) | Onaylı kullanıcılar |
| `log` | işlem geçmişi (sadece eklenir, değiştirilemez) | Yönetici okur, herkes ekler |
| `cop/{id}` | silinen kayıtlar (30 gün) | Yönetici |
| `yedek/{tarih}` | haftalık otomatik yedek (son 4) | Yönetici |

Güvenlik kuralı sitede ☁ → giriş → "Kuralı kopyala" ile alınır; sahibin UID'si içine gömülüdür (`ayar.ownerUid`).
İlk giriş yapan (kuralda UID'si olan) otomatik **Yönetici** olur; sonra giren herkes **Onay bekliyor** olur, yönetici Yönetim sekmesinden rol verir.

## Sürüm geçmişi
- **v1** — Kayıt listesi, sektör/durum filtresi, CSV içe/dışa aktarma (yalnızca tarayıcıda).
- **v2 (29.10.2026)** — Bulut eşitleme, yetkili/kaynak/öncelik/sonraki arama, görüşme geçmişi, Bugün / Teklifler / Analiz sekmeleri, JSON yedek.
- **v2.1** — Firebase ayarları koda gömüldü; pencere dışına tıklayınca kapanma.
- **v3 (29.10.2026)** — Toplu işlem, mükerrer kontrol, yazdırılabilir arama listesi, ziyaret rotası, WhatsApp şablonları, adres + harita, teklif PDF, aylık hedefler, tema düğmesi, Ayarlar ekranı.
- **v4 (29.10.2026) — profesyonel sürüm**
  - *Güvenlik / ekip:* Çoklu kullanıcı ve roller (Yönetici / Satış / Onay bekliyor), kayıt sahibi + devir (tek tek veya toplu), satış personeli yalnızca kendi firmalarını görür ve silemez, işlem geçmişi, çöp kutusu (30 gün, geri alma), haftalık otomatik bulut yedeği + elle yedek + yedekten geri yükleme, şifremi unuttum.
  - *Satış:* Ürün kataloğu (fiyat + maliyet + marj), çok kalemli teklif (kalem iskontosu, KDV %0/1/10/20, ara/genel toplam, maliyeti bilinen kalemlerden kâr), otomatik teklif/sipariş numarası, PDF'te logo, teklif düzenleme, teklifi siparişe çevirme, sipariş takibi (Hazırlanıyor → Üretimde → Sevk edildi → Teslim edildi / İptal, teslim tarihi), sipariş formu çıktısı, tahsilat (ödemeler, bakiye, alacak listesi, WhatsApp ile bakiye hatırlatma).
  - *Analiz:* Satış hunisi (adım adım dönüşüm, en çok kayıp olan adım), son 6 ay karşılaştırma tablosu (▲▼ geçen aya göre), Türkiye haritası (il bazında firma/müşteri), sektör kârlılığı, kayıp sebepleri, rakip takibi (mevcut tedarikçi + fiyatı).
  - *Otomasyon:* Günlük bildirim (uygulama açıldığında; izin gerekir), uyuyan müşteri listesi (varsayılan 60 gün), teslimi geciken siparişler, kartvizit fotoğrafı, sesli görüşme notu (en fazla 60 sn), 7 sayfalık Excel raporu.
  - *Entegrasyon:* "📤 Sevkiyata bildir" siparişi hazır metin olarak WhatsApp'a (Mag Sevkiyat grubu) gönderir; ürün maliyetleri poşet maliyet tablosundan girilerek kâr marjı görünür.

## Otomatik kurallar
- Teklif eklenince firma "Teklif verildi" olur (Yeni / İletişim kuruldu / İlgileniyor ise).
- Teklif "Kabul" ya da sipariş eklenince firma "Müşteri" olur; müşteri olma tarihi hedef hesabında kullanılır.
- Şablonla WhatsApp açılınca görüşme geçmişine yazılır; "Yeni" firma "İletişim kuruldu" olur.
- "İlgilenmiyor" seçilirse kayıp sebebi sorulur.

## Bilinen sınırlar
- Bildirimler yalnızca uygulama açıldığında / açıkken gelir (kapalıyken bildirim için ücretli sunucu gerekir).
- Sevkiyat programıyla doğrudan veri bağlantısı yok (ayrı Firebase projesi); şimdilik WhatsApp metni ile.
- Fotoğraf ve ses, giriş yapılmadan kullanılırsa cihaz hafızasına sığdığı kadar saklanır.

## Güncelleme nasıl yapılır
GitHub → depo → Add file → Upload files → değişen dosyaları sürükle → Commit changes → 1-2 dk sonra sitede Ctrl+F5.
