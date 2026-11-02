// MAG Pazar — 🌙 Gece ajanı (GitHub Actions, ücretsiz)
// Her sabah buluttaki kayıtları okur, programdaki AYNI ajan kurallarını çalıştırır (index.html'den okunur),
// Müdür raporunu buluta yazar ve yöneticilerin telefonuna bildirim gönderir.
// DİKKAT: Depo herkese açık olduğu için bu betik müşteri bilgisini ASLA ekrana (log'a) yazmaz.
import fs from "node:fs";
import vm from "node:vm";
import zlib from "node:zlib";
import crypto from "node:crypto";

const env = k => (process.env[k] || "").trim();
const log = (...a) => console.log("•", ...a);
const dur = (m, kod = 1) => { console.log("\n❌ " + m); process.exit(kod); };

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
  "toDoc", "calc", "docTop", "docAra", "sipAktif", "ciro", "odenen", "bakiye", "lastBuy", "kalemOzet", "TUK_DEF", "tuk", "oner", "hamL", "TSEK", "sleepers", "reorderList", "EPRE", "epCikar", "hav", "ZINCIR", "zRe", "isChain", "isMobile", "isRival", "adayPuan", "normF", "tel10", "uid_", "bolgeler", "bolgeOf", "VERI_DEF"];
const goruldu = new Set(), kodlar = [];
for (const ad of YARDIMCI) { const p = parca(ad); if (!goruldu.has(p.i)) { goruldu.add(p.i); kodlar.push([p.i, p.kod]); } }
kodlar.sort((a, b) => a[0] - b[0]);
const CEKIRDEK = blok("/* ================= v11 — 🤖 AJAN MERKEZİ", "/* --- ekran --- */");
let AI = blok("/* ================= v12 — 🧠 YAPAY ZEKÂ BEYNİ", "/* --- 💬 Müdürle konuş --- */") + "\n" + blok("/* --- ✨ firmaya özel mesaj --- */", "let aiYaziyor");
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
let prof = null; try { prof = await oku("users/" + g.uid, g.tok); } catch (e) { }
if (!prof) {
  try { await yaz("users/" + g.uid, g.tok, { email: env("FB_EMAIL"), ad: "🤖 Ajan", rol: "beklemede", t: Date.now() }); } catch (e) { }
  dur("Ajan hesabı açıldı ve onay bekliyor.\n   ŞİMDİ: Programda Diğer → 🛡 Yönetim → \"🤖 Ajan\" → rolünü YÖNETİCİ yap, sonra bu görevi bir kez daha çalıştır (Run workflow).");
}
if (prof.rol !== "admin") dur("Ajan hesabının rolü \"" + prof.rol + "\". Programda Diğer → 🛡 Yönetim → \"" + (prof.ad || "🤖 Ajan") + "\" → rolünü YÖNETİCİ yap, sonra tekrar çalıştır.");

let leads, ayar, katalog, users;
try { [leads, ayar, katalog, users] = await Promise.all(["leads", "ayar", "katalog", "users"].map(p => oku(p, g.tok))); }
catch (e) { dur("Bulut okunamadı: " + e.message + ". Firebase kuralı güncel mi? (Programda ☁ → Kuralı kopyala → Firebase Rules → Publish)"); }
const data = Object.entries(leads || {}).map(([k, v]) => ({ ...v, id: v.id || k })).filter(x => x && x.firma);
ayar = ayar || {}; if (env("GEMINI_KEY")) ayar.aiKey = env("GEMINI_KEY"); else delete ayar.aiKey;
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
globalThis.__api={ajCalistir,ajRapor,ajMasada,AJAD,aiSor,AISYS,deanon,aiKey,epCikar,anon,aiKodla,ciro,bakiye,sipAktif,docTop,daysSince,today,plus,fmt,fd,arr,reorderList,sleepers,vadeDurum,aiMesajYaz,ajKey,hav,isChain,isRival,isMobile,adayPuan,normF,tel10,uid_,bolgeOf,VERI_DEF,TSEK,tuk,kodOf,selam,imza,kalemOzet,docAra,AJ,setR:r=>{tara.r=r}};`;
Object.assign(ctx, { bellek, __ayar: ayar, __data: data, __katalog: katalog || [], __users: users || {} });
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
const ilkCalisma = D.tarih !== BUGUN || env("TAM") === "1";
if (D.tarih !== BUGUN) D = { tarih: BUGUN, epN: 0, taramaR: D.taramaR || 0, sonGelen: D.sonGelen || 0 };
const GUN = ((await okuG("ajan/gunluk/" + BUGUN)) || {}).isler || [];
const not_ = (ik, metin) => { GUN.push({ ik, metin, t: Date.now() }); };
const SICAK = []; // hemen bildirilecek sıcak gelişmeler
const durumYaz = () => yaz("ajan/durum", g.tok, D).catch(e => log("durum yazılamadı:", e.message));
async function guncelle(x, alan) {
  x.u = Date.now(); Object.assign(x, alan);
  await yaz("leads/" + x.id, g.tok, { ...alan, u: x.u }, "PATCH");
}
const sonGor = x => X.arr(x.gorus).reduce((m, q) => Math.max(m, +q.t || 0), 0);
const gorusEkle = (x, tip, not) => { const l = X.arr(x.gorus); l.push({ t: Date.now(), tip, not, kim: "🤖 Ajan" }); return l; };
log(ilkCalisma ? "Günün ilk çalışması (tam tur)" : "Gün içi tur (gelen kutusu + e-posta)");

/* ---------- 🔄 1) Takibi kendisi ayarlar ---------- */
if (ilkCalisma) {
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
  if (n) not_("🔄", `${n} kaydın takip tarihini ve önceliğini kendisi ayarladı`);
  log("Takip ayarı:", n, "kayıt");
}

/* ---------- 🎯 2) Yeni müşteri adaylarını kendisi bulur (kendi verimizden) ---------- */
if (ilkCalisma && O.tarama !== false) {
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
    not_("🎯", n ? `${R} km içinde ${aday.length} işletmeye baktı, ${n} yeni müşteri adayı buldu ve listeye ekledi (en iyiler: ${sec.slice(0, 3).map(o => o.p.ad).join(", ")})` : `${R} km içinde yeni aday kalmadı${D.taramaR > R ? "; yarın " + D.taramaR + " km'ye genişleyecek" : ""}`);
    log("Otomatik tarama:", R, "km •", aday.length, "işletme •", n, "yeni aday eklendi");
  } catch (e) { log("Otomatik tarama hatası:", e.message); not_("⚠", "Otomatik tarama bu gece yapılamadı: " + e.message); }
}

/* ---------- ✉ 3) Web sitelerinden e-posta bulur ---------- */
if (ilkCalisma) {
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
  if (bulunan) not_("✉", `${aday.length} firmanın web sitesine girdi, ${bulunan} e-posta adresi buldu`);
  if (aday.length) log("E-posta avcısı:", aday.length, "site •", bulunan, "bulundu");
}

/* ---------- 📧 Gmail bağlantısı (isteğe bağlı) ---------- */
const GU = env("GMAIL_USER"), GP = env("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
const gmailVar = !!(GU && GP) && O.eposta !== "kapali";
const F = ayar.firma || {}, FIRMA = F.ad || "MAG AMBALAJ";
const enc = s => "=?UTF-8?B?" + Buffer.from(String(s)).toString("base64") + "?=";
const altBilgi = () => `\n\n—\n${FIRMA}${F.adr ? "\n" + F.adr : ""}${F.tel ? "\nTel: " + F.tel : ""}${F.web ? " • " + F.web : ""}\nBu e-postaları almak istemiyorsanız "İPTAL" yazarak yanıtlamanız yeterli.`;
const epMap = new Map(); for (const x of data) if (x.eposta) epMap.set(String(x.eposta).toLowerCase().trim(), x);
const GENEL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|yandex|icloud|msn|mynet|windowslive)\./i;
const kimin = adr => { adr = String(adr || "").toLowerCase(); if (epMap.has(adr)) return epMap.get(adr); const d = adr.split("@")[1] || ""; if (!d || GENEL.test(d)) return null; for (const [e, x] of epMap) if (e.endsWith("@" + d)) return x; return null; };

/* ---------- 📨 4) Gelen cevapları okur, sınıflar, Gmail'de cevap taslağı hazırlar ---------- */
if (gmailVar) {
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
      for (const m of gelen) {
        const kimden = m.envelope && m.envelope.from && m.envelope.from[0] && m.envelope.from[0].address; const x = kimin(kimden); if (!x) continue;
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
SADECE JSON: {"tur":"ilgileniyor"|"soru"|"iptal"|"olumsuz"|"otomatik","ozet":"tek cümle","cevap":"müşteriye yanıt metni (selam ve imza dahil değil; fiyat/teslim uydurma, bilmediğini 'bugün sizi arayacağız' diye geçiştir) ya da boş"}`,
              [{ r: "ben", m: JSON.stringify({ firmaKodu: X.kodOf(x), sektor: x.sektor || "", gelenMesaj: X.anon(metin) }) }], { json: true, sicak: 0.3, max: 1500 })).replace(/^```(?:json)?|```$/g, ""));
            if (["ilgileniyor", "soru", "iptal", "olumsuz", "otomatik"].includes(j.tur)) tur = j.tur; ozet = X.deanon(j.ozet || ozet); cevap = X.deanon(j.cevap || "");
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
    } catch (e) { log("Gmail gelen kutusu hatası:", e.message); if (/auth|credential|password|Invalid/i.test(e.message)) not_("⚠", "Gmail'e girilemedi: uygulama şifresini kontrol et (GMAIL_APP_PASSWORD)"); }
    finally { try { await cl.logout(); } catch (e) { } }
    if (okunan) not_("📨", `${okunan} e-posta cevabı okudu (ilgilenen ${sinif.ilgileniyor || 0}, soru ${sinif.soru || 0}, iptal ${sinif.iptal || 0}, olumsuz ${sinif.olumsuz || 0})${taslak ? `; ${taslak} cevap taslağını Gmail'de Taslaklar'a hazırladı` : ""}`);
    log("Gelen kutusu:", okunan, "cevap •", taslak, "taslak");
  }
}

/* ---------- 📋 5) Ajanlar + Müdür raporu (günün ilk turu) ---------- */
const l = X.ajCalistir();
const metin = X.ajRapor(l);
const masada = X.ajMasada(l).reduce((a, z) => a + z[1], 0);
const acil = l.filter(f => f.sev === "kritik").length, onemli = l.filter(f => f.sev === "onemli").length;
log("Bulunan iş:", l.length, "• acil:", acil, "• önemli:", onemli);
const TL = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: ayar.para || "TRY", maximumFractionDigits: 0 }).format(n || 0);

if (ilkCalisma) {
  let yorum = "";
  if (X.aiKey()) {
    try { yorum = X.deanon(await X.aiSor(X.AISYS(), [{ r: "ben", m: "Bugünün planını çıkar: öncelik sırasıyla en fazla 6 madde (kim/kod, ne yapılacak, neden, ₺ etkisi). Sonunda tek cümle genel değerlendirme." }])); log("Müdür yorumu yazıldı"); }
    catch (e) { log("Yapay zekâ yorumu atlandı:", e.message); }
  }
  const rapor = { t: Date.now(), tarih: BUGUN, metin, yorum, sayi: l.length, acil, onemli, masada: Math.round(masada) };
  try { await yaz("ajan/rapor/son", g.tok, rapor); log("Rapor buluta yazıldı"); }
  catch (e) { dur("Rapor buluta yazılamadı (" + e.message + "). Firebase kuralını güncelle: programda ☁ → Kuralı kopyala → Firebase Rules → Publish."); }
  not_("📋", `Müdür raporunu hazırladı: ${l.length} iş${acil ? ", " + acil + " acil" : ""}${masada >= 1 ? ", masada ≈ " + TL(masada) : ""}`);

  /* ---------- ✍ 6) Her iş için mesajı hazır yazar ---------- */
  if (X.aiKey()) {
    const isler = l.filter(f => f.msg && f.id).sort((a, b) => (a.sev === "bilgi") - (b.sev === "bilgi")).slice(0, Math.max(0, +O.taslakSayisi || 12));
    const ts = {}; let n = 0;
    for (const f of isler) {
      try { const m = await X.aiMesajYaz(f, true); if (m) { ts[crypto.createHash("sha1").update(X.ajKey(f)).digest("hex").slice(0, 20)] = { k: X.ajKey(f), m, d: BUGUN }; n++; } }
      catch (e) { log("mesaj yazılamadı:", e.message); if (/kota|429|sınır/i.test(e.message)) break; }
    }
    if (n) { await yaz("ajan/taslak", g.tok, ts).catch(e => log("taslaklar yazılamadı:", e.message)); not_("✍", `${n} iş için firmaya özel mesajı hazır yazdı — sabah sadece "Gönder"e basman yeterli`); }
    log("Hazır mesaj:", n);
  }
}

/* ---------- 📧 7) E-postayı kendisi gönderir (tanıtım + takip + teklif hatırlatma) ---------- */
if (gmailVar) {
  let nodemailer; try { nodemailer = (await import("nodemailer")).default; } catch (e) { log("nodemailer yok, gönderim atlandı"); }
  const mod = O.eposta === "acik" ? "acik" : "deneme";
  const sinir = mod === "acik" ? Math.max(0, +O.gunlukEposta || 20) : 3;
  const kalan = Math.max(0, sinir - (D.epN || 0));
  if (nodemailer && kalan > 0 && X.aiKey()) {
    const tp = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: GU, pass: GP } });
    const tg = +X.AJ().teklifGun || 3;
    const hedef = [];
    for (const x of data) {
      if (!x.eposta || x.aramayin || x.izin === "Çıkış yaptı" || x.durum === "İlgilenmiyor" || X.isChain({ ad: x.firma })) continue;
      const gec = X.arr(x.epGonderim), son = gec[gec.length - 1], cevapVar = x.epCevap && (!son || x.epCevap.t > son.t);
      if (cevapVar) continue;
      if (O.eposta !== "acik" && x.epDeneme) continue; // deneme modunda her firmaya bir kez örnek
      const tk = X.arr(x.teklif).find(t => t.durum === "Beklemede" && t.tar && X.daysSince(t.tar) >= tg);
      if (tk && !gec.some(q => q.tur === "teklif" && q.no === tk.no) && Date.now() - sonGor(x) > tg * 864e5) hedef.push({ x, tur: "teklif", tk, p: 3 });
      else if (x.durum === "Yeni" && !gec.length) hedef.push({ x, tur: "tanitim", p: 1 + (x.aday || 0) / 100 });
      else if (x.durum === "İletişim kuruldu" && gec.length === 1 && son.tur === "tanitim" && Date.now() - son.t > (+O.takipEpostasiGun || 5) * 864e5 && Date.now() - sonGor(x) > 3 * 864e5) hedef.push({ x, tur: "takip", p: 2 });
    }
    hedef.sort((a, b) => b.p - a.p);
    let gonderilen = 0, hata = 0;
    for (const h of hedef.slice(0, kalan)) {
      const x = h.x;
      try {
        X.aiKodla();
        const bilgi = { tur: { tanitim: "ilk tanıtım e-postası", takip: "cevapsız tanıtımdan sonra kısa, nazik ikinci e-posta", teklif: "verdiğimiz teklifin hatırlatması" }[h.tur], firma: { sektor: x.sektor || "", ilce: x.il || "", tahminiAylikKg: (() => { const t = X.TSEK.find(s => s.ad === x.sektor); return t ? X.tuk(t.k) : null; })() },
          teklif: h.tk ? { no: h.tk.no || "", tarih: X.fd(h.tk.tar), kalemler: X.anon(X.kalemOzet(h.tk, true)), tutar: Math.round(X.docAra(h.tk)) } : null,
          firmamiz: `${FIRMA}: Silivri'de kendi fabrikasında atlet, rulo (manav), kasap/dürüm, HDPE/LDPE, el geçme/kulplu, baskılı ve baskısız poşet üreticisi; aracısız fabrika fiyatı, hızlı teslim` };
        const j = JSON.parse(String(await X.aiSor(`Bir poşet üreticisi adına işletmeye gönderilecek e-postayı yaz. Türkçe, kısa (60-110 kelime), samimi ama profesyonel; tek net teklif/soru ile bitir (ör. "numune bırakalım mı?").
Firma adı yerine {FIRMA} yaz (program doldurur). Selamlama ("Merhaba,") ile başla; imza ve altbilgi YAZMA. Fiyat, indirim, tarih UYDURMA.
SADECE JSON: {"konu":"en fazla 60 karakter, spam kelimesi yok","govde":"..."}`, [{ r: "ben", m: JSON.stringify(bilgi) }], { json: true, sicak: 0.7, max: 1500, toplu: true })).replace(/^```(?:json)?|```$/g, ""));
        const doldur = s => X.deanon(String(s || "")).replace(/\{FIRMA\}/g, x.firma).trim();
        let konu = doldur(j.konu).slice(0, 90), govde = doldur(j.govde);
        if (!konu || !govde) throw new Error("boş e-posta");
        if (x.yetkili && /^merhaba\s*,/i.test(govde)) govde = govde.replace(/^merhaba\s*,/i, "Merhaba " + x.yetkili + ",");
        govde += "\n\nSaygılarımızla," + altBilgi();
        const deneme = mod !== "acik";
        await tp.sendMail({ from: `"${FIRMA}" <${GU}>`, to: deneme ? GU : x.eposta, subject: deneme ? `[DENEME → ${x.firma} <${x.eposta}>] ${konu}` : konu, text: govde, headers: deneme ? {} : { "List-Unsubscribe": `<mailto:${GU}?subject=IPTAL>` } });
        gonderilen++; D.epN = (D.epN || 0) + 1;
        if (deneme) { x.epDeneme = BUGUN; await guncelle(x, { epDeneme: BUGUN }).catch(() => { }); }
        if (!deneme) {
          const gec = [...X.arr(x.epGonderim), { t: Date.now(), tur: h.tur, konu, ...(h.tk ? { no: h.tk.no || "" } : {}) }].slice(-10);
          const ch = { epGonderim: gec, gorus: gorusEkle(x, "E-posta", `🤖 Ajan ${h.tur === "tanitim" ? "tanıtım" : h.tur === "takip" ? "takip" : "teklif hatırlatma"} e-postası gönderdi: ${konu}`), sonraki: X.plus(h.tur === "teklif" ? 2 : 5) };
          if (x.durum === "Yeni") ch.durum = "İletişim kuruldu";
          await guncelle(x, ch).catch(() => { });
        }
      } catch (e) { hata++; log("e-posta gönderilemedi:", e.message); if (/auth|credential|Username and Password|535/i.test(e.message)) { not_("⚠", "Gmail ile gönderilemedi: uygulama şifresini kontrol et"); break; } if (/kota|429/i.test(e.message)) break; }
    }
    if (gonderilen) not_("📧", mod === "acik" ? `${gonderilen} firmaya e-postayı kendisi gönderdi (tanıtım/takip/teklif hatırlatma)` : `DENEME modu: ${gonderilen} örnek e-postayı sana (${GU}) gönderdi — beğenirsen Kurulum'da "Açık" yap`);
    log("E-posta gönderimi:", gonderilen, mod, hata ? "• hata: " + hata : "");
  }
}

/* ---------- 📅 8) Haftalık strateji ---------- */
if (ilkCalisma) {
  let hafta = await okuG("ajan/rapor/hafta");
  if (X.aiKey() && (new Date().getDay() === 1 || !hafta || Date.now() - (hafta.t || 0) > 6.5 * 864e5)) {
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
      not_("📅", "Haftalık strateji raporunu yazdı"); log("Haftalık strateji yazıldı");
    } catch (e) { log("Haftalık strateji atlandı:", e.message); }
  }
}

/* ---------- 📒 9) Ajan günlüğü + durum ---------- */
if (ilkCalisma) D.rapor = BUGUN;
await durumYaz();
if (GUN.length) await yaz("ajan/gunluk/" + BUGUN, g.tok, { t: Date.now(), isler: GUN.slice(-60) }).catch(e => log("günlük yazılamadı:", e.message));
// 30 günden eski günlükleri sil
try { const gk = (await okuG("ajan/gunluk")) || {}; for (const k of Object.keys(gk)) if (X.daysSince(k) > 30) await yaz("ajan/gunluk/" + k, g.tok, null).catch(() => { }); } catch (e) { }

/* ---------- 🔔 10) Bildirim ---------- */
const priv = env("VAPID_PRIVATE"), pub = ayar.vapidPub;
const ozetSatir = () => {
  const al = ik => GUN.filter(q => q.ik === ik && q.t > Date.now() - 3 * 3600e3).length;
  const parcalar = [];
  for (const q of GUN.filter(q => q.t > Date.now() - 3 * 3600e3 && q.ik !== "⚠")) { const m = q.metin.match(/(\d+) (yeni müşteri adayı|iş için|firmaya e-postayı|e-posta cevabı|kaydın takip)/); if (m) parcalar.push({ "yeni müşteri adayı": m[1] + " yeni aday", "iş için": m[1] + " mesaj hazır", "firmaya e-postayı": m[1] + " e-posta gitti", "e-posta cevabı": m[1] + " cevap", "kaydın takip": m[1] + " takip ayarı" }[m[2]]); }
  return parcalar.join(" • ");
};
if (!priv || !pub) { log("Bildirim atlandı: " + (!pub ? "programda bildirim anahtarı üretilmemiş (Kurulum 4. adım)" : "VAPID_PRIVATE eklenmemiş")); console.log("\n✅ Tamam."); process.exit(0); }
let webpush; try { webpush = (await import("web-push")).default; } catch (e) { log("web-push paketi yok, bildirim atlandı"); process.exit(0); }
try { webpush.setVapidDetails("mailto:info@magambalaj.com", pub, priv); } catch (e) { dur("VAPID_PRIVATE hatalı: programdaki 4. adımda üretilen gizli anahtarı aynen yapıştır (" + e.message + ")"); }
const bildirimler = [];
if (ilkCalisma) { const oz = ozetSatir(), ilk = l.find(f => f.sev !== "bilgi"); bildirimler.push({ title: "🤖 Ajanlar gece çalıştı", body: `${oz ? oz + "\n" : ""}Bugün ${l.length} iş${acil ? " (" + acil + " acil)" : ""}${ilk ? " • önce: " + ilk.bas : ""}`.slice(0, 230), url: "./?git=akis" }); }
for (const s of SICAK.slice(0, 3)) bildirimler.push({ title: "🔥 Sıcak gelişme", body: s, url: "./?git=akis" });
if (!bildirimler.length) { log("Gönderilecek bildirim yok"); console.log("\n✅ Tamam."); process.exit(0); }
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
console.log("\n✅ Tamam.");
