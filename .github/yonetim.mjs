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
