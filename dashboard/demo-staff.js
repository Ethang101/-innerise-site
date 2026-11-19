// InneRISE Dashboard demo: InneRISE administration (082's staff_* functions, which wrap the service-role ones of 068, 074, 075
// and 078 for signed-in InneRISE staff) and the Reports section's org_report_places, in memory, with made-up sample data.
// Plugs into demo.js the way demo-programs.js does, on the same database. The partner review (staff_partner_queue,
// staff_partner_decide) lives in demo-programs.js beside 074's campaigns, and the prize review (staff_prize_queue,
// staff_prize_logo, staff_prize_terms) in demo-prizes.js beside 078's prize terms and logos.
//
// Built against 082's APP_CONTRACT_082.md (082_staff_admin_reports.sql). What this demo follows from it:
//   every staff call raises not_staff (P0001) for anyone who isn't InneRISE staff; innerise_is_staff() is a boolean.
//   staff_overview() -> {orgs_waiting (every pending organization), partners_waiting, campaigns_waiting, library_waiting,
//     logos_waiting, terms_waiting}
//   staff_org_list(st default 'pending', q, lim 1..200, off) -> {total, rows}: q looks in the name and the legal name; pending
//     is oldest first, everything else (null = every status) newest first; {error: 'status'} for another status.
//   staff_org_set_status(o, st, note) -> 068's org_staff_set_status: st active | suspended | closed; the note is trimmed,
//     at most 200 characters, and an empty one keeps the old note; {ok, status, verified_at}; errors status, not_found, note.
//   staff_library_list(st default null), staff_library_set_status(template, st): 075's, unchanged.
//   org_report_places(o): per place direct and below (each person once), with *_fewer_than and *_hidden ('fewer_than' or
//     'protects'); total_active and not_placed for administrators ('not_in_scope' for managers and teachers, who get a
//     filtered copy of the administrators' report). The small-group rule is 082's org_report_hide, ported below as it is.

const DAY = 864e5;
const err = (code, more = {}) => ({ error: code, ...more });
const txt = (v) => (v == null ? null : typeof v === 'string' ? v : String(v));
const ORG_STATUSES = ['pending', 'active', 'suspended', 'closed'];

export const STAFF_SIGNATURES = {
  innerise_is_staff: { args: [], required: [] },
  staff_overview: { args: [], required: [] },
  staff_org_list: { args: ['st', 'q', 'lim', 'off'], required: [], ints: ['lim', 'off'] },
  staff_org_set_status: { args: ['o', 'st', 'note'], required: ['o', 'st', 'note'], uuids: ['o'] },
  staff_library_list: { args: ['st'], required: [] },
  staff_library_set_status: { args: ['template', 'st'], required: ['template', 'st'], uuids: ['template'] },
  org_report_places: { args: ['o'], required: ['o'], uuids: ['o'] },
};

// The organizations InneRISE staff look after in ?demo=staff --------------------------------------------------------------
export const INNERISE_TEAM = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c50';
export const SUMMIT = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c60';
export const LAKEVIEW = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c70';
export const BRIGHTPATH = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c80';
const SCREEN_FREE_TEMPLATE = '11b0c000-75aa-4c1d-8e2f-000000000001';
const PEAK_TEN_PACK = 'e7b10000-3c2d-4e1f-9a8b-000000000305';

// ?demo=staff: Morgan works at InneRISE (InneRISE staff) and runs InneRISE's own team. Waiting for InneRISE: Riverside Schools
// (a district), Summit Climbing Gym (a partner) and Lakeview College; Peak Fitness's Cycle the Riverfront challenge (new, as in
// ?demo=sponsor) and its 10-class pack offer (changed since it was approved), its logo and its smoothie offer's prize terms; and
// one library template.
// Peak Fitness is verified, with its history (as in ?demo=sponsor), and has accepted the Sponsor Reward Terms.
export function seedStaff(db, start, refs) {
  db.staff = [];
  if (start !== 'staff' || !refs) return db;
  const now = Date.now();
  const at = (days, hours = 0) => new Date(now + days * DAY + hours * 36e5).toISOString();
  db.staff.push(refs.me);
  const person = (id, name, email, days) => {
    db.users[id] = db.users[id] || { id, first_name: name, email, email_confirmed_at: at(-days) };
    return id;
  };
  const orgRow = (o) => db.orgs.push({ verified_at: null, offers_workplace: false, offers_challenges: true, min_report_group: 5,
    time_zone: 'America/Detroit', legal_name: null, website: null, contact_email: null, contact_phone: null, street: null, city: null,
    region: null, postal_code: null, country: 'US', verified_note: null, ...o });
  const join = (o, uid, type, days, admin = false) => {
    db.members.push({ org_id: o, user_id: uid, member_type: type, age_band: 'adult', status: 'active', joined_at: at(-days), ended_at: null });
    if (admin) db.roles.push({ id: `5a1f0000-82aa-4c1d-8e2f-${String(db.roles.length + 1).padStart(12, '0')}`, org_id: o, user_id: uid,
      role: 'admin', unit_id: null, granted_by: uid, granted_at: at(-days) });
  };

  // InneRISE's own team: Morgan is its administrator.
  orgRow({ id: INNERISE_TEAM, kind: 'business', name: 'InneRISE Team', status: 'active', verified_at: at(-300), offers_workplace: true,
    created_by: refs.me, created_at: at(-310), legal_name: 'InneRISE, Inc.', website: 'https://innerise.example', contact_email: 'team@innerise.example',
    city: 'Detroit', region: 'MI' });
  db.domains.push({ org_id: INNERISE_TEAM, domain: 'innerise.example', verified_by: refs.me, verified_at: at(-309) });
  join(INNERISE_TEAM, refs.me, 'employee', 300, true);
  const studio = 'f1e2d3c4-82aa-4c1d-8e2f-000000000001';
  db.units.push({ id: studio, org_id: INNERISE_TEAM, parent_id: null, kind: 'location', name: 'Detroit studio', grade_level: null, created_at: at(-300),
    street: '1 Campus Martius', city: 'Detroit', region: 'MI', postal_code: '48226', country: 'US', time_zone: null });
  db.unitMembers.push({ unit_id: studio, user_id: refs.me, org_id: INNERISE_TEAM, added_at: at(-300) });
  ['Priyanka', 'Theo', 'Lena', 'Marcus', 'Ines', 'Owen'].forEach((name, i) => {
    const id = person(`5a1f${String(i + 1).padStart(4, '0')}-82aa-4c1d-8e2f-900000000000`, name, `${name.toLowerCase()}@innerise.example`, 280);
    join(INNERISE_TEAM, id, 'employee', 280 - i * 20);
    db.unitMembers.push({ unit_id: studio, user_id: id, org_id: INNERISE_TEAM, added_at: at(-270) });
  });

  // Summit Climbing Gym: a partner gym, registered yesterday, waiting to be checked.
  const jake = person('5a1f0101-82aa-4c1d-8e2f-900000000000', 'Jake', 'jake@summitclimbing.example', 3);
  orgRow({ id: SUMMIT, kind: 'partner', name: 'Summit Climbing Gym', status: 'pending', offers_workplace: true, created_by: jake, created_at: at(-1, -3),
    legal_name: 'Summit Climbing LLC', website: 'https://summitclimbing.example', contact_email: 'hello@summitclimbing.example',
    contact_phone: '+1 313 555 0166', street: '2100 Michigan Avenue', city: 'Detroit', region: 'MI', postal_code: '48216' });
  db.domains.push({ org_id: SUMMIT, domain: 'summitclimbing.example', verified_by: jake, verified_at: at(-1, -2) });
  join(SUMMIT, jake, 'employee', 1, true);
  db.pprofiles.push({ org_id: SUMMIT, about: 'A bouldering and rope-climbing gym in Corktown, with youth teams and classes for beginners.', logo_path: null,
    plan_requested: 'local_rewards', plan_requested_at: at(-1), updated_at: at(-1) });

  // Lakeview College: a community college, registered three days ago, waiting to be checked.
  const ana = person('5a1f0201-82aa-4c1d-8e2f-900000000000', 'Ana', 'ana.ruiz@lakeview.example', 5);
  const dmitri = person('5a1f0202-82aa-4c1d-8e2f-900000000000', 'Dmitri', 'dmitri@lakeview.example', 5);
  orgRow({ id: LAKEVIEW, kind: 'college', name: 'Lakeview College', status: 'pending', created_by: ana, created_at: at(-3, -5),
    legal_name: 'Lakeview Community College', website: 'https://lakeview.example', contact_email: 'wellbeing@lakeview.example',
    contact_phone: '+1 734 555 0123', street: '4800 E Huron River Drive', city: 'Ann Arbor', region: 'MI', postal_code: '48105' });
  db.domains.push({ org_id: LAKEVIEW, domain: 'lakeview.example', verified_by: ana, verified_at: at(-3) });
  join(LAKEVIEW, ana, 'staff', 3, true);
  join(LAKEVIEW, dmitri, 'staff', 2, true);

  // Brightpath Tutoring: paused by InneRISE at its owner's request.
  const rae = person('5a1f0301-82aa-4c1d-8e2f-900000000000', 'Rae', 'rae@brightpath.example', 200);
  orgRow({ id: BRIGHTPATH, kind: 'business', name: 'Brightpath Tutoring', status: 'suspended', verified_at: at(-180), created_by: rae, created_at: at(-190),
    legal_name: 'Brightpath Learning Services, Inc.', website: 'https://brightpath.example', contact_email: 'office@brightpath.example',
    city: 'Lansing', region: 'MI', verified_note: 'Paused at the owner\'s request while the business changes hands.' });
  join(BRIGHTPATH, rae, 'employee', 190, true);

  // Riverside Schools came in two days ago: a second administrator signed up with it.
  const nadia = person('5a1f0401-82aa-4c1d-8e2f-900000000000', 'Nadia', 'nadia@riversideschools.example', 2);
  join(refs.riverside, nadia, 'staff', 2, true);

  // Peak Fitness: accepted the Sponsor Reward Terms, and changed its approved 10-class pack offer (its new Cycle the Riverfront
  // challenge waits for review already).
  db.sponsorTerms.push({ org_id: refs.peak, version: db.challengeLimits.sponsor_terms_version, accepted_by: refs.ids.Alex, accepted_at: at(-40) });
  const pack = db.campaigns.find((c) => c.id === PEAK_TEN_PACK);
  if (pack) Object.assign(pack, { revision: { title: '25% off a 10-class pack', summary: 'Show your code at the front desk for 25% off any 10-class pack, now through the new year.',
    ends_on: new Date(Date.parse(`${pack.ends_on}T00:00:00Z`) + 21 * DAY).toISOString().slice(0, 10) }, revision_at: at(0, -5), updated_at: at(0, -5) });

  // The library: one template InneRISE's team wrote, still a draft.
  db.library.push({ id: SCREEN_FREE_TEMPLATE, org_id: null, kind: 'challenge', status: 'draft', title: 'Phone-free family dinners',
    description: 'Keep phones off the table at dinner. Tap Done on each evening you do.', for_kinds: ['business', 'college', 'district', 'school'],
    age_groups: ['adults', 'children', 'teens'], tracking: 'self_checkin', metric: 'positive_habit', mode: 'participation', daily_goal: null,
    target: 10, days: 21, sides: null, reward_kind: null, earns: null, top_n: null, quantity: null, created_by: refs.me, created_at: at(-2), updated_at: at(-2) });
  return db;
}

// The functions ---------------------------------------------------------------------------------------------------------
// h: db(), me(), org(o), unitOf(u), hasRole(o, uid, roles, u).
export function staffFunctions(h) {
  const D = () => h.db();
  const isStaff = () => !!h.me() && (D().staff || []).includes(h.me());
  // 082: every staff call raises not_staff (P0001) for anyone who isn't InneRISE staff, before it does anything.
  const notStaff = () => { throw Object.assign(new Error('not_staff'), { code: 'P0001' }); };
  const firstName = (uid) => (D().users[uid] && String(D().users[uid].first_name || '').trim()) || null;
  const activeMembers = (o) => D().members.filter((m) => m.org_id === o && m.status === 'active');
  const libraryJson = (t) => {
    const base = { id: t.id, own: t.org_id != null, kind: t.kind, title: t.title, description: t.description, for_kinds: [...t.for_kinds],
      age_groups: [...t.age_groups] };
    const habitLabel = { device: 'Verified activity from a phone or watch', self_checkin: 'Self check-in: the person taps Done for the day',
      staff_confirmed: 'Confirmed by a teacher or manager' }[t.tracking] || null;
    return t.kind === 'challenge'
      ? { ...base, tracking: t.tracking, tracking_label: habitLabel, metric: t.tracking === 'device' ? t.metric : null,
        habit: t.tracking !== 'device' ? t.metric : null, mode: t.mode, daily_goal: t.daily_goal, target: t.target, days: t.days, sides: t.sides }
      : { ...base, reward_kind: t.reward_kind, earns: t.earns, top_n: t.top_n, quantity: t.quantity, fits_habits: ['goal', 'finish'].includes(t.earns) };
  };
  const orgJson = (g) => ({
    id: g.id, name: g.name, kind: g.kind, status: g.status, created_at: g.created_at, time_zone: g.time_zone, website: g.website,
    contact_email: g.contact_email, country: g.country, legal_name: g.legal_name, verified_note: g.verified_note ?? null,
    verified_at: g.verified_at ?? null, contact_phone: g.contact_phone ?? null, city: g.city ?? null, region: g.region ?? null,
    offers_workplace: !!g.offers_workplace, offers_challenges: !!g.offers_challenges,
    member_count: activeMembers(g.id).length,
    pending_member_count: D().members.filter((m) => m.org_id === g.id && m.status === 'pending').length,
    admins: D().roles.filter((r) => r.org_id === g.id && r.role === 'admin' && activeMembers(g.id).some((m) => m.user_id === r.user_id))
      .sort((a, b) => (a.granted_at < b.granted_at ? -1 : a.granted_at > b.granted_at ? 1 : a.user_id < b.user_id ? -1 : 1))
      .map((r) => ({ user_id: r.user_id, first_name: firstName(r.user_id), email: (D().users[r.user_id] || {}).email || null })),
    email_domains: D().domains.filter((x) => x.org_id === g.id).map((x) => x.domain).sort(),
  });

  const fns = {
    innerise_is_staff() {
      return isStaff();
    },

    staff_overview() {
      if (!isStaff()) notStaff();
      const db = D();
      return {
        orgs_waiting: db.orgs.filter((g) => g.status === 'pending').length,
        partners_waiting: db.orgs.filter((g) => g.status === 'pending' && g.kind === 'partner').length,
        campaigns_waiting: db.campaigns.filter((c) => c.status === 'submitted' || (c.status === 'approved' && c.revision != null)).length,
        library_waiting: db.library.filter((t) => t.org_id == null && t.status === 'draft').length,
        logos_waiting: (db.prize.givers || []).filter((x) => x.logo_state === 'waiting').length,
        terms_waiting: (db.prize.terms || []).filter((t) => t.state === 'waiting').length,
      };
    },

    staff_org_list({ st = 'pending', q = null, lim = 50, off = 0 }) {
      if (!isStaff()) notStaff();
      if (st != null && !ORG_STATUSES.includes(st)) return err('status');
      const needle = (txt(q) || '').trim().toLowerCase();
      const limit = Math.max(1, Math.min(lim == null ? 50 : Number(lim), 200));
      const offset = Math.max(0, off == null ? 0 : Number(off));
      const oldest = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);
      const hits = D().orgs.filter((g) => (st == null || g.status === st)
        && (!needle || [g.name, g.legal_name].some((x) => x && String(x).toLowerCase().includes(needle))))
        .sort((a, b) => (st === 'pending' ? oldest(a, b) : -oldest(a, b)) || (a.id < b.id ? -1 : 1));
      return { total: hits.length, rows: hits.slice(offset, offset + limit).map(orgJson) };
    },

    // 068's org_staff_set_status: verified_at the first time it is active; a trimmed note, an empty one keeps the old one.
    staff_org_set_status({ o, st, note }) {
      if (!isStaff()) notStaff();
      if (!['active', 'suspended', 'closed'].includes(st)) return err('status');
      const g = h.org(o);
      if (!g) return err('not_found');
      const n = (txt(note) || '').trim() || null;
      if (n != null && n.length > 200) return err('note');
      g.status = st;
      if (st === 'active' && !g.verified_at) g.verified_at = new Date().toISOString();
      if (n) g.verified_note = n;
      return { ok: true, status: g.status, verified_at: g.verified_at ?? null };
    },

    staff_library_list({ st = null }) {
      if (!isStaff()) notStaff();
      return D().library.filter((t) => t.org_id == null && (st == null || t.status === st))
        .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1))
        .map((t) => ({ ...libraryJson(t), status: t.status, created_at: t.created_at, updated_at: t.updated_at }));
    },

    staff_library_set_status({ template, st }) {
      if (!isStaff()) notStaff();
      if (st == null || !['draft', 'published', 'retired'].includes(st)) return err('status');
      const t = D().library.find((x) => x.id === template && x.org_id == null);
      if (!t) return err('not_found');
      Object.assign(t, { status: st, updated_at: new Date().toISOString() });
      return { ok: true, status: st };
    },

    // The Reports section: active members in each place, each count under the smallest group hidden, and the counts that
    // would give one away hidden too (082's rule). Managers and teachers get the administrators' numbers for their places.
    org_report_places({ o }) {
      const uid = h.me();
      const g = h.org(o);
      if (!g) return err('not_found');
      if (g.status === 'suspended' || g.status === 'closed') return err(g.status);
      const whole = h.hasRole(o, uid, ['admin']);
      const all = D().units.filter((x) => x.org_id === o);
      const mine = whole ? null : new Set(all.filter((x) => h.hasRole(o, uid, ['unit_manager', 'teacher'], x.id)).map((x) => x.id));
      if (mine && !mine.size) return err('not_allowed');
      const n = g.min_report_group;
      // Every place, deepest first (each before the place above it), as 082 orders them; the organization is the last node.
      const depth = new Map();
      const walk = (parent, d) => all.filter((x) => (x.parent_id || null) === parent).forEach((x) => { if (d < 50) { depth.set(x.id, d); walk(x.id, d + 1); } });
      walk(null, 0);
      const ids = [...depth.keys()].sort((x, y) => depth.get(y) - depth.get(x) || (x < y ? -1 : 1));
      const at = new Map(ids.map((id, i) => [id, i]));
      const active = new Set(activeMembers(o).map((m) => m.user_id));
      const people = D().unitMembers.filter((m) => m.org_id === o && active.has(m.user_id));
      const under = (id) => {
        const out = [id];
        for (let i = 0; i < out.length; i++) all.filter((x) => x.parent_id === out[i]).forEach((x) => out.push(x.id));
        return new Set(out);
      };
      const k = ids.length;
      const par = [...ids.map((id) => { const u = all.find((x) => x.id === id); return u.parent_id && at.has(u.parent_id) ? at.get(u.parent_id) : k; }), -1];
      const notPlaced = [...active].filter((u) => !D().unitMembers.some((m) => m.org_id === o && m.user_id === u)).length;
      const a = [...ids.map((id) => people.filter((m) => m.unit_id === id).length), notPlaced];
      const t = [...ids.map((id) => { const s = under(id); return new Set(people.filter((m) => s.has(m.unit_id)).map((m) => m.user_id)).size; }), active.size];
      const hide = reportHide(n, par, a, t);
      const cell = (state, v) => [state === 's' ? v : null, state === 'f' ? n : null, state === 'f' ? 'fewer_than' : state === 'p' ? 'protects' : null];
      const places = ids.filter((id) => whole || mine.has(id)).map((id) => {
        const u = all.find((x) => x.id === id);
        const i = at.get(id);
        const [direct, directFewer, directHidden] = cell(hide.a[i], a[i]);
        const [below, belowFewer, belowHidden] = cell(hide.t[i], t[i]);
        return { id, name: u.name, kind: u.kind, parent_id: u.parent_id, has_children: all.some((x) => x.parent_id === id),
          direct, below, direct_fewer_than: directFewer, below_fewer_than: belowFewer, direct_hidden: directHidden, below_hidden: belowHidden };
      }).sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }) || (x.id < y.id ? -1 : 1));
      const [total, totalFewer, totalHidden] = whole ? cell(hide.t[k], t[k]) : [null, null, 'not_in_scope'];
      const [np, npFewer, npHidden] = whole ? cell(hide.a[k], a[k]) : [null, null, 'not_in_scope'];
      return { ok: true, org_id: o, min_group: n, scope: whole ? 'organization' : 'places',
        total_active: total, total_active_fewer_than: totalFewer, total_active_hidden: totalHidden,
        not_placed: np, not_placed_fewer_than: npFewer, not_placed_hidden: npHidden, places };
    },
  };
  return { fns };
}

// 082's org_report_hide, as it is (0-based here). Nodes: every place before the place above it, then the organization (a: people
// in no place, t: its active members); par: the node above (-1 for the organization). a: people placed directly; t: people in
// the place and under it, each once. One letter per node: s shown, f fewer than n, p hidden to protect a small group.
export function reportHide(n, par, a, t) {
  const k = par.length;
  if (!k) return { a: [], t: [] };
  const kids = Array.from({ length: k }, () => []);
  par.forEach((p, i) => { if (p >= 0) kids[p].push(i); });
  const sa = a.map((x) => (x >= n ? 's' : 'f'));
  const st = t.map((x) => (x >= n ? 's' : 'f'));
  const gsum = new Array(k).fill(0);
  const gshown = new Array(k).fill(0);
  const gnz = new Array(k).fill(false);
  const gg = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    if ((!kids[i].length && i < k - 1) || st[i] !== 's') continue;
    // This shown sum's hidden parts (a place hidden to protect below brings its own hidden parts) and its shown parts.
    let sumh = 0; let shown = 0; let nz = false; let ng = 0;
    const cv = []; const ci = [];
    if (sa[i] === 's') { shown += a[i]; cv.push(a[i]); ci.push(i); } else { sumh += a[i]; nz = nz || a[i] > 0; }
    for (const c of kids[i]) {
      if (!kids[c].length) {
        if (sa[c] === 's') { shown += a[c]; cv.push(a[c]); ci.push(c); } else { sumh += a[c]; nz = nz || a[c] > 0; }
      } else if (st[c] === 's') shown += t[c];
      else if (st[c] === 'f') { sumh += t[c]; nz = nz || t[c] > 0; }
      else { sumh += gsum[c]; shown += gshown[c]; nz = nz || gnz[c]; ng += gg[c] + (gshown[c] > 0 ? 0 : 1); }
    }
    const ov = sumh - (t[i] - shown); // people counted in two parts of this sum
    if (!nz && (ov === 0 || ov >= n)) continue;
    // One part hidden to protect: the smallest that is enough on its own.
    let best = -1;
    cv.forEach((v, j) => { if ((!nz || sumh + v >= (n - 1) + n * (1 + ng)) && (best < 0 || v < cv[best])) best = j; });
    if (best >= 0) { sa[ci[best]] = 'p'; continue; }
    // Otherwise the largest first, until enough.
    const ord = cv.map((v, j) => j).sort((x, y) => cv[y] - cv[x] || x - y);
    let nq = 0; let s2 = sumh;
    const pick = [];
    for (const j of ord) { nq += 1; s2 += cv[j]; pick.push(j); if (s2 >= (n - 1) + n * (nq + ng)) break; }
    if (nq > 0 && s2 >= (n - 1) + n * (nq + ng)) pick.forEach((j) => { sa[ci[j]] = 'p'; });
    else { st[i] = 'p'; gsum[i] = sumh; gshown[i] = shown; gnz[i] = nz; gg[i] = ng; } // the sum is hidden; its parts join the one above
  }
  for (let i = 0; i < k - 1; i++) if (!kids[i].length) st[i] = sa[i]; // a place with nothing under it: one count
  return { a: sa, t: st };
}
