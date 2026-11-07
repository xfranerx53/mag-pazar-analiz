// Claude yönetim aracı — GitHub'da çalışır, anahtarlar GitHub gizli değişkenlerinden gelir.
// DİKKAT: Depo herkese açık; bu betik ASLA müşteri/kişi bilgisi yazdırmaz, yalnızca sayılar ve ayar adları.
import fs from "node:fs";
import admin from "firebase-admin";
const env = k => (process.env[k] || "").trim();
const islem = env("ISLEM") || "saglik";
const log = (...a) => console.log(...a);
const sirala = o => Array.isArray(o) ? o.map(sirala) : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sirala(o[k])])) : o;
let hata = 0;

/* ---------------- Firebase ---------------- */
if (env("SA")) {
  let sa; try { sa = JSON.parse(env("SA")); } catch (e) { log("❌ Firebase anahtarı (JSON) okunamadı — GitHub secret'ına dosyanın TAMAMI yapıştırılmalı"); process.exit(1); }
  const DB = env("DB_URL");
  log(`🔥 Firebase projesi: ${sa.project_id} • hesap: ${String(sa.client_email).replace(/^(.{6}).*(@.*)$/, "$1…$2")}`);
  admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: DB });
  const tok = (await admin.app().options.credential.getAccessToken()).access_token;
  const sig = async p => { const r = await fetch(DB.replace(/\/$/, "") + "/" + p + ".json?shallow=true", { headers: { Authorization: "Bearer " + tok } }); if (!r.ok) throw new Error("okuma " + r.status); return (await r.json()) || {}; };
  try {
    const kok = env("KOK") ? env("KOK") + "/" : "";
    const ust = Object.keys(await sig(env("KOK") || ""));
    log(`✅ Veritabanına erişim var. Ana bölümler (${ust.length}): ${ust.join(", ")}`);
    if (islem === "saglik") for (const k of ust) { try { const n = Object.keys(await sig(kok + k)).length; log(`   • ${k}: ${n} kayıt`); } catch (e) { log(`   • ${k}: okunamadı`); } }
  } catch (e) { hata++; log("❌ Veritabanı okunamadı:", e.message, "— hizmet hesabının 'Firebase Realtime Database Admin' rolü var mı?"); }

  /* 🩺 teşhis: tüm veriyi (fotoğraf ve gizli anahtarlar HARİÇ) ./teshis/ klasörüne yazar; iş akışı bunu ÖZEL depoya (mag-yonetim) gönderir.
     Herkese açık kayda (log) yalnız sayılar yazılır. 30 günden eski hata kayıtları silinir. */
  if (islem === "teshis") {
    const kok = env("KOK"), HARIC = new Set(env("HARIC").split(",").map(x => x.trim()).filter(Boolean));
    const temizle = v => { if (typeof v === "string") return /^data:/.test(v) ? "[dosya]" : v.length > 4000 ? v.slice(0, 4000) + "…[kesildi]" : v; if (Array.isArray(v)) return v.map(temizle); if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = HARIC.has(k) ? "[gizli/hariç]" : temizle(v[k]); return o; } return v; };
    const ust = Object.keys(await sig(kok || "")), cikti = {}, say = {};
    for (const k of ust) { if (HARIC.has(k)) { cikti[k] = "[hariç]"; continue; } try { const v = (await admin.database().ref((kok ? kok + "/" : "") + k).once("value")).val(); cikti[k] = temizle(v); say[k] = v && typeof v === "object" ? Object.keys(v).length : 1; } catch (e) { cikti[k] = "[okunamadı: " + e.message + "]"; } }
    const hy = (kok ? kok + "/" : "") + "hata", H = cikti.hata && typeof cikti.hata === "object" ? cikti.hata : {};
    let silinen = 0; for (const [id, h] of Object.entries(H)) if (h && h.t && Date.now() - h.t > 30 * 864e5) { await admin.database().ref(hy + "/" + id).remove().catch(() => { }); delete H[id]; silinen++; }
    fs.mkdirSync("teshis", { recursive: true });
    fs.writeFileSync("teshis/veri.json", JSON.stringify(sirala(cikti), null, 1));
    const hl = Object.values(H).filter(Boolean).sort((a, b) => b.t - a.t);
    const md = [`# Teşhis — ${sa.project_id} — ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`, "", "## Kayıt sayıları", ...Object.entries(say).map(([k, n]) => `- ${k}: ${n}`), "",
      `## Son hatalar (${hl.length}, 30 günden eskiler silindi: ${silinen})`, ...hl.slice(0, 80).map(h => `- ${new Date(h.t).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} • ${h.tur || ""}${h.n > 1 ? " ×" + h.n : ""} • ${h.v || ""} • ${h.ekran || ""} • ${h.cihaz || ""} • u:${h.u || ""}\n  ${h.m}${h.s ? "\n  ```\n  " + String(h.s).split("\n").slice(0, 4).join("\n  ") + "\n  ```" : ""}`)];
    fs.writeFileSync("teshis/OZET.md", md.join("\n") + "\n");
    log(`🩺 Teşhis hazır: ${Object.keys(say).length} bölüm, ${hl.length} hata kaydı (${silinen} eski silindi). İçerik yalnız özel depoya gider.`);
  }

  if (/^kural/.test(islem) || islem === "saglik") {
    let hedef = null;
    if (env("KURAL_DOSYA")) hedef = JSON.parse(fs.readFileSync(env("KURAL_DOSYA"), "utf8"));
    else if (env("KURAL_HTML")) { // Mag Pazar: kurallar index.html'deki rulesText() ile üretilir (sahip uid'i ayardan)
      const h = fs.readFileSync(env("KURAL_HTML"), "utf8"), a = h.indexOf("function rulesText("), b = h.indexOf("\nfunction ", a + 10);
      const rulesText = new Function("return " + h.slice(a, b))();
      const own = (await admin.database().ref("mag_pazar/ayar/ownerUid").once("value")).val();
      if (!own) log("⚠ ayar.ownerUid bulunamadı; kural yalnız yönetici rolüne göre üretilecek");
      hedef = JSON.parse(rulesText(own || "yok"));
    }
    try {
      const simdi = await admin.database().getRulesJSON();
      const ayni = JSON.stringify(sirala(simdi)) === JSON.stringify(sirala(hedef));
      log(hedef ? (ayni ? "✅ Yayındaki kurallar depodaki kurallarla AYNI" : "⚠ Yayındaki kurallar depodakinden FARKLI") : "ℹ Karşılaştırılacak kural dosyası yok");
      if (islem === "kural-yayinla" && hedef && !ayni) { await admin.database().setRules(JSON.stringify(hedef, null, 2)); log("✅ Yeni kurallar YAYINLANDI"); }
      else if (islem === "kural-yayinla") log("ℹ Yayınlamaya gerek yok");
    } catch (e) { hata++; log("❌ Kurallara erişilemedi:", e.message, "— hizmet hesabına 'Firebase Realtime Database Admin' rolü verilmeli"); }
    /* 🌐 web sitesi teklif formu kuralını GERÇEK veritabanında dene: geçerli talep kabul, eksik talep ret; test kaydı hemen silinir */
    if (islem === "kural-yayinla" && env("KURAL_HTML")) try {
      await new Promise(r => setTimeout(r, 4000));
      const u = DB.replace(/\/$/, "") + "/mag_pazar/talep.json", P = o => fetch(u, { method: "POST", body: JSON.stringify({ kaynak: "site", t: { ".sv": "timestamp" }, ...o }) });
      const iyi = await P({ tur: "teklif", firma: "TEST - otomatik silinir", tel: "0000000000", test: true }), kotu = await P({ firma: "x" });
      if (iyi.ok) { const { name } = await iyi.json(); await admin.database().ref("mag_pazar/talep/" + name).remove(); }
      if (iyi.ok && !kotu.ok) log("✅ Web sitesi formu kuralı çalışıyor (geçerli talep kabul edildi, eksik talep reddedildi; test kaydı silindi)");
      else { hata++; log(`❌ Web sitesi formu testi: geçerli talep ${iyi.status}, eksik talep ${kotu.status}`); }
    } catch (e) { log("⚠ Web formu testi yapılamadı:", e.message); }
  }
}

/* ---------------- ⏰ Dış zamanlayıcı (Cloudflare Cron → GitHub "Ajan sabah raporu", zamanli=1) ---------------- */
if (islem === "zamanlayici-kur") {
  const A = env("CF_ACCOUNT"), CT = env("CF_TOKEN");
  if (!A || !CT || !env("SA")) { log("❌ Cloudflare anahtarları ya da Firebase anahtarı yok"); process.exit(1); }
  const gh = String((await admin.database().ref("mag_pazar/ajan/gizli/ghToken").once("value")).val() || "").trim();
  if (!gh) { log("❌ Programda GitHub anahtarı (Kurulum 8) kayıtlı değil"); process.exit(1); }
  const kod = `export default {
  async scheduled(ev, env, ctx) { ctx.waitUntil(tetikle(env)); },
  async fetch(req, env) { return new Response("MAG ajan zamanlayıcısı çalışıyor (her saat :17; 06:17 teşhis). Son tetikleme: " + (await env.KV?.get?.("son") || "-"), { headers: { "content-type": "text/plain; charset=utf-8" } }); }
};
async function calistir(env, wf, inputs) {
  const r = await fetch("https://api.github.com/repos/xfranerx53/mag-pazar-analiz/actions/workflows/" + wf + "/dispatches", { method: "POST",
    headers: { Authorization: "Bearer " + env.GH_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "mag-zamanlayici", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs }) });
  if (r.status !== 204) console.log("GitHub tetiklenemedi", wf, r.status, await r.text());
}
async function tetikle(env) {
  await calistir(env, "ajan-gece.yml", { zamanli: "1" });
  // Sabah teşhisi: GitHub'ın kendi 06:41 zamanlaması saatlerce gecikebiliyor; 06:17'de (UTC 03) buradan da başlat
  if (new Date().getUTCHours() === 3) await calistir(env, "yonetim.yml", { islem: "teshis" });
}`;
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify({ main_module: "index.js", compatibility_date: "2024-09-01", bindings: [{ type: "secret_text", name: "GH_TOKEN", text: gh }] })], { type: "application/json" }));
  fd.append("index.js", new Blob([kod], { type: "application/javascript+module" }), "index.js");
  const u = `https://api.cloudflare.com/client/v4/accounts/${A}/workers/scripts/mag-zamanlayici`, H = { Authorization: "Bearer " + CT };
  let r = await fetch(u, { method: "PUT", headers: H, body: fd }), j = await r.json().catch(() => ({}));
  if (!j.success) { log("❌ Worker yüklenemedi:", JSON.stringify(j.errors || r.status).slice(0, 200)); process.exit(1); }
  r = await fetch(u + "/schedules", { method: "PUT", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify([{ cron: "17 * * * *" }]) }); j = await r.json().catch(() => ({}));
  if (!j.success) { log("❌ Zamanlama ayarlanamadı:", JSON.stringify(j.errors || r.status).slice(0, 200)); process.exit(1); }
  log("✅ Cloudflare zamanlayıcısı kuruldu: mag-zamanlayici, her saatin 17. dakikasında ajanları, 06:17'de teşhisi başlatır");
}

/* ---------------- Cloudflare ---------------- */
if (env("CF_TOKEN")) {
  const H = { Authorization: "Bearer " + env("CF_TOKEN") }, A = env("CF_ACCOUNT");
  const cf = async p => { const r = await fetch("https://api.cloudflare.com/client/v4/" + p, { headers: H }); const j = await r.json().catch(() => ({})); if (!j.success) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || "yanıt " + r.status); return j.result; };
  try {
    const v = await cf("user/tokens/verify"); log(`☁ Cloudflare anahtarı: ${v.status}`);
    if (!A) { hata++; log("❌ CLOUDFLARE_ACCOUNT_ID yok"); }
    else {
      const w = await cf(`accounts/${A}/workers/scripts`); log(`✅ Worker'lar (${w.length}): ${w.map(x => x.id).join(", ") || "-"}`);
      const kv = await cf(`accounts/${A}/storage/kv/namespaces`); log(`✅ KV alanları (${kv.length}): ${kv.map(x => x.title).join(", ") || "-"}`);
      try { const s = await cf(`accounts/${A}/workers/subdomain`); log(`   adres kökü: ${s.subdomain}.workers.dev`); } catch (e) { }
    }
  } catch (e) { hata++; log("❌ Cloudflare:", e.message); }
}
/* ---------------- 🎯 KOMUT: Claude'un sahibin talimatını doğrudan uygulaması ----------------
   Talimat ÖZEL depo mag-yonetim/komut/<PROJE_AD>.json'dadır: {aciklama, islemler:[{tur:"yaz"|"birlestir"|"sil", yol, deger}]}
   Önce eski değerler komut/yedek/'e yedeklenir (geri alınabilir), sonra tek seferde uygulanır, Fabrika'da denetim kaydına düşülür.
   Herkese açık log'a YALNIZ sayılar yazılır (açıklama, isim, değer yazılmaz). Değerdeki "{SUNUCU_ZAMANI}" sunucu saatine çevrilir. */
if (islem === "komut") {
  const T = env("YONETIM_TOKEN"), PRJ = env("PROJE_AD"), KOKK = env("KOK");
  if (!T || !env("SA") || !PRJ) { log("❌ YONETIM_TOKEN / Firebase anahtarı / PROJE_AD yok"); process.exit(1); }
  const API = "https://api.github.com/repos/xfranerx53/mag-yonetim/contents/komut/", HH = { Authorization: "Bearer " + T, "User-Agent": "mag-yonetim", Accept: "application/vnd.github+json" };
  const r = await fetch(API + PRJ + ".json", { headers: HH });
  if (r.status === 404) log("ℹ Bekleyen komut yok");
  else if (!r.ok) { log("❌ Komut dosyası okunamadı:", r.status); process.exit(1); }
  else {
    const meta = await r.json(), K = JSON.parse(Buffer.from(meta.content, "base64").toString("utf8")), D = admin.database();
    const SZ = v => v === "{SUNUCU_ZAMANI}" ? admin.database.ServerValue.TIMESTAMP : v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, SZ(b)])) : Array.isArray(v) ? v.map(SZ) : v;
    const up = {}, yedek = { t: Date.now(), proje: PRJ, aciklama: K.aciklama || "", once: {} };
    for (const x of K.islemler || []) {
      const p = String(x.yol || "").replace(/^\/+|\/+$/g, "");
      if (!p || /[.#$\[\]]/.test(p) || p.split("/").some(s => !s)) { log("❌ Geçersiz yol, komut uygulanmadı"); process.exit(1); }
      if (KOKK && p !== KOKK && !p.startsWith(KOKK + "/")) { log("❌ Yol programın kök düğümü dışında, komut uygulanmadı"); process.exit(1); }
      yedek.once[p] = (await D.ref(p).once("value")).val();
      if (x.tur === "sil") up[p] = null;
      else if (x.tur === "birlestir") for (const [a, b] of Object.entries(x.deger || {})) up[p + "/" + a] = SZ(b);
      else if (x.tur === "yaz") up[p] = SZ(x.deger);
      else { log("❌ Bilinmeyen işlem türü, komut uygulanmadı"); process.exit(1); }
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-"), b64 = o => Buffer.from(JSON.stringify(o, null, 1)).toString("base64");
    const yr = await fetch(API + "yedek/" + PRJ + "-" + ts + ".json", { method: "PUT", headers: HH, body: JSON.stringify({ message: "komut yedeği " + PRJ, content: b64(yedek) }) });
    if (!yr.ok) { log("❌ Yedek alınamadı, komut UYGULANMADI:", yr.status); process.exit(1); }
    if (Object.keys(up).length) await D.ref().update(up);
    if (PRJ === "fabrika") await D.ref("denetim").push({ tur: "claude", baslik: String(K.aciklama || "Claude talimatı").slice(0, 120), detay: Object.keys(up).length + " değişiklik (sahibin talimatıyla)", yol: "", id: "", kim: "🤖 Claude (sahibin talimatı)", uid: "claude", zaman: admin.database.ServerValue.TIMESTAMP }).catch(() => { });
    await fetch(API + PRJ + ".json", { method: "DELETE", headers: HH, body: JSON.stringify({ message: "komut uygulandı " + PRJ, sha: meta.sha }) });
    await fetch(API + "sonuc-" + PRJ + ".json", { method: "GET", headers: HH }).then(x => x.ok ? x.json() : null).then(o => fetch(API + "sonuc-" + PRJ + ".json", { method: "PUT", headers: HH, body: JSON.stringify({ message: "komut sonucu", content: b64({ t: Date.now(), degisiklik: Object.keys(up).length, yedek: "yedek/" + PRJ + "-" + ts + ".json" }), ...(o && o.sha ? { sha: o.sha } : {}) }) }));
    log(`✅ Komut uygulandı: ${Object.keys(up).length} değişiklik • eski hali yedeklendi`);
  }
}

process.exit(hata ? 1 : 0);
