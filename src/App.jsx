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

const DOT_COLORS = { Cashback: "#1a9d4a", Discount: "#c48a1a", ChargeXP: "#7c4dbd", Coupon: "#2a7ab8", "Pre-load": "#0e8a7a" };
const BADGE_MAP = { Cashback: ["bg-cashback", "Cashback"], Discount: ["bg-discount", "Discount"], ChargeXP: ["bg-xp", "ChargeXP"], Coupon: ["bg-coupon", "Coupon"] };
const REWARDS_FOR = { "Charging session": ["Cashback", "Discount", "Coupon"], "Wallet top-up": ["Cashback", "ChargeXP", "Coupon"] };

let _oc = 0;
const uid = () => "o" + (++_oc) + "_" + Date.now();
const defaultOffer = (n) => ({ id: uid(), name: "Offer " + n, segments: [], activity: "Charging session", wpre: false, w: "", wa: "Campaign start date", dist: "spread", wsx: "", wsxType: "fixed", wpun: "", wpc: "", reward: "Cashback", tiers: [{ s: "1", pct: "7" }, { s: "2", pct: "10" }, { s: "3", pct: "12" }], dpct: "", xpwpct: "", p: "", un: "", ux: "", nx: "", cy: "", dy: "", wm: "", sn: "", sx: "", t: "30", te: "", ce: "30", ctMode: "off", wtMode: "none", wtSlabs: [{ min: "100", max: "499", pct: "5" }, { min: "500", max: "999", pct: "8" }, { min: "1000", max: "", pct: "12" }], rc: null, rcFileName: "", rcCount: 0, rcLogic: "intersection", simTxns: null, simResult: null, simRoi: null, startDate: new Date().toISOString().split("T")[0], paused: false, scaleInputs: null });
function getOfferStatus(o) { if (o.paused) return "paused"; const today = new Date(); const sd = o.startDate ? new Date(o.startDate) : null; if (!sd) return "draft"; const days = parseInt(o.t) || 30; const ed = o.te ? new Date(o.te) : new Date(sd.getTime() + days * 86400000); if (today < sd) return "scheduled"; if (today > ed) return "expired"; return "active"; }
function getOfferEndDate(o) { const sd = o.startDate ? new Date(o.startDate) : new Date(); const days = parseInt(o.t) || 30; return o.te ? new Date(o.te) : new Date(sd.getTime() + days * 86400000); }
const STATUS_COLORS = { active: "var(--green)", scheduled: "var(--blue)", paused: "var(--amber)", expired: "var(--text3)", draft: "var(--text3)" };
const STATUS_BG = { active: "var(--green-bg)", scheduled: "var(--blue-bg)", paused: "var(--amber-bg)", expired: "var(--bg3)", draft: "var(--bg3)" };
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
    if (offer.wpre) { if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (wr <= 0) st = "exhausted"; else if (offer.sx && sc >= parseInt(offer.sx)) st = "max-sess"; else if (totalUsed >= wpcLimit) st = "credit-cap"; else { if (wpunMin > 0) { const kwhEquiv = amt / (parseFloat(offer.wsx) || amt); if (kwhEquiv < wpunMin) { st = "below-kwh"; return { idx: i + 1, date: tx.date || "—", amount: amt, reward: 0, rateStr: "< " + wpunMin + "kWh", sessStr: "—", status: st, type: "preload", netVal: 0 }; } } sc++; ss = sc; let ms = wr; if (offer.dist === "spread" && offer.wsx) { const cap = offer.wsxType === "pct" ? (parseFloat(offer.wsx) / 100 * (parseFloat(offer.w) || 0)) : parseFloat(offer.wsx); ms = Math.min(wr, cap); } const remainingCap = wpcLimit - totalUsed; ms = Math.min(ms, remainingCap); rw = Math.min(ms, amt); wr = Math.max(0, wr - rw); totalUsed += rw; rs = "₹" + rw.toFixed(2) + " used"; st = wr <= 0 ? "exhausted-now" : totalUsed >= wpcLimit ? "credit-cap" : "applied"; qt++; } return { idx: i + 1, date: tx.date || "—", amount: amt, reward: rw, rateStr: rs, sessStr: ss, status: st, type: "preload", netVal: 0 };
    } else if (offer.reward === "Cashback") { if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (offer.wm && amt < parseFloat(offer.wm)) st = "below-min"; else if (offer.wtMode === "first" && ftu) st = "not-first"; else if (offer.sx && sc >= parseInt(offer.sx)) st = "max-sess"; else { sc++; ss = sc;
      if (snV > 0 && sc < snV) { return { idx: i + 1, date: tx.date || "—", amount: amt, reward: 0, rateStr: sc + "/" + snV, sessStr: ss, status: "pending-sn", type: "wallet-cashback", netVal: 0 }; }
      let pct = 0, slabOk = true; if (offer.wtMode === "slab") { const sl = offer.wtSlabs.find(s => { const mn = parseFloat(s.min) || 0, mx = s.max ? parseFloat(s.max) : Infinity; return amt >= mn && amt <= mx; }); if (sl) { pct = parseFloat(sl.pct) || 0; } else { slabOk = false; st = "no-slab"; rw = 0; rs = "No slab"; } } else { const m = offer.tiers.filter(t => parseInt(t.s) === sc); pct = m.length > 0 ? parseFloat(m[0].pct) : parseFloat(offer.tiers[offer.tiers.length - 1]?.pct || 0); }
      if (slabOk) { rw = amt * (pct / 100); rs = pct.toFixed(1) + "%"; if (offer.cy && rw > parseFloat(offer.cy)) { rw = parseFloat(offer.cy); st = "capped"; } else st = "earned"; qt++; } if (offer.wtMode === "first") ftu = true; }
    return { idx: i + 1, date: tx.date || "—", amount: amt, reward: rw, rateStr: rs, sessStr: ss, status: st, type: "wallet-cashback", netVal: 0 };
    } else if (offer.reward === "ChargeXP") { if (!td) st = "no-date"; else if (ed && td > ed) st = "expired"; else if (offer.wm && amt < parseFloat(offer.wm)) st = "below-min"; else { sc++; ss = sc; qt++; const xr = parseFloat(offer.xpwpct) || 0; rw = amt * xr; rs = xr + " XP/₹"; st = "earned"; } return { idx: i + 1, date: tx.date || "—", amount: amt, reward: rw, rateStr: rs, sessStr: ss, status: st, type: "wallet-xp", rewardUnit: "XP", netVal: 0 };
    } else { return { idx: i + 1, date: tx.date || "—", amount: amt, reward: 0, rateStr: "—", sessStr: "—", status: "manual", type: "wallet-other", netVal: 0 }; }
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
const IC={home:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6.5L8 2l6 4.5V13a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z"/><path d="M6 14V9h4v5"/></svg>',layers:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L2 5l6 3 6-3-6-3z"/><path d="M2 11l6 3 6-3"/><path d="M2 8l6 3 6-3"/></svg>',cal:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1.5v3M11 1.5v3M2 7h12"/></svg>',spark:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2"/></svg>',gear:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>',bolt:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2L3 9h4l-1 5 6-7H8l1-5z" stroke-linejoin="round"/></svg>'};
const SvgIcon=({name,size=16})=><span style={{display:"inline-flex",width:size,height:size}} dangerouslySetInnerHTML={{__html:IC[name]||""}}/>;


const css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
:root,.light{--bg:#ffffff;--bg2:#fafafa;--bg3:#f4f4f5;--bg4:#ececef;--border:#e4e4e7;--border2:#d4d4d8;--text:#0a0a0a;--text2:#404040;--text3:#71717a;--accent:#eb212e;--accent2:#c91a25;--accent-bg:rgba(235,33,46,.06);--accent-soft:rgba(235,33,46,.08);--green:#10b981;--green-bg:#ecfdf5;--red:#ef4444;--red-bg:#fef2f2;--amber:#f59e0b;--amber-bg:#fffbeb;--blue:#3b82f6;--blue-bg:#eff6ff;--purple:#8b5cf6;--purple-bg:#f5f3ff;--teal:#14b8a6;--teal-bg:#f0fdfa;--sage:#10b981;--sage-bg:#ecfdf5;--r:8px;--r2:12px;--r3:16px;--sh-sm:0 1px 2px rgba(0,0,0,.04);--sh:0 1px 2px rgba(0,0,0,.04),0 8px 24px -10px rgba(0,0,0,.10);--sh-lg:0 2px 4px rgba(0,0,0,.04),0 24px 48px -16px rgba(0,0,0,.18);--font-display:'Instrument Serif','Times New Roman',serif;--font-ui:'Inter',-apple-system,sans-serif;--font-mono:'JetBrains Mono',monospace}
.dark{--bg:#0a0a0a;--bg2:#141414;--bg3:#1e1e1e;--bg4:#282828;--border:#27272a;--border2:#3f3f46;--text:#fafafa;--text2:#a1a1aa;--text3:#71717a;--accent:#eb212e;--accent2:#ff3a48;--accent-bg:rgba(235,33,46,.12);--accent-soft:rgba(235,33,46,.15);--green:#34d399;--green-bg:rgba(52,211,153,.1);--red:#f87171;--red-bg:rgba(248,113,113,.1);--amber:#fbbf24;--amber-bg:rgba(251,191,36,.1);--blue:#60a5fa;--blue-bg:rgba(96,165,250,.1);--purple:#a78bfa;--purple-bg:rgba(167,139,250,.1);--teal:#2dd4bf;--teal-bg:rgba(45,212,191,.1);--sage:#34d399;--sage-bg:rgba(52,211,153,.1);--sh-sm:0 1px 2px rgba(0,0,0,.3);--sh:0 2px 8px rgba(0,0,0,.4);--sh-lg:0 8px 30px rgba(0,0,0,.5)}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;font-feature-settings:'cv11','ss01';letter-spacing:-0.005em}button{font:inherit;color:inherit;cursor:pointer;border:none;background:none}input,textarea,select{font:inherit;color:inherit}
.app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
/* Sidebar */
.sidebar{background:var(--bg);border-right:1px solid var(--border);padding:16px 12px;display:flex;flex-direction:column;gap:1px;position:sticky;top:0;height:100vh;overflow-y:auto}
.sb-brand{display:flex;align-items:center;gap:10px;padding:6px 8px 18px;font-size:15px;font-weight:600;letter-spacing:-0.02em;cursor:pointer}.sb-brand-mark{width:26px;height:26px;border-radius:8px;background:var(--accent);display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex-shrink:0}
.sb-org{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;cursor:pointer}.sb-org:hover{background:var(--bg2)}.sb-org-avatar{width:24px;height:24px;border-radius:6px;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:10px;font-weight:700;flex-shrink:0}.sb-org .name{flex:1;font-size:13px;font-weight:500}.sb-org .caret{color:var(--text3);font-size:12px}
.sb-section{padding:14px 10px 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);font-weight:500}
.sb-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:var(--r);color:var(--text3);font-size:13px;cursor:pointer;width:100%;text-align:left;transition:all .1s;font-weight:500;border:1px solid transparent}.sb-item:hover{background:var(--bg2);color:var(--text)}.sb-item.active{background:var(--bg2);color:var(--text);border-color:var(--border)}.sb-item .icon{width:16px;height:16px;display:flex;align-items:center;flex-shrink:0}.sb-item .badge{margin-left:auto;font-size:11px;background:var(--accent-bg);color:var(--accent);padding:1px 7px;border-radius:10px;font-weight:600}
.sb-foot{margin-top:auto;padding:12px 8px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}.sb-foot-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#f97316);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:600;flex-shrink:0}.sb-foot .who{font-size:12.5px;font-weight:500}.sb-foot .role{font-size:11px;color:var(--text3)}
/* Topbar */
.topbar{display:flex;align-items:center;gap:14px;padding:12px 24px;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:10}
.breadcrumb{font-size:13px;color:var(--text3);display:flex;align-items:center;gap:6px}.breadcrumb .sep{opacity:.3}.breadcrumb .current{color:var(--text);font-weight:500}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.searchbar{display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:6px 12px;font-size:12px;color:var(--text3);cursor:pointer;min-width:200px}.searchbar:hover{border-color:var(--border2)}
/* Main */
.main-area{display:flex;flex-direction:column;min-width:0;overflow-y:auto;height:100vh}
.content{padding:0 24px 60px;max-width:1200px;width:100%}
.page-hdr{padding:24px 0 18px}.page-hdr h1{font-size:24px;font-weight:600;letter-spacing:-0.02em}.page-hdr-sub{font-size:13px;color:var(--text3);cursor:pointer;display:flex;align-items:center;gap:4px;margin-bottom:4px}.page-hdr-sub:hover{color:var(--text)}
/* Cards */
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:20px;margin-bottom:14px}.card-title{font-size:16px;font-weight:600;letter-spacing:-0.01em;margin-bottom:14px}
/* Panels */
.panel{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2)}.panel-head{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}.panel-head h3{font-size:14px;font-weight:600}.panel-body{padding:8px}
/* Segments */
.seg-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px}.seg-card{border:1px solid var(--border);border-radius:var(--r2);padding:14px;cursor:pointer;transition:all .12s;background:var(--bg)}.seg-card:hover{border-color:var(--border2);box-shadow:var(--sh-sm)}.seg-card.selected{border-color:var(--accent);background:var(--accent-bg);box-shadow:0 0 0 2px var(--accent-soft)}.seg-card-icon{font-size:20px;margin-bottom:6px}.seg-card-name{font-weight:600;font-size:13px;margin-bottom:2px}.seg-card-desc{font-size:11px;color:var(--text3);margin-bottom:6px}.seg-card-insight{font-size:11px;color:var(--text2);line-height:1.5;padding-top:6px;border-top:1px solid var(--border);font-style:italic}
.csv-zone{margin-top:14px;padding:16px;border:1px dashed var(--border2);border-radius:var(--r2);background:var(--bg2);transition:all .12s;cursor:pointer;text-align:center}.csv-zone:hover{border-color:var(--teal);background:var(--teal-bg)}.csv-zone.has{border-color:var(--teal);border-style:solid;background:var(--teal-bg)}.csv-logic{margin-top:10px;display:flex;gap:8px;align-items:center;font-size:12px;color:var(--text3)}
.field{display:flex;flex-direction:column;gap:4px}.field-label{font-size:12px;color:var(--text2);font-weight:500}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
input[type=text],input[type=number],input[type=date],input[type=password],select,textarea{background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:8px 12px;color:var(--text);font-size:13px;width:100%;transition:border-color .12s}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}input::placeholder{color:var(--text3)}select{cursor:pointer}
.preload-box{margin-top:14px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2)}.toggle-row{display:flex;align-items:center;justify-content:space-between}.toggle-label{font-size:13px;font-weight:600}.toggle-sub{font-size:11px;color:var(--text3)}.toggle-track{width:40px;height:22px;border-radius:11px;background:var(--bg4);cursor:pointer;position:relative;transition:.2s;flex-shrink:0}.toggle-track.on{background:var(--green)}.toggle-thumb{position:absolute;width:16px;height:16px;border-radius:50%;top:3px;left:3px;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.15)}.toggle-track.on .toggle-thumb{transform:translateX(18px)}
.dist-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.dist-item{border:1px solid var(--border);border-radius:var(--r2);padding:12px;cursor:pointer;transition:all .12s;background:var(--bg)}.dist-item:hover{border-color:var(--border2)}.dist-item.selected{border-color:var(--green);background:var(--green-bg)}.dist-item-title{font-size:12px;font-weight:600;margin-bottom:2px}.dist-item-desc{font-size:11px;color:var(--text3)}
.act-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.act-item{border:1px solid var(--border);border-radius:var(--r2);padding:16px;cursor:pointer;transition:all .12s;background:var(--bg)}.act-item:hover{box-shadow:var(--sh-sm)}.act-item.selected{border-color:var(--accent);background:var(--accent-bg)}.act-item-icon{font-size:22px;margin-bottom:6px}.act-item-title{font-size:13px;font-weight:600;margin-bottom:2px}.act-item-vars{font-size:11px;color:var(--text3)}
.rwd-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.rwd-item{border:1px solid var(--border);border-radius:var(--r2);padding:14px;cursor:pointer;transition:all .12s;background:var(--bg)}.rwd-item:hover{box-shadow:var(--sh-sm)}.rwd-item.selected{border-color:var(--accent);background:var(--accent-bg)}.rwd-item.disabled{opacity:.25;pointer-events:none}.rwd-item-name{font-size:13px;font-weight:600;margin-bottom:2px}.rwd-item-formula{font-size:11px;color:var(--text3)}
.rwd-disabled{padding:12px 14px;background:var(--green-bg);border-radius:var(--r);font-size:12px;color:var(--green);margin-bottom:16px;line-height:1.6}
.rwd-config{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:16px 20px;margin-top:6px}.rwd-config-title{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:14px}
.tier-hdr,.tier-row{display:grid;grid-template-columns:80px 1fr 28px;gap:8px;margin-bottom:6px;align-items:center}.tier-hdr span{font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.wt-box{margin-top:16px;padding:16px 18px;border:1px solid rgba(235,33,46,.1);border-radius:var(--r2);background:var(--accent-bg)}.wt-title{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
.wt-modes{display:flex;gap:6px;margin-bottom:12px}.wt-mode{padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg);color:var(--text3);font-size:12px;cursor:pointer;font-weight:500;transition:all .12s}.wt-mode:hover{border-color:var(--text3)}.wt-mode.active{border-color:var(--accent);color:var(--accent);background:var(--accent-bg)}
.slab-hdr,.slab-row{display:grid;grid-template-columns:80px 80px 70px 28px;gap:6px;margin-bottom:5px;align-items:center}.slab-hdr span{font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.bc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.bc-note{font-size:12px;color:var(--text2);margin-top:12px;padding:10px 14px;background:var(--bg2);border-left:3px solid var(--accent);border-radius:0 var(--r) var(--r) 0;line-height:1.6}
.sum-card{border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;margin-bottom:16px}.sum-hdr{padding:14px 20px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}.sum-name{font-size:18px;font-weight:600;letter-spacing:-0.01em}
.badge{font-size:10px;padding:3px 10px;border-radius:20px;font-weight:600}.bg-cashback{background:var(--green-bg);color:var(--green)}.bg-discount{background:var(--amber-bg);color:var(--amber)}.bg-xp{background:var(--purple-bg);color:var(--purple)}.bg-coupon{background:var(--blue-bg);color:var(--blue)}.bg-preload{background:var(--teal-bg);color:var(--teal)}
.sum-body{padding:20px}.sum-plain{font-size:13px;line-height:1.8;color:var(--text2);margin-bottom:20px;padding:14px 16px;background:var(--bg2);border-radius:var(--r);border-left:3px solid var(--accent)}.sum-plain strong{color:var(--accent);font-weight:600}
.vtable{width:100%;border-collapse:collapse}.vtable th{font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}.vtable td{padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px}.vtable tr:last-child td{border-bottom:none}.vtable tr:hover td{background:var(--bg2)}
.txn-hdr,.txn-row{display:grid;grid-template-columns:130px 90px 80px 28px;gap:8px;margin-bottom:6px;align-items:center}.txn-hdr span{font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.sample-btn{width:100%;padding:10px;margin-bottom:14px;border:1px dashed var(--accent);border-radius:var(--r);background:var(--accent-bg);color:var(--accent);font-size:12px;font-weight:500;cursor:pointer;transition:all .12s}.sample-btn:hover{background:var(--accent-soft)}
.dash-section{margin-bottom:24px}.dash-title{font-size:16px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:10px;letter-spacing:-0.01em}.dash-icon{width:28px;height:28px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}.di-g{background:var(--green-bg);color:var(--green)}.di-a{background:var(--amber-bg);color:var(--amber)}.di-r{background:var(--accent-bg);color:var(--accent)}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.mc{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:16px}.mc-label{font-size:11px;font-weight:500;color:var(--text3);letter-spacing:.03em;text-transform:uppercase;margin-bottom:6px}.mc-val{font-size:24px;font-weight:600;letter-spacing:-0.02em}.mc-sub{font-size:11px;color:var(--text3);margin-top:4px}
.result-tbl{width:100%;border-collapse:collapse;font-size:12px}.result-tbl th{font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}.result-tbl td{padding:8px 10px;border-bottom:1px solid var(--border);color:var(--text2)}.result-tbl tr:last-child td{border-bottom:none}.result-tbl tr:hover td{background:var(--bg2)}.result-tbl td.rval{color:var(--accent);font-family:var(--font-mono);font-weight:600}
.sbadge{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:500;display:inline-block}.bg-green{background:var(--green-bg);color:var(--green)}.bg-amber{background:var(--amber-bg);color:var(--amber)}.bg-red{background:var(--red-bg);color:var(--red)}.bg-blue{background:var(--blue-bg);color:var(--blue)}.bg-muted{background:var(--bg3);color:var(--text3)}
.risk-item{display:flex;align-items:flex-start;gap:8px;padding:12px 14px;border-radius:var(--r);margin-bottom:6px;font-size:12px;line-height:1.5}.risk-item.risk{background:var(--red-bg);color:var(--red)}.risk-item.warn{background:var(--amber-bg);color:var(--amber)}.risk-item.ok{background:var(--green-bg);color:var(--green)}
.btn-row{display:flex;gap:8px;margin-top:20px}.btn{padding:8px 16px;border-radius:var(--r);border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:all .1s;display:inline-flex;align-items:center;gap:6px}.btn:hover{background:var(--bg2)}.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent2)}.btn-dashed{width:100%;padding:8px;border:1px dashed var(--border2);border-radius:var(--r);background:none;font-size:11px;color:var(--text3);cursor:pointer;font-weight:500;margin-top:6px;transition:all .12s}.btn-dashed:hover{border-color:var(--accent);color:var(--accent)}.del-btn{background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;transition:color .12s}.del-btn:hover{color:var(--red)}.scroll-x{overflow-x:auto}
.steps{display:flex;gap:0;margin-bottom:18px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:3px;overflow-x:auto}.step{flex:1;padding:8px 6px;font-size:12px;cursor:pointer;color:var(--text3);text-align:center;border-radius:var(--r);transition:all .12s;white-space:nowrap;font-weight:500}.step:hover{color:var(--text2)}.step.active{background:var(--bg);color:var(--text);box-shadow:var(--sh-sm)}.step.done{color:var(--green)}.step.incomplete{color:var(--red)}
.offers-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.offer-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:16px;cursor:pointer;transition:all .12s;position:relative}.offer-card:hover{box-shadow:var(--sh);border-color:var(--border2)}.offer-card.active{border-color:var(--accent)}.offer-card-actions{position:absolute;top:10px;right:10px;display:flex;gap:3px;opacity:0;transition:opacity .12s}.offer-card:hover .offer-card-actions{opacity:1}.offer-card-actions button{width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--bg);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text3)}.offer-card-actions button:hover{background:var(--bg2);color:var(--text)}.offer-card-actions button.del:hover{color:var(--red)}
.offer-card-type{display:flex;align-items:center;gap:6px;margin-bottom:8px}.offer-card-dot{width:7px;height:7px;border-radius:50%}.offer-card-label{font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.03em}.offer-card-name{font-size:15px;font-weight:600;margin-bottom:3px;letter-spacing:-0.01em}.offer-card-segs{font-size:11px;color:var(--text3)}
.add-card{border:1px dashed var(--border2);border-radius:var(--r2);padding:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:13px;font-weight:500;min-height:100px;transition:all .12s}.add-card:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-bg)}
.campaign-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:20px}.campaign-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:20px;cursor:pointer;transition:all .12s;position:relative}.campaign-card:hover{box-shadow:var(--sh)}.campaign-card-name{font-size:18px;font-weight:600;margin-bottom:6px;letter-spacing:-0.01em}.campaign-card-meta{font-size:12px;color:var(--text3);display:flex;gap:12px}
.save-indicator{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:4px}.save-indicator.saving{color:var(--accent)}.save-indicator.saved{color:var(--green)}
.theme-toggle{width:32px;height:18px;border-radius:9px;background:var(--bg3);cursor:pointer;position:relative;transition:.2s;border:1px solid var(--border);flex-shrink:0}.theme-toggle .thumb{position:absolute;width:12px;height:12px;border-radius:50%;top:2px;left:2px;background:var(--text3);transition:.2s}.dark .theme-toggle .thumb{transform:translateX(14px);background:var(--accent)}
.user-badge{display:flex;align-items:center;gap:6px;padding:4px;cursor:pointer;border-radius:var(--r);transition:background .12s}.user-badge:hover{background:var(--bg2)}.user-badge-avatar{width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600}.user-badge-name{font-size:12px;font-weight:500;color:var(--text2)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px)}.modal{background:var(--bg);border:1px solid var(--border);border-radius:var(--r3);padding:28px;max-width:460px;width:92%;box-shadow:var(--sh-lg)}.modal-title{font-size:18px;font-weight:600;margin-bottom:6px}.modal-msg{font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.5}.modal-actions{display:flex;gap:8px;justify-content:flex-end}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg2);padding:20px}.login-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r3);padding:40px;max-width:400px;width:100%;box-shadow:var(--sh-lg)}.login-logo{width:44px;height:44px;border-radius:12px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;margin:0 auto 20px}.login-title{font-size:22px;font-weight:600;text-align:center;margin-bottom:4px;letter-spacing:-0.02em}.login-sub{font-size:13px;color:var(--text3);text-align:center;margin-bottom:28px}.login-field{margin-bottom:16px}.login-field label{display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}.login-err{padding:10px 14px;background:var(--red-bg);border-radius:var(--r);font-size:12px;color:var(--red);margin-bottom:16px;text-align:center}.login-btn{width:100%;padding:12px;background:var(--accent);border:none;border-radius:var(--r);color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s;margin-top:6px}.login-btn:hover{background:var(--accent2)}.login-btn:disabled{opacity:.5;cursor:not-allowed}
.ai-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:30;opacity:0;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(3px)}.ai-overlay.open{opacity:1;pointer-events:auto}
.ai-drawer{position:fixed;top:0;right:-360px;width:360px;height:100vh;background:var(--bg);border-left:1px solid var(--border);z-index:31;display:flex;flex-direction:column;transition:right .2s ease;box-shadow:var(--sh-lg)}.ai-drawer.open{right:0}
.ai-hdr{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}.ai-hdr-t{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;color:var(--accent)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px rgba(235,33,46,.4);animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.ai-x{background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:4px 6px;border-radius:var(--r);transition:all .1s}.ai-x:hover{background:var(--bg2);color:var(--text)}
.ai-body{flex:1;overflow-y:auto;padding:16px}.ai-msg{margin-bottom:12px;padding:12px 14px;border-radius:var(--r2);font-size:12px;line-height:1.6;color:var(--text2)}.ai-msg.bot{background:var(--bg2);border:1px solid var(--border)}.ai-msg.user{background:var(--text);color:var(--bg);border-radius:var(--r2) var(--r2) 4px var(--r2)}.ai-msg strong{color:var(--accent);font-weight:600}.ai-msg code{font-family:var(--font-mono);font-size:10px;background:var(--bg3);padding:1px 4px;border-radius:3px}
.ai-dots{display:flex;align-items:center;gap:6px;padding:12px;color:var(--accent);font-size:11px}.ai-dots i{width:5px;height:5px;border-radius:50%;background:var(--accent);display:inline-block;animation:blink 1.2s infinite;opacity:.3}.ai-dots i:nth-child(2){animation-delay:.2s}.ai-dots i:nth-child(3){animation-delay:.4s}@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}
.ai-ftr{padding:14px;border-top:1px solid var(--border)}.ai-ftr-row{display:flex;gap:6px}.ai-inp{flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:8px 10px;color:var(--text);font-size:12px}.ai-inp:focus{outline:none;border-color:var(--accent)}.ai-go{background:var(--accent);border:none;border-radius:var(--r);color:#fff;font-size:12px;padding:8px 14px;cursor:pointer;font-weight:500}.ai-go:hover{background:var(--accent2)}
.ai-qa{display:flex;gap:4px;margin-top:8px;flex-wrap:wrap}.ai-qa button{padding:4px 10px;font-size:10px;border:1px solid var(--border);border-radius:20px;background:var(--bg);color:var(--text3);cursor:pointer;font-weight:500;transition:all .1s}.ai-qa button:hover{border-color:var(--accent);color:var(--accent)}
/* What-If Simulator */
.wif-grid{display:grid;grid-template-columns:320px 1fr;gap:20px}.wif-knobs{display:flex;flex-direction:column;gap:12px}.wif-knob{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:14px 16px}.wif-knob-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}.wif-knob-label{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);font-weight:600}.wif-knob-val{font-family:var(--font-display);font-size:22px;letter-spacing:-0.01em}.wif-knob-val .unit{font-size:12px;color:var(--text3);margin-left:2px}.wif-track{height:6px;background:var(--bg3);border-radius:3px;position:relative;cursor:pointer;margin:8px 0}.wif-track-fill{position:absolute;top:0;left:0;bottom:0;background:var(--accent);border-radius:3px}.wif-track-thumb{position:absolute;top:50%;width:16px;height:16px;border-radius:50%;background:var(--bg);border:2px solid var(--accent);transform:translate(-50%,-50%);box-shadow:var(--sh-sm)}.wif-knob-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--text3)}.wif-result{display:flex;flex-direction:column;gap:12px}.wif-headline{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);padding:22px 24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}.wif-headline-block{padding-right:18px;border-right:1px solid var(--border)}.wif-headline-block:last-child{border-right:none;padding-right:0}.wif-headline-label{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);font-weight:600;margin-bottom:6px}.wif-headline-val{font-family:var(--font-display);font-size:28px;letter-spacing:-0.015em;line-height:1}.wif-headline-delta{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text3)}.wif-chip{font-family:var(--font-mono);font-size:10px;padding:2px 6px;border-radius:10px;font-weight:600}.wif-chip.up{background:var(--green-bg);color:var(--green)}.wif-chip.down{background:var(--red-bg);color:var(--red)}.wif-narrative{background:var(--accent-bg);border-radius:var(--r2);padding:14px 16px;font-size:12px;color:var(--accent2);line-height:1.6}.wif-narrative b{font-weight:600}
/* Decision Board */
.db-summary{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);padding:20px 22px;margin-bottom:18px;display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:20px;align-items:center}.db-status{border-right:1px solid var(--border);padding-right:20px}.db-status-orb{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:18px;margin-bottom:6px}.db-status-orb.healthy{background:var(--green-bg);color:var(--green)}.db-status-orb.caution{background:var(--amber-bg);color:var(--amber)}.db-status-orb.risk{background:var(--red-bg);color:var(--red)}.db-status-text{font-size:16px;font-weight:600;letter-spacing:-0.01em;margin-bottom:3px}.db-status-sub{font-size:11px;color:var(--text3)}.db-metric{padding-right:16px;border-right:1px solid var(--border)}.db-metric:last-child{border-right:none}.db-metric-label{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);font-weight:600;margin-bottom:4px}.db-metric-val{font-size:22px;font-weight:600;letter-spacing:-0.01em}.db-metric-delta{font-size:11px;margin-top:4px;font-weight:500}.db-metric-delta.up{color:var(--green)}.db-metric-delta.down{color:var(--red)}
/* Mini chart */
.mini-chart{display:flex;align-items:flex-end;gap:3px;height:40px;margin-top:10px}.mini-chart-bar{flex:1;background:var(--accent-bg);border-radius:3px 3px 0 0;min-height:2px;transition:height .3s}.mini-chart-bar.active{background:var(--accent)}
/* Schedule Gantt */
.gantt{border:1px solid var(--border);border-radius:var(--r2);overflow:hidden}.gantt-header{position:relative;height:36px;border-bottom:1px solid var(--border);background:var(--bg2);font-size:10px;color:var(--text3);font-weight:500}.gantt-group{padding:8px 16px;font-size:11px;font-weight:600;color:var(--text3);background:var(--bg2);border-bottom:1px solid var(--border);letter-spacing:.03em;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between}.gantt-group-meta{font-weight:400;text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums}.gantt-row{position:relative;height:44px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}.gantt-row:hover{background:var(--bg2)}.gantt-row:last-child{border-bottom:none}.gantt-bar{position:absolute;top:8px;height:28px;border-radius:6px;display:flex;align-items:center;padding-left:8px;gap:5px;font-size:10px;font-weight:600;overflow:hidden;white-space:nowrap}.gantt-bar-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}.gantt-today{position:absolute;top:0;bottom:0;width:2px;background:var(--accent);z-index:2}.gantt-today-label{position:absolute;top:2px;left:-12px;font-size:9px;color:var(--accent);font-weight:600;background:var(--bg2);padding:0 3px}
/* Schedule stats */
.sched-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.sched-stat{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:14px 16px}.sched-stat-label{font-size:10px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px}.sched-stat-val{font-size:22px;font-weight:600;letter-spacing:-0.02em}.sched-stat-sub{font-size:11px;color:var(--text3);margin-top:3px}
@media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{position:fixed;top:0;left:0;right:0;bottom:auto;height:auto;flex-direction:row;gap:4px;padding:8px 10px;overflow-x:auto;border-right:none;border-bottom:1px solid var(--border);z-index:20}.sb-section,.sb-foot,.sb-org,.sb-brand{display:none}.sb-item{white-space:nowrap;font-size:11px;padding:6px 10px}.main-area{padding-top:50px;height:auto}.content{padding:0 16px 60px}.seg-cards,.offers-grid{grid-template-columns:1fr}.grid2,.bc-grid,.act-grid,.rwd-grid,.dist-grid{grid-template-columns:1fr}.metrics,.sched-stats{grid-template-columns:1fr 1fr}.steps{flex-wrap:nowrap}.step{min-width:70px;flex-shrink:0}.ai-drawer{width:100%;right:-100%}.campaign-list{grid-template-columns:1fr}.wif-grid{grid-template-columns:1fr}.wif-headline{grid-template-columns:1fr}.wif-headline-block{border-right:none;border-bottom:1px solid var(--border);padding:0 0 14px}.wif-headline-block:last-child{border-bottom:none}.db-summary{grid-template-columns:1fr}.db-status,.db-metric{border-right:none;border-bottom:1px solid var(--border);padding:0 0 12px}.db-status:last-child,.db-metric:last-child{border-bottom:none}}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:8px;border:2px solid var(--bg)}::-webkit-scrollbar-thumb:hover{background:var(--text3)}
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
  return <div className="login-page"><div className="login-card">
    <div className="login-logo">O</div>
    <div className="login-title">OfferOS</div>
    <div className="login-sub">Campaign Intelligence for ChargeZone</div>
    {err && <div className="login-err">{err}</div>}
    <form onSubmit={submit}>
      <div className="login-field"><label>Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoFocus /></div>
      <div className="login-field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" /></div>
      <button type="submit" className="login-btn" disabled={loading || !username || !password}>{loading ? "Signing in..." : "Sign in"}</button>
    </form>
  </div></div>;
}

/* ── Home Dashboard ── */
function HomeDashboard({ campaigns, allOffers }) {
  const totalCampaigns = campaigns.length;
  const rewardTypes = {}; const segCoverage = {}; let totalProjectedCost = 0; let simmedOffers = 0; let unsimmed = 0; let hasAll = false;
  allOffers.forEach(o => { const tp = o.wpre ? "Pre-load" : (o.reward || "Cashback"); rewardTypes[tp] = (rewardTypes[tp] || 0) + 1; (o.segments || []).forEach(s => { if(s==="All")hasAll=true; segCoverage[s] = (segCoverage[s] || 0) + 1; }); if (o.simResult) { totalProjectedCost += o.simResult.totalReward || 0; simmedOffers++; } else { unsimmed++; } });
  const uncovered = hasAll ? [] : Object.keys(SEGMENTS).filter(s => s !== "All" && !segCoverage[s]);
  const coveredCount = hasAll ? Object.keys(SEGMENTS).length - 1 : Object.keys(segCoverage).filter(s => s !== "All").length;
  const totalOffers = allOffers.length;
  const conflictCount = Object.keys(detectConflicts(allOffers)).length / 2;
  return <div style={{ marginBottom: 28 }}>
    <div style={{fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)",marginBottom:12}}>Platform Overview</div>
    <div className="metrics" style={{ marginBottom: 16 }}>
      <div className="mc"><div className="mc-label">Active campaigns</div><div className="mc-val">{totalCampaigns}</div></div>
      <div className="mc"><div className="mc-label">Total offers</div><div className="mc-val">{totalOffers}</div><div className="mc-sub">{simmedOffers} simulated, {unsimmed} pending</div></div>
      <div className="mc"><div className="mc-label">Projected reward cost</div><div className="mc-val" style={{color:totalProjectedCost>0?"var(--red)":"var(--text3)"}}>₹{totalProjectedCost.toFixed(0)}</div><div className="mc-sub">across {simmedOffers} simulated offers</div></div>
      <div className="mc"><div className="mc-label">Segments covered</div><div className="mc-val">{coveredCount}/{Object.keys(SEGMENTS).length - 1}</div><div className="mc-sub">{uncovered.length > 0 ? "Missing: " + uncovered.join(", ") : "All covered"}</div></div>
    </div>
    {(conflictCount > 0 || unsimmed > 0 || uncovered.length > 0) && <div style={{marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)",marginBottom:8}}>Needs attention</div>
      {conflictCount > 0 && <div className="risk-item risk" style={{marginBottom:4}}>{Math.round(conflictCount)} offer{conflictCount>1?"s":""} with segment + reward overlap</div>}
      {unsimmed > 0 && <div className="risk-item warn" style={{marginBottom:4}}>{unsimmed} offer{unsimmed>1?"s":""} not yet tested with simulation</div>}
      {uncovered.length > 0 && <div className="risk-item warn" style={{marginBottom:4}}>Segments without any offer: {uncovered.join(", ")}</div>}
    </div>}
    {Object.keys(rewardTypes).length > 0 && <div style={{marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)",marginBottom:8}}>Reward distribution</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{Object.entries(rewardTypes).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--r)"}}><div style={{width:8,height:8,borderRadius:"50%",background:DOT_COLORS[k]||"var(--text3)"}}/><span style={{fontSize:12}}>{k}: {v}</span></div>)}</div>
    </div>}
  </div>;
}

/* ── Campaigns List ── */
/* ── Business Impact Projector ── */
function BusinessProjector({ offers, marginPct, projInputs, onSave }) {
  const defaults = { segmentSizes: { New: "5000", Dormant: "2000", Engaged: "8000", Existing: "15000" }, redemptionRate: "15", avgMonthlyEvents: "3", avgKwh: "12", avgTopup: "300", ratePerKwh: "22", cpa: "5", campaignPeriodDays: "30" };
  const [inp, setInp] = useState({ ...defaults, ...projInputs });
  const [open, setOpen] = useState(!!projInputs?.redemptionRate);
  const save = (v) => { const n = { ...inp, ...v }; setInp(n); onSave(n); };
  const saveSeg = (seg, val) => { const s = { ...inp.segmentSizes, [seg]: val }; save({ segmentSizes: s }); };

  const rr = (parseFloat(inp.redemptionRate) || 0) / 100;
  const avgEvents = parseFloat(inp.avgMonthlyEvents) || 3;
  const avgKwh = parseFloat(inp.avgKwh) || 12;
  const avgTopup = parseFloat(inp.avgTopup) || 300;
  const rpk = parseFloat(inp.ratePerKwh) || 22;
  const cpa = parseFloat(inp.cpa) || 0;
  const periodDays = parseFloat(inp.campaignPeriodDays) || 30;
  const periodMonths = periodDays / 30;

  // Per-offer feasibility calculation
  const offerRows = offers.map(o => {
    const isW = o.activity === "Wallet top-up", isP = !!o.wpre;
    // Calculate target users for this offer based on segments
    let targetUsers = 0;
    (o.segments || []).forEach(s => {
      if (s === "All") { targetUsers = Object.values(inp.segmentSizes).reduce((sum, v) => sum + (parseFloat(v) || 0), 0); }
      else { targetUsers += parseFloat(inp.segmentSizes[s]) || 0; }
    });
    const redeemed = Math.round(targetUsers * rr);
    const sessionsPerUser = Math.round(avgEvents * periodMonths);

    // Reward cost per user from simulation
    let rewardPerUser = 0;
    if (o.simResult && o.simResult.qualTxns > 0) {
      const simRewardPerSession = o.simResult.totalReward / o.simResult.qualTxns;
      rewardPerUser = simRewardPerSession * Math.min(sessionsPerUser, parseInt(o.sx) || sessionsPerUser);
    }
    if (isP) rewardPerUser = parseFloat(o.w) || 0;

    const totalRewardCost = redeemed * rewardPerUser;
    const revenuePerUser = isW ? 0 : sessionsPerUser * avgKwh * rpk;
    const totalRevenue = redeemed * revenuePerUser;
    const marginEarned = totalRevenue * (marginPct / 100);
    const acqCost = targetUsers * cpa;
    const netImpact = marginEarned - totalRewardCost - acqCost;

    return { offer: o, targetUsers, redeemed, rewardPerUser, totalRewardCost, totalRevenue, marginEarned, acqCost, netImpact, isW, isP, sessionsPerUser };
  });

  // Totals
  const totTarget = offerRows.reduce((s, r) => s + r.targetUsers, 0);
  const totRedeemed = offerRows.reduce((s, r) => s + r.redeemed, 0);
  const totRewardCost = offerRows.reduce((s, r) => s + r.totalRewardCost, 0);
  const totRevenue = offerRows.reduce((s, r) => s + r.totalRevenue, 0);
  const totMargin = offerRows.reduce((s, r) => s + r.marginEarned, 0);
  const totAcqCost = offerRows.reduce((s, r) => s + r.acqCost, 0);
  const totNet = totMargin - totRewardCost - totAcqCost;
  const hasData = offers.length > 0;

  return <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "12px 0" }} onClick={() => setOpen(!open)}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent)" }}>Business Impact Projection</div>
      <span style={{ color: "var(--text3)", fontSize: 14 }}>{open ? "▾" : "▸"}</span>
    </div>
    {open && <div className="card">
      <div className="card-title" style={{ fontSize: 18 }}>Campaign Feasibility</div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>Enter your business assumptions — the tool will project combined impact of all {offers.length} offer{offers.length !== 1 ? "s" : ""} running during this period.</div>

      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>Segment sizes (total users in each)</div>
      <div className="grid2" style={{ marginBottom: 18 }}>
        {Object.entries(SEGMENTS).filter(([k]) => k !== "All").map(([k, v]) =>
          <div key={k} className="field"><div className="field-label">{v.label}</div><input type="number" value={inp.segmentSizes?.[k] || ""} placeholder="0" onChange={e => saveSeg(k, e.target.value)} /></div>
        )}
      </div>

      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>Business parameters</div>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field"><div className="field-label">Campaign period (days)</div><input type="number" value={inp.campaignPeriodDays} placeholder="30" onChange={e => save({ campaignPeriodDays: e.target.value })} /></div>
        <div className="field"><div className="field-label">Expected redemption rate (%)</div><input type="number" value={inp.redemptionRate} placeholder="15" onChange={e => save({ redemptionRate: e.target.value })} /></div>
      </div>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field"><div className="field-label">Avg charging events per user/month</div><input type="number" value={inp.avgMonthlyEvents} placeholder="3" onChange={e => save({ avgMonthlyEvents: e.target.value })} /></div>
        <div className="field"><div className="field-label">Avg kWh per session</div><input type="number" value={inp.avgKwh} placeholder="12" onChange={e => save({ avgKwh: e.target.value })} /></div>
      </div>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field"><div className="field-label">Rate per kWh (₹)</div><input type="number" value={inp.ratePerKwh} placeholder="22" onChange={e => save({ ratePerKwh: e.target.value })} /></div>
        <div className="field"><div className="field-label">Cost per acquisition (₹/user)</div><input type="number" value={inp.cpa} placeholder="5" onChange={e => save({ cpa: e.target.value })} /></div>
      </div>
      <div className="field" style={{ marginBottom: 18 }}>
        <div className="field-label">Avg wallet top-up amount (₹)</div>
        <input type="number" value={inp.avgTopup} placeholder="300" onChange={e => save({ avgTopup: e.target.value })} style={{ maxWidth: 200 }} />
      </div>

      {hasData && <>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", margin: "24px 0 12px" }}>Combined campaign impact ({periodDays} days)</div>
        <div className="metrics" style={{ marginBottom: 18 }}>
          <div className="mc"><div className="mc-label">Total target users</div><div className="mc-val">{totTarget.toLocaleString()}</div><div className="mc-sub">across all offers (may overlap)</div></div>
          <div className="mc"><div className="mc-label">Expected redemptions</div><div className="mc-val">{totRedeemed.toLocaleString()}</div><div className="mc-sub">{(rr * 100).toFixed(0)}% redemption rate</div></div>
          <div className="mc"><div className="mc-label">Total reward liability</div><div className="mc-val" style={{ color: "var(--red)" }}>₹{totRewardCost.toLocaleString()}</div><div className="mc-sub">combined cost of all offers</div></div>
          <div className="mc"><div className="mc-label">Net P&L</div><div className="mc-val" style={{ color: totNet >= 0 ? "var(--green)" : "var(--red)" }}>{totNet >= 0 ? "+" : ""}₹{totNet.toLocaleString()}</div><div className="mc-sub">margin - rewards - acquisition</div></div>
        </div>

        {/* Per-offer breakdown */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>Per-offer breakdown</div>
        <div className="scroll-x"><table className="result-tbl" style={{ minWidth: 700 }}>
          <thead><tr><th>Offer</th><th>Segment</th><th>Target users</th><th>Redeemed</th><th>Reward/user</th><th>Total reward</th><th>Revenue</th><th>Margin</th><th>Net impact</th></tr></thead>
          <tbody>{offerRows.map((r, i) => <tr key={i}>
            <td style={{ fontWeight: 600 }}>{r.offer.name}</td>
            <td>{(r.offer.segments || []).join(", ") || "—"}</td>
            <td>{r.targetUsers.toLocaleString()}</td>
            <td>{r.redeemed.toLocaleString()}</td>
            <td style={{ fontFamily: "var(--font-mono)" }}>₹{r.rewardPerUser.toFixed(0)}{r.isP ? " (pre-load)" : ""}</td>
            <td style={{ color: "var(--red)" }}>₹{r.totalRewardCost.toLocaleString()}</td>
            <td>{r.isW ? "Lagging" : "₹" + r.totalRevenue.toLocaleString()}</td>
            <td>{r.isW ? "—" : "₹" + r.marginEarned.toLocaleString()}</td>
            <td style={{ color: r.netImpact >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{r.netImpact >= 0 ? "+" : ""}₹{r.netImpact.toLocaleString()}</td>
          </tr>)}</tbody>
          <tfoot><tr style={{ fontWeight: 600, borderTop: "2px solid var(--border2)" }}>
            <td>Total</td><td></td><td>{totTarget.toLocaleString()}</td><td>{totRedeemed.toLocaleString()}</td><td></td>
            <td style={{ color: "var(--red)" }}>₹{totRewardCost.toLocaleString()}</td>
            <td>₹{totRevenue.toLocaleString()}</td>
            <td>₹{totMargin.toLocaleString()}</td>
            <td style={{ color: totNet >= 0 ? "var(--green)" : "var(--red)" }}>{totNet >= 0 ? "+" : ""}₹{totNet.toLocaleString()}</td>
          </tr></tfoot>
        </table></div>

        {/* Warnings */}
        {offerRows.some(r => !r.offer.simResult) && <div className="risk-item warn" style={{ marginTop: 14 }}>Some offers haven't been simulated yet — their reward/user is estimated at ₹0. Run simulations for accurate projections.</div>}
        {totNet < 0 && <div className="risk-item risk" style={{ marginTop: 8 }}>Campaign is projected to lose ₹{Math.abs(totNet).toLocaleString()}. Consider reducing reward rates, narrowing segments, or increasing margin.</div>}
        {offerRows.filter(r => r.targetUsers > 0).length > 1 && <div className="risk-item warn" style={{ marginTop: 8 }}>Target users may overlap across offers if they share segments. Actual reach may be lower than the sum.</div>}
      </>}
    </div>}
  </div>;
}

/* ── Schedule / Gantt Chart View ── */
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
    <div className="page-hdr"><h1>Schedule</h1><div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>All offers across campaigns on a timeline</div></div>
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
  const [delId, setDelId] = useState(null);
  const delName = delId ? (campaigns.find(c => c._id === delId)?.name || "") : "";
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 4 }}>Workspace</div><h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, fontWeight: 400 }}>Campaigns</h1></div>
      <button className="btn btn-primary" onClick={onNew}>+ New Campaign</button>
    </div>
    <div className="campaign-list">
      {campaigns.map(c => <div key={c._id} className="campaign-card" onClick={() => onSelect(c)}>
        <div className="offer-card-actions" style={{opacity:1}} onClick={e => e.stopPropagation()}>
          <button className="del" onClick={() => setDelId(c._id)} title="Archive campaign">×</button>
        </div>
        <div className={"campaign-card-status sbadge " + (c.status === "active" ? "bg-green" : c.status === "completed" ? "bg-blue" : "bg-muted")}>{c.status || "draft"}</div>
        <div className="campaign-card-name">{c.name}</div>
        <div className="campaign-card-meta">
          <span>{c.offerCount || 0} offers</span>
          <span>Margin {c.marginPct || 30}%</span>
          {c.updatedAt && <span>Updated {new Date(c.updatedAt).toLocaleDateString()}</span>}
        </div>
      </div>)}
      {campaigns.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
        <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.3 }}>◎</div>
        <div style={{ fontSize: 14, marginBottom: 4 }}>No campaigns yet</div>
        <div style={{ fontSize: 12 }}>Create your first campaign to get started</div>
      </div>}
    </div>
    {delId && <ConfirmModal title="Archive campaign?" msg={'"' + delName + '" and all its offers will be archived. You can recover it from MongoDB if needed.'} onConfirm={() => { onArchive(delId); setDelId(null); }} onCancel={() => setDelId(null)} />}
  </div>;
}

function APIKeyModal({onClose}){const[key,setKey]=useState(getApiKey()),[saved,setSaved]=useState(false);const save=()=>{setApiKeyVal(key.trim());setSaved(true);setTimeout(onClose,500)};const has=!!getApiKey();return<div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title">AI Configuration</div><div className="modal-msg">Enter your Anthropic API key. Stays in browser memory only — never stored.</div><input type="password" value={key} onChange={e=>{setKey(e.target.value);setSaved(false)}} placeholder="sk-ant-api03-..." style={{marginBottom:8}}/><div style={{fontSize:10,color:"var(--text3)",marginBottom:16,lineHeight:1.5}}>Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style={{color:"var(--accent)"}}>console.anthropic.com</a></div><div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,marginBottom:16}}><span style={{width:7,height:7,borderRadius:"50%",background:has?"var(--green)":"var(--text3)",display:"inline-block"}}/>{has?"Key configured":"No key set"}</div><div className="modal-actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{saved?"✓ Saved":"Save"}</button></div></div></div>}
function ConfirmModal({title,msg,onConfirm,onCancel}){return<div className="modal-overlay" onClick={onCancel}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title">{title}</div><div className="modal-msg">{msg}</div><div className="modal-actions"><button className="btn" onClick={onCancel}>Cancel</button><button className="btn" style={{borderColor:"var(--red)",color:"var(--red)"}} onClick={onConfirm}>Delete</button></div></div></div>}

function AudienceStep({offer,update}){const fr=useRef();const toggle=seg=>{let s=[...offer.segments];if(seg==="All")s=["All"];else{s=s.filter(x=>x!=="All");const i=s.indexOf(seg);if(i>-1)s.splice(i,1);else s.push(seg)}update({segments:s})};const hc=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const ls=ev.target.result.trim().split("\n").filter(Boolean);const ids=ls.slice(1).map(l=>l.split(",")[0].trim()).filter(Boolean);update({rc:ids,rcFileName:f.name,rcCount:ids.length})};r.readAsText(f)};return<div className="card"><div className="card-title">Who's this for?</div><div style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Select one or more customer segments to target with this offer</div><div className="seg-cards">{Object.entries(SEGMENTS).map(([k,v])=><div key={k} className={`seg-card ${offer.segments.includes(k)?"selected":""}`} onClick={()=>toggle(k)}><div className="seg-card-icon">{v.icon}</div><div className="seg-card-name">{v.label}</div><div className="seg-card-desc">{v.desc}</div><div className="seg-card-insight">{v.insight}</div></div>)}</div><div className={`csv-zone ${offer.rc?"has":""}`} onClick={()=>!offer.rc&&fr.current?.click()}><input ref={fr} type="file" accept=".csv" style={{display:"none"}} onChange={hc}/>{offer.rc?<><div style={{fontSize:11,color:"var(--teal)",fontWeight:600}}>✓ {offer.rcFileName} — {offer.rcCount} users loaded</div><button className="btn" style={{marginTop:8,padding:"4px 12px",fontSize:10}} onClick={e=>{e.stopPropagation();update({rc:null,rcFileName:"",rcCount:0})}}>Remove</button></>:<div style={{fontSize:12,color:"var(--text3)"}}>Upload a CSV to narrow targeting to specific user IDs</div>}</div>{offer.rc&&<div className="csv-logic"><label>Combine with segments using:</label><select value={offer.rcLogic} onChange={e=>update({rcLogic:e.target.value})} style={{width:"auto",fontSize:11}}><option value="intersection">Intersection (must match both)</option><option value="union">Union (match either)</option></select></div>}</div>}

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
      let html='<html><head><title>'+offer.name+' — Offer Report</title><style>@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap");body{font-family:Inter,sans-serif;font-size:12px;color:#1e1a16;max-width:800px;margin:0 auto;padding:30px}h1{font-family:Instrument Serif,serif;font-size:26px;font-weight:400;margin:0 0 4px}h2{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid #e5e2dd;color:#eb212e}h3{font-size:12px;margin:18px 0 8px;color:#5c554d}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{padding:8px 10px;border:1px solid #e5e2dd;text-align:left;font-size:11px}th{background:#f5f2ed;font-weight:600;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#8a847c}td:first-child{font-weight:500}.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600}.meta{color:#8a847c;font-size:12px;margin-bottom:24px}.summary-box{background:#f5f2ed;border-left:3px solid #eb212e;padding:16px 18px;margin:14px 0;line-height:1.8;font-size:13px;border-radius:0 10px 10px 0}.mc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:12px 0}.mc-card{border:1px solid #e5e2dd;border-radius:14px;padding:16px}.mc-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8a847c;margin-bottom:6px}.mc-val{font-family:Instrument Serif,serif;font-size:24px;font-weight:400}.risk{padding:10px 14px;margin:6px 0;border-radius:8px;font-size:12px;line-height:1.5}.risk-ok{background:#e8f5e9;color:#1a7a3a}.risk-warn{background:#fff8e1;color:#b07714}.risk-risk{background:#fce4ec;color:#c62828}@media print{body{padding:10px}}</style></head><body>';
      html+='<h1>'+offer.name+'</h1><div class="meta">'+(campaignName||"")+" \u2022 Generated "+new Date().toLocaleDateString()+'</div>';
      html+='<h2>Audience</h2><p><strong>Segments:</strong> '+segs+'</p>';if(offer.rc)html+='<p><strong>Custom cohort:</strong> '+offer.rcCount+' users ('+offer.rcLogic+')</p>';
      html+='<h2>Activity & Triggers</h2><p><strong>Activity:</strong> '+offer.activity+'</p>';if(offer.ctMode==="first")html+='<p><strong>Trigger:</strong> First charging session only</p>';if(offer.wtMode==="first")html+='<p><strong>Trigger:</strong> First wallet top-up only</p>';if(offer.wpre)html+='<p><strong>Pre-load:</strong> \u20b9'+offer.w+' ('+offer.dist+') from '+offer.wa+'</p>';
      html+='<h2>Reward</h2><p><strong>Type:</strong> '+(offer.wpre?"Pre-load":offer.reward)+'</p>';if(offer.reward==="Cashback"&&!offer.wpre){html+='<table><tr><th>'+(isW?"Top-up #":"Session #")+'</th><th>Rate</th></tr>';offer.tiers.forEach(t=>{html+='<tr><td>#'+t.s+'</td><td>'+t.pct+'%</td></tr>'});html+='</table>'}if(offer.reward==="Discount")html+='<p><strong>Rate:</strong> '+offer.dpct+'%</p>';if(offer.reward==="ChargeXP")html+='<p><strong>XP Rate:</strong> '+offer.xpwpct+' XP/\u20b9</p>';if(offer.reward==="Coupon")html+='<p><strong>Code:</strong> '+offer.p+'</p>';
      html+='<h2>Limits</h2><table><tr><th>Parameter</th><th>Value</th></tr>';if(offer.un&&!isW&&!isP)html+='<tr><td>Min kWh</td><td>'+offer.un+'</td></tr>';if(offer.cy&&!isP)html+='<tr><td>Max cashback</td><td>\u20b9'+offer.cy+'</td></tr>';if(offer.dy&&!isP)html+='<tr><td>Max discount</td><td>\u20b9'+offer.dy+'</td></tr>';if(offer.wm)html+='<tr><td>Min balance</td><td>\u20b9'+offer.wm+'</td></tr>';if(offer.sx&&!isP)html+='<tr><td>Max sessions</td><td>'+offer.sx+'</td></tr>';if(offer.wpun)html+='<tr><td>Min kWh/session</td><td>'+offer.wpun+'</td></tr>';if(offer.wpc)html+='<tr><td>Total credit cap</td><td>\u20b9'+offer.wpc+'</td></tr>';if(isP&&offer.wsx)html+='<tr><td>Max spend/session</td><td>'+(offer.wsxType==="pct"?offer.wsx+"%":"\u20b9"+offer.wsx)+'</td></tr>';if(isP&&offer.sx)html+='<tr><td>Max sessions</td><td>'+offer.sx+'</td></tr>';html+='</table>';
      html+='<h2>Duration</h2><p><strong>Validity:</strong> '+offer.t+' days</p>';if(offer.te)html+='<p><strong>Expiry:</strong> '+offer.te+'</p>';if(offer.ce)html+='<p><strong>Cashback expiry:</strong> '+offer.ce+' days</p>';
      html+='<h2>Business Summary</h2><div class="summary-box">'+pl+'</div>';
      html+='<h2>Technical Specification</h2><table><tr><th>Variable</th><th>Parameter</th><th>Value</th></tr>';rows.forEach(r=>{html+='<tr><td>'+r.v+'</td><td>'+r.p+'</td><td>'+r.val+'</td></tr>'});html+='</table>';
      if(sTxns&&sTxns.length>0){html+='<h2>Simulation Data</h2><h3>Test Transactions</h3><table><tr><th>#</th><th>Date</th>';if(isW||isP)html+='<th>Amount (\u20b9)</th>';else html+='<th>kWh</th><th>Rate (\u20b9/kWh)</th>';html+='</tr>';sTxns.forEach((tx,i)=>{html+='<tr><td>'+(i+1)+'</td><td>'+(tx.date||"\u2014")+'</td>';if(isW||isP)html+='<td>'+(tx.amount||0)+'</td>';else html+='<td>'+(tx.units||0)+'</td><td>'+(tx.rate||22)+'</td>';html+='</tr>'});html+='</table>'}
      if(sim){html+='<h3>Did it work?</h3><div class="mc-grid"><div class="mc-card"><div class="mc-label">Rewarded '+(isW&&!isP?"top-ups":"sessions")+'</div><div class="mc-val">'+sim.qualTxns+' / '+sim.rows.length+'</div></div><div class="mc-card"><div class="mc-label">Total reward cost</div><div class="mc-val">\u20b9'+sim.totalReward.toFixed(0)+'</div></div></div>';
        if(sim.rows){html+='<h3>Transaction Detail</h3><table><tr><th>#</th><th>Date</th>';if(isW||isP)html+='<th>Amount</th>';else html+='<th>kWh</th><th>Net \u20b9</th>';html+='<th>Sess</th><th>Rate</th><th>Reward</th><th>Status</th></tr>';sim.rows.forEach(r=>{html+='<tr><td>'+r.idx+'</td><td>'+r.date+'</td>';if(isW||isP)html+='<td>\u20b9'+(r.amount||0).toFixed(0)+'</td>';else html+='<td>'+r.units+'</td><td>\u20b9'+r.net.toFixed(0)+'</td>';html+='<td>'+r.sessStr+'</td><td>'+r.rateStr+'</td><td>\u20b9'+(r.reward||0).toFixed(0)+'</td><td>'+r.status+'</td></tr>'});html+='</table>'}}
      if(sRoi){html+='<h3>Was it worth it?</h3><div class="mc-grid"><div class="mc-card"><div class="mc-label">'+sRoi.rewardLabel+'</div><div class="mc-val">\u20b9'+sRoi.liability.toFixed(0)+'</div></div>';if(sRoi.isCharging){html+='<div class="mc-card"><div class="mc-label">Margin earned</div><div class="mc-val">\u20b9'+sRoi.marginEarned.toFixed(0)+'</div></div><div class="mc-card"><div class="mc-label">Net impact</div><div class="mc-val">'+(sRoi.netImpact>=0?"+":"")+'\u20b9'+sRoi.netImpact.toFixed(0)+'</div></div><div class="mc-card"><div class="mc-label">Per session</div><div class="mc-val">'+(sRoi.perSession>=0?"+":"")+'\u20b9'+sRoi.perSession.toFixed(0)+'</div></div>'}html+='<div class="mc-card"><div class="mc-label">Breakeven</div><div class="mc-val">'+sRoi.breakeven+'</div></div></div>';
        if(sRoi.risks&&sRoi.risks.length>0){html+='<h3>Risk Assessment</h3>';sRoi.risks.forEach(r=>{html+='<div class="risk risk-'+r.type+'">'+r.msg+'</div>'})}}
      html+='</body></html>';w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);
    }}>Download PDF</button></div>
  </div></div>}

function SimulateStep({offer,txns,setTxns,marginPct,onSaveSim}){const[res,setRes]=useState(offer.simResult||null);const[roi,setRoi]=useState(offer.simRoi||null);const isW=offer.activity==="Wallet top-up",isP=!!offer.wpre;const txnTimer=useRef(null);
  const ut=(i,f,v)=>{const t=[...txns];t[i]={...t[i],[f]:v};setTxns(t);if(txnTimer.current)clearTimeout(txnTimer.current);txnTimer.current=setTimeout(()=>onSaveSim({simTxns:t}),2000)};
  const addTxn=(tx)=>{const t=[...txns,tx];setTxns(t);onSaveSim({simTxns:t})};
  const delTxn=(j)=>{const t=txns.filter((_,i)=>i!==j);setTxns(t);onSaveSim({simTxns:t})};
  const genSample=()=>{const t=generateSampleTxns(offer);setTxns(t);onSaveSim({simTxns:t})};
  const run=()=>{const r=runSimulation(offer,txns);const ro=computeROI(offer,r,marginPct);setRes(r);setRoi(ro);onSaveSim({simTxns:txns,simResult:{...r,rows:r.rows},simRoi:ro})};
  return<><div className="card"><div className="card-title">{isP?"Sessions spending pre-load":isW?"Wallet top-ups":"Charging sessions"}</div><button className="sample-btn" onClick={genSample}>{"\u2726"} Generate sample data</button>
  {(isW||isP)?<>{(()=>{const rows=txns.map((tx,i)=><div key={i} className="txn-row" style={{gridTemplateColumns:"130px 120px 28px"}}><input type="date" value={tx.date||""} onChange={e=>ut(i,"date",e.target.value)}/><input type="number" value={tx.amount||""} placeholder={"\u20b9"} onChange={e=>ut(i,"amount",e.target.value)}/><button className="del-btn" onClick={()=>delTxn(i)}>{"\u00d7"}</button></div>);return<><div className="txn-hdr" style={{gridTemplateColumns:"130px 120px 28px"}}><span>Date</span><span>{isP?"Session \u20b9":"Top-up \u20b9"}</span><span/></div>{rows}</>})()}<button className="btn-dashed" onClick={()=>addTxn({date:"",amount:""})}>+ Add {isP?"session":"top-up"}</button></>:
  <><div className="txn-hdr"><span>Date</span><span>kWh</span><span>{"\u20b9"}/kWh</span><span/></div>{txns.map((tx,i)=><div key={i} className="txn-row"><input type="date" value={tx.date||""} onChange={e=>ut(i,"date",e.target.value)}/><input type="number" value={tx.units||""} placeholder="kWh" onChange={e=>ut(i,"units",e.target.value)}/><input type="number" value={tx.rate||""} placeholder={"\u20b9/kWh"} onChange={e=>ut(i,"rate",e.target.value)}/><button className="del-btn" onClick={()=>delTxn(i)}>{"\u00d7"}</button></div>)}<button className="btn-dashed" onClick={()=>addTxn({date:"",units:"",rate:"22"})}>+ Add txn</button></>}</div>
  <button className="btn btn-primary" onClick={run} style={{marginBottom:20,width:"100%"}}>Run Simulation</button>
  {res&&<>
    <div className="dash-section"><div className="dash-title"><span className="dash-icon di-g">{"\u2713"}</span> Did it work?</div><div className="metrics"><div className="mc"><div className="mc-label">Rewarded {isW&&!isP?"top-ups":"sessions"}</div><div className="mc-val">{res.qualTxns}</div><div className="mc-sub">out of {res.rows.length} transactions</div></div><div className="mc"><div className="mc-label">Total {res.rewardType==="ChargeXP"?"XP issued":"reward cost"}</div><div className="mc-val">{res.rewardType==="ChargeXP"?res.totalReward.toFixed(0)+" XP":"\u20b9"+res.totalReward.toFixed(0)}</div></div>{!isW&&!isP&&<div className="mc"><div className="mc-label">Net revenue (pre-GST)</div><div className="mc-val">{"\u20b9"}{res.totalNet.toFixed(0)}</div><div className="mc-sub">Margin applies to this</div></div>}{(isW||isP)&&<div className="mc"><div className="mc-label">{isP?"Session spend":"Total topped up"}</div><div className="mc-val">{"\u20b9"}{res.totalGross.toFixed(0)}</div><div className="mc-sub">{isP?"From pre-loaded balance":"No margin on top-ups"}</div></div>}</div></div>
    {roi&&<div className="dash-section"><div className="dash-title"><span className="dash-icon di-a">{"\u20b9"}</span> Was it worth it?</div>
      {roi.isCharging&&<><div className="metrics"><div className="mc"><div className="mc-label">Margin earned</div><div className="mc-val" style={{color:"var(--green)"}}>{"\u20b9"}{roi.marginEarned.toFixed(0)}</div><div className="mc-sub">Net revenue {"\u00d7"} {marginPct}%</div></div><div className="mc"><div className="mc-label">{roi.rewardLabel}</div><div className="mc-val" style={{color:"var(--red)"}}>{"\u20b9"}{roi.liability.toFixed(0)}</div><div className="mc-sub">total payout</div></div><div className="mc"><div className="mc-label">Net impact</div><div className="mc-val" style={{color:roi.netImpact>=0?"var(--green)":"var(--red)"}}>{roi.netImpact>=0?"+":""}{"\u20b9"}{roi.netImpact.toFixed(0)}</div><div className="mc-sub">{roi.netImpact>=0?"Profitable":"Loss"}</div></div><div className="mc"><div className="mc-label">Per session</div><div className="mc-val" style={{color:roi.perSession>=0?"var(--green)":"var(--red)"}}>{roi.perSession>=0?"+":""}{"\u20b9"}{roi.perSession.toFixed(0)}</div><div className="mc-sub">margin - reward</div></div></div><div className="mc" style={{marginTop:10}}><div className="mc-label">Breakeven</div><div className="mc-val">{roi.breakeven}</div></div></>}
      {roi.isWallet&&<><div className="metrics"><div className="mc"><div className="mc-label">{roi.rewardLabel}</div><div className="mc-val" style={{color:"var(--red)"}}>{"\u20b9"}{roi.liability.toFixed(0)}</div><div className="mc-sub">Leading cost</div></div><div className="mc"><div className="mc-label">Revenue</div><div className="mc-val" style={{color:"var(--text3)"}}>{"\u20b9"}0</div><div className="mc-sub">Lagging</div></div><div className="mc"><div className="mc-label">To break even</div><div className="mc-val">{roi.breakeven}</div><div className="mc-sub">at {marginPct}% margin</div></div></div></>}
      {roi.isPreload&&<><div className="metrics"><div className="mc"><div className="mc-label">Pre-load cost</div><div className="mc-val" style={{color:"var(--red)"}}>{"\u20b9"}{(parseFloat(offer.w)||0).toFixed(0)}</div><div className="mc-sub">Per user</div></div><div className="mc"><div className="mc-label">Revenue</div><div className="mc-val">{"\u20b9"}{res.totalGross.toFixed(0)}</div><div className="mc-sub">{res.qualTxns} sessions</div></div><div className="mc"><div className="mc-label">Margin</div><div className="mc-val" style={{color:roi.marginEarned>0?"var(--green)":"var(--text3)"}}>{"\u20b9"}{roi.marginEarned.toFixed(0)}</div><div className="mc-sub">at {marginPct}%</div></div><div className="mc"><div className="mc-label">Net impact</div><div className="mc-val" style={{color:roi.netImpact>=0?"var(--green)":"var(--red)"}}>{roi.netImpact>=0?"+":""}{"\u20b9"}{roi.netImpact.toFixed(0)}</div></div></div><div className="mc" style={{marginTop:10}}><div className="mc-label">Breakeven</div><div className="mc-val">{roi.breakeven}</div></div></>}
    </div>}
    {roi&&roi.risks.length>0&&<div className="dash-section"><div className="dash-title"><span className="dash-icon di-r">{"\u2192"}</span> What next?</div>{roi.risks.map((r,i)=><div key={i} className={"risk-item "+r.type}>{r.msg}</div>)}</div>}
    <div className="card" style={{padding:0,overflow:"hidden",marginTop:8}}><div style={{padding:"14px 20px 0",fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)"}}>Transaction Detail</div><div className="scroll-x" style={{padding:"8px 0"}}><table className="result-tbl" style={{minWidth:600}}><thead><tr><th>#</th><th>Date</th>{(isW||isP)&&<th>{isP?"Sess \u20b9":"Top-up \u20b9"}</th>}{!isW&&!isP&&<><th>kWh</th><th>Net \u20b9</th><th>w/ GST</th></>}<th>{isW&&!isP?"#":"Sess"}</th><th>Rate</th><th>{res.rewardType==="ChargeXP"?"XP":"Reward"}</th><th>Status</th></tr></thead><tbody>{res.rows.map((r,i)=><tr key={i}><td>{r.idx}</td><td>{r.date}</td>{(isW||isP)&&<td>{"\u20b9"}{(r.amount||0).toFixed(0)}</td>}{!isW&&!isP&&<><td>{r.units}</td><td>{"\u20b9"}{r.net.toFixed(0)}</td><td>{"\u20b9"}{r.total.toFixed(0)}</td></>}<td>{r.sessStr}</td><td>{r.rateStr}</td><td className="rval">{r.rewardUnit==="XP"?(r.reward||0).toFixed(0)+" XP":"\u20b9"+(r.reward||0).toFixed(0)}</td><td><StatusBadge s={r.status}/></td></tr>)}</tbody></table></div></div>
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
    const cashbackPerSess=rewardPerQualTxn;const netMarginPerSess=marginPerSess-cashbackPerSess;
    const marginErosion=marginPerSess>0?(cashbackPerSess/marginPerSess)*100:0;
    const totalSessions=redeemed*cappedSess;const totalRevenue=totalSessions*revenuePerSess;
    const totalMargin=totalSessions*marginPerSess;const totalCashback=totalSessions*cashbackPerSess;
    const netTotal=totalMargin-totalCashback;
    const incrNet=totalMargin*incr-totalCashback;
    const effRatePerKwh=aRate-(cashbackPerSess/aKwh);
    // Chart
    const chartPts=[];for(let r=0;r<=50;r+=2){const rd=Math.round(ub*(r/100));const s=rd*cappedSess;chartPts.push({r,margin:s*marginPerSess,reward:s*cashbackPerSess,net:s*netMarginPerSess})}
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
      <div className="wif-headline-block"><div className="wif-headline-label">Net after cashback</div><div className="wif-headline-val" style={{color:netTotal>=0?"var(--green)":"var(--red)"}}>{netTotal>=0?"+":""}{fmt(netTotal)}</div><div className="wif-headline-delta">{redeemed.toLocaleString()} users × {cappedSess} sessions</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">Cashback payout</div><div className="wif-headline-val" style={{color:"var(--red)"}}>{fmt(totalCashback)}</div><div className="wif-headline-delta">{"₹"}{cashbackPerSess.toFixed(0)} per session avg</div></div>
      <div className="wif-headline-block"><div className="wif-headline-label">Margin erosion</div><div className="wif-headline-val" style={{color:marginErosion>40?"var(--red)":marginErosion>25?"var(--amber)":"var(--green)"}}>{fmtP(marginErosion)}</div><div className="wif-headline-delta">of {fmtP(mPct*100)} margin goes to cashback</div></div>
    </div>,
    detail:<>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Session-level economics</div><div className="metrics">
        <div className="mc"><div className="mc-label">Revenue / session</div><div className="mc-val">{"₹"}{revenuePerSess.toFixed(0)}</div><div className="mc-sub">{aKwh}kWh × {"₹"}{aRate}</div></div>
        <div className="mc"><div className="mc-label">Margin / session</div><div className="mc-val">{"₹"}{marginPerSess.toFixed(0)}</div><div className="mc-sub">{fmtP(mPct*100)} of revenue</div></div>
        <div className="mc"><div className="mc-label">Cashback / session</div><div className="mc-val" style={{color:"var(--red)"}}>{"₹"}{cashbackPerSess.toFixed(0)}</div><div className="mc-sub">from simulation</div></div>
        <div className="mc"><div className="mc-label">Net margin / session</div><div className="mc-val" style={{color:netMarginPerSess>=0?"var(--green)":"var(--red)"}}>{netMarginPerSess>=0?"+":""}{"₹"}{netMarginPerSess.toFixed(0)}</div><div className="mc-sub">margin - cashback</div></div>
      </div></div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Effective pricing after offer</div><div className="metrics">
        <div className="mc"><div className="mc-label">Rate before offer</div><div className="mc-val">{"₹"}{aRate}/kWh</div></div>
        <div className="mc"><div className="mc-label">Effective rate after cashback</div><div className="mc-val" style={{color:effRatePerKwh<aRate*0.8?"var(--red)":"var(--text)"}}>{"₹"}{effRatePerKwh.toFixed(1)}/kWh</div><div className="mc-sub">what you actually earn</div></div>
      </div></div>
      <div className="card" style={{padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Incrementality test</div>
        <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:12}}>If <b>{fmtP(incr*100)}</b> of sessions are incremental (wouldn't have happened without the offer), your true net impact is:</div>
        <div className="metrics">
          <div className="mc"><div className="mc-label">Incremental margin</div><div className="mc-val">{fmt(totalMargin*incr)}</div><div className="mc-sub">only counting new sessions</div></div>
          <div className="mc"><div className="mc-label">Full cashback cost</div><div className="mc-val" style={{color:"var(--red)"}}>{fmt(totalCashback)}</div><div className="mc-sub">paid on ALL sessions</div></div>
          <div className="mc"><div className="mc-label">True net impact</div><div className="mc-val" style={{color:incrNet>=0?"var(--green)":"var(--red)"}}>{incrNet>=0?"+":""}{fmt(incrNet)}</div><div className="mc-sub">{incr*100<100?"lower than headline":"fully incremental"}</div></div>
        </div>
        {incrNet<0&&netTotal>=0&&<div className="risk-item warn" style={{marginTop:10}}>The headline looks profitable, but if only {fmtP(incr*100)} of sessions are incremental, you actually lose {fmt(Math.abs(incrNet))}. The rest are users who would have charged anyway — you're just giving them cashback for free.</div>}
      </div>
    </>,chart:<div className="card" style={{padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600}}>Margin vs Cashback across redemption rates</div>
        <div style={{display:"flex",gap:14,fontSize:11,color:"var(--text3)"}}><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"var(--green)",marginRight:4}}/>Margin</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"var(--red)",marginRight:4}}/>Cashback</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"var(--text)",marginRight:4}}/>Net</span></div>
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
    narrative:netTotal>=0?<div className="wif-narrative"><b>Profitable at scale.</b> At {inp.redemptionRate}% redemption, {redeemed.toLocaleString()} users generate {fmt(totalMargin)} in margin. After {fmt(totalCashback)} cashback payout, you net <b>{fmt(netTotal)}</b>. Margin erosion is {fmtP(marginErosion)} — {marginErosion<20?"well within healthy range.":marginErosion<35?"moderate, monitor closely.":"high, consider reducing rates."} Effective per-kWh earning drops from {"₹"}{aRate} to {"₹"}{effRatePerKwh.toFixed(1)}.</div>:<div className="wif-narrative" style={{background:"var(--red-bg)",color:"var(--red)"}}><b>Unprofitable.</b> Cashback cost ({fmt(totalCashback)}) exceeds margin ({fmt(totalMargin)}). Effective kWh rate is {"₹"}{effRatePerKwh.toFixed(1)} — below sustainable levels. Reduce cashback rate or cap, or narrow the audience.</div>};
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
        {isCharging&&"Adjust the levers to project how this cashback offer performs at scale. Each change updates all calculations live."}
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
  const saveTimer=useRef(null);

  const offer=offers.find(o=>(o._id||o.id)===cid);const conflicts=detectConflicts(offers);

  // Theme
  useEffect(()=>{document.documentElement.className=theme;try{window.localStorage?.setItem("offeros_theme",theme)}catch{}},[theme]);
  const toggleTheme=()=>setTheme(t=>t==="light"?"dark":"light");

  // Auth check on mount
  useEffect(()=>{api("/auth?action=me").then(d=>{setUser(d.user);setAuthLoading(false)}).catch(()=>setAuthLoading(false))},[]);

  // Load campaigns when authenticated
  useEffect(()=>{if(user){api("/campaigns").then(c=>{setCampaigns(c);Promise.all(c.map(camp=>api("/offers?campaignId="+camp._id).catch(()=>[]))).then(results=>{setAllOffers(results.flat())}).catch(()=>{})}).catch(()=>{})}},[user]);

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
  return<><style>{css}</style><div className="app">
    <aside className="sidebar">
      <div className="sb-brand" onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>
        <div className="sb-brand-mark">OS</div><span>OfferOS</span>
      </div>
      <div className="sb-org">
        <div className="sb-org-avatar">CZ</div><span className="name">ChargeZone</span><span className="caret">⌄</span>
      </div>
      <div className="sb-section">Workspace</div>
      <button className={"sb-item "+(view==="campaigns"&&!activeCampaign?"active":"")} onClick={()=>{setActiveCampaign(null);setView("campaigns")}}><span className="icon"><SvgIcon name="home"/></span><span>Overview</span></button>
      <button className={"sb-item "+((view==="offers"||view==="editor")?"active":"")} onClick={()=>{if(activeCampaign)setView("offers");else setView("campaigns")}}><span className="icon"><SvgIcon name="layers"/></span><span>Campaigns</span></button>
      <button className={"sb-item "+(view==="schedule"?"active":"")} onClick={()=>setView("schedule")}><span className="icon"><SvgIcon name="cal"/></span><span>Schedule</span></button>
      <button className={"sb-item "+(aiOpen?"active":"")} onClick={()=>setAiOpen(!aiOpen)}><span className="icon"><SvgIcon name="spark"/></span><span>AI Assistant</span>{!getApiKey()&&<span className="badge">!</span>}</button>
      <div className="sb-section">Account</div>
      <button className="sb-item" onClick={()=>setKeyModal(true)}><span className="icon"><SvgIcon name="gear"/></span><span>Settings</span></button>
      <div className="sb-foot">
        <div className="sb-foot-avatar">{user.displayName?.[0]?.toUpperCase()||"U"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="who">{user.displayName||"User"}</div>
          <div className="role">{user.role||"editor"} · ChargeZone</div>
        </div>
        <div className="theme-toggle" onClick={toggleTheme} title={theme==="light"?"Dark mode":"Light mode"}><div className="thumb"/></div>
      </div>
    </aside>
    <div className="main-area">
      <div className="topbar">
        <div className="breadcrumb">
          <span style={{cursor:"pointer"}} onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>OfferOS</span>
          {activeCampaign&&<><span className="sep">/</span><span style={{cursor:"pointer"}} onClick={()=>setView("offers")}>{activeCampaign.name}</span></>}
          {offer&&view==="editor"&&<><span className="sep">/</span><span className="current">{offer.name}</span></>}
          {view==="schedule"&&<><span className="sep">/</span><span className="current">Schedule</span></>}
          {!activeCampaign&&view!=="schedule"&&<><span className="sep">/</span><span className="current">Campaigns</span></>}
        </div>
        <div className="topbar-right">
          {saveStatus&&<div className={"save-indicator "+saveStatus}>{saveStatus==="saving"?"Saving...":saveStatus==="saved"?"✓ Saved":saveStatus==="error"?"Save failed":""}</div>}
          <div className="user-badge" onClick={logout} title={"Sign out"}>
            <div className="user-badge-avatar">{user.displayName?.[0]?.toUpperCase()||"U"}</div>
          </div>
        </div>
      </div>
      <div className="content">
      {/* CAMPAIGNS LIST */}
      {view==="campaigns"&&<><HomeDashboard campaigns={campaigns} allOffers={allOffers} /><CampaignsList campaigns={campaigns} onSelect={c=>{setActiveCampaign(c);}} onNew={newCampaign} onArchive={archiveCampaign}/></>}

      {/* SCHEDULE VIEW */}
      {view==="schedule"&&<ScheduleView allOffers={allOffers} campaigns={campaigns} onOpenOffer={(o)=>{const camp=campaigns.find(c=>c._id===o.campaignId);if(camp){setActiveCampaign(camp);api("/offers?campaignId="+camp._id).then(offs=>{setOffers(offs);setCid(o._id||o.id);setStep(0);setTxns(o.simTxns||defaultTxns(o.activity));setLastSim(o.simResult||null);setView("editor")}).catch(()=>{})}}}/>}

      {/* OFFERS VIEW */}
      {view==="offers"&&activeCampaign&&<><div className="page-hdr">
        <div className="page-hdr-sub" onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>← All Campaigns</div>
        <input style={{fontFamily:"var(--font-display)",fontSize:28,fontWeight:400,border:"none",background:"none",width:"100%",padding:0,color:"var(--text)"}} value={activeCampaign.name} onChange={e=>{setActiveCampaign(p=>({...p,name:e.target.value}));updateCampaignName(e.target.value)}} placeholder="Campaign name"/>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:20,alignItems:"center"}}><div className="field" style={{maxWidth:180}}><div className="field-label">Charging margin %</div><input type="number" value={marginPct} min="1" max="100" onChange={e=>updateMargin(parseInt(e.target.value)||30)} style={{padding:"7px 10px"}}/></div><div style={{fontSize:11,color:"var(--text3)",lineHeight:1.5,maxWidth:400}}>Margin on charging net revenue (pre-GST). Wallet top-ups don't generate margin.</div></div>
      {/* Business Impact Projector */}
      <BusinessProjector offers={offers} marginPct={marginPct} projInputs={activeCampaign.projectionInputs} onSave={(inp)=>{setActiveCampaign(p=>({...p,projectionInputs:inp}));api("/campaigns?id="+activeCampaign._id,{method:"PUT",body:{projectionInputs:inp}}).catch(()=>{})}} />
      {/* Campaign Dashboard — Decision Board */}
      {offers.length>0&&<div style={{marginBottom:24}}>
        {(()=>{const totalCost=offers.reduce((s,o)=>s+(o.simResult?.totalReward||0),0);const simCount=offers.filter(o=>o.simResult).length;const allSegs=[...new Set(offers.flatMap(o=>o.segments||[]))];const segText=allSegs.includes("All")?"All segments":allSegs.filter(s=>s!=="All").join(", ")||"None";const conflictCount=Math.round(Object.keys(conflicts).length/2);const hasNeg=offers.some(o=>o.simRoi&&o.simRoi.netImpact<0);const verdict=conflictCount>0?"Conflicts detected":hasNeg?"Some offers losing money":simCount===0?"Not yet tested":totalCost>0?"Viable":"Ready";const orbClass=conflictCount>0||hasNeg?"caution":simCount===0?"caution":"healthy";return<div className="db-summary">
          <div className="db-status"><div className={"db-status-orb "+orbClass}>{orbClass==="healthy"?"✓":"⚠"}</div><div className="db-status-text">{verdict}</div><div className="db-status-sub">{offers.length} offers · {simCount} simulated</div></div>
          <div className="db-metric"><div className="db-metric-label">Projected reward</div><div className="db-metric-val" style={{color:totalCost>0?"var(--red)":"var(--text3)"}}>₹{totalCost.toLocaleString()}</div><div className={"db-metric-delta "+(totalCost>0?"down":"")}>{simCount>0?"from "+simCount+" simulations":"run simulations first"}</div></div>
          <div className="db-metric"><div className="db-metric-label">Segments</div><div className="db-metric-val" style={{fontSize:18}}>{segText}</div><div className="db-metric-delta">{offers.filter(o=>!o.segments||o.segments.length===0).length>0?offers.filter(o=>!o.segments||o.segments.length===0).length+" without segment":""}</div></div>
          <div className="db-metric" style={{borderRight:"none"}}><div className="db-metric-label">Conflicts</div><div className="db-metric-val" style={{color:conflictCount>0?"var(--red)":"var(--green)"}}>{conflictCount>0?conflictCount:"None"}</div>{conflictCount>0&&<div className="db-metric-delta down">segment + reward overlap</div>}</div>
        </div>})()}
        {offers.length>1&&<div className="card" style={{padding:0,overflow:"hidden",marginBottom:16}}><div style={{padding:"14px 20px 0",fontSize:10,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text3)"}}>Offer comparison</div><div className="scroll-x" style={{padding:"8px 0"}}><table className="result-tbl" style={{minWidth:600}}><thead><tr><th>Offer</th><th>Segment</th><th>Type</th><th>Activity</th><th>Key rate</th><th>Cap</th><th>Duration</th><th>Reward cost</th><th>Net impact</th></tr></thead><tbody>{offers.map(o=>{const tp=o.wpre?"Pre-load":o.reward;const rate=o.wpre?"₹"+(o.w||"—"):o.reward==="Cashback"?(o.tiers?.[0]?.pct||"—")+"%":o.reward==="Discount"?(o.dpct||"—")+"%":o.reward==="ChargeXP"?(o.xpwpct||"—")+" XP/₹":o.p||"—";const cap=o.cy?"₹"+o.cy:o.dy?"₹"+o.dy:"—";const sr=o.simResult;const sRoi=o.simRoi;return<tr key={o._id||o.id} style={{cursor:"pointer"}} onClick={()=>openOffer(o._id||o.id)}><td style={{fontWeight:600}}>{o.name}</td><td>{o.segments?.join(", ")||"—"}</td><td><span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"var(--bg3)"}}>{tp}</span></td><td>{o.activity}</td><td>{rate}</td><td>{cap}</td><td>{o.t}d</td><td>{sr?"₹"+sr.totalReward.toFixed(0):"—"}</td><td style={{color:sRoi?(sRoi.netImpact>=0?"var(--green)":"var(--red)"):"var(--text3)"}}>{sRoi?(sRoi.netImpact>=0?"+":"")+"₹"+sRoi.netImpact.toFixed(0):"—"}</td></tr>})}</tbody></table></div></div>}
      </div>}
      {offersLoading&&<div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Loading offers...</div>}
      {!offersLoading&&<div className="offers-grid">{offers.map(o=>{const tp=o.wpre?"Pre-load":o.reward,oid=o._id||o.id,hc=conflicts[oid],st=getOfferStatus(o);return<div key={oid} className={"offer-card "+(oid===cid?"active":"")} onClick={()=>openOffer(oid)}><div className="offer-card-actions" onClick={e=>e.stopPropagation()}><button onClick={()=>dupOffer(oid)} title="Duplicate">⧉</button><button className="del" onClick={()=>setDelTarget(oid)} title="Delete">×</button></div><div className="offer-card-type"><div className="offer-card-dot" style={{background:DOT_COLORS[tp]}}/><div className="offer-card-label">{tp}</div><span style={{marginLeft:"auto",fontSize:10,padding:"2px 8px",borderRadius:12,background:STATUS_BG[st],color:STATUS_COLORS[st],fontWeight:600}}>{st}</span></div><div className="offer-card-name">{o.name}</div><div className="offer-card-segs">{o.segments?.length?o.segments.join(", "):"No segment"}{o.startDate?" · Starts "+o.startDate:""}</div>{hc&&<div style={{fontSize:10,color:"var(--red)",marginTop:6}}>⚠ {hc[0]}</div>}</div>})}<div className="add-card" onClick={()=>setShowTemplates(true)}>+ New Offer</div></div>}
      {showTemplates&&<div className="modal-overlay" onClick={()=>setShowTemplates(false)}><div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}><div className="modal-title">Choose a starting point</div><div className="modal-msg">Pick a template to pre-fill your offer, or start from scratch.</div>{OFFER_TEMPLATES.map((t,i)=><div key={i} style={{padding:"14px 16px",border:"1px solid var(--border)",borderRadius:"var(--r)",marginBottom:8,cursor:"pointer",transition:"all .15s"}} onClick={()=>addOffer(t)} onMouseOver={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseOut={e=>e.currentTarget.style.borderColor="var(--border)"}><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{t.name}</div><div style={{fontSize:11,color:"var(--text3)"}}>{t.desc}</div></div>)}</div></div>}
      </>}

      {/* EDITOR VIEW */}
      {view==="editor"&&offer&&<><div className="page-hdr">
        <div className="page-hdr-sub" onClick={()=>setView("offers")}>← {activeCampaign?.name||"Offers"}</div>
        <input style={{fontFamily:"var(--font-display)",fontSize:28,fontWeight:400,border:"none",borderBottom:"2px solid var(--border)",background:"none",width:"100%",padding:"0 0 4px",color:"var(--text)"}} value={offer.name} onChange={e=>upd({name:e.target.value})} placeholder="Offer name"/>
      </div>
        <div className="steps">{STEPS.map((s,i)=>{let cls="";if(i===step)cls="active";else if(i<step)cls=validateStep(offer,i)?"done":"incomplete";return<div key={i} className={"step "+cls} onClick={()=>setStep(i)}>{s.label}</div>})}</div>
        <div style={{marginBottom:20,padding:"12px 16px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"var(--r2)"}}><div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{STEPS[step].title}</div><div style={{fontSize:12,color:"var(--text3)"}}>{STEPS[step].desc}</div></div>
        {step===0&&<><AudienceStep offer={offer} update={upd}/><div className="btn-row"><button className="btn btn-primary" onClick={()=>setStep(1)}>Next →</button></div></>}
        {step===1&&<><ActivityStep offer={offer} update={upd} setTxns={setTxns}/><div className="btn-row"><button className="btn" onClick={()=>setStep(0)}>← Back</button><button className="btn btn-primary" onClick={()=>setStep(2)}>Next →</button></div></>}
        {step===2&&<><RewardStep offer={offer} update={upd}/><div className="btn-row"><button className="btn" onClick={()=>setStep(1)}>← Back</button><button className="btn btn-primary" onClick={()=>setStep(3)}>Next →</button></div></>}
        {step===3&&<><BoundaryStep offer={offer} update={upd}/><div className="btn-row"><button className="btn" onClick={()=>setStep(2)}>← Back</button><button className="btn btn-primary" onClick={()=>setStep(4)}>Next →</button></div></>}
        {step===4&&<><DurationStep offer={offer} update={upd}/><div className="btn-row"><button className="btn" onClick={()=>setStep(3)}>← Back</button><button className="btn btn-primary" onClick={()=>setStep(5)}>Review →</button></div></>}
        {step===5&&<><SummaryStep offer={offer} campaignName={activeCampaign?.name}/><div className="btn-row"><button className="btn" onClick={()=>setStep(4)}>← Back</button><button className="btn btn-primary" onClick={()=>setStep(6)}>Test scenarios →</button></div></>}
        {step===6&&<><SimulateStep offer={offer} txns={txns} setTxns={setTxns} marginPct={marginPct} onSaveSim={(simData)=>{setOffers(p=>p.map(o=>(o._id||o.id)===cid?{...o,...simData}:o));if(cid){api("/offers?id="+cid,{method:"PUT",body:simData}).catch(()=>{})}}}/><div className="btn-row"><button className="btn" onClick={()=>setStep(5)}>← Back</button></div></>}
      </>}
    </div></div>
    <AIDrawer offer={offer} offers={offers} open={aiOpen} onClose={()=>setAiOpen(false)} step={step} lastSim={lastSim}/>
    <div className="mobile-bar">
      <button className={view==="campaigns"?"active":""} onClick={()=>{setActiveCampaign(null);setView("campaigns")}}>⊞<span>Home</span></button>
      <button className={view==="schedule"?"active":""} onClick={()=>setView("schedule")}>📅<span>Schedule</span></button>
      {activeCampaign&&<button className={view==="offers"?"active":""} onClick={()=>setView("offers")}>☰<span>Offers</span></button>}
      {offer&&<button className={view==="editor"?"active":""} onClick={()=>setView("editor")}>✎<span>Editor</span></button>}
      <button className={aiOpen?"active":""} onClick={()=>setAiOpen(!aiOpen)}>✦<span>AI</span></button>
    </div>
  </div>{delTarget&&<ConfirmModal title="Delete offer?" msg={'"'+(offers.find(o=>(o._id||o.id)===delTarget)?.name||"")+'" will be permanently removed.'} onConfirm={confirmDel} onCancel={()=>setDelTarget(null)}/>}{keyModal&&<APIKeyModal onClose={()=>setKeyModal(false)}/>}</>}
