# MAG Ambalaj • Pazar Analiz — Proje Notları

> **Programın asıl amacı:** Seçilen konumun çevresinde (yarıçap / mesafe) potansiyel müşteri işletmeleri **otomatik taramak**, bilgilerini (ad, adres, telefon, web, uzaklık) vermek ve seçilenleri takip listesine almak. Ana ekran: **🔍 Çevrede Tara**. Teklif / sipariş / tahsilat gibi bölümler bulunan müşterilerin takibi için arkada durur.

**Site (tek resmi adres):** https://xfranerx53.github.io/mag-pazar-analiz/ (GitHub Pages; `xfranerx53/mag-pazar-analiz` → `main` dalına her yüklemede otomatik yayınlanır). Eski Cloudflare adresi (mag-pazar-analiz.pages.dev) Türkiye'de açılmadığı için kullanılmıyor; açılırsa kendiliğinden buraya yönlendirir.
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
- **v10.1 (30.10.2026) — e-posta:** Tarama sonuçlarında e-posta: OpenStreetMap'te kayıtlıysa doğrudan gelir (kendi veri, Geoapify, Overpass). Yoksa ve web sitesi varsa "🔎 E-posta bul" (tek firma) veya seçilenlerde "✉ E-posta bul" (toplu) web sitesinin ana sayfasını ve iletişim sayfasını tarar (ücretsiz açık aracı sunucular: allorigins, corsproxy, r.jina.ai; [at]/(at) gibi gizlemeler çözülür). Filtre: E-posta var / yok / "yok ama web sitesi var". Listeye eklenince e-posta kayda geçer; kayıtta "🔎 Web'den e-posta bul". CSV'ye E-posta sütunu. mag-veri kayıtlarına 10. alan olarak e-posta eklendi (bir sonraki derlemede).
- **v11 (02.11.2026) — 🤖 AJAN MERKEZİ (kâr modeli, 1. adım):** Diğer → 🤖 Ajanlar (Bugün ekranında da özet kartı ve düğme). Tamamen ücretsiz, kural tabanlı; tarayıcıda çalışır, veri dışarı çıkmaz.
  - 👔 *Müdür:* tüm bulguları aciliyet + paraya etkisine göre sıralar; "masadaki para" (vadesi geçen alacak, beklenen tekrar sipariş, açık tekliflerden olası, uyuyanlardan aylık, düşük fiyattan kayıp); sabah raporu → WhatsApp / kopyala.
  - 🛡 *Fiyat Bekçisi:* bekleyen tekliflerde ve katalogda asgari kâr marjının altındaki kalemler (teklif verildikten sonra maliyet artmışsa belirtir); teklif/sipariş **kaydedilirken** asgari marjın altındaysa uyarır, onaysız kaydetmez.
  - 💰 *Tahsilat:* ödemeler en eski siparişten düşülür, vade = firmanın "Vade (gün)" alanı ya da varsayılan; gecikme günü, vade farkı (aylık %), vadesi 3 gün içinde dolacaklar; hazır hatırlatma mesajı.
  - 📨 *Teklif Takipçisi:* N gündür cevapsız teklifler (son görüşmeden beri N gün geçmişse), olası değer = teklifin %30'u.
  - 🔁 *Tekrar Sipariş* (sipariş aralığına göre) ve 😴 *Uyuyan Müşteri* (Ayarlar'daki uyku günü; aylık kayıp tahmini); hazır mesajlar.
  - 🎯 *Müşteri Avcısı:* durumu Yeni, telefonu olan, hiç görüşülmemiş kayıtlardan aday puanı + öncelik ile günün ilk N adayı; "sırayla ara" ve tanıtım mesajı.
  - 🧪 *Hammadde:* son 30 günde fiyatı değişen hammaddeler ve hedef kârın altına düşen bağlı ürünler; N gündür fiyatı girilmeyen hammadde hatırlatması.
  - Her bulguda: Ara, 💬 WhatsApp (görüşme geçmişine "🤖 ajan adı" ile yazılır, Yeni → İletişim kuruldu), Kopyala, ilgili işlem düğmesi, "✓ Sonra" (3 gün gizle, cihazda).
  - *Kurallar* (Ajanlar ekranının altında, yönetici kaydeder → `ayar.ajan`): asgari kâr %10, vade 30 gün, vade farkı aylık %4, teklif takibi 3 gün, günlük 10 aday, hammadde hatırlatma 15 gün.
  - sw.js önbellek sürümü mag-v16.

- **v11.1 (02.11.2026) — tek adres:** Program yalnızca https://xfranerx53.github.io/mag-pazar-analiz/ adresine bağlı. Uygulama bilgisi (manifest) bu adrese sabitlendi (id / start_url / scope), Android için PNG simgeler eklendi (192, 512, maskable) → Chrome'dan "Uygulamayı yükle / Ana ekrana ekle" bu adresle kurulur. pages.dev'den açılırsa github.io'ya yönlendirir; o cihazda bulutla eşitlenmemiş kayıt varsa önce yedek indirmeyi önerir. sw.js önbellek mag-v17.

- **v12 (02.11.2026) — 🧠 yapay zekâ + 🌙 gece ajanı (kâr modeli tam sürüm):**
  - *Yapay zekâ beyni:* Google Gemini ücretsiz anahtarı (kart yok). Ajanlar → 🛠 Kurulum → 1. adım. Model kendiliğinden seçilir (en yeni kararlı "flash"; kota/hata olursa sıradakine geçer). Anahtar `ayar.aiKey` (yönetici kaydeder, ekip kullanır). v12.1: Google'ın yeni "AQ." anahtarları desteklenir — anahtar URL'de değil `x-goog-api-key` başlığında gönderilir (eski AIza anahtarları da çalışır).
  - *Gizlilik:* ücretsiz katmanda Google gönderilen içeriği ürün geliştirmede kullanabildiği için firma adları **F12** gibi kodlarla gider; telefon, e-posta, adres, yetkili ve personel adları gönderilmez (yazı içinde geçse bile silinir). Cevaptaki kodlar telefonda gerçek adlara çevrilir. Tutarlar, sektör, ürün ve tarihler gider.
  - *💬 Müdürle konuş:* gerçek verilere (ajan bulguları, en önemli 120 firma, ürün/maliyet, hammadde, kurallar) bakarak cevap verir; hazır sorular; sohbet cihazda saklanır (son 40).
  - *🧠 Müdür'ün bugünkü planı:* günlük öncelikli eylem planı (cihazda günlük saklanır).
  - *✨ Firmaya özel mesaj:* her işte "✨ Özel yaz" → firmanın geçmişine göre mesaj; selam (yetkili adıyla) ve imza programca eklenir. "✨ Önemli işlerin mesajlarını yaz" toplu (kota için ~7 sn arayla).
  - *🛠 Kurulum ekranı:* 6 adımlı kontrol listesi (anahtar, kural, ajan hesabı, bildirim anahtarı, GitHub, bu telefonda bildirim).
  - *🔔 Bildirim:* VAPID anahtar çifti programda üretilir (açık anahtar `ayar.vapidPub`, gizli anahtar sadece GitHub secret `VAPID_PRIVATE`). Telefon aboneliği `ajan/abone/<uid>/<cihaz>`. Bildirime dokununca `?git=ajan` ile Ajanlar açılır (sw.js push + notificationclick). sw.js önbellek mag-v18.
  - *Firebase kuralı değişti:* `ajan` (okuma/yazma yönetici; `abone/<uid>` kişinin kendisi) → ☁ → Kuralı kopyala → Firebase Rules → Publish.

## 🌙 Gece ajanı (GitHub Actions — ücretsiz)
- Dosyalar: `ajan-gece.mjs` + `.github/workflows/ajan-gece.yml`. v16'dan beri her saat uyanır, programdaki ⏰ çalışma saatlerinde iş yapar; Actions → "Ajan sabah raporu" → **Run workflow** ile elle.
- Ajan kuralları **index.html'den okunur** (v11 AJAN MERKEZİ bloğu + v12 yapay zekâ bloğu) — kural değişince betiği ayrıca güncellemek gerekmez. Yardımcı fonksiyonlar da adlarıyla index.html'den alınır (adı değişirse betikteki YARDIMCI listesi güncellenmeli).
- Secrets (Settings → Secrets and variables → Actions): `GMAIL_USER`, `GMAIL_APP_PASSWORD` (isteğe bağlı, e-posta), `FB_EMAIL`, `FB_PASSWORD` (ajanın kendi hesabı; ilk çalışmada kendisi açar → Yönetim'den **Yönetici** yapılmalı), `VAPID_PRIVATE`, `GEMINI_KEY` (isteğe bağlı: rapora Müdür yorumu).
- Yaptığı: girer → leads/ayar/katalog/users okur → ajanları çalıştırır → `ajan/rapor/son` yazar → (Pazartesi) haftalık strateji → web sitelerinden e-posta bulur (programda Müdür ekranında "🌙 Gece ajanının raporu") → yöneticilerin abone cihazlarına bildirim (eskimiş abonelikleri siler).
- Depo herkese açık: betik **log'a müşteri bilgisi yazmaz** (sadece sayılar).
- GitHub, depoda 60 gün hiç değişiklik olmazsa zamanlanmış görevi durdurur; durursa Actions sekmesinden yeniden açılır.

- **v13 (02.11.2026) — kullanılabilirlik + kazandıran yapay zekâ özellikleri:**
  - *Müşteri listesi toplu işlem:* ✨ Kampanya mesajı, ✉ E-posta bul (web sitesi olanlar), 🗺 Rota (seçilenler, en yakından, 10 durak).
  - *⭐ Önce kazandıracaklar* sıralaması (varsayılan): vadesi geçen alacak, sipariş zamanı gelen, bekleyen teklif, bugün aranacak, öncelik, durum ve aday puanına göre.
  - *Kart:* aday puanı ve son görüşmeden geçen gün etiketi (30+ gün ilgilenen/teklifli ise kırmızı); "✨ Satış koçu" düğmesi.
  - *✨ Satış koçu:* firmanın sipariş/görüşme geçmişi + aynı sektördeki müşterilerin aldıkları + ürün maliyetleri → durum, ne satmalı, fiyat (en az kâr kuralı), açılış cümlesi, itirazlar, sonraki adım; tek dokunuşla WhatsApp mesajı.
  - *✨ Akıllı görüşme notu:* not yazılınca durum, öncelik, sonraki arama tarihi ve kayıp sebebi doldurulur; kaydedince takip mesajı önerilir.
  - *✨ Fiyat danışmanı* (teklif/sipariş penceresi): müşterinin geçmiş fiyatları, diğer müşterilerin fiyatları, liste fiyatı, maliyet ve rakip fiyatına göre kalem kalem fiyat; asgari kâr kuralının altı programca engellenir; "Uygula".
  - *✨ Kampanya mesajı:* amaç seç (tanıtım, numune, geri kazanım, fiyat güncellemesi, sezon…) → 3 mesaj ({firma}/{yetkili} ile kişiye özel, İPTAL cümlesiyle) → şablonlara kaydedip toplu WhatsApp.
  - *✨ Bölge yorumu* (tarama sonrası): sektör bazında değer, ilk aranacak 5 firma (T kodları telefonda ada çevrilir), saha planı; "İlk 15 adayı listeye ekle".
  - *Yeni ajanlar:* 🧩 Çapraz Satış (aynı sektördeki müşterilerin %30+'ının aldığı ama bu müşterinin hiç almadığı ürün); 🛡 Fiyat Bekçisi'ne "sonraki siparişte fiyat güncellenmeli" (son sipariş fiyatı bugünkü maliyetle asgari kârın altındaysa, hazır fiyat güncelleme mesajı).
  - *Gece ajanı:* ✉ e-posta avcısı (web sitesi olup e-postası olmayan en çok 30 kayıt/gece, ana sayfa + iletişim sayfası; bulunamazsa 30 gün tekrar denenmez; `eposta`, `epKaynak`, `epDenendi`) ve 📅 haftalık strateji (Pazartesi ya da son rapor 7 günden eskiyse → `ajan/rapor/hafta`, Müdür ekranında).
  - *Düzeltmeler:* Analiz tabloları telefonda sayfayı yana taşırmıyor; liste özet kutuları 3 sütun; teklif listesinde kâr kuralının altındakilere "🛡" etiketi; program başlangıcı tüm modüller yüklendikten sonra (`__baslat`); yapay zekâ JSON cevap modu. sw.js önbellek mag-v19.

- **v13.1 (02.11.2026):** Yapay zekâ istekleri artık takılı kalmaz: istek başına 45 sn süre sınırı (aşılırsa açık hata mesajı), bekleme sırasında saniye sayacı ("Google düşünüyor • 12 sn") ve **Vazgeç** düğmesi; hızlı cevap için düşük düşünme modu (Gemini 3: thinkingLevel low, 2.5 Flash: thinkingBudget 0; model kabul etmezse kendiliğinden ayarsız tekrar dener); "düşünce" parçaları cevaptan ayıklanır. Gece ajanı da aynı kodu kullanır.

- **v13.2 (02.11.2026):** Yapay zekâ cevabı **akış (stream)** ile alınır (`streamGenerateContent?alt=sse`): metin yazıldıkça ekrana gelir (Satış koçu, sohbet, bölge yorumu); süre sınırı artık "40 sn hiç veri gelmezse" (yazmaya devam ettiği sürece kesilmez); 2 model üst üste cevap vermezse durur. 🛠 Kurulum → **🩺 Hız testi**: ilk 6 modeli kısa bir soruyla dener (model başına en çok 25 sn), çalışanları hıza göre sıralar ve en hızlıyı 30 gün kullanır.

- **v14 (02.11.2026) — 🤖 OTONOM AJANLAR + 🏠 TEK EKRAN:**
  - *Açılış ekranı "🏠 Bugün" (iş akışı):* üstte "🤖 Ajanlar bugün çalıştı" günlüğü (`ajan/gunluk/<tarih>`), ilerleme çubuğu, sonra sırayla işler: 📨 e-postaya cevap verenler → acil/önemli ajan işleri → bugünkü planlı aramalar → adaylar/çapraz satış. Her işte tek büyük düğme (💬 Gönder = gece yazılmış hazır mesaj / 📞 Ara → aramadan sonra görüşme penceresi), altında Yarına / ✓ Bitti (3 gün gizler). İlk 15 iş, "daha göster".
  - *Alt menü 5 sekme:* 🏠 Bugün • 🔍 Tara • 📋 Müşteriler • 💬 Müdür (sohbet) • ☰ Diğer (🤖 Ajanlar, 💼 Satış, 📅 Planlı aramalar, Analiz, Ürünler, Ayarlar…). `?git=<sekme>` ile açılış.
  - *Sade müşteri kartı:* durum, Aramayın, sonraki arama, bakiye, 📨 cevap verdi, aday puanı, son temas; düğmeler Ara • WhatsApp • + Görüşme • ✨ Koç; geri kalan her şey "⋯ Daha fazla"da. Liste 60'ar kart (sayfalama), telefonda üstteki sayı kutuları gizli.
  - *Gece ajanı otonom (günde 3 kez: 08:12 tam tur, 13:12 ve 18:12 gelen kutusu + e-posta):*
    - 🔄 Takip ayarı: ilgilenen/teklifli/iletişimdekilerde boş sonraki arama, sipariş zamanı, uyuyan müşteri, gecikmiş alacak, aday puanı ≥50/70 → öncelik ve tarih (gecede en çok 300 kayıt).
    - 🎯 Otomatik tarama: `ayar.otonom.merkez` çevresinde kendi verimizden (mag-veri dunya.json + w/i + w/t .gz) seçili sektörler (yoksa poşet tüketimi ≥20 kg/ay olanlar); zincir, rakip, listede olan (telefon/isim+300 m) ve daha önce eklenen (`ajan/gorulen`) elenir; aday puanına göre günde N (varsayılan 15) yeni kayıt, kaynak "🤖 Gece ajanı", sahibi bölge sahibi ya da yönetici; aday tükenirse yarıçap her gece +5 km (en fazla `yaricapMax`).
    - ✍ Hazır mesajlar: en önemli N (12) iş için firmaya özel WhatsApp mesajı → `ajan/taslak` (programda "💬 Gönder" bunları kullanır, 2 gün geçerli).
    - 📧 Gmail (isteğe bağlı, secrets `GMAIL_USER`, `GMAIL_APP_PASSWORD`): e-postası olan Yeni adaylara tanıtım, 5 gün cevapsızlara 1 takip, bekleyen teklife hatırlatma; yapay zekâ yazar, altbilgide firma bilgisi + "İPTAL yazın"; `List-Unsubscribe`; mod `kapali/deneme/acik` (deneme: her firmadan bir örnek sadece GMAIL_USER'a, günde en çok 3), günlük sınır (20). Kayda `epGonderim`, görüşme notu, durum Yeni→İletişim kuruldu, sonraki +5 gün.
    - 📨 Gelen kutusu (IMAP): kayıtlı e-postalardan (ya da aynı kurumsal alan adından) gelen cevaplar sınıflanır (ilgileniyor/soru/iptal/olumsuz/otomatik); İPTAL → Aramayın + izin çıkış; olumsuz → İlgilenmiyor; ilgileniyor/soru → İlgileniyor + Sıcak + bugün ara + **anında bildirim** + Gmail Taslaklar'a cevap taslağı (In-Reply-To ile). Gelen metindeki telefon/e-posta/imza satırları ve telefondan önceki isimler yapay zekâya gitmeden silinir.
    - Durum `ajan/durum` (tarih, epN, taramaR, sonGelen); günlük 30 gün tutulur. Bildirim: sabah özeti + sıcak gelişmeler (`./?git=akis`).
  - *Kurulum 7. adım:* fabrika konumu (GPS ya da Tara ekranı merkezi), yarıçap, günlük aday, hazır mesaj sayısı, e-posta modu ve sınırı, sektörler (Tara ekranındakileri kullan), Gmail kurulum anlatımı. 2. adım artık yazma iznini de dener.
  - *Firebase kuralı değişti:* `ajan` altı yönetici okur/yazar (`abone/<uid>` kişinin kendisi) → ☁ → Kuralı kopyala → Publish.
  - *Workflow değişti:* 3 zamanlama, `nodemailer imapflow mailparser` kurulumu, GMAIL secrets, 25 dk süre.
  - *Düzeltmeler:* "⭐ Önce kazandıracaklar" vadesi geçmeyen bakiyeyi artık geciken saymıyor; toplu "E-posta bul" listeden ayrılmadan çalışır (ilerleme tostla); WhatsApp "Gönder" yalnızca cep numarasında (sabit hatta "Ara"); deneme modunda aynı firmaya ikinci örnek gitmez. sw.js mag-v20.

- **v14.1 (02.11.2026):** Ajanlar ekranındaki üst düğmeler (Müdür … 🛠 Kurulum) artık yana kaymıyor, alt alta sarılıyor — bilgisayarda fareyle ulaşılamama sorunu giderildi. Diğer menüsüne doğrudan "🛠 Kurulum ve ajan ayarları" düğmesi eklendi.

- **v14.2 (02.11.2026) — her şey uygulamadan:** "▶ Ajanları şimdi çalıştır" (Bugün ekranında ve Kurulum 8. adımda): GitHub API `workflow_dispatch` ile ajanı başlatır, 10 sn'de bir durumunu izler, bitince günlüğü yeniler. Bir kerelik GitHub fine-grained token (yalnızca bu depo, Actions: Read and write) Kurulum 8. adımda girilir. Gmail adresi + uygulama şifresi (Kurulum 7b), bildirim gizli anahtarı (4. adımda üretilince) ve yapay zekâ anahtarı (`ayar.aiKey`) artık buluttan okunur → `ajan/gizli` (yalnızca yöneticiler okur/yazar). GitHub'da gereken secrets yalnızca `FB_EMAIL`, `FB_PASSWORD` (eski GMAIL_*/VAPID_PRIVATE/GEMINI_KEY secrets'ları varsa onlar önceliklidir). Her çalışmanın sonucu `ajan/sonCalisma` {t, ok, mesaj/ozet, elle} → Bugün ekranında "Son çalışma ✅/❌ + hata sebebi"; elle çalıştırma her zaman tam tur yapar.

- **v14.3 (02.11.2026) — 🔐 giriş zorunlu:** Program açılınca tam ekran giriş kapısı: e-posta/şifre ya da Google ile giriş yapılmadan ve hesap yönetici onayından geçmeden (rol beklemede değil) hiçbir ekran görünmez ("yalnızca bu cihazda" çalışma kalktı). Kapıda: Giriş yap, İlk kez hesap oluştur (yönetici onayına düşer), Şifremi unuttum, Google; onay bekleyen → bekleme mesajı + Çıkış; kural yoksa → Kuralı göster. İnternet yoksa ve oturum önbellekte değilse açılmaz. Müşteri sipariş linki (`?siparis=`) muaf. Şirketin genel e-postası **magambalajas@gmail.com** (ayar.firma.ep boşsa otomatik; ajan e-postalarının altbilgisinde); kullanıcı/yönetici hesabı xfranerxx@gmail.com.

- **v14.4 (02.11.2026):** Kurulum 7b/8 "Kaydet" hataları artık sessiz kalmıyor: Firebase kuralı eskiyse (ajan altına yazma izni yok) ne yapılacağını söyleyen uyarı; GitHub "Kaydet ve dene" düğmesi "Deneniyor…" gösterir, sonucu ✅/❌ pencereyle bildirir; anahtardaki boşluklar temizlenir.

- **v15 (02.11.2026) — 🎛 AJAN GÖREVLERİ:** Ajanlar → 🎛 Görevler (ve Diğer menüsünde yeşil düğme): 18 görev 4 grupta, her biri aç/kapat + zaman (Her sabah 08:12 / Günde 3 kez / Sadece elle) + e-posta görevlerinde hedef (Tüm liste / Sadece ajana verdiklerim); her görevin son sonucu (`ajan/gorevSon`) ve eksik bağlantı uyarısı (Gmail / yapay zekâ). Ayar `ayar.otonom.gorevler`.
  - Görevler: 🎯 yeni müşteri bul, ✉ e-posta bul, 🔄 takibi ayarla, 🗺 ziyaret rotası (yeni; `ajan/rota`, Bugün ekranında "Haritada aç"), ✍ WhatsApp mesajları; e-posta: 👋 tanıtım, 🔁 takip, 📨 teklif hatırlatma, 🎁 numune takibi (yeni), 📦 sipariş zamanı (yeni), 🧩 ürün önerisi (yeni), 😴 geri kazanım (yeni), 💰 ödeme hatırlatma (yeni, haftada en çok 1), 🛡 fiyat güncelleme (yeni); 📨 gelen cevaplar, 📋 Müdür raporu, 📅 haftalık strateji, 🔔 bildirim. Yeni e-posta türleri varsayılan kapalı.
  - ▶ Şimdi çalıştır → görev seçme penceresi (son seçim hatırlanır) → `ajan/istek` {t, gorevler} yazılır → ajan yalnızca seçilenleri yapar (20 dk geçerli, okununca silinir).
  - 🤖 Ajana ver / Ajandan al (Müşteriler → toplu işlem) → `ajanSec`; kartta 🤖 etiketi; sıralama "🤖 Ajana verdiklerim önce".
  - E-posta kuralları: firmaya günde en çok 1 e-posta, öncelik sırası teklif > ödeme > sipariş zamanı > numune > fiyat > ürün önerisi > geri kazanım > takip > tanıtım; tür başına tekrar aralığı (ödeme 7, sipariş 20, diğerleri 30-60 gün); deneme konusu türü de gösterir.

- **v15.1 (02.11.2026):** Kurulum 7b/8: kayıtlı Gmail uygulama şifresi ve GitHub anahtarı sayfa yenilense de kutuda (gizli noktalarla) görünür, 👁 ile gösterilir; "✅ Kayıtlı: adres + şifre (16 harf) • tarih" satırı. Yalnızca yöneticiler görür.
- **v16 (02.11.2026) — 🏢 AJAN OFİSİ (videodaki gibi: yönetici sensin, işi ajanlar yapar):**
  - *Ofis* (alt menü 🏢): 10 ajan kutusu (Müdür, Müşteri Avcısı, Mail Yazarı, Tahsilat, Muhasebe, Risk Analisti, Stok, Fiyat Bekçisi, Fırsat Avcısı, İçerik Üretici) + ajanların yaptıklarının akışı (`ajan/gunluk`, görev anahtarı `k` ile) + Müdür sohbeti.
  - *Müdür'e iş ver:* düz Türkçe komut → JSON eylem kartları (e-posta, WhatsApp, teklif, hatırlatma, kayıt güncelle, filtreyle firma seç + görev, ajanları çalıştır, risk, fırsat, içerik, stok) → ✅ Yap / Hepsini yap. E-postalar `ajan/kuyruk`'a yazılır ve ajan hemen başlatılır (Deneme modunda sana gelir). Teklifte Fiyat Bekçisi asgari kârın altını düzeltir. Hatırlatma `ajan/takvim` + Google Takvim bağlantısı + zamanında telefon bildirimi.
  - *⏰ Çalışma saatleri:* Görevler ekranında gün ve saat seçimi (`ayar.otonom.mesai`), ⏸ tatil (`ayar.otonom.durdur`). Workflow her saat uyanır; ajan sadece seçili saatte çalışır (gecikmeli tur bir sonraki saatte telafi edilir, aynı tur iki kez yapılmaz: `ajan/durum/slot`). 50 günde bir boş kayıtla zamanlayıcı açık tutulur.
  - *🛡 Risk Analisti:* 0-100 güven puanı = ödeme geçmişi 40 (FIFO ile ortalama gecikme, vadesi geçmiş borç, borç/aylık alım, notlarda "karşılıksız, icra…") + işletme profili 20 (sabit hat, web, kurumsal e-posta, unvan/vergi no, zincir, sektör riski) + web araştırması 40 (Gemini + Google Araması, ücretsiz katman: kuruluş yılı, şube, Google puanı, şikâyet, konkordato/iflas/icra/kapanma). Karar + vade + açık hesap limiti; `x.risk`, `x.limit`. Limit aşımı ve riskli bakiye ajan uyarısı. Resmî kontrol bağlantıları, banka sicili (KKB/Findeks) açıklaması ve Findeks raporu isteme mesajı. Gece görevi `risk`: günde 4 firma, 90 günde bir yeniler.
  - *📒 Muhasebe:* ay özeti, alacak yaşlandırma, en çok borçlular, Excel/CSV (Mikro, Logo, banka) bakiye listesi (`x.muhBakiye`, mutabakat) ve tahsilat listesi (ödeme olarak eklenir, tekrarları atlar). xlsx için SheetJS (jsdelivr) gerektiğinde yüklenir; CSV doğrudan okunur.
  - *📦 Stok:* hammadde kartlarına stok, kritik seviye, günlük kullanım, tedarikçi ve e-postası; kaç gün yeteceği; azalınca uyarı + tedarikçiye sipariş e-postası (kuyruk).
  - *🎪 Fırsat Avcısı* (Google araması: bölgede yeni açılışlar, poşet ihaleleri, fuar/etkinlik; tek dokunuşla listeye ekle) ve *🎨 İçerik Üretici* (haftalık 5 paylaşım, Google yorumu cevabı, 3 reklam metni). Gece görevleri `firsat`, `icerik` haftada bir; `ajan/firsat`, `ajan/icerik`.
  - *Tek kullanıcı:* program yalnızca sahibine (xfranerxx@gmail.com ya da `ayar.ownerUid`) açılır; "hesap oluştur" kaldırıldı; satışçı/bölge/prim alanları gizlendi. Ajan hesabı için Diğer → 🔐 Hesaplar.
  - Güncellenen dosyalar: `index.html`, `ajan-gece.mjs`, `.github/workflows/ajan-gece.yml`, `sw.js`.
- **v16.1 (02.11.2026) — elle iş kalmasın:** Risk analizi resmî kayıtlara kendisi bakar (Google Haberler RSS + Bing RSS + DuckDuckGo; tarayıcıda açık aracı sunucular, gece ajanında doğrudan): konkordato/iflas/icra/haciz, ilan.gov.tr, Şikâyetvar, Ticaret Sicili Gazetesi, haberler, web sitesi açık mı → "🤖 Otomatik kontroller" tablosu. Sıra: Google araması + yapay zekâ → (kota biterse) bulunan haberler + yapay zekâ → (o da biterse) kural ile değerlendirme; analiz hiçbir zaman boş kalmaz. Fırsat Avcısı da önce haberleri kendisi toplar, aynı yedekleme sırası. 429 hataları ayrıştırılır (dakikalık / günlük / arama kotası, yenilenme saati). Findeks raporu isteği e-postası varsa ajan kendisi gönderir.
- **v16.2 (02.11.2026) — kota ve fırsat düzeltmesi:** Kotası dolan model hatırlanır ve atlanır (`mag_aidolu`: dakikalık → 1 dk, günlük → 11:00), yedekte ücretsiz katmanda yüksek limitli **Gemma** modelleri (sistem talimatı mesaja eklenir, JSON metinden ayıklanır). Gece ajanı toplu işlerde önce Gemma/Lite kullanır, Flash kotasını önemli işlere bırakır. Fırsat Avcısı yalnızca 3 tür fırsat tutar: kamu poşet/çöp torbası ihalesi (haber + ilan.gov.tr), bölgede yeni açılan market/gıda işletmesi, ambalaj/gıda fuarı; dava, tutuklama, dernek vb. haberler atılır; uygun yoksa "fırsat yok" der.
- **v16.3 (02.11.2026):** Tarayıcıda haber/arama sayfaları içerik doğrulamalı, sırayla (en çok 3 eşzamanlı) ve 4 aracı sunucuyla getirilir. Cihazdan ulaşılamazsa iş otomatik olarak GitHub'daki ajana verilir (`ajan/istek` → `firsat`, ya da `risk` + `riskIds`), sonuç 2-4 dk içinde ekrana gelir. Eski süzülmemiş fırsat kayıtları gösterilmez.
- **v17 (02.11.2026) — 🚚 Fabrika Sevkiyat köprüsü:** Gece ajanı (görev `sevkiyat`, sabah) Fabrika Sevkiyat programına (sevkiyat-fc22b) ayrı bir Muhasebe hesabıyla (+Sevkiyat izni) girer, yalnızca OKUR: `urunler` (durum=sevk_edildi), `dosyalar` (onayTarihi ≥ son eşitleme, artımlı), `tahsilatlar` (son 30 gün), `isEmirleri` (son 120 gün, bitmemiş). Müşteri adını eşleştirir (`firmaEsle`), olmayanı "Müşteri" olarak ekler; kayıtlara `sevk` [{k,tar,kg,adet,urun,no}], `tahsil` [{k,tar,tutar,nakit,cek}], `uretim`, `sevkSon` yazar. Sorgular artımlı olduğu için günlük okunan veri azdır (ilk eşitleme son 1 yıl). Tekrar sipariş / uyuyan müşteri ajanları sevkiyat tarihlerini de alım sayar (`alimT`). Kurulum 9 (kullanıcı adı/şifre `ajan/gizli` sevkKul/sevkSifre), Ofis'te 🚚 Sevkiyat Köprüsü ekranı, kartta son sevk/tahsilat/üretim satırı, Müdür bağlamına eklendi.
- **v17.1 (02.11.2026) — 🧮 gerçek maliyet:** Köprü aynı hesapla Fabrika Sevkiyat → `maliyet` (ADET & MALİYET, v129) okur (o programın kuralına `magajan` okuma izni eklendi). `malOzet` = maliyet.js hesabının birebir kopyası (kur, KDV dahil, reçete yoğunluğu, fire, sabit/aylık gider, paket). Sonuç: `ayar.hammadde` fiyatları (₺/kg, KDV hariç) ve `katalog` maliyetleri kendiliğinden güncellenir (eşleşme `malId` ya da ad; adet birimli üründe adet maliyeti), katalogda olmayan tam kartlar eklenir (fiyat = faturalı kâr% ile), eksik kartlar yazılmaz. `ajan/maliyetDurum` → Sevkiyat Köprüsü ekranında ve Fiyat Bekçisi'nde "tamamlanması gerekenler".
- **v17.2 (02.11.2026) — 🩺 kendiliğinden görünen hatalar:** Sayfanın en başındaki küçük betik `window.onerror`, `unhandledrejection`, `alert` ve `cloudErr` mesajlarını telefonda biriktirir (`mag_hata`), girişten sonra `mag_pazar/hata`'ya yazar (kural: herkes yalnız ekler, yönetici okur). `.github/workflows/yonetim.yml` + `.github/yonetim.mjs`: sağlık, kural kontrol/yayın (rulesText ile), her sabah teşhis → fotoğraf ve gizli anahtarlar hariç tüm veri + hata özeti ÖZEL depo `xfranerx53/mag-yonetim`e (secret `YONETIM_TOKEN`); herkese açık kayda yalnız sayılar.

## Kâr modeli — ücretsiz ajan yol haritası
Kural: hiçbir servise para ödenmeyecek. Ücretsiz katmanı olan servis kullanılırsa, ileride kendi altyapımızla değiştirilebilecek şekilde bağlanır (Geoapify → mag-veri örneğinde olduğu gibi).
1. ✅ **Ajan Merkezi (v11)** — kural tabanlı ajanlar, program içinde.
2. ✅ **Uygulama kapalıyken çalışma (v12)** — GitHub Actions zamanlanmış görev (ücretsiz) her sabah Firebase'deki veriyi okur, aynı kuralları çalıştırır, Müdür raporunu buluta yazar ve telefona bildirim (web push) gönderir — ek uygulama gerekmez.
3. ✅ **Yazan ajanlar (yapay zekâ, v12)** — mesajları firmaya özel yazdırmak için Google Gemini ücretsiz anahtarı (kart yok), firma adları kodlanarak.
4. ⏳ **Sevkiyat ve maliyet bağlantısı** — sevkiyat programındaki siparişler/tahsilatlar ve ADET&MALİYET hesaplamasındaki gerçek maliyetler ajanlara bağlanır.

- **Alan adı notu (30.10.2026):** magambalaj.com Natro'da (NS1/NS2.NATROHOST.COM). İleride `pazar.magambalaj.com` → Cloudflare Pages için Natro DNS'e CNAME `pazar` → `mag-pazar-analiz.pages.dev` eklenecek (siteyi kuranlarla birlikte yapılacak); sonra Firebase "Authorized domains"a eklenip program deposu gizlenebilir.

## Google Haritalar anahtarı nasıl alınır (isteğe bağlı)
1. console.cloud.google.com → yeni proje (veya mevcut `mag-pazar` Firebase projesi).
2. Faturalandırma hesabı bağla (kart ister; aylık ücretsiz kota aşılmadıkça ücret çıkmaz). Places "Enterprise" alanları (telefon, web, puan) için ayda yaklaşık 1.000 sorgu ücretsiz; her sorgu en çok 20 işletme getirir.
3. APIs & Services → Library: **Maps JavaScript API** ve **Places API (New)** → Enable.
4. Credentials → Create credentials → API key → Application restrictions: **Websites** → `https://xfranerx53.github.io/mag-pazar-analiz/*` ; API restrictions: yukarıdaki iki API.
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
