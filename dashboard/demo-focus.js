// InneRISE Dashboard demo: Workplace App Management and School Focus (071a_workplace_focus.sql and 071b_workplace_focus.sql, the
// model Ethan chose on 17 Nov: people enroll their own phones, then the organization's schedules apply by themselves), in
// memory, with made-up sample data. Loaded by demo.js; nothing leaves the browser.
//
// Every function here mirrors its SQL: the same argument names, the same order of checks, the same error codes, the same
// reach counts (org_focus_count: a number to the nearest 5, or fewer_than, almost_everyone or small_group) and the same
// rules for who manages a schedule, who sees whom, and who answers a request. workplace_enforcement stays off, as on
// Production: phones apply nothing until InneRISE turns it on after Apple's written approval.
// The sample School Focus data has students enrolled by their guardians, which needs 073 (guardians) on Production.

const DAY = 864e5;
const MIN = 6e4;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CATEGORIES = ['social', 'games', 'entertainment', 'creativity', 'education', 'health_fitness', 'information_reading',
  'productivity_finance', 'shopping_food', 'travel', 'utilities', 'other'];
const REASONS = ['work_task', 'call', 'break', 'emergency', 'other'];
const EDUCATION = ['school', 'district', 'college'];

// Signatures, as demo.js checks them (PostgREST: wrong or missing argument names find no function). Only the functions
// the website calls; enrolling, what applies now and asking for access are the app's.
export const FOCUS_SIGNATURES = {
  org_focus_save: { args: ['o', 'd'], required: ['o', 'd'], uuids: ['o'] },
  org_focus_remove: { args: ['o', 's'], required: ['o', 's'], uuids: ['o', 's'] },
  org_focus_device: { args: ['o', 'who', 'ref', 'add'], required: ['o', 'who', 'ref', 'add'], uuids: ['o', 'who'] },
  org_focus_list: { args: ['o'], required: ['o'], uuids: ['o'] },
  org_focus_enrolled: { args: ['o', 'skip'], required: ['o'], uuids: ['o'], ints: ['skip'] },
  org_focus_access_rules: { args: ['o', 'd'], required: ['o'], uuids: ['o'] },
  org_focus_waiting: { args: [], required: [] },
  org_focus_answer: { args: ['r', 'approve'], required: ['r', 'approve'], uuids: ['r'] },
};
export const FOCUS_SERVICE_ROLE = ['org_focus_push_work'];

const err = (code, extra = {}) => ({ error: code, ...extra });
const len = (s) => [...String(s)].length;
const validZone = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
const hhmm = (j) => (typeof j === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(j) ? j : null);
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const sameArr = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
// org_focus_pick: words from a JSON list, each one of ok (any case), in ok's order, once each; null if j isn't such a list.
function pick(j, ok) {
  if (!Array.isArray(j)) return null;
  if (j.some((x) => typeof x !== 'string' || !ok.includes(x.trim().toLowerCase()))) return null;
  const got = new Set(j.map((x) => x.trim().toLowerCase()));
  return ok.filter((x) => got.has(x));
}
// The organization's day, as a date.
const dayIn = (tz, t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

export function focusFunctions(h) {
  const D = () => {
    const db = h.db();
    if (!db.focusSchedules) Object.assign(db, { focusSchedules: [], focusEnrollments: [], focusAccess: [], focusRequests: [], workplaceEnforcement: { enabled: false } });
    return db;
  };
  const org = (o) => h.org(o);
  const offered = (o) => { const g = org(o); return !!g && (!!g.offers_workplace || EDUCATION.includes(g.kind)); };
  // org_focus_manager: administrators, unit managers and teachers (an active member; nobody while suspended or closed).
  const manager = (o, uid) => { const g = org(o); const m = h.member(o, uid);
    return !!g && ['active', 'pending'].includes(g.status) && !!m && m.status === 'active'
      && D().roles.some((r) => r.org_id === o && r.user_id === uid && ['admin', 'unit_manager', 'teacher'].includes(r.role)); };
  const chain = (u) => { const out = []; for (let x = h.unitOf(u), i = 0; x && i <= 20; x = x.parent_id ? h.unitOf(x.parent_id) : null, i++) out.push(x.id); return out; };
  const below = (u) => { const out = [u]; for (let i = 0; i < out.length; i++) D().units.filter((x) => x.parent_id === out[i]).forEach((x) => out.push(x.id)); return out; };
  // org_focus_zone: its own, else the nearest unit's at or above its unit, else the organization's.
  const zone = (o, u, tz) => tz || (u ? chain(u).map((id) => h.unitOf(id).time_zone).find(Boolean) : null) || org(o).time_zone;
  const minor = (o, uid) => !!(D().users[uid] && D().users[uid].child) || D().members.some((m) => m.org_id === o && m.user_id === uid && m.age_band !== 'adult');
  const json = (s) => ({ id: s.id, org_id: s.org_id, name: s.name, kind: s.kind, days: [...s.days], start: s.start, end: s.end,
    time_zone: s.effective_zone, own_time_zone: s.time_zone, unit_id: s.unit_id, unit_name: s.unit_id ? (h.unitOf(s.unit_id) || {}).name ?? null : null,
    app_categories: [...s.app_categories], note: s.note, version: s.version, updated_at: s.updated_at, last_change: [...s.last_change],
    previous: s.previous ? JSON.parse(JSON.stringify(s.previous)) : null });
  const withoutPrevious = (s) => { const { previous: _p, ...rest } = json(s); return rest; };
  // org_focus_reach: active members the schedule covers (the whole organization, or a unit and everything under it).
  const reach = (o, u) => {
    const active = (uid) => { const m = h.member(o, uid); return !!m && m.status === 'active'; };
    if (!u) return D().members.filter((m) => m.org_id === o && m.status === 'active').map((m) => m.user_id);
    const units = below(u);
    return [...new Set(D().unitMembers.filter((x) => x.org_id === o && units.includes(x.unit_id) && active(x.user_id)).map((x) => x.user_id))];
  };
  // org_focus_count: n covered, k enrolled, lim the smallest group for reports.
  const count = (n, k, lim) => { const reads = n <= lim ? 'small_group' : k < lim ? 'fewer_than' : n - k < lim ? 'almost_everyone' : 'number';
    return { reads, enrolled: reads === 'number' ? Math.max(5, Math.trunc((k + 2) / 5) * 5) : null }; };
  // org_focus_who: a first name, and the units of theirs that me looks after (all, for administrators).
  const who = (o, me, uid) => ({ first_name: String((D().users[uid] || {}).first_name || '').trim() || null,
    units: D().unitMembers.filter((x) => x.org_id === o && x.user_id === uid && h.hasRole(o, me, ['unit_manager', 'teacher'], x.unit_id))
      .map((x) => (h.unitOf(x.unit_id) || {}).name).filter(Boolean).sort((a, b) => a.localeCompare(b)) });
  const accessOf = (o) => D().focusAccess.find((a) => a.org_id === o) || { org_id: o, approvers: 'either', max_minutes: 15, max_day_minutes: 60, reason_required: false };
  // org_focus_approver: may g answer s's requests in o?
  const approver = (o, g, s) => {
    const x = org(o);
    if (g === s || !x || !['active', 'pending'].includes(x.status)) return false;
    const gm = h.member(o, g);
    if (!gm || gm.status !== 'active') return false;
    const a = accessOf(o).approvers;
    return D().roles.some((r) => r.org_id === o && r.user_id === g
      && ((r.role === 'admin' && a !== 'managers')
        || (a !== 'admins' && (r.role === 'unit_manager' || (r.role === 'teacher' && EDUCATION.includes(x.kind)))
          && (r.unit_id == null || D().unitMembers.some((um) => um.org_id === o && um.user_id === s && chain(um.unit_id).includes(r.unit_id))))));
  };
  // org_focus_used: approved minutes today (the organization's day).
  const used = (o, uid) => { const tz = org(o).time_zone; const today = dayIn(tz);
    return D().focusRequests.filter((q) => q.org_id === o && q.user_id === uid && q.status === 'approved' && dayIn(tz, Date.parse(q.answered_at)) === today)
      .reduce((a, q) => a + q.minutes, 0); };
  const nameTaken = (o, u, nm, except) => D().focusSchedules.some((x) => x.org_id === o && (x.unit_id || null) === (u || null)
    && x.name.toLowerCase() === nm.toLowerCase() && x.id !== except);

  const fns = {
    org_focus_save({ o, d }) {
      const me = h.me();
      if (d == null || typeof d !== 'object' || Array.isArray(d)) return err('details');
      if (!manager(o, me)) return err('not_allowed');
      if (!offered(o)) return err('not_offered');
      if (Object.keys(d).some((k) => !['id', 'name', 'kind', 'days', 'start', 'end', 'time_zone', 'unit_id', 'app_categories', 'note'].includes(k))) return err('unknown_field');
      let cur = null;
      if ('id' in d) {
        if (typeof d.id !== 'string' || !UUID_RE.test(d.id)) return err('not_found');
        cur = D().focusSchedules.find((x) => x.id === d.id.toLowerCase() && x.org_id === o) || null;
        if (!cur) return err('not_found');
        if (!h.hasRole(o, me, ['unit_manager', 'teacher'], cur.unit_id)) return err('not_allowed');
      }
      if ('unit_id' in d && d.unit_id !== null && (typeof d.unit_id !== 'string' || !UUID_RE.test(d.unit_id))) return err('unit');
      const u = 'unit_id' in d ? (d.unit_id ? d.unit_id.toLowerCase() : null) : cur ? cur.unit_id : null;
      if (u && !D().units.some((x) => x.id === u && x.org_id === o)) return err('unit');
      if (!h.hasRole(o, me, ['unit_manager', 'teacher'], u)) return err('not_allowed');
      const text = (v) => (v == null ? null : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v));
      const nm = !('name' in d) ? cur && cur.name : typeof d.name === 'string' ? d.name.trim() : null;
      const kd = 'kind' in d ? text(d.kind) : cur && cur.kind;
      const dys = 'days' in d ? pick(d.days, DAYS) : cur && cur.days;
      const st = 'start' in d ? hhmm(d.start) : cur && cur.start;
      const en = 'end' in d ? hhmm(d.end) : cur && cur.end;
      const tz = 'time_zone' in d ? (String(text(d.time_zone) ?? '').trim() || null) : cur ? cur.time_zone : null;
      const cats = kd !== 'focus_hours' ? [] : 'app_categories' in d ? pick(d.app_categories, CATEGORIES) : cur ? cur.app_categories : null;
      const nt = 'note' in d ? (String(text(d.note) ?? '').trim() || null) : cur ? cur.note : null;
      const catsSent = 'app_categories' in d ? d.app_categories : [];
      const e = nm == null || len(nm) < 2 || len(nm) > 60 ? 'name'
        : kd == null || !['focus_hours', 'lunch', 'break'].includes(kd) ? 'kind'
          : !dys || dys.length === 0 ? 'days' : st == null ? 'start' : en == null ? 'end'
            : ((mins(en) - mins(st)) + 1440) % 1440 < 15 ? 'too_short'
              : ('time_zone' in d && d.time_zone !== null && typeof d.time_zone !== 'string') || (tz != null && !validZone(tz)) ? 'time_zone'
                : (kd === 'focus_hours' && (!cats || cats.length === 0)) || (kd !== 'focus_hours' && !(catsSent === null || (Array.isArray(catsSent) && catsSent.length === 0))) ? 'app_categories'
                  : ('note' in d && d.note !== null && typeof d.note !== 'string') || (nt != null && len(nt) > 200) ? 'note' : null;
      if (e) return err(e);
      const now = new Date().toISOString();
      if (!cur) {
        if (D().focusSchedules.filter((x) => x.org_id === o).length >= 1000) return err('too_many');
        if (nameTaken(o, u, nm, null)) return err('name_taken');
        const row = { id: h.newId(), org_id: o, unit_id: u, name: nm, kind: kd, days: dys, start: st, end: en, time_zone: tz, effective_zone: zone(o, u, tz),
          app_categories: cats, note: nt, version: 1, previous: null, last_change: [], created_by: me, created_at: now, updated_at: now };
        D().focusSchedules.push(row);
        return { ok: true, id: row.id, version: 1 };
      }
      const changed = [nm !== cur.name && 'name', kd !== cur.kind && 'kind', !sameArr(dys, cur.days) && 'days', st !== cur.start && 'start',
        en !== cur.end && 'end', tz !== cur.time_zone && 'time_zone', u !== cur.unit_id && 'unit_id',
        !sameArr(cats, cur.app_categories) && 'app_categories', nt !== cur.note && 'note'].filter(Boolean);
      if (!changed.length) return { ok: true, id: cur.id, changed: [], version: cur.version };
      if (nameTaken(o, u, nm, cur.id)) return err('name_taken');
      const previous = withoutPrevious(cur);
      Object.assign(cur, { unit_id: u, name: nm, kind: kd, days: dys, start: st, end: en, time_zone: tz, effective_zone: zone(o, u, tz),
        app_categories: cats, note: nt, version: cur.version + 1, updated_at: now, previous, last_change: changed });
      return { ok: true, id: cur.id, changed, version: cur.version };
    },

    org_focus_remove({ o, s }) {
      const me = h.me();
      if (!manager(o, me)) return err('not_allowed');
      const cur = D().focusSchedules.find((x) => x.id === s && x.org_id === o);
      if (!cur) return err('not_found');
      if (!h.hasRole(o, me, ['unit_manager', 'teacher'], cur.unit_id)) return err('not_allowed');
      D().focusSchedules = D().focusSchedules.filter((x) => x.id !== s);
      return { ok: true };
    },

    // Company-owned phones: administrators, for active adult members. Records only until the device-management link exists.
    org_focus_device({ o, who: uid, ref, add }) {
      const me = h.me();
      if (!h.hasRole(o, me, ['admin'])) return err('not_allowed');
      const r = ref == null ? null : String(ref).trim();
      if (r == null || len(r) < 1 || len(r) > 100 || add == null) return err('device_ref');
      if (add) {
        if (!offered(o)) return err('not_offered');
        const m = h.member(o, uid);
        if (!m || m.status !== 'active') return err('not_member');
        if (minor(o, uid)) return err('under_18');
        if (D().focusEnrollments.some((x) => x.org_id === o && x.ownership === 'company' && x.device_ref === r)) return err('device_taken');
        D().focusEnrollments.push({ id: h.newId(), org_id: o, user_id: uid, ownership: 'company', device_ref: r, via: 'admin', created_by: me, created_at: new Date().toISOString() });
        return { ok: true };
      }
      const gone = D().focusEnrollments.find((x) => x.org_id === o && x.ownership === 'company' && x.device_ref === r && (uid == null || x.user_id === uid));
      if (!gone) return err('not_found');
      D().focusEnrollments = D().focusEnrollments.filter((x) => x !== gone);
      if (!D().focusEnrollments.some((x) => x.org_id === o && x.user_id === gone.user_id && x.ownership === 'personal')) {
        D().focusRequests = D().focusRequests.filter((q) => !(q.org_id === o && q.user_id === gone.user_id)); // org_focus_access_gone
      }
      return { ok: true };
    },

    // The schedules I look after, each with how many it covers are enrolled. Never who.
    org_focus_list({ o }) {
      const me = h.me();
      const g = org(o);
      if (!g) return err('not_found');
      if (['suspended', 'closed'].includes(g.status)) return err(g.status);
      if (!manager(o, me)) return err('not_allowed');
      const enrolled = new Set(D().focusEnrollments.filter((e) => e.org_id === o).map((e) => e.user_id));
      const list = D().focusSchedules.filter((s) => s.org_id === o && h.hasRole(o, me, ['unit_manager', 'teacher'], s.unit_id))
        .sort((a, b) => (a.unit_id != null) - (b.unit_id != null) || a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
        .map((s) => { const r = reach(o, s.unit_id); return { ...json(s), ...count(r.length, r.filter((x) => enrolled.has(x)).length, g.min_report_group) }; });
      return { ok: true, offered: offered(o), min_group: g.min_report_group, enforcement: D().workplaceEnforcement.enabled, schedules: list };
    },

    // Who is enrolled: administrators and whole-organization roles see everyone; unit managers and teachers their units.
    org_focus_enrolled({ o, skip = 0 }) {
      const me = h.me();
      if (!manager(o, me)) return err('not_allowed');
      const whole = h.hasRole(o, me, ['unit_manager', 'teacher']);
      const people = D().focusEnrollments.filter((x) => x.org_id === o && (whole
        || D().unitMembers.some((um) => um.org_id === o && um.user_id === x.user_id && h.hasRole(o, me, ['unit_manager', 'teacher'], um.unit_id))))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .slice(Math.max(Number(skip) || 0, 0), Math.max(Number(skip) || 0, 0) + 500)
        .map((x) => ({ id: x.id, user_id: x.user_id, ownership: x.ownership, device_ref: x.device_ref, since: x.created_at, ...who(o, me, x.user_id) }));
      return { ok: true, people };
    },

    // The rules: d null reads them (administrators, unit managers, teachers); d changes the keys sent (administrators).
    org_focus_access_rules({ o, d = null }) {
      const me = h.me();
      if (!manager(o, me) || (d != null && !h.hasRole(o, me, ['admin']))) return err('not_allowed');
      let a = { ...accessOf(o) };
      if (d != null) {
        if (typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some((k) => !['approvers', 'max_minutes', 'max_day_minutes', 'reason_required'].includes(k))) return err('details');
        // jsonb_populate_record: a value that can't be cast fails the whole call ('details').
        const asInt = (v) => (v == null ? null : typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v) ? Number(v) : undefined);
        const asBool = (v) => (v == null ? null : typeof v === 'boolean' ? v : typeof v === 'string' && /^\s*(t|true|yes|on|1)\s*$/i.test(v) ? true
          : typeof v === 'string' && /^\s*(f|false|no|off|0)\s*$/i.test(v) ? false : undefined);
        const next = { ...a };
        if ('approvers' in d) next.approvers = d.approvers == null ? null : typeof d.approvers === 'object' ? undefined : String(d.approvers);
        if ('max_minutes' in d) next.max_minutes = asInt(d.max_minutes);
        if ('max_day_minutes' in d) next.max_day_minutes = asInt(d.max_day_minutes);
        if ('reason_required' in d) next.reason_required = asBool(d.reason_required);
        if (Object.values(next).some((v) => v === undefined)) return err('details');
        const bad = !['managers', 'admins', 'either'].includes(next.approvers) || next.max_minutes == null || next.max_minutes < 5 || next.max_minutes > 120
          || next.max_day_minutes == null || next.max_day_minutes < 5 || next.max_day_minutes > 480 || next.max_day_minutes < next.max_minutes || next.reason_required == null;
        if (bad) {
          return err(next.approvers == null || !['managers', 'admins', 'either'].includes(next.approvers) ? 'approvers'
            : next.max_minutes == null || next.max_minutes < 5 || next.max_minutes > 120 ? 'max_minutes'
              : next.reason_required == null ? 'reason_required' : 'max_day_minutes');
        }
        D().focusAccess = D().focusAccess.filter((x) => x.org_id !== o);
        D().focusAccess.push({ ...next, org_id: o, updated_by: me, updated_at: new Date().toISOString() });
        a = next;
      }
      return { ok: true, reasons: [...REASONS], approvers: a.approvers, max_minutes: a.max_minutes, max_day_minutes: a.max_day_minutes, reason_required: a.reason_required };
    },

    // Requests I may answer now, in every organization: first name, units (those I look after), minutes, reason.
    org_focus_waiting() {
      const me = h.me();
      const now = Date.now();
      return D().focusRequests.filter((q) => q.status === 'pending' && Date.parse(q.expires_at) > now
        && D().roles.some((r) => r.org_id === q.org_id && r.user_id === me) && approver(q.org_id, me, q.user_id))
        .sort((a, b) => a.asked_at.localeCompare(b.asked_at) || a.id.localeCompare(b.id))
        .map((q) => ({ id: q.id, org_id: q.org_id, org_name: org(q.org_id).name, minutes: q.minutes, reason: q.reason, asked_at: q.asked_at,
          expires_at: q.expires_at, ...who(q.org_id, me, q.user_id) }));
    },

    // Approve or deny a request. Approved: a window of its minutes from now.
    org_focus_answer({ r, approve }) {
      const me = h.me();
      const q = D().focusRequests.find((x) => x.id === r);
      if (!q || !approver(q.org_id, me, q.user_id)) return err('not_found');
      if (approve == null) return err('answer');
      if (q.status === 'pending' && Date.parse(q.expires_at) <= Date.now()) { q.status = 'expired'; return err('expired'); }
      if (q.status !== 'pending') return err('already_answered', { status: q.status });
      if (approve && used(q.org_id, q.user_id) + q.minutes > accessOf(q.org_id).max_day_minutes) return err('day_limit');
      const now = Date.now();
      Object.assign(q, { status: approve ? 'approved' : 'denied', answered_by: me, answered_at: new Date(now).toISOString(),
        ends_at: approve ? new Date(now + q.minutes * MIN).toISOString() : null });
      return { ok: true, status: q.status, ends_at: q.ends_at };
    },
  };

  // org_focus_rezone (a trigger on 068's tables): an organization's or unit's time zone changed, so each schedule that
  // inherits it and now runs in another zone takes the new one, as a new version.
  function rezone(o) {
    for (const s of D().focusSchedules.filter((x) => x.org_id === o && x.time_zone == null).sort((a, b) => a.id.localeCompare(b.id))) {
      const z = zone(o, s.unit_id, null);
      if (s.effective_zone === z) continue;
      const previous = withoutPrevious(s);
      Object.assign(s, { effective_zone: z, version: s.version + 1, previous, last_change: ['time_zone'], updated_at: new Date().toISOString() });
    }
  }
  return { fns, rezone };
}

// Sample data ---------------------------------------------------------------------------------------
export function seedFocus(db, start, refs) {
  const now = Date.now();
  const at = (minutes) => new Date(now + minutes * MIN).toISOString();
  Object.assign(db, { focusSchedules: [], focusEnrollments: [], focusAccess: [], focusRequests: [], workplaceEnforcement: { enabled: false } });
  if (start === 'new') return db;
  const { ids } = refs;
  let n = 0;
  const sid = () => `f0c50000-71aa-4b1c-8d2e-${String(++n).padStart(12, '0')}`;
  let e = 0;
  const eid = () => `f0c5e000-71aa-4b1c-8d2e-${String(++e).padStart(12, '0')}`;
  let q = 0;
  const qid = () => `f0c5a000-71bb-4c2d-9e3f-${String(++q).padStart(12, '0')}`;
  const orgOf = (id) => db.orgs.find((g) => g.id === id);
  const unitOf = (id) => db.units.find((x) => x.id === id);
  const zoneOf = (o, u, tz) => { if (tz) return tz; for (let x = unitOf(u); x; x = x.parent_id ? unitOf(x.parent_id) : null) if (x.time_zone) return x.time_zone; return orgOf(o).time_zone; };
  // A schedule as org_focus_save leaves it. history: its changes, oldest first, as [days ago, {field: value before}]; the row
  // holds today's values, and previous is the version before the last change, as org_focus_json showed it.
  const schedule = (o, s) => {
    const hist = s.history || [];
    const row = { id: sid(), org_id: o, unit_id: s.unit || null, name: s.name, kind: s.kind, days: s.days, start: s.start, end: s.end,
      time_zone: s.tz || null, effective_zone: zoneOf(o, s.unit, s.tz), app_categories: s.cats || [], note: s.note || null, version: 1 + hist.length,
      previous: null, last_change: [], created_by: s.by, created_at: at(-s.made * 1440), updated_at: at(-s.made * 1440) };
    if (hist.length) {
      const [lastAgo, was] = hist[hist.length - 1];
      const before = hist.length > 1 ? hist[hist.length - 2] : null;
      row.previous = { id: row.id, org_id: o, name: row.name, kind: row.kind, days: [...row.days], start: row.start, end: row.end, time_zone: row.effective_zone,
        own_time_zone: row.time_zone, unit_id: row.unit_id, unit_name: row.unit_id ? unitOf(row.unit_id).name : null, app_categories: [...row.app_categories],
        note: row.note, version: row.version - 1, updated_at: before ? at(-before[0] * 1440) : row.created_at, last_change: before ? Object.keys(before[1]) : [],
        ...was };
      row.last_change = Object.keys(was);
      row.updated_at = at(-lastAgo * 1440);
    }
    db.focusSchedules.push(row);
    return row;
  };
  const enroll = (o, uid, daysAgo, ownership = 'personal', ref = null, via = ownership === 'company' ? 'admin' : 'self') =>
    db.focusEnrollments.push({ id: eid(), org_id: o, user_id: uid, ownership, device_ref: ref, via, created_by: ownership === 'company' ? ids.Alex : uid,
      created_at: at(-daysAgo * 1440 - (e % 7) * 53) });
  const ask = (o, uid, minutesAgo, minutes, reason) => db.focusRequests.push({ id: qid(), org_id: o, user_id: uid, minutes, reason, status: 'pending',
    asked_at: at(-minutesAgo), expires_at: at(15 - minutesAgo), answered_by: null, answered_at: null, ends_at: null });
  const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

  // Northside Health: Workplace App Management (offers_workplace is on), America/Detroit, smallest group for reports 5.
  const NH = refs.northside;
  const dt = 'c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e05';
  const rivT = 'c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e04';
  schedule(NH, { name: 'Morning focus', kind: 'focus_hours', days: WEEKDAYS, start: '09:00', end: '11:30', by: ids.Alex, made: 30,
    cats: ['social', 'games', 'entertainment', 'shopping_food'], note: 'Quiet hours for charting and patient follow-up.', history: [[6, { end: '11:00' }]] });
  schedule(NH, { name: 'Lunch', kind: 'lunch', days: WEEKDAYS, start: '12:00', end: '13:00', by: ids.Alex, made: 30 });
  schedule(NH, { name: 'Afternoon focus', kind: 'focus_hours', days: WEEKDAYS, start: '13:00', end: '16:30', by: ids.Alex, made: 30,
    cats: ['social', 'games', 'entertainment'] });
  schedule(NH, { unit: refs.riv, name: 'Saturday clinic', kind: 'focus_hours', days: ['sat'], start: '09:00', end: '13:00', by: ids.Maria, made: 21,
    cats: ['social', 'games', 'entertainment', 'shopping_food'], note: 'Walk-in hours: phones away at the front desk and on the floor.',
    history: [[12, { days: ['sat', 'sun'] }], [4, { start: '08:30' }]] });
  schedule(NH, { unit: rivT, name: 'Night shift focus', kind: 'focus_hours', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '23:00', end: '05:00',
    tz: 'America/Detroit', by: ids.Maria, made: 18, cats: ['social', 'games', 'entertainment', 'shopping_food', 'travel'] });
  schedule(NH, { unit: refs.rivF, name: 'Front desk break', kind: 'break', days: WEEKDAYS, start: '15:00', end: '15:15', by: ids.Maria, made: 14 });
  schedule(NH, { unit: dt, name: 'Downtown planning hour', kind: 'focus_hours', days: ['wed'], start: '10:00', end: '11:00', by: ids.Alex, made: 9,
    cats: ['social', 'games', 'entertainment', 'creativity', 'shopping_food', 'travel'] });
  // Enrolled: eight personal phones, two company phones (records only, until the device-management link exists).
  [['Maria', 40], ['Priya', 38], ['Jamal', 35], ['Hannah', 33], ['Aisha', 30], ['Sofia', 26], ['Dev', 21], ['Luis', 12]]
    .forEach(([name, ago]) => enroll(NH, ids[name], ago));
  enroll(NH, ids.Omar, 28, 'company', 'NH-RC-0233');
  enroll(NH, ids.Ben, 19, 'company', 'NH-FD-0107');
  // Approved earlier today, and two waiting for an answer now.
  db.focusRequests.push({ id: qid(), org_id: NH, user_id: ids.Priya, minutes: 10, reason: 'call', status: 'approved', asked_at: at(-150),
    expires_at: at(-135), answered_by: ids.Maria, answered_at: at(-148), ends_at: at(-138) });
  ask(NH, ids.Priya, 3, 10, 'work_task');
  ask(NH, ids.Dev, 1, 15, null);

  // ?demo=manager: Jordan manages Sales (Downtown office), with Rosa in it and Theo in Community outreach.
  if (start === 'manager' && refs.sales) {
    schedule(NH, { unit: refs.sales, name: 'Sales call block', kind: 'focus_hours', days: ['mon', 'tue', 'wed', 'thu'], start: '14:00', end: '16:00',
      by: ids.Jordan, made: 10, cats: ['social', 'games', 'entertainment', 'shopping_food'], note: 'Calls to customers come first.' });
    enroll(NH, ids.Jordan, 11);
    enroll(NH, ids.Rosa, 9);
    enroll(NH, ids.Theo, 8);
    ask(NH, ids.Theo, 2, 5, 'call');
  }

  // Riverside Schools: School Focus (always on for schools, districts and colleges), smallest group for reports 10.
  // Verified, with people, only in ?demo=district; otherwise it has no schedules yet.
  if (refs.district) {
    const RS = refs.riverside;
    const mid = db.units.find((x) => x.org_id === RS && x.name === 'Riverside Middle School').id;
    schedule(RS, { name: 'School day', kind: 'focus_hours', days: WEEKDAYS, start: '08:30', end: '15:15', by: ids.Alex, made: 35,
      cats: ['social', 'games', 'entertainment', 'shopping_food', 'creativity'], note: 'Class time. Lunch and the morning break lift it.',
      history: [[20, { end: '15:00' }], [5, { start: '08:45' }]] });
    schedule(RS, { name: 'Lunch', kind: 'lunch', days: WEEKDAYS, start: '11:45', end: '12:30', by: ids.Alex, made: 35 });
    schedule(RS, { unit: refs.lin, name: 'Morning break', kind: 'break', days: WEEKDAYS, start: '10:00', end: '10:20', by: ids.Alex, made: 30 });
    schedule(RS, { unit: mid, name: 'After-school study hall', kind: 'focus_hours', days: ['mon', 'tue', 'wed', 'thu'], start: '15:30', end: '17:00',
      by: ids.Marcus, made: 16, cats: ['social', 'games', 'entertainment'], note: 'For students who stay for study hall.' });
    schedule(RS, { unit: refs.sci7, name: 'Science lab', kind: 'focus_hours', days: ['tue', 'thu'], start: '09:00', end: '10:00', by: ids.Marcus, made: 8,
      cats: ['social', 'games', 'entertainment', 'shopping_food', 'creativity', 'travel'] });
    // Students are enrolled by a guardian (073); teachers and staff enroll themselves.
    const s = refs.students;
    ['Yusuf', 'Zara', 'Andre', 'Bianca', 'Cyrus', 'Daria', 'Gabe', 'Hana', 'Ivan', 'Jolie', 'Amara', 'Bodhi', 'Callie', 'Diego', 'Elsie', 'Oliver', 'Paloma', 'Quentin']
      .forEach((name, i) => enroll(RS, s[name].id, 30 - i, 'personal', null, 'guardian'));
    enroll(RS, ids.Rachel, 32);
    enroll(RS, ids.Marcus, 31);
    db.focusAccess.push({ org_id: RS, approvers: 'either', max_minutes: 10, max_day_minutes: 30, reason_required: true, updated_by: ids.Alex, updated_at: at(-30 * 1440) });
    ask(RS, s.Zara.id, 4, 10, 'call');
    ask(RS, s.Diego.id, 2, 5, 'other');
  }
  return db;
}
