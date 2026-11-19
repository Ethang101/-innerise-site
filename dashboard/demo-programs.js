// InneRISE Dashboard demo: organization Challenges and Rewards (072_company_challenges.sql) and InneRISE Partners
// (074_partners.sql), in memory, with made-up sample data. Loaded by demo.js; nothing leaves the browser.
//
// Every function here mirrors its SQL: the same argument names, the same order of checks, the same error codes, the
// same rounding and "fewer than N" floors, and the same children's rules. The engine's daily numbers (activity_apply,
// challenge_days) aren't simulated: each participant carries the score the engine would give them so far.
//
// 072 follows the revised file (17 Nov, 09:40; the 09:59 change only keeps a partner's reward claim out of its log by
// name, nothing the portal calls): counts through org_challenge_count ("fewer than N" below the smallest
// group; "at least X" for a part of those who joined with fewer than N left out; otherwise the nearest 5, never below 5),
// in the report, the list and the rewards; side averages only once final; children's rules for anyone who isn't an active
// adult member now (org_challenge_adult); codes_left not shown once a reward is earned, and codes_short.
// 074 follows the revised file (17 Nov, 09:48): plans local_rewards, regional and national; paused is a flag beside the
// status; editing an approved campaign keeps it live with its changes as a revision for InneRISE, and editing one that
// waits for review keeps it waiting; a pool needs a code for each one it gives out (codes_short, with how many are
// missing); a sponsored Challenge's settings are checked again when it is sent; a rewards manager may pause a reward offer,
// and only an administrator sends, changes, resumes or withdraws one once sent; an offer starts today or later; counts
// as 072's org_challenge_count, and redemptions exact.
// Both follow the 17 Nov update (no size limits; regions and districts; groups of sides; final rounds): no fixed ceiling on
// people, running challenges, rewards, top N, how many of a reward, codes or campaigns unless InneRISE sets one in
// org_challenge_limits (db.challengeLimits, all null by default but max_days 365 and 5,000 codes a call); unit kinds region
// and district; group_kind, each group's standing, each_group rewards; final rounds (final_of, advance, advance_n), whose
// finalists are worked out from the first round's final results (org_challenge_finalists_set).
// The Prize Wallet round (078's 072/074 changes): an offer's per_person is 1 or more with no upper bound; final_of carries
// the first round's group_kind; 074's counter is two steps (partner_redeem_check, _confirm, _status), in demo-prizes.js.
// The Sponsor Reward Terms (072's terms round): an administrator accepts the current version for the organization
// (org_sponsor_terms_state, org_sponsor_terms_accept); until then org_reward_codes_add (and 078's prize_terms_set) answer
// sponsor_terms. Northside Health and Lakeshore Auto Group have accepted them; Peak Fitness and Riverside Schools haven't.

const DAY = 864e5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIDE_KINDS = ['location', 'department', 'team', 'school', 'campus', 'grade', 'classroom', 'college', 'program', 'group', 'region', 'district'];
// 072's org_challenge_limits (one row, InneRISE staff only): null = no limit. The defaults, as the SQL sets them.
// sponsor_terms_version: the current Sponsor Reward Terms' label (a placeholder until InneRISE sets the real one; never shown).
export const CHALLENGE_LIMITS = { max_people: null, max_days: 365, max_active: null, max_top_n: null, max_quantity: null, max_codes: null,
  max_codes_per_add: 5000, sponsor_terms_version: 'draft-pending-attorney' };
const limitsOf = (db) => db.challengeLimits || CHALLENGE_LIMITS;
// org_sponsor_terms_ok: has the organization accepted the current version?
export const sponsorTermsOk = (db, o) => (db.sponsorTerms || []).some((t) => t.org_id === o && t.version === limitsOf(db).sponsor_terms_version);
const METRICS = ['steps', 'walk_run_distance', 'cycling_distance', 'floors'];
const HEALTH_LIMIT = { steps: 100000, walk_run_distance: 120000, cycling_distance: 400000, floors: 500 }; // 039
const PLANS = ['local_rewards', 'regional', 'national'];
const RULE_KEYS = ['metric', 'mode', 'daily_goal', 'target', 'days', 'starts_on', 'max_people'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Signatures, as demo.js checks them (PostgREST: wrong or missing argument names find no function).
export const PROGRAM_SIGNATURES = {
  org_challenge_create: { args: ['o', 'd'], required: ['o', 'd'], uuids: ['o'] },
  org_challenge_edit: { args: ['ch', 'd'], required: ['ch', 'd'], uuids: ['ch'] },
  org_challenge_cancel: { args: ['ch'], required: ['ch'], uuids: ['ch'] },
  org_challenge_list: { args: ['o'], required: ['o'], uuids: ['o'] },
  org_challenge_report: { args: ['ch', 'max_rows', 'skip'], required: ['ch'], uuids: ['ch'] },
  org_reward_set: { args: ['ch', 'reward', 'd'], required: ['ch', 'reward', 'd'], uuids: ['ch', 'reward'] },
  org_reward_approve: { args: ['reward', 'yes'], required: ['reward', 'yes'], uuids: ['reward'] },
  org_reward_remove: { args: ['reward'], required: ['reward'], uuids: ['reward'] },
  org_reward_codes_add: { args: ['reward', 'codes'], required: ['reward', 'codes'], uuids: ['reward'] },
  org_reward_status: { args: ['ch'], required: ['ch'], uuids: ['ch'] },
  org_reward_given: { args: ['earned'], required: ['earned'], ints: ['earned'] },
  org_sponsor_terms_state: { args: ['o'], required: ['o'], uuids: ['o'] },
  org_sponsor_terms_accept: { args: ['o', 'version'], required: ['o', 'version'], uuids: ['o'] },
  partner_options: { args: [], required: [] },
  partner_profile_set: { args: ['o', 'd'], required: ['o', 'd'], uuids: ['o'] },
  partner_plan_set: { args: ['o', 'plan'], required: ['o', 'plan'], uuids: ['o'] },
  partner_overview: { args: ['o'], required: ['o'], uuids: ['o'] },
  partner_campaign_create: { args: ['o', 'k', 'd'], required: ['o', 'k', 'd'], uuids: ['o'] },
  partner_campaign_edit: { args: ['campaign', 'd'], required: ['campaign', 'd'], uuids: ['campaign'] },
  partner_campaign_submit: { args: ['campaign'], required: ['campaign'], uuids: ['campaign'] },
  partner_campaign_withdraw: { args: ['campaign'], required: ['campaign'], uuids: ['campaign'] },
  partner_campaign_pause: { args: ['campaign', 'pause'], required: ['campaign', 'pause'], uuids: ['campaign'] },
  partner_campaign_list: { args: ['o'], required: ['o'], uuids: ['o'] },
  partner_campaign_details: { args: ['campaign'], required: ['campaign'], uuids: ['campaign'] },
  partner_campaign_report: { args: ['campaign'], required: ['campaign'], uuids: ['campaign'] },
  partner_codes_add: { args: ['campaign', 'codes'], required: ['campaign', 'codes'], uuids: ['campaign'] },
  // InneRISE administration (082): 074's partner_staff_queue, _approve and _reject for a signed-in InneRISE staff member.
  staff_partner_queue: { args: [], required: [] },
  staff_partner_decide: { args: ['campaign', 'approve', 'note'], required: ['campaign', 'approve', 'note'], uuids: ['campaign'] },
};

// Dates ---------------------------------------------------------------------------------------------
export function dayIn(tz, plus = 0, at = Date.now()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at + plus * DAY));
  } catch {
    return new Date(at + plus * DAY).toISOString().slice(0, 10);
  }
}
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const earliestDay = () => dayIn('Etc/GMT+12'); // the last place on Earth where it's still today
const latestDay = () => dayIn('Etc/GMT-14'); // the first place where it's already today

// Postgres casts from jsonb ->> text: a bad value raises, which the functions turn into an error code.
class CastError extends Error {}
const txt = (v) => (v == null ? null : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v));
function asInt(v) {
  const s = txt(v);
  if (s == null) return null;
  if (!/^\s*[+-]?\d+\s*$/.test(s)) throw new CastError();
  return Number(s);
}
function asNum(v) {
  const s = txt(v);
  if (s == null) return null;
  if (!/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(s)) throw new CastError();
  return Number(s);
}
function asBool(v) { // Postgres' boolean input
  const s = txt(v);
  if (s == null) return null;
  const t = s.trim().toLowerCase();
  if (['t', 'true', 'y', 'yes', 'on', '1'].includes(t)) return true;
  if (['f', 'false', 'n', 'no', 'off', '0'].includes(t)) return false;
  throw new CastError();
}
function asDate(v) {
  const s = txt(v);
  if (s == null) return null;
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`)) || new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) !== t) {
    throw new CastError();
  }
  return t;
}
// 070's org_field: is the key there, and its trimmed text ("" counts as none).
const fieldOf = (d, k) => ({ present: Object.prototype.hasOwnProperty.call(d, k), val: (txt(d[k]) || '').trim() || null });
const err = (code) => ({ error: code });
const isObj = (d) => d != null && typeof d === 'object' && !Array.isArray(d);
const len = (s) => [...String(s)].length;

// Sample data ----------------------------------------------------------------------------------------
const FIRST_NAMES = ['Maya', 'Liam', 'Zoe', 'Ethan', 'Ava', 'Noel', 'Isla', 'Leo', 'Ruby', 'Owen', 'Lucy', 'Felix', 'Hazel', 'Miles',
  'Ivy', 'Jonah', 'Clara', 'Elias', 'Nora', 'Caleb', 'Stella', 'Rowan', 'Alice', 'Henry', 'Violet', 'Jack', 'Eden', 'Simon', 'Leah',
  'Adam', 'Iris', 'Hugo', 'June', 'Max', 'Rose', 'Toby', 'Gemma', 'Arlo', 'Willa', 'Kai', 'Lena', 'Reid', 'Paige', 'Dylan', 'Freya',
  'Gavin', 'Holly', 'Ian', 'Jade', 'Kurt', 'Lila', 'Mason', 'Nell', 'Oscar', 'Pia', 'Quinn', 'Ralph', 'Sara', 'Tyler', 'Uma'];

// refs: the people and places demo.js made (ids by first name, unit ids by short name).
export function seedPrograms(db, start, refs) {
  const now = Date.now();
  Object.assign(db, {
    challenges: [], cpart: [], rewards: [], earned: [], rcodes: [], consents: [],
    campaigns: [], pclaims: [], pcodes: [], pchallengePeople: [], predeem: [], pstats: [], pprofiles: [], pusage: [],
    partnerSettings: { hide_from_under_18: true }, seq: { earned: 100, rcode: 1000, claim: 500, pcode: 5000, redeem: 300 },
    challengeLimits: { ...CHALLENGE_LIMITS }, sponsorTerms: [],
  });
  if (start === 'new') return db; // Sam has no organization yet: nothing running, nothing to show
  const { ids } = refs;
  const at = (days) => new Date(now + days * DAY).toISOString();
  // The Sponsor Reward Terms: Northside Health accepted them (Alex, its administrator); so did Lakeshore Auto Group, below.
  const acceptTerms = (org, by, days) => db.sponsorTerms.push({ org_id: org, version: CHALLENGE_LIMITS.sponsor_terms_version, accepted_by: by, accepted_at: at(days) });
  acceptTerms(refs.northside, ids.Alex, -58);
  const consent = (org, name, kind, granted) => db.consents.push({ org_id: org, user_id: ids[name] || name, kind, granted, at: at(-60) });
  let n = 0;
  const cid = (k) => `c4a0${String(k).padStart(4, '0')}-1e2f-4a3b-8c4d-${String(++n).padStart(12, '0')}`;

  // A challenge exactly as org_challenge_create leaves it.
  const challenge = (org, tz, c) => {
    const st = dayIn(tz, c.startIn);
    const row = { id: c.id || cid(1), org_id: org, unit_id: c.unit || null, title: c.title, description: c.description || null,
      metric: c.metric, mode: c.mode, goal: c.mode === 'goal' ? c.daily_goal : c.mode === 'participation' ? 1 : null,
      target: c.target ?? null, days: c.days, starts_on: st, ends_on: addDays(st, c.days - 1), status: c.status || 'active',
      cancelled_running: false, side_kind: c.sides || null, max_people: c.max_people ?? null, group_kind: c.group_kind || null,
      final_of: c.final_of || null, advance: c.advance || null, advance_n: c.advance_n ?? null, finalists: [], created_by: c.by, created_at: at(c.made) };
    db.challenges.push(row);
    if (row.final_of) finalistsSet(db, row.id);
    return row;
  };
  // Someone in it: their score so far as the engine counts it (days for participation and goal, the amount for total).
  const joined = (ch, uid, score, extra = {}) => db.cpart.push({ challenge_id: ch.id, user_id: uid, status: 'accepted', share_progress: true,
    joined_on: ch.starts_on, score, active_days: extra.active ?? (ch.mode === 'total' ? (score > 0 ? Math.min(ch.days, 6 + (score % 9)) : 0) : score),
    best: extra.best ?? Math.max(0, Math.min(score, 3 + (score % 4))), side_unit: extra.side || null,
    group_unit: ch.group_kind && extra.side ? groupOf(db, extra.side, ch.group_kind) : null });
  const reward = (ch, r) => {
    const row = { id: r.id || cid(2), challenge_id: ch.id, org_id: ch.org_id, title: r.title, description: r.description || null,
      kind: r.kind || 'prize', earns: r.earns, top_n: r.earns === 'top_n' ? r.top_n : null, quantity: r.quantity ?? null, each_group: !!r.each_group,
      created_by: r.by, created_at: at(r.made ?? -8), approved_by: r.approved ? r.approvedBy : null, approved_at: r.approved ? at(r.made ?? -8) : null,
      awarded_at: null };
    db.rewards.push(row);
    return row;
  };
  const codes = (rw, list) => list.forEach((code) => db.rcodes.push({ id: ++db.seq.rcode, reward_id: rw.id, code, added_by: rw.created_by,
    added_at: at(-7), earned_id: null, assigned_at: null }));

  // Northside Health ---------------------------------------------------------------------------------
  const NS = refs.northside;
  const nsTz = 'America/Detroit';
  // Who shares their challenge results with their managers (068's consent 'manager_reporting'); everyone takes part.
  ['Alex', 'Maria', 'Dev', 'Priya', 'Hannah', 'Luis', 'Grace', 'Omar', 'Chloe', 'Sofia', 'Carlos', 'Mei'].forEach((p) => consent(NS, p, 'manager_reporting', true));
  ['Ben', 'Jamal', 'Aisha', 'Nina'].forEach((p) => consent(NS, p, 'manager_reporting', false));
  Object.keys(ids).forEach((p) => consent(NS, p, 'challenges', true));

  const ch1 = challenge(NS, nsTz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000101', unit: refs.riv, title: 'Nursing vs Front desk steps',
    description: 'Riverside clinic, department against department: count the days you reach 7,000 steps. The department with the best average wins.',
    metric: 'steps', mode: 'goal', daily_goal: 7000, target: 20, days: 28, startIn: -9, sides: 'department', by: ids.Alex, made: -14 });
  [['Priya', 7, refs.rivN], ['Aisha', 9, refs.rivN], ['Jamal', 4, refs.rivN], ['Sofia', 8, refs.rivN], ['Mei', 6, refs.rivN],
    ['Hannah', 8, refs.rivF], ['Ben', 5, refs.rivF], ['Tessa', 6, refs.rivF], ['Carlos', 9, refs.rivF], ['Nina', 3, refs.rivF]]
    .forEach(([p, s, side]) => joined(ch1, ids[p], s, { side, active: Math.min(10, s + 1) }));
  reward(ch1, { title: 'Team breakfast for the winning department', description: 'Breakfast for everyone on the winning side, the morning after it ends.',
    earns: 'side', by: ids.Alex, approved: true, approvedBy: ids.Alex, made: -13 });
  const shoes = reward(ch1, { title: 'Running store voucher', description: 'A voucher from a running store near the clinic, for the top three.',
    earns: 'top_n', top_n: 3, quantity: 3, by: ids.Dev, approved: true, approvedBy: ids.Alex, made: -12 });
  codes(shoes, ['RUN-4KQ8-T2', 'RUN-7PX3-M9', 'RUN-2HW6-C5']);

  const ch2 = challenge(NS, nsTz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000102', title: 'October stair climb',
    description: 'Take the stairs: every floor counts. Climb 150 floors in the month to earn the certificate.',
    metric: 'floors', mode: 'total', target: 150, days: 31, startIn: -47, status: 'finished', by: ids.Dev, made: -55 });
  [['Alex', 182], ['Maria', 240], ['Dev', 95], ['Priya', 160], ['Luis', 210], ['Grace', 130], ['Omar', 0], ['Chloe', 175], ['Hannah', 120],
    ['Sofia', 155], ['Tessa', 200], ['Carlos', 60]].forEach(([p, s]) => joined(ch2, ids[p], s));
  const champ = reward(ch2, { title: 'Stair champion', description: 'Two extra days off, for whoever climbs the most.', earns: 'winner', quantity: 1,
    by: ids.Dev, approved: true, approvedBy: ids.Alex, made: -54 });
  const cert = reward(ch2, { title: 'Stair climber certificate', kind: 'recognition', description: 'A certificate for everyone who climbs 150 floors.',
    earns: 'goal', by: ids.Dev, approved: true, approvedBy: ids.Alex, made: -54 });
  // Three prizes with Prize Wallet terms (078, demo-prizes.js): used at the counter, picked up or delivered, or claimed by email.
  reward(ch2, { id: 'c4a00002-1e2f-4a3b-8c4d-000000000111', title: 'Chair massage', description: 'A 20-minute chair massage at the clinic, for the top three.',
    earns: 'top_n', top_n: 3, quantity: 3, by: ids.Dev, approved: true, approvedBy: ids.Alex, made: -54 });
  reward(ch2, { id: 'c4a00002-1e2f-4a3b-8c4d-000000000112', title: 'Wellness kit', description: 'A wellness kit for everyone who climbs 150 floors.',
    earns: 'goal', by: ids.Dev, approved: true, approvedBy: ids.Alex, made: -54 });
  // Claimed by email: the winner writes to the clinic's wellness team to book it (078's fulfillment 'contact').
  reward(ch2, { id: 'c4a00002-1e2f-4a3b-8c4d-000000000113', title: 'Nutrition consult', description: 'A 30-minute nutrition consult with a dietitian, for whoever climbs the most.',
    earns: 'winner', quantity: 1, by: ids.Dev, approved: true, approvedBy: ids.Alex, made: -54 });
  // It ended, so its rewards were earned (org_challenge_award); some people have claimed theirs and some were handed over.
  award(db, ch2.id);
  const got = (w, name, claimed, given) => {
    const e = db.earned.find((x) => x.reward_id === w.id && x.user_id === ids[name]);
    if (e && claimed != null) e.claimed_at = at(claimed);
    if (e && given != null) Object.assign(e, { given_at: at(given), given_by: ids.Dev });
  };
  got(champ, 'Maria', -14, -12);
  got(cert, 'Alex', -15, -12);
  got(cert, 'Priya', -13, null);
  got(cert, 'Tessa', -14, null);
  got(cert, 'Chloe', -11, -10);

  const ch3 = challenge(NS, nsTz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000103', title: 'Winter step challenge',
    description: 'Six weeks of moving every day. Downtown office against Riverside clinic: the location with the most active days per person wins.',
    metric: 'steps', mode: 'participation', target: 30, days: 42, startIn: 12, sides: 'location', by: ids.Dev, made: -2 });
  reward(ch3, { title: 'Lunch for the winning location', description: 'Lunch delivered to everyone at the winning location.', earns: 'side', by: ids.Dev, made: -1 });

  challenge(NS, nsTz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000104', title: 'Bike to work week', metric: 'cycling_distance', mode: 'total',
    days: 5, startIn: -30, status: 'cancelled', by: ids.Dev, made: -40 });

  // ?demo=manager: Jordan runs one for Sales, with a reward an administrator still has to approve.
  if (refs.sales) {
    consent(NS, ids.Jordan, 'manager_reporting', true);
    consent(NS, ids.Rosa, 'manager_reporting', true);
    const walks = challenge(NS, nsTz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000105', unit: refs.sales, title: 'Sales lunchtime walks',
      description: 'Two weeks of walking at lunch. Every day with a walk counts.', metric: 'steps', mode: 'participation', target: 8, days: 14,
      startIn: -3, by: ids.Jordan, made: -5 });
    joined(walks, ids.Jordan, 3);
    joined(walks, ids.Rosa, 2);
    joined(walks, ids.Theo, 4);
    reward(walks, { title: 'Coffee on the team', description: 'A coffee for everyone who takes part.', earns: 'finish', by: ids.Jordan, made: -4 });
  }

  // Lakeshore Auto Group (?demo=dealers): dealerships against each other, ranked within each region, and a final round -------
  if (refs.dealers) {
    const L = refs.dealers;
    const tz = 'America/Detroit';
    const P = L.people;
    acceptTerms(L.org, refs.me, -100);
    P.forEach((p) => consent(L.org, p.id, 'challenges', true));
    // Most share their results with their managers; every fourth doesn't.
    P.forEach((p) => consent(L.org, p.id, 'manager_reporting', p.k % 4 !== 0));
    // The fall round, finished: dealerships (locations) as sides, grouped by region. A store's people score around its base.
    const base = { dearborn: 18, troy: 14, grandRapids: 16, kalamazoo: 11, toledo: 15, findlay: 12, columbus: 17, dublin: 13 };
    const fall = challenge(L.org, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000401', title: 'Fall dealership step-off',
      description: 'Four weeks of 8,000-step days. Dealerships go head to head within each region; the top two of each region go through to the winter final.',
      metric: 'steps', mode: 'goal', daily_goal: 8000, target: 15, days: 28, startIn: -45, status: 'finished', sides: 'location', group_kind: 'region',
      by: L.ids.Marco, made: -50 });
    P.forEach((p, i) => {
      if (p.name === 'Wade' || p.name === 'Xavi') return; // two never joined
      const score = Math.max(0, Math.min(28, base[p.store] + ((i * 7 + 3) % 6) - 2));
      joined(fall, p.id, score, { side: p.unit, active: Math.min(28, score + 3) });
    });
    reward(fall, { title: 'Region champion trophy', kind: 'recognition', description: 'The trophy for the best dealership in each region, for everyone on its team.',
      earns: 'side', each_group: true, by: L.ids.Marco, approved: true, approvedBy: ids.Alex, made: -48 });
    reward(fall, { title: 'Detailing voucher', description: 'A full detail for the top three in each region.', earns: 'top_n', top_n: 3, each_group: true,
      quantity: 3, by: L.ids.Petra, approved: true, approvedBy: ids.Alex, made: -47 });
    award(db, fall.id);

    // The winter final: only the people of each region's top two dealerships can join.
    const final = challenge(L.org, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000402', title: 'Winter final: top dealerships',
      description: 'The top two dealerships of each region from the fall round. Active days count; the best dealership of each region wins the final.',
      metric: 'steps', mode: 'participation', target: 15, days: 21, startIn: -6, sides: 'location', group_kind: 'region',
      final_of: fall.id, advance: 'sides', advance_n: 2, by: L.ids.Marco, made: -9 });
    const finalists = new Set(db.challenges.find((x) => x.id === final.id).finalists);
    P.filter((p) => finalists.has(p.id)).forEach((p, i) => {
      if (i % 9 === 8) return; // a few haven't joined yet
      joined(final, p.id, Math.max(0, 6 - ((i * 5) % 4) + (p.store === 'columbus' ? 1 : 0) - (p.store === 'grandRapids' ? 1 : 0)), { side: p.unit });
    });
    reward(final, { title: 'Winter champion dinner', description: 'Dinner for the whole team of the best dealership in each region.', earns: 'side',
      each_group: true, by: L.ids.Marco, made: -5 });
    reward(final, { title: 'Final round finisher', kind: 'recognition', description: 'A badge for everyone who takes part in the final.', earns: 'finish',
      by: L.ids.Marco, approved: true, approvedBy: ids.Alex, made: -8 });

    // A spring final for people: the top three of each region in the fall round.
    challenge(L.org, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000403', title: 'Spring sales-floor sprint',
      description: 'The top three walkers of each region from the fall round, head to head for two weeks.', metric: 'steps', mode: 'total',
      days: 14, startIn: 30, final_of: fall.id, advance: 'people', advance_n: 3, by: L.ids.Marco, made: -2 });
  }

  // Riverside Schools (verified only in ?demo=district) -------------------------------------------------------
  if (refs.district) {
    const RS = refs.riverside;
    const tz = 'America/Detroit';
    const kids = refs.students; // name -> { id, unit, band }
    const by = (room) => Object.entries(kids).filter(([, k]) => k.unit === room).map(([name, k]) => [name, k.id]);
    const d1 = challenge(RS, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000201', unit: refs.lin, title: 'Lincoln Move More Month',
      description: 'Every day you move counts. Grade 3 and Grade 4 team up by grade: 15 active days earns the Move More certificate.',
      metric: 'steps', mode: 'participation', target: 15, days: 30, startIn: -12, sides: 'grade', by: ids.Elena, made: -16 });
    const grade3 = [...by(refs.r112), ...by(refs.r114)].slice(0, 12);
    const grade4 = by(refs.r201);
    grade3.forEach(([, uid], i) => joined(d1, uid, [9, 11, 6, 12, 8, 10, 7, 12, 5, 9, 11, 4][i], { side: refs.g3 }));
    grade4.forEach(([, uid], i) => joined(d1, uid, [10, 12, 8, 11, 9, 12, 7, 10, 6, 11][i], { side: refs.g4 }));
    reward(d1, { title: 'Class party for the winning grade', description: 'A class party for everyone in the most active grade.', earns: 'side',
      by: ids.Elena, approved: true, approvedBy: ids.Alex, made: -15 });
    reward(d1, { title: 'Move More certificate', kind: 'recognition', description: 'A certificate for 15 active days.', earns: 'goal',
      by: ids.Elena, approved: true, approvedBy: ids.Alex, made: -15 });

    const d2 = challenge(RS, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000202', unit: refs.r112, title: 'Room 112 stair climb',
      description: 'Ten floors a day for ten school days. Seven days at 10 floors earns a Stair Star.', metric: 'floors', mode: 'goal',
      daily_goal: 10, target: 7, days: 10, startIn: -25, status: 'finished', by: ids.Rachel, made: -28 });
    by(refs.r112).forEach(([, uid], i) => joined(d2, uid, [8, 7, 9, 5, 7, 10, 3, 6][i]));
    const star = reward(d2, { title: 'Stair Star badge', kind: 'recognition', description: 'A Stair Star badge in the app for seven days at 10 floors.',
      earns: 'goal', by: ids.Rachel, approved: true, approvedBy: ids.Alex, made: -27 });

    const d3 = challenge(RS, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000203', unit: refs.g7, title: 'Grade 7 step-up week',
      description: 'Five days at 6,000 steps in one week.', metric: 'steps', mode: 'goal', daily_goal: 6000, target: 5, days: 7, startIn: -2,
      by: ids.Marcus, made: -6 });
    by(refs.sci7).slice(0, 6).forEach(([, uid], i) => joined(d3, uid, [2, 1, 3, 2, 0, 3][i]));

    const d4 = challenge(RS, tz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000204', title: 'Walk to School Week',
      description: 'The whole district walks or rolls to school for a week. Schools go head to head on active days per student.',
      metric: 'steps', mode: 'participation', days: 5, startIn: 20, sides: 'school', by: ids.Elena, made: -1 });
    reward(d4, { title: 'Golden Sneaker trophy', kind: 'recognition', description: 'The trophy goes to the most active school for a year.', earns: 'side',
      by: ids.Elena, made: -1 });
    award(db, d2.id);
    const e = db.earned.filter((x) => x.reward_id === star.id);
    if (e[0]) { e[0].claimed_at = at(-14); e[0].given_at = at(-12); }
    if (e[1]) e[1].claimed_at = at(-13);
  }

  // Peak Fitness: drafts while it's being verified; a full history once it is (?demo=sponsor) --------------------
  const PK = refs.peak;
  const pkTz = 'America/Detroit';
  db.pprofiles.push({ org_id: PK, about: refs.sponsor ? 'A neighborhood gym in Midtown Detroit, with classes for every level.' : null, logo_path: null,
    plan_requested: refs.sponsor ? 'regional' : null, plan_requested_at: refs.sponsor ? at(-60) : null, updated_at: at(-60) });
  const camp = (c) => {
    const row = { id: c.id, org_id: PK, kind: c.kind, reward_type: c.reward_type || null, status: c.status, paused: !!c.paused,
      paused_at: c.paused ? at(c.made + 4) : null, revision: null, revision_at: null, title: c.title, summary: c.summary || null,
      link: c.link || null, image_path: null, country: c.country || null, region: c.region || null, city: c.city || null,
      starts_on: c.starts_on || null, ends_on: c.ends_on || null, rules: c.rules || null, challenge_id: c.challenge_id || null,
      for_campaign: c.for_campaign || null, earns: c.earns || null, quantity: c.quantity ?? null, per_person: c.per_person ?? null,
      code_source: c.code_source || null, reward_id: c.reward_id || null, review_note: c.review_note || null, created_by: ids.Alex,
      created_at: at(c.made), updated_at: at(c.made + 1), submitted_by: c.status === 'draft' ? null : ids.Alex,
      submitted_at: c.status === 'draft' ? null : at(c.made + 1), reviewed_at: c.reviewed ? at(c.made + 2) : null,
      approved_at: c.approved ? at(c.made + 2) : null };
    db.campaigns.push(row);
    return row;
  };
  const rules = (o) => ({ unit_id: null, metric: o.metric, mode: o.mode, scoring: o.mode === 'total' ? 'health_total' : 'health_goal',
    engine_goal: o.mode === 'goal' ? o.daily_goal : o.mode === 'participation' ? 1 : null, daily_goal: o.mode === 'goal' ? o.daily_goal : null,
    target: o.target ?? null, days: o.days, starts_on: o.starts_on, sides: null, max_people: o.max_people ?? null });

  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000301', kind: 'reward_offer', reward_type: 'offer', status: 'draft', title: 'Free guest week',
    summary: 'Bring a friend for a week of classes, free.', starts_on: dayIn(pkTz, 7), ends_on: dayIn(pkTz, 67), quantity: 300, per_person: 1,
    code_source: 'pool', country: 'US', region: 'MI', city: 'Detroit', made: -1 });
  const nyRules = rules({ metric: 'steps', mode: 'participation', target: 20, days: 31, starts_on: dayIn(pkTz, 45) });
  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000302', kind: 'sponsored_challenge', status: 'draft', title: 'New Year step challenge',
    summary: 'Start the year moving: 20 active days in January.', rules: nyRules, starts_on: nyRules.starts_on, ends_on: addDays(nyRules.starts_on, 30),
    country: 'US', region: 'MI', made: -1 });
  if (!refs.sponsor) return db;

  // Members of the public who joined or claimed (InneRISE accounts, not people in Peak Fitness).
  const publicUser = (i) => {
    const id = `9a1c${String(i).padStart(4, '0')}-5b6d-4e7f-8a9b-${String(700000000000 + i).slice(0, 12)}`;
    db.users[id] = { id, first_name: FIRST_NAMES[i % FIRST_NAMES.length], email: `member${i}@example.com`, email_confirmed_at: at(-200) };
    return id;
  };
  // The sponsored Challenge in the engine (072's organization challenge, the partner as its organization).
  const tenK = rules({ metric: 'steps', mode: 'goal', daily_goal: 10000, target: 20, days: 30, starts_on: dayIn(pkTz, -14) });
  const engine = challenge(PK, pkTz, { id: 'c4a00001-1e2f-4a3b-8c4d-000000000301', title: 'November 10K Steps',
    description: 'Hit 10,000 steps on 20 days this month. Everyone who makes it gets a free class at Peak Fitness.', metric: 'steps', mode: 'goal',
    daily_goal: 10000, target: 20, days: 30, startIn: -14, by: ids.Alex, made: -20 });
  for (let i = 1; i <= 48; i++) {
    const uid = publicUser(i);
    joined(engine, uid, (i * 7) % 15, { active: Math.min(15, ((i * 7) % 15) + 2) });
    db.pchallengePeople.push({ challenge_id: engine.id, user_id: uid, share_with_sponsor: i % 3 === 0, chosen_at: at(-10) });
  }
  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000303', kind: 'sponsored_challenge', status: 'approved', title: engine.title, summary: engine.description,
    link: 'https://peakfitness.example/10k', rules: tenK, starts_on: tenK.starts_on, ends_on: addDays(tenK.starts_on, 29), challenge_id: engine.id,
    country: 'US', region: 'MI', city: 'Detroit', review_note: 'Looks great. Approved as sent.', reviewed: true, approved: true, made: -20 });
  const pass = reward(engine, { id: 'c4a00002-1e2f-4a3b-8c4d-000000000301', title: 'Free class pass', description: 'One free class at any Peak Fitness studio.',
    earns: 'goal', quantity: 200, by: ids.Alex, approved: true, approvedBy: ids.Alex, made: -18 });
  codes(pass, Array.from({ length: 200 }, (_, i) => `PKC${String(i * 7919 % 100000).padStart(5, '0')}Q`));
  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000304', kind: 'reward_offer', reward_type: 'achievement', status: 'approved', title: 'Free class pass',
    summary: 'One free class at any Peak Fitness studio.', for_campaign: 'e7b10000-3c2d-4e1f-9a8b-000000000303', earns: 'goal', quantity: 200,
    code_source: 'generated', reward_id: pass.id, reviewed: true, approved: true, made: -18 });

  // A live offer with claims, codes given out and some used.
  const offer = camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000305', kind: 'reward_offer', reward_type: 'offer', status: 'approved',
    title: '20% off a 10-class pack', summary: 'Show your code at the front desk for 20% off any 10-class pack.', link: 'https://peakfitness.example/classes',
    starts_on: dayIn(pkTz, -20), ends_on: dayIn(pkTz, 40), quantity: 500, per_person: 1, code_source: 'generated', country: 'US', region: 'MI',
    reviewed: true, approved: true, made: -24 });
  const given = [['PKF7QM2XRA', 'Maya', true, null], ['PKH3TW9NBE', 'Liam', false, null], ['PKD8LC4VYU', 'Zoe', true, -3]];
  for (let i = 0; i < 46; i++) {
    const uid = i < 3 ? publicUser(100 + i) : publicUser(103 + i);
    if (i < 3) db.users[uid].first_name = given[i][1];
    const claim = { id: ++db.seq.claim, campaign_id: offer.id, user_id: uid, share_first_name: i < 3 ? given[i][2] : i % 2 === 0, claimed_at: at(-18 + (i % 18)) };
    db.pclaims.push(claim);
    const code = i < 3 ? given[i][0] : `PK${Array.from({ length: 8 }, (_, k) => CODE_ALPHABET[(i * 31 + k * 7) % 32]).join('')}`;
    const pc = { id: ++db.seq.pcode, campaign_id: offer.id, org_id: PK, code, generated: true, added_at: claim.claimed_at, claim_id: claim.id, assigned_at: claim.claimed_at };
    db.pcodes.push(pc);
    const used = i < 3 ? given[i][3] : (i % 5 === 1 ? -(i % 9) - 1 : null);
    if (used != null) db.predeem.push({ id: ++db.seq.redeem, org_id: PK, campaign_id: offer.id, offer_code: pc.id, reward_code: null, redeemed_at: at(used), redeemed_by: ids.Alex });
  }
  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000306', kind: 'reward_offer', reward_type: 'offer', status: 'approved', paused: true, title: 'Smoothies: buy one, get one free',
    summary: 'Two smoothies for the price of one at the studio café.', starts_on: dayIn(pkTz, -30), ends_on: dayIn(pkTz, 30), quantity: 150, per_person: 2,
    code_source: 'pool', country: 'US', region: 'MI', city: 'Detroit', reviewed: true, approved: true, made: -34 });
  for (let i = 0; i < 120; i++) {
    db.pcodes.push({ id: ++db.seq.pcode, campaign_id: 'e7b10000-3c2d-4e1f-9a8b-000000000306', org_id: PK, code: `SMOOTH${String(1000 + i * 37)}`,
      generated: false, added_at: at(-33), claim_id: null, assigned_at: i < 12 ? at(-20 + i) : null });
  }
  const stairRules = rules({ metric: 'floors', mode: 'total', target: 300, days: 21, starts_on: dayIn(pkTz, -5) });
  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000307', kind: 'sponsored_challenge', status: 'rejected', title: 'Spring Stair Sprint',
    summary: 'Climb 300 floors in three weeks.', rules: stairRules, starts_on: stairRules.starts_on, ends_on: addDays(stairRules.starts_on, 20),
    review_note: 'The start date has already passed. Pick a start date from today on and send it again.', reviewed: true, made: -9 });
  const cycleRules = rules({ metric: 'cycling_distance', mode: 'total', target: 100000, days: 7, starts_on: dayIn(pkTz, 21) });
  camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000308', kind: 'sponsored_challenge', status: 'submitted', title: 'Cycle the Riverfront',
    summary: 'Ride 100 km in a week along the Detroit Riverfront.', link: 'https://peakfitness.example/ride', rules: cycleRules,
    starts_on: cycleRules.starts_on, ends_on: addDays(cycleRules.starts_on, 6), country: 'US', region: 'MI', city: 'Detroit', made: -2 });
  const summer = camp({ id: 'e7b10000-3c2d-4e1f-9a8b-000000000309', kind: 'reward_offer', reward_type: 'offer', status: 'approved',
    title: 'Summer membership deal', summary: 'Your first month of membership for half price.', starts_on: dayIn(pkTz, -100), ends_on: dayIn(pkTz, -10),
    quantity: 200, per_person: 1, code_source: 'generated', country: 'US', reviewed: true, approved: true, made: -105 });

  // Daily counts (partner_stats), the partner's own day.
  const stat = (c, ago, v) => db.pstats.push({ campaign_id: c, day: dayIn(pkTz, -ago), views: v[0] || 0, opens: v[1] || 0, claims: v[2] || 0,
    joins: v[3] || 0, redemptions: v[4] || 0 });
  for (let a = 20; a >= 0; a--) stat(offer.id, a, [40 + ((a * 13) % 35), 12 + ((a * 7) % 15), a % 4 === 0 ? 3 : 1 + (a % 3), 0, a % 6 === 0 ? 0 : (a % 5 === 0 ? 2 : 1)]);
  for (let a = 18; a >= 0; a--) stat(engine.id ? 'e7b10000-3c2d-4e1f-9a8b-000000000303' : '', a, [60 + ((a * 17) % 40), 18 + ((a * 5) % 12), 0, a > 13 ? 6 + (a % 4) : (a % 3 === 0 ? 4 : 1)]);
  for (let a = 100; a >= 12; a -= 4) stat(summer.id, a, [30 + (a % 20), 10 + (a % 7), 2 + (a % 3), 0, 1 + (a % 2)]);
  return db;
}

// 072's org_challenge_count: one count of people as an organization sees it. lim: its smallest group for reports.
// Below lim: "fewer than lim". A part of ofN (took part, met the target, of those who joined) with fewer than lim of ofN
// outside it: "at least X", X from ofN's rounded count alone. Otherwise the nearest 5, never below 5.
const near5 = (k) => Math.max(5, Math.trunc((k + 2) / 5) * 5);
const orgCount = (k, lim, ofN = null) => (k == null ? null : k < lim ? `fewer than ${lim}`
  : ofN != null && ofN - k < lim ? `at least ${Math.max(lim, Math.trunc((near5(ofN) - lim - 1) / 5) * 5)}` : near5(k));

// Earns a finished challenge's approved rewards from its final results, once each, then gives private codes in the order
// earned (072's org_challenge_award).
function award(db, ch) {
  const c = db.challenges.find((x) => x.id === ch);
  if (!c || c.status !== 'finished') return 0;
  const rows = challengeRows(db, ch);
  let count = 0;
  const list = db.rewards.filter((w) => w.challenge_id === ch && w.approved_at && !w.awarded_at)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  for (const w of list) {
    // each_group: within each group (the winner, the top N, the best side of each), how many per group; only people in a group.
    const eg = !!w.each_group;
    const taken = new Map();
    const fits = rows.filter((y) => (w.earns === 'winner' ? !y.child && y.score > 0 && (eg ? y.place_in_group : y.group_place) === 1
      : w.earns === 'top_n' ? !y.child && y.score > 0 && (eg ? y.place_in_group : y.group_place) <= w.top_n
        : w.earns === 'side' ? (eg ? y.side_place_in_group : y.side_place) === 1 && y.side_average > 0
          : w.earns === 'goal' ? y.goal_met : w.earns === 'finish' ? y.took_part : false) && (!eg || y.group_unit != null))
      .sort((a, b) => a.place - b.place || (a.user_id < b.user_id ? -1 : 1))
      .filter((y) => {
        const key = eg ? y.group_unit : '';
        const k = (taken.get(key) || 0) + 1;
        taken.set(key, k);
        return w.quantity == null || k <= w.quantity;
      });
    for (const y of fits) {
      if (db.earned.some((e) => e.reward_id === w.id && e.user_id === y.user_id)) continue;
      db.earned.push({ id: ++db.seq.earned, reward_id: w.id, user_id: y.user_id, earned_at: new Date().toISOString(), claimed_at: null, given_at: null, given_by: null });
      count += 1;
    }
    w.awarded_at = new Date().toISOString();
  }
  for (const w of db.rewards.filter((x) => x.challenge_id === ch)) {
    const need = db.earned.filter((e) => e.reward_id === w.id && !db.rcodes.some((x) => x.earned_id === e.id)).sort((a, b) => a.id - b.id);
    const free = db.rcodes.filter((x) => x.reward_id === w.id && !x.assigned_at).sort((a, b) => a.id - b.id);
    need.forEach((e, k) => { if (free[k]) { free[k].earned_id = e.id; free[k].assigned_at = new Date().toISOString(); } });
  }
  return count;
}

// 072's org_challenge_rows: everyone in, scored as the engine scores them, with their side and its standing.
function challengeRows(db, ch) {
  const c = db.challenges.find((x) => x.id === ch);
  const g = db.orgs.find((x) => x.id === c.org_id);
  const kidsOrg = ['school', 'district'].includes(g.kind);
  const people = db.cpart.filter((p) => p.challenge_id === ch && p.status === 'accepted').map((p) => {
    const m = db.members.find((x) => x.org_id === c.org_id && x.user_id === p.user_id);
    return { user_id: p.user_id, share_progress: p.share_progress, child: kidsOrg || !m || m.status !== 'active' || m.age_band !== 'adult', score: p.score,
      active_days: p.active_days, best: p.best || 0, side_unit: p.side_unit || null, group_unit: p.group_unit || null };
  });
  const total = c.mode === 'total';
  for (const x of people) {
    x.place = 1 + people.filter((y) => y.score > x.score || (y.score === x.score && !total && y.best > x.best)).length;
  }
  for (const x of people) {
    x.group_place = 1 + people.filter((y) => y.child === x.child && y.place < x.place).length;
    x.place_in_group = 1 + people.filter((y) => y.child === x.child && y.group_unit === x.group_unit && y.place < x.place).length;
    x.took_part = x.active_days > 0 || x.score > 0;
    x.goal_met = c.target != null && x.score >= c.target;
  }
  const sides = new Map();
  for (const x of people.filter((y) => y.side_unit)) {
    const s = sides.get(x.side_unit) || { people: 0, sum: 0 };
    s.people += 1;
    s.sum += x.score;
    sides.set(x.side_unit, s);
  }
  // A side's group: the one most of its people are in (then the first by id).
  const tally = new Map();
  for (const x of people.filter((y) => y.side_unit && y.group_unit)) {
    const m = tally.get(x.side_unit) || new Map();
    m.set(x.group_unit, (m.get(x.group_unit) || 0) + 1);
    tally.set(x.side_unit, m);
  }
  const sideGroup = new Map([...tally.entries()].map(([s, m]) => [s, [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]]));
  const ranked = [...sides.entries()].filter(([, s]) => s.people >= g.min_report_group)
    .map(([id, s]) => ({ id, average: s.sum / s.people, group: sideGroup.get(id) || null }));
  for (const x of people) {
    const s = x.side_unit ? sides.get(x.side_unit) : null;
    x.side_people = s ? s.people : null;
    x.side_average = s ? s.sum / s.people : null;
    const r = ranked.find((y) => y.id === x.side_unit);
    x.side_place = r ? 1 + ranked.filter((y) => y.average > r.average).length : null;
    x.side_group = x.side_unit ? sideGroup.get(x.side_unit) || null : null;
    x.side_place_in_group = r ? 1 + ranked.filter((y) => y.group === r.group && y.average > r.average).length : null;
  }
  // Each group's standing: the average per person in it, ranked only with at least the smallest group for reports.
  const grps = new Map();
  for (const x of people.filter((y) => y.group_unit)) {
    const s = grps.get(x.group_unit) || { people: 0, sum: 0 };
    s.people += 1;
    s.sum += x.score;
    grps.set(x.group_unit, s);
  }
  const rankedG = [...grps.entries()].filter(([, s]) => s.people >= g.min_report_group).map(([id, s]) => ({ id, average: s.sum / s.people }));
  for (const x of people) {
    const s = x.group_unit ? grps.get(x.group_unit) : null;
    x.group_people = s ? s.people : null;
    x.group_average = s ? s.sum / s.people : null;
    const r = rankedG.find((y) => y.id === x.group_unit);
    x.group_rank = r ? 1 + rankedG.filter((y) => y.average > r.average).length : null;
  }
  return people;
}

// 072's org_challenge_group_of: the nearest unit of kind k above unit u (never u itself), or null.
export function groupOf(db, u, k) {
  const byId = (id) => db.units.find((x) => x.id === id);
  let x = byId(u);
  for (let i = 0; x && i < 20; i++) {
    x = x.parent_id ? byId(x.parent_id) : null;
    if (x && x.kind === k) return x.id;
  }
  return null;
}

// 072's org_challenge_finalists_set: who may join a final round, from the first round's final results, all over again.
// 'sides': everyone who took part on one of the top advance_n ranked sides of each of its groups (or overall), averaging
// above 0; 'people': the top advance_n adults of each group (or overall) with a score above 0. With groups, only those in one.
export function finalistsSet(db, ch) {
  const c = db.challenges.find((x) => x.id === ch);
  if (!c) return 0;
  c.finalists = [];
  if (!c.final_of || !c.advance) return 0;
  const first = db.challenges.find((x) => x.id === c.final_of);
  if (!first) return 0;
  const grouped = first.group_kind != null;
  c.finalists = challengeRows(db, first.id).filter((y) => (c.advance === 'sides'
    ? y.took_part && y.side_average > 0 && y.side_place_in_group != null && y.side_place_in_group <= c.advance_n && (!grouped || y.side_group != null)
    : c.advance === 'people' ? !y.child && y.score > 0 && y.place_in_group <= c.advance_n && (!grouped || y.group_unit != null) : false))
    .map((y) => y.user_id);
  return c.finalists.length;
}

// 072's org_challenge_shape: sides, groups, size and final round, checked and cleaned; also 075's habit challenges.
// h: demo.js's helpers (db, me, org, hasRole).
export function challengeShape(h, o, d) {
  const sk = (txt(d.sides) || '').trim() || null;
  if (sk != null && !SIDE_KINDS.includes(sk)) return err('sides');
  const gk = (txt(d.group_kind) || '').trim() || null;
  if (gk != null && (!SIDE_KINDS.includes(gk) || sk == null || gk === sk)) return err('group_kind');
  let mx; let an;
  try {
    mx = asInt(d.max_people);
    an = asInt(d.advance_n);
  } catch { return err('invalid'); }
  const cap = limitsOf(h.db()).max_people;
  mx = mx ?? cap;
  if (mx != null && (mx < 2 || (cap != null && mx > cap))) return err('max_people');
  const fs = (txt(d.final_of) || '').trim() || null;
  if (fs != null && !UUID_RE.test(fs)) return err('final_of');
  const fo = fs && fs.toLowerCase();
  const adv = (txt(d.advance) || '').trim() || null;
  if (fo == null) {
    if (adv != null || an != null) return err('final_of');
  } else {
    const src = h.db().challenges.find((x) => x.id === fo && x.org_id === o);
    if (!src || src.status !== 'finished' || !h.hasRole(o, h.me(), ['challenge_coordinator', 'unit_manager', 'teacher'], src.unit_id)) return err('final_of');
    if (adv == null || !['sides', 'people'].includes(adv) || (adv === 'sides' && src.side_kind == null)) return err('advance');
    if (adv === 'people' && ['school', 'district'].includes((h.org(o) || {}).kind)) return err('children_rules');
    if (an == null || an < 1) return err('advance_n');
  }
  return { sides: sk, group_kind: gk, max_people: mx, final_of: fo, advance: adv, advance_n: an };
}

// The functions ------------------------------------------------------------------------------------------
// h: what demo.js shares: db(), me(), org(o), unitOf(u), member(o, uid), hasRole(o, uid, roles, u), newId().
export function programFunctions(h) {
  const D = () => h.db();
  const ch = (id) => D().challenges.find((x) => x.id === id);
  const oc = (id) => { const c = ch(id); return c && D().orgs.some((g) => g.id === c.org_id) ? c : null; };
  const kidsOf = (o) => ['school', 'district'].includes((h.org(o) || {}).kind);
  const firstName = (uid) => ((D().users[uid] && String(D().users[uid].first_name || '').trim()) || 'Someone'); // connect_name
  const consentNow = (o, uid, k) => {
    const rows = D().consents.filter((c) => c.org_id === o && c.user_id === uid && c.kind === k);
    return rows.length ? rows[rows.length - 1].granted : null;
  };
  const isPartnerOrg = (o) => (h.org(o) || {}).kind === 'partner';

  // 072's helpers, with 074's fence: never a partner's sponsored Challenge.
  const challengeManager = (id, uid) => {
    const c = oc(id);
    return !!uid && !!c && h.hasRole(c.org_id, uid, ['challenge_coordinator', 'unit_manager', 'teacher'], c.unit_id) && !isPartnerOrg(c.org_id);
  };
  const rewardManager = (id, uid) => {
    const c = oc(id);
    return !!uid && !!c && (h.hasRole(c.org_id, uid, ['rewards_manager'], c.unit_id) || (c.created_by === uid && challengeManager(id, uid)))
      && !isPartnerOrg(c.org_id);
  };

  function rules(o, d, keepStart = null) {
    const g = h.org(o);
    const kids = kidsOf(o);
    const ut = (txt(d.unit_id) || '').trim() || null;
    if (ut != null && !UUID_RE.test(ut)) return err('unit');
    if (ut != null && !h.unitOf(ut)) return err('unit');
    if (ut != null && h.unitOf(ut).org_id !== o) return err('unit');
    const t = (txt(d.title) || '').trim();
    if (len(t) < 1 || len(t) > 60) return err('title');
    const dsc = (txt(d.description) || '').trim() || null;
    if (dsc != null && len(dsc) > 500) return err('description');
    const met = txt(d.metric);
    if (met == null || !METRICS.includes(met)) return err('metric');
    const lim = HEALTH_LIMIT[met];
    const md = txt(d.mode);
    if (md == null || !['participation', 'goal', 'total'].includes(md)) return err('mode');
    if (kids && md === 'total') return err('children_rules');
    let n; let gl; let tg; let st;
    try {
      n = asInt(d.days);
      gl = asNum(d.daily_goal);
      tg = asNum(d.target);
      st = asDate(d.starts_on) || dayIn(g.time_zone);
    } catch { return err('invalid'); }
    if (n == null || n < 1 || n > limits().max_days) return err('days');
    if (md === 'goal') {
      if (gl == null || gl <= 0 || gl > lim) return err('daily_goal');
    } else if (gl != null) return err('daily_goal');
    if (tg != null && (tg <= 0 || (md === 'total' && tg > lim * n) || (md !== 'total' && tg > n))) return err('target');
    const earliest = earliestDay();
    if (st !== keepStart && (st < earliest || st > addDays(earliest, 365))) return err('starts_on');
    const sh = challengeShape(h, o, d);
    if (sh.error) return sh;
    return { unit_id: ut, title: t, description: dsc, metric: met, mode: md, scoring: md === 'total' ? 'health_total' : 'health_goal',
      engine_goal: md === 'goal' ? gl : md === 'participation' ? 1 : null, daily_goal: gl, target: tg, days: n, starts_on: st, ...sh };
  }

  function card(id) {
    const c = ch(id);
    const g = h.org(c.org_id);
    const u = c.unit_id ? h.unitOf(c.unit_id) : null;
    return { id: c.id, org_id: c.org_id, org_name: g.name, org_kind: g.kind, title: c.title, description: c.description, metric: c.metric,
      mode: c.mode, daily_goal: c.mode === 'goal' ? c.goal : null, target: c.target, days: c.days, starts_on: c.starts_on, ends_on: c.ends_on,
      status: c.status, unit_id: c.unit_id, unit_name: u ? u.name : null, sides: c.side_kind, max_people: c.max_people ?? null,
      group_kind: c.group_kind || null,
      final_of: c.final_of ? { id: c.final_of, title: (ch(c.final_of) || {}).title || null, group_kind: (ch(c.final_of) || {}).group_kind || null } : null,
      advance: c.advance || null, advance_n: c.advance_n ?? null,
      rewards: D().rewards.filter((w) => w.challenge_id === c.id && w.approved_at).sort(byCreated)
        .map((w) => ({ id: w.id, title: w.title, description: w.description, kind: w.kind, earns: w.earns, top_n: w.top_n, quantity: w.quantity,
          each_group: !!w.each_group })) };
  }
  const limits = () => limitsOf(D());
  const byCreated = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1);
  const joinedCount = (id) => D().cpart.filter((p) => p.challenge_id === id && p.status === 'accepted').length;
  // A prize's codes: how many, how many left (exact until it is earned, then not shown: with the number of codes it would
  // tell how many earned), and whether someone who earned it waits for a code (072's codes_short).
  const codeCounts = (w) => {
    const all = D().rcodes.filter((x) => x.reward_id === w.id);
    const left = all.filter((x) => !x.assigned_at).length;
    const short = !!w.awarded_at && D().earned.some((e) => e.reward_id === w.id && !D().rcodes.some((x) => x.earned_id === e.id));
    return { codes: all.length, codes_left: w.awarded_at ? null : left, codes_short: short && all.length > 0 };
  };
  const auditLog = () => {}; // 068's org_log: the demo keeps no audit log

  const fns = {
    org_challenge_create({ o, d }) {
      const uid = h.me();
      if (!isObj(d)) return err('details');
      const g = h.org(o);
      const ut = (txt(d.unit_id) || '').trim() || null;
      if (ut != null && !UUID_RE.test(ut)) return err('unit');
      if (!g || (ut != null && !(h.unitOf(ut) && h.unitOf(ut).org_id === o)) || !h.hasRole(o, uid, ['challenge_coordinator', 'unit_manager', 'teacher'], ut)) {
        return err('not_allowed');
      }
      if (g.kind === 'partner') return err('partner_campaign');
      if (g.status !== 'active') return err('not_verified');
      if (!g.offers_challenges) return err('not_offered');
      const cap = limits().max_active;
      if (cap != null && D().challenges.filter((x) => x.org_id === o && x.status === 'active').length >= cap) return err('too_many');
      const r = rules(o, d);
      if (r.error) return r;
      const id = h.newId();
      D().challenges.push({ id, org_id: o, unit_id: r.unit_id, title: r.title, description: r.description, metric: r.metric, mode: r.mode,
        goal: r.engine_goal, target: r.target, days: r.days, starts_on: r.starts_on, ends_on: addDays(r.starts_on, r.days - 1), status: 'active',
        cancelled_running: false, side_kind: r.sides, max_people: r.max_people, group_kind: r.group_kind, final_of: r.final_of, advance: r.advance,
        advance_n: r.advance_n, finalists: [], created_by: uid, created_at: new Date().toISOString() });
      finalistsSet(D(), id);
      auditLog();
      return { ok: true, challenge_id: id };
    },

    org_challenge_edit({ ch: id, d }) {
      const uid = h.me();
      if (!isObj(d)) return err('details');
      const c = oc(id);
      if (!c || !challengeManager(id, uid)) return err('not_allowed');
      if (c.status !== 'active' || c.ends_on < earliestDay()) return err('not_open');
      const cur = { unit_id: c.unit_id, title: c.title, description: c.description, metric: c.metric, mode: c.mode,
        daily_goal: c.mode === 'goal' ? c.goal : null, target: c.target, days: c.days, starts_on: c.starts_on, sides: c.side_kind, max_people: c.max_people ?? null,
        group_kind: c.group_kind || null, final_of: c.final_of || null, advance: c.advance || null, advance_n: c.advance_n ?? null };
      const base = { ...cur };
      // max_people left out keeps it; the final round is checked again only when one of its keys is sent.
      const finalSent = ['final_of', 'advance', 'advance_n'].some((k) => k in d);
      if (!('max_people' in d)) delete base.max_people;
      if (!finalSent) { delete base.final_of; delete base.advance; delete base.advance_n; }
      if (isObj(d) && 'mode' in d && d.mode !== c.mode) {
        base.daily_goal = null;
        if ((d.mode === 'total') !== (c.mode === 'total')) base.target = null;
      }
      const r = rules(c.org_id, { ...base, ...d }, c.starts_on);
      if (r.error) return r;
      if (!('max_people' in d)) r.max_people = cur.max_people;
      if (!finalSent) Object.assign(r, { final_of: cur.final_of, advance: cur.advance, advance_n: cur.advance_n });
      const keys = ['unit_id', 'title', 'description', 'metric', 'mode', 'daily_goal', 'target', 'days', 'starts_on', 'sides', 'max_people',
        'group_kind', 'final_of', 'advance', 'advance_n'];
      const changed = keys.filter((k) => (r[k] ?? null) !== (cur[k] ?? null));
      const rulesChanged = changed.some((k) => !['title', 'description', 'max_people'].includes(k));
      if (rulesChanged && D().cpart.some((p) => p.challenge_id === id)) return err('locked');
      if (changed.includes('unit_id') && !h.hasRole(c.org_id, uid, ['challenge_coordinator', 'unit_manager', 'teacher'], r.unit_id)) return err('not_allowed');
      if (r.max_people != null && r.max_people < joinedCount(id)) return err('max_people');
      if (!changed.length) return { ok: true, changed: [] };
      Object.assign(c, { title: r.title, metric: r.metric, goal: r.engine_goal, days: r.days, starts_on: r.starts_on, ends_on: addDays(r.starts_on, r.days - 1),
        unit_id: r.unit_id, mode: r.mode, target: r.target, side_kind: r.sides, max_people: r.max_people, description: r.description,
        group_kind: r.group_kind, final_of: r.final_of, advance: r.advance, advance_n: r.advance_n });
      if (changed.some((k) => ['final_of', 'advance', 'advance_n'].includes(k))) finalistsSet(D(), id);
      if (rulesChanged) D().rewards.filter((w) => w.challenge_id === id && !w.awarded_at).forEach((w) => { w.approved_by = null; w.approved_at = null; });
      return { ok: true, changed };
    },

    org_challenge_cancel({ ch: id }) {
      const c = oc(id);
      if (!c || !challengeManager(id, h.me())) return err('not_allowed');
      if (c.status !== 'active') return err('not_open');
      const today = latestDay();
      const started = c.starts_on <= today;
      Object.assign(c, { status: 'cancelled', cancelled_running: started, ends_on: started && today < c.ends_on ? today : c.ends_on });
      return { ok: true };
    },

    org_challenge_list({ o }) {
      const uid = h.me();
      return D().challenges.filter((c) => c.org_id === o)
        .map((c) => ({ c, manage: challengeManager(c.id, uid), reward: rewardManager(c.id, uid) }))
        .filter((x) => x.manage || x.reward)
        .sort((a, b) => (a.c.created_at > b.c.created_at ? -1 : a.c.created_at < b.c.created_at ? 1 : a.c.id < b.c.id ? -1 : 1))
        .map((x) => ({ ...card(x.c.id), joined: orgCount(joinedCount(x.c.id), h.org(o).min_report_group), can_manage: x.manage, can_reward: x.reward }));
    },

    org_challenge_report({ ch: id, max_rows = 100, skip = 0 }) {
      const c = oc(id);
      if (!c || !challengeManager(id, h.me())) return err('not_allowed');
      const kids = kidsOf(c.org_id);
      const r = challengeRows(D(), id);
      const named = r.filter((x) => kids || (!x.child && consentNow(c.org_id, x.user_id, 'manager_reporting') === true))
        .map((x) => ({ user_id: x.user_id, place: x.group_place, score: x.score, took_part: x.took_part, goal_met: x.goal_met, first_name: firstName(x.user_id),
          group_unit: x.group_unit, place_in_group: x.place_in_group }));
      const order = (a, b) => (kids ? 0 : a.place - b.place) || a.first_name.localeCompare(b.first_name) || (a.user_id < b.user_id ? -1 : 1);
      const limit = Math.max(1, Math.min(max_rows == null ? 100 : max_rows, 500));
      const page = [...named].sort(order).slice(Math.max(skip == null ? 0 : skip, 0), Math.max(skip == null ? 0 : skip, 0) + limit);
      const seen = new Map();
      r.filter((x) => x.side_place != null).forEach((x) => seen.set(x.side_unit, x));
      const floor = h.org(c.org_id).min_report_group;
      const final = c.status === 'finished';
      const grouped = c.group_kind != null;
      const sideRows = [...seen.values()];
      const sides = sideRows.map((x) => ({ id: x.side_unit, name: (h.unitOf(x.side_unit) || {}).name, people: orgCount(x.side_people, floor),
        average: final ? Math.round(x.side_average * 100) / 100 : null, place: x.side_place,
        ...(grouped ? { group_id: x.side_group, place_in_group: x.side_group != null ? x.side_place_in_group : null } : {}) }))
        .filter((s) => s.name != null).sort((a, b) => a.place - b.place || a.name.localeCompare(b.name));
      // Each group of at least the smallest group for reports, by place, with its top 3 ranked sides (their place in it).
      const gseen = new Map();
      r.filter((x) => x.group_rank != null).forEach((x) => gseen.set(x.group_unit, x));
      const groups = [...gseen.values()].map((x) => ({ id: x.group_unit, name: (h.unitOf(x.group_unit) || {}).name, place: x.group_rank,
        people: orgCount(x.group_people, floor), average: final ? Math.round(x.group_average * 100) / 100 : null,
        sides: sideRows.filter((s) => s.side_group === x.group_unit).sort((a, b) => a.side_place_in_group - b.side_place_in_group || (a.side_unit < b.side_unit ? -1 : 1))
          .slice(0, 3).map((s) => ({ id: s.side_unit, name: (h.unitOf(s.side_unit) || {}).name, place: s.side_place_in_group }))
          .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name)) }))
        .filter((g) => g.name != null).sort((a, b) => a.place - b.place || a.name.localeCompare(b.name));
      return {
        challenge: card(id), children_rules: kids, min_group: floor, joined: orgCount(r.length, floor),
        left: orgCount(D().cpart.filter((p) => p.challenge_id === id && p.status === 'left').length, floor),
        took_part: orgCount(r.filter((x) => x.took_part).length, floor, r.length),
        goal_met: c.target != null ? orgCount(r.filter((x) => x.goal_met).length, floor, r.length) : null,
        sides,
        groups,
        named: page.map((p) => (kids ? { user_id: p.user_id, first_name: p.first_name, took_part: p.took_part, goal_met: c.target != null ? p.goal_met : null }
          : { user_id: p.user_id, first_name: p.first_name, place: p.place, score: p.score,
            ...(grouped ? { group_id: p.group_unit, place_in_group: p.group_unit != null ? p.place_in_group : null } : {}) })),
        named_total: named.length,
      };
    },

    org_reward_set({ ch: id, reward, d }) {
      const uid = h.me();
      if (!isObj(d)) return err('details');
      const c = oc(id);
      if (!c || !rewardManager(id, uid)) return err('not_allowed');
      if (c.status === 'cancelled') return err('not_open');
      let w = null;
      let dd = d;
      if (reward != null) {
        w = D().rewards.find((x) => x.id === reward && x.challenge_id === id);
        if (!w) return err('not_found');
        if (w.awarded_at) return err('earned');
        dd = { title: w.title, description: w.description, kind: w.kind, earns: w.earns, top_n: w.top_n, quantity: w.quantity, each_group: !!w.each_group, ...d };
      }
      const kids = kidsOf(c.org_id);
      const t = (txt(dd.title) || '').trim();
      if (len(t) < 1 || len(t) > 80) return err('title');
      const dsc = (txt(dd.description) || '').trim() || null;
      if (dsc != null && len(dsc) > 500) return err('description');
      const k = txt(dd.kind) ?? 'prize';
      if (!['prize', 'recognition'].includes(k)) return err('kind');
      const e = txt(dd.earns);
      if (e == null || !['winner', 'top_n', 'side', 'goal', 'finish'].includes(e)) return err('earns');
      if (kids && ['winner', 'top_n'].includes(e)) return err('children_rules');
      if ((e === 'side' && c.side_kind == null) || (e === 'goal' && c.target == null)) return err('earns');
      let tn; let qn; let eg;
      try {
        tn = e === 'top_n' ? asInt(dd.top_n) : null;
        qn = asInt(dd.quantity);
        eg = asBool(dd.each_group) ?? false;
      } catch { return err('invalid'); }
      const cap = limits();
      if (e === 'top_n' && (tn == null || tn < 1 || (cap.max_top_n != null && tn > cap.max_top_n))) return err('top_n');
      if (qn != null && (qn < 1 || (cap.max_quantity != null && qn > cap.max_quantity))) return err('quantity');
      if (eg && c.group_kind == null) return err('each_group');
      if (k === 'recognition' && reward != null && D().rcodes.some((x) => x.reward_id === reward)) return err('codes');
      if (reward == null) {
        const rid = h.newId();
        D().rewards.push({ id: rid, challenge_id: id, org_id: c.org_id, title: t, description: dsc, kind: k, earns: e, top_n: tn, quantity: qn, each_group: eg,
          created_by: uid, created_at: new Date().toISOString(), approved_by: null, approved_at: null, awarded_at: null });
        return { ok: true, reward_id: rid, approved: false };
      }
      Object.assign(w, { title: t, description: dsc, kind: k, earns: e, top_n: tn, quantity: qn, each_group: eg, approved_by: null, approved_at: null });
      return { ok: true, reward_id: w.id, approved: false };
    },

    org_reward_approve({ reward, yes }) {
      const uid = h.me();
      const w = D().rewards.find((x) => x.id === reward);
      if (!w || !h.hasRole(w.org_id, uid, ['admin'])) return err('not_allowed');
      if (isPartnerOrg(w.org_id)) return err('partner_campaign');
      const c = ch(w.challenge_id);
      if (w.awarded_at) return err('earned');
      if (c.status === 'cancelled') return err('not_open');
      if (yes == null) return err('invalid');
      const kids = kidsOf(w.org_id);
      if (yes && ((w.earns === 'side' && c.side_kind == null) || (w.earns === 'goal' && c.target == null) || (kids && ['winner', 'top_n'].includes(w.earns)))) {
        return err('earns');
      }
      if (yes && w.each_group && c.group_kind == null) return err('each_group');
      w.approved_by = yes ? uid : null;
      w.approved_at = yes ? new Date().toISOString() : null;
      if (yes && c.status === 'finished') award(D(), c.id);
      return { ok: true, approved: yes };
    },

    org_reward_remove({ reward }) {
      const w = D().rewards.find((x) => x.id === reward);
      if (!w || !rewardManager(w.challenge_id, h.me())) return err('not_allowed');
      if (w.awarded_at) return err('earned');
      const db = D();
      db.rewards = db.rewards.filter((x) => x.id !== reward);
      db.rcodes = db.rcodes.filter((x) => x.reward_id !== reward);
      return { ok: true };
    },

    org_reward_codes_add({ reward, codes }) {
      const w = D().rewards.find((x) => x.id === reward);
      if (!w || !rewardManager(w.challenge_id, h.me())) return err('not_allowed');
      if (w.kind !== 'prize') return err('kind');
      if (!sponsorTermsOk(D(), w.org_id)) return err('sponsor_terms');
      const cap = limits();
      if (!Array.isArray(codes) || codes.length === 0 || codes.length > cap.max_codes_per_add) return err('codes');
      // Only the codes really added count toward the limit: one of each, not blank, not one it already has.
      const seen = new Set();
      const clean = [];
      for (const raw of codes) {
        const code = String(raw ?? '').trim();
        if (len(code) < 1 || len(code) > 200 || seen.has(code)) continue;
        seen.add(code);
        if (!D().rcodes.some((x) => x.reward_id === reward && x.code === code)) clean.push(code);
      }
      if (cap.max_codes != null && D().rcodes.filter((x) => x.reward_id === reward).length + clean.length > cap.max_codes) return err('too_many');
      for (const code of clean) {
        D().rcodes.push({ id: ++D().seq.rcode, reward_id: reward, code, added_by: h.me(), added_at: new Date().toISOString(), earned_id: null, assigned_at: null });
      }
      if (w.awarded_at) award(D(), w.challenge_id);
      return { ok: true, added: clean.length, ...codeCounts(w) };
    },

    org_reward_status({ ch: id }) {
      const uid = h.me();
      const c = oc(id);
      if (!c || !(rewardManager(id, uid) || challengeManager(id, uid))) return err('not_allowed');
      const kids = kidsOf(c.org_id);
      const lim = h.org(c.org_id).min_report_group;
      return {
        min_group: lim,
        rewards: D().rewards.filter((w) => w.challenge_id === id).sort(byCreated).map((w) => {
          const earned = D().earned.filter((e) => e.reward_id === w.id).sort((a, b) => a.id - b.id);
          const codes = D().rcodes.filter((x) => x.reward_id === w.id);
          const people = earned.map((e) => {
            const m = D().members.find((x) => x.org_id === w.org_id && x.user_id === e.user_id);
            const adult = !!m && m.status === 'active' && m.age_band === 'adult'; // org_challenge_adult
            const named = kids ? e.claimed_at != null : adult && (e.claimed_at != null || consentNow(w.org_id, e.user_id, 'manager_reporting') === true);
            const minor = !!m && ['active', 'pending'].includes(m.status) && m.age_band !== 'adult';
            return { e, named, minor };
          }).filter((x) => x.named || x.e.claimed_at != null).map(({ e, named, minor }) => ({ earned_id: e.id, user_id: named ? e.user_id : null,
            first_name: named ? firstName(e.user_id) : null, under_18: !named && !kids && minor, claimed_at: e.claimed_at, given_at: e.given_at }));
          return { id: w.id, title: w.title, description: w.description, kind: w.kind, earns: w.earns, top_n: w.top_n, quantity: w.quantity,
            each_group: !!w.each_group, approved: w.approved_at != null, approved_at: w.approved_at, awarded_at: w.awarded_at, earned: orgCount(earned.length, lim, joinedCount(id)),
            claimed: earned.filter((e) => e.claimed_at).length, given: earned.filter((e) => e.given_at).length,
            ...codeCounts(w), people };
        }),
      };
    },

    // The Sponsor Reward Terms (terms round): where the organization stands, for its administrators and those who run its
    // rewards or challenges (any of their places); an administrator accepts the version they were shown.
    // Gaps round: a role for a place counts as one for the whole organization does.
    org_sponsor_terms_state({ o }) {
      const uid = h.me();
      const mine = D().roles.some((r) => r.org_id === o && r.user_id === uid
        && ['admin', 'rewards_manager', 'challenge_coordinator', 'unit_manager', 'teacher'].includes(r.role) && h.hasRole(o, uid, [r.role], r.unit_id));
      if (!uid || !h.org(o) || !mine) return err('not_allowed');
      const v = limits().sponsor_terms_version;
      const t = (D().sponsorTerms || []).find((x) => x.org_id === o && x.version === v);
      return { ok: true, version: v, accepted: !!t, accepted_at: t ? t.accepted_at : null, accepted_by: t && t.accepted_by ? firstName(t.accepted_by) : null };
    },

    org_sponsor_terms_accept({ o, version }) {
      const uid = h.me();
      if (!uid || !h.org(o) || !h.hasRole(o, uid, ['admin'])) return err('not_allowed');
      const v = limits().sponsor_terms_version;
      if (version !== v) return { error: 'version', version: v };
      const db = D();
      if (!db.sponsorTerms) db.sponsorTerms = [];
      if (!db.sponsorTerms.some((x) => x.org_id === o && x.version === v)) {
        db.sponsorTerms.push({ org_id: o, version: v, accepted_by: uid, accepted_at: new Date().toISOString() });
      }
      return fns.org_sponsor_terms_state({ o });
    },

    org_reward_given({ earned }) {
      const e = D().earned.find((x) => x.id === Number(earned));
      const w = e ? D().rewards.find((x) => x.id === e.reward_id) : null;
      if (!e || !rewardManager(w.challenge_id, h.me())) return err('not_allowed');
      if (!e.claimed_at) return err('not_claimed');
      if (!e.given_at) { e.given_at = new Date().toISOString(); e.given_by = h.me(); }
      return { ok: true };
    },
  };

  // 074: InneRISE Partners ------------------------------------------------------------------------------
  const camp = (id) => D().campaigns.find((x) => x.id === id);
  const partnerCan = (o, uid, k) => {
    const g = h.org(o);
    if (!uid || !g || g.kind !== 'partner') return false;
    const roles = { sponsored_challenge: ['challenge_coordinator'], reward_offer: ['rewards_manager'], plan: ['billing_contact'],
      any: ['challenge_coordinator', 'rewards_manager', 'billing_contact'] }[k] || ['admin'];
    return h.hasRole(o, uid, roles);
  };
  const partnerMinor = (uid) => !!(D().users[uid] && D().users[uid].child)
    || D().members.some((m) => m.user_id === uid && ['active', 'pending'].includes(m.status) && ['teen', 'under13'].includes(m.age_band));
  // partner_count: one count as the partner sees it (072's org_challenge_count, no "of").
  const pcount = (n, floor) => orgCount(n, floor);
  // partner_total: daily counts added up. With a hidden day: "fewer than N", or "at least" what the shown days add up to as
  // shown (each shown day's count less 2), to the 5 below, never under N.
  const ptotal = (total, shownLow, hidden, floor) => (total == null ? null : !hidden ? pcount(total, floor) : total < floor ? `fewer than ${floor}`
    : `at least ${Math.max(Math.trunc((shownLow || 0) / 5) * 5, floor)}`);
  function state(c) {
    if (['draft', 'submitted', 'rejected', 'withdrawn'].includes(c.status)) return c.status;
    const p = c.for_campaign ? camp(c.for_campaign) : null;
    if (c.reward_type === 'achievement' && (!p || p.status !== 'approved')) return 'approved';
    const engine = ch((p && p.challenge_id) || c.challenge_id);
    const ends = (p && p.ends_on) || c.ends_on;
    if ((engine && ['finished', 'cancelled'].includes(engine.status)) || (ends != null && ends < earliestDay())) return 'ended';
    if (c.paused) return 'paused'; // its own pause only: a paused sponsored Challenge keeps its rewards
    const starts = (p && p.starts_on) || c.starts_on;
    if (starts != null && starts > latestDay()) return 'scheduled';
    return 'live';
  }
  function campaignJson(c) {
    const p = c.for_campaign ? camp(c.for_campaign) : null;
    let challenge = null;
    if (c.kind === 'sponsored_challenge' && c.rules) {
      const { unit_id: _u, sides: _s, scoring: _sc, engine_goal: _e, ...rest } = c.rules;
      challenge = rest;
    }
    return { id: c.id, org_id: c.org_id, kind: c.kind, reward_type: c.reward_type, status: c.status, state: state(c), paused: !!c.paused,
      paused_at: c.paused_at ?? null, title: c.title, summary: c.summary,
      link: c.link, image_path: c.image_path, country: c.country, region: c.region, city: c.city,
      starts_on: c.starts_on ?? (p ? p.starts_on : null), ends_on: c.ends_on ?? (p ? p.ends_on : null), challenge,
      challenge_id: c.challenge_id ?? (p ? p.challenge_id : null), for_campaign: c.for_campaign, for_title: p ? p.title : null,
      earns: c.earns, quantity: c.quantity, per_person: c.per_person, code_source: c.code_source,
      // An approved one's changes waiting for InneRISE's review (only the keys that differ from the live version).
      revision: c.revision ?? null, revision_at: c.revision_at ?? null,
      review_note: c.review_note, submitted_at: c.submitted_at, reviewed_at: c.reviewed_at, approved_at: c.approved_at, updated_at: c.updated_at };
  }
  const EDIT_KEYS = ['title', 'summary', 'link', 'image_path', 'country', 'region', 'city', 'starts_on', 'ends_on', 'rules', 'earns', 'quantity',
    'per_person', 'code_source'];
  const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const sameKey = (k, a, b) => (k !== 'rules' ? sameJson(a, b) : a == null || b == null ? (a ?? null) === (b ?? null) // jsonb equality: key order aside
    : Object.keys({ ...a, ...b }).every((x) => sameJson(a[x], b[x])));
  const poolHas = (c) => D().pcodes.filter((x) => x.campaign_id === c.id).length + D().rcodes.filter((x) => c.reward_id && x.reward_id === c.reward_id).length;
  // partner_check: a campaign's content and terms, checked and cleaned.
  function check(cur, d) {
    const g = h.org(cur.org_id);
    const today = dayIn(g ? g.time_zone : 'UTC');
    let { title: t, summary: sm, link: ln, image_path: im, country: co, region: rg, city: ct, starts_on: st, ends_on: en, rules: rl, earns: ea,
      quantity: qn, per_person: pp, code_source: cs } = cur;
    let f = fieldOf(d, 'title');
    if (f.present) t = f.val;
    if (t == null || len(t) < 2 || len(t) > (cur.kind === 'sponsored_challenge' ? 60 : 80)) return err('title');
    f = fieldOf(d, 'summary'); if (f.present) sm = f.val;
    if (sm != null && len(sm) > 280) return err('summary');
    f = fieldOf(d, 'link'); if (f.present) ln = f.val;
    if (ln != null && (!/^https:\/\/\S{3,}$/.test(ln) || len(ln) > 300)) return err('link');
    f = fieldOf(d, 'image_path'); if (f.present) im = f.val;
    if (im != null && (!/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,199}$/.test(im) || /(\.\.|\/\/)/.test(im))) return err('image_path');
    f = fieldOf(d, 'country'); if (f.present) co = f.val && f.val.toUpperCase();
    if (co != null && !/^[A-Z]{2}$/.test(co)) return err('country');
    f = fieldOf(d, 'region'); if (f.present) rg = f.val;
    if (rg != null && len(rg) > 100) return err('region');
    f = fieldOf(d, 'city'); if (f.present) ct = f.val;
    if (ct != null && len(ct) > 100) return err('city');
    if ((rg != null || ct != null) && co == null) return err('area');
    if (cur.kind === 'sponsored_challenge') {
      if ((txt(d.unit_id) || '').trim()) return err('unit');
      if ((txt(d.sides) || '').trim()) return err('sides');
      const merged = { ...(rl || {}) };
      for (const k of RULE_KEYS) if (Object.prototype.hasOwnProperty.call(d, k)) merged[k] = d[k];
      Object.assign(merged, { title: t, description: sm, unit_id: null, sides: null });
      const r = rules(cur.org_id, merged, rl ? rl.starts_on : null);
      if (r.error) return r;
      // A partner has no units: groups and final rounds don't apply (074 drops them).
      const { title: _t, description: _d, group_kind: _g, final_of: _f, advance: _a, advance_n: _n, ...rest } = r;
      rl = rest;
      st = r.starts_on;
      en = addDays(st, r.days - 1);
    } else if (cur.reward_type === 'offer') {
      try {
        if ('starts_on' in d) st = ((txt(d.starts_on) || '').trim() || null) && asDate(d.starts_on);
        if ('ends_on' in d) en = ((txt(d.ends_on) || '').trim() || null) && asDate(d.ends_on);
        if ('quantity' in d) qn = asInt(d.quantity);
        if ('per_person' in d) pp = asInt(d.per_person);
      } catch { return err('invalid'); }
      st = st || today;
      pp = pp ?? 1;
      if (st !== cur.starts_on && (st < today || st > addDays(today, 365))) return err('starts_on');
      if (en == null || en < st || addDays(st, 365) < en || en < earliestDay()) return err('ends_on');
      if (qn == null || qn < 1) return err('quantity');
      if (pp < 1) return err('per_person'); // 1 or more, no upper bound (prize round)
    } else {
      const p = camp(cur.for_campaign);
      if (!p || p.org_id !== cur.org_id || p.kind !== 'sponsored_challenge' || p.status === 'withdrawn') return err('for_campaign');
      if ('earns' in d) ea = txt(d.earns);
      if (ea == null || !['goal', 'finish'].includes(ea) || (ea === 'goal' && (p.rules == null || p.rules.target == null))) return err('earns');
      try { if ('quantity' in d) qn = asInt(d.quantity); } catch { return err('invalid'); }
      if (qn == null || qn < 1 || (limits().max_quantity != null && qn > limits().max_quantity)) return err('quantity');
    }
    if (cur.kind === 'reward_offer') {
      if ('code_source' in d && cur.code_source != null && txt(d.code_source) !== cur.code_source) return err('locked');
      cs = cs ?? txt(d.code_source);
      if (cs == null || !['generated', 'pool'].includes(cs)) return err('code_source');
    }
    return { title: t, summary: sm, link: ln, image_path: im, country: co, region: rg, city: ct, starts_on: st, ends_on: en, rules: rl, earns: ea,
      quantity: qn, per_person: pp, code_source: cs };
  }
  const putChallenge = (c) => { // partner_put_challenge, for a campaign InneRISE approved again (title and description only)
    const engine = ch(c.challenge_id);
    if (engine) { engine.title = c.title; engine.description = c.summary; }
  };

  Object.assign(fns, {
    partner_options() {
      return { kinds: ['sponsored_challenge', 'reward_offer'], reward_types: ['offer', 'achievement'], achievement_earns: ['goal', 'finish'],
        code_sources: ['generated', 'pool'], plans: [...PLANS], metrics: [...METRICS], modes: ['participation', 'goal', 'total'],
        reviewed_by_innerise: true, hidden_from_under_18: D().partnerSettings.hide_from_under_18, portal_url: 'https://innerise.app/partners' };
    },

    partner_profile_set({ o, d }) {
      if (!isObj(d)) return err('details');
      if (!partnerCan(o, h.me(), 'admin')) return err('not_allowed');
      let pp = D().pprofiles.find((x) => x.org_id === o);
      if (!pp) { pp = { org_id: o, about: null, logo_path: null, plan_requested: null, plan_requested_at: null }; D().pprofiles.push(pp); }
      let { about: ab, logo_path: lg } = pp;
      const changed = [];
      let f = fieldOf(d, 'about');
      if (f.present) {
        if (f.val != null && len(f.val) > 280) return err('about');
        if (f.val !== ab) { ab = f.val; changed.push('about'); }
      }
      f = fieldOf(d, 'logo_path');
      if (f.present) {
        if (f.val != null && (!/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,199}$/.test(f.val) || /(\.\.|\/\/)/.test(f.val))) return err('logo_path');
        if (f.val !== lg) { lg = f.val; changed.push('logo_path'); }
      }
      Object.assign(pp, { about: ab, logo_path: lg, updated_at: new Date().toISOString() });
      return { ok: true, changed };
    },

    partner_plan_set({ o, plan }) {
      if (!partnerCan(o, h.me(), 'plan')) return err('not_allowed');
      if (plan != null && !PLANS.includes(plan)) return err('plan');
      let pp = D().pprofiles.find((x) => x.org_id === o);
      if (!pp) { pp = { org_id: o, about: null, logo_path: null }; D().pprofiles.push(pp); }
      Object.assign(pp, { plan_requested: plan ?? null, plan_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return { ok: true, plan: plan ?? null };
    },

    partner_overview({ o }) {
      const uid = h.me();
      if (!partnerCan(o, uid, 'any')) return err('not_allowed');
      const g = h.org(o);
      const pp = D().pprofiles.find((x) => x.org_id === o) || {};
      const campaigns = {};
      D().campaigns.filter((c) => c.org_id === o && partnerCan(o, uid, c.kind)).forEach((c) => { const s = state(c); campaigns[s] = (campaigns[s] || 0) + 1; });
      return { org: { id: g.id, name: g.name, status: g.status, verified_at: g.verified_at, website: g.website, time_zone: g.time_zone,
        min_report_group: g.min_report_group }, profile: { about: pp.about ?? null, logo_path: pp.logo_path ?? null },
      plan: partnerCan(o, uid, 'plan') ? (pp.plan_requested ?? null) : null,
      roles: D().roles.filter((r) => r.org_id === o && r.user_id === uid).map((r) => r.role).sort(),
      can_submit: g.status === 'active', campaigns, portal_url: 'https://innerise.app/partners' };
    },

    partner_campaign_create({ o, k, d }) {
      const uid = h.me();
      if (!isObj(d)) return err('details');
      if (k == null || !['sponsored_challenge', 'reward_offer'].includes(k)) return err('kind');
      if (!partnerCan(o, uid, k)) return err('not_allowed');
      const c = { org_id: o, kind: k, reward_type: null, for_campaign: null, title: null, summary: null, link: null, image_path: null, country: null,
        region: null, city: null, starts_on: null, ends_on: null, rules: null, earns: null, quantity: null, per_person: null, code_source: null };
      if (k === 'reward_offer') {
        c.reward_type = txt(d.reward_type);
        if (c.reward_type == null || !['offer', 'achievement'].includes(c.reward_type)) return err('reward_type');
        if (c.reward_type === 'achievement') {
          const fc = (txt(d.for_campaign) || '').trim() || null;
          if (fc != null && !UUID_RE.test(fc)) return err('for_campaign');
          c.for_campaign = fc;
        }
      }
      const r = check(c, d);
      if (r.error) return r;
      const id = h.newId();
      const now = new Date().toISOString();
      D().campaigns.push({ id, ...c, ...r, rules: k === 'sponsored_challenge' ? r.rules : null, earns: r.earns ?? null, quantity: r.quantity ?? null,
        per_person: k === 'reward_offer' && c.reward_type === 'offer' ? r.per_person : null, starts_on: c.reward_type === 'achievement' ? null : r.starts_on,
        ends_on: c.reward_type === 'achievement' ? null : r.ends_on, code_source: k === 'reward_offer' ? r.code_source : null,
        status: 'draft', challenge_id: null, reward_id: null, review_note: null, created_by: uid, created_at: now, updated_at: now,
        submitted_by: null, submitted_at: null, reviewed_at: null, approved_at: null });
      return { ok: true, campaign_id: id, status: 'draft' };
    },

    partner_campaign_edit({ campaign, d }) {
      const uid = h.me();
      if (!isObj(d)) return err('details');
      const c = camp(campaign);
      if (!c || !partnerCan(c.org_id, uid, c.kind)) return err('not_allowed');
      if (c.status === 'withdrawn') return err('withdrawn');
      if (state(c) === 'ended') return err('ended');
      if (['submitted', 'approved'].includes(c.status) && c.kind === 'reward_offer' && !partnerCan(c.org_id, uid, 'admin')) return err('needs_admin');
      // An approved one is checked as it would be with its revision (if any) in place.
      const pend = c.status === 'approved' ? { ...c, ...(c.revision || {}) } : c;
      const r = check(pend, d);
      if (r.error) return r;
      const changed = EDIT_KEYS.filter((k) => !sameKey(k, r[k], pend[k]));
      const rev = Object.fromEntries(EDIT_KEYS.filter((k) => !sameKey(k, r[k], c[k])).map((k) => [k, r[k] ?? null]));
      if (!changed.length) return { ok: true, changed: [], status: c.status, revision: c.revision ?? null };
      // Once approved: its Challenge is in the engine, its reward on that Challenge.
      if (c.approved_at && ((c.kind === 'sponsored_challenge' && changed.some((k) => ['rules', 'starts_on', 'ends_on'].includes(k)))
        || (c.reward_type === 'achievement' && changed.some((k) => ['earns', 'quantity'].includes(k))))) return err('locked');
      if (c.reward_id && D().rewards.some((w) => w.id === c.reward_id && w.awarded_at)) return err('earned');
      if (c.reward_type === 'offer' && r.quantity < D().pcodes.filter((x) => x.campaign_id === campaign && x.assigned_at).length) return err('quantity');
      if (['submitted', 'approved'].includes(c.status) && c.code_source === 'pool' && poolHas(c) < r.quantity) {
        return { error: 'codes_short', short: r.quantity - poolHas(c) };
      }
      const now = new Date().toISOString();
      if (c.status === 'approved') {
        c.revision = Object.keys(rev).length ? rev : null;
        c.revision_at = c.revision ? now : null;
        c.updated_at = now;
        return { ok: true, changed, status: c.status, revision: c.revision };
      }
      // A draft stays a draft, a rejected one becomes a draft again, and one waiting for review keeps waiting, sent again now.
      const ns = c.status === 'rejected' ? 'draft' : c.status;
      Object.assign(c, { title: r.title, summary: r.summary, link: r.link, image_path: r.image_path, country: r.country, region: r.region, city: r.city,
        starts_on: r.starts_on ?? null, ends_on: r.ends_on ?? null, rules: c.kind === 'sponsored_challenge' ? r.rules : null, earns: r.earns ?? null,
        quantity: r.quantity ?? null, per_person: r.per_person ?? null, status: ns, updated_at: now, submitted_at: ns === 'submitted' ? now : c.submitted_at });
      return { ok: true, changed, status: ns, revision: null };
    },

    partner_campaign_submit({ campaign }) {
      const uid = h.me();
      const c = camp(campaign);
      if (!c || !partnerCan(c.org_id, uid, c.kind)) return err('not_allowed');
      if (c.kind === 'reward_offer' && !partnerCan(c.org_id, uid, 'admin')) return err('needs_admin');
      const g = h.org(c.org_id);
      if (g.status !== 'active') return err('not_verified');
      if (!['draft', 'rejected'].includes(c.status)) return err('not_draft');
      const ends = c.ends_on ?? (camp(c.for_campaign) || {}).ends_on;
      if (state(c) === 'ended' || (ends != null && ends < earliestDay())) return err('ended');
      // Checked again now: a sponsored Challenge's settings (a start that has passed reads starts_on), an offer's start, and
      // a pool's codes (one for each it gives out).
      if (c.kind === 'sponsored_challenge') {
        const r = rules(c.org_id, { ...(c.rules || {}), title: c.title, description: c.summary, unit_id: null, sides: null });
        if (r.error) return r;
      }
      if (c.reward_type === 'offer' && c.starts_on < dayIn(g.time_zone)) return err('starts_on');
      if (c.code_source === 'pool' && poolHas(c) < c.quantity) return { error: 'codes_short', short: c.quantity - poolHas(c) };
      if (c.reward_type === 'achievement' && (camp(c.for_campaign) || {}).status === 'withdrawn') return err('for_campaign');
      Object.assign(c, { status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: uid, updated_at: new Date().toISOString() });
      return { ok: true, status: 'submitted' };
    },

    partner_campaign_withdraw({ campaign }) {
      const c = camp(campaign);
      if (!c || !partnerCan(c.org_id, h.me(), c.kind)) return err('not_allowed');
      if (c.status === 'withdrawn') return { ok: true, already: true };
      if (c.kind === 'reward_offer' && ['submitted', 'approved'].includes(c.status) && !partnerCan(c.org_id, h.me(), 'admin')) return err('needs_admin');
      const today = latestDay();
      for (const x of D().campaigns.filter((y) => y.id === campaign || (y.for_campaign === campaign && y.status !== 'withdrawn'))) {
        x.status = 'withdrawn';
        x.revision = null;
        x.revision_at = null;
        x.updated_at = new Date().toISOString();
        const w = x.reward_id ? D().rewards.find((r) => r.id === x.reward_id && !r.awarded_at) : null;
        if (w) { w.approved_by = null; w.approved_at = null; }
      }
      const engine = c.challenge_id ? ch(c.challenge_id) : null;
      if (engine && engine.status === 'active') {
        const started = engine.starts_on <= today;
        Object.assign(engine, { status: 'cancelled', cancelled_running: started, ends_on: started && today < engine.ends_on ? today : engine.ends_on });
      }
      return { ok: true, already: false };
    },

    partner_campaign_pause({ campaign, pause }) {
      const c = camp(campaign);
      if (!c || !partnerCan(c.org_id, h.me(), c.kind)) return err('not_allowed');
      if (pause == null) return err('invalid');
      const st = state(c);
      // Ended: nothing to pause, except an achievement reward paused when its Challenge became final (resumed: earned then).
      const parentFinal = () => { const p = camp(c.for_campaign); const e = p && p.challenge_id ? ch(p.challenge_id) : null; return !!e && e.status === 'finished'; };
      if (!['submitted', 'approved'].includes(c.status) || (st === 'ended' && !(!pause && c.paused && c.reward_type === 'achievement' && parentFinal()))) {
        return err('not_live');
      }
      if (!pause && c.kind === 'reward_offer' && !partnerCan(c.org_id, h.me(), 'admin')) return err('needs_admin');
      const w = c.reward_id ? D().rewards.find((x) => x.id === c.reward_id) : null;
      if (w && w.awarded_at) return err('earned');
      if (!!c.paused === !!pause) return { ok: true, already: true, paused: !!c.paused, state: st };
      const now = new Date().toISOString();
      Object.assign(c, { paused: !!pause, paused_at: pause ? now : null, updated_at: now });
      if (w && c.status === 'approved') {
        w.approved_at = pause ? null : now;
        w.approved_by = pause ? null : (D().users[c.submitted_by] ? c.submitted_by : null);
        if (!pause && (ch(w.challenge_id) || {}).status === 'finished') award(D(), w.challenge_id);
      }
      return { ok: true, already: false, paused: c.paused, state: state(c) };
    },

    partner_campaign_list({ o }) {
      const uid = h.me();
      const sc = partnerCan(o, uid, 'sponsored_challenge');
      const ro = partnerCan(o, uid, 'reward_offer');
      if (!(sc || ro)) return err('not_allowed');
      return { ok: true, campaigns: D().campaigns.filter((c) => c.org_id === o && ((c.kind === 'sponsored_challenge' && sc) || (c.kind === 'reward_offer' && ro)))
        .sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : a.id < b.id ? -1 : 1)).map(campaignJson) };
    },

    partner_campaign_details({ campaign }) {
      const c = camp(campaign);
      if (!c || !partnerCan(c.org_id, h.me(), c.kind)) return err('not_allowed');
      return { ...campaignJson(c),
        codes_uploaded: c.code_source === 'pool' ? D().pcodes.filter((x) => x.campaign_id === c.id && !x.generated).length
          + D().rcodes.filter((x) => x.reward_id === c.reward_id).length : null,
        rewards: c.kind === 'sponsored_challenge' ? D().campaigns.filter((x) => x.for_campaign === c.id).sort(byCreated)
          .map((x) => ({ id: x.id, title: x.title, earns: x.earns, quantity: x.quantity, status: x.status, paused: !!x.paused, state: state(x) })) : null };
    },

    partner_campaign_report({ campaign }) {
      const c = camp(campaign);
      if (!c || !partnerCan(c.org_id, h.me(), c.kind)) return err('not_allowed');
      const g = h.org(c.org_id);
      const n = g.min_report_group;
      const app = c.kind === 'sponsored_challenge' ? ['views', 'opens', 'joins', 'completions']
        : c.reward_type === 'offer' ? ['views', 'opens', 'claims', 'redemptions'] : ['redemptions'];
      let final = false; let comp = null; let joined = null; let took = null; let met = null; let named = []; let engine = null; let tgt = null;
      if (c.kind === 'sponsored_challenge' && c.challenge_id) {
        engine = ch(c.challenge_id);
        tgt = engine.target;
        final = engine.status === 'finished';
        const rows = challengeRows(D(), c.challenge_id);
        joined = rows.length;
        took = rows.filter((y) => y.took_part).length;
        met = rows.filter((y) => y.goal_met).length;
        const share = (uid) => (D().pchallengePeople.find((p) => p.challenge_id === c.challenge_id && p.user_id === uid) || {}).share_with_sponsor;
        named = rows.filter((y) => final && share(y.user_id) && !partnerMinor(y.user_id))
          .map((y) => ({ first_name: (String((D().users[y.user_id] || {}).first_name || '').trim() || null), score: y.score,
            goal_met: tgt != null ? y.goal_met : null, took_part: y.took_part }))
          .sort((a, b) => b.score - a.score || String(a.first_name).localeCompare(String(b.first_name)));
        comp = final ? (tgt != null ? met : took) : null;
      }
      const byDay = new Map();
      for (const s of D().pstats.filter((x) => x.campaign_id === campaign)) {
        const row = byDay.get(s.day) || { day: s.day, v: 0, o: 0, cl: 0, j: 0, co: null, r: 0 };
        row.v += s.views; row.o += s.opens; row.cl += s.claims; row.j += s.joins; row.r += s.redemptions;
        byDay.set(s.day, row);
      }
      if (comp != null) {
        const row = byDay.get(engine.ends_on) || { day: engine.ends_on, v: null, o: null, cl: null, j: null, co: null, r: null };
        row.co = (row.co || 0) + comp;
        byDay.set(engine.ends_on, row);
      }
      const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
      const col = { views: 'v', opens: 'o', claims: 'cl', joins: 'j', completions: 'co', redemptions: 'r' };
      const has = (k) => app.includes(k);
      // Completions: a part of those who joined. Redemptions: exact (each was typed in at the partner's own counter).
      const compShown = orgCount(comp, n, joined);
      const dayRows = days.map((d) => ({ day: d.day, views: has('views') ? pcount(d.v, n) : null, opens: has('opens') ? pcount(d.o, n) : null,
        claims: has('claims') ? pcount(d.cl, n) : null, joins: has('joins') ? pcount(d.j, n) : null,
        completions: has('completions') && d.co != null ? compShown : null, redemptions: has('redemptions') ? d.r : null }));
      const tot = (k) => {
        const vals = days.map((d) => d[col[k]]).filter((x) => x != null);
        const shown = vals.filter((x) => x >= n);
        return ptotal(vals.reduce((a, b) => a + b, 0), shown.length ? shown.reduce((a, x) => a + near5(x) - 2, 0) : null, vals.some((x) => x < n), n);
      };
      const totals = { views: has('views') ? tot('views') : null, opens: has('opens') ? tot('opens') : null, claims: has('claims') ? tot('claims') : null,
        joins: has('joins') ? tot('joins') : null, completions: has('completions') ? compShown : null,
        redemptions: has('redemptions') ? days.reduce((a, d) => a + (d.r || 0), 0) : null };
      let codes = null;
      if (c.kind === 'reward_offer') {
        const qn = c.quantity;
        let issued; let uploaded; let free; let earned = null; let awarded = false; let ofN = null;
        if (c.reward_type === 'offer') {
          issued = D().pcodes.filter((x) => x.campaign_id === campaign && x.assigned_at).length;
          uploaded = c.code_source === 'pool' ? D().pcodes.filter((x) => x.campaign_id === campaign && !x.generated).length : null;
          free = c.code_source === 'pool' ? D().pcodes.filter((x) => x.campaign_id === campaign && !x.assigned_at).length : null;
        } else {
          awarded = D().rewards.some((w) => w.id === c.reward_id && w.awarded_at);
          earned = D().earned.filter((e) => e.reward_id === c.reward_id).length;
          issued = D().rcodes.filter((x) => x.reward_id === c.reward_id && x.assigned_at).length;
          uploaded = c.code_source === 'pool' ? D().rcodes.filter((x) => x.reward_id === c.reward_id).length
            + D().pcodes.filter((x) => x.campaign_id === campaign).length : null;
          free = D().rcodes.filter((x) => x.reward_id === c.reward_id && !x.assigned_at).length
            + D().pcodes.filter((x) => x.campaign_id === campaign && !x.assigned_at).length;
          // Who earned it, and so got a code, are a part of those who joined its Challenge.
          const p = camp(c.for_campaign);
          ofN = p && p.challenge_id ? joinedCount(p.challenge_id) : 0;
        }
        const used = D().predeem.filter((x) => x.campaign_id === campaign).length;
        // The most that "given out", as shown, can mean; what's left is only what the counts shown allow.
        const top = issued < n ? n - 1 : near5(issued) + 2;
        const ach = c.reward_type === 'achievement';
        codes = { quantity: qn, uploaded, earned: ach ? orgCount(earned, n, ofN) : null, issued: orgCount(issued, n, ofN), redeemed: used,
          sold_out: c.reward_type === 'offer' ? issued >= qn : null,
          remaining: ach ? (!awarded ? qn - issued : null) : issued >= qn ? 0 : `at least ${Math.max(qn - top, 1)}`,
          codes_left: free == null ? null : ach ? (!awarded ? free : null) : free === 0 ? 0 : `at least ${Math.max(free + issued - top, 1)}` };
      }
      return { campaign: campaignJson(c), min_group: n, days: dayRows, totals, codes,
        challenge: c.kind === 'sponsored_challenge' ? { started: c.challenge_id != null, final, joined: pcount(joined, n),
          took_part: orgCount(took, n, joined), goal_met: tgt != null ? orgCount(met, n, joined) : null, named } : null };
    },

    partner_codes_add({ campaign, codes }) {
      const c = camp(campaign);
      if (!c || c.kind !== 'reward_offer' || !partnerCan(c.org_id, h.me(), 'reward_offer')) return err('not_allowed');
      if (c.code_source !== 'pool') return err('code_source');
      if (c.status === 'withdrawn' || state(c) === 'ended') return err('not_open');
      if (!Array.isArray(codes) || codes.length === 0 || codes.length > limits().max_codes_per_add) return err('codes');
      const taken = (code) => D().pcodes.some((y) => y.org_id === c.org_id && y.code.toUpperCase() === code.toUpperCase())
        || D().rcodes.some((y) => y.code.toUpperCase() === code.toUpperCase() && (D().rewards.find((w) => w.id === y.reward_id) || {}).org_id === c.org_id);
      const seen = new Set();
      const clean = [];
      for (const raw of codes) {
        const code = String(raw ?? '').trim();
        if (!/^\S{4,64}$/.test(code) || seen.has(code.toUpperCase()) || taken(code)) continue;
        seen.add(code.toUpperCase());
        clean.push(code);
      }
      const total = D().pcodes.filter((x) => x.campaign_id === campaign).length + D().rcodes.filter((x) => c.reward_id && x.reward_id === c.reward_id).length;
      if (limits().max_codes != null && total + clean.length > limits().max_codes) return err('too_many');
      const now = new Date().toISOString();
      if (c.reward_id) {
        clean.forEach((code) => D().rcodes.push({ id: ++D().seq.rcode, reward_id: c.reward_id, code, added_by: h.me(), added_at: now, earned_id: null, assigned_at: null }));
        const w = D().rewards.find((x) => x.id === c.reward_id);
        if (w && w.awarded_at) award(D(), w.challenge_id);
      } else {
        clean.forEach((code) => D().pcodes.push({ id: ++D().seq.pcode, campaign_id: campaign, org_id: c.org_id, code, generated: false, added_at: now, claim_id: null, assigned_at: null }));
      }
      return { ok: true, added: clean.length, skipped: codes.length - clean.length };
    },
  });
  // InneRISE administration (082): 074's partner_staff_queue, partner_staff_approve and partner_staff_reject, wrapped for a
  // signed-in InneRISE staff member (db.staff); anyone else gets {error: 'not_allowed'}. Same order of checks, same answers.
  const isStaff = () => !!h.me() && (D().staff || []).includes(h.me());
  // 082: every staff call raises not_staff (P0001) for anyone who isn't InneRISE staff, before it does anything.
  const notStaff = () => { throw Object.assign(new Error('not_staff'), { code: 'P0001' }); };
  const waitingSince = (c) => (c.status === 'approved' ? c.revision_at : c.submitted_at) || '';
  // partner_put_challenge for a new sponsored Challenge: it goes into the engine as the partner's organization challenge.
  const newEngine = (c) => {
    const r = c.rules || {};
    const row = { id: h.newId(), org_id: c.org_id, unit_id: null, title: c.title, description: c.summary, metric: r.metric, mode: r.mode,
      goal: r.engine_goal ?? (r.mode === 'goal' ? r.daily_goal : r.mode === 'participation' ? 1 : null), target: r.target ?? null, days: r.days,
      starts_on: r.starts_on, ends_on: addDays(r.starts_on, r.days - 1), status: 'active', cancelled_running: false, side_kind: null,
      max_people: r.max_people ?? null, group_kind: null, final_of: null, advance: null, advance_n: null, finalists: [], created_by: c.created_by,
      created_at: new Date().toISOString() };
    D().challenges.push(row);
    return row.id;
  };
  // partner_put_reward for a new challenge reward, once its Sponsored Challenge is in the engine.
  const newReward = (c) => {
    const p = camp(c.for_campaign);
    if (!p || !p.challenge_id || c.reward_id) return c.reward_id || null;
    const now = new Date().toISOString();
    const row = { id: h.newId(), challenge_id: p.challenge_id, org_id: c.org_id, title: c.title, description: c.summary, kind: 'prize', earns: c.earns,
      top_n: null, quantity: c.quantity ?? null, each_group: false, created_by: c.created_by, created_at: now, approved_by: null, approved_at: now, awarded_at: null };
    D().rewards.push(row);
    return row.id;
  };
  function staffApprove(c, note) {
    if (!c) return err('not_found');
    if (!(c.status === 'submitted' || (c.status === 'approved' && c.revision != null))) return { error: 'not_submitted', status: c.status };
    const g = h.org(c.org_id);
    if (!g || g.kind !== 'partner' || g.status !== 'active') return err('not_verified');
    if (note != null && len(note) > 300) return err('note');
    if (c.kind === 'reward_offer' && !sponsorTermsOk(D(), c.org_id)) return err('sponsor_terms');
    const now = new Date().toISOString();
    const n = (txt(note) || '').trim() || null;
    if (c.status === 'approved') {
      const rev = c.revision || {};
      for (const k of ['title', 'summary', 'link', 'image_path', 'country', 'region', 'city', 'starts_on', 'ends_on', 'quantity', 'per_person']) {
        if (Object.prototype.hasOwnProperty.call(rev, k)) c[k] = rev[k];
      }
      Object.assign(c, { revision: null, revision_at: null, reviewed_at: now, review_note: n, updated_at: now });
      if (c.kind === 'sponsored_challenge') putChallenge(c);
      return { ok: true, revision: true, challenge_id: c.challenge_id || null, reward_id: c.reward_id || null };
    }
    if (c.reward_type === 'offer' && c.ends_on < earliestDay()) return err('ended');
    if (c.kind === 'sponsored_challenge') {
      const r = rules(c.org_id, { ...(c.rules || {}), title: c.title, description: c.summary, unit_id: null, sides: null });
      if (r.error) return r;
    }
    if (c.reward_type === 'achievement' && (camp(c.for_campaign) || {}).status === 'withdrawn') return err('for_campaign');
    Object.assign(c, { status: 'approved', reviewed_at: now, approved_at: now, review_note: n, updated_at: now });
    if (c.kind === 'sponsored_challenge' && !c.challenge_id) c.challenge_id = newEngine(c);
    if (c.reward_type === 'achievement') c.reward_id = newReward(c);
    return { ok: true, revision: false, challenge_id: c.challenge_id || null, reward_id: c.reward_id || null };
  }
  function staffReject(c, note) {
    const n = (txt(note) || '').trim();
    if (len(n) < 5 || len(n) > 300) return err('note');
    if (!c) return err('not_found');
    const now = new Date().toISOString();
    if (c.status === 'approved' && c.revision != null) {
      Object.assign(c, { revision: null, revision_at: null, reviewed_at: now, review_note: n, updated_at: now });
      return { ok: true, revision: true };
    }
    if (c.status !== 'submitted') return { error: 'not_submitted', status: c.status };
    Object.assign(c, { status: 'rejected', reviewed_at: now, review_note: n, updated_at: now });
    return { ok: true, revision: false };
  }
  Object.assign(fns, {
    staff_partner_queue() {
      if (!isStaff()) notStaff();
      const campaigns = D().campaigns.filter((c) => c.status === 'submitted' || (c.status === 'approved' && c.revision != null))
        .sort((a, b) => (waitingSince(a) < waitingSince(b) ? -1 : waitingSince(a) > waitingSince(b) ? 1 : a.id < b.id ? -1 : 1))
        .map((c) => {
          const g = h.org(c.org_id);
          const pp = D().pprofiles.find((x) => x.org_id === c.org_id) || {};
          return { ...campaignJson(c),
            partner: { id: g.id, name: g.name, status: g.status, legal_name: g.legal_name ?? null, website: g.website ?? null, about: pp.about ?? null,
              logo_path: pp.logo_path ?? null },
            re_review: c.status === 'approved',
            codes_uploaded: D().pcodes.filter((x) => x.campaign_id === c.id && !x.generated).length
              + D().rcodes.filter((x) => c.reward_id && x.reward_id === c.reward_id).length,
            for_status: c.for_campaign ? ((camp(c.for_campaign) || {}).status ?? null) : null };
        });
      const partners_waiting = D().orgs.filter((g) => g.kind === 'partner' && g.status === 'pending')
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1))
        .map((g) => {
          const pp = D().pprofiles.find((x) => x.org_id === g.id) || {};
          return { id: g.id, name: g.name, legal_name: g.legal_name ?? null, website: g.website ?? null, contact_email: g.contact_email ?? null,
            country: g.country ?? null, created_at: g.created_at, about: pp.about ?? null, plan: pp.plan_requested ?? null };
        });
      return { campaigns, partners_waiting };
    },
    staff_partner_decide({ campaign, approve, note }) {
      if (!isStaff()) notStaff();
      if (approve == null) return err('approve');
      return approve ? staffApprove(camp(campaign), note) : staffReject(camp(campaign), note);
    },
  });
  return fns;
}
