// MAG Pazar — 🌙 Gece ajanı (GitHub Actions, ücretsiz)
// Her sabah buluttaki kayıtları okur, programdaki AYNI ajan kurallarını çalıştırır (index.html'den okunur),
// Müdür raporunu buluta yazar ve yöneticilerin telefonuna bildirim gönderir.
// DİKKAT: Depo herkese açık olduğu için bu betik müşteri bilgisini ASLA ekrana (log'a) yazmaz.
import fs from "node:fs";
import vm from "node:vm";

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
  "toDoc", "calc", "docTop", "docAra", "sipAktif", "ciro", "odenen", "bakiye", "lastBuy", "kalemOzet", "TUK_DEF", "tuk", "oner", "hamL", "TSEK", "sleepers", "reorderList"];
const goruldu = new Set(), kodlar = [];
for (const ad of YARDIMCI) { const p = parca(ad); if (!goruldu.has(p.i)) { goruldu.add(p.i); kodlar.push([p.i, p.kod]); } }
kodlar.sort((a, b) => a[0] - b[0]);
const CEKIRDEK = blok("/* ================= v11 — 🤖 AJAN MERKEZİ", "/* --- ekran --- */");
let AI = blok("/* ================= v12 — 🧠 YAPAY ZEKÂ BEYNİ", "/* --- 💬 Müdürle konuş --- */");
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
const ctx = vm.createContext({ console, fetch, setTimeout, URLSearchParams, TextEncoder, Intl, Date, Math, JSON });
const kaynak = `
const ls={get:k=>bellek[k]??null,set:(k,v)=>{bellek[k]=String(v);return true},del:k=>{delete bellek[k]}};
const lsJ=(k,d)=>{try{return JSON.parse(ls.get(k))??d}catch(e){return d}};
let ayar=__ayar,data=__data,katalog=__katalog,users=__users,me={uid:null,ad:"🤖 Ajan",email:""},role="admin";
const isAdmin=()=>false;
${kodlar.map(k => k[1]).join("\n")}
${CEKIRDEK}
${AI}
globalThis.__api={ajCalistir,ajRapor,ajMasada,AJAD,aiSor,AISYS,deanon,aiKey};`;
Object.assign(ctx, { bellek, __ayar: ayar, __data: data, __katalog: katalog || [], __users: users || {} });
vm.runInContext(kaynak, ctx, { filename: "ajan-cekirdek.js" });
const X = ctx.__api;

const l = X.ajCalistir();
const metin = X.ajRapor(l);
const masada = X.ajMasada(l).reduce((a, z) => a + z[1], 0);
const acil = l.filter(f => f.sev === "kritik").length, onemli = l.filter(f => f.sev === "onemli").length;
log("Bulunan iş:", l.length, "• acil:", acil, "• önemli:", onemli);

let yorum = "";
if (X.aiKey()) {
  try {
    yorum = X.deanon(await X.aiSor(X.AISYS(), [{ r: "ben", m: "Bugünün planını çıkar: öncelik sırasıyla en fazla 6 madde (kim/kod, ne yapılacak, neden, ₺ etkisi). Sonunda tek cümle genel değerlendirme." }]));
    log("Müdür yorumu yazıldı (yapay zekâ)");
  } catch (e) { log("Yapay zekâ yorumu atlandı:", e.message); }
} else log("GEMINI_KEY yok → yapay zekâ yorumu atlandı (isteğe bağlı)");

const TL = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: ayar.para || "TRY", maximumFractionDigits: 0 }).format(n || 0);
const rapor = { t: Date.now(), tarih: new Date().toISOString().slice(0, 10), metin, yorum, sayi: l.length, acil, onemli, masada: Math.round(masada) };
try { await yaz("ajan/rapor/son", g.tok, rapor); log("Rapor buluta yazıldı"); }
catch (e) { dur("Rapor buluta yazılamadı (" + e.message + "). Firebase kuralını güncelle: programda ☁ → Kuralı kopyala → Firebase Rules → Publish."); }

/* ---------- 🔔 bildirim ---------- */
const priv = env("VAPID_PRIVATE"), pub = ayar.vapidPub;
if (!priv || !pub) { log("Bildirim atlandı: " + (!pub ? "programda bildirim anahtarı üretilmemiş (Kurulum 4. adım)" : "VAPID_PRIVATE eklenmemiş")); process.exit(0); }
let webpush; try { webpush = (await import("web-push")).default; } catch (e) { log("web-push paketi yok, bildirim atlandı"); process.exit(0); }
try { webpush.setVapidDetails("mailto:info@magambalaj.com", pub, priv); } catch (e) { dur("VAPID_PRIVATE hatalı: programdaki 4. adımda üretilen gizli anahtarı aynen yapıştır (" + e.message + ")"); }
let abone = {}; try { abone = (await oku("ajan/abone", g.tok)) || {}; } catch (e) { log("Abone listesi okunamadı:", e.message); }
const yonetici = uid => uid === ayar.ownerUid || (users && users[uid] && users[uid].rol === "admin");
const ilk = l.find(f => f.sev !== "bilgi");
const payload = JSON.stringify({
  title: "👔 Müdür raporu hazır",
  body: `${l.length} iş${acil ? " • " + acil + " acil" : ""}${masada >= 1 ? " • masada ≈ " + TL(masada) : ""}${ilk ? "\nÖnce: " + ilk.bas : ""}`.slice(0, 230),
  url: "./?git=ajan"
});
let gonderildi = 0, silindi = 0, hata = 0;
for (const [uid, cihazlar] of Object.entries(abone)) {
  if (!yonetici(uid)) continue;
  for (const [id, a] of Object.entries(cihazlar || {})) {
    try { await webpush.sendNotification(a.sub, payload, { TTL: 6 * 3600 }); gonderildi++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { try { await yaz("ajan/abone/" + uid + "/" + id, g.tok, null); silindi++; } catch (x) { } }
      else hata++;
    }
  }
}
log("Bildirim gönderildi:", gonderildi, "cihaz", silindi ? "• eskimiş abonelik silindi: " + silindi : "", hata ? "• hata: " + hata : "");
console.log("\n✅ Tamam.");
