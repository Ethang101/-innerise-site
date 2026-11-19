// InneRISE Dashboard: an in-memory stand-in for InneRISE's server, with made-up sample data.
// Used with ?demo in the address, and automatically while config.js still has the placeholder key.
// Nothing leaves the browser and every reload starts over.
//   ?demo          Alex, administrator of three organizations; starts in Northside Health (a business)
//   ?demo=school   the same, starting in Riverside Schools (a district, still being verified)
//   ?demo=partner  the same, starting in Peak Fitness (a partner, still being verified)
//   ?demo=new      Sam, a brand-new account with no organization yet
//   ?demo=manager  Jordan, manager of the Sales department at Northside Health (not an administrator anywhere)
//   ?demo=district Alex again, starting in Riverside Schools, already verified, with teachers, classrooms and students
//   ?demo=sponsor  Alex again, starting in Peak Fitness, already verified, with sponsored Challenges and offers running
//   ?demo=counter  Jess, rewards manager at Peak Fitness (the same data as ?demo=sponsor; Alex is its administrator)
//   ?demo=teacher  Rachel, Room 112's teacher at Riverside Schools (the same data as ?demo=district; Alex is its administrator)
//   ?demo=billing  Alex again, starting in Northside Health's Billing, with sample plans to choose from; Peak Fitness,
//                  verified, already subscribes (the plan names are made up: InneRISE hasn't added any plans yet)
//   ?demo=dealers  Alex again, starting in Lakeshore Auto Group: dealerships in districts and regions, a step challenge with
//                  dealerships ranked within each region, its final round, and rewards for the best of each region
//   ?demo=redeemer Kim, who works the front desks at Northside Health and can redeem prizes at the Riverside clinic and the
//                  Downtown office (Can Redeem Prizes), and nothing else
//   ?demo=gymdesk  Dana, at the front desk of Peak Fitness's Riverfront gym: Can Redeem Prizes there, and nothing else
//                  (the same data as ?demo=sponsor; Alex is its administrator)
//   ?demo=staff    Morgan, who works at InneRISE (InneRISE staff) and runs InneRISE's own team: InneRISE administration, with
//                  Riverside Schools, Summit Climbing Gym and Lakeview College waiting to be verified, two of Peak Fitness's
//                  campaigns (one new, one changed), its logo and prize terms, and a library template waiting (demo-staff.js)
// A sign-in handed over by the app (#handoff=<token_hash>) always works here, except a token starting "expired".
//
// It mirrors the org_* functions in 068_organizations.sql and 070_org_details.sql: the same argument
// names, the same rules and the same error codes, including the guard that an organization never loses
// its last administrator while anyone else is in it. Calls with the wrong argument names fail the way
// PostgREST does, so the demo catches mistakes the real server would. Challenges and Rewards (072) and
// InneRISE Partners (074) live in demo-programs.js, Workplace App Management and School Focus (071a and 071b) in demo-focus.js,
// the Challenge & Rewards Library and habit challenges (075) in demo-library.js, organization billing (076, with its
// two Edge Functions, billing-checkout and billing-portal) in demo-billing.js, and the Prize Wallet (078, with Storage's
// prize-logos bucket and 074's two-step counter) in demo-prizes.js, InneRISE administration (082's staff_* functions) and the
// Reports section's org_report_places in demo-staff.js; they all plug in here.

import { PROGRAM_SIGNATURES, programFunctions, seedPrograms } from './demo-programs.js';
import { FOCUS_SIGNATURES, FOCUS_SERVICE_ROLE, focusFunctions, seedFocus } from './demo-focus.js';
import { LIBRARY_SIGNATURES, LIBRARY_SERVICE_ROLE, libraryFunctions, seedLibrary } from './demo-library.js';
import { BILLING_SIGNATURES, BILLING_SERVICE_ROLE, billingFunctions, seedBilling } from './demo-billing.js';
import { PRIZE_SIGNATURES, PRIZE_SERVICE_ROLE, prizeFunctions, seedPrizes, rotating } from './demo-prizes.js';
import { STAFF_SIGNATURES, staffFunctions, seedStaff, INNERISE_TEAM } from './demo-staff.js';

const DAY = 864e5;
const LATENCY = 90;
const ME = '3f6c2a10-8d4e-4b1a-9c55-0a7d2e4b9001';
const NORTHSIDE = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c10';
const RIVERSIDE = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c20';
const PEAK = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c30';
const LAKESHORE = 'b1d0c7e2-5a3f-4c8e-9d21-6e0f4a7b2c40'; // ?demo=dealers
const ALEX_OTHER = '5e7b0000-2c4d-4f6a-8b1c-900000000000'; // Alex, when the demo signs in as someone else
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const FREE_MAIL = ['gmail.com', 'googlemail.com', 'icloud.com', 'me.com', 'mac.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'hey.com', 'fastmail.com',
  'privaterelay.appleid.com', 'duck.com', 'qq.com', '163.com', 'comcast.net', 'verizon.net', 'att.net'];
const ORG_KINDS = ['business', 'school', 'district', 'college', 'partner'];
const UNIT_KINDS = ['location', 'department', 'team', 'school', 'campus', 'grade', 'classroom', 'college', 'program', 'group', 'region', 'district'];
const MEMBER_TYPES = ['employee', 'student', 'staff', 'teacher', 'partner'];
const ROLES = ['admin', 'unit_manager', 'teacher', 'challenge_coordinator', 'rewards_manager', 'billing_contact', 'privacy_contact', 'prize_redeemer'];

// Signatures: every argument by name, and the ones without a default.
const SIGNATURES = {
  org_create: { args: ['k', 'nm', 'tz'], required: ['k', 'nm'] },
  org_unit_add: { args: ['o', 'parent', 'k', 'nm', 'grade'], required: ['o', 'parent', 'k', 'nm'], uuids: ['o', 'parent'] },
  org_unit_rename: { args: ['u', 'nm'], required: ['u', 'nm'], uuids: ['u'] },
  org_unit_remove: { args: ['u'], required: ['u'], uuids: ['u'] },
  org_invite_create: { args: ['o', 'u', 'mtype', 'uses', 'days'], required: ['o', 'u', 'mtype'], uuids: ['o', 'u'] },
  org_invite_close: { args: ['code_in'], required: ['code_in'] },
  org_leave: { args: ['o'], required: ['o'], uuids: ['o'] },
  org_member_remove: { args: ['o', 'who'], required: ['o', 'who'], uuids: ['o', 'who'] },
  org_role_set: { args: ['o', 'who', 'r', 'u', 'give'], required: ['o', 'who', 'r', 'u', 'give'], uuids: ['o', 'who', 'u'] },
  org_admin_transfer: { args: ['o', 'who'], required: ['o', 'who'], uuids: ['o', 'who'] },
  org_settings_set: { args: ['o', 'min_group'], required: ['o', 'min_group'], uuids: ['o'] },
  org_members_list: { args: ['o', 'u', 'max_rows', 'skip'], required: ['o'], uuids: ['o', 'u'] },
  org_mine: { args: [], required: [] },
  org_handover_needed: { args: [], required: [] },
  org_admin_view: { args: ['o'], required: ['o'], uuids: ['o'] },
  org_profile_set: { args: ['o', 'd'], required: ['o', 'd'], uuids: ['o'] },
  org_unit_details_set: { args: ['u', 'd'], required: ['u', 'd'], uuids: ['u'] },
  org_domain_add: { args: ['o', 'dom'], required: ['o', 'dom'], uuids: ['o'] },
  org_domain_remove: { args: ['o', 'dom'], required: ['o', 'dom'], uuids: ['o'] },
  org_details: { args: ['o'], required: ['o'], uuids: ['o'] },
};
Object.assign(SIGNATURES, PROGRAM_SIGNATURES, FOCUS_SIGNATURES, LIBRARY_SIGNATURES, BILLING_SIGNATURES, PRIZE_SIGNATURES, STAFF_SIGNATURES);
const SERVICE_ROLE_ONLY = ['org_staff_set_status', 'org_staff_set_offerings', 'org_staff_set_admin', 'org_last_admin_of',
  'org_challenge_award', 'partner_staff_queue', 'partner_staff_approve', 'partner_staff_reject', ...FOCUS_SERVICE_ROLE,
  ...LIBRARY_SERVICE_ROLE, ...BILLING_SERVICE_ROLE, ...PRIZE_SERVICE_ROLE];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const iso = (t) => new Date(t).toISOString();
const err = (code) => ({ error: code });
const trimmed = (s) => String(s ?? '').trim();
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

class Raised extends Error {
  constructor(message, code = 'P0001') {
    super(message);
    this.code = code;
  }
}

function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, h);
}

function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Sample data -------------------------------------------------------------------------------------
function seed(start) {
  const now = Date.now();
  const db = { orgs: [], units: [], members: [], unitMembers: [], roles: [], invitations: [], domains: [], usage: {}, users: {} };
  db.users[ME] = start === 'new'
    ? { id: ME, first_name: 'Sam', email: 'sam@harborlight.example', email_confirmed_at: iso(now - 30 * DAY) }
    : start === 'manager'
      ? { id: ME, first_name: 'Jordan', email: 'jordan@northsidehealth.example', email_confirmed_at: iso(now - 150 * DAY) }
      : start === 'counter'
        ? { id: ME, first_name: 'Jess', email: 'jess@peakfitness.example', email_confirmed_at: iso(now - 80 * DAY) }
      : start === 'teacher'
        ? { id: ME, first_name: 'Rachel', email: 'rachel@riversideschools.example', email_confirmed_at: iso(now - 50 * DAY) }
      : start === 'redeemer'
        ? { id: ME, first_name: 'Kim', email: 'kim@northsidehealth.example', email_confirmed_at: iso(now - 70 * DAY) }
      : start === 'gymdesk'
        ? { id: ME, first_name: 'Dana', email: 'dana@peakfitness.example', email_confirmed_at: iso(now - 40 * DAY) }
      : start === 'staff'
        ? { id: ME, first_name: 'Morgan', email: 'morgan@innerise.example', email_confirmed_at: iso(now - 300 * DAY) }
      : { id: ME, first_name: 'Alex', email: 'alex@northsidehealth.example', email_confirmed_at: iso(now - 200 * DAY) };
  // Sam has no organization yet: every program starts empty, InneRISE's starter templates aside.
  if (start === 'new') return seedPrizes(seedBilling(seedLibrary(seedFocus(seedPrograms(db, start, null), start, null), start, null), start, null), start, null);
  const ALEX = ['manager', 'counter', 'teacher', 'redeemer', 'gymdesk', 'staff'].includes(start) ? ALEX_OTHER : ME;
  const live = ['sponsor', 'counter', 'billing', 'gymdesk', 'staff'].includes(start); // Peak Fitness verified, with its history

  const O = NORTHSIDE;
  db.orgs.push({
    id: O, kind: 'business', name: 'Northside Health', status: 'active', verified_at: null,
    offers_workplace: true, offers_challenges: true, min_report_group: 5, time_zone: 'America/Detroit',
    created_by: ME, created_at: iso(now - 120 * DAY),
    legal_name: 'Northside Health Partners, LLC', website: 'https://northsidehealth.example',
    contact_email: 'people@northsidehealth.example', contact_phone: '+1 313 555 0142',
    street: '200 Griswold Street', city: 'Detroit', region: 'MI', postal_code: '48226', country: 'US',
  });
  db.domains.push({ org_id: O, domain: 'northsidehealth.example', verified_by: ME, verified_at: iso(now - 119 * DAY) });

  const unit = (id, parent, kind, name, extra = {}) => {
    db.units.push({ id, org_id: O, parent_id: parent, kind, name, grade_level: null, created_at: iso(now - 110 * DAY),
      street: null, city: null, region: null, postal_code: null, country: null, time_zone: null, ...extra });
    return id;
  };
  const riv = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e01', null, 'location', 'Riverside clinic',
    { street: '2150 Riverside Drive', city: 'Detroit', region: 'MI', postal_code: '48207', country: 'US' });
  const rivN = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e02', riv, 'department', 'Nursing');
  const rivF = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e03', riv, 'department', 'Front desk');
  const rivT = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e04', rivN, 'team', 'Night shift');
  const dt = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e05', null, 'location', 'Downtown office');
  const dtN = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e06', dt, 'department', 'Nursing');
  const dtF = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e07', dt, 'department', 'Front desk');

  // name, age band, status, units
  const people = [
    ['Alex', 'adult', 'active', [dt]],
    ['Maria', 'adult', 'active', [riv]],
    ['Dev', 'adult', 'active', [dtF]],
    ['Priya', 'adult', 'active', [rivN]],
    ['Jamal', 'adult', 'active', [rivT]],
    ['Hannah', 'adult', 'active', [rivF]],
    ['Luis', 'adult', 'active', [dtN]],
    ['Grace', 'adult', 'active', [dtF]],
    ['Omar', 'adult', 'active', [riv]],
    ['Chloe', 'adult', 'active', [dtN]],
    ['Ben', 'adult', 'active', [rivF]],
    ['Tessa', 'teen', 'active', [rivF]],
    ['Noah', 'adult', 'pending', [dt]],
    ['Aisha', 'adult', 'active', [rivN, dtN]],
    ['Sofia', 'adult', 'active', [rivN]],
    ['Mei', 'adult', 'active', [rivN]],
    ['Carlos', 'adult', 'active', [rivF]],
    ['Nina', 'adult', 'active', [rivF]],
  ];
  const ids = {};
  people.forEach(([name, band, status, units], i) => {
    const id = i === 0 ? ALEX : `5e7b${String(i).padStart(4, '0')}-2c4d-4f6a-8b1c-${String(9e11 + i * 7919).slice(0, 12)}`;
    ids[name] = id;
    if (id !== ME) db.users[id] = { id, first_name: name, email: `${name.toLowerCase()}@northsidehealth.example`, email_confirmed_at: iso(now - 90 * DAY) };
    db.members.push({ org_id: O, user_id: id, member_type: 'employee', age_band: band, status,
      joined_at: iso(now - (100 - i * 5) * DAY), ended_at: null });
    for (const u of units) db.unitMembers.push({ unit_id: u, user_id: id, org_id: O, added_at: iso(now - 60 * DAY) });
  });
  const role = (name, r, u = null) => db.roles.push({ id: newId(), org_id: O, user_id: ids[name], role: r, unit_id: u,
    granted_by: ME, granted_at: iso(now - 80 * DAY) });
  role('Alex', 'admin');
  role('Maria', 'unit_manager', riv);
  role('Dev', 'challenge_coordinator');
  role('Chloe', 'billing_contact');

  const code = (c, u, uses, max, made, expires) => db.invitations.push({ id: newId(), org_id: O, unit_id: u, member_type: 'employee',
    code: c, max_uses: max, uses, status: 'open', created_by: ME, created_at: iso(now - made * DAY), expires_at: iso(now + expires * DAY) });
  code('RVC7K2PM', riv, 6, 25, 5, 9);
  code('DTN4HQ8X', dt, 3, 10, 2, 12);
  code('NHW3ZB6T', null, 0, 200, 1, 44);
  code('QX5TB9MW', rivF, 2, 2, 20, -6); // used up and expired: not listed

  // ?demo=redeemer: Kim, at the Riverside clinic's front desk (her Can Redeem Prizes roles come with the prizes, demo-prizes.js).
  if (start === 'redeemer') {
    db.members.push({ org_id: O, user_id: ME, member_type: 'employee', age_band: 'adult', status: 'active', joined_at: iso(now - 70 * DAY), ended_at: null });
    db.unitMembers.push({ unit_id: rivF, user_id: ME, org_id: O, added_at: iso(now - 70 * DAY) });
    ids.Kim = ME;
  }

  const refs = { ids, me: ME, northside: O, riverside: RIVERSIDE, peak: PEAK, riv, rivN, rivF, dt, sales: null,
    district: ['district', 'teacher'].includes(start), sponsor: live, students: {} };

  // ?demo=manager: Jordan manages the Sales department at the Downtown office, with two people in it.
  if (start === 'manager') {
    const sales = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e08', dt, 'department', 'Sales');
    const outreach = unit('c2a1e0f4-1b7d-4e22-8a90-3d5c6b7a8e09', sales, 'team', 'Community outreach');
    [['Jordan', ME, sales], ['Rosa', '5e7b0101-2c4d-4f6a-8b1c-900000101010', sales], ['Theo', '5e7b0102-2c4d-4f6a-8b1c-900000102020', outreach]]
      .forEach(([name, id, u], i) => {
        if (id !== ME) db.users[id] = { id, first_name: name, email: `${name.toLowerCase()}@northsidehealth.example`, email_confirmed_at: iso(now - 90 * DAY) };
        ids[name] = id;
        db.members.push({ org_id: O, user_id: id, member_type: 'employee', age_band: 'adult', status: 'active', joined_at: iso(now - (60 - i * 5) * DAY), ended_at: null });
        db.unitMembers.push({ unit_id: u, user_id: id, org_id: O, added_at: iso(now - 50 * DAY) });
      });
    db.roles.push({ id: newId(), org_id: O, user_id: ME, role: 'unit_manager', unit_id: sales, granted_by: ALEX, granted_at: iso(now - 40 * DAY) });
    code('SLS5RT8K', sales, 2, 15, 3, 18);
    refs.sales = sales;
  }

  // Riverside Schools: a district still waiting for InneRISE to verify it. Its administrator has set up
  // schools, grades and classrooms, but no one else can have joined yet: codes only work once it's verified.
  // With ?demo=district (and ?demo=teacher) it's verified, and teachers, staff and students have joined.
  const district = refs.district;
  const blank = { street: null, city: null, region: null, postal_code: null, country: null, time_zone: null, grade_level: null };
  db.orgs.push({
    id: RIVERSIDE, kind: 'district', name: 'Riverside Schools', status: district ? 'active' : 'pending',
    verified_at: district ? iso(now - 40 * DAY) : null,
    offers_workplace: false, offers_challenges: true, min_report_group: 10, time_zone: 'America/Detroit',
    created_by: ME, created_at: iso(now - (district ? 45 : 2) * DAY),
    legal_name: 'Riverside Community School District', website: 'https://riversideschools.example',
    contact_email: 'office@riversideschools.example', contact_phone: '+1 313 555 0190',
    street: '900 Monroe Avenue', city: 'Detroit', region: 'MI', postal_code: '48226', country: 'US',
  });
  db.members.push({ org_id: RIVERSIDE, user_id: ALEX, member_type: 'staff', age_band: 'adult', status: 'active', joined_at: iso(now - 2 * DAY), ended_at: null });
  db.roles.push({ id: newId(), org_id: RIVERSIDE, user_id: ALEX, role: 'admin', unit_id: null, granted_by: ALEX, granted_at: iso(now - 2 * DAY) });
  let n = 0;
  const sunit = (org, parent, kind, name, extra = {}) => {
    n += 1;
    const id = `d4e5f6a7-0000-4c00-8000-${String(n).padStart(12, '0')}`;
    db.units.push({ id, org_id: org, parent_id: parent, kind, name, created_at: iso(now - DAY), ...blank, ...extra });
    return id;
  };
  const lin = sunit(RIVERSIDE, null, 'school', 'Lincoln Elementary', { street: '1400 Lincoln Street', city: 'Detroit', region: 'MI', postal_code: '48208', country: 'US' });
  const g3 = sunit(RIVERSIDE, lin, 'grade', 'Grade 3', { grade_level: 3 });
  const r112 = sunit(RIVERSIDE, g3, 'classroom', 'Room 112');
  const r114 = sunit(RIVERSIDE, g3, 'classroom', 'Room 114');
  const g4 = sunit(RIVERSIDE, lin, 'grade', 'Grade 4', { grade_level: 4 });
  const r201 = sunit(RIVERSIDE, g4, 'classroom', 'Room 201');
  const mid = sunit(RIVERSIDE, null, 'school', 'Riverside Middle School', { street: '75 Water Street', city: 'Detroit', region: 'MI', postal_code: '48207', country: 'US' });
  const g7 = sunit(RIVERSIDE, mid, 'grade', 'Grade 7', { grade_level: 7 });
  const sci7 = sunit(RIVERSIDE, g7, 'classroom', 'Science 7A');
  const g8 = sunit(RIVERSIDE, mid, 'grade', 'Grade 8', { grade_level: 8 });
  const r204 = sunit(RIVERSIDE, g8, 'classroom', 'Room 204');
  sunit(RIVERSIDE, mid, 'group', 'Robotics club');
  Object.assign(refs, { lin, g3, g4, g7, r112, r114, r201, sci7 });

  if (district) {
    // Staff: a teacher for Room 112, the middle school's principal, and the district's challenge coordinator.
    let k = 0;
    const join = (name, mtype, band, units, email = true) => {
      k += 1;
      const id = start === 'teacher' && name === 'Rachel' ? ME // ?demo=teacher: signed in as Rachel
        : `6f8c${String(k).padStart(4, '0')}-3d5e-4a7b-9c2d-${String(800000000000 + k * 104729).slice(0, 12)}`;
      ids[name] = id;
      db.users[id] = { id, first_name: name, email: email ? `${name.toLowerCase()}@riversideschools.example` : null,
        email_confirmed_at: email ? iso(now - 50 * DAY) : null };
      db.members.push({ org_id: RIVERSIDE, user_id: id, member_type: mtype, age_band: band, status: 'active',
        joined_at: iso(now - (38 - (k % 8)) * DAY), ended_at: null });
      for (const u of units) db.unitMembers.push({ unit_id: u, user_id: id, org_id: RIVERSIDE, added_at: iso(now - 36 * DAY) });
      return id;
    };
    const srole = (who, r, u = null) => db.roles.push({ id: newId(), org_id: RIVERSIDE, user_id: who, role: r, unit_id: u,
      granted_by: ALEX, granted_at: iso(now - 37 * DAY) });
    srole(join('Rachel', 'teacher', 'adult', [r112]), 'teacher', r112);
    srole(join('Marcus', 'staff', 'adult', [mid]), 'unit_manager', mid);
    srole(join('Elena', 'staff', 'adult', []), 'challenge_coordinator');
    const rooms = [
      [r112, 'under13', ['Amara', 'Bodhi', 'Callie', 'Diego', 'Elsie', 'Finn', 'Gia', 'Hector']],
      [r114, 'under13', ['Ines', 'Jasper', 'Kenji', 'Lola', 'Milo', 'Nadia']],
      [r201, 'under13', ['Oliver', 'Paloma', 'Quentin', 'Riya', 'Sami', 'Talia', 'Uriel', 'Vera', 'Wes', 'Ximena']],
      [sci7, 'teen', ['Yusuf', 'Zara', 'Andre', 'Bianca', 'Cyrus', 'Daria', 'Emil', 'Fiona']],
      [r204, 'teen', ['Gabe', 'Hana', 'Ivan', 'Jolie', 'Kofi', 'Lucia']],
    ];
    for (const [room, band, names] of rooms) {
      for (const name of names) refs.students[name] = { id: join(name, 'student', band, [room], false), unit: room, band };
    }
    const scode = (c, u, mtype, uses, max) => db.invitations.push({ id: newId(), org_id: RIVERSIDE, unit_id: u, member_type: mtype,
      code: c, max_uses: max, uses, status: 'open', created_by: ALEX, created_at: iso(now - 6 * DAY), expires_at: iso(now + 8 * DAY) });
    scode('RM1127KQ', r112, 'student', 8, 30);
    scode('LNS4TCH9', lin, 'teacher', 3, 10);
  }

  // Peak Fitness: a gym partner, also still being verified (verified, with a history, in ?demo=sponsor).
  db.orgs.push({
    id: PEAK, kind: 'partner', name: 'Peak Fitness', status: live ? 'active' : 'pending',
    verified_at: live ? iso(now - 70 * DAY) : null,
    offers_workplace: true, offers_challenges: true, min_report_group: 5, time_zone: 'America/Detroit',
    created_by: ME, created_at: iso(now - DAY),
    legal_name: null, website: 'https://peakfitness.example', contact_email: 'hello@peakfitness.example',
    contact_phone: null, street: null, city: 'Detroit', region: 'MI', postal_code: null, country: 'US',
  });
  db.members.push({ org_id: PEAK, user_id: ALEX, member_type: 'employee', age_band: 'adult', status: 'active', joined_at: iso(now - DAY), ended_at: null });
  db.roles.push({ id: newId(), org_id: PEAK, user_id: ALEX, role: 'admin', unit_id: null, granted_by: ALEX, granted_at: iso(now - DAY) });
  // ?demo=counter: Jess works the front desk and looks after rewards and offers (074's rewards_manager), not an administrator.
  if (start === 'counter') {
    db.members.push({ org_id: PEAK, user_id: ME, member_type: 'employee', age_band: 'adult', status: 'active', joined_at: iso(now - 60 * DAY), ended_at: null });
    db.roles.push({ id: newId(), org_id: PEAK, user_id: ME, role: 'rewards_manager', unit_id: null, granted_by: ALEX, granted_at: iso(now - 59 * DAY) });
  }
  const midtown = sunit(PEAK, null, 'location', 'Midtown studio', { street: '3100 Woodward Avenue', city: 'Detroit', region: 'MI', postal_code: '48201', country: 'US' });
  sunit(PEAK, midtown, 'team', 'Trainers');
  refs.riverfront = sunit(PEAK, null, 'location', 'Riverfront gym');
  // ?demo=gymdesk: Dana works the Riverfront gym's front desk (her Can Redeem Prizes role comes with the prizes, demo-prizes.js).
  if (start === 'gymdesk') {
    db.members.push({ org_id: PEAK, user_id: ME, member_type: 'employee', age_band: 'adult', status: 'active', joined_at: iso(now - 40 * DAY), ended_at: null });
    db.unitMembers.push({ unit_id: refs.riverfront, user_id: ME, org_id: PEAK, added_at: iso(now - 40 * DAY) });
  }

  // ?demo=dealers: Lakeshore Auto Group, a dealer group Alex runs, with its dealerships in districts and regions (072's unit
  // kinds region and district): Region › District › Dealership. Its step challenges compare dealerships within each region,
  // and the best of each region went through to a final round.
  if (start === 'dealers') {
    const L = LAKESHORE;
    db.orgs.push({
      id: L, kind: 'business', name: 'Lakeshore Auto Group', status: 'active', verified_at: iso(now - 150 * DAY),
      offers_workplace: false, offers_challenges: true, min_report_group: 5, time_zone: 'America/Detroit',
      created_by: ME, created_at: iso(now - 160 * DAY),
      legal_name: 'Lakeshore Auto Group, Inc.', website: 'https://lakeshoreauto.example',
      contact_email: 'people@lakeshoreauto.example', contact_phone: '+1 313 555 0177',
      street: '1 Lakeshore Plaza', city: 'Dearborn', region: 'MI', postal_code: '48126', country: 'US',
    });
    db.domains.push({ org_id: L, domain: 'lakeshoreauto.example', verified_by: ME, verified_at: iso(now - 149 * DAY) });
    let u = 0;
    const lunit = (parent, kind, name, extra = {}) => {
      u += 1;
      const id = `b7c1d2e3-0000-4c00-8000-${String(u).padStart(12, '0')}`;
      db.units.push({ id, org_id: L, parent_id: parent, kind, name, created_at: iso(now - 140 * DAY), ...blank, ...extra });
      return id;
    };
    const greatLakes = lunit(null, 'region', 'Great Lakes');
    const detroit = lunit(greatLakes, 'district', 'Detroit metro');
    const westMi = lunit(greatLakes, 'district', 'West Michigan');
    const ohioValley = lunit(null, 'region', 'Ohio Valley');
    const nwOhio = lunit(ohioValley, 'district', 'Northwest Ohio');
    const central = lunit(ohioValley, 'district', 'Central Ohio');
    const store = (district, name, city, region) => lunit(district, 'location', name, { city, region, country: 'US', time_zone: region === 'OH' ? 'America/New_York' : null });
    const stores = {
      dearborn: store(detroit, 'Lakeshore Dearborn', 'Dearborn', 'MI'), troy: store(detroit, 'Lakeshore Troy', 'Troy', 'MI'),
      grandRapids: store(westMi, 'Lakeshore Grand Rapids', 'Grand Rapids', 'MI'), kalamazoo: store(westMi, 'Lakeshore Kalamazoo', 'Kalamazoo', 'MI'),
      toledo: store(nwOhio, 'Lakeshore Toledo', 'Toledo', 'OH'), findlay: store(nwOhio, 'Lakeshore Findlay', 'Findlay', 'OH'),
      columbus: store(central, 'Lakeshore Columbus', 'Columbus', 'OH'), dublin: store(central, 'Lakeshore Dublin', 'Dublin', 'OH'),
    };
    const crew = {
      dearborn: ['Avery', 'Brooke', 'Cole', 'Dana', 'Eli', 'Fern'], troy: ['Gina', 'Hank', 'Imani', 'Jamie', 'Kyle', 'Lena'],
      grandRapids: ['Marco', 'Nia', 'Owen', 'Petra', 'Quinn', 'Rafael'], kalamazoo: ['Sage', 'Tariq', 'Una', 'Vince', 'Wren', 'Xavi'],
      toledo: ['Yara', 'Zack', 'Abby', 'Boris', 'Cora', 'Dmitri'], findlay: ['Esme', 'Flynn', 'Greta', 'Hugo', 'Ivy', 'Joel'],
      columbus: ['Kira', 'Liam', 'Mona', 'Nate', 'Olga', 'Pablo'], dublin: ['Remy', 'Sasha', 'Theo', 'Uma', 'Vera', 'Wade'],
    };
    const lids = {};
    const lpeople = [];
    db.members.push({ org_id: L, user_id: ALEX, member_type: 'employee', age_band: 'adult', status: 'active', joined_at: iso(now - 160 * DAY), ended_at: null });
    db.roles.push({ id: newId(), org_id: L, user_id: ALEX, role: 'admin', unit_id: null, granted_by: ALEX, granted_at: iso(now - 160 * DAY) });
    let k = 0;
    for (const [key, names] of Object.entries(crew)) {
      for (const name of names) {
        k += 1;
        const id = `7a9d${String(k).padStart(4, '0')}-4e5f-4a6b-8c7d-${String(700000000000 + k * 7919).slice(0, 12)}`;
        lids[name] = id;
        // Jamie is a 17-year-old apprentice at Troy: counted, never named.
        const band = name === 'Jamie' ? 'teen' : 'adult';
        db.users[id] = { id, first_name: name, email: `${name.toLowerCase()}@lakeshoreauto.example`, email_confirmed_at: iso(now - 120 * DAY) };
        db.members.push({ org_id: L, user_id: id, member_type: 'employee', age_band: band, status: 'active', joined_at: iso(now - (130 - k) * DAY), ended_at: null });
        db.unitMembers.push({ unit_id: stores[key], user_id: id, org_id: L, added_at: iso(now - 120 * DAY) });
        lpeople.push({ name, id, store: key, unit: stores[key], band, k });
      }
    }
    const lrole = (name, r, unitId = null) => db.roles.push({ id: newId(), org_id: L, user_id: lids[name], role: r, unit_id: unitId,
      granted_by: ALEX, granted_at: iso(now - 100 * DAY) });
    lrole('Dana', 'unit_manager', greatLakes);
    lrole('Kira', 'unit_manager', ohioValley);
    lrole('Marco', 'challenge_coordinator');
    lrole('Petra', 'rewards_manager');
    db.invitations.push({ id: newId(), org_id: L, unit_id: greatLakes, member_type: 'employee', code: 'LKS7Q2WM', max_uses: 400, uses: 24,
      status: 'open', created_by: ALEX, created_at: iso(now - 10 * DAY), expires_at: iso(now + 20 * DAY) });
    refs.dealers = { org: L, ids: lids, people: lpeople, stores, greatLakes, ohioValley, detroit, westMi, nwOhio, central };
  }
  return seedStaff(seedPrizes(seedBilling(seedLibrary(seedFocus(seedPrograms(db, start, refs), start, refs), start, refs), start, refs), start, refs), start, refs);
}

// The demo client: the same shape as supabase-js (auth + rpc) -------------------------------------
export function createDemoClient(start = 'sample') {
  const startOrg = start === 'new' ? null : ['school', 'district', 'teacher'].includes(start) ? RIVERSIDE
    : ['partner', 'sponsor', 'counter', 'gymdesk'].includes(start) ? PEAK : start === 'dealers' ? LAKESHORE : start === 'staff' ? INNERISE_TEAM
      : NORTHSIDE; // redeemer: Northside
  let db = seed(start);
  let session = null;
  const listeners = new Set();

  const emit = (event) => listeners.forEach((fn) => fn(event, session));
  const startSession = (email, provider) => {
    const user = db.users[ME];
    if (email) user.email = String(email).trim().toLowerCase();
    user.email_confirmed_at = user.email_confirmed_at || iso(Date.now());
    session = {
      access_token: 'demo', token_type: 'bearer', expires_in: 3600,
      user: { id: ME, email: user.email, email_confirmed_at: user.email_confirmed_at, app_metadata: { provider } },
    };
    emit('SIGNED_IN');
    return session;
  };

  const authApi = {
    async getSession() {
      return { data: { session }, error: null };
    },
    onAuthStateChange(fn) {
      listeners.add(fn);
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
    },
    async signInWithOAuth({ provider }) {
      await wait(LATENCY);
      startSession(null, provider);
      return { data: { provider, url: null }, error: null };
    },
    async signInWithOtp({ email }) {
      await wait(LATENCY);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim())) {
        return { data: {}, error: { message: 'Unable to validate email address: invalid format', status: 400 } };
      }
      return { data: {}, error: null };
    },
    async verifyOtp({ email, token, token_hash, type }) {
      await wait(LATENCY);
      if (token_hash !== undefined) {
        // The app's hand-over: a magic-link token hash, used once.
        if (type !== 'magiclink' || !token_hash || /^expired/i.test(String(token_hash))) {
          return { data: { session: null, user: null }, error: { message: 'Email link is invalid or has expired', status: 403, code: 'otp_expired' } };
        }
        const s = startSession(null, 'handoff');
        return { data: { session: s, user: s.user }, error: null };
      }
      if (!/^\d{6}$/.test(String(token || ''))) {
        return { data: {}, error: { message: 'Token has expired or is invalid', status: 403 } };
      }
      const s = startSession(email, 'email');
      return { data: { session: s, user: s.user }, error: null };
    },
    async signOut() {
      session = null;
      emit('SIGNED_OUT');
      return { error: null };
    },
  };

  // Helpers, as in the SQL ---------------------------------------------------------------------------
  const me = () => (session ? session.user.id : null);
  const org = (o) => db.orgs.find((g) => g.id === o);
  const unitOf = (u) => db.units.find((x) => x.id === u);
  const member = (o, uid) => db.members.find((m) => m.org_id === o && m.user_id === uid);
  const isActive = (o, uid) => { const m = member(o, uid); return !!m && m.status === 'active'; };
  const isIn = (o, uid) => { const m = member(o, uid); return !!m && (m.status === 'active' || m.status === 'pending'); };
  const adultNonStudent = (o, uid) => { const m = member(o, uid); return !!m && m.status === 'active' && m.age_band === 'adult' && m.member_type !== 'student'; };

  function chain(u) {
    const out = [];
    let x = unitOf(u);
    for (let depth = 0; x && depth <= 20; depth++) {
      out.push(x.id);
      x = x.parent_id ? unitOf(x.parent_id) : null;
    }
    return out;
  }
  function below(u) {
    const out = [u];
    for (let i = 0; i < out.length && out.length < 20000; i++) {
      db.units.filter((x) => x.parent_id === out[i]).forEach((x) => out.push(x.id));
    }
    return out;
  }
  function hasRole(o, uid, roles, u = null) {
    const g = org(o);
    if (!g || !['active', 'pending'].includes(g.status) || !isActive(o, uid)) return false;
    const up = u ? chain(u) : [];
    return db.roles.some((r) => r.org_id === o && r.user_id === uid && (roles.includes(r.role) || r.role === 'admin')
      && (r.unit_id == null || (u != null && up.includes(r.unit_id))));
  }
  function count(uid, what, limit) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `${uid}:${day}`;
    const row = (db.usage[key] = db.usage[key] || { orgs: 0, codes: 0, joins: 0, previews: 0 });
    row[what] += 1;
    return row[what] <= limit;
  }
  function lastAdminOf(target) {
    return db.orgs.filter((g) => g.status !== 'closed'
      && db.roles.some((r) => r.org_id === g.id && r.user_id === target && r.role === 'admin' && isActive(g.id, r.user_id))
      && !db.roles.some((r) => r.org_id === g.id && r.role === 'admin' && r.user_id !== target && isActive(g.id, r.user_id))
      && db.members.some((m) => m.org_id === g.id && m.user_id !== target && (m.status === 'active' || m.status === 'pending')))
      .sort(byName).map((g) => ({ org_id: g.id, name: g.name }));
  }
  // The guard (org_keep_admin): checked after every change, like the deferred trigger at commit.
  function keepAdmin() {
    for (const g of db.orgs) {
      if (g.status === 'closed') continue;
      if (db.roles.some((r) => r.org_id === g.id && r.role === 'admin' && isActive(g.id, r.user_id))) continue;
      if (db.members.some((m) => m.org_id === g.id && (m.status === 'active' || m.status === 'pending'))) {
        throw new Raised('org_last_admin: this organization still has people in it. Make someone else its administrator first. Nothing was changed.');
      }
      g.status = 'closed';
      db.invitations.filter((i) => i.org_id === g.id && i.status === 'open').forEach((i) => { i.status = 'closed'; });
    }
  }
  const field = (d, k) => {
    const present = Object.prototype.hasOwnProperty.call(d, k);
    const raw = d[k];
    const val = raw == null ? null : (trimmed(typeof raw === 'string' ? raw : JSON.stringify(raw)) || null);
    return { present, val };
  };
  const nameTaken = (o, parent, nm, except = null) => db.units.some((x) => x.org_id === o && (x.parent_id || null) === (parent || null)
    && x.name.toLowerCase() === nm.toLowerCase() && x.id !== except);

  // The functions ------------------------------------------------------------------------------------
  const fns = {
    org_create({ k, nm, tz = 'America/New_York' }) {
      const uid = me();
      if (!ORG_KINDS.includes(k)) return err('kind');
      const name = trimmed(nm);
      if (name.length < 2 || name.length > 80) return err('name');
      const zone = trimmed(tz);
      if (zone && !validTimeZone(zone)) return err('time_zone');
      if (!count(uid, 'orgs', 3)) return err('rate_limited');
      const o = newId();
      const status = k === 'business' ? 'active' : 'pending';
      db.orgs.push({ id: o, kind: k, name, status, verified_at: null, offers_workplace: ['business', 'partner'].includes(k),
        offers_challenges: true, min_report_group: 5, time_zone: zone || 'America/New_York', created_by: uid, created_at: iso(Date.now()),
        legal_name: null, website: null, contact_email: null, contact_phone: null, street: null, city: null, region: null,
        postal_code: null, country: null });
      db.members.push({ org_id: o, user_id: uid, member_type: ['business', 'partner'].includes(k) ? 'employee' : 'staff',
        age_band: 'adult', status: 'active', joined_at: iso(Date.now()), ended_at: null });
      db.roles.push({ id: newId(), org_id: o, user_id: uid, role: 'admin', unit_id: null, granted_by: uid, granted_at: iso(Date.now()) });
      return { ok: true, org_id: o, status };
    },

    org_unit_add({ o, parent, k, nm, grade = null }) {
      const uid = me();
      if (parent != null && !db.units.some((x) => x.id === parent && x.org_id === o)) return err('parent');
      if (!hasRole(o, uid, ['unit_manager', 'teacher'], parent)) return err('not_allowed');
      const name = trimmed(nm);
      // CHECK constraints come before the unique index, as in Postgres
      if (!UNIT_KINDS.includes(k) || name.length < 1 || name.length > 80 || (grade != null && (grade < -1 || grade > 12))) return err('invalid');
      if (nameTaken(o, parent, name)) return err('name_taken');
      const id = newId();
      db.units.push({ id, org_id: o, parent_id: parent ?? null, kind: k, name, grade_level: grade, created_at: iso(Date.now()),
        street: null, city: null, region: null, postal_code: null, country: null, time_zone: null });
      return { ok: true, unit_id: id };
    },

    org_unit_rename({ u, nm }) {
      const x = unitOf(u);
      if (!x || !hasRole(x.org_id, me(), ['unit_manager', 'teacher'], u)) return err('not_allowed');
      const name = trimmed(nm);
      if (name.length < 1 || name.length > 80) return err('invalid');
      if (nameTaken(x.org_id, x.parent_id, name, x.id)) return err('name_taken');
      x.name = name;
      return { ok: true };
    },

    org_unit_remove({ u }) {
      const x = unitOf(u);
      if (!x || !hasRole(x.org_id, me(), ['unit_manager'], x.parent_id)) return err('not_allowed');
      if (db.units.some((y) => y.parent_id === u) || db.unitMembers.some((m) => m.unit_id === u)) return err('not_empty');
      // on delete cascade: its codes and the roles for it go with it
      db.units = db.units.filter((y) => y.id !== u);
      db.invitations = db.invitations.filter((i) => i.unit_id !== u);
      db.roles = db.roles.filter((r) => r.unit_id !== u);
      return { ok: true };
    },

    org_invite_create({ o, u, mtype, uses = 1, days = 14 }) {
      const uid = me();
      const g = org(o);
      if (!g) return err('not_found');
      if (g.status !== 'active') return err('not_verified');
      if (u != null && !db.units.some((x) => x.id === u && x.org_id === o)) return err('unit');
      if (!hasRole(o, uid, ['unit_manager', 'teacher'], u)) return err('not_allowed');
      if (mtype !== 'student' && !hasRole(o, uid, ['unit_manager'], u)) return err('not_allowed');
      if (!MEMBER_TYPES.includes(mtype)) return err('member_type');
      if (!count(uid, 'codes', 200)) return err('rate_limited');
      let c;
      do {
        c = Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * 32)]).join('');
      } while (db.invitations.some((i) => i.code === c));
      const max = Math.max(1, uses == null ? 1 : Math.trunc(uses)); // 072: 1 or more, no upper bound
      const d = Math.max(1, Math.min(days == null ? 14 : Math.trunc(days), 90));
      db.invitations.push({ id: newId(), org_id: o, unit_id: u ?? null, member_type: mtype, code: c, max_uses: max, uses: 0,
        status: 'open', created_by: uid, created_at: iso(Date.now()), expires_at: iso(Date.now() + d * DAY) });
      return { ok: true, code: c };
    },

    org_invite_close({ code_in }) {
      const inv = db.invitations.find((i) => i.code === trimmed(code_in).toUpperCase());
      if (!inv || !hasRole(inv.org_id, me(), ['unit_manager', 'teacher'], inv.unit_id)) return err('not_allowed');
      inv.status = 'closed';
      return { ok: true };
    },

    org_leave({ o }) {
      const uid = me();
      if (!isIn(o, uid)) return err('not_member');
      const iAmAdmin = db.roles.some((r) => r.org_id === o && r.user_id === uid && r.role === 'admin');
      const otherAdmin = db.roles.some((r) => r.org_id === o && r.role === 'admin' && r.user_id !== uid && isActive(o, r.user_id));
      const othersIn = db.members.some((m) => m.org_id === o && m.user_id !== uid && (m.status === 'active' || m.status === 'pending'));
      if (iAmAdmin && !otherAdmin && othersIn) return err('last_admin');
      const m = member(o, uid);
      m.status = 'left';
      m.ended_at = iso(Date.now());
      db.unitMembers = db.unitMembers.filter((x) => !(x.org_id === o && x.user_id === uid));
      db.roles = db.roles.filter((r) => !(r.org_id === o && r.user_id === uid));
      return { ok: true };
    },

    org_member_remove({ o, who }) {
      const uid = me();
      if (!hasRole(o, uid, ['admin'])) return err('not_allowed');
      if (who === uid) return err('use_leave');
      if (!isIn(o, who)) return err('not_member');
      const m = member(o, who);
      m.status = 'removed';
      m.ended_at = iso(Date.now());
      db.unitMembers = db.unitMembers.filter((x) => !(x.org_id === o && x.user_id === who));
      db.roles = db.roles.filter((r) => !(r.org_id === o && r.user_id === who));
      return { ok: true };
    },

    org_role_set({ o, who, r, u, give }) {
      const uid = me();
      if (!hasRole(o, uid, ['admin'])) return err('not_allowed');
      if (!ROLES.includes(r)) return err('role');
      if (r === 'admin' && u != null) return err('admin_whole_org');
      if (u != null && !db.units.some((x) => x.id === u && x.org_id === o)) return err('unit');
      if (!adultNonStudent(o, who)) return err('not_eligible');
      if (give) {
        if (!db.roles.some((x) => x.org_id === o && x.user_id === who && x.role === r && (x.unit_id || null) === (u || null))) {
          db.roles.push({ id: newId(), org_id: o, user_id: who, role: r, unit_id: u ?? null, granted_by: uid, granted_at: iso(Date.now()) });
        }
      } else {
        if (r === 'admin' && who === uid) return err('use_leave');
        db.roles = db.roles.filter((x) => !(x.org_id === o && x.user_id === who && x.role === r && (x.unit_id || null) === (u || null)));
      }
      return { ok: true };
    },

    org_admin_transfer({ o, who }) {
      const uid = me();
      if (!hasRole(o, uid, ['admin'])) return err('not_allowed');
      if (who == null || who === uid) return err('not_eligible');
      if (!adultNonStudent(o, who)) return err('not_eligible');
      if (!db.roles.some((x) => x.org_id === o && x.user_id === who && x.role === 'admin')) {
        db.roles.push({ id: newId(), org_id: o, user_id: who, role: 'admin', unit_id: null, granted_by: uid, granted_at: iso(Date.now()) });
      }
      db.roles = db.roles.filter((x) => !(x.org_id === o && x.user_id === uid && x.role === 'admin'));
      return { ok: true };
    },

    org_settings_set({ o, min_group }) {
      if (!hasRole(o, me(), ['admin'])) return err('not_allowed');
      const g = org(o);
      g.min_report_group = Math.max(3, Math.min(min_group == null ? g.min_report_group : Math.trunc(min_group), 50));
      return { ok: true };
    },

    org_members_list({ o, u = null, max_rows = 200, skip = 0 }) {
      const uid = me();
      const whole = hasRole(o, uid, ['admin']);
      if (u != null && !db.units.some((x) => x.id === u && x.org_id === o)) return err('unit');
      if (!whole && (u == null || !hasRole(o, uid, ['unit_manager', 'teacher'], u))) return err('not_allowed');
      const scope = u != null ? below(u) : null;
      const limit = Math.max(1, Math.min(max_rows == null ? 200 : max_rows, 500));
      const offset = Math.max(skip == null ? 0 : skip, 0);
      const people = db.members
        .filter((m) => m.org_id === o && (m.status === 'active' || m.status === 'pending')
          && (!scope || db.unitMembers.some((x) => x.org_id === o && x.user_id === m.user_id && scope.includes(x.unit_id))))
        .sort((a, b) => (a.user_id < b.user_id ? -1 : 1))
        .slice(offset, offset + limit);
      const members = people.map((p) => ({
        user_id: p.user_id,
        first_name: trimmed(db.users[p.user_id] && db.users[p.user_id].first_name) || null,
        member_type: p.member_type,
        status: p.status,
        can_be_admin: p.status === 'active' && p.age_band === 'adult' && p.member_type !== 'student',
        units: db.unitMembers.filter((x) => x.org_id === o && x.user_id === p.user_id && (!scope || scope.includes(x.unit_id)))
          .map((x) => unitOf(x.unit_id)).filter(Boolean).map((x) => ({ id: x.id, name: x.name })).sort(byName),
        roles: db.roles.filter((r) => r.org_id === o && r.user_id === p.user_id).map((r) => ({ role: r.role, unit_id: r.unit_id })),
      }));
      return { ok: true, members };
    },

    org_mine() {
      const uid = me();
      return db.members.filter((m) => m.user_id === uid && m.status === 'active')
        .map((m) => ({ m, g: org(m.org_id) }))
        .sort((a, b) => byName(a.g, b.g))
        .map(({ m, g }) => ({
          org_id: g.id, name: g.name, kind: g.kind, status: g.status,
          offers_workplace: g.offers_workplace, offers_challenges: g.offers_challenges,
          member_type: m.member_type, member_status: m.status,
          units: db.unitMembers.filter((x) => x.org_id === g.id && x.user_id === uid).map((x) => unitOf(x.unit_id))
            .filter(Boolean).map((x) => ({ id: x.id, name: x.name, kind: x.kind })).sort(byName),
          roles: db.roles.filter((r) => r.org_id === g.id && r.user_id === uid).map((r) => ({ role: r.role, unit_id: r.unit_id })),
          consents: { challenges: true, manager_reporting: null, workplace_restrictions: null },
        }));
    },

    org_handover_needed() {
      return lastAdminOf(me());
    },

    org_admin_view({ o }) {
      const uid = me();
      const g = org(o);
      if (!g) return err('not_found');
      if (g.status === 'suspended' || g.status === 'closed') return err(g.status);
      const whole = hasRole(o, uid, ['admin']);
      if (!whole && !db.roles.some((r) => r.org_id === o && r.user_id === uid && ['unit_manager', 'teacher'].includes(r.role) && r.unit_id != null)) {
        return err('not_allowed');
      }
      const now = Date.now();
      return {
        org: { id: g.id, name: g.name, kind: g.kind, status: g.status, offers_workplace: g.offers_workplace,
          offers_challenges: g.offers_challenges, min_report_group: g.min_report_group, time_zone: g.time_zone },
        members: whole ? db.members.filter((m) => m.org_id === o && m.status === 'active').length : null,
        units: db.units.filter((x) => x.org_id === o && (whole || hasRole(o, uid, ['unit_manager', 'teacher'], x.id))).sort(byName)
          .map((x) => ({ id: x.id, parent_id: x.parent_id, kind: x.kind, name: x.name, grade_level: x.grade_level,
            people: db.unitMembers.filter((m) => m.unit_id === x.id).length })),
        invitations: db.invitations.filter((i) => i.org_id === o && i.status === 'open' && Date.parse(i.expires_at) > now
          && (whole || hasRole(o, uid, ['unit_manager', 'teacher'], i.unit_id)))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .map((i) => ({ code: i.code, unit_id: i.unit_id, member_type: i.member_type, uses: i.uses, max_uses: i.max_uses, expires_at: i.expires_at })),
      };
    },

    org_profile_set({ o, d }) {
      if (d == null || typeof d !== 'object' || Array.isArray(d)) return err('details');
      const g = org(o);
      if (!g || !hasRole(o, me(), ['admin'])) return err('not_allowed');
      const next = { ...g };
      const changed = [];
      const locked = g.kind !== 'business' && g.status === 'active';
      let f = field(d, 'name');
      if (f.present) {
        if (f.val == null || f.val.length < 2 || f.val.length > 80) return err('name');
        if (f.val !== g.name) {
          if (locked) return err('ask_innerise');
          next.name = f.val; changed.push('name');
        }
      }
      f = field(d, 'legal_name');
      if (f.present) {
        if (f.val != null && (f.val.length < 2 || f.val.length > 120)) return err('legal_name');
        if (f.val !== g.legal_name) {
          if (locked) return err('ask_innerise');
          next.legal_name = f.val; changed.push('legal_name');
        }
      }
      f = field(d, 'website');
      if (f.present) {
        if (f.val != null && !/^https?:\/\/\S{3,200}$/.test(f.val)) return err('website');
        next.website = f.val; changed.push('website');
      }
      f = field(d, 'contact_email');
      if (f.present) {
        if (f.val != null && (f.val.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.val))) return err('contact_email');
        next.contact_email = f.val && f.val.toLowerCase(); changed.push('contact_email');
      }
      f = field(d, 'contact_phone');
      if (f.present) {
        if (f.val != null && !/^[0-9 +().-]{7,32}$/.test(f.val)) return err('contact_phone');
        next.contact_phone = f.val; changed.push('contact_phone');
      }
      for (const [k, max] of [['street', 200], ['city', 100], ['region', 100], ['postal_code', 20]]) {
        f = field(d, k);
        if (f.present) {
          if (f.val != null && f.val.length > max) return err(k);
          next[k] = f.val; changed.push(k);
        }
      }
      f = field(d, 'country');
      if (f.present) {
        if (f.val != null && !/^[A-Z]{2}$/.test(f.val.toUpperCase())) return err('country');
        next.country = f.val && f.val.toUpperCase(); changed.push('country');
      }
      f = field(d, 'time_zone');
      if (f.present) {
        if (f.val == null || !validTimeZone(f.val)) return err('time_zone');
        next.time_zone = f.val; changed.push('time_zone');
      }
      const zoneWas = g.time_zone;
      Object.assign(g, next);
      if (g.time_zone !== zoneWas) focus.rezone(g.id); // 071a's org_focus_org_zone trigger
      return { ok: true, changed };
    },

    org_unit_details_set({ u, d }) {
      if (d == null || typeof d !== 'object' || Array.isArray(d)) return err('details');
      const x = unitOf(u);
      if (!x || !hasRole(x.org_id, me(), ['unit_manager'], u)) return err('not_allowed');
      if (!['location', 'school', 'campus', 'college'].includes(x.kind)) return err('kind');
      const next = { ...x };
      const changed = [];
      for (const [k, max] of [['street', 200], ['city', 100], ['region', 100], ['postal_code', 20]]) {
        const f = field(d, k);
        if (f.present) {
          if (f.val != null && f.val.length > max) return err(k);
          next[k] = f.val; changed.push(k);
        }
      }
      let f = field(d, 'country');
      if (f.present) {
        if (f.val != null && !/^[A-Z]{2}$/.test(f.val.toUpperCase())) return err('country');
        next.country = f.val && f.val.toUpperCase(); changed.push('country');
      }
      f = field(d, 'time_zone');
      if (f.present) {
        if (f.val != null && !validTimeZone(f.val)) return err('time_zone');
        next.time_zone = f.val; changed.push('time_zone');
      }
      const zoneWas = x.time_zone;
      Object.assign(x, next);
      if (x.time_zone !== zoneWas) focus.rezone(x.org_id); // 071a's org_focus_unit_zone trigger
      return { ok: true, changed };
    },

    org_domain_add({ o, dom }) {
      const uid = me();
      if (!hasRole(o, uid, ['admin'])) return err('not_allowed');
      const d = trimmed(dom).replace(/^\.+|\.+$/g, '').toLowerCase();
      if (d.length > 253 || !DOMAIN.test(d)) return err('domain');
      if (FREE_MAIL.includes(d)) return err('free_mail');
      if (db.domains.some((x) => x.org_id === o && x.domain === d)) return { ok: true, domain: d };
      if (db.domains.filter((x) => x.org_id === o).length >= 10) return err('too_many');
      const user = db.users[uid];
      const at = String((user && user.email) || '').toLowerCase().split('@')[1] || '';
      if (!user.email_confirmed_at || !at || !(at === d || at.endsWith('.' + d))) return err('email_not_at_domain');
      db.domains.push({ org_id: o, domain: d, verified_by: uid, verified_at: iso(Date.now()) });
      return { ok: true, domain: d };
    },

    org_domain_remove({ o, dom }) {
      if (!hasRole(o, me(), ['admin'])) return err('not_allowed');
      const d = trimmed(dom).replace(/^\.+|\.+$/g, '').toLowerCase();
      db.domains = db.domains.filter((x) => !(x.org_id === o && x.domain === d));
      return { ok: true };
    },

    org_details({ o }) {
      const uid = me();
      const g = org(o);
      if (!g) return err('not_found');
      if (g.status === 'suspended' || g.status === 'closed') return err(g.status);
      const whole = hasRole(o, uid, ['admin']);
      if (!whole && !db.roles.some((r) => r.org_id === o && r.user_id === uid && ['unit_manager', 'teacher'].includes(r.role) && r.unit_id != null)) {
        return err('not_allowed');
      }
      const base = { id: g.id, name: g.name, kind: g.kind, status: g.status, website: g.website, time_zone: g.time_zone };
      return {
        org: whole ? { ...base, legal_name: g.legal_name, contact_email: g.contact_email, contact_phone: g.contact_phone,
          street: g.street, city: g.city, region: g.region, postal_code: g.postal_code, country: g.country,
          name_locked: g.kind !== 'business' && g.status === 'active' } : base,
        domains: db.domains.filter((x) => x.org_id === o).map((x) => x.domain).sort(),
        units: db.units.filter((x) => x.org_id === o && ['location', 'school', 'campus', 'college'].includes(x.kind)
          && (whole || hasRole(o, uid, ['unit_manager', 'teacher'], x.id))).sort(byName)
          .map((x) => ({ id: x.id, kind: x.kind, name: x.name, street: x.street, city: x.city, region: x.region,
            postal_code: x.postal_code, country: x.country, time_zone: x.time_zone })),
      };
    },
  };
  // Challenges and Rewards (072) and InneRISE Partners (074), sharing this database and these helpers.
  Object.assign(fns, programFunctions({ db: () => db, me, org, unitOf, member, hasRole, newId }));
  // Workplace App Management and School Focus (071a and 071b), the same way.
  const focus = focusFunctions({ db: () => db, me, org, unitOf, member, hasRole, newId });
  Object.assign(fns, focus.fns);
  // The Challenge & Rewards Library and habit challenges (075). Its functions call 072's and 074's, as the SQL does, and its
  // trigger guards 072's rewards: a habit challenge's rewards are for reaching the target or taking part.
  const library = libraryFunctions({ db: () => db, me, org, unitOf, member, hasRole, newId, chain, call: (n, a) => fns[n](a) });
  Object.assign(fns, library.fns);
  fns.org_reward_set = library.guardRewards(fns.org_reward_set);
  // Organization billing (076): org_billing_view, and the two Edge Functions with Stripe switched off (payments are off here).
  const billing = billingFunctions({ db: () => db, me, org, hasRole });
  Object.assign(fns, billing.fns);
  // The Prize Wallet (078): the counter, prize terms and codes, disputes, pickups and deliveries, the report; 074's two-step
  // counter; and Storage's prize-logos bucket.
  const prizes = prizeFunctions({ db: () => db, me, org, unitOf, member, hasRole, newId, chain });
  Object.assign(fns, prizes.fns);
  // InneRISE administration (082's staff_* functions, for InneRISE staff only) and the Reports section's org_report_places.
  Object.assign(fns, staffFunctions({ db: () => db, me, org, unitOf, hasRole }).fns);
  // The flow test: lose the answer to the next calls of these functions, as a dropped connection would (after the server ran
  // the call, or before it got there).
  let lose = null;

  async function rpc(name, args = {}) {
    await wait(LATENCY);
    if (SERVICE_ROLE_ONLY.includes(name)) {
      return { data: null, error: { code: '42501', message: `permission denied for function ${name}` } };
    }
    const sig = SIGNATURES[name];
    const given = Object.keys(args || {});
    const notFound = { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}(${given.join(', ')}) in the schema cache` } };
    if (!sig || given.some((k) => !sig.args.includes(k)) || sig.required.some((k) => !given.includes(k))) return notFound;
    for (const k of sig.uuids || []) {
      if (args[k] != null && !UUID.test(String(args[k]))) {
        return { data: null, error: { code: '22P02', message: `invalid input syntax for type uuid: "${args[k]}"` } };
      }
    }
    for (const k of sig.ints || []) {
      if (args[k] != null && !/^\s*[+-]?\d+\s*$/.test(String(args[k]))) {
        return { data: null, error: { code: '22P02', message: `invalid input syntax for type bigint: "${args[k]}"` } };
      }
    }
    if (!session) return { data: null, error: { code: 'P0001', message: 'not_signed_in' } };
    if (lose && lose.fns.includes(name) && lose.times > 0) {
      lose.times -= 1;
      const ran = lose.commit;
      if (lose.times === 0) lose = null;
      if (ran) { try { fns[name](clone(args)); keepAdmin(); } catch { /* the answer is lost either way */ } }
      throw new TypeError('Failed to fetch');
    }
    const before = clone(db);
    try {
      const data = fns[name](clone(args));
      if (!(data && data.error)) keepAdmin();
      return { data: clone(data), error: null };
    } catch (e) {
      db = before;
      return { data: null, error: { code: e.code || 'P0001', message: e.message } };
    }
  }

  // supabase-js's functions.invoke, for billing-checkout and billing-portal (076). As supabase-js 2.45.4 does: { data } for a
  // 2xx answer, else { error } whose context is the Response (the function's { error, message }).
  const functionsApi = {
    async invoke(name, { body } = {}) {
      await wait(LATENCY);
      const r = billing.invoke(name, session ? session.user.id : null, clone(body));
      if (r.status >= 200 && r.status < 300) return { data: r.body, error: null };
      const error = new Error('Edge Function returned a non-2xx status code');
      error.name = 'FunctionsHttpError';
      error.context = new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
      return { data: null, error };
    },
  };

  return {
    auth: authApi,
    rpc,
    functions: functionsApi,
    storage: { from: (name) => { const b = prizes.storage.from(name); const slow = (fn) => async (...a) => { await wait(LATENCY); return fn(...a); };
      return { upload: slow(b.upload), list: slow(b.list), createSignedUrl: slow(b.createSignedUrl), remove: slow(b.remove) }; } },
    // stripe(o, fields): what one of Stripe's signed messages would record (for the flow test). rotating(ref): the six digits
    // a winner's QR code shows now. loseNext(fns, commit, times): the next calls' answers are lost (a dropped connection).
    demo: { snapshot: () => clone(db), me: ME, startOrg, stripe: (o, fields) => clone(billing.stripe(o, fields)),
      rotating: (ref, steps = 0) => rotating(ref, Date.now() + steps * 30000),
      loseNext: (names, commit = true, times = 1) => { lose = { fns: [].concat(names), commit, times }; },
      // InneRISE sets a new version of the Sponsor Reward Terms (org_challenge_limits.sponsor_terms_version).
      sponsorTermsVersion: (label) => { db.challengeLimits = { ...db.challengeLimits, sponsor_terms_version: String(label) }; },
      // InneRISE reviews a waiting logo (078's prize_staff_logo, InneRISE staff only): shown, or sent back with a note.
      reviewLogo: (o, approve, note = null) => {
        const pg = (db.prize.givers || []).find((x) => x.org_id === o && x.logo_state === 'waiting');
        if (!pg) return { error: 'not_waiting' };
        Object.assign(pg, { logo_state: approve ? 'shown' : 'rejected', logo_note: note ? String(note).trim() || null : null, updated_at: new Date().toISOString() });
        return { ok: true };
      },
      // An administrator elsewhere sets what the signed-in person does in an organization: [[role, unit or null], ...], or none
      // (only a member). For the role-based landing checks; call it before signing in, so the dashboard reads it fresh.
      myRoles: (o, list) => {
        db.roles = db.roles.filter((r) => !(r.org_id === o && r.user_id === ME));
        list.forEach(([role, unit = null]) => db.roles.push({ id: newId(), org_id: o, user_id: ME, role, unit_id: unit, granted_by: ME, granted_at: iso(Date.now()) }));
        return { ok: true };
      } },
  };
}
