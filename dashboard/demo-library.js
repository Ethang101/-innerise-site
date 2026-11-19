// InneRISE Dashboard demo: the Challenge & Rewards Library and habit challenges (075_library_habits.sql), with made-up
// sample data. Plugs into demo.js the way demo-programs.js does, on the same database: a habit challenge is one of 072's
// challenges (db.challenges and db.cpart) with a row in db.habits, as org_habit_challenges is in the SQL.
// Every function here mirrors its SQL: the same argument names, the same order of checks, the same error codes and the same
// answers, as 075_library_habits.sql stands at md5 8f03fe7d (2026-11-17 11:24) and APP_CONTRACT_075.md (md5 652bcd06).
// The person's own app functions (org_habit_checkin, org_habit_mine) and InneRISE staff's (org_library_staff_*) aren't the
// portal's, so they aren't here. Results aren't made final by date here: a challenge's status is what the sample data says.
// The 17 Nov update: no limit on own templates, people, running challenges, top N or how many of a reward unless InneRISE
// sets one; sides and templates take region and district; habit challenges and "use template" take 072's group_kind,
// final_of, advance and advance_n (checked by 072's org_challenge_shape, shared from demo-programs.js); a reward template
// takes each_group.
import { CHALLENGE_LIMITS as LIMITS_072, challengeShape, finalistsSet } from './demo-programs.js';

const DAY = 864e5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORG_KINDS = ['business', 'school', 'district', 'college', 'partner'];
const AGE_GROUPS = ['adults', 'teens', 'children'];
const DEVICE_METRICS = ['steps', 'walk_run_distance', 'cycling_distance', 'floors'];
const HABITS = ['reading', 'wellness', 'positive_habit'];
const SIDE_KINDS = ['location', 'department', 'team', 'school', 'campus', 'grade', 'classroom', 'college', 'program', 'group', 'region', 'district'];
const HEALTH_LIMIT = { steps: 100000, walk_run_distance: 120000, cycling_distance: 400000, floors: 500 }; // 039
const TEMPLATE_KEYS = ['title', 'description', 'for_kinds', 'age_groups', 'tracking', 'metric', 'mode', 'daily_goal', 'target', 'days',
  'sides', 'reward_kind', 'earns', 'top_n', 'quantity'];

export const LIBRARY_SIGNATURES = {
  org_library_options: { args: [], required: [] },
  org_library_browse: { args: ['o', 'what', 'age_group', 'counted_by'], required: ['o'], uuids: ['o'] },
  org_library_save: { args: ['o', 'template', 'd'], required: ['o', 'template', 'd'], uuids: ['o', 'template'] },
  org_library_remove: { args: ['o', 'template'], required: ['o', 'template'], uuids: ['o', 'template'] },
  org_library_use: { args: ['o', 'template', 'd'], required: ['o', 'template'], uuids: ['o', 'template'] },
  org_library_use_reward: { args: ['ch', 'template', 'd'], required: ['ch', 'template'], uuids: ['ch', 'template'] },
  org_habit_create: { args: ['o', 'd'], required: ['o', 'd'], uuids: ['o'] },
  org_habit_edit: { args: ['ch', 'd'], required: ['ch', 'd'], uuids: ['ch'] },
  org_habit_confirm: { args: ['ch', 'on_day', 'members', 'done', 'local_today'], required: ['ch', 'on_day', 'members', 'done'], uuids: ['ch'] },
  org_habit_sheet: { args: ['ch', 'on_day', 'local_today', 'max_rows', 'skip'], required: ['ch'], uuids: ['ch'], ints: ['max_rows', 'skip'] },
  org_habit_to_confirm: { args: ['local_today'], required: [] },
  org_habit_about: { args: ['ids'], required: ['ids'] },
};
// InneRISE staff only (service role), and 075's helpers only its own functions call: never the portal's.
export const LIBRARY_SERVICE_ROLE = ['org_library_staff_save', 'org_library_staff_status', 'org_library_staff_list',
  'org_habit_confirmable', 'org_habit_confirm_cutoff', 'org_habit_final_hold', 'org_habit_count', 'org_habit_can_confirm', 'org_habit_confirmer'];
// The capacity limits are settings (072's org_challenge_limits and 075's org_library_limits, one row each, InneRISE staff
// only): the functions read them, nothing is fixed. These are the rows' defaults.
export const CHALLENGE_LIMITS = LIMITS_072; // null = no limit, but max_days 365
export const LIBRARY_LIMITS = { max_own_templates: null };

// Dates and values, as Postgres reads them -------------------------------------------------------------
const dayIn = (tz, t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const earliestDay = () => dayIn('Etc/GMT+12'); // the last place on Earth where it's still today
const latestDay = () => dayIn('Etc/GMT-14'); // the first place where it's already today
const utcDay = () => new Date().toISOString().slice(0, 10); // current_date on the server
const txt = (v) => (v == null ? null : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v));
const isObj = (d) => d != null && typeof d === 'object' && !Array.isArray(d);
const len = (s) => [...String(s)].length;
const err = (code, extra = {}) => ({ error: code, ...extra });
function asInt(v) {
  if (v == null) return null;
  const s = txt(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('invalid');
  return Number(s);
}
function asNum(v) {
  if (v == null) return null;
  const s = txt(v).trim();
  if (s === '' || !Number.isFinite(Number(s))) throw new Error('invalid');
  return Number(s);
}
function asDate(v) {
  if (v == null) return null;
  const s = txt(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new Error('invalid');
  return s;
}
const asUuid = (v) => { const s = (txt(v) || '').trim(); if (!s) return null; if (!UUID_RE.test(s)) throw new Error('invalid'); return s.toLowerCase(); };
const textList = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => txt(x)))].sort() : null);

// How a challenge's days are counted, in words the app shows (org_habit_label). A habit is never called "verified activity".
export const habitLabel = (tr) => ({ device: 'Verified activity from a phone or watch', self_checkin: 'Self check-in: the person taps Done for the day',
  staff_confirmed: 'Confirmed by a teacher or manager' }[tr] || null);
// org_library_plain: no money signs or words, percentages, links, email addresses or trademark signs.
const plain = (t) => t == null || !(/[$€£¥₹¢™®©@]/.test(t) || /(https?:|www\.|\.(com|net|org|io|co|app)\b)/i.test(t)
  || /\b(price|prices|priced|cost|costs|usd|eur|gbp|dollars?|euros?|cents?|coupons?|discounts?|voucher|vouchers)\b/i.test(t) || /[0-9]\s*%/.test(t));

// org_library_check: a template's settings, checked and cleaned. orgKind: the organization saving its own (null: InneRISE's).
function check(orgKind, cur, d, cap = CHALLENGE_LIMITS) {
  const v = { ...cur };
  for (const k of TEMPLATE_KEYS) if (Object.prototype.hasOwnProperty.call(d, k)) v[k] = d[k];
  const t = (txt(v.title) || '').trim() || null;
  if (t == null || len(t) > (cur.kind === 'challenge' ? 60 : 80)) return err('title');
  const dsc = (txt(v.description) || '').trim() || null;
  if (dsc != null && len(dsc) > 500) return err('description');
  if (!plain(t) || !plain(dsc)) return err('no_prices_or_brands');
  const fk = orgKind != null ? [orgKind] : textList(v.for_kinds);
  if (!fk || !fk.length || !fk.every((x) => ORG_KINDS.includes(x))) return err('for_kinds');
  const ag = textList(v.age_groups);
  if (!ag || !ag.length || !ag.every((x) => AGE_GROUPS.includes(x))) return err('age_groups');
  const kids = fk.some((x) => ['school', 'district'].includes(x)) || ag.some((x) => ['teens', 'children'].includes(x));
  if (cur.kind === 'challenge') {
    const tr = txt(v.tracking);
    if (!['device', 'self_checkin', 'staff_confirmed'].includes(tr)) return err('tracking');
    const met = txt(v.metric);
    if (met == null || (tr === 'device' && !DEVICE_METRICS.includes(met)) || (tr !== 'device' && !HABITS.includes(met))) return err('metric');
    const md = txt(v.mode);
    if (!['participation', 'goal', 'total'].includes(md) || (tr !== 'device' && md === 'total')) return err('mode');
    if (md === 'total' && kids) return err('children_rules');
    let gl; let tg; let n;
    try { gl = asNum(v.daily_goal); tg = asNum(v.target); n = asInt(v.days); } catch { return err('invalid'); }
    if (n == null || n < 1 || n > cap.max_days) return err('days');
    const lim = tr === 'device' ? HEALTH_LIMIT[met] : null;
    if (tr === 'device' && md === 'goal') {
      if (gl == null || gl <= 0 || gl > lim) return err('daily_goal');
    } else if (gl != null) return err('daily_goal');
    if (tr !== 'device' && md === 'goal' && tg == null) return err('target');
    if (tg != null && (tg <= 0 || (md === 'total' && tg > lim * n) || (md !== 'total' && tg > n))) return err('target');
    const sk = (txt(v.sides) || '').trim() || null;
    if (sk != null && !SIDE_KINDS.includes(sk)) return err('sides');
    if (fk.includes('partner') && (tr !== 'device' || sk != null)) return err('partner');
    return { title: t, description: dsc, for_kinds: fk, age_groups: ag, tracking: tr, metric: met, mode: md, daily_goal: gl, target: tg, days: n,
      sides: sk, reward_kind: null, earns: null, top_n: null, quantity: null };
  }
  const rk = txt(v.reward_kind);
  if (!['prize', 'recognition'].includes(rk)) return err('reward_kind');
  const ea = txt(v.earns);
  if (!['winner', 'top_n', 'side', 'goal', 'finish'].includes(ea)) return err('earns');
  if (['winner', 'top_n'].includes(ea) && kids) return err('children_rules');
  let tn; let qn;
  try { tn = ea === 'top_n' ? asInt(v.top_n) : null; qn = asInt(v.quantity); } catch { return err('invalid'); }
  if (ea === 'top_n' && (tn == null || tn < 1 || (cap.max_top_n != null && tn > cap.max_top_n))) return err('top_n');
  if (qn != null && (qn < 1 || (cap.max_quantity != null && qn > cap.max_quantity))) return err('quantity');
  if (fk.includes('partner')) return err('partner');
  return { title: t, description: dsc, for_kinds: fk, age_groups: ag, tracking: null, metric: null, mode: null, daily_goal: null, target: null,
    days: null, sides: null, reward_kind: rk, earns: ea, top_n: tn, quantity: qn };
}

// org_library_json: a template as the app shows it.
function json(t) {
  const base = { id: t.id, own: t.org_id != null, kind: t.kind, title: t.title, description: t.description, for_kinds: [...t.for_kinds], age_groups: [...t.age_groups] };
  return t.kind === 'challenge'
    ? { ...base, tracking: t.tracking, tracking_label: habitLabel(t.tracking), metric: t.tracking === 'device' ? t.metric : null,
      habit: t.tracking !== 'device' ? t.metric : null, mode: t.mode, daily_goal: t.daily_goal, target: t.target, days: t.days, sides: t.sides }
    : { ...base, reward_kind: t.reward_kind, earns: t.earns, top_n: t.top_n, quantity: t.quantity, fits_habits: ['goal', 'finish'].includes(t.earns) };
}
const byKindTitle = (a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1);

// The functions ------------------------------------------------------------------------------------------
// h: db(), me(), org(o), unitOf(u), member(o, uid), hasRole(o, uid, roles, u), newId(), call(name, args) (another demo function,
// as one SQL function calls another), chain(u) (068's org_unit_chain).
export function libraryFunctions(h) {
  const D = () => h.db();
  const firstName = (uid) => ((D().users[uid] && String(D().users[uid].first_name || '').trim()) || 'Someone'); // connect_name
  const consentNow = (o, uid, k) => {
    const rows = (D().consents || []).filter((c) => c.org_id === o && c.user_id === uid && c.kind === k);
    return rows.length ? rows[rows.length - 1].granted : null;
  };
  const challenge = (id) => D().challenges.find((x) => x.id === id) || null;
  const cap = () => D().challengeLimits || CHALLENGE_LIMITS; // 072's org_challenge_limits
  // org_habit_confirm_cutoff: the end of ends_on + 3 in the last time zone (UTC-12), (ends_on + 4) 12:00 UTC.
  const cutoff = (ends) => `${addDays(ends, 4)}T12:00:00+00:00`;
  const habitOf = (id) => D().habits.find((x) => x.challenge_id === id) || null;
  const accepted = (id, uid) => D().cpart.find((p) => p.challenge_id === id && p.user_id === uid && p.status === 'accepted') || null;

  // org_library_staffer: an administrator, challenge coordinator, unit manager, teacher or rewards manager, whole or one unit.
  const staffer = (o, uid) => {
    const g = h.org(o);
    const m = h.member(o, uid);
    return !!uid && !!g && ['active', 'pending'].includes(g.status) && !!m && m.status === 'active'
      && D().roles.some((r) => r.org_id === o && r.user_id === uid && ['admin', 'challenge_coordinator', 'unit_manager', 'teacher', 'rewards_manager'].includes(r.role));
  };
  // org_habit_today: the app's local date, only if it is today somewhere on Earth.
  const today = (local) => {
    const d = local == null ? utcDay() : local;
    return d >= earliestDay() && d <= latestDay() ? d : null;
  };
  // The role a person confirms with: a teacher for a classroom, grade, program or group; a unit manager in a business.
  const confirmRoles = (o, uid) => {
    const g = h.org(o);
    const m = h.member(o, uid);
    if (!uid || !g || !['active', 'pending'].includes(g.status) || g.kind === 'partner' || !m || m.status !== 'active') return [];
    return D().roles.filter((r) => r.org_id === o && r.user_id === uid && r.unit_id != null
      && r.role === (g.kind === 'business' ? 'unit_manager' : 'teacher')
      && (g.kind === 'business' || ['classroom', 'grade', 'program', 'group'].includes((h.unitOf(r.unit_id) || {}).kind)));
  };
  const confirmer = (o, uid) => confirmRoles(o, uid).length > 0;
  // org_habit_can_confirm
  const canConfirm = (ch, uid, member) => {
    const hb = habitOf(ch);
    if (!uid || !member || uid === member || !hb || hb.tracking !== 'staff_confirmed') return false;
    const g = h.org(hb.org_id);
    const pm = h.member(hb.org_id, member);
    if (!pm || pm.status !== 'active') return false;
    if (!['school', 'district'].includes(g.kind) && !(pm.age_band === 'adult' && consentNow(hb.org_id, member, 'manager_reporting') === true)) return false;
    const mine = confirmRoles(hb.org_id, uid).map((r) => r.unit_id);
    return D().unitMembers.some((um) => um.org_id === hb.org_id && um.user_id === member && h.chain(um.unit_id).some((u) => mine.includes(u)));
  };
  const countUse = (uid, what, n, lim) => {
    const day = utcDay();
    D().habitUsage = D().habitUsage.filter((x) => !(x.user_id === uid && x.day < addDays(day, -7)));
    let row = D().habitUsage.find((x) => x.user_id === uid && x.day === day);
    if (!row) { row = { user_id: uid, day, checkins: 0, confirms: 0 }; D().habitUsage.push(row); }
    row[what] += n;
    return lim - row[what]; // how many are left today; below 0: over the limit
  };
  // org_habit_write: done (a day, kept) or not done (no day). The engine's score is the days done.
  const write = (ch, uid, d, done) => {
    const has = D().habitDays.some((x) => x.challenge_id === ch && x.user_id === uid && x.day === d);
    if (done && !has) D().habitDays.push({ challenge_id: ch, user_id: uid, day: d });
    if (!done && has) D().habitDays = D().habitDays.filter((x) => !(x.challenge_id === ch && x.user_id === uid && x.day === d));
    const p = D().cpart.find((x) => x.challenge_id === ch && x.user_id === uid);
    if (p) { p.score = D().habitDays.filter((x) => x.challenge_id === ch && x.user_id === uid).length; p.active_days = p.score; p.best = Math.min(p.score, p.best || p.score); }
    return done !== has;
  };
  // 072's org_challenge_card, and the habit (org_habit_card).
  const card = (id) => {
    const c = challenge(id);
    const g = h.org(c.org_id);
    const u = c.unit_id ? h.unitOf(c.unit_id) : null;
    const hb = habitOf(id);
    return { id: c.id, org_id: c.org_id, org_name: g.name, org_kind: g.kind, title: c.title, description: c.description, metric: c.metric,
      mode: c.mode, daily_goal: c.mode === 'goal' ? c.goal : null, target: c.target, days: c.days, starts_on: c.starts_on, ends_on: c.ends_on,
      status: c.status, unit_id: c.unit_id, unit_name: u ? u.name : null, sides: c.side_kind, max_people: c.max_people ?? null,
      group_kind: c.group_kind || null, final_of: c.final_of ? { id: c.final_of, title: (challenge(c.final_of) || {}).title || null } : null,
      advance: c.advance || null, advance_n: c.advance_n ?? null,
      rewards: D().rewards.filter((w) => w.challenge_id === c.id && w.approved_at)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1))
        .map((w) => ({ id: w.id, title: w.title, description: w.description, kind: w.kind, earns: w.earns, top_n: w.top_n, quantity: w.quantity,
          each_group: !!w.each_group })),
      ...(hb ? { habit: { kind: hb.habit, tracking: hb.tracking, label: habitLabel(hb.tracking) } } : {}) };
  };
  // org_habit_confirmable: could anyone confirm this member's days now? The first reason that holds when not.
  const confirmable = (ch, member) => {
    const hb = habitOf(ch);
    if (hb.tracking !== 'staff_confirmed') return { can_be_confirmed: null, confirm_reason: null };
    const c = challenge(ch);
    const g = h.org(hb.org_id);
    const m = h.member(hb.org_id, member);
    const mine = D().unitMembers.filter((um) => um.org_id === hb.org_id && um.user_id === member);
    const edu = ['school', 'district'].includes(g.kind);
    let reason = 'no_confirmer';
    if (!m || m.status !== 'active') reason = 'not_member';
    else if (c.unit_id && !accepted(ch, member) && !mine.some((um) => h.chain(um.unit_id).includes(c.unit_id))) reason = 'not_in_unit';
    else if (mine.some((um) => D().roles.some((r) => r.org_id === hb.org_id && r.user_id !== member && r.unit_id != null
      && h.chain(um.unit_id).includes(r.unit_id) && canConfirm(ch, r.user_id, member)))) reason = null;
    else if (!edu && m.age_band !== 'adult') reason = 'under_18';
    else if (!edu && consentNow(hb.org_id, member, 'manager_reporting') !== true) reason = 'manager_reporting_off';
    else if (!mine.length) reason = 'no_unit';
    return { can_be_confirmed: reason == null, confirm_reason: reason };
  };
  const manager = (id, uid) => { // 072's org_challenge_manager
    const c = challenge(id);
    return !!uid && !!c && h.hasRole(c.org_id, uid, ['challenge_coordinator', 'unit_manager', 'teacher'], c.unit_id) && (h.org(c.org_id) || {}).kind !== 'partner';
  };

  // org_habit_rules
  function rules(o, d, keepStart = null) {
    const g = h.org(o);
    let u;
    try { u = asUuid(d.unit_id); } catch { return err('unit'); }
    if (u != null && !D().units.some((x) => x.id === u && x.org_id === o)) return err('unit');
    const t = (txt(d.title) || '').trim();
    if (len(t) < 1 || len(t) > 60) return err('title');
    const dsc = (txt(d.description) || '').trim() || null;
    if (dsc != null && len(dsc) > 500) return err('description');
    const hb = txt(d.habit);
    if (!HABITS.includes(hb)) return err('habit');
    const tr = txt(d.tracking);
    if (!['self_checkin', 'staff_confirmed'].includes(tr)) return err('tracking');
    const md = txt(d.mode);
    if (!['participation', 'goal'].includes(md)) return err('mode');
    if ((txt(d.daily_goal) || '') !== '') return err('daily_goal');
    let n; let tg; let st;
    try {
      n = asInt(d.days);
      tg = asNum(d.target);
      st = asDate(d.starts_on) || dayIn(g.time_zone);
    } catch { return err('invalid'); }
    if (n == null || n < 1 || n > cap().max_days) return err('days');
    if ((md === 'goal' && tg == null) || (tg != null && (tg <= 0 || tg > n))) return err('target');
    const earliest = earliestDay();
    if (st !== keepStart && (st < earliest || st > addDays(earliest, 365))) return err('starts_on');
    // 072's org_challenge_shape: sides, group_kind, max_people (null: no limit), final_of, advance, advance_n.
    const sh = challengeShape(h, o, d);
    if (sh.error) return sh;
    return { unit_id: u, title: t, description: dsc, habit: hb, tracking: tr, mode: md, target: tg, days: n, starts_on: st, ...sh };
  }

  const fns = {
    // Habit challenges ---------------------------------------------------------------------------------
    org_habit_create({ o, d }) {
      const me = h.me();
      if (!isObj(d)) return err('details');
      const g = h.org(o);
      let u;
      try { u = asUuid(d.unit_id); } catch { return err('unit'); }
      if (!g || (u != null && !D().units.some((x) => x.id === u && x.org_id === o)) || !h.hasRole(o, me, ['challenge_coordinator', 'unit_manager', 'teacher'], u)) {
        return err('not_allowed');
      }
      if (g.kind === 'partner') return err('not_for_partners');
      if (g.status !== 'active') return err('not_verified');
      if (!g.offers_challenges) return err('not_offered');
      if (cap().max_active != null && D().challenges.filter((x) => x.org_id === o && x.status === 'active').length >= cap().max_active) return err('too_many');
      const r = rules(o, d);
      if (r.error) return r;
      const id = h.newId();
      D().challenges.push({ id, org_id: o, unit_id: r.unit_id, title: r.title, description: r.description, metric: null, mode: r.mode, goal: null,
        target: r.target, days: r.days, starts_on: r.starts_on, ends_on: addDays(r.starts_on, r.days - 1), status: 'active', cancelled_running: false,
        side_kind: r.sides, max_people: r.max_people, group_kind: r.group_kind, final_of: r.final_of, advance: r.advance, advance_n: r.advance_n,
        finalists: [], created_by: me, created_at: new Date().toISOString() });
      D().habits.push({ challenge_id: id, org_id: o, habit: r.habit, tracking: r.tracking });
      finalistsSet(D(), id);
      return { ok: true, challenge_id: id };
    },

    org_habit_edit({ ch, d }) {
      const me = h.me();
      if (!isObj(d)) return err('details');
      const c = challenge(ch);
      const hb = habitOf(ch);
      if (!hb || !manager(ch, me)) return err('not_allowed');
      if (c.status !== 'active' || c.ends_on < earliestDay()) return err('not_open');
      const cur = { unit_id: c.unit_id, title: c.title, description: c.description, habit: hb.habit, tracking: hb.tracking, mode: c.mode,
        target: c.target, days: c.days, starts_on: c.starts_on, sides: c.side_kind, max_people: c.max_people ?? null, group_kind: c.group_kind || null,
        final_of: c.final_of || null, advance: c.advance || null, advance_n: c.advance_n ?? null };
      // As 072's edit: max_people left out keeps it; the final round is checked again only when one of its keys is sent.
      const base = { ...cur };
      const finalSent = ['final_of', 'advance', 'advance_n'].some((k) => k in d);
      if (!('max_people' in d)) delete base.max_people;
      if (!finalSent) { delete base.final_of; delete base.advance; delete base.advance_n; }
      const r = rules(c.org_id, { ...base, ...d }, c.starts_on);
      if (r.error) return r;
      if (!('max_people' in d)) r.max_people = cur.max_people;
      if (!finalSent) Object.assign(r, { final_of: cur.final_of, advance: cur.advance, advance_n: cur.advance_n });
      const keys = ['unit_id', 'title', 'description', 'habit', 'tracking', 'mode', 'target', 'days', 'starts_on', 'sides', 'max_people',
        'group_kind', 'final_of', 'advance', 'advance_n'];
      const changed = keys.filter((k) => (r[k] ?? null) !== (cur[k] ?? null));
      const rulesChanged = changed.some((k) => !['title', 'description', 'max_people'].includes(k));
      if (rulesChanged && D().cpart.some((p) => p.challenge_id === ch)) return err('locked');
      if (changed.includes('unit_id') && !h.hasRole(c.org_id, me, ['challenge_coordinator', 'unit_manager', 'teacher'], r.unit_id)) return err('not_allowed');
      if (r.max_people != null && r.max_people < D().cpart.filter((p) => p.challenge_id === ch && p.status === 'accepted').length) return err('max_people');
      if (!changed.length) return { ok: true, changed: [] };
      Object.assign(c, { title: r.title, days: r.days, starts_on: r.starts_on, ends_on: addDays(r.starts_on, r.days - 1), unit_id: r.unit_id, mode: r.mode,
        target: r.target, side_kind: r.sides, max_people: r.max_people, description: r.description, group_kind: r.group_kind, final_of: r.final_of,
        advance: r.advance, advance_n: r.advance_n });
      Object.assign(hb, { habit: r.habit, tracking: r.tracking });
      if (changed.some((k) => ['final_of', 'advance', 'advance_n'].includes(k))) finalistsSet(D(), ch);
      if (rulesChanged) D().rewards.filter((w) => w.challenge_id === ch && !w.awarded_at).forEach((w) => { w.approved_by = null; w.approved_at = null; });
      return { ok: true, changed };
    },

    org_habit_confirm({ ch, on_day, members, done, local_today = null }) {
      const me = h.me();
      const c = challenge(ch);
      const hb = habitOf(ch);
      if (!hb || !confirmer(hb.org_id, me)) return err('not_allowed');
      if (hb.tracking !== 'staff_confirmed') return err('self_checkin');
      if (c.status !== 'active') return err('not_open');
      if (done == null || on_day == null) return err('invalid');
      if (typeof done !== 'boolean') throw Object.assign(new Error('invalid input syntax for type boolean'), { code: '22P02' });
      if (!Array.isArray(members) || members.length < 1 || members.length > 500) return err('members');
      const t = today(local_today);
      if (t == null) return err('day');
      if (on_day > t || on_day < addDays(t, -3)) return err('window');
      if (on_day < c.starts_on || on_day > c.ends_on) return err('outside_dates');
      const lt = countUse(me, 'confirms', members.length, 5000);
      if (lt < 0) return err('rate_limited');
      let n = 0;
      let k = 0;
      for (const m of [...new Set(members.filter((x) => x != null))]) {
        const p = accepted(ch, m);
        const from = p ? (p.joined_on || c.starts_on) : null;
        if (!from || on_day < from || !canConfirm(ch, me, m)) { k += 1; continue; }
        if (done) {
          if (!D().habitConf.some((x) => x.challenge_id === ch && x.user_id === m && x.day === on_day)) D().habitConf.push({ challenge_id: ch, user_id: m, day: on_day, confirmed_by: me });
        } else {
          D().habitConf = D().habitConf.filter((x) => !(x.challenge_id === ch && x.user_id === m && x.day === on_day));
        }
        write(ch, m, on_day, done);
        n += 1;
      }
      return { ok: true, day: on_day, done, people: n, skipped: k, left_today: lt };
    },

    org_habit_sheet({ ch, on_day = null, local_today = null, max_rows = 200, skip = 0 }) {
      const me = h.me();
      const c = challenge(ch);
      const hb = habitOf(ch);
      if (!hb || !confirmer(hb.org_id, me)) return err('not_allowed');
      if (hb.tracking !== 'staff_confirmed') return err('self_checkin');
      if (c.status !== 'active') return err('not_open');
      const t = today(local_today);
      if (t == null) return err('day');
      const d = on_day || t;
      if (d > t || d < addDays(t, -3)) return err('window');
      if (d < c.starts_on || d > c.ends_on) return err('outside_dates');
      const people = D().cpart.filter((p) => p.challenge_id === ch && p.status === 'accepted' && canConfirm(ch, me, p.user_id))
        .map((p) => ({ user_id: p.user_id, from_day: p.joined_on || c.starts_on, first_name: firstName(p.user_id) }))
        .sort((a, b) => (a.first_name < b.first_name ? -1 : a.first_name > b.first_name ? 1 : a.user_id < b.user_id ? -1 : 1));
      const lim = Math.max(1, Math.min(max_rows == null ? 200 : max_rows, 500));
      const from = Math.max(skip == null ? 0 : skip, 0);
      const lo = addDays(t, -3) > c.starts_on ? addDays(t, -3) : c.starts_on;
      return {
        challenge: card(ch), day: d, window: { from: lo, to: t < c.ends_on ? t : c.ends_on },
        people: people.slice(from, from + lim).map((x) => ({ user_id: x.user_id, first_name: x.first_name, counts: d >= x.from_day,
          confirmed: D().habitConf.some((k) => k.challenge_id === ch && k.user_id === x.user_id && k.day === d) })),
        people_total: people.length,
      };
    },

    org_habit_to_confirm({ local_today = null } = {}) {
      const me = h.me();
      if (!me) return [];
      const t = today(local_today) || utcDay();
      const units = [...new Set(D().roles.filter((r) => r.user_id === me && r.unit_id != null).map((r) => r.org_id))].flatMap((o) => confirmRoles(o, me));
      const near = (c) => c.unit_id == null || units.some((u) => u.org_id === c.org_id
        && (h.chain(u.unit_id).includes(c.unit_id) || h.chain(c.unit_id).includes(u.unit_id)));
      const mine = D().habits.filter((hb) => hb.tracking === 'staff_confirmed' && units.some((u) => u.org_id === hb.org_id))
        .map((hb) => challenge(hb.challenge_id))
        .filter((c) => c.status === 'active' && c.starts_on <= t && c.ends_on >= addDays(t, -3))
        .map((c) => {
          const ppl = D().cpart.filter((p) => p.challenge_id === c.id && p.status === 'accepted' && canConfirm(c.id, me, p.user_id));
          return { c, people: ppl.length, confirmed_today: ppl.filter((p) => D().habitConf.some((k) => k.challenge_id === c.id && k.user_id === p.user_id && k.day === t)).length };
        })
        .filter((x) => x.people > 0 || near(x.c))
        .sort((a, b) => (a.c.ends_on < b.c.ends_on ? -1 : a.c.ends_on > b.c.ends_on ? 1 : a.c.title < b.c.title ? -1 : a.c.title > b.c.title ? 1 : a.c.id < b.c.id ? -1 : 1));
      return mine.map((x) => ({ ...card(x.c.id), today: t, people: x.people, confirmed_today: x.confirmed_today, no_people_yet: x.people === 0,
        window: { from: addDays(t, -3) > x.c.starts_on ? addDays(t, -3) : x.c.starts_on, to: t < x.c.ends_on ? t : x.c.ends_on },
        confirm_cutoff: cutoff(x.c.ends_on) }));
    },

    org_habit_about({ ids }) {
      const me = h.me();
      if (!me || !Array.isArray(ids) || ids.length > 500) return [];
      return D().habits.filter((hb) => ids.includes(hb.challenge_id)
        && ((h.member(hb.org_id, me) || {}).status === 'active'
          || D().cpart.some((p) => p.challenge_id === hb.challenge_id && p.user_id === me && ['accepted', 'left'].includes(p.status))))
        .sort((a, b) => (a.challenge_id < b.challenge_id ? -1 : 1))
        .map((hb) => ({ challenge_id: hb.challenge_id, habit: { kind: hb.habit, tracking: hb.tracking, label: habitLabel(hb.tracking) },
          ...confirmable(hb.challenge_id, me) }));
    },

    // The library ----------------------------------------------------------------------------------------
    org_library_options() {
      return { org_kinds: ORG_KINDS, age_groups: AGE_GROUPS, template_kinds: ['challenge', 'reward'],
        tracking: ['device', 'self_checkin', 'staff_confirmed'].map((v) => ({ value: v, label: habitLabel(v) })),
        device_metrics: DEVICE_METRICS, habits: HABITS, modes: { device: ['participation', 'goal', 'total'], habit: ['participation', 'goal'] },
        habit_reward_earns: ['goal', 'finish'], confirm_window_days: 3, self_checkin_days: 'today' };
    },

    org_library_browse({ o, what = null, age_group = null, counted_by = null }) {
      const me = h.me();
      const g = h.org(o);
      if (!g || !staffer(o, me)) return err('not_allowed');
      if (what != null && !['challenge', 'reward'].includes(what)) return err('what');
      if (age_group != null && !AGE_GROUPS.includes(age_group)) return err('age_group');
      if (counted_by != null && !['device', 'habit', 'self_checkin', 'staff_confirmed'].includes(counted_by)) return err('counted_by');
      return { org_kind: g.kind, templates: D().library
        .filter((t) => ((t.org_id == null && t.status === 'published' && t.for_kinds.includes(g.kind)) || t.org_id === o)
          && (what == null || t.kind === what)
          && (age_group == null || t.age_groups.includes(age_group))
          && (counted_by == null
            || (t.kind === 'challenge' && (t.tracking === counted_by || (counted_by === 'habit' && t.tracking !== 'device')))
            || (t.kind === 'reward' && (counted_by === 'device' || ['goal', 'finish'].includes(t.earns)))))
        .sort(byKindTitle).map(json) };
    },

    org_library_save({ o, template, d }) {
      const me = h.me();
      if (!isObj(d)) return err('details');
      const g = h.org(o);
      if (!g || !h.hasRole(o, me, ['challenge_coordinator'])) return err('not_allowed');
      let cur;
      let dd = d;
      if (template == null) {
        const most = (D().libraryLimits || LIBRARY_LIMITS).max_own_templates;
        if (most != null && D().library.filter((x) => x.org_id === o).length >= most) return err('too_many');
        if (Object.prototype.hasOwnProperty.call(dd, 'from_challenge')) {
          let chId;
          try { chId = asUuid(dd.from_challenge); } catch { return err('from_challenge'); }
          const c = chId ? challenge(chId) : null;
          if (!c || c.org_id !== o) return err('from_challenge');
          const hb = habitOf(chId);
          const rest = { ...dd };
          delete rest.from_challenge;
          dd = { kind: 'challenge', title: c.title, description: c.description, tracking: hb ? hb.tracking : 'device', metric: hb ? hb.habit : c.metric,
            mode: c.mode, daily_goal: c.mode === 'goal' && !hb ? c.goal : null, target: c.target, days: c.days, sides: c.side_kind, ...rest };
        }
        cur = { kind: txt(dd.kind) };
        if (!['challenge', 'reward'].includes(cur.kind)) return err('kind');
        if (!Object.prototype.hasOwnProperty.call(dd, 'age_groups')) {
          dd = { ...dd, age_groups: ['school', 'district'].includes(g.kind) ? ['children', 'teens'] : ['adults'] };
        }
      } else {
        cur = D().library.find((x) => x.id === template && x.org_id === o);
        if (!cur) return err('not_found');
      }
      const r = check(g.kind, cur, dd, cap());
      if (r.error) return r;
      let tid = template;
      if (template == null) {
        tid = h.newId();
        D().library.push({ id: tid, org_id: o, kind: cur.kind, status: 'published', ...r, created_by: me, created_at: new Date().toISOString(),
          updated_at: new Date().toISOString() });
      } else {
        Object.assign(cur, r, { updated_at: new Date().toISOString() });
      }
      return { ok: true, template_id: tid };
    },

    org_library_remove({ o, template }) {
      const me = h.me();
      if (!h.hasRole(o, me, ['challenge_coordinator'])) return err('not_allowed');
      const before = D().library.length;
      D().library = D().library.filter((x) => !(x.id === template && x.org_id === o));
      if (D().library.length === before) return err('not_found');
      return { ok: true };
    },

    org_library_use({ o, template, d = {} }) {
      const me = h.me();
      const dd = d == null ? {} : d;
      if (!isObj(dd)) return err('details');
      const g = h.org(o);
      if (!g || !staffer(o, me)) return err('not_allowed');
      const t = D().library.find((x) => x.id === template && x.kind === 'challenge'
        && ((x.org_id == null && x.status === 'published' && x.for_kinds.includes(g.kind)) || x.org_id === o));
      if (!t) return err('not_found');
      let base = { title: t.title, description: t.description, mode: t.mode, daily_goal: t.daily_goal, target: t.target, days: t.days, sides: t.sides };
      const keys = ['title', 'description', 'unit_id', 'starts_on', 'days', 'daily_goal', 'target', 'sides', 'max_people', 'mode',
        'group_kind', 'final_of', 'advance', 'advance_n'];
      const extra = Object.fromEntries(Object.entries(dd).filter(([k]) => keys.includes(k)));
      // Another mode than the template's: the template's daily goal goes, unless one is given.
      if ('mode' in extra && !('daily_goal' in extra) && extra.mode !== 'goal') { const { daily_goal: _g, ...rest } = base; base = rest; }
      base = { ...base, ...extra };
      let r;
      if (t.tracking === 'device') {
        base = { ...base, metric: t.metric };
        if (g.kind === 'partner') {
          const { description, ...rest } = base;
          r = h.call('partner_campaign_create', { o, k: 'sponsored_challenge', d: { ...rest, summary: description } });
          if (r && r.campaign_id) return { ...r, template_id: t.id, review: true };
          return r;
        }
        r = h.call('org_challenge_create', { o, d: base });
      } else {
        r = fns.org_habit_create({ o, d: { ...base, habit: t.metric, tracking: t.tracking } });
      }
      if (r && r.challenge_id) return { ...r, template_id: t.id };
      return r;
    },

    org_library_use_reward({ ch, template, d = {} }) {
      const me = h.me();
      const dd = d == null ? {} : d;
      if (!isObj(dd)) return err('details');
      const c = challenge(ch);
      if (!c || !c.org_id || !staffer(c.org_id, me)) return err('not_allowed');
      const k = h.org(c.org_id).kind;
      const t = D().library.find((x) => x.id === template && x.kind === 'reward'
        && ((x.org_id == null && x.status === 'published' && x.for_kinds.includes(k)) || x.org_id === c.org_id));
      if (!t) return err('not_found');
      if (!['goal', 'finish'].includes(t.earns) && habitOf(ch)) return err('habit_rewards');
      const base = { title: t.title, description: t.description, kind: t.reward_kind, earns: t.earns, top_n: t.top_n, quantity: t.quantity,
        ...Object.fromEntries(Object.entries(dd).filter(([x]) => ['title', 'description', 'quantity', 'top_n', 'each_group'].includes(x))) };
      const r = h.call('org_reward_set', { ch, reward: null, d: base });
      if (r && r.reward_id) return { ...r, template_id: t.id };
      return r;
    },
  };

  // 072's org_reward_set, guarded as 075's trigger guards org_rewards: a habit challenge's rewards are goal or finish only.
  const guardRewards = (inner) => (args) => {
    const hb = args && habitOf(args.ch);
    const earns = args && isObj(args.d) ? txt(args.d.earns) : null;
    const was = hb && args.reward ? D().rewards.find((w) => w.id === args.reward) : null;
    const next = earns || (was ? was.earns : null);
    if (hb && next && !['goal', 'finish'].includes(next)) {
      throw Object.assign(new Error("habit_rewards: a habit challenge's rewards are for reaching the target or taking part (goal or finish). Nothing was changed."), { code: 'P0001' });
    }
    return inner(args);
  };
  return { fns, guardRewards, confirmer };
}

// The starter library (075's, word for word) and the sample data ---------------------------------------
const STARTER = [
  { kind: 'challenge', title: 'Daily steps', description: 'Walk 7,500 steps a day. Reach the goal on 20 of the 30 days.', for_kinds: ['business', 'college', 'partner'], age_groups: ['adults'],
    tracking: 'device', metric: 'steps', mode: 'goal', daily_goal: 7500, target: 20, days: 30 },
  { kind: 'challenge', title: 'Department walking competition',
    description: "Departments compete on days with 6,000 steps or more. A department's score is the average per person who joined, so small and large departments compete fairly.",
    for_kinds: ['business', 'college'], age_groups: ['adults'], tracking: 'device', metric: 'steps', mode: 'goal', daily_goal: 6000, target: 15, days: 21, sides: 'department' },
  { kind: 'challenge', title: 'Location step challenge', description: "Each location's average days with 8,000 steps or more, over two weeks.",
    for_kinds: ['business'], age_groups: ['adults'], tracking: 'device', metric: 'steps', mode: 'goal', daily_goal: 8000, target: 10, days: 14, sides: 'location' },
  { kind: 'challenge', title: 'Active days', description: 'Any day you move counts. Be active on 20 of the next 30 days.',
    for_kinds: ['business', 'school', 'district', 'college'], age_groups: ['adults', 'teens', 'children'], tracking: 'device', metric: 'steps', mode: 'participation', target: 20, days: 30 },
  { kind: 'challenge', title: 'Take the stairs', description: 'Climb 10 floors a day on 10 of the next 14 days.',
    for_kinds: ['business', 'college', 'partner'], age_groups: ['adults'], tracking: 'device', metric: 'floors', mode: 'goal', daily_goal: 10, target: 10, days: 14 },
  { kind: 'challenge', title: 'Ride to work', description: 'Cycle at least 5 km on 10 days this month.',
    for_kinds: ['business', 'college', 'partner'], age_groups: ['adults'], tracking: 'device', metric: 'cycling_distance', mode: 'goal', daily_goal: 5000, target: 10, days: 30 },
  { kind: 'challenge', title: 'Team distance', description: "Teams add up walking and running distance for a month. A team's score is the average per person.",
    for_kinds: ['business', 'college'], age_groups: ['adults'], tracking: 'device', metric: 'walk_run_distance', mode: 'total', days: 30, sides: 'team' },
  { kind: 'challenge', title: 'Staff step challenge', description: 'For teachers and staff: 6,000 steps a day on 15 of the next 30 days.',
    for_kinds: ['school', 'district'], age_groups: ['adults'], tracking: 'device', metric: 'steps', mode: 'goal', daily_goal: 6000, target: 15, days: 30 },
  { kind: 'challenge', title: 'Move every day', description: 'Classrooms compete on how many days their students are active.',
    for_kinds: ['school', 'district'], age_groups: ['children', 'teens'], tracking: 'device', metric: 'steps', mode: 'participation', target: 15, days: 20, sides: 'classroom' },
  { kind: 'challenge', title: 'Grade step challenge', description: 'Grades compete on days with 5,000 steps or more.',
    for_kinds: ['school', 'district'], age_groups: ['teens'], tracking: 'device', metric: 'steps', mode: 'goal', daily_goal: 5000, target: 10, days: 14, sides: 'grade' },
  { kind: 'challenge', title: 'Reading streak', description: 'Read every day for four weeks. Tap Done on each day you read. Classrooms compete on reading days.',
    for_kinds: ['school', 'district'], age_groups: ['children', 'teens'], tracking: 'self_checkin', metric: 'reading', mode: 'goal', target: 20, days: 28, sides: 'classroom' },
  { kind: 'challenge', title: 'Class reading time', description: 'The class reads together. Your teacher marks each day it happens.',
    for_kinds: ['school', 'district'], age_groups: ['children', 'teens'], tracking: 'staff_confirmed', metric: 'reading', mode: 'participation', target: 15, days: 20 },
  { kind: 'challenge', title: 'Family reading nights', description: 'Read at home with your family. Tap Done on each night you read together.',
    for_kinds: ['school', 'district'], age_groups: ['children'], tracking: 'self_checkin', metric: 'reading', mode: 'participation', target: 10, days: 30 },
  { kind: 'challenge', title: 'Book club month', description: 'Read on 12 days this month. Tap Done on each day you read.',
    for_kinds: ['business', 'college'], age_groups: ['adults'], tracking: 'self_checkin', metric: 'reading', mode: 'goal', target: 12, days: 30 },
  { kind: 'challenge', title: 'Screen-free evenings', description: 'Put screens away after dinner. Tap Done on each evening you do.',
    for_kinds: ['business', 'school', 'district', 'college'], age_groups: ['adults', 'teens', 'children'], tracking: 'self_checkin', metric: 'positive_habit', mode: 'participation', target: 10, days: 14 },
  { kind: 'challenge', title: 'Mindful minutes', description: 'Take a few quiet minutes to breathe each day. Tap Done when you have.',
    for_kinds: ['business', 'school', 'district', 'college'], age_groups: ['adults', 'teens', 'children'], tracking: 'self_checkin', metric: 'wellness', mode: 'participation', target: 15, days: 21 },
  { kind: 'challenge', title: 'Drink water every day', description: 'Have a glass of water with each meal. Tap Done on each day you do.',
    for_kinds: ['business', 'school', 'district', 'college'], age_groups: ['adults', 'teens', 'children'], tracking: 'self_checkin', metric: 'positive_habit', mode: 'participation', target: 15, days: 21 },
  { kind: 'challenge', title: 'Kindness challenge', description: 'Do one kind thing for someone each day. Tap Done when you have.',
    for_kinds: ['school', 'district'], age_groups: ['children', 'teens'], tracking: 'self_checkin', metric: 'positive_habit', mode: 'participation', target: 10, days: 14 },
  { kind: 'challenge', title: 'Lunch walk', description: "Walk together at lunch. The team's manager marks who came each day.",
    for_kinds: ['business'], age_groups: ['adults'], tracking: 'staff_confirmed', metric: 'wellness', mode: 'participation', target: 10, days: 20 },
  { kind: 'challenge', title: 'Stretch break', description: "A short stretch with your team each afternoon. The team's manager marks each day you join in.",
    for_kinds: ['business'], age_groups: ['adults'], tracking: 'staff_confirmed', metric: 'wellness', mode: 'participation', target: 15, days: 20 },
  { kind: 'challenge', title: 'Morning movement break', description: 'The class moves together for a few minutes each morning. Your teacher marks each day.',
    for_kinds: ['school', 'district'], age_groups: ['children', 'teens'], tracking: 'staff_confirmed', metric: 'wellness', mode: 'participation', target: 15, days: 20, sides: 'classroom' },
  { kind: 'reward', title: 'Finisher badge', description: 'For everyone who took part.', for_kinds: ['business', 'school', 'district', 'college'],
    age_groups: ['adults', 'teens', 'children'], reward_kind: 'recognition', earns: 'finish' },
  { kind: 'reward', title: 'Goal reached certificate', description: 'For everyone who reached the target.', for_kinds: ['business', 'school', 'district', 'college'],
    age_groups: ['adults', 'teens', 'children'], reward_kind: 'recognition', earns: 'goal' },
  { kind: 'reward', title: 'Reading champion', description: 'A certificate for every reader who reached the target.', for_kinds: ['school', 'district'],
    age_groups: ['children', 'teens'], reward_kind: 'recognition', earns: 'goal' },
  { kind: 'reward', title: 'Class trophy', description: 'For every student in the winning classroom.', for_kinds: ['school', 'district'],
    age_groups: ['children', 'teens'], reward_kind: 'recognition', earns: 'side' },
  { kind: 'reward', title: 'Extra free time', description: 'Extra recess or free time for the winning class, as the school decides.', for_kinds: ['school', 'district'],
    age_groups: ['children', 'teens'], reward_kind: 'prize', earns: 'side' },
  { kind: 'reward', title: 'Team champion badge', description: 'For everyone on the winning team.', for_kinds: ['business', 'college'],
    age_groups: ['adults'], reward_kind: 'recognition', earns: 'side' },
  { kind: 'reward', title: 'Team lunch', description: 'Lunch together for the winning team, chosen by your organization.', for_kinds: ['business'],
    age_groups: ['adults'], reward_kind: 'prize', earns: 'side' },
  { kind: 'reward', title: 'Thank-you gift', description: 'A small gift your organization chooses, for everyone who reaches the target.', for_kinds: ['business', 'college'],
    age_groups: ['adults'], reward_kind: 'prize', earns: 'goal' },
  { kind: 'reward', title: 'Afternoon off', description: 'An afternoon off for everyone who reaches the target, as your organization decides.', for_kinds: ['business'],
    age_groups: ['adults'], reward_kind: 'prize', earns: 'goal' },
  { kind: 'reward', title: 'Challenge winner', description: 'A prize your organization chooses for the person with the best result.', for_kinds: ['business', 'college'],
    age_groups: ['adults'], reward_kind: 'prize', earns: 'winner', quantity: 1 },
  { kind: 'reward', title: 'Top ten', description: 'A prize your organization chooses for the ten best results.', for_kinds: ['business', 'college'],
    age_groups: ['adults'], reward_kind: 'prize', earns: 'top_n', top_n: 10 },
];

export function seedLibrary(db, start, refs) {
  const now = Date.now();
  const at = (days) => new Date(now + days * DAY).toISOString();
  Object.assign(db, { library: [], habits: [], habitConf: [], habitDays: [], habitUsage: [], libraryLimits: { ...LIBRARY_LIMITS } });
  if (!db.challengeLimits) db.challengeLimits = { ...CHALLENGE_LIMITS };
  // The starter set passes the same check as any template (a mistake stops the whole migration; here, the demo).
  STARTER.forEach((x, i) => {
    const r = check(null, { kind: x.kind }, x);
    if (r.error) throw new Error(`Starter template "${x.title}" is not valid (${r.error}).`);
    db.library.push({ id: `11b0a000-75aa-4c1d-8e2f-${String(i + 1).padStart(12, '0')}`, org_id: null, kind: x.kind, status: 'published', ...r,
      created_by: null, created_at: at(-20), updated_at: at(-20) });
  });
  if (start === 'new') return db;
  const { ids } = refs;
  let k = 0;
  const own = (org, by, x) => {
    const g = db.orgs.find((o) => o.id === org);
    const r = check(g.kind, { kind: x.kind }, x);
    if (r.error) throw new Error(`Sample template "${x.title}" is not valid (${r.error}).`);
    db.library.push({ id: `11b0b000-75aa-4c1d-8e2f-${String(++k).padStart(12, '0')}`, org_id: org, kind: x.kind, status: 'published', ...r,
      created_by: by, created_at: at(-9 + k), updated_at: at(-9 + k) });
  };
  // Northside Health's own: the stair week Riverside clinic runs each spring, and its reward.
  own(refs.northside, ids.Dev, { kind: 'challenge', title: 'Clinic stair week', description: 'Take the stairs between floors: 8 floors a day on 5 of the 7 days.',
    age_groups: ['adults'], tracking: 'device', metric: 'floors', mode: 'goal', daily_goal: 8, target: 5, days: 7, sides: 'department' });
  own(refs.northside, ids.Dev, { kind: 'reward', title: 'Stair week certificate', description: 'For everyone who reaches the target.',
    age_groups: ['adults'], reward_kind: 'recognition', earns: 'goal' });

  const dayOf = (tz, plus) => dayIn(tz, now + plus * DAY);
  let n = 0;
  const cid = () => `c4a0e075-1e2f-4a3b-8c4d-${String(++n).padStart(12, '0')}`;
  // A habit challenge exactly as org_habit_create leaves it, with people in it and their days done.
  const habit = (org, tz, c) => {
    const st = dayOf(tz, c.startIn);
    const row = { id: cid(), org_id: org, unit_id: c.unit || null, title: c.title, description: c.description || null, metric: null, mode: c.mode, goal: null,
      target: c.target ?? null, days: c.days, starts_on: st, ends_on: addDays(st, c.days - 1), status: 'active', cancelled_running: false,
      side_kind: c.sides || null, max_people: null, group_kind: null, final_of: null, advance: null, advance_n: null, finalists: [],
      created_by: c.by, created_at: at(c.startIn - 3) };
    db.challenges.push(row);
    db.habits.push({ challenge_id: row.id, org_id: org, habit: c.habit, tracking: c.tracking });
    const today = dayOf(tz, 0);
    for (const [uid, done] of c.people) {
      const days = [];
      for (let d = st; d < today && d <= row.ends_on; d = addDays(d, 1)) days.push(d);
      const kept = days.filter((_, i) => done[i % done.length] === '1');
      for (const d of kept) {
        db.habitDays.push({ challenge_id: row.id, user_id: uid, day: d });
        if (c.tracking === 'staff_confirmed') db.habitConf.push({ challenge_id: row.id, user_id: uid, day: d, confirmed_by: c.by });
      }
      db.cpart.push({ challenge_id: row.id, user_id: uid, status: 'accepted', share_progress: true, joined_on: st, score: kept.length, active_days: kept.length,
        best: Math.min(kept.length, 3), side_unit: c.sideOf ? c.sideOf(uid) : null });
    }
    return row;
  };

  // Riverside Schools, verified (?demo=district, and ?demo=teacher signed in as Rachel, Room 112's teacher).
  if (refs.district) {
    const RS = refs.riverside;
    const tz = 'America/Detroit';
    const s = refs.students;
    const room112 = ['Amara', 'Bodhi', 'Callie', 'Diego', 'Elsie', 'Finn', 'Gia', 'Hector'];
    const pattern = ['1101', '1110', '1011', '1111', '0110', '1101', '1001', '1110'];
    habit(RS, tz, { title: 'Class reading time', description: 'The class reads together after lunch. Ms. Rachel marks each day it happens.',
      habit: 'reading', tracking: 'staff_confirmed', mode: 'participation', target: 15, days: 20, startIn: -6, unit: refs.r112, by: ids.Rachel,
      people: room112.map((nm, i) => [s[nm].id, pattern[i]]) });
    const lincoln = [...room112, 'Ines', 'Jasper', 'Kenji', 'Lola', 'Milo', 'Nadia', 'Oliver', 'Paloma', 'Quentin', 'Riya', 'Sami', 'Talia'];
    habit(RS, tz, { title: 'Reading streak', description: 'Read every day for four weeks. Tap Done on each day you read. Classrooms compete on reading days.',
      habit: 'reading', tracking: 'self_checkin', mode: 'goal', target: 20, days: 28, startIn: -3, unit: refs.lin, sides: 'classroom', by: ids.Elena,
      people: lincoln.map((nm, i) => [s[nm].id, ['111', '101', '110', '011'][i % 4]]), sideOf: (uid) => Object.values(s).find((x) => x.id === uid).unit });
    if (start === 'teacher') {
      habit(RS, tz, { title: 'Quiet reading week', description: 'Ten quiet minutes with a book after recess. Ms. Rachel marks each day.',
        habit: 'reading', tracking: 'staff_confirmed', mode: 'participation', days: 6, startIn: -7, unit: refs.r112, by: ids.Rachel,
        people: room112.slice(0, 6).map((nm, i) => [s[nm].id, pattern[i]]) });
      habit(RS, tz, { title: 'Kindness week', description: 'One kind thing a day for a week. Each class\'s teacher marks the days.',
        habit: 'positive_habit', tracking: 'staff_confirmed', mode: 'participation', days: 7, startIn: -1, unit: refs.lin, by: ids.Elena,
        people: ['Ines', 'Jasper', 'Kenji'].map((nm) => [s[nm].id, '1']) });
    }
    own(RS, ids.Elena, { kind: 'challenge', title: 'Lincoln reading month', description: 'Read on 15 days this month. Tap Done on each day you read.',
      age_groups: ['children'], tracking: 'self_checkin', metric: 'reading', mode: 'goal', target: 15, days: 30, sides: 'classroom' });
  }
  // ?demo=manager: Jordan's Sales department stretches each afternoon; Jordan marks who joined in.
  if (refs.sales) {
    habit(refs.northside, 'America/Detroit', { title: 'Sales afternoon stretch', description: "A short stretch together each afternoon. The team's manager marks who joined in.",
      habit: 'wellness', tracking: 'staff_confirmed', mode: 'participation', target: 10, days: 20, startIn: -4, unit: refs.sales, by: ids.Jordan,
      people: [[ids.Rosa, '101'], [ids.Theo, '110']] });
    if (!db.consents.some((c) => c.org_id === refs.northside && c.user_id === ids.Theo && c.kind === 'manager_reporting')) {
      db.consents.push({ org_id: refs.northside, user_id: ids.Theo, kind: 'manager_reporting', granted: true, at: at(-30) });
    }
  }
  return db;
}
