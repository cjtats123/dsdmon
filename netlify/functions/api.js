// CEPALCO API: logins, permissions and the shared Excel data, stored in Netlify Blobs.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const st = () => getStore("cepalco");
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const FEATS = ["collections", "accounts", "contacts", "gen", "report", "dnjo", "sms", "dmap"], ACTS = ["view", "create", "update", "delete"];
// Contacts are derived from accounts, so only View and Edit apply to them.
const NA = { contacts: ["create", "delete"], gen: ["create", "delete"], dnjo: ["create", "delete"], sms: ["create", "update", "delete"], dmap: ["create", "delete"] };
// Accounts masterlist: same columns, same order as sheet "MONITORING FOR CODE". s=text, n=number, d=date (YYYY-MM-DD), x=number or text
const COLS = [["CUSTOMER TYPE","s"],["BILLING","s"],["DN/ODAA","s"],["JOB-ORDER","s"],["CLN","s"],["SUB-AREA","s"],["CUSTOMER NAME","s"],["AREA","x"],["RATE SCHED","x"],["CONTRACT NO.","n"],["MONTHS UNPAID","n"],["DUE DATE","d"],["PAYMENT DATE","d"],["ARREARS","n"],["LATEST BILL AMOUNT","n"],["TOTAL BALANCE AMOUNT","n"],["PAID AMOUNT","n"],["REMAINING BALANCE","n"],["SMS","s"],["EMAIL","s"],["FIELD REMARKS","s"],["PHONE NO.","s"],["EMAIL ADDRESS","s"],["Contact Person","s"]];
const CONTACT_COLS = ["PHONE NO.", "EMAIL ADDRESS", "Contact Person"], CONTACT_EDIT = ["PHONE NO.", "EMAIL ADDRESS", "Contact Person"];
const ct = x => ({ id: x._id, name: x["CUSTOMER NAME"], cn: x["CONTRACT NO."], phone: x["PHONE NO."], email: x["EMAIL ADDRESS"], person: x["Contact Person"] });
const row = v => ({ view: v ? 1 : 0, create: 0, update: 0, delete: 0 });
// Guests start with NO access. The admin can tick View for Guest on the Admin page if a read-only guest login is wanted.
const defGuest = () => ({ collections: row(0), accounts: row(0), contacts: row(0), gen: row(0), report: row(0), dnjo: row(0), sms: row(0), dmap: row(0) });
// Password rules (new and reset passwords): at least 8 characters and not an obvious one.
const pwBad = (p, u) => { p = String(p || ""); if (p.length < 8) return "Password needs at least 8 characters"; if (p.toLowerCase() === String(u || "").toLowerCase() || /^(admin|password|12345678|cepalco\d*)$/i.test(p)) return "That password is too easy to guess"; return null; };
const hash = (p, salt) => crypto.scryptSync(p, salt, 32).toString("hex");
const mkUser = (u, p, role) => { const salt = crypto.randomBytes(16).toString("hex"); return { u, salt, h: hash(p, salt), role }; };

// Speed: the signing secret never changes, so keep it in memory; users/permissions and the account list are kept for a few seconds
// (writes always re-read the account list first, so edits never overwrite each other with stale data).
let _k = null, _db = null, _dbAt = 0, _acc = null, _accAt = 0;
const FRESH = 5000;
async function loadDb() {
  if (_db && Date.now() - _dbAt < FRESH) return _db;
  const s = st(); let db = await s.get("db", { type: "json" });
  if (!db) { db = { users: [mkUser("admin", process.env.ADMIN_PASSWORD || "admin", "admin")], perms: { guest: defGuest() } }; await s.setJSON("db", db); }
  _db = db; _dbAt = Date.now(); return db;
}
async function secret() {
  if (_k) return _k;
  const s = st(); let k = await s.get("secret");
  if (!k) { k = crypto.randomBytes(32).toString("hex"); await s.set("secret", k); }
  return (_k = k);
}
const sign = (b, k) => crypto.createHmac("sha256", k).update(b).digest("base64url");
const mk = (o, k) => { const b = Buffer.from(JSON.stringify(o)).toString("base64url"); return b + "." + sign(b, k); };
function ver(t, k) {
  try {
    const [b, s] = String(t || "").split("."); if (!b || !s) return null;
    const e = sign(b, k); if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
    const o = JSON.parse(Buffer.from(b, "base64url").toString()); return o.x > Date.now() ? o : null;
  } catch { return null; }
}
const who = (tok, db) => !tok ? null : tok.role === "guest" ? { u: "guest", role: "guest" } : (db.users.find(y => y.u === tok.u && y.role === tok.role) ? { u: tok.u, role: tok.role, must: !!tok.m } : null);
const can = (me, db, f, a = "view") => me.role === "admin" || !!(db.perms[me.role === "guest" ? "guest" : me.u]?.[f]?.[a]);
const permsOf = (me, db) => me.role === "admin" ? Object.fromEntries(FEATS.map(f => [f, { view: 1, create: 1, update: 1, delete: 1 }])) : (db.perms[me.role === "guest" ? "guest" : me.u] || defGuest());
const session = (me, db, k) => ({ t: mk({ u: me.u, role: me.role, x: Date.now() + 12 * 36e5, m: me.must ? 1 : 0 }, k), u: me.u, role: me.role, must: me.must ? 1 : 0, perms: permsOf(me, db) });

// ---- accounts data ----
const r2 = v => Math.round(v * 100) / 100;
function coerce(k, t, v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  if (t === "s") return String(v).trim();
  if (t === "d") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim()), d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!d || d.getUTCMonth() !== +m[2] - 1) throw new Error("Invalid date in " + k + " (use YYYY-MM-DD)");
    return m[0];
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(/[\u20B1,\s]/g, ""));
  if (Number.isFinite(n)) return t === "n" ? r2(n) : n;
  if (t === "x") return String(v).trim();
  throw new Error("Invalid number in " + k);
}
// Same rules as the Excel formulas: TOTAL = ARREARS + LATEST BILL when ARREARS is filled; REMAINING = TOTAL - PAID.
function norm(o, id) {
  const r = { _id: id };
  for (const [k, t] of COLS) r[k] = coerce(k, t, o[k]);
  if (r["ARREARS"] !== null) r["TOTAL BALANCE AMOUNT"] = r2(r["ARREARS"] + (r["LATEST BILL AMOUNT"] || 0));
  const T = r["TOTAL BALANCE AMOUNT"], P = r["PAID AMOUNT"];
  r["REMAINING BALANCE"] = T === null && P === null ? null : r2((T || 0) - (P || 0));
  return r;
}
const newId = () => crypto.randomBytes(6).toString("hex");
const loadAcc = async s => { const a = (await s.get("accounts", { type: "json" })) || { n: "", r: [], at: 0 }; _acc = a; _accAt = Date.now(); return a; };
const readAcc = async s => (_acc && Date.now() - _accAt < FRESH) ? _acc : loadAcc(s);   // read-only views may use the short-lived copy
const saveAcc = async (s, a) => { a.at = Date.now(); await s.setJSON("accounts", a); _acc = a; _accAt = Date.now(); };
const canAnyAcc = (me, db) => ["create", "update", "delete"].some(x => can(me, db, "accounts", x));
// EMAIL/SMS generator: shared templates + how many times an email / SMS was generated for each account (own blob "gen").
const GEN_DEF = {
  cc: "atcagulang@cepalco.com.ph", subject: "CEPALCO Account Follow-up", msgr: "https://www.messenger.com/e2ee/t/9883957611625416",
  email_head: "Hi Sir/Ma'am,\n\nGood day.\n\nThis is a follow-up from CEPALCO regarding the following accounts with outstanding balances for [BILLING_MONTH-1] billing (due [BILLING_MONTH_YEAR]):\n\n",
  email_loop: "Name: [NAME]\nContract No: [CONTRACT]\nAmount: P[AMOUNT]\nMonths Unpaid: [MONTHS]\nDue Date: [DUEDATE]\n\n",
  email_foot: "Kindly ensure that the above accounts are settled.\n\nShould you have any concerns, please do not hesitate to coordinate with our office.\n\nThank you.\n\nBest Regards,\n\nChristian John D. Tato\nCollection Section\nCEPALCO - District Services Department\n09756200562",
  sms_head: "CEPALCO REMINDER: Hi! The following accounts have unpaid bills:\n",
  sms_loop: "Contract [CONTRACT]: P[AMOUNT] ([NAME])\n",
  sms_foot: "\nPlease settle soon. Thank you"
};
const GEN_MAX = { cc: 300, subject: 200, msgr: 300, email_head: 3000, email_loop: 1500, email_foot: 3000, sms_head: 1000, sms_loop: 500, sms_foot: 1000 };
const loadGen = async s => (await s.get("gen", { type: "json" })) || { counts: {}, cfg: {} };
const cfgOf = c => ({ ...GEN_DEF, ...(c.cfg || {}) });
// ids -> { e: emails generated, s: SMS generated } (only accounts that have at least one)
const countsOf = c => Object.fromEntries(Object.entries(c.counts || {}).map(([id, x]) => [id, { e: x.e || 0, s: x.s || 0, t: x.t || 0, u: x.u || "" }]));
const keyCn = v => String(v ?? "").trim().replace(/\.0+$/, "");
const keyNm = v => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
// ---- change log (who changed what) ----
const AUDIT_MAX = 2000;
const short = v => v === null || v === undefined ? "" : String(v).slice(0, 60);
const diff = (o, n) => COLS.map(([k]) => k).filter(k => k !== "REMAINING BALANCE" && (o[k] ?? null) !== (n[k] ?? null)).slice(0, 12).map(k => [k, short(o[k]), short(n[k])]);
async function audit(s, me, act, rec, d) {
  try {
    const l = (await s.get("audit", { type: "json" })) || [];
    l.push({ t: Date.now(), u: me.u, a: act, id: rec ? rec._id : null, n: rec ? short(rec["CUSTOMER NAME"]) : "", cn: rec ? short(rec["CONTRACT NO."]) : "", d: d || null });
    await s.setJSON("audit", l.slice(-AUDIT_MAX));
  } catch { /* the change log must never block an edit */ }
}
// ---- backups of the whole account list (kept before Load Excel and before a restore) ----
const BK_KEEP = 8;
async function backup(s, label) {
  const cur = await s.get("accounts", { type: "json" }); if (!cur || !Array.isArray(cur.r) || !cur.r.length) return null;
  const idx = (await s.get("backups_idx", { type: "json" })) || [], key = "backup-" + Date.now() + "-" + newId();
  await s.setJSON(key, cur); idx.push({ key, t: Date.now(), label, count: cur.r.length, n: cur.n || "" });
  while (idx.length > BK_KEEP) { const o = idx.shift(); try { await s.delete(o.key); } catch { } }
  await s.setJSON("backups_idx", idx); return key;
}
// ---- Text button (opens the phone's SMS app; the website sends nothing) ----
const SMS_DEF = { tpl: "Good day, {name}. Your CEPALCO account (Contract {contract}) has an unpaid balance of PHP {amount}[[, {months_unpaid} unpaid]][[, due {due_date}]].", closing: "Please settle at your earliest convenience. Thank you." };
const SMS_VARS = ["name", "contract", "amount", "months_unpaid", "due_date"];
const loadSms = async s => (await s.get("sms", { type: "json" })) || { cfg: {}, texted: {} };
const bad = e => J({ e: e.message || "Invalid data" }, 400);

// ---- Accounts Mapping: pin locations are stored by contract no. + customer name (not by row id), so they survive Load Excel ----
const geoKey = x => keyCn(x["CONTRACT NO."]) + "|" + keyNm(x["CUSTOMER NAME"]);
const loadGeo = async s => { const g = (await s.get("geo", { type: "json" })) || {}; g.p = g.p || {}; return g; };
const okLL = (la, ln) => Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180 && !(la === 0 && ln === 0);

export default async (req) => {
  if (req.method !== "POST") return J({ e: "POST only" }, 405);
  let b; try { b = await req.json(); } catch { return J({ e: "Bad request" }, 400); }
  const [db, k] = await Promise.all([loadDb(), secret()]), s = st(), a = b.a;

  if (a === "login") {
    const u = String(b.u || "").trim().toLowerCase(), x = db.users.find(y => y.u === u);
    // Throttle: 5 wrong passwords from the same address for the same username locks that pair for 15 minutes.
    const ip = String(req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?").split(",")[0].trim(), fk = ip + "|" + u.slice(0, 40), now = Date.now();
    const fails = (await s.get("fails", { type: "json" })) || {}, f = fails[fk];
    if (f && f.until > now) return J({ e: "Too many wrong sign-ins. Try again in " + Math.ceil((f.until - now) / 60000) + " minute(s)." }, 429);
    const okPw = !!x && crypto.timingSafeEqual(Buffer.from(hash(String(b.p || ""), x.salt)), Buffer.from(x.h));
    if (!okPw) {
      for (const k of Object.keys(fails)) if ((fails[k].until || 0) < now && now - (fails[k].last || 0) > 36e5) delete fails[k];
      const n = ((f && !(f.until && f.until <= now)) ? f.n || 0 : 0) + 1;
      fails[fk] = n >= 5 ? { n: 0, until: now + 15 * 6e4, last: now } : { n, until: 0, last: now };
      if (Object.keys(fails).length > 500) for (const k of Object.keys(fails).slice(0, 100)) delete fails[k];
      await s.setJSON("fails", fails);
      return J({ e: "Wrong username or password." }, 401);
    }
    if (f) { delete fails[fk]; await s.setJSON("fails", fails); }
    // A weak or default password (like admin/admin) works only to reach the "choose a new password" step.
    return J(session({ u, role: x.role, must: !!pwBad(b.p, u) }, db, k));
  }
  if (a === "guest") return J(session({ u: "guest", role: "guest" }, db, k));

  const me = who(ver(b.t, k), db);
  if (!me) return J({ e: "Please sign in again." }, 401);
  const save = async () => { await s.setJSON("db", db); _db = db; _dbAt = Date.now(); };
  if (a === "me") return J(session(me, db, k));
  if (a === "chpw") {
    const x = me.role === "guest" ? null : db.users.find(y => y.u === me.u); if (!x) return J({ e: "Guests have no password" }, 400);
    const o = String(b.o || ""), np = String(b.p || "");
    if (!crypto.timingSafeEqual(Buffer.from(hash(o, x.salt)), Buffer.from(x.h))) return J({ e: "The current password is wrong" }, 401);
    const m = pwBad(np, me.u) || (np === o ? "Choose a password different from the current one" : null); if (m) return J({ e: m }, 400);
    Object.assign(x, mkUser(me.u, np, x.role)); await save(); return J(session({ u: me.u, role: x.role }, db, k));
  }
  if (me.must) return J({ e: "Please choose a new password before continuing.", must: 1 }, 403);

  if (a === "getdata") {
    if (!can(me, db, "collections") && !can(me, db, "accounts") && !can(me, db, "report") && !can(me, db, "dnjo")) return J({ e: "Not allowed" }, 403);
    const d = await readAcc(s), full = me.role === "admin" || canAnyAcc(me, db) || can(me, db, "contacts") || can(me, db, "dnjo", "update");
    // people who may not see contact details never receive them
    const r = full ? d.r : d.r.map(x => { const y = { ...x }; for (const c of CONTACT_COLS) delete y[c]; return y; });
    const gc = can(me, db, "accounts") ? countsOf(await loadGen(s)) : {};
    return J({ n: d.n, at: d.at, cols: COLS, r, gen: gc });
  }
  if (a === "getcontacts") {
    if (!can(me, db, "contacts")) return J({ e: "Not allowed" }, 403);
    const d = await readAcc(s);
    return J({ r: d.r.map(ct) });
  }
  if (a === "con_upd") {
    if (!can(me, db, "contacts", "update")) return J({ e: "You do not have permission to edit contacts" }, 403);
    const d = await loadAcc(s), x = d.r.find(y => y._id === b.id); if (!x) return J({ e: "Account not found (it may have been deleted)" }, 404);
    const p = b.patch || {}, ks = Object.keys(p);
    if (!ks.length || ks.some(k => !CONTACT_EDIT.includes(k))) return J({ e: "Only phone, email and contact person can be edited here" }, 400);
    try { const before = { ...x }; Object.assign(x, norm({ ...x, ...p }, x._id)); var ch = diff(before, x); } catch (e) { return bad(e); }
    await saveAcc(s, d); if (ch.length) await audit(s, me, "edit contact", x, ch); return J({ ok: 1, rec: ct(x) });
  }
  if (a === "gen_get") {
    if (!can(me, db, "gen")) return J({ e: "Not allowed" }, 403);
    const c = await loadGen(s), sc = await loadSms(s);
    return J({ cfg: cfgOf(c), def: GEN_DEF, canEdit: can(me, db, "gen", "update"), counts: countsOf(c), sms: { tpl: (sc.cfg && sc.cfg.tpl) || SMS_DEF.tpl, closing: (sc.cfg && sc.cfg.closing) || SMS_DEF.closing } });
  }
  // Unpaid list for the generator: only accounts with a remaining balance, and only the fields the message needs (no contact details).
  if (a === "gen_accounts") {
    if (!can(me, db, "gen")) return J({ e: "Not allowed" }, 403);
    const d = await readAcc(s);
    const withPhone = can(me, db, "contacts");   // phone numbers are only sent to people who may see the Contact Directory
    const r = d.r.filter(x => Number(x["REMAINING BALANCE"]) > 0).map(x => ({ id: x._id, name: x["CUSTOMER NAME"] || "", cn: x["CONTRACT NO."], m: x["MONTHS UNPAID"], d: x["DUE DATE"] || "", b: Number(x["REMAINING BALANCE"]), ...(withPhone ? { p: x["PHONE NO."] || "" } : {}) }));
    return J({ r, at: d.at || 0 });
  }
  if (a === "gen_cfg") {
    if (!can(me, db, "gen", "update")) return J({ e: "You do not have permission to change the templates" }, 403);
    const p = b.cfg || {}, cfg = {};
    for (const k of Object.keys(GEN_DEF)) {
      const v = String(p[k] ?? GEN_DEF[k]).replace(/\r\n/g, "\n");
      if (v.length > GEN_MAX[k]) return J({ e: "Too long: " + k.replace("_", " ") + " (max " + GEN_MAX[k] + " characters)" }, 400);
      cfg[k] = v;
    }
    if (cfg.msgr && !/^https:\/\//i.test(cfg.msgr)) return J({ e: "Messenger link must start with https://" }, 400);
    const c = await loadGen(s); c.cfg = cfg; await s.setJSON("gen", c); return J({ ok: 1, cfg });
  }
  // One generation = one click on Prep Email / Prep SMS (or Outlook / Messenger when they have to generate first).
  // The contract numbers in the pasted data are matched to accounts; every matched account's count goes up by one.
  if (a === "gen_log") {
    if (!can(me, db, "gen")) return J({ e: "Not allowed" }, 403);
    const kind = b.kind === "email" ? "e" : b.kind === "sms" ? "s" : null; if (!kind) return J({ e: "Unknown type" }, 400);
    const items = Array.isArray(b.items) ? b.items.slice(0, 500) : [], acc = await readAcc(s), c = await loadGen(s), t = Date.now();
    const by = new Map(); for (const y of acc.r) { const k = keyCn(y["CONTRACT NO."]); if (k) (by.get(k) || by.set(k, []).get(k)).push(y); }
    c.counts = c.counts || {}; const hit = new Set(), miss = [];
    for (const it of items) {
      const l = by.get(keyCn(it && it.cn)); if (!l) { miss.push(String(it && it.cn || "")); continue; }
      const same = l.filter(y => keyNm(y["CUSTOMER NAME"]) === keyNm(it.name));   // shared contract numbers: prefer the same customer name
      for (const y of (same.length ? same : l)) hit.add(y._id);
    }
    for (const id of hit) { const x = c.counts[id] = c.counts[id] || { e: 0, s: 0 }; x[kind] = (x[kind] || 0) + 1; x.t = t; x.u = me.u; }
    if (hit.size) await s.setJSON("gen", c);
    return J({ ok: 1, matched: hit.size, missing: miss });
  }
  if (a === "sms_get" || a === "sms_mark") {
    if (!can(me, db, "contacts") || !can(me, db, "sms")) return J({ e: "Not allowed" }, 403);
    const c = await loadSms(s);
    if (a === "sms_get") return J({ tpl: (c.cfg && c.cfg.tpl) || SMS_DEF.tpl, closing: (c.cfg && c.cfg.closing) || SMS_DEF.closing, texted: c.texted || {} });
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter(x => typeof x === "string" && x.length <= 40).slice(0, 50), acc = await readAcc(s), have = new Set(acc.r.map(y => y._id)), t = Date.now();
    c.texted = c.texted || {}; let n = 0; for (const id of ids) if (have.has(id)) { c.texted[id] = { t, u: me.u }; n++; }
    if (n) await s.setJSON("sms", c); return J({ ok: 1, marked: n });
  }
  if (a === "dnjo_set") {
    if (!can(me, db, "dnjo", "update")) return J({ e: "You do not have permission to update DN / Job Order" }, 403);
    const col = b.col, v = String(b.v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    if (col !== "DN/ODAA" && col !== "JOB-ORDER") return J({ e: "Unknown column" }, 400);
    const m = /^(GEN|OK|TENDER) (\d{1,2})$/.exec(v);
    if (v && (!m || +m[2] < 1 || +m[2] > 31 || (m[1] === "TENDER" && col === "DN/ODAA"))) return J({ e: "Use GEN 18, OK 18 or (Job Order only) TENDER 18" }, 400);
    const d = await loadAcc(s), i = d.r.findIndex(y => y._id === b.id); if (i < 0) return J({ e: "Account not found (it may have been deleted)" }, 404);
    let rec; try { rec = norm({ ...d.r[i], [col]: v || null }, d.r[i]._id); } catch (e) { return bad(e); }
    const ch = diff(d.r[i], rec); d.r[i] = rec; await saveAcc(s, d); if (ch.length) await audit(s, me, "DN/JO", rec, ch); return J({ ok: 1, v: rec[col] });
  }
  // Accounts Mapping: all accounts (delinquent / partially paid / fully paid / unbilled), plus where each one is pinned. Phone numbers only for people who may see the Contact Directory.
  if (a === "dmap_get") {
    if (!can(me, db, "dmap")) return J({ e: "Not allowed" }, 403);
    const d = await readAcc(s), g = await loadGeo(s), withPhone = can(me, db, "contacts");
    // s = status: 0 delinquent (balance left, nothing paid), 1 partially paid (paid something, balance left), 2 fully paid, 3 unbilled (no balance, nothing paid). Every account is sent; the page splits them into tabs.
    const nn = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const r = d.r.filter(x => x["CUSTOMER NAME"]).map(x => {
      const R = nn(x["REMAINING BALANCE"]), P = nn(x["PAID AMOUNT"]), s = R > 0 ? (P > 0 ? 1 : 0) : (P > 0 ? 2 : 3);
      const p = g.p[geoKey(x)];
      return { s, pa: P, t: nn(x["TOTAL BALANCE AMOUNT"]), pd: x["PAYMENT DATE"] || "", id: x._id, name: x["CUSTOMER NAME"], cn: x["CONTRACT NO."], area: x["AREA"] ?? "", sub: x["SUB-AREA"] || "", type: x["CUSTOMER TYPE"] || "", m: x["MONTHS UNPAID"], d: x["DUE DATE"] || "", b: Math.max(0, R), dn: x["DN/ODAA"] || "", jo: x["JOB-ORDER"] || "", ...(p ? { la: p.la, ln: p.ln } : {}), ...(withPhone ? { p: x["PHONE NO."] || "" } : {}) };
    });
    return J({ v: 2, r, at: d.at || 0, canEdit: can(me, db, "dmap", "update") });
  }
  // One account ({id, la, ln}; la empty = remove the pin) or a batch from an imported file ({items: [{cn, name, la, ln}]}, matched to accounts by contract no. / name).
  if (a === "dmap_set") {
    if (!can(me, db, "dmap", "update")) return J({ e: "You do not have permission to place pins" }, 403);
    const d = await loadAcc(s), g = await loadGeo(s), t = Date.now();
    if (b.id) {
      const x = d.r.find(y => y._id === b.id); if (!x) return J({ e: "Account not found (it may have been deleted)" }, 404);
      if (b.la === null || b.la === undefined || b.la === "") { delete g.p[geoKey(x)]; await s.setJSON("geo", g); await audit(s, me, "map pin removed", x, null); return J({ ok: 1 }); }
      const la = Number(b.la), ln = Number(b.ln); if (!okLL(la, ln)) return J({ e: "That is not a valid location" }, 400);
      g.p[geoKey(x)] = { la: Math.round(la * 1e6) / 1e6, ln: Math.round(ln * 1e6) / 1e6, t, u: me.u };
      await s.setJSON("geo", g); await audit(s, me, "map pin set", x, null); return J({ ok: 1, la: g.p[geoKey(x)].la, ln: g.p[geoKey(x)].ln });
    }
    const items = Array.isArray(b.items) ? b.items.slice(0, 1000) : [];
    const byCn = new Map(), byNm = new Map();
    for (const y of d.r) { const c = keyCn(y["CONTRACT NO."]), n = keyNm(y["CUSTOMER NAME"]); if (c) (byCn.get(c) || byCn.set(c, []).get(c)).push(y); if (n) (byNm.get(n) || byNm.set(n, []).get(n)).push(y); }
    let n = 0, bad = 0; const miss = [];
    for (const it of items) {
      const la = Number(it && it.la), ln = Number(it && it.ln); if (!okLL(la, ln)) { bad++; continue; }
      let l = byCn.get(keyCn(it.cn));
      if (l) { const same = l.filter(y => keyNm(y["CUSTOMER NAME"]) === keyNm(it.name)); if (same.length) l = same; }   // shared contract numbers: prefer the same customer name
      else { const nm = byNm.get(keyNm(it.name)); if (nm && new Set(nm.map(geoKey)).size === 1) l = nm; }       // no contract number: accept a name that identifies exactly one account
      if (!l) { if (miss.length < 30) miss.push(String(it.name || it.cn || "?").slice(0, 60)); continue; }
      for (const k of new Set(l.map(geoKey))) g.p[k] = { la: Math.round(la * 1e6) / 1e6, ln: Math.round(ln * 1e6) / 1e6, t, u: me.u };
      n++;
    }
    if (n) { await s.setJSON("geo", g); await audit(s, me, "map import", null, [["pins", "", String(n)]]); }
    return J({ ok: 1, saved: n, invalid: bad, missing: miss });
  }
  if (a === "acc_add") {
    if (!can(me, db, "accounts", "create")) return J({ e: "You do not have permission to add accounts" }, 403);
    let rec; try { rec = norm(b.rec || {}, newId()); } catch (e) { return bad(e); }
    if (!rec["CUSTOMER NAME"]) return J({ e: "Customer name is required" }, 400);
    const d = await loadAcc(s); d.r.push(rec); await saveAcc(s, d); await audit(s, me, "add", rec); return J({ ok: 1, rec });
  }
  if (a === "acc_upd") {
    if (!can(me, db, "accounts", "update")) return J({ e: "You do not have permission to edit accounts" }, 403);
    const d = await loadAcc(s), i = d.r.findIndex(y => y._id === b.id); if (i < 0) return J({ e: "Account not found (it may have been deleted)" }, 404);
    const p = b.patch || {}; if (Object.keys(p).some(k => !COLS.some(c => c[0] === k))) return J({ e: "Unknown column" }, 400);
    let rec; try { rec = norm({ ...d.r[i], ...p }, d.r[i]._id); } catch (e) { return bad(e); }
    if (!rec["CUSTOMER NAME"]) return J({ e: "Customer name cannot be empty" }, 400);
    const ch = diff(d.r[i], rec); d.r[i] = rec; await saveAcc(s, d); if (ch.length) await audit(s, me, "edit", rec, ch); return J({ ok: 1, rec });
  }
  if (a === "acc_del") {
    if (!can(me, db, "accounts", "delete")) return J({ e: "You do not have permission to delete accounts" }, 403);
    const d = await loadAcc(s), n = d.r.length, gone = d.r.find(y => y._id === b.id); d.r = d.r.filter(y => y._id !== b.id);
    if (d.r.length === n) return J({ e: "Account not found" }, 404);
    await saveAcc(s, d); await audit(s, me, "delete", gone, COLS.map(([k]) => k).filter(k => gone[k] != null && ["TOTAL BALANCE AMOUNT", "PAID AMOUNT", "DUE DATE"].includes(k)).map(k => [k, short(gone[k]), ""])); return J({ ok: 1 });
  }

  if (a === "sms_cfg") {
    if (!can(me, db, "gen", "update")) return J({ e: "You do not have permission to change the templates" }, 403);
    const tpl = String(b.tpl ?? "").replace(/\r\n/g, "\n").trim(), closing = String(b.closing ?? "").replace(/\r\n/g, "\n").trim();
    if (!tpl || tpl.length > 500) return J({ e: "The message must be 1 to 500 characters" }, 400);
    if (closing.length > 300) return J({ e: "The closing line is too long (max 300)" }, 400);
    const unk = [...tpl.matchAll(/\{(\w+)\}/g)].map(m => m[1]).find(v => !SMS_VARS.includes(v)); if (unk) return J({ e: "Unknown placeholder {" + unk + "}. Use: " + SMS_VARS.map(v => "{" + v + "}").join(", ") }, 400);
    const c = await loadSms(s); c.cfg = { tpl, closing }; await s.setJSON("sms", c); return J({ ok: 1 });
  }

  if (me.role !== "admin") return J({ e: "Admin only" }, 403);
  const pw = String(b.p || ""), u = String(b.u || "").trim().toLowerCase();

  if (a === "putdata") {
    if (!Array.isArray(b.r)) return J({ e: "No rows" }, 400);
    let r; try { r = b.r.filter(x => x && (x["CUSTOMER NAME"] || x["CONTRACT NO."])).map(x => norm(x, newId())); } catch (e) { return bad(e); }
    const bk = await backup(s, "Before Load Excel (" + me.u + ")");   // the old list is kept so a wrong upload can be undone
    await saveAcc(s, { n: String(b.n || "masterlist"), r }); await audit(s, me, "load excel", null, [["rows", "", String(r.length)], ["file", "", short(b.n)]]);
    await s.delete("rows"); await s.delete("file"); // old formats, no longer used
    return J({ ok: 1, count: r.length, backedUp: !!bk });
  }
  if (a === "audit_get") { const l = (await s.get("audit", { type: "json" })) || []; return J({ l: l.slice(-500).reverse() }); }
  if (a === "backups") return J({ l: ((await s.get("backups_idx", { type: "json" })) || []).slice().reverse() });
  if (a === "backup_now") { const key = await backup(s, "Manual backup (" + me.u + ")"); return key ? J({ ok: 1 }) : J({ e: "Nothing to back up yet" }, 400); }
  if (a === "backup_restore") {
    const idx = (await s.get("backups_idx", { type: "json" })) || [], e = idx.find(y => y.key === b.key); if (!e) return J({ e: "Backup not found" }, 404);
    const snap = await s.get(e.key, { type: "json" }); if (!snap || !Array.isArray(snap.r)) return J({ e: "That backup file is missing" }, 404);
    await backup(s, "Before restoring a backup (" + me.u + ")");
    await saveAcc(s, { n: snap.n || "restored", r: snap.r }); await audit(s, me, "restore backup", null, [["rows", "", String(snap.r.length)], ["from", "", new Date(e.t).toISOString().slice(0, 16)]]);
    return J({ ok: 1, count: snap.r.length });
  }
  if (a === "users") return J({ users: db.users.map(({ u, role }) => ({ u, role })), perms: db.perms });
  if (a === "adduser") {
    if (!/^[a-z0-9._-]{3,20}$/.test(u)) return J({ e: "Username: 3-20 letters, numbers, . _ -" }, 400);
    if (u === "guest" || db.users.some(x => x.u === u)) return J({ e: "That username is taken" }, 400);
    { const m = pwBad(pw, u); if (m) return J({ e: m }, 400); }
    db.users.push(mkUser(u, pw, "user")); db.perms[u] = JSON.parse(JSON.stringify(db.perms.guest)); await save(); return J({ ok: 1 });
  }
  if (a === "setpw") {
    const x = db.users.find(y => y.u === u); if (!x) return J({ e: "No such user" }, 404);
    { const m = pwBad(pw, u); if (m) return J({ e: m }, 400); }
    Object.assign(x, mkUser(u, pw, x.role)); await save(); return J({ ok: 1 });
  }
  if (a === "deluser") {
    const x = db.users.find(y => y.u === u); if (!x || x.role === "admin") return J({ e: "Cannot delete that user" }, 400);
    db.users = db.users.filter(y => y !== x); delete db.perms[u]; await save(); return J({ ok: 1 });
  }
  if (a === "setperm") {
    const key = String(b.k || ""); if (key !== "guest" && !db.users.some(x => x.u === key && x.role === "user")) return J({ e: "No such user" }, 404);
    if (!FEATS.includes(b.f) || !ACTS.includes(b.x) || (NA[b.f] || []).includes(b.x)) return J({ e: "Bad permission" }, 400);
    const p = db.perms[key] = db.perms[key] || defGuest(); (p[b.f] = p[b.f] || row(0))[b.x] = b.v ? 1 : 0; await save(); return J({ ok: 1 });
  }
  return J({ e: "Unknown action" }, 400);
};
export const config = { path: "/api" };
