// InneRISE Dashboard demo: the Prize Wallet (078_prize_wallet.sql) and 074's two-step counter (partner_redeem_check,
// partner_redeem_confirm, partner_redeem_status), in memory, with the same argument names, rules and error codes. It plugs
// into demo.js like the other demo parts, and shares their database.
//   Northside Health gives four prizes: a chair massage (an InneRISE voucher, good at two places), a wellness kit (picked up
//   at the Riverside clinic or delivered), a nutrition consult (claimed by emailing the clinic's wellness team) and a running
//   store discount (the business's own codes, uploaded as a list).
//   Omar (Riverside clinic) and Aisha (Downtown office) have Can Redeem Prizes; ?demo=redeemer signs in as Kim, who has it
//   for both places and nothing else. Peak Fitness's logo and one offer's terms wait for InneRISE's review; ?demo=gymdesk
//   signs in as Dana, who has Can Redeem Prizes for Peak's Riverfront gym only and checks Peak's codes at 074's counter.
// The gaps round: prize_giver_get (the logo's review state and InneRISE's note), prize_staff_places.units lists every place
// where I may redeem (all of them for the whole giver), and every redeemer of a partner uses 074's counter.
// New prize terms need the Sponsor Reward Terms accepted first (072's terms round; prize_terms_set answers sponsor_terms).
// Every prize is used once at the counter: one confirm, one confirmation number. The demo has no phone to make the rotating
// QR code, so it makes its own six digits (demo.rotating(ref) gives them); the manual code works as on the server.
import { dayIn, sponsorTermsOk } from './demo-programs.js';

const DAY = 864e5;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY = /^[A-Za-z0-9_-]{8,64}$/;
const DT = 'c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e05'; // Northside's Downtown office
export const MASSAGE = 'c4a00002-1e2f-4a3b-8c4d-000000000111';
export const KIT = 'c4a00002-1e2f-4a3b-8c4d-000000000112';
export const CONSULT = 'c4a00002-1e2f-4a3b-8c4d-000000000113';
const PEAK_CP = (n) => `e7b10000-3c2d-4e1f-9a8b-000000000${n}`;
const LOGO_NORTHSIDE = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAA9UlEQVR42u3b2xGDQAiFYTtJSZaWNztKAVakDWRGVA6wy8+M7zlf1uvCslBUWK3777Ac7QJPBeIVejgMy4//fDfTMRSER+A3ICXDewW3QkwfvBREZnALRJvw4QjVgl9BtAovRRglvAxhpPD/EEr9+9YqsQoUSz8KwAVBsfQjAV6dCqoLXybALQTVhS8a4NEqUN72sgFMCMrbXgbA7VXQGkD90JMFYEYAAIDGAE/CVykXBAAAAAAAAAAAAIC2ALwLAAAAAHwTBIDP4myMsDXG5ijb4zRI0CJDkxRtcjRK0ipLszTt8gxMMDLD0BRjcwxOMjpLzV0nryg2Iyvlka0AAAAASUVORK5CYII=';
const LOGO_PEAK = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABJ0lEQVR42u3ayw3CMBBF0VRAFRRCB/TJmobYUAQbUJAiRZCP7byJJ+M70ivgHslZpes47nun8+Xd0gAAAAAAAAAAAAAAAMAY4Hp7tgvQxw9rDmAc7xEBAEuAqXhvCGYAS/GeEEwAUuK9IACgBsiJ94AgBSiJr40gA9gSXxMBAAWAIj4V4f54+QJQxq8h9PHDXABYxM8hjOOVCIcAmIpXIRQDWMb/IrgD2CN+2FK8AiEbYM/4PRDCAJQiZAHUiLdGSAaoGW/5FJIAPMRbIYQEyEFYBfAUb4GwCOAxXo0wC+A5Xvk9CA+whjAJcIR4FcIfwJHiFQghALYgABAFoBQhFEAJQjiAXISmAfqFBMhBCAuQihAaIAWB/wQBAAAAAAAAAAAAAODavg+Q44G58j7sIAAAAABJRU5ErkJggg==';
const TYPES = ['discount', 'free_item', 'service', 'membership', 'physical'];
const BARCODES = ['code128', 'qr', 'ean13', 'upca', 'code39', 'none'];
const LABEL = 'Promotional reward. No cash value.'; // the server's words on every InneRISE voucher
const FULFILLMENTS = ['none', 'pickup', 'delivery', 'either', 'contact'];
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// Keys of the earlier draft's money prizes: a prize is never money, so any of them makes the terms 'invalid'.
const MONEY_KEYS = ['value_cents', 'currency', 'uses', 'balance_cents', 'amount_cents'];

export const PRIZE_SIGNATURES = {
  prize_staff_places: { args: ['o'], required: ['o'], uuids: ['o'] },
  prize_check: { args: ['o', 'code_in', 'at_unit'], required: ['o', 'code_in'], uuids: ['o', 'at_unit'] },
  prize_confirm: { args: ['o', 'code_in', 'at_unit', 'request_key'], required: ['o', 'code_in', 'at_unit', 'request_key'], uuids: ['o', 'at_unit'] },
  prize_status: { args: ['o', 'request_key'], required: ['o', 'request_key'], uuids: ['o'] },
  prize_giver_get: { args: ['o'], required: ['o'], uuids: ['o'] },
  prize_giver_set: { args: ['o', 'd'], required: ['o', 'd'], uuids: ['o'] },
  prize_terms_set: { args: ['k', 'target', 'd'], required: ['k', 'target', 'd'], uuids: ['target'] },
  prize_terms_get: { args: ['k', 'target'], required: ['k', 'target'], uuids: ['target'] },
  prize_codes_add: { args: ['k', 'target', 'codes'], required: ['k', 'target', 'codes'], uuids: ['target'] },
  prize_reverse: { args: ['o', 'event_id', 'reason'], required: ['o', 'event_id', 'reason'], uuids: ['o'], ints: ['event_id'] },
  prize_disputes: { args: ['o', 'open_only', 'before_id', 'max_rows'], required: ['o'], uuids: ['o'], ints: ['before_id', 'max_rows'] },
  prize_dispute_answer: { args: ['o', 'dispute', 'outcome', 'answer'], required: ['o', 'dispute', 'outcome', 'answer'], uuids: ['o'], ints: ['dispute'] },
  prize_fulfillment_list: { args: ['o', 'state', 'after', 'max_rows'], required: ['o'], uuids: ['o'], ints: ['max_rows'] },
  prize_fulfill: { args: ['o', 'prize', 'step'], required: ['o', 'prize', 'step'], uuids: ['o', 'prize'] },
  prize_address: { args: ['o', 'prize'], required: ['o', 'prize'], uuids: ['o', 'prize'] },
  prize_report: { args: ['o', 'from_day', 'to_day', 'unit', 'after_id', 'max_rows'], required: ['o'], uuids: ['o', 'unit'], ints: ['after_id', 'max_rows'] },
  partner_redeem_check: { args: ['o', 'code_in'], required: ['o', 'code_in'], uuids: ['o'] },
  partner_redeem_confirm: { args: ['o', 'code_in', 'request_key'], required: ['o', 'code_in', 'request_key'], uuids: ['o'] },
  partner_redeem_status: { args: ['o', 'request_key'], required: ['o', 'request_key'], uuids: ['o'] },
  // The winners' functions (the app's Prize Wallet) exist on the server too; the portal never calls them.
  prize_wallet: { args: ['filter', 'after', 'max_rows'], required: [] },
  // InneRISE administration (082): 078's prize_staff_queue, _logo and _terms for a signed-in InneRISE staff member.
  staff_prize_queue: { args: [], required: [] },
  staff_prize_logo: { args: ['o', 'approve', 'note'], required: ['o', 'approve', 'note'], uuids: ['o'] },
  staff_prize_terms: { args: ['campaign', 'approve', 'note'], required: ['campaign', 'approve', 'note'], uuids: ['campaign'] },
};
export const PRIZE_SERVICE_ROLE = ['prize_staff_queue', 'prize_staff_logo', 'prize_staff_terms', 'prize_push_work', 'prize_daily'];

const err = (code, more = {}) => ({ error: code, ...more });
const iso = (t) => new Date(t).toISOString();
const txt = (v) => (v == null ? null : String(v));
const blank = (v) => { const s = (txt(v) || '').trim(); return s || null; };
const squash = (s) => String(s ?? '').replace(/[\s-]/g, '').toUpperCase();
const hash = (s) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) % 1000003; return x; };
// The demo's rotating code: six digits that change every 30 seconds (the server's is TOTP from the prize's secret).
export const rotating = (ref, at = Date.now()) => String((hash(ref) * 7919 + Math.floor(at / 30000) * 104729) % 1000000).padStart(6, '0');
const innerFormat = (code) => /^IR1[A-HJ-NP-Z2-9]{10}[0-9]{6}$/.test(squash(code)) || /^IR[A-HJ-NP-Z2-9]{12}$/.test(squash(code));

// Sample data ----------------------------------------------------------------------------------------------------------
export function seedPrizes(db, start, refs) {
  const P = { givers: [], terms: [], codes: [], prizes: [], events: [], disputes: [], addresses: [], usage: [], storage: {},
    seq: { event: 7000, dispute: 40, code: 100, terms: 0 } };
  db.prize = P;
  if (start === 'new' || !refs) return db;
  const now = Date.now();
  const at = (days, hours = 0) => iso(now + days * DAY + hours * 36e5);
  const { ids } = refs;
  const NS = refs.northside;
  let n = 0;
  const refOf = () => { n += 1; return Array.from({ length: 10 }, (_, k) => ALPHABET[(n * 37 + k * 11 + k * k * 5) % 32]).join(''); };
  let c = 0;
  const conf = () => { c += 1; return `${Array.from({ length: 4 }, (_, k) => ALPHABET[(c * 13 + k * 7) % 32]).join('')}-${Array.from({ length: 4 }, (_, k) => ALPHABET[(c * 29 + k * 3 + 5) % 32]).join('')}`; };
  const terms = (org, target, kind, t, extra = {}) => {
    const row = { id: `7e000000-0000-4000-8000-${String(++P.seq.terms).padStart(12, '0')}`, org_id: org, reward_id: kind === 'reward' ? target : null,
      campaign_id: kind === 'campaign' ? target : null, state: 'live', review_note: null, set_by: ids.Alex, set_at: at(-30), live_at: at(-30),
      prize_type: t.prize_type, method: t.method, code_mode: t.code_mode || null, barcode: t.barcode || (t.method === 'business_code' ? 'none' : null),
      shared_code: t.shared_code || null, instructions: t.instructions || null, contact_email: t.contact_email || null,
      valid_from: t.valid_from || null, valid_until: t.valid_until || null,
      valid_days: t.valid_days ?? null, units: t.units || null, min_age: t.min_age ?? null, country: t.country || null, region: t.region || null,
      city: t.city || null, fulfillment: t.fulfillment || 'none', pickup_unit: t.pickup_unit || null, ...extra };
    P.terms.push(row);
    return row;
  };
  const snap = (t) => ({ prize_type: t.prize_type, method: t.method, code_mode: t.code_mode, barcode: t.barcode, instructions: t.instructions,
    contact_email: t.contact_email, units: t.units, min_age: t.min_age, country: t.country, region: t.region, city: t.city, fulfillment: t.fulfillment, pickup_unit: t.pickup_unit,
    valid_days: t.valid_days, valid_from: t.valid_from, valid_until: t.valid_until });
  const prize = (t, e, title, won, extra = {}) => {
    const p = { id: `7f000000-0000-4000-8000-${String(P.prizes.length + 1).padStart(12, '0')}`, ref: refOf(), org_id: t.org_id, user_id: e.user_id,
      reward_id: t.reward_id, campaign_id: t.campaign_id, earned_id: e.id, claim_id: null, title, method: t.method, terms: snap(t),
      status: 'available', starts_on: null, expires_at: t.valid_days ? iso(Date.parse(won) + t.valid_days * DAY) : null, won_at: won, used_at: null,
      manual: null, biz_code: null, fulfillment: null, fulfillment_state: ['pickup', 'delivery', 'either'].includes(t.fulfillment) ? 'waiting' : null,
      delivered_at: null, ...extra };
    p.manual = extra.manual || `IR${Array.from({ length: 12 }, (_, k) => ALPHABET[(hash(p.ref) + k * 17 + k * k) % 32]).join('')}`;
    P.prizes.push(p);
    P.events.push({ id: ++P.seq.event, prize_id: p.id, org_id: p.org_id, kind: 'won', by_user: null, unit_id: null, at: won, confirmation: null,
      request_key: null, reverses: null, reason: null, detail: null });
    return p;
  };
  const event = (p, kind, days, by, unit, more = {}) => {
    const e = { id: ++P.seq.event, prize_id: p.id, org_id: p.org_id, kind, by_user: by, unit_id: unit, at: at(days, 2), confirmation: null,
      request_key: null, reverses: null, reason: null, detail: null, ...more };
    if (kind === 'confirm' || kind === 'reverse') e.confirmation = conf();
    if (kind === 'confirm') e.detail = { answer: { ok: true, prize_ref: p.ref, title: p.title, confirmation: e.confirmation, used_at: e.at, status: 'used', via: 'manual' }, via: 'manual' };
    P.events.push(e);
    return e;
  };
  const role = (org, uid, r, u) => db.roles.push({ id: `7d000000-0000-4000-8000-${String(db.roles.length + 1).padStart(12, '0')}`, org_id: org,
    user_id: uid, role: r, unit_id: u, granted_by: ids.Alex, granted_at: at(-40) });
  const store = (path, b64) => { P.storage[path] = { type: 'image/png', size: Math.round(b64.length * 0.75), data: `data:image/png;base64,${b64}`, updated_at: at(-50) }; };

  // Northside Health: its logo shows on its prizes; two people at the front desks can redeem them.
  store(`${NS}/logo.png`, LOGO_NORTHSIDE);
  P.givers.push({ org_id: NS, logo_path: `${NS}/logo.png`, logo_state: 'shown', logo_note: null, updated_at: at(-50) });
  role(NS, ids.Omar, 'prize_redeemer', refs.riv);
  role(NS, ids.Aisha, 'prize_redeemer', DT);
  const massage = db.rewards.find((w) => w.id === MASSAGE);
  const kit = db.rewards.find((w) => w.id === KIT);
  const consult = db.rewards.find((w) => w.id === CONSULT);
  const shoes = db.rewards.find((w) => w.org_id === NS && w.title === 'Running store voucher');
  const tm = massage && terms(NS, massage.id, 'reward', { prize_type: 'service', method: 'voucher', valid_days: 90, units: [refs.riv, DT],
    instructions: 'Book a 20-minute chair massage at the front desk, and show this before it starts.' });
  const tk = kit && terms(NS, kit.id, 'reward', { prize_type: 'physical', method: 'voucher', valid_days: 60, fulfillment: 'either', pickup_unit: refs.riv,
    country: 'US', region: 'MI', instructions: 'A water bottle, a yoga strap and a step counter. Pick it up at the Riverside clinic front desk, or have it delivered in Michigan.' });
  const tc = consult && terms(NS, consult.id, 'reward', { prize_type: 'service', method: 'voucher', valid_days: 90, fulfillment: 'contact',
    contact_email: 'wellness@northsidehealth.example', instructions: 'Email the wellness team to book a 30-minute consult, in person or by video. Say which days suit you.' });
  if (shoes) {
    const ts = terms(NS, shoes.id, 'reward', { prize_type: 'discount', method: 'business_code', code_mode: 'list', barcode: 'code128', valid_days: 60,
      instructions: '20% off running shoes at Motor City Running on Woodward Avenue. Show the code at the register.' });
    ['MCR20-4471-KQ', 'MCR20-8802-TP', 'MCR20-1935-WX', 'MCR20-6620-LM', 'MCR20-3058-ZB'].forEach((code) => P.codes.push({ id: ++P.seq.code,
      org_id: NS, reward_id: ts.reward_id, campaign_id: null, code, prize_id: null, assigned_at: null, added_at: at(-7), added_by: ids.Dev }));
  }
  const won = at(-16, -6);
  const earners = (w) => db.earned.filter((e) => w && e.reward_id === w.id);
  const who = (e) => Object.keys(ids).find((k) => ids[k] === e.user_id);
  for (const e of earners(massage)) {
    const p = prize(tm, e, massage.title, won);
    if (who(e) === 'Maria') {
      // Used at Riverside, undone (the therapist was out), then used again downtown; she asked about it and was answered.
      const first = event(p, 'confirm', -6, ids.Omar, refs.riv);
      event(p, 'reverse', -5, ids.Alex, refs.riv, { reverses: first.id, reason: 'The massage was cancelled: the therapist was out sick. Booked again for Friday.' });
      const again = event(p, 'confirm', -2, ids.Aisha, DT);
      Object.assign(p, { status: 'used', used_at: again.at });
      P.disputes.push({ id: ++P.seq.dispute, prize_id: p.id, org_id: NS, user_id: e.user_id, topic: 'other',
        note: 'My massage was cancelled, but the app says my prize was used.', status: 'resolved',
        answer: 'Sorry about that. We gave the use back, so you could book again.', opened_at: at(-6, 4), answered_at: at(-5, 3) });
    }
    if (who(e) === 'Luis') p.manual = 'IR7KQM4TZPW9XC'; // the counter demo's code: IR-7KQM-4TZP-W9XC
  }
  for (const e of earners(kit)) {
    const p = prize(tk, e, kit.title, won);
    const name = who(e);
    const address = (line1, city, postal) => P.addresses.push({ prize_id: p.id, name: `${name} ${name === 'Maria' ? 'Lopez' : 'Kim'}`, line1, line2: null,
      city, region: 'MI', postal_code: postal, country: 'US', phone: '+1 313 555 0188' });
    if (name === 'Maria') { Object.assign(p, { fulfillment: 'delivery' }); address('418 Woodward Avenue, Apt 5', 'Detroit', '48226'); }
    if (name === 'Luis') {
      Object.assign(p, { fulfillment: 'pickup' });
      P.disputes.push({ id: ++P.seq.dispute, prize_id: p.id, org_id: NS, user_id: e.user_id, topic: 'not_received',
        note: 'I went to the Riverside front desk for my kit, but they didn\'t know about it.', status: 'open', answer: null, opened_at: at(-1, 2), answered_at: null });
    }
    if (name === 'Priya') { Object.assign(p, { fulfillment: 'pickup', fulfillment_state: 'ready' }); event(p, 'ready', -3, ids.Alex, refs.riv); }
    if (name === 'Chloe') { Object.assign(p, { fulfillment: 'delivery', fulfillment_state: 'shipped' }); address('77 Brush Street', 'Detroit', '48226'); event(p, 'shipped', -2, ids.Alex, refs.riv); }
    if (name === 'Sofia') {
      Object.assign(p, { fulfillment: 'delivery', fulfillment_state: 'delivered', status: 'used', delivered_at: at(-4), used_at: at(-4) });
      address('12 Brush Park Lane', 'Detroit', '48201');
      event(p, 'delivered', -4, ids.Alex, refs.riv);
    }
    if (name === 'Alex') {
      const e2 = event(p, 'confirm', -4, ids.Omar, refs.riv);
      Object.assign(p, { fulfillment: 'pickup', fulfillment_state: 'picked_up', status: 'used', used_at: e2.at });
    }
  }
  // Maria won the nutrition consult: she books it by email (the counter demo's code: IR-9NCT-4RWB-2HKM).
  for (const e of earners(consult)) prize(tc, e, consult.title, won, { manual: 'IR9NCT4RWB2HKM' });
  // ?demo=redeemer: Kim works the front desks and can redeem prizes at both places, nothing more.
  if (start === 'redeemer') { role(NS, refs.me, 'prize_redeemer', refs.riv); role(NS, refs.me, 'prize_redeemer', DT); }
  // ?demo=gymdesk: Dana works the front desk at Peak Fitness's Riverfront gym and can redeem prizes there, nothing more.
  if (start === 'gymdesk' && refs.riverfront) role(refs.peak, refs.me, 'prize_redeemer', refs.riverfront);

  // Peak Fitness (verified, ?demo=sponsor and ?demo=counter): its logo and one offer's new terms wait for InneRISE.
  const PK = refs.peak;
  if (refs.sponsor) {
    store(`${PK}/logo.png`, LOGO_PEAK);
    P.givers.push({ org_id: PK, logo_path: `${PK}/logo.png`, logo_state: 'waiting', logo_note: null, updated_at: at(-1) });
    const pp = (db.pprofiles || []).find((x) => x.org_id === PK);
    if (pp) pp.logo_path = `${PK}/logo.png`;
    terms(PK, PEAK_CP(304), 'campaign', { prize_type: 'service', method: 'voucher', valid_days: 30,
      instructions: 'One free class at any Peak Fitness studio. Show this at the front desk before class.' });
    terms(PK, PEAK_CP(306), 'campaign', { prize_type: 'free_item', method: 'business_code', code_mode: 'shared', barcode: 'upca',
      shared_code: '012345678905', instructions: 'Two smoothies for the price of one at the studio café.' }, { state: 'waiting', live_at: null, set_at: at(-1) });
    terms(PK, PEAK_CP(305), 'campaign', { prize_type: 'discount', method: 'voucher', instructions: '20% off.' },
      { state: 'rejected', live_at: null, set_at: at(-4), review_note: 'Say which packs the 20% covers in the instructions, then send it again.' });
  }
  // 074's partner codes already used get the confirmation numbers 074 gives every use.
  for (const r of db.predeem || []) if (!r.confirmation) { r.confirmation = conf(); r.request_key = null; }
  // On the server events are numbered as they happen: number the sample ones by time too (the report pages by number).
  const byTime = [...P.events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id));
  const renumber = new Map(byTime.map((e, i) => [e.id, 7001 + i]));
  for (const e of P.events) { e.id = renumber.get(e.id); if (e.reverses) e.reverses = renumber.get(e.reverses); }
  P.events.sort((a, b) => a.id - b.id);
  P.seq.event = 7000 + P.events.length;
  return db;
}

// The functions -------------------------------------------------------------------------------------------------------
export function prizeFunctions(h) {
  const D = () => h.db();
  const P = () => h.db().prize;
  const tzOf = (o) => (h.org(o) || {}).time_zone || 'UTC';
  const today = (o) => dayIn(tzOf(o));
  const unitIn = (o, u) => { const x = h.unitOf(u); return !!x && x.org_id === o; };
  const canRedeem = (o, uid, u) => !!uid && h.hasRole(o, uid, ['rewards_manager', 'prize_redeemer'], u);
  const manager = (o, uid, u = null) => !!uid && h.hasRole(o, uid, ['rewards_manager'], u);
  const staffAny = (o, uid) => D().roles.some((r) => r.org_id === o && r.user_id === uid && ['admin', 'rewards_manager', 'prize_redeemer'].includes(r.role)
    && h.hasRole(o, uid, ['rewards_manager', 'prize_redeemer'], r.unit_id));
  const isAdmin = (o, uid) => !!uid && h.hasRole(o, uid, ['admin']);
  const nameOf = (uid) => (uid && D().users[uid] && String(D().users[uid].first_name || '').trim()) || null;
  const minor = (uid) => !!(D().users[uid] && D().users[uid].child)
    || D().members.some((m) => m.user_id === uid && ['active', 'pending'].includes(m.status) && ['teen', 'under13'].includes(m.age_band));
  const consent = (o, uid, k) => { const rows = D().consents.filter((x) => x.org_id === o && x.user_id === uid && x.kind === k); return rows.length ? rows[rows.length - 1].granted : null; };
  // The winner's first name, as 072 and 074 allow: an adult who shares their results (072) or chose to share it (074).
  const firstName = (p) => {
    if (minor(p.user_id)) return null;
    if (p.reward_id && !p.campaign_id) return consent(p.org_id, p.user_id, 'manager_reporting') ? nameOf(p.user_id) : null;
    const claim = p.claim_id ? D().pclaims.find((k) => k.id === p.claim_id) : null;
    return claim && claim.share_first_name ? nameOf(p.user_id) : null;
  };
  const usableStatus = (p) => (p.status === 'available' && p.expires_at && Date.parse(p.expires_at) <= Date.now() ? 'expired' : p.status);
  const giverOf = (o) => {
    const g = h.org(o);
    const pg = P().givers.find((x) => x.org_id === o);
    return { id: o, name: g.name, kind: g.kind, website: g.website || null, city: g.city || null, region: g.region || null, country: g.country || null,
      logo_path: pg && pg.logo_state === 'shown' ? pg.logo_path : null };
  };
  const card = (p) => {
    const t = p.terms;
    const pick = t.pickup_unit ? h.unitOf(t.pickup_unit) : null;
    return {
      id: p.id, ref: p.ref, title: p.title, status: usableStatus(p), method: p.method, prize_type: t.prize_type,
      label: p.method === 'voucher' ? LABEL : null, instructions: t.instructions || null, contact_email: t.contact_email || null,
      starts_on: p.starts_on, expires_at: p.expires_at,
      won_at: p.won_at, used_at: p.used_at, min_age: t.min_age ?? null,
      area: t.country ? { country: t.country, region: t.region, city: t.city } : null,
      // 'contact' (email the business to claim): no choice and no state; the card shows contact_email.
      fulfillment: t.fulfillment && t.fulfillment !== 'none' ? { offered: t.fulfillment, choice: t.fulfillment === 'contact' ? null : p.fulfillment,
        state: t.fulfillment === 'contact' ? null : p.fulfillment_state, pickup_at: pick ? { id: pick.id, name: pick.name, street: pick.street, city: pick.city, region: pick.region, postal_code: pick.postal_code, country: pick.country } : null,
        has_address: P().addresses.some((a) => a.prize_id === p.id) } : null,
      locations: { all: !Array.isArray(t.units), count: Array.isArray(t.units) ? t.units.length : D().units.filter((u) => u.org_id === p.org_id && u.city).length },
      giver: giverOf(p.org_id),
      business_code_waiting: p.method === 'business_code' && !p.biz_code,
      open_dispute: P().disputes.some((d) => d.prize_id === p.id && d.status === 'open'),
    };
  };
  const counterCard = (p) => { const x = card(p); delete x.id; delete x.giver; return x; };
  const blocker = (p, u) => {
    const s = usableStatus(p);
    if (s === 'void' || s === 'used' || s === 'expired') return s;
    if (p.starts_on && p.starts_on > today(p.org_id)) return 'not_yet';
    if (p.fulfillment === 'delivery') return 'delivery';
    if (p.method === 'business_code' && !p.biz_code) return 'no_code';
    const places = p.terms.pickup_unit ? [p.terms.pickup_unit] : p.terms.units;
    if (Array.isArray(places) && !(u && h.chain(u).some((x) => places.includes(x)))) return 'location';
    return null;
  };
  const usage = (uid, o) => {
    const day = today(o);
    let x = P().usage.find((r) => r.user_id === uid && r.org_id === o && r.day === day);
    if (!x) { x = { user_id: uid, org_id: o, day, tries: 0, misses: 0 }; P().usage.push(x); }
    return x;
  };
  const tryOne = (uid, o) => { const x = usage(uid, o); x.tries += 1; return x.tries <= 5000 && x.misses < 30; };
  const miss = (uid, o) => { usage(uid, o).misses += 1; };
  const newConf = (o) => {
    for (;;) {
      const c = Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * 32)]).join('');
      const x = `${c.slice(0, 4)}-${c.slice(4)}`;
      if (!P().events.some((e) => e.org_id === o && e.confirmation === x) && !(D().predeem || []).some((r) => r.org_id === o && r.confirmation === x)) return x;
    }
  };
  // The prize behind a 072 or 074 reward code given with it.
  const ofRewardCode = (o, code) => {
    const x = String(code ?? '').trim().toUpperCase();
    const pc = (D().pcodes || []).find((y) => y.org_id === o && y.code.toUpperCase() === x && y.claim_id);
    if (pc) { const p = P().prizes.find((z) => z.claim_id === pc.claim_id); if (p) return p; }
    const rc = (D().rcodes || []).find((y) => y.code.toUpperCase() === x && y.earned_id && (D().rewards.find((w) => w.id === y.reward_id) || {}).org_id === o);
    return rc ? P().prizes.find((z) => z.earned_id === rc.earned_id && z.org_id === o) || null : null;
  };
  // prize_find: the QR or barcode payload, the manual code, a business code on a list, a shared code, a reward code.
  const find = (o, code, strict) => {
    const raw = String(code ?? '').trim();
    const x = squash(raw);
    if (!x) return err('not_valid');
    const m = x.match(/^IR1([A-HJ-NP-Z2-9]{10})([0-9]{6})$/);
    if (m) {
      const p = P().prizes.find((z) => z.ref === m[1]);
      if (!p || p.org_id !== o) return err('not_valid');
      if (strict && ![-2, -1, 0, 1, 2].some((d) => rotating(p.ref, Date.now() + d * 30000) === m[2])) return err('code_expired');
      return { prize: p, via: 'qr' };
    }
    if (/^IR[A-HJ-NP-Z2-9]{12}$/.test(x)) {
      const p = P().prizes.find((z) => z.org_id === o && z.manual === x);
      return p ? { prize: p, via: 'manual' } : err('not_valid');
    }
    const lc = P().codes.find((y) => y.org_id === o && y.code.toUpperCase() === raw.toUpperCase());
    if (lc) {
      const p = lc.prize_id ? P().prizes.find((z) => z.id === lc.prize_id) : null;
      return p ? { prize: p, via: 'business_code' } : err('not_valid');
    }
    if (P().terms.some((t) => t.org_id === o && t.shared_code && t.shared_code.toUpperCase() === raw.toUpperCase())) return err('shared_code');
    const p = ofRewardCode(o, raw);
    return p ? { prize: p, via: 'reward_code' } : err('not_valid');
  };
  const again = (o, k, p) => {
    const e = P().events.find((x) => x.org_id === o && x.request_key === k);
    if (!e) return null;
    if (p && e.prize_id !== p.id) return err('request_key');
    return { ...e.detail.answer, first_name: firstName(P().prizes.find((z) => z.id === e.prize_id)) };
  };
  const checkCore = (o, uid, p, u, via) => {
    const why = blocker(p, u);
    P().events.push({ id: ++P().seq.event, prize_id: p.id, org_id: o, kind: 'check', by_user: uid, unit_id: u, at: iso(Date.now()),
      confirmation: null, request_key: null, reverses: null, reason: null, detail: { via, ready: why == null, reason: why } });
    return { ok: true, ready: why == null, reason: why, via, first_name: firstName(p), prize: counterCard(p) };
  };
  const confirmCore = (o, uid, p, u, k, via) => {
    const a = again(o, k, p);
    if (a) return a;
    if ((D().predeem || []).some((r) => r.org_id === o && r.request_key === k)) return err('request_key');
    const why = blocker(p, u);
    if (why) return err(why, { prize: counterCard(p) });
    const first = !P().events.some((e) => e.prize_id === p.id && e.kind === 'confirm');
    const c = newConf(o);
    const when = iso(Date.now());
    const answer = { ok: true, prize_ref: p.ref, title: p.title, confirmation: c, used_at: when, status: 'used', via };
    Object.assign(p, { status: 'used', used_at: when });
    if (['pickup', 'either'].includes(p.terms.fulfillment)) Object.assign(p, { fulfillment: 'pickup', fulfillment_state: 'picked_up' });
    P().events.push({ id: ++P().seq.event, prize_id: p.id, org_id: o, kind: 'confirm', by_user: uid, unit_id: u, at: when, confirmation: c,
      request_key: k, reverses: null, reason: null, detail: { answer, via } });
    // A partner's prize also marks its 074 code used, the first time.
    if (first && p.campaign_id) {
      const pc = p.claim_id ? (D().pcodes || []).find((y) => y.claim_id === p.claim_id) : null;
      if (pc && !D().predeem.some((r) => r.offer_code === pc.id)) {
        D().predeem.push({ id: ++D().seq.redeem, org_id: o, campaign_id: p.campaign_id, offer_code: pc.id, reward_code: null, redeemed_at: when,
          redeemed_by: uid, confirmation: c, request_key: k });
      }
    }
    return { ...answer, first_name: firstName(p) };
  };
  // prize_target: the 072 reward or 074 offer or achievement reward that terms and codes belong to, and whether I may.
  const target = (k, id, uid) => {
    if (k === 'reward') {
      const w = D().rewards.find((x) => x.id === id);
      const c = w && D().challenges.find((x) => x.id === w.challenge_id);
      const coord = c && h.hasRole(c.org_id, uid, ['challenge_coordinator', 'unit_manager', 'teacher'], c.unit_id);
      const ok = !!uid && !!c && (h.org(c.org_id) || {}).kind !== 'partner'
        && (h.hasRole(c.org_id, uid, ['rewards_manager'], c.unit_id) || (c.created_by === uid && coord));
      if (!ok) return err('not_allowed');
      if (D().campaigns.some((p) => p.reward_id === w.id)) return err('partner_reward');
      return { org: w.org_id, awarded: !!w.awarded_at, approved: !!w.approved_at, row: w };
    }
    if (k === 'campaign') {
      const c = D().campaigns.find((x) => x.id === id);
      if (!c || c.kind !== 'reward_offer' || !(h.org(c.org_id) && h.hasRole(c.org_id, uid, ['rewards_manager']))) return err('not_allowed');
      return { org: c.org_id, status: c.status, row: c };
    }
    return err('kind');
  };
  const termsOf = (id) => P().terms.filter((t) => t.reward_id === id || t.campaign_id === id);
  const termsJson = (t) => ({ prize_type: t.prize_type, method: t.method, code_mode: t.code_mode, barcode: t.barcode, instructions: t.instructions,
    contact_email: t.contact_email || null, valid_from: t.valid_from, valid_until: t.valid_until, valid_days: t.valid_days, units: Array.isArray(t.units) ? [...t.units].sort() : null,
    min_age: t.min_age, country: t.country, region: t.region, city: t.city, fulfillment: t.fulfillment, pickup_unit: t.pickup_unit });
  const waitingFor = (id) => P().prizes.filter((p) => (p.campaign_id || p.reward_id) === id && p.method === 'business_code' && !p.biz_code
    && p.status === 'available').length;
  const assign = (id) => {
    const waiting = P().prizes.filter((p) => (p.campaign_id || p.reward_id) === id && p.method === 'business_code' && !p.biz_code && p.status === 'available')
      .sort((a, b) => (a.won_at < b.won_at ? -1 : 1));
    const free = P().codes.filter((y) => (y.reward_id === id || y.campaign_id === id) && !y.assigned_at).sort((a, b) => a.id - b.id);
    waiting.forEach((p, i) => { if (free[i]) { p.biz_code = free[i].code; free[i].prize_id = p.id; free[i].assigned_at = iso(Date.now()); } });
  };
  const log = (o, what) => { void o; void what; }; // the server writes org_log; nothing to keep here
  const intOr = (v, d) => (v == null ? d : Math.trunc(Number(v)));

  const fns = {
    // The place picker (gaps round): every unit where I may check and confirm, by name (all of them for the whole giver;
    // otherwise the units I hold the role for and the units under them), each with its parent unit's id and name (null at the top).
    prize_staff_places({ o }) {
      const uid = h.me();
      if (!uid) return null;
      const units = D().units.filter((u) => u.org_id === o && canRedeem(o, uid, u.id))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1));
      const above = (u) => D().units.find((x) => x.id === u.parent_id && x.org_id === o) || null;
      return { whole_org: canRedeem(o, uid, null), manager: manager(o, uid),
        units: units.map((u) => ({ id: u.id, name: u.name, kind: u.kind, parent_id: above(u) ? above(u).id : null, parent_name: above(u) ? above(u).name : null })) };
    },

    prize_check({ o, code_in, at_unit = null }) {
      const uid = h.me();
      if (at_unit != null && !unitIn(o, at_unit)) return err('unit');
      if (!canRedeem(o, uid, at_unit)) return err('not_allowed');
      if (!tryOne(uid, o)) return err('rate_limited');
      const f = find(o, code_in, true);
      if (f.error) { if (['not_valid', 'code_expired'].includes(f.error)) miss(uid, o); return f; }
      return checkCore(o, uid, f.prize, at_unit, f.via);
    },

    // One confirm, one use: no amount (the money-free contract's four arguments).
    prize_confirm({ o, code_in, at_unit, request_key }) {
      const uid = h.me();
      const k = String(request_key ?? '').trim();
      if (!KEY.test(k)) return err('request_key');
      if (at_unit != null && !unitIn(o, at_unit)) return err('unit');
      if (!canRedeem(o, uid, at_unit)) return err('not_allowed');
      const loose = find(o, code_in, false);
      const a = again(o, k, loose.prize || null);
      if (a) return a;
      if (!tryOne(uid, o)) return err('rate_limited');
      const f = find(o, code_in, true);
      if (f.error) { if (['not_valid', 'code_expired'].includes(f.error)) miss(uid, o); return f; }
      return confirmCore(o, uid, f.prize, at_unit, k, f.via);
    },

    prize_status({ o, request_key }) {
      const uid = h.me();
      const k = String(request_key ?? '').trim();
      const e = P().events.find((x) => x.org_id === o && x.request_key === k);
      if (!e) return staffAny(o, uid) ? err('not_found') : err('not_allowed');
      if (!(e.by_user === uid || canRedeem(o, uid, e.unit_id))) return err('not_allowed');
      return again(o, k, null);
    },

    // The logo and its review (gaps round): administrators and rewards managers, for the whole giver or a place. Reads only.
    prize_giver_get({ o }) {
      const uid = h.me();
      if (!D().roles.some((r) => r.org_id === o && r.user_id === uid && ['admin', 'rewards_manager'].includes(r.role) && manager(o, uid, r.unit_id))) {
        return err('not_allowed');
      }
      const pg = P().givers.find((x) => x.org_id === o) || {};
      return { ok: true, logo_path: pg.logo_path || null, logo_state: pg.logo_state || null, review_note: pg.logo_note || null };
    },

    prize_giver_set({ o, d }) {
      const uid = h.me();
      if (d == null || typeof d !== 'object' || Array.isArray(d)) return err('details');
      if (!isAdmin(o, uid)) return err('not_allowed');
      const lg = blank(d.logo_path);
      if (lg != null && (lg.length > 200 || !lg.startsWith(`${o}/`) || /(\.\.|\/\/)/.test(lg) || !P().storage[lg])) return err('logo_path');
      const g = h.org(o);
      let pg = P().givers.find((x) => x.org_id === o);
      if (!pg) { pg = { org_id: o, logo_path: null, logo_state: null, logo_note: null }; P().givers.push(pg); }
      if (g.kind === 'partner') {
        // A partner's logo is its partner profile's, and waits for InneRISE's review.
        const pp = (D().pprofiles || []).find((x) => x.org_id === o);
        if (pp) pp.logo_path = lg;
        Object.assign(pg, { logo_path: lg, logo_state: lg ? 'waiting' : null, logo_note: null, updated_at: iso(Date.now()) });
      } else {
        Object.assign(pg, { logo_path: lg, logo_state: lg ? 'shown' : null, logo_note: null, updated_at: iso(Date.now()) });
      }
      log(o, 'prize_logo_changed');
      return { ok: true, logo_state: pg.logo_state };
    },

    prize_terms_set({ k, target: id, d }) {
      const uid = h.me();
      const tg = target(k, id, uid);
      if (tg.error) return tg;
      const o = tg.org;
      if (k === 'reward' && tg.awarded) return err('earned');
      if (k === 'campaign' && tg.status === 'withdrawn') return err('not_open');
      if (d == null) {
        P().terms = P().terms.filter((t) => t.reward_id !== id && t.campaign_id !== id);
        if (k === 'reward' && tg.approved) Object.assign(tg.row, { approved_at: null, approved_by: null });
        return { ok: true, state: null, needs_approval: k === 'reward' && tg.approved };
      }
      if (typeof d !== 'object' || Array.isArray(d)) return err('details');
      if (!sponsorTermsOk(D(), o)) return err('sponsor_terms');
      if (MONEY_KEYS.some((x) => x in d)) return err('invalid');
      const pt = txt(d.prize_type);
      const mt = txt(d.method) || 'voucher';
      const cm = txt(d.code_mode);
      const bc = txt(d.barcode) || (mt === 'business_code' ? 'none' : null);
      const sc = blank(d.shared_code);
      const ins = blank(d.instructions);
      const em = blank(d.contact_email);
      const day = (v) => (v == null || v === '' ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : undefined);
      const vf = day(d.valid_from);
      const vu = day(d.valid_until);
      const vd = d.valid_days == null || d.valid_days === '' ? null : Number(d.valid_days);
      const ma = d.min_age == null || d.min_age === '' ? null : Number(d.min_age);
      const co = blank(d.country) ? blank(d.country).toUpperCase() : null;
      const rg = blank(d.region);
      const ct = blank(d.city);
      const fu = txt(d.fulfillment) || 'none';
      const pu = blank(d.pickup_unit);
      if (vf === undefined || vu === undefined || (vd != null && !Number.isInteger(vd)) || (ma != null && !Number.isInteger(ma))) return err('invalid');
      let units = null;
      if (d.locations == null || d.locations === 'all') units = null;
      else if (Array.isArray(d.locations)) units = [...new Set(d.locations.map(String))];
      else return err('locations');
      if (!TYPES.includes(pt)) return err('prize_type');
      if (!['voucher', 'business_code'].includes(mt) || (mt === 'voucher' && (cm != null || 'barcode' in d || sc != null))) return err('method');
      if (mt === 'business_code') {
        if (!['shared', 'list'].includes(cm)) return err('code_mode');
        if (!BARCODES.includes(bc)) return err('barcode');
        if ((cm === 'shared') !== (sc != null) || (sc && sc.length > 200)) return err('shared_code');
        if (sc && innerFormat(sc)) return err('voucher_format');
        if (sc && P().codes.some((y) => y.org_id === o && y.code.toUpperCase() === sc.toUpperCase())) return err('shared_code');
      }
      if (ins && ins.length > 1000) return err('instructions');
      if (em != null && (em.length > 254 || !EMAIL.test(em))) return err('contact_email');
      if ((vu && vd != null) || (vd != null && vd < 1) || (vf && vu && vf > vu) || (vu && vu < today(o))) return err('valid');
      if (ma != null && ![18, 21].includes(ma)) return err('min_age');
      if ((co && !/^[A-Z]{2}$/.test(co)) || ((rg || ct) && !co) || (rg && rg.length > 100) || (ct && ct.length > 100)) return err('area');
      if (!FULFILLMENTS.includes(fu)) return err('fulfillment');
      if (fu === 'contact' && em == null) return err('contact_email');
      if (pu && (!['pickup', 'either'].includes(fu) || !unitIn(o, pu))) return err('pickup_unit');
      if (units && (!units.length || units.some((u) => !unitIn(o, u)))) return err('locations');
      const st = k === 'reward' ? 'live' : 'waiting';
      if (k === 'reward') P().terms = P().terms.filter((t) => t.reward_id !== id);
      else P().terms = P().terms.filter((t) => !(t.campaign_id === id && t.state !== 'live'));
      const now = iso(Date.now());
      P().terms.push({ id: `7e000000-0000-4000-8000-${String(++P().seq.terms).padStart(12, '0')}`, org_id: o, reward_id: k === 'reward' ? id : null,
        campaign_id: k === 'campaign' ? id : null, state: st, review_note: null, set_by: uid, set_at: now, live_at: st === 'live' ? now : null,
        prize_type: pt, method: mt, code_mode: mt === 'business_code' ? cm : null, barcode: mt === 'business_code' ? bc : null, shared_code: sc,
        instructions: ins, contact_email: em, valid_from: vf, valid_until: vu, valid_days: vd, units, min_age: ma, country: co, region: rg, city: ct, fulfillment: fu, pickup_unit: pu });
      if (k === 'reward' && tg.approved) Object.assign(tg.row, { approved_at: null, approved_by: null });
      return { ok: true, state: st, needs_approval: k === 'reward' && tg.approved };
    },

    prize_terms_get({ k, target: id }) {
      const tg = target(k, id, h.me());
      if (tg.error) return tg;
      const live = termsOf(id).find((t) => t.state === 'live');
      const next = termsOf(id).find((t) => t.campaign_id === id && t.state !== 'live');
      const codes = P().codes.filter((y) => y.reward_id === id || y.campaign_id === id);
      return { ok: true,
        live: live ? { ...termsJson(live), shared_code_set: !!live.shared_code, live_at: live.live_at } : null,
        next: next ? { ...termsJson(next), state: next.state, review_note: next.review_note, shared_code_set: !!next.shared_code, set_at: next.set_at } : null,
        codes: codes.length, codes_left: codes.filter((y) => !y.assigned_at).length, waiting_for_code: waitingFor(id) };
    },

    prize_codes_add({ k, target: id, codes }) {
      const uid = h.me();
      const tg = target(k, id, uid);
      if (tg.error) return tg;
      const o = tg.org;
      if (!Array.isArray(codes) || !codes.length) return err('codes');
      if (!termsOf(id).some((t) => t.code_mode === 'list')) return err('not_list');
      const have = new Set(P().codes.filter((y) => y.org_id === o).map((y) => y.code.toUpperCase()));
      const shared = new Set(P().terms.filter((t) => t.org_id === o && t.shared_code).map((t) => t.shared_code.toUpperCase()));
      let added = 0;
      for (const c0 of codes) {
        const c = String(c0 ?? '').trim();
        if (c.length < 1 || c.length > 200 || innerFormat(c) || have.has(c.toUpperCase()) || shared.has(c.toUpperCase())) continue;
        have.add(c.toUpperCase());
        P().codes.push({ id: ++P().seq.code, org_id: o, reward_id: k === 'reward' ? id : null, campaign_id: k === 'campaign' ? id : null, code: c,
          prize_id: null, assigned_at: null, added_at: iso(Date.now()), added_by: uid });
        added += 1;
      }
      assign(id);
      return { ok: true, added, skipped: codes.length - added, waiting_for_code: waitingFor(id) };
    },

    prize_reverse({ o, event_id, reason }) {
      const uid = h.me();
      const r = blank(reason);
      const e = P().events.find((x) => x.id === Number(event_id) && x.org_id === o && x.kind === 'confirm');
      if (!e) return manager(o, uid) ? err('not_found') : err('not_allowed');
      if (!manager(o, uid, e.unit_id)) return err('not_allowed');
      if (!r || r.length > 500) return err('reason');
      if (P().events.some((x) => x.reverses === e.id)) return err('already_reversed');
      const p = P().prizes.find((z) => z.id === e.prize_id);
      const st = p.status === 'void' ? 'void' : p.expires_at && Date.parse(p.expires_at) <= Date.now() ? 'expired' : 'available';
      Object.assign(p, { status: st, used_at: null, fulfillment_state: p.fulfillment_state === 'picked_up' ? 'waiting' : p.fulfillment_state });
      const c = newConf(o);
      P().events.push({ id: ++P().seq.event, prize_id: p.id, org_id: o, kind: 'reverse', by_user: uid, unit_id: e.unit_id, at: iso(Date.now()),
        confirmation: c, request_key: null, reverses: e.id, reason: r, detail: null });
      if (p.campaign_id) D().predeem = D().predeem.filter((x) => !(x.org_id === o && x.confirmation === e.confirmation));
      return { ok: true, confirmation: c, reversed: e.confirmation, status: st };
    },

    prize_disputes({ o, open_only = true, before_id = null, max_rows = 50 }) {
      if (!manager(o, h.me())) return err('not_allowed');
      const lim = Math.max(1, Math.min(intOr(max_rows, 50), 500));
      const rows = P().disputes.filter((x) => x.org_id === o && (open_only === false || x.status === 'open') && (before_id == null || x.id < Number(before_id)))
        .sort((a, b) => b.id - a.id).slice(0, lim).map((x) => {
          const p = P().prizes.find((z) => z.id === x.prize_id);
          return { id: x.id, prize_ref: p.ref, title: p.title, topic: x.topic, note: x.note, status: x.status, answer: x.answer, opened_at: x.opened_at,
            answered_at: x.answered_at, first_name: firstName(p),
            uses: P().events.filter((e) => e.prize_id === p.id && ['confirm', 'reverse', 'delivered'].includes(e.kind)).sort((a, b) => a.id - b.id)
              .map((e) => ({ event_id: e.id, kind: e.kind, at: e.at, confirmation: e.confirmation, place: e.unit_id ? (h.unitOf(e.unit_id) || {}).name || null : null })) };
        });
      return { disputes: rows, next_before: rows.length === lim ? rows[rows.length - 1].id : null };
    },

    prize_dispute_answer({ o, dispute, outcome, answer }) {
      const uid = h.me();
      const a = blank(answer);
      if (!manager(o, uid)) return err('not_allowed');
      const x = P().disputes.find((y) => y.id === Number(dispute) && y.org_id === o);
      if (!x) return err('not_found');
      if (x.status !== 'open') return err('closed');
      if (!['resolved', 'declined'].includes(outcome)) return err('outcome');
      if (!a || a.length > 500) return err('answer');
      Object.assign(x, { status: outcome, answer: a, answered_by: uid, answered_at: iso(Date.now()) });
      P().events.push({ id: ++P().seq.event, prize_id: x.prize_id, org_id: o, kind: 'dispute_closed', by_user: uid, unit_id: null, at: iso(Date.now()),
        confirmation: null, request_key: null, reverses: null, reason: null, detail: { dispute: x.id, outcome } });
      return { ok: true };
    },

    prize_fulfillment_list({ o, state = null, after = null, max_rows = 100 }) {
      if (!manager(o, h.me())) return err('not_allowed');
      if (state != null && !['waiting', 'ready', 'shipped'].includes(state)) return err('state');
      if (after != null && (typeof after !== 'object' || !after.won_at || !after.id)) return err('after');
      const lim = Math.max(1, Math.min(intOr(max_rows, 100), 500));
      const key = (p) => `${p.won_at}|${p.id}`;
      const rows = P().prizes.filter((p) => p.org_id === o && ['waiting', 'ready', 'shipped'].includes(p.fulfillment_state)
        && (state == null || p.fulfillment_state === state) && p.status === 'available' && (!after || key(p) > `${after.won_at}|${after.id}`))
        .sort((a, b) => (key(a) < key(b) ? -1 : 1)).slice(0, lim)
        .map((p) => ({ id: p.id, ref: p.ref, title: p.title, won_at: p.won_at, offered: p.terms.fulfillment, choice: p.fulfillment, state: p.fulfillment_state,
          has_address: P().addresses.some((a) => a.prize_id === p.id), first_name: firstName(p) }));
      return { prizes: rows, next: rows.length === lim ? { won_at: rows[rows.length - 1].won_at, id: rows[rows.length - 1].id } : null };
    },

    prize_fulfill({ o, prize, step }) {
      const uid = h.me();
      const p = P().prizes.find((z) => z.id === prize && z.org_id === o);
      if (!p) return manager(o, uid) ? err('not_found') : err('not_allowed');
      if (!manager(o, uid, p.terms.pickup_unit)) return err('not_allowed');
      if (!['ready', 'shipped', 'delivered'].includes(step)) return err('step');
      const ok = p.status === 'available' && !(p.expires_at && Date.parse(p.expires_at) <= Date.now())
        && ((step === 'ready' && (p.fulfillment || 'pickup') === 'pickup' && ['pickup', 'either'].includes(p.terms.fulfillment) && p.fulfillment_state === 'waiting')
          || (step === 'shipped' && p.fulfillment === 'delivery' && p.fulfillment_state === 'waiting')
          || (step === 'delivered' && p.fulfillment === 'delivery' && ['waiting', 'shipped'].includes(p.fulfillment_state)));
      if (!ok) return err('state');
      const now = iso(Date.now());
      p.fulfillment_state = step;
      if (step === 'delivered') Object.assign(p, { status: 'used', used_at: now, delivered_at: now });
      P().events.push({ id: ++P().seq.event, prize_id: p.id, org_id: o, kind: step, by_user: uid, unit_id: p.terms.pickup_unit, at: now,
        confirmation: null, request_key: null, reverses: null, reason: null, detail: null });
      return { ok: true, state: step };
    },

    prize_address({ o, prize }) {
      if (!manager(o, h.me())) return err('not_allowed');
      const p = P().prizes.find((z) => z.id === prize && z.org_id === o && z.fulfillment === 'delivery');
      const a = p && P().addresses.find((x) => x.prize_id === p.id);
      if (!a) return err('not_found');
      P().addressViews = (P().addressViews || 0) + 1; // logged on the server (prize_address_viewed)
      return { ok: true, name: a.name, line1: a.line1, line2: a.line2, city: a.city, region: a.region, postal_code: a.postal_code, country: a.country, phone: a.phone };
    },

    prize_report({ o, from_day = null, to_day = null, unit = null, after_id = null, max_rows = 500 }) {
      const uid = h.me();
      if (unit != null && !unitIn(o, unit)) return err('unit');
      if (!manager(o, uid, unit)) return err('not_allowed');
      const tz = tzOf(o);
      const g = h.org(o);
      const lim = Math.max(1, Math.min(intOr(max_rows, 500), 5000));
      const dayOf = (t) => dayIn(tz, 0, Date.parse(t));
      const inRange = (t) => (from_day == null || dayOf(t) >= from_day) && (to_day == null || dayOf(t) <= to_day);
      const tree = unit ? (() => { const out = [unit]; for (let i = 0; i < out.length; i++) D().units.filter((x) => x.parent_id === out[i]).forEach((x) => out.push(x.id)); return out; })() : null;
      const inUnit = (e) => !tree || tree.includes(e.unit_id);
      const uses = P().events.filter((e) => e.org_id === o && ['confirm', 'reverse'].includes(e.kind) && inRange(e.at) && inUnit(e));
      const rows = uses.filter((e) => after_id == null || e.id > Number(after_id)).sort((a, b) => a.id - b.id).slice(0, lim).map((e) => {
        const p = P().prizes.find((z) => z.id === e.prize_id);
        const back = e.reverses ? P().events.find((x) => x.id === e.reverses) : null;
        return { event_id: e.id, at: e.at, day: dayOf(e.at), kind: e.kind, confirmation: e.confirmation, reverses: back ? back.confirmation : null,
          prize_ref: p.ref, title: p.title, prize_type: p.terms.prize_type, method: p.method, place: e.unit_id ? (h.unitOf(e.unit_id) || {}).name || null : null,
          place_id: e.unit_id, employee: nameOf(e.by_user), reason: e.reason, winner: firstName(p) };
      });
      const won = P().prizes.filter((p) => p.org_id === o && inRange(p.won_at)).length;
      const floor = g.min_report_group;
      return {
        columns: ['event_id', 'at', 'day', 'kind', 'confirmation', 'reverses', 'prize_ref', 'title', 'prize_type', 'method', 'place', 'place_id', 'employee', 'reason', 'winner'],
        rows, next_after: rows.length === lim ? rows[rows.length - 1].event_id : null, min_group: floor,
        totals: after_id == null ? { won: won === 0 ? 0 : won < floor ? `fewer than ${floor}` : won, uses: uses.filter((e) => e.kind === 'confirm').length,
          reversals: uses.filter((e) => e.kind === 'reverse').length } : null,
      };
    },

    // 074's counter, two steps (prize round). A code that belongs to a prize answers as the prize's own functions.
    partner_redeem_check({ o, code_in }) {
      const uid = h.me();
      if (!partnerCan(o, uid)) return err('not_allowed');
      const u = pusage(uid, o);
      if (u.redeem_misses >= 30) return err('rate_limited');
      u.redeem_tries += 1;
      if (u.redeem_tries > 5000) return err('rate_limited');
      const p = ofRewardCode(o, code_in);
      if (p) {
        const a = checkCore(o, uid, p, null, 'reward_code');
        return { ...a, status: a.reason || 'ready', title: p.title };
      }
      const f = partnerFind(o, code_in);
      if (!f) { u.redeem_misses += 1; return err('not_valid'); }
      if (f.used) { u.redeem_misses += 1; return err('already_redeemed', { confirmation: f.used.confirmation, redeemed_on: dayIn(tzOf(o), 0, Date.parse(f.used.redeemed_at)) }); }
      return { ok: true, status: 'ready', title: f.title, first_name: f.first_name };
    },

    partner_redeem_confirm({ o, code_in, request_key }) {
      const uid = h.me();
      const k = String(request_key ?? '').trim();
      if (!KEY.test(k)) return err('request_key');
      if (!partnerCan(o, uid)) return err('not_allowed');
      const p = ofRewardCode(o, code_in);
      if (p) { const a = again(o, k, p); if (a) return a; }
      const before = partnerAgain(o, k, code_in);
      if (before) return before;
      if (!p && P().events.some((e) => e.org_id === o && e.request_key === k)) return err('request_key');
      const u = pusage(uid, o);
      if (u.redeem_misses >= 30) return err('rate_limited');
      u.redeem_tries += 1;
      if (u.redeem_tries > 5000) return err('rate_limited');
      if (p) return confirmCore(o, uid, p, null, k, 'reward_code');
      const f = partnerFind(o, code_in);
      if (!f) { u.redeem_misses += 1; return err('not_valid'); }
      if (f.used) { u.redeem_misses += 1; return err('already_redeemed', { confirmation: f.used.confirmation, redeemed_on: dayIn(tzOf(o), 0, Date.parse(f.used.redeemed_at)) }); }
      const c = newConf(o);
      D().predeem.push({ id: ++D().seq.redeem, org_id: o, campaign_id: f.campaign, offer_code: f.offer_code, reward_code: f.reward_code,
        redeemed_at: iso(Date.now()), redeemed_by: uid, confirmation: c, request_key: k });
      const day = dayIn(tzOf(o));
      let s = D().pstats.find((y) => y.campaign_id === f.campaign && y.day === day);
      if (!s) { s = { campaign_id: f.campaign, day, views: 0, opens: 0, claims: 0, joins: 0, redemptions: 0 }; D().pstats.push(s); }
      s.redemptions += 1;
      return partnerAgain(o, k, null);
    },

    partner_redeem_status({ o, request_key }) {
      const uid = h.me();
      if (!partnerCan(o, uid)) return err('not_allowed');
      const k = String(request_key ?? '').trim();
      const a = again(o, k, null);
      if (a) return a;
      return partnerAgain(o, k, null) || err('not_found');
    },

    prize_wallet() { return { prizes: [], next: null, available: 0 }; },
  };

  // 074's helpers for the partner counter. With 078 on, every redeemer of the partner uses it: an administrator, a rewards
  // manager or Can Redeem Prizes, for the whole partner or any place (a partner code has no place).
  const partnerCan = (o, uid) => !!uid && (h.org(o) || {}).kind === 'partner' && staffAny(o, uid);
  const pusage = (uid, o) => {
    const day = dayIn(tzOf(o));
    let u = D().pusage.find((x) => x.user_id === uid && x.day === day);
    if (!u) { u = { user_id: uid, day, claims: 0, redeem_tries: 0, redeem_misses: 0 }; D().pusage.push(u); }
    return u;
  };
  const partnerFind = (o, code) => {
    const x = String(code ?? '').trim().toUpperCase();
    const pc = D().pcodes.find((y) => y.org_id === o && y.code.toUpperCase() === x && y.assigned_at);
    if (pc) {
      const claim = D().pclaims.find((k) => k.id === pc.claim_id);
      const who = claim ? claim.user_id : null;
      return { campaign: pc.campaign_id, offer_code: pc.id, reward_code: null, title: (D().campaigns.find((c) => c.id === pc.campaign_id) || {}).title,
        used: D().predeem.find((r) => r.offer_code === pc.id) || null,
        first_name: claim && claim.share_first_name && !minor(who) ? nameOf(who) : null };
    }
    const rc = D().rcodes.find((y) => y.code.toUpperCase() === x && y.assigned_at && (D().rewards.find((w) => w.id === y.reward_id) || {}).org_id === o
      && D().campaigns.some((p) => p.reward_id === y.reward_id));
    if (!rc) return null;
    const camp = D().campaigns.find((p) => p.reward_id === rc.reward_id);
    const e = D().earned.find((y) => y.id === rc.earned_id);
    const w = e && D().rewards.find((r) => r.id === e.reward_id);
    const share = e && w ? (D().pchallengePeople.find((p) => p.challenge_id === w.challenge_id && p.user_id === e.user_id) || {}).share_with_sponsor : null;
    return { campaign: camp.id, offer_code: null, reward_code: rc.id, title: camp.title, used: D().predeem.find((r) => r.reward_code === rc.id) || null,
      first_name: share && e && !minor(e.user_id) ? nameOf(e.user_id) : null };
  };
  // A partner code's use under this request key: its answer again (null: not used here; request_key: used for another code).
  const partnerAgain = (o, k, code) => {
    const r = D().predeem.find((x) => x.org_id === o && x.request_key === k);
    if (!r) return null;
    if (code != null) {
      const f = partnerFind(o, code);
      if (!f || (f.offer_code || null) !== (r.offer_code || null) || (f.reward_code || null) !== (r.reward_code || null)) return err('request_key');
    }
    const f = r.offer_code ? D().pcodes.find((y) => y.id === r.offer_code) : D().rcodes.find((y) => y.id === r.reward_code);
    const found = f ? partnerFind(o, f.code) : null;
    return { ok: true, title: (D().campaigns.find((c) => c.id === r.campaign_id) || {}).title, first_name: found ? found.first_name : null,
      confirmation: r.confirmation, redeemed_at: r.redeemed_at, redeemed_on: dayIn(tzOf(o), 0, Date.parse(r.redeemed_at)) };
  };

  // Storage: the private bucket prize-logos (078's policies: an administrator writes under the organization's id; its members read).
  const bucket = (name) => ({
    async upload(path, file, opts = {}) {
      if (name !== 'prize-logos') return { data: null, error: { message: 'Bucket not found' } };
      const folder = String(path).split('/')[0];
      if (!/^[0-9a-f-]{36}$/i.test(folder) || !isAdmin(folder, h.me())) return { data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } };
      const type = (opts && opts.contentType) || (file && file.type) || '';
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) return { data: null, error: { message: `mime type ${type || 'unknown'} is not supported` } };
      if (P().storage[path] && !opts.upsert) return { data: null, error: { message: 'The resource already exists' } };
      const data = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(file); });
      P().storage[path] = { type, size: file.size, data, updated_at: iso(Date.now()) };
      return { data: { path }, error: null };
    },
    async list(prefix) {
      const uid = h.me();
      if (!D().members.some((m) => m.org_id === prefix && m.user_id === uid && m.status === 'active')) return { data: [], error: null };
      const rows = Object.entries(P().storage).filter(([p]) => p.startsWith(`${prefix}/`))
        .map(([p, f]) => ({ name: p.slice(prefix.length + 1), updated_at: f.updated_at, metadata: { size: f.size, mimetype: f.type } }))
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      return { data: rows, error: null };
    },
    async createSignedUrl(path) {
      const f = P().storage[path];
      const folder = String(path).split('/')[0];
      // Its members read it; so does InneRISE staff, to review a waiting logo (082's assumed read policy for innerise_is_staff()).
      const member = D().members.some((m) => m.org_id === folder && m.user_id === h.me() && m.status === 'active') || (D().staff || []).includes(h.me());
      if (!f || !member) return { data: null, error: { message: 'Object not found' } };
      return { data: { signedUrl: f.data }, error: null };
    },
    async remove(paths) {
      const out = [];
      for (const p of paths || []) {
        if (!isAdmin(String(p).split('/')[0], h.me())) return { data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } };
        if (P().storage[p]) { delete P().storage[p]; out.push({ name: p }); }
      }
      return { data: out, error: null };
    },
  });

  // InneRISE administration (082): 078's prize_staff_queue, prize_staff_logo and prize_staff_terms, wrapped for a signed-in
  // InneRISE staff member (db.staff); anyone else gets {error: 'not_allowed'}. Same checks and answers. Never a code.
  const isStaff = () => !!h.me() && (D().staff || []).includes(h.me());
  // 082: every staff call raises not_staff (P0001) for anyone who isn't InneRISE staff, before it does anything.
  const notStaff = () => { throw Object.assign(new Error('not_staff'), { code: 'P0001' }); };
  const reviewNote = (approve, note) => {
    const n = blank(note);
    if (approve == null) return err('approve');
    if ((!approve && n == null) || (n != null && n.length > 300)) return err('note');
    return { n };
  };
  Object.assign(fns, {
    staff_prize_queue() {
      if (!isStaff()) notStaff();
      const byOldest = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1);
      const logos = P().givers.filter((x) => x.logo_state === 'waiting').map((x) => [x.updated_at || '', x.org_id, x]).sort(byOldest).map(([, , x]) => {
        const g = h.org(x.org_id) || {};
        return { org_id: x.org_id, name: g.name, kind: g.kind, logo_path: x.logo_path, since: x.updated_at || null };
      });
      const terms = P().terms.filter((t) => t.state === 'waiting' && t.campaign_id).map((t) => [t.set_at || '', t.id, t]).sort(byOldest).map(([, , t]) => {
        const c = D().campaigns.find((x) => x.id === t.campaign_id) || {};
        const live = P().terms.find((x) => x.campaign_id === t.campaign_id && x.state === 'live');
        return { campaign_id: t.campaign_id, org_id: c.org_id, partner: (h.org(c.org_id) || {}).name, title: c.title, reward_type: c.reward_type,
          campaign_status: c.status, since: t.set_at, terms: { ...termsJson(t), shared_code_set: !!t.shared_code }, live: live ? termsJson(live) : null };
      });
      return { logos, terms };
    },
    staff_prize_logo({ o, approve, note }) {
      if (!isStaff()) notStaff();
      const r = reviewNote(approve, note);
      if (r.error) return r;
      const pg = P().givers.find((x) => x.org_id === o && x.logo_state === 'waiting');
      if (!pg) return err('not_waiting');
      Object.assign(pg, { logo_state: approve ? 'shown' : 'rejected', logo_note: r.n, logo_reviewed_at: iso(Date.now()), updated_at: iso(Date.now()) });
      return { ok: true };
    },
    staff_prize_terms({ campaign, approve, note }) {
      if (!isStaff()) notStaff();
      const r = reviewNote(approve, note);
      if (r.error) return r;
      const t = P().terms.find((x) => x.campaign_id === campaign && x.state === 'waiting');
      if (!t) return err('not_waiting');
      if (approve) {
        P().terms = P().terms.filter((x) => !(x.campaign_id === campaign && x.state === 'live'));
        Object.assign(t, { state: 'live', live_at: iso(Date.now()), review_note: r.n });
      } else {
        Object.assign(t, { state: 'rejected', review_note: r.n });
      }
      return { ok: true, state: approve ? 'live' : 'rejected' };
    },
  });

  return { fns, storage: { from: bucket } };
}
