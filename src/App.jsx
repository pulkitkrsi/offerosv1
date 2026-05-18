import { useState, useEffect, useRef, useCallback } from "react";

/* ════════════════════════════════════════════════════
   CONSTANTS & DATA
   ════════════════════════════════════════════════════ */
const SEGMENTS = {
  New: { label: "New", desc: "First time user — never charged", icon: "✦", insight: "68% drop off before first charge. Convert them now.", color: "#1a9d4a" },
  Dormant: { label: "Dormant", desc: "No session in 90+ days", icon: "◌", insight: "Lapsed users who know the product. Re-engagement has 3× ROI vs acquisition.", color: "#c48a1a" },
  Engaged: { label: "Engaged", desc: "1–5 sessions this month", icon: "◉", insight: "Building habit. Session 3 is the stickiness threshold.", color: "#2a7ab8" },
  Existing: { label: "Existing", desc: "Active account holder", icon: "●", insight: "Broad base. Reward frequency or increase wallet commitment.", color: "#7c4dbd" },
  All: { label: "All", desc: "Every user, no filter", icon: "◎", insight: "Maximum reach. Use for platform-wide campaigns.", color: "#5c5c66" },
};
const SEGMENT_SUGGESTIONS = {
  New: [
    { title: "First-charge cashback 10–15%", desc: "Strongest conversion trigger. New users who complete their first charge are 4× more likely to return.", reward: "Cashback", activity: "Charging session" },
    { title: "Wallet pre-load ₹50–100", desc: "Give new users free balance to try the platform risk-free. Works best for price-sensitive segments.", reward: "Pre-load", activity: "Wallet top-up" },
    { title: "Welcome coupon — flat ₹50 off", desc: "Simple, easy to understand. Good for acquisition campaigns with fixed budget.", reward: "Coupon", activity: "Charging session" },
  ],
  Dormant: [
    { title: "Re-engagement cashback 12–18%", desc: "Higher rate than standard — dormant users need a stronger nudge. First-session trigger recommended.", reward: "Cashback", activity: "Charging session" },
    { title: "Win-back wallet credit ₹100–200", desc: "Pre-load their wallet so they have a reason to open the app again. Spread distribution keeps them coming back.", reward: "Pre-load", activity: "Wallet top-up" },
    { title: "Time-limited 20% discount", desc: "Urgency drives action. 7–14 day window with a meaningful discount on their first session back.", reward: "Discount", activity: "Charging session" },
  ],
  Engaged: [
    { title: "Step-up cashback 5%→8%→12%", desc: "Reward increasing frequency. Session 3 is the stickiness threshold — this pushes users past it.", reward: "Cashback", activity: "Charging session" },
    { title: "Loyalty XP — 1 XP per ₹ spent", desc: "Build long-term engagement through points. Works best when XP can be redeemed for tangible value.", reward: "ChargeXP", activity: "Wallet top-up" },
    { title: "Wallet top-up cashback 5–8%", desc: "Encourage wallet commitment. Users with wallet balance charge 2× more frequently.", reward: "Cashback", activity: "Wallet top-up" },
  ],
  Existing: [
    { title: "Platform-wide 5% cashback", desc: "Low-cost blanket offer to maintain engagement. Keep the cap tight to control costs.", reward: "Cashback", activity: "Charging session" },
    { title: "Slab-based wallet cashback", desc: "Higher cashback for larger top-ups. Drives wallet commitment and reduces payment friction.", reward: "Cashback", activity: "Wallet top-up" },
  ],
  All: [
    { title: "Festival/seasonal cashback 8–10%", desc: "Time-bound platform-wide offer. Works for festivals, holidays, or milestone celebrations.", reward: "Cashback", activity: "Charging session" },
    { title: "Refer & earn — coupon for both", desc: "Growth driver. Give both referrer and referee a coupon for their next charge.", reward: "Coupon", activity: "Charging session" },
  ],
};

const DOT_COLORS = { Cashback: "#1a9d4a", Discount: "#c48a1a", ChargeXP: "#7c4dbd", Coupon: "#2a7ab8", "Pre-load": "#0e8a7a" };
const BADGE_MAP = { Cashback: ["bg-cashback", "Cashback"], Discount: ["bg-discount", "Discount"], ChargeXP: ["bg-xp", "ChargeXP"], Coupon: ["bg-coupon", "Coupon"] };
const REWARDS_FOR = { "Charging session": ["Cashback", "Discount", "Coupon"], "Wallet top-up": ["Cashback", "ChargeXP", "Coupon"] };

let _oc = 0;
const uid = () => "o" + (++_oc) + "_" + Date.now();
const defaultOffer = (n) => ({ id: uid(), name: "Offer " + n, segments: [], activity: "Charging session", wpre: false, w: "", wa: "Campaign start date", dist: "spread", wsx: "", wsxType: "fixed", wpun: "", wpc: "", reward: "Cashback", tiers: [{ s: "1", pct: "7" }, { s: "2", pct: "10" }, { s: "3", pct: "12" }], dpct: "", xpwpct: "", p: "", un: "", ux: "", nx: "", cy: "", dy: "", wm: "", sn: "", sx: "", t: "30", te: "", ce: "30", ctMode: "off", wtMode: "none", wtSlabs: [{ min: "100", max: "499", pct: "5" }, { min: "500", max: "999", pct: "8" }, { min: "1000", max: "", pct: "12" }], rc: null, rcFileName: "", rcCount: 0, rcLogic: "intersection", simTxns: null, simResult: null, simRoi: null, startDate: new Date().toISOString().split("T")[0], paused: false, scaleInputs: null, offerStatus: "draft" });
const OFFER_STATUSES = ["draft", "ready", "approved", "live", "completed"];
const STATUS_LABELS = { draft: "Draft", ready: "Ready for review", approved: "Approved", live: "Live", completed: "Completed" };
function getOfferStatus(o) { if (o.offerStatus && OFFER_STATUSES.includes(o.offerStatus)) return o.offerStatus; if (o.paused) return "paused"; const today = new Date(); const sd = o.startDate ? new Date(o.startDate) : null; if (!sd) return "draft"; const days = parseInt(o.t) || 30; const ed = o.te ? new Date(o.te) : new Date(sd.getTime() + days * 86400000); if (today < sd) return "draft"; if (today > ed) return "completed"; return "live"; }
function getOfferEndDate(o) { const sd = o.startDate ? new Date(o.startDate) : new Date(); const days = parseInt(o.t) || 30; return o.te ? new Date(o.te) : new Date(sd.getTime() + days * 86400000); }
const STATUS_COLORS = { draft: "var(--text3)", ready: "var(--blue)", approved: "var(--purple)", live: "var(--green)", completed: "var(--text3)", paused: "var(--amber)", active: "var(--green)", scheduled: "var(--blue)", expired: "var(--text3)" };
const STATUS_BG = { draft: "var(--bg3)", ready: "var(--blue-bg)", approved: "var(--purple-bg)", live: "var(--green-bg)", completed: "var(--bg3)", paused: "var(--amber-bg)", active: "var(--green-bg)", scheduled: "var(--blue-bg)", expired: "var(--bg3)" };
const defaultTxns = (a) => a === "Wallet top-up" ? [{ date: "", amount: "" }] : [{ date: "", units: "", rate: "22" }];
function validateStep(o, s) { if (!o) return false; if (s === 0) return o.segments.length > 0; if (s === 1) return !!o.activity; if (s === 2) { if (o.wpre) return true; if (o.reward === "Cashback") return o.tiers.length > 0 && o.tiers.some(t => parseFloat(t.pct) > 0); if (o.reward === "Discount") return parseFloat(o.dpct) > 0; if (o.reward === "ChargeXP") return parseFloat(o.xpwpct) > 0; if (o.reward === "Coupon") return !!o.p; return false; } if (s === 4) return parseFloat(o.t) > 0; return true; }
function detectConflicts(offers) { const f = {}; for (let i = 0; i < offers.length; i++) for (let j = i + 1; j < offers.length; j++) { const a = offers[i], b = offers[j]; const aid = a._id || a.id, bid = b._id || b.id; const ov = a.segments.filter(s => b.segments.includes(s) || s === "All" || b.segments.includes("All")); if (ov.length > 0 && (a.wpre ? "Pre-load" : a.reward) === (b.wpre ? "Pre-load" : b.reward) && a.activity === b.activity) { f[aid] = f[aid] || []; f[aid].push("Overlaps with " + b.name); f[bid] = f[bid] || []; f[bid].push("Overlaps with " + a.name); } } return f; }
function generateSampleTxns(offer) { const days = parseInt(offer.t) || 30; const today = new Date(); const count = 5; const txns = []; for (let i = 0; i < count; i++) { const d = new Date(today.getTime() + Math.floor((i / count) * days) * 86400000); const ds = d.toISOString().split("T")[0]; if (offer.activity === "Wallet top-up") txns.push({ date: ds, amount: String([200, 500, 300, 1000, 150][i]) }); else txns.push({ date: ds, units: String([12, 8, 15, 20, 25][i]), rate: "22" }); } return txns; }

let _apiKey = "";
const getApiKey = () => _apiKey;
const setApiKeyVal = (k) => { _apiKey = k; };
async function callAI(sys, usr) { const key = getApiKey(); if (!key) return "Set your API key via ⚙ to enable AI."; try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys, messages: [{ role: "user", content: usr }] }) }); if (!r.ok) { const e = await r.json().catch(() => ({})); return r.status === 401 ? "Invalid API key." : "Error: " + (e.error?.message || r.statusText); } const d = await r.json(); return d.content?.map(b => b.text || "").join("\n") || "No response"; } catch (e) { return "AI unavailable — " + e.message; } }
const AI_SYS = "You are OfferOS AI — campaign intelligence for ChargeZone EV charging. Analyze offer configs, suggest optimizations. RULES: Charging session→Cashback/Discount/Coupon. Wallet top-up→Cashback/ChargeXP/Coupon. Discount NEVER for wallet. ChargeXP NEVER for charging. Cashback≠Discount. All ₹. ct=charging trigger (off/first — first session only for charging). wt=wallet top-up trigger (off/first/slab). Concise 3-5 bullets. Use backticks for vars.";
const AI_QA = { 0: ["Which segments?", "Overlap risk?"], 1: ["Charging vs Wallet?", "First session?"], 2: ["Suggest rates", "Cashback vs Discount?"], 3: ["Boundaries ok?", "Cap thresholds"], 4: ["Duration right?", "Optimal expiry?"], 5: ["Analyze offer", "Check conflicts"], 6: ["ROI outlook", "Risk assessment"] };
const STEP_INFO = [
  { label: "Audience", title: "Who's this for?", desc: "Select the customer segments you want to target" },
  { label: "Activity", title: "What earns the reward?", desc: "Choose the action and set behavioural triggers" },
  { label: "Reward", title: "What do they get?", desc: "Configure the reward type and rates" },
  { label: "Limits", title: "What are the limits?", desc: "Set minimum requirements and maximum caps" },
  { label: "Duration", title: "How long does it run?", desc: "Define the campaign duration and reward expiry" },
  { label: "Review", title: "Review your offer", desc: "Check everything before sharing with the team" },
  { label: "Scenarios", title: "Test with scenarios", desc: "Enter sample transactions to see projected outcomes" },
];
const OFFER_TEMPLATES = [
  { name: "Acquisition — First charge cashback", desc: "Bring new users to their first charging session", preset: { segments: ["New"], ctMode: "first", activity: "Charging session", reward: "Cashback", tiers: [{ s: "1", pct: "10" }], un: "10", cy: "100", t: "30", ce: "30" } },
  { name: "Re-engagement — Come back bonus", desc: "Win back users who haven't charged in 90+ days", preset: { segments: ["Dormant"], ctMode: "first", activity: "Charging session", reward: "Cashback", tiers: [{ s: "1", pct: "15" }], un: "8", cy: "150", t: "45", ce: "30" } },
  { name: "Loyalty — Step-up rewards", desc: "Reward engaged users with increasing cashback", preset: { segments: ["Engaged"], activity: "Charging session", reward: "Cashback", tiers: [{ s: "1", pct: "5" }, { s: "2", pct: "8" }, { s: "3", pct: "12" }], un: "10", cy: "200", t: "30", ce: "30" } },
  { name: "Wallet push — Top-up incentive", desc: "Drive wallet adoption with cashback on first top-up", preset: { segments: ["All"], wtMode: "first", activity: "Wallet top-up", reward: "Cashback", tiers: [{ s: "1", pct: "5" }], cy: "50", t: "30", ce: "30" } },
  { name: "Blank — Start from scratch", desc: "Empty offer with default settings", preset: {} },
];

function runSimulation(offer, txns) { const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date)); const cs = sorted[0]?.date ? new Date(sorted[0].date) : null; let sc = 0, tn = 0, tg = 0, qt = 0, wr = parseFloat(offer.w) || 0, ftu = false, fsu = false, totalUsed = 0; const isW = offer.activity === "Wallet top-up", snV = parseInt(offer.sn) || 0, wpcLimit = parseFloat(offer.wpc) || Infinity, wpunMin = parseFloat(offer.wpun) || 0; const rows = txns.map((tx, i) => { const td = tx.date ? new Date(tx.date) : null; const ed = cs ? new Date(cs.getTime() + (parseInt(offer.t) || 30) * 86400000) : null; let rw = 0, st = "", rs = "—", ss = "—", netVal = 0;
  if (isW) { const amt = parseFloat(tx.amount) || 0; tg += amt;
    if (offer.wpre) {
      if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (wr <= 0) st = "exhausted"; else if (offer.sx && sc >= parseInt(offer.sx)) st = "max-sess"; else if (totalUsed >= wpcLimit) st = "credit-cap"; else { if (wpunMin > 0) { const kwhEquiv = amt / (parseFloat(offer.wsx) || amt); if (kwhEquiv < wpunMin) { st = "below-kwh"; return { idx: i + 1, date: tx.date || "—", amount: amt, reward: 0, rateStr: "< " + wpunMin + "kWh", sessStr: "—", status: st, type: "preload", netVal: 0 }; } } sc++; ss = sc; let ms = wr; if (offer.dist === "spread" && offer.wsx) { const cap = offer.wsxType === "pct" ? (parseFloat(offer.wsx) / 100 * (parseFloat(offer.w) || 0)) : parseFloat(offer.wsx); ms = Math.min(wr, cap); } const remainingCap = wpcLimit - totalUsed; ms = Math.min(ms, remainingCap); rw = Math.min(ms, amt); wr = Math.max(0, wr - rw); totalUsed += rw; rs = "₹" + rw.toFixed(2) + " used"; st = wr <= 0 ? "exhausted-now" : totalUsed >= wpcLimit ? "credit-cap" : "applied"; qt++; }
      return { idx: i + 1, date: tx.date || "—", amount: amt, reward: rw, rateStr: rs, sessStr: ss, status: st, type: "preload", netVal: 0 };
    } else if (offer.reward === "Cashback") {
      if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (offer.wm && amt < parseFloat(offer.wm)) st = "below-min"; else if (offer.wtMode === "first" && ftu) st = "not-first"; else if (offer.sx && sc >= parseInt(offer.sx)) st = "max-sess"; else { sc++; ss = sc;
      if (snV > 0 && sc < snV) { return { idx: i + 1, date: tx.date || "—", amount: amt, reward: 0, rateStr: sc + "/" + snV, sessStr: ss, status: "pending-sn", type: "wallet-cashback", netVal: 0 }; }
      let pct = 0, slabOk = true; if (offer.wtMode === "slab") { const sl = offer.wtSlabs.find(s => { const mn = parseFloat(s.min) || 0, mx = s.max ? parseFloat(s.max) : Infinity; return amt >= mn && amt <= mx; }); if (sl) { pct = parseFloat(sl.pct) || 0; } else { slabOk = false; st = "no-slab"; rw = 0; rs = "No slab"; } } else { const m = offer.tiers.filter(t => parseInt(t.s) === sc); pct = m.length > 0 ? parseFloat(m[0].pct) : parseFloat(offer.tiers[offer.tiers.length - 1]?.pct || 0); }
      if (slabOk) { rw = amt * (pct / 100); rs = pct.toFixed(1) + "%"; if (offer.cy && rw > parseFloat(offer.cy)) { rw = parseFloat(offer.cy); st = "capped"; } else st = "earned"; qt++; } if (offer.wtMode === "first") ftu = true; }
      return { idx: i + 1, date: tx.date || "—", amount: amt, reward: rw, rateStr: rs, sessStr: ss, status: st, type: "wallet-cashback", netVal: 0 };
    } else if (offer.reward === "ChargeXP") {
      if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (offer.wm && amt < parseFloat(offer.wm)) st = "below-min"; else { sc++; ss = sc; qt++; const xr = parseFloat(offer.xpwpct) || 0; rw = amt * xr; rs = xr + " XP/₹"; st = "earned"; }
      return { idx: i + 1, date: tx.date || "—", amount: amt, reward: rw, rateStr: rs, sessStr: ss, status: st, type: "wallet-xp", rewardUnit: "XP", netVal: 0 };
    } else {
      return { idx: i + 1, date: tx.date || "—", amount: amt, reward: 0, rateStr: "—", sessStr: "—", status: "manual", type: "wallet-other", netVal: 0 };
    }
  } else { const u = parseFloat(tx.units) || 0, rt = parseFloat(tx.rate) || 0; netVal = u * rt; const gst = netVal * 0.18, tot = netVal + gst; tn += netVal; tg += tot;
    if (offer.reward === "Cashback") { if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (offer.ctMode === "first" && fsu) st = "not-first"; else if (offer.un && u < parseFloat(offer.un)) st = "below-kwh"; else if (offer.nx && netVal < parseFloat(offer.nx)) st = "below-val"; else if (offer.sx && sc >= parseInt(offer.sx)) st = "max-sess"; else { sc++; ss = sc;
      if (snV > 0 && sc < snV) { return { idx: i + 1, date: tx.date || "—", units: u.toFixed(1), net: netVal, total: tot, sessStr: ss, rateStr: sc + "/" + snV, reward: 0, status: "pending-sn", type: "charging", netVal }; }
      const m = offer.tiers.filter(t => parseInt(t.s) === sc), pct = m.length > 0 ? parseFloat(m[0].pct) : parseFloat(offer.tiers[offer.tiers.length - 1]?.pct || 0); rw = netVal * (pct / 100); rs = pct.toFixed(1) + "%"; if (offer.cy && rw > parseFloat(offer.cy)) { rw = parseFloat(offer.cy); st = "capped"; } else st = "earned"; qt++; fsu = true; }
    } else if (offer.reward === "Discount") { if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (offer.ctMode === "first" && fsu) st = "not-first"; else if (offer.un && u < parseFloat(offer.un)) st = "below-kwh"; else { sc++; ss = sc;
      if (snV > 0 && sc < snV) { return { idx: i + 1, date: tx.date || "—", units: u.toFixed(1), net: netVal, total: tot, sessStr: ss, rateStr: sc + "/" + snV, reward: 0, status: "pending-sn", type: "charging", netVal }; }
      const pct = parseFloat(offer.dpct) || 0; rw = netVal * (pct / 100); rs = pct + "%"; if (offer.dy && rw > parseFloat(offer.dy)) { rw = parseFloat(offer.dy); st = "capped"; } else st = "applied"; qt++; fsu = true; }
    } else st = "manual";
    return { idx: i + 1, date: tx.date || "—", units: u.toFixed(1), net: netVal, total: tot, sessStr: ss, rateStr: rs, reward: rw, status: st, type: "charging", netVal }; }
  }); const ftr = rows.reduce((s, r) => s + (r.reward || 0), 0); const totalNet = rows.reduce((s, r) => s + (r.netVal || 0), 0);
  return { rows, totalReward: ftr, qualTxns: qt, totalGross: tg, totalNet, effRate: tg > 0 ? ftr / tg * 100 : 0, walletRemaining: wr, isPreload: !!offer.wpre, isWalletTopUp: isW, rewardType: offer.wpre ? "Pre-load" : offer.reward }; }
function computeROI(o, r, marginPct) { const { totalReward: tr, totalNet: tNet, qualTxns: qt, effRate: er } = r; const mg = (marginPct || 30) / 100; const isW = o.activity === "Wallet top-up"; const isP = !!o.wpre;
  const rl = isP ? "Pre-load Cost" : o.reward === "ChargeXP" ? "XP Issued" : o.reward === "Discount" ? "Discount Given" : "Cashback Liability";
  // Charging: margin on net revenue (pre-GST), cost = reward
  // Wallet: cost = reward (leading), revenue = unknown (lagging)
  // Pre-load: cost = ₹w (leading), revenue = sessions generated (lagging)
  let marginEarned = 0, netImpact = 0, perSession = 0, breakeven = "—", beUnit = "sessions";
  const avgNet = qt > 0 ? tNet / qt : 0; const avgReward = qt > 0 ? tr / qt : 0;
  if (!isW && !isP) {
    // CHARGING SESSION — direct ROI, margin on net
    marginEarned = tNet * mg;
    netImpact = marginEarned - tr;
    perSession = qt > 0 ? (avgNet * mg) - avgReward : 0;
    if (perSession >= 0) breakeven = "Every session profitable";
    else { const sessToRecover = avgReward / (avgNet * mg); breakeven = Math.ceil(sessToRecover) + " unpaid sessions"; }
  } else if (isP) {
    const preloadCost = parseFloat(o.w) || 0;
    const avgRate = qt > 0 && tNet > 0 ? tNet / qt / 12 : 22; // derive from simulation or fallback
    marginEarned = r.totalGross * mg;
    netImpact = marginEarned - preloadCost;
    const kwhToRecover = preloadCost / (avgRate * mg);
    breakeven = Math.ceil(kwhToRecover) + " kWh charging";
    beUnit = "kWh";
  } else {
    // WALLET TOP-UP — cost is cashback (leading), revenue is future charging (lagging)
    marginEarned = 0;
    netImpact = -tr;
    const avgRate = 22;
    if (tr > 0) { const kwhToRecover = tr / (avgRate * mg); breakeven = Math.ceil(kwhToRecover) + " kWh charging needed"; beUnit = "kWh"; }
    else breakeven = "—";
  }
  const risks = [];
  if (o.reward === "Cashback" && !isP) {
    if (!isW) { const cy = parseFloat(o.cy), ap = o.tiers.reduce((s, t) => s + parseFloat(t.pct || 0), 0) / (o.tiers.length || 1); if (cy && ap > 0 && cy / (ap / 100) > 2000) risks.push({ type: "warn", msg: "Cashback cap of ₹" + o.cy + " only triggers above ₹" + (cy / (ap / 100)).toFixed(0) + " spend — is this intentional?" }); }
    if (isW && o.wtMode === "slab") { const ss = [...o.wtSlabs].sort((a, b) => (parseFloat(a.min) || 0) - (parseFloat(b.min) || 0)); for (let i = 0; i < ss.length - 1; i++) { const cm = parseFloat(ss[i].max) || 0, nm = parseFloat(ss[i + 1].min) || 0; if (cm > 0 && nm > cm + 1) risks.push({ type: "warn", msg: "Gap in slab tiers: ₹" + (cm + 1) + "–₹" + (nm - 1) + " has no cashback rate" }); } }
    if (isW && o.wtMode === "first") risks.push({ type: "ok", msg: "First top-up only — effective for user acquisition" });
    if (parseFloat(o.t) < 45 && o.segments.includes("Dormant")) risks.push({ type: "warn", msg: o.t + " day campaign may be too short for Dormant users to re-engage" });
    if (o.ce && parseFloat(o.ce) < 14) risks.push({ type: "risk", msg: "Cashback expires in just " + o.ce + " days — users may not redeem in time" });
  }
  if (!isW && o.ctMode === "first") risks.push({ type: "ok", msg: "First session only — strong conversion trigger" });
  if (isP) { if ((parseFloat(o.w) || 0) > 500) risks.push({ type: "warn", msg: "₹" + o.w + " pre-load per user is high — ensure targeting is narrow" }); if (o.dist === "single" && o.segments.includes("Dormant")) risks.push({ type: "warn", msg: "Single-use for Dormant users — consider Spread for better engagement" }); }
  if (!isW && !isP) { if (perSession < 0) risks.push({ type: "risk", msg: "Each qualifying session loses ₹" + Math.abs(perSession).toFixed(0) + " — reward exceeds margin" }); else if (perSession > 0) risks.push({ type: "ok", msg: "Each qualifying session earns ₹" + perSession.toFixed(0) + " net margin after reward" }); }
  if (isW && !isP) risks.push({ type: "warn", msg: "Cashback of ₹" + tr.toFixed(0) + " is paid upfront. This cost is only recovered when users charge their EVs." });
  return { avgReward, marginEarned, netImpact, perSession, breakeven, beUnit, risks, liability: tr, rewardLabel: rl, isCharging: !isW && !isP, isWallet: isW && !isP, isPreload: isP }; }
const SB = { earned: ["Earned", "bg-green"], applied: ["Applied", "bg-green"], "exhausted-now": ["Exhausted", "bg-amber"], capped: ["Capped", "bg-amber"], "credit-cap": ["Credit cap", "bg-amber"], expired: ["Expired", "bg-red"], exhausted: ["Exhausted", "bg-muted"], "no-date": ["No date", "bg-muted"], "below-kwh": ["< kWh", "bg-muted"], "below-val": ["< ₹", "bg-muted"], "max-sess": ["Max sess", "bg-muted"], manual: ["Manual", "bg-muted"], "below-min": ["< ₹wm", "bg-muted"], "not-first": ["Not first", "bg-muted"], "no-slab": ["No slab", "bg-muted"], "pending-sn": ["Pending", "bg-blue"] };
const StatusBadge = ({ s }) => { const [l, c] = SB[s] || ["—", "bg-muted"]; return <span className={"sbadge " + c}>{l}</span>; };
const IC={home:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11L12 4l9 7v9a2 2 0 01-2 2h-3v-7h-8v7H5a2 2 0 01-2-2v-9z"/></svg>',layers:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>',cal:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',spark:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',gear:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',bolt:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/></svg>'};
const SvgIcon=({name,size=16})=><span style={{display:"inline-flex",width:size,height:size}} dangerouslySetInnerHTML={{__html:IC[name]||""}}/>;
/* Animated number */
function useAnimatedNumber(target,dur=700){const[v,setV]=useState(0);const from=useRef(0);const start=useRef(null);useEffect(()=>{from.current=v;start.current=null;let raf;const tick=(t)=>{if(!start.current)start.current=t;const p=Math.min(1,(t-start.current)/dur);const e=1-Math.pow(1-p,3);setV(from.current+(target-from.current)*e);if(p<1)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[target]);return v}
const AnimNum=({value,prefix="",suffix=""})=>{const v=useAnimatedNumber(value);return <span>{prefix}{Math.round(v).toLocaleString()}{suffix}</span>};
/* Sparkline */
function MiniSparkline({data,w=120,h=32,stroke="var(--mint)",fill}){if(!data?.length)return null;const max=Math.max(...data),min=Math.min(...data),range=max-min||1;const pts=data.map((v,i)=>{const x=(i/(data.length-1))*w;const y=h-((v-min)/range)*(h-4)-2;return[x,y]});const path=pts.map((p,i)=>(i===0?"M":"L")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");const area=path+" L"+w+" "+h+" L0 "+h+" Z";return<svg width={w} height={h} style={{display:"block",overflow:"visible"}}>{fill&&<path d={area} fill={fill}/>}<path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={stroke}/></svg>}


const css = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--bg:#f7faf8;--bg2:#edf4ef;--bg3:#e3eee7;--paper:#ffffff;--ink:#0f1f1a;--ink2:#3d524a;--ink3:#7d908a;--line:rgba(15,31,26,.08);--line2:rgba(15,31,26,.14);--accent:#00b377;--accent-soft:#dff8ee;--mint:#00d68f;--mint-soft:#dff8ee;--mint-deep:#005a3c;--ok:#00b377;--ok-soft:#dff8ee;--warn:#e89c2b;--warn-soft:#fdf0d8;--bad:#e65c5c;--bad-soft:#fde6e6;--info:#5fa8ff;--info-soft:#e2efff;--purple:#7c69d6;--purple-soft:#ece9f8;--teal:#0eaaa0;--teal-soft:#d9f3f1;--r1:12px;--r2:18px;--r3:24px;--display:'Instrument Serif',Georgia,serif;--ui:'Inter',-apple-system,sans-serif;--mono:'JetBrains Mono',monospace;--font-display:var(--display);--font-ui:var(--ui);--font-mono:var(--mono);--green:var(--ok);--green-bg:var(--ok-soft);--red:var(--bad);--red-bg:var(--bad-soft);--amber:var(--warn);--amber-bg:var(--warn-soft);--blue:var(--info);--blue-bg:var(--info-soft);--text:var(--ink);--text2:var(--ink2);--text3:var(--ink3);--border:var(--line);--border2:var(--line2);--r:var(--r1);--sh:0 1px 0 rgba(15,31,26,.02);--sh-sm:0 1px 2px rgba(15,31,26,.04);--sh-lg:0 30px 60px -30px rgba(15,31,26,.18)}
.dark{--bg:#0a1410;--bg2:#10201a;--bg3:#1a2a23;--paper:#14241e;--ink:#eef7f3;--ink2:#a9bfb6;--ink3:#6e827a;--line:rgba(238,247,243,.07);--line2:rgba(238,247,243,.12);--accent-soft:rgba(0,179,119,.12);--mint-soft:rgba(0,214,143,.12);--ok-soft:rgba(0,179,119,.1);--warn-soft:rgba(232,156,43,.1);--bad-soft:rgba(230,92,92,.1);--info-soft:rgba(95,168,255,.1);--purple-soft:rgba(124,105,214,.1);--teal-soft:rgba(14,170,160,.1);--sh:0 1px 0 rgba(0,0,0,.2);--sh-sm:0 1px 2px rgba(0,0,0,.3);--sh-lg:0 20px 40px rgba(0,0,0,.4)}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--ink);font-family:var(--ui);font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}button{font:inherit;color:inherit;cursor:pointer;border:none;background:none}input,textarea,select{font:inherit;color:inherit}

.pulse-app{font-family:var(--ui);color:var(--ink);background:var(--bg);min-height:100vh}
.pulse-shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.pulse-side{background:var(--bg2);border-right:1px solid var(--line);padding:18px 14px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0;height:100vh;overflow-y:auto}
.pulse-brand{display:flex;align-items:center;gap:10px;padding:6px 8px 22px;font-weight:600;font-size:15px;letter-spacing:-.01em}
.pulse-brand-mark{width:28px;height:28px;border-radius:9px;background:var(--mint);color:var(--mint-deep);display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0;font-family:var(--display)}
.pulse-brand-mark.accent{background:var(--accent)}
.pulse-org{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--line);border-radius:var(--r1);margin-bottom:14px;cursor:pointer;background:var(--paper)}
.pulse-org-avatar{width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--mint),var(--teal));color:var(--mint-deep);display:grid;place-items:center;font-size:10px;font-weight:700}
.pulse-org-name{flex:1;font-size:13px;font-weight:500}
.pulse-org-caret{color:var(--ink3);font-size:11px}
.pulse-sec{padding:14px 10px 6px;font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink3);font-weight:600}
.pulse-nav{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:var(--r1);color:var(--ink2);font-size:13px;cursor:pointer;width:100%;text-align:left;font-weight:500;border:1px solid transparent;transition:background .12s}
.pulse-nav:hover{background:var(--bg3);color:var(--ink)}
.pulse-nav.active{background:var(--mint-soft);color:var(--mint-deep);border-color:transparent}
.pulse-nav-glyph{width:18px;display:inline-flex;font-size:13px;color:var(--ink3)}
.pulse-nav.active .pulse-nav-glyph{color:var(--mint-deep)}
.pulse-nav-badge{margin-left:auto;font-size:10px;background:var(--mint);color:var(--mint-deep);padding:2px 7px;border-radius:10px;font-weight:700}
.pulse-foot{margin-top:auto;padding:14px 8px;border-top:1px solid var(--line);display:flex;align-items:center;gap:10px}
.pulse-foot-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--mint),var(--info));color:#fff;display:grid;place-items:center;font-size:11px;font-weight:600}
.pulse-foot-who{font-size:13px;font-weight:500}
.pulse-foot-role{font-size:11px;color:var(--ink3)}

.pulse-main{min-width:0;height:100vh;overflow-y:auto}
.pulse-top{display:flex;align-items:center;gap:10px;padding:14px 32px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5;backdrop-filter:blur(8px);min-width:0}
.pulse-top > * { flex-shrink: 0; }
.pulse-top .pulse-crumb { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pulse-top-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
.pulse-crumb{font-size:13px;color:var(--ink3);display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pulse-crumb .sep{opacity:.35}
.pulse-crumb .now{color:var(--ink);font-weight:500}
.pulse-top-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:nowrap}
.pulse-content{padding:0 32px 80px;max-width:1280px;width:100%}

.pulse-h{display:flex;justify-content:space-between;align-items:flex-end;padding:32px 0 24px;gap:24px;flex-wrap:wrap}
.pulse-h h1{font-family:var(--display);font-size:42px;font-weight:400;letter-spacing:-.02em;line-height:1.05}
.pulse-h .eyebrow{font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin-bottom:6px}
.pulse-h .lede{font-size:14px;color:var(--ink2);max-width:560px;margin-top:8px;line-height:1.6}

/* Buttons */
.pbtn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:var(--r1);border:1px solid var(--line2);background:var(--paper);color:var(--ink);font-size:13px;font-weight:500;cursor:pointer;transition:all .12s;white-space:nowrap}
.pbtn:hover{background:var(--bg3);border-color:var(--ink3)}
.pbtn.primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.pbtn.primary:hover{background:#000}
.pbtn.accent{background:var(--mint);color:var(--mint-deep);border-color:var(--mint);box-shadow:0 2px 12px rgba(0,179,119,.22);font-weight:600}
.pbtn.accent:hover{background:#00c485}
.pbtn.ghost{border-color:transparent;background:transparent}
.pbtn.ghost:hover{background:var(--bg3)}
.pbtn.sm{padding:6px 12px;font-size:12px;white-space:nowrap}

/* Cards / surfaces */
.pcard{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:24px;box-shadow:0 1px 0 rgba(15,31,26,.02)}
.pcard-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:16px}
.pcard-t{font-family:var(--display);font-size:24px;font-weight:400;letter-spacing:-.01em}
.pcard-sub{font-size:12px;color:var(--ink3);margin-top:2px}

/* Pills / chips */
.pchip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:22px;font-size:11px;font-weight:600;letter-spacing:.01em}
.pchip-dot{width:6px;height:6px;border-radius:50%}
.pchip.live{background:var(--ok-soft);color:var(--ok)}
.pchip.draft{background:var(--bg3);color:var(--ink3)}
.pchip.ready{background:var(--info-soft);color:var(--info)}
.pchip.approved{background:var(--purple-soft);color:var(--purple)}
.pchip.completed{background:var(--bg3);color:var(--ink3)}
.pchip.warn{background:var(--warn-soft);color:var(--warn)}
.pchip.bad{background:var(--bad-soft);color:var(--bad)}
.pchip.ok{background:var(--ok-soft);color:var(--ok)}
.pchip.cashback{background:var(--ok-soft);color:var(--ok)}
.pchip.discount{background:var(--warn-soft);color:var(--warn)}
.pchip.chargexp{background:var(--purple-soft);color:var(--purple)}
.pchip.coupon{background:var(--info-soft);color:var(--info)}
.pchip.preload{background:var(--teal-soft);color:var(--teal)}

/* KPI / metric */
.pmetric{display:flex;flex-direction:column;gap:6px}
.pmetric-label{font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink3);font-weight:600}
.pmetric-val{font-family:var(--display);font-size:38px;font-weight:400;letter-spacing:-.01em;line-height:1}
.pmetric-val.sm{font-size:28px}
.pmetric-sub{font-size:11px;color:var(--ink3)}
.pmetric-delta{font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:3px}
.pmetric-delta.up{color:var(--ok)}
.pmetric-delta.down{color:var(--bad)}

/* Inputs */
.pfld{display:flex;flex-direction:column;gap:5px}
.pfld-l{font-size:11px;color:var(--ink2);font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.pinput{background:var(--paper);border:1px solid var(--line);border-radius:var(--r1);padding:9px 12px;color:var(--ink);font-size:13px;width:100%;transition:border-color .12s,box-shadow .12s}
.pinput:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pinput::placeholder{color:var(--ink3)}

/* Annotation strip beside each scene */
.scene{padding:60px 0;border-bottom:1px dashed var(--line2);position:relative}
.scene-tag{position:absolute;top:18px;right:0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);font-weight:600}
.scene-h{font-family:var(--display);font-size:32px;font-weight:400;letter-spacing:-.015em;margin-bottom:8px}
.scene-sub{font-size:13px;color:var(--ink3);max-width:640px;margin-bottom:28px;line-height:1.7}
.scene-mock{position:relative;border-radius:var(--r3);overflow:hidden;border:1px solid var(--line);background:var(--bg);box-shadow:0 30px 60px -30px rgba(40,30,15,.18),0 1px 3px rgba(40,30,15,.06)}
.scene-notes{margin-top:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.scene-note{padding:16px 18px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r2);position:relative}
.scene-note-tag{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:6px}
.scene-note-t{font-size:13px;font-weight:600;margin-bottom:4px}
.scene-note-d{font-size:12px;color:var(--ink2);line-height:1.55}

/* Scene nav */
.scene-nav{position:sticky;top:0;z-index:20;background:rgba(246,242,234,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:14px 32px;display:flex;align-items:center;gap:6px;overflow-x:auto}
.scene-nav-brand{font-family:var(--display);font-size:18px;margin-right:18px;font-weight:400;letter-spacing:-.01em;flex-shrink:0}
.scene-nav-brand small{font-family:var(--ui);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);font-weight:600;display:block;margin-top:-2px}
.scene-nav-tab{padding:7px 14px;border-radius:18px;font-size:12px;color:var(--ink2);cursor:pointer;font-weight:500;white-space:nowrap;border:1px solid transparent}
.scene-nav-tab:hover{background:var(--bg3)}
.scene-nav-tab.active{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.scene-nav-counter{margin-left:auto;font-size:11px;color:var(--ink3);font-family:var(--mono);flex-shrink:0}

/* Mock viewport — content rendered inside an iframe-like frame */
.mock-frame{position:relative;width:100%;background:var(--bg);min-height:720px}

/* Reveal/animations are minimal — content focused */
.fade-in{animation:fadeIn .5s ease both}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.cover{padding:80px 32px 48px;max-width:1100px;margin:0 auto}
.cover-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:20px}
.cover h1{font-family:var(--display);font-size:84px;font-weight:400;letter-spacing:-.025em;line-height:.95;margin-bottom:16px}
.cover h1 em{font-style:italic;color:var(--ink3)}
.cover-lede{font-size:18px;color:var(--ink2);max-width:680px;line-height:1.55;margin-bottom:36px}
.cover-meta{display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:var(--ink3);padding-top:24px;border-top:1px solid var(--line)}
.cover-meta b{color:var(--ink);font-weight:600}

.cover-pains{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:48px}
.cover-pain{padding:20px 22px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r2)}
.cover-pain-num{font-family:var(--display);font-size:40px;color:var(--accent);line-height:1;margin-bottom:10px}
.cover-pain-t{font-size:13px;font-weight:600;margin-bottom:4px}
.cover-pain-d{font-size:12px;color:var(--ink2);line-height:1.55}

/* Misc layout helpers used inside scenes */
.row{display:flex;align-items:center;gap:8px}
.col{display:flex;flex-direction:column;gap:8px}
.spread{display:flex;justify-content:space-between;align-items:center;gap:12px}
.divider{height:1px;background:var(--line);margin:14px 0}
.muted{color:var(--ink3)}
.mono{font-family:var(--mono)}
.serif{font-family:var(--display)}
.b{font-weight:600}

/* Compat aliases for existing components */
.app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.sidebar{composes:pulse-side}
.card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:24px;margin-bottom:16px;box-shadow:var(--sh)}
.card-title{font-family:var(--display);font-size:24px;font-weight:400;letter-spacing:-.01em;margin-bottom:16px}
.seg-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px}
.seg-card{border:1px solid var(--line);border-radius:var(--r2);padding:16px;cursor:pointer;transition:all .12s;background:var(--paper)}.seg-card:hover{border-color:var(--line2);box-shadow:var(--sh-sm)}.seg-card.selected{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 3px rgba(0,179,119,.1)}.seg-card-icon{font-size:22px;margin-bottom:8px}.seg-card-name{font-weight:600;font-size:14px;margin-bottom:3px}.seg-card-desc{font-size:12px;color:var(--ink3);margin-bottom:8px}.seg-card-insight{font-size:11px;color:var(--ink2);line-height:1.5;padding-top:8px;border-top:1px solid var(--line);font-style:italic}
.csv-zone{margin-top:14px;padding:18px;border:1px dashed var(--line2);border-radius:var(--r2);background:var(--bg2);cursor:pointer;text-align:center}.csv-zone:hover{border-color:var(--teal);background:var(--teal-soft)}.csv-zone.has{border-color:var(--teal);border-style:solid;background:var(--teal-soft)}.csv-logic{margin-top:10px;display:flex;gap:8px;align-items:center;font-size:12px;color:var(--ink3)}
.field{display:flex;flex-direction:column;gap:5px}.field-label{font-size:12px;color:var(--ink2);font-weight:500}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
input[type=text],input[type=number],input[type=date],input[type=password],select,textarea{background:var(--paper);border:1px solid var(--line);border-radius:var(--r1);padding:9px 12px;color:var(--ink);font-size:13px;width:100%;transition:border-color .12s}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}input::placeholder{color:var(--ink3)}select{cursor:pointer}
.preload-box{margin-top:16px;padding:18px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r2)}.toggle-row{display:flex;align-items:center;justify-content:space-between}.toggle-label{font-size:13px;font-weight:600}.toggle-sub{font-size:11px;color:var(--ink3)}.toggle-track{width:42px;height:24px;border-radius:12px;background:var(--bg3);cursor:pointer;position:relative;transition:.2s;flex-shrink:0}.toggle-track.on{background:var(--ok)}.toggle-thumb{position:absolute;width:18px;height:18px;border-radius:50%;top:3px;left:3px;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.12)}.toggle-track.on .toggle-thumb{transform:translateX(18px)}
.dist-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.dist-item{border:1px solid var(--line);border-radius:var(--r2);padding:14px;cursor:pointer;transition:all .12s;background:var(--paper)}.dist-item:hover{border-color:var(--line2)}.dist-item.selected{border-color:var(--ok);background:var(--ok-soft)}.dist-item-title{font-size:12px;font-weight:600;margin-bottom:3px}.dist-item-desc{font-size:11px;color:var(--ink3)}
.act-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.act-item{border:1px solid var(--line);border-radius:var(--r3);padding:18px;cursor:pointer;transition:all .12s;background:var(--paper)}.act-item:hover{box-shadow:var(--sh-sm)}.act-item.selected{border-color:var(--accent);background:var(--accent-soft)}.act-item-icon{font-size:24px;margin-bottom:8px}.act-item-title{font-size:14px;font-weight:600;margin-bottom:3px}.act-item-vars{font-size:12px;color:var(--ink3)}
.rwd-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}.rwd-item{border:1px solid var(--line);border-radius:var(--r2);padding:16px;cursor:pointer;transition:all .12s;background:var(--paper)}.rwd-item:hover{box-shadow:var(--sh-sm)}.rwd-item.selected{border-color:var(--accent);background:var(--accent-soft)}.rwd-item.disabled{opacity:.25;pointer-events:none}.rwd-item-name{font-size:14px;font-weight:600;margin-bottom:3px}.rwd-item-formula{font-size:12px;color:var(--ink3)}
.rwd-disabled{padding:14px 16px;background:var(--ok-soft);border:1px solid rgba(0,179,119,.15);border-radius:var(--r1);font-size:13px;color:var(--mint-deep);margin-bottom:18px;line-height:1.6}
.rwd-config{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r2);padding:18px 22px;margin-top:8px}.rwd-config-title{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-bottom:16px}
.tier-hdr,.tier-row{display:grid;grid-template-columns:80px 1fr 28px;gap:10px;margin-bottom:8px;align-items:center}.tier-hdr span{font-size:10px;color:var(--ink3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.wt-box{margin-top:18px;padding:18px 20px;border:1px solid rgba(0,179,119,.2);border-radius:var(--r2);background:var(--accent-soft)}.wt-title{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mint-deep);margin-bottom:14px}
.wt-modes{display:flex;gap:8px;margin-bottom:14px}.wt-mode{padding:7px 16px;border-radius:18px;border:1px solid var(--line2);background:var(--paper);color:var(--ink2);font-size:12px;cursor:pointer;font-weight:500;transition:all .12s}.wt-mode:hover{border-color:var(--ink3)}.wt-mode.active{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.slab-hdr,.slab-row{display:grid;grid-template-columns:80px 80px 70px 28px;gap:8px;margin-bottom:6px;align-items:center}.slab-hdr span{font-size:10px;color:var(--ink3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.bc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.bc-note{font-size:12px;color:var(--ink2);margin-top:14px;padding:12px 16px;background:var(--bg2);border-left:3px solid var(--accent);border-radius:0 var(--r1) var(--r1) 0;line-height:1.6}
.sum-card{border:1px solid var(--line);border-radius:var(--r3);overflow:hidden;margin-bottom:18px;box-shadow:var(--sh)}.sum-hdr{padding:18px 24px;background:var(--bg2);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}.sum-name{font-family:var(--display);font-size:22px}
.badge{font-size:10px;padding:4px 12px;border-radius:22px;font-weight:600}.bg-cashback{background:var(--ok-soft);color:var(--ok)}.bg-discount{background:var(--warn-soft);color:var(--warn)}.bg-xp{background:var(--purple-soft);color:var(--purple)}.bg-coupon{background:var(--info-soft);color:var(--info)}.bg-preload{background:var(--teal-soft);color:var(--teal)}
.sum-body{padding:24px}.sum-plain{font-size:14px;line-height:1.9;color:var(--ink2);margin-bottom:24px;padding:18px 20px;background:var(--bg2);border-radius:var(--r1);border-left:3px solid var(--accent)}.sum-plain strong{color:var(--accent);font-weight:600}
.vtable{width:100%;border-collapse:collapse}.vtable th{font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3);text-align:left;padding:8px 12px;border-bottom:1px solid var(--line)}.vtable td{padding:8px 12px;border-bottom:1px solid var(--line);font-size:13px}.vtable tr:last-child td{border-bottom:none}.vtable tr:hover td{background:var(--bg2)}
.result-tbl{width:100%;border-collapse:collapse;font-size:12px}.result-tbl th{font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3);text-align:left;padding:10px;border-bottom:1px solid var(--line)}.result-tbl td{padding:10px;border-bottom:1px solid var(--line);color:var(--ink2)}.result-tbl tr:last-child td{border-bottom:none}.result-tbl tr:hover td{background:var(--bg2)}.result-tbl td.rval{color:var(--accent);font-family:var(--mono);font-weight:600}
.sbadge{font-size:10px;padding:3px 10px;border-radius:22px;font-weight:500;display:inline-block}.bg-green{background:var(--ok-soft);color:var(--ok)}.bg-amber{background:var(--warn-soft);color:var(--warn)}.bg-red{background:var(--bad-soft);color:var(--bad)}.bg-blue{background:var(--info-soft);color:var(--info)}.bg-muted{background:var(--bg3);color:var(--ink3)}
.risk-item{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-radius:var(--r1);margin-bottom:8px;font-size:13px;line-height:1.6}.risk-item.risk{background:var(--bad-soft);color:var(--bad)}.risk-item.warn{background:var(--warn-soft);color:var(--warn)}.risk-item.ok{background:var(--ok-soft);color:var(--ok)}
.btn-row{display:flex;gap:10px;margin-top:22px}.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:var(--r1);border:1px solid var(--line2);background:var(--paper);color:var(--ink);font-size:13px;font-weight:500;cursor:pointer;transition:all .12s}.btn:hover{background:var(--bg3);border-color:var(--ink3)}.btn-primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}.btn-primary:hover{background:#000}.btn-dashed{width:100%;padding:10px;border:1px dashed var(--line2);border-radius:var(--r1);background:none;font-size:12px;color:var(--ink3);cursor:pointer;font-weight:500;margin-top:8px;transition:all .12s}.btn-dashed:hover{border-color:var(--accent);color:var(--accent)}.del-btn{background:none;border:none;color:var(--ink3);cursor:pointer;font-size:15px;transition:color .12s}.del-btn:hover{color:var(--bad)}.scroll-x{overflow-x:auto}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.mc{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:18px;box-shadow:var(--sh)}.mc-label{font-size:10px;font-weight:600;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}.mc-val{font-family:var(--display);font-size:30px;font-weight:400;letter-spacing:-.01em}.mc-sub{font-size:11px;color:var(--ink3);margin-top:5px}
.offers-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.offer-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:18px;cursor:pointer;transition:all .12s;position:relative}.offer-card:hover{box-shadow:0 12px 32px -16px rgba(15,31,26,.18)}.offer-card.active{border-color:var(--accent)}.offer-card-actions{position:absolute;top:12px;right:12px;display:flex;gap:4px;opacity:0;transition:opacity .12s}.offer-card:hover .offer-card-actions{opacity:1}.offer-card-actions button{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--paper);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink3)}.offer-card-actions button:hover{background:var(--bg3);color:var(--ink)}.offer-card-actions button.del:hover{color:var(--bad)}
.offer-card-type{display:flex;align-items:center;gap:8px;margin-bottom:10px}.offer-card-dot{width:8px;height:8px;border-radius:50%}.offer-card-label{font-size:10px;color:var(--ink3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}.offer-card-name{font-family:var(--display);font-size:20px;margin-bottom:4px;letter-spacing:-.01em}.offer-card-segs{font-size:12px;color:var(--ink3)}
.add-card{border:1px dashed var(--line2);border-radius:var(--r3);padding:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink3);font-size:14px;font-weight:500;min-height:120px;transition:all .12s}.add-card:hover{border-color:var(--accent);color:var(--mint-deep);background:var(--accent-soft)}
.campaign-list{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}.campaign-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:22px;cursor:pointer;transition:all .12s;position:relative}.campaign-card:hover{box-shadow:0 12px 32px -16px rgba(15,31,26,.18)}.campaign-card-name{font-family:var(--display);font-size:26px;letter-spacing:-.01em;margin-bottom:6px}.campaign-card-meta{font-size:12px;color:var(--ink3);display:flex;gap:14px}
.steps{display:flex;gap:0;margin-bottom:20px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r2);padding:4px;overflow-x:auto}.step{flex:1;padding:10px 8px;font-size:12px;cursor:pointer;color:var(--ink3);text-align:center;border-radius:var(--r1);transition:all .12s;white-space:nowrap;font-weight:500}.step:hover{color:var(--ink2)}.step.active{background:var(--paper);color:var(--ink);box-shadow:var(--sh-sm)}.step.done{color:var(--ok)}.step.incomplete{color:var(--bad)}
.wif-grid{display:grid;grid-template-columns:320px 1fr;gap:22px}.wif-knobs{display:flex;flex-direction:column;gap:14px}.wif-knob{background:var(--paper);border:1px solid var(--line);border-radius:var(--r2);padding:16px 18px}.wif-knob-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}.wif-knob-label{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3);font-weight:600}.wif-knob-val{font-family:var(--display);font-size:26px;letter-spacing:-.01em}.wif-knob-val .unit{font-size:13px;color:var(--ink3);margin-left:2px}.wif-track{height:6px;background:var(--bg3);border-radius:3px;position:relative;cursor:pointer;margin:10px 0}.wif-track-fill{position:absolute;top:0;left:0;bottom:0;background:var(--accent);border-radius:3px}.wif-track-thumb{position:absolute;top:50%;width:18px;height:18px;border-radius:50%;background:var(--paper);border:2px solid var(--accent);transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,.18)}.wif-knob-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--ink3)}.wif-result{display:flex;flex-direction:column;gap:14px}.wif-headline{background:linear-gradient(180deg,var(--paper),var(--bg2));border:1px solid var(--line);border-radius:var(--r3);padding:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px}.wif-headline-block{padding-right:20px;border-right:1px solid var(--line)}.wif-headline-block:last-child{border-right:none;padding-right:0}.wif-headline-label{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin-bottom:8px}.wif-headline-val{font-family:var(--display);font-size:32px;letter-spacing:-.015em;line-height:1}.wif-headline-delta{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--ink3)}.wif-chip{font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:12px;font-weight:600}.wif-chip.up{background:var(--ok-soft);color:var(--ok)}.wif-chip.down{background:var(--bad-soft);color:var(--bad)}.wif-narrative{background:var(--accent-soft);border:1px solid rgba(0,179,119,.15);border-radius:var(--r2);padding:16px 18px;font-size:13px;color:var(--ink2);line-height:1.7}.wif-narrative b{font-weight:600;color:var(--mint-deep)}
.db-summary{background:linear-gradient(180deg,var(--paper),var(--bg2));border:1px solid var(--line);border-radius:var(--r3);padding:22px 24px;margin-bottom:20px;display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:22px;align-items:center}.db-status{border-right:1px solid var(--line);padding-right:22px}.db-status-orb{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:20px;margin-bottom:8px}.db-status-orb.healthy{background:var(--ok-soft);color:var(--ok)}.db-status-orb.caution{background:var(--warn-soft);color:var(--warn)}.db-status-orb.risk{background:var(--bad-soft);color:var(--bad)}.db-status-text{font-family:var(--display);font-size:20px;line-height:1.1;margin-bottom:4px}.db-status-sub{font-size:11px;color:var(--ink3)}.db-metric{padding-right:18px;border-right:1px solid var(--line)}.db-metric:last-child{border-right:none}.db-metric-label{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);font-weight:600;margin-bottom:6px}.db-metric-val{font-family:var(--display);font-size:28px;letter-spacing:-.01em}.db-metric-delta{font-size:11px;margin-top:5px;font-weight:500}.db-metric-delta.up{color:var(--ok)}.db-metric-delta.down{color:var(--bad)}
.gantt{border:1px solid var(--line);border-radius:var(--r3);overflow:hidden;box-shadow:var(--sh)}.gantt-header{position:relative;height:42px;border-bottom:1px solid var(--line);background:var(--bg2)}.gantt-group{padding:14px 24px;font-size:12px;color:var(--ink2);font-weight:600;background:var(--bg2);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}.gantt-group-meta{font-weight:400;font-size:11px;color:var(--ink3)}.gantt-row{position:relative;height:54px;border-bottom:1px solid var(--line);cursor:pointer;transition:background .1s}.gantt-row:hover{background:var(--bg2)}.gantt-bar{position:absolute;top:9px;bottom:9px;border-radius:var(--r1);display:flex;align-items:center;padding-left:12px;gap:8px;font-size:12px;font-weight:500;overflow:hidden;white-space:nowrap}.gantt-bar-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}.gantt-today{position:absolute;top:0;bottom:0;width:1px;background:var(--accent);z-index:2}.gantt-today-label{position:absolute;top:4px;left:-12px;transform:translateX(-50%);font-size:9px;letter-spacing:.10em;text-transform:uppercase;color:var(--accent);font-weight:700;background:var(--paper);padding:1px 6px;border-radius:8px;border:1px solid var(--accent)}
.sched-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}.sched-stat{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:16px 18px;box-shadow:var(--sh)}.sched-stat-label{font-size:10px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}.sched-stat-val{font-family:var(--display);font-size:28px;letter-spacing:-.02em}.sched-stat-sub{font-size:11px;color:var(--ink3);margin-top:3px}
.empty-workspace{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;text-align:center;padding:40px 20px}.empty-icon{width:72px;height:72px;border-radius:20px;background:var(--accent-soft);display:grid;place-items:center;font-size:32px;margin-bottom:20px}.empty-title{font-family:var(--display);font-size:32px;font-weight:400;margin-bottom:8px;letter-spacing:-.01em}.empty-desc{font-size:14px;color:var(--ink3);max-width:420px;line-height:1.6;margin-bottom:24px}.empty-actions{display:flex;gap:10px;margin-bottom:32px}
.quickstart{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:680px;width:100%}.quickstart-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:20px;text-align:left;cursor:pointer;transition:all .12s}.quickstart-card:hover{box-shadow:0 12px 32px -16px rgba(15,31,26,.18)}.quickstart-icon{font-size:20px;margin-bottom:10px}.quickstart-title{font-size:14px;font-weight:600;margin-bottom:4px}.quickstart-desc{font-size:12px;color:var(--ink3);line-height:1.5}
.ship-card{background:linear-gradient(180deg,var(--bg2),var(--bg));border:1px solid var(--line);border-radius:var(--r3);padding:28px;margin-top:20px;box-shadow:var(--sh)}.ship-title{font-family:var(--display);font-size:24px;margin-bottom:8px;font-weight:400}.ship-desc{font-size:13px;color:var(--ink3);margin-bottom:20px;line-height:1.6}.ship-options{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.ship-opt{border:1px solid var(--line);border-radius:var(--r2);padding:18px;cursor:pointer;transition:all .12s;text-align:center;background:var(--paper)}.ship-opt:hover{border-color:var(--accent);box-shadow:var(--sh-sm)}.ship-opt-icon{font-size:24px;margin-bottom:8px}.ship-opt-title{font-size:13px;font-weight:600;margin-bottom:3px}.ship-opt-desc{font-size:11px;color:var(--ink3)}
.save-indicator{font-size:11px;color:var(--ink3);display:flex;align-items:center;gap:4px}.save-indicator.saving{color:var(--accent)}.save-indicator.saved{color:var(--ok)}
.theme-toggle{width:34px;height:20px;border-radius:10px;background:var(--bg3);cursor:pointer;position:relative;transition:.2s;border:1px solid var(--line);flex-shrink:0}.theme-toggle .thumb{position:absolute;width:14px;height:14px;border-radius:50%;top:2px;left:2px;background:var(--ink3);transition:.2s}.dark .theme-toggle .thumb{transform:translateX(14px);background:var(--accent)}
.modal-overlay{position:fixed;inset:0;background:rgba(15,31,26,.35);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px)}.modal{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:30px;max-width:460px;width:92%;box-shadow:var(--sh-lg)}.modal-title{font-family:var(--display);font-size:24px;margin-bottom:8px;font-weight:400}.modal-msg{font-size:13px;color:var(--ink2);margin-bottom:22px;line-height:1.6}.modal-actions{display:flex;gap:10px;justify-content:flex-end}
.login-page{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;background:var(--bg)}.login-hero{background:var(--bg2);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 40px;border-right:1px solid var(--line)}.login-hero-mark{width:60px;height:60px;border-radius:16px;background:var(--accent);display:grid;place-items:center;color:var(--mint-deep);font-weight:700;font-size:22px;margin-bottom:24px;font-family:var(--display)}.login-hero h2{font-family:var(--display);font-size:42px;text-align:center;line-height:1.05;margin-bottom:12px;font-weight:400;letter-spacing:-.02em}.login-hero p{font-size:15px;color:var(--ink2);text-align:center;max-width:360px;line-height:1.6}
.login-form{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 40px}.login-card{max-width:380px;width:100%}.login-title{font-family:var(--display);font-size:28px;text-align:center;margin-bottom:4px;font-weight:400}.login-sub{font-size:13px;color:var(--ink3);text-align:center;margin-bottom:30px}
.login-field{margin-bottom:18px}.login-field label{display:block;font-size:11px;font-weight:600;color:var(--ink2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
.login-err{padding:12px 16px;background:var(--bad-soft);border-radius:var(--r1);font-size:13px;color:var(--bad);margin-bottom:18px;text-align:center}
.login-btn{width:100%;padding:14px;background:var(--accent);border:none;border-radius:var(--r1);color:var(--mint-deep);font-size:14px;font-weight:600;cursor:pointer;transition:all .12s;margin-top:8px;box-shadow:0 2px 12px rgba(0,179,119,.22)}.login-btn:hover{background:var(--mint)}.login-btn:disabled{opacity:.5;cursor:not-allowed}
.ai-overlay{position:fixed;inset:0;background:rgba(15,31,26,.3);z-index:30;opacity:0;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(4px)}.ai-overlay.open{opacity:1;pointer-events:auto}
.ai-drawer{position:fixed;top:0;right:-360px;width:360px;height:100vh;background:var(--paper);border-left:1px solid var(--line);z-index:31;display:flex;flex-direction:column;transition:right .25s ease;box-shadow:var(--sh-lg)}.ai-drawer.open{right:0}
.ai-hdr{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.ai-hdr-t{font-family:var(--display);font-size:18px;display:flex;align-items:center;gap:10px;font-weight:400;color:var(--mint-deep)}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px rgba(0,179,119,.4);animation:pulse-g 2s infinite}@keyframes pulse-g{0%,100%{opacity:1}50%{opacity:.4}}
.ai-x{background:none;border:none;color:var(--ink3);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:8px;transition:all .1s}.ai-x:hover{background:var(--bg3);color:var(--ink)}
.ai-body{flex:1;overflow-y:auto;padding:18px}.ai-msg{margin-bottom:14px;padding:14px 16px;border-radius:var(--r2);font-size:13px;line-height:1.7;color:var(--ink2)}.ai-msg.bot{background:var(--bg2);border:1px solid var(--line)}.ai-msg.user{background:var(--ink);color:var(--bg);border-radius:var(--r2) var(--r2) 4px var(--r2)}.ai-msg strong{color:var(--mint-deep);font-weight:600}.ai-msg code{font-family:var(--mono);font-size:11px;background:var(--bg3);padding:2px 5px;border-radius:6px}
.ai-dots{display:flex;align-items:center;gap:8px;padding:14px;color:var(--accent);font-size:12px}.ai-dots i{width:6px;height:6px;border-radius:50%;background:var(--accent);display:inline-block;animation:blink 1.2s infinite;opacity:.3}.ai-dots i:nth-child(2){animation-delay:.2s}.ai-dots i:nth-child(3){animation-delay:.4s}@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}
.ai-ftr{padding:16px;border-top:1px solid var(--line)}.ai-ftr-row{display:flex;gap:8px}.ai-inp{flex:1;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r1);padding:10px 12px;color:var(--ink);font-size:12px}.ai-inp:focus{outline:none;border-color:var(--accent)}.ai-go{background:var(--accent);border:none;border-radius:var(--r1);color:var(--mint-deep);font-size:12px;padding:8px 16px;cursor:pointer;font-weight:600;box-shadow:0 2px 6px rgba(0,179,119,.15)}.ai-go:hover{background:var(--mint)}
.ai-qa{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.ai-qa button{padding:5px 12px;font-size:11px;border:1px solid var(--line);border-radius:22px;background:var(--paper);color:var(--ink3);cursor:pointer;font-weight:500;transition:all .12s}.ai-qa button:hover{border-color:var(--accent);color:var(--accent)}
.page-hdr{padding:32px 0 24px}.page-hdr h1{font-family:var(--display);font-size:42px;font-weight:400;letter-spacing:-.02em;line-height:1.05}.page-hdr-sub{font-size:13px;color:var(--ink3);cursor:pointer;display:flex;align-items:center;gap:4px;margin-bottom:6px}.page-hdr-sub:hover{color:var(--ink)}
@media(max-width:900px){.app,.pulse-shell{grid-template-columns:1fr}.pulse-side,.sidebar{position:fixed;top:0;left:0;right:0;bottom:auto;height:auto;flex-direction:row;gap:4px;padding:8px 10px;overflow-x:auto;border-right:none;border-bottom:1px solid var(--line);z-index:20}.pulse-sec,.pulse-foot,.pulse-brand,.pulse-org,.sb-section,.sb-foot,.sb-org,.sb-brand{display:none}.pulse-nav,.sb-item{white-space:nowrap;font-size:11px;padding:8px 12px;border-radius:8px}.pulse-main,.main-area{padding-top:50px;height:auto}.pulse-content,.content{padding:0 16px 60px}.seg-cards,.offers-grid{grid-template-columns:1fr}.grid2,.bc-grid,.act-grid,.rwd-grid,.dist-grid{grid-template-columns:1fr}.metrics,.sched-stats{grid-template-columns:1fr 1fr}.steps{flex-wrap:nowrap}.step{min-width:70px;flex-shrink:0}.ai-drawer{width:100%;right:-100%}.campaign-list{grid-template-columns:1fr}.wif-grid{grid-template-columns:1fr}.wif-headline,.db-summary{grid-template-columns:1fr}.wif-headline-block,.db-status,.db-metric{border-right:none;border-bottom:1px solid var(--line);padding:0 0 14px}.wif-headline-block:last-child,.db-metric:last-child{border-bottom:none}.login-page{grid-template-columns:1fr}.login-hero{display:none}.ship-options,.quickstart{grid-template-columns:1fr}}
@media(min-width:901px){.mobile-bar{display:none}}
::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:var(--bg3);border-radius:10px;border:2px solid var(--bg)}::-webkit-scrollbar-thumb:hover{background:var(--ink3)}

/* Studio layout */
.studio{display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start}
.studio-left{display:flex;flex-direction:column;gap:0}
.studio-right{position:sticky;top:80px}
.studio-section{border:1px solid var(--line);border-radius:var(--r3);background:var(--paper);margin-bottom:12px;overflow:hidden}
.studio-section-head{display:flex;align-items:center;gap:14px;padding:18px 24px;cursor:pointer;transition:background .12s}
.studio-section-head:hover{background:var(--bg2)}
.studio-section-num{font-size:14px;color:var(--ink3);font-weight:500;width:24px;flex-shrink:0}
.studio-section-title{font-family:var(--display);font-size:22px;font-weight:400;flex:1}
.studio-section-chip{font-size:11px;padding:3px 10px;border-radius:12px;font-weight:600}
.studio-section-chip.filled{background:var(--ok-soft);color:var(--ok)}
.studio-section-chip.empty{background:var(--bg3);color:var(--ink3)}
.studio-section-arrow{color:var(--ink3);font-size:14px;transition:transform .2s}
.studio-section-arrow.open{transform:rotate(180deg)}
.studio-section-summary{font-size:12px;color:var(--ink3);padding:0 24px 14px 62px}
.studio-section-body{padding:6px 24px 24px 24px;border-top:1px solid var(--line)}
.studio-insight{margin:12px 0;padding:14px 18px;background:var(--accent-soft);border-radius:var(--r2);font-size:13px;color:var(--ink2);line-height:1.6}
.studio-insight b{color:var(--accent);font-weight:600}
.preview-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);padding:24px;box-shadow:var(--sh)}
.preview-tabs{display:inline-flex;gap:4px;padding:4px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r2);margin-bottom:20px}
.preview-tab{padding:8px 16px;border-radius:var(--r1);font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:var(--ink3)}.preview-tab.active{background:var(--ink);color:var(--bg)}
.preview-section-label{font-size:10px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:var(--ink3);margin:20px 0 10px}
.preview-plain{font-size:14px;line-height:1.7;color:var(--ink2)}.preview-plain b{color:var(--ink);font-weight:600}
.preview-outcome{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.preview-outcome-val{font-family:var(--display);font-size:44px;letter-spacing:-.02em;line-height:1}
.preview-outcome-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.preview-outcome-item{font-size:12px}.preview-outcome-item .label{color:var(--ink3);margin-bottom:2px}.preview-outcome-item .val{font-family:var(--mono);font-weight:600;font-size:13px}
.preview-risk{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);font-size:12.5px;line-height:1.5}.preview-risk:last-child{border-bottom:none}
.preview-risk-dot{width:16px;height:16px;border-radius:6px;display:grid;place-items:center;font-size:10px;flex-shrink:0;margin-top:2px}
.sim-button{display:block;width:100%;padding:16px;background:var(--ink);color:var(--bg);border:none;border-radius:var(--r2);font-size:14px;font-weight:600;cursor:pointer;margin-top:20px;text-align:center;transition:background .12s}.sim-button:hover{background:#000}
/* Campaign Canvas */
.offer-table{background:var(--paper);border:1px solid var(--line);border-radius:var(--r3);overflow:hidden}
.offer-table-head{display:grid;grid-template-columns:1fr 100px 130px 140px 100px 130px 60px;padding:12px 22px;border-bottom:1px solid var(--line);background:var(--bg2);font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink3);font-weight:600;gap:12px}
.offer-table-row{display:grid;grid-template-columns:1fr 100px 130px 140px 100px 130px 60px;padding:16px 22px;border-bottom:1px solid var(--line);align-items:center;gap:12px;cursor:pointer;transition:background .12s}.offer-table-row:hover{background:var(--bg2)}.offer-table-row:last-child{border-bottom:none}
.offer-table-add{padding:14px 22px;border-top:1px solid var(--line);cursor:pointer;color:var(--ink3);font-size:13px;font-weight:500;text-align:center;transition:color .12s}.offer-table-add:hover{color:var(--accent)}
.bar-wrap{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden}.bar-fill{height:100%;border-radius:2px}
.composition-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}
@media(max-width:900px){.studio{grid-template-columns:1fr}.studio-right{position:static}.offer-table-head,.offer-table-row{grid-template-columns:1fr;gap:4px}.composition-grid{grid-template-columns:1fr}}

/* Scale Impact inside preview rail — single column */
.preview-card .wif-grid{grid-template-columns:1fr;gap:16px}
.preview-card .wif-headline{grid-template-columns:1fr;gap:12px}
.preview-card .wif-headline-block{border-right:none;border-bottom:1px solid var(--line);padding:0 0 12px}
.preview-card .wif-headline-block:last-child{border-bottom:none;padding-bottom:0}
.preview-card .wif-knob-val{font-size:20px}
.preview-card .wif-headline-val{font-size:24px}
.preview-card .wif-knob{padding:12px 14px}
.preview-card .metrics{grid-template-columns:1fr 1fr}
.preview-card .mc{padding:12px}
.preview-card .mc-val{font-size:20px}
.preview-card .result-tbl{font-size:11px}
.preview-card .result-tbl th,.preview-card .result-tbl td{padding:6px 8px}
.preview-card .card{padding:14px;margin-bottom:10px}
.preview-card .card-title{font-size:16px;margin-bottom:10px}

/* Simulation fields inside preview rail */
.preview-card .txn-hdr,.preview-card .txn-row{grid-template-columns:1fr 1fr 1fr 28px;gap:6px;margin-bottom:4px}
.preview-card .txn-hdr span{font-size:9px}
.preview-card input[type=date],.preview-card input[type=number]{padding:8px 10px;font-size:12px}
.preview-card .sample-btn{padding:10px;font-size:12px;margin-bottom:10px}
.preview-card .btn-dashed{padding:8px;font-size:11px}
.preview-card .scroll-x{overflow-x:auto}
`;





/* ── API helpers ── */
async function api(path, opts = {}) {
  const r = await fetch("/api" + path, { ...opts, headers: { "Content-Type": "application/json", ...opts.headers }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

/* ── Login Page ── */
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try { const d = await api("/auth?action=login", { method: "POST", body: { username, password } }); onLogin(d.user); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  return <div className="login-page">
    <div className="login-hero"><div className="login-hero-mark"><SvgIcon name="bolt" size={28}/></div><h2>Loyalty that pays back</h2><p>The simplest way to design, simulate and ship reward campaigns for your charging network. Friendly enough for marketing, sharp enough for finance.</p></div>
    <div className="login-form"><div className="login-card">
    <div className="login-title">Sign in to OfferOS</div>
    <div className="login-sub">Enter your credentials to continue</div>
    {err && <div className="login-err">{err}</div>}
    <form onSubmit={submit}>
      <div className="login-field"><label>Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoFocus /></div>
      <div className="login-field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" /></div>
      <button type="submit" className="login-btn" disabled={loading || !username || !password}>{loading ? "Signing in..." : "Sign in"}</button>
    </form>
  </div></div></div>;
}

/* ── Home Dashboard ── */
function HomeDashboard({ campaigns, allOffers }) {
  const SEGMENTS_ALL = ["New","Dormant","Engaged","Existing"];
  const rewardTypes = {}; const segCoverage = {}; let totalProjectedCost = 0; let simmedOffers = 0; let unsimmed = 0; let hasAll = false;
  allOffers.forEach(o => { const tp = o.wpre ? "Pre-load" : (o.reward || "Cashback"); rewardTypes[tp] = (rewardTypes[tp] || 0) + 1; (o.segments || []).forEach(s => { if(s==="All")hasAll=true; segCoverage[s] = (segCoverage[s] || 0) + 1; }); if (o.simResult) { totalProjectedCost += o.simResult.totalReward || 0; simmedOffers++; } else { unsimmed++; } });
  const coveredCount = hasAll ? SEGMENTS_ALL.length : Object.keys(segCoverage).filter(s => s !== "All").length;
  const uncovered = hasAll ? [] : SEGMENTS_ALL.filter(s => !segCoverage[s]);
  const liveOffers = allOffers.filter(o=>getOfferStatus(o)==="live");
  const conflicts = detectConflicts(allOffers);
  const conflictCount = Math.round(Object.keys(conflicts).length / 2);
  const needsAttention = [];
  allOffers.forEach(o=>{if(o.simResult&&o.simRoi){if(o.simRoi.netImpact<0)needsAttention.push({type:"bad",title:o.name,reason:"Net loss of ₹"+Math.abs(o.simRoi.netImpact).toFixed(0)+" per simulation",action:"Review rates"});if(o.simRoi.risks)o.simRoi.risks.filter(r=>r.type==="risk").forEach(r=>needsAttention.push({type:"bad",title:o.name,reason:r.msg,action:"Fix now"}))}if(!o.simResult&&o.offerStatus!=="draft")needsAttention.push({type:"warn",title:o.name,reason:"Not simulated yet — costs unknown",action:"Run simulation"})});

  return <div>
    <div className="pulse-h"><div>
      <div className="eyebrow">ChargeZone · India</div>
      <h1>Good morning.</h1>
      <div className="lede">{campaigns.length} campaign{campaigns.length!==1?"s":""} active. <b style={{color:"var(--ink)"}}>{allOffers.length} offers</b> configured{simmedOffers>0?" — "+simmedOffers+" simulated":""}.</div>
    </div></div>

    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",gap:14,marginBottom:16}}>
      <div className="pcard" style={{padding:"22px 26px"}}>
        <div className="spread" style={{marginBottom:14}}>
          <div className="pmetric-label">Active campaigns</div>
          <span className="pchip ok">{campaigns.length} running</span>
        </div>
        <div className="pmetric-val">{campaigns.length}</div>
        <div className="muted" style={{fontSize:11,marginTop:6}}>{allOffers.length} offers across all campaigns</div>
      </div>
      <div className="pcard">
        <div className="pmetric-label">Total offers</div>
        <div className="pmetric-val">{allOffers.length}</div>
        <div className="muted" style={{fontSize:11,marginTop:6}}>{simmedOffers} simulated, {unsimmed} pending</div>
      </div>
      <div className="pcard">
        <div className="pmetric-label">Projected reward cost</div>
        <div className="pmetric-val" style={{color:totalProjectedCost>0?"var(--bad)":"var(--ink3)"}}>₹{totalProjectedCost.toLocaleString()}</div>
        <div className="muted" style={{fontSize:11,marginTop:6}}>across {simmedOffers} simulated offers</div>
      </div>
      <div className="pcard">
        <div className="pmetric-label">Segments covered</div>
        <div className="pmetric-val">{coveredCount}/{SEGMENTS_ALL.length}</div>
        <div className="muted" style={{fontSize:11,marginTop:6}}>{uncovered.length>0?"Missing: "+uncovered.join(", "):"All covered"}</div>
      </div>
    </div>

    {needsAttention.length>0&&<div className="pcard" style={{marginBottom:24,padding:"18px 24px"}}>
      <div className="spread" style={{marginBottom:12}}>
        <div className="row" style={{gap:10}}>
          <span style={{fontFamily:"var(--display)",fontSize:18}}>Needs your attention</span>
          <span className="pchip warn">{needsAttention.length}</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:needsAttention.length>1?"1fr 1fr":"1fr",gap:14}}>
        {needsAttention.slice(0,4).map((a,i)=><div key={i} className="row" style={{padding:"14px 16px",background:"var(--bg)",borderRadius:"var(--r2)",border:"1px solid var(--line)",gap:14}}>
          <div style={{width:6,height:36,background:a.type==="bad"?"var(--bad)":"var(--warn)",borderRadius:3,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div className="b" style={{fontSize:13,marginBottom:2}}>{a.title}</div>
            <div className="muted" style={{fontSize:12}}>{a.reason}</div>
          </div>
          <button className="pbtn sm">{a.action}</button>
        </div>)}
      </div>
    </div>}

    {Object.keys(rewardTypes).length>0&&<div style={{marginBottom:24}}>
      <div className="pmetric-label" style={{marginBottom:10}}>Reward distribution</div>
      <div className="row" style={{gap:8,flexWrap:"wrap"}}>{Object.entries(rewardTypes).map(([tp,ct])=><span key={tp} className="pchip" style={{background:"var(--bg3)",color:"var(--ink2)",fontSize:11}}><span className="pchip-dot" style={{background:DOT_COLORS[tp]||"var(--ink3)"}}/>{tp}: {ct}</span>)}</div>
    </div>}
  </div>;
}

function ScheduleView({ allOffers, campaigns, onOpenOffer }) {
  const [scale, setScale] = useState("month");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const grouped = {};
  campaigns.forEach(c => { grouped[c._id] = { name: c.name, offers: [] }; });
  allOffers.forEach(o => { if (grouped[o.campaignId]) grouped[o.campaignId].offers.push(o); });
  // Stats
  const activeCount = allOffers.filter(o => getOfferStatus(o) === "active").length;
  const scheduledCount = allOffers.filter(o => getOfferStatus(o) === "scheduled").length;
  const expiredCount = allOffers.filter(o => getOfferStatus(o) === "expired").length;
  const totalCost = allOffers.reduce((s, o) => s + (o.simResult?.totalReward || 0), 0);
  // Date range
  const allDates = allOffers.filter(o => o.startDate).map(o => {
    const sd = new Date(o.startDate); const ed = getOfferEndDate(o); return [sd, ed];
  }).flat();
  if (allDates.length === 0) allDates.push(new Date(today.getTime() - 7 * 86400000), new Date(today.getTime() + 60 * 86400000));
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())) - 7 * 86400000);
  const spanDays = scale === "week" ? 21 : scale === "quarter" ? 90 : 45;
  const maxDate = new Date(minDate.getTime() + spanDays * 86400000);
  const totalMs = maxDate.getTime() - minDate.getTime();
  const pct = (d) => Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / totalMs) * 100));
  const dateLabels = [];
  for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + (scale === "week" ? 1 : scale === "quarter" ? 7 : 3))) {
    dateLabels.push({ date: new Date(d), pct: pct(d) });
  }
  const todayPct = pct(today);
  return <div>
    <div className="pulse-h"><h1>Schedule</h1><div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>All offers across campaigns on a timeline</div></div>
    <div className="sched-stats">
      <div className="sched-stat"><div className="sched-stat-label">Active</div><div className="sched-stat-val" style={{color:"var(--green)"}}>{activeCount}</div><div className="sched-stat-sub">running now</div></div>
      <div className="sched-stat"><div className="sched-stat-label">Scheduled</div><div className="sched-stat-val" style={{color:"var(--blue)"}}>{scheduledCount}</div><div className="sched-stat-sub">upcoming</div></div>
      <div className="sched-stat"><div className="sched-stat-label">Expired</div><div className="sched-stat-val">{expiredCount}</div><div className="sched-stat-sub">completed</div></div>
      <div className="sched-stat"><div className="sched-stat-label">Total reward cost</div><div className="sched-stat-val" style={{color:totalCost>0?"var(--red)":"var(--text3)"}}>₹{totalCost.toLocaleString()}</div><div className="sched-stat-sub">from simulations</div></div>
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {["week", "month", "quarter"].map(s => <button key={s} className={"wt-mode " + (scale === s ? "active" : "")} onClick={() => setScale(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>)}
    </div>
    {allOffers.length === 0 ? <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No offers created yet.</div> :
      <div className="gantt">
        <div className="gantt-header">
          {dateLabels.map((dl, i) => <span key={i} style={{ position: "absolute", left: dl.pct + "%", transform: "translateX(-50%)", top: 12, whiteSpace: "nowrap" }}>{dl.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>)}
          {todayPct > 0 && todayPct < 100 && <div className="gantt-today" style={{left:todayPct+"%"}}><div className="gantt-today-label">Today</div></div>}
        </div>
        {Object.entries(grouped).map(([cId, cData]) => {
          if (cData.offers.length === 0) return null;
          const campCost = cData.offers.reduce((s, o) => s + (o.simResult?.totalReward || 0), 0);
          return <div key={cId}>
            <div className="gantt-group"><span>{cData.name}</span><span className="gantt-group-meta">{cData.offers.length} offers{campCost > 0 ? " · ₹" + campCost.toLocaleString() : ""}</span></div>
            {cData.offers.map(o => {
              const st = getOfferStatus(o); const sd = o.startDate ? new Date(o.startDate) : today; const ed = getOfferEndDate(o);
              const left = pct(sd); const right = pct(ed); const width = Math.max(right - left, 1);
              const tp = o.wpre ? "Pre-load" : o.reward;
              return <div key={o._id || o.id} className="gantt-row" onClick={() => onOpenOffer && onOpenOffer(o)} title={o.name + " · " + st + " · " + (o.segments || []).join(", ")}>
                <div className="gantt-bar" style={{ left: Math.max(left, 0) + "%", width: width + "%", minWidth: 24, background: STATUS_BG[st], border: "1px solid " + STATUS_COLORS[st] + "40", color: STATUS_COLORS[st], ...(st === "paused" ? { backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, " + STATUS_COLORS[st] + "15 3px, " + STATUS_COLORS[st] + "15 6px)" } : {}) }}>
                  <span className="gantt-bar-dot" style={{ background: DOT_COLORS[tp] || "var(--text3)" }} />{o.name}
                </div>
              </div>;
            })}
          </div>;
        })}
      </div>
    }
  </div>;
}

function CampaignsList({ campaigns, onSelect, onNew, onArchive }) {
  const [delId,setDelId]=useState(null);const delName=campaigns.find(c=>c._id===delId)?.name||"";
  return <div>
    <div className="pulse-h" style={{padding:"8px 0 18px"}}>
      <div>
        <div className="eyebrow">Portfolio</div>
        <h1 style={{fontSize:30}}>Campaigns</h1>
      </div>
      <div className="row" style={{gap:8}}>
        <button className="pbtn accent sm" onClick={onNew}>+ New Campaign</button>
      </div>
    </div>
    <div className="campaign-list">
      {campaigns.map(c => {
        const st = c.status || "draft";
        return <div key={c._id} className="pcard" style={{cursor:"pointer",position:"relative"}} onClick={()=>onSelect(c)}
          onMouseEnter={e=>e.currentTarget.style.boxShadow="0 12px 32px -16px rgba(15,31,26,.20)"}
          onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
          <button style={{position:"absolute",top:12,right:12,width:28,height:28,borderRadius:8,border:"1px solid var(--line)",background:"var(--paper)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--ink3)"}} onClick={e=>{e.stopPropagation();setDelId(c._id)}}>×</button>
          <div className="spread" style={{marginBottom:12}}>
            <span className={"pchip "+(st==="live"?"live":"draft")}><span className="pchip-dot" style={{background:st==="live"?"var(--ok)":"var(--ink3)"}}/>{st==="live"?"Live":"Draft"}</span>
            <span className="muted" style={{fontSize:11}}>Margin {c.marginPct||30}%</span>
          </div>
          <div className="serif" style={{fontSize:26,letterSpacing:"-.01em",marginBottom:6}}>{c.name}</div>
          <div className="muted" style={{fontSize:12}}>{c.offerCount||0} offers &nbsp;·&nbsp; Margin {c.marginPct||30}% &nbsp;·&nbsp; Updated {c.updatedAt?new Date(c.updatedAt).toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"}):""}</div>
        </div>;
      })}
    </div>
    {campaigns.length===0&&<div className="empty-workspace">
      <div className="empty-icon">⚡</div>
      <div className="empty-title">Welcome to your workspace</div>
      <div className="empty-desc">This is where your campaigns live. Create your first campaign to start building offers.</div>
      <div className="empty-actions"><button className="pbtn accent" onClick={onNew}>Create your first campaign</button></div>
      <div className="quickstart">
        <div className="quickstart-card" onClick={onNew}><div className="quickstart-icon">🎯</div><div className="quickstart-title">Acquisition</div><div className="quickstart-desc">Bring new users to their first session</div></div>
        <div className="quickstart-card" onClick={onNew}><div className="quickstart-icon">🔄</div><div className="quickstart-title">Re-engagement</div><div className="quickstart-desc">Win back dormant users</div></div>
        <div className="quickstart-card" onClick={onNew}><div className="quickstart-icon">📈</div><div className="quickstart-title">Growth</div><div className="quickstart-desc">Increase frequency and wallet adoption</div></div>
      </div>
    </div>}
    {delId&&<ConfirmModal title="Archive campaign?" msg={'"'+delName+'" will be archived.'} onConfirm={()=>{onArchive(delId);setDelId(null)}} onCancel={()=>setDelId(null)}/>}
  </div>;
}


function APIKeyModal({onClose}){const[key,setKey]=useState(getApiKey()),[saved,setSaved]=useState(false);const save=()=>{setApiKeyVal(key.trim());setSaved(true);setTimeout(onClose,500)};const has=!!getApiKey();return<div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title">AI Configuration</div><div className="modal-msg">Enter your Anthropic API key. Stays in browser memory only — never stored.</div><input type="password" value={key} onChange={e=>{setKey(e.target.value);setSaved(false)}} placeholder="sk-ant-api03-..." style={{marginBottom:8}}/><div style={{fontSize:10,color:"var(--text3)",marginBottom:16,lineHeight:1.5}}>Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style={{color:"var(--accent)"}}>console.anthropic.com</a></div><div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,marginBottom:16}}><span style={{width:7,height:7,borderRadius:"50%",background:has?"var(--green)":"var(--text3)",display:"inline-block"}}/>{has?"Key configured":"No key set"}</div><div className="modal-actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{saved?"✓ Saved":"Save"}</button></div></div></div>}
function ConfirmModal({title,msg,onConfirm,onCancel}){return<div className="modal-overlay" onClick={onCancel}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title">{title}</div><div className="modal-msg">{msg}</div><div className="modal-actions"><button className="btn" onClick={onCancel}>Cancel</button><button className="btn" style={{borderColor:"var(--red)",color:"var(--red)"}} onClick={onConfirm}>Delete</button></div></div></div>}

function AudienceStep({offer,update}){const fr=useRef();const toggle=seg=>{let s=[...offer.segments];if(seg==="All")s=["All"];else{s=s.filter(x=>x!=="All");const i=s.indexOf(seg);if(i>-1)s.splice(i,1);else s.push(seg)}update({segments:s})};const hc=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const ls=ev.target.result.trim().split("\n").filter(Boolean);const ids=ls.slice(1).map(l=>l.split(",")[0].trim()).filter(Boolean);update({rc:ids,rcFileName:f.name,rcCount:ids.length})};r.readAsText(f)};return<div className="card"><div className="card-title">Who's this for?</div><div style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Select one or more customer segments to target with this offer</div><div className="seg-cards">{Object.entries(SEGMENTS).map(([k,v])=><div key={k} className={`seg-card ${offer.segments.includes(k)?"selected":""}`} onClick={()=>toggle(k)}><div className="seg-card-icon">{v.icon}</div><div className="seg-card-name">{v.label}</div><div className="seg-card-desc">{v.desc}</div><div className="seg-card-insight">{v.insight}</div></div>)}</div><div className={`csv-zone ${offer.rc?"has":""}`} onClick={()=>!offer.rc&&fr.current?.click()}><input ref={fr} type="file" accept=".csv" style={{display:"none"}} onChange={hc}/>{offer.rc?<><div style={{fontSize:11,color:"var(--teal)",fontWeight:600}}>✓ {offer.rcFileName} — {offer.rcCount} users loaded</div><button className="btn" style={{marginTop:8,padding:"4px 12px",fontSize:10}} onClick={e=>{e.stopPropagation();update({rc:null,rcFileName:"",rcCount:0})}}>Remove</button></>:<div style={{fontSize:12,color:"var(--text3)"}}>Upload a CSV to narrow targeting to specific user IDs</div>}</div>{offer.rc&&<div className="csv-logic"><label>Combine with segments using:</label><select value={offer.rcLogic} onChange={e=>update({rcLogic:e.target.value})} style={{width:"auto",fontSize:11}}><option value="intersection">Intersection (must match both)</option><option value="union">Union (match either)</option></select></div>}
  {offer.segments.length>0&&<div style={{marginTop:20}}>
    <div style={{fontSize:11,fontWeight:600,letterSpacing:".04em",textTransform:"uppercase",color:"var(--accent)",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>✦ Recommended offer patterns</div>
    <div style={{display:"grid",gap:8}}>
      {[...new Set(offer.segments)].flatMap(s=>SEGMENT_SUGGESTIONS[s]||[]).filter((v,i,a)=>a.findIndex(x=>x.title===v.title)===i).slice(0,3).map((sg,i)=><div key={i} style={{padding:"12px 16px",border:"1px solid var(--border)",borderRadius:"var(--r2)",background:"var(--bg2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div><div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{sg.title}</div><div style={{fontSize:12,color:"var(--text3)",lineHeight:1.5}}>{sg.desc}</div></div>
          <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"var(--bg3)",color:"var(--text2)",flexShrink:0,fontWeight:600,whiteSpace:"nowrap"}}>{sg.reward} · {sg.activity}</span>
        </div>
      </div>)}
    </div>
  </div>}
</div>}

function ActivityStep({offer,update,setTxns}){
  const sa=a=>{const c={activity:a};if(a!=="Wallet top-up"){c.wpre=false;c.wtMode="none";}if(a!=="Charging session"){c.ctMode="off";}if(!REWARDS_FOR[a].includes(offer.reward))c.reward=REWARDS_FOR[a][0];update(c);setTxns(defaultTxns(a))};
  const segs=offer.segments;const hasNew=segs.includes("New");const hasDormant=segs.includes("Dormant");const hasAll=segs.includes("All");
  const ctHint=hasNew&&hasDormant?"For New: first-ever charge. For Dormant: first session back.":hasNew?"First-ever charging session on the platform.":hasDormant?"First session back after 90+ days.":hasAll?"First qualifying session for any user.":"First qualifying charging session in this campaign.";
  const wtHint=hasNew?"First top-up after signup — drives early commitment.":hasDormant?"First top-up back to re-establish wallet habit.":hasAll?"First qualifying wallet top-up for any user.":"First qualifying wallet top-up in this campaign.";
  return<div className="card"><div className="card-title">What earns the reward?</div><div style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Choose the customer action and set behavioural triggers</div>
    <div className="act-grid">
      <div className={`act-item ${offer.activity==="Charging session"?"selected":""}`} onClick={()=>sa("Charging session")}><div className="act-item-icon">⚡</div><div className="act-item-title">Charging session</div><div className="act-item-vars">Reward when user charges their EV</div></div>
      <div className={`act-item ${offer.activity==="Wallet top-up"?"selected":""}`} onClick={()=>sa("Wallet top-up")}><div className="act-item-icon">💳</div><div className="act-item-title">Wallet top-up</div><div className="act-item-vars">Reward when user adds money to wallet</div></div>
    </div>
    {offer.activity==="Charging session"&&<div className="preload-box" style={{marginTop:16}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Reward only on first charge</div><div style={{fontSize:11,color:"var(--text3)"}}>Each user earns this reward once — on their first qualifying session</div></div><div className={"toggle-track "+(offer.ctMode==="first"?"on":"")} onClick={()=>update({ctMode:offer.ctMode==="first"?"off":"first"})}><div className="toggle-thumb"/></div></div>{offer.ctMode==="first"&&<div style={{fontSize:11,color:"var(--text2)",padding:"10px 14px",background:"var(--bg3)",borderRadius:"var(--r)",borderLeft:"3px solid var(--accent)",lineHeight:1.7,marginTop:10}}>{ctHint}</div>}</div>}
    {offer.activity==="Wallet top-up"&&<><div className="preload-box" style={{marginTop:16}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Reward only on first top-up</div><div style={{fontSize:11,color:"var(--text3)"}}>Cashback applies only to the user's very first wallet top-up</div></div><div className={"toggle-track "+(offer.wtMode==="first"?"on":"")} onClick={()=>update({wtMode:offer.wtMode==="first"?"none":"first"})}><div className="toggle-thumb"/></div></div>{offer.wtMode==="first"&&<div style={{fontSize:11,color:"var(--text2)",padding:"10px 14px",background:"var(--bg3)",borderRadius:"var(--r)",borderLeft:"3px solid var(--accent)",lineHeight:1.7,marginTop:10}}>{wtHint}</div>}</div>
      <div className="preload-box" style={{marginTop:12}}><div className="toggle-row"><div><div className="toggle-label">Pre-load wallet balance</div><div className="toggle-sub">Give users free balance as the incentive itself</div></div><div className={`toggle-track ${offer.wpre?"on":""}`} onClick={()=>update({wpre:!offer.wpre,...(!offer.wpre?{cy:"",dy:""}:{})})}><div className="toggle-thumb"/></div></div>{offer.wpre&&<div style={{marginTop:14}}><div className="grid2" style={{marginBottom:12}}><div className="field"><div className="field-label">Pre-loaded amount (₹)</div><input type="number" value={offer.w} placeholder="200" onChange={e=>update({w:e.target.value})}/></div><div className="field"><div className="field-label">Validity starts from</div><select value={offer.wa} onChange={e=>update({wa:e.target.value})}><option>Campaign start date</option><option>App download date</option><option>Segment trigger date</option></select></div></div><div className="field-label" style={{marginBottom:6}}>How should the balance be used?</div><div className="dist-grid"><div className={`dist-item ${offer.dist==="spread"?"selected":""}`} onClick={()=>update({dist:"spread"})}><div className="dist-item-title">Spread across sessions</div><div className="dist-item-desc">Capped amount per session</div></div><div className={`dist-item ${offer.dist==="single"?"selected":""}`} onClick={()=>update({dist:"single"})}><div className="dist-item-title">Single use</div><div className="dist-item-desc">Full balance in one session</div></div></div>
        {offer.dist==="spread"&&<div style={{marginTop:12}}><div style={{fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--text3)",marginBottom:10}}>Distribution rules</div><div className="grid2" style={{marginBottom:10}}><div className="field"><div className="field-label">Maximum spend per session</div><div className="grid2"><select value={offer.wsxType} onChange={e=>update({wsxType:e.target.value})} style={{fontSize:11}}><option value="fixed">Fixed ₹</option><option value="pct">% of balance</option></select><input type="number" value={offer.wsx} placeholder="50" onChange={e=>update({wsx:e.target.value})}/></div>{offer.wsxType==="pct"&&offer.wsx&&offer.w&&<div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>= ₹{(parseFloat(offer.wsx)/100*parseFloat(offer.w)).toFixed(2)} per session</div>}</div><div className="field"><div className="field-label">Maximum sessions allowed</div><input type="number" value={offer.sx} placeholder="No limit" onChange={e=>update({sx:e.target.value})}/><div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>Total number of sessions that can draw from this balance</div></div></div><div className="grid2"><div className="field"><div className="field-label">Minimum charge per session (kWh)</div><input type="number" value={offer.wpun} placeholder="No minimum" onChange={e=>update({wpun:e.target.value})}/><div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>User must charge at least this much to use pre-loaded balance</div></div><div className="field"><div className="field-label">Total credit cap (₹)</div><input type="number" value={offer.wpc} placeholder={offer.w||"Full balance"} onChange={e=>update({wpc:e.target.value})}/><div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{offer.wpc&&offer.w?"₹"+offer.wpc+" of ₹"+offer.w+" usable":"Maximum total amount usable across all sessions"}</div></div></div></div>}
        {offer.dist==="single"&&<div style={{marginTop:12}}><div className="field" style={{maxWidth:240}}><div className="field-label">Minimum charge required (kWh)</div><input type="number" value={offer.wpun} placeholder="No minimum" onChange={e=>update({wpun:e.target.value})}/><div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>User must charge at least this much to use the full pre-loaded balance</div></div></div>}
      </div>}</div></>}
  </div>}


function RewardStep({offer,update}){const ip=offer.wpre,vr=REWARDS_FOR[offer.activity]||[],isW=offer.activity==="Wallet top-up";const allR=[{k:"Cashback",f:isW?"Percentage back on top-up amount":"Percentage back on charging amount"},{k:"Discount",f:"Percentage off charging cost"},{k:"ChargeXP",f:"Loyalty points per ₹ spent"},{k:"Coupon",f:"Promotional code"}];const ut=(i,f,v)=>{const t=[...offer.tiers];t[i]={...t[i],[f]:v};update({tiers:t})};const us=(i,f,v)=>{const s=[...offer.wtSlabs];s[i]={...s[i],[f]:v};update({wtSlabs:s})};return<div className="card"><div className="card-title">What do they get?</div><div style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Choose the reward type and configure rates</div>{ip&&<div className="rwd-disabled">Pre-loaded wallet is active — the wallet balance <strong style={{color:"var(--teal)"}}>is the reward</strong>. No additional reward needed.</div>}<div style={{opacity:ip?.3:1,pointerEvents:ip?"none":"auto"}}><div className="rwd-grid">{allR.map(r=><div key={r.k} className={`rwd-item ${offer.reward===r.k&&!ip?"selected":""} ${!vr.includes(r.k)?"disabled":""}`} onClick={()=>vr.includes(r.k)&&update({reward:r.k,...(r.k!=="Cashback"?{cy:""}:{}),...(r.k!=="Discount"?{dy:""}:{})})}><div className="rwd-item-name">{r.k}</div><div className="rwd-item-formula">{r.f}</div>{!vr.includes(r.k)&&<div style={{fontSize:9,color:"var(--red)",marginTop:4}}>Not available for {offer.activity}</div>}</div>)}</div>{!ip&&offer.reward==="Cashback"&&<div className="rwd-config"><div className="rwd-config-title">{isW?"Cashback rates — increases with each top-up":"Cashback rates — increases with each session"}</div><div className="tier-hdr"><span>{isW?"Top-up #":"Session #"}</span><span>Cashback %</span><span/></div>{offer.tiers.map((t,i)=><div key={i} className="tier-row"><input type="number" value={t.s} min="1" onChange={e=>ut(i,"s",e.target.value)}/><input type="number" value={t.pct} placeholder="%" onChange={e=>ut(i,"pct",e.target.value)}/><button className="del-btn" onClick={()=>update({tiers:offer.tiers.filter((_,j)=>j!==i)})}>×</button></div>)}<button className="btn-dashed" onClick={()=>update({tiers:[...offer.tiers,{s:String(offer.tiers.length+1),pct:""}]})}>+ Add tier</button></div>}{!ip&&offer.reward==="Discount"&&<div className="rwd-config"><div className="rwd-config-title">Discount rate</div><div className="field" style={{maxWidth:200}}><div className="field-label">Discount percentage</div><input type="number" value={offer.dpct} placeholder="15" onChange={e=>update({dpct:e.target.value})}/></div></div>}{!ip&&offer.reward==="ChargeXP"&&<div className="rwd-config"><div className="rwd-config-title">Loyalty points</div><div className="field" style={{maxWidth:240}}><div className="field-label">XP earned per ₹ spent</div><input type="number" value={offer.xpwpct} placeholder="1" onChange={e=>update({xpwpct:e.target.value})}/></div></div>}{!ip&&offer.reward==="Coupon"&&<div className="rwd-config"><div className="rwd-config-title">Promo code</div><div className="field" style={{maxWidth:240}}><div className="field-label">Coupon code</div><input type="text" value={offer.p} placeholder="CHARGE20" onChange={e=>update({p:e.target.value})}/></div></div>}</div>{isW&&!ip&&offer.reward==="Cashback"&&<div className="wt-box"><div className="wt-title">Wallet top-up cashback tiers</div>{offer.wtMode==="first"?<div style={{fontSize:11,color:"var(--teal)",padding:"8px 0",lineHeight:1.6}}>✓ First top-up only is active (set in Behaviour step). Slab tiers not available with first-only mode.</div>:<><div className="wt-modes"><button className={`wt-mode ${offer.wtMode==="none"?"active":""}`} onClick={()=>update({wtMode:"none"})}>Off</button><button className={`wt-mode ${offer.wtMode==="slab"?"active":""}`} onClick={()=>update({wtMode:"slab"})}>Amount-based tiers</button></div>{offer.wtMode==="slab"&&<div><div className="slab-hdr"><span>Min ₹</span><span>Max ₹</span><span>Rate %</span><span/></div>{offer.wtSlabs.map((sl,i)=><div key={i} className="slab-row"><input type="number" value={sl.min} placeholder="100" onChange={e=>us(i,"min",e.target.value)}/><input type="number" value={sl.max} placeholder="No limit" onChange={e=>us(i,"max",e.target.value)}/><input type="number" value={sl.pct} placeholder="%" onChange={e=>us(i,"pct",e.target.value)}/><button className="del-btn" onClick={()=>update({wtSlabs:offer.wtSlabs.filter((_,j)=>j!==i)})}>×</button></div>)}<button className="btn-dashed" onClick={()=>update({wtSlabs:[...offer.wtSlabs,{min:"",max:"",pct:""}]})}>+ Add tier</button></div>}</>}</div>}</div>}

function BoundaryStep({offer,update}){const fs=[];let note="";if(offer.wpre){fs.push({k:"wm",l:"Minimum wallet balance (₹)",v:offer.wm});const parts=["Pre-loaded ₹"+(offer.w||"—")];parts.push(offer.dist==="spread"?"Spread across sessions":"Single use");if(offer.sx)parts.push("Max "+offer.sx+" sessions");if(offer.wpun)parts.push("Min "+offer.wpun+" kWh/session");if(offer.wpc)parts.push("Credit cap ₹"+offer.wpc);if(offer.wsx)parts.push("₹"+(offer.wsxType==="pct"?(parseFloat(offer.wsx)/100*parseFloat(offer.w||0)).toFixed(0):offer.wsx)+"/session");note=parts.join(" · ")}else if(offer.activity==="Charging session"){fs.push({k:"un",l:"Minimum charge required (kWh)",v:offer.un},{k:"ux",l:"Maximum charge allowed (kWh)",v:offer.ux},{k:"nx",l:"Minimum transaction value (₹)",v:offer.nx});if(offer.reward==="Cashback")fs.push({k:"cy",l:"Maximum cashback per session (₹)",v:offer.cy});if(offer.reward==="Discount")fs.push({k:"dy",l:"Maximum discount per session (₹)",v:offer.dy});fs.push({k:"sn",l:"Sessions before reward starts",v:offer.sn},{k:"sx",l:"Maximum rewarded sessions",v:offer.sx})}else{fs.push({k:"wm",l:"Minimum top-up amount (₹)",v:offer.wm});if(offer.reward==="Cashback")fs.push({k:"cy",l:"Maximum cashback per top-up (₹)",v:offer.cy})}return<div className="card"><div className="card-title">What are the limits?</div><div style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Set guardrails to control eligibility and cap your costs</div><div className="bc-grid">{fs.map(f=><div key={f.k} className="field"><div className="field-label">{f.l}</div><input type="number" value={f.v||""} placeholder="No limit" onChange={e=>update({[f.k]:e.target.value})}/></div>)}</div>{note&&<div className="bc-note">{note}</div>}</div>}

function DurationStep({offer,update}){const sc=offer.reward==="Cashback"&&!offer.wpre;return<div className="card"><div className="card-title">How long does it run?</div><div style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Set the campaign window and when earned rewards expire</div><div className="grid2" style={{marginBottom:14}}><div className="field"><div className="field-label">Start date</div><input type="date" value={offer.startDate||""} onChange={e=>update({startDate:e.target.value})}/></div><div className="field"><div className="field-label">Campaign duration (days)</div><input type="number" value={offer.t} onChange={e=>update({t:e.target.value})}/></div></div><div className="grid2" style={{marginBottom:sc?14:0}}><div className="field"><div className="field-label">Hard expiry date</div><input type="date" value={offer.te} onChange={e=>update({te:e.target.value})}/></div>{sc&&<div className="field"><div className="field-label">Cashback expires after (days)</div><input type="number" value={offer.ce} onChange={e=>update({ce:e.target.value})}/></div>}</div></div>}

function SummaryStep({offer,campaignName}){const[viewMode,setViewMode]=useState("business");const[copied,setCopied]=useState("");
  const segs=offer.segments.length?offer.segments.join(", "):"—";let bg,bl;if(offer.wpre){bg="bg-preload";bl="Pre-load"}else{[bg,bl]=BADGE_MAP[offer.reward]||["bg-coupon","Coupon"]}const isW=offer.activity==="Wallet top-up";
  let pl="";if(offer.wpre)pl="Pre-loads <strong>₹"+offer.w+"</strong> into wallets for <strong>"+segs+"</strong> users. "+(offer.dist==="spread"?"Balance spreads across multiple sessions.":"Full balance available in one session.")+" Runs for <strong>"+offer.t+" days</strong> from "+offer.wa+".";else if(isW&&offer.reward==="Cashback"){const md=offer.wtMode==="first"?" Only the <strong>first wallet top-up</strong> earns cashback.":offer.wtMode==="slab"?" Cashback rate depends on top-up amount: "+offer.wtSlabs.map(s=>"₹"+s.min+"–"+(s.max||"∞")+" gets "+s.pct+"%").join(", ")+".":"Cashback increases with each top-up: "+offer.tiers.map(t=>"top-up #"+t.s+" earns "+t.pct+"%").join(", ")+".";pl="<strong>Cashback on wallet top-ups</strong> for <strong>"+segs+"</strong>."+md+(offer.cy?" Maximum <strong>₹"+offer.cy+"</strong> cashback per top-up.":"")+" Campaign runs <strong>"+offer.t+" days</strong>."}else if(offer.reward==="Cashback"){const td=offer.tiers.map(t=>"session #"+t.s+" earns "+t.pct+"%").join(", ");const ctNote=offer.ctMode==="first"?" <strong>First charging session only</strong> — each user earns this once.":"";pl="<strong>Cashback on charging</strong> for <strong>"+segs+"</strong>."+ctNote+" Rate steps up: "+td+". "+(offer.un?"Minimum <strong>"+offer.un+" kWh</strong> per charge. ":"")+(offer.cy?"Capped at <strong>₹"+offer.cy+"</strong> per session. ":"")+"Runs <strong>"+offer.t+" days</strong>."+(offer.ce?" Cashback expires <strong>"+offer.ce+" days</strong> after earning.":"")}else if(offer.reward==="Discount"){const ctNote=offer.ctMode==="first"?" <strong>First session only.</strong>":"";pl="<strong>"+offer.dpct+"% discount on charging</strong> for <strong>"+segs+"</strong>."+ctNote+(offer.dy?" Capped at <strong>₹"+offer.dy+"</strong>.":"")+" Runs <strong>"+offer.t+" days</strong>."}else if(offer.reward==="ChargeXP")pl="<strong>"+offer.xpwpct+" XP per ₹</strong> spent on wallet top-ups for <strong>"+segs+"</strong>. Runs <strong>"+offer.t+" days</strong>.";else pl="Coupon code <strong>"+offer.p+"</strong> for <strong>"+segs+"</strong>. Runs <strong>"+offer.t+" days</strong>.";
  // Tech spec rows
  const rows=[{v:"r",p:"Segment",val:segs}];if(offer.rc)rows.push({v:"rc",p:"Custom cohort",val:offer.rcCount+" users ("+offer.rcLogic+")"});rows.push({v:"activity",p:"Trigger",val:offer.activity});if(offer.wpre){rows.push({v:"wpre",p:"Pre-load",val:"Yes"},{v:"w",p:"Amount",val:"₹"+offer.w},{v:"wa",p:"Anchor",val:offer.wa});if(offer.dist==="spread"&&offer.wsx)rows.push({v:"wsx",p:"Cap/session",val:offer.wsxType==="pct"?offer.wsx+"%":"₹"+offer.wsx});if(offer.sx)rows.push({v:"sx",p:"Max sessions",val:offer.sx});if(offer.wpun)rows.push({v:"wpun",p:"Min kWh/session",val:offer.wpun+" kWh"});if(offer.wpc)rows.push({v:"wpc",p:"Total credit cap",val:"₹"+offer.wpc})}else{rows.push({v:"reward",p:"Type",val:offer.reward});if(offer.reward==="Cashback")offer.tiers.forEach(t=>rows.push({v:"c%",p:(isW?"Top-up":"Session")+" "+t.s,val:t.pct+"%"}));if(offer.reward==="Discount")rows.push({v:"d%",p:"Rate",val:offer.dpct+"%"});if(offer.reward==="ChargeXP")rows.push({v:"xpw%",p:"XP rate",val:offer.xpwpct+" XP/₹"});if(offer.reward==="Coupon")rows.push({v:"p",p:"Code",val:offer.p});if(offer.wtMode==="first")rows.push({v:"wt",p:"Wallet trigger",val:"First top-up only"});if(offer.wtMode==="slab")rows.push({v:"wt",p:"Wallet slabs",val:offer.wtSlabs.map(s=>"₹"+s.min+"-"+(s.max||"∞")+": "+s.pct+"%").join(", ")});if(offer.ctMode==="first")rows.push({v:"ct",p:"Charging trigger",val:"First session only"})}if(offer.un&&!offer.wpre&&!isW)rows.push({v:"un",p:"Min kWh",val:offer.un});if(offer.cy&&offer.reward==="Cashback"&&!offer.wpre)rows.push({v:"cy",p:"Cashback cap",val:"₹"+offer.cy});if(offer.dy&&offer.reward==="Discount")rows.push({v:"dy",p:"Discount cap",val:"₹"+offer.dy});if(offer.wm)rows.push({v:"wm",p:"Min balance",val:"₹"+offer.wm});if(offer.sn)rows.push({v:"sn",p:"Min sessions",val:offer.sn});if(offer.sx&&!offer.wpre)rows.push({v:"sx",p:"Max sessions",val:offer.sx});rows.push({v:"t",p:"Validity",val:offer.t+" days"});if(offer.te)rows.push({v:"te",p:"Expiry date",val:offer.te});if(offer.ce&&offer.reward==="Cashback"&&!offer.wpre)rows.push({v:"ce",p:"Cashback expiry",val:offer.ce+" days"});
  // Export JSON
  const exportJson=()=>{const spec={offerName:offer.name,campaign:campaignName||"",segment:offer.segments,behaviour:{firstChargingSession:offer.ctMode==="first",firstWalletTopup:offer.wtMode==="first"},activity:offer.activity};if(offer.wpre){spec.preload={amount:offer.w,anchor:offer.wa,distribution:offer.dist};if(offer.wsx)spec.preload.maxPerSession=offer.wsxType==="pct"?offer.wsx+"%":"₹"+offer.wsx;if(offer.sx)spec.preload.maxSessions=parseInt(offer.sx);if(offer.wpun)spec.preload.minKwhPerSession=parseFloat(offer.wpun);if(offer.wpc)spec.preload.totalCreditCap=parseFloat(offer.wpc)}else{spec.reward={type:offer.reward};if(offer.reward==="Cashback"){spec.reward.tiers=offer.tiers.map(t=>({[isW?"topup":"session"]:parseInt(t.s),rate:t.pct+"%"}));if(offer.wtMode==="slab")spec.reward.slabs=offer.wtSlabs.map(s=>({min:s.min,max:s.max||"unlimited",rate:s.pct+"%"}))}if(offer.reward==="Discount")spec.reward.rate=offer.dpct+"%";if(offer.reward==="ChargeXP")spec.reward.xpPerRupee=offer.xpwpct;if(offer.reward==="Coupon")spec.reward.code=offer.p}spec.boundaries={};if(offer.un&&!isW)spec.boundaries.minKwh=parseFloat(offer.un);if(offer.ux)spec.boundaries.maxKwh=parseFloat(offer.ux);if(offer.nx)spec.boundaries.minValue=parseFloat(offer.nx);if(offer.cy)spec.boundaries.maxCashback=parseFloat(offer.cy);if(offer.dy)spec.boundaries.maxDiscount=parseFloat(offer.dy);if(offer.wm)spec.boundaries.minBalance=parseFloat(offer.wm);if(offer.sn)spec.boundaries.minSessions=parseInt(offer.sn);if(offer.sx)spec.boundaries.maxSessions=parseInt(offer.sx);spec.duration={validityDays:parseInt(offer.t)||30};if(offer.te)spec.duration.expiryDate=offer.te;if(offer.ce)spec.duration.cashbackExpiryDays=parseInt(offer.ce);return spec};
  const copyJson=()=>{navigator.clipboard.writeText(JSON.stringify(exportJson(),null,2));setCopied("json");setTimeout(()=>setCopied(""),2000)};
  const copyText=()=>{const lines=["OFFER: "+offer.name,campaignName?"CAMPAIGN: "+campaignName:"",""].concat(rows.map(r=>r.p+": "+r.val));navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));setCopied("text");setTimeout(()=>setCopied(""),2000)};
  return<div className="sum-card"><div className="sum-hdr"><span className="sum-name">{offer.name}</span><div style={{display:"flex",gap:8,alignItems:"center"}}><span className={"badge "+bg}>{bl}</span></div></div><div className="sum-body">
    <div style={{display:"flex",gap:6,marginBottom:16}}><button className={"wt-mode "+(viewMode==="business"?"active":"")} onClick={()=>setViewMode("business")}>Business view</button><button className={"wt-mode "+(viewMode==="tech"?"active":"")} onClick={()=>setViewMode("tech")}>Technical spec</button></div>
    {viewMode==="business"&&<div className="sum-plain" dangerouslySetInnerHTML={{__html:pl}}/>}
    {viewMode==="tech"&&<><table className="vtable"><thead><tr><th>Variable</th><th>Parameter</th><th>Value</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td style={{fontFamily:"var(--font-mono)",color:"var(--accent)",fontSize:11}}>{r.v}</td><td style={{color:"var(--text3)"}}>{r.p}</td><td style={{fontWeight:600}}>{r.val}</td></tr>)}</tbody></table></>}
    <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}><button className="btn" onClick={copyJson}>{copied==="json"?"✓ Copied!":"Copy as JSON"}</button><button className="btn" onClick={copyText}>{copied==="text"?"✓ Copied!":"Copy as text"}</button><button className="btn btn-primary" onClick={()=>{
      const isW=offer.activity==="Wallet top-up",isP=!!offer.wpre;const sim=offer.simResult;const sRoi=offer.simRoi;const sTxns=offer.simTxns;
      const w=window.open("","_blank");if(!w)return;
      let html='<html><head><title>'+offer.name+' — Offer Report</title><style>@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap");body{font-family:Inter,sans-serif;font-size:12px;color:#0f1f1a;max-width:800px;margin:0 auto;padding:30px}h1{font-family:Instrument Serif,serif;font-size:26px;font-weight:400;margin:0 0 4px}h2{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid #e4ede8;color:#00b377}h3{font-size:12px;margin:18px 0 8px;color:#5c554d}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{padding:8px 10px;border:1px solid #e4ede8;text-align:left;font-size:11px}th{background:#f7faf7;font-weight:600;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#8a9c93}td:first-child{font-weight:500}.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600}.meta{color:#8a9c93;font-size:12px;margin-bottom:24px}.summary-box{background:#f7faf7;border-left:3px solid #00d68f;padding:16px 18px;margin:14px 0;line-height:1.8;font-size:13px;border-radius:0 10px 10px 0}.mc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:12px 0}.mc-card{border:1px solid #e4ede8;border-radius:14px;padding:16px}.mc-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8a9c93;margin-bottom:6px}.mc-val{font-size:24px;font-weight:600}.risk{padding:10px 14px;margin:6px 0;border-radius:8px;font-size:12px;line-height:1.5}.risk-ok{background:#e8f5e9;color:#1a7a3a}.risk-warn{background:#fff8e1;color:#b07714}.risk-risk{background:#fce4ec;color:#c62828}@media print{body{padding:10px}}</style></head><body>';
      html+='<h1>'+offer.name+'</h1><div class="meta">'+(campaignName||"")+" \u2022 Generated "+new Date().toLocaleDateString()+'</div>';
      html+='<h2>Audience</h2><p><strong>Segments:</strong> '+segs+'</p>';if(offer.rc)html+='<p><strong>Custom cohort:</strong> '+offer.rcCount+' users ('+offer.rcLogic+')</p>';
      html+='<h2>Activity & Triggers</h2><p><strong>Activity:</strong> '+offer.activity+'</p>';if(offer.ctMode==="first")html+='<p><strong>Trigger:</strong> First charging session only</p>';if(offer.wtMode==="first")html+='<p><strong>Trigger:</strong> First wallet top-up only</p>';if(offer.wpre)html+='<p><strong>Pre-load:</strong> ₹'+offer.w+' ('+offer.dist+') from '+offer.wa+'</p>';
      html+='<h2>Reward</h2><p><strong>Type:</strong> '+(offer.wpre?"Pre-load":offer.reward)+'</p>';if(offer.reward==="Cashback"&&!offer.wpre){html+='<table><tr><th>'+(isW?"Top-up #":"Session #")+'</th><th>Rate</th></tr>';offer.tiers.forEach(t=>{html+='<tr><td>#'+t.s+'</td><td>'+t.pct+'%</td></tr>'});html+='</table>'}if(offer.reward==="Discount")html+='<p><strong>Rate:</strong> '+offer.dpct+'%</p>';if(offer.reward==="ChargeXP")html+='<p><strong>XP Rate:</strong> '+offer.xpwpct+' XP/₹</p>';if(offer.reward==="Coupon")html+='<p><strong>Code:</strong> '+offer.p+'</p>';
      html+='<h2>Limits</h2><table><tr><th>Parameter</th><th>Value</th></tr>';if(offer.un&&!isW&&!isP)html+='<tr><td>Min kWh</td><td>'+offer.un+'</td></tr>';if(offer.cy&&!isP)html+='<tr><td>Max cashback</td><td>₹'+offer.cy+'</td></tr>';if(offer.dy&&!isP)html+='<tr><td>Max discount</td><td>₹'+offer.dy+'</td></tr>';if(offer.wm)html+='<tr><td>Min balance</td><td>₹'+offer.wm+'</td></tr>';if(offer.sx&&!isP)html+='<tr><td>Max sessions</td><td>'+offer.sx+'</td></tr>';if(offer.wpun)html+='<tr><td>Min kWh/session</td><td>'+offer.wpun+'</td></tr>';if(offer.wpc)html+='<tr><td>Total credit cap</td><td>₹'+offer.wpc+'</td></tr>';if(isP&&offer.wsx)html+='<tr><td>Max spend/session</td><td>'+(offer.wsxType==="pct"?offer.wsx+"%":"₹"+offer.wsx)+'</td></tr>';if(isP&&offer.sx)html+='<tr><td>Max sessions</td><td>'+offer.sx+'</td></tr>';html+='</table>';
      html+='<h2>Duration</h2><p><strong>Validity:</strong> '+offer.t+' days</p>';if(offer.te)html+='<p><strong>Expiry:</strong> '+offer.te+'</p>';if(offer.ce)html+='<p><strong>Cashback expiry:</strong> '+offer.ce+' days</p>';
      html+='<h2>Business Summary</h2><div class="summary-box">'+pl+'</div>';
      html+='<h2>Technical Specification</h2><table><tr><th>Variable</th><th>Parameter</th><th>Value</th></tr>';rows.forEach(r=>{html+='<tr><td>'+r.v+'</td><td>'+r.p+'</td><td>'+r.val+'</td></tr>'});html+='</table>';
      if(sTxns&&sTxns.length>0){html+='<h2>Simulation Data</h2><h3>Test Transactions</h3><table><tr><th>#</th><th>Date</th>';if(isW||isP)html+='<th>Amount (₹)</th>';else html+='<th>kWh</th><th>Rate (₹/kWh)</th>';html+='</tr>';sTxns.forEach((tx,i)=>{html+='<tr><td>'+(i+1)+'</td><td>'+(tx.date||"\u2014")+'</td>';if(isW||isP)html+='<td>'+(tx.amount||0)+'</td>';else html+='<td>'+(tx.units||0)+'</td><td>'+(tx.rate||22)+'</td>';html+='</tr>'});html+='</table>'}
      if(sim){html+='<h3>Did it work?</h3><div class="mc-grid"><div class="mc-card"><div class="mc-label">Rewarded '+(isW&&!isP?"top-ups":"sessions")+'</div><div class="mc-val">'+sim.qualTxns+' / '+sim.rows.length+'</div></div><div class="mc-card"><div class="mc-label">Total reward cost</div><div class="mc-val">₹'+sim.totalReward.toFixed(0)+'</div></div></div>';
        if(sim.rows){html+='<h3>Transaction Detail</h3><table><tr><th>#</th><th>Date</th>';if(isW||isP)html+='<th>Amount</th>';else html+='<th>kWh</th><th>Net ₹</th>';html+='<th>Sess</th><th>Rate</th><th>Reward</th><th>Status</th></tr>';sim.rows.forEach(r=>{html+='<tr><td>'+r.idx+'</td><td>'+r.date+'</td>';if(isW||isP)html+='<td>₹'+(r.amount||0).toFixed(0)+'</td>';else html+='<td>'+r.units+'</td><td>₹'+r.net.toFixed(0)+'</td>';html+='<td>'+r.sessStr+'</td><td>'+r.rateStr+'</td><td>₹'+(r.reward||0).toFixed(0)+'</td><td>'+r.status+'</td></tr>'});html+='</table>'}}
      if(sRoi){html+='<h3>Was it worth it?</h3><div class="mc-grid"><div class="mc-card"><div class="mc-label">'+sRoi.rewardLabel+'</div><div class="mc-val">₹'+sRoi.liability.toFixed(0)+'</div></div>';if(sRoi.isCharging){html+='<div class="mc-card"><div class="mc-label">Margin earned</div><div class="mc-val">₹'+sRoi.marginEarned.toFixed(0)+'</div></div><div class="mc-card"><div class="mc-label">Net impact</div><div class="mc-val">'+(sRoi.netImpact>=0?"+":"")+'₹'+sRoi.netImpact.toFixed(0)+'</div></div><div class="mc-card"><div class="mc-label">Per session</div><div class="mc-val">'+(sRoi.perSession>=0?"+":"")+'₹'+sRoi.perSession.toFixed(0)+'</div></div>'}html+='<div class="mc-card"><div class="mc-label">Breakeven</div><div class="mc-val">'+sRoi.breakeven+'</div></div></div>';
        if(sRoi.risks&&sRoi.risks.length>0){html+='<h3>Risk Assessment</h3>';sRoi.risks.forEach(r=>{html+='<div class="risk risk-'+r.type+'">'+r.msg+'</div>'})}}
      html+='</body></html>';w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);
    }}>Download PDF</button></div>
    {/* Ship card */}
    <div className="ship-card">
      <div className="ship-title">Ship this offer</div>
      <div className="ship-desc">Choose how to share this offer spec with your team. The complete configuration, simulation data, and business analysis will be included.</div>
      <div className="ship-options">
        <div className="ship-opt" onClick={copyJson}><div className="ship-opt-icon">📋</div><div className="ship-opt-title">Copy JSON spec</div><div className="ship-opt-desc">Paste into Jira, Slack, or your backend system</div></div>
        <div className="ship-opt" onClick={()=>{copyText();}}><div className="ship-opt-icon">📝</div><div className="ship-opt-title">Copy as text</div><div className="ship-opt-desc">Plain text for emails and documents</div></div>
        <div className="ship-opt" onClick={()=>document.querySelector(".btn-primary[onclick]")?.click()}><div className="ship-opt-icon">📄</div><div className="ship-opt-title">Download report</div><div className="ship-opt-desc">Full PDF with config, simulation, and ROI</div></div>
      </div>
    </div>
  </div></div>}

function SimulateStep({offer,txns,setTxns,marginPct,onSaveSim}){const[res,setRes]=useState(offer.simResult||null);const[roi,setRoi]=useState(offer.simRoi||null);const isW=offer.activity==="Wallet top-up",isP=!!offer.wpre;const txnTimer=useRef(null);
  const ut=(i,f,v)=>{const t=[...txns];t[i]={...t[i],[f]:v};setTxns(t);if(txnTimer.current)clearTimeout(txnTimer.current);txnTimer.current=setTimeout(()=>onSaveSim({simTxns:t}),2000)};
  const addTxn=(tx)=>{const t=[...txns,tx];setTxns(t);onSaveSim({simTxns:t})};
  const delTxn=(j)=>{const t=txns.filter((_,i)=>i!==j);setTxns(t);onSaveSim({simTxns:t})};
  const genSample=()=>{const t=generateSampleTxns(offer);setTxns(t);onSaveSim({simTxns:t})};
  const run=()=>{const r=runSimulation(offer,txns);const ro=computeROI(offer,r,marginPct);setRes(r);setRoi(ro);onSaveSim({simTxns:txns,simResult:{...r,rows:r.rows},simRoi:ro})};
  return<><div className="card"><div className="card-title">{isP?"Sessions spending pre-load":isW?"Wallet top-ups":"Charging sessions"}</div><button className="sample-btn" onClick={genSample}>{"\u2726"} Generate sample data</button>
  {(isW||isP)?<>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
      <thead><tr style={{borderBottom:"1px solid var(--line)"}}><th style={{textAlign:"left",padding:"8px 6px",fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--ink3)"}}>Date</th><th style={{textAlign:"left",padding:"8px 6px",fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--ink3)"}}>{isP?"Session ₹":"Top-up ₹"}</th><th style={{width:28}}/></tr></thead>
      <tbody>{txns.map((tx,i)=><tr key={i} style={{borderBottom:"1px solid var(--line)"}}><td style={{padding:"6px"}}><input type="date" value={tx.date||""} onChange={e=>ut(i,"date",e.target.value)} style={{padding:"6px 8px",fontSize:12}}/></td><td style={{padding:"6px"}}><input type="number" value={tx.amount||""} placeholder="₹" onChange={e=>ut(i,"amount",e.target.value)} style={{padding:"6px 8px",fontSize:12}}/></td><td style={{padding:"6px",textAlign:"center"}}><button className="del-btn" onClick={()=>delTxn(i)}>×</button></td></tr>)}</tbody>
    </table>
    <button className="btn-dashed" onClick={()=>addTxn({date:"",amount:""})}>+ Add {isP?"session":"top-up"}</button>
  </>:
  <>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
      <thead><tr style={{borderBottom:"1px solid var(--line)"}}><th style={{textAlign:"left",padding:"8px 6px",fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--ink3)"}}>Date</th><th style={{textAlign:"left",padding:"8px 6px",fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--ink3)"}}>kWh</th><th style={{textAlign:"left",padding:"8px 6px",fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--ink3)"}}>₹/kWh</th><th style={{width:28}}/></tr></thead>
      <tbody>{txns.map((tx,i)=><tr key={i} style={{borderBottom:"1px solid var(--line)"}}><td style={{padding:"6px"}}><input type="date" value={tx.date||""} onChange={e=>ut(i,"date",e.target.value)} style={{padding:"6px 8px",fontSize:12}}/></td><td style={{padding:"6px"}}><input type="number" value={tx.units||""} placeholder="kWh" onChange={e=>ut(i,"units",e.target.value)} style={{padding:"6px 8px",fontSize:12,width:80}}/></td><td style={{padding:"6px"}}><input type="number" value={tx.rate||""} placeholder="₹/kWh" onChange={e=>ut(i,"rate",e.target.value)} style={{padding:"6px 8px",fontSize:12,width:70}}/></td><td style={{padding:"6px",textAlign:"center"}}><button className="del-btn" onClick={()=>delTxn(i)}>×</button></td></tr>)}</tbody>
    </table>
    <button className="btn-dashed" onClick={()=>addTxn({date:"",units:"",rate:"22"})}>+ Add transaction</button>
  </>}</div>
  <button className="btn btn-primary" onClick={run} style={{marginBottom:20,width:"100%"}}>Run Simulation</button>
  {res&&<>
    <div className="dash-section"><div className="dash-title"><span className="dash-icon di-g">{"\u2713"}</span> Did it work?</div><div className="metrics"><div className="mc"><div className="mc-label">Rewarded {isW&&!isP?"top-ups":"sessions"}</div><div className="mc-val">{res.qualTxns}</div><div className="mc-sub">out of {res.rows.length} transactions</div></div><div className="mc"><div className="mc-label">Total {res.rewardType==="ChargeXP"?"XP issued":"reward cost"}</div><div className="mc-val">{res.rewardType==="ChargeXP"?res.totalReward.toFixed(0)+" XP":"₹"+res.totalReward.toFixed(0)}</div></div>{!isW&&!isP&&<div className="mc"><div className="mc-label">Net revenue (pre-GST)</div><div className="mc-val">{"₹"}{res.totalNet.toFixed(0)}</div><div className="mc-sub">Margin applies to this</div></div>}{(isW||isP)&&<div className="mc"><div className="mc-label">{isP?"Session spend":"Total topped up"}</div><div className="mc-val">{"₹"}{res.totalGross.toFixed(0)}</div><div className="mc-sub">{isP?"From pre-loaded balance":"No margin on top-ups"}</div></div>}</div></div>
    {roi&&<div className="dash-section"><div className="dash-title"><span className="dash-icon di-a">{"₹"}</span> Was it worth it?</div>
      {roi.isCharging&&<><div className="metrics"><div className="mc"><div className="mc-label">Margin earned</div><div className="mc-val" style={{color:"var(--green)"}}>{"₹"}{roi.marginEarned.toFixed(0)}</div><div className="mc-sub">Net revenue {"×"} {marginPct}%</div></div><div className="mc"><div className="mc-label">{roi.rewardLabel}</div><div className="mc-val" style={{color:"var(--red)"}}>{"₹"}{roi.liability.toFixed(0)}</div><div className="mc-sub">total payout</div></div><div className="mc"><div className="mc-label">Net impact</div><div className="mc-val" style={{color:roi.netImpact>=0?"var(--green)":"var(--red)"}}>{roi.netImpact>=0?"+":""}{"₹"}{roi.netImpact.toFixed(0)}</div><div className="mc-sub">{roi.netImpact>=0?"Profitable":"Loss"}</div></div><div className="mc"><div className="mc-label">Per session</div><div className="mc-val" style={{color:roi.perSession>=0?"var(--green)":"var(--red)"}}>{roi.perSession>=0?"+":""}{"₹"}{roi.perSession.toFixed(0)}</div><div className="mc-sub">margin - reward</div></div></div><div className="mc" style={{marginTop:10}}><div className="mc-label">Breakeven</div><div className="mc-val">{roi.breakeven}</div></div></>}
      {roi.isWallet&&<><div className="metrics"><div className="mc"><div className="mc-label">{roi.rewardLabel}</div><div className="mc-val" style={{color:"var(--red)"}}>{"₹"}{roi.liability.toFixed(0)}</div><div className="mc-sub">Leading cost</div></div><div className="mc"><div className="mc-label">Revenue</div><div className="mc-val" style={{color:"var(--text3)"}}>{"₹"}0</div><div className="mc-sub">Lagging</div></div><div className="mc"><div className="mc-label">To break even</div><div className="mc-val">{roi.breakeven}</div><div className="mc-sub">at {marginPct}% margin</div></div></div></>}
      {roi.isPreload&&<><div className="metrics"><div className="mc"><div className="mc-label">Pre-load cost</div><div className="mc-val" style={{color:"var(--red)"}}>{"₹"}{(parseFloat(offer.w)||0).toFixed(0)}</div><div className="mc-sub">Per user</div></div><div className="mc"><div className="mc-label">Revenue</div><div className="mc-val">{"₹"}{res.totalGross.toFixed(0)}</div><div className="mc-sub">{res.qualTxns} sessions</div></div><div className="mc"><div className="mc-label">Margin</div><div className="mc-val" style={{color:roi.marginEarned>0?"var(--green)":"var(--text3)"}}>{"₹"}{roi.marginEarned.toFixed(0)}</div><div className="mc-sub">at {marginPct}%</div></div><div className="mc"><div className="mc-label">Net impact</div><div className="mc-val" style={{color:roi.netImpact>=0?"var(--green)":"var(--red)"}}>{roi.netImpact>=0?"+":""}{"₹"}{roi.netImpact.toFixed(0)}</div></div></div><div className="mc" style={{marginTop:10}}><div className="mc-label">Breakeven</div><div className="mc-val">{roi.breakeven}</div></div></>}
    </div>}
    {roi&&roi.risks.length>0&&<div className="dash-section"><div className="dash-title"><span className="dash-icon di-r">{"\u2192"}</span> What next?</div>{roi.risks.map((r,i)=><div key={i} className={"risk-item "+r.type}>{r.msg}</div>)}</div>}
    <div className="card" style={{padding:0,overflow:"hidden",marginTop:8}}><div style={{padding:"14px 20px 0",fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)"}}>Transaction Detail</div><div className="scroll-x" style={{padding:"8px 0"}}><table className="result-tbl" style={{minWidth:600}}><thead><tr><th>#</th><th>Date</th>{(isW||isP)&&<th>{isP?"Sess ₹":"Top-up ₹"}</th>}{!isW&&!isP&&<><th>kWh</th><th>Net ₹</th><th>w/ GST</th></>}<th>{isW&&!isP?"#":"Sess"}</th><th>Rate</th><th>{res.rewardType==="ChargeXP"?"XP":"Reward"}</th><th>Status</th></tr></thead><tbody>{res.rows.map((r,i)=><tr key={i}><td>{r.idx}</td><td>{r.date}</td>{(isW||isP)&&<td>{"₹"}{(r.amount||0).toFixed(0)}</td>}{!isW&&!isP&&<><td>{r.units}</td><td>{"₹"}{r.net.toFixed(0)}</td><td>{"₹"}{r.total.toFixed(0)}</td></>}<td>{r.sessStr}</td><td>{r.rateStr}</td><td className="rval">{r.rewardUnit==="XP"?(r.reward||0).toFixed(0)+" XP":"₹"+(r.reward||0).toFixed(0)}</td><td><StatusBadge s={r.status}/></td></tr>)}</tbody></table></div></div>
    <ScaleProjector offer={offer} simResult={res} simRoi={roi} marginPct={marginPct} onSave={(si)=>onSaveSim({scaleInputs:si})}/>
  </>}</>}
/* ── Scale to User Base ── */
function ScaleProjector({offer,simResult,simRoi,marginPct,onSave}){
  const isW=offer.activity==="Wallet top-up",isP=!!offer.wpre,isCharging=!isW;
  const days=parseInt(offer.t)||30,months=days/30;
  // Defaults per type
  const chargingDefaults={userBase:"50000",redemptionRate:"15",avgSessionsPerMonth:"3",avgKwhPerSession:"12",avgRatePerKwh:"22",marginAssumption:String(marginPct),incrementality:"70"};
  const walletDefaults={userBase:"50000",redemptionRate:"15",avgTopupsPerMonth:"2",avgTopupAmount:"300",conversionToCharging:"60",avgSessionsAfterTopup:"3",avgKwhPerSession:"12",avgRatePerKwh:"22",marginAssumption:String(marginPct)};
  const preloadDefaults={userBase:"50000",redemptionRate:"20",avgSessionsFromPreload:"4",avgKwhPerSession:"12",avgRatePerKwh:"22",walletUtilisation:"75",marginAssumption:String(marginPct),incrementality:"50"};
  const defaults=isP?preloadDefaults:isW?walletDefaults:chargingDefaults;
  const[inp,setInp]=useState(offer.scaleInputs||defaults);
  const[open,setOpen]=useState(true);
  const save=(v)=>{const n={...inp,...v};setInp(n);onSave(n)};
  if(!simResult)return null;
  const ub=parseFloat(inp.userBase)||0;const rr=(parseFloat(inp.redemptionRate)||0)/100;
  const mPct=(parseFloat(inp.marginAssumption)||marginPct)/100;
  const redeemed=Math.round(ub*rr);
  const simQual=simResult.qualTxns||1;const simReward=simResult.totalReward||0;
  const rewardPerQualTxn=simQual>0?simReward/simQual:0;
  const fmt=(v)=>{const a=Math.abs(v);const s=v<0?"-":"";return a>=100000?s+"₹"+(a/100000).toFixed(1)+"L":a>=1000?s+"₹"+(a/1000).toFixed(0)+"K":s+"₹"+a.toFixed(0)};
  const fmtP=(v)=>v.toFixed(1)+"%";
  // Knob helper
  const Knob=({label,value,unit,min,max,step:st,baseline,baseLabel,onChange})=>{const pct=Math.max(0,Math.min(100,((parseFloat(value)-min)/(max-min))*100));const blPct=baseline!==undefined?Math.max(0,Math.min(100,((baseline-min)/(max-min))*100)):null;const handleClick=(e)=>{const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width;const nv=Math.round((min+x*(max-min))/(st||1))*(st||1);onChange(String(Math.max(min,Math.min(max,nv))))};return<div className="wif-knob"><div className="wif-knob-head"><span className="wif-knob-label">{label}</span><span className="wif-knob-val">{unit==="₹"?"₹"+value:value}<span className="unit">{unit==="%"?"%":unit==="₹"?"":unit?" "+unit:""}</span></span></div><div className="wif-track" onClick={handleClick}><div className="wif-track-fill" style={{width:pct+"%"}}/>{blPct!==null&&<div style={{position:"absolute",top:-3,width:2,height:12,background:"var(--text3)",transform:"translateX(-50%)",opacity:.4,left:blPct+"%"}}/>}<div className="wif-track-thumb" style={{left:pct+"%"}}/></div><div className="wif-knob-meta"><span>{unit==="₹"?"₹":"" }{min}{unit==="%"?"%":unit==="₹"?"":""}</span>{baseline!==undefined&&<span style={{color:"var(--text2)"}}>{baseLabel||"baseline"} <b style={{color:"var(--text)"}}>{unit==="₹"?"₹":""}{baseline}{unit==="%"?"%":""}</b></span>}<span>{unit==="₹"?"₹":""}{max}{unit==="%"?"%":""}</span></div></div>};

  // ══════════ CHARGING SESSION CASHBACK ══════════
  let analysis=null;
  if(isCharging){
    const aSess=parseFloat(inp.avgSessionsPerMonth)||3;const aKwh=parseFloat(inp.avgKwhPerSession)||12;
    const aRate=parseFloat(inp.avgRatePerKwh)||22;const incr=(parseFloat(inp.incrementality)||70)/100;
    const sessPerUser=Math.round(aSess*months);const cappedSess=offer.sx?Math.min(sessPerUser,parseInt(offer.sx)):sessPerUser;
    const revenuePerSess=aKwh*aRate;const marginPerSess=revenuePerSess*mPct;
    const rewardPerSess=rewardPerQualTxn;const netMarginPerSess=marginPerSess-rewardPerSess;
    const marginErosion=marginPerSess>0?(rewardPerSess/marginPerSess)*100:0;
    const totalSessions=redeemed*cappedSess;const totalRevenue=totalSessions*revenuePerSess;
    const totalMargin=totalSessions*marginPerSess;const totalRewardCost=totalSessions*rewardPerSess;
    const netTotal=totalMargin-totalRewardCost;
    const incrNet=totalMargin*incr-totalRewardCost;
    const effRatePerKwh=aRate-(rewardPerSess/aKwh);
    // Reward-type labels
    const rType=offer.reward;
    const rLabel=rType==="Cashback"?"Cashback":rType==="Discount"?"Discount":rType==="ChargeXP"?"XP":"Reward";
    const rPayoutLabel=rType==="Cashback"?"Cashback payout":rType==="Discount"?"Total discount given":rType==="ChargeXP"?"XP issued":"Reward cost";
    const rNetLabel=rType==="Cashback"?"Net after cashback":rType==="Discount"?"Net after discount":rType==="ChargeXP"?"Net after XP cost":"Net after reward";
    const rErosionLabel=rType==="Cashback"?"Margin erosion":rType==="Discount"?"Revenue reduction":"Cost ratio";
    const rErosionDesc=rType==="Cashback"?"of margin goes to cashback":rType==="Discount"?"of revenue given as discount":"of margin allocated to reward";
    const rPerSessLabel=rType==="Cashback"?"Cashback / session":rType==="Discount"?"Discount / session":rType==="ChargeXP"?"XP cost / session":"Reward / session";
    const rChartLabel=rType==="Cashback"?"Margin vs Cashback":rType==="Discount"?"Revenue vs Discount":rType==="ChargeXP"?"Margin vs XP cost":"Margin vs Reward cost";
    const rChartLegend=rType==="Cashback"?"Cashback":rType==="Discount"?"Discount":rType==="ChargeXP"?"XP cost":"Reward";
    const rEffLabel=rType==="Discount"?"Effective rate after discount":"Effective rate after "+rLabel.toLowerCase();
    // Chart
    const chartPts=[];for(let r=0;r<=50;r+=2){const rd=Math.round(ub*(r/100));const s=rd*cappedSess;chartPts.push({r,margin:s*marginPerSess,reward:s*rewardPerSess,net:s*netMarginPerSess})}
    const chartMax=Math.max(...chartPts.map(p=>Math.max(p.margin,p.reward,Math.abs(p.net))),1);
    const cx=(r)=>(r/50)*100;const cy=(v)=>100-((v/chartMax)*80+10);
    analysis={type:"charging",knobs:<>
      <Knob label="Sessions per user / month" value={inp.avgSessionsPerMonth} unit="" min={1} max={15} step={1} baseline={3} baseLabel="platform avg" onChange={v=>save({avgSessionsPerMonth:v})}/>
      <Knob label="Avg kWh per session" value={inp.avgKwhPerSession} unit="kWh" min={1} max={50} step={1} baseline={12} baseLabel="platform avg" onChange={v=>save({avgKwhPerSession:v})}/>
      <Knob label="Rate per kWh" value={inp.avgRatePerKwh} unit="₹" min={10} max={50} step={1} baseline={22} baseLabel="current rate" onChange={v=>save({avgRatePerKwh:v})}/>
      <Knob label="Redemption rate" value={inp.redemptionRate} unit="%" min={1} max={50} step={1} baseline={15} baseLabel="industry avg" onChange={v=>save({redemptionRate:v})}/>
      <Knob label="Audience size" value={inp.userBase} unit="" min={1000} max={200000} step={1000} baseline={50000} baseLabel="target" onChange={v=>save({userBase:v})}/>
      <Knob label="Incrementality" value={inp.incrementality||"70"} unit="%" min={0} max={100} step={5} baseline={70} baseLabel="est." onChange={v=>save({incrementality:v})}/>
      <Knob label="Margin assumption" value={inp.marginAssumption||String(marginPct)} unit="%" min={15} max={50} step={1} baseline={marginPct} baseLabel="finance set" onChange={v=>save({marginAssumption:v})}/>
    </>,headline:<div className="wif-headline">
      <div className="wif-headline-block"><div className="wif-headline-label">{rNetLabel}</div><div className="wif-headline-val" style={{color:netTotal>=0?"var(--green)":"var(--red)"}}>{netTotal>=0?"+":""}{fmt(netTotal)}</div><div className="wif-headline-delta">{redeemed.toLocaleString()} users × {cappedSess} sessions</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">{rPayoutLabel}</div><div className="wif-headline-val" style={{color:"var(--red)"}}>{fmt(totalRewardCost)}</div><div className="wif-headline-delta">{"₹"}{rewardPerSess.toFixed(0)} per session avg</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">{rErosionLabel}</div><div className="wif-headline-val" style={{color:marginErosion>40?"var(--red)":marginErosion>25?"var(--amber)":"var(--green)"}}>{fmtP(marginErosion)}</div><div className="wif-headline-delta">{rErosionDesc}</div></div>
    </div>,
    detail:<>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Session-level economics</div><div className="metrics">
        <div className="mc"><div className="mc-label">Revenue / session</div><div className="mc-val">{"₹"}{revenuePerSess.toFixed(0)}</div><div className="mc-sub">{aKwh}kWh × {"₹"}{aRate}</div></div>
        <div className="mc"><div className="mc-label">Margin / session</div><div className="mc-val">{"₹"}{marginPerSess.toFixed(0)}</div><div className="mc-sub">{fmtP(mPct*100)} of revenue</div></div>
        <div className="mc"><div className="mc-label">{rPerSessLabel}</div><div className="mc-val" style={{color:"var(--red)"}}>{"₹"}{rewardPerSess.toFixed(0)}</div><div className="mc-sub">from simulation</div></div>
        <div className="mc"><div className="mc-label">Net margin / session</div><div className="mc-val" style={{color:netMarginPerSess>=0?"var(--green)":"var(--red)"}}>{netMarginPerSess>=0?"+":""}{"₹"}{netMarginPerSess.toFixed(0)}</div><div className="mc-sub">margin - {rLabel.toLowerCase()}</div></div>
      </div></div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Effective pricing after offer</div><div className="metrics">
        <div className="mc"><div className="mc-label">Rate before offer</div><div className="mc-val">{"₹"}{aRate}/kWh</div></div>
        <div className="mc"><div className="mc-label">{rEffLabel}</div><div className="mc-val" style={{color:effRatePerKwh<aRate*0.8?"var(--red)":"var(--text)"}}>{"₹"}{effRatePerKwh.toFixed(1)}/kWh</div><div className="mc-sub">what you actually earn</div></div>
      </div></div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Incrementality test</div>
        <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:12}}>If <b>{fmtP(incr*100)}</b> of sessions are incremental (wouldn't have happened without the offer), your true net impact is:</div>
        <div className="metrics">
          <div className="mc"><div className="mc-label">Incremental margin</div><div className="mc-val">{fmt(totalMargin*incr)}</div><div className="mc-sub">only counting new sessions</div></div>
          <div className="mc"><div className="mc-label">Full {rLabel.toLowerCase()} cost</div><div className="mc-val" style={{color:"var(--red)"}}>{fmt(totalRewardCost)}</div><div className="mc-sub">paid on ALL sessions</div></div>
          <div className="mc"><div className="mc-label">True net impact</div><div className="mc-val" style={{color:incrNet>=0?"var(--green)":"var(--red)"}}>{incrNet>=0?"+":""}{fmt(incrNet)}</div><div className="mc-sub">{incr*100<100?"lower than headline":"fully incremental"}</div></div>
        </div>
        {incrNet<0&&netTotal>=0&&<div className="risk-item warn" style={{marginTop:10}}>The headline looks profitable, but if only {fmtP(incr*100)} of sessions are incremental, you actually lose {fmt(Math.abs(incrNet))}. The rest are users who would have charged anyway — you're giving them {rLabel.toLowerCase()} for free.</div>}
      </div>
    </>,chart:<div className="card" style={{padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600}}>{rChartLabel} across redemption rates</div>
        <div style={{display:"flex",gap:14,fontSize:11,color:"var(--text3)"}}><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"var(--green)",marginRight:4}}/>Margin</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"var(--red)",marginRight:4}}/>{rChartLegend}</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"var(--text)",marginRight:4}}/>Net</span></div>
      </div>
      <svg viewBox="0 0 100 100" style={{width:"100%",height:180}} preserveAspectRatio="none">
        <polygon points={"0,"+cy(0)+" "+chartPts.map(p=>cx(p.r)+","+cy(p.net)).join(" ")+" 100,"+cy(0)} fill="var(--green)" opacity=".06"/>
        <polyline points={chartPts.map(p=>cx(p.r)+","+cy(p.margin)).join(" ")} fill="none" stroke="var(--green)" strokeWidth=".5"/>
        <polyline points={chartPts.map(p=>cx(p.r)+","+cy(p.reward)).join(" ")} fill="none" stroke="var(--red)" strokeWidth=".5"/>
        <polyline points={chartPts.map(p=>cx(p.r)+","+cy(p.net)).join(" ")} fill="none" stroke="var(--text)" strokeWidth=".6"/>
        <line x1={cx(rr*100)} y1="5" x2={cx(rr*100)} y2="95" stroke="var(--text)" strokeWidth=".3" strokeDasharray="1,1"/>
        <circle cx={cx(rr*100)} cy={cy(netTotal)} r="1.5" fill="var(--text)"/>
        <line x1="0" y1={cy(0)} x2="100" y2={cy(0)} stroke="var(--text3)" strokeWidth=".15"/>
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text3)",marginTop:4}}><span>0%</span><span>25%</span><span>50%</span></div>
    </div>,
    narrative:netTotal>=0?<div className="wif-narrative"><b>Profitable at scale.</b> At {inp.redemptionRate}% redemption, {redeemed.toLocaleString()} users generate {fmt(totalMargin)} in margin. After {fmt(totalRewardCost)} {rLabel.toLowerCase()} payout, you net <b>{fmt(netTotal)}</b>. {rErosionLabel} is {fmtP(marginErosion)} — {marginErosion<20?"well within healthy range.":marginErosion<35?"moderate, monitor closely.":"high, consider reducing rates."} Effective per-kWh earning drops from {"₹"}{aRate} to {"₹"}{effRatePerKwh.toFixed(1)}.</div>:<div className="wif-narrative" style={{background:"var(--red-bg)",color:"var(--red)"}}><b>Unprofitable.</b> {rLabel} cost ({fmt(totalRewardCost)}) exceeds margin ({fmt(totalMargin)}). Effective kWh rate is {"₹"}{effRatePerKwh.toFixed(1)} — below sustainable levels. Reduce {rLabel.toLowerCase()} rate or cap, or narrow the audience.</div>};
  }

  // ══════════ WALLET TOP-UP CASHBACK ══════════
  if(isW&&!isP){
    const aTpm=parseFloat(inp.avgTopupsPerMonth)||2;const aTopup=parseFloat(inp.avgTopupAmount)||300;
    const convRate=(parseFloat(inp.conversionToCharging)||60)/100;
    const futSess=parseFloat(inp.avgSessionsAfterTopup)||3;const aKwh=parseFloat(inp.avgKwhPerSession)||12;
    const aRate=parseFloat(inp.avgRatePerKwh)||22;
    const topupsPerUser=Math.round(aTpm*months);const cashbackPerTopup=rewardPerQualTxn;
    const totalTopups=redeemed*topupsPerUser;const totalCashback=totalTopups*cashbackPerTopup;
    const usersWhoCharge=Math.round(redeemed*convRate);const totalFutureSess=usersWhoCharge*futSess;
    const futureRevenue=totalFutureSess*aKwh*aRate;const futureMargin=futureRevenue*mPct;
    const netTotal=futureMargin-totalCashback;
    const paybackMonths=futureMargin>0?(totalCashback/futureMargin)*months:999;
    const sessToRecover=cashbackPerTopup>0?Math.ceil(cashbackPerTopup/(aKwh*aRate*mPct)):0;
    analysis={type:"wallet",knobs:<>
      <Knob label="Top-ups per user / month" value={inp.avgTopupsPerMonth||"2"} unit="" min={1} max={10} step={1} baseline={2} baseLabel="avg" onChange={v=>save({avgTopupsPerMonth:v})}/>
      <Knob label="Avg top-up amount" value={inp.avgTopupAmount||"300"} unit={"₹"} min={50} max={2000} step={50} baseline={300} baseLabel="platform avg" onChange={v=>save({avgTopupAmount:v})}/>
      <Knob label="Conversion to charging" value={inp.conversionToCharging||"60"} unit="%" min={10} max={100} step={5} baseline={60} baseLabel="est." onChange={v=>save({conversionToCharging:v})}/>
      <Knob label="Avg sessions after top-up" value={inp.avgSessionsAfterTopup||"3"} unit="" min={1} max={15} step={1} baseline={3} baseLabel="est." onChange={v=>save({avgSessionsAfterTopup:v})}/>
      <Knob label="Redemption rate" value={inp.redemptionRate} unit="%" min={1} max={50} step={1} baseline={15} baseLabel="industry" onChange={v=>save({redemptionRate:v})}/>
      <Knob label="Audience size" value={inp.userBase} unit="" min={1000} max={200000} step={1000} baseline={50000} baseLabel="target" onChange={v=>save({userBase:v})}/>
    </>,headline:<div className="wif-headline">
      <div className="wif-headline-block"><div className="wif-headline-label">Cashback cost (leading)</div><div className="wif-headline-val" style={{color:"var(--red)"}}>{fmt(totalCashback)}</div><div className="wif-headline-delta">paid immediately on top-ups</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">Future margin (lagging)</div><div className="wif-headline-val" style={{color:futureMargin>0?"var(--green)":"var(--text3)"}}>{fmt(futureMargin)}</div><div className="wif-headline-delta">{usersWhoCharge.toLocaleString()} users convert to charging</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">Payback period</div><div className="wif-headline-val">{paybackMonths<24?paybackMonths.toFixed(1)+"mo":"—"}</div><div className="wif-headline-delta">to recover cashback cost</div></div>
    </div>,
    detail:<>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Cost-to-recovery pipeline</div>
        <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.8,marginBottom:14}}>
          <b>{redeemed.toLocaleString()}</b> users top up → you pay <b style={{color:"var(--red)"}}>{fmt(totalCashback)}</b> in cashback immediately.<br/>
          <b>{fmtP(convRate*100)}</b> convert to charging → <b>{usersWhoCharge.toLocaleString()}</b> users generate <b>{totalFutureSess.toLocaleString()}</b> sessions.<br/>
          Those sessions earn <b style={{color:"var(--green)"}}>{fmt(futureMargin)}</b> in margin over time.
        </div>
        <div className="metrics">
          <div className="mc"><div className="mc-label">Sessions to recover per user</div><div className="mc-val">{sessToRecover}</div><div className="mc-sub">each cashback recipient needs this many charges</div></div>
          <div className="mc"><div className="mc-label">Net after recovery</div><div className="mc-val" style={{color:netTotal>=0?"var(--green)":"var(--red)"}}>{netTotal>=0?"+":""}{fmt(netTotal)}</div></div>
        </div>
      </div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Conversion risk</div>
        <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:10}}>What if fewer users convert from wallet to charging?</div>
        <div className="scroll-x"><table className="result-tbl"><thead><tr><th>Conversion</th><th>Users charge</th><th>Future margin</th><th>Net P&L</th></tr></thead><tbody>
          {[30,40,50,60,70,80].map(c=>{const uc=Math.round(redeemed*(c/100));const fm=uc*futSess*aKwh*aRate*mPct;const n=fm-totalCashback;return<tr key={c} style={{background:c===Math.round(convRate*100)?"var(--accent-bg)":""}}>
            <td style={{fontWeight:c===Math.round(convRate*100)?700:400}}>{c}%{c===Math.round(convRate*100)?" ←":""}</td><td>{uc.toLocaleString()}</td><td>{fmt(fm)}</td><td style={{color:n>=0?"var(--green)":"var(--red)",fontWeight:600}}>{n>=0?"+":""}{fmt(n)}</td></tr>})}
        </tbody></table></div>
      </div>
    </>,chart:null,
    narrative:netTotal>=0?<div className="wif-narrative"><b>Recoverable.</b> The {fmt(totalCashback)} cashback cost is a leading investment. If {fmtP(convRate*100)} of users convert to charging ({usersWhoCharge.toLocaleString()} users), the {fmt(futureMargin)} future margin recovers the cost in <b>{paybackMonths.toFixed(1)} months</b>. Net positive: <b>{fmt(netTotal)}</b>.</div>:<div className="wif-narrative" style={{background:"var(--red-bg)",color:"var(--red)"}}><b>Recovery at risk.</b> At {fmtP(convRate*100)} conversion, future margin ({fmt(futureMargin)}) doesn't cover the {fmt(totalCashback)} cashback cost. You need {sessToRecover}+ sessions per user to break even. Increase conversion rate or reduce cashback.</div>};
  }

  // ══════════ PRE-LOADED WALLET ══════════
  if(isP){
    const preloadAmt=parseFloat(offer.w)||0;
    const sessFromPreload=parseFloat(inp.avgSessionsFromPreload)||4;
    const aKwh=parseFloat(inp.avgKwhPerSession)||12;const aRate=parseFloat(inp.avgRatePerKwh)||22;
    const util=(parseFloat(inp.walletUtilisation)||75)/100;const incr=(parseFloat(inp.incrementality)||50)/100;
    const investPerUser=preloadAmt;const usedPerUser=preloadAmt*util;const wastedPerUser=preloadAmt*(1-util);
    const totalInvestment=redeemed*investPerUser;const totalWasted=redeemed*wastedPerUser;
    const sessRevenue=sessFromPreload*aKwh*aRate;const sessMargin=sessRevenue*mPct;
    const preloadROI=investPerUser>0?((sessMargin-investPerUser)/investPerUser)*100:0;
    const totalSessions=redeemed*sessFromPreload;const totalRevenue=totalSessions*aKwh*aRate;
    const totalMargin=totalRevenue*mPct;const netTotal=totalMargin-totalInvestment;
    const incrNet=totalMargin*incr-totalInvestment;
    const sessToRecover=investPerUser>0&&aKwh*aRate*mPct>0?Math.ceil(investPerUser/(aKwh*aRate*mPct)):0;
    analysis={type:"preload",knobs:<>
      <Knob label="Sessions from pre-load per user" value={inp.avgSessionsFromPreload||"4"} unit="" min={1} max={15} step={1} baseline={4} baseLabel="est." onChange={v=>save({avgSessionsFromPreload:v})}/>
      <Knob label="Avg kWh per session" value={inp.avgKwhPerSession} unit="kWh" min={1} max={50} step={1} baseline={12} baseLabel="platform avg" onChange={v=>save({avgKwhPerSession:v})}/>
      <Knob label="Rate per kWh" value={inp.avgRatePerKwh} unit={"₹"} min={10} max={50} step={1} baseline={22} baseLabel="current rate" onChange={v=>save({avgRatePerKwh:v})}/>
      <Knob label="Wallet utilisation" value={inp.walletUtilisation||"75"} unit="%" min={10} max={100} step={5} baseline={75} baseLabel="est." onChange={v=>save({walletUtilisation:v})}/>
      <Knob label="Incrementality" value={inp.incrementality||"50"} unit="%" min={0} max={100} step={5} baseline={50} baseLabel="est." onChange={v=>save({incrementality:v})}/>
      <Knob label="Redemption rate" value={inp.redemptionRate} unit="%" min={1} max={50} step={1} baseline={20} baseLabel="for pre-load" onChange={v=>save({redemptionRate:v})}/>
      <Knob label="Audience size" value={inp.userBase} unit="" min={1000} max={200000} step={1000} baseline={50000} baseLabel="target" onChange={v=>save({userBase:v})}/>
    </>,headline:<div className="wif-headline">
      <div className="wif-headline-block"><div className="wif-headline-label">Total investment</div><div className="wif-headline-val" style={{color:"var(--red)"}}>{fmt(totalInvestment)}</div><div className="wif-headline-delta">{"₹"}{investPerUser} × {redeemed.toLocaleString()} users</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">Pre-load ROI</div><div className="wif-headline-val" style={{color:preloadROI>=0?"var(--green)":"var(--red)"}}>{preloadROI>=0?"+":""}{preloadROI.toFixed(0)}%</div><div className="wif-headline-delta">{sessToRecover} sessions to recover</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">Balance wasted</div><div className="wif-headline-val" style={{color:util<0.5?"var(--red)":"var(--amber)"}}>{fmt(totalWasted)}</div><div className="wif-headline-delta">{fmtP((1-util)*100)} unused by users</div></div>
    </div>,
    detail:<>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Pre-load investment flow</div>
        <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.8,marginBottom:14}}>
          You invest <b style={{color:"var(--red)"}}>{"₹"}{investPerUser}</b> per user × {redeemed.toLocaleString()} users = <b style={{color:"var(--red)"}}>{fmt(totalInvestment)}</b> total.<br/>
          Users utilise <b>{fmtP(util*100)}</b> of balance → <b>{"₹"}{usedPerUser.toFixed(0)}</b> spent, <b>{"₹"}{wastedPerUser.toFixed(0)}</b> wasted per user.<br/>
          Each user does <b>{sessFromPreload}</b> sessions generating <b>{"₹"}{sessRevenue.toFixed(0)}</b> revenue ({"₹"}{sessMargin.toFixed(0)} margin).
        </div>
        <div className="metrics">
          <div className="mc"><div className="mc-label">Revenue from pre-load sessions</div><div className="mc-val">{fmt(totalRevenue)}</div></div>
          <div className="mc"><div className="mc-label">Margin earned</div><div className="mc-val" style={{color:"var(--green)"}}>{fmt(totalMargin)}</div></div>
          <div className="mc"><div className="mc-label">Net after investment</div><div className="mc-val" style={{color:netTotal>=0?"var(--green)":"var(--red)"}}>{netTotal>=0?"+":""}{fmt(netTotal)}</div></div>
        </div>
      </div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Incrementality test</div>
        <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:12}}>If only <b>{fmtP(incr*100)}</b> of sessions are truly incremental (users wouldn't have charged without the pre-load):</div>
        <div className="metrics">
          <div className="mc"><div className="mc-label">Incremental margin</div><div className="mc-val">{fmt(totalMargin*incr)}</div></div>
          <div className="mc"><div className="mc-label">Full investment</div><div className="mc-val" style={{color:"var(--red)"}}>{fmt(totalInvestment)}</div></div>
          <div className="mc"><div className="mc-label">True net impact</div><div className="mc-val" style={{color:incrNet>=0?"var(--green)":"var(--red)"}}>{incrNet>=0?"+":""}{fmt(incrNet)}</div></div>
        </div>
        {incrNet<0&&<div className="risk-item warn" style={{marginTop:10}}>At {fmtP(incr*100)} incrementality, the pre-load loses {fmt(Math.abs(incrNet))}. Many pre-load sessions may be from users who would have charged anyway.</div>}
      </div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Utilisation sensitivity</div>
        <div className="scroll-x"><table className="result-tbl"><thead><tr><th>Utilisation</th><th>Used/user</th><th>Wasted</th><th>Net P&L</th></tr></thead><tbody>
          {[40,50,60,75,85,95].map(u=>{const wu=preloadAmt*(1-(u/100))*redeemed;const nm=totalMargin-totalInvestment;return<tr key={u} style={{background:u===Math.round(util*100)?"var(--accent-bg)":""}}>
            <td style={{fontWeight:u===Math.round(util*100)?700:400}}>{u}%{u===Math.round(util*100)?" ←":""}</td><td>{"₹"}{(preloadAmt*(u/100)).toFixed(0)}</td><td style={{color:"var(--red)"}}>{fmt(wu)}</td><td style={{color:nm>=0?"var(--green)":"var(--red)",fontWeight:600}}>{nm>=0?"+":""}{fmt(nm)}</td></tr>})}
        </tbody></table></div>
      </div>
    </>,chart:null,
    narrative:preloadROI>=0?<div className="wif-narrative"><b>Investment justified.</b> {"₹"}{investPerUser} pre-load generates {"₹"}{sessMargin.toFixed(0)} margin over {sessFromPreload} sessions — a <b>{preloadROI.toFixed(0)}% ROI</b>. At {fmtP(util*100)} utilisation, {fmt(totalWasted)} goes unused. You need just {sessToRecover} sessions per user to break even.</div>:<div className="wif-narrative" style={{background:"var(--red-bg)",color:"var(--red)"}}><b>Investment at risk.</b> {"₹"}{investPerUser} pre-load only generates {"₹"}{sessMargin.toFixed(0)} margin over {sessFromPreload} sessions — a <b>{preloadROI.toFixed(0)}% return</b>. You need {sessToRecover} sessions to break even but only {sessFromPreload} are expected. Reduce pre-load amount or increase session targets.</div>};
  }

  if(!analysis)return null;
  return<div style={{marginTop:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"14px 0",borderTop:"1px solid var(--border)"}} onClick={()=>setOpen(!open)}>
      <div><div style={{fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--text3)"}}>SCALE IMPACT · {offer.name}</div><div style={{fontFamily:"var(--font-display)",fontSize:26,marginTop:4}}>Scale Impact Analysis</div></div>
      <span style={{color:"var(--text3)",fontSize:16}}>{open?"▾":"▸"}</span>
    </div>
    {open&&ub>0&&<>
      <div style={{fontSize:13,color:"var(--text3)",marginBottom:16,maxWidth:600,lineHeight:1.6}}>
        {isCharging&&("Adjust the levers to project how this "+(offer.reward==="Discount"?"discount":offer.reward==="ChargeXP"?"XP":offer.reward==="Coupon"?"coupon":"cashback")+" offer performs at scale. Each change updates all calculations live.")}
        {isW&&!isP&&"Wallet cashback costs are leading — you pay now, revenue comes later from charging. Adjust conversion assumptions to test feasibility."}
        {isP&&"Pre-load is a direct investment per user. This analysis tests whether the charging sessions it induces justify the cost."}
      </div>
      <div className="wif-grid">
        <div className="wif-knobs">{analysis.knobs}</div>
        <div className="wif-result">
          {analysis.headline}
          {analysis.chart}
          {analysis.narrative}
          {analysis.detail}
        </div>
      </div>
    </>}
    {open&&ub===0&&<div className="card" style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Set an audience size to see projections</div>}
  </div>;
}

function AIDrawer({offer,offers,open,onClose,step,lastSim}){const[msgs,setMsgs]=useState([{role:"bot",text:"I'm your campaign intelligence engine. Ask anything about your offers."}]),[inp,setInp]=useState(""),[thinking,setThinking]=useState(false);const br=useRef();useEffect(()=>{if(br.current)br.current.scrollTop=br.current.scrollHeight},[msgs]);
  const send=async t=>{if(!t.trim())return;setMsgs(p=>[...p,{role:"user",text:t.trim()}]);setInp("");setThinking(true);const oc=offer?JSON.stringify({name:offer.name,segments:offer.segments,activity:offer.activity,wpre:offer.wpre,w:offer.w,reward:offer.reward,tiers:offer.tiers,dpct:offer.dpct,cy:offer.cy,dy:offer.dy,sn:offer.sn,sx:offer.sx,t:offer.t,ce:offer.ce,ctMode:offer.ctMode,wtMode:offer.wtMode,rc:offer.rc?offer.rcCount+" users":null},null,2):"None";const ao=offers.map(o=>o.name+": "+(o.wpre?"Pre-load":o.reward)+" for "+(o.segments.join(",")||"—")+" ("+o.activity+")").join("\n");const sc=lastSim?"\nSim: ₹"+lastSim.totalReward.toFixed(2)+" reward, "+lastSim.qualTxns+" qual, "+lastSim.effRate.toFixed(1)+"% rate":"";const reply=await callAI(AI_SYS,"Offer:\n"+oc+"\n\nAll:\n"+ao+sc+"\n\nQ: "+t.trim());setThinking(false);setMsgs(p=>[...p,{role:"bot",text:reply}])};
  const qa=AI_QA[step]||AI_QA[5];return<><div className={"ai-overlay "+(open?"open":"")} onClick={onClose}/><div className={"ai-drawer "+(open?"open":"")}><div className="ai-hdr"><div className="ai-hdr-t"><span className="pulse"/> OfferOS AI</div><button className="ai-x" onClick={onClose}>✕</button></div><div className="ai-body" ref={br}>{msgs.map((m,i)=><div key={i} className={"ai-msg "+m.role}><div dangerouslySetInnerHTML={{__html:m.text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/`(.*?)`/g,"<code>$1</code>").replace(/•/g,"·").replace(/\n/g,"<br/>")}}/></div>)}{thinking&&<div className="ai-dots"><span><i/><i/><i/></span> Analyzing...</div>}</div><div className="ai-ftr"><div className="ai-ftr-row"><input className="ai-inp" value={inp} placeholder="Ask about this offer..." onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(inp)}/><button className="ai-go" onClick={()=>send(inp)}>Ask</button></div><div className="ai-qa">{qa.map(q=><button key={q} onClick={()=>send(q)}>{q}</button>)}</div></div></div></>}


export default function App(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);const[theme,setTheme]=useState(()=>{try{return window.localStorage?.getItem("offeros_theme")||"light"}catch{return"light"}});
  const[campaigns,setCampaigns]=useState([]);const[activeCampaign,setActiveCampaign]=useState(null);
  const[offers,setOffers]=useState([]);const[allOffers,setAllOffers]=useState([]);const[cid,setCid]=useState(null);const[offersLoading,setOffersLoading]=useState(false);
  const[step,setStep]=useState(0);const[txns,setTxns]=useState(defaultTxns("Charging session"));
  const[aiOpen,setAiOpen]=useState(false);const[lastSim,setLastSim]=useState(null);
  const[view,setView]=useState("campaigns");const[delTarget,setDelTarget]=useState(null);const[keyModal,setKeyModal]=useState(false);
  const[marginPct,setMarginPct]=useState(30);const[saveStatus,setSaveStatus]=useState("");const[showTemplates,setShowTemplates]=useState(false);
  const[showOnboarding,setShowOnboarding]=useState(false);const[onboardStep,setOnboardStep]=useState(0);
  const saveTimer=useRef(null);

  const offer=offers.find(o=>(o._id||o.id)===cid);const conflicts=detectConflicts(offers);

  // Theme
  useEffect(()=>{document.documentElement.className=theme;try{window.localStorage?.setItem("offeros_theme",theme)}catch{}},[theme]);
  const toggleTheme=()=>setTheme(t=>t==="light"?"dark":"light");

  // Auth check on mount
  useEffect(()=>{api("/auth?action=me").then(d=>{setUser(d.user);setAuthLoading(false)}).catch(()=>setAuthLoading(false))},[]);

  // Load campaigns when authenticated
  useEffect(()=>{if(user){api("/campaigns").then(c=>{setCampaigns(c);if(c.length===0){try{const seen=window.localStorage?.getItem("offeros_onboarded");if(!seen)setShowOnboarding(true)}catch{setShowOnboarding(true)}}Promise.all(c.map(camp=>api("/offers?campaignId="+camp._id).catch(()=>[]))).then(results=>{setAllOffers(results.flat())}).catch(()=>{})}).catch(()=>{})}},[user]);

  // Load offers when campaign selected
  useEffect(()=>{if(activeCampaign){setOffersLoading(true);api("/offers?campaignId="+activeCampaign._id).then(o=>{setOffers(o);setCid(null);setView("offers");setAllOffers(prev=>{const otherOffers=prev.filter(p=>p.campaignId!==activeCampaign._id);return[...otherOffers,...o]});setOffersLoading(false)}).catch(()=>setOffersLoading(false));setMarginPct(activeCampaign.marginPct||30)}},[activeCampaign]);

  const login=u=>{setUser(u);setAuthLoading(false)};
  const logout=async()=>{try{await api("/auth?action=logout",{method:"POST"})}catch{}setUser(null);setActiveCampaign(null);setOffers([]);setCampaigns([])};

  // Campaign CRUD
  const newCampaign=async()=>{try{const c=await api("/campaigns",{method:"POST",body:{name:"Campaign "+(campaigns.length+1),marginPct:30}});setCampaigns(p=>[c,...p]);setActiveCampaign(c);setView("offers")}catch{}};
  const archiveCampaign=async id=>{try{await api("/campaigns?id="+id,{method:"DELETE"});setCampaigns(p=>p.filter(c=>c._id!==id));if(activeCampaign?._id===id){setActiveCampaign(null);setOffers([]);setView("campaigns")}}catch{}};
  const campNameTimer=useRef(null);
  const updateCampaignName=async(name)=>{if(!activeCampaign)return;if(campNameTimer.current)clearTimeout(campNameTimer.current);campNameTimer.current=setTimeout(async()=>{try{const u=await api("/campaigns?id="+activeCampaign._id,{method:"PUT",body:{name}});setCampaigns(p=>p.map(c=>c._id===u._id?{...c,name:u.name}:c))}catch{}},1500)};
  const updateMargin=async(v)=>{setMarginPct(v);if(!activeCampaign)return;try{await api("/campaigns?id="+activeCampaign._id,{method:"PUT",body:{marginPct:v}})}catch{}};

  // Offer CRUD
  const addOffer=async(template)=>{if(!activeCampaign)return;const base=defaultOffer(offers.length+1);const o=template?.preset&&Object.keys(template.preset).length>0?{...base,...template.preset,name:template.name.split("—")[0].trim()+" "+(offers.length+1)}:base;try{const saved=await api("/offers",{method:"POST",body:{...o,campaignId:activeCampaign._id}});setOffers(p=>[...p,saved]);setCid(saved._id);setStep(0);setTxns(defaultTxns(saved.activity));setView("editor");setShowTemplates(false)}catch{}};
  const openOffer=id=>{setCid(id);setStep(0);const t=offers.find(o=>(o._id||o.id)===id);setTxns(t?.simTxns||defaultTxns(t?.activity));setLastSim(t?.simResult||null);setView("editor")};
  const dupOffer=async id=>{const s=offers.find(o=>(o._id||o.id)===id);if(!s||!activeCampaign)return;const{_id,createdBy,lastModifiedBy,createdAt,updatedAt,...data}=s;try{const saved=await api("/offers",{method:"POST",body:{...data,campaignId:activeCampaign._id,name:s.name+" (copy)"}});setOffers(p=>[...p,saved]);setCid(saved._id);setStep(0);setView("editor")}catch{}};
  const confirmDel=async()=>{if(!delTarget)return;try{await api("/offers?id="+delTarget,{method:"DELETE"});setOffers(p=>p.filter(o=>(o._id||o.id)!==delTarget));if(cid===delTarget){const remaining=offers.filter(o=>(o._id||o.id)!==delTarget);setCid(remaining.length>0?(remaining[remaining.length-1]._id||remaining[remaining.length-1].id):null);if(remaining.length===0)setView("offers")}}catch{}setDelTarget(null)};

  // Debounced auto-save for offer updates
  const upd=useCallback(c=>{setOffers(p=>p.map(o=>(o._id||o.id)===cid?{...o,...c}:o));
    if(saveTimer.current)clearTimeout(saveTimer.current);setSaveStatus("saving");
    saveTimer.current=setTimeout(async()=>{if(!cid)return;try{await api("/offers?id="+cid,{method:"PUT",body:c});setSaveStatus("saved");setTimeout(()=>setSaveStatus(""),2000)}catch{setSaveStatus("error")}},2000);
  },[cid]);

  if(authLoading)return<><style>{css}</style><div className="login-page"><div style={{color:"var(--text3)"}}>Loading...</div></div></>;
  if(!user)return<><style>{css}</style><LoginPage onLogin={login}/></>;

  const STEPS=STEP_INFO;
  return<><style>{css}</style><div className="pulse-shell">
    <div className="pulse-side">
      <div className="pulse-brand" onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>
        <div className="pulse-brand-mark accent"><SvgIcon name="bolt"/></div><span>OfferOS</span>
      </div>
      <div className="pulse-org">
        <div className="pulse-org-avatar">CZ</div><span className="pulse-org-name">ChargeZone</span><span className="pulse-org-caret">⌄</span>
      </div>
      <div className="pulse-sec">Workspace</div>
      <button className={"pulse-nav "+(view==="campaigns"&&!activeCampaign?"active":"")} onClick={()=>{setActiveCampaign(null);setView("campaigns")}}><span className="pulse-nav-glyph">◇</span>Overview</button>
      <button className={"pulse-nav "+((view==="offers"||view==="editor")?"active":"")} onClick={()=>{if(activeCampaign)setView("offers");else setView("campaigns")}}><span className="pulse-nav-glyph">◐</span>Campaigns</button>
      <button className={"pulse-nav "+(view==="schedule"?"active":"")} onClick={()=>setView("schedule")}><span className="pulse-nav-glyph">▦</span>Schedule</button>
      <button className={"pulse-nav "+(aiOpen?"active":"")} onClick={()=>setAiOpen(!aiOpen)}><span className="pulse-nav-glyph">⊙</span>AI Assistant{!getApiKey()&&<span className="pulse-nav-badge">!</span>}</button>
      <div className="pulse-sec">Account</div>
      <button className="pulse-nav" onClick={()=>setKeyModal(true)}><span className="pulse-nav-glyph">⚙</span>Settings</button>
      <div className="pulse-foot">
        <div className="pulse-foot-avatar">{user.displayName?.[0]?.toUpperCase()||"U"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="pulse-foot-who">{user.displayName||"User"}</div>
          <div className="pulse-foot-role">{user.role||"editor"} · ChargeZone</div>
        </div>
        <div className="theme-toggle" onClick={toggleTheme} title={theme==="light"?"Dark mode":"Light mode"}><div className="thumb"/></div>
      </div>
    </div>
    <div className="pulse-main">
      <div className="pulse-top">
        <div className="pulse-crumb">
          <span style={{cursor:"pointer"}} onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>OfferOS</span>
          {activeCampaign&&<><span className="sep">/</span><span style={{cursor:"pointer"}} onClick={()=>setView("offers")}>{activeCampaign.name}</span></>}
          {offer&&view==="editor"&&<><span className="sep">/</span><span className="current">{offer.name}</span></>}
          {view==="schedule"&&<><span className="sep">/</span><span className="current">Schedule</span></>}
          {!activeCampaign&&view!=="schedule"&&<><span className="sep">/</span><span className="current">Campaigns</span></>}
        </div>
        <div className="pulse-top-r">
          {saveStatus&&<div className={"save-indicator "+saveStatus}>{saveStatus==="saving"?"Saving...":saveStatus==="saved"?"✓ Saved":saveStatus==="error"?"Save failed":""}</div>}
          <div className="user-badge" onClick={logout} title={"Sign out"}>
            <div className="user-badge-avatar">{user.displayName?.[0]?.toUpperCase()||"U"}</div>
          </div>
        </div>
      </div>
      <div className="pulse-content">
      {/* CAMPAIGNS LIST */}
      {view==="campaigns"&&<><HomeDashboard campaigns={campaigns} allOffers={allOffers} /><CampaignsList campaigns={campaigns} onSelect={c=>{setActiveCampaign(c);}} onNew={newCampaign} onArchive={archiveCampaign}/></>}

      {/* SCHEDULE VIEW */}
      {view==="schedule"&&<ScheduleView allOffers={allOffers} campaigns={campaigns} onOpenOffer={(o)=>{const camp=campaigns.find(c=>c._id===o.campaignId);if(camp){setActiveCampaign(camp);api("/offers?campaignId="+camp._id).then(offs=>{setOffers(offs);setCid(o._id||o.id);setStep(0);setTxns(o.simTxns||defaultTxns(o.activity));setLastSim(o.simResult||null);setView("editor")}).catch(()=>{})}}}/>}

      {/* OFFERS VIEW — Campaign Canvas */}
      {view==="offers"&&activeCampaign&&<>
        <div className="pulse-h">
          <div>
            <div className="row" style={{gap:10,marginBottom:6}}>
              <span className="pchip live"><span className="pchip-dot" style={{background:"var(--ok)"}}/>Live</span>
              <span className="muted" style={{fontSize:12}}>Margin assumption {marginPct}%</span>
            </div>
            <h1>{activeCampaign.name}</h1>
            <div className="lede">{offers.length} offers configured. Click any offer to open the Studio.</div>
          </div>
          <div className="row" style={{gap:8}}>
            <button className="pbtn sm" onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>← Back</button>
            <button className="pbtn sm">Export brief</button>
            <button className="pbtn accent sm" onClick={()=>setShowTemplates(true)}>+ New offer</button>
          </div>
        </div>
        {/* Campaign KPIs */}
        {offers.length>0&&<div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",gap:14,marginBottom:24}}>
          <div className="pcard" style={{padding:"22px 26px"}}>
            <div className="pmetric-label">Net P&L · projected</div>
            <div className="row" style={{gap:14,alignItems:"flex-end",marginTop:6}}>
              <div className="pmetric-val" style={{color:offers.some(o=>o.simResult)?"var(--ok)":"var(--ink3)"}}>{offers.some(o=>o.simResult)?"+₹"+(offers.reduce((s,o)=>s+(o.simRoi?.netImpact||0),0)/1000).toFixed(1)+"k":"—"}</div>
            </div>
            <div className="divider"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,fontSize:12}}>
              <div><div className="muted" style={{marginBottom:2}}>Margin</div><div className="b">+₹{(offers.reduce((s,o)=>s+(o.simRoi?.marginEarned||0),0)/1000).toFixed(1)}k</div></div>
              <div><div className="muted" style={{marginBottom:2}}>Reward cost</div><div className="b" style={{color:"var(--bad)"}}>-₹{(offers.reduce((s,o)=>s+(o.simResult?.totalReward||0),0)/1000).toFixed(1)}k</div></div>
              <div><div className="muted" style={{marginBottom:2}}>Offers</div><div className="b">{offers.length}</div></div>
            </div>
          </div>
          <div className="pcard"><div className="pmetric-label">Simulated</div><div className="pmetric-val">{offers.filter(o=>o.simResult).length}/{offers.length}</div><div className="muted" style={{fontSize:11,marginTop:4}}>{offers.filter(o=>!o.simResult).length} pending</div></div>
          <div className="pcard"><div className="pmetric-label">Segments</div><div className="pmetric-val" style={{fontSize:20}}>{[...new Set(offers.flatMap(o=>o.segments||[]))].join(", ")||"—"}</div></div>
          <div className="pcard"><div className="pmetric-label">Conflicts</div><div className="pmetric-val" style={{color:Object.keys(conflicts).length>0?"var(--bad)":"var(--ok)"}}>{Object.keys(conflicts).length>0?Math.round(Object.keys(conflicts).length/2):"None"}</div></div>
        </div>}
        {/* Offer Table */}
        {offersLoading&&<div style={{textAlign:"center",padding:40,color:"var(--ink3)"}}>Loading offers...</div>}
        {!offersLoading&&offers.length>0&&<>
          <div className="spread" style={{marginBottom:14}}>
            <div className="serif" style={{fontSize:24}}>Offers in this campaign</div>
          </div>
          <div className="offer-table">
            <div className="offer-table-head"><span>Offer</span><span>Status</span><span>Reward</span><span>Segments</span><span style={{textAlign:"right"}}>Simulated</span><span style={{textAlign:"right"}}>Per-session</span><span></span></div>
            {offers.map((o,i)=>{const tp=o.wpre?"Pre-load":o.reward;const st=getOfferStatus(o);const oid=o._id||o.id;const perSess=o.simResult&&o.simResult.qualTxns>0?o.simResult.totalReward/o.simResult.qualTxns:null;return<div key={oid} className="offer-table-row" onClick={()=>openOffer(oid)}>
              <div><div className="b" style={{fontSize:14,marginBottom:3}}>{o.name}</div><div className="muted" style={{fontSize:11}}>{o.activity}{o.ctMode==="first"?" · First only":""}</div></div>
              <div><span className={"pchip "+(st==="live"?"live":st==="approved"?"ok":st==="ready"?"info":"draft")}>{STATUS_LABELS[st]||st}</span></div>
              <div><span className={"pchip "+tp.toLowerCase().replace("-","").replace(" ","")}><span className="pchip-dot" style={{background:DOT_COLORS[tp]||"var(--ink3)"}}/>{tp}</span></div>
              <div style={{fontSize:12}}>{o.segments?.join(", ")||"—"}</div>
              <div style={{textAlign:"right"}}>{o.simResult?<span className="pchip ok">Yes</span>:<span className="muted" style={{fontSize:11}}>—</span>}</div>
              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12,color:perSess!==null?(o.simRoi?.netImpact>=0?"var(--ok)":"var(--bad)"):"var(--ink3)"}}>{perSess!==null?(o.simRoi?.netImpact>=0?"+":"")+"\u20b9"+perSess.toFixed(0)+"/sess":"—"}</div>
              <div style={{textAlign:"right"}}><button className="pbtn ghost sm" onClick={e=>{e.stopPropagation();setDelTarget(oid)}}>⋯</button></div>
            </div>})}
            <div className="offer-table-add" onClick={()=>setShowTemplates(true)}>+ Add another offer to this campaign</div>
          </div>
        </>}
        {!offersLoading&&offers.length===0&&<div className="pcard" style={{textAlign:"center",padding:40,color:"var(--ink3)"}}>
          <div style={{fontSize:24,marginBottom:8}}>No offers yet</div>
          <button className="pbtn accent" onClick={()=>setShowTemplates(true)}>+ Create first offer</button>
        </div>}
        {/* Composition panels */}
        {offers.length>0&&<div className="composition-grid">
          <div className="pcard">
            <div className="pcard-hd"><div><div className="pcard-t">Reach across segments</div><div className="pcard-sub">How offers cover your audience</div></div></div>
            {["New","Engaged","Existing","Dormant","All"].map(s=>{const count=offers.filter(o=>(o.segments||[]).includes(s)||(o.segments||[]).includes("All")&&s!=="All").length;const pct=Math.min(100,count*25);return<div key={s} style={{marginBottom:14}}>
              <div className="spread" style={{marginBottom:5,fontSize:12}}><span className="row" style={{gap:8}}><span style={{fontFamily:"var(--display)",fontSize:16,color:"var(--ink2)"}}>{SEGMENTS[s]?.icon||"◎"}</span><span className="b">{s}</span></span><span className="muted">{count} offer{count!==1?"s":""}</span></div>
              <div className="bar-wrap"><div className="bar-fill" style={{width:pct+"%",background:count===0?"var(--bg3)":"var(--ink)"}}/></div>
            </div>})}
          </div>
          <div className="pcard">
            <div className="pcard-hd"><div><div className="pcard-t">Reward mix</div><div className="pcard-sub">Where the budget is going</div></div></div>
            {["Cashback","Coupon","Discount","ChargeXP","Pre-load"].map(r=>{const list=offers.filter(o=>(o.wpre?"Pre-load":o.reward)===r);if(!list.length)return null;const cost=list.reduce((s,o)=>s+(o.simResult?.totalReward||0),0);const totalCost=offers.reduce((s,o)=>s+(o.simResult?.totalReward||0),0);const pct=totalCost>0?(cost/totalCost*100):0;return<div key={r} style={{marginBottom:14}}>
              <div className="spread" style={{marginBottom:5,fontSize:12}}><span className={"pchip "+r.toLowerCase().replace("-","").replace(" ","")}><span className="pchip-dot" style={{background:DOT_COLORS[r]||"var(--ink3)"}}/>{r}</span><span className="muted">₹{(cost/1000).toFixed(1)}k · {Math.round(pct)}%</span></div>
              <div className="bar-wrap"><div className="bar-fill" style={{width:Math.max(pct,2)+"%",background:DOT_COLORS[r]||"var(--ink3)"}}/></div>
            </div>})}
          </div>
        </div>}
      {showTemplates&&<div className="modal-overlay" onClick={()=>setShowTemplates(false)}><div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}><div className="modal-title">Choose a starting point</div><div className="modal-msg">Pick a template or start from scratch.</div>{OFFER_TEMPLATES.map((t,i)=><div key={i} style={{padding:"14px 16px",border:"1px solid var(--line)",borderRadius:"var(--r1)",marginBottom:8,cursor:"pointer",transition:"all .12s"}} onClick={()=>addOffer(t)} onMouseOver={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseOut={e=>e.currentTarget.style.borderColor="var(--line)"}><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{t.name}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{t.desc}</div></div>)}</div></div>}
      </>}

      {/* EDITOR — OFFER STUDIO */}
      {view==="editor"&&offer&&<>
        <div className="pulse-h">
          <div>
            <div className="eyebrow">Offer Studio</div>
            <input style={{fontFamily:"var(--display)",fontSize:36,fontWeight:400,border:"none",background:"none",width:"100%",padding:0,color:"var(--ink)",letterSpacing:"-.02em"}} value={offer.name} onChange={e=>upd({name:e.target.value})} placeholder="Offer name"/>
            <div className="lede" style={{marginTop:6}}>Compose by section. Toggle, drag, replace — preview rebuilds the spec live.</div>
          </div>
          <div className="row" style={{gap:8}}>
            <div className="save-indicator saved">● Saved</div>
            <button className="pbtn sm" onClick={()=>setView("offers")}>Discard</button>
            <button className="pbtn sm" onClick={()=>upd({offerStatus:"draft"})}>Save draft</button>
            <button className="pbtn primary sm" onClick={()=>upd({offerStatus:"ready"})}>Send for review</button>
          </div>
        </div>
        <div className={step===6?"":"studio"}>
          {step!==6&&<div className="studio-left">
            {/* Section 01 — Audience */}
            <div className="studio-section">
              <div className="studio-section-head" onClick={()=>setStep(step===0?-1:0)}>
                <span className="studio-section-num">01</span>
                <span className="studio-section-title">Who's this for?</span>
                <span className={"studio-section-chip "+(offer.segments?.length>0?"filled":"empty")}>{offer.segments?.length>0?"Filled":"Empty"}</span>
                <span className={"studio-section-arrow "+(step===0?"open":"")}>▾</span>
              </div>
              {step!==0&&offer.segments?.length>0&&<div className="studio-section-summary">{offer.segments.join(", ")}{offer.rc?" + "+offer.rcCount+" CSV IDs":""}</div>}
              {step===0&&<div className="studio-section-body"><AudienceStep offer={offer} update={upd}/></div>}
            </div>
            {/* Section 02 — Activity */}
            <div className="studio-section">
              <div className="studio-section-head" onClick={()=>setStep(step===1?-1:1)}>
                <span className="studio-section-num">02</span>
                <span className="studio-section-title">What earns it?</span>
                <span className={"studio-section-chip "+(offer.activity?"filled":"empty")}>{offer.activity?"Filled":"Empty"}</span>
                <span className={"studio-section-arrow "+(step===1?"open":"")}>▾</span>
              </div>
              {step!==1&&<div className="studio-section-summary">{offer.activity}{offer.wpre?" · Pre-loaded wallet":""}{offer.ctMode==="first"?" · First session only":""}</div>}
              {step===1&&<div className="studio-section-body"><ActivityStep offer={offer} update={upd} setTxns={setTxns}/></div>}
            </div>
            {/* Section 03 — Reward */}
            <div className="studio-section">
              <div className="studio-section-head" onClick={()=>setStep(step===2?-1:2)}>
                <span className="studio-section-num">03</span>
                <span className="studio-section-title">What do they get?</span>
                <span className={"studio-section-chip "+(validateStep(offer,2)?"filled":"empty")}>{validateStep(offer,2)?"Filled":"Empty"}</span>
                <span className={"studio-section-arrow "+(step===2?"open":"")}>▾</span>
              </div>
              {step!==2&&<div className="studio-section-summary">{offer.wpre?"Pre-loaded ₹"+(offer.w||"—"):offer.reward}{offer.reward==="Cashback"&&!offer.wpre?" · "+offer.tiers?.map(t=>t.pct+"%").join("→"):""}{offer.reward==="Discount"?" · "+offer.dpct+"%":""}</div>}
              {step===2&&<div className="studio-section-body"><RewardStep offer={offer} update={upd}/></div>}
            </div>
            {/* Section 04 — Guardrails */}
            <div className="studio-section">
              <div className="studio-section-head" onClick={()=>setStep(step===3?-1:3)}>
                <span className="studio-section-num">04</span>
                <span className="studio-section-title">Guardrails</span>
                <span className={"studio-section-chip filled"}>Filled</span>
                <span className={"studio-section-arrow "+(step===3?"open":"")}>▾</span>
              </div>
              {step!==3&&<div className="studio-section-summary">{offer.cy?"Cap ₹"+offer.cy+"/sess":"No cap"}{offer.un?" · Min "+offer.un+" kWh":""}{offer.sx?" · Max "+offer.sx+" sessions":""}</div>}
              {step===3&&<div className="studio-section-body"><BoundaryStep offer={offer} update={upd}/></div>}
            </div>
            {/* Section 05 — Duration */}
            <div className="studio-section">
              <div className="studio-section-head" onClick={()=>setStep(step===4?-1:4)}>
                <span className="studio-section-num">05</span>
                <span className="studio-section-title">When does it run?</span>
                <span className={"studio-section-chip "+(offer.t?"filled":"empty")}>{offer.t?"Filled":"Empty"}</span>
                <span className={"studio-section-arrow "+(step===4?"open":"")}>▾</span>
              </div>
              {step!==4&&<div className="studio-section-summary">{offer.t} days{offer.startDate?" · Starts "+offer.startDate:""}{offer.ce?" · cashback expires "+offer.ce+"d after earn":""}</div>}
              {step===4&&<div className="studio-section-body"><DurationStep offer={offer} update={upd}/></div>}
            </div>
          </div>}
          {/* RIGHT RAIL — Live preview (hidden when Simulate is full-width) */}
          {step!==6&&<div className="studio-right">
            <div className="preview-card">
              <div className="preview-tabs">
                <button className={"preview-tab "+(step!==5&&step!==6?"active":"")} onClick={()=>setStep(0)}>Preview</button>
                <button className={"preview-tab "+(step===5?"active":"")} onClick={()=>setStep(5)}>Spec</button>
                <button className={"preview-tab "+(step===6?"active":"")} onClick={()=>setStep(6)}>Simulate</button>
              </div>
              {step!==5&&<>
                <div className="preview-section-label">Plain English</div>
                <div className="preview-plain">
                  <span className={"pchip "+(offer.wpre?"preload":offer.reward?.toLowerCase()||"cashback")} style={{marginRight:6}}>
                    <span className="pchip-dot" style={{background:DOT_COLORS[offer.wpre?"Pre-load":offer.reward]||"var(--ink3)"}}/>{offer.wpre?"Pre-load":offer.reward}
                  </span>
                  {" for "}<b>{offer.segments?.join(", ")||"—"}</b>{" users. "}
                  {offer.ctMode==="first"&&<><b>First session only</b>{" — "}</>}
                  {offer.reward==="Cashback"&&!offer.wpre&&(" rate steps up: "+offer.tiers?.map(t=>"session #"+t.s+" earns "+t.pct+"%").join(", ")+". ")}
                  {offer.reward==="Discount"&&(" "+offer.dpct+"% discount on charging. ")}
                  {offer.cy&&<>{"Capped at "}<b>{"₹"+offer.cy}</b>{"/session. "}</>}
                  {"Runs "}<b>{offer.t||30}{" days"}</b>{"."}
                </div>
                <div className="preview-section-label">Outcome at a glance</div>
                {offer.simResult?<>
                  <div className="preview-outcome">
                    <div>
                      <div className="pmetric-label">Per-session</div>
                      <div className="preview-outcome-val" style={{color:offer.simRoi?.netImpact>=0?"var(--ok)":"var(--bad)"}}>{offer.simRoi?.netImpact>=0?"+":""}₹{(offer.simRoi?.netImpact||(offer.simResult?.totalReward||0)).toFixed(0)}</div>
                      <div className="muted" style={{fontSize:11,marginTop:4}}>net margin per qualifying session</div>
                    </div>
                    <span className={"pchip "+(offer.simRoi?.netImpact>=0?"ok":"bad")}>{offer.simRoi?.netImpact>=0?"+ profitable":"− losing"}</span>
                  </div>
                  <div className="preview-outcome-grid">
                    <div className="preview-outcome-item"><div className="label">Avg reward</div><div className="val">₹{offer.simResult.qualTxns>0?(offer.simResult.totalReward/offer.simResult.qualTxns).toFixed(0):"—"}</div></div>
                    <div className="preview-outcome-item"><div className="label">Avg net</div><div className="val">₹{offer.simRoi?.avgReward?.toFixed(0)||"—"}</div></div>
                    <div className="preview-outcome-item"><div className="label">Effective rate</div><div className="val">{offer.simResult.effRate?.toFixed(1)||"—"}%</div></div>
                    <div className="preview-outcome-item"><div className="label">Breakeven</div><div className="val">{offer.simRoi?.breakeven||"Every session"}</div></div>
                  </div>
                </>:<div className="muted" style={{fontSize:13,padding:"20px 0"}}>Run a simulation to see outcome metrics</div>}
                <div className="preview-section-label">Risks & checks</div>
                {offer.simRoi?.risks?.length>0?offer.simRoi.risks.map((r,i)=><div key={i} className="preview-risk">
                  <div className="preview-risk-dot" style={{background:r.type==="ok"?"var(--ok-soft)":r.type==="warn"?"var(--warn-soft)":"var(--bad-soft)",color:r.type==="ok"?"var(--ok)":r.type==="warn"?"var(--warn)":"var(--bad)"}}>{r.type==="ok"?"✓":"!"}</div>
                  <div>{r.msg}</div>
                </div>):<div className="muted" style={{fontSize:12}}>Run simulation to generate risk checks</div>}
                <button className="sim-button" onClick={()=>setStep(6)}>Run full simulation →</button>
              </>}
              {step===5&&<SummaryStep offer={offer} campaignName={activeCampaign?.name}/>}
            </div>
          </div>}
          {/* SIMULATE — Full width when active */}
          {step===6&&<div>
            <div className="spread" style={{marginBottom:18}}>
              <div><div className="eyebrow">Scenarios</div><h2 style={{fontFamily:"var(--display)",fontSize:28}}>Test & simulate</h2></div>
              <button className="pbtn sm" onClick={()=>setStep(0)}>← Back to studio</button>
            </div>
            <SimulateStep offer={offer} txns={txns} setTxns={setTxns} marginPct={marginPct} onSaveSim={(simData)=>{setOffers(p=>p.map(o=>(o._id||o.id)===cid?{...o,...simData}:o));if(cid){api("/offers?id="+cid,{method:"PUT",body:simData}).catch(()=>{})}}}/>
          </div>}
        </div>
      </>}
    </div></div>
    <AIDrawer offer={offer} offers={offers} open={aiOpen} onClose={()=>setAiOpen(false)} step={step} lastSim={lastSim}/>
    {/* Onboarding walkthrough */}
    {showOnboarding&&<div className="modal-overlay" onClick={()=>{setShowOnboarding(false);try{window.localStorage?.setItem("offeros_onboarded","1")}catch{}}}><div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
      {onboardStep===0&&<><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:8}}>👋</div><div className="modal-title" style={{fontSize:22}}>Welcome to OfferOS</div><div className="modal-msg">The AI-powered campaign builder for ChargeZone. Let's walk through how it works — takes about 60 seconds.</div></div><div style={{display:"flex",gap:8,justifyContent:"center"}}><button className="btn btn-primary" onClick={()=>setOnboardStep(1)}>Show me how it works</button><button className="btn" onClick={()=>{setShowOnboarding(false);try{window.localStorage?.setItem("offeros_onboarded","1")}catch{}}}>Skip, I'll explore</button></div></>}
      {onboardStep===1&&<><div className="modal-title">Step 1: Create a Campaign</div><div className="modal-msg">Campaigns are containers for your offers. Start by creating one — give it a name like "Diwali 2025" or "Q1 Acquisition."</div><div style={{padding:14,background:"var(--bg2)",borderRadius:"var(--r2)",marginBottom:16,fontSize:12,color:"var(--text2)",lineHeight:1.6}}>💡 Each campaign can hold multiple offers targeting different segments with different reward types.</div><div style={{display:"flex",gap:8,justifyContent:"space-between"}}><button className="btn" onClick={()=>setOnboardStep(0)}>← Back</button><button className="btn btn-primary" onClick={()=>setOnboardStep(2)}>Next →</button></div></>}
      {onboardStep===2&&<><div className="modal-title">Step 2: Build Offers</div><div className="modal-msg">Each offer has 7 simple steps:</div><div style={{padding:14,background:"var(--bg2)",borderRadius:"var(--r2)",marginBottom:16,fontSize:12,color:"var(--text2)",lineHeight:1.8}}>1. <b>Who's this for?</b> — Pick customer segments<br/>2. <b>What earns the reward?</b> — Charging or wallet top-up<br/>3. <b>What do they get?</b> — Cashback, discount, XP, or coupon<br/>4. <b>What are the limits?</b> — Caps and minimums<br/>5. <b>How long does it run?</b> — Duration and expiry<br/>6. <b>Review</b> — Check everything, export for tech team<br/>7. <b>Test with scenarios</b> — Simulate and project at scale</div><div style={{display:"flex",gap:8,justifyContent:"space-between"}}><button className="btn" onClick={()=>setOnboardStep(1)}>← Back</button><button className="btn btn-primary" onClick={()=>setOnboardStep(3)}>Next →</button></div></>}
      {onboardStep===3&&<><div className="modal-title">Step 3: Test & Export</div><div className="modal-msg">Before going live:</div><div style={{padding:14,background:"var(--bg2)",borderRadius:"var(--r2)",marginBottom:16,fontSize:12,color:"var(--text2)",lineHeight:1.8}}>📊 <b>Run simulations</b> with sample transactions to validate the offer mechanics<br/>📈 <b>Scale Impact Analysis</b> projects costs across your full user base<br/>📋 <b>Copy as JSON</b> or <b>Download PDF</b> to share the complete spec with your tech team<br/>📅 <b>Schedule view</b> shows all offers on a Gantt chart timeline</div><div style={{display:"flex",gap:8,justifyContent:"space-between"}}><button className="btn" onClick={()=>setOnboardStep(2)}>← Back</button><button className="btn btn-primary" onClick={()=>{setShowOnboarding(false);setOnboardStep(0);try{window.localStorage?.setItem("offeros_onboarded","1")}catch{}}}>Got it, let's start!</button></div></>}
      <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:16}}>{[0,1,2,3].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:i===onboardStep?"var(--accent)":"var(--bg3)"}}/>)}</div>
    </div></div>}
    <div className="mobile-bar">
      <button className={view==="campaigns"?"active":""} onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>⊞<span>Home</span></button>
      <button className={view==="schedule"?"active":""} onClick={()=>setView("schedule")}>📅<span>Schedule</span></button>
      {activeCampaign&&<button className={view==="offers"?"active":""} onClick={()=>setView("offers")}>☰<span>Offers</span></button>}
      {offer&&<button className={view==="editor"?"active":""} onClick={()=>setView("editor")}>✎<span>Editor</span></button>}
      <button className={aiOpen?"active":""} onClick={()=>setAiOpen(!aiOpen)}>✦<span>AI</span></button>
    </div>
  </div>{delTarget&&<ConfirmModal title="Delete offer?" msg={'"'+(offers.find(o=>(o._id||o.id)===delTarget)?.name||"")+'" will be permanently removed.'} onConfirm={confirmDel} onCancel={()=>setDelTarget(null)}/>}{keyModal&&<APIKeyModal onClose={()=>setKeyModal(false)}/>}</>}
