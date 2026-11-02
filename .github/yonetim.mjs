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
  }
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
process.exit(hata ? 1 : 0);
