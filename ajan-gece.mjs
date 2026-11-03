// MAG Pazar — 🌙 Gece ajanı (GitHub Actions, ücretsiz)
// Her sabah buluttaki kayıtları okur, programdaki AYNI ajan kurallarını çalıştırır (index.html'den okunur),
// Müdür raporunu buluta yazar ve yöneticilerin telefonuna bildirim gönderir.
// DİKKAT: Depo herkese açık olduğu için bu betik müşteri bilgisini ASLA ekrana (log'a) yazmaz.
import fs from "node:fs";
import vm from "node:vm";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const env = k => (process.env[k] || "").trim();
const BASLA = Date.now(), dakika = () => (Date.now() - BASLA) / 60000; // 25 dk sınırı var: ağır işler süre bütçesine uyar
const log = (...a) => console.log("•", ...a);
// Son çalışmanın sonucu buluta yazılır (ajan/sonCalisma) → program GitHub'a girmeden gösterir
let DURUM_URL = null;
const sonYaz = o => { if (!DURUM_URL) return; try { execFileSync(process.execPath, ["-e", `fetch(${JSON.stringify(DURUM_URL)},{method:"PUT",headers:{"Content-Type":"application/json"},body:${JSON.stringify(JSON.stringify(o))}}).catch(()=>{})`], { timeout: 20000 }); } catch (e) { } };
const dur = (m, kod = 1) => { console.log("\n❌ " + m); sonYaz({ t: Date.now(), ok: false, mesaj: m, elle: process.env.GITHUB_EVENT_NAME === "workflow_dispatch" }); process.exit(kod); };
let OZET = "";
const bitir = () => { console.log("\n✅ Tamam."); sonYaz({ t: Date.now(), ok: true, ozet: OZET, elle: process.env.GITHUB_EVENT_NAME === "workflow_dispatch" }); process.exit(0); };
process.on("uncaughtException", e => dur("Beklenmeyen hata: " + (e && e.message || e)));
process.on("unhandledRejection", e => dur("Beklenmeyen hata: " + (e && e.message || e)));

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const API_KEY = (html.match(/apiKey:"([^"]+)"/) || [])[1];
const DB = env("FB_DB_URL") || (html.match(/databaseURL:"([^"]+)"/) || [])[1];
const AUTH = env("FB_AUTH_URL") || "https://identitytoolkit.googleapis.com/v1/";
if (!API_KEY || !DB) dur("index.html içinde Firebase ayarı bulunamadı.");
if (!env("FB_EMAIL") || !env("FB_PASSWORD")) dur("FB_EMAIL ve FB_PASSWORD gizli değişkenleri (secrets) eklenmemiş. Programda Ajanlar → 🛠 Kurulum → 5. adıma bak.");

/* ---------- index.html'den kod parçası okuma ---------- */
const lines = html.split("\n");
const TOP = /^(const |let |function |async function |\/\*|document\.|window\.|Object\.assign|\{|if\(|try\{|\$\(|A\.)/;
function parca(ad) { // en üst seviyedeki tanımı bir sonraki üst seviye satıra kadar al
  const rx = new RegExp("^(const|let|function|async function) " + ad + "\\b");
  const i = lines.findIndex(l => rx.test(l));
  if (i < 0) throw new Error("index.html'de bulunamadı: " + ad);
  let j = i + 1; while (j < lines.length && !TOP.test(lines[j]) && !/^<\/script>/.test(lines[j])) j++;
  return { i, kod: lines.slice(i, j).join("\n") };
}
function blok(bas, son) {
  const a = html.indexOf(bas), b = html.indexOf(son, a + 1);
  if (a < 0 || b < 0) throw new Error("index.html'de blok bulunamadı: " + bas);
  return html.slice(a, b);
}
const YARDIMCI = ["arr", "pad", "fmt", "today", "plus", "fd", "fdt", "ym", "tsDay", "daysSince", "PARA", "TL", "TL2", "NUM", "esc", "digits", "ulkeKod", "waNum",
  "toDoc", "calc", "docTop", "docAra", "sipAktif", "ciro", "odenen", "bakiye", "alimT", "lastBuy", "kalemOzet", "TUK_DEF", "tuk", "oner", "hamL", "TSEK", "sleepers", "reorderList", "EPRE", "epCikar", "hav", "ZINCIR", "zRe", "isChain", "isMobile", "isRival", "adayPuan", "normF", "tel10", "uid_", "bolgeler", "bolgeOf", "VERI_DEF"];
const goruldu = new Set(), kodlar = [];
for (const ad of YARDIMCI) { const p = parca(ad); if (!goruldu.has(p.i)) { goruldu.add(p.i); kodlar.push([p.i, p.kod]); } }
kodlar.sort((a, b) => a[0] - b[0]);
const CEKIRDEK = blok("/* ================= v11 — 🤖 AJAN MERKEZİ", "/* --- ekran --- */");
let AI = blok("/* ================= v12 — 🧠 YAPAY ZEKÂ BEYNİ", "/* --- 💬 Müdürle konuş --- */") + "\n" + blok("/* --- ✨ firmaya özel mesaj --- */", "let aiYaziyor");
const V16 = blok("/* ================= v16 ÇEKİRDEK", "/* --- v16 ekran --- */");
if (env("AI_BASE_URL")) AI = AI.replace("https://generativelanguage.googleapis.com/v1beta/", env("AI_BASE_URL"));

/* ---------- Firebase (REST) ---------- */
async function istek(url, o = {}) {
  const r = await fetch(url, { ...o, headers: { "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, st: r.status, j };
}
async function giris() {
  const body = JSON.stringify({ email: env("FB_EMAIL"), password: env("FB_PASSWORD"), returnSecureToken: true });
  let r = await istek(AUTH + "accounts:signInWithPassword?key=" + API_KEY, { method: "POST", body });
  if (r.ok) return { uid: r.j.localId, tok: r.j.idToken, yeni: false };
  const m = (r.j.error && r.j.error.message) || "";
  if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD/.test(m)) {
    const s = await istek(AUTH + "accounts:signUp?key=" + API_KEY, { method: "POST", body });
    if (s.ok) return { uid: s.j.localId, tok: s.j.idToken, yeni: true };
    const m2 = (s.j.error && s.j.error.message) || "";
    if (/EMAIL_EXISTS/.test(m2)) dur("Ajan hesabı var ama FB_PASSWORD yanlış. GitHub'daki FB_PASSWORD'ü ilk kullandığın şifreyle aynı yap.");
    if (/WEAK_PASSWORD/.test(m2)) dur("FB_PASSWORD çok kısa: en az 8 karakter olsun.");
    if (/INVALID_EMAIL/.test(m2)) dur("FB_EMAIL geçerli bir e-posta biçiminde değil (ör. ajan@magambalaj.com).");
    dur("Ajan hesabı açılamadı: " + m2);
  }
  if (/TOO_MANY/.test(m)) dur("Çok fazla deneme oldu; 1 saat sonra tekrar çalıştır.");
  dur("Giriş yapılamadı: " + m);
}
const yol = (p, tok) => DB.replace(/\/$/, "") + "/mag_pazar/" + p + ".json?auth=" + encodeURIComponent(tok);
async function oku(p, tok) { const r = await istek(yol(p, tok)); if (!r.ok) throw Object.assign(new Error(p + " okunamadı (" + r.st + ")"), { st: r.st }); return r.j; }
async function yaz(p, tok, v, yontem = "PUT") { const r = await istek(yol(p, tok), { method: yontem, body: JSON.stringify(v) }); if (!r.ok) throw Object.assign(new Error(p + " yazılamadı (" + r.st + ")"), { st: r.st }); }

/* ---------- çalış ---------- */
const g = await giris();
log("Ajan hesabıyla giriş yapıldı" + (g.yeni ? " (hesap yeni açıldı)" : ""));
DURUM_URL = DB.replace(/\/$/, "") + "/mag_pazar/ajan/sonCalisma.json?auth=" + encodeURIComponent(g.tok);
let prof = null; try { prof = await oku("users/" + g.uid, g.tok); } catch (e) { }
if (!prof) {
  try { await yaz("users/" + g.uid, g.tok, { email: env("FB_EMAIL"), ad: "🤖 Ajan", rol: "beklemede", t: Date.now() }); } catch (e) { }
  dur("Ajan hesabı açıldı ve onay bekliyor.\n   ŞİMDİ: Programda Diğer → 🔐 Hesaplar → \"🤖 Ajan\" → rolünü YÖNETİCİ yap, sonra bu görevi bir kez daha çalıştır (Run workflow).");
}
if (prof.rol !== "admin") dur("Ajan hesabının rolü \"" + prof.rol + "\". Programda Diğer → 🔐 Hesaplar → \"" + (prof.ad || "🤖 Ajan") + "\" → rolünü YÖNETİCİ yap, sonra tekrar çalıştır.");

let leads, ayar, katalog, users;
try { [leads, ayar, katalog, users] = await Promise.all(["leads", "ayar", "katalog", "users"].map(p => oku(p, g.tok))); }
catch (e) { dur("Bulut okunamadı: " + e.message + ". Firebase kuralı güncel mi? (Programda ☁ → Kuralı kopyala → Firebase Rules → Publish)"); }
const data = Object.entries(leads || {}).map(([k, v]) => ({ ...v, id: v.id || k })).filter(x => x && x.firma);
ayar = ayar || {}; if (env("GEMINI_KEY")) ayar.aiKey = env("GEMINI_KEY");
let GIZLI = {}; try { GIZLI = (await oku("ajan/gizli", g.tok)) || {}; } catch (e) { } // programdan girilen Gmail / bildirim anahtarları (yalnızca yönetici okur)
log("Okunan kayıt:", data.length, "• ürün:", Object.keys(katalog || {}).length);

const bellek = {};
const ctx = vm.createContext({ console, fetch, setTimeout, clearTimeout, setInterval: () => 0, AbortController, URLSearchParams, TextEncoder, TextDecoder, Intl, Date, Math, JSON, document: { querySelectorAll: () => [] } });
const kaynak = `
const ls={get:k=>bellek[k]??null,set:(k,v)=>{bellek[k]=String(v);return true},del:k=>{delete bellek[k]}};
const lsJ=(k,d)=>{try{return JSON.parse(ls.get(k))??d}catch(e){return d}};
let ayar=__ayar,data=__data,katalog=__katalog,users=__users,me={uid:null,ad:"🤖 Ajan",email:""},role="admin",tara={r:10};
const isAdmin=()=>false;
${kodlar.map(k => k[1]).join("\n")}
${CEKIRDEK}
${AI}
${V16}
globalThis.__api={malOzet,SEVK_CFG,KOTU_AD,firmaEsle,riskAnaliz,firsatAra,icerikPlani,ajStok,ajRisk,ajCalistir,ajRapor,ajMasada,AJAD,aiSor,AISYS,deanon,aiKey,epCikar,anon,aiKodla,ciro,bakiye,sipAktif,docTop,daysSince,today,plus,fmt,fd,arr,reorderList,sleepers,vadeDurum,aiMesajYaz,ajKey,hav,isChain,isRival,isMobile,adayPuan,normF,tel10,uid_,bolgeOf,VERI_DEF,TSEK,tuk,kodOf,selam,imza,kalemOzet,docAra,AJ,setR:r=>{tara.r=r}};`;
Object.assign(ctx, { bellek, __ayar: ayar, __data: data, __katalog: Array.isArray(katalog) ? katalog : Object.values(katalog || {}), __users: users || {} });
vm.runInContext(kaynak, ctx, { filename: "ajan-cekirdek.js" });
const X = ctx.__api;

/* =====================================================================
   v14 — OTONOM AJANLAR. Her çalışmada (günde 3 kez) neler yapılacağı ajan/durum'dan anlaşılır:
   - Günün İLK çalışması: takip ayarı, otomatik tarama, e-posta avcısı, rapor, hazır mesajlar, haftalık strateji, bildirim
   - Her çalışma: Gmail gelen kutusu (cevaplar), Gmail ile e-posta gönderme (günlük sınır içinde)
   Herkese açık depo: log'a müşteri bilgisi YAZILMAZ, sadece sayılar.
   ===================================================================== */
const BUGUN = X.today();
const O = Object.assign({ tarama: true, yaricap: 10, yaricapMax: 30, gunlukAday: 15, taslakSayisi: 12, eposta: "deneme", gunlukEposta: 20, takipEpostasiGun: 5 }, ayar.otonom || {});
const okuG = async p => { try { return await oku(p, g.tok); } catch (e) { return null; } };
let D = (await okuG("ajan/durum")) || {};
const ilkCalisma = D.tarih !== BUGUN || env("TAM") === "1" || env("GITHUB_EVENT_NAME") === "workflow_dispatch";
if (D.tarih !== BUGUN) D = { tarih: BUGUN, epN: 0, taramaR: D.taramaR || 0, sonGelen: D.sonGelen || 0 };
const sabahTuru = D.sabah !== BUGUN;
/* ---------- 🎛 Görev seçimi: programdaki "Görevler" ekranı (ayar.otonom.gorevler) + elle çalıştırmada seçilenler (ajan/istek) ---------- */
const GOREV_VARS = { tarama: { acik: true, zaman: "sabah" }, epbul: { acik: true, zaman: "sabah" }, takip: { acik: true, zaman: "sabah" }, rota: { acik: false, zaman: "sabah" },
  gelen: { acik: true, zaman: "her" }, talep: { acik: true, zaman: "her" }, rapor: { acik: true, zaman: "sabah" }, taslak: { acik: true, zaman: "sabah" },
  tanitim: { acik: true, zaman: "sabah", hedef: "hepsi" }, takipEp: { acik: true, zaman: "sabah", hedef: "hepsi" }, teklifEp: { acik: true, zaman: "sabah", hedef: "hepsi" },
  numuneEp: { acik: false, zaman: "sabah", hedef: "hepsi" }, tekrarEp: { acik: false, zaman: "sabah", hedef: "hepsi" }, caprazEp: { acik: false, zaman: "sabah", hedef: "hepsi" },
  uyuyanEp: { acik: false, zaman: "sabah", hedef: "hepsi" }, tahsilatEp: { acik: false, zaman: "sabah", hedef: "hepsi" }, fiyatEp: { acik: false, zaman: "sabah", hedef: "hepsi" },
  haftalik: { acik: true, zaman: "sabah" }, bildirim: { acik: true, zaman: "her" },
  sevkiyat: { acik: true, zaman: "sabah" }, kuyruk: { acik: true, zaman: "her" }, hatirlat: { acik: true, zaman: "her" }, risk: { acik: true, zaman: "sabah" }, firsat: { acik: true, zaman: "sabah" }, icerik: { acik: true, zaman: "sabah" } };
const GV = {}; for (const k in GOREV_VARS) GV[k] = Object.assign({}, GOREV_VARS[k], (O.gorevler || {})[k] || {});
if (O.tarama === false && !(O.gorevler || {}).tarama) GV.tarama.acik = false;
const elle = env("GITHUB_EVENT_NAME") === "workflow_dispatch" && env("ZAMANLI") !== "1"; // ZAMANLI=1: dış zamanlayıcıdan gelen otomatik tur (mesai kuralı geçerli)
/* ---------- ⏰ Çalışma saatleri: GitHub her saat uyandırır; ajan sadece programda seçilen gün/saatte iş yapar ---------- */
if (!elle && env("TAM") !== "1") {
  if (O.durdur) { log("⏸ Ajanlar tatilde (programda durduruldu) — iş yok"); process.exit(0); }
  const MS = Object.assign({ gunler: [1, 2, 3, 4, 5, 6], saatler: [8, 13, 18] }, O.mesai || {});
  const n = new Date(), gn = n.getDay() || 7, sa = n.getHours();
  // GitHub bazen gecikir: bir önceki saatin turu kaçtıysa bu saatte yapılır, aynı tur iki kez yapılmaz
  const slot = MS.saatler.map(Number).filter(h => h <= sa && h >= sa - 1).sort((a, b) => b - a)[0];
  if (!MS.gunler.map(Number).includes(gn) || slot == null || D.slot === BUGUN + "-" + slot) { log(`Mesai dışı (${["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][gn]} ${sa}:${String(n.getMinutes()).padStart(2, "0")}) — bu saatte iş yok`); process.exit(0); }
  D.slot = BUGUN + "-" + slot;
}
let ISTEK = null; if (elle) { ISTEK = await okuG("ajan/istek"); if (!ISTEK || Date.now() - (ISTEK.t || 0) > 20 * 60e3) ISTEK = null; else await yaz("ajan/istek", g.tok, null).catch(() => { }); }
const SECILI = ISTEK && Array.isArray(ISTEK.gorevler) ? new Set(ISTEK.gorevler) : null;
const RAN = new Set(), GSON = {};
const calis = k => { const v = GV[k]; if (!v) return false; const r = SECILI ? SECILI.has(k) : elle ? !!v.acik : !!v.acik && (v.zaman === "her" || (v.zaman === "sabah" && sabahTuru)); if (r) RAN.add(k); return r; };
const GUN = ((await okuG("ajan/gunluk/" + BUGUN)) || {}).isler || [];
const GUN0 = GUN.length; // bu turdan önceki kayıtlar
const not_ = (ik, metin, k) => { GUN.push(k ? { ik, metin, t: Date.now(), k } : { ik, metin, t: Date.now() }); if (k) GSON[k] = { t: Date.now(), metin }; };
const SICAK = []; // hemen bildirilecek sıcak gelişmeler
const durumYaz = () => yaz("ajan/durum", g.tok, D).catch(e => log("durum yazılamadı:", e.message));
async function guncelle(x, alan) {
  x.u = Date.now(); Object.assign(x, alan);
  await yaz("leads/" + x.id, g.tok, { ...alan, u: x.u }, "PATCH");
}
const sonGor = x => X.arr(x.gorus).reduce((m, q) => Math.max(m, +q.t || 0), 0);
const gorusEkle = (x, tip, not) => { const l = X.arr(x.gorus); l.push({ t: Date.now(), tip, not, kim: "🤖 Ajan" }); return l; };
log((elle ? "Elle çalıştırma" : sabahTuru ? "Günün ilk turu" : "Gün içi tur") + " • görevler: " + Object.keys(GV).filter(k => calis(k)).join(", ")); RAN.clear();

/* ---------- 🚚 0) Fabrika Sevkiyat programından sevkiyat, tahsilat, üretim (yalnızca OKUR; az veri: artımlı sorgu) ---------- */
if (calis("sevkiyat")) {
  const SK = String(GIZLI.sevkKul || "").trim(), SP = String(GIZLI.sevkSifre || "");
  if (!SK || !SP) GSON.sevkiyat = { t: Date.now(), metin: "Bağlantı kurulmamış (Kurulum 9)" };
  else try {
    const C = X.SEVK_CFG, DBS = (env("SEVK_DB_URL") || C.db).replace(/\/$/, "");
    const lg = await istek((env("SEVK_AUTH_URL") || AUTH) + "accounts:signInWithPassword?key=" + C.apiKey, { method: "POST", body: JSON.stringify({ email: C.ep(SK), password: SP, returnSecureToken: true }) });
    if (!lg.ok) throw new Error("Fabrika Sevkiyat'a giriş olmadı (" + (((lg.j.error || {}).message) || lg.st) + ") — Kurulum 9'daki kullanıcı adı/şifreyi kontrol et");
    const tk = lg.j.idToken;
    const sorgu = async (yolu, q) => { const r = await istek(DBS + "/" + yolu + ".json?auth=" + encodeURIComponent(tk) + "&" + q); if (!r.ok) throw new Error(yolu + " okunamadı (" + r.st + (r.st === 401 ? ": izin yok — ajan kullanıcısına Muhasebe rolü + Sevkiyat izni ver" : "") + ")"); return r.j || {}; };
    const Q = (alan, op, v) => `orderBy=${encodeURIComponent(JSON.stringify(alan))}&${op}=${encodeURIComponent(JSON.stringify(v))}`;
    const S = (await okuG("ajan/sevkSenk")) || {}, ilk = Date.now() - 365 * 864e5;
    const [aktif, arsiv, tah, ise] = await Promise.all([
      sorgu("urunler", Q("durum", "equalTo", "sevk_edildi")),
      sorgu("dosyalar", Q("onayTarihi", "startAt", (S.dosya || ilk) - 2 * 864e5)),
      sorgu("tahsilatlar", Q("zaman", "startAt", S.dosya ? Date.now() - 30 * 864e5 : ilk)).catch(e => { log("tahsilat atlandı"); return null; }),
      sorgu("isEmirleri", Q("eklenmeTarihi", "startAt", Date.now() - 120 * 864e5)).catch(e => { log("iş emirleri atlandı"); return null; })]);
    const gun = ts => +ts ? X.fmt(new Date(+ts)) : "", yeniler = [], O2 = new Map();
    const kayit = ad => { ad = String(ad || "").trim(); if (ad.length < 3 || X.KOTU_AD.test(ad) || yeniler.length > 300) return null; let x = X.firmaEsle(ad, data);
      if (!x) { x = { id: X.uid_(), c: Date.now(), firma: ad, durum: "Müşteri", sektor: "Diğer", kaynak: "🚚 Fabrika Sevkiyat", sevkAd: [ad], mt: Date.now() }; data.push(x); yeniler.push(x); }
      if (!O2.has(x.id)) O2.set(x.id, { x, sevk: [], tahsil: [], uretim: [] }); return O2.get(x.id); };
    const sevkEkle = (id, u) => { const o = kayit(u.musteri); if (!o) return; const tar = gun(u.irsaliyeTarihi) || u.tarih || gun(u.onayTarihi); if (!tar) return;
      o.sevk.push({ k: id, tar, kg: +u.kg || 0, adet: +u.paket || 0, urun: String(u.urunAd || u.urun || "").split("\n")[0].slice(0, 60), no: u.isEmriNo || "", tur: u.irsTur || "irsaliye" }); };
    const tahEkle = (id, t) => { if (t.durum && t.durum !== "alindi") return; const tut = (+t.nakit || 0) + (+t.cek || 0); if (!tut) return; const o = kayit(t.cari); if (!o) return;
      o.tahsil.push({ k: id, tar: gun(t.alinmaZaman || t.zaman), tutar: tut, nakit: +t.nakit || 0, cek: +t.cek || 0, makbuz: t.makbuzNo || "" }); };
    let sonDosya = S.dosya || 0;
    for (const [id, u] of Object.entries(aktif)) if (u) sevkEkle(id, u);
    for (const [id, d] of Object.entries(arsiv)) { if (!d) continue; sonDosya = Math.max(sonDosya, +d.onayTarihi || 0); if (d.kaynak === "tahsilat") tahEkle(id, d); else if (d.kaynak === "talimat" || (!d.musteri && d.metin)) continue; else sevkEkle(id, d); }
    if (tah) for (const [id, t] of Object.entries(tah)) if (t) tahEkle(id, t);
    if (ise) for (const [, e] of Object.entries(ise)) if (e && e.asama !== "bitti" && !e.aktarildi) { const o = kayit(e.musteri); if (o) o.uretim.push({ no: e.no || "", tar: gun(e.eklenmeTarihi), asama: e.asama || "" }); }
    let nS = 0, nT = 0, nG = 0;
    const birlestir = (eski, yeni) => { const m = new Map(X.arr(eski).map(o => [o.k, o])), once = m.size; yeni.forEach(o => m.set(o.k, o)); return { l: [...m.values()].filter(o => o.tar).sort((a, b) => a.tar.localeCompare(b.tar)).slice(-80), n: m.size - once }; };
    for (const o of O2.values()) {
      const x = o.x, ch = {}, yeni = yeniler.includes(x);
      if (o.sevk.length) { const b = birlestir(x.sevk, o.sevk); if (b.n || yeni) { ch.sevk = b.l; ch.sevkSon = b.l.length ? b.l[b.l.length - 1].tar : ""; nS += b.n; } }
      if (o.tahsil.length) { const b = birlestir(x.tahsil, o.tahsil); if (b.n || yeni) { ch.tahsil = b.l; nT += b.n; } }
      if (ise && JSON.stringify(X.arr(x.uretim)) !== JSON.stringify(o.uretim)) ch.uretim = o.uretim.length ? o.uretim.slice(0, 10) : null;
      if (o.sevk.length && x.durum !== "Müşteri") { ch.durum = "Müşteri"; if (!x.mt) ch.mt = Date.now(); }
      if (!Object.keys(ch).length && !yeni) continue;
      try { if (yeni) { Object.assign(x, ch); x.u = Date.now(); await yaz("leads/" + x.id, g.tok, x); nG++; } else await guncelle(x, ch); } catch (e) { log("kayıt güncellenemedi"); }
    }
    if (ise) for (const x of data) if (X.arr(x.uretim).length && !O2.has(x.id)) await guncelle(x, { uretim: null }).catch(() => { });
    await yaz("ajan/sevkSenk", g.tok, { dosya: sonDosya || Date.now(), t: Date.now() }).catch(() => { });
    /* 🧮 maliyet: Fabrika programındaki ADET & MALİYET → hammadde fiyatları + ürün maliyetleri (tek kaynak orası) */
    let malMetin = "";
    try {
      const M = await sorgu("maliyet", "print=pretty"), Z = X.malOzet(M), KAT = ctx.__katalog, nf = s => String(s || "").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]/g, "");
      let hD = 0, uD = 0, uY = 0;
      const HL = Array.isArray(ayar.hammadde) ? ayar.hammadde : [];
      for (const h of Z.ham) { let m = HL.find(x => nf(x.ad) === nf(h.ad)); if (!m) { m = { ad: h.ad, fiyat: 0, gecmis: [] }; HL.push(m); }
        const g2 = X.arr(m.gecmis), son = g2[g2.length - 1]; m.kaynak = "🧮 Fabrika maliyet";
        if (Math.abs((+m.fiyat || 0) - h.tl) > Math.max(0.01, h.tl * 0.002) || !son || X.daysSince(son[0]) >= 7) { if (Math.abs((+m.fiyat || 0) - h.tl) > 0.01) hD++; m.fiyat = h.tl; m.gecmis = [...g2.filter(q => q[0] !== BUGUN), [BUGUN, h.tl]].slice(-24); } }
      ayar.hammadde = HL; if (Z.ham.length) await yaz("ayar/hammadde", g.tok, HL);
      for (const u of Z.urun) { if (!(u.mal > 0) || u.uyar.length) continue; /* eksik kartla yanlış maliyet yazma */ let k = KAT.find(x => x.malId === u.id) || KAT.find(x => nf(x.ad) === nf(u.ad));
        const adetli = k ? /adet|paket|koli|top/i.test(k.birim || "") && u.adetMal > 0 : false, mal = Math.round((adetli ? u.adetMal : u.mal) * 10000) / 10000;
        if (!k) { k = { id: X.uid_(), ad: u.ad, tip: u.grup, birim: "kg", fiyat: Math.round(u.fF * 100) / 100, maliyet: Math.round(u.mal * 100) / 100, malId: u.id, kaynak: "🧮 Fabrika maliyet" }; KAT.push(k); uY++; continue; }
        if (Math.abs((+k.maliyet || 0) - mal) > 0.0001) { k.maliyet = mal; uD++; } k.malId = u.id; k.malT = BUGUN; }
      if (Z.urun.length) await yaz("katalog", g.tok, KAT);
      await yaz("ajan/maliyetDurum", g.tok, { t: Date.now(), urunN: Z.urun.length, hamN: Z.ham.length, eksik: Z.eksik.slice(0, 40), giderKaynak: Z.giderKaynak || "" });
      malMetin = `; maliyet: ${Z.ham.length} hammadde${hD ? ` (${hD} fiyat değişti)` : ""}, ${Z.urun.length} ürün${uD ? ` (${uD} maliyet güncellendi)` : ""}${uY ? `, ${uY} yeni ürün kataloğa eklendi` : ""}${Z.eksik.length ? `, ${Z.eksik.length} eksik var` : ""}`;
      log("Maliyet:", Z.ham.length, "hammadde •", Z.urun.length, "ürün •", Z.eksik.length, "eksik");
      /* 🏭 FABRİKA ZEKÂSI: üretim planı + vardiya yükü, sevkiyat rotası, stok, denetim bekçisi, müşteri kârlılığı, zam sinyali */
      try {
        const now = Date.now(), Q2 = (alan, bas) => Q(alan, "startAt", bas);
        const [stk, sh, dn, sevA, sevE, tal] = await Promise.all([
          sorgu("stokKalem", "shallow=false").catch(() => ({})), sorgu("stokHareket", Q2("zaman", now - 60 * 864e5)).catch(() => ({})),
          sorgu("denetim", Q2("zaman", now - 26 * 3600e3)).catch(() => ({})), sorgu("sevkAdresleri", "shallow=false").catch(() => ({})),
          sorgu("urunler", Q("durum", "equalTo", "sevk_edilecek")).catch(() => ({})), sorgu("sevkTalimat", Q("durum", "equalTo", "bekliyor")).catch(() => ({}))]);
        const kurU = +(((M.kur || {}).USD || {}).efektif) || 0, kurE = +(((M.kur || {}).EUR || {}).efektif) || 0, kurOf = pb => pb === "USD" ? kurU : pb === "EUR" ? kurE : 1;
        const nfx = s => String(s || "").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
        const ortMal = Z.urun.filter(u => u.mal > 0 && !u.uyar.length), ortM = ortMal.length ? ortMal.reduce((a, u) => a + u.mal, 0) / ortMal.length : 0;
        const malBul = e => { const t = nfx([e.stok, e.urunAdi, e.formul].join(" ")).split(" ").filter(w => w.length > 2); let en = null, ep = 0; for (const u of ortMal) { const w = nfx(u.ad).split(" "); const p = t.filter(x => w.includes(x)).length; if (p > ep) { ep = p; en = u; } } return ep >= 2 ? en.mal : ortM; };
        const isl = Object.values(ise || {}).filter(e => e && e.no), kgOf = e => X.arr(e.siparis).reduce((a, r) => a + (+r.kg || 0), 0) || X.arr(Object.values(e.etiket || {})).reduce((a, r) => a + (+r.kg || 0), 0);
        // 1) üretim planı: aşama kuyrukları, aynı formül/renk art arda (geçiş azalsın), en eski sipariş önce
        const ASM = ["etiket", "ekstruder", "baski", "kesim", "depo"], acik = isl.filter(e => e.asama && e.asama !== "bitti");
        const kuyruk = {}; for (const a of ASM) { const l = acik.filter(e => e.asama === a).sort((x, y) => String(x.spTarih || "").localeCompare(String(y.spTarih || "")) || (x.eklenmeTarihi || 0) - (y.eklenmeTarihi || 0));
          if (a === "ekstruder") l.sort((x, y) => String(x.formul || "").localeCompare(String(y.formul || "")) || String(x.renk || "").localeCompare(String(y.renk || "")));
          kuyruk[a] = l.map(e => ({ no: e.no, musteri: e.musteri || "", urun: e.urunAdi || e.stok || "", kg: Math.round(kgOf(e)), formul: e.formul || "", renk: e.renk || "", baski: !!e.baskiVar, gun: e.spTarih ? X.daysSince(e.spTarih) : null })); }
        const HIZ = Object.assign({ ekstruder: 60, baski: 80, kesim: 25 }, O.hiz || {}); // kg/saat (makine/kişi başı) — programdan değiştirilebilir
        const yuk = {}; for (const a of ["ekstruder", "baski", "kesim"]) { const kg = kuyruk[a].reduce((s, e) => s + e.kg, 0) + (a !== "ekstruder" ? ASM.slice(0, ASM.indexOf(a)).reduce((s, b) => s + kuyruk[b].filter(e => a !== "baski" || e.baski).reduce((t, e) => t + e.kg, 0), 0) : kuyruk.etiket.reduce((s, e) => s + e.kg, 0));
          yuk[a] = { kg: Math.round(kg), saat: Math.round(kg / HIZ[a] * 10) / 10, vardiya: Math.round(kg / HIZ[a] / 12 * 10) / 10 }; }
        const gecGun = acik.filter(e => e.spTarih && X.daysSince(e.spTarih) > 10).map(e => e.no);
        // 2) sevkiyat günü rotası (fabrika → sevk edilecekler + talimatlar + tahsilat talepleri)
        const adrHarita = {}; for (const a of Object.values(sevA || {})) if (a && a.ad) adrHarita[nfx(a.ad)] = a;
        const durak = [];
        for (const u of Object.values(sevE || {})) if (u) durak.push({ tur: "sevk", ad: u.musteri || "", adres: u.adres || ((adrHarita[nfx(u.musteri)] || {}).adres) || "", harita: u.haritaUrl || ((adrHarita[nfx(u.musteri)] || {}).haritaUrl) || "", not: `${u.kg || ""} kg ${String(u.urun || "").split("\n")[0]}`.trim() });
        for (const t of Object.values(tal || {})) if (t) durak.push({ tur: "talimat", ad: t.adresAd || "", adres: t.adres || "", harita: t.haritaUrl || "", not: String(t.metin || "").slice(0, 80) });
        for (const t of Object.values(tah || {})) if (t && t.durum === "bekliyor") durak.push({ tur: "tahsilat", ad: t.cari || "", adres: t.adres || ((adrHarita[nfx(t.cari)] || {}).adres) || "", harita: t.haritaUrl || ((adrHarita[nfx(t.cari)] || {}).haritaUrl) || "", not: String(t.not || "").slice(0, 80) });
        const ko = h => { const m = String(h || "").match(/(-?\d{1,2}\.\d{2,})(?:,|%2C|\s)+(-?\d{1,3}\.\d{2,})/i); return m ? { lat: +m[1], lon: +m[2] } : null; };
        const merk = O.merkez && isFinite(+O.merkez.lat) ? { lat: +O.merkez.lat, lon: +O.merkez.lon } : { lat: 41.0701, lon: 28.2851 };
        durak.forEach(d => { d.k = ko(d.harita); }); const sirali = [], kalan = durak.filter(d => d.k); let c = merk;
        while (kalan.length) { kalan.sort((a, b) => X.hav(c.lat, c.lon, a.k.lat, a.k.lon) - X.hav(c.lat, c.lon, b.k.lat, b.k.lon)); const n = kalan.shift(); sirali.push(n); c = n.k; }
        const rotaL = [...sirali, ...durak.filter(d => !d.k)], hedefler = rotaL.map(d => d.k ? d.k.lat + "," + d.k.lon : encodeURIComponent(d.adres || d.ad)).filter(Boolean).slice(0, 9);
        const rota = { t: now, duraklar: rotaL.map(d => ({ tur: d.tur, ad: d.ad, adres: d.adres, not: d.not })), url: hedefler.length ? "https://www.google.com/maps/dir/" + [merk.lat + "," + merk.lon, ...hedefler].join("/") : "" };
        // 3) stok: son 60 günlük çıkışa göre kaç gün yeter
        const cikis = {}, hareketli = new Set(); for (const h of Object.values(sh || {})) { if (!h || !h.kalemId) continue; hareketli.add(h.kalemId); if (h.tip !== "cikis") continue; const k = h.kalemId; const m = h.mik || {}; const b = Object.keys(m)[0]; if (!b) continue; cikis[k] = cikis[k] || {}; cikis[k][b] = (cikis[k][b] || 0) + (+m[b] || 0); }
        // hiç sayılmamış (0 girilmiş ve 60 günde hiç giriş/çıkış olmamış) kalem "bitti" sayılmaz — yalnız sayılır
        let sayilmamis = 0;
        const stok = []; for (const [id, k] of Object.entries(stk || {})) { if (!k || !k.ad) continue; const mik = k.mik || {}; for (const b of Object.keys(mik)) { const var_ = +mik[b] || 0, gunluk = ((cikis[id] || {})[b] || 0) / 60; if (!gunluk) { if (var_ <= 0) { if (hareketli.has(id) || +k.kritik > 0) stok.push({ ad: k.ad, birim: b, kalan: 0, gun: 0, ted: k.tedarikci || "", not: "stok yok" }); else sayilmamis++; } continue; } const g = Math.floor(var_ / gunluk); if (g <= 14) stok.push({ ad: k.ad, birim: b, kalan: var_, gun: g, gunluk: Math.round(gunluk * 10) / 10, ted: k.tedarikci || "" }); } }
        stok.sort((a, b) => a.gun - b.gun);
        // 4) denetim bekçisi (son 26 saat)
        const den = []; for (const d of Object.values(dn || {})) { if (!d || !d.zaman) continue; const sa = new Date(d.zaman).getHours(), tur = String(d.tur || "");
          if (/sil|cop|geri|tahsilat-duz|duzelt/i.test(tur) || /sil|geri al|düzelt/i.test(d.baslik || "")) den.push({ t: d.zaman, kim: d.kim || "", ne: `${tur}: ${String(d.baslik || "").slice(0, 90)}` });
          else if (sa >= 0 && sa < 6 && !/Claude|Ajan/.test(d.kim || "")) den.push({ t: d.zaman, kim: d.kim || "", ne: `gece ${String(sa).padStart(2, "0")}:00 işlem — ${tur}: ${String(d.baslik || "").slice(0, 70)}` }); }
        // 5) müşteri kârlılığı (son 120 gün iş emirleri: fiyat × kg − maliyet)
        const kar = {}; for (const e of isl) { const kg = kgOf(e), f = +e.fiyat || 0; if (!kg || !f || !e.musteri) continue; const tl = f * kurOf(e.paraBirimi) / (e.kdvDahil ? 1.2 : 1), mal = malBul(e);
          const o = kar[e.musteri] = kar[e.musteri] || { musteri: e.musteri, kg: 0, ciro: 0, maliyet: 0, is: 0 }; o.kg += kg; o.ciro += kg * tl; o.maliyet += kg * mal; o.is++; }
        const karL = Object.values(kar).map(o => ({ ...o, kg: Math.round(o.kg), ciro: Math.round(o.ciro), maliyet: Math.round(o.maliyet), kar: Math.round(o.ciro - o.maliyet), marj: o.ciro ? Math.round((o.ciro - o.maliyet) / o.ciro * 100) : 0 })).sort((a, b) => a.marj - b.marj);
        // 6) zam sinyali: hammadde fiyatının 30 günlük değişimi
        const zam = (ayar.hammadde || []).map(h => { const g = X.arr(h.gecmis), eski = g.filter(q => X.daysSince(q[0]) >= 25).pop() || g[0]; return eski && +eski[1] ? { ad: h.ad, simdi: +h.fiyat, eski: +eski[1], degisim: Math.round((h.fiyat - eski[1]) / eski[1] * 1000) / 10 } : null; }).filter(z => z && Math.abs(z.degisim) >= 3);
        // 7) ⚠️ fire / arıza (Fabrika Sevkiyat → FİRE / ARIZA kayıtları): makine/aşama başına kayıp, duruş, fire maliyeti
        let fire = null;
        try {
          const UO = Object.values(await sorgu("uretimOlay", Q2("zaman", now - 30 * 864e5)).catch(() => ({})) || {}).filter(x => x && x.tur && +x.zaman);
          if (UO.length) {
            const h7 = now - 7 * 864e5, son7 = UO.filter(x => x.zaman >= h7), hamTL = Z.ham.length ? Z.ham.reduce((a, h) => a + (+h.tl || 0), 0) / Z.ham.length : ortM;
            const top = (l, f) => l.reduce((a, x) => a + (+x[f] || 0), 0), ASN = { ekstruder: "Ekstruder", baski: "Baskı", kesim: "Kesim", depo: "Depo", diger: "Diğer" };
            const uretim7 = isl.reduce((a, e) => { const d = e.log && e.log.depo; return a + (d && +d.zaman >= h7 ? (+d.kg || 0) : 0); }, 0);
            const fk7 = top(son7.filter(x => x.tur === "fire"), "kg"), dk7 = top(son7.filter(x => x.tur === "ariza"), "dk");
            const mk = {}; for (const x of son7) { const ad = x.makine || ASN[x.asama] || x.asama; const o = mk[ad] = mk[ad] || { ad, kg: 0, dk: 0, n: 0 }; o.kg += +x.kg || 0; o.dk += +x.dk || 0; o.n++; }
            const sb = {}; for (const x of son7) { const k = String(x.sebep || "").split(/[,.;]/)[0].trim().toLocaleLowerCase("tr").slice(0, 40); if (k) sb[k] = (sb[k] || 0) + 1; }
            const mkL = Object.values(mk).map(o => ({ ...o, kg: Math.round(o.kg * 10) / 10 })).sort((a, b) => (b.dk / 60 + b.kg / 20) - (a.dk / 60 + a.kg / 20));
            const oran = uretim7 >= 200 ? Math.round(fk7 / (uretim7 + fk7) * 1000) / 10 : null; // üretim kaydı azsa oran yanıltır
            const enCok = mkL.slice(0, 3).map(o => ({ ad: o.ad, deger: [o.kg ? o.kg + " kg fire" : "", o.dk ? Math.round(o.dk / 6) / 10 + " sa duruş" : ""].filter(Boolean).join(", ") }));
            const sbL = Object.entries(sb).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([ad, n]) => ({ ad, n }));
            let oneri = ""; const m1 = mkL[0];
            const mSeb = ad => { const c = {}; son7.filter(x => (x.makine || ASN[x.asama] || x.asama) === ad && x.sebep).forEach(x => { const k = String(x.sebep).split(/[,.;]/)[0].trim().toLocaleLowerCase("tr").slice(0, 40); c[k] = (c[k] || 0) + 1; }); return (Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [""])[0]; };
            if (m1 && m1.dk >= 120) oneri = `${m1.ad} son 7 günde ${Math.round(m1.dk / 6) / 10} saat durdu${mSeb(m1.ad) ? " (neden: " + mSeb(m1.ad) + ")" : ""} — önleyici bakım planlayın.`;
            else if (oran != null && oran >= 5) oneri = `Fire oranı %${oran}${sbL[0] ? "; en sık neden: " + sbL[0].ad : ""} — bu nedene odaklanın.`;
            else if (m1 && m1.kg >= 50) oneri = `En çok fire ${m1.ad}'de (${m1.kg} kg) — ayar/başlangıç firesini kontrol edin.`;
            fire = { fireKg: Math.round(fk7 * 10) / 10, durusSaat: Math.round(dk7 / 6) / 10, fireOran: oran, uretimKg: Math.round(uretim7), fireTL7: Math.round(fk7 * hamTL), fireTL30: Math.round(top(UO.filter(x => x.tur === "fire"), "kg") * hamTL), durusSaat30: Math.round(top(UO.filter(x => x.tur === "ariza"), "dk") / 6) / 10,
              makine: mkL.slice(0, 10), sebep: sbL, enCok, oneri, kgTL: Math.round(hamTL * 100) / 100, kayit: son7.length };
            const dun = UO.filter(x => x.tur === "ariza" && x.zaman >= now - 26 * 3600e3 && +x.dk >= 60); if (dun.length) SICAK.push(`🔧 Son 24 saatte ${dun.length} uzun arıza: ${dun.slice(0, 2).map(x => (x.makine || ASN[x.asama] || "") + " " + x.dk + " dk").join(", ")}`);
            if (oran != null && oran >= 8) SICAK.push(`🗑 Fire oranı son 7 günde %${oran} (${fire.fireKg} kg ≈ ${Math.round(fire.fireTL7).toLocaleString("tr-TR")} ₺)`);
          }
        } catch (e) { log("fire analizi atlandı"); }
        const fab = { t: now, fire, kuyruk, yuk, hiz: HIZ, gecGun, rota, stok: stok.slice(0, 20), denetim: den.slice(0, 20), karlilik: karL.slice(0, 40), zam, ozet: { acikIs: acik.length, asama: Object.fromEntries(ASM.map(a => [a, kuyruk[a].length])), bekleyenSevk: Object.keys(sevE || {}).length, bekleyenTahsilat: durak.filter(d => d.tur === "tahsilat").length, kritikStok: stok.length, sayilmamisStok: sayilmamis } };
        await yaz("ajan/fabrika", g.tok, fab);
        // personel tarafı (Fabrika Sevkiyat → 🤖 Yapay Zekâ ekranı) — yalnız iş bilgisi, fiyat/kârlılık yazılmaz
        try { const r = await istek(DBS + "/ai.json?auth=" + encodeURIComponent(tk), { method: "PUT", body: JSON.stringify({ t: now, kuyruk, yuk, gecGun, rota, stok: stok.slice(0, 20), fire: fire ? { fireKg: fire.fireKg, durusSaat: fire.durusSaat, fireOran: fire.fireOran, enCok: fire.enCok, oneri: fire.oneri } : null }) }); if (!r.ok) log("Fabrika'ya plan yazılamadı (" + r.st + ")"); } catch (e) { }
        if (den.length) SICAK.push(`🛡 Fabrika denetim: son 24 saatte ${den.length} dikkat çeken işlem (silme/düzeltme/gece)`);
        const zarar = karL.filter(o => o.marj < 5); if (zarar.length) SICAK.push(`📉 ${zarar.length} müşteride kâr %5'in altında (${zarar.slice(0, 2).map(o => o.musteri).join(", ")})`);
        malMetin += `; fabrika: ${acik.length} açık iş, rota ${rotaL.length} durak, ${stok.length} stok uyarısı${sayilmamis ? ` (${sayilmamis} kalemin stoğu hiç girilmemiş)` : ""}${den.length ? ", " + den.length + " denetim uyarısı" : ""}`;
        // 7) teslim edilen siparişler için müşteriye bilgi e-postası (kuyruk → Deneme/Açık moduna uyar)
        if (O.teslimEposta !== false) for (const o of O2.values()) { const x = o.x; if (!x.eposta) continue; for (const sv of o.sevk) { if (X.daysSince(sv.tar) > 2 || X.arr(x.teslimBildirim).includes(sv.k)) continue;
          await yaz("ajan/kuyruk/tes_" + sv.k.replace(/[^\w-]/g, ""), g.tok, { t: now, tip: "eposta", firmaId: x.id, konu: "Siparişiniz teslim edildi — " + (ayar.firma && ayar.firma.ad || "MAG AMBALAJ"), metin: `Merhaba${x.yetkili ? " " + x.yetkili : ""},\n\n${X.fd(sv.tar)} tarihinde ${sv.kg ? sv.kg + " kg " : ""}${sv.urun || "siparişiniz"} teslim edilmiştir. Bizi tercih ettiğiniz için teşekkür ederiz. Herhangi bir sorun ya da yeni ihtiyacınız olursa bu e-postayı yanıtlamanız yeterli.` }).catch(() => { });
          await guncelle(x, { teslimBildirim: [...X.arr(x.teslimBildirim), sv.k].slice(-30) }).catch(() => { }); } }
      } catch (e) { log("Fabrika zekâsı atlandı:", String(e.message).slice(0, 80)); }
    } catch (e) { malMetin = /401|izin/.test(e.message) ? "; maliyet bölümüne okuma izni yok (Fabrika Sevkiyat kuralını yayınla)" : "; maliyet okunamadı"; await yaz("ajan/maliyetDurum", g.tok, { t: Date.now(), hata: malMetin.slice(2) }).catch(() => { }); }
    not_("🚚", `Fabrika Sevkiyat'tan ${nS} yeni sevkiyat ve ${nT} tahsilat işledi${nG ? `; orada olup listede olmayan ${nG} gerçek müşteriyi ekledi` : ""}${malMetin}`, "sevkiyat");
    log("Sevkiyat köprüsü:", nS, "sevkiyat •", nT, "tahsilat •", nG, "yeni müşteri");
  } catch (e) { GSON.sevkiyat = { t: Date.now(), metin: "⚠ " + e.message }; log("Sevkiyat köprüsü atlandı:", e.message.replace(/[^\w çğıöşüÇĞİÖŞÜ():—-]/g, "").slice(0, 120)); }
}

/* ---------- 🔄 1) Takibi kendisi ayarlar ---------- */
if (calis("takip")) {
  let n = 0;
  const ro = new Map(X.reorderList().map(o => [o.x.id, o])), sl = new Set(X.sleepers().map(o => o.x.id));
  for (const x of data) {
    if (n >= 300) break;
    if (x.aramayin || x.durum === "İlgilenmiyor") continue;
    const ch = {}, sg = sonGor(x);
    if (["İlgileniyor", "İletişim kuruldu", "Teklif verildi"].includes(x.durum) && !x.sonraki)
      ch.sonraki = sg && Date.now() - sg < 7 * 864e5 ? X.fmt(new Date(sg + 7 * 864e5)) : BUGUN;
    const r = ro.get(x.id); if (r && (!x.sonraki || x.sonraki > r.bek)) ch.sonraki = r.bek < BUGUN ? BUGUN : r.bek;
    if (sl.has(x.id)) { if (!x.oncelik) ch.oncelik = "Sıcak"; if (!x.sonraki && !ch.sonraki) ch.sonraki = BUGUN; }
    if (X.vadeDurum(x).tut > 0.5 && !x.sonraki && !ch.sonraki) ch.sonraki = BUGUN;
    if (x.durum === "Yeni" && !x.oncelik && x.aday != null) { if (x.aday >= 70) ch.oncelik = "Sıcak"; else if (x.aday >= 50) ch.oncelik = "Ilık"; }
    for (const k of Object.keys(ch)) if (ch[k] === x[k]) delete ch[k];
    if (Object.keys(ch).length) { try { await guncelle(x, ch); n++; } catch (e) { } }
  }
  if (n) not_("🔄", `${n} kaydın takip tarihini ve önceliğini kendisi ayarladı`, "takip");
  log("Takip ayarı:", n, "kayıt");
}

/* ---------- 🎯 2) Yeni müşteri adaylarını kendisi bulur (kendi verimizden) ---------- */
if (calis("tarama")) {
  const M = O.merkez;
  if (!M || !isFinite(+M.lat) || !isFinite(+M.lon)) { log("Otomatik tarama atlandı: fabrika konumu seçilmemiş (Kurulum → Otonom ajanlar)"); not_("⚠", "Otomatik tarama için fabrika konumu seçilmemiş (Ajanlar → 🛠 Kurulum → 7. adım)"); }
  else try {
    const base = String(ayar.veriUrl || X.VERI_DEF).trim().replace(/\/?$/, "/");
    const jget = async u => { const r = await fetch(u); if (!r.ok) { const e = new Error(u.split("/").pop() + " " + r.status); e.st = r.status; throw e; } return r; };
    const idx = await (await jget(base + "dunya.json")).json(), B = idx.blok || 48;
    const Rmax = Math.max(1, +O.yaricapMax || 30), R = Math.min(Rmax, Math.max(+O.yaricap || 10, +D.taramaR || 0));
    X.setR(R);
    const c = { lat: +M.lat, lon: +M.lon }, a10 = v => Math.floor(v * 10);
    const dLa = R / 111, dLo = R / (111 * Math.max(.05, Math.cos(c.lat * Math.PI / 180)));
    const la0 = a10(c.lat - dLa), la1 = a10(c.lat + dLa), lo0 = a10(c.lon - dLo), lo1 = a10(c.lon + dLo), bl = [];
    for (let i = Math.floor(la0 / B); i <= Math.floor(la1 / B); i++) for (let j = Math.floor(lo0 / B); j <= Math.floor(lo1 / B); j++) bl.push(i + "_" + j);
    const keys = [];
    for (const b of bl) { let d = { t: {} }; try { d = await (await jget(base + "w/i/" + b + ".json")).json(); } catch (e) { if (e.st !== 404) throw e; }
      for (const k of Object.keys(d.t || {})) { const [s, ij] = k.split("/"), [i, j] = ij.split("_").map(Number), S = +s; if (i * S <= la1 && i * S + S - 1 >= la0 && j * S <= lo1 && j * S + S - 1 >= lo0) keys.push(k); } }
    const sekVars = X.TSEK.filter(t => X.tuk(t.k) >= 20).map(t => t.k);
    const secs = new Set((Array.isArray(O.sektorler) && O.sektorler.length) ? O.sektorler : sekVars);
    const aday = [];
    for (const k of keys) {
      const buf = Buffer.from(await (await jget(base + "w/t/" + k + ".json.gz")).arrayBuffer());
      const rows = JSON.parse((buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString("utf8"));
      for (const [ad, sk, lat, lon, tel, web, adres, il, oid, ep] of rows) {
        if (!ad || !secs.has(sk)) continue; const km = X.hav(c.lat, c.lon, lat, lon); if (km > R) continue;
        aday.push({ id: "o" + (oid || lat + "," + lon), ad, sek: sk, lat, lon, tel: tel || "", web: web || "", ep: ep || "", adres: adres || "", il: il || "", km });
      }
    }
    const gorulen = (await okuG("ajan/gorulen")) || {};
    const telV = new Set(data.map(x => X.tel10(x.telefon)).filter(Boolean));
    const ayni = p => data.some(x => X.normF(x.firma) === X.normF(p.ad) && (!x.konum || X.hav(x.konum.lat, x.konum.lon, p.lat, p.lon) < 0.3));
    const temiz = aday.filter(p => !gorulen[p.id.replace(/[.#$/[\]]/g, "_")] && !X.isChain(p) && !X.isRival(p) && !(X.tel10(p.tel) && telV.has(X.tel10(p.tel))) && !ayni(p))
      .map(p => ({ p, s: X.adayPuan(p) + (p.tel ? 0 : -25) })).sort((a, b) => b.s - a.s);
    const N = Math.max(0, +O.gunlukAday || 15), sec = temiz.slice(0, N);
    const owner = ayar.ownerUid, sekAd = k => (X.TSEK.find(t => t.k === k) || {}).ad || "Diğer";
    const yeniG = {};
    for (const { p, s: sc } of sec) {
      const bo = X.bolgeOf(p.lat, p.lon), sahip = (bo && bo.uid) || owner || "", sahipAd = (bo && bo.uad) || (users && users[sahip] && users[sahip].ad) || "";
      const L = { id: X.uid_(), c: Date.now(), u: Date.now(), aday: Math.max(0, Math.min(100, sc)), firma: p.ad, yetkili: "", sektor: sekAd(p.sek), il: p.il, adres: p.adres, telefon: p.tel, eposta: p.ep, web: p.web,
        durum: "Yeni", izin: "Yok", oncelik: sc >= 70 ? "Sıcak" : sc >= 50 ? "Ilık" : "", kaynak: "🤖 Gece ajanı (otomatik tarama)", konum: { lat: p.lat, lon: p.lon }, mesafe: Math.round(p.km * 100) / 100, sonraki: "", not: "" };
      if (sahip) { L.sahip = sahip; L.sahipAd = sahipAd; }
      try { await yaz("leads/" + L.id, g.tok, L); data.push(L); yeniG[p.id.replace(/[.#$/[\]]/g, "_")] = BUGUN; } catch (e) { log("aday eklenemedi:", e.message); }
    }
    if (Object.keys(yeniG).length) await yaz("ajan/gorulen", g.tok, yeniG, "PATCH").catch(() => { });
    if (temiz.length - sec.length < N && R < Rmax) D.taramaR = Math.min(Rmax, R + 5);
    const n = Object.keys(yeniG).length;
    not_("🎯", n ? `${R} km içinde ${aday.length} işletmeye baktı, ${n} yeni müşteri adayı buldu ve listeye ekledi (en iyiler: ${sec.slice(0, 3).map(o => o.p.ad).join(", ")})` : `${R} km içinde yeni aday kalmadı${D.taramaR > R ? "; yarın " + D.taramaR + " km'ye genişleyecek" : ""}`, "tarama");
    log("Otomatik tarama:", R, "km •", aday.length, "işletme •", n, "yeni aday eklendi");
  } catch (e) { log("Otomatik tarama hatası:", e.message); not_("⚠", "Otomatik tarama bu gece yapılamadı: " + e.message); }
}

/* ---------- ✉ 3) Web sitelerinden e-posta bulur ---------- */
if (calis("epbul")) {
  const aday = data.filter(x => x.web && !x.eposta && !x.aramayin && (!x.epDenendi || X.daysSince(x.epDenendi) > 30)).slice(0, +env("EPOSTA_LIMIT") || 30);
  const getir = async u => { const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
    try { const r = await fetch(u, { signal: c.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; MAGAmbalajBot/1.0)", "Accept-Language": "tr,en" } }); return r.ok ? (await r.text()).slice(0, 800000) : ""; }
    catch (e) { return ""; } finally { clearTimeout(t); } };
  let bulunan = 0;
  for (const x of aday) {
    let u = String(x.web).trim(); if (!/^https?:/i.test(u)) u = "https://" + u;
    let host = ""; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch (e) { }
    let h = await getir(u); if (!h && u.startsWith("https://")) h = await getir(u.replace("https://", "http://"));
    let l = h ? X.epCikar(h) : [];
    if (!l.length && h) {
      const lk = [...new Set([...h.matchAll(/href=["']?([^"' >]+)/gi)].map(m => m[1]).filter(z => /(iletisim|contact|kontakt|bize-ulasin|hakkimizda|about)/i.test(z)))].slice(0, 2);
      for (const k of lk) { try { l = X.epCikar(await getir(new URL(k, u).href)); if (l.length) break; } catch (e) { } }
    }
    l.sort((a, b) => (b.endsWith(host) ? 1 : 0) - (a.endsWith(host) ? 1 : 0));
    try { await guncelle(x, l.length ? { eposta: l[0], epKaynak: "web (gece ajanı)", epDenendi: BUGUN } : { epDenendi: BUGUN }); if (l.length) bulunan++; } catch (e) { }
  }
  if (bulunan || aday.length) not_("✉", `${aday.length} firmanın web sitesine girdi, ${bulunan} e-posta adresi buldu`, "epbul");
  if (aday.length) log("E-posta avcısı:", aday.length, "site •", bulunan, "bulundu");
}

/* ---------- 📧 Gmail bağlantısı (isteğe bağlı) ---------- */
const GU = env("GMAIL_USER") || String(GIZLI.gmailUser || "").trim(), GP = (env("GMAIL_APP_PASSWORD") || String(GIZLI.gmailPass || "")).replace(/\s+/g, "");
const gmailVar = !!(GU && GP) && O.eposta !== "kapali";
const F = ayar.firma || {}, FIRMA = F.ad || "MAG AMBALAJ";
const enc = s => "=?UTF-8?B?" + Buffer.from(String(s)).toString("base64") + "?=";
const altBilgi = () => `\n\n—\n${FIRMA}${F.adr ? "\n" + F.adr : ""}${F.tel ? "\nTel: " + F.tel : ""}${F.web ? " • " + F.web : ""}\nE-posta: ${F.ep || GU}\nBu e-postaları almak istemiyorsanız "İPTAL" yazarak yanıtlamanız yeterli.`;
const epMap = new Map(); for (const x of data) if (x.eposta) epMap.set(String(x.eposta).toLowerCase().trim(), x);
const GENEL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|yandex|icloud|msn|mynet|windowslive)\./i;
const kimin = adr => { adr = String(adr || "").toLowerCase(); if (epMap.has(adr)) return epMap.get(adr); const d = adr.split("@")[1] || ""; if (!d || GENEL.test(d)) return null; for (const [e, x] of epMap) if (e.endsWith("@" + d)) return x; return null; };

/* ---------- 📨 4) Gelen cevapları okur, sınıflar, Gmail'de cevap taslağı hazırlar ---------- */
if (calis("gelen") && !gmailVar) GSON.gelen = { t: Date.now(), metin: "Gmail bağlı değil (Kurulum 7b)" };
if (gmailVar && calis("gelen")) {
  let ImapFlow, simpleParser;
  try { ({ ImapFlow } = await import("imapflow")); ({ simpleParser } = await import("mailparser")); } catch (e) { log("imapflow/mailparser yok, gelen kutusu atlandı"); }
  if (ImapFlow) {
    const cl = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: GU, pass: GP }, logger: false });
    let okunan = 0, sinif = { ilgileniyor: 0, soru: 0, iptal: 0, olumsuz: 0 }, taslak = 0;
    try {
      await cl.connect();
      const kutular = await cl.list(); const taslakKutu = (kutular.find(k => k.specialUse === "\\Drafts") || {}).path;
      const lock = await cl.getMailboxLock("INBOX");
      const gelen = [];
      try {
        const since = new Date(Math.max(Date.now() - 4 * 864e5, (D.sonGelen || 0) - 864e5));
        for await (const m of cl.fetch({ since }, { envelope: true, source: true, uid: true })) gelen.push(m);
      } finally { lock.release(); }
      const EPG = (await okuG("ajan/epGorulen")) || {}, epgYeni = {}; let yeniSor = 0;
      const TOPLU = /no-?reply|noreply|mailer-daemon|postmaster|bildirim|notification|newsletter|bulten|bülten|kampanya|info@.*(google|facebook|linkedin|instagram|trendyol|hepsiburada|amazon|n11|getir|yemeksepeti)/i;
      for (const m of gelen) {
        const kimden = m.envelope && m.envelope.from && m.envelope.from[0] && m.envelope.from[0].address; const x = kimin(kimden);
        if (!x) { /* v17.6: listede olmayan biri yazdıysa: fiyat/sipariş isteği mi? → 📥 talep (müşteri kaydı + teklif/iş emri taslağı «talep» görevinde) */
          if (!calis("talep") || !kimden || String(kimden).toLowerCase() === String(GU).toLowerCase() || TOPLU.test(kimden) || !X.aiKey() || yeniSor >= 10) continue;
          const mid2 = (m.envelope.messageId || String(m.uid)).replace(/[.#$/[\]]/g, "_"); if (EPG[mid2]) continue;
          const ml2 = await simpleParser(m.source).catch(() => null); if (!ml2) continue; epgYeni[mid2] = BUGUN;
          const hd = k => String(ml2.headers && ml2.headers.get && ml2.headers.get(k) || "");
          if (hd("list-unsubscribe") || /bulk|list|junk/i.test(hd("precedence")) || /auto-/i.test(hd("auto-submitted"))) continue;
          const mt = String(ml2.text || "").split(/\n>|\nOn .+wrote:|\n.+tarihinde .+ yazdı:/)[0].trim().slice(0, 3000); if (mt.length < 15) continue;
          yeniSor++;
          try {
            X.aiKodla();
            const j = JSON.parse(String(await X.aiSor(`Poşet/ambalaj üreticisi ${FIRMA}'ın gelen kutusuna, müşteri listesinde OLMAYAN birinden e-posta geldi. Bu bir fiyat/teklif isteği mi, sipariş mi, yoksa başka bir şey mi (reklam, tedarikçi teklifi, iş başvurusu, fatura, banka, kargo vb.)? Yalnız bizden ürün almak isteyenler teklif/siparis sayılır.
SADECE JSON: {"tur":"teklif"|"siparis"|"diger","firma":"yazanın firması ya da boş","ad":"yazanın adı ya da boş","tel":"mesajda telefon varsa ya da boş","kalem":[{"urun":"","mik":"sayı","birim":"kg|adet|koli|paket","olcu":"ölçü/mikron/baskı bilgisi"}],"ozet":"tek cümle"}`,
              [{ r: "ben", m: JSON.stringify({ konu: ml2.subject || "", mesaj: mt }) }], { json: true, sicak: 0.1, max: 900 })).replace(/^```(?:json)?|```$/g, ""));
            if (j.tur === "teklif" || j.tur === "siparis") {
              await yaz("talep", g.tok, { kaynak: "eposta", tur: j.tur, firma: String(j.firma || "").slice(0, 120), ad: String(j.ad || (m.envelope.from[0].name || "")).slice(0, 80), tel: String(j.tel || "").slice(0, 30), ep: String(kimden).slice(0, 120),
                kalem: X.arr(j.kalem).slice(0, 6).map(q => ({ urun: String(q.urun || "").slice(0, 80), mik: +String(q.mik || "").replace(",", ".") || 0, birim: String(q.birim || "").slice(0, 12), olcu: String(q.olcu || "").slice(0, 120) })),
                not: mt.slice(0, 1500), ozet: String(j.ozet || "").slice(0, 200), konu: String(ml2.subject || "").slice(0, 150), mid: String(ml2.messageId || "").slice(0, 200), t: Date.now() }, "POST");
              okunan++; sinif.istek = (sinif.istek || 0) + 1;
            }
          } catch (e) { log("yeni e-posta sınıflanamadı:", String(e.message).slice(0, 60)); }
          continue;
        }
        const mid = (m.envelope.messageId || String(m.uid)).replace(/[.#$/[\]]/g, "_");
        if (X.arr(x.epCevapIds).includes(mid)) continue;
        const ml = await simpleParser(m.source).catch(() => null); if (!ml) continue;
        const otomatik = /auto-?replied|auto-generated/i.test(String(ml.headers && ml.headers.get && ml.headers.get("auto-submitted") || "")) || /otomatik yanıt|out of office|izindeyim|automatic reply/i.test(ml.subject || "");
        let metin = String(ml.text || "").split(/\n>|\nOn .+wrote:|\n.+tarihinde .+ yazdı:/)[0].trim().slice(0, 3000);
        // imza/kişi adı gizliliği: telefondan önce gelen isimleri ve sondaki kısa imza satırlarını at
        metin = metin.replace(/((?:[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+){1,3})(?=\+?\d[\d\s().-]{8,}\d)/g, "[kişi] ");
        { const sat = metin.split("\n"); let i = sat.length; while (i > 1 && sat.length - i < 4 && sat[i - 1].trim().split(/\s+/).length <= 4 && !/[?]/.test(sat[i - 1])) i--; metin = sat.slice(0, i).join("\n").trim(); }
        let tur = /\biptal\b|istemiyorum|unsubscribe|listeden çıkar/i.test(metin) ? "iptal" : "soru", ozet = metin.slice(0, 120), cevap = "";
        if (!otomatik && tur !== "iptal" && X.aiKey()) {
          try {
            X.aiKodla();
            const j = JSON.parse(String(await X.aiSor(`Poşet üreticisi ${FIRMA}'ın e-postasına bir işletmeden cevap geldi. Cevabı sınıfla ve gerekiyorsa kısa, kibar bir yanıt yaz.
SADECE JSON: {"tur":"ilgileniyor"|"soru"|"iptal"|"olumsuz"|"otomatik","istek":"teklif (fiyat soruyor) | siparis (ürün istiyor) | boş","kalem":[{"urun":"","mik":"sayı","birim":"","olcu":""}],"ozet":"tek cümle","cevap":"müşteriye yanıt metni (selam ve imza dahil değil; fiyat/teslim uydurma, bilmediğini 'bugün sizi arayacağız' diye geçiştir) ya da boş"}`,
              [{ r: "ben", m: JSON.stringify({ firmaKodu: X.kodOf(x), sektor: x.sektor || "", gelenMesaj: X.anon(metin) }) }], { json: true, sicak: 0.3, max: 1500 })).replace(/^```(?:json)?|```$/g, ""));
            if (["ilgileniyor", "soru", "iptal", "olumsuz", "otomatik"].includes(j.tur)) tur = j.tur; ozet = X.deanon(j.ozet || ozet); cevap = X.deanon(j.cevap || "");
            if ((j.istek === "teklif" || j.istek === "siparis") && calis("talep") && tur !== "iptal" && tur !== "olumsuz") { /* teklif/iş emri taslağını «talep» görevi hazırlar */
              await yaz("talep", g.tok, { kaynak: "eposta", tur: j.istek, lead: x.id, firma: x.firma, ep: String(kimden).slice(0, 120), kalem: X.arr(j.kalem).slice(0, 6).map(q => ({ urun: String(q.urun || "").slice(0, 80), mik: +String(q.mik || "").replace(",", ".") || 0, birim: String(q.birim || "").slice(0, 12), olcu: String(q.olcu || "").slice(0, 120) })),
                not: metin.slice(0, 1500), ozet: ozet.slice(0, 200), konu: String(ml.subject || "").slice(0, 150), mid: String(ml.messageId || "").slice(0, 200), t: Date.now() }, "POST").catch(() => { });
              cevap = ""; }
          } catch (e) { log("cevap sınıflanamadı:", e.message); }
        }
        if (otomatik || tur === "otomatik") { x.epCevapIds = [...X.arr(x.epCevapIds), mid].slice(-10); await guncelle(x, { epCevapIds: x.epCevapIds }).catch(() => { }); continue; }
        okunan++; sinif[tur] = (sinif[tur] || 0) + 1;
        const ch = { epCevapIds: [...X.arr(x.epCevapIds), mid].slice(-10), epCevap: { t: Date.now(), tur, ozet }, gorus: gorusEkle(x, "E-posta", "📨 Cevap geldi (" + tur + "): " + ozet) };
        if (tur === "iptal") { ch.aramayin = { neden: "E-posta ile İPTAL yazdı", t: Date.now(), kim: "🤖 Ajan" }; ch.izin = "Çıkış yaptı"; }
        else if (tur === "olumsuz") { ch.durum = "İlgilenmiyor"; ch.kayip = x.kayip || "E-postada ilgilenmedi"; }
        else { if (["Yeni", "İletişim kuruldu"].includes(x.durum)) ch.durum = "İlgileniyor"; ch.oncelik = "Sıcak"; ch.sonraki = BUGUN; SICAK.push(`📨 ${x.firma} e-postana cevap verdi (${tur}): ${ozet}`.slice(0, 200)); }
        if (cevap && taslakKutu && (tur === "ilgileniyor" || tur === "soru")) {
          const govde = `Merhaba${x.yetkili ? " " + x.yetkili : ""},\n\n${cevap.trim()}\n\nSaygılarımızla,${altBilgi()}`;
          const konu = /^re:/i.test(ml.subject || "") ? ml.subject : "Re: " + (ml.subject || FIRMA);
          const raw = [`From: ${enc(FIRMA)} <${GU}>`, `To: <${kimden}>`, `Subject: ${enc(konu)}`, ml.messageId ? `In-Reply-To: ${ml.messageId}` : "", ml.messageId ? `References: ${ml.messageId}` : "", `Date: ${new Date().toUTCString()}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(govde).toString("base64").replace(/.{76}/g, "$&\r\n")].filter(z => z !== "").join("\r\n").replace("Transfer-Encoding: base64\r\n", "Transfer-Encoding: base64\r\n\r\n");
          try { await cl.append(taslakKutu, raw, ["\\Draft"]); taslak++; ch.epTaslak = { t: Date.now() }; } catch (e) { log("taslak kaydedilemedi:", e.message); }
        }
        await guncelle(x, ch).catch(e => log("güncellenemedi:", e.message));
      }
      D.sonGelen = Date.now();
      if (Object.keys(epgYeni).length) { const tut = Object.fromEntries(Object.entries({ ...EPG, ...epgYeni }).filter(([, d]) => X.daysSince(d) <= 10)); await yaz("ajan/epGorulen", g.tok, tut).catch(() => { }); }
    } catch (e) { log("Gmail gelen kutusu hatası:", e.message); if (/auth|credential|password|Invalid/i.test(e.message)) not_("⚠", "Gmail'e girilemedi: uygulama şifresini kontrol et (GMAIL_APP_PASSWORD)"); }
    finally { try { await cl.logout(); } catch (e) { } }
    not_("📨", `${okunan} e-posta okudu (ilgilenen ${sinif.ilgileniyor || 0}, soru ${sinif.soru || 0}, iptal ${sinif.iptal || 0}, olumsuz ${sinif.olumsuz || 0}${sinif.istek ? `, yeni fiyat/sipariş isteği ${sinif.istek}` : ""})${taslak ? `; ${taslak} cevap taslağını Gmail'de Taslaklar'a hazırladı` : ""}`, "gelen");
    log("Gelen kutusu:", okunan, "cevap •", taslak, "taslak");
  }
}

/* ---------- 📥 v17.6 TALEPLER: müşteri portalı / web sitesi formu / e-posta → müşteri kaydı + fabrikaya iş emri taslağı + teklif taslağı ----------
   Hiçbir şey kendiliğinden müşteriye gitmez: teklif Gmail «Taslaklar»a konur, iş emri taslağı Fabrika Sevkiyat'ta «📥 Gelen siparişler»de onay bekler. */
if (calis("talep")) {
  /* 🌐 web sitesi ve müşteri portalı ürün listesini (fiyatsız; «vitrinde fiyat göster» açıksa fiyatlı) günde bir tazele */
  if (D.vitrin !== BUGUN) try { const F2 = ayar.firma || {}, KV = ctx.__katalog || [];
    await yaz("vitrin", g.tok, JSON.parse(JSON.stringify({ firma: { ad: F2.ad || "", tel: F2.tel || "", ep: F2.ep || "", web: F2.web || "" }, para: ayar.para || "TRY", urunler: KV.filter(u => u && u.ad).map(u => ({ id: u.id || "", ad: u.ad, birim: u.birim || "", tip: u.tip || "", ebat: u.ebat || "", ...(ayar.vitrinFiyat ? { fiyat: +u.fiyat || 0 } : {}) })), t: Date.now() })));
    D.vitrin = BUGUN; } catch (e) { log("vitrin yazılamadı"); }
  try {
    const T = (await okuG("talep")) || {};
    const yeni = Object.entries(T).filter(([, t]) => t && !t.ajan && !t.islendi && !t.test && Date.now() - (+t.t || 0) < 30 * 864e5).sort((a, b) => (a[1].t || 0) - (b[1].t || 0)).slice(0, 15);
    if (yeni.length) {
      const KAD = { portal: "Müşteri portalı", site: "Web sitesi", eposta: "E-posta" };
      // Fabrika Sevkiyat girişi (iş emri taslağı için)
      let fab = null; const SK = String(GIZLI.sevkKul || "").trim(), SP = String(GIZLI.sevkSifre || "");
      if (SK && SP) try { const C = X.SEVK_CFG, DBS = (env("SEVK_DB_URL") || C.db).replace(/\/$/, "");
        const lg = await istek((env("SEVK_AUTH_URL") || AUTH) + "accounts:signInWithPassword?key=" + C.apiKey, { method: "POST", body: JSON.stringify({ email: C.ep(SK), password: SP, returnSecureToken: true }) });
        if (lg.ok) fab = { DBS, tk: lg.j.idToken }; } catch (e) { }
      // teklif taslakları için Gmail (IMAP «Taslaklar»)
      let cl = null, taslakKutu = null;
      const gmailAc = async () => { if (cl !== null) return !!taslakKutu; cl = false; if (!gmailVar) return false;
        try { const { ImapFlow } = await import("imapflow"); cl = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: GU, pass: GP }, logger: false }); await cl.connect();
          taslakKutu = ((await cl.list()).find(k => k.specialUse === "\\Drafts") || {}).path || null; } catch (e) { log("Gmail (taslak) açılamadı"); cl = false; } return !!taslakKutu; };
      const KAT = (ctx.__katalog || []).filter(u => u && u.ad && +u.fiyat > 0).slice(0, 80).map(u => ({ ad: u.ad, birim: u.birim || "kg", fiyat: +u.fiyat, tip: u.tip || "", ebat: u.ebat || "" }));
      const PB = ayar.para || "TRY", fiyatYaz = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: PB, maximumFractionDigits: 2 }).format(n);
      const nE = s => String(s || "").toLowerCase().trim();
      let nL = 0, nF = 0, nT = 0;
      for (const [k, t] of yeni) {
        const kay = t.kaynak || "portal", tur = kay === "portal" ? "siparis" : (t.tur === "siparis" ? "siparis" : "teklif");
        const kal = X.arr(t.kalem).filter(q => q && (q.urun || q.mik)), ozet = String(t.ozet || kal.map(q => [q.urun, q.mik ? q.mik + " " + (q.birim || "") : ""].filter(Boolean).join(" ")).join(", ") || t.not || "").replace(/\s+/g, " ").slice(0, 140);
        // 1) müşteri kaydı: varsa bul (lead / e-posta / telefon / firma adı), yoksa aç
        let x = (t.lead && data.find(v => v.id === t.lead)) || (t.ep && data.find(v => nE(v.eposta) === nE(t.ep))) || (X.tel10(t.tel) && data.find(v => X.tel10(v.telefon) === X.tel10(t.tel))) || (t.firma && data.find(v => X.normF(v.firma) === X.normF(t.firma)));
        if (!x) { const sahip = ayar.ownerUid || "";
          x = { id: X.uid_(), c: Date.now(), u: Date.now(), firma: String(t.firma || t.ad || (t.ep ? String(t.ep).split("@")[0] : "") || "Web talebi").slice(0, 120), yetkili: t.ad || "", telefon: t.tel || "", eposta: t.ep || "",
            durum: "İlgileniyor", izin: "Yok", oncelik: "Sıcak", kaynak: kay === "site" ? "🌐 Web sitesi teklif formu" : "📧 E-posta talebi (gece ajanı)", sonraki: BUGUN, not: "" };
          if (sahip) { x.sahip = sahip; x.sahipAd = (users && users[sahip] && users[sahip].ad) || ""; }
          try { await yaz("leads/" + x.id, g.tok, x); data.push(x); nL++; } catch (e) { log("talep müşterisi eklenemedi:", e.message); continue; } }
        const ch = { ajan: { t: Date.now(), tur }, lead: x.id };
        const gx = { gorus: gorusEkle(x, "Not", `📥 ${KAD[kay] || kay}: ${tur === "teklif" ? "fiyat/teklif isteği" : "sipariş"} — ${ozet}`), oncelik: "Sıcak", sonraki: BUGUN };
        if (["Yeni", "İletişim kuruldu"].includes(x.durum)) gx.durum = "İlgileniyor"; if (!x.eposta && t.ep) gx.eposta = t.ep; if (!x.telefon && t.tel) gx.telefon = t.tel;
        await guncelle(x, gx).catch(() => { });
        // 2) sipariş → Fabrika Sevkiyat «📥 Gelen siparişler» (iş emri formunu yapay zekâ doldurur, personel Kaydet der). Fiyat GİTMEZ.
        if (tur === "siparis" && fab) {
          try { const r = await istek(fab.DBS + "/aiTaslak/" + encodeURIComponent(k) + ".json?auth=" + encodeURIComponent(fab.tk), { method: "PUT", body: JSON.stringify({ t: Date.now(), kaynak: kay, firma: x.firma,
            kalem: kal.slice(0, 6).map(q => ({ urun: String(q.urun || "").slice(0, 80), mik: +q.mik || 0, birim: String(q.birim || "").slice(0, 12), olcu: String(q.olcu || "").slice(0, 120) })), not: String(t.not || "").slice(0, 600), durum: "yeni" }) });
            if (r.ok) { ch.ajan.fab = true; nF++; } else log("iş emri taslağı yazılamadı (" + r.st + ")"); } catch (e) { }
        }
        // 3) teklif → Gmail Taslaklar'a fiyat teklifi (fiyatlar YALNIZ katalogdan; bilinmeyen ürün için bilgi istenir)
        if (tur === "teklif" && t.ep && X.aiKey() && await gmailAc()) {
          try {
            X.aiKodla();
            const j = JSON.parse(String(await X.aiSor(`Poşet/ambalaj üreticisi ${FIRMA} adına bir fiyat teklifi e-postası yaz. KURALLAR: Fiyatları YALNIZ verilen katalogdan al, ASLA fiyat uydurma. İstenen ürün katalogda net eşleşmiyorsa (ölçü/mikron/baskı farklı) o kalem için fiyat yazma; hangi bilgiler gerekirse (ölçü, mikron, renk, baskı, adet/kg) kibarca sor ve aynı gün dönüş yapacağımızı söyle. Katalog fiyatları birim başınadır ve KDV hariçtir. Miktar varsa ara toplamı hesapla. Teslim süresi, ödeme vadesi, indirim UYDURMA. Kısa, net, kibar Türkçe. Selam ve imza YAZMA.
SADECE JSON: {"eslesen":[{"istek":"","katalog":"katalogdaki ad","birimFiyat":0,"birim":"","mik":0}],"govde":"e-posta gövdesi"}`,
              [{ r: "ben", m: JSON.stringify({ katalog: KAT, istek: { kalemler: kal, mesaj: X.anon(String(t.not || "").slice(0, 1500)) } }) }], { json: true, sicak: 0.2, max: 1800 })).replace(/^```(?:json)?|```$/g, ""));
            // güvenlik: model katalog dışı fiyat yazdıysa teklif taslağı oluşturma
            const kotu = X.arr(j.eslesen).some(e => +e.birimFiyat > 0 && !KAT.some(u => u.ad === e.katalog && Math.abs(u.fiyat - +e.birimFiyat) < 0.011));
            const govde0 = X.deanon(String(j.govde || "")).trim();
            if (!kotu && govde0.length > 20) {
              const govde = `Merhaba${t.ad ? " " + t.ad : x.yetkili ? " " + x.yetkili : ""},\n\n${govde0}\n\nSaygılarımızla,${altBilgi().replace(/\nBu e-postaları almak istemiyorsanız.*$/s, "")}`;
              const konu = t.mid ? (/^re:/i.test(t.konu || "") ? t.konu : "Re: " + (t.konu || "Fiyat teklifi")) : `Fiyat teklifi — ${FIRMA}`;
              const raw = [`From: ${enc(FIRMA)} <${GU}>`, `To: <${t.ep}>`, `Subject: ${enc(konu)}`, t.mid ? `In-Reply-To: ${t.mid}` : "", t.mid ? `References: ${t.mid}` : "", `Date: ${new Date().toUTCString()}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(govde).toString("base64").replace(/.{76}/g, "$&\r\n")].filter((l, i) => l !== "" || i > 8).join("\r\n");
              await cl.append(taslakKutu, raw, ["\\Draft"]); ch.ajan.teklif = true; nT++;
              await guncelle(x, { gorus: gorusEkle(x, "E-posta", "📝 Teklif taslağı Gmail → Taslaklar'da hazır (kontrol edip gönder)") }).catch(() => { });
            } else if (kotu) log("teklif taslağında katalog dışı fiyat çıktı, taslak yazılmadı");
          } catch (e) { log("teklif taslağı yazılamadı:", String(e.message).slice(0, 60)); }
        }
        SICAK.push(`📥 ${x.firma}: ${KAD[kay] || kay} ${tur === "teklif" ? "teklif isteği" : "siparişi"} — ${ozet}${ch.ajan.teklif ? " (teklif taslağı Gmail'de hazır)" : ch.ajan.fab ? " (fabrikada iş emri taslağı hazır)" : ""}`.slice(0, 220));
        await yaz("talep/" + k, g.tok, ch, "PATCH").catch(e => log("talep işaretlenemedi:", e.message));
      }
      if (cl) { try { await cl.logout(); } catch (e) { } }
      not_("📥", `${yeni.length} gelen talebi işledi${nL ? `, ${nL} yeni müşteri kaydı açtı` : ""}${nF ? `, ${nF} siparişi fabrikaya iş emri taslağı olarak gönderdi` : ""}${nT ? `, ${nT} teklif taslağını Gmail → Taslaklar'a hazırladı` : ""}`, "talep");
      log("Talepler:", yeni.length, "• yeni müşteri", nL, "• fabrika", nF, "• teklif", nT);
    }
  } catch (e) { GSON.talep = { t: Date.now(), metin: "⚠ " + e.message }; log("Talepler atlandı:", String(e.message).slice(0, 80)); }
}

/* ---------- 📋 5) Ajanlar + Müdür raporu (günün ilk turu) ---------- */
const l = X.ajCalistir();
const metin = X.ajRapor(l);
const masada = X.ajMasada(l).reduce((a, z) => a + z[1], 0);
const acil = l.filter(f => f.sev === "kritik").length, onemli = l.filter(f => f.sev === "onemli").length;
log("Bulunan iş:", l.length, "• acil:", acil, "• önemli:", onemli);
const TL = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: ayar.para || "TRY", maximumFractionDigits: 0 }).format(n || 0);

if (calis("rapor") || calis("taslak")) {
  if (calis("rapor")) {
  let yorum = "";
  if (X.aiKey()) {
    try { yorum = X.deanon(await X.aiSor(X.AISYS(), [{ r: "ben", m: "Bugünün planını çıkar: öncelik sırasıyla en fazla 6 madde (kim/kod, ne yapılacak, neden, ₺ etkisi). Sonunda tek cümle genel değerlendirme." }])); log("Müdür yorumu yazıldı"); }
    catch (e) { log("Yapay zekâ yorumu atlandı:", e.message); }
  }
  const rapor = { t: Date.now(), tarih: BUGUN, metin, yorum, sayi: l.length, acil, onemli, masada: Math.round(masada) };
  try { await yaz("ajan/rapor/son", g.tok, rapor); log("Rapor buluta yazıldı"); }
  catch (e) { dur("Rapor buluta yazılamadı (" + e.message + "). Firebase kuralını güncelle: programda ☁ → Kuralı kopyala → Firebase Rules → Publish."); }
  not_("📋", `Müdür raporunu hazırladı: ${l.length} iş${acil ? ", " + acil + " acil" : ""}${masada >= 1 ? ", masada ≈ " + TL(masada) : ""}`, "rapor");
  }

  /* ---------- ✍ 6) Her iş için mesajı hazır yazar ---------- */
  if (calis("taslak") && !X.aiKey()) GSON.taslak = { t: Date.now(), metin: "Yapay zekâ anahtarı yok (Kurulum 1. adım)" };
  if (X.aiKey() && calis("taslak")) {
    const isler = l.filter(f => f.msg && f.id).sort((a, b) => (a.sev === "bilgi") - (b.sev === "bilgi")).slice(0, Math.max(0, +O.taslakSayisi || 12));
    const ts = {}; let n = 0;
    for (const f of isler) {
      try { const m = await X.aiMesajYaz(f, true); if (m) { ts[crypto.createHash("sha1").update(X.ajKey(f)).digest("hex").slice(0, 20)] = { k: X.ajKey(f), m, d: BUGUN }; n++; } }
      catch (e) { log("mesaj yazılamadı:", e.message); if (/kota|429|sınır/i.test(e.message)) break; }
    }
    if (n) { await yaz("ajan/taslak", g.tok, ts).catch(e => log("taslaklar yazılamadı:", e.message)); not_("✍", `${n} iş için firmaya özel mesajı hazır yazdı — sabah sadece "Gönder"e basman yeterli`, "taslak"); }
    log("Hazır mesaj:", n);
  }
}

/* ---------- 📧 7) E-postayı kendisi gönderir — Görevler ekranında seçilen türler ---------- */
const EPT = ["teklifEp", "tahsilatEp", "tekrarEp", "numuneEp", "fiyatEp", "caprazEp", "uyuyanEp", "takipEp", "tanitim"].filter(k => calis(k));
if (EPT.length && !gmailVar) for (const k of EPT) GSON[k] = { t: Date.now(), metin: "Gmail bağlı değil (Kurulum 7b)" };
const TURA = { tanitim: ["tanitim", "ilk tanıtım e-postası: kendimizi tanıt, aracısız fabrika fiyatı ve hızlı teslimden bahset, numune bırakmayı teklif et"],
  takipEp: ["takip", "cevapsız tanıtımdan sonra kısa, nazik ikinci e-posta"], teklifEp: ["teklif", "verdiğimiz teklifin nazik hatırlatması; soru veya değişiklik varsa güncelleyelim"],
  tahsilatEp: ["tahsilat", "vadesi geçmiş ödeme için kibar, saygılı hatırlatma; verilen tutarı ve vade tarihini aynen yaz; baskı/tehdit yok; ödendiyse dikkate almayın de"],
  tekrarEp: ["tekrar", "mevcut müşteriye: sipariş aralığına göre stoğu azalmış olabilir; geçen seferki ürünleri hazırlayalım mı diye sor"],
  numuneEp: ["numune", "bıraktığımız numune hakkında görüş iste; beğendiyse sipariş/teklif öner"],
  fiyatEp: ["fiyat", "hammadde maliyet artışı nedeniyle bir sonraki siparişten itibaren geçerli yeni birim fiyat bildirimi; verilen yeni fiyatları aynen yaz; nazik ve gerekçeli"],
  caprazEp: ["capraz", "mevcut müşteriye, aynı sektördeki müşterilerimizin de aldığı ama onun almadığı ürünü öner; bir sonraki siparişe eklemeyi ya da numuneyi teklif et"],
  uyuyanEp: ["uyuyan", "uzun süredir sipariş vermeyen eski müşteriyi geri kazan: özlediğimizi söyle, şu an ihtiyacını nereden karşıladığını sor, numune/özel teklif öner (fiyat uydurma)"] };
const TUR_AD = { tanitim: "tanıtım", takip: "takip", teklif: "teklif hatırlatma", tahsilat: "ödeme hatırlatma", tekrar: "sipariş hatırlatma", numune: "numune takibi", fiyat: "fiyat güncelleme", capraz: "ürün önerisi", uyuyan: "geri kazanım" };
if (gmailVar && EPT.length) {
  let nodemailer; try { nodemailer = (await import("nodemailer")).default; } catch (e) { log("nodemailer yok, gönderim atlandı"); }
  const mod = O.eposta === "acik" ? "acik" : "deneme";
  const sinir = mod === "acik" ? Math.max(0, +O.gunlukEposta || 20) : 3;
  const kalan = Math.max(0, sinir - (D.epN || 0));
  if (!kalan) for (const k of EPT) GSON[k] = { t: Date.now(), metin: `Günlük e-posta sınırı doldu (${sinir})` };
  if (!X.aiKey()) for (const k of EPT) GSON[k] = { t: Date.now(), metin: "Yapay zekâ anahtarı yok (Kurulum 1. adım)" };
  if (nodemailer && kalan > 0 && X.aiKey()) {
    const tp = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: GU, pass: GP } });
    const tg = +X.AJ().teklifGun || 3;
    const bulgu = new Map(); for (const f of l) if (f.id) { if (!bulgu.has(f.id)) bulgu.set(f.id, []); bulgu.get(f.id).push(f); }
    const roL = new Map(X.reorderList().map(o => [o.x.id, o])), slS = new Set(X.sleepers().map(o => o.x.id));
    const yakin = (gec, tur, gun) => gec.some(q => q.tur === tur && Date.now() - q.t < gun * 864e5);
    const hedef = [];
    for (const x of data) {
      if (!x.eposta || x.aramayin || x.izin === "Çıkış yaptı" || x.durum === "İlgilenmiyor" || X.isChain({ ad: x.firma })) continue;
      const gec = X.arr(x.epGonderim), son = gec[gec.length - 1], cevapVar = x.epCevap && (!son || x.epCevap.t > son.t);
      if (cevapVar) continue;
      if (O.eposta !== "acik" && x.epDeneme) continue; // deneme modunda her firmaya bir kez örnek
      if (son && Date.now() - son.t < 20 * 3600e3) continue; // firmaya günde en çok 1 e-posta
      const ekle = (k, p, ek) => { if (!EPT.includes(k) || ((GV[k].hedef === "secili" || (ISTEK && ISTEK.secili)) && !x.ajanSec)) return false; hedef.push({ x, k, tur: TURA[k][0], p, ...(ek || {}) }); return true; };
      const tk = X.arr(x.teklif).find(t => t.durum === "Beklemede" && t.tar && X.daysSince(t.tar) >= tg);
      if (tk && !gec.some(q => q.tur === "teklif" && q.no === tk.no) && Date.now() - sonGor(x) > tg * 864e5 && ekle("teklifEp", 9, { tk })) continue;
      const vd = X.vadeDurum(x); if (vd.tut > 0.5 && vd.enEski && vd.enEski.gec >= 3 && !yakin(gec, "tahsilat", 7) && ekle("tahsilatEp", 8, { vd })) continue;
      const ro = roL.get(x.id); if (ro && ro.kalan <= 3 && !yakin(gec, "tekrar", 20) && ekle("tekrarEp", 7, { ro })) continue;
      if (x.numune && x.numune.tar && X.daysSince(x.numune.tar) >= 5 && !X.arr(x.gorus).some(q => q.t > (x.numune.t || 0) + 36e5 && q.tip !== "Numune") && !yakin(gec, "numune", 60) && ekle("numuneEp", 6)) continue;
      const fb = (bulgu.get(x.id) || []).find(f => f.ag === "fiyat" && /fiyat güncellenmeli/.test(f.bas)); if (fb && !yakin(gec, "fiyat", 45) && ekle("fiyatEp", 5, { f: fb })) continue;
      const cb = (bulgu.get(x.id) || []).find(f => f.ag === "capraz"); if (cb && !yakin(gec, "capraz", 45) && ekle("caprazEp", 4, { f: cb })) continue;
      if (slS.has(x.id) && !yakin(gec, "uyuyan", 45) && ekle("uyuyanEp", 3)) continue;
      const tanSay = gec.filter(q => q.tur === "tanitim" || q.tur === "takip").length;
      if (x.durum === "İletişim kuruldu" && tanSay === 1 && son && son.tur === "tanitim" && Date.now() - son.t > (+O.takipEpostasiGun || 5) * 864e5 && Date.now() - sonGor(x) > 3 * 864e5 && ekle("takipEp", 2)) continue;
      if (x.durum === "Yeni" && !gec.length) ekle("tanitim", 1 + (x.aday || 0) / 100);
    }
    hedef.sort((a, b) => b.p - a.p);
    let gonderilen = 0, hata = 0; const say = {};
    for (const h of hedef.slice(0, kalan)) {
      const x = h.x;
      try {
        X.aiKodla();
        const s0 = X.arr(x.siparis).filter(X.sipAktif).sort((a, b) => (b.tar || "").localeCompare(a.tar || ""))[0];
        const bilgi = { amac: TURA[h.k][1], firma: { sektor: x.sektor || "", ilce: x.il || "", durum: x.durum, tahminiAylikKg: (() => { const t = X.TSEK.find(s => s.ad === x.sektor); return t ? X.tuk(t.k) : null; })() },
          teklif: h.tk ? { no: h.tk.no || "", tarih: X.fd(h.tk.tar), kalemler: X.anon(X.kalemOzet(h.tk, true)), tutar: TL(X.docAra(h.tk)) } : null,
          odeme: h.vd ? { tutar: TL(h.vd.tut), vadeTarihi: X.fd(h.vd.enEski.due), gecikmeGun: h.vd.enEski.gec } : null,
          sonSiparis: s0 && ["tekrar", "capraz", "uyuyan", "fiyat"].includes(h.tur) ? { tarih: X.fd(s0.tar), urunler: X.anon(X.kalemOzet(s0, true)) } : null,
          ajanBulgusu: h.f ? X.anon(h.f.bas + " — " + h.f.det) : null,
          firmamiz: `${FIRMA}: Silivri'de kendi fabrikasında atlet, rulo (manav), kasap/dürüm, HDPE/LDPE, el geçme/kulplu, baskılı ve baskısız poşet üreticisi; aracısız fabrika fiyatı, hızlı teslim` };
        const j = await (async (...q) => { /* cevap yarım gelirse (düşünen model token'ı bitirir) bir kez daha, daha geniş sınırla dene */
          for (let d = 0; d < 2; d++) { try { return JSON.parse(String(await X.aiSor(q[0], q[1], d ? { ...q[2], max: 4000, sicak: 0.5 } : q[2])).replace(/^```(?:json)?|```$/g, "").trim()); } catch (e) { if (d || !/JSON|Unterminated|Unexpected/i.test(e.message)) throw e; } } })(`Bir poşet üreticisi adına işletmeye gönderilecek e-postayı yaz. Amaç "amac" alanında. Türkçe, kısa (50-110 kelime), samimi ama profesyonel; tek net soru/teklif ile bitir.
Firma adı yerine {FIRMA} yaz (program doldurur). "Merhaba," ile başla; imza ve altbilgi YAZMA. Verilen tutar/tarih/fiyatları aynen kullan; verilmeyen fiyat, indirim, tarih UYDURMA.
SADECE JSON: {"konu":"en fazla 60 karakter, spam kelimesi yok","govde":"..."}`, [{ r: "ben", m: JSON.stringify(bilgi) }], { json: true, sicak: 0.7, max: 1500, toplu: true });
        const doldur = s => X.deanon(String(s || "")).replace(/\{FIRMA\}/g, x.firma).trim();
        let konu = doldur(j.konu).slice(0, 90), govde = doldur(j.govde);
        if (!konu || !govde) throw new Error("boş e-posta");
        if (x.yetkili && /^merhaba\s*,/i.test(govde)) govde = govde.replace(/^merhaba\s*,/i, "Merhaba " + x.yetkili + ",");
        govde += "\n\nSaygılarımızla," + altBilgi();
        const deneme = mod !== "acik";
        await tp.sendMail({ from: `"${FIRMA}" <${GU}>`, to: deneme ? GU : x.eposta, subject: deneme ? `[DENEME → ${x.firma} <${x.eposta}> • ${TUR_AD[h.tur]}] ${konu}` : konu, text: govde, headers: deneme ? {} : { "List-Unsubscribe": `<mailto:${GU}?subject=IPTAL>` } });
        gonderilen++; say[h.k] = (say[h.k] || 0) + 1; D.epN = (D.epN || 0) + 1;
        if (deneme) { x.epDeneme = BUGUN; await guncelle(x, { epDeneme: BUGUN }).catch(() => { }); }
        else {
          const gec = [...X.arr(x.epGonderim), { t: Date.now(), tur: h.tur, konu, ...(h.tk ? { no: h.tk.no || "" } : {}) }].slice(-15);
          const ch = { epGonderim: gec, gorus: gorusEkle(x, "E-posta", `🤖 Ajan ${TUR_AD[h.tur]} e-postası gönderdi: ${konu}`), sonraki: X.plus({ teklif: 2, tahsilat: 3, tekrar: 3, numune: 3 }[h.tur] || 5) };
          if (x.durum === "Yeni") ch.durum = "İletişim kuruldu";
          await guncelle(x, ch).catch(() => { });
        }
      } catch (e) { hata++; log("e-posta gönderilemedi:", e.message); if (/auth|credential|Username and Password|535/i.test(e.message)) { not_("⚠", "Gmail ile gönderilemedi: uygulama şifresini kontrol et"); for (const k of EPT) GSON[k] = { t: Date.now(), metin: "Gmail'e girilemedi: uygulama şifresini kontrol et" }; break; } if (/kota|429/i.test(e.message)) break; }
    }
    for (const k of EPT) if (say[k]) GSON[k] = { t: Date.now(), metin: `${say[k]} ${mod === "acik" ? "firmaya" : "deneme"} e-posta gönderdi` };
    if (gonderilen) not_("📧", mod === "acik" ? `${gonderilen} firmaya e-postayı kendisi gönderdi (${Object.entries(say).map(([k, n]) => TUR_AD[TURA[k][0]] + " " + n).join(", ")})` : `DENEME modu: ${gonderilen} örnek e-postayı sana (${GU}) gönderdi — beğenirsen Kurulum'da "Açık" yap`);
    log("E-posta gönderimi:", gonderilen, mod, hata ? "• hata: " + hata : "");
  }
}

/* ---------- 📤 Müdür'ün verdiği e-postalar (programda ✅ Yap denenler) ---------- */
if (calis("kuyruk")) {
  const KQ = (await okuG("ajan/kuyruk")) || {}, ids = Object.keys(KQ);
  if (ids.length && !gmailVar) GSON.kuyruk = { t: Date.now(), metin: `Sırada ${ids.length} e-posta var ama Gmail bağlı değil (Kurulum 7b)` };
  else if (ids.length) {
    let nm; try { nm = (await import("nodemailer")).default; } catch (e) { log("nodemailer yok, kuyruk atlandı"); }
    if (nm) {
      const tp = nm.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: GU, pass: GP } });
      const deneme = O.eposta !== "acik"; let n = 0, h = 0, atl = 0;
      for (const id of ids) {
        const q = KQ[id] || {}, x = q.firmaId ? data.find(v => v.id === q.firmaId) : null, to = q.to || (x && x.eposta);
        if (!to || (x && (x.aramayin || x.izin === "Çıkış yaptı"))) { atl++; await yaz("ajan/kuyruk/" + id, g.tok, null).catch(() => { }); continue; }
        const govde = String(q.metin || "").trim() + "\n\nSaygılarımızla," + (q.ted ? `\n${FIRMA}${F.tel ? "\nTel: " + F.tel : ""}` : altBilgi());
        try {
          await tp.sendMail({ from: `"${FIRMA}" <${GU}>`, to: deneme ? GU : to, subject: deneme ? `[DENEME → ${x ? x.firma : "tedarikçi"} <${to}> • Müdür'ün işi] ${q.konu || ""}` : (q.konu || FIRMA), text: govde });
          n++; await yaz("ajan/kuyruk/" + id, g.tok, null).catch(() => { });
          if (x) await guncelle(x, { gorus: gorusEkle(x, "E-posta", (deneme ? "[DENEME] " : "") + "👔 Müdür'ün işi: " + (q.konu || "")), epGonderim: [...X.arr(x.epGonderim), { t: Date.now(), tur: "mudur", konu: q.konu || "", deneme }].slice(-20) }).catch(() => { });
        } catch (e) { h++; }
      }
      if (n) not_("📧", (deneme ? "DENEME modu: " : "") + `Müdür'ün verdiği ${n} e-postayı ${deneme ? "örnek olarak sana gönderdi" : "gönderdi"}`, "kuyruk");
      else if (h) GSON.kuyruk = { t: Date.now(), metin: `${h} e-posta gönderilemedi (Gmail şifresi?)` };
      log("Kuyruk:", n, "gönderildi", h ? "• hata " + h : "", atl ? "• atlandı " + atl : "");
    }
  }
}
if (calis("hatirlat")) {
  const T = (await okuG("ajan/takvim")) || {}, s = new Date(), hh = String(s.getHours()).padStart(2, "0") + ":" + String(s.getMinutes()).padStart(2, "0"); let n = 0;
  for (const [id, h] of Object.entries(T)) {
    if (!h || h.bitti || h.bildirildi) continue;
    if (h.tarih < BUGUN || (h.tarih === BUGUN && (h.saat || "09:00") <= hh)) { const x = h.firmaId && data.find(v => v.id === h.firmaId); SICAK.push("⏰ " + (x ? x.firma + ": " : "") + h.metin); n++; await yaz("ajan/takvim/" + id + "/bildirildi", g.tok, Date.now()).catch(() => { }); }
  }
  if (n) GSON.hatirlat = { t: Date.now(), metin: `${n} hatırlatma telefona gönderildi` };
}

/* ---------- 🗺 Bugünün ziyaret rotası ---------- */
if (calis("rota")) {
  const M = O.merkez && isFinite(+O.merkez.lat) ? { lat: +O.merkez.lat, lon: +O.merkez.lon } : null;
  const ad = data.filter(x => x.konum && isFinite(x.konum.lat) && !x.aramayin && x.durum !== "İlgilenmiyor" && ((x.sonraki && x.sonraki <= BUGUN) || (x.oncelik === "Sıcak" && ["Yeni", "İletişim kuruldu", "İlgileniyor"].includes(x.durum)) || (x.epCevap && Date.now() - x.epCevap.t < 3 * 864e5)));
  if (M && ad.length) {
    const sira = []; let c = M; const k = [...ad];
    while (k.length && sira.length < 10) { k.sort((a, b) => X.hav(c.lat, c.lon, a.konum.lat, a.konum.lon) - X.hav(c.lat, c.lon, b.konum.lat, b.konum.lon)); const n = k.shift(); sira.push(n); c = n.konum; }
    const url = "https://www.google.com/maps/dir/" + [M, ...sira.map(x => x.konum)].map(p => p.lat + "," + p.lon).join("/");
    await yaz("ajan/rota", g.tok, { t: Date.now(), tarih: BUGUN, url, firmalar: sira.map(x => ({ id: x.id, firma: x.firma })) }).catch(() => { });
    not_("🗺", `Bugünün ziyaret rotasını hazırladı: ${sira.length} firma (${sira.slice(0, 3).map(x => x.firma).join(", ")}${sira.length > 3 ? "…" : ""})`, "rota");
  } else GSON.rota = { t: Date.now(), metin: M ? "Bugün ziyaret edilecek konumlu firma yok" : "Fabrika konumu seçilmemiş" };
}

/* ---------- 📅 8) Haftalık strateji ---------- */
if (calis("haftalik")) {
  let hafta = await okuG("ajan/rapor/hafta");
  if (X.aiKey() && ((SECILI && SECILI.has("haftalik")) || new Date().getDay() === 1 || !hafta || Date.now() - (hafta.t || 0) > 6.5 * 864e5)) {
    try {
      X.aiKodla();
      const gun7 = Date.now() - 7 * 864e5, sek = {}, kayip = {}, h = { yeniKayit: 0, gorusme: 0, teklif: 0, siparis: 0, siparisTutar: 0, tahsilat: 0, yeniMusteri: 0, ajanEpostasi: 0, epostaCevabi: 0 };
      for (const x of data) {
        const k = x.sektor || "?"; const o = sek[k] = sek[k] || { kayit: 0, gorusulen: 0, teklifVerilen: 0, musteri: 0, ciro: 0 };
        o.kayit++; if (X.arr(x.gorus).length || x.durum !== "Yeni") o.gorusulen++; if (X.arr(x.teklif).length) o.teklifVerilen++; if (x.durum === "Müşteri") { o.musteri++; o.ciro += Math.round(X.ciro(x)); }
        if (x.kayip) kayip[x.kayip] = (kayip[x.kayip] || 0) + 1;
        if ((x.c || 0) > gun7) h.yeniKayit++; if ((x.mt || 0) > gun7) h.yeniMusteri++;
        h.gorusme += X.arr(x.gorus).filter(q => (q.t || 0) > gun7).length;
        h.teklif += X.arr(x.teklif).filter(q => q.tar && X.daysSince(q.tar) < 7).length;
        for (const q of X.arr(x.siparis)) if (q.tar && X.daysSince(q.tar) < 7 && X.sipAktif(q)) { h.siparis++; h.siparisTutar += Math.round(X.docTop(q)); }
        h.tahsilat += X.arr(x.odeme).filter(q => q.tar && X.daysSince(q.tar) < 7).reduce((a, q) => a + (+q.tutar || 0), 0);
        h.ajanEpostasi += X.arr(x.epGonderim).filter(q => q.t > gun7).length; if (x.epCevap && x.epCevap.t > gun7) h.epostaCevabi++;
      }
      const m = X.deanon(await X.aiSor(X.AISYS(), [{ r: "ben", m: "HAFTALIK STRATEJİ RAPORU yaz. Ek veri: " + JSON.stringify({ gecenHafta: h, sektorPerformansi: sek, kayipSebepleri: kayip }) +
        "\nBaşlıklar: **Geçen hafta** (2-3 madde, rakamla) • **Para nerede** (hangi sektör/müşteri kazandırıyor, hangisi boşa emek) • **Bu hafta 5 hedef** (ölçülebilir) • **Fiyat** (zam/indirim önerisi) • **Ajanlara ayar önerisi** (tarama yarıçapı, sektör, e-posta sayısı) • **Uyarı**. En fazla 22 satır." }], { max: 4000 }));
      await yaz("ajan/rapor/hafta", g.tok, { t: Date.now(), metin: m });
      not_("📅", "Haftalık strateji raporunu yazdı", "haftalik"); log("Haftalık strateji yazıldı");
    } catch (e) { log("Haftalık strateji atlandı:", e.message); }
  }
}

/* ---------- 🛡 Risk analisti (Google araması, ücretsiz katman) ---------- */
if (calis("risk")) {
  if (!X.aiKey()) GSON.risk = { t: Date.now(), metin: "Yapay zekâ anahtarı yok (Kurulum 1)" };
  else {
    const lim = Math.max(0, Math.min(10, +O.riskGunluk || 4)); let n = 0, riskli = 0, rHata = "";
    const ozel = ISTEK && Array.isArray(ISTEK.riskIds) ? new Set(ISTEK.riskIds) : null; // programdan "bu firmayı araştır"
    const aday = ozel ? data.filter(x => ozel.has(x.id)).slice(0, 10) : data.filter(x => !x.aramayin && ["Teklif verildi", "İlgileniyor", "Müşteri"].includes(x.durum) && (!x.risk || x.risk.v !== 2 || Date.now() - (x.risk.t || 0) > 90 * 864e5))
      .sort((a, b) => (a.risk ? 1 : 0) - (b.risk ? 1 : 0) || X.bakiye(b) - X.bakiye(a)).slice(0, lim);
    for (const x of aday) {
      if (dakika() > 12) { rHata = rHata || "süre bitti, kalanı sonraki turda"; break; }
      try { const r = await X.riskAnaliz(x); await guncelle(x, { risk: r }); n++; if (r.seviye === "risk") { riskli++; SICAK.push("🛡 " + x.firma + ": " + r.karar); } }
      catch (e) { log("Risk analizi atlandı"); rHata = e.message; if (/429|kota|sınır/i.test(e.message)) break; }
    }
    if (!n && rHata) GSON.risk = { t: Date.now(), metin: "⚠ Araştırma yapılamadı: " + String(rHata).slice(0, 140) };
    if (n) not_("🛡", `${n} firmanın ödeme güvenini araştırdı${riskli ? `, ${riskli} tanesi riskli çıktı` : ", hepsi makul"}`, "risk");
    log("Risk analizi:", n, "firma", riskli ? "• riskli " + riskli : "");
  }
}
/* ---------- 🎪 Fırsat avcısı + 🎨 içerik (haftada bir) ---------- */
for (const [k, yol, fn, ik, yazi] of [["firsat", "ajan/firsat", () => X.firsatAra(), "🎪", r => `${r.l.length} fırsat buldu (yeni açılış, ihale, fuar, etkinlik)`], ["icerik", "ajan/icerik", () => X.icerikPlani(""), "🎨", r => `Bu haftanın ${r.l.length} sosyal medya paylaşımını yazdı`]]) {
  if (!calis(k) || !X.aiKey()) continue;
  if (dakika() > 15) { GSON[k] = { t: Date.now(), metin: "Süre yetmedi, sonraki turda yapılacak" }; continue; }
  const eski = await okuG(yol);
  if (!(SECILI && SECILI.has(k)) && eski && Date.now() - (eski.t || 0) < 6.5 * 864e5) continue;
  try { const r = await fn(); await yaz(yol, g.tok, r); not_(ik, yazi(r), k); log(k, "yazıldı"); } catch (e) { log(k, "atlandı:", String(e.message).slice(0, 60)); GSON[k] = { t: Date.now(), metin: "⚠ Yapılamadı: " + String(e.message).slice(0, 140) }; }
}

/* ---------- 📒 9) Ajan günlüğü + durum ---------- */
if (!elle ? sabahTuru : !SECILI) D.sabah = BUGUN;
for (const k of RAN) if (!GSON[k]) GSON[k] = { t: Date.now(), metin: "Çalıştı — yapacak iş yoktu" };
if (Object.keys(GSON).length) await yaz("ajan/gorevSon", g.tok, GSON, "PATCH").catch(() => { });
await durumYaz();
if (GUN.length) await yaz("ajan/gunluk/" + BUGUN, g.tok, { t: Date.now(), isler: GUN.slice(-60) }).catch(e => log("günlük yazılamadı:", e.message));
// 30 günden eski günlükleri sil
try { const gk = (await okuG("ajan/gunluk")) || {}; for (const k of Object.keys(gk)) if (X.daysSince(k) > 30) await yaz("ajan/gunluk/" + k, g.tok, null).catch(() => { }); } catch (e) { }

/* ---------- 🔔 10) Bildirim ---------- */
OZET = GUN.slice(GUN0).map(q => q.ik + " " + q.metin).join("\n").slice(0, 1500);
if (!calis("bildirim")) { log("Bildirim görevi bu turda kapalı"); bitir(); }
const priv = env("VAPID_PRIVATE") || String(GIZLI.vapidPriv || ""), pub = ayar.vapidPub;
const ozetSatir = () => {
  const al = ik => GUN.filter(q => q.ik === ik && q.t > Date.now() - 3 * 3600e3).length;
  const parcalar = [];
  for (const q of GUN.filter(q => q.t > Date.now() - 3 * 3600e3 && q.ik !== "⚠")) { const m = q.metin.match(/(\d+) (yeni müşteri adayı|iş için|firmaya e-postayı|e-posta cevabı|kaydın takip)/); if (m) parcalar.push({ "yeni müşteri adayı": m[1] + " yeni aday", "iş için": m[1] + " mesaj hazır", "firmaya e-postayı": m[1] + " e-posta gitti", "e-posta cevabı": m[1] + " cevap", "kaydın takip": m[1] + " takip ayarı" }[m[2]]); }
  return parcalar.join(" • ");
};
if (!priv || !pub) { log("Bildirim atlandı: " + (!pub ? "programda bildirim anahtarı üretilmemiş (Kurulum 4. adım)" : "bildirim gizli anahtarı yok (Kurulum 4. adımda yeniden üret)")); bitir(); }
let webpush; try { webpush = (await import("web-push")).default; } catch (e) { log("web-push paketi yok, bildirim atlandı"); bitir(); }
try { webpush.setVapidDetails("mailto:info@magambalaj.com", pub, priv); } catch (e) { dur("VAPID_PRIVATE hatalı: programdaki 4. adımda üretilen gizli anahtarı aynen yapıştır (" + e.message + ")"); }
const bildirimler = [];
if (sabahTuru || elle) { const oz = ozetSatir(), ilk = l.find(f => f.sev !== "bilgi"); bildirimler.push({ title: "🤖 Ajanlar gece çalıştı", body: `${oz ? oz + "\n" : ""}Bugün ${l.length} iş${acil ? " (" + acil + " acil)" : ""}${ilk ? " • önce: " + ilk.bas : ""}`.slice(0, 230), url: "./?git=akis" }); }
for (const s of SICAK.slice(0, 6)) bildirimler.push({ title: s.startsWith("⏰") ? "⏰ Hatırlatma" : s.startsWith("🛡") ? "🛡 Ödeme riski" : "🔥 Sıcak gelişme", body: s.replace(/^(⏰|🛡) /, ""), url: "./?git=akis" });
if (!bildirimler.length) { log("Gönderilecek bildirim yok"); bitir(); }
let abone = (await okuG("ajan/abone")) || {};
const yonetici = uid => uid === ayar.ownerUid || (users && users[uid] && users[uid].rol === "admin");
let gonderildi = 0, silindi = 0, hata = 0;
for (const [uid, cihazlar] of Object.entries(abone)) {
  if (!yonetici(uid)) continue;
  for (const [id, a] of Object.entries(cihazlar || {})) {
    for (const b of bildirimler) {
      try { await webpush.sendNotification(a.sub, JSON.stringify(b), { TTL: 6 * 3600 }); gonderildi++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { try { await yaz("ajan/abone/" + uid + "/" + id, g.tok, null); silindi++; } catch (x) { } break; } else hata++; }
    }
  }
}
log("Bildirim gönderildi:", gonderildi, silindi ? "• eskimiş abonelik silindi: " + silindi : "", hata ? "• hata: " + hata : "");
bitir();
