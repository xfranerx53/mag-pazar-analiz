# MAG Ambalaj • Pazar Analiz — Proje Notları

> **Programın asıl amacı:** Seçilen konumun çevresinde (yarıçap / mesafe) potansiyel müşteri işletmeleri **otomatik taramak**, bilgilerini (ad, adres, telefon, web, uzaklık) vermek ve seçilenleri takip listesine almak. Ana ekran: **🔍 Çevrede Tara**. Teklif / sipariş / tahsilat gibi bölümler bulunan müşterilerin takibi için arkada durur.

**Site:** https://mag-pazar-analiz.pages.dev (Cloudflare Pages; GitHub `xfranerx53/mag-pazar-analiz` → `main` dalına her yüklemede otomatik yayınlanır)
**Yapı:** Tek dosya `index.html` + `sw.js` (çevrimdışı önbellek) + `manifest.webmanifest` + `icon.svg`. Derleme yok.
**Bulut:** Firebase projesi `mag-pazar` — Realtime Database (europe-west1), giriş: E-posta/Şifre. Ayarlar `index.html` içine gömülü.
**Tarama kaynakları:** OpenStreetMap Overpass API (ücretsiz, anahtarsız; overpass-api.de, yedek overpass.kumi.systems) + isteğe bağlı Google Maps JavaScript API / Places (anahtar ⚙ Ayarlar'da, aylık sorgu sınırı ile). Adres → konum: Nominatim (OSM).
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
  - *Analiz:* Satış hunisi (adım adım dönüşüm, en çok kayıp olan adım), son 6 ay karşılaştırma tablosu (▲▼ geçen aya göre), Türkiye haritası (il bazında firma/müşteri; v8.2'de dünya haritası oldu), sektör kârlılığı, kayıp sebepleri, rakip takibi (mevcut tedarikçi + fiyatı).
  - *Otomasyon:* Günlük bildirim (uygulama açıldığında; izin gerekir), uyuyan müşteri listesi (varsayılan 60 gün), teslimi geciken siparişler, kartvizit fotoğrafı, sesli görüşme notu (en fazla 60 sn), 7 sayfalık Excel raporu.
  - *Entegrasyon:* "📤 Sevkiyata bildir" siparişi hazır metin olarak WhatsApp'a (Mag Sevkiyat grubu) gönderir; ürün maliyetleri poşet maliyet tablosundan girilerek kâr marjı görünür.

- **v5 (29.10.2026) — ÇEVREDE TARA (asıl amaç)**
  - Ana ekran tarama: merkez = GPS konumu, yazılan adres veya haritaya tıklama; yarıçap 500 m – 25 km.
  - 13 sektör (market, manav, kasap, fırın/pastane, dürüm/fast food, restoran, kafe, kuruyemiş/şarküteri, eczane, büfe/tekel, giyim, hırdavat, toptancı) + serbest arama kelimesi.
  - Kaynak: OpenStreetMap (ücretsiz) ve/veya Google Haritalar; iki kaynağın aynı işletmesi birleştirilir (Google bilgisi öncelikli).
  - Sonuçlar yakından uzağa; ad, sektör, mesafe, adres, telefon, web, Google puanı; haritada noktalar (yeşil = telefonlu).
  - Filtre: sektör, sadece telefonu olanlar, listemde olmayanlar (mükerrer kontrolü), arama; sıralama A-Z / yorum sayısı.
  - Tek tıkla veya toplu "listeye ekle" (sektör, il, adres, telefon, konum, mesafe, kaynak otomatik dolar), seçilenlere Google Haritalar rotası, CSV indir.
  - Google aylık sorgu sayacı (cihaz + bulut), sınır dolunca Google durur, OSM devam eder. Son tarama cihazda saklanır.

## Geoapify anahtarı nasıl alınır (ücretsiz, kart yok — önerilen)
Herkese açık ücretsiz OpenStreetMap sunucuları (Overpass) yoğunlukta ve mobil operatörlerin ortak IP'si yüzünden sık sık cevap vermiyor ("Failed to fetch"). Geoapify aynı OSM verisini güvenilir sunucudan verir; günde 3.000 kredi ücretsiz, kredi kartı istemez.
1. geoapify.com → Sign up (Google hesabıyla girilebilir).
2. "My projects" → "Create project" (ad: mag) → oluşan **API key**'i kopyala.
3. Sitede ⚙ Ayarlar → "Geoapify anahtarı" alanına yapıştır → Kaydet.
4. Tarama artık önce Geoapify'ı kullanır; hata olursa otomatik yedek sunuculara geçer.
- v5.1 (29.10.2026): Overpass için 4 yedek sunucu + 35 sn zaman aşımı + açık hata mesajı; Geoapify desteği; haritaya dokununca merkez değişmeden önce onay; GPS hassasiyeti gösterimi.

- **v6 (29.10.2026) — kullanım kolaylığı**
  - Sektörler 6 grupta 49 başlık: Gıda perakende, Yeme-içme, Mağazalar, **Sanayi / Toptan (Fabrika, Atölye, Toptancı, Depo/Lojistik, Ambalaj, Matbaa, Hırdavat, Tarım, Oto, Akaryakıt)**, Hizmet. Seçim aranabilir liste penceresinde (tik kutusu yok), grup grup seçilebilir.
  - Alt menü: Tara • Liste • Bugün • Satış (Teklif/Sipariş/Tahsilat) • Diğer (Analiz, Ürünler, Ayarlar, Bulut, Yönetim, Tema).
  - Tarama 3 adım: Nerede? (konum/adres) → Ne kadar uzağa? (düğmeler) → Hangi işletmeler? (liste). Gelişmiş seçenekler katlanır.
  - Sonuçlar: Liste / Harita geçişi, karta dokunarak seçme, alttaki çubukla toplu listeye ekleme / rota.
  - Müşteri listesinde filtreler ve içe/dışa aktarma katlanır menüde; kartta az kullanılanlar "⋯ Diğer işlemler" altında.
  - Geoapify geçersiz kategori hatasında kategorileri tek tek dener; Geoapify'da olmayan sektörler (Ambalaj, Akaryakıt) ve ek kelime OpenStreetMap yedek sunucusundan aranır.

- **v6.1 (29.10.2026) — sonuç filtreleri:** Telefon (hepsi / telefonu olan / cep-WhatsApp / sabit hat / numarasız), müşteri listem (olmayan / olan), web sitesi, adres, zincir mağazalar (göster / gizle / sadece; BİM, A101, Migros, Opet, McDonald's vb. — isim başına bakar), Google puanı (3+/4+/4,5+), yorum sayısı (10+/50+/200+ = işletme büyüklüğü), kaynak (Google / OSM / ikisinde de), bölge (ilçe), en fazla uzaklık, gizlenenler. Sıralama: yakınlık, telefonlu önce, puan, yorum, A-Z, sektör. Kartta "Gizle" (bir daha gösterme, cihazda saklanır), toplu gizleme, aktif filtre sayısı rozeti, filtreler cihazda hatırlanır.

- **v7 (29.10.2026) — saha, pazar analizi, ekip**
  - Saha: 📞 Arama modu (sırayla arama, tek dokunuşla sonuç: ulaşılamadı / sonra ara / ilgileniyor / teklif istedi / numune istedi / sipariş verdi / ilgilenmiyor → durum ve sonraki arama tarihi otomatik), 🗺 akıllı rota (en kısa sıra, 10'arlı Google Haritalar bölümleri, yazdırılabilir plan), 📍 Yakınımda (listeyi sana olan uzaklığa göre sıralar), 📍 Buradayım (ziyaret kaydına GPS konumu), 📸 Sahadan ekle (konum + adres otomatik + fotoğraf), çevrimdışı çalışma (bekleyen kayıtlar internet gelince eşitlenir; Firebase/harita kütüphaneleri önbellekte).
  - Pazar: ⭐ Aday puanı 0-100 (sektörün poşet tüketimi, telefon/cep, yorum sayısı, yakınlık, zincir cezası), sektör başı tahmini poşet tüketimi (Ayarlar'dan düzenlenir) ve ₺/kg ile bölge pazar büyüklüğü, 📄 Bölge pazar raporu (PDF), 🔥 yoğunluk haritası, rakip ambalajcı tespiti (isimde ambalaj/poşet/naylon/plastik), yeni açılan işletmeler (önceki taramada olmayan) + taranan alanların haritada gösterimi.
  - Satış: 💬 Toplu WhatsApp (sırayla, şablonlu, izinsizleri atlar), 🎁 Numune takibi (N gün sonra Bugün'de hatırlatma), 🔁 Tekrar sipariş hatırlatması (müşterinin ortalama sipariş aralığına göre), 💡 Önerilen fiyat (maliyet + hedef kâr marjı), cari/fatura bilgileri (unvan, VD, VKN, vade, fatura adresi) teklif/sipariş çıktısında.
  - Ekip: personel performansı (aylık yeni firma, görüşme, ziyaret, numune, teklif, sipariş, tahsilat), satış bölgeleri (Yönetim → bölge ekle; taramadan eklenen firma bölge sahibine atanır, başkasına uyarı).
  - Henüz yok: Sevkiyat programına doğrudan sipariş aktarımı (sevkiyat programının veri yapısı gerekiyor; şimdilik "📤 Sevkiyata bildir" WhatsApp metni).

- **v7.1 (29.10.2026):** GitHub Pages'e taşındı. Giriş penceresinde "Beni hatırla" (oturum açık kalır, ad/e-posta dolu gelir, şifre tarayıcının şifre kasasında). Cihaz hafızası anahtarları "mpz:" ön ekiyle (aynı github.io adresindeki diğer programlarla karışmaz). API anahtarları buluttaki ayarlara da yazılır; bulutta yoksa cihazdaki korunur.

- **v8 (29.10.2026) — kendi veri servisimiz:** Tarama ve adres/semt arama önce **mag-veri** deposundaki kendi OpenStreetMap verimizden yapılır (anahtarsız, kotasız, ücretsiz; haftalık otomatik güncelleme; parçalar telefonda önbelleğe alınır). Kendi verimiz yoksa sırayla Geoapify → yavaş ücretsiz sunucu. Ayarlar'da "Veri adresi" ve "Veriyi kontrol et". Kurulum: mag-veri deposundaki README.md. Geoapify anahtarı kutusuna bağlantı yapıştırılırsa anahtar otomatik ayıklanır; "AIza" ile başlamayan Google anahtarı kabul edilmez.

- **v8.1 (29.10.2026):** Mesafe elle yazılabilir (0,1–300 km; 50 km üstünde uyarı), kendi veride parçalar 8'er 8'er indirilir, eski sektör adları yenilerine eşlenir. mag-veri görevi her çalışmada `son_guncelleme.txt` yazar (GitHub 60 gün hareketsizlikte zamanlanmış görevi kapatıyor).

- **v8.2 (30.10.2026) — dünya haritası:** Analiz'deki Türkiye haritası dünya haritası oldu. Her kayıt gerçek konumunda (taramadan/ziyaretten gelen konum), konumu yoksa Türkiye il merkezinde gösterilir. Yakınlaştırdıkça daireler ülke → şehir → semt → tek firma diye ayrılır (çift dokunuş = yakınlaştır). "🌍 Tüm kayıtlar" bütün kayıtları ekrana sığdırır. "📍 Konumu olmayanları bul" adres / İl-İlçe alanından (örn. "Berlin, Almanya") yerini ücretsiz OpenStreetMap adres aramasıyla bulur (saniyede 1 kayıt, Durdur düğmesi var). Adresten bulunan konum, kayıtta adres veya il değiştirilince kendiliğinden silinir (yanlış yerde kalmasın).
- **v8.3 (30.10.2026):** Tarama 1. adımda "🗺 Haritadan seç": tam ekran harita açılır, ortadaki iğne sabit durur, harita kaydırılır (veya dokunulan yere gider); seçili mesafe kırmızı daire olarak görünür; yer adı kendiliğinden bulunur (önce kendi verimiz, sonra OpenStreetMap). Dünyanın her yeri seçilebilir; Türkiye dışında tarama Geoapify/OpenStreetMap ile yapılır (kendi veride şimdilik sadece Türkiye var).
- **v8.4 (30.10.2026) — dünya verisi:** Kendi veri deposu (mag-veri) bütün dünyayı kapsıyor: 8 bölge (Avrupa+Türkiye, Rusya, Asya, Afrika, Kuzey/Orta/Güney Amerika, Okyanusya), ayda 2 kez güncellenir. Program yeni düzeni (`dunya.json`, sıkıştırılmış `.json.gz` kareler) okur; yoksa eski Türkiye düzenine döner. Semt/şehir araması dünya genelinde ve Türkçe/İngilizce/yerel adla çalışır ("Moskova", "Moscow"); adres araması artık Türkiye ile sınırlı değil.
- **v9 (30.10.2026) — harita ve dünya geneli:**
  - *Haritadan seç* penceresinde 3 mod: 📍 Daire (iğne + mesafe), ⬠ Alan çiz (köşelere dokun; sadece çizilen alanın içi taranır), 〰 Yol boyunca (yol üzerindeki noktalara dokun, genişlik 100 m–1 km; yolun iki yanı taranır). Mesafe düğmesine dokununca daireye dönülür.
  - *Kayıtlı yerler:* "＋ Bu yeri kaydet" ile merkez/alan/yol adıyla saklanır (bu cihazda, en çok 30), ⭐ ile tek dokunuşta seçilir, ✕ ile silinir.
  - *Taranmış yerler:* son 200 tarama (alan/yol şekli dahil) seçim haritasında gri, sonuç haritasında kesikli gösterilir. "Yeni açılan" hesabı da çizilen şekle göre yapılır.
  - *Para birimi ve ülke telefon kodu* (Ayarlar → Satış ve pazar hesapları): tüm tutarlar ve ₺ yazan etiketler seçilen para birimine döner; WhatsApp'ta 0'la başlayan/kodsuz numaralara ülke kodu eklenir, +… ve 00… numaralar olduğu gibi kalır.
  - *Kayıtlar haritası:* durum / sektör / satışçı süzgeci; "🧭 Görünen alandan rota" haritada görünen ve tam konumu olan firmalardan ziyaret rotası çıkarır.
- **v9.1 (30.10.2026):** Düzeltme: "X sektör seçili" sayısı 0 görünüyordu (aynı kimlik iki yerde). Yeni sektör "Diğer işletmeler (sektörü belirsiz)": veride olup hiçbir sektöre girmeyen işletmeler artık seçilerek görülebilir. Fabrika: adı olan sanayi binaları ve sanayi alanları (OSB) da; Depo: depo binaları; Ambalaj: adında ambalaj/poşet/packaging geçenler; Şirket/Ofis: tüm ofis türleri. Aynı kurallar mag-veri sektorler.json ve build.py'ye de işlendi (bir sonraki derlemede geçerli).
- **v10 (30.10.2026) — büyük paket:**
  - *Bulutta kişisel ayarlar:* kayıtlı yerler, taranan alanlar, gizlenen firmalar ve filtreler `kisisel/<kullanıcı>` altında; telefon ve bilgisayarda aynı.
  - *Ekip ortak katmanı:* sahadan (taramadan değil) eklenen ve konumu olan firmalar `ortak/` altına yazılır, ekipteki herkesin taramasında "Ekip" kaynağıyla çıkar.
  - *OpenStreetMap'e bildir:* kayıt → ⋯ → "🌍 OpenStreetMap'e bildir" haritada eksik firmayı herkese açık not olarak gönderir (ücretsiz, hesapsız).
  - *Kartvizitten doldur:* kayıt formunda kartvizit fotoğrafı → firma, yetkili, telefon, e-posta, adres otomatik (Tesseract.js, telefonda çalışır, ilk seferde dil dosyası iner).
  - *Yakındaki sanayi bölgeleri:* Tara → "🏭 Yakındaki sanayi bölgeleri / OSB'ler" (kendi veri + OpenStreetMap), dokununca 3 km merkez.
  - *Belge dili:* kayıtta "Belge dili" (Türkçe / English / Русский) → teklif ve sipariş PDF'i o dilde.
  - *Bugün özet panosu:* bugün aranacak, bu ay yeni müşteri / hedef, geciken teslim, numune, alacak, yeni açılan; bulut kapalıysa haftalık yedek hatırlatması.
  - *Araçlar (Diğer → 🧰):* mükerrer kayıt birleştirme, aramayın listesi + CSV (KVKK kaydı), PIN kilidi, Firebase güvenlik kontrolü, sektorler.json indir, yedek.
  - *Aramayın listesi:* kayıt → ⋯ → "⛔ Aramayın listesine al" (neden + tarih + kim); arama modu, toplu WhatsApp ve Bugün'den çıkar.
  - *Satışçı primi:* Ayarlar → yeni müşteri başına tutar + tahsilat %; Analiz → performans tablosunda Prim sütunu.
  - *Hammadde fiyatları:* Ürünler ekranında; fiyat girilince bağlı ürünlerin maliyeti (birim başına kg × fark) güncellenir, son 24 fiyat geçmişi.
  - *Müşteri sipariş sayfası:* kayıt → ⋯ → "🔗 Sipariş linki / QR". Müşteri linkten (giriş yapmadan) ürünleri görür, miktar yazıp talep gönderir; talepler Satış → Siparişler'de "Siparişe çevir". Fiyatların görünmesi Ayarlar'dan.
  - *Google ile giriş* (Firebase'de Google sağlayıcısı açılmalı), *Takvime ekle* (.ics, alarm 09:00), Rusya/Kazakistan 8'li numaralar.
  - Sektör kuralları artık mag-veri `data/sektorler.json`'dan okunur (tek yerden yönetim).
  - **Firebase kuralları değişti** (kisisel, ortak, vitrin, musteri, talep) → ☁ → kuralı kopyala → Firebase Rules → Publish.
  - Yapılamayanlar: uygulama kapalıyken bildirim (ücretli sunucu gerekir; yerine takvim), sevkiyat entegrasyonu (sevkiyat index.html'i gerekli), tüm arayüzün çevirisi (şimdilik sadece PDF).
- **Alan adı notu (30.10.2026):** magambalaj.com Natro'da (NS1/NS2.NATROHOST.COM). İleride `pazar.magambalaj.com` → Cloudflare Pages için Natro DNS'e CNAME `pazar` → `mag-pazar-analiz.pages.dev` eklenecek (siteyi kuranlarla birlikte yapılacak); sonra Firebase "Authorized domains"a eklenip program deposu gizlenebilir.

## Google Haritalar anahtarı nasıl alınır (isteğe bağlı)
1. console.cloud.google.com → yeni proje (veya mevcut `mag-pazar` Firebase projesi).
2. Faturalandırma hesabı bağla (kart ister; aylık ücretsiz kota aşılmadıkça ücret çıkmaz). Places "Enterprise" alanları (telefon, web, puan) için ayda yaklaşık 1.000 sorgu ücretsiz; her sorgu en çok 20 işletme getirir.
3. APIs & Services → Library: **Maps JavaScript API** ve **Places API (New)** → Enable.
4. Credentials → Create credentials → API key → Application restrictions: **Websites** → `https://mag-pazar-analiz.pages.dev/*` ; API restrictions: yukarıdaki iki API.
5. Anahtarı sitede ⚙ Ayarlar → "Google API anahtarı" alanına yapıştır, "Aylık Google sorgu sınırı" 900 kalsın.
6. Güvenlik için Google Cloud → Billing → Budgets & alerts'ten 1 ₺ / 1 $'lık bütçe uyarısı kur.

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
