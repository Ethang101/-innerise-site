// InneRISE Dashboard: the one workspace for every kind of organization (business, school, district,
// college, partner). The address says where you are: ?org=<id>&section=<section>, with the sections overview,
// people, places, invites, approvals, settings, billing, reports and enroll; the programs challenges, rewards,
// library (the Challenge & Rewards Library) and focus; for partners sponsored, offers, performance and profile; for whoever gives prizes,
// redeem (the counter) and prizes (078's Prize Wallet) (and ?section=register&kind=... to
// register one). The InneRISE app opens it signed in with #handoff=<token_hash>. Everything goes through api.js.
// The public pages (../workplaces/, ../schools/, ../partners/) send people here: Sign In to ./, Get Started to
// ?section=register&kind=business|school|partner. InneRISE staff (082's innerise_is_staff()) also have InneRISE
// administration, in the same dashboard: ?section=staff (?staff for short), staff-orgs, staff-org&id=<organization>,
// staff-partners, staff-library and staff-prizes. PORTAL_MAP.md, next to the portal, maps every page.
import { DEMO, connect, auth, rpc, billing, logos, PRIZE_REASON, redirectError, useWords, demoStartOrg, HANDOFF } from './api.js';
import { APP_SCHEME } from './config.js';

const app = document.getElementById('app');
const layer = document.getElementById('layer');
const toasts = document.getElementById('toasts');

// Small helpers ------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('en-US');
const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
const DAY = 864e5;

const ICON = {
  book: '<path d="M12 6.6C10.2 5.2 7.6 4.6 4 4.6v13.2c3.6 0 6.2.6 8 2 1.8-1.4 4.4-2 8-2V4.6c-3.6 0-6.2.6-8 2z"/><path d="M12 6.6v13.2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  spark: '<path d="M11 3.5l1.8 4.9 4.9 1.8-4.9 1.8L11 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z"/><path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4"/><path d="M19.6 4.6v4.2h-4.2"/>',
  building: '<path d="M4.5 20.5V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15.5"/><path d="M14.5 9.5h4a1 1 0 0 1 1 1v10"/><path d="M3 20.5h18"/><path d="M8 8h3M8 11.5h3M8 15h3"/><path d="M17 13h.01M17 16.5h.01"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.2" r="2.5"/><path d="M15.6 14.1a4.6 4.6 0 0 1 5.4 4.6"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  ticket: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14.5 6.5v1.6M14.5 11.2v1.6M14.5 15.9v1.6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  layers: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12L12 16.5 20.5 12"/><path d="M3.5 16L12 20.5 20.5 16"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.2a1.7 1.7 0 0 0-1.7-1.7H6.2a1.7 1.7 0 0 0-1.7 1.7v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  signout: '<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/><path d="M9.5 16.5L5 12l4.5-4.5"/><path d="M5 12h10"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.8 7l8.2 6.2L20.2 7"/>',
  apple: '<path fill="currentColor" stroke="none" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2-1.1 2.8-2.3.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.8zM14.1 5.9c.6-.8 1.1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.8-1.3z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeoff: '<path d="M3.5 3.5l17 17"/><path d="M10.4 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.4 16.4 0 0 1-3 3.8M6.6 6.7A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  shield: '<path d="M12 3.5l7 2.8v5.3c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5a13 13 0 0 1 0 17M12 3.5a13 13 0 0 0 0 17"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  school: '<path d="M3.5 20.5h17"/><path d="M5.5 20.5V10.2L12 6.5l6.5 3.7v10.3"/><path d="M10 20.5v-4.5h4v4.5"/><path d="M12 6.5V2.8l3 1.3-3 1.2"/><path d="M8.5 12.5h.01M15.5 12.5h.01"/>',
  board: '<rect x="3.5" y="4.5" width="17" height="11" rx="1.6"/><path d="M8.5 20l1.8-4.5M15.5 20l-1.8-4.5M12 4.5V3"/>',
  cap: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4.4c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.4"/><path d="M21.5 9.5v5"/>',
  store: '<path d="M4.5 10v10h15V10"/><path d="M3 9.5l1.7-5h14.6L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
  crown: '<path d="M4 17.5h16M5 17.5L4 8l4.5 3.5L12 5.5l3.5 6L20 8l-1 9.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M10.5 18.5h3"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M2.5 10h19M6 15h4"/>',
  chart: '<path d="M4 20.5h16"/><path d="M7 17v-6M12 17V6.5M17 17v-4"/>',
  enroll: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  inbox: '<path d="M3.5 13.5l2.6-7.2A1.5 1.5 0 0 1 7.5 5.3h9a1.5 1.5 0 0 1 1.4 1l2.6 7.2v4.7a1.5 1.5 0 0 1-1.5 1.5h-13a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 13.5h4.8l1.5 2.5h4.4l1.5-2.5h4.8"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  printer: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.8"/><path d="M7 14h10v6.5H7z"/>',
  trophy: '<path d="M8 4.5h8v4.6a4 4 0 0 1-8 0z"/><path d="M8 6.5H5.2a2.6 2.6 0 0 0 2.9 3.6M16 6.5h2.8a2.6 2.6 0 0 1-2.9 3.6"/><path d="M12 13.1v3.2M8.5 20h7M9.6 20l.5-3.7h3.8l.5 3.7"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20"/><path d="M12 8.5C10.6 5.2 7.2 4.6 7.2 6.6c0 1.5 2.5 1.9 4.8 1.9zM12 8.5c1.4-3.3 4.8-3.9 4.8-1.9 0 1.5-2.5 1.9-4.8 1.9z"/>',
  focus: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.2a2.6 2.6 0 0 1 0 5.2H16"/><path d="M8.5 3.5v2.6M12 3.5v2.6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z"/>',
  key: '<circle cx="8" cy="15.5" r="3.8"/><path d="M10.7 12.8L19.5 4M16 7.5l2.5 2.5M13.8 9.7l2 2"/>',
  edit: '<path d="M4.5 19.5h3.8L19 8.8a2.1 2.1 0 0 0-3-3L5.3 16.5z"/><path d="M14.3 7.5l3 3"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 12h9"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2h5.4l1.5 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.3"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  flag: '<path d="M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11"/>',
  send: '<path d="M20.5 3.5L10.2 13.8M20.5 3.5l-6.3 17-4-6.7-6.7-4z"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.4"/>',
  trend: '<path d="M3.5 17.5l5.5-5.5 4 4 7.5-7.5"/><path d="M15 8.5h5.5V14"/>',
  stairs: '<path d="M3.5 19.5h4.5v-4h4v-4h4v-4h4.5"/>',
  map: '<path d="M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
};
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ''}</svg>`;
const ring = (name, size = '') => `<span class="ring ${size}">${icon(name)}</span>`;
const wordmark = (cls = '') => `<span class="wordmark ${cls}" aria-label="InneRISE"><span class="w-inne">Inne</span><span class="w-rise">RISE</span></span>`;
const demoTag = () => (DEMO ? '<span class="demo-tag" title="Made-up sample data. Nothing is saved.">Demo data</span>' : '');

// Time zones and countries -------------------------------------------------------------------------
const LOCAL_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } })();
const TIME_ZONES = (() => {
  let list = [];
  try { list = Intl.supportedValuesOf('timeZone'); } catch { /* older browsers */ }
  if (!list.length) {
    list = ['America/New_York', 'America/Detroit', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
      'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
      'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam',
      'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
  }
  return list;
})();
const tzLabels = new Map();
function tzLabel(tz) {
  if (!tzLabels.has(tz)) {
    let off = '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      off = (parts.find((p) => p.type === 'timeZoneName') || {}).value || '';
    } catch { /* unknown zone */ }
    tzLabels.set(tz, `${tz.replace(/_/g, ' ')}${off ? ` (${off})` : ''}`);
  }
  return tzLabels.get(tz);
}
function tzName(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' }).formatToParts(new Date());
    return (parts.find((p) => p.type === 'timeZoneName') || {}).value || '';
  } catch { return ''; }
}
function tzOptions(selected, blankLabel) {
  const list = !selected || TIME_ZONES.includes(selected) ? TIME_ZONES : [selected, ...TIME_ZONES];
  return (blankLabel != null ? `<option value=""${!selected ? ' selected' : ''}>${esc(blankLabel)}</option>` : '')
    + list.map((z) => `<option value="${esc(z)}"${z === selected ? ' selected' : ''}>${esc(tzLabel(z))}</option>`).join('');
}
// ISO 3166 country codes, written run-together two letters at a time.
const COUNTRY_CODES = 'ADAEAFAGAIALAMAOAQARASATAUAWAXAZBABBBDBEBFBGBHBIBJBLBMBNBOBQBRBSBTBVBWBYBZCACCCDCFCGCHCICKCLCMCNCOCRCUCVCWCXCYCZDEDJDKDMDODZECEEEGEHERESETFIFJFKFMFOFRGAGBGDGEGFGGGHGIGLGMGNGPGQGRGSGTGUGWGYHKHMHNHRHTHUIDIEILIMINIOIQIRISITJEJMJOJPKEKGKHKIKMKNKPKRKWKYKZLALBLCLILKLRLSLTLULVLYMAMCMDMEMFMGMHMKMLMMMNMOMPMQMRMSMTMUMVMWMXMYMZNANCNENFNGNINLNONPNRNUNZOMPAPEPFPGPHPKPLPMPNPRPSPTPWPYQARERORSRURWSASBSCSDSESGSHSISJSKSLSMSNSOSRSSSTSVSXSYSZTCTDTFTGTHTJTKTLTMTNTOTRTTTVTWTZUAUGUMUSUYUZVAVCVEVGVIVNVUWFWSYEYTZAZMZW'.match(/[A-Z]{2}/g);
const COUNTRIES = (() => {
  let names = null;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* fall back to codes */ }
  return COUNTRY_CODES.map((c) => [c, names ? names.of(c) : c]).sort((a, b) => a[1].localeCompare(b[1]));
})();
const countryName = (c) => (COUNTRIES.find((x) => x[0] === c) || [c, c])[1];
const LOCAL_COUNTRY = (() => { const m = String(navigator.language || '').match(/-([A-Z]{2})$/i); return m && COUNTRY_CODES.includes(m[1].toUpperCase()) ? m[1].toUpperCase() : ''; })();
const countryOptions = (selected) => `<option value=""${!selected ? ' selected' : ''}>Choose a country</option>`
  + COUNTRIES.map(([c, n]) => `<option value="${c}"${c === selected ? ' selected' : ''}>${esc(n)}</option>`).join('');

const FREE_MAIL = ['gmail.com', 'googlemail.com', 'icloud.com', 'me.com', 'mac.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'ymail.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com',
  'hey.com', 'fastmail.com', 'privaterelay.appleid.com', 'duck.com', 'qq.com', '163.com', 'comcast.net', 'verizon.net', 'att.net'];

// Labels -------------------------------------------------------------------------------------------
const KIND_LABEL = { location: 'Location', department: 'Department', team: 'Team', school: 'School', campus: 'Campus', grade: 'Grade',
  classroom: 'Classroom', college: 'College', program: 'Program', group: 'Group', region: 'Region', district: 'District' };
const KIND_ICON = { location: 'pin', department: 'layers', team: 'people', school: 'school', campus: 'building', college: 'cap',
  grade: 'layers', classroom: 'board', program: 'layers', group: 'people', region: 'globe', district: 'map' };
// Regions and districts (072) group places in any kind of organization: Region › District › the organization's own places.
const AREA_KINDS = ['region', 'district'];
const TYPE_LABEL = { employee: 'Employee', staff: 'Staff', teacher: 'Teacher', student: 'Student', partner: 'Partner contact' };
const TYPE_PLURAL = { employee: 'Employees', staff: 'Staff', teacher: 'Teachers', student: 'Students', partner: 'Partner contacts' };
const ROLE_LABEL = { admin: 'Administrator', unit_manager: 'Manager', teacher: 'Teacher', challenge_coordinator: 'Challenge coordinator',
  rewards_manager: 'Rewards manager', billing_contact: 'Billing contact', privacy_contact: 'Privacy contact', prize_redeemer: 'Can Redeem Prizes' };
const ADDRESS_KINDS = ['location', 'school', 'campus', 'college'];

// Words that depend on the kind of organization ----------------------------------------------------
// Every page takes its nouns, unit kinds and role names from here. Nothing below hard-codes "company",
// "employee" or "school": one dashboard serves businesses, schools, districts, colleges and partners.
const ORG_KINDS = ['business', 'school', 'district', 'college', 'partner'];
const FAMILY = { business: 'business', school: 'education', district: 'education', college: 'education', partner: 'partner' };
const BRAND = { business: 'for Business', education: 'for Education', partner: 'Partners', any: 'for Organizations', staff: 'Administration' };
const PENDING_NOTE = "InneRISE is checking your organization. You can set everything up now; inviting people starts once it's verified.";
const CHALLENGE_ROLE = { role: 'challenge_coordinator', give: 'Make challenge coordinator', label: 'Challenge coordinator' };
const REWARDS_ROLE = { role: 'rewards_manager', give: 'Make rewards manager', label: 'Rewards manager' };

const EDUCATION = {
  members: 'students, teachers and staff', Members: 'Students, teachers & staff', joinTitle: 'How students, teachers and staff join',
  inviteTypes: ['student', 'teacher', 'staff'],
  units: 'Schools, grades & classrooms', unitsLower: 'schools, grades and classrooms', addressKinds: 'schools and campuses',
  roles: [
    { role: 'unit_manager', unit: true, give: 'Make leader of…', label: 'Leader', help: 'They look after this place and everything under it.' },
    { role: 'teacher', unit: true, give: 'Make teacher of…', label: 'Teacher', help: 'They see who is in this class and can invite students to it.' },
    CHALLENGE_ROLE,
    REWARDS_ROLE,
  ],
  noUnit: 'No class yet',
  setting: 'a school',
  staffWho: 'administrators, leaders and teachers',
  // Programs. School Focus is the education name for the Focus section (one component: focusPage).
  focusNav: 'School Focus', focusTitle: 'School Focus', focusFeature: 'Class time, lunch and breaks for the phones that are enrolled, and quick requests for a few minutes of access.',
  chExample: 'Walk to School Week',
};

const WORDS = {
  business: {
    org: 'company', Org: 'Company', registerTitle: 'Register your company',
    members: 'employees', Members: 'Employees', joinTitle: 'How employees join',
    inviteTypes: ['employee'],
    units: 'Locations & departments', unitsLower: 'locations and departments', addressKinds: 'locations',
    unitKinds: ['location', 'department', 'team'],
    childKinds: { location: ['department', 'team', 'location'], department: ['team', 'department'], team: ['team'] },
    topKinds: ['location'], topLabel: 'Locations', topOne: 'Location', subLabel: 'Departments & teams',
    roles: [
      { role: 'unit_manager', unit: true, give: 'Make manager of…', label: 'Manager', help: 'They look after this place and everything under it.' },
      CHALLENGE_ROLE,
      REWARDS_ROLE,
    ],
    noUnit: 'No location yet',
    setting: 'a workplace',
    staffWho: 'administrators and managers',
    domainWhy: 'so they know the company is really their employer',
    placeholders: { name: 'Acme Inc.', legal: 'Acme Incorporated', top: 'Main office', child: 'Front desk' },
    sub: {
      people: 'Everyone in your company on InneRISE.',
      units: 'How your company is organized.',
      invites: 'Codes your employees use to join your company in the InneRISE app.',
      settings: "Your company's details, email domain and administrators.",
    },
    unitsEmpty: 'Start with your locations, like your main office, then add departments and teams under them.',
    chSub: 'Company-wide, location, department and team challenges.',
    chScopes: 'the whole company, a location, a department or a team',
    chFeature: 'Company-wide, location, department and team challenges, with sides.',
    chExample: 'Spring step challenge',
    focusNav: 'Workplace App Management', focusTitle: 'Workplace App Management', focusFeature: 'Focus hours, lunch and breaks for the phones people enroll, and quick requests for a few minutes of access.',
  },
  school: {
    ...EDUCATION,
    org: 'school', Org: 'School', registerTitle: 'Register your school',
    unitKinds: ['grade', 'campus', 'classroom', 'group'],
    childKinds: { campus: ['grade', 'classroom', 'group'], grade: ['classroom', 'group'], classroom: ['group'], group: ['group'] },
    topKinds: ['grade'], topLabel: 'Grades', topOne: 'Grade', subLabel: 'Classrooms & groups',
    domainWhy: 'so students, families and staff know it is really their school',
    placeholders: { name: 'Lincoln Elementary', legal: 'Lincoln Elementary School', top: 'Grade 3', child: 'Room 112' },
    sub: {
      people: 'Everyone in your school on InneRISE.',
      units: 'How your school is organized.',
      invites: 'Codes your students, teachers and staff use to join your school in the InneRISE app.',
      settings: "Your school's details, email domain and administrators.",
    },
    unitsEmpty: 'Start with your grades, then add classrooms under them.',
    chSub: 'Classroom, grade and whole-school challenges.',
    chScopes: 'the whole school, a grade or a classroom',
    chFeature: 'Classroom, grade and whole-school challenges, with sides.',
  },
  district: {
    ...EDUCATION,
    org: 'district', Org: 'District', registerTitle: 'Register your district',
    unitKinds: ['school', 'campus', 'group'],
    childKinds: { school: ['grade', 'classroom', 'group', 'campus'], campus: ['grade', 'classroom', 'group'], grade: ['classroom', 'group'],
      classroom: ['group'], group: ['group'] },
    topKinds: ['school'], topLabel: 'Schools', topOne: 'School', subLabel: 'Grades & classrooms',
    domainWhy: 'so students, families and staff know it is really their district',
    placeholders: { name: 'Riverside Schools', legal: 'Riverside Community School District', top: 'Lincoln Elementary', child: 'Grade 3' },
    sub: {
      people: 'Everyone in your district on InneRISE.',
      units: 'Your schools, and the grades and classrooms in them.',
      invites: 'Codes your students, teachers and staff use to join your district in the InneRISE app.',
      settings: "Your district's details, email domain and administrators.",
    },
    unitsEmpty: 'Start with your schools, then add grades and classrooms under them.',
    chSub: 'Classroom, grade, school and district challenges.',
    chScopes: 'the whole district, a school, a grade or a classroom',
    chFeature: 'Classroom, grade, school and district challenges, with sides.',
  },
  college: {
    ...EDUCATION,
    org: 'college', Org: 'College', registerTitle: 'Register your college',
    unitKinds: ['campus', 'school', 'group'],
    childKinds: { campus: ['school', 'classroom', 'group'], school: ['classroom', 'group'], classroom: ['group'], group: ['group'] },
    topKinds: ['campus'], topLabel: 'Campuses', topOne: 'Campus', subLabel: 'Schools & classes',
    domainWhy: 'so students and staff know it is really their college',
    placeholders: { name: 'Lakeview College', legal: 'Lakeview Community College', top: 'Main campus', child: 'School of Nursing' },
    sub: {
      people: 'Everyone in your college on InneRISE.',
      units: 'How your college is organized.',
      invites: 'Codes your students, teachers and staff use to join your college in the InneRISE app.',
      settings: "Your college's details, email domain and administrators.",
    },
    unitsEmpty: 'Start with your campuses, then add schools and classes under them.',
    chSub: 'Class, school, campus and college-wide challenges.',
    chScopes: 'the whole college, a campus, a school or a class',
    chFeature: 'Class, school, campus and college-wide challenges, with sides.',
  },
  partner: {
    org: 'business', Org: 'Business', registerTitle: 'Register your business',
    members: 'team', Members: 'Team', joinTitle: 'How your team joins',
    inviteTypes: ['employee'], typeLabel: { employee: 'Team member' }, typePlural: { employee: 'Team members' },
    units: 'Business locations', unitsLower: 'business locations', addressKinds: 'locations',
    unitKinds: ['location', 'team'], childKinds: { location: ['team'], team: ['team'] },
    topKinds: ['location'], topLabel: 'Locations', topOne: 'Location', subLabel: 'Teams',
    roles: [
      { role: 'unit_manager', unit: true, give: 'Make manager of…', label: 'Manager', help: 'They look after this location and everything under it.' },
      { role: 'rewards_manager', give: 'Make rewards manager', label: 'Rewards manager' },
      CHALLENGE_ROLE,
    ],
    noUnit: 'No location yet',
    setting: 'a business',
    staffWho: 'administrators and managers',
    domainWhy: 'so people know your Challenges and rewards really come from you',
    placeholders: { name: 'Peak Fitness', legal: 'Peak Fitness LLC', top: 'Midtown studio', child: 'Trainers' },
    sub: {
      people: 'Everyone on your team on InneRISE.',
      units: 'Your business locations and the teams in them.',
      invites: 'Codes your team uses to join your business in the InneRISE app.',
      settings: "Your business's details, email domain and administrators.",
    },
    unitsEmpty: 'Add your locations, like your main gym or store, then the teams that work there.',
    chSub: 'Challenges for your team.', chScopes: 'your whole team', chFeature: 'Challenges for your team.', chExample: 'Spring step challenge',
    focusNav: 'Workplace App Management', focusTitle: 'Workplace App Management', focusFeature: 'Focus hours, lunch and breaks for the phones people enroll, and quick requests for a few minutes of access.',
  },
};

// Registration: what each front door registers (#/register?kind=business|education|partner|school|district|college).
const KIND_CHOICES = {
  business: { title: 'Company', blurb: 'An employer and its people', icon: 'building' },
  school: { title: 'School', blurb: 'One school', icon: 'school' },
  district: { title: 'District', blurb: 'Several schools', icon: 'layers' },
  college: { title: 'College', blurb: 'A college or university', icon: 'cap' },
  partner: { title: 'Partner business', blurb: 'A gym, shop or sponsor', icon: 'store' },
};
// The public pages' Get Started: ?section=register&kind=business, school or partner. A school, district or college (or
// "education") opens the one education choice, with that kind picked and the other two still there to pick.
function entryFor(param) {
  if (param === 'education' || ['school', 'district', 'college'].includes(param)) {
    return { title: 'Register your school or district', kinds: ['school', 'district', 'college'], family: 'education', pick: param === 'education' ? null : param };
  }
  if (ORG_KINDS.includes(param)) return { title: WORDS[param].registerTitle, kinds: [param], family: FAMILY[param] };
  return { title: 'Register your organization', kinds: ORG_KINDS, family: 'any' };
}

// The words for an organization kind; with none given, the current organization's.
function words(kind) {
  const k = kind || (currentOrg() && currentOrg().kind) || 'business';
  return WORDS[k] || WORDS.business;
}
const article = (word) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);
const typeLabel = (t, w = words()) => (w.typeLabel && w.typeLabel[t]) || TYPE_LABEL[t] || t;
const typePlural = (t, w = words()) => (w.typePlural && w.typePlural[t]) || TYPE_PLURAL[t] || t;
const roleDef = (role, w = words()) => w.roles.find((d) => d.role === role);
const roleLabel = (role, w = words()) => (roleDef(role, w) || {}).label || ROLE_LABEL[role] || role;
const familyOf = (kindParam) => (kindParam === 'education' ? 'education' : FAMILY[kindParam] || 'any');

// State --------------------------------------------------------------------------------------------
const freshSignin = () => ({ step: 'choose', email: '', error: null });
const S = {
  ready: false,
  fatal: null,
  user: null,
  orgs: null,
  orgsError: null,
  orgId: null,
  data: {},
  loadError: null,
  peopleUnit: null,
  registering: null, // { step, orgId, kind } once step 1 has created the organization
  regKind: null, // the kind picked on step 1
  notice: null,
  noticeSticky: false,
  newCode: null,
  navOpen: false,
  signin: freshSignin(),
  section: null, // the section on screen
  noticeKind: 'ok', // 'ok' or 'refused' (a deep link this account can't open)
  enroll: null, // the codes bulk enrollment just made
  enrollPick: new Set(),
  chOpen: null, // the challenge whose standings are open
  chNamed: null, // its named rows, once more were loaded
  perfCampaign: null, // the campaign Performance shows
  perfAll: false,
  counter: null, // the code at the counter: checked, being confirmed, or used (078)
  counterLog: [], // what this tab did at the counter just now (never stored)
  counterPlace: {}, // the place this counter redeems at, per organization (also remembered on this device)
  prizeRange: null, // the Prizes report's days and place
  pickState: '', // which pickups and deliveries show
  disputesAll: false, // answered disputes too
  staff: null, // whether this account is InneRISE staff (innerise_is_staff()), once asked
};
let lastRoute = null;

function reset() {
  Object.assign(S, { user: null, orgs: null, orgsError: null, orgId: null, data: {}, loadError: null, peopleUnit: null,
    registering: null, regKind: null, notice: null, noticeSticky: false, newCode: null, navOpen: false, signin: freshSignin(),
    section: null, noticeKind: 'ok', enroll: null, enrollPick: new Set(), chOpen: null, chNamed: null, perfCampaign: null, perfAll: false,
    counter: null, counterLog: [], counterPlace: {}, prizeRange: null, pickState: '', disputesAll: false, staff: null });
}

// Per-viewer conveniences only; the page works without them.
const ORG_KEY = 'innerise.dashboard.org';
const AFTER_KEY = 'innerise.dashboard.after';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};
const tabStore = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private window */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* private window */ } },
};

// What this account can open in each organization. The server checks every call again; this only decides
// what to show. Billing: administrators and the billing contact. Settings: administrators. The rest of the
// administration: administrators, and managers and teachers for their own places. Programs: Challenges for
// administrators, challenge coordinators, managers and teachers; Rewards for them and rewards managers; the Challenge &
// Rewards Library for all of them; Focus for administrators, managers and teachers. A partner's programs follow 074's roles (partner_can).
const ADMIN_SECTIONS = ['overview', 'people', 'places', 'invites', 'approvals', 'settings', 'billing', 'reports', 'enroll'];
const PROGRAM_SECTIONS = ['challenges', 'rewards', 'library', 'focus'];
const PARTNER_SECTIONS = ['sponsored', 'offers', 'performance', 'profile'];
// The Prize Wallet (078), wherever prizes are given (a partner, or an organization with challenges): Redeem prizes (the counter)
// for administrators, rewards managers and people with Can Redeem Prizes; Prizes for administrators and rewards managers.
const PRIZE_SECTIONS = ['redeem', 'prizes'];
const SECTIONS = [...ADMIN_SECTIONS, ...PROGRAM_SECTIONS, ...PARTNER_SECTIONS, ...PRIZE_SECTIONS];
const WEB_ONLY = ['billing', 'reports', 'enroll', 'library']; // the app has no screen for these: its button opens the overview
const UNIT_SECTIONS = ['overview', 'people', 'places', 'invites', 'approvals', 'reports', 'enroll'];
const rolesOf = (o) => (o && o.roles) || [];
const isAdminOf = (o) => rolesOf(o).some((r) => r.role === 'admin');
const unitRolesOf = (o) => rolesOf(o).filter((r) => (r.role === 'unit_manager' || r.role === 'teacher') && r.unit_id);
const isBillingOf = (o) => rolesOf(o).some((r) => r.role === 'billing_contact' && !r.unit_id);
const hasRoleIn = (o, role) => rolesOf(o).some((r) => r.role === role);
const wholeOrgRole = (o, role) => rolesOf(o).some((r) => r.role === role && !r.unit_id);
const openOrg = (o) => ORG_KINDS.includes(o.kind) && o.member_status !== 'pending' && ['active', 'pending'].includes(o.status);
const focusOffered = (o) => FAMILY[o.kind] === 'education' || !!o.offers_workplace;
const givesPrizes = (o) => !!o && (o.kind === 'partner' || !!o.offers_challenges);
const prizeManagerOf = (o) => isAdminOf(o) || hasRoleIn(o, 'rewards_manager');
const redeemerOf = (o) => prizeManagerOf(o) || hasRoleIn(o, 'prize_redeemer');
function programSectionsFor(o) {
  const admin = isAdminOf(o);
  const unit = unitRolesOf(o).length > 0;
  const coord = hasRoleIn(o, 'challenge_coordinator');
  const rewards = hasRoleIn(o, 'rewards_manager');
  const out = [];
  if (o.kind === 'partner') {
    if (admin || coord) out.push('sponsored');
    if (admin || rewards) out.push('offers');
    if (redeemerOf(o)) out.push('redeem');
    if (admin || rewards) out.push('prizes');
    if (admin || coord || rewards) out.push('performance');
    if (admin || coord || rewards || isBillingOf(o)) out.push('profile');
    if (admin || coord) out.push('library'); // ready-made Sponsored Challenges (075 through 074)
  } else if (o.offers_challenges) {
    if (admin || coord || unit) out.push('challenges');
    if (admin || coord || rewards || unit) out.push('rewards');
    // The Challenge & Rewards Library (075's org_library_staffer): anyone who runs challenges or rewards here.
    if (admin || coord || rewards || unit || hasRoleIn(o, 'unit_manager') || hasRoleIn(o, 'teacher')) out.push('library');
    if (redeemerOf(o)) out.push('redeem');
    if (admin || rewards) out.push('prizes');
  }
  // Focus: administrators, and managers and teachers (org_focus_manager), whether for one place or the whole organization.
  if (focusOffered(o) && (admin || rolesOf(o).some((r) => r.role === 'unit_manager' || r.role === 'teacher'))) out.push('focus');
  return out;
}
function sectionsFor(o) {
  if (!o || !openOrg(o)) return [];
  const admin = isAdminOf(o);
  const base = admin ? ADMIN_SECTIONS : unitRolesOf(o).length ? UNIT_SECTIONS : [];
  const programs = programSectionsFor(o);
  const out = base[0] === 'overview' ? ['overview', ...programs, ...base.slice(1)] : [...programs, ...base];
  if (!admin && isBillingOf(o)) out.push('billing');
  return out;
}
const dashOrgs = () => (S.orgs || []).filter((o) => sectionsFor(o).length);
const currentOrg = () => dashOrgs().find((o) => o.org_id === S.orgId) || null;
const amAdmin = () => isAdminOf(currentOrg());
const myUnits = () => [...new Set(unitRolesOf(currentOrg()).map((r) => r.unit_id))];

function setOrg(id) {
  if (S.orgId !== id) {
    S.orgId = id;
    S.data = {};
    S.loadError = null;
    S.peopleUnit = null;
    S.newCode = null;
    S.enroll = null;
    S.enrollPick = new Set();
    S.chOpen = null;
    S.chNamed = null;
    S.hbOpen = null;
    S.hbDay = null;
    S.libFilter = {};
    S.perfCampaign = null;
    S.perfAll = false;
    S.counter = null;
    S.disputesAll = false;
    S.pickState = '';
  }
  if (id) store.set(ORG_KEY, id);
}

// Boot and sign-in ---------------------------------------------------------------------------------
const HANDOFF_FAILED = "The sign-in from the InneRISE app didn't work: the link may have expired or been used already. Sign in here and you'll go straight on.";

async function boot() {
  fromOldAddress();
  fromStaffAddress();
  try {
    await connect();
  } catch {
    S.fatal = "We couldn't load InneRISE. Check your connection and reload the page.";
    S.ready = true;
    render();
    return;
  }
  auth.onChange(onAuthEvent);
  let session = null;
  if (HANDOFF) {
    // Opened from the app: sign in as the app's account. If that fails, sign in here as usual (and don't carry
    // on as whoever this browser had signed in before: it may not be the person holding the phone).
    try {
      session = await auth.verifyHandoff(HANDOFF);
    } catch {
      session = null;
      await auth.signOut();
      S.signin.error = HANDOFF_FAILED;
    }
  } else {
    try { session = await auth.session(); } catch (e) { S.signin.error = e.message; }
  }
  const back = redirectError();
  if (back) {
    S.signin.error = back;
    const q = new URLSearchParams(location.search);
    ['error', 'error_description', 'error_code'].forEach((k) => q.delete(k));
    history.replaceState(null, '', location.pathname + (q.toString() ? `?${q.toString().replace(/^demo=(&|$)/, 'demo$1')}` : ''));
  }
  S.ready = true;
  if (session) await enter(session);
  else render();
}

function onAuthEvent(event, session) {
  if (!S.ready) return;
  if (event === 'SIGNED_OUT') {
    if (S.user) { reset(); render(); }
  } else if (session && session.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    enter(session);
  } else if (event === 'USER_UPDATED' && session && S.user) {
    S.user.email = session.user.email || S.user.email;
    render();
  }
}

async function enter(session) {
  if (S.user && S.user.id === session.user.id) return;
  S.user = { id: session.user.id, email: session.user.email || '' };
  S.signin = freshSignin();
  S.orgs = null;
  S.staff = null;
  // Sign in with Apple leaves the page; come back to where the person was going (an organization and section,
  // or a register link).
  const after = tabStore.get(AFTER_KEY);
  if (after) {
    tabStore.del(AFTER_KEY);
    if (!param('org') && !param('section')) history.replaceState(null, '', location.pathname + after);
  }
  render();
  await loadOrgs();
  render();
}

// Is this account InneRISE staff? Only asked, never assumed: anything but a clear yes (an error, or a server without 082 yet)
// means no, and the server checks every staff call again anyway.
async function staffCheck() {
  try { return (await rpc.isStaff()) === true; } catch { return false; }
}

async function loadOrgs(preferId) {
  try {
    const [mine, staff] = await Promise.all([rpc.mine(), S.staff == null ? staffCheck() : Promise.resolve(S.staff)]);
    S.orgs = mine || [];
    S.staff = staff;
    S.orgsError = null;
  } catch (e) {
    if (await signedOut(e)) return;
    S.orgs = null;
    S.orgsError = e.message;
    return;
  }
  const list = dashOrgs();
  let id = preferId || S.orgId || demoStartOrg() || store.get(ORG_KEY);
  if (!list.some((o) => o.org_id === id)) id = list[0] ? list[0].org_id : null;
  setOrg(id);
}

async function signedOut(e) {
  if (!e || e.code !== 'signed_out') return false;
  await auth.signOut();
  reset();
  S.signin.error = e.message;
  render();
  return true;
}

// Data for the current company ---------------------------------------------------------------------
const LOADERS = {
  view: () => rpc.adminView(S.orgId),
  // Reports (082's org_report_places): the server leaves out every count under the smallest group, so none reaches the page.
  placeCounts: () => rpc.reportPlaces(S.orgId),
  details: () => rpc.details(S.orgId),
  people: () => fetchPeople(0, 200),
  all: () => fetchAllMembers(),
  // Programs (072 and 074)
  challenges: async () => withHabits((await rpc.challengeList(S.orgId)) || []),
  rewards: () => loadRewards(true),
  chReport: () => rpc.challengeReport(S.chOpen, 0, 100),
  summary: () => loadSummary(),
  campaigns: () => loadCampaigns(),
  partner: () => rpc.partnerOverview(S.orgId),
  perf: () => rpc.campaignReport(S.perfCampaign),
  options: () => rpc.partnerOptions(),
  // The Prize Wallet (078): where I may redeem, the logo, disputes, pickups and deliveries, the report
  places: async () => (await rpc.prizeStaffPlaces(S.orgId)) || { whole_org: false, manager: false, units: [] },
  giver: () => loadGiver(),
  disputes: () => rpc.prizeDisputes(S.orgId, !S.disputesAll, null, 50),
  pickups: () => rpc.prizeFulfillmentList(S.orgId, S.pickState || null, null, 100),
  prizeReport: () => loadPrizeReport(),
  // The Sponsor Reward Terms (072's terms round): { none: true } when this person can't see them, or before the server has them.
  sponsorTerms: async () => {
    try { return (await rpc.sponsorTermsState(S.orgId)) || { none: true }; } catch (e) { if (['missing_function', 'not_allowed'].includes(e.code)) return { none: true }; throw e; }
  },
  // Workplace App Management / School Focus (071a, 071b)
  focus: () => rpc.focusList(S.orgId),
  focusRules: () => rpc.focusRules(S.orgId),
  focusWaiting: () => focusWaitingHere(),
  focusPeople: () => loadFocusPeople(0),
  // The Challenge & Rewards Library and habit challenges (075)
  library: () => rpc.libraryBrowse(S.orgId, (S.libFilter || {}).what || null, (S.libFilter || {}).age || null, (S.libFilter || {}).counted || null),
  toConfirm: () => loadToConfirm(),
  hbSheet: () => loadSheet(),
  // Billing (076). Before 076 is on, the page says so instead of failing.
  billing: async () => {
    try { return await rpc.billingView(S.orgId); } catch (e) { if (e.code === 'missing_function') return { missing: true }; throw e; }
  },
};
const inflight = new Set();

async function fetchPeople(skip, rows) {
  const unit = S.peopleUnit || (amAdmin() ? null : myUnits()[0] || null);
  const res = await rpc.members(S.orgId, unit, skip, rows);
  const list = res.members || [];
  return { unit, list, more: list.length === rows };
}

// Everyone, 500 at a time (for the administrators list, the hand-over picker and approvals). A manager or
// teacher gets everyone in the places they look after.
async function fetchAllMembers() {
  if (!amAdmin()) {
    const seen = new Map();
    for (const u of myUnits()) {
      for (let page = 0; page < 40; page++) {
        const res = await rpc.members(S.orgId, u, page * 500, 500);
        const list = res.members || [];
        for (const m of list) {
          const had = seen.get(m.user_id);
          if (!had) seen.set(m.user_id, m);
          else had.units = [...had.units, ...(m.units || []).filter((x) => !had.units.some((y) => y.id === x.id))];
        }
        if (list.length < 500) break;
      }
    }
    return [...seen.values()];
  }
  const out = [];
  for (let page = 0; page < 40; page++) {
    const res = await rpc.members(S.orgId, null, out.length, 500);
    const list = res.members || [];
    out.push(...list);
    if (list.length < 500) break;
  }
  return out;
}

function need(keys) {
  const missing = keys.filter((k) => S.data[k] == null);
  if (S.loadError) return false;
  for (const k of missing) if (!inflight.has(k)) load(k);
  return missing.length === 0;
}

async function load(k) {
  inflight.add(k);
  const org = S.orgId;
  try {
    const value = await LOADERS[k]();
    if (org === S.orgId) S.data[k] = value;
  } catch (e) {
    if (org === S.orgId && !(await signedOut(e))) S.loadError = e.message;
  } finally {
    inflight.delete(k);
    if (org === S.orgId) render();
  }
}

// Reload some data after a change; drop other copies that may now be out of date.
async function refresh(keys, drop = []) {
  const org = S.orgId;
  for (const k of drop) delete S.data[k];
  try {
    const values = await Promise.all(keys.map((k) => {
      if (k === 'people' && S.data.people) return fetchPeople(0, Math.min(500, Math.max(200, S.data.people.list.length)));
      return LOADERS[k]();
    }));
    if (org !== S.orgId) return;
    keys.forEach((k, i) => { S.data[k] = values[i]; });
  } catch (e) {
    if (!(await signedOut(e))) toast(e.message);
  }
  render();
}

// Units: order, paths, labels.
function unitTree(units) {
  const kids = new Map();
  for (const u of units) {
    const p = u.parent_id || '';
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(u);
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const out = [];
  const known = new Set(units.map((u) => u.id));
  const walk = (parent, depth) => {
    for (const u of (kids.get(parent) || []).sort(byName)) {
      out.push({ unit: u, depth });
      walk(u.id, depth + 1);
    }
  };
  walk('', 0);
  // A unit whose parent isn't visible to this person still shows, at the top.
  for (const u of units) if (u.parent_id && !known.has(u.parent_id) && !out.some((x) => x.unit.id === u.id)) { out.push({ unit: u, depth: 0 }); walk(u.id, 1); }
  return out;
}
function unitPath(id, units) {
  const map = new Map(units.map((u) => [u.id, u]));
  const names = [];
  for (let u = map.get(id), i = 0; u && i < 20; u = map.get(u.parent_id), i++) names.unshift(u.name);
  return names.join(' › ');
}
const unitOptions = (units, selected, blank) => (blank ? `<option value=""${!selected ? ' selected' : ''}>${esc(blank)}</option>` : '')
  + unitTree(units).map(({ unit }) => `<option value="${esc(unit.id)}"${unit.id === selected ? ' selected' : ''}>${esc(unitPath(unit.id, units))}</option>`).join('');

// Rendering ----------------------------------------------------------------------------------------
// The sections this account may open here, in the order the menu shows them: the overview, then the programs, then
// the administration (the list it has always had). Approvals is for schools.
const navGroups = (w, org, route) => {
  const allowed = sectionsFor(org);
  const edu = FAMILY[org.kind] === 'education';
  const pick = (list) => list.filter((n) => n && allowed.includes(n.id));
  // The Prize Wallet's two sections follow the rewards they come from.
  const prizes = [{ id: 'redeem', label: 'Redeem prizes', icon: 'scan' }, { id: 'prizes', label: 'Prizes', icon: 'tag' }];
  const programs = org.kind === 'partner'
    ? [{ id: 'sponsored', label: 'Sponsored Challenges', icon: 'trophy' }, { id: 'offers', label: 'Rewards & offers', icon: 'gift' },
      ...prizes, { id: 'performance', label: 'Performance', icon: 'trend' }, { id: 'profile', label: 'Business profile & plan', icon: 'store' }]
    : [{ id: 'challenges', label: 'Challenges & Competitions', icon: 'trophy' }, { id: 'rewards', label: 'Rewards', icon: 'gift' }, ...prizes];
  // The library sits with what it makes: after Sponsored Challenges for a partner, after Rewards for everyone else.
  programs.splice(org.kind === 'partner' ? 1 : 2, 0, { id: 'library', label: 'Challenge & Rewards Library', icon: 'book' });
  programs.push({ id: 'focus', label: w.focusNav, icon: 'focus' });
  return [
    { cls: 'nav-home', name: 'Home', items: pick([{ id: 'overview', label: 'Overview', icon: 'building' }]) },
    { cls: 'nav-product', name: 'Programs', title: 'Programs', items: pick(programs) },
    { cls: 'nav-admin', name: 'Administration', title: 'Administration', items: pick(adminNav(w, edu, route)) },
  ].filter((g) => g.items.length);
};
const adminNav = (w, edu, route) => [
  { id: 'people', label: 'People', icon: 'people' },
  { id: 'places', label: w.units, icon: KIND_ICON[w.topKinds[0]] || 'pin' },
  { id: 'invites', label: 'Invite codes', icon: 'ticket' },
  { id: 'enroll', label: 'Bulk enrollment', icon: 'enroll' },
  (edu || route === 'approvals') && { id: 'approvals', label: 'Approvals', icon: 'inbox' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
  { id: 'billing', label: 'Billing', icon: 'card' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];
const PAGES = { overview: overviewPage, people: peoplePage, places: placesPage, invites: invitesPage, approvals: approvalsPage,
  settings: settingsPage, billing: billingPage, reports: reportsPage, enroll: enrollPage, challenges: challengesPage, rewards: rewardsPage,
  focus: focusPage, library: libraryPage, sponsored: sponsoredPage, offers: offersPage, redeem: counterPage, prizes: prizesPage, performance: performancePage, profile: profilePage };
const sectionTitle = (section, w = words()) => ({ overview: 'Overview', people: 'People', places: w.units, invites: 'Invite codes',
  approvals: 'Approvals', settings: 'Settings', billing: 'Billing', reports: 'Reports', enroll: 'Bulk enrollment',
  challenges: 'Challenges & Competitions', rewards: 'Rewards', library: 'Challenge & Rewards Library', focus: w.focusTitle, sponsored: 'Sponsored Challenges', offers: 'Rewards & offers',
  redeem: 'Redeem prizes', prizes: 'Prizes', performance: 'Performance', profile: 'Business profile & plan' }[section] || section);

// Addresses ----------------------------------------------------------------------------------------
// GitHub Pages has no server routes, so everything lives in the query: ?org=<id>&section=<section>.
const param = (k) => new URLSearchParams(location.search).get(k);
// InneRISE administration's pages (082), for InneRISE staff only: ?section=staff, staff-orgs (&st=, &q=), staff-org&id=,
// staff-partners, staff-library (&st=) and staff-prizes.
const STAFF_SECTIONS = ['staff', 'staff-orgs', 'staff-org', 'staff-partners', 'staff-library', 'staff-prizes'];
const routeName = () => { const s = param('section'); return s === 'register' || SECTIONS.includes(s) || STAFF_SECTIONS.includes(s) ? s : ''; };
// ?demo (and which demo) rides along on every address, so a reload stays in the demo.
const DEMO_PART = (() => {
  const q = new URLSearchParams(location.search);
  if (!q.has('demo')) return '';
  return q.get('demo') ? `demo=${encodeURIComponent(q.get('demo'))}` : 'demo';
})();
function urlFor({ org = null, section = null, kind = null, id = null, st = null, q = null } = {}) {
  const parts = [DEMO_PART, org && `org=${encodeURIComponent(org)}`, section && `section=${encodeURIComponent(section)}`,
    kind && `kind=${encodeURIComponent(kind)}`, id && `id=${encodeURIComponent(id)}`, st && `st=${encodeURIComponent(st)}`,
    q && `q=${encodeURIComponent(q)}`].filter(Boolean);
  return parts.length ? `?${parts.join('&')}` : './';
}
const sectionUrl = (section, orgId = S.orgId) => urlFor({ org: orgId, section });
// Change the address without leaving the page: push for a step the person took, replace for a correction.
function go(target, push = false) {
  const next = new URL(typeof target === 'string' ? target : urlFor(target), location.href);
  if (next.pathname === location.pathname && next.search === location.search && !location.hash) return;
  history[push ? 'pushState' : 'replaceState'](null, '', next.pathname + next.search);
}
// ?staff, InneRISE administration's short address, turns into ?section=staff.
function fromStaffAddress() {
  const q = new URLSearchParams(location.search);
  if (!q.has('staff') || q.get('section')) return false;
  go({ section: 'staff' });
  return true;
}
// Old addresses (#/people, #/units, #/register?kind=...) still work: they turn into the new ones.
function fromOldAddress() {
  const m = location.hash.match(/^#\/([a-z]+)(?:\?(.*))?$/);
  if (!m) return false;
  const q = new URLSearchParams(m[2] || '');
  const renamed = { units: 'places', signin: null };
  go({ org: param('org'), section: m[1] in renamed ? renamed[m[1]] : m[1], kind: q.get('kind') || param('kind') });
  return true;
}
// The same place in the InneRISE app. Website-only sections open the organization's overview there.
const appHref = (orgId, section) => `${APP_SCHEME}://org/${encodeURIComponent(orgId)}?section=${WEB_ONLY.includes(section) ? 'overview' : section}`;
// Only an iPhone or iPad can have the InneRISE app, so only they show "Open in the InneRISE app" (an iPad can call itself a Mac
// with a touch screen). A computer has nothing to open.
const APP_DEVICE = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0);
const appLink = () => (APP_DEVICE && S.orgId && S.section
  ? `<a class="btn btn-app" href="${esc(appHref(S.orgId, S.section))}" data-app-link>${icon('phone')}<span>Open in the InneRISE app</span></a>` : '');
const brandOf = (family) => `InneRISE ${BRAND[family] || BRAND.any}`;
// One header and one footer on every page: sign in, register and the dashboard. Their links go to the public pages on the
// same site (innerise.app/workplaces/, /schools/, /partners/), which have Sign In and Get Started buttons that come back here.
// Those pages are outside the dashboard, so ?demo stays behind; links inside the dashboard keep it (urlFor).
const DOOR_LINKS = [['workplaces', 'Workplaces', 'InneRISE for Business', 'business'], ['schools', 'Schools', 'InneRISE for Education', 'education'],
  ['partners', 'Partners', 'InneRISE Partners', 'partner']];
const doorUrl = (folder) => `../${folder}/`;
function siteTop(family, action = '', cls = '') {
  const home = DOOR_LINKS.find((d) => d[3] === family);
  return `<header class="site-top${cls}">
    <a class="site-brand" href="${esc(home ? doorUrl(home[0]) : '../')}">${wordmark('wordmark-md')}<span class="for-biz">${esc(BRAND[family] || BRAND.any)}</span></a>
    <nav class="site-nav" aria-label="InneRISE for organizations">${DOOR_LINKS.map(([f, name]) => `<a href="${esc(doorUrl(f))}">${name}</a>`).join('')}</nav>
    <div class="site-action">${action}</div></header>`;
}
const siteFoot = () => `<footer class="site-foot"><div class="site-foot-brand">${wordmark()}<span>One InneRISE account for everything.</span></div>
  <nav aria-label="Other InneRISE programs">${DOOR_LINKS.map(([f, , brand]) => `<a class="link-btn small" href="${esc(doorUrl(f))}">${esc(brand)}</a>`).join('')}</nav></footer>`;
const setTitle = (page, family) => { document.title = page ? `${page} · ${brandOf(family)}` : brandOf(family); };

function render() {
  closeMenu();
  useWords(words(S.registering ? S.registering.kind : (routeName() === 'register' && S.regKind) || undefined));
  const kept = keepForms();
  const focusId = document.activeElement && app.contains(document.activeElement) ? document.activeElement.id : null;
  app.innerHTML = view();
  restoreForms(kept);
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); }
  const autofocus = app.querySelector('[data-autofocus]');
  if (autofocus && !focusId) autofocus.focus({ preventScroll: true });
}

function view() {
  if (!S.ready) return splash('Loading…');
  if (S.fatal) return soloPage(errorCard(S.fatal, false));
  if (!S.user) {
    setTitle('Sign in', familyOf(param('kind')));
    return signInPage();
  }
  if (S.orgs == null) return S.orgsError ? soloPage(errorCard(S.orgsError, true, 'retry-orgs')) : splash('Loading your organizations…');
  let route = S.registering ? 'register' : routeName();
  const staffRoute = STAFF_SECTIONS.includes(route);
  if (staffRoute && !S.staff) {
    // InneRISE administration is only for InneRISE staff: say so, and open what this account can.
    refuse(`InneRISE administration is only for InneRISE staff, so ${S.user.email || 'this account'} can't open it. Here's what you can open.`);
    go({});
    route = '';
  }
  if (route !== 'register' && !(staffRoute && S.staff)) {
    const place = resolvePlace();
    if (place) route = place.section;
    else if (S.staff) {
      // InneRISE staff with no organization of their own to open: InneRISE administration is what they have here.
      go({ section: 'staff' });
      route = 'staff';
    } else {
      // Nothing this account can open here: the start screen, to register one or join one with a code in the app.
      go({ section: 'register', kind: param('kind') });
      route = 'register';
    }
  }
  if (lastRoute !== route) {
    if (lastRoute && !S.noticeSticky) S.notice = null;
    // Coming into InneRISE administration from elsewhere: ask the server again, so nothing shown is old.
    if (STAFF_SECTIONS.includes(route) && !STAFF_SECTIONS.includes(lastRoute)) STAFF_KEYS.forEach((k) => delete S.data[k]);
    // Reports always asks again: places and people may have changed since it was last open.
    if (route === 'reports') delete S.data.placeCounts;
    lastRoute = route;
    S.chOpen = null;
    S.chNamed = null;
    S.hbOpen = null;
    S.hbDay = null;
    S.perfAll = false;
    window.scrollTo(0, 0);
  }
  S.noticeSticky = false;
  if (route === 'register') {
    S.section = null;
    setTitle('Register', S.registering ? FAMILY[S.registering.kind] : entryFor(param('kind')).family);
    return registerPage();
  }
  if (STAFF_SECTIONS.includes(route)) {
    S.section = route;
    setTitle(STAFF_TITLES[route], 'staff');
    return staffShell(route, STAFF_PAGES[route]());
  }
  const w = words();
  S.section = route;
  setTitle(sectionTitle(route, w), FAMILY[currentOrg().kind]);
  return shell(route, PAGES[route]());
}

// Which organization and section to show: the ones in the address when this account may open them. When it
// may not, say why in one short notice and open what it can: never a blank page, never a search.
function resolvePlace() {
  const orgs = dashOrgs();
  const wantOrg = param('org');
  const raw = param('section');
  const wantSection = SECTIONS.includes(raw) ? raw : null;
  let org = wantOrg ? orgs.find((o) => o.org_id === wantOrg) : null;
  if (wantOrg && !org) refuse(whyNotOrg(wantOrg));
  if (!org) {
    const pick = [S.orgId, demoStartOrg(), store.get(ORG_KEY)].find((id) => id && orgs.some((o) => o.org_id === id));
    org = orgs.find((o) => o.org_id === pick) || orgs[0];
    if (org && wantSection && !wantOrg && !sectionsFor(org).includes(wantSection)) org = orgs.find((o) => sectionsFor(o).includes(wantSection)) || org;
  }
  if (!org) return null;
  const allowed = sectionsFor(org);
  let section = wantSection && allowed.includes(wantSection) ? wantSection : null;
  if (!section && (!wantOrg || wantOrg === org.org_id)) {
    if (wantSection) refuse(whyNotSection(org, wantSection));
    else if (raw && raw !== 'register') refuse(`There's no "${raw}" page on the website, so here is the overview.`);
  }
  if (!section) section = allowed.includes('overview') ? 'overview' : allowed[0];
  setOrg(org.org_id);
  go({ org: org.org_id, section });
  return { org, section };
}
function say(text) {
  S.notice = text;
  S.noticeKind = 'ok';
  S.noticeSticky = true;
}
function refuse(text) {
  S.notice = text;
  S.noticeKind = 'refused';
  S.noticeSticky = true;
}
function whyNotOrg(id) {
  const o = (S.orgs || []).find((x) => x.org_id === id);
  const who = S.user.email || 'This account';
  if (!o) return `${who} isn't a member of the organization in that link. Sign in with the account you use there, or ask its administrators to invite you.`;
  if (o.status === 'suspended') return `${o.name} is paused by InneRISE, so it can't be opened here right now.`;
  if (o.status === 'closed') return `${o.name} is closed, so there's nothing to open.`;
  if (o.member_status === 'pending') return `You're still waiting to join ${o.name}, so it can't be opened here yet.`;
  const w = words(o.kind);
  return `You're in ${o.name} as ${article(typeLabel(o.member_type, w).toLowerCase())}. Only its ${w.staffWho} can open it here.`;
}
function whyNotSection(o, section) {
  const w = words(o.kind);
  const edu = FAMILY[o.kind] === 'education';
  const title = sectionTitle(section, w);
  if (PARTNER_SECTIONS.includes(section) && o.kind !== 'partner') {
    return `${title} is for InneRISE Partners, so ${o.name} doesn't have it. Here's what you can open.`;
  }
  if (['challenges', 'rewards'].includes(section) && o.kind === 'partner') {
    return `A partner's challenges and rewards are in Sponsored Challenges and Rewards & offers, so ${o.name} doesn't have ${title}. Here's what you can open.`;
  }
  if (['challenges', 'rewards', 'library', ...PRIZE_SECTIONS].includes(section) && !o.offers_challenges && o.kind !== 'partner') {
    return `Challenges aren't switched on for ${o.name}. Write to InneRISE to switch them on. Here's what you can open.`;
  }
  if (section === 'focus' && !focusOffered(o)) return `${title} isn't switched on for ${o.name}. Here's what you can open.`;
  const managers = edu ? 'leaders and teachers' : 'managers';
  const who = {
    billing: 'administrators and billing contact',
    settings: 'administrators',
    challenges: `administrators, challenge coordinators and ${managers}`,
    rewards: `administrators, rewards managers, challenge coordinators and ${managers}`,
    library: o.kind === 'partner' ? 'administrators and challenge coordinators' : `administrators, challenge coordinators, rewards managers and ${managers}`,
    sponsored: 'administrators and challenge coordinators',
    offers: 'administrators and rewards managers',
    redeem: 'administrators, rewards managers and people with Can Redeem Prizes',
    prizes: 'administrators and rewards managers',
    performance: 'administrators, challenge coordinators and rewards managers',
    profile: 'administrators, coordinators, rewards managers and billing contact',
  }[section] || w.staffWho;
  return `${title} in ${o.name} is only for its ${who}, so this account can't open it. Here's what you can open.`;
}
// One line for the sidebar: what a manager, teacher or billing contact is here.
function roleSummary(o, w = words()) {
  const units = (S.data.view && S.data.view.units) || (S.data.placeCounts && S.data.placeCounts.places) || [];
  const parts = unitRolesOf(o).map((r) => roleText(r, units, w));
  if (hasRoleIn(o, 'challenge_coordinator')) parts.push('Challenge coordinator');
  if (hasRoleIn(o, 'rewards_manager')) parts.push('Rewards manager');
  const redeem = rolesOf(o).filter((r) => r.role === 'prize_redeemer');
  if (redeem.length) {
    // Can Redeem Prizes, and where: names from the administration view, or from the counter's own list of places.
    const named = (S.data.places && S.data.places.units) || [];
    const where = redeem.map((r) => (r.unit_id ? unitPath(r.unit_id, units) || (named.find((u) => u.id === r.unit_id) || {}).name || '' : null));
    parts.push(where.includes(null) || !where.some(Boolean) ? 'Can Redeem Prizes' : `Can Redeem Prizes · ${where.filter(Boolean).join(', ')}`);
  }
  if (isBillingOf(o)) parts.push('Billing contact');
  return parts.join(', ');
}

const splash = (text) => `<div class="splash">${wordmark('wordmark-lg')}<p class="muted">${esc(text)}</p></div>`;

function soloPage(inner) {
  return `<div class="solo-page">${siteTop(familyOf(param('kind')), demoTag())}
    <main class="solo">${inner}</main>${siteFoot()}</div>`;
}

function errorCard(message, retry, act = 'retry') {
  return `<section class="glass card error-card" role="alert"><p>${esc(message)}</p>
    ${retry ? `<button class="btn" data-act="${act}">Try again</button>` : ''}</section>`;
}

// The organization switcher (the picker): every organization this account can open here, and for InneRISE staff, InneRISE
// administration as one more entry. Nothing to pick between: no switcher.
const STAFF_PICK = 'innerise-administration';
function orgSwitcher(selected) {
  const orgs = dashOrgs();
  if (orgs.length + (S.staff ? 1 : 0) < 2) return '';
  const mixed = S.staff || new Set(orgs.map((o) => o.kind)).size > 1;
  return `<label class="side-label" for="org-switch">${mixed ? 'Organization' : words().Org}</label>
       <select id="org-switch" class="input" data-change="switch-org">${orgs.map((o) => `<option value="${esc(o.org_id)}"${o.org_id === selected ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}${
  S.staff ? `<option value="${STAFF_PICK}"${selected === STAFF_PICK ? ' selected' : ''}>InneRISE administration</option>` : ''}</select>`;
}

function shell(route, content) {
  const org = currentOrg();
  const w = words();
  const sub = BRAND[FAMILY[org.kind]];
  const switcher = orgSwitcher(S.orgId) || `<div class="side-label">${w.Org}</div><div class="side-company">${esc(org.name)}</div>`;
  return `<div class="shell${S.navOpen ? ' nav-open' : ''}">
    <header class="topbar">
      <button class="icon-btn" data-act="nav-toggle" aria-label="Open menu" aria-controls="sidebar" aria-expanded="${S.navOpen}">${icon('menu')}</button>
      <a class="topbar-brand" href="${esc(sectionUrl(sectionsFor(org)[0]))}" data-nav>${wordmark()}<span class="for-biz">${sub}</span></a>
      ${demoTag()}
    </header>
    <aside class="sidebar" id="sidebar" aria-label="Main">
      <div class="side-brand">
        <div class="side-brand-row">${wordmark('wordmark-md')}<button class="icon-btn nav-close" data-act="nav-close" aria-label="Close menu">${icon('x')}</button></div>
        <div class="for-biz">${sub}</div>
        ${demoTag()}
      </div>
      <div class="side-org">${switcher}${amAdmin() ? '' : `<div class="side-role">${icon('shield')}<span>${esc(roleSummary(org, w))}</span></div>`}</div>
      ${navGroups(w, org, route).map((g) => `<nav class="nav ${g.cls}" aria-label="${esc(g.name)}">${g.title ? `<div class="nav-group-label">${esc(g.title)}</div>` : ''}${g.items
    .map((n) => `<a class="nav-link${n.id === route ? ' active' : ''}" href="${esc(sectionUrl(n.id))}" data-nav data-section="${n.id}"${n.id === route ? ' aria-current="page"' : ''}>${ring(n.icon, 'sm')}<span>${esc(n.label)}</span></a>`).join('')}</nav>`).join('')}
      <div class="side-foot">
        <div class="side-label">Signed in as</div>
        <div class="account-email" title="${esc(S.user.email)}">${esc(S.user.email || 'Your InneRISE account')}</div>
        <button class="btn btn-sm" data-act="sign-out">${icon('signout')}<span>Sign out</span></button>
      </div>
    </aside>
    <div class="scrim" data-act="nav-close"></div>
    <main class="main" id="main"><div class="content">${noticeBanner()}${content}</div>${siteFoot()}</main>
  </div>`;
}

function noticeBanner() {
  if (!S.notice) return '';
  const refused = S.noticeKind === 'refused';
  return `<div class="notice glass${refused ? ' notice-refused' : ''}" role="${refused ? 'alert' : 'status'}">${ring(refused ? 'shield' : 'check', 'sm')}<p>${esc(S.notice)}</p>
    <button class="icon-btn" data-act="notice-close" aria-label="Dismiss">${icon('x')}</button></div>`;
}

// Every section's heading carries the way back into the app; a manager or teacher also sees what they look after.
const pageHead = (title, sub, actions = '') => `<header class="page-head"><div class="page-head-text"><h1 class="page-title">${esc(title)}</h1>
  <p class="page-sub">${esc(sub)}</p>${scopeLine()}</div><div class="page-actions">${appLink()}${actions}</div></header>`;
function scopeLine() {
  const o = currentOrg();
  // The places' names come from the administration view, or on Reports from its own list of places.
  const known = S.data.view ? S.data.view.units || [] : S.data.placeCounts ? S.data.placeCounts.places || [] : null;
  if (!o || isAdminOf(o) || !known) return '';
  const program = ['challenges', 'rewards', 'focus'].includes(S.section);
  if (!UNIT_SECTIONS.includes(S.section) && !program) return '';
  // A whole-organization coordinator or rewards manager isn't limited to their places in Challenges or Rewards.
  if (program && (wholeOrgRole(o, 'challenge_coordinator') || (S.section === 'rewards' && wholeOrgRole(o, 'rewards_manager')))) return '';
  if (S.section === 'focus' && wholeFocus(o)) return '';
  const names = myUnits().map((id) => unitPath(id, known)).filter(Boolean);
  return names.length ? `<p class="scope-line">${icon('shield')}<span>Only the ${names.length === 1 ? 'place' : 'places'} you look after: ${esc(names.join(', '))}</span></p>` : '';
}
const label = (text) => `<h2 class="section-label">${esc(text)}</h2>`;
const loading = () => `<section class="glass card loading-card"><span class="spinner" aria-hidden="true"></span><span>Loading…</span></section>`;
// An empty list says what will show up there, and how to get it started.
const emptyState = (ic, title, text, action = '') => `<div class="empty-state">${ring(ic, 'lg')}<p class="empty-title">${esc(title)}</p>
  <p class="empty-text">${esc(text)}</p>${action}</div>`;
const emptyRow = (...a) => `<div class="row empty-row">${emptyState(...a)}</div>`;
const pendingCard = (extra = '') => `<section class="glass card pending-card" role="status">${ring('clock')}
  <div><h2 class="card-title">Being verified</h2><p>${esc(PENDING_NOTE)}</p>${extra}</div></section>`;

function pageBody(keys) {
  if (S.loadError) return errorCard(S.loadError, true);
  if (!need(keys)) return loading();
  return null;
}

// Sign in ------------------------------------------------------------------------------------------
// Where a link from the app (or a bookmark) goes once the person has signed in.
function nextLine() {
  const s = param('section');
  if (STAFF_SECTIONS.includes(s)) {
    return `<p class="signin-next">${icon('arrow')}<span>After you sign in, <strong>InneRISE administration</strong> opens for InneRISE staff.</span></p>`;
  }
  if (s === 'register') {
    const kind = param('kind');
    const what = ['school', 'district', 'college', 'education'].includes(kind) ? 'your school, district or college' : kind === 'partner' ? 'your partner business'
      : kind === 'business' ? 'your company' : 'your organization';
    return `<p class="signin-next">${icon('arrow')}<span>After you sign in, you can <strong>register ${esc(what)}</strong>.</span></p>`;
  }
  if (!SECTIONS.includes(s)) return '';
  const name = s === 'places' ? 'Places' : sectionTitle(s);
  return `<p class="signin-next">${icon('arrow')}<span>After you sign in, <strong>${esc(name)}</strong> opens for your organization.</span></p>`;
}

function signInPage() {
  const s = S.signin;
  let body = '';
  if (s.step === 'code') {
    body = `<form data-form="verify-code" class="stack" novalidate>
        <p class="lead-small">We sent a 6-digit code to <strong>${esc(s.email)}</strong>. Enter it here.</p>
        <label class="field"><span class="field-label">Code</span>
          <input id="code" class="input input-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456" data-autofocus></label>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        <div class="row-links"><button type="button" class="link-btn" data-act="email-back">Use a different email</button>
        <button type="button" class="link-btn" data-act="resend">Send a new code</button></div>
      </form>`;
  } else {
    body = `<button class="btn btn-block" data-act="apple">${icon('apple')}<span>Continue with Apple</span></button>
      ${s.step === 'email'
    ? `<div class="or"><span>or</span></div>
         <form data-form="send-code" class="stack" novalidate>
           <label class="field"><span class="field-label">Your email</span>
             <input id="email" class="input" name="email" type="email" autocomplete="email" placeholder="you@company.com" value="${esc(s.email)}" data-autofocus></label>
           <button class="btn btn-primary btn-block" type="submit">Send code</button>
         </form>`
    : `<button class="btn btn-block" data-act="email-start">${icon('mail')}<span>Email me a code</span></button>`}`;
  }
  return `<div class="solo-page signin-page">${siteTop(familyOf(param('kind')))}
    <main class="solo narrow">
      <section class="glass card signin-card">
        ${demoTag()}
        <div class="signin-brand">${wordmark('wordmark-xl')}</div>
        <h1 class="signin-title">${esc(brandOf(familyOf(param('kind'))))}</h1>
        <p class="signin-sub">Sign in with your InneRISE account, the same one you use in the app.</p>
        ${nextLine()}
        <div class="stack signin-actions">${body}</div>
        <p class="form-error" role="alert"${s.error ? '' : ' hidden'}>${esc(s.error || '')}</p>
        ${DEMO ? '<p class="hint">Demo: either button signs you in, and any 6-digit code works.</p>' : ''}
      </section>
      <p class="signin-foot">${icon('shield')}<span>Your people's screen time, health and messages stay private. Always.</span></p>
    </main>${siteFoot()}</div>`;
}

// Register an organization -------------------------------------------------------------------------
function registerPage() {
  const r = S.registering;
  const entry = entryFor(r ? r.kind : param('kind'));
  if (!r && !entry.kinds.includes(S.regKind)) S.regKind = entry.pick || entry.kinds[0];
  const kind = r ? r.kind : S.regKind;
  const w = words(kind);
  const step = r ? r.step : 1;
  const steps = [w.Org, 'Details', 'Email domain'];
  const stepper = `<ol class="steps" aria-label="Steps">${steps.map((t, i) => `<li class="${i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}"${i + 1 === step ? ' aria-current="step"' : ''}>
      <span class="step-dot">${i + 1 < step ? icon('check') : i + 1}</span><span class="step-text">${esc(t)}</span></li>`).join('')}</ol>`;
  const memberOf = (S.orgs || []).filter((o) => ORG_KINDS.includes(o.kind) && ['active', 'pending'].includes(o.status) && !sectionsFor(o).length);
  // Someone who is only a member (no role to manage anything): their organization lives in the app, never an empty page here.
  const memberNote = step === 1 && memberOf.length && !dashOrgs().length
    ? `<section class="glass card explain-card member-card">${ring('phone')}<div class="stack">
        <h2 class="card-title">Your organization is managed in the InneRISE app</h2>
        <p>${memberOf.map((o) => `You're in ${esc(o.name)} as ${esc(article(typeLabel(o.member_type, words(o.kind)).toLowerCase()))}.`).join(' ')}
          Your challenges, rewards and everything else you do with ${memberOf.length === 1 ? esc(memberOf[0].name) : 'them'} are in the InneRISE app.</p>
        <p class="muted">The website is for administrators, managers and teachers. To help run ${memberOf.length === 1 ? esc(memberOf[0].name) : 'one of them'} here, ask one of its administrators to give you a role.</p>
        ${APP_DEVICE ? `<div><a class="btn btn-app" href="${esc(appHref(memberOf[0].org_id, 'overview'))}" data-app-link>${icon('phone')}<span>Open in the InneRISE app</span></a></div>` : ''}
      </div></section>`
    : step === 1 && memberOf.length
      ? `<p class="note">${memberOf.map((o) => `You're in ${esc(o.name)} as ${esc(article(typeLabel(o.member_type, words(o.kind)).toLowerCase()))}.`).join(' ')}
       To manage it here, ask one of its administrators to make you an administrator.</p>` : '';
  // Nothing to open here yet: register an organization, or join one with a code (that happens in the app).
  const joinCard = !r && step === 1 && !dashOrgs().length && !memberOf.length && !param('kind')
    ? `<section class="glass card explain-card join-card">${ring('ticket')}<div class="stack">
        <h2 class="card-title">Joining your organization instead?</h2>
        <p>If your organization gave you an invite code, join with it in the InneRISE app: <strong>Protection → Organizations → Join with a code.</strong></p>
        <p class="muted">Registering is for the person setting up a company, school, district, college or partner business on InneRISE.</p>
      </div></section>` : '';
  let card = '';
  if (step === 1) {
    const choice = entry.kinds.length > 1
      ? `<fieldset class="kind-choice"><legend class="field-label">What are you registering?</legend>
          <div class="kind-options">${entry.kinds.map((k) => `<label class="kind-opt">
            <input type="radio" name="kind" value="${k}"${k === kind ? ' checked' : ''} data-change="reg-kind">
            <span class="kind-card">${ring(KIND_CHOICES[k].icon, 'sm')}<span class="kind-text"><strong>${KIND_CHOICES[k].title}</strong>
            <small>${KIND_CHOICES[k].blurb}</small></span></span></label>`).join('')}</div></fieldset>`
      : '';
    const checked = kind !== 'business'
      ? `<div class="explain">${ring('clock', 'sm')}<p>InneRISE checks every ${esc(w.org)} by hand. You can set everything up right away; inviting people starts once it's verified.</p></div>`
      : '';
    card = `<form data-form="reg-1" data-keep="reg1" class="stack" novalidate>
      ${choice}
      <h2 class="card-title">Your ${esc(w.org)}</h2>
      <label class="field"><span class="field-label">${esc(w.Org)} name</span>
        <input id="reg-name" class="input" name="name" maxlength="80" autocomplete="organization" placeholder="${esc(w.placeholders.name)}" data-autofocus></label>
      <label class="field"><span class="field-label">Time zone</span>
        <select id="reg-tz" class="input" name="tz">${tzOptions(LOCAL_TZ)}</select>
        <span class="field-help">Used for challenge days and report dates. You can change it later.</span></label>
      ${checked}
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Register ${esc(w.org)}</button></div>
    </form>`;
  } else if (step === 2) {
    card = `<form data-form="reg-2" class="stack" novalidate>
      <h2 class="card-title">${esc(w.Org)} details</h2>
      <p class="muted">All optional. You can add or change these any time in Settings.</p>
      ${detailFields({ country: LOCAL_COUNTRY }, { w, prefix: 'reg', withName: false, withTz: false })}
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions"><button class="btn" type="button" data-act="reg-skip">Skip</button>
        <button class="btn btn-primary" type="submit">Save and continue</button></div>
    </form>`;
  } else {
    const at = (S.user.email.split('@')[1] || '').toLowerCase();
    const guess = at && !FREE_MAIL.includes(at) ? at : '';
    card = `<form data-form="reg-3" class="stack" novalidate>
      <h2 class="card-title">${esc(w.Org)} email domain</h2>
      <p>Add the domain of your ${esc(w.org)}'s email, like <strong>acme.com</strong>. People see it when they join, ${esc(w.domainWhy)}.</p>
      ${domainExplainer(w)}
      <label class="field"><span class="field-label">Email domain</span>
        <input id="reg-domain" class="input" name="domain" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="acme.com" value="${esc(guess)}" data-autofocus></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions"><button class="btn" type="button" data-act="reg-finish">Skip</button>
        <button class="btn btn-primary" type="submit">Confirm domain</button></div>
    </form>`;
  }
  const back = !r && (dashOrgs().length || S.staff) ? `<a class="link-btn small back-link" href="${esc(urlFor({}))}" data-nav>${icon('arrow')}<span>Back to dashboard</span></a>` : '';
  const account = `${demoTag()}<span class="site-email" title="${esc(S.user.email)}">${esc(S.user.email)}</span><button class="link-btn" data-act="sign-out">Sign out</button>`;
  return `<div class="solo-page">${siteTop(entry.family, account, ' account')}
    <main class="solo">
      ${back}
      ${noticeBanner()}
      <h1 class="page-title">${esc(r ? w.registerTitle : entry.title)}</h1>
      <p class="page-sub">Three short steps. You can change everything later.</p>
      ${memberNote}
      ${joinCard}
      ${stepper}
      <section class="glass card">${card}</section>
    </main>${siteFoot()}</div>`;
}

function domainExplainer(w = words()) {
  const relay = /@privaterelay\.appleid\.com$/i.test(S.user.email);
  return `<div class="explain">${ring('shield', 'sm')}<p>We confirm it with your own sign-in email, so it must be at this domain.
    You're signed in as <strong>${esc(S.user.email || 'an account without an email')}</strong>.
    ${relay ? `You signed in with Apple's Hide My Email, so your sign-in email is a private relay address and can't confirm ${article(w.org)} domain.` : ''}</p></div>`;
}

// Company details fields (registration step 2 and Settings).
function detailFields(v, { w, prefix, withName, withTz, nameLocked }) {
  const f = (name, labelText, attrs = '', help = '') => `<label class="field"><span class="field-label">${labelText}</span>
    <input id="${prefix}-${name}" class="input" name="${name}" value="${esc(v[name] || '')}" ${attrs}>${help ? `<span class="field-help">${help}</span>` : ''}</label>`;
  return `<div class="form-grid">
    ${withName ? `<label class="field span-2"><span class="field-label">${w.Org} name</span>
      <input id="${prefix}-name" class="input" name="name" maxlength="80" value="${esc(v.name || '')}"${nameLocked ? ' readonly aria-readonly="true"' : ''}>
      ${nameLocked ? '<span class="field-help">InneRISE checked this name by hand. Write to InneRISE to change it.</span>' : ''}</label>` : ''}
    ${f('legal_name', 'Legal name', `maxlength="120" placeholder="${esc(w.placeholders.legal)}"${nameLocked ? ' readonly' : ''}`)}
    ${f('website', 'Website', 'type="url" inputmode="url" autocapitalize="off" placeholder="https://acme.com"')}
    ${f('contact_email', 'Contact email', 'type="email" autocapitalize="off" placeholder="people@acme.com"')}
    ${f('contact_phone', 'Contact phone', 'type="tel" placeholder="+1 555 010 0000"')}
    ${f('street', 'Street address', 'maxlength="200" autocomplete="street-address"', '').replace('class="field"', 'class="field span-2"')}
    ${f('city', 'City', 'maxlength="100" autocomplete="address-level2"')}
    ${f('region', 'State or region', 'maxlength="100" autocomplete="address-level1"')}
    ${f('postal_code', 'Postal code', 'maxlength="20" autocomplete="postal-code"')}
    <label class="field"><span class="field-label">Country</span><select id="${prefix}-country" class="input" name="country">${countryOptions(v.country || '')}</select></label>
    ${withTz ? `<label class="field span-2"><span class="field-label">Time zone</span><select id="${prefix}-time_zone" class="input" name="time_zone">${tzOptions(v.time_zone)}</select></label>` : ''}
  </div>`;
}

const DETAIL_KEYS = ['name', 'legal_name', 'website', 'contact_email', 'contact_phone', 'street', 'city', 'region', 'postal_code', 'country', 'time_zone'];
function readDetails(form, before = {}) {
  const d = {};
  for (const k of DETAIL_KEYS) {
    const el = form.elements[k];
    if (!el || el.readOnly) continue;
    let v = String(el.value || '').trim();
    if (k === 'website' && v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
    if ((before[k] || '') !== v) d[k] = v;
  }
  return d;
}

// Overview ---------------------------------------------------------------------------------------
function overviewPage() {
  const org = currentOrg();
  const admin = amAdmin();
  const programs = sectionsFor(org).some((x) => ['challenges', 'rewards', 'sponsored', 'offers'].includes(x));
  const wait = pageBody([...(admin ? ['view', 'details'] : ['view', 'details', 'all']), ...(programs ? ['summary'] : [])]);
  if (wait) return pageHead('Overview', `${org.name} on InneRISE, at a glance.`) + wait;
  const v = S.data.view;
  const d = S.data.details;
  const w = words();
  const units = v.units || [];
  const tops = units.filter((u) => w.topKinds.includes(u.kind)).length;
  const subs = units.length - tops;
  const codes = (v.invitations || []).length;
  const pending = v.org.status === 'pending';
  const status = v.org.status === 'active'
    ? '<span class="chip chip-ok"><span class="dot"></span>Active</span>'
    : `<span class="chip chip-wait">${pending ? `${icon('clock')}Being verified` : esc(v.org.status)}</span>`;
  const domains = (d.domains || []).length
    ? d.domains.map((x) => `<span class="chip chip-accent" title="Verified: ${esc(x)}">${icon('check')}<span>Verified: ${esc(x)}</span></span>`).join('')
    : admin ? `<a class="chip chip-link" href="${esc(sectionUrl('settings'))}" data-nav>Add your email domain</a>` : '';
  const stat = (section, ic, n, title, sub) => `<a class="glass stat" href="${esc(sectionUrl(section))}" data-nav>${ring(ic)}<span class="stat-num">${num(n)}</span>
    <span class="stat-title">${esc(title)}</span>${sub ? `<span class="stat-sub">${esc(sub)}</span>` : ''}</a>`;
  const see = ['First names', 'Who is a member, and who is still waiting', `Which ${w.unitsLower} people are in`, 'Challenge results that people choose to share'];
  const never = ['Screen time or which apps people use', 'Health or activity records', 'Where people are (their location)', 'Messages', 'Anything people save in InneRISE'];
  const action = pending && admin
    ? `<a class="btn btn-primary" href="${esc(sectionUrl('places'))}" data-nav>${icon('plus')}<span>Add ${esc(w.topLabel.toLowerCase())}</span></a>`
    : `<a class="btn btn-primary" href="${esc(sectionUrl('invites'))}" data-nav>${icon('plus')}<span>Invite people</span></a>`;
  const codeStat = stat('invites', 'ticket', codes, codes === 1 ? 'Open invite code' : 'Open invite codes', pending ? 'once verified' : '');
  const stats = admin
    ? [stat('people', 'people', v.members ?? 0, 'People', 'active members'),
      stat('places', KIND_ICON[w.topKinds[0]] || 'pin', tops, tops === 1 ? w.topOne : w.topLabel),
      stat('places', 'layers', subs, w.subLabel),
      codeStat]
    : [stat('people', 'people', S.data.all.filter((m) => m.status === 'active').length, 'People', 'active in your places'),
      stat('places', 'layers', units.length, units.length === 1 ? 'Place you look after' : 'Places you look after', 'including the ones under them'),
      codeStat];
  return `${pageHead('Overview', `${v.org.name} on InneRISE, at a glance.`)}
    <section class="glass card company-card">
      <div class="company-main">${ring(KIND_CHOICES[v.org.kind] ? KIND_CHOICES[v.org.kind].icon : 'building', 'lg')}
        <div class="company-text">
          <h2 class="company-name">${esc(v.org.name)}</h2>
          <div class="chips">${status}${domains}</div>
          <p class="meta">${icon('clock')}<span>${esc(v.org.time_zone)}${tzName(v.org.time_zone) ? ` · ${esc(tzName(v.org.time_zone))}` : ''}</span></p>
        </div>
      </div>
      <div class="company-actions">${action}</div>
    </section>
    ${pending ? pendingCard() : ''}
    ${programCards()}
    ${label('At a glance')}
    <div class="stats${admin ? '' : ' stats-3'}">${stats.join('')}</div>
    ${label('Privacy')}
    <section class="glass card privacy">
      <h2 class="card-title">What you see / What you never see</h2>
      <p class="muted">InneRISE is built so ${esc(w.setting)} can support wellbeing without watching anyone.</p>
      <div class="privacy-cols">
        <div><h3 class="privacy-head">${ring('eye', 'sm')}What you see</h3>
          <ul class="ticks">${see.map((t) => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul></div>
        <div><h3 class="privacy-head">${ring('eyeoff', 'sm')}What you never see</h3>
          <ul class="ticks never">${never.map((t) => `<li>${icon('x')}<span>${esc(t)}</span></li>`).join('')}</ul></div>
      </div>
    </section>`;
}

// People -------------------------------------------------------------------------------------------
function roleText(r, units, w = words()) {
  const name = roleLabel(r.role, w);
  return r.unit_id ? `${name} · ${unitPath(r.unit_id, units) || 'a removed place'}` : name;
}
function sortPeople(list) {
  const me = S.user.id;
  return [...list].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1
    : (a.first_name || '￿').localeCompare(b.first_name || '￿', 'en', { sensitivity: 'base' })));
}
const personName = (m) => m.first_name || 'No name yet';

function peoplePage() {
  const w = words();
  const admin = amAdmin();
  const head = pageHead('People', admin ? w.sub.people : 'Everyone in the places you look after.',
    `<a class="btn btn-primary" href="${esc(sectionUrl('invites'))}" data-nav>${icon('plus')}<span>Invite people</span></a>`);
  const wait = pageBody(['view', 'people']);
  if (wait) return head + wait;
  const units = S.data.view.units || [];
  const p = S.data.people;
  const list = sortPeople(p.list);
  const me = S.user.id;
  const countText = `${num(list.length)}${p.more ? '+' : ''} ${list.length === 1 ? 'person' : 'people'}${p.unit ? ` in ${unitPath(p.unit, units)}` : ''}`;
  const rows = list.map((m) => {
    const isMe = m.user_id === me;
    const type = esc(typeLabel(m.member_type, w));
    const status = m.status === 'pending' ? '<span class="chip chip-wait">Waiting</span>' : '<span class="chip chip-ok"><span class="dot"></span>Active</span>';
    const unitChips = (m.units || []).map((u) => { const t = esc(unitPath(u.id, units) || u.name); return `<span class="chip" title="${t}"><span>${t}</span></span>`; }).join('');
    const roleChips = (m.roles || []).map((r) => { const t = esc(roleText(r, units, w)); return `<span class="chip chip-accent" title="${t}"><span>${t}</span></span>`; }).join('');
    return `<div class="row person" data-user="${esc(m.user_id)}">
      <div class="cell c-name"><span class="avatar${isMe ? ' me' : ''}" aria-hidden="true">${esc((personName(m)[0] || '?').toUpperCase())}</span>
        <div class="pname-wrap"><div class="pname">${isMe ? 'You' : esc(personName(m))}</div>
        <div class="psub">${isMe ? `${esc(personName(m))}<span class="m-only"> · ${type}</span>` : `<span class="m-only">${type}</span>`}</div></div></div>
      <div class="cell c-type">${type}</div>
      <div class="cell c-status">${status}</div>
      <div class="cell c-units${unitChips ? '' : ' empty'}">${unitChips || `<span class="muted">${esc(w.noUnit)}</span>`}</div>
      <div class="cell c-roles${roleChips ? '' : ' empty'}">${roleChips || '<span class="muted">—</span>'}</div>
      <div class="cell c-menu">${admin ? `<button class="icon-btn" data-act="person-menu" data-user="${esc(m.user_id)}" aria-haspopup="menu" aria-label="Actions for ${isMe ? 'you' : esc(personName(m))}">${icon('more')}</button>` : ''}</div>
    </div>`;
  }).join('');
  return `${head}
    <div class="toolbar">
      <label class="field-inline" for="people-filter"><span>Show</span>
        <select id="people-filter" class="input" data-change="people-filter">${unitOptions(units, p.unit, admin ? 'Everyone' : null)}</select></label>
      <span class="muted count">${esc(countText)}</span>
    </div>
    <section class="glass list people-list" aria-label="People">
      <div class="list-head" aria-hidden="true"><span>Name</span><span>Type</span><span>Status</span><span>${esc(w.units)}</span><span>Roles</span><span></span></div>
      ${rows || (p.unit
    ? emptyRow('pin', 'No one here yet', 'Make an invite code for this place. People who join with it show up here.')
    : emptyRow('people', 'No one has joined yet', 'Make an invite code and share it. People join from the InneRISE app, and show up here as they do.',
      `<a class="btn btn-sm" href="${esc(sectionUrl('invites'))}" data-nav>${icon('ticket')}<span>Make an invite code</span></a>`))}
    </section>
    ${p.more ? '<div class="more-wrap"><button class="btn" data-act="people-more">Show more people</button></div>' : ''}`;
}

function personMenu(m) {
  const w = words();
  const units = S.data.view.units || [];
  const isMe = m.user_id === S.user.id;
  const roles = m.roles || [];
  const has = (role) => roles.some((r) => r.role === role && !r.unit_id);
  const item = (act, text, extra = '', cls = '') => `<button class="menu-item ${cls}" role="menuitem" data-act="${act}" data-user="${esc(m.user_id)}" ${extra}>${esc(text)}</button>`;
  const off = (text) => `<button class="menu-item" role="menuitem" disabled aria-disabled="true">${esc(text)}</button>`;
  let out = '';
  if (m.can_be_admin) {
    if (has('admin')) {
      out += isMe ? '<p class="menu-note">You\'re an administrator. To stop, use Hand over and leave in Settings.</p>'
        : item('role-take', 'Remove administrator role', 'data-role="admin"', 'danger');
    } else {
      out += item('role-admin', 'Make administrator');
    }
    for (const def of w.roles) {
      if (def.unit) {
        out += item('role-unit', def.give, `data-role="${def.role}"`);
        for (const r of roles.filter((x) => x.role === def.role && x.unit_id)) {
          out += item('role-take', `Remove ${def.label.toLowerCase()} role · ${unitPath(r.unit_id, units) || 'a removed place'}`,
            `data-role="${def.role}" data-unit="${esc(r.unit_id)}"`, 'danger');
        }
      } else {
        out += has(def.role)
          ? item('role-take', `Remove ${def.label.toLowerCase()} role`, `data-role="${def.role}"`, 'danger')
          : item('role-give', def.give, `data-role="${def.role}"`);
      }
    }
    if (givesPrizes(currentOrg())) {
      if (!roles.some((x) => x.role === 'prize_redeemer' && !x.unit_id)) out += item('role-redeem', 'Give Can Redeem Prizes…');
      for (const r of roles.filter((x) => x.role === 'prize_redeemer')) {
        out += item('role-take', `Remove Can Redeem Prizes${r.unit_id ? ` · ${unitPath(r.unit_id, units) || 'a removed place'}` : ''}`,
          `data-role="prize_redeemer"${r.unit_id ? ` data-unit="${esc(r.unit_id)}"` : ''}`, 'danger');
      }
    }
  } else {
    out = off('Make administrator') + w.roles.map((def) => off(def.give)).join('') + (givesPrizes(currentOrg()) ? off('Give Can Redeem Prizes…') : '')
      + `<p class="menu-note">${m.status === 'pending' ? "People who are still waiting to join can't have a role yet." : "Only adults who aren't students can have a role."}</p>`;
  }
  return `<div class="menu-title">${isMe ? 'You' : esc(personName(m))}</div>${out}
    ${isMe ? '' : `<div class="menu-sep"></div>${item('member-remove', `Remove from ${w.org}`, '', 'danger')}`}`;
}

const findPerson = (id) => {
  const pools = [S.data.people && S.data.people.list, S.data.all].filter(Boolean);
  for (const pool of pools) { const m = pool.find((x) => x.user_id === id); if (m) return m; }
  return null;
};

async function afterPeopleChange(msg) {
  toast(msg);
  await refresh(['people', 'view'], ['all']);
}

// Units: locations & departments, or schools, grades & classrooms ----------------------------------
function addressLine(d) {
  if (!d) return '';
  const cityLine = [d.city, [d.region, d.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [d.street, cityLine, d.country ? countryName(d.country) : ''].filter(Boolean).join(', ');
}

// What this account may change in a place. The server checks again: administrators anything; a manager the
// places they look after and everything under them (removing needs the role above the place); a teacher can
// add and rename there.
function unitRights(u, units) {
  const o = currentOrg();
  if (isAdminOf(o)) return { add: true, rename: true, address: true, remove: true };
  const byId = new Map(units.map((x) => [x.id, x]));
  const chain = (id) => { const out = []; for (let x = byId.get(id), i = 0; x && i < 20; x = byId.get(x.parent_id), i++) out.push(x.id); return out; };
  const has = (roles, id) => { const up = id ? chain(id) : []; return unitRolesOf(o).some((r) => roles.includes(r.role) && up.includes(r.unit_id)); };
  return {
    add: has(['unit_manager', 'teacher'], u.id),
    rename: has(['unit_manager', 'teacher'], u.id),
    address: has(['unit_manager'], u.id),
    remove: has(['unit_manager'], u.parent_id),
  };
}

function placesPage() {
  const w = words();
  const admin = amAdmin();
  const head = pageHead(w.units, admin ? w.sub.units : 'The places you look after, and the places under them.', admin
    ? `<button class="btn btn-primary" data-act="unit-add" data-parent="">${icon('plus')}<span>Add at the top</span></button>` : '');
  const wait = pageBody(['view', 'details']);
  if (wait) return head + wait;
  const units = S.data.view.units || [];
  const det = new Map((S.data.details.units || []).map((u) => [u.id, u]));
  const orgTz = S.data.view.org.time_zone;
  const rows = unitTree(units).map(({ unit, depth }) => {
    const d = det.get(unit.id);
    const can = unitRights(unit, units);
    const anything = can.add || can.rename || can.remove || (can.address && ADDRESS_KINDS.includes(unit.kind));
    const isPlace = ADDRESS_KINDS.includes(unit.kind);
    const addr = isPlace ? addressLine(d) : '';
    const tz = isPlace && d && d.time_zone && d.time_zone !== orgTz ? `<span class="usub-line">${icon('clock')}${esc(d.time_zone)}</span>` : '';
    return `<div class="row unit" style="--depth:${Math.min(depth, 6)}" data-unit="${esc(unit.id)}">
      ${depth ? '<span class="branch" aria-hidden="true"></span>' : ''}${ring(KIND_ICON[unit.kind] || 'layers', 'sm')}
      <div class="unit-text">
        <div class="uname">${esc(unit.name)}</div>
        <div class="usub"><span>${KIND_LABEL[unit.kind] || unit.kind}</span><span class="sep">·</span><span>${plural(unit.people || 0, 'person', 'people')}</span></div>
        ${isPlace ? (addr ? `<span class="usub-line">${icon('pin')}${esc(addr)}</span>` : can.address ? `<button class="link-btn small" data-act="unit-address" data-unit="${esc(unit.id)}">Add address</button>` : '') : ''}
        ${tz}
      </div>
      ${anything ? `<button class="icon-btn" data-act="unit-menu" data-unit="${esc(unit.id)}" aria-haspopup="menu" aria-label="Actions for ${esc(unit.name)}">${icon('more')}</button>` : ''}
    </div>`;
  }).join('');
  return `${head}
    <section class="glass list tree" aria-label="${esc(w.units)}">
      ${rows || emptyRow(KIND_ICON[w.topKinds[0]] || 'layers', `No ${w.unitsLower} yet`, w.unitsEmpty)}
    </section>
    <p class="foot-note">${icon('people')}<span>People join a place with the invite code made for it. Counts show the people directly in each one.</span></p>`;
}

// The kinds that can go under a unit, and the words for adding one there.
const childKinds = (kind) => {
  const w = words();
  if (kind === 'region') return ['district', ...w.unitKinds];
  if (kind === 'district') return w.unitKinds;
  return w.childKinds[kind] || w.unitKinds;
};
const topKindsToAdd = () => [...words().unitKinds, ...AREA_KINDS];
function addHereLabel(kind) {
  const kinds = childKinds(kind);
  const shown = kinds.filter((k) => k !== kind).slice(0, 2);
  const names = (shown.length ? shown : kinds.slice(0, 1)).map((k) => (KIND_LABEL[k] || k).toLowerCase());
  return `Add ${article(names[0])}${names[1] ? ` or ${names[1]}` : ''} here`;
}

function unitMenu(u, can) {
  const items = [
    can.add && childKinds(u.kind).length > 0 && `<button class="menu-item" role="menuitem" data-act="unit-add" data-parent="${esc(u.id)}">${addHereLabel(u.kind)}</button>`,
    can.rename && `<button class="menu-item" role="menuitem" data-act="unit-rename" data-unit="${esc(u.id)}">Rename</button>`,
    can.address && ADDRESS_KINDS.includes(u.kind) && `<button class="menu-item" role="menuitem" data-act="unit-address" data-unit="${esc(u.id)}">Address and time zone</button>`,
  ].filter(Boolean).join('');
  const remove = can.remove ? `${items ? '<div class="menu-sep"></div>' : ''}<button class="menu-item danger" role="menuitem" data-act="unit-remove" data-unit="${esc(u.id)}">Remove</button>` : '';
  return `<div class="menu-title">${esc(u.name)}</div>${items}${remove}`;
}

// Invite codes -------------------------------------------------------------------------------------
function expiryText(iso) {
  const t = Date.parse(iso);
  const days = Math.ceil((t - Date.now()) / DAY);
  const date = new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days <= 1) return `Expires ${days <= 0 ? 'today' : 'tomorrow'} · ${date}`;
  return `Expires in ${days} days · ${date}`;
}

// Who this account may invite: administrators and managers anyone; a teacher students only.
function invitableTypes(w = words()) {
  const o = currentOrg();
  if (isAdminOf(o) || unitRolesOf(o).some((r) => r.role === 'unit_manager')) return w.inviteTypes;
  const students = w.inviteTypes.filter((t) => t === 'student');
  return students.length ? students : w.inviteTypes;
}

function invitesPage() {
  const w = words();
  const admin = amAdmin();
  const head = pageHead('Invite codes', w.sub.invites);
  const wait = pageBody(['view']);
  if (wait) return head + wait;
  const v = S.data.view;
  const units = v.units || [];
  const codes = v.invitations || [];
  const types = invitableTypes(w);
  const verified = v.org.status === 'active';
  const where = (u) => (u ? unitPath(u, units) || 'A removed place' : `Whole ${w.org}`);
  const nc = S.newCode;
  const newCard = nc ? `<section class="glass card new-code" aria-live="polite">
      <div class="new-code-text"><div class="new-code-label">New code</div>
        <div class="code-big" id="new-code">${esc(nc.code)}</div>
        <p class="muted">${esc(where(nc.unit))} · ${esc(typePlural(nc.type, w))} · up to ${plural(nc.uses, 'person', 'people')} · ${esc(expiryText(nc.expires))}</p></div>
      <div class="new-code-actions"><button class="btn btn-primary" data-act="code-copy" data-code="${esc(nc.code)}">${icon('copy')}<span>Copy</span></button>
        <button class="btn" data-act="new-code-done">Done</button></div>
    </section>` : '';
  const rows = codes.map((c) => `<div class="row code-row">
      <div class="code-main"><span class="code-mono">${esc(c.code)}</span>
        <span class="code-where">${icon(c.unit_id ? 'pin' : 'building')}<span>${esc(where(c.unit_id))}${w.inviteTypes.length > 1 ? ` · ${esc(typePlural(c.member_type, w))}` : ''}</span></span></div>
      <div class="code-meta"><span>${num(c.uses)} of ${num(c.max_uses)} used</span><span class="muted">${esc(expiryText(c.expires_at))}</span></div>
      <div class="code-actions"><button class="btn btn-sm" data-act="code-copy" data-code="${esc(c.code)}">${icon('copy')}<span>Copy</span></button>
        <button class="btn btn-sm btn-danger" data-act="code-close" data-code="${esc(c.code)}">Close</button></div>
    </div>`).join('');
  const who = types.length > 1
    ? `<label class="field"><span class="field-label">Who it's for</span><select id="inv-type" class="input" name="mtype">${types.map((t) => `<option value="${t}">${esc(typePlural(t, w))}</option>`).join('')}</select></label>`
    : `<div class="field"><span class="field-label">Who it's for</span><div class="static-value">${ring('people', 'xs')}${esc(typePlural(types[0], w))}</div>
        <input type="hidden" name="mtype" value="${esc(types[0])}"></div>`;
  return `${head}${verified ? '' : pendingCard()}${newCard}
    <div class="invite-grid">
      <section class="glass card">
        <h2 class="card-title">Create a code</h2>
        <form data-form="invite-create" data-keep="invite" class="stack" novalidate>
          <fieldset class="plain stack"${verified ? '' : ' disabled'}>
          <label class="field"><span class="field-label">Where they join</span>
            <select id="inv-unit" class="input" name="unit">${unitOptions(units, '', admin ? `Whole ${w.org}` : null)}</select></label>
          ${who}
          <div class="form-grid">
            <label class="field"><span class="field-label">How many people can use it</span>
              <input id="inv-uses" class="input" name="uses" type="number" inputmode="numeric" min="1" step="1" value="50">
              <span class="field-help">1 or more</span></label>
            <label class="field"><span class="field-label">Expires after (days)</span>
              <input id="inv-days" class="input" name="days" type="number" inputmode="numeric" min="1" max="90" step="1" value="14">
              <span class="field-help">1 to 90 days</span></label>
          </div>
          <p class="form-error" role="alert" hidden></p>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Create code</button></div>
          </fieldset>
          ${verified ? '' : '<p class="field-help">You can create codes once InneRISE has verified your organization.</p>'}
        </form>
      </section>
      <aside class="glass card howto">
        ${ring('ticket', 'lg')}
        <h2 class="card-title">${esc(w.joinTitle)}</h2>
        <p>In the InneRISE app: <strong>Protection → Organizations → Join with a code.</strong></p>
        <p class="muted">They see your ${esc(w.org)}'s name and confirmed email domain before they join, and they choose what to share.</p>
      </aside>
    </div>
    ${label('Open codes')}
    <section class="glass list codes" aria-label="Open codes">
      ${rows || (verified
    ? emptyRow('ticket', 'No open codes', 'Create one above and share it. Each code shows here until it is used up, expires or you turn it off.')
    : emptyRow('clock', 'No codes yet', `You can make codes once InneRISE has verified your ${w.org}.`))}
    </section>`;
}

// Approvals ----------------------------------------------------------------------------------------
// In a school or district, 13 to 17 year olds and children's accounts wait after joining with a code.
function approvalsPage() {
  const w = words();
  const edu = FAMILY[currentOrg().kind] === 'education';
  const head = pageHead('Approvals', `People waiting to join your ${w.org}.`);
  const wait = pageBody(['view', 'all']);
  if (wait) return head + wait;
  const units = S.data.view.units || [];
  const waiting = sortPeople(S.data.all.filter((m) => m.status === 'pending'));
  const rows = waiting.map((m) => {
    const places = (m.units || []).map((u) => unitPath(u.id, units) || u.name).join(', ');
    return `<div class="row wait-row" data-user="${esc(m.user_id)}"><span class="avatar" aria-hidden="true">${esc((personName(m)[0] || '?').toUpperCase())}</span>
      <div class="grow"><div class="uname">${esc(personName(m))}</div>
        <div class="usub">${esc(typeLabel(m.member_type, w))}${places ? ` · ${esc(places)}` : ''}</div></div>
      <span class="chip chip-wait">${icon('clock')}<span>Waiting</span></span></div>`;
  }).join('');
  return `${head}
    <section class="glass card explain-card">${ring('inbox')}
      <div class="stack-sm"><h2 class="card-title">Who waits here</h2>
        <p>${edu ? "Students aged 13 to 17, and children's InneRISE accounts, wait here after joining with a code, until a guardian or the school says yes."
    : 'People who joined but are still waiting show up here.'}</p>
        <p class="muted">Saying yes from the website comes in a later update. Until then, this list shows who is waiting.</p></div>
    </section>
    ${label(`Waiting (${num(waiting.length)})`)}
    <section class="glass list waiting" aria-label="Waiting to join">
      ${rows || emptyRow('check', 'No one is waiting', 'When someone needs a yes before they can join, they show up here.')}
    </section>`;
}

// Billing (076) ------------------------------------------------------------------------------------------------
// org_billing_view: the plan and status Stripe last reported for this organization, and the plans InneRISE offers its
// kind. "Choose a plan" and "Manage billing" open Stripe's own pages (the billing-checkout and billing-portal Edge
// Functions answer only their address). Prices, cards and invoices are only ever on Stripe; nothing is bought here:
// Stripe's signed messages record it, so a change can take a moment to show. Administrators and the billing contact only.
const isBillingContact = (m) => (m.roles || []).some((r) => r.role === 'billing_contact' && !r.unit_id);
const BILL_STATUS = {
  none: ['No plan yet', 'chip-wait', 'clock'], trialing: ['Trial', 'chip-ok', 'check'], active: ['Active', 'chip-ok', 'check'],
  past_due: ['Payment needed', 'chip-back', 'card'], canceled: ['Cancelled', 'chip-muted', 'x'], incomplete: ['Not finished', 'chip-wait', 'clock'],
};
const intervalWord = (i) => (i === 'year' ? 'Billed yearly' : 'Billed monthly');
const seatWord = (p) => (p.seat_based ? 'Per seat' : 'One price for the organization');
const KIND_PLURAL = { business: 'companies', school: 'schools', district: 'school districts', college: 'colleges', partner: 'partner businesses' };
const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: orgTz() }) : '');

function billingPage() {
  const o = currentOrg();
  const admin = amAdmin();
  const head = pageHead('Billing', `The InneRISE plan for ${o.name}. Prices, cards and invoices are on Stripe's secure pages, never here.`,
    `<button class="btn" data-act="bill-check">${icon('refresh')}<span>Check again</span></button>`);
  const wait = pageBody(admin ? ['billing', 'all'] : ['billing']);
  if (wait) return head + wait;
  const v = S.data.billing;
  if (v.missing) {
    return `${head}<section class="glass card plan-card"><div class="plan-top">${ring('card', 'lg')}<div class="plan-text"><div class="plan-label">Plan</div>
      <h2 class="company-name">${esc(o.name)}</h2></div></div>
      <div class="empty-inset">${ring('clock', 'sm')}<div><p class="empty-title">Billing isn't switched on yet</p>
        <p class="muted">InneRISE is switching on billing. There's nothing to pay until then, and nothing is switched off.</p></div></div></section>
      ${label('Billing contact')}${billingContact(o, admin)}`;
  }
  const b = v.billing;
  const [stText, stCls, stIcon] = BILL_STATUS[b.status] || BILL_STATUS.none;
  const kind = KIND_CHOICES[o.kind] || KIND_CHOICES.business;
  const subscribed = ['trialing', 'active', 'past_due'].includes(b.status);
  const reason = v.checkout.reason;
  // What Stripe last said.
  const planName = b.plan ? b.plan.name : b.plan_unknown ? 'A plan InneRISE no longer lists' : 'No plan yet';
  const end = dateOf(b.current_period_end);
  const rows = [
    b.plan && ['Billing', esc(`${intervalWord(b.plan.interval)} · ${seatWord(b.plan)}`)],
    b.plan && b.plan.seat_based && b.seats != null && ['Seats', esc(num(b.seats))],
    end && subscribed && [b.cancel_at_period_end ? 'Ends on' : b.status === 'trialing' ? 'Trial ends' : 'Renews on', esc(end)],
    b.last_paid_at && ['Last payment', esc(dateOf(b.last_paid_at))],
    b.updated_at && ['Last update from Stripe', esc(dateOf(b.updated_at))],
  ].filter(Boolean);
  const notes = [];
  if (b.status === 'past_due') {
    notes.push(['card', `Stripe couldn't take the last payment${b.payment_failed_at ? ` on ${dateOf(b.payment_failed_at)}` : ''}. Update the card in Manage billing and Stripe tries again.`]);
  } else if (b.payment_failed_at && subscribed && (!b.last_paid_at || b.payment_failed_at > b.last_paid_at)) {
    notes.push(['card', `A payment didn't go through on ${dateOf(b.payment_failed_at)}. Check the card in Manage billing.`]);
  }
  if (b.cancel_at_period_end && subscribed) notes.push(['calendar', `The subscription ends on ${end || 'the end of this period'}. To keep it, open Manage billing.`]);
  if (b.status === 'canceled') notes.push(['x', 'The subscription was cancelled. Choose a plan to start again.']);
  if (b.status === 'incomplete') notes.push(['clock', "The first payment wasn't finished. Choose a plan again, or finish it in Manage billing."]);
  if (b.plan_unknown) notes.push(['shield', "Stripe reports a plan InneRISE doesn't list anymore. Write to InneRISE and we'll sort it out."]);
  if (['past_due', 'canceled'].includes(b.status)) {
    notes.push(['shield', v.access === 'full' ? `Nothing is switched off for ${o.name} or its people while this is sorted out.`
      : `Some of InneRISE is limited for ${o.name} until billing is sorted out.`]);
  }
  const acts = [
    v.checkout.allowed && v.plans.length ? `<button class="btn btn-primary" data-act="bill-choose">${icon('card')}<span>Choose a plan</span></button>` : '',
    b.can_manage ? `<button class="btn${v.checkout.allowed ? '' : ' btn-primary'}" data-act="bill-manage">${icon('arrow')}<span>Manage billing</span></button>` : '',
  ].join('');
  const plan = `<section class="glass card plan-card">
      <div class="plan-top">${ring('card', 'lg')}
        <div class="plan-text"><div class="plan-label">Plan</div><h2 class="company-name">${esc(planName)}</h2>
          <div class="chips">${b.status === 'none' && !b.plan_unknown ? '' : `<span class="chip ${stCls}">${icon(stIcon)}<span>${esc(stText)}</span></span>`}<span class="chip">${icon(kind.icon)}<span>${esc(kind.title)}</span></span>
            ${o.status === 'active' ? '' : `<span class="chip chip-wait">${icon('clock')}<span>Being verified</span></span>`}</div></div></div>
      ${rows.length ? facts(rows) : ''}
      ${notes.map(([ic, t]) => `<div class="explain bill-note">${ring(ic, 'sm')}<p>${esc(t)}</p></div>`).join('')}
      ${acts ? `<div class="form-actions start bill-acts">${acts}</div>` : ''}
      ${acts ? `<p class="field-help">${b.can_manage ? 'Manage billing opens Stripe: the card, invoices, plan and seats.' : 'Choosing a plan opens Stripe\'s secure checkout, which shows the price before you pay.'} Changes show here once Stripe confirms them; use Check again if one hasn't.</p>` : ''}
    </section>`;
  // The plans for this kind of organization, or why there are none yet.
  let plans;
  if (!v.plans.length) {
    plans = `<section class="glass card bill-plans"><div class="empty-inset">${ring('card', 'sm')}<div>
        <p class="empty-title">No plans are available yet</p>
        <p class="muted">InneRISE hasn't added the plans for ${esc(KIND_PLURAL[o.kind] || 'organizations like yours')} yet. When it does, they show here and you can choose one. There's nothing to pay until then, and nothing is switched off.</p></div></div>
      <ul class="ticks bill-ready">
        <li>${icon('check')}<span>${esc(b.status === 'none' ? 'Everything you use now keeps working.' : 'Your current plan keeps working as Stripe reports it.')}</span></li>
        <li>${icon('check')}<span>${esc(admin && !(S.data.all || []).some((m) => m.status === 'active' && isBillingContact(m))
    ? 'Choose a billing contact below, so the right person can pay once plans are added.'
    : admin ? 'You and your billing contact can choose a plan here as soon as one is added.' : "You'll be able to choose a plan here as soon as one is added.")}</span></li>
        <li>${icon('check')}<span>Prices are shown on Stripe's secure checkout before anyone pays.</span></li>
      </ul></section>`;
  } else {
    const why = reason === 'not_verified' ? `InneRISE hasn't verified ${o.name} yet, so it can't subscribe yet. You can see the plans now.`
      : reason === 'already_subscribed' ? `To switch plans${b.plan && b.plan.seat_based ? ' or change seats' : ''}, use Manage billing.` : '';
    const rowsHtml = v.plans.map((p) => {
      const current = b.plan && b.plan.key === p.key && subscribed;
      return `<div class="row plan-row">${ring(p.interval === 'year' ? 'calendar' : 'card', 'sm')}
        <div class="grow"><div class="uname">${esc(p.name)}</div><div class="usub">${esc(`${intervalWord(p.interval)} · ${seatWord(p)}`)}</div></div>
        ${current ? `<span class="chip chip-ok">${icon('check')}<span>Your plan</span></span>`
    : v.checkout.allowed ? `<button class="btn btn-sm" data-act="bill-choose" data-plan="${esc(p.key)}">Choose</button>` : ''}</div>`;
    }).join('');
    plans = `<section class="glass card bill-plans"><h2 class="card-title">Plans for ${esc(KIND_PLURAL[o.kind] || 'your organization')}</h2>
      ${why ? `<p class="muted">${esc(why)}</p>` : ''}
      <div class="list inset">${rowsHtml}</div>
      <p class="field-help">The price of each plan is shown on Stripe's checkout before you pay.</p></section>`;
  }
  return `${head}${plan}${label('Plans')}${plans}${label('Billing contact')}${billingContact(o, admin)}
    <p class="foot-note">${icon('shield')}<span>Payments go through Stripe. InneRISE never sees or keeps card details, and keeps no prices: only the plan, its status, seats and dates that Stripe reports.</span></p>`;
}

function billingContact(o, admin) {
  let contact = '';
  if (!admin) {
    contact = `<section class="glass card billing-you">${ring('shield')}<div><h2 class="card-title">You're the billing contact</h2>
      <p class="muted">You look after paying for InneRISE at ${esc(o.name)}: choosing the plan here, and the card and invoices on Stripe through Manage billing.</p></div></section>`;
  } else {
    const me = S.user.id;
    const holders = sortPeople(S.data.all.filter((m) => m.status === 'active' && isBillingContact(m)));
    const list = holders.map((m) => `<div class="row admin-row"><span class="avatar${m.user_id === me ? ' me' : ''}" aria-hidden="true">${esc((personName(m)[0] || '?').toUpperCase())}</span>
      <div class="grow"><div class="uname">${m.user_id === me ? 'You' : esc(personName(m))}</div><div class="usub">Billing contact</div></div>
      <button class="btn btn-sm btn-danger" data-act="billing-remove" data-user="${esc(m.user_id)}">Remove</button></div>`).join('');
    contact = `<section class="glass card billing-contact">
      <h2 class="card-title">Billing contact</h2>
      <p class="muted">The person who looks after paying for InneRISE. They can open Billing here, choose the plan and manage it on Stripe; it gives them nothing else.</p>
      ${holders.length ? `<div class="list inset">${list}</div>` : `<div class="empty-inset">${ring('card', 'sm')}<div><p class="empty-title">No billing contact yet</p>
        <p class="muted">Until you choose one, only administrators can open Billing.</p></div></div>`}
      <div class="form-actions start"><button class="btn" data-act="billing-set">${icon('plus')}<span>${holders.length ? 'Add another billing contact' : 'Choose a billing contact'}</span></button></div>
    </section>`;
  }
  return contact;
}

function openChoosePlan(key) {
  const v = S.data.billing;
  const o = currentOrg();
  const pick = v.plans.find((p) => p.key === key) || null;
  const choices = pick ? [pick] : v.plans;
  const active = (S.data.all || []).filter((m) => m.status === 'active').length;
  openModal({
    title: pick ? `Choose ${esc(pick.name)}` : 'Choose a plan',
    body: `${pick ? '' : `<fieldset class="kind-choice"><legend class="field-label">Plan</legend><div class="kind-options">${choices.map((p, i) => `<label class="kind-opt">
        <input type="radio" name="plan" value="${esc(p.key)}"${i === 0 ? ' checked' : ''} data-seats="${p.seat_based ? '1' : '0'}">
        <span class="kind-card">${ring(p.interval === 'year' ? 'calendar' : 'card', 'sm')}<span class="kind-text"><strong>${esc(p.name)}</strong><small>${esc(`${intervalWord(p.interval)} · ${seatWord(p)}`)}</small></span></span></label>`).join('')}</div></fieldset>`}
      ${pick ? `<input type="hidden" name="plan" value="${esc(pick.key)}">${facts([['Billing', esc(intervalWord(pick.interval))], ['Charged', esc(seatWord(pick))]])}` : ''}
      <label class="field" data-seat-field><span class="field-label">Seats</span>
        <input class="input input-narrow" name="seats" type="number" inputmode="numeric" min="1" max="100000" step="1" placeholder="${active ? esc(String(active)) : 'Everyone'}">
        <span class="field-help">Leave it empty to count everyone who's active in ${esc(o.name)} now${active ? ` (${esc(plural(active, 'person', 'people'))})` : ''}. You can change seats later in Manage billing.</span></label>
      <p class="muted">Next is Stripe's secure checkout, which shows the price before you pay. You come back here afterwards.</p>`,
    submit: 'Continue to Stripe',
    onOpen: (form) => {
      const sync = () => {
        const el = form.querySelector('input[name=plan]:checked') || form.querySelector('input[name=plan]');
        const p = v.plans.find((x) => x.key === el.value);
        form.querySelector('[data-seat-field]').hidden = !(p && p.seat_based);
      };
      form.addEventListener('change', sync);
      sync();
    },
    onSubmit: async (form) => {
      const el = form.querySelector('input[name=plan]:checked') || form.querySelector('input[name=plan]');
      const p = v.plans.find((x) => x.key === el.value);
      let seats = null;
      if (p && p.seat_based) {
        const s = String(form.elements.seats.value || '').trim();
        if (s) {
          seats = Number(s);
          if (!Number.isInteger(seats) || seats < 1 || seats > 100000) throw new Error('Choose between 1 and 100,000 seats.');
        }
      }
      const url = await billing.checkout(org(), el.value, seats);
      location.assign(url);
      return true; // the page is leaving for Stripe
    },
  });
}

// Reports ------------------------------------------------------------------------------------------
// Counts only, per place, from org_report_places (082): the server never sends a count smaller than the organization's
// smallest group (it sends none, and "fewer than N" instead), nor a count that would let someone work one out by subtracting
// ("hidden"). The page shows what it is sent and never works a hidden number out.
const reportCount = (n, fewer, hidden, min) => (n != null ? `<span class="rcount">${num(n)}</span>`
  : hidden === 'protects' ? '<span class="rcount rcount-hidden">hidden</span>' : `<span class="rcount rcount-hidden">fewer than ${num(fewer || min)}</span>`);
function reportsPage() {
  const w = words();
  const admin = amAdmin();
  const head = pageHead('Reports', admin ? `How many people are in each part of your ${w.org}.` : 'How many people are in the places you look after.');
  const wait = pageBody(['placeCounts']);
  if (wait) return head + wait;
  const r = S.data.placeCounts;
  const min = r.min_group;
  const units = r.places || [];
  const whole = admin && r.scope !== 'places';
  const shown = (n, fewer, hidden) => reportCount(n, fewer, hidden, min);
  const rows = unitTree(units).map(({ unit, depth }) => `<div class="row report-row" style="--depth:${Math.min(depth, 6)}" data-unit="${esc(unit.id)}">
      <div class="report-name">${depth ? '<span class="branch" aria-hidden="true"></span>' : ''}${ring(KIND_ICON[unit.kind] || 'layers', 'xs')}
        <div class="unit-text"><div class="uname">${esc(unit.name)}</div><div class="usub">${esc(KIND_LABEL[unit.kind] || unit.kind)}</div></div></div>
      <div class="report-num" data-col="here"><span class="m-label">In this place</span>${shown(unit.direct, unit.direct_fewer_than, unit.direct_hidden)}</div>
      <div class="report-num" data-col="all"><span class="m-label">With places under it</span>${unit.has_children ? shown(unit.below, unit.below_fewer_than, unit.below_hidden) : '<span class="rcount muted">—</span>'}</div>
    </div>`).join('');
  // Administrators also see the people in no place yet (a small number there can hide the total).
  const unplaced = whole && units.length ? `<div class="row report-row report-unplaced" data-unit="">
      <div class="report-name">${ring('people', 'xs')}<div class="unit-text"><div class="uname">Not in a place yet</div><div class="usub">People who aren't in any place</div></div></div>
      <div class="report-num" data-col="here"><span class="m-label">In this place</span>${shown(r.not_placed, r.not_placed_fewer_than, r.not_placed_hidden)}</div>
      <div class="report-num" data-col="all"><span class="m-label">With places under it</span><span class="rcount muted">—</span></div>
    </div>` : '';
  // A manager or teacher gets no total: with one place on top, its count with the places under it is theirs.
  const ids = new Set(units.map((u) => u.id));
  const tops = units.filter((u) => !u.parent_id || !ids.has(u.parent_id));
  const tiles = whole
    ? [['people', 'Active members', shown(r.total_active, r.total_active_fewer_than, r.total_active_hidden), `in the whole ${w.org}`]]
    : [['people', 'People', tops.length === 1 ? (tops[0].has_children ? shown(tops[0].below, tops[0].below_fewer_than, tops[0].below_hidden)
      : shown(tops[0].direct, tops[0].direct_fewer_than, tops[0].direct_hidden)) : '<span class="rcount muted">—</span>',
    tops.length === 1 ? 'in the places you look after' : 'counted in each place below']];
  tiles.push(['layers', units.length === 1 ? 'Place' : 'Places', `<span class="rcount">${num(units.length)}</span>`, admin ? 'in total' : 'you look after']);
  tiles.push(['shield', 'Smallest group shown', `<span class="rcount">${num(min)}</span>`, 'people or more']);
  const floor = admin ? ' You can change the smallest group in Settings.' : '';
  return `${head}
    <div class="stats stats-3 report-tiles">${tiles.map(([ic, title, n, sub]) => `<div class="glass stat static">${ring(ic)}<span class="stat-num">${n}</span>
      <span class="stat-title">${esc(title)}</span><span class="stat-sub">${esc(sub)}</span></div>`).join('')}</div>
    ${label(`People in each ${admin ? 'place' : 'of your places'}`)}
    <section class="glass list report" aria-label="People in each place">
      ${units.length ? `<div class="list-head report-head" aria-hidden="true"><span>Place</span><span>In this place</span><span>With places under it</span></div>${rows}${unplaced}`
    : emptyRow('chart', 'Nothing to count yet', `Add your ${w.unitsLower} first. Then this shows how many people are in each one.`)}
    </section>
    <p class="foot-note">${icon('shield')}<span>Counts only: no names, and nothing about health, screen time or activity. A group smaller than ${num(min)} shows as "fewer than ${num(min)}", so no one can be picked out. A count that would let someone work out a smaller group by subtracting shows as "hidden". Someone in two places counts in each, and once in the places above them.${floor}</span>
      ${admin ? `<a class="link-btn small" href="${esc(sectionUrl('settings'))}" data-nav>${icon('gear')}<span>Open Settings</span></a>` : ''}</p>`;
}

// Bulk enrollment ----------------------------------------------------------------------------------
// One invite code for each place picked, made with org_invite_create and its usual limits. Nothing is emailed
// or sent: the person downloads the codes as a CSV file or prints them.
const ENROLL_MAX = 100;
const isoDay = (when, tz) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(when)); }
  catch { return new Date(when).toISOString().slice(0, 10); }
};
const niceDay = (when, tz) => {
  try { return new Date(when).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return isoDay(when, tz); }
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'organization';
// A spreadsheet cell: quoted when it has to be, and never read as a formula.
const csvCell = (x) => {
  let s = String(x ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function enrollCsv(r, tz) {
  const lines = [['place', 'code', 'uses', 'expires'], ...r.codes.map((c) => [c.place, c.code, c.uses, isoDay(c.expires, tz)])];
  return `﻿${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function enrollPage() {
  const w = words();
  const head = pageHead('Bulk enrollment', `Invite codes for many ${w.unitsLower} at once, one for each.`);
  const wait = pageBody(['view']);
  if (wait) return head + wait;
  const v = S.data.view;
  if (S.enroll) return head + enrollResults(S.enroll, v, w);
  const units = v.units || [];
  const verified = v.org.status === 'active';
  const types = invitableTypes(w);
  const picked = units.filter((u) => S.enrollPick.has(u.id)).length;
  const rows = unitTree(units).map(({ unit, depth }) => `<label class="pick-row" style="--depth:${Math.min(depth, 6)}">
      <input type="checkbox" id="pick-${esc(unit.id)}" value="${esc(unit.id)}"${S.enrollPick.has(unit.id) ? ' checked' : ''} data-change="enroll-pick">
      ${ring(KIND_ICON[unit.kind] || 'layers', 'xs')}<span class="pick-name">${esc(unit.name)}</span>
      <span class="pick-kind">${esc(KIND_LABEL[unit.kind] || unit.kind)}</span></label>`).join('');
  const who = types.length > 1
    ? `<label class="field"><span class="field-label">Who they're for</span><select id="enr-type" class="input" name="mtype">${types.map((t) => `<option value="${t}">${esc(typePlural(t, w))}</option>`).join('')}</select></label>`
    : `<div class="field"><span class="field-label">Who they're for</span><div class="static-value">${ring('people', 'xs')}${esc(typePlural(types[0], w))}</div>
        <input type="hidden" name="mtype" value="${esc(types[0])}"></div>`;
  return `${head}${verified ? '' : pendingCard()}
    <form data-form="enroll" data-keep="enroll" class="enroll-grid" novalidate>
      <section class="glass card enroll-places">
        <fieldset class="plain stack"${verified ? '' : ' disabled'}>
          <div class="card-head-row"><h2 class="card-title">1. Pick the places</h2>
            <span class="pick-tools"><button type="button" class="link-btn small" data-act="enroll-all">Select all</button>
              <button type="button" class="link-btn small" data-act="enroll-none">Clear</button></span></div>
          <p class="muted">Each place gets its own code, so people land in the right place when they join.</p>
          <div class="pick-list" role="group" aria-label="Places">${rows || emptyState('layers', `No ${w.unitsLower} yet`, `Add them in ${w.units} first. Each one can then get its own code here.`)}</div>
          <p class="pick-count muted" aria-live="polite">${picked ? `${plural(picked, 'place', 'places')} picked` : 'Nothing picked yet'}</p>
        </fieldset>
      </section>
      <section class="glass card enroll-codes">
        <fieldset class="plain stack"${verified ? '' : ' disabled'}>
          <h2 class="card-title">2. The codes</h2>
          ${who}
          <label class="field"><span class="field-label">How many people can use each code</span>
            <input id="enr-uses" class="input" name="uses" type="number" inputmode="numeric" min="1" step="1" value="40">
            <span class="field-help">1 or more</span></label>
          <label class="field"><span class="field-label">Expires after (days)</span>
            <input id="enr-days" class="input" name="days" type="number" inputmode="numeric" min="1" max="90" step="1" value="30">
            <span class="field-help">1 to 90 days</span></label>
          <p class="form-error" role="alert" hidden></p>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${picked ? `Create ${plural(picked, 'code', 'codes')}` : 'Create codes'}</button></div>
        </fieldset>
        <p class="field-help send-note">${icon('shield')}<span>Nothing is emailed or sent. You share the codes yourself: download them as a spreadsheet or print them.</span></p>
        ${verified ? '' : '<p class="field-help">You can create codes once InneRISE has verified your organization.</p>'}
      </section>
    </form>`;
}

function enrollResults(r, v, w) {
  const tz = v.org.time_zone;
  const rows = r.codes.map((c) => `<div class="row code-row enroll-row">
      <div class="code-main"><span class="code-mono">${esc(c.code)}</span>
        <span class="code-where">${icon('pin')}<span>${esc(c.place)}</span></span></div>
      <div class="code-meta"><span>Up to ${plural(c.uses, 'person', 'people')}</span><span class="muted">Expires ${esc(niceDay(c.expires, tz))}</span></div>
      <div class="code-actions"><button class="btn btn-sm" data-act="code-copy" data-code="${esc(c.code)}">${icon('copy')}<span>Copy</span></button></div>
    </div>`).join('');
  const failed = r.failed
    ? `<div class="notice glass notice-refused" role="alert">${ring('x', 'sm')}<p>${esc(r.failed.place)} got no code: ${esc(r.failed.message)}${r.failed.left > 1 ? ` The ${num(r.failed.left - 1)} after it weren't tried.` : ''}</p></div>`
    : '';
  return `<section class="glass card enroll-done" aria-live="polite">
      <div class="enroll-done-text">${ring('check', 'lg')}<div><h2 class="card-title">${plural(r.codes.length, 'code', 'codes')} ready</h2>
        <p class="muted">${esc(typePlural(r.type, w))}, one code for each place. Nothing has been emailed or sent: share them yourself.</p></div></div>
      <div class="enroll-actions"><button class="btn btn-primary" data-act="enroll-csv">${icon('download')}<span>Download CSV</span></button>
        <button class="btn" data-act="enroll-print">${icon('printer')}<span>Print</span></button>
        <button class="btn" data-act="enroll-done">Done</button></div>
    </section>
    ${failed}
    ${label('New codes')}
    <section class="glass list codes enroll-list" aria-label="New codes">${rows}</section>
    <div class="print-sheet">
      <h1 class="print-title">${esc(v.org.name)}: invite codes</h1>
      <p class="print-how">To join: open the InneRISE app, then Protection → Organizations → Join with a code.</p>
      <div class="print-codes">${r.codes.map((c) => `<div class="print-code"><div class="print-place">${esc(c.place)}</div>
        <div class="print-mono">${esc(c.code)}</div>
        <div class="print-meta">${esc(typePlural(r.type, w))} · up to ${plural(c.uses, 'person', 'people')} · expires ${esc(niceDay(c.expires, tz))}</div></div>`).join('')}</div>
    </div>`;
}

// Settings -----------------------------------------------------------------------------------------
function settingsPage() {
  const w = words();
  const head = pageHead('Settings', w.sub.settings);
  const wait = pageBody(['view', 'details', 'all']);
  if (wait) return head + wait;
  const v = S.data.view;
  const d = S.data.details;
  const all = S.data.all;
  const me = S.user.id;
  const admins = sortPeople(all.filter((m) => m.status === 'active' && (m.roles || []).some((r) => r.role === 'admin')));
  const otherAdmins = admins.filter((m) => m.user_id !== me);
  const othersIn = all.some((m) => m.user_id !== me);
  const canTakeOver = all.some((m) => m.user_id !== me && m.can_be_admin);
  const orgName = v.org.name;
  const domains = (d.domains || []).map((x) => `<div class="row domain-row">${ring('check', 'sm')}
      <div class="grow"><div class="uname">${esc(x)}</div><div class="usub">Verified</div></div>
      <button class="btn btn-sm btn-danger" data-act="domain-remove" data-domain="${esc(x)}">Remove</button></div>`).join('');
  let leave = '';
  if (!othersIn) {
    leave = `<p class="muted">You're the only person in ${esc(orgName)}. If you leave, it closes and its invite codes stop working.</p>
      <div class="form-actions start"><button class="btn btn-danger" data-act="leave">Leave and close ${w.org}</button></div>`;
  } else if (otherAdmins.length) {
    leave = `<p class="muted">Other administrators keep running ${esc(orgName)} if you leave.</p>
      <div class="form-actions start"><button class="btn btn-danger" data-act="leave">Leave ${w.org}</button></div>`;
  } else {
    leave = `<p class="muted">You're the only administrator. Before you leave, hand the role to someone who can take over.</p>
      <div class="form-actions start"><button class="btn" data-act="handover"${canTakeOver ? '' : ' disabled'}>Hand over and leave</button></div>
      ${canTakeOver ? '' : '<p class="field-help">No one can take over yet: it has to be an active adult member who isn\'t a student.</p>'}`;
  }
  return `${head}
    ${label(`${w.Org} details`)}
    <section class="glass card">
      <form data-form="profile" data-keep="profile" class="stack" novalidate>
        ${detailFields(d.org, { w, prefix: 'set', withName: true, withTz: true, nameLocked: d.org.name_locked })}
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save details</button></div>
      </form>
    </section>
    ${label('Email domain')}
    <section class="glass card">
      ${domainExplainer(w)}
      ${domains ? `<div class="list inset">${domains}</div>` : '<p class="muted">No confirmed domain yet.</p>'}
      <form data-form="domain-add" data-keep="domain" class="inline-form" novalidate>
        <label class="field grow"><span class="field-label">Add a domain</span>
          <input id="set-domain" class="input" name="domain" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="acme.com"></label>
        <button class="btn" type="submit">${icon('plus')}<span>Add domain</span></button>
        <p class="form-error" role="alert" hidden></p>
      </form>
    </section>
    ${label('Reports')}
    <section class="glass card">
      <form data-form="report-floor" data-keep="floor" class="inline-form" novalidate>
        <label class="field"><span class="field-label">Smallest group for reports</span>
          <input id="set-floor" class="input input-narrow" name="min_group" type="number" inputmode="numeric" min="3" max="50" step="1" value="${esc(v.org.min_report_group)}"></label>
        <button class="btn" type="submit">Save</button>
        <p class="field-help full">Reports never show a group with fewer people than this, so no one can be picked out. From 3 to 50.</p>
        <p class="form-error" role="alert" hidden></p>
      </form>
    </section>
    ${label('Administrators')}
    <section class="glass card">
      <div class="list inset">${admins.map((m) => `<div class="row admin-row"><span class="avatar${m.user_id === me ? ' me' : ''}" aria-hidden="true">${esc((personName(m)[0] || '?').toUpperCase())}</span>
        <div class="grow"><div class="uname">${m.user_id === me ? 'You' : esc(personName(m))}</div><div class="usub">${m.user_id === me ? `${esc(personName(m))} · ` : ''}Administrator</div></div></div>`).join('')}</div>
      <p class="field-help">To add an administrator, open People and choose Make administrator from a person's menu.</p>
      <div class="leave-box">${leave}</div>
    </section>`;
}

// Programs: Challenges & Competitions, Rewards, Workplace App Management / School Focus -------------------
// Challenges and Rewards run on 072 (org_challenge_*, org_reward_*): the same Challenges engine and rewards the app uses,
// inside the shared Organizations roles. A partner's Sponsored Challenges and Rewards & offers run on 074 (partner_*):
// the same engine and rewards again, with InneRISE reviewing each one first.
const METRIC = {
  steps: { name: 'Steps', what: 'steps', unit: 'steps', km: false },
  walk_run_distance: { name: 'Walking & running distance', what: 'walking and running', unit: 'km', km: true },
  cycling_distance: { name: 'Cycling distance', what: 'cycling', unit: 'km', km: true },
  floors: { name: 'Floors climbed', what: 'floors', unit: 'floors', km: false },
};
const DAY_LIMIT = { steps: 100000, walk_run_distance: 120000, cycling_distance: 400000, floors: 500 }; // a healthy day (039)
const SIDE_ORDER = ['region', 'district', 'location', 'department', 'team', 'school', 'campus', 'college', 'grade', 'classroom', 'program', 'group'];
const SIDE_WORD = { location: 'locations', department: 'departments', team: 'teams', school: 'schools', campus: 'campuses', grade: 'grades',
  classroom: 'classrooms', college: 'colleges', program: 'programs', group: 'groups', region: 'regions', district: 'districts' };
const kindWord = (k) => (KIND_LABEL[k] || k || 'group').toLowerCase();
const kindsWord = (k) => SIDE_WORD[k] || `${kindWord(k)}s`;
const EARNS = { winner: 'The winner', top_n: 'The top places', side: 'Everyone on the winning side', goal: 'Everyone who reaches the target',
  finish: 'Everyone who takes part' };
const childrenRules = (o = currentOrg()) => !!o && ['school', 'district'].includes(o.kind); // 072: a school or district
const verified = (o = currentOrg()) => !!o && o.status === 'active';
const canView = () => amAdmin() || myUnits().length > 0;
const wholeOrgCreator = (o = currentOrg()) => isAdminOf(o) || wholeOrgRole(o, 'challenge_coordinator');

function dayIn(tz, plus = 0) {
  const at = new Date(Date.now() + plus * DAY);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || LOCAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch { return at.toISOString().slice(0, 10); }
}
const orgTz = () => (S.data.view && S.data.view.org.time_zone) || (S.data.partner && S.data.partner.org.time_zone) || LOCAL_TZ;
const daysFrom = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const addDay = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const fmtDay = (d, year = false) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US',
  { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }) : '');
const fmtRange = (a, b) => `${fmtDay(a, a.slice(0, 4) !== b.slice(0, 4))} to ${fmtDay(b, true)}`;
const dec = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
// An amount in a metric's own unit (metres for distances, shown in km).
const amount = (metric, n) => ((METRIC[metric] || METRIC.steps).km ? `${dec(Number(n) / 1000)} km` : `${dec(n)} ${(METRIC[metric] || METRIC.steps).unit}`);
const score = (c, n) => (c.mode === 'total' ? amount(c.metric, n) : `${dec(n)} ${Number(n) === 1 ? 'day' : 'days'}`);
// A count the server floored ("fewer than 5", "at least 12") or an exact one.
const floored = (v) => (v == null ? '<span class="rcount muted">—</span>' : typeof v === 'number'
  ? `<span class="rcount">${num(v)}</span>` : `<span class="rcount rcount-hidden">${esc(String(v).charAt(0).toUpperCase() + String(v).slice(1))}</span>`);

function ruleText(c) {
  if (c.habit) return habitRuleText(c);
  const m = METRIC[c.metric] || METRIC.steps;
  const how = c.mode === 'goal' ? `Days at ${amount(c.metric, c.daily_goal)}` : c.mode === 'total' ? `Total ${m.what}` : `Active days (${m.what})`;
  const target = c.target == null ? 'No target' : c.mode === 'total' ? amount(c.metric, c.target) : `${num(c.target)} of ${num(c.days)} days`;
  return { how, target };
}
function phase(c, today) {
  if (c.status === 'cancelled') return 'cancelled';
  if (c.status === 'finished' || c.ends_on < today) return 'finished';
  return c.starts_on > today ? 'upcoming' : 'running';
}
function phaseChip(c, today) {
  const p = phase(c, today);
  if (p === 'cancelled') return '<span class="chip chip-muted"><span>Cancelled</span></span>';
  if (p === 'finished') {
    // 075: a staff-confirmed habit challenge stays running after its last day, until that day's 3-day window has closed.
    const waiting = c.status === 'active' && c.habit && c.habit.tracking === 'staff_confirmed';
    return `<span class="chip">${icon(waiting ? 'clock' : 'check')}<span>${c.status === 'finished' ? 'Finished' : waiting ? 'Ended: last days being confirmed' : 'Ended: results coming'}</span></span>`;
  }
  if (p === 'upcoming') {
    const n = daysFrom(today, c.starts_on);
    return `<span class="chip chip-accent">${icon('calendar')}<span>${n <= 1 ? 'Starts tomorrow' : `Starts in ${n} days`}</span></span>`;
  }
  return `<span class="chip chip-ok"><span class="dot"></span><span>Running · day ${daysFrom(c.starts_on, today) + 1} of ${c.days}</span></span>`;
}
const scopeName = (c, w = words()) => c.unit_name || `The whole ${w.org}`;
const facts = (list) => `<dl class="facts">${list.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const smallest = () => (S.data.view ? S.data.view.org.min_report_group : null);
// Someone has joined for sure: 072 counts who joined, so below the smallest group it reads "fewer than N" (maybe none).
const hasJoined = (c) => typeof c.joined === 'number' && c.joined > 0;
const joinedUnknown = (c) => typeof c.joined === 'string';
const countWords = (v) => (v == null ? '—' : typeof v === 'number' ? num(v) : String(v));
// org_challenge_list returns an exact joined count; show it with the report's rule so the two never disagree.
function joinedText(n) {
  if (n == null) return '—';
  if (typeof n !== 'number') return esc(n.charAt(0).toUpperCase() + n.slice(1));
  const floor = smallest() || 5;
  if (n === 0) return 'No one yet';
  return n < floor ? `Fewer than ${num(floor)}` : `About ${num(Math.round(n / 5) * 5)}`;
}

// Challenges -----------------------------------------------------------------------------------------
async function loadRewards(withTerms = false) {
  const list = await withHabits((await rpc.challengeList(S.orgId)) || []);
  const status = {};
  await Promise.all(list.filter((c) => c.status !== 'cancelled').map(async (c) => { status[c.id] = (await rpc.rewardStatus(c.id)).rewards || []; }));
  // Each prize's Prize Wallet terms (078), for the people who look after it. One that can't be read here shows no terms.
  const terms = {};
  if (withTerms) {
    const prizes = list.filter((c) => c.can_reward && c.status !== 'cancelled').flatMap((c) => (status[c.id] || []).filter((x) => x.kind === 'prize'));
    await Promise.all(prizes.map(async (x) => {
      try { terms[x.id] = await rpc.prizeTermsGet('reward', x.id); } catch (e) { if (e.code === 'signed_out') throw e; }
    }));
  }
  return { list, status, terms };
}
// What the overview's program cards say. A program that isn't switched on yet only loses its line, never the page.
async function loadSummary() {
  const o = currentOrg();
  const allowed = sectionsFor(o);
  const out = {};
  const soft = async (k, fn) => {
    try { out[k] = await fn(); } catch (e) { if (e.code === 'signed_out') throw e; out[k] = null; }
  };
  if (allowed.includes('sponsored') || allowed.includes('offers')) await soft('campaigns', async () => (await rpc.campaignList(S.orgId)).campaigns || []);
  if (allowed.includes('rewards')) await soft('rewards', loadRewards);
  else if (allowed.includes('challenges')) await soft('rewards', async () => ({ list: (await rpc.challengeList(S.orgId)) || [], status: {} }));
  if (allowed.includes('focus')) {
    await soft('focus', async () => {
      const [list, waiting] = await Promise.all([rpc.focusList(S.orgId), focusWaitingHere()]);
      return { schedules: list.schedules.length, waiting: waiting.length };
    });
  }
  return out;
}
async function loadCampaigns() {
  const list = (await rpc.campaignList(S.orgId)).campaigns || [];
  const details = {};
  await Promise.all(list.filter((c) => c.code_source === 'pool' && c.status !== 'withdrawn')
    .map(async (c) => { details[c.id] = await rpc.campaignDetails(c.id); }));
  // Prize Wallet terms (078) on rewards and offers, for administrators and rewards managers.
  const terms = {};
  if (prizeManagerOf(currentOrg())) {
    await Promise.all(list.filter((c) => c.kind === 'reward_offer' && c.status !== 'withdrawn').map(async (c) => {
      try { terms[c.id] = await rpc.prizeTermsGet('campaign', c.id); } catch (e) { if (e.code === 'signed_out') throw e; }
    }));
  }
  return { list, details, terms };
}
// Load what an action needs before its form opens (the page may still be loading).
async function ensure(keys) {
  for (const k of keys) if (S.data[k] == null) S.data[k] = await LOADERS[k]();
}

function challengesPage() {
  if (S.hbOpen) return sheetPage();
  const o = currentOrg();
  const w = words();
  const creator = wholeOrgCreator(o) || myUnits().length > 0;
  const open = verified(o);
  const lib = libraryOn(o) ? `<a class="btn" href="${esc(sectionUrl('library'))}" data-nav>${icon('book')}<span>Library</span></a>` : '';
  const head = pageHead('Challenges & Competitions', w.chSub,
    `${lib}${creator && open ? `<button class="btn btn-primary" data-act="ch-new">${icon('plus')}<span>Create a challenge</span></button>` : ''}`);
  const wait = pageBody([...(canView() ? ['challenges', 'view'] : ['challenges']), ...(maybeConfirmer(o) ? ['toConfirm'] : [])]);
  if (wait) return head + wait;
  const today = dayIn(orgTz());
  const list = S.data.challenges;
  const shown = S.chOpen && list.find((c) => c.id === S.chOpen);
  if (shown) return challengeDetail(shown, today);
  const groups = [['running', 'Running'], ['upcoming', 'Coming up'], ['finished', 'Finished'], ['cancelled', 'Cancelled']]
    .map(([p, title]) => [title, list.filter((c) => phase(c, today) === p)]).filter(([, l]) => l.length);
  const pending = open ? '' : `<section class="glass card pending-card" role="status">${ring('clock')}<div><h2 class="card-title">Being verified</h2>
    <p>Challenges start once InneRISE verifies ${esc(o.name)}. Until then, here is how they work.</p></div></section>`;
  const body = groups.length
    ? groups.map(([title, l]) => `${label(`${title} (${l.length})`)}<div class="ch-list">${l.map((c) => challengeCard(c, today)).join('')}</div>`).join('')
    : `<section class="glass list">${emptyRow('trophy', 'No challenges yet', `Create one for ${w.chScopes}, or start from a ready-made one in the library. People join from the InneRISE app, and their days count from then.`,
      `<div class="empty-acts">${creator && open ? `<button class="btn btn-sm" data-act="ch-new">${icon('plus')}<span>Create a challenge</span></button>` : ''}${libraryOn(o)
        ? `<a class="btn btn-sm" href="${esc(sectionUrl('library'))}" data-nav>${icon('book')}<span>Browse the library</span></a>` : ''}</div>`)}</section>`;
  return `${head}${pending}${toConfirmCard()}${body}${challengeRolesCard(w)}${challengePrivacyCard(w)}`;
}

function challengeCard(c, today) {
  const w = words();
  const r = ruleText(c);
  const p = phase(c, today);
  const editable = c.can_manage && c.status === 'active' && p !== 'finished';
  const rewards = (c.rewards || []).map((x) => `<span class="chip">${icon(x.kind === 'recognition' ? 'star' : 'gift')}<span>${esc(x.title)}</span></span>`).join('');
  const acts = [
    c.can_manage && p !== 'cancelled' ? `<button class="btn btn-sm" data-act="ch-open" data-ch="${esc(c.id)}">${icon('chart')}<span>${p === 'finished' ? 'Results' : 'Standings'}</span></button>` : '',
    editable ? `<button class="btn btn-sm" data-act="ch-edit" data-ch="${esc(c.id)}">${icon('edit')}<span>Edit</span></button>` : '',
    c.can_reward && p !== 'cancelled' ? `<a class="btn btn-sm" href="${esc(sectionUrl('rewards'))}" data-nav>${icon('gift')}<span>Rewards</span></a>` : '',
    (S.data.toConfirm || []).some((x) => x.id === c.id && !x.no_people_yet) ? `<button class="btn btn-sm" data-act="hb-open" data-ch="${esc(c.id)}">${icon('check')}<span>Confirm days</span></button>` : '',
  ].join('');
  return `<article class="glass card ch-card" data-challenge="${esc(c.id)}">
    <div class="ch-top">${ring(c.habit ? habitIcon(c) : c.metric === 'floors' ? 'stairs' : 'trophy')}
      <div class="ch-head"><h3 class="ch-title">${esc(c.title)}</h3>
        <div class="chips">${phaseChip(c, today)}<span class="chip">${icon(c.unit_id ? 'pin' : 'building')}<span>${esc(scopeName(c, w))}</span></span>
          ${c.sides ? `<span class="chip">${icon('flag')}<span>Sides: ${esc(SIDE_WORD[c.sides] || c.sides)}</span></span>` : ''}${shapeChips(c)}</div></div>
      ${editable ? `<button class="icon-btn" data-act="ch-menu" data-ch="${esc(c.id)}" aria-haspopup="menu" aria-label="More for ${esc(c.title)}">${icon('more')}</button>` : ''}
    </div>
    ${c.description ? `<p class="ch-desc">${esc(c.description)}</p>` : ''}
    ${facts([['Counts', esc(r.how)], c.habit && ['Counted by', esc(c.habit.label || HABIT_LABEL[c.habit.tracking])], ['Target', esc(r.target)], ['Dates', esc(fmtRange(c.starts_on, c.ends_on))], ['Joined', joinedText(c.joined)],
      c.final_of && ['Final round of', esc(c.final_of.title)]])}
    ${rewards ? `<div class="chips ch-rewards">${rewards}</div>` : ''}
    ${acts ? `<div class="ch-actions">${acts}</div>` : ''}
  </article>`;
}

function challengeDetail(c, today) {
  const w = words();
  const r = ruleText(c);
  const back = `<button class="link-btn back-link-btn" data-act="ch-back">${icon('back')}<span>All challenges</span></button>`;
  const top = `${pageHead(c.title, `${scopeName(c, w)} · ${fmtRange(c.starts_on, c.ends_on)}`,
    c.can_manage && c.status === 'active' && phase(c, today) !== 'finished' ? `<button class="btn" data-act="ch-edit" data-ch="${esc(c.id)}">${icon('edit')}<span>Edit</span></button>` : '')}
    <div class="detail-back">${back}</div>
    <section class="glass card ch-card ch-detail">
      <div class="chips">${phaseChip(c, today)}${c.sides ? `<span class="chip">${icon('flag')}<span>Sides: ${esc(SIDE_WORD[c.sides] || c.sides)}</span></span>` : ''}${shapeChips(c)}</div>
      ${c.description ? `<p class="ch-desc">${esc(c.description)}</p>` : ''}
      ${facts([['Counts', esc(r.how)], c.habit && ['Counted by', esc(c.habit.label || HABIT_LABEL[c.habit.tracking])], ['Target', esc(r.target)], ['Open to', esc(openTo(c.max_people))],
        c.final_of && ['Final round of', esc(c.final_of.title)], c.final_of && ['Who went through', esc(goesThrough(c.advance, c.advance_n, firstRound(c.final_of.id) || c.final_of))]])}
    </section>`;
  if (!c.can_manage) {
    return `${top}<section class="glass card explain-card">${ring('shield')}<div><p>Standings are for the people who run this challenge.
      You look after its rewards.</p></div></section>`;
  }
  const wait = pageBody(['chReport']);
  if (wait) return top + wait;
  const rep = S.data.chReport;
  const kids = rep.children_rules;
  if (rep.challenge && rep.challenge.id !== c.id) { delete S.data.chReport; return top + loading(); }
  const min = rep.min_group || smallest();
  // Counts arrive floored: "fewer than N" below the smallest group, rounded to the nearest 5 above it.
  const tiles = [['people', 'Joined', rep.joined], ['check', 'Took part', rep.took_part],
    ['star', 'Reached the target', rep.goal_met]].map(([ic, t, n]) => `<div class="glass stat static">${ring(ic)}
      <span class="stat-num">${n == null && t === 'Reached the target' && c.target == null ? '<span class="rcount muted">No target</span>' : floored(n)}</span><span class="stat-title">${esc(t)}</span>
      <span class="stat-sub">${typeof n === 'number' && n > 0 ? 'rounded to the nearest 5' : '&nbsp;'}</span></div>`).join('');
  let sides = '';
  const units = (S.data.view && S.data.view.units) || [];
  const groupName = (id) => ((units.find((u) => u.id === id) || (rep.groups || []).find((g) => g.id === id) || {}).name || '');
  const inGroup = (x) => (c.group_kind && x.group_id && x.place_in_group ? `${ordinal(x.place_in_group)} in ${groupName(x.group_id)}` : '');
  if (c.sides) {
    const best = Math.max(...rep.sides.map((s) => s.average || 0), 0);
    const finalAverages = rep.sides.some((s) => s.average != null);
    const people = (s) => (typeof s.people === 'number' ? `about ${num(s.people)} people` : esc(s.people));
    const rows = rep.sides.map((s) => `<div class="row side-row">
      <span class="place${s.place === 1 ? ' first' : ''}" aria-label="Place ${s.place}">${s.place}</span>
      <div class="grow"><div class="uname">${esc(unitPath(s.id, units) || s.name)}</div>${inGroup(s) ? `<div class="usub side-group">${esc(inGroup(s))}</div>` : ''}
        ${s.average != null ? `<div class="bar" aria-hidden="true"><span style="width:${best ? Math.max(4, Math.round((s.average / best) * 100)) : 0}%"></span></div>` : ''}</div>
      <div class="side-num">${s.average != null ? `<span class="rcount">${esc(score(c, s.average))}</span><span class="usub">per person · ${people(s)}</span>`
        : `<span class="usub">${people(s)}</span>`}</div></div>`).join('');
    sides = `${label('Sides')}<section class="glass list side-list" aria-label="Sides">${rows
      || emptyRow('flag', 'No side is ranked yet', `A side is ranked once at least ${min ? num(min) : 'the smallest group of'} people on it have joined, so no one can be picked out.`)}</section>
      <p class="foot-note">${icon('shield')}<span>Sides are ranked by the average per person on each${finalAverages ? '' : '; the averages show once the challenge is final'}. A side shows once it has at least ${min ? num(min) : 'the smallest group of'} people.</span></p>`;
  }
  let groups = '';
  if (c.group_kind) {
    const gw = kindWord(c.group_kind);
    const sw = c.sides ? kindsWord(c.sides) : 'sides';
    const people = (g) => (typeof g.people === 'number' ? `About ${num(g.people)} people` : esc(String(g.people).charAt(0).toUpperCase() + String(g.people).slice(1)));
    const cards = (rep.groups || []).map((g) => `<section class="glass card group-card" data-group="${esc(g.id)}" aria-label="${esc(g.name)}">
        <div class="group-head"><span class="place${g.place === 1 ? ' first' : ''}" aria-label="Place ${g.place}">${g.place}</span>
          <div class="grow"><h3 class="group-name">${esc(g.name)}</h3>
            <div class="usub">${people(g)}${g.average != null ? ` · ${esc(score(c, g.average))} per person` : ''}</div></div></div>
        ${g.sides.length ? `<div class="list inset group-sides">${g.sides.map((s) => `<div class="row group-side"><span class="place place-sm${s.place === 1 ? ' first' : ''}" aria-label="Place ${s.place} in ${esc(g.name)}">${s.place}</span>
          <div class="grow uname">${esc(s.name)}</div></div>`).join('')}</div>`
        : `<p class="muted group-none">No ${esc(kindWord(c.sides || 'side'))} in it is ranked yet.</p>`}
      </section>`).join('');
    groups = `${label(`By ${gw}`)}${cards ? `<div class="group-grid">${cards}</div>`
      : `<section class="glass list">${emptyRow(KIND_ICON[c.group_kind] || 'globe', `No ${gw} is ranked yet`, `A ${gw} is ranked once at least ${min ? num(min) : 'the smallest group of'} people in it have joined, so no one can be picked out.`)}</section>`}
      <p class="foot-note">${icon('shield')}<span>${esc(`Each ${gw} is ranked by the average per person in it, and shows its top 3 ${sw}, ranked within the ${gw}. A ${gw} shows once it has at least ${min ? num(min) : 'the smallest group of'} people${rep.groups && rep.groups.some((g) => g.average != null) ? '' : '; the averages show once the challenge is final'}.`)}</span></p>`;
  }
  const more = rep.named_total > (S.chNamed || rep.named).length;
  const named = S.chNamed || rep.named;
  const people = kids
    ? named.map((p) => `<div class="row result-row"><span class="avatar" aria-hidden="true">${esc((p.first_name || '?')[0].toUpperCase())}</span>
        <div class="grow uname">${esc(p.first_name)}</div>
        <div class="chips">${p.took_part ? `<span class="chip chip-ok">${icon('check')}<span>Took part</span></span>` : '<span class="chip chip-wait"><span>Not yet</span></span>'}
          ${p.goal_met ? `<span class="chip chip-accent">${icon('star')}<span>Reached the target</span></span>` : ''}</div></div>`).join('')
    : named.map((p) => `<div class="row result-row"><span class="place${p.place === 1 ? ' first' : ''}" aria-label="Place ${p.place}">${p.place}</span>
        ${inGroup(p) ? `<div class="grow"><div class="uname">${esc(p.first_name)}</div><div class="usub">${esc(inGroup(p))}</div></div>` : `<div class="grow uname">${esc(p.first_name)}</div>`}<span class="result-score">${esc(score(c, p.score))}</span></div>`).join('');
  const note = kids
    ? `Students' results show who took part and who reached the target. There are no places or scores for students.`
    : `Only adults who chose to share their challenge results with managers are named. People under 18 are never named. Everyone still counts in the totals and the sides.`;
  const countsNote = ` Counts are rounded to the nearest 5. A count under ${min ? num(min) : 'the smallest group'} reads "fewer than ${min ? num(min) : 'that'}", and one that could give away the few left out reads "at least".`;
  return `${top}<div class="stats stats-3 report-tiles">${tiles}</div>${groups}${sides}
    ${label(kids ? 'Who took part' : 'Standings')}
    <section class="glass list result-list${kids ? ' result-grid' : ''}" aria-label="${kids ? 'Who took part' : 'Standings'}">${people
      || emptyRow('people', kids ? 'No one has joined yet' : 'No one to name yet', kids ? 'Students who join show here.' : 'Adults who share their results with managers show here, with their place.')}</section>
    ${more ? `<div class="more-wrap"><button class="btn" data-act="ch-more">Show more</button></div>` : ''}
    <p class="foot-note">${icon('shield')}<span>${esc(note + countsNote)}</span></p>`;
}

function challengeRolesCard(w) {
  const edu = FAMILY[currentOrg().kind] === 'education';
  const rows = [
    ['crown', 'Administrators', 'Run any challenge, and approve every reward before it counts.'],
    ['trophy', 'Challenge coordinators', `Run challenges for the whole ${w.org}.`],
    ['layers', edu ? 'Leaders and teachers' : 'Managers', `Run challenges for the ${w.unitsLower} they look after.`],
    ['gift', 'Rewards managers', 'Set up rewards and give out prizes, for any challenge.'],
    ['scan', 'Can Redeem Prizes', `Confirm prizes at the counter, for the whole ${w.org} or one place and everything under it.`],
  ];
  return `${label('Who runs challenges')}<section class="glass card roles-card"><ul class="role-list">${rows.map(([ic, t, d]) => `<li>${ring(ic, 'sm')}
    <div><strong>${esc(t)}</strong><p class="muted">${esc(d)}</p></div></li>`).join('')}</ul>
    ${amAdmin() ? `<p class="field-help">Give these roles from a person's menu in People.</p>` : ''}</section>`;
}
function challengePrivacyCard(w) {
  const kids = childrenRules();
  const see = kids
    ? ['How many joined and took part', 'Who took part and who reached the target, by first name', `How each side is doing, once it has enough ${w.members}`]
    : ['How many joined, took part and reached the target', 'How each side is doing, once it has enough people', 'Places and first names of adults who share their results with managers'];
  const never = kids
    ? ["Students' places, scores or daily numbers", 'Health or activity records', 'Anything people save in InneRISE']
    : ['Anyone under 18 by name', "Anyone who chose not to share", 'Health or activity records, or daily numbers'];
  return `${label('Privacy')}<section class="glass card privacy"><h2 class="card-title">What you see / What you never see</h2>
    <div class="privacy-cols">
      <div><h3 class="privacy-head">${ring('eye', 'sm')}What you see</h3><ul class="ticks">${see.map((t) => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul></div>
      <div><h3 class="privacy-head">${ring('eyeoff', 'sm')}What you never see</h3><ul class="ticks never">${never.map((t) => `<li>${icon('x')}<span>${esc(t)}</span></li>`).join('')}</ul></div>
    </div></section>`;
}

// The rules part of a challenge form: shared by Challenges and Sponsored Challenges.
function ruleFields(v, { kids = false, locked = false } = {}) {
  const m = METRIC[v.metric] || METRIC.steps;
  const dis = locked ? ' disabled' : '';
  const shown = (n) => (n == null ? '' : m.km ? String(Number(n) / 1000) : String(n));
  const modes = [['participation', 'Active days: any activity counts'], ['goal', 'Days at a daily goal'], ...(kids ? [] : [['total', 'Total amount']])];
  return `<fieldset class="plain stack rule-fields"${dis}>
    <div class="form-grid">
      <label class="field"><span class="field-label">What counts</span><select class="input" name="metric">${Object.entries(METRIC)
        .map(([k, x]) => `<option value="${k}"${k === v.metric ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">How it's scored</span><select class="input" name="mode">${modes
        .map(([k, t]) => `<option value="${k}"${k === v.mode ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="field" data-show="goal"><span class="field-label">Daily goal (<span data-unit>${esc(m.unit)}</span>)</span>
        <input class="input" name="daily_goal" type="number" inputmode="decimal" min="0" step="any" value="${esc(shown(v.daily_goal))}"></label>
      <label class="field"><span class="field-label" data-target-label>Target</span>
        <input class="input" name="target" type="number" inputmode="decimal" min="0" step="any" value="${esc(v.mode === 'total' ? shown(v.target) : v.target ?? '')}" placeholder="No target"></label>
      <label class="field"><span class="field-label">Starts on</span><input class="input" name="starts_on" type="date" value="${esc(v.starts_on)}"></label>
      <label class="field"><span class="field-label">Days</span><input class="input" name="days" type="number" inputmode="numeric" min="1" max="365" step="1" value="${esc(v.days)}"></label>
    </div>
    <p class="field-help" data-rule-help></p>
    ${kids ? '<p class="field-help">With students, a challenge counts days: active days or days at a goal, never totals.</p>' : ''}
  </fieldset>`;
}
// Keep the rule fields in step with the choices: the daily goal only for "days at a goal", units for distances.
function wireRules(form) {
  const sync = () => {
    const f = form.elements;
    if (!f.metric) return;
    const m = METRIC[f.metric.value] || METRIC.steps;
    const mode = f.mode.value;
    form.querySelector('[data-show="goal"]').hidden = mode !== 'goal';
    form.querySelectorAll('[data-unit]').forEach((el) => { el.textContent = m.unit; });
    form.querySelector('[data-target-label]').textContent = mode === 'total' ? `Target (${m.unit}, optional)` : 'Target (days, optional)';
    const lim = DAY_LIMIT[f.metric.value];
    form.querySelector('[data-rule-help]').textContent = mode === 'goal'
      ? `A daily goal can be up to ${amount(f.metric.value, lim)}, a healthy day's limit.`
      : mode === 'total' ? `Everything people do adds up. A day counts up to ${amount(f.metric.value, lim)}.`
        : 'Every day with any activity counts as an active day.';
  };
  form.addEventListener('change', sync);
  sync();
}
// The rules as the server wants them: distances in metres, a daily goal only for "days at a goal".
function readRules(form) {
  const f = form.elements;
  const metric = f.metric.value;
  const mode = f.mode.value;
  const km = (METRIC[metric] || METRIC.steps).km;
  const val = (el, what, scaled) => {
    const s = String(el.value || '').trim().replace(/,/g, '');
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`Enter ${what} as a number.`);
    return scaled && km ? Math.round(n * 1000) : n;
  };
  const days = val(f.days, 'the number of days');
  if (days == null || !Number.isInteger(days)) throw new Error('Enter how many days it runs: a whole number from 1 to 365.');
  const goal = mode === 'goal' ? val(f.daily_goal, 'the daily goal', true) : null;
  if (mode === 'goal' && goal == null) throw new Error('Enter the daily goal.');
  const starts = String(f.starts_on.value || '').trim();
  if (!starts) throw new Error('Pick a start date.');
  return { metric, mode, daily_goal: goal, target: val(f.target, 'the target', mode === 'total'), starts_on: starts, days };
}

// Groups of sides and final rounds (072's org_challenge_shape, also for 075's habit challenges) ------------------------
// The kinds a side's places can be grouped by: the kinds of the places above them (regions above dealerships).
function groupKindsFor(sideKind, units = (S.data.view && S.data.view.units) || []) {
  if (!sideKind) return [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const found = new Set();
  for (const u of units.filter((x) => x.kind === sideKind)) {
    for (let p = byId.get(u.parent_id), i = 0; p && i < 20; p = byId.get(p.parent_id), i++) if (p.kind !== sideKind) found.add(p.kind);
  }
  return SIDE_ORDER.filter((k) => found.has(k));
}
function groupOptions(sideKind, sel) {
  const kinds = groupKindsFor(sideKind);
  if (sel && sideKind && sel !== sideKind && !kinds.includes(sel)) kinds.push(sel);
  return `<option value="">No groups: one ranking for all</option>${kinds
    .map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>Within each ${esc(kindWord(k))}</option>`).join('')}`;
}
// The finished challenges a final round can follow: this organization's, that I run.
const firstRounds = (except = null) => (S.data.challenges || []).filter((x) => x.can_manage && x.status === 'finished' && x.id !== except);
const firstRound = (id) => (id ? (S.data.challenges || []).find((x) => x.id === id) || null : null);
// Who goes through, in words: "The top 2 locations of each region".
function goesThrough(advance, n, first) {
  const each = first && first.group_kind ? ` of each ${kindWord(first.group_kind)}` : '';
  const one = advance === 'people' ? 'person' : first && first.sides ? kindWord(first.sides) : 'side';
  const many = advance === 'people' ? 'people' : first && first.sides ? kindsWord(first.sides) : 'sides';
  return `The top ${n === 1 ? one : `${num(n)} ${many}`}${each}`;
}
function advanceOptions(first, sel, kids) {
  const each = first && first.group_kind ? ` of each ${kindWord(first.group_kind)}` : '';
  const sides = !first || first.sides || first.unknown;
  return [sides && ['sides', `The top ${first && first.sides ? kindsWord(first.sides) : 'sides'}${each}, with everyone on them`],
    !kids && ['people', `The top people${each}`]].filter(Boolean)
    .map(([k, t]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
}
// The groups and final-round fields of a challenge form. edit: the challenge being changed (it can't follow itself).
function shapeFields(v, { kids = false, locked = false, edit = null } = {}) {
  const dis = locked ? ' disabled' : '';
  // With students a final takes the top sides only, so only a first round with sides can lead to one.
  const firsts = firstRounds(edit).filter((x) => !kids || x.sides);
  const fo = v.final_of ? v.final_of.id || v.final_of : '';
  if (fo && !firsts.some((x) => x.id === fo)) firsts.push({ id: fo, title: (v.final_of && v.final_of.title) || 'Its first round', unknown: true });
  const groupsShown = !!v.sides && (groupKindsFor(v.sides).length > 0 || !!v.group_kind);
  const groups = `<label class="field" data-show-groups${groupsShown ? '' : ' hidden'}><span class="field-label">Groups</span>
      <select class="input" name="group_kind">${groupOptions(v.sides, v.group_kind)}</select>
      <span class="field-help">Each side is also ranked within its group, and the results show each group's top 3. A reward can go to the best of each group.</span></label>`;
  const first = firsts.find((x) => x.id === fo) || firsts[0];
  const final = firsts.length ? `<fieldset class="plain stack final-fields"${dis}>
      <label class="field"><span class="field-label">Final round</span><select class="input" name="final_of">
        <option value="">No: open to everyone it's for</option>${firsts
        .map((x) => `<option value="${esc(x.id)}"${x.id === fo ? ' selected' : ''}>Final round of ${esc(x.title)}</option>`).join('')}</select></label>
      <div class="form-grid" data-show-final${fo ? '' : ' hidden'}>
        <label class="field"><span class="field-label">Who goes through</span><select class="input" name="advance">${advanceOptions(first, v.advance, kids)}</select></label>
        <label class="field"><span class="field-label">How many go through</span>
          <input class="input input-narrow" name="advance_n" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.advance_n ?? 2)}"></label>
      </div>
      <p class="field-help" data-final-help>A final round is open only to those who go through from a finished challenge.</p>
    </fieldset>` : '';
  return { groups, final };
}
// Keep the groups and final-round fields in step with the sides and the first round picked.
function wireShape(form, kids = childrenRules()) {
  const f = form.elements;
  const sync = (e) => {
    const box = form.querySelector('[data-show-groups]');
    if (box && f.sides && (!e || e.target === f.sides)) {
      const side = f.sides.value || null;
      f.group_kind.innerHTML = groupOptions(side, f.group_kind.value && f.group_kind.value !== side ? f.group_kind.value : null);
      box.hidden = !side || f.group_kind.options.length < 2;
    }
    if (!f.final_of) return;
    const id = f.final_of.value;
    const first = firstRound(id) || { id, unknown: true };
    if (!e || e.target === f.final_of) f.advance.innerHTML = advanceOptions(first, f.advance.value, kids);
    form.querySelector('[data-show-final]').hidden = !id;
    const n = Number(f.advance_n.value);
    const top = goesThrough(f.advance.value, Number.isInteger(n) && n > 0 ? n : 1, firstRound(id));
    const from = `in ${first.title || 'the first round'}`;
    form.querySelector('[data-final-help]').textContent = !id ? 'A final round is open only to those who go through from a finished challenge.'
      : f.advance.value === 'sides' ? `Everyone who took part on ${top.charAt(0).toLowerCase()}${top.slice(1)} ${from} can join. Ties at the cut all go through.`
        : `${top} ${from}, with a score above 0, can join. Ties at the cut all go through.`;
  };
  form.addEventListener('change', sync);
  form.addEventListener('input', (e) => { if (e.target === f.advance_n) sync(e); });
  sync();
}
// group_kind always (it's a rule); the final-round keys on a new challenge when it is one, and on an edit only when they change
// (the server checks them again only when one is sent).
function readShape(form, c = null) {
  const f = form.elements;
  const out = {};
  if (f.group_kind) {
    const box = form.querySelector('[data-show-groups]');
    out.group_kind = (box && !box.hidden && f.group_kind.value) || null;
  }
  if (f.final_of) {
    const fo = f.final_of.value || null;
    let adv = null;
    let n = null;
    if (fo) {
      adv = f.advance.value || null;
      const s = String(f.advance_n.value || '').trim();
      n = s ? Number(s) : null;
      if (s && !Number.isInteger(n)) throw new Error('Enter how many go through as a whole number.');
    }
    const was = c ? [c.final_of ? c.final_of.id : null, c.advance || null, c.advance_n ?? null] : [null, null, null];
    if (was[0] !== fo || was[1] !== adv || was[2] !== n) Object.assign(out, { final_of: fo, advance: adv, advance_n: n });
  }
  return out;
}
// The most people who can join: empty means no limit (072: null).
function readMax(form) {
  const s = String(form.elements.max_people.value || '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n)) throw new Error('Enter the most people who can join as a whole number, or leave it empty for no limit.');
  return n;
}
const maxField = (v, dis = '') => `<label class="field"><span class="field-label">Most people who can join (optional)</span>
      <input class="input input-narrow" name="max_people" type="number" inputmode="numeric" min="2" step="1" value="${esc(v.max_people ?? '')}" placeholder="No limit"${dis}>
      <span class="field-help">Leave it empty for no limit.</span></label>`;
const openTo = (n) => (n == null ? 'No limit' : `Up to ${num(n)} people`);
const shapeChips = (c) => `${c.group_kind ? `<span class="chip">${icon(KIND_ICON[c.group_kind] || 'globe')}<span>Groups: ${esc(kindsWord(c.group_kind))}</span></span>` : ''}${
  c.final_of ? `<span class="chip">${icon('trophy')}<span>Final round</span></span>` : ''}`;
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${num(n)}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function challengeForm(c) {
  const w = words();
  const o = currentOrg();
  const units = (S.data.view && S.data.view.units) || [];
  const locked = !!c && hasJoined(c);
  const maybe = !!c && !locked && joinedUnknown(c);
  const v = c || { metric: 'steps', mode: 'participation', days: 28, starts_on: dayIn(orgTz(), 1), max_people: null, unit_id: null, sides: null };
  const shape = shapeFields(v, { kids: childrenRules(o), locked, edit: c ? c.id : null });
  const scopes = [...(wholeOrgCreator(o) ? [['', `The whole ${w.org}`]] : []),
    ...unitTree(units).map(({ unit }) => [unit.id, unitPath(unit.id, units)])];
  if (c && c.unit_id && !scopes.some(([id]) => id === c.unit_id)) scopes.push([c.unit_id, c.unit_name || 'Its place']);
  const present = new Set(units.map((u) => u.kind));
  const kinds = SIDE_ORDER.filter((k) => (present.size ? present.has(k) : w.unitKinds.includes(k)));
  if (v.sides && !kinds.includes(v.sides)) kinds.push(v.sides);
  return `<label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="60" value="${esc(v.title || '')}" placeholder="${esc(w.chExample)}" data-autofocus></label>
    <label class="field"><span class="field-label">Description (optional)</span><textarea class="input" name="description" rows="2" maxlength="500">${esc(v.description || '')}</textarea></label>
    ${locked ? `<div class="explain">${ring('shield', 'sm')}<p>People have joined, so the rules are set. You can still change the name, the description and how many people can join.</p></div>` : ''}
    ${maybe ? '<p class="field-help">Once anyone joins, only the name, the description and how many people can join can change.</p>' : ''}
    <fieldset class="plain stack"${locked ? ' disabled' : ''}>
      <label class="field"><span class="field-label">Who it's for</span><select class="input" name="unit">${scopes
        .map(([id, t]) => `<option value="${esc(id)}"${(v.unit_id || '') === id ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        ${wholeOrgCreator(o) ? '' : `<span class="field-help">You can run challenges for the ${esc(w.unitsLower)} you look after.</span>`}</label>
      <label class="field"><span class="field-label">Sides</span><select class="input" name="sides"><option value="">No sides: everyone for themselves</option>${kinds
        .map((k) => `<option value="${k}"${k === v.sides ? ' selected' : ''}>${esc(KIND_LABEL[k])}s against each other</option>`).join('')}</select>
        <span class="field-help">With sides, people are on the side of the ${esc(w.unitsLower)} they're in. A side is ranked by its average per person.</span></label>
      ${shape.groups}
    </fieldset>
    ${ruleFields(v, { kids: childrenRules(o), locked })}
    ${shape.final}
    ${maxField(v)}`;
}

function openChallengeForm(c) {
  openModal({
    title: c ? `Edit ${esc(c.title)}` : 'Create a challenge',
    body: challengeForm(c),
    submit: c ? 'Save changes' : 'Create challenge',
    onOpen: (form) => { wireRules(form); wireShape(form); },
    onSubmit: async (form) => {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) throw new Error('Give the challenge a name.');
      let d = { title, description: f.description.value.trim() || null, max_people: readMax(form) };
      if (!(c && hasJoined(c))) d = { ...d, unit_id: f.unit.value || null, sides: f.sides.value || null, ...readShape(form, c), ...readRules(form) };
      if (c) {
        const res = await rpc.challengeEdit(c.id, d);
        toast(res.changed && res.changed.length ? `Saved ${title}.` : 'Nothing changed.');
      } else {
        await rpc.challengeCreate(org(), d);
        toast(`Created ${title}. People can join it in the InneRISE app.`);
      }
      await refresh(['challenges'], ['rewards', 'summary', 'chReport']);
    },
  });
}

// Rewards --------------------------------------------------------------------------------------------
function rewardsPage() {
  const o = currentOrg();
  const w = words();
  const kids = childrenRules(o);
  const wait = pageBody(canView() ? ['rewards', 'view', 'sponsorTerms'] : ['rewards', 'sponsorTerms']);
  const r = S.data.rewards;
  const addable = r ? r.list.filter((c) => c.can_reward && c.status !== 'cancelled') : [];
  const head = pageHead('Rewards', 'Rewards, incentives and prizes for your challenges.',
    `${libraryOn(o) ? `<a class="btn" href="${esc(sectionUrl('library'))}" data-nav>${icon('book')}<span>Library</span></a>` : ''}${addable.length
      ? `<button class="btn btn-primary" data-act="rw-new">${icon('plus')}<span>Add a reward</span></button>` : ''}`);
  if (wait) return head + wait;
  const today = dayIn(orgTz());
  const admin = amAdmin();
  const list = r.list.filter((c) => c.status !== 'cancelled');
  const waiting = admin ? list.flatMap((c) => (r.status[c.id] || []).filter((x) => !x.approved && !x.awarded_at).map((x) => [c, x])) : [];
  const approvals = waiting.length ? `<section class="glass card approve-card">
      <div class="card-head-row"><h2 class="card-title">Waiting for your approval</h2><span class="chip chip-wait"><span>${plural(waiting.length, 'reward', 'rewards')}</span></span></div>
      <p class="muted">A reward counts only once an administrator approves it. Check what it is and who earns it.</p>
      <div class="list inset">${waiting.map(([c, x]) => `<div class="row approve-row">${ring(x.kind === 'recognition' ? 'star' : 'gift', 'sm')}
        <div class="grow"><div class="uname">${esc(x.title)}</div><div class="usub">${esc(c.title)} · ${esc(earnsText(x, c))}</div></div>
        <button class="btn btn-sm btn-primary" data-act="rw-approve" data-reward="${esc(x.id)}">${icon('check')}<span>Approve</span></button></div>`).join('')}</div>
    </section>` : '';
  const cards = list.map((c) => rewardCard(c, r.status[c.id] || [], today)).join('');
  const rule = kids
    ? 'With students, rewards go to everyone who takes part, everyone who reaches the target, or the winning side: never to one winner or a top few.'
    : 'Rewards for the winner or the top places go to adults. People under 18 can still earn rewards for taking part, reaching the target or being on the winning side.';
  return `${head}${sponsorTermsCard()}${approvals}
    ${list.length ? `${label('By challenge')}<div class="ch-list">${cards}</div>`
    : `<section class="glass list">${emptyRow('gift', 'No challenges to reward yet', 'Rewards belong to a challenge. Create a challenge first, then add its rewards here.',
      sectionsFor(o).includes('challenges') ? `<a class="btn btn-sm" href="${esc(sectionUrl('challenges'))}" data-nav>${icon('trophy')}<span>Open Challenges</span></a>` : '')}</section>`}
    <p class="foot-note">${icon('shield')}<span>${esc(rule)} Codes go privately to the people who earn them, in the app; codes you add are never shown here again.</span></p>`;
}
// each_group (072): worked out within each group of the challenge; how many there are counts per group.
const eachWord = (c) => kindWord((c && c.group_kind) || 'group');
const earnsText = (x, c = null) => (x.earns === 'top_n' ? `The top ${num(x.top_n)}` : EARNS[x.earns] || x.earns)
  + (x.each_group ? ` · in each ${eachWord(c)}` : '') + (x.quantity ? ` · ${num(x.quantity)} available${x.each_group ? ` in each ${eachWord(c)}` : ''}` : '');

function rewardCard(c, rewards, today) {
  const admin = amAdmin();
  const terms = (S.data.rewards && S.data.rewards.terms) || {};
  const rows = rewards.map((x) => {
    const pt = terms[x.id];
    const st = x.awarded_at ? `<span class="chip chip-ok">${icon('check')}<span>${x.earned ? `Earned by ${esc(countWords(x.earned))}` : 'No one earned it'}</span></span>`
      : x.approved ? `<span class="chip chip-accent">${icon('check')}<span>Approved</span></span>` : '<span class="chip chip-wait"><span>Waiting for approval</span></span>';
    const kind = x.kind === 'recognition' ? 'Recognition: a badge or certificate in the app' : 'Prize';
    const codes = x.kind === 'prize' && (x.codes || !hasTerms(pt)) ? `<span class="usub-line">${icon('key')}<span>${x.codes ? `${plural(x.codes, 'code', 'codes')} added${x.codes_left != null ? ` · ${esc(countWords(x.codes_left))} not given out yet` : ''}` : 'No codes: hand it over in person'}</span></span>
      ${x.codes_short ? `<span class="usub-line warn-line">${icon('key')}<span>Someone who earned it is waiting for a code. Add more codes and it goes out to them.</span></span>` : ''}` : '';
    const people = x.awarded_at && x.people.length ? `<div class="list inset earned-list">${x.people.map((p) => `<div class="row earned-row">
        <span class="avatar" aria-hidden="true">${esc(p.first_name ? p.first_name[0].toUpperCase() : '·')}</span>
        <div class="grow"><div class="uname">${p.first_name ? esc(p.first_name) : p.under_18 ? 'Someone under 18' : 'Not named'}</div>
          <div class="usub">${p.claimed_at ? 'Claimed in the app' : p.given_at ? 'Handed over in person' : 'Not claimed yet'}</div></div>
        ${c.can_reward && p.claimed_at && !p.given_at ? `<button class="btn btn-sm" data-act="rw-given" data-earned="${esc(p.earned_id)}" data-name="${esc(p.first_name || '')}">Mark given</button>` : ''}
        ${p.given_at ? `<span class="chip chip-ok">${icon('check')}<span>Given</span></span>` : ''}</div>`).join('')}</div>` : '';
    const counts = x.awarded_at ? `<p class="usub reward-counts">Earned by ${esc(countWords(x.earned))} · claimed by ${num(x.claimed)} · given to ${num(x.given)}</p>` : '';
    const acts = [
      admin && !x.awarded_at && !x.approved ? `<button class="btn btn-sm btn-primary" data-act="rw-approve" data-reward="${esc(x.id)}">${icon('check')}<span>Approve</span></button>` : '',
      c.can_reward && !x.awarded_at ? `<button class="btn btn-sm" data-act="rw-edit" data-ch="${esc(c.id)}" data-reward="${esc(x.id)}">${icon('edit')}<span>Edit</span></button>` : '',
      c.can_reward && x.kind === 'prize' ? `<button class="btn btn-sm" data-act="rw-codes" data-reward="${esc(x.id)}">${icon('key')}<span>Add codes</span></button>` : '',
      pt !== undefined && !x.awarded_at ? `<button class="btn btn-sm" data-act="pt-edit" data-k="reward" data-target="${esc(x.id)}">${icon('tag')}<span>${hasTerms(pt) ? 'Prize terms' : 'Add prize terms'}</span></button>` : '',
      listCodes(pt) ? `<button class="btn btn-sm" data-act="pt-codes" data-k="reward" data-target="${esc(x.id)}">${icon('key')}<span>Upload business codes</span></button>` : '',
      (c.can_reward && !x.awarded_at) || (admin && x.approved && !x.awarded_at)
        ? `<button class="icon-btn" data-act="rw-menu" data-ch="${esc(c.id)}" data-reward="${esc(x.id)}" aria-haspopup="menu" aria-label="More for ${esc(x.title)}">${icon('more')}</button>` : '',
    ].join('');
    return `<div class="reward" data-reward="${esc(x.id)}">
      <div class="reward-top">${ring(x.kind === 'recognition' ? 'star' : 'gift', 'sm')}
        <div class="grow"><div class="uname">${esc(x.title)}</div><div class="usub">${esc(kind)} · ${esc(earnsText(x, c))}</div>
          ${x.description ? `<p class="reward-desc">${esc(x.description)}</p>` : ''}${codes}${termsLines(pt)}</div>${st}</div>
      ${counts}${people}
      ${acts ? `<div class="reward-actions">${acts}</div>` : ''}</div>`;
  }).join('');
  return `<article class="glass card ch-card reward-card" data-challenge="${esc(c.id)}">
    <div class="card-head-row"><div><h3 class="ch-title">${esc(c.title)}</h3><p class="usub">${esc(scopeName(c))} · ${esc(fmtRange(c.starts_on, c.ends_on))}</p></div>
      <div class="chips">${phaseChip(c, today)}</div></div>
    ${rows || `<div class="empty-inset">${ring('gift', 'sm')}<div><p class="empty-title">No rewards yet</p><p class="muted">Add a prize or recognition for this challenge.</p></div></div>`}
    ${c.can_reward ? `<div class="form-actions start"><button class="btn btn-sm" data-act="rw-new" data-ch="${esc(c.id)}">${icon('plus')}<span>Add a reward</span></button></div>` : ''}
  </article>`;
}

// Who can earn a reward in this challenge (072: sides need sides, "reaches the target" a target; students never one winner or a top few).
function earnsFor(c) {
  // A habit challenge (075): rewards for reaching the target or taking part only.
  if (c.habit) return ['goal', 'finish'].filter((k) => !(k === 'goal' && c.target == null));
  const kids = c.org_kind ? ['school', 'district'].includes(c.org_kind) : childrenRules();
  return Object.keys(EARNS).filter((k) => !(kids && ['winner', 'top_n'].includes(k)) && !(k === 'side' && !c.sides) && !(k === 'goal' && c.target == null));
}
function rewardForm(c, x, choices) {
  const v = x || { kind: 'prize', earns: earnsFor(c)[0] || 'finish' };
  return `${choices ? `<label class="field"><span class="field-label">Challenge</span><select class="input" name="ch" data-reward-ch>${choices
      .map((y) => `<option value="${esc(y.id)}"${y.id === c.id ? ' selected' : ''}>${esc(y.title)}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="80" value="${esc(v.title || '')}" placeholder="Team breakfast" data-autofocus></label>
    <label class="field"><span class="field-label">Description (optional)</span><textarea class="input" name="description" rows="2" maxlength="500">${esc(v.description || '')}</textarea></label>
    <fieldset class="kind-choice"><legend class="field-label">Kind</legend><div class="kind-options">
      ${[['prize', 'gift', 'Prize', 'Something people get: a voucher, a lunch, a day off'], ['recognition', 'star', 'Recognition', 'A badge or certificate in the app']]
        .map(([k, ic, t, s]) => `<label class="kind-opt"><input type="radio" name="kind" value="${k}"${k === v.kind ? ' checked' : ''}>
          <span class="kind-card">${ring(ic, 'sm')}<span class="kind-text"><strong>${t}</strong><small>${s}</small></span></span></label>`).join('')}</div></fieldset>
    <div class="form-grid">
      <label class="field"><span class="field-label">Who earns it</span><select class="input" name="earns" data-earns>${earnsOptions(c, v.earns)}</select></label>
      <label class="field" data-show="top_n"><span class="field-label">How many top places</span><input class="input" name="top_n" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.top_n || 3)}"></label>
      <label class="field"><span class="field-label">How many there are (optional)</span><input class="input" name="quantity" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.quantity ?? '')}" placeholder="No limit"></label>
    </div>
    ${eachGroupField(c, v.each_group)}
    <p class="field-help" data-earns-help></p>
    <p class="field-help">${amAdmin() ? 'You approve it next: a reward counts once an administrator approves it.' : 'An administrator approves every reward before it counts.'}${x && x.approved ? ' Saving changes sends it back for approval.' : ''}</p>`;
}
const earnsOptions = (c, sel) => earnsFor(c).map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(EARNS[k])}</option>`).join('');
// "In each region": only for a challenge whose sides are grouped.
const eachGroupHelp = (c) => `Worked out within each ${eachWord(c)}: the winner, the top places or the best side of each ${eachWord(c)}, and how many there are counts per ${eachWord(c)}. People outside every ${eachWord(c)} don't earn it.`;
const eachGroupField = (c, on) => `<label class="pick-row each-group" data-each-group${c && c.group_kind ? '' : ' hidden'}><input type="checkbox" name="each_group"${on ? ' checked' : ''}>
      <span class="pick-text"><span class="pick-name" data-each-label>In each ${esc(eachWord(c))}</span><small data-each-help>${esc(eachGroupHelp(c))}</small></span></label>`;
function syncEachGroup(form, c) {
  const box = form.querySelector('[data-each-group]');
  if (!box) return;
  box.hidden = !(c && c.group_kind);
  box.querySelector('[data-each-label]').textContent = `In each ${eachWord(c)}`;
  box.querySelector('[data-each-help]').textContent = eachGroupHelp(c);
}
const readEachGroup = (form) => { const box = form.querySelector('[data-each-group]'); return !!(box && !box.hidden && form.elements.each_group.checked); };
function wireReward(form, pool) {
  const sync = () => {
    const f = form.elements;
    form.querySelector('[data-show="top_n"]').hidden = f.earns.value !== 'top_n';
    const c = pool.find((y) => y.id === (f.ch ? f.ch.value : pool[0].id)) || pool[0];
    const kids = ['school', 'district'].includes(c.org_kind);
    form.querySelector('[data-earns-help]').textContent = c.habit
      ? "A habit challenge's rewards go to everyone who reaches the target or everyone who takes part."
      : kids ? 'With students, rewards go to everyone who takes part, everyone who reaches the target, or the winning side.'
        : !c.sides ? 'A reward for the winning side needs a challenge with sides.' : '';
    syncEachGroup(form, c);
  };
  form.addEventListener('change', (e) => {
    if (e.target.matches('[data-reward-ch]')) {
      const c = pool.find((y) => y.id === e.target.value);
      form.elements.earns.innerHTML = earnsOptions(c, form.elements.earns.value);
    }
    sync();
  });
  sync();
}
function openRewardForm(c, x, choices = null) {
  const pool = choices || [c];
  openModal({
    title: x ? `Edit ${esc(x.title)}` : 'Add a reward',
    body: rewardForm(c, x, choices),
    submit: x ? 'Save changes' : 'Add reward',
    onOpen: (form) => wireReward(form, pool),
    onSubmit: async (form) => {
      const f = form.elements;
      const ch = f.ch ? f.ch.value : c.id;
      const title = f.title.value.trim();
      if (!title) throw new Error('Give the reward a name.');
      const int = (el) => { const s = String(el.value || '').trim(); if (!s) return null; const n = Number(s); if (!Number.isInteger(n)) throw new Error('Use whole numbers.'); return n; };
      const d = { title, description: f.description.value.trim() || null, kind: f.kind.value, earns: f.earns.value,
        top_n: f.earns.value === 'top_n' ? int(f.top_n) : null, quantity: int(f.quantity), each_group: readEachGroup(form) };
      await rpc.rewardSet(ch, x ? x.id : null, d);
      toast(amAdmin() ? `Saved ${title}. Approve it to make it count.` : `Saved ${title}. It's waiting for an administrator to approve it.`);
      await refresh(['rewards'], ['challenges', 'summary']);
    },
  });
}
const findReward = (id) => {
  const r = S.data.rewards;
  for (const c of (r && r.list) || []) { const x = (r.status[c.id] || []).find((y) => y.id === id); if (x) return [c, x]; }
  return [null, null];
};

// Challenge & Rewards Library, and habit challenges (075) --------------------------------------------------------
// The library (org_library_*): InneRISE's ready-made templates for this kind of organization, and the organization's own.
// "Use template" makes a challenge on 072's engine (org_library_use), a habit challenge, or for a partner a draft Sponsored
// Challenge that InneRISE reviews (074); a reward template adds a reward that an administrator approves, as always (072).
// Habit challenges (org_habit_*) count reading, wellness or a positive habit, by a self check-in or confirmed by a teacher
// or manager: always shown with 075's own words (org_habit_label), and never called "verified". A phone-or-watch
// challenge is shown as that, not with 075's device label.
const HABIT_LABEL = { self_checkin: 'Self check-in: the person taps Done for the day', staff_confirmed: 'Confirmed by a teacher or manager' };
const DEVICE_WORDS = 'Steps, distance or floors from a phone or watch';
const countedBy = (tracking, label) => (tracking === 'device' ? 'A phone or watch' : label || HABIT_LABEL[tracking] || '');
const HABITS = { reading: ['Reading', 'book', 'Days of reading'], wellness: ['Wellness', 'heart', 'Days of wellness'],
  positive_habit: ['A positive habit', 'spark', 'Days of the habit'] };
const HABIT_MODES = [['participation', 'Days done'], ['goal', 'Days done, toward a target']];
const AGES = [['adults', 'Adults'], ['teens', 'Teens'], ['children', 'Children']];
const habitIcon = (c) => (HABITS[c.habit.kind] || HABITS.positive_habit)[1];
const localToday = () => dayIn(LOCAL_TZ); // the person's own date, as the app sends it (075 checks it is today somewhere)
const libraryOn = (o = currentOrg()) => sectionsFor(o).includes('library');
const templateSaver = (o = currentOrg()) => isAdminOf(o) || wholeOrgRole(o, 'challenge_coordinator');
const challengeMaker = (o = currentOrg()) => o.kind === 'partner' ? isAdminOf(o) || hasRoleIn(o, 'challenge_coordinator')
  : sectionsFor(o).includes('challenges') && (wholeOrgCreator(o) || myUnits().length > 0);
// A teacher (for a classroom, grade, program or group) or, in a business, a unit manager confirms habit days (075). The
// server decides; this only says whether to ask it.
const maybeConfirmer = (o = currentOrg()) => o.kind !== 'partner'
  && rolesOf(o).some((r) => r.unit_id && r.role === (o.kind === 'business' ? 'unit_manager' : 'teacher'));
const confirmHelp = (edu = FAMILY[currentOrg().kind] === 'education') => (edu
  ? "Each class's teacher confirms the days: on the day, or up to 3 days after it. Students can't mark them."
  : "The manager of each person's team confirms the days: on the day, or up to 3 days after it. Managers only see adults who share their challenge results with managers.");
const TRACKING_HELP = {
  device: 'Each person\'s phone or watch counts it. Nothing is typed in.',
  self_checkin: 'People tap Done in the InneRISE app on each day they do it, for that day only.',
};

// 072's list doesn't know habits: org_habit_about adds what each habit challenge counts and how.
async function withHabits(list) {
  const ids = (list || []).filter((c) => c.metric == null).map((c) => c.id).slice(0, 500);
  if (!ids.length) return list || [];
  let about = [];
  try { about = (await rpc.habitAbout(ids)) || []; } catch (e) { if (e.code === 'signed_out') throw e; about = []; }
  const by = new Map(about.map((x) => [x.challenge_id, x.habit]));
  return list.map((c) => (by.has(c.id) ? { ...c, habit: by.get(c.id) } : c));
}
function habitRuleText(c) {
  const days = (HABITS[c.habit.kind] || HABITS.positive_habit)[2];
  return { how: c.mode === 'goal' ? `${days}, toward a target` : days, target: c.target == null ? 'No target' : `${num(c.target)} of ${num(c.days)} days` };
}

// The habit challenges this person confirms here, today (their own date).
async function loadToConfirm() {
  try {
    return ((await rpc.habitToConfirm(localToday())) || []).filter((c) => c.org_id === S.orgId);
  } catch (e) {
    if (e.code === 'signed_out') throw e;
    return [];
  }
}
// One day's sheet, every page of it.
async function loadSheet() {
  let day = S.hbDay || null;
  if (!day) { const c = findChallenge(S.hbOpen); if (c && c.ends_on < localToday()) day = c.ends_on; }
  const first = await rpc.habitSheet(S.hbOpen, day, localToday(), 0, 500);
  const people = [...(first.people || [])];
  for (let i = 0; i < 9 && people.length < (first.people_total || 0); i++) {
    const next = await rpc.habitSheet(S.hbOpen, first.day, localToday(), people.length, 500);
    if (!(next.people || []).length) break;
    people.push(...next.people);
  }
  return { ...first, people };
}

function toConfirmCard() {
  const list = S.data.toConfirm || [];
  if (!list.length) return '';
  const edu = FAMILY[currentOrg().kind] === 'education';
  const rows = list.map((c) => {
    const ended = c.ends_on < c.today;
    const where = c.unit_name || `The whole ${words().org}`;
    const nobody = ended ? (edu ? 'None of your students took part' : 'No one in your team took part')
      : (edu ? 'None of your students have joined yet' : 'No one in your team has joined yet');
    const sub = c.no_people_yet ? `${where} · ${nobody}`
      : ended ? `${where} · Ended ${fmtDay(c.ends_on)} · its last days can be confirmed until ${fmtDay(addDay(c.ends_on, 3))}`
        : `${where} · ${num(c.confirmed_today)} of ${plural(c.people, 'person', 'people')} confirmed today`;
    const act = c.no_people_yet
      ? `<span class="chip">${icon('clock')}<span>${ended ? 'Nothing to confirm' : 'Waiting for people to join'}</span></span>`
      : `<button class="btn btn-sm btn-primary" data-act="hb-open" data-ch="${esc(c.id)}">${icon('check')}<span>Confirm days</span></button>`;
    return `<div class="row hb-row${c.no_people_yet ? ' is-waiting' : ''}" data-ch="${esc(c.id)}">${ring(habitIcon(c), 'sm')}
    <div class="grow"><div class="uname">${esc(c.title)}</div><div class="usub">${esc(sub)}</div></div>${act}</div>`;
  }).join('');
  return `<section class="glass card hb-card">
    <div class="card-head-row"><h2 class="card-title">Days to confirm</h2><span class="chip">${icon('check')}<span>${esc(HABIT_LABEL.staff_confirmed)}</span></span></div>
    <p class="muted">${esc(confirmHelp())}</p>
    <div class="list inset">${rows}</div></section>`;
}

// The confirm screen: one challenge, one day in the window, the confirmer's own people.
function sheetPage() {
  const back = `<div class="detail-back"><button class="link-btn back-link-btn" data-act="hb-back">${icon('back')}<span>All challenges</span></button></div>`;
  const known = (S.data.toConfirm || []).find((x) => x.id === S.hbOpen) || findChallenge(S.hbOpen);
  const title = known ? known.title : 'Confirm days';
  const wait = pageBody(['hbSheet']);
  if (wait) return `${pageHead(`Confirm days: ${title}`, HABIT_LABEL.staff_confirmed)}${back}${wait}`;
  const sh = S.data.hbSheet;
  const c = sh.challenge;
  const today = localToday();
  const days = [];
  for (let d = sh.window.from; d <= sh.window.to && days.length < 5; d = addDay(d, 1)) days.push(d);
  const dayName = (d) => (d === today ? 'Today' : d === addDay(today, -1) ? 'Yesterday' : fmtDay(d));
  const picker = `<fieldset class="plain"><legend class="field-label">Day</legend><div class="pill-options day-pick">${days.reverse().map((d) => `<label class="pill-opt">
      <input type="radio" name="hb-day" value="${d}"${d === sh.day ? ' checked' : ''} data-change="hb-day"><span class="pill">${icon('calendar')}<span>${esc(dayName(d))}</span></span></label>`).join('')}</div></fieldset>`;
  const counted = sh.people.filter((p) => p.counts);
  const done = counted.filter((p) => p.confirmed).length;
  const people = sh.people.map((p) => `<label class="pill-opt hb-person${p.counts ? '' : ' is-off'}">
      <input type="checkbox" name="members" value="${esc(p.user_id)}"${p.confirmed ? ' checked' : ''}${p.counts ? '' : ' disabled'} data-was="${p.confirmed ? '1' : '0'}">
      <span class="pill">${icon('check')}<span>${esc(p.first_name)}</span>${p.counts ? '' : '<small>Joined later</small>'}</span></label>`).join('');
  const body = sh.people.length
    ? `<form data-form="hb-save" class="stack" novalidate>
        <div class="card-head-row"><h2 class="card-title">${esc(fmtDay(sh.day, true))}</h2><span class="chip${done ? ' chip-ok' : ''}">${icon('check')}<span>${num(done)} of ${num(counted.length)} done</span></span></div>
        <p class="muted">Tap each person who did it on this day, then save. Tap again to take one back.</p>
        <div class="pill-options hb-people">${people}</div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions start"><button class="btn btn-primary" type="submit">${icon('check')}<span>Save this day</span></button>
          <button class="btn" type="button" data-act="hb-all">Everyone did it</button></div></form>`
    : emptyState('people', 'No one to confirm yet', FAMILY[c.org_kind] === 'education'
      ? 'Students in your classes show here once they join the challenge in the InneRISE app.'
      : 'People in your team show here once they join the challenge and share their challenge results with managers.');
  const windowText = `A day can be confirmed on the day and up to 3 days after it, within the challenge's dates (${fmtRange(c.starts_on, c.ends_on)}). Its results are final once its last day has had those 3 days.`;
  const ended = c.ends_on < today
    ? `<div class="explain hb-ended">${ring('clock', 'sm')}<p>${esc(`It ended on ${fmtDay(c.ends_on, true)}. Its last days can be confirmed until ${fmtDay(addDay(c.ends_on, 3), true)}; then its results are final.`)}</p></div>` : '';
  return `${pageHead(`Confirm days: ${c.title}`, `${c.unit_name || `The whole ${words().org}`} · ${HABIT_LABEL.staff_confirmed}`)}${back}
    <section class="glass card hb-sheet">${ended}${picker}${body}</section>
    <p class="foot-note">${icon('shield')}<span>${esc(`${windowText} You see only your own people and the days staff confirmed for them: never a score, a place, a self check-in or anything from their phone.`)}</span></p>`;
}

// The challenge form's first question: how days are counted (a phone or watch, a self check-in, or confirmed by staff).
function trackingChoice(tracking, { fixed = false, habitsOnly = false } = {}) {
  const opts = [...(habitsOnly ? [] : [['device', 'trophy', 'Phone or watch', DEVICE_WORDS]]),
    ['self_checkin', 'check', 'Self check-in', HABIT_LABEL.self_checkin], ['staff_confirmed', 'people', 'Confirmed by staff', HABIT_LABEL.staff_confirmed]];
  return `<fieldset class="kind-choice tracking-choice"${fixed ? ' disabled' : ''}><legend class="field-label">How days are counted</legend><div class="kind-options kind-options-3">${opts
    .map(([k, ic, t, sub]) => `<label class="kind-opt"><input type="radio" name="tracking" value="${k}"${k === tracking ? ' checked' : ''}>
      <span class="kind-card">${ring(ic, 'sm')}<span class="kind-text"><strong>${esc(t)}</strong><small>${esc(sub)}</small></span></span></label>`).join('')}</div></fieldset>
    <p class="field-help" data-tracking-help>${esc(tracking === 'staff_confirmed' ? confirmHelp() : TRACKING_HELP[tracking])}</p>`;
}

// A habit challenge's form: new, from a template, or an edit (rules set once anyone joined).
function habitForm(v, { edit = false, locked = false, template = null } = {}) {
  const w = words();
  const o = currentOrg();
  const units = (S.data.view && S.data.view.units) || [];
  const scopes = [...(wholeOrgCreator(o) ? [['', `The whole ${w.org}`]] : []), ...unitTree(units).map(({ unit }) => [unit.id, unitPath(unit.id, units)])];
  if (v.unit_id && !scopes.some(([id]) => id === v.unit_id)) scopes.push([v.unit_id, v.unit_name || 'Its place']);
  const present = new Set(units.map((u) => u.kind));
  const kinds = SIDE_ORDER.filter((k) => (present.size ? present.has(k) : w.unitKinds.includes(k)));
  if (v.sides && !kinds.includes(v.sides)) kinds.push(v.sides);
  const dis = locked ? ' disabled' : '';
  const fixedHabit = locked || !!template;
  const shape = shapeFields(v, { kids: childrenRules(o), locked, edit: edit ? v.id : null });
  return `<label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="60" value="${esc(v.title || '')}" placeholder="${esc(FAMILY[o.kind] === 'education' ? 'Reading every day' : 'Lunch walk')}" data-autofocus></label>
    <label class="field"><span class="field-label">Description (optional)</span><textarea class="input" name="description" rows="2" maxlength="500">${esc(v.description || '')}</textarea></label>
    ${locked ? `<div class="explain">${ring('shield', 'sm')}<p>People have joined, so the rules are set. You can still change the name, the description and how many people can join.</p></div>` : ''}
    ${edit && !locked && joinedUnknown(v) ? '<p class="field-help">Once anyone joins, only the name, the description and how many people can join can change.</p>' : ''}
    ${template ? `<div class="explain">${ring('book', 'sm')}<p>From the library. What it counts and how days are counted come from the template; change anything else before you start it.</p></div>` : ''}
    ${edit || template ? trackingChoice(v.tracking, { fixed: fixedHabit, habitsOnly: true }) : ''}
    <fieldset class="plain stack"${fixedHabit ? ' disabled' : ''}>
      <label class="field"><span class="field-label">The habit</span><select class="input" name="habit">${Object.entries(HABITS)
        .map(([k, [t]]) => `<option value="${k}"${k === v.habit ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <span class="field-help">Each day is done or not. Nothing else about it is kept: no titles, notes or minutes.</span></label>
    </fieldset>
    <fieldset class="plain stack"${dis}>
      <label class="field"><span class="field-label">Who it's for</span><select class="input" name="unit">${scopes
        .map(([id, t]) => `<option value="${esc(id)}"${(v.unit_id || '') === id ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        ${wholeOrgCreator(o) ? '' : `<span class="field-help">You can run challenges for the ${esc(w.unitsLower)} you look after.</span>`}</label>
      <label class="field"><span class="field-label">Sides</span><select class="input" name="sides"><option value="">No sides: everyone for themselves</option>${kinds
        .map((k) => `<option value="${k}"${k === v.sides ? ' selected' : ''}>${esc(KIND_LABEL[k])}s against each other</option>`).join('')}</select>
        <span class="field-help">With sides, people are on the side of the ${esc(w.unitsLower)} they're in. A side is ranked by its average days per person.</span></label>
      ${shape.groups}
      <div class="form-grid">
        <label class="field"><span class="field-label">How it's scored</span><select class="input" name="mode">${HABIT_MODES
          .map(([k, t]) => `<option value="${k}"${k === v.mode ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label" data-target-label>Target (days)</span>
          <input class="input" name="target" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.target ?? '')}" placeholder="No target"></label>
        <label class="field"><span class="field-label">Starts on</span><input class="input" name="starts_on" type="date" value="${esc(v.starts_on)}"></label>
        <label class="field"><span class="field-label">Days</span><input class="input" name="days" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.days)}"></label>
      </div>
    </fieldset>
    ${shape.final}
    ${maxField(v)}`;
}
function wireHabit(form) {
  const sync = () => {
    const f = form.elements;
    if (!f.mode) return;
    form.querySelector('[data-target-label]').textContent = f.mode.value === 'goal' ? 'Target (days)' : 'Target (days, optional)';
    const help = form.querySelector('[data-tracking-help]');
    const tr = form.querySelector('input[name=tracking]:checked');
    if (help && tr) help.textContent = tr.value === 'staff_confirmed' ? confirmHelp() : TRACKING_HELP[tr.value];
  };
  form.addEventListener('change', sync);
  sync();
}
// The shared fields of a habit form, as 075 wants them.
function readHabit(form, { rules = true, c = null } = {}) {
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) throw new Error('Give the challenge a name.');
  const d = { title, description: f.description.value.trim() || null, max_people: readMax(form) };
  if (!rules) return d;
  const shape = readShape(form, c);
  const days = Number(String(f.days.value || '').trim());
  if (!String(f.days.value || '').trim() || !Number.isInteger(days)) throw new Error('Enter how many days it runs, as a whole number.');
  const t = String(f.target.value || '').trim();
  const target = t ? Number(t) : null;
  if (t && !Number.isInteger(target)) throw new Error('Enter the target as a whole number of days.');
  if (f.mode.value === 'goal' && target == null) throw new Error('Set the target: how many days count toward it.');
  const starts = String(f.starts_on.value || '').trim();
  if (!starts) throw new Error('Pick a start date.');
  return { ...d, unit_id: f.unit.value || null, sides: f.sides.value || null, ...shape, mode: f.mode.value, target, starts_on: starts, days };
}

// "Create a challenge": a phone-or-watch challenge (072's form, as it is) or a habit challenge (075), chosen first. Changing
// the choice keeps the name, description, place, sides, dates and size typed so far.
function openNewChallenge(tracking = 'device', carry = {}) {
  const base = { title: '', description: '', unit_id: null, sides: null, starts_on: dayIn(orgTz(), 1), days: 28, max_people: '', ...carry };
  const habit = tracking !== 'device';
  openModal({
    title: 'Create a challenge',
    body: `${trackingChoice(tracking)}${habit ? habitForm({ habit: 'reading', mode: 'participation', tracking, ...base })
      : challengeForm({ metric: 'steps', mode: 'participation', ...base })}`,
    submit: 'Create challenge',
    onOpen: (form) => {
      if (habit) wireHabit(form); else wireRules(form);
      wireShape(form);
      form.querySelectorAll('input[name=tracking]').forEach((r) => r.addEventListener('change', () => {
        const f = form.elements;
        const keep = { title: f.title.value, description: f.description.value, unit_id: f.unit.value || null, sides: f.sides.value || null,
          group_kind: (f.group_kind && f.group_kind.value) || null, starts_on: f.starts_on.value, days: f.days.value, max_people: f.max_people.value };
        openNewChallenge(r.value, keep);
      }));
    },
    onSubmit: async (form) => {
      const f = form.elements;
      if (habit) {
        const d = { ...readHabit(form), habit: f.habit.value, tracking };
        await rpc.habitCreate(org(), d);
        toast(`Created ${d.title}. People can join it in the InneRISE app.`);
      } else {
        const title = f.title.value.trim();
        if (!title) throw new Error('Give the challenge a name.');
        const d = { title, description: f.description.value.trim() || null, max_people: readMax(form), unit_id: f.unit.value || null, sides: f.sides.value || null,
          ...readShape(form), ...readRules(form) };
        await rpc.challengeCreate(org(), d);
        toast(`Created ${title}. People can join it in the InneRISE app.`);
      }
      await refresh(['challenges'], ['rewards', 'summary', 'chReport', 'toConfirm']);
    },
  });
}

function openHabitEdit(c) {
  const locked = hasJoined(c);
  openModal({
    title: `Edit ${esc(c.title)}`,
    body: habitForm({ ...c, habit: c.habit.kind, tracking: c.habit.tracking }, { edit: true, locked }),
    submit: 'Save changes',
    onOpen: (form) => { wireHabit(form); wireShape(form); },
    onSubmit: async (form) => {
      const d = locked ? readHabit(form, { rules: false })
        : { ...readHabit(form, { c }), habit: form.elements.habit.value, tracking: form.elements.tracking.value };
      const res = await rpc.habitEdit(c.id, d);
      toast(res.changed && res.changed.length ? `Saved ${d.title}.` : 'Nothing changed.');
      await refresh(['challenges'], ['rewards', 'summary', 'chReport', 'toConfirm']);
    },
  });
}

// The library page ----------------------------------------------------------------------------------------------
function libraryPage() {
  const o = currentOrg();
  const w = words();
  const partner = o.kind === 'partner';
  const saver = templateSaver(o) && !partner;
  const head = pageHead('Challenge & Rewards Library', partner
    ? 'Ready-made Sponsored Challenges. Make a draft from one, change it, then send it to InneRISE for review.'
    : `Ready-made challenges and rewards from InneRISE, and ${o.name}'s own. Use one as it is, or change it first.`,
  saver ? `<button class="btn" data-act="lib-save">${icon('plus')}<span>Save your own</span></button>` : '');
  const wait = pageBody(canView() ? ['library', 'view'] : ['library']);
  if (wait) return head + wait;
  const f = S.libFilter || {};
  const sel = (name, opts, cur) => `<select class="input" name="${name}" data-change="lib-filter" aria-label="${esc(opts[0][1])}">${opts
    .map(([k, t]) => `<option value="${k}"${(cur || '') === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const filters = `<div class="lib-filters">
    ${partner ? '' : sel('what', [['', 'Challenges and rewards'], ['challenge', 'Challenges'], ['reward', 'Rewards']], f.what)}
    ${sel('age', [['', 'Every age group'], ...AGES.map(([k, t]) => [k, t])], f.age)}
    ${partner ? '' : sel('counted', [['', 'Any way of counting'], ['device', 'A phone or watch'], ['habit', 'Any habit'],
      ['self_checkin', HABIT_LABEL.self_checkin], ['staff_confirmed', HABIT_LABEL.staff_confirmed]], f.counted)}</div>`;
  const list = S.data.library.templates || [];
  const own = list.filter((t) => t.own);
  const ours = list.filter((t) => !t.own);
  const pending = verified(o) || partner ? '' : `<section class="glass card pending-card" role="status">${ring('clock')}<div><h2 class="card-title">Being verified</h2>
    <p>You can browse now. Templates can be used once InneRISE verifies ${esc(o.name)}.</p></div></section>`;
  const filtered = !!(f.what || f.age || f.counted);
  const ownBlock = own.length ? `${label(`Your templates (${own.length})`)}<div class="ch-list tpl-list">${own.map(templateCard).join('')}</div>`
    : saver && !filtered ? `${label('Your templates')}<section class="glass list">${emptyRow('book', 'None saved yet',
      `Save a challenge you've run, or a reward you give often, so anyone running challenges at ${o.name} can use it again.`,
      `<button class="btn btn-sm" data-act="lib-save">${icon('plus')}<span>Save your own</span></button>`)}</section>` : '';
  const oursBlock = ours.length ? `${label(`From InneRISE (${ours.length})`)}<div class="ch-list tpl-list">${ours.map(templateCard).join('')}</div>`
    : filtered ? '' : `${label('From InneRISE')}<section class="glass list">${emptyRow('book', 'Nothing here yet', 'Templates InneRISE adds for your kind of organization show here.')}</section>`;
  const none = filtered && !own.length && !ours.length ? `<section class="glass list">${emptyRow('book', 'Nothing matches these filters',
    'Try another age group or way of counting.', `<button class="btn btn-sm" data-act="lib-clear">Show everything</button>`)}</section>` : '';
  return `${head}${pending}${filters}${none}${ownBlock}${oursBlock}
    <p class="foot-note">${icon('shield')}<span>${esc(partner
    ? 'Templates hold no prices, codes or brands. A draft made from one goes to InneRISE for review before anyone sees it.'
    : `Templates hold no prices, codes or brands. Every challenge made from one follows the same rules as any other${childrenRules(o) ? ', including the rules for students' : ''}, and every reward still waits for an administrator's approval.`)}</span></p>`;
}

function templateFacts(t) {
  if (t.kind === 'reward') {
    return facts([['Kind', t.reward_kind === 'recognition' ? 'Recognition' : 'Prize'],
      ['Who earns it', esc(t.earns === 'top_n' ? `The top ${num(t.top_n)}` : EARNS[t.earns] || t.earns)],
      ['How many', t.quantity ? num(t.quantity) : 'No limit'], ['Habit challenges', t.fits_habits ? 'Fits them too' : 'Not for habit challenges']]);
  }
  const what = t.tracking === 'device' ? (METRIC[t.metric] || METRIC.steps).name : (HABITS[t.habit] || HABITS.positive_habit)[0];
  const how = t.tracking === 'device'
    ? (t.mode === 'goal' ? `Days at ${amount(t.metric, t.daily_goal)}` : t.mode === 'total' ? `Total ${(METRIC[t.metric] || METRIC.steps).what}` : 'Active days')
    : t.mode === 'goal' ? 'Days done, toward a target' : 'Days done';
  const target = t.target == null ? 'No target' : t.mode === 'total' ? amount(t.metric, t.target) : `${num(t.target)} of ${num(t.days)} days`;
  return facts([['What counts', esc(what)], ['Counted by', esc(countedBy(t.tracking, t.tracking_label))], ['Scored', esc(how)], ['Target', esc(target)],
    ['Runs', plural(t.days, 'day', 'days')], ['Sides', t.sides ? esc(`${KIND_LABEL[t.sides] || t.sides}s against each other`) : 'No sides']]);
}
function templateCard(t) {
  const o = currentOrg();
  const ic = t.kind === 'reward' ? (t.reward_kind === 'recognition' ? 'star' : 'gift')
    : t.tracking === 'device' ? (t.metric === 'floors' ? 'stairs' : 'trophy') : (HABITS[t.habit] || HABITS.positive_habit)[1];
  const ages = AGES.filter(([k]) => (t.age_groups || []).includes(k)).map(([, x]) => x).join(', ');
  const usable = t.kind === 'challenge' ? challengeMaker(o) && (verified(o) || o.kind === 'partner')
    : sectionsFor(o).includes('rewards') && verified(o);
  const acts = [
    usable ? `<button class="btn btn-sm btn-primary" data-act="lib-use" data-template="${esc(t.id)}">${icon(o.kind === 'partner' ? 'edit' : 'plus')}<span>${o.kind === 'partner' ? 'Make a draft' : 'Use template'}</span></button>` : '',
    t.own && templateSaver(o) ? `<button class="btn btn-sm" data-act="lib-edit" data-template="${esc(t.id)}">${icon('edit')}<span>Edit</span></button>
      <button class="btn btn-sm btn-danger" data-act="lib-remove" data-template="${esc(t.id)}">Remove</button>` : '',
  ].join('');
  return `<article class="glass card ch-card tpl-card" data-template="${esc(t.id)}">
    <div class="ch-top">${ring(ic)}
      <div class="ch-head"><h3 class="ch-title">${esc(t.title)}</h3>
        <div class="chips"><span class="chip${t.kind === 'reward' ? ' chip-accent' : ''}">${icon(t.kind === 'reward' ? 'gift' : 'trophy')}<span>${t.kind === 'reward' ? 'Reward' : 'Challenge'}</span></span>
          ${t.own ? `<span class="chip">${icon('building')}<span>${esc(o.name)}'s own</span></span>` : ''}
          ${ages ? `<span class="chip">${icon('people')}<span>${esc(ages)}</span></span>` : ''}</div></div></div>
    ${t.description ? `<p class="ch-desc">${esc(t.description)}</p>` : ''}
    ${templateFacts(t)}
    ${acts ? `<div class="ch-actions">${acts}</div>` : ''}
  </article>`;
}
const findTemplate = (id) => ((S.data.library && S.data.library.templates) || []).find((t) => t.id === id) || null;

// Use a template: the same forms as creating one, filled in from the template; what the template fixes can't change here.
function openUseChallenge(t) {
  const base = { title: t.title, description: t.description || '', unit_id: null, sides: t.sides, mode: t.mode, target: t.target, days: t.days,
    starts_on: dayIn(orgTz(), 1), max_people: '' };
  const after = async () => {
    await refresh(['challenges'], ['rewards', 'summary', 'chReport', 'toConfirm']);
    go(sectionUrl('challenges'), true);
    render();
  };
  if (t.tracking !== 'device') {
    openModal({
      title: `Use ${esc(t.title)}`,
      body: habitForm({ ...base, habit: t.habit, tracking: t.tracking }, { template: t }),
      submit: 'Create challenge',
      onOpen: (form) => { wireHabit(form); wireShape(form); },
      onSubmit: async (form) => {
        const d = readHabit(form);
        await rpc.libraryUse(org(), t.id, d);
        toast(`Created ${d.title}. People can join it in the InneRISE app.`);
        await after();
      },
    });
    return;
  }
  openModal({
    title: `Use ${esc(t.title)}`,
    body: `<div class="explain">${ring('book', 'sm')}<p>From the library. What it counts comes from the template; change anything else before you start it.</p></div>
      ${challengeForm({ ...base, metric: t.metric, daily_goal: t.daily_goal })}`,
    submit: 'Create challenge',
    onOpen: (form) => {
      wireRules(form);
      wireShape(form);
      form.elements.metric.disabled = true;
      form.elements.metric.closest('.field').classList.add('is-fixed');
    },
    onSubmit: async (form) => {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) throw new Error('Give the challenge a name.');
      const { metric: _fixed, ...rules } = readRules(form);
      const d = { title, description: f.description.value.trim() || null, max_people: readMax(form), unit_id: f.unit.value || null, sides: f.sides.value || null,
        ...readShape(form), ...rules };
      await rpc.libraryUse(org(), t.id, d);
      toast(`Created ${title}. People can join it in the InneRISE app.`);
      await after();
    },
  });
}
// A partner: a draft Sponsored Challenge (074), which opens for the rest (where it runs, a link) before InneRISE reviews it.
function openUseSponsored(t) {
  openModal({
    title: `Make a draft from ${esc(t.title)}`,
    body: `<p class="muted">This makes a draft Sponsored Challenge from the template. Next you can change anything in it, then send it to InneRISE for review. No one sees it before InneRISE approves it.</p>
      <label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="60" value="${esc(t.title)}" data-autofocus></label>
      <div class="form-grid">
        <label class="field"><span class="field-label">Starts on</span><input class="input" name="starts_on" type="date" value="${esc(dayIn(orgTz(), 14))}"></label>
        <label class="field"><span class="field-label">Days</span><input class="input" name="days" type="number" inputmode="numeric" min="1" max="365" step="1" value="${esc(t.days)}"></label>
      </div>`,
    submit: 'Make the draft',
    onSubmit: async (form) => {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) throw new Error('Give the challenge a name.');
      const days = Number(f.days.value);
      if (!Number.isInteger(days)) throw new Error('Enter how many days it runs: a whole number from 1 to 365.');
      const starts = String(f.starts_on.value || '').trim();
      if (!starts) throw new Error('Pick a start date.');
      const res = await rpc.libraryUse(org(), t.id, { title, starts_on: starts, days });
      toast(`Made a draft: ${title}. Change anything, then send it to InneRISE.`);
      await refresh(['campaigns'], ['summary', 'partner']);
      go(sectionUrl('sponsored'), true);
      render();
      const c = findCampaign(res.campaign_id);
      if (c) { openCampaignForm(c.kind, c.reward_type, c); return true; } // the next form replaces this one
      return false;
    },
  });
}
// A reward template: onto one of the challenges this person rewards. Habit challenges take only target or taking-part rewards.
async function openUseReward(t) {
  await ensure(['rewards']);
  const pool = S.data.rewards.list.filter((c) => c.can_reward && c.status !== 'cancelled' && earnsFor(c).includes(t.earns));
  if (!pool.length) {
    openModal({ title: 'No challenge this reward fits', cancel: 'OK',
      body: `<p>${esc(t.earns === 'goal' ? 'This reward is for reaching the target, so it needs a challenge with a target.'
        : t.earns === 'side' ? 'This reward is for the winning side, so it needs a challenge with sides.'
          : ['winner', 'top_n'].includes(t.earns) ? (childrenRules() ? 'With students, rewards never go to one winner or a top few.' : 'This reward is for the winner or the top places, so it needs a challenge that ranks people: a phone-or-watch challenge, not a habit one.')
            : 'Create a challenge first, then add this reward to it.')}</p>` });
    return;
  }
  openModal({
    title: `Use ${esc(t.title)}`,
    body: `<label class="field"><span class="field-label">Challenge</span><select class="input" name="ch">${pool
        .map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="80" value="${esc(t.title)}" data-autofocus></label>
      <label class="field"><span class="field-label">Description (optional)</span><textarea class="input" name="description" rows="2" maxlength="500">${esc(t.description || '')}</textarea></label>
      <div class="form-grid">
        ${t.earns === 'top_n' ? `<label class="field"><span class="field-label">How many top places</span><input class="input" name="top_n" type="number" inputmode="numeric" min="1" step="1" value="${esc(t.top_n || 3)}"></label>` : ''}
        <label class="field"><span class="field-label">How many there are (optional)</span><input class="input" name="quantity" type="number" inputmode="numeric" min="1" step="1" value="${esc(t.quantity ?? '')}" placeholder="No limit"></label>
      </div>
      ${eachGroupField(pool[0], false)}
      ${facts([['Kind', t.reward_kind === 'recognition' ? 'Recognition: a badge or certificate in the app' : 'Prize'], ['Who earns it', esc(EARNS[t.earns] || t.earns)]])}
      <p class="field-help">${amAdmin() ? 'You approve it next: a reward counts once an administrator approves it.' : 'An administrator approves every reward before it counts.'}</p>`,
    submit: 'Add reward',
    onOpen: (form) => form.elements.ch.addEventListener('change', () => syncEachGroup(form, pool.find((x) => x.id === form.elements.ch.value))),
    onSubmit: async (form) => {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) throw new Error('Give the reward a name.');
      const int = (el) => { if (!el) return undefined; const s = String(el.value || '').trim(); if (!s) return null; const n = Number(s); if (!Number.isInteger(n)) throw new Error('Use whole numbers.'); return n; };
      const d = { title, description: f.description.value.trim() || null, quantity: int(f.quantity) };
      if (f.top_n) d.top_n = int(f.top_n);
      if (readEachGroup(form)) d.each_group = true;
      const c = pool.find((x) => x.id === f.ch.value);
      await rpc.libraryUseReward(f.ch.value, t.id, d);
      toast(amAdmin() ? `Added ${title} to ${c.title}. Approve it to make it count.` : `Added ${title} to ${c.title}. It's waiting for an administrator to approve it.`);
      await refresh(['rewards'], ['challenges', 'summary']);
      go(sectionUrl('rewards'), true);
      render();
    },
  });
}

// Save your own: a challenge or a reward from scratch, or one of the organization's challenges as it is.
const defaultAges = (o = currentOrg()) => (['school', 'district'].includes(o.kind) ? ['children', 'teens'] : ['adults']);
const agesField = (sel) => `<fieldset class="plain"><legend class="field-label">Age groups</legend><div class="pill-options">${AGES.map(([k, t]) => `<label class="pill-opt">
    <input type="checkbox" name="age_groups" value="${k}"${sel.includes(k) ? ' checked' : ''}><span class="pill">${icon('check')}<span>${t}</span></span></label>`).join('')}</div></fieldset>`;
const readAges = (form) => {
  const a = [...form.querySelectorAll('input[name=age_groups]:checked')].map((x) => x.value);
  if (!a.length) throw new Error('Pick at least one age group.');
  return a;
};
function openSaveOwn() {
  const own = (S.data.challenges || []).filter((c) => c.status !== 'cancelled');
  const opts = [...(own.length ? [['from', 'trophy', 'One of your challenges', 'Save its rules to use again']] : []),
    ['challenge', 'plus', 'A new challenge', 'Set its rules here'], ['reward', 'gift', 'A reward', 'A prize or recognition you give often']];
  openModal({
    title: 'Save your own template',
    body: `<p class="muted">Your templates are only for ${esc(currentOrg().name)}. Anyone here who runs challenges or rewards can use them.</p>
      <fieldset class="kind-choice"><legend class="field-label">What to save</legend><div class="kind-options kind-options-3">${opts.map(([k, ic, t, sub], i) => `<label class="kind-opt">
        <input type="radio" name="what" value="${k}"${i === 0 ? ' checked' : ''}><span class="kind-card">${ring(ic, 'sm')}<span class="kind-text"><strong>${esc(t)}</strong><small>${esc(sub)}</small></span></span></label>`).join('')}</div></fieldset>`,
    submit: 'Next',
    onSubmit: (form) => {
      const what = form.elements.what.value;
      if (what === 'from') openFromChallenge(null);
      else openTemplateForm(what, null);
      return true; // the next form replaces this one
    },
  });
}
function openFromChallenge(c) {
  const own = (S.data.challenges || []).filter((x) => x.status !== 'cancelled');
  openModal({
    title: c ? `Save ${esc(c.title)} as a template` : 'Save a challenge as a template',
    body: `${c ? '' : `<label class="field"><span class="field-label">Challenge</span><select class="input" name="ch" data-from-ch>${own
        .map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label>`}
      <label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="60" value="${esc((c || own[0] || {}).title || '')}" data-autofocus></label>
      ${agesField(defaultAges())}
      <p class="field-help">The template keeps what it counts, how it's scored, the target, how many days it runs and its sides. It doesn't keep its people, place, dates or rewards.</p>`,
    submit: 'Save template',
    onOpen: (form) => {
      const pick = form.querySelector('[data-from-ch]');
      if (pick) pick.addEventListener('change', () => { const x = own.find((y) => y.id === pick.value); if (x) form.elements.title.value = x.title; });
    },
    onSubmit: async (form) => {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) throw new Error('Give the template a name.');
      await rpc.librarySave(org(), null, { from_challenge: c ? c.id : f.ch.value, title, age_groups: readAges(form) });
      toast(S.section === 'library' ? `Saved ${title} to your library.` : `Saved ${title} to your library. Find it in the Challenge & Rewards Library.`);
      delete S.data.library;
      render();
    },
  });
}
function templateForm(kind, t) {
  const o = currentOrg();
  const v = t || (kind === 'reward' ? { reward_kind: 'recognition', earns: 'finish', age_groups: defaultAges(o) }
    : { tracking: 'device', metric: 'steps', mode: 'participation', days: 28, age_groups: defaultAges(o) });
  const common = `<label class="field"><span class="field-label">Name</span><input class="input" name="title" maxlength="${kind === 'reward' ? 80 : 60}" value="${esc(v.title || '')}" data-autofocus></label>
    <label class="field"><span class="field-label">Description (optional)</span><textarea class="input" name="description" rows="2" maxlength="500">${esc(v.description || '')}</textarea></label>
    ${agesField(v.age_groups || defaultAges(o))}`;
  if (kind === 'reward') {
    return `${common}
      <fieldset class="kind-choice"><legend class="field-label">Kind</legend><div class="kind-options">
        ${[['prize', 'gift', 'Prize', 'Something people get'], ['recognition', 'star', 'Recognition', 'A badge or certificate in the app']]
    .map(([k, ic, tt, s]) => `<label class="kind-opt"><input type="radio" name="reward_kind" value="${k}"${k === v.reward_kind ? ' checked' : ''}>
          <span class="kind-card">${ring(ic, 'sm')}<span class="kind-text"><strong>${tt}</strong><small>${s}</small></span></span></label>`).join('')}</div></fieldset>
      <div class="form-grid">
        <label class="field"><span class="field-label">Who earns it</span><select class="input" name="earns">${Object.keys(EARNS)
    .map((k) => `<option value="${k}"${k === v.earns ? ' selected' : ''}>${esc(EARNS[k])}</option>`).join('')}</select></label>
        <label class="field" data-show="top_n"><span class="field-label">How many top places</span><input class="input" name="top_n" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.top_n || 3)}"></label>
        <label class="field"><span class="field-label">How many there are (optional)</span><input class="input" name="quantity" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.quantity ?? '')}" placeholder="No limit"></label>
      </div>
      <p class="field-help">For teens, children or a school, rewards never go to one winner or a top few. Habit challenges take only "everyone who reaches the target" or "everyone who takes part".</p>`;
  }
  const kinds = SIDE_ORDER.filter((k) => words().unitKinds.includes(k) || ((S.data.view && S.data.view.units) || []).some((u) => u.kind === k));
  if (v.sides && !kinds.includes(v.sides)) kinds.push(v.sides);
  const m = METRIC[v.metric] || METRIC.steps;
  const shown = (n) => (n == null ? '' : m.km ? String(Number(n) / 1000) : String(n));
  return `${common}
    ${trackingChoice(v.tracking)}
    <div class="form-grid">
      <label class="field"><span class="field-label">What counts</span><select class="input" name="metric" data-tpl-metric></select></label>
      <label class="field"><span class="field-label">How it's scored</span><select class="input" name="mode" data-tpl-mode></select></label>
      <label class="field" data-show="goal"><span class="field-label">Daily goal (<span data-unit>${esc(m.unit)}</span>)</span>
        <input class="input" name="daily_goal" type="number" inputmode="decimal" min="0" step="any" value="${esc(v.tracking === 'device' ? shown(v.daily_goal) : '')}"></label>
      <label class="field"><span class="field-label" data-target-label>Target</span>
        <input class="input" name="target" type="number" inputmode="decimal" min="0" step="any" value="${esc(v.mode === 'total' ? shown(v.target) : v.target ?? '')}" placeholder="No target"></label>
      <label class="field"><span class="field-label">Days</span><input class="input" name="days" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.days)}"></label>
      <label class="field"><span class="field-label">Sides</span><select class="input" name="sides"><option value="">No sides</option>${kinds
    .map((k) => `<option value="${k}"${k === v.sides ? ' selected' : ''}>${esc(KIND_LABEL[k])}s against each other</option>`).join('')}</select></label>
    </div>`;
}
function wireTemplate(form, kind, v) {
  if (kind === 'reward') {
    const sync = () => { form.querySelector('[data-show="top_n"]').hidden = form.elements.earns.value !== 'top_n'; };
    form.addEventListener('change', sync);
    sync();
    return;
  }
  let lastTracking = null;
  const sync = () => {
    const f = form.elements;
    const tr = f.tracking.value;
    const device = tr === 'device';
    if (tr !== lastTracking) {
      const metric = f.metric.value || v.metric || v.habit; // a habit template keeps its habit in habit (org_library_json)
      const mode = f.mode.value || v.mode;
      const metrics = device ? Object.entries(METRIC).map(([k, x]) => [k, x.name]) : Object.entries(HABITS).map(([k, [t]]) => [k, t]);
      const modes = device ? [['participation', 'Active days: any activity counts'], ['goal', 'Days at a daily goal'], ['total', 'Total amount']] : HABIT_MODES;
      f.metric.innerHTML = metrics.map(([k, t]) => `<option value="${k}"${k === metric ? ' selected' : ''}>${esc(t)}</option>`).join('');
      f.mode.innerHTML = modes.map(([k, t]) => `<option value="${k}"${k === mode ? ' selected' : ''}>${esc(t)}</option>`).join('');
      const help = form.querySelector('[data-tracking-help]');
      if (help) help.textContent = tr === 'staff_confirmed' ? confirmHelp() : TRACKING_HELP[tr];
      lastTracking = tr;
    }
    const m = METRIC[f.metric.value] || METRIC.steps;
    const mode = f.mode.value;
    form.querySelector('[data-show="goal"]').hidden = !(device && mode === 'goal');
    form.querySelectorAll('[data-unit]').forEach((el) => { el.textContent = m.unit; });
    form.querySelector('[data-target-label]').textContent = device && mode === 'total' ? `Target (${m.unit}, optional)` : !device && mode === 'goal' ? 'Target (days)' : 'Target (days, optional)';
  };
  form.addEventListener('change', sync);
  sync();
}
function readTemplate(form, kind) {
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) throw new Error('Give the template a name.');
  const base = { title, description: f.description.value.trim() || null, age_groups: readAges(form) };
  const numOf = (el, what) => { const s = String(el.value || '').trim().replace(/,/g, ''); if (!s) return null; const n = Number(s); if (!Number.isFinite(n)) throw new Error(`Enter ${what} as a number.`); return n; };
  if (kind === 'reward') {
    const int = (el) => { const n = numOf(el, 'it'); if (n != null && !Number.isInteger(n)) throw new Error('Use whole numbers.'); return n; };
    return { ...base, reward_kind: f.reward_kind.value, earns: f.earns.value, top_n: f.earns.value === 'top_n' ? int(f.top_n) : null, quantity: int(f.quantity) };
  }
  const tracking = f.tracking.value;
  const device = tracking === 'device';
  const mode = f.mode.value;
  const km = device && (METRIC[f.metric.value] || METRIC.steps).km;
  const scaled = (n) => (n != null && km ? Math.round(n * 1000) : n);
  const days = numOf(f.days, 'the number of days');
  if (days == null || !Number.isInteger(days)) throw new Error('Enter how many days it runs, as a whole number.');
  const goal = device && mode === 'goal' ? scaled(numOf(f.daily_goal, 'the daily goal')) : null;
  if (device && mode === 'goal' && goal == null) throw new Error('Enter the daily goal.');
  const target = numOf(f.target, 'the target');
  if (!device && mode === 'goal' && target == null) throw new Error('Set the target: how many days count toward it.');
  return { ...base, tracking, metric: f.metric.value, mode, daily_goal: goal, target: mode === 'total' ? scaled(target) : target, days, sides: f.sides.value || null };
}
function openTemplateForm(kind, t) {
  openModal({
    title: t ? `Edit ${esc(t.title)}` : kind === 'reward' ? 'Save a reward template' : 'Save a challenge template',
    body: templateForm(kind, t),
    submit: t ? 'Save changes' : 'Save template',
    onOpen: (form) => wireTemplate(form, kind, t || { metric: 'steps', mode: 'participation' }),
    onSubmit: async (form) => {
      const d = readTemplate(form, kind);
      await rpc.librarySave(org(), t ? t.id : null, t ? d : { kind, ...d });
      toast(t ? `Saved ${d.title}.` : `Saved ${d.title} to your library.`);
      delete S.data.library;
      render();
    },
  });
}

// Workplace App Management / School Focus (071a, 071b) ------------------------------------------------
// One section, one component, for businesses and partners (Workplace App Management) and schools (School Focus). People enroll
// their own phone in the app, and from then on the schedules that reach them apply by themselves. Administrators run
// everything; managers and teachers the places they look after. Phones apply nothing while InneRISE's
// workplace_enforcement switch is off (until Apple's written approval).
const FOCUS_KIND = { focus_hours: ['Focus hours', 'focus', 'Limits the apps you pick'], lunch: ['Lunch', 'cup', 'Lifts focus hours while it runs'],
  break: ['Break', 'cup', 'Lifts focus hours while it runs'] };
const WEEK = [['mon', 'Mon', 'Monday'], ['tue', 'Tue', 'Tuesday'], ['wed', 'Wed', 'Wednesday'], ['thu', 'Thu', 'Thursday'], ['fri', 'Fri', 'Friday'],
  ['sat', 'Sat', 'Saturday'], ['sun', 'Sun', 'Sunday']];
// Apple's 12 Screen Time app categories, in plain names.
const APP_CATEGORIES = [['social', 'Social'], ['games', 'Games'], ['entertainment', 'Entertainment'], ['creativity', 'Creativity'],
  ['education', 'Education'], ['health_fitness', 'Health & Fitness'], ['information_reading', 'Information & Reading'],
  ['productivity_finance', 'Productivity & Finance'], ['shopping_food', 'Shopping & Food'], ['travel', 'Travel'], ['utilities', 'Utilities'], ['other', 'Other']];
const catName = (k) => (APP_CATEGORIES.find(([c]) => c === k) || [k, k])[1];
const focusEdu = () => FAMILY[currentOrg().kind] === 'education';
const reasonWord = (r) => ({ work_task: focusEdu() ? 'Schoolwork' : 'A work task', call: 'A call', break: 'A break', emergency: 'An emergency',
  other: 'Something else' }[r] || 'No reason given');
const reasonList = (r) => { const a = (r.reasons || []).map((x) => reasonWord(x).toLowerCase()); return a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}`; };
const clockText = (hhmm) => new Date(Date.UTC(2000, 0, 1, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5))))
  .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const clockAt = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: orgTz() });
const dayAt = (iso) => fmtDay(new Intl.DateTimeFormat('en-CA', { timeZone: orgTz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)), true);
function daysText(days) {
  const idx = days.map((d) => WEEK.findIndex(([k]) => k === d)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (idx.length === 7) return 'Every day';
  if (idx.length === 1) return `${WEEK[idx[0]][2]}s`;
  if (idx.join() === '5,6') return 'Saturday and Sunday';
  if (idx.length >= 3 && idx[idx.length - 1] - idx[0] === idx.length - 1) return `${WEEK[idx[0]][1]} to ${WEEK[idx[idx.length - 1]][1]}`;
  return listWords(idx.map((i) => WEEK[i][1]));
}
const timeText = (s) => `${clockText(s.start)} to ${clockText(s.end)}${s.end <= s.start ? ' the next day' : ''}`;
const zoneText = (s) => `${tzName(s.time_zone) || s.time_zone.replace(/_/g, ' ')} (${s.own_time_zone ? s.own_time_zone.split('/').pop().replace(/_/g, ' ') : 'inherited'})`;
const placeOf = (s) => (s.unit_id ? unitPath(s.unit_id, (S.data.view && S.data.view.units) || []) || s.unit_name || 'One place' : `The whole ${words().org}`);
// org_focus_count, in words: about N (to the nearest 5), fewer than the smallest group, almost everyone, or a small group.
function reachText(s, min) {
  if (s.reads === 'number') return `About ${num(s.enrolled)} enrolled`;
  if (s.reads === 'fewer_than') return `Fewer than ${num(min)} enrolled`;
  if (s.reads === 'almost_everyone') return 'Almost everyone enrolled';
  return 'Small group: not counted';
}
// What the last change was, from last_change and previous.
function changeText(s) {
  const p = s.previous;
  if (!p || !(s.last_change || []).length) return '';
  const w = words();
  const was = { name: `was called "${p.name}"`, kind: `was ${(FOCUS_KIND[p.kind] || [p.kind])[0].toLowerCase()}`, days: `ran ${daysText(p.days).replace(/^Every day$/, 'every day')}`,
    start: `started at ${clockText(p.start)}`, end: `ended at ${clockText(p.end)}`, time_zone: `ran on ${tzName(p.time_zone) || p.time_zone}`,
    unit_id: `applied to ${p.unit_name || `the whole ${w.org}`}`,
    app_categories: (p.app_categories || []).length ? `limited ${listWords(p.app_categories.map(catName))}` : 'limited no apps',
    note: p.note ? `had the note "${p.note}"` : 'had no note' };
  const parts = s.last_change.map((k) => was[k]).filter(Boolean);
  return `Changed ${dayAt(s.updated_at)}. Before, it ${listWords(parts)}.`;
}
const canManageFocus = (o = currentOrg()) => isAdminOf(o) || rolesOf(o).some((r) => r.role === 'unit_manager' || r.role === 'teacher');
// The places a manager or teacher looks after, and everything under them (administrators: all).
function focusUnits() {
  const units = (S.data.view && S.data.view.units) || [];
  const o = currentOrg();
  if (isAdminOf(o) || rolesOf(o).some((r) => (r.role === 'unit_manager' || r.role === 'teacher') && !r.unit_id)) return units;
  const map = new Map(units.map((u) => [u.id, u]));
  const mine = myUnits();
  return units.filter((u) => { for (let x = u, i = 0; x && i < 20; x = map.get(x.parent_id), i++) if (mine.includes(x.id)) return true; return false; });
}
const wholeFocus = (o = currentOrg()) => isAdminOf(o) || rolesOf(o).some((r) => (r.role === 'unit_manager' || r.role === 'teacher') && !r.unit_id);

async function loadFocusPeople(skip = 0, have = []) {
  const res = await rpc.focusEnrolled(S.orgId, skip);
  const list = [...have, ...(res.people || [])];
  return { list, more: (res.people || []).length === 500 };
}
const focusWaitingHere = async () => ((await rpc.focusWaiting()) || []).filter((q) => q.org_id === S.orgId);

function focusPage() {
  const w = words();
  const o = currentOrg();
  const edu = focusEdu();
  const head = pageHead(w.focusTitle, edu ? 'Class time, lunch and breaks for the phones that are enrolled, and requests for a few minutes of access.'
    : 'Focus hours, lunch and breaks for the phones people enroll, and requests for a few minutes of access.',
  S.data.focus && !S.data.focus.offered ? '' : `<button class="btn btn-primary" data-act="fx-new">${icon('plus')}<span>New schedule</span></button>`);
  const wait = pageBody(['focus', 'focusRules', 'focusWaiting', 'focusPeople', 'view']);
  if (wait) return head + wait;
  const data = S.data.focus;
  const min = data.min_group;
  const admin = amAdmin();
  // One quiet line while phones apply nothing: InneRISE is waiting for Apple's written approval.
  const quiet = [
    data.enforcement ? '' : `<p class="quiet-line">${icon('phone')}<span>Phones don't apply these schedules yet. InneRISE is waiting for Apple's approval to limit apps ${edu ? 'at school' : 'at work'}. Schedules, enrollment and access requests all work now.</span></p>`,
    data.offered ? '' : `<p class="quiet-line">${icon('shield')}<span>${esc(w.focusTitle)} is switched off for ${esc(o.name)}, so these schedules don't reach anyone. Write to InneRISE to turn it back on.</span></p>`,
  ].join('');
  const waiting = S.data.focusWaiting;
  const requests = waiting.length ? `${label(`Waiting for an answer (${waiting.length})`)}<section class="glass list focus-requests" aria-label="Waiting for an answer">${waiting.map(requestRow).join('')}</section>` : '';
  const list = data.schedules;
  const schedules = list.length
    ? `<div class="ch-list focus-list">${list.map((s) => focusCard(s, min)).join('')}</div>`
    : `<section class="glass list">${emptyRow('focus', 'No schedules yet', edu
      ? 'Add class time for the whole district or one school, grade or classroom, with lunch and breaks that lift it. It applies to every enrolled phone it reaches.'
      : 'Add focus hours for the whole company or one place, with lunch and breaks that lift them. They apply to every enrolled phone they reach.',
    `<button class="btn btn-sm" data-act="fx-new">${icon('plus')}<span>New schedule</span></button>`)}</section>`;
  return `${head}${quiet}${requests}${label(`Schedules (${list.length})`)}${schedules}
    <p class="foot-note">${icon('shield')}<span>Enrolled counts are rounded to the nearest 5. Under ${num(min)} enrolled reads "fewer than ${num(min)}", fewer than ${num(min)} left out reads "almost everyone", and a schedule that reaches ${num(min)} people or fewer isn't counted.</span></p>
    ${enrolledSection(admin, edu)}${rulesSection(admin, edu, waiting.length)}${focusPrivacyCard(edu)}`;
}

function focusCard(s, min) {
  const [kname, kic] = FOCUS_KIND[s.kind] || [s.kind, 'focus'];
  const change = changeText(s);
  return `<article class="glass card ch-card focus-card" data-schedule="${esc(s.id)}">
    <div class="ch-top">${ring(kic)}
      <div class="ch-head"><h3 class="ch-title">${esc(s.name)}</h3>
        <div class="chips"><span class="chip${s.kind === 'focus_hours' ? ' chip-accent' : ''}"><span>${esc(kname)}</span></span>
          <span class="chip">${icon(s.unit_id ? 'pin' : 'building')}<span>${esc(placeOf(s))}</span></span>
          <span class="chip"><span>Version ${num(s.version)}</span></span></div></div></div>
    ${facts([['Days', esc(daysText(s.days))], ['Time', esc(timeText(s))], ['Time zone', esc(zoneText(s))], ['Enrolled', esc(reachText(s, min))]])}
    ${s.kind === 'focus_hours'
    ? `<div class="focus-apps"><span class="focus-apps-label">Apps it limits</span><div class="chips">${s.app_categories.map((c) => `<span class="chip">${esc(catName(c))}</span>`).join('')}</div></div>`
    : `<p class="usub-line">${icon('cup')}<span>Lifts focus hours while it runs.</span></p>`}
    ${s.note ? `<p class="ch-desc focus-note">${esc(s.note)}</p>` : ''}
    ${change ? `<p class="focus-change">${icon('clock')}<span>${esc(change)}</span></p>` : ''}
    <div class="ch-actions"><button class="btn btn-sm" data-act="fx-edit" data-schedule="${esc(s.id)}">${icon('edit')}<span>Edit</span></button>
      <button class="link-btn small btn-danger danger-link" data-act="fx-remove" data-schedule="${esc(s.id)}">Remove</button></div>
  </article>`;
}

function requestRow(q) {
  return `<div class="row request-row" data-request="${esc(q.id)}">
    <span class="avatar" aria-hidden="true">${esc((q.first_name || '?')[0].toUpperCase())}</span>
    <div class="grow"><div class="uname">${esc(q.first_name || 'Someone')}</div><div class="usub">${esc([...new Set(q.units || []), `asked ${clockAt(q.asked_at)}`].join(' · '))}</div></div>
    <div class="request-what"><strong>${esc(plural(q.minutes, 'minute', 'minutes'))}</strong><span class="usub">${esc(reasonWord(q.reason))}</span></div>
    <span class="usub request-expires">${icon('clock')}<span>Expires ${esc(clockAt(q.expires_at))}</span></span>
    <div class="row-acts"><button class="btn btn-sm btn-primary" data-act="fx-approve" data-request="${esc(q.id)}">${icon('check')}<span>Approve</span></button>
      <button class="btn btn-sm" data-act="fx-deny" data-request="${esc(q.id)}">${icon('x')}<span>Deny</span></button></div>
  </div>`;
}

function enrolledSection(admin, edu) {
  const { list, more } = S.data.focusPeople;
  const top = `<div class="row focus-list-top"><p class="muted">${edu
    ? 'People enroll their own phone in the InneRISE app; a guardian enrolls a student under 18. Leaving works at any time.'
    : 'People enroll their own phone in the InneRISE app, when they choose to. Leaving works at any time.'}</p>
    ${admin ? `<button class="btn btn-sm" data-act="fx-device-add">${icon('plus')}<span>Add a company phone</span></button>` : ''}</div>`;
  const rows = list.map((p) => `<div class="row enrolled-row" data-enrolled="${esc(p.id)}">
      <span class="avatar" aria-hidden="true">${esc((p.first_name || '?')[0].toUpperCase())}</span>
      <div class="grow"><div class="uname">${esc(p.first_name || 'Not named')}</div><div class="usub">${esc([...new Set(p.units || [])].join(', ') || words().noUnit)}</div></div>
      <span class="chip">${icon('phone')}<span>${p.ownership === 'company' ? `Company phone · ${esc(p.device_ref)}` : 'Personal phone'}</span></span>
      <span class="usub enrolled-since">Since ${esc(dayAt(p.since))}</span>
      ${admin && p.ownership === 'company' ? `<button class="link-btn small btn-danger danger-link" data-act="fx-device-remove" data-enrolled="${esc(p.id)}">Remove</button>` : ''}
    </div>`).join('');
  return `${label(`Enrolled phones (${list.length}${more ? '+' : ''})`)}<section class="glass list focus-people" aria-label="Enrolled phones">${top}${rows
    || emptyRow('phone', 'No phones enrolled yet', edu ? 'Phones show here once their owner, or a student\'s guardian, enrolls them in the InneRISE app.'
      : 'Phones show here once their owner enrolls them in the InneRISE app.')}</section>
    ${more ? `<div class="more-wrap"><button class="btn" data-act="fx-more">Show more</button></div>` : ''}
    ${admin ? '<p class="foot-note">' + icon('phone') + '<span>Company phones are records for now: the link to your device-management system comes later. They count as enrolled.</span></p>' : ''}`;
}

const APPROVERS = (edu) => ({ managers: edu ? 'Teachers and leaders' : 'Managers', admins: 'Administrators',
  either: edu ? 'Teachers, leaders or administrators' : 'Managers or administrators' });
function rulesSection(admin, edu, waiting) {
  const r = S.data.focusRules;
  return `${label('Temporary access')}<section class="glass card focus-rules">
    <p>${edu ? 'During class time, a student can ask for a few minutes of access in the app.' : 'During focus hours, someone can ask for a few minutes of access in the app.'}
      Approved time starts right away. A request no one answers runs out after 15 minutes.</p>
    ${facts([['Who approves', esc(APPROVERS(edu)[r.approvers] || r.approvers)], ['Longest request', esc(plural(r.max_minutes, 'minute', 'minutes'))],
    ['Most in a day', esc(plural(r.max_day_minutes, 'minute', 'minutes'))], ['Reason', r.reason_required ? 'Needed' : 'Optional']])}
    <p class="field-help">A request names ${esc(reasonList(r))}${r.reason_required ? '' : ', or no reason'}.
      ${waiting ? '' : 'No requests are waiting right now.'}</p>
    ${admin ? `<div class="ch-actions"><button class="btn btn-sm" data-act="fx-rules">${icon('edit')}<span>Change the rules</span></button></div>`
    : '<p class="field-help">Only administrators can change these rules.</p>'}
  </section>`;
}

function focusPrivacyCard(edu) {
  const see = ['Schedules, and about how many each one reaches', 'Who enrolled a phone, and since when', 'Requests for access: first name, minutes and reason'];
  const never = ['Screen time, or which apps anyone uses', 'Health or activity records', edu ? "Anything else on a student's phone" : "Anything else on anyone's phone"];
  return `${label('What you see')}<section class="glass card privacy"><div class="privacy-cols">
    <div><h3 class="privacy-head">${ring('eye', 'sm')}What you see</h3><ul class="ticks">${see.map((t) => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul></div>
    <div><h3 class="privacy-head">${ring('eyeoff', 'sm')}What you never see</h3><ul class="ticks never">${never.map((t) => `<li>${icon('x')}<span>${esc(t)}</span></li>`).join('')}</ul></div></div></section>`;
}

// The schedule form: make one, or change one (only what changed counts as a change, and makes a new version).
function focusForm(s) {
  const w = words();
  const v = s || { kind: 'focus_hours', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '12:00', unit_id: null, own_time_zone: null,
    app_categories: ['social', 'games', 'entertainment'], note: '' };
  const units = focusUnits();
  const unitList = (wholeFocus() ? `<option value=""${!v.unit_id ? ' selected' : ''}>The whole ${esc(w.org)}</option>` : '')
    + unitTree(units).map(({ unit }) => `<option value="${esc(unit.id)}"${unit.id === v.unit_id ? ' selected' : ''}>${esc(unitPath(unit.id, (S.data.view && S.data.view.units) || units))}</option>`).join('');
  return `<label class="field"><span class="field-label">Name</span><input class="input" name="name" maxlength="60" value="${esc(s ? s.name : '')}" placeholder="${focusEdu() ? 'School day' : 'Morning focus'}" data-autofocus></label>
    <fieldset class="kind-choice"><legend class="field-label">Kind</legend><div class="kind-options">${Object.entries(FOCUS_KIND).map(([k, [t, ic, sub]]) => `<label class="kind-opt">
      <input type="radio" name="kind" value="${k}"${k === v.kind ? ' checked' : ''}><span class="kind-card">${ring(ic, 'sm')}<span class="kind-text"><strong>${esc(t)}</strong><small>${esc(sub)}</small></span></span></label>`).join('')}</div></fieldset>
    <fieldset class="plain"><legend class="field-label">Days</legend><div class="pill-options">${WEEK.map(([k, short, long]) => `<label class="pill-opt">
      <input type="checkbox" name="days" value="${k}" aria-label="${long}"${v.days.includes(k) ? ' checked' : ''}><span class="pill">${icon('check')}<span>${short}</span></span></label>`).join('')}</div></fieldset>
    <div class="form-grid">
      <label class="field"><span class="field-label">Starts</span><input class="input" name="start" type="time" step="60" value="${esc(v.start)}"></label>
      <label class="field"><span class="field-label">Ends</span><input class="input" name="end" type="time" step="60" value="${esc(v.end)}"></label>
    </div>
    <p class="field-help">At least 15 minutes. An end before the start runs past midnight.</p>
    <div class="form-grid">
      <label class="field"><span class="field-label">Applies to</span><select class="input" name="unit_id">${unitList}</select></label>
      <label class="field"><span class="field-label">Time zone</span><select class="input" name="time_zone">${tzOptions(v.own_time_zone || '', 'Same as where it applies')}</select></label>
    </div>
    <fieldset class="plain" data-show-kind="focus_hours"${v.kind === 'focus_hours' ? '' : ' hidden'}><legend class="field-label">Apps it limits</legend>
      <div class="pill-options cat-options">${APP_CATEGORIES.map(([k, t]) => `<label class="pill-opt">
        <input type="checkbox" name="app_categories" value="${k}"${(v.app_categories || []).includes(k) ? ' checked' : ''}><span class="pill">${icon('check')}<span>${esc(t)}</span></span></label>`).join('')}</div>
      <p class="field-help">Apple's Screen Time app categories. Lunch and breaks lift focus hours while they run.</p></fieldset>
    <label class="field"><span class="field-label">Note (optional)</span><textarea class="input" name="note" rows="2" maxlength="200" placeholder="${focusEdu() ? 'Class time. Lunch and the morning break lift it.' : 'Quiet hours for deep work.'}">${esc(v.note || '')}</textarea></label>
    <p class="field-help">${s ? `Saving makes version ${num(s.version + 1)}, and keeps what it was before. ` : ''}It applies to every enrolled phone it reaches, with nothing for anyone to switch on.</p>`;
}
function readFocusForm(form) {
  const f = form.elements;
  const name = f.name.value.trim();
  if (name.length < 2) throw new Error('Give it a name of 2 to 60 characters.');
  const kind = (form.querySelector('[name=kind]:checked') || {}).value;
  const days = [...form.querySelectorAll('[name=days]:checked')].map((x) => x.value);
  if (!days.length) throw new Error('Pick at least one day.');
  if (!f.start.value) throw new Error('Set a start time.');
  if (!f.end.value) throw new Error('Set an end time.');
  const cats = kind === 'focus_hours' ? [...form.querySelectorAll('[name=app_categories]:checked')].map((x) => x.value) : [];
  if (kind === 'focus_hours' && !cats.length) throw new Error('Pick at least one kind of app for focus hours to limit.');
  return { name, kind, days, start: f.start.value.slice(0, 5), end: f.end.value.slice(0, 5), unit_id: f.unit_id.value || null,
    time_zone: f.time_zone.value, app_categories: cats, note: f.note.value.trim() };
}
async function openFocusForm(s) {
  await ensure(['view']);
  openModal({
    title: s ? `Edit ${esc(s.name)}` : 'New schedule',
    body: focusForm(s),
    submit: s ? 'Save changes' : 'Add schedule',
    onOpen: (form) => {
      const sync = () => { form.querySelector('[data-show-kind]').hidden = (form.querySelector('[name=kind]:checked') || {}).value !== 'focus_hours'; };
      form.addEventListener('change', sync);
      sync();
    },
    onSubmit: async (form) => {
      const d = readFocusForm(form);
      if (s) {
        const res = await rpc.focusSave(S.orgId, { id: s.id, ...d });
        toast(res.changed && res.changed.length ? `Saved ${d.name}: now version ${num(res.version)}.` : 'Nothing changed.');
      } else {
        await rpc.focusSave(S.orgId, d);
        toast(`Added ${d.name}.`);
      }
      await refresh(['focus'], ['summary']);
    },
  });
}
const findSchedule = (id) => (S.data.focus ? S.data.focus.schedules.find((s) => s.id === id) : null);
// Temporary access rules (administrators change them; managers and teachers read them).
function rulesForm(r) {
  const edu = focusEdu();
  const help = { managers: edu ? 'Teachers answer for their own classes, and leaders for the places they look after and everything under them. A student with no teacher or leader above them can\'t ask.'
    : 'Managers answer for the places they look after and everything under them. Someone with no manager above them can\'t ask.',
  admins: `Only administrators answer, for everyone in the ${words().org}.`,
  either: edu ? 'Teachers and leaders answer for their own places, and administrators for everyone.' : 'Managers answer for their own places, and administrators for everyone.' };
  return `<fieldset class="plain"><legend class="field-label">Who approves</legend><div class="pick-list rules-pick">${Object.entries(APPROVERS(edu)).map(([k, t]) => `<label class="pick-row">
      <input type="radio" name="approvers" value="${k}"${r.approvers === k ? ' checked' : ''}><span class="pick-text"><span class="pick-name">${esc(t)}</span><small>${esc(help[k])}</small></span></label>`).join('')}</div>
    <p class="field-help">Nobody answers their own request.</p></fieldset>
    <div class="form-grid">
      <label class="field"><span class="field-label">Longest request, in minutes</span><input class="input" name="max_minutes" type="number" inputmode="numeric" min="5" max="120" step="1" value="${esc(String(r.max_minutes))}"></label>
      <label class="field"><span class="field-label">Most in a day, in minutes</span><input class="input" name="max_day_minutes" type="number" inputmode="numeric" min="5" max="480" step="1" value="${esc(String(r.max_day_minutes))}"></label>
    </div>
    <p class="field-help">One request: 5 to 120 minutes. A day: 5 to 480 minutes, and at least one request's worth. Every request is at least 5 minutes, and the day follows the ${esc(words().org)}'s time zone.</p>
    <label class="pick-row"><input type="checkbox" name="reason_required"${r.reason_required ? ' checked' : ''}><span class="pick-text"><span class="pick-name">Ask for a reason</span>
      <small>Each request then names ${esc(reasonList(r))}.</small></span></label>`;
}
function readAccessRules(form) {
  const f = form.elements;
  const whole = (v) => (/^\s*\d+\s*$/.test(v) ? Number(v) : null);
  const max = whole(f.max_minutes.value);
  const day = whole(f.max_day_minutes.value);
  if (max == null || max < 5 || max > 120) throw new Error('Allow 5 to 120 minutes for one request.');
  if (day == null || day < 5 || day > 480 || day < max) throw new Error('Allow 5 to 480 minutes a day, and at least as many as one request.');
  return { approvers: (form.querySelector('[name=approvers]:checked') || {}).value, max_minutes: max, max_day_minutes: day, reason_required: f.reason_required.checked };
}
// Approve or Deny. A request that ran out, was answered by someone else or isn't ours anymore drops off the list.
async function answerRequest(btn, approve) {
  const q = (S.data.focusWaiting || []).find((x) => x.id === btn.dataset.request);
  if (!q) return;
  const name = q.first_name || 'Someone';
  await tryAct(btn, async () => {
    let res;
    try {
      res = await rpc.focusAnswer(q.id, approve);
    } catch (e) {
      if (['expired', 'already_answered', 'not_found'].includes(e.code)) await refresh(['focusWaiting'], ['summary']);
      throw e;
    }
    toast(res.status === 'approved' ? `Approved ${plural(q.minutes, 'minute', 'minutes')} for ${name}, until ${clockAt(res.ends_at)}.` : `Denied ${name}'s request.`);
    await refresh(['focusWaiting'], ['summary']);
  });
}

// Partners: Sponsored Challenges, Rewards & offers, Redeem a code, Performance, Business profile & plan ---------
const STATE = {
  draft: ['Draft', 'chip-plain'], submitted: ['Waiting for InneRISE review', 'chip-wait'], rejected: ['Sent back by InneRISE', 'chip-back'],
  withdrawn: ['Withdrawn', 'chip-muted'], paused: ['Paused', 'chip-wait'], scheduled: ['Approved · starts soon', 'chip-accent'],
  live: ['Live', 'chip-ok'], ended: ['Ended', 'chip-muted'], approved: ['Approved · waiting for its challenge', 'chip-accent'],
};
const stateChip = (c) => { const [t, cls] = STATE[c.state] || [c.state, '']; return `<span class="chip ${cls}">${c.state === 'live' ? '<span class="dot"></span>' : ''}<span>${esc(t)}</span></span>`; };
const areaText = (c) => [c.city, c.region, c.country ? countryName(c.country) : null].filter(Boolean).join(', ') || 'Everywhere';
const PLANS = [['local', 'Local'], ['regional', 'Regional'], ['national', 'National']];
const PLAN_KEY = { local: 'local_rewards', regional: 'regional', national: 'national' }; // the server's plan keys
const planName = (key) => (PLANS.find(([k]) => PLAN_KEY[k] === key) || [null, null])[1];
const partnerVerifyNote = (o) => (verified(o) ? '' : `<section class="glass card pending-card" role="status">${ring('clock')}<div><h2 class="card-title">Being verified</h2>
  <p>You can write drafts now. Sending them to InneRISE for review starts once InneRISE verifies ${esc(o.name)}.</p></div></section>`);

function campaignCard(c, all, details) {
  const admin = amAdmin();
  const sponsored = c.kind === 'sponsored_challenge';
  const ended = ['ended', 'withdrawn'].includes(c.state);
  const canSubmit = verified() && ['draft', 'rejected'].includes(c.status) && c.state !== 'ended' && (sponsored || admin);
  const canEdit = !ended && (sponsored || admin || ['draft', 'rejected'].includes(c.status));
  const live = c.status === 'approved';
  const sent = ['submitted', 'approved'].includes(c.status);
  const rev = live && c.revision && Object.keys(c.revision).length ? c.revision : null; // changes waiting for InneRISE
  // Anyone who runs it pauses it; a reward or offer once sent is resumed or withdrawn by an administrator. A reward paused
  // when its challenge ended can still be resumed: it is earned then, from the final results.
  const parent = c.for_campaign ? all.find((x) => x.id === c.for_campaign) : null;
  const lateReward = c.reward_type === 'achievement' && c.state === 'ended' && !!parent && parent.status === 'approved' && parent.state === 'ended';
  const canPause = live && !c.paused && c.state !== 'ended';
  const canResume = sent && c.paused && (sponsored || admin) && (c.state !== 'ended' || lateReward);
  const canWithdraw = c.status !== 'withdrawn' && c.state !== 'ended' && (sponsored || admin || !sent);
  const pool = c.kind === 'reward_offer' && c.code_source === 'pool' ? details[c.id] : null;
  const pt = c.kind === 'reward_offer' && S.data.campaigns && S.data.campaigns.terms ? S.data.campaigns.terms[c.id] : undefined;
  const short = pool && pool.codes_uploaded != null && pool.codes_uploaded < (c.quantity || 1);
  const rows = [];
  if (sponsored && c.challenge) {
    const r = ruleText(c.challenge);
    rows.push(['Counts', esc(r.how)], ['Target', esc(r.target)], ['Dates', esc(fmtRange(c.challenge.starts_on, addDay(c.challenge.starts_on, c.challenge.days - 1)))],
      ['Open to', esc(openTo(c.challenge.max_people))]);
  } else if (c.reward_type === 'achievement') {
    rows.push(['For', esc(c.for_title || 'A Sponsored Challenge')], ['Who earns it', esc(EARNS[c.earns] || c.earns || '')], ['Available', num(c.quantity)]);
  } else {
    rows.push(['Dates', c.starts_on && c.ends_on ? esc(fmtRange(c.starts_on, c.ends_on)) : '—'], ['Available', `${num(c.quantity)} · ${plural(c.per_person, 'per person', 'per person')}`]);
  }
  if (c.kind === 'reward_offer') {
    const d = details[c.id];
    rows.push(['Codes', c.code_source === 'pool' ? `Your own codes${d && d.codes_uploaded != null ? ` · ${num(d.codes_uploaded)} of ${num(c.quantity)} uploaded` : ''}` : 'Made by InneRISE']);
  }
  if (c.reward_type !== 'achievement') rows.push(['Area', esc(areaText(c))]);
  const linked = sponsored ? all.filter((x) => x.for_campaign === c.id && x.status !== 'withdrawn') : [];
  const acts = [
    canSubmit ? `<button class="btn btn-sm btn-primary" data-act="cp-submit" data-campaign="${esc(c.id)}">${icon('send')}<span>Send for review</span></button>` : '',
    canEdit ? `<button class="btn btn-sm" data-act="cp-edit" data-campaign="${esc(c.id)}">${icon('edit')}<span>Edit</span></button>` : '',
    canPause ? `<button class="btn btn-sm" data-act="cp-pause" data-campaign="${esc(c.id)}">${icon('pause')}<span>Pause</span></button>` : '',
    canResume ? `<button class="btn btn-sm" data-act="cp-resume" data-campaign="${esc(c.id)}">${icon('play')}<span>Resume</span></button>` : '',
    c.kind === 'reward_offer' && c.code_source === 'pool' && !ended ? `<button class="btn btn-sm" data-act="cp-codes" data-campaign="${esc(c.id)}">${icon('key')}<span>Add codes</span></button>` : '',
    pt !== undefined && !ended ? `<button class="btn btn-sm" data-act="pt-edit" data-k="campaign" data-target="${esc(c.id)}">${icon('tag')}<span>${hasTerms(pt) ? 'Prize terms' : 'Add prize terms'}</span></button>` : '',
    listCodes(pt) && c.state !== 'withdrawn' ? `<button class="btn btn-sm" data-act="pt-codes" data-k="campaign" data-target="${esc(c.id)}">${icon('key')}<span>Upload business codes</span></button>` : '',
    c.approved_at ? `<a class="btn btn-sm" href="${esc(sectionUrl('performance'))}" data-nav data-campaign="${esc(c.id)}">${icon('trend')}<span>Performance</span></a>` : '',
    canWithdraw ? `<button class="link-btn small btn-danger danger-link" data-act="cp-withdraw" data-campaign="${esc(c.id)}">Withdraw</button>` : '',
  ].join('');
  return `<article class="glass card ch-card campaign" data-campaign="${esc(c.id)}">
    <div class="ch-top">${ring(sponsored ? 'trophy' : c.reward_type === 'achievement' ? 'star' : 'tag')}
      <div class="ch-head"><h3 class="ch-title">${esc(c.title)}</h3>
        <div class="chips">${stateChip(c)}${c.paused && c.state !== 'paused' ? '<span class="chip chip-wait"><span>Paused</span></span>' : ''}${rev ? '<span class="chip chip-wait"><span>Changes with InneRISE</span></span>' : ''}<span class="chip"><span>${sponsored ? 'Sponsored Challenge' : c.reward_type === 'achievement' ? 'Challenge reward' : 'Offer'}</span></span></div></div></div>
    ${c.summary ? `<p class="ch-desc">${esc(c.summary)}</p>` : ''}
    ${c.review_note ? `<div class="review-note${c.status === 'rejected' ? ' sent-back' : ''}">${icon('mail')}<div><div class="review-note-label">Note from InneRISE</div><p>${esc(c.review_note)}</p></div></div>` : ''}
    ${rev ? `<div class="review-note revision">${icon('clock')}<div>
      <div class="review-note-label">Your changes are with InneRISE for review</div>
      <p>People still see the version below until InneRISE approves your changes to the ${esc(listWords(changedParts(rev)))}${rev.title ? `. The new title: "${esc(rev.title)}"` : ''}.</p></div></div>` : ''}
    ${facts(rows)}
    ${termsLines(pt)}${termsNote(pt)}
    ${linked.length ? `<div class="chips ch-rewards">${linked.map((x) => `<span class="chip">${icon('star')}<span>${esc(x.title)} · ${esc((STATE[x.state] || [x.state])[0])}</span></span>`).join('')}</div>` : ''}
    ${c.link ? `<p class="usub-line">${icon('globe')}<span>${esc(c.link)}</span></p>` : ''}
    ${!sponsored && !admin && ['draft', 'rejected'].includes(c.status) ? '<p class="field-help">An administrator sends rewards and offers to InneRISE for review.</p>' : ''}
    ${!admin && !sponsored && sent && c.state !== 'ended' ? `<p class="field-help">${c.paused ? 'An administrator can turn it back on, or withdraw it.'
      : live ? 'An administrator can turn it back on after a pause, or withdraw it.' : 'An administrator can change or withdraw it while InneRISE reviews it.'}</p>` : ''}
    ${lateReward && c.paused ? `<p class="field-help">It was paused when its challenge ended, so no one has earned it yet.${canResume ? ' Resume it and everyone who qualified earns it.' : ''}</p>` : ''}
    ${short && ['draft', 'rejected'].includes(c.status) ? `<p class="field-help">${icon('key')} Upload ${num(c.quantity - pool.codes_uploaded)} more ${c.quantity - pool.codes_uploaded === 1 ? 'code' : 'codes'} before sending it for review: one for each of the ${num(c.quantity)} available.</p>` : ''}
    ${acts ? `<div class="ch-actions">${acts}</div>` : ''}
  </article>`;
}
// What a revision changes, in words.
const PART_NAMES = { title: 'title', summary: 'summary', link: 'link', image_path: 'picture', country: 'area', region: 'area', city: 'area',
  starts_on: 'dates', ends_on: 'dates', quantity: 'number available', per_person: 'number per person' };
const changedParts = (rev) => [...new Set(Object.keys(rev).map((k) => PART_NAMES[k] || 'details'))];
const listWords = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const campaignGroups = (list) => [['Live and scheduled', ['live', 'scheduled', 'approved', 'paused']], ['Drafts and review', ['draft', 'submitted', 'rejected']],
  ['Ended and withdrawn', ['ended', 'withdrawn']]].map(([t, states]) => [t, list.filter((c) => states.includes(c.state))]).filter(([, l]) => l.length);

function sponsoredPage() {
  const o = currentOrg();
  const head = pageHead('Sponsored Challenges', 'Challenges you sponsor, open to everyone on InneRISE. InneRISE reviews each one before it goes live.',
    `<button class="btn btn-primary" data-act="sp-new">${icon('plus')}<span>New Sponsored Challenge</span></button>`);
  const wait = pageBody(['campaigns']);
  if (wait) return head + partnerVerifyNote(o) + wait;
  const { list, details } = S.data.campaigns;
  const mine = list.filter((c) => c.kind === 'sponsored_challenge');
  const body = mine.length
    ? campaignGroups(mine).map(([t, l]) => `${label(t)}<div class="ch-list">${l.map((c) => campaignCard(c, list, details)).join('')}</div>`).join('')
    : `<section class="glass list">${emptyRow('trophy', 'No Sponsored Challenges yet', 'Write one: what counts, the target and the dates. Send it to InneRISE for review, and it goes live on its start date.',
      `<button class="btn btn-sm" data-act="sp-new">${icon('plus')}<span>New Sponsored Challenge</span></button>`)}</section>`;
  return `${head}${partnerVerifyNote(o)}${body}${partnerPromiseCard()}`;
}

function offersPage() {
  const o = currentOrg();
  const head = pageHead('Rewards & offers', 'Offers people claim in the app, and rewards for finishing your Sponsored Challenges. InneRISE reviews each one.',
    `<button class="btn btn-primary" data-act="of-new">${icon('plus')}<span>New offer</span></button>
     <button class="btn" data-act="ar-new">${icon('star')}<span>New challenge reward</span></button>`);
  const wait = pageBody(['campaigns', 'sponsorTerms']);
  if (wait) return head + partnerVerifyNote(o) + wait;
  const { list, details } = S.data.campaigns;
  const mine = list.filter((c) => c.kind === 'reward_offer');
  const body = mine.length
    ? campaignGroups(mine).map(([t, l]) => `${label(t)}<div class="ch-list">${l.map((c) => campaignCard(c, list, details)).join('')}</div>`).join('')
    : `<section class="glass list">${emptyRow('gift', 'No rewards or offers yet', 'Make an offer people can claim for a code, like a free class or a discount. InneRISE reviews it, then it shows in the app.',
      `<button class="btn btn-sm" data-act="of-new">${icon('plus')}<span>New offer</span></button>`)}</section>`;
  return `${head}${partnerVerifyNote(o)}${sponsorTermsCard()}${body}
    <p class="foot-note">${icon('shield')}<span>Each code goes privately to the one person who claims or earns it, and works once. Codes already given out still work after an offer ends, is paused or is withdrawn.</span></p>`;
}

function partnerPromiseCard() {
  const opts = S.data.options;
  if (opts == null && !inflight.has('options')) need(['options']);
  const minors = !opts || opts.hidden_from_under_18;
  return `${label('How InneRISE Partners works')}<section class="glass card privacy"><div class="privacy-cols">
    <div><h3 class="privacy-head">${ring('eye', 'sm')}What you see</h3><ul class="ticks">${['Counts by day: views, opens, claims, joins and codes used',
      'A first name, only from someone who chose to share it with you', 'Results of people who chose to share them, once a challenge is final']
      .map((t) => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul></div>
    <div><h3 class="privacy-head">${ring('eyeoff', 'sm')}What you never see</h3><ul class="ticks never">${['Anyone under 18 by name',
      'Health or activity records, or daily numbers', 'Where people are, or anything else in the app']
      .map((t) => `<li>${icon('x')}<span>${esc(t)}</span></li>`).join('')}</ul></div></div>
    <p class="muted">${minors ? "Sponsored Challenges and offers aren't shown to anyone under 18. " : ''}Small counts read "fewer than" a number, so no one can be picked out.</p></section>`;
}

// One form for every kind: a Sponsored Challenge, an offer, or a reward for a Sponsored Challenge.
function campaignForm(kind, rtype, c, sponsors) {
  // Editing a live one again starts from the changes already waiting for InneRISE.
  const pending = c && c.revision && c.status === 'approved'
    ? Object.fromEntries(['title', 'summary', 'link', 'country', 'region', 'city', 'starts_on', 'ends_on', 'quantity', 'per_person']
      .filter((k) => k in c.revision).map((k) => [k, c.revision[k]])) : {};
  const v = c ? { ...c, ...pending } : {};
  const sponsored = kind === 'sponsored_challenge';
  const approved = !!(c && c.approved_at);
  const rules = sponsored ? (v.challenge || { metric: 'steps', mode: 'participation', days: 30, starts_on: dayIn(orgTz(), 7), max_people: null }) : null;
  const sent = c && c.status === 'approved';
  const waiting = c && c.status === 'submitted';
  const area = `<div class="form-grid">
      <label class="field"><span class="field-label">Country</span><select class="input" name="country"><option value="">Everywhere</option>${COUNTRIES
        .map(([k, n]) => `<option value="${k}"${k === v.country ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">State or region (optional)</span><input class="input" name="region" maxlength="100" value="${esc(v.region || '')}"></label>
      <label class="field span-2"><span class="field-label">City (optional)</span><input class="input" name="city" maxlength="100" value="${esc(v.city || '')}"></label>
    </div>`;
  const codeChoice = (locked) => `<fieldset class="kind-choice"${locked ? ' disabled' : ''}><legend class="field-label">Codes</legend><div class="kind-options">
      ${[['generated', 'key', 'InneRISE makes them', 'A new code for each person'], ['pool', 'enroll', 'Upload your own', 'From your till or booking system']]
        .map(([k, ic, t, s]) => `<label class="kind-opt"><input type="radio" name="code_source" value="${k}"${k === (v.code_source || 'generated') ? ' checked' : ''}>
          <span class="kind-card">${ring(ic, 'sm')}<span class="kind-text"><strong>${t}</strong><small>${s}</small></span></span></label>`).join('')}</div></fieldset>`;
  let terms = '';
  if (sponsored) {
    terms = `${approved ? `<div class="explain">${ring('shield', 'sm')}<p>InneRISE approved its rules and dates, so they stay as they are. You can change the words, the link and the area.</p></div>` : ''}
      ${ruleFields(rules, { locked: approved })}
      ${maxField(rules, approved ? ' disabled' : '')}`;
  } else if (rtype === 'offer') {
    terms = `<div class="form-grid">
        <label class="field"><span class="field-label">Starts on</span><input class="input" name="starts_on" type="date" value="${esc(v.starts_on || dayIn(orgTz(), 1))}"></label>
        <label class="field"><span class="field-label">Ends on</span><input class="input" name="ends_on" type="date" value="${esc(v.ends_on || dayIn(orgTz(), 61))}"></label>
        <label class="field"><span class="field-label">How many in all</span><input class="input" name="quantity" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.quantity ?? 100)}"></label>
        <label class="field"><span class="field-label">How many per person</span><input class="input" name="per_person" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.per_person ?? 1)}"></label>
      </div>${codeChoice(!!c)}`;
  } else {
    terms = `${c ? `<p class="static-value">${icon('trophy')}<span>For ${esc(v.for_title || 'its Sponsored Challenge')}</span></p>`
      : `<label class="field"><span class="field-label">For which Sponsored Challenge</span><select class="input" name="for_campaign">${sponsors
        .map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label>`}
      ${approved ? `<div class="explain">${ring('shield', 'sm')}<p>InneRISE approved who earns it and how many there are, so those stay as they are.</p></div>` : ''}
      <div class="form-grid">
        <label class="field"><span class="field-label">Who earns it</span><select class="input" name="earns"${approved ? ' disabled' : ''}>${[['goal', EARNS.goal], ['finish', EARNS.finish]]
          .map(([k, t]) => `<option value="${k}"${k === (v.earns || 'goal') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">How many there are</span><input class="input" name="quantity" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.quantity ?? 100)}"${approved ? ' disabled' : ''}></label>
      </div>${codeChoice(!!c)}`;
  }
  return `<label class="field"><span class="field-label">Title</span><input class="input" name="title" maxlength="${sponsored ? 60 : 80}" value="${esc(v.title || '')}" data-autofocus></label>
    <label class="field"><span class="field-label">Summary (optional)</span><textarea class="input" name="summary" rows="2" maxlength="280">${esc(v.summary || '')}</textarea></label>
    <label class="field"><span class="field-label">Link (optional)</span><input class="input" name="link" type="url" inputmode="url" maxlength="300" autocapitalize="off" spellcheck="false" placeholder="https://" value="${esc(v.link || '')}"></label>
    ${rtype === 'achievement' ? '' : `<div class="stack-sm"><span class="field-label">Where it shows</span>${area}</div>`}
    ${terms}
    ${sent ? '<p class="field-help">It stays live as it is. Your changes go to InneRISE for review, and show in the app once approved.</p>'
    : waiting ? '<p class="field-help">It stays with InneRISE for review, with your changes, and counts as sent again now.</p>'
      : '<p class="field-help">It\'s saved as a draft. Send it to InneRISE for review when it\'s ready.</p>'}`;
}
function readCampaign(form, kind, rtype, c) {
  const f = form.elements;
  const title = f.title.value.trim();
  if (title.length < 2) throw new Error('Give it a title of at least 2 characters.');
  const d = { title, summary: f.summary.value.trim() || null, link: f.link.value.trim() || null };
  if (rtype !== 'achievement') Object.assign(d, { country: f.country.value || null, region: f.region.value.trim() || null, city: f.city.value.trim() || null });
  const int = (el, what) => { const n = Number(String(el.value || '').trim()); if (!Number.isInteger(n)) throw new Error(`Enter ${what} as a whole number.`); return n; };
  const approved = !!(c && c.approved_at);
  if (kind === 'sponsored_challenge') {
    if (!approved) Object.assign(d, readRules(form), { max_people: readMax(form) });
  } else if (rtype === 'offer') {
    Object.assign(d, { starts_on: f.starts_on.value || null, ends_on: f.ends_on.value || null, quantity: int(f.quantity, 'how many in all'),
      per_person: int(f.per_person, 'how many per person') });
    if (!c) d.code_source = f.code_source.value;
  } else {
    if (!approved) Object.assign(d, { earns: f.earns.value, quantity: int(f.quantity, 'how many there are') });
    if (!c) Object.assign(d, { reward_type: 'achievement', for_campaign: f.for_campaign.value, code_source: f.code_source.value });
  }
  if (kind === 'reward_offer' && rtype === 'offer' && !c) d.reward_type = 'offer';
  return d;
}
function openCampaignForm(kind, rtype, c) {
  const sponsors = (S.data.campaigns ? S.data.campaigns.list : []).filter((x) => x.kind === 'sponsored_challenge' && x.status !== 'withdrawn' && x.state !== 'ended');
  if (rtype === 'achievement' && !c && !sponsors.length) {
    openModal({ title: 'Make a Sponsored Challenge first', body: '<p>A challenge reward belongs to one of your Sponsored Challenges. Make that first, then add its reward here.</p>', cancel: 'OK' });
    return;
  }
  const what = kind === 'sponsored_challenge' ? 'Sponsored Challenge' : rtype === 'achievement' ? 'challenge reward' : 'offer';
  openModal({
    title: c ? `Edit ${esc(c.title)}` : `New ${what}`,
    body: (kind === 'reward_offer' ? sponsorTermsCard('modal') : '') + campaignForm(kind, rtype, c, sponsors),
    submit: c ? 'Save changes' : 'Save draft',
    onOpen: (form) => { if (kind === 'sponsored_challenge') wireRules(form); },
    onSubmit: async (form) => {
      const d = readCampaign(form, kind, rtype, c);
      if (c) {
        const res = await rpc.campaignEdit(c.id, d);
        toast(!res.changed || !res.changed.length ? 'Nothing changed.'
          : res.status === 'approved' ? (res.revision ? 'Saved. Your changes are with InneRISE for review; the live version stays up until then.'
            : 'Saved. It matches the live version again, so nothing waits for review.')
            : res.status === 'submitted' ? `Saved. ${d.title} is still with InneRISE for review, with your changes.` : `Saved ${d.title}.`);
      } else {
        await rpc.campaignCreate(org(), kind, d);
        toast(`Saved ${d.title} as a draft.`);
      }
      await refresh(['campaigns'], ['summary', 'partner', 'perf']);
    },
  });
}
const findCampaign = (id) => (S.data.campaigns ? S.data.campaigns.list.find((c) => c.id === id) : null);

function performancePage() {
  const head = pageHead('Performance', 'How your Sponsored Challenges and offers are doing, day by day.');
  const wait = pageBody(['campaigns']);
  if (wait) return head + wait;
  const list = S.data.campaigns.list.filter((c) => c.approved_at);
  if (!list.length) {
    return `${head}<section class="glass list">${emptyRow('trend', 'Nothing to show yet', 'Performance shows here once InneRISE approves a Sponsored Challenge or an offer.')}</section>`;
  }
  if (!list.some((c) => c.id === S.perfCampaign)) {
    S.perfCampaign = (list.find((c) => c.state === 'live' && c.kind === 'sponsored_challenge') || list.find((c) => c.state === 'live') || list[0]).id;
    delete S.data.perf;
  }
  const picker = `<div class="toolbar"><label class="field-inline" for="perf-pick"><span>Show</span>
    <select id="perf-pick" class="input" data-change="perf-pick">${list.map((c) => `<option value="${esc(c.id)}"${c.id === S.perfCampaign ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label></div>`;
  const wait2 = pageBody(['perf']);
  if (wait2) return head + picker + wait2;
  const p = S.data.perf;
  if (p.campaign.id !== S.perfCampaign) { delete S.data.perf; return head + picker + loading(); }
  const n = p.min_group;
  const kind = p.campaign.kind === 'sponsored_challenge' ? 'challenge' : p.campaign.reward_type;
  const cols = kind === 'challenge' ? [['views', 'Views'], ['opens', 'Opens'], ['joins', 'Joined'], ['completions', 'Completed']]
    : kind === 'offer' ? [['views', 'Views'], ['opens', 'Opens'], ['claims', 'Claimed'], ['redemptions', 'Codes used']] : [['redemptions', 'Codes used']];
  const tiles = cols.map(([k, t]) => `<div class="glass stat static"><span class="stat-num">${floored(p.totals[k])}</span><span class="stat-title">${esc(t)}</span><span class="stat-sub">added up by day</span></div>`).join('');
  let extra = '';
  if (p.codes) {
    const c = p.codes;
    const cells = [['Available', c.quantity], ['Earned', c.earned], ['Given out', c.issued], ['Used', c.redeemed], ['Left to give', c.remaining], ['Codes not given yet', c.codes_left]]
      .filter(([k, v]) => v != null && !(k === 'Codes not given yet' && String(v) === String(c.remaining)));
    extra += `${label('Codes')}<section class="glass card">${facts(cells.map(([k, v]) => [k, floored(v)]))}</section>`;
  }
  if (p.challenge) {
    const ch = p.challenge;
    extra += `${label('The challenge')}<section class="glass card">${ch.started ? facts([['Joined', floored(ch.joined)], ['Took part', floored(ch.took_part)],
      ['Reached the target', ch.goal_met == null ? 'No target' : floored(ch.goal_met)]]) : '<p class="muted">It starts in the app once InneRISE approves it.</p>'}
      ${ch.final ? (ch.named.length ? `<h3 class="privacy-head">People who shared their result with you</h3><div class="list inset">${ch.named.map((x) => `<div class="row">
        <span class="avatar" aria-hidden="true">${esc((x.first_name || '?')[0].toUpperCase())}</span><div class="grow uname">${esc(x.first_name || 'Someone')}</div>
        ${x.goal_met ? `<span class="chip chip-accent">${icon('star')}<span>Reached the target</span></span>` : ''}</div>`).join('')}</div>` : '<p class="muted">No one chose to share their result with you.</p>')
    : '<p class="field-help">Results of people who chose to share them show here once the challenge is final.</p>'}</section>`;
  }
  const days = [...p.days].reverse();
  const shownDays = S.perfAll ? days : days.slice(0, 14);
  const table = days.length ? `<section class="glass list perf" aria-label="By day" style="--cols:${cols.length}">
      <div class="list-head perf-row" aria-hidden="true"><span>Day</span>${cols.map(([, t]) => `<span>${esc(t)}</span>`).join('')}</div>
      ${shownDays.map((d) => `<div class="row perf-row"><span class="perf-day">${esc(fmtDay(d.day, true))}</span>${cols.map(([k, t]) => `<span class="perf-num"><span class="m-label">${esc(t)}</span>${floored(d[k])}</span>`).join('')}</div>`).join('')}
    </section>${days.length > shownDays.length ? `<div class="more-wrap"><button class="btn" data-act="perf-all">Show all ${num(days.length)} days</button></div>` : ''}`
    : `<section class="glass list">${emptyRow('trend', 'No days counted yet', 'A day shows here once someone sees, joins, claims or uses it.')}</section>`;
  return `${head}${picker}<div class="stats${cols.length === 1 ? ' stats-1' : cols.length === 3 ? ' stats-3' : ''} report-tiles">${tiles}</div>${extra}
    ${label('By day')}${table}
    <p class="foot-note">${icon('shield')}<span>Counts only, rounded to the nearest 5. A count under ${num(n)} reads "fewer than ${num(n)}", and one that could give a smaller count away reads "at least". Codes used are exact: each one was checked at your counter. Views and opens count each person once a day.</span></p>`;
}

function profilePage() {
  const o = currentOrg();
  const head = pageHead('Business profile & plan', `How ${o.name} shows with its Sponsored Challenges and offers, and the plan you'd like.`);
  const wait = pageBody(['partner']);
  if (wait) return head + wait;
  const p = S.data.partner;
  const admin = amAdmin();
  const planner = admin || isBillingOf(o);
  const about = admin
    ? `<form data-form="partner-about" data-keep="about" class="stack" novalidate>
        <label class="field"><span class="field-label">About ${esc(o.name)}</span><textarea id="about" class="input" name="about" rows="3" maxlength="280" placeholder="A neighborhood gym with classes for every level.">${esc(p.profile.about || '')}</textarea>
        <span class="field-help">One or two sentences, up to 280 characters. It shows with your Sponsored Challenges and offers.</span></label>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save</button></div></form>`
    : `<p>${p.profile.about ? esc(p.profile.about) : '<span class="muted">No description yet.</span>'}</p><p class="field-help">An administrator can change it.</p>`;
  const current = planName(p.plan);
  const plan = planner
    ? `<form data-form="partner-plan" class="stack" novalidate>
        <fieldset class="kind-choice"><legend class="field-label">Plan</legend><div class="kind-options plan-options">${PLANS.map(([k, t]) => `<label class="kind-opt">
          <input type="radio" name="plan" value="${k}"${PLAN_KEY[k] === p.plan ? ' checked' : ''}>
          <span class="kind-card">${ring(k === 'local' ? 'pin' : k === 'regional' ? 'layers' : 'globe', 'sm')}<span class="kind-text"><strong>${t}</strong></span></span></label>`).join('')}</div></fieldset>
        <p class="field-help">${current ? `You asked for ${esc(current)}. ` : 'No plan chosen yet. '}Only the plan's name is saved. InneRISE confirms it with you.</p>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save plan</button></div></form>`
    : '<p class="muted">Your administrators and billing contact choose the plan.</p>';
  return `${head}
    <section class="glass card company-card">
      <div class="company-main">${ring('store', 'lg')}<div class="company-text"><h2 class="company-name">${esc(p.org.name)}</h2>
        <div class="chips">${p.org.status === 'active' ? '<span class="chip chip-ok"><span class="dot"></span>Verified partner</span>'
    : `<span class="chip chip-wait">${icon('clock')}<span>Being verified</span></span>`}${p.org.website ? `<span class="chip">${icon('globe')}<span>${esc(p.org.website.replace(/^https:\/\//, ''))}</span></span>` : ''}</div></div></div>
      ${admin ? `<div class="company-actions"><a class="btn" href="${esc(sectionUrl('settings'))}" data-nav>${icon('gear')}<span>Name, website and contact</span></a></div>` : ''}
    </section>
    ${label('Profile')}<section class="glass card">${about}</section>
    ${label('Plan')}<section class="glass card">${plan}</section>
    ${partnerRolesCard()}`;
}
function partnerRolesCard() {
  const rows = [['crown', 'Administrators', 'Everything here, and the only ones who send rewards and offers to InneRISE for review.'],
    ['trophy', 'Challenge coordinators', 'Sponsored Challenges: write them, send them for review, pause and withdraw them.'],
    ['gift', 'Rewards managers', 'Rewards and offers: write them, upload codes, and confirm prizes at the counter.'],
    ['scan', 'Can Redeem Prizes', 'Confirm prizes at the counter, and nothing else.'],
    ['card', 'Billing contact', 'Choose the plan.']];
  return `${label('Who does what')}<section class="glass card roles-card"><ul class="role-list">${rows.map(([ic, t, d]) => `<li>${ring(ic, 'sm')}
    <div><strong>${esc(t)}</strong><p class="muted">${esc(d)}</p></div></li>`).join('')}</ul>
    ${amAdmin() ? '<p class="field-help">Give these roles from a person\'s menu in People.</p>' : ''}</section>`;
}

// The Prize Wallet (078): the counter, and the prizes a giver's managers look after -----------------------------
// Words for the prize terms. Every prize is used once at the counter: no amounts, balances or passes with several uses.
const PRIZE_TYPES = [['membership', 'Membership or day/guest pass'], ['service', 'Class, round or experience'], ['discount', 'Discount'],
  ['free_item', 'Free item'], ['physical', 'Merchandise or prize to pick up or deliver']];
const PRIZE_TYPE = Object.fromEntries(PRIZE_TYPES);
const BARCODES = [['code128', 'Code 128'], ['qr', 'QR code'], ['ean13', 'EAN-13'], ['upca', 'UPC-A'], ['code39', 'Code 39'], ['none', 'No barcode: the code as text']];
const FULFILL = [['none', 'At the counter'], ['pickup', 'Picked up at one place'], ['delivery', 'Delivered to the winner'], ['either', 'Pickup or delivery: the winner chooses'],
  ['contact', 'Email the business to claim']];
const TOPIC = { not_accepted: 'Not accepted at the counter', not_mine: 'Used by someone else',
  expired_early: 'Expired too early', not_received: 'Never received', other: 'Something else' };
const methodChip = (m) => (m === 'business_code' ? `<span class="chip">${icon('tag')}<span>Your business's code</span></span>`
  : `<span class="chip chip-accent">${icon('ticket')}<span>InneRISE voucher</span></span>`);
const ucFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const placeNames = () => (S.data.view && S.data.view.units) || [];
function termsLine(t, whose = 'your business') {
  const how = t.method === 'voucher' ? 'InneRISE voucher' : t.code_mode === 'shared' ? `${whose} code, the same for every winner`
    : `${whose} codes, one for each winner`;
  const where = Array.isArray(t.units) ? plural(t.units.length, 'place', 'places') : 'every place';
  const until = t.valid_until ? `until ${fmtDay(t.valid_until, true)}` : t.valid_days ? `${plural(t.valid_days, 'day', 'days')} after winning` : '';
  const get = t.fulfillment === 'pickup' ? 'picked up' : t.fulfillment === 'delivery' ? 'delivered' : t.fulfillment === 'either' ? 'picked up or delivered'
    : t.fulfillment === 'contact' ? `claimed by email to ${t.contact_email}` : '';
  return [PRIZE_TYPE[t.prize_type] || t.prize_type, how, where, get, until].filter(Boolean).join(' · ');
}
// Prize Wallet terms on a 072 reward or a 074 offer card: what they say, codes, and InneRISE's review of a partner's.
function termsLines(pt) {
  if (!pt) return '';
  const t = pt.live || pt.next;
  if (!t) return '';
  const list = (pt.live && pt.live.code_mode === 'list') || (pt.next && pt.next.code_mode === 'list');
  return `<div class="terms-lines">${pt.live ? `<span class="usub-line terms-line">${icon('tag')}<span>Prizes: ${esc(ucFirst(termsLine(pt.live)))}</span></span>` : ''}
    ${pt.next && pt.next.state === 'waiting' ? `<span class="usub-line terms-line">${icon('clock')}<span>New prize terms are with InneRISE for review: ${esc(termsLine(pt.next))}</span></span>` : ''}
    ${list ? `<span class="usub-line">${icon('key')}<span>${pt.codes ? `${plural(pt.codes, 'business code', 'business codes')} uploaded · ${num(pt.codes_left)} not given out yet` : 'No business codes uploaded yet'}</span></span>` : ''}
    ${pt.waiting_for_code ? `<span class="usub-line warn-line">${icon('key')}<span>${plural(pt.waiting_for_code, 'winner is', 'winners are')} waiting for a business code. Upload more and they get theirs at once.</span></span>` : ''}</div>`;
}
const hasTerms = (pt) => !!(pt && (pt.live || pt.next));
const listCodes = (pt) => !!(pt && ((pt.live && pt.live.code_mode === 'list') || (pt.next && pt.next.code_mode === 'list')));
// The Sponsor Reward Terms (072's terms round): one of the organization's administrators accepts them, once for each version,
// before new prize terms, business codes or a partner's reward offers go out. The version label goes back as it came.
const SPONSOR_TERMS = 'Before offering rewards, your business accepts the Sponsor Reward Terms: you provide and fulfill each reward, keep offers accurate and available, set expiration terms, follow applicable laws, and handle customer service.';
const sponsorTermsDue = () => { const st = S.data.sponsorTerms; return !!st && !st.none && !st.accepted; };
function sponsorTermsCard(where = 'page') {
  if (!sponsorTermsDue()) return '';
  return `<section class="${where === 'modal' ? 'sponsor-terms in-modal' : 'glass card sponsor-terms'}" data-sponsor-terms>${ring('shield', 'sm')}
    <div class="grow"><h2 class="sponsor-terms-title">Sponsor Reward Terms</h2><p>${esc(SPONSOR_TERMS)}</p>
      ${amAdmin() ? `<div class="ch-actions"><button type="button" class="btn btn-primary" data-act="sponsor-accept">${icon('check')}<span>Accept</span></button></div>`
    : '<p class="field-help">An administrator needs to accept these.</p>'}</div></section>`;
}
function sponsorTermsAccepted() {
  const st = S.data.sponsorTerms;
  if (!st || st.none || !st.accepted) return '';
  return `<p class="usub-line sponsor-terms-ok">${icon('check')}<span>Sponsor Reward Terms accepted${st.accepted_at ? ` on ${esc(dayAt(st.accepted_at))}` : ''}${st.accepted_by ? ` by ${esc(st.accepted_by)}` : ''}.</span></p>`;
}
const termsNote = (pt) => (pt && pt.next && pt.next.state === 'rejected' ? `<div class="review-note sent-back">${icon('mail')}<div>
  <div class="review-note-label">Note from InneRISE about the prize terms</div><p>${esc(pt.next.review_note || 'InneRISE sent the prize terms back.')}</p></div></div>` : '');

// The counter -----------------------------------------------------------------------------------------------------------
// Two steps: check (reads only), then an explicit Confirm. One request key per confirm attempt, kept until an answer comes;
// a confirm with no answer asks the status function with the same key before it may be sent again.
const PLACE_KEY = 'innerise.counter.place.';
const cameraOk = () => typeof window.BarcodeDetector === 'function' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const innerCode = (code) => /^IR1[A-HJ-NP-Z2-9]{10}\d{6}$|^IR[A-HJ-NP-Z2-9]{12}$/.test(String(code).replace(/[\s-]/g, '').toUpperCase());
const partnerDesk = (o = currentOrg()) => o.kind === 'partner' && redeemerOf(o); // 074's counter, for every redeemer of a partner
function newKey() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}
// The places this person may confirm at, as the server lists them (prize_staff_places.units, by name: every place for
// someone whose role covers the whole organization, otherwise their places and the places under them), after "any place"
// when the role covers the whole organization.
// Two places can share a name (a Front desk at each clinic): each of those says where it is (the place above it, from
// this page's places for an administrator, otherwise the server's parent_name).
function counterPlaces() {
  const p = S.data.places;
  if (!p) return [];
  const units = p.units || [];
  const tree = amAdmin() ? placeNames() : [];
  const twice = new Set(units.map((u) => u.name).filter((n, i, all) => all.indexOf(n) !== i));
  const where = (u) => { const t = tree.find((x) => x.id === u.id); return t && t.parent_id ? unitPath(t.parent_id, tree) : (u.parent_name || ''); };
  return [...(p.whole_org ? [{ id: '', name: `Any place in the ${words().org}` }] : []),
    ...units.map((u) => ({ id: u.id, name: twice.has(u.name) && where(u) ? `${u.name} · ${where(u)}` : u.name }))];
}
function counterPlace() {
  const list = counterPlaces();
  if (!list.length) return null;
  const saved = S.counterPlace[S.orgId] ?? store.get(PLACE_KEY + S.orgId);
  const hit = list.find((x) => x.id === saved);
  return (hit || list[0]).id || null;
}
const placeName = (id) => { const x = counterPlaces().find((p) => p.id === (id || '')); return x ? x.name : ''; };

function counterPage() {
  const o = currentOrg();
  const head = pageHead('Redeem prizes', 'Scan or type a prize code. Checking uses nothing: a prize is used only when you press Confirm.');
  const wait = pageBody(amAdmin() ? ['places', 'view'] : ['places']);
  if (wait) return head + wait;
  const places = counterPlaces();
  if (!places.length) {
    return `${head}<section class="glass list">${emptyRow('scan', 'No place to redeem at yet', 'Your Can Redeem Prizes role is for a place that is no longer there. Ask an administrator to give it to you again.')}</section>`;
  }
  const at = counterPlace();
  const picker = places.length > 1
    ? `<label class="field"><span class="field-label">Redeeming at</span>
        <select id="counter-place" class="input" data-change="counter-place">${places.map((p) => `<option value="${esc(p.id)}"${p.id === (at || '') ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <span class="field-help">This counter remembers it. Prizes good at only some places check against it.</span></label>`
    : `<p class="counter-at">${icon('pin')}<span>Redeeming at <strong>${esc(places[0].name)}</strong></span></p>`;
  const log = (S.counterLog || []).filter((x) => x.org === S.orgId);
  return `${head}
    <div class="redeem-grid">
      <section class="glass card redeem-card">
        ${picker}
        <form data-form="counter-check" data-keep="counter" class="stack counter-form" novalidate>
          <label class="field"><span class="field-label">Prize code</span>
            <input id="redeem-code" class="input redeem-input" name="code" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"
              maxlength="200" enterkeyhint="go" placeholder="Scan, type or paste the code" data-autofocus></label>
          <p class="field-help">A USB or Bluetooth scanner types into this box and checks the code by itself.</p>
          <p class="form-error" role="alert" hidden></p>
          <div class="form-actions start"><button class="btn btn-primary" type="submit">${icon('scan')}<span>Check code</span></button>
            ${cameraOk() ? `<button type="button" class="btn" data-act="counter-camera">${icon('camera')}<span>Scan with camera</span></button>` : ''}</div>
        </form>
        ${counterResult()}
      </section>
      <section class="glass card howto">${ring('shield')}<h2 class="card-title">How it works</h2>
        <ol class="counter-steps">
          <li><strong>Scan or type the code.</strong> The QR code or barcode in the winner's InneRISE app, the code under it, or a code from your business.</li>
          <li><strong>Check it.</strong> You see what the prize is and whether it can be used here. Nothing is used yet.</li>
          <li><strong>Confirm.</strong> Press Confirm use when you hand it over. You get a confirmation number.</li>
        </ol>
        <p class="muted">You see the prize, and the winner's first name only when the rules allow it. Never anyone under 18, and never health records.</p></section>
    </div>
    ${log.length ? `${label('At this counter just now')}<section class="glass list counter-log">${log.map((x) => `<div class="row">${ring(x.kind === 'used' ? 'check' : 'x', 'xs')}
      <div class="grow"><div class="uname code-mono">${esc(x.kind === 'used' ? x.confirmation : x.code)}</div><div class="usub">${esc(x.text)}</div></div></div>`).join('')}</section>` : ''}
    ${o.kind === 'partner' && !verified(o) ? `<p class="foot-note">${icon('clock')}<span>Codes are given out once InneRISE verifies ${esc(o.name)} and approves an offer.</span></p>` : ''}`;
}

// What the counter shows after a check or a confirm.
function counterResult() {
  const c = S.counter;
  if (!c || c.org !== S.orgId) return '';
  const a = c.answer || {};
  const p = a.prize || {};
  const title = a.title || p.title || '';
  const code = `<p class="redeem-code">${esc(c.shown)}</p>`;
  const bad = (head, help, extra = '') => `<div class="redeem-result bad" role="status">${ring('x', 'lg')}<div class="grow">${code}
    <h2 class="redeem-title">${esc(head)}</h2><p class="muted">${esc(help)}</p>${extra}
    <div class="counter-actions"><button class="btn" data-act="counter-clear">Check another code</button></div></div></div>`;
  if (c.step === 'checking') return `<div class="redeem-result wait" role="status"><span class="spinner" aria-hidden="true"></span><div>${code}<p class="muted">Checking…</p></div></div>`;
  if (c.step === 'error') {
    const e = c.error;
    if (e.code === 'already_redeemed') {
      const on = e.data && e.data.redeemed_on;
      return bad(on ? `Already used on ${fmtDay(on, true)}` : 'Already used', 'Each code works once. The winner can see it in their InneRISE app.',
        e.data && e.data.confirmation ? `<p class="usub-line">${icon('check')}<span>Confirmation ${esc(e.data.confirmation)}</span></p>` : '');
    }
    const heads = { not_valid: 'Not a valid code here', code_expired: 'That code has changed', shared_code: 'One code for every winner',
      rate_limited: 'Checking is paused until tomorrow', not_allowed: "You can't confirm prizes here", unit: 'That place is no longer there' };
    return bad(heads[e.code] || "That code couldn't be checked", e.message);
  }
  const facts2 = facts([
    ['For', a.first_name ? esc(a.first_name) : '<span class="muted">Name not shared</span>'],
    ['Place', esc(c.route === 'partner' ? currentOrg().name : placeName(c.place) || 'Any place')],
    p.expires_at && ['Good until', esc(dayAt(p.expires_at))],
    p.fulfillment && p.fulfillment.choice && ['Winner chose', esc(p.fulfillment.choice === 'pickup' ? 'Pickup' : 'Delivery')],
    p.fulfillment && p.fulfillment.offered === 'contact' && ['How they get it', 'Email the business to claim'],
    p.contact_email && ['Contact email', `<a class="link-btn" href="mailto:${esc(p.contact_email)}">${esc(p.contact_email)}</a>`],
  ]);
  const about = `${p.method ? `<div class="chips">${methodChip(p.method)}${p.prize_type ? `<span class="chip"><span>${esc(PRIZE_TYPE[p.prize_type] || p.prize_type)}</span></span>` : ''}</div>` : ''}
    ${facts2}${p.instructions ? `<p class="counter-ins">${esc(p.instructions)}</p>` : ''}
    ${p.label ? `<p class="field-help">${esc(p.label)}</p>` : ''}
    ${p.method === 'business_code' ? `<p class="field-help">This is your business's own code: use it at your register as you always do, then confirm it here.</p>` : ''}`;
  if (c.step === 'blocked') {
    const why = PRIZE_REASON[c.reason] || "This prize can't be used right now.";
    return `<div class="redeem-result bad" role="status">${ring('x', 'lg')}<div class="grow">${code}
      <h2 class="redeem-title">Can't be used: ${esc(title)}</h2><p class="muted">${esc(why)}</p>${about}
      <div class="counter-actions"><button class="btn" data-act="counter-clear">Check another code</button></div></div></div>`;
  }
  if (c.step === 'refused') return bad(`Not used: ${title || 'this prize'}`, c.error.message);
  if (['ready', 'confirming', 'retry'].includes(c.step)) {
    const again = c.step === 'retry';
    return `<div class="redeem-result ok" role="status">${ring('check', 'lg')}<div class="grow">${code}
      <h2 class="redeem-title">${again ? 'Not used yet' : 'Ready to use'}: ${esc(title)}</h2>
      ${again ? '<p class="muted">InneRISE has no record of that confirm, so nothing was used. You can confirm it now.</p>' : ''}${about}
      <div class="counter-actions"><button class="btn btn-primary btn-lg" data-act="counter-confirm"${c.step === 'confirming' ? ' aria-busy="true"' : ''}>${icon('check')}<span>${again ? 'Confirm again' : 'Confirm use'}</span></button>
        <button class="btn" data-act="counter-clear">Not now</button></div>
      <p class="field-help">Confirm only when you hand it over. Checking it didn't use it.</p></div></div>`;
  }
  if (c.step === 'unknown' || c.step === 'offline') {
    const off = c.step === 'offline';
    return `<div class="redeem-result wait" role="status">${off ? ring('clock', 'lg') : '<span class="spinner" aria-hidden="true"></span>'}<div class="grow">${code}
      <h2 class="redeem-title">${off ? "We can't tell yet whether it was used" : 'Checking whether it went through…'}</h2>
      <p class="muted">${off ? "We still can't reach InneRISE. Don't confirm it again: check again once you're back online, and you'll see whether it was used."
    : "We sent the confirm but didn't hear back. Asking InneRISE what happened, before anything is sent again."}</p>
      ${off ? `<div class="counter-actions"><button class="btn btn-primary" data-act="counter-status">${icon('refresh')}<span>Check again</span></button></div>` : ''}</div></div>`;
  }
  if (c.step === 'done') {
    const r = c.result || {};
    const when = r.used_at || r.redeemed_at;
    return `<div class="counter-done" role="status">${ring('check', 'lg')}
      <p class="counter-eyebrow">Confirmation number</p>
      <p class="code-big counter-conf">${esc(r.confirmation || '')}</p>
      <h2 class="redeem-title">Used: ${esc(r.title || title)}</h2>
      <p class="muted">${esc([r.first_name && `For ${r.first_name}`, c.route === 'partner' ? '' : placeName(c.place), when && clockAt(when)].filter(Boolean).join(' · '))}</p>
      <div class="counter-actions"><button class="btn btn-primary" data-act="counter-next">${icon('scan')}<span>Next code</span></button></div></div>`;
  }
  return '';
}

async function counterCheck(code) {
  const o = currentOrg();
  const orgId = S.orgId;
  const place = counterPlace();
  S.counter = { org: orgId, code, shown: code.trim().toUpperCase(), step: 'checking', place, route: 'prize', key: null };
  render();
  let a = null;
  let route = 'prize';
  try {
    if (partnerDesk(o) && !innerCode(code)) {
      // A partner's own codes go through 074's counter; a code it doesn't know may be one of the partner's business codes.
      try {
        a = await rpc.partnerRedeemCheck(orgId, code);
        route = a.prize ? 'prize' : 'partner';
      } catch (e) {
        if (e.code !== 'not_valid') throw e;
        a = await rpc.prizeCheck(orgId, code, place);
      }
      if (a.prize && a.reason === 'location' && place) a = await rpc.prizeCheck(orgId, code, place);
    } else {
      a = await rpc.prizeCheck(orgId, code, place);
    }
    if (S.orgId !== orgId || !S.counter || S.counter.code !== code) return;
    const ready = a.ready != null ? !!a.ready : a.status === 'ready';
    Object.assign(S.counter, { step: ready ? 'ready' : 'blocked', route, answer: a, reason: a.reason || (ready ? null : a.status) });
    if (!ready) counterLog('bad', code, `Can't be used: ${a.title || (a.prize || {}).title || ''}`);
  } catch (e) {
    if (await signedOut(e)) return;
    if (S.orgId !== orgId || !S.counter || S.counter.code !== code) return;
    Object.assign(S.counter, { step: 'error', error: e });
    if (['not_valid', 'code_expired', 'already_redeemed', 'shared_code'].includes(e.code)) counterLog('bad', code, e.code === 'already_redeemed' ? 'Already used' : e.message);
  }
  render();
  showCounterResult();
}
// On a phone the answer can sit below the code box: bring it into view.
function showCounterResult() {
  const el = document.querySelector('.redeem-result, .counter-done');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}
function counterLog(kind, code, text, confirmation = null) {
  S.counterLog = [{ org: S.orgId, kind, code: code.trim().toUpperCase(), text, confirmation }, ...(S.counterLog || [])].slice(0, 8);
}
async function counterConfirm() {
  const c = S.counter;
  if (!c || !['ready', 'retry'].includes(c.step)) return;
  if (!c.key) c.key = newKey(); // one key per attempt, kept until there is an answer
  c.step = 'confirming';
  render();
  try {
    const res = c.route === 'partner' ? await rpc.partnerRedeemConfirm(c.org, c.code, c.key) : await rpc.prizeConfirm(c.org, c.code, c.place, c.key);
    counterDone(c, res);
  } catch (e) {
    if (await signedOut(e)) return;
    if (e.code === 'network') { await counterStatus(); return; }
    Object.assign(c, { step: 'refused', error: e, key: null });
    counterLog('bad', c.code, `Not used: ${e.message}`);
    render();
  }
}
// The confirm got no answer: ask what became of it under the same key. Only "nothing happened" allows another confirm.
async function counterStatus() {
  const c = S.counter;
  if (!c || !c.key) return;
  c.step = 'unknown';
  render();
  try {
    const res = c.route === 'partner' ? await rpc.partnerRedeemStatus(c.org, c.key) : await rpc.prizeStatus(c.org, c.key);
    counterDone(c, res);
  } catch (e) {
    if (await signedOut(e)) return;
    if (e.code === 'not_found') c.step = 'retry';
    else if (e.code === 'network') c.step = 'offline';
    else Object.assign(c, { step: 'refused', error: e, key: null });
    render();
  }
}
function counterDone(c, res) {
  Object.assign(c, { step: 'done', result: res, key: null });
  counterLog('used', c.code, `Used: ${res.title || ''}`, res.confirmation);
  if (S.counter === c) { render(); showCounterResult(); }
}

// A camera, where the browser can read codes itself (BarcodeDetector). Nothing else is loaded for it.
async function openCamera() {
  let stream = null;
  const stop = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
  openModal({
    title: 'Scan with the camera',
    body: `<div class="cam-wrap"><video id="cam-video" class="cam-video" playsinline muted></video></div>
      <p class="field-help">Hold the code inside the frame. It checks as soon as the camera reads it; nothing is used until you confirm.</p>`,
    cancel: 'Close',
    onOpen: async (form) => {
      const video = form.querySelector('#cam-video');
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = ['qr_code', 'code_128', 'ean_13', 'upc_a', 'code_39'].filter((f) => supported.includes(f));
        const detector = new window.BarcodeDetector({ formats });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!video.isConnected) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        const look = async () => {
          if (!video.isConnected) { stop(); return; }
          try {
            const found = await detector.detect(video);
            if (found.length && found[0].rawValue) {
              stop();
              closeModal();
              const input = document.getElementById('redeem-code');
              if (input) input.value = found[0].rawValue;
              counterCheck(found[0].rawValue);
              return;
            }
          } catch { /* the next frame */ }
          setTimeout(look, 250);
        };
        look();
      } catch {
        stop();
        setError(form, "The camera couldn't start. Allow the camera for this page, or type the code instead.");
      }
    },
  });
}

// Prizes: how they look, disputes, pickups and deliveries, the report ---------------------------------------------------
// The logo winners see, its review state (shown, waiting for InneRISE, sent back; null: no logo) and InneRISE's note.
async function loadGiver() {
  const g = await rpc.prizeGiverGet(S.orgId);
  const path = g.logo_path || null;
  return { path, state: path ? g.logo_state || null : null, note: g.review_note || null, url: path ? await logos.url(path) : null };
}
// Prizes for the whole organization (disputes, pickups and deliveries, every place's uses): administrators and rewards managers
// for all of it. A rewards manager for some places sees their places' uses.
const prizesWhole = (o = currentOrg()) => isAdminOf(o) || wholeOrgRole(o, 'rewards_manager');
const reportRange = () => {
  if (!S.prizeRange || S.prizeRange.org !== S.orgId) {
    const first = prizesWhole() ? '' : (reportPlaces()[0] || {}).id || '';
    S.prizeRange = { org: S.orgId, from: addDay(dayIn(orgTz()), -29), to: dayIn(orgTz()), unit: first };
  }
  return S.prizeRange;
};
async function loadPrizeReport() {
  await ensure(['places']);
  const r = reportRange();
  const res = await rpc.prizeReport(S.orgId, r.from || null, r.to || null, r.unit || null, null, 500);
  return { ...res, range: { ...r } };
}
// Where a manager may look in the report: everywhere (whole organization), or the places they look after.
function reportPlaces() {
  if (amAdmin()) return [{ id: '', name: 'Every place' }, ...unitTree(placeNames()).map(({ unit }) => ({ id: unit.id, name: unitPath(unit.id, placeNames()) }))];
  const p = S.data.places || {};
  const units = p.units || [];
  const twice = new Set(units.map((u) => u.name).filter((n, i, all) => all.indexOf(n) !== i));
  return [...(p.manager ? [{ id: '', name: 'Every place' }] : []),
    ...units.map((u) => ({ id: u.id, name: twice.has(u.name) && u.parent_name ? `${u.name} · ${u.parent_name}` : u.name }))];
}

function prizesPage() {
  const o = currentOrg();
  const admin = amAdmin();
  const head = pageHead('Prizes', 'How your prizes look to winners, disputes, pickups and deliveries, and every use at your counters.',
    `<a class="btn" href="${esc(sectionUrl('redeem'))}" data-nav>${icon('scan')}<span>Redeem prizes</span></a>`);
  const whole = prizesWhole(o);
  const wait = pageBody([...(whole ? ['giver', 'places', 'disputes', 'pickups', 'prizeReport'] : ['giver', 'places', 'prizeReport']), 'sponsorTerms',
    ...(admin ? ['details', 'view'] : [])]);
  if (wait) return head + wait;
  return `${head}${sponsorTermsCard()}${giverCard(o, admin)}${whole ? disputesSection() + pickupsSection() : ''}${reportSection()}
    <p class="foot-note">${icon('shield')}<span>Winners show here by first name only when the rules allow it, never anyone under 18, and never with health records. You give these prizes, and these are your records of them.</span></p>`;
}

function giverCard(o, admin) {
  const g = S.data.giver || {};
  const d = S.data.details ? S.data.details.org : {};
  const places = S.data.details ? S.data.details.units.filter((u) => u.city) : null;
  const partner = o.kind === 'partner';
  const stateChip = !g.path ? '<span class="chip chip-muted"><span>No logo yet</span></span>'
    : g.state === 'waiting' ? `<span class="chip chip-wait">${icon('clock')}<span>Logo waiting for InneRISE review</span></span>`
      : g.state === 'rejected' ? `<span class="chip chip-back">${icon('x')}<span>Logo sent back by InneRISE</span></span>`
        : `<span class="chip chip-ok">${icon('check')}<span>Logo shows on your prizes</span></span>`;
  const sentBack = g.path && g.state === 'rejected';
  const note = g.note ? `<div class="review-note${sentBack ? ' sent-back' : ''} giver-note">${icon('mail')}<div><div class="review-note-label">Note from InneRISE about the logo</div><p>${esc(g.note)}</p></div></div>`
    : sentBack ? `<div class="review-note sent-back giver-note">${icon('mail')}<div><div class="review-note-label">Note from InneRISE about the logo</div><p>InneRISE sent the logo back.</p></div></div>` : '';
  const city = [d.city, d.region].filter(Boolean).join(', ');
  return `${label('How your prizes look')}<section class="glass card giver-card">
    <div class="giver-main"><div class="giver-logo">${g.url ? `<img src="${esc(g.url)}" alt="${esc(o.name)} logo">` : ring('store', 'lg')}</div>
      <div class="company-text"><h2 class="company-name">${esc(o.name)}</h2>
        <div class="chips">${city ? `<span class="chip">${icon('pin')}<span>${esc(city)}</span></span>` : ''}${d.website ? `<span class="chip">${icon('globe')}<span>${esc(d.website.replace(/^https:\/\//, ''))}</span></span>` : ''}
          ${places ? `<span class="chip">${icon('building')}<span>${places.length ? `Good at ${plural(places.length, 'place', 'places')} with an address` : 'No places with an address yet'}</span></span>` : ''}${stateChip}</div></div></div>
    <p class="muted">Winners see your logo, name, city and website on each prize, and the places where it's good.${partner ? ' InneRISE reviews a new logo before winners see it.' : ''}${
  g.state === 'waiting' ? ' Until then, winners see your name.' : sentBack ? ` Winners see your name instead.${admin ? ' Upload another logo to send it again.' : ''}` : ''}</p>
    ${note}
    ${admin ? `<div class="ch-actions"><button class="btn" data-act="logo-pick">${icon('download')}<span>${g.path ? 'Change logo' : 'Upload logo'}</span></button>
      <input id="logo-file" class="file-hidden" type="file" accept="image/png,image/jpeg,image/webp" data-change="logo-file" tabindex="-1" aria-hidden="true">
      ${g.path ? '<button class="link-btn small btn-danger danger-link" data-act="logo-remove">Remove logo</button>' : ''}</div>
      <p class="field-help">A PNG, JPEG or WebP picture under 1 MB, square works best. Your name, city and website come from ${partner ? 'your business profile' : 'Settings'}.</p>
      <div><a class="link-btn small" href="${esc(sectionUrl(partner ? 'profile' : 'settings'))}" data-nav>${icon('edit')}<span>${partner ? 'Open Business profile' : 'Open Settings'}</span></a></div>`
    : '<p class="field-help">An administrator can change the logo.</p>'}
    ${sponsorTermsAccepted()}
  </section>`;
}

function disputesSection() {
  const d = S.data.disputes;
  const list = d.disputes || [];
  const rows = list.map((x) => {
    const chip = x.status === 'open' ? '<span class="chip chip-wait"><span>Open</span></span>'
      : x.status === 'resolved' ? `<span class="chip chip-ok">${icon('check')}<span>Resolved</span></span>` : '<span class="chip chip-muted"><span>Declined</span></span>';
    const uses = (x.uses || []).map((u) => `<span class="usub-line">${icon(u.kind === 'reverse' ? 'back' : 'check')}<span>${esc(u.kind === 'reverse' ? 'Undone' : u.kind === 'delivered' ? 'Delivered' : 'Used')}${u.confirmation ? ` · ${esc(u.confirmation)}` : ''}${u.place ? ` · ${esc(u.place)}` : ''} · ${esc(dayAt(u.at))}</span></span>`).join('');
    return `<div class="row dispute-row" data-dispute="${esc(x.id)}">${ring('flag', 'sm')}
      <div class="grow"><div class="uname">${esc(x.title)} <span class="ref-mono">${esc(x.prize_ref)}</span></div>
        <div class="usub">${esc(TOPIC[x.topic] || TOPIC.other)} · ${x.first_name ? esc(x.first_name) : 'Name not shared'} · ${esc(dayAt(x.opened_at))}</div>
        ${x.note ? `<p class="reward-desc">“${esc(x.note)}”</p>` : ''}${uses ? `<div class="stack-sm dispute-uses">${uses}</div>` : ''}
        ${x.answer ? `<div class="review-note">${icon('mail')}<div><div class="review-note-label">Your answer</div><p>${esc(x.answer)}</p></div></div>` : ''}</div>
      <div class="row-side">${chip}${x.status === 'open' ? `<button class="btn btn-sm btn-primary" data-act="dispute-answer" data-dispute="${esc(x.id)}">Answer</button>` : ''}</div></div>`;
  }).join('');
  return `<div class="label-row">${label('Disputes')}<button class="link-btn small" data-act="disputes-all">${S.disputesAll ? 'Show open ones only' : 'Show answered ones too'}</button></div>
    <section class="glass list disputes">${rows || emptyRow('flag', S.disputesAll ? 'No disputes' : 'No open disputes', 'When a winner reports a problem with a prize, it shows here for you to answer.')}</section>
    ${d.next_before ? '<div class="more-wrap"><button class="btn" data-act="disputes-more">Show more</button></div>' : ''}`;
}

function pickupsSection() {
  const f = S.data.pickups;
  const list = f.prizes || [];
  const rows = list.map((p) => {
    const choice = p.choice || (p.offered === 'either' ? null : p.offered);
    const how = choice === 'pickup' ? 'Pickup' : choice === 'delivery' ? 'Delivery' : "The winner hasn't chosen pickup or delivery yet";
    const chip = p.state === 'ready' ? `<span class="chip chip-accent"><span>Ready for pickup</span></span>`
      : p.state === 'shipped' ? `<span class="chip chip-accent">${icon('send')}<span>Shipped</span></span>` : '<span class="chip chip-wait"><span>Waiting</span></span>';
    const b = (step, text, primary = false) => `<button class="btn btn-sm${primary ? ' btn-primary' : ''}" data-act="pick-step" data-step="${step}" data-prize="${esc(p.id)}">${esc(text)}</button>`;
    const acts = [
      choice === 'pickup' && p.state === 'waiting' && b('ready', 'Mark ready', true),
      choice === 'delivery' && p.state === 'waiting' && b('shipped', 'Mark shipped', true),
      choice === 'delivery' && ['waiting', 'shipped'].includes(p.state) && b('delivered', 'Mark delivered', p.state === 'shipped'),
      p.has_address && `<button class="btn btn-sm" data-act="pick-address" data-prize="${esc(p.id)}">${icon('eye')}<span>Show address</span></button>`,
    ].filter(Boolean).join('');
    return `<div class="row pickup-row" data-prize="${esc(p.id)}">${ring(choice === 'delivery' ? 'send' : choice === 'pickup' ? 'pin' : 'clock', 'sm')}
      <div class="grow"><div class="uname">${esc(p.title)} <span class="ref-mono">${esc(p.ref)}</span></div>
        <div class="usub">${p.first_name ? `${esc(p.first_name)} · ` : ''}${esc(how)} · won ${esc(dayAt(p.won_at))}</div>
        ${choice === 'pickup' && p.state === 'ready' ? '<span class="usub-line">' + icon('scan') + '<span>Confirm it at the counter when the winner picks it up.</span></span>' : ''}</div>
      <div class="row-side">${chip}${acts}</div></div>`;
  }).join('');
  return `<div class="label-row">${label('Pickups and deliveries')}
      <label class="field-inline" for="pick-filter"><span>Show</span><select id="pick-filter" class="input" data-change="pick-filter">
        ${[['', 'Waiting, ready or shipped'], ['waiting', 'Waiting'], ['ready', 'Ready for pickup'], ['shipped', 'Shipped']]
    .map(([k, t]) => `<option value="${k}"${k === (S.pickState || '') ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <section class="glass list pickups">${rows || emptyRow('send', 'Nothing to pick up or deliver', 'Prizes picked up at one of your places or delivered to winners show here until they are done.')}</section>
    ${f.next ? '<div class="more-wrap"><button class="btn" data-act="pickups-more">Show more</button></div>' : ''}`;
}

const reportKind = (x) => (x.kind === 'reverse' ? 'Undone' : 'Used');
function reportSection() {
  const r = S.data.prizeReport;
  const range = reportRange();
  const t = r.totals || {};
  const undone = new Set((r.rows || []).filter((x) => x.kind === 'reverse').map((x) => x.reverses));
  const canUndo = (x) => x.kind === 'confirm' && !undone.has(x.confirmation);
  const rows = (r.rows || []).map((x) => `<div class="row prow${x.kind === 'reverse' ? ' prow-back' : ''}" data-event="${esc(x.event_id)}">
      <span class="pr-when">${esc(fmtDay(x.day, true))}<span class="muted"> ${esc(clockAt(x.at))}</span></span>
      <span class="pr-prize"><span class="uname">${esc(x.title)}</span><span class="usub">${esc(x.prize_ref)}${x.winner ? ` · ${esc(x.winner)}` : ''}</span></span>
      <span class="pr-place"><span class="m-label">Place</span>${esc(x.place || 'Any place')}</span>
      <span class="pr-by"><span class="m-label">By</span>${esc(x.employee || '—')}</span>
      <span class="pr-conf"><span class="chip${x.kind === 'reverse' ? ' chip-back' : ' chip-ok'}"><span>${reportKind(x)}</span></span><span class="code-mono small">${esc(x.confirmation || '')}</span>
        ${x.kind === 'reverse' ? `<span class="usub">Undoes ${esc(x.reverses || '')}${x.reason ? `: ${esc(x.reason)}` : ''}</span>` : ''}</span>
      <span class="pr-act">${canUndo(x) ? `<button class="btn btn-sm" data-act="prize-undo" data-event="${esc(x.event_id)}">${icon('back')}<span>Undo</span></button>` : ''}</span></div>`).join('');
  const places = reportPlaces();
  const won = typeof t.won === 'string' ? ucFirst(t.won) : num(t.won);
  return `${label('Report')}
    <form class="toolbar report-filter" data-form="prize-report" novalidate>
      <label class="field-inline"><span>From</span><input class="input" type="date" name="from" value="${esc(range.from || '')}"></label>
      <label class="field-inline"><span>To</span><input class="input" type="date" name="to" value="${esc(range.to || '')}"></label>
      ${places.length > 1 ? `<label class="field-inline"><span>Place</span><select class="input" name="unit">${places.map((p) => `<option value="${esc(p.id)}"${p.id === (range.unit || '') ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
      <div class="report-acts"><button class="btn btn-sm" type="submit">Show</button>
        <button class="btn btn-sm" type="button" data-act="prize-csv">${icon('download')}<span>Download CSV</span></button></div>
      <p class="form-error" role="alert" hidden></p>
    </form>
    <div class="stats stats-3 report-tiles prize-tiles">
      <div class="glass stat static"><span class="stat-num">${esc(won)}</span><span class="stat-title">Prizes won</span><span class="stat-sub">in these days</span></div>
      <div class="glass stat static"><span class="stat-num">${num(t.uses)}</span><span class="stat-title">Used</span><span class="stat-sub">confirmed at a counter</span></div>
      <div class="glass stat static"><span class="stat-num">${num(t.reversals)}</span><span class="stat-title">Undone</span><span class="stat-sub">each with a reason</span></div>
    </div>
    <section class="glass list prize-report" aria-label="Uses">
      <div class="list-head prow" aria-hidden="true"><span>When</span><span>Prize</span><span>Place</span><span>By</span><span>Confirmation</span><span></span></div>
      ${rows || emptyRow('chart', 'No uses in these days', 'Each prize confirmed at a counter shows here with its confirmation number.')}
    </section>
    ${r.next_after ? '<div class="more-wrap"><button class="btn" data-act="report-more">Show more</button></div>' : ''}`;
}
const findReportRow = (id) => ((S.data.prizeReport && S.data.prizeReport.rows) || []).find((x) => String(x.event_id) === String(id)) || null;
function prizeCsv(rows, tz) {
  const head = ['day', 'time', 'kind', 'confirmation', 'undoes', 'prize_ref', 'prize', 'prize_type', 'method', 'place', 'by', 'winner', 'reason'];
  const time = (t) => new Date(t).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const lines = [head, ...rows.map((x) => [x.day, time(x.at), x.kind === 'reverse' ? 'undone' : 'used', x.confirmation, x.reverses, x.prize_ref, x.title,
    PRIZE_TYPE[x.prize_type] || x.prize_type, x.method === 'business_code' ? 'business code' : 'InneRISE voucher', x.place, x.employee, x.winner, x.reason])];
  return `﻿${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// Prize terms: on a 072 reward (k 'reward') or a 074 offer or challenge reward (k 'campaign') ------------------------------
function termsForm(v, { k, units }) {
  const t = v || {};
  const biz = t.method === 'business_code';
  const until = t.valid_until ? 'date' : t.valid_days ? 'days' : 'none';
  const places = units.filter((u) => ADDRESS_KINDS.includes(u.kind));
  const pick = places.length ? places : units;
  const some = Array.isArray(t.units);
  return `<label class="field"><span class="field-label">What kind of prize</span>
      <select class="input" name="prize_type" data-autofocus>${PRIZE_TYPES.map(([x, n]) => `<option value="${x}"${x === (t.prize_type || 'service') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <fieldset class="kind-choice"><legend class="field-label">How winners use it</legend><div class="kind-options">
      <label class="kind-opt"><input type="radio" name="method" value="voucher"${biz ? '' : ' checked'}><span class="kind-card">${ring('ticket', 'sm')}<span class="kind-text"><strong>InneRISE voucher</strong>
        <span>A QR code, barcode and code in the winner's app. You check it and confirm it here or in the InneRISE app.</span></span></span></label>
      <label class="kind-opt"><input type="radio" name="method" value="business_code"${biz ? ' checked' : ''}><span class="kind-card">${ring('tag', 'sm')}<span class="kind-text"><strong>Codes from your business</strong>
        <span>Codes your register already takes. Winners see your code in their app.</span></span></span></label></div></fieldset>
    <div class="stack-sm" data-biz${biz ? '' : ' hidden'}>
      <fieldset class="plain"><legend class="field-label">Your codes</legend><div class="pill-options">
        <label class="pill-opt"><input type="radio" name="code_mode" value="list"${t.code_mode !== 'shared' ? ' checked' : ''}><span class="pill">A list: one code for each winner</span></label>
        <label class="pill-opt"><input type="radio" name="code_mode" value="shared"${t.code_mode === 'shared' ? ' checked' : ''}><span class="pill">One code for every winner</span></label></div></fieldset>
      <label class="field" data-shared${t.code_mode === 'shared' ? '' : ' hidden'}><span class="field-label">The code every winner uses</span>
        <input class="input input-codes" name="shared_code" maxlength="200" autocomplete="off" spellcheck="false">
        <span class="field-help">${t.shared_code_set ? 'Enter it again each time you save these terms: it is never shown here again.' : 'It is never shown here again once saved.'}</span></label>
      <p class="field-help" data-listhelp${t.code_mode === 'shared' ? ' hidden' : ''}>Upload the list after you save: each winner gets the next code.</p>
      <label class="field"><span class="field-label">Barcode your register reads</span>
        <select class="input" name="barcode">${BARCODES.map(([x, n]) => `<option value="${x}"${x === (t.barcode || 'none') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span class="field-label">How to use it (optional)</span>
      <textarea class="input" name="instructions" rows="3" maxlength="1000" placeholder="What it is, where to go, and what to show.">${esc(t.instructions || '')}</textarea>
      <span class="field-help">Winners see this on the prize. Up to 1,000 characters.</span></label>
    <label class="field"><span class="field-label">Contact email<span data-email-optional${t.fulfillment === 'contact' ? ' hidden' : ''}> (optional)</span></span>
      <input class="input" type="email" name="contact_email" maxlength="254" autocomplete="email" spellcheck="false" value="${esc(t.contact_email || '')}">
      <span class="field-help">Winners see it on the prize and can write to you about it. "Email the business to claim" needs it.</span></label>
    <div class="form-grid">
      <label class="field"><span class="field-label">First day (optional)</span><input class="input" type="date" name="valid_from" value="${esc(t.valid_from || '')}"></label>
      <label class="field"><span class="field-label">Good until</span><select class="input" name="until">
        ${[['none', 'No end date'], ['date', 'A last day'], ['days', 'A number of days after winning']].map(([x, n]) => `<option value="${x}"${x === until ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field" data-until="date"${until === 'date' ? '' : ' hidden'}><span class="field-label">Last day</span><input class="input" type="date" name="valid_until" value="${esc(t.valid_until || '')}"></label>
      <label class="field" data-until="days"${until === 'days' ? '' : ' hidden'}><span class="field-label">Days after winning</span><input class="input" type="number" inputmode="numeric" min="1" step="1" name="valid_days" value="${esc(t.valid_days ?? 30)}"></label>
    </div>
    <fieldset class="plain"><legend class="field-label">Where it's good</legend><div class="pill-options">
      <label class="pill-opt"><input type="radio" name="where" value="all"${some ? '' : ' checked'}><span class="pill">Every place</span></label>
      ${pick.length ? `<label class="pill-opt"><input type="radio" name="where" value="some"${some ? ' checked' : ''}><span class="pill">Only some places</span></label>` : ''}</div></fieldset>
    ${pick.length ? `<div class="pick-list" data-places${some ? '' : ' hidden'}>${pick.map((u) => `<label class="pick-row"><input type="checkbox" name="units" value="${esc(u.id)}"${some && t.units.includes(u.id) ? ' checked' : ''}>
      <span>${esc(unitPath(u.id, units) || u.name)}</span></label>`).join('')}</div>` : ''}
    <div class="form-grid">
      <label class="field"><span class="field-label">How winners get it</span>
        <select class="input" name="fulfillment">${FULFILL.map(([x, n]) => `<option value="${x}"${x === (t.fulfillment || 'none') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="field" data-pickup${['pickup', 'either'].includes(t.fulfillment) ? '' : ' hidden'}><span class="field-label">Pickup place</span>
        <select class="input" name="pickup_unit">${unitOptions(pick.length ? pick : units, t.pickup_unit || '', pick.length ? null : 'Choose a place')}</select></label>
      <label class="field"><span class="field-label">Age</span><select class="input" name="min_age">
        ${[['', 'Any age the challenge allows'], ['18', '18 or older'], ['21', '21 or older']].map(([x, n]) => `<option value="${x}"${x === String(t.min_age ?? '') ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <fieldset class="plain"><legend class="field-label">Delivery area (optional)</legend><div class="form-grid">
      <label class="field"><span class="field-label">Country</span><select class="input" name="country">${countryOptions(t.country || '')}</select></label>
      <label class="field"><span class="field-label">State or region</span><input class="input" name="region" maxlength="100" value="${esc(t.region || '')}"></label>
      <label class="field span-2"><span class="field-label">City</span><input class="input" name="city" maxlength="100" value="${esc(t.city || '')}"></label></div>
      <span class="field-help">Deliveries go only inside this area. Leave it empty for anywhere.</span></fieldset>
    ${k === 'campaign' ? '<p class="field-help">Saving sends these terms to InneRISE for review. Winners keep the current terms until InneRISE approves the new ones.</p>' : ''}`;
}
function wireTerms(form) {
  const sync = () => {
    const f = form.elements;
    const biz = f.method.value === 'business_code';
    form.querySelector('[data-biz]').hidden = !biz;
    const shared = biz && f.code_mode.value === 'shared';
    form.querySelector('[data-shared]').hidden = !shared;
    form.querySelector('[data-listhelp]').hidden = shared;
    for (const el of form.querySelectorAll('[data-until]')) el.hidden = el.dataset.until !== f.until.value;
    const places = form.querySelector('[data-places]');
    if (places) places.hidden = f.where.value !== 'some';
    form.querySelector('[data-pickup]').hidden = !['pickup', 'either'].includes(f.fulfillment.value);
    form.querySelector('[data-email-optional]').hidden = f.fulfillment.value === 'contact';
  };
  form.addEventListener('change', sync);
  sync();
}
function readTerms(form) {
  const f = form.elements;
  const biz = f.method.value === 'business_code';
  const d = { prize_type: f.prize_type.value, method: f.method.value };
  if (biz) {
    d.code_mode = f.code_mode.value;
    d.barcode = f.barcode.value;
    if (d.code_mode === 'shared') {
      d.shared_code = f.shared_code.value.trim();
      if (!d.shared_code) throw new Error('Enter the code every winner uses.');
    }
  }
  const ins = f.instructions.value.trim();
  if (ins) d.instructions = ins;
  const em = f.contact_email.value.trim();
  if (em && (em.length > 254 || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(em))) {
    throw new Error('Enter an email address winners can write to, like rewards@example.com.');
  }
  if (em) d.contact_email = em;
  if (f.valid_from.value) d.valid_from = f.valid_from.value;
  if (f.until.value === 'date') {
    if (!f.valid_until.value) throw new Error('Pick the last day it can be used.');
    d.valid_until = f.valid_until.value;
  }
  if (f.until.value === 'days') {
    const n = Number(f.valid_days.value);
    if (!Number.isInteger(n) || n < 1) throw new Error('Use a whole number of days, 1 or more.');
    d.valid_days = n;
  }
  if (f.where.value === 'some') {
    const ids = [...form.querySelectorAll('input[name=units]:checked')].map((x) => x.value);
    if (!ids.length) throw new Error('Pick at least one place, or every place.');
    d.locations = ids;
  } else d.locations = 'all';
  d.fulfillment = f.fulfillment.value;
  if (d.fulfillment === 'contact' && !em) throw new Error('Enter the email address winners write to: "Email the business to claim" needs it.');
  if (['pickup', 'either'].includes(d.fulfillment)) {
    if (!f.pickup_unit.value) throw new Error('Pick the place where winners pick it up.');
    d.pickup_unit = f.pickup_unit.value;
  }
  if (f.min_age.value) d.min_age = Number(f.min_age.value);
  if (f.country.value) d.country = f.country.value;
  if (f.region.value.trim()) d.region = f.region.value.trim();
  if (f.city.value.trim()) d.city = f.city.value.trim();
  return d;
}
// The terms a reward or offer has (from its card's load), and what it's called.
function termsTarget(k, id) {
  if (k === 'reward') {
    const [c, x] = findReward(id);
    return x ? { title: x.title, pt: S.data.rewards && S.data.rewards.terms ? S.data.rewards.terms[id] : null, approved: !!x.approved, c } : null;
  }
  const c = findCampaign(id);
  return c ? { title: c.title, pt: S.data.campaigns && S.data.campaigns.terms ? S.data.campaigns.terms[id] : null } : null;
}
async function openTermsForm(k, id) {
  const tg = termsTarget(k, id);
  if (!tg) return;
  // The places the terms can name: the administrator's (or manager's) view of the organization, when there is one.
  try { await ensure(['view']); } catch (e) { if (e.code === 'signed_out') throw e; }
  await ensure(['sponsorTerms']);
  const units = placeNames();
  const pt = await rpc.prizeTermsGet(k, id);
  const v = pt.next || pt.live;
  openModal({
    title: `Prize terms for ${esc(tg.title)}`,
    body: `${pt.next && pt.next.state === 'waiting' ? `<div class="review-note">${icon('clock')}<div><div class="review-note-label">With InneRISE for review</div><p>These are the terms you sent. Winners keep the current ones until InneRISE approves them.</p></div></div>` : ''}
      ${termsNote(pt)}${sponsorTermsCard('modal')}
      <p class="muted">Prize terms put this ${k === 'reward' ? 'reward' : 'reward or offer'} in winners' My rewards, with your logo and places. Each prize is used once, at your counter.</p>
      ${termsForm(v, { k, units })}
      ${pt.live || pt.next ? `<p><button type="button" class="link-btn small btn-danger danger-link" data-act="pt-remove" data-k="${k}" data-target="${esc(id)}">Remove the prize terms</button></p>` : ''}
      ${k === 'reward' && tg.approved ? '<p class="field-help">Saving asks an administrator to approve this reward again.</p>' : ''}`,
    submit: k === 'campaign' ? 'Send for review' : 'Save terms',
    onOpen: wireTerms,
    onSubmit: async (form) => {
      const d = readTerms(form);
      let res;
      try {
        res = await rpc.prizeTermsSet(k, id, d);
      } catch (e) {
        // The Sponsor Reward Terms come first: bring their card (and its Accept) into view.
        const card = e.code === 'sponsor_terms' && form.querySelector('[data-sponsor-terms]');
        if (card) card.scrollIntoView({ block: 'nearest' });
        throw e;
      }
      toast(res.state === 'waiting' ? `Sent the prize terms for ${tg.title} to InneRISE for review.`
        : `Saved the prize terms for ${tg.title}.${res.needs_approval ? ' An administrator approves the reward again before it counts.' : ''}${d.code_mode === 'list' ? ' Upload your business codes next.' : ''}`);
      await refresh([k === 'reward' ? 'rewards' : 'campaigns'], ['summary']);
    },
  });
}
// A CSV file or a plain list: the first column of each line, without a header that just says "code".
function codesFromFile(text) {
  return String(text || '').split(/\r?\n/).map((line) => {
    const m = line.match(/^\s*"((?:[^"]|"")*)"|^\s*([^,;\t]*)/);
    return (m[1] != null ? m[1].replace(/""/g, '"') : m[2] || '').trim();
  }).filter((x, i) => x && !(i === 0 && /^codes?$/i.test(x)));
}
async function openBizCodes(k, id) {
  const tg = termsTarget(k, id);
  if (!tg) return;
  const pt = await rpc.prizeTermsGet(k, id);
  openModal({
    title: `Upload business codes for ${esc(tg.title)}`,
    body: `${facts([['Uploaded', num(pt.codes)], ['Not given out yet', num(pt.codes_left)], ['Winners waiting', num(pt.waiting_for_code)]])}
      <label class="field"><span class="field-label">Codes, one per line</span>
        <textarea class="input input-codes" name="codes" rows="7" autocapitalize="off" autocorrect="off" spellcheck="false" data-autofocus></textarea>
        <span class="field-help">Up to 200 characters each. Each winner gets the next code, privately in their app, and you won't see the codes here again.</span></label>
      <label class="field"><span class="field-label">Or a CSV file</span><input class="input" type="file" name="file" accept=".csv,.txt,text/csv,text/plain" data-change="codes-file">
        <span class="field-help">The first column of each line is used.</span></label>`,
    submit: 'Upload codes',
    onSubmit: async (form) => {
      const codes = String(form.elements.codes.value || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!codes.length) throw new Error('Paste at least one code, or choose a file.');
      const res = await rpc.prizeCodesAdd(k, id, codes);
      toast(`Added ${plural(res.added, 'code', 'codes')}.${res.skipped ? ` Skipped ${num(res.skipped)}: already uploaded, repeated, or shaped like an InneRISE code.` : ''}${res.waiting_for_code ? ` ${plural(res.waiting_for_code, 'winner still waits', 'winners still wait')} for a code.` : ''}`);
      await refresh([k === 'reward' ? 'rewards' : 'campaigns']);
    },
  });
}

// The overview's program cards: what each is, where it stands, and the next thing to do.
function programCards() {
  const o = currentOrg();
  const w = words();
  const allowed = sectionsFor(o);
  const sm = S.data.summary || {};
  const open = verified(o);
  const today = dayIn(orgTz());
  const card = (section, ic, title, desc, status, act, then = '', extra = '') => `<article class="glass feature" data-feature="${section}">
    <div class="feature-head">${ring(ic, 'lg')}<h2 class="feature-title">${esc(title)}</h2></div>
    <p class="feature-desc">${esc(desc)}</p>
    ${status ? `<p class="feature-status">${status}</p>` : ''}
    <div class="feature-acts"><a class="btn feature-go" href="${esc(sectionUrl(section))}" data-nav${then ? ` data-then="${then}"` : ''}>${icon(then ? 'plus' : 'arrow')}<span>${esc(act)}</span></a>${extra}</div>
  </article>`;
  const out = [];
  if (o.kind === 'partner') {
    const camps = sm.campaigns || null;
    const count = (kind, states) => (camps || []).filter((c) => c.kind === kind && states.includes(c.state)).length;
    const line = (kind) => {
      if (!camps) return '';
      const live = count(kind, ['live', 'scheduled', 'approved']);
      const review = count(kind, ['submitted']);
      const drafts = count(kind, ['draft', 'rejected']);
      const parts = [live && `${num(live)} live`, review && `${num(review)} with InneRISE`, drafts && plural(drafts, 'draft', 'drafts')].filter(Boolean);
      return esc(parts.length ? parts.join(' · ') : 'None yet');
    };
    const lib = allowed.includes('library') ? `<a class="link-btn feature-alt" href="${esc(sectionUrl('library'))}" data-nav><span>Browse the library</span></a>` : '';
    if (allowed.includes('sponsored')) out.push(card('sponsored', 'trophy', 'Sponsored Challenges', 'Challenges you sponsor, open to everyone on InneRISE.', line('sponsored_challenge'), 'New Sponsored Challenge', 'sp-new', lib));
    // Redeeming sits with offers: the same people can do both, and it keeps the overview to three cards.
    const redeem = allowed.includes('redeem') ? `<a class="link-btn feature-alt" href="${esc(sectionUrl('redeem'))}" data-nav><span>Redeem prizes</span></a>` : '';
    if (allowed.includes('offers')) out.push(card('offers', 'gift', 'Rewards & offers', 'Offers people claim for a code, and rewards for your challenges. Each code works once.', line('reward_offer'), 'New offer', 'of-new', redeem));
  } else {
    const r = sm.rewards || null;
    if (allowed.includes('challenges')) {
      let status = '';
      if (!open) status = esc(`Starts once InneRISE verifies ${o.name}`);
      else if (r) {
        const running = r.list.filter((c) => phase(c, today) === 'running').length;
        const soon = r.list.filter((c) => phase(c, today) === 'upcoming').length;
        status = esc([running && `${num(running)} running`, soon && `${num(soon)} coming up`].filter(Boolean).join(' · ') || 'None running');
      }
      const creator = open && (wholeOrgCreator(o) || myUnits().length > 0);
      const lib = allowed.includes('library') ? `<a class="link-btn feature-alt" href="${esc(sectionUrl('library'))}" data-nav><span>Browse the library</span></a>` : '';
      out.push(card('challenges', 'trophy', 'Challenges & Competitions', w.chFeature, status, creator ? 'Create a challenge' : 'Open Challenges', creator ? 'ch-new' : '', lib));
    }
    if (allowed.includes('rewards')) {
      let status = '';
      let act = 'Open Rewards';
      let then = '';
      if (r && r.status) {
        const all = r.list.filter((c) => c.status !== 'cancelled').flatMap((c) => r.status[c.id] || []);
        const waiting = all.filter((x) => !x.approved && !x.awarded_at).length;
        if (amAdmin() && waiting) { status = esc(`${num(waiting)} waiting for your approval`); act = 'Review rewards'; }
        else status = esc(all.length ? plural(all.length, 'reward', 'rewards') + ` on ${plural(r.list.filter((c) => (r.status[c.id] || []).length).length, 'challenge', 'challenges')}` : 'None yet');
        if (!(amAdmin() && waiting) && r.list.some((c) => c.can_reward && c.status !== 'cancelled')) { act = 'Add a reward'; then = 'rw-new'; }
      }
      const redeem = allowed.includes('redeem') ? `<a class="link-btn feature-alt" href="${esc(sectionUrl('redeem'))}" data-nav><span>Redeem prizes</span></a>` : '';
      out.push(card('rewards', 'gift', 'Rewards', 'Rewards, incentives and prizes for your challenges.', status, act, then, redeem));
    }
  }
  if (allowed.includes('focus')) {
    const f = sm.focus || null;
    let status = '';
    let act = `Open ${w.focusTitle}`;
    let then = '';
    if (f) {
      status = esc([f.schedules ? plural(f.schedules, 'schedule', 'schedules') : 'No schedules yet', f.waiting && `${num(f.waiting)} waiting for an answer`].filter(Boolean).join(' · '));
      if (f.waiting) act = 'Answer requests';
      else if (!f.schedules) { act = 'Add a schedule'; then = 'fx-new'; }
    }
    out.push(card('focus', 'focus', w.focusNav, w.focusFeature, status, act, then));
  }
  return out.length ? `${label('Programs')}<div class="features${out.length < 3 ? ` features-${out.length}` : ''}">${out.join('')}</div>` : '';
}

// InneRISE administration (082) -----------------------------------------------------------------------------------------
// For InneRISE staff (innerise_is_staff()), in the same dashboard and the same look: what is waiting, the organizations to
// verify, partners' Sponsored Challenges, rewards and offers (new and changed), InneRISE's own library templates, and
// partners' logos and prize terms. Every page reads 082's staff_* functions, which check again that the account is staff;
// every answer and refusal is a plain sentence (api.js). The organization or partner sees every note written here.
const STAFF_KEYS = ['staffOverview', 'staffOrgs', 'staffOrg', 'staffPartners', 'staffLibrary', 'staffPrizes'];
const STAFF_TITLES = { staff: 'Overview', 'staff-orgs': 'Organizations', 'staff-org': 'Organization', 'staff-partners': 'Partner reviews',
  'staff-library': 'Library', 'staff-prizes': 'Prize logos & terms' };
const STAFF_PAGES = { staff: staffOverviewPage, 'staff-orgs': staffOrgsPage, 'staff-org': staffOrgPage, 'staff-partners': staffPartnersPage,
  'staff-library': staffLibraryPage, 'staff-prizes': staffPrizesPage };
const ORG_STATUS = [['pending', 'Waiting for verification'], ['active', 'Verified'], ['suspended', 'Suspended'], ['closed', 'Closed'], ['all', 'All']];
const LIB_STATUS = [['draft', 'Drafts'], ['published', 'Published'], ['retired', 'Retired'], ['all', 'All']];
const staffSt = (list, fallback) => { const s = param('st'); return list.some(([k]) => k === s) ? s : fallback; };
const staffQ = () => String(param('q') || '').trim().slice(0, 100);
const staffDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: LOCAL_TZ }) : '');
const kindName = (k) => (KIND_CHOICES[k] || { title: k || 'Organization' }).title;
const kindIcon = (k) => (KIND_CHOICES[k] || { icon: 'building' }).icon;
const staffSeen = new Map(); // organization id -> name, from the lists already read (to find one organization quickly)
function orgStatusChip(st) {
  if (st === 'active') return '<span class="chip chip-ok"><span class="dot"></span><span>Verified</span></span>';
  if (st === 'pending') return `<span class="chip chip-wait">${icon('clock')}<span>Waiting for verification</span></span>`;
  if (st === 'suspended') return '<span class="chip chip-back"><span>Suspended</span></span>';
  return `<span class="chip chip-muted"><span>${st === 'closed' ? 'Closed' : esc(st)}</span></span>`;
}

Object.assign(LOADERS, {
  staffOverview: () => rpc.staffOverview(),
  staffOrgs: () => loadStaffOrgs(),
  staffOrg: () => loadStaffOrg(param('id')),
  staffPartners: async () => {
    const d = (await rpc.staffPartnerQueue()) || {};
    (d.partners_waiting || []).forEach((x) => staffSeen.set(x.id, x.name));
    return { campaigns: d.campaigns || [], partners_waiting: d.partners_waiting || [] };
  },
  staffLibrary: async () => { const st = staffSt(LIB_STATUS, 'draft'); return { st, list: (await rpc.staffLibraryList(st === 'all' ? null : st)) || [] }; },
  staffPrizes: () => loadStaffPrizes(),
});
// A page of organizations for the filter and search in the address ("All" asks with no status), added to what is shown.
async function loadStaffOrgs(have = null) {
  const st = staffSt(ORG_STATUS, 'pending');
  const q = staffQ();
  const res = (await rpc.staffOrgList(st === 'all' ? null : st, q || null, 50, have ? have.rows.length : 0)) || {};
  const rows = [...(have ? have.rows : []), ...(res.rows || [])];
  rows.forEach((g) => staffSeen.set(g.id, g.name));
  return { st, q, total: res.total || rows.length, rows };
}
// One organization. 082 reads organizations as lists only: look it up by the name already seen, else page through them all.
async function loadStaffOrg(id) {
  if (!id) return { id, missing: true };
  const name = staffSeen.get(id);
  if (name) {
    const res = (await rpc.staffOrgList(null, name, 200, 0)) || {};
    const hit = (res.rows || []).find((g) => g.id === id);
    if (hit) return { id, org: hit };
  }
  for (let off = 0; off < 100000; off += 200) {
    const rows = ((await rpc.staffOrgList(null, null, 200, off)) || {}).rows || [];
    const hit = rows.find((g) => g.id === id);
    if (hit) { staffSeen.set(id, hit.name); return { id, org: hit }; }
    if (rows.length < 200) break;
  }
  return { id, missing: true };
}
async function loadStaffPrizes() {
  const d = (await rpc.staffPrizeQueue()) || {};
  const shown = await Promise.all((d.logos || []).map(async (x) => {
    let url = null;
    try { url = x.logo_path ? await logos.url(x.logo_path) : null; } catch { url = null; }
    return { ...x, url };
  }));
  return { logos: shown, terms: d.terms || [] };
}

const staffHead = (title, sub) => `<header class="page-head"><div class="page-head-text"><h1 class="page-title">${esc(title)}</h1>
  <p class="page-sub">${esc(sub)}</p></div><div class="page-actions"></div></header>`;
const STAFF_NAV = [
  { cls: 'nav-home', name: 'Home', items: [{ id: 'staff', label: 'Overview', icon: 'shield' }] },
  { cls: 'nav-admin', name: 'Reviews', title: 'Reviews', items: [{ id: 'staff-orgs', label: 'Organizations', icon: 'building' },
    { id: 'staff-partners', label: 'Partner reviews', icon: 'store' }, { id: 'staff-library', label: 'Library', icon: 'book' },
    { id: 'staff-prizes', label: 'Prize logos & terms', icon: 'tag' }] },
];
// The same frame as every organization's pages: the switcher (with InneRISE administration picked), the menu, the account.
function staffShell(route, content) {
  const here = route === 'staff-org' ? 'staff-orgs' : route;
  const sub = BRAND.staff;
  const switcher = orgSwitcher(STAFF_PICK) || '<div class="side-label">Organization</div><div class="side-company">InneRISE administration</div>';
  return `<div class="shell${S.navOpen ? ' nav-open' : ''}">
    <header class="topbar">
      <button class="icon-btn" data-act="nav-toggle" aria-label="Open menu" aria-controls="sidebar" aria-expanded="${S.navOpen}">${icon('menu')}</button>
      <a class="topbar-brand" href="${esc(urlFor({ section: 'staff' }))}" data-nav>${wordmark()}<span class="for-biz">${sub}</span></a>
      ${demoTag()}
    </header>
    <aside class="sidebar" id="sidebar" aria-label="Main">
      <div class="side-brand">
        <div class="side-brand-row">${wordmark('wordmark-md')}<button class="icon-btn nav-close" data-act="nav-close" aria-label="Close menu">${icon('x')}</button></div>
        <div class="for-biz">${sub}</div>
        ${demoTag()}
      </div>
      <div class="side-org">${switcher}<div class="side-role">${icon('shield')}<span>InneRISE staff</span></div></div>
      ${STAFF_NAV.map((g) => `<nav class="nav ${g.cls}" aria-label="${esc(g.name)}">${g.title ? `<div class="nav-group-label">${esc(g.title)}</div>` : ''}${g.items
    .map((n) => `<a class="nav-link${n.id === here ? ' active' : ''}" href="${esc(urlFor({ section: n.id }))}" data-nav data-section="${n.id}"${n.id === here ? ' aria-current="page"' : ''}>${ring(n.icon, 'sm')}<span>${esc(n.label)}</span></a>`).join('')}</nav>`).join('')}
      <div class="side-foot">
        <div class="side-label">Signed in as</div>
        <div class="account-email" title="${esc(S.user.email)}">${esc(S.user.email || 'Your InneRISE account')}</div>
        <button class="btn btn-sm" data-act="sign-out">${icon('signout')}<span>Sign out</span></button>
      </div>
    </aside>
    <div class="scrim" data-act="nav-close"></div>
    <main class="main" id="main"><div class="content">${noticeBanner()}${content}</div>${siteFoot()}</main>
  </div>`;
}

// Overview: six counts, each opening its list.
function staffOverviewPage() {
  const head = staffHead('InneRISE administration', 'What is waiting for InneRISE, across every organization.');
  const wait = pageBody(['staffOverview']);
  if (wait) return head + wait;
  const v = S.data.staffOverview || {};
  const tile = (key, ic, title, sub, section, st = null) => `<a class="glass stat" href="${esc(urlFor({ section, st }))}" data-nav data-count="${key}">${ring(ic)}
    <span class="stat-num">${num(v[key])}</span><span class="stat-title">${esc(title)}</span><span class="stat-sub">${esc(sub)}</span></a>`;
  return `${head}
    ${label('Waiting for InneRISE')}
    <div class="stats stats-3 staff-tiles">
      ${tile('orgs_waiting', 'building', 'Organizations', 'waiting for verification', 'staff-orgs', 'pending')}
      ${tile('partners_waiting', 'store', 'Partner businesses', 'waiting for verification', 'staff-partners')}
      ${tile('campaigns_waiting', 'trophy', 'Partner reviews', 'Sponsored Challenges, rewards and offers, new or changed', 'staff-partners')}
      ${tile('library_waiting', 'book', 'Library drafts', 'templates not published yet', 'staff-library', 'draft')}
      ${tile('logos_waiting', 'star', 'Logos', 'before winners see them', 'staff-prizes')}
      ${tile('terms_waiting', 'tag', 'Prize terms', 'before prizes follow them', 'staff-prizes')}
    </div>
    ${label('How review works')}
    <section class="glass card explain-card">${ring('shield')}<div class="stack">
      <h2 class="card-title">Checked by hand, before anyone sees it</h2>
      <p>An organization waiting for verification can set things up, but it can't invite people until InneRISE approves it. A partner's Sponsored Challenges, rewards and offers, its changes to approved ones, its logo and its prize terms reach people only once InneRISE approves them.</p>
      <p class="muted">The organization or partner sees every note you write. Here you see what review needs: an organization's details and its administrators' first names and emails. Never anyone's screen time, health or activity records, location or messages.</p>
    </div></section>`;
}

// Organizations: a status filter and a search, the waiting ones oldest first.
function staffOrgsPage() {
  const st = staffSt(ORG_STATUS, 'pending');
  const q = staffQ();
  const head = staffHead('Organizations', 'Every organization on InneRISE. Check the new ones, then approve or decline them.');
  const have = S.data.staffOrgs;
  if (have && (have.st !== st || have.q !== q)) delete S.data.staffOrgs;
  const tools = `<form data-form="staff-search" class="inline-form staff-tools" role="search" novalidate>
    <label class="field"><span class="field-label">Show</span><select id="staff-st" class="input" name="st" data-change="staff-st">${ORG_STATUS
    .map(([k, t]) => `<option value="${k}"${k === st ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="field grow"><span class="field-label">Search</span><input id="staff-q" class="input" name="q" type="search" maxlength="100"
      placeholder="Name or legal name" value="${esc(q)}" autocapitalize="off" spellcheck="false"></label>
    <button class="btn" type="submit">Search</button>
    ${q ? '<button class="link-btn small" type="button" data-act="staff-clear">Clear search</button>' : ''}
  </form>`;
  const wait = pageBody(['staffOrgs']);
  if (wait) return head + tools + wait;
  const d = S.data.staffOrgs;
  const named = { pending: 'Waiting for verification', active: 'Verified', suspended: 'Suspended', closed: 'Closed', all: 'All organizations' }[st];
  const empty = q ? emptyRow('building', 'Nothing matches', `No organization here matches "${q}". Try part of its name or legal name, or show all of them.`)
    : st === 'pending' ? emptyRow('check', 'Nothing waiting', 'New organizations show here, oldest first, until InneRISE approves or declines them.')
      : emptyRow('building', 'None here', `${named} organizations show here.`);
  return `${head}${tools}
    ${label(`${named} (${num(d.total)})`)}
    <section class="glass list staff-orgs" aria-label="Organizations">${d.rows.map(staffOrgRow).join('') || empty}</section>
    ${d.rows.length < d.total ? '<div class="more-wrap"><button class="btn" data-act="staff-orgs-more">Show more</button></div>' : ''}`;
}
function staffOrgRow(g) {
  const sub = [kindName(g.kind), plural(g.member_count || 0, 'member', 'members'), `registered ${staffDay(g.created_at)}`, ...(g.email_domains || [])].join(' · ');
  const open = urlFor({ section: 'staff-org', id: g.id });
  return `<div class="row staff-org-row" data-org="${esc(g.id)}">${ring(kindIcon(g.kind), 'sm')}
    <div class="grow"><div class="uname">${esc(g.name)}</div><div class="usub">${esc(sub)}</div></div>
    <div class="row-side">${orgStatusChip(g.status)}<a class="btn btn-sm${g.status === 'pending' ? ' btn-primary' : ''}" href="${esc(open)}" data-nav>${g.status === 'pending' ? 'Review' : 'Open'}</a></div></div>`;
}

// One organization: what it sent when it registered, and Approve, Decline, Suspend or Turn back on.
function staffOrgPage() {
  const id = param('id');
  const list = S.data.staffOrgs;
  const back = `<a class="link-btn small back-link" href="${esc(urlFor({ section: 'staff-orgs', st: list ? list.st : null, q: list ? list.q || null : null }))}" data-nav>${icon('arrow')}<span>Organizations</span></a>`;
  if (S.data.staffOrg && S.data.staffOrg.id !== id) delete S.data.staffOrg;
  const wait = pageBody(['staffOrg']);
  if (wait) return back + staffHead('Organization', 'One organization on InneRISE.') + wait;
  const d = S.data.staffOrg;
  if (d.missing) {
    return back + staffHead('Organization', 'One organization on InneRISE.')
      + `<section class="glass list">${emptyRow('building', "That organization isn't here", 'The link may be wrong. Find it in Organizations.')}</section>`;
  }
  const g = d.org;
  const head = staffHead(g.name, `${kindName(g.kind)} · registered ${staffDay(g.created_at)}`);
  const partnerWaits = g.kind === 'partner' && g.status === 'pending';
  if (partnerWaits) { const more = pageBody(['staffPartners']); if (more) return back + head + more; }
  const pp = partnerWaits ? (S.data.staffPartners.partners_waiting || []).find((x) => x.id === g.id) || null : null;
  const acts = g.status === 'pending'
    ? `<button class="btn btn-primary" data-act="staff-org-set" data-to="approve">${icon('check')}<span>Approve</span></button>
       <button class="btn btn-danger" data-act="staff-org-set" data-to="decline">${icon('x')}<span>Decline</span></button>`
    : g.status === 'active' ? `<button class="btn btn-danger" data-act="staff-org-set" data-to="suspend">${icon('pause')}<span>Suspend</span></button>`
      : g.status === 'suspended' ? `<button class="btn btn-primary" data-act="staff-org-set" data-to="resume">${icon('play')}<span>Turn back on</span></button>` : '';
  const site = g.website && /^https?:\/\//i.test(g.website)
    ? `<a class="link-btn small" href="${esc(g.website)}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>${esc(g.website.replace(/^https?:\/\//i, ''))}</span></a>` : esc(g.website || '—');
  const admins = g.admins || [];
  const noteBack = ['suspended', 'closed'].includes(g.status);
  return `${back}${head}
    <section class="glass card company-card staff-org-card" data-org="${esc(g.id)}">
      <div class="company-main">${ring(kindIcon(g.kind), 'lg')}
        <div class="company-text"><h2 class="company-name">${esc(g.name)}</h2>
          <div class="chips">${orgStatusChip(g.status)}<span class="chip">${esc(kindName(g.kind))}</span>${(g.email_domains || [])
    .map((x) => `<span class="chip chip-accent">${icon('check')}<span>Email domain: ${esc(x)}</span></span>`).join('')}</div>
          <p class="meta">${icon('clock')}<span>${esc(g.time_zone || '')}${tzName(g.time_zone) ? ` · ${esc(tzName(g.time_zone))}` : ''}</span></p>
        </div>
      </div>
      ${acts ? `<div class="company-actions">${acts}</div>` : ''}
    </section>
    ${label('What it sent')}
    <section class="glass card staff-facts">
      ${facts([['Legal name', esc(g.legal_name || '—')], ['Website', site], ['Contact email', esc(g.contact_email || '—')],
    ['Phone', esc(g.contact_phone || '—')], ['City', esc([g.city, g.region].filter(Boolean).join(', ') || '—')],
    ['Country', esc(g.country ? countryName(g.country) : '—')],
    ['Members', `${num(g.member_count)}${g.pending_member_count ? ` · ${esc(num(g.pending_member_count))} waiting to join` : ''}`],
    ['Registered', esc(staffDay(g.created_at))], ['Verified', esc(g.verified_at ? staffDay(g.verified_at) : 'Not yet')]])}
      ${g.verified_note ? `<div class="review-note${noteBack ? ' sent-back' : ''} staff-note">${icon('mail')}<div><div class="review-note-label">Note from InneRISE</div><p>${esc(g.verified_note)}</p></div></div>` : ''}
    </section>
    ${pp ? `${label('Partner business')}<section class="glass card staff-partner">
      ${pp.about ? `<p class="ch-desc">${esc(pp.about)}</p>` : '<p class="muted">No description yet.</p>'}
      ${facts([['Plan asked for', esc(planName(pp.plan) || 'None yet')]])}</section>` : ''}
    ${label(`Administrators (${admins.length})`)}
    <section class="glass list staff-admins" aria-label="Administrators">${admins.map((a) => `<div class="row">${ring('crown', 'sm')}
      <div class="grow"><div class="uname">${esc(a.first_name || 'No name yet')}</div><div class="usub">${esc(a.email || 'No email')}</div></div></div>`).join('')
    || emptyRow('people', 'No administrators', 'Nobody can manage this organization on the website yet.')}</section>
    <p class="foot-note">${icon('shield')}<span>The organization sees the note you write. Approving verifies it, so it can invite people. Declining closes it. Suspending pauses it until InneRISE turns it back on.</span></p>`;
}
function staffOrgModal(to) {
  const d = S.data.staffOrg;
  if (!d || !d.org) return;
  const g = d.org;
  const spec = {
    approve: ['active', `Approve ${g.name}?`, 'Approve', false, false,
      g.kind === 'partner' ? `${g.name} is verified at once, so it can send Sponsored Challenges, rewards and offers to InneRISE for review.`
        : `${g.name} is verified at once, so its administrators can invite people.`, `Approved. ${g.name} is verified.`],
    decline: ['closed', `Decline ${g.name}?`, 'Decline', true, true, `This closes ${g.name}: nobody can open it or join it. Say why in a note.`,
      `Declined. ${g.name} is closed.`],
    suspend: ['suspended', `Suspend ${g.name}?`, 'Suspend', true, true, `${g.name} is paused: nobody can open it until InneRISE turns it back on. Say why in a note.`,
      `Suspended. ${g.name} is paused.`],
    resume: ['active', `Turn ${g.name} back on?`, 'Turn back on', false, false, `${g.name} opens again for its people and administrators.`, `${g.name} is on again.`],
  }[to];
  if (!spec) return;
  const [st, title, submit, danger, needed, text, done] = spec;
  openModal({ title: esc(title), submit, danger,
    body: `<p>${esc(text)}</p>
      <label class="field"><span class="field-label">Note to ${esc(g.name)}${needed ? '' : ' (optional)'}</span>
        <textarea class="input" name="note" rows="3" maxlength="200" data-autofocus></textarea>
        <span class="field-help">${needed ? '5 to 200 characters.' : 'Up to 200 characters. Left empty, the last note stays.'} The organization sees it.</span></label>`,
    async onSubmit(form) {
      // 068 keeps the last note when the new one is empty; declining and suspending say why here.
      const note = form.elements.note.value.trim();
      if (needed && note.length < 5) throw new Error('Say why in a note of 5 to 200 characters. The organization sees it.');
      await rpc.staffOrgSetStatus(g.id, st, note || null);
      toast(done);
      await refresh(['staffOrg'], ['staffOverview', 'staffOrgs', 'staffPartners']);
    } });
}

// Partner reviews: campaigns waiting (new, or changed since InneRISE approved them), and partner businesses to verify.
const REV_LABEL = { title: 'Title', summary: 'Summary', link: 'Link', image_path: 'Picture', country: 'Country', region: 'State or region', city: 'City',
  starts_on: 'Starts', ends_on: 'Ends', quantity: 'Number available', per_person: 'Per person' };
function revValue(k, v) {
  if (v == null || v === '') return 'None';
  if (k === 'starts_on' || k === 'ends_on') return fmtDay(String(v), true);
  if (k === 'country') return countryName(v);
  if (typeof v === 'number') return num(v);
  if (typeof v === 'object') return 'Changed';
  return String(v);
}
function changesBlock(c) {
  const rev = c.revision || {};
  const keys = Object.keys(rev);
  if (!keys.length) return '';
  return `<div class="review-note revision staff-diff">${icon('edit')}<div class="grow"><div class="review-note-label">What changed</div>
    <dl class="diff">${keys.map((k) => `<div class="diff-row" data-key="${esc(k)}"><dt>${esc(REV_LABEL[k] || ucFirst(k.replace(/_/g, ' ')))}</dt>
      <dd><span class="was">${esc(revValue(k, c[k]))}</span>${icon('arrow')}<span class="now">${esc(revValue(k, rev[k]))}</span></dd></div>`).join('')}</dl>
    <p class="field-help">People see the version approved before until you approve these changes.</p></div></div>`;
}
function staffCampaignCard(c) {
  const sponsored = c.kind === 'sponsored_challenge';
  const p = c.partner || {};
  const rows = [];
  if (sponsored && c.challenge) {
    const r = ruleText(c.challenge);
    rows.push(['Counts', esc(r.how)], ['Target', esc(r.target)],
      ['Dates', esc(fmtRange(c.challenge.starts_on, addDay(c.challenge.starts_on, c.challenge.days - 1)))], ['Open to', esc(openTo(c.challenge.max_people))]);
  } else if (c.reward_type === 'achievement') {
    rows.push(['For', esc(c.for_title || 'A Sponsored Challenge')], ['Who earns it', esc(EARNS[c.earns] || c.earns || '')], ['Available', num(c.quantity)]);
  } else {
    rows.push(['Dates', c.starts_on && c.ends_on ? esc(fmtRange(c.starts_on, c.ends_on)) : '—'],
      ['Available', `${num(c.quantity)} · ${plural(c.per_person, 'per person', 'per person')}`]);
  }
  if (c.kind === 'reward_offer') rows.push(['Codes', c.code_source === 'pool' ? `The partner's own · ${num(c.codes_uploaded)} uploaded` : 'Made by InneRISE']);
  if (c.reward_type !== 'achievement') rows.push(['Area', esc(areaText(c))]);
  rows.push(['Sent', esc(staffDay(c.re_review ? c.revision_at : c.submitted_at))]);
  return `<article class="glass card ch-card campaign staff-review" data-campaign="${esc(c.id)}">
    <div class="ch-top">${ring(sponsored ? 'trophy' : c.reward_type === 'achievement' ? 'star' : 'tag')}
      <div class="ch-head"><h3 class="ch-title">${esc(c.title)}</h3>
        <div class="chips">${c.re_review ? `<span class="chip chip-wait">${icon('edit')}<span>Changed since approved</span></span>` : `<span class="chip chip-accent">${icon('spark')}<span>New</span></span>`}
          <span class="chip"><span>${sponsored ? 'Sponsored Challenge' : c.reward_type === 'achievement' ? 'Challenge reward' : 'Offer'}</span></span>
          <span class="chip">${icon('store')}<span>${esc(p.name || '')}</span></span>
          ${p.status && p.status !== 'active' ? '<span class="chip chip-back"><span>Partner not verified yet</span></span>' : ''}</div></div></div>
    ${c.summary ? `<p class="ch-desc">${esc(c.summary)}</p>` : ''}
    ${c.re_review ? changesBlock(c) : ''}
    ${facts(rows)}
    ${c.for_status === 'withdrawn' ? `<p class="usub-line warn-line">${icon('x')}<span>The Sponsored Challenge it belongs to was withdrawn.</span></p>` : ''}
    ${c.link ? `<p class="usub-line">${icon('globe')}<span>${esc(c.link)}</span></p>` : ''}
    <div class="ch-actions"><button class="btn btn-sm btn-primary" data-act="staff-cp" data-campaign="${esc(c.id)}" data-approve="1">${icon('check')}<span>Approve</span></button>
      <button class="btn btn-sm" data-act="staff-cp" data-campaign="${esc(c.id)}" data-approve="0">${icon('back')}<span>Send back</span></button>
      ${p.status === 'pending' ? `<a class="btn btn-sm" href="${esc(urlFor({ section: 'staff-org', id: p.id }))}" data-nav>${icon('building')}<span>Check the business</span></a>` : ''}</div>
  </article>`;
}
function staffPartnerRow(x) {
  const sub = [x.website && x.website.replace(/^https?:\/\//i, ''), x.plan && `Asked for the ${planName(x.plan) || x.plan} plan`, `registered ${staffDay(x.created_at)}`];
  return `<div class="row staff-partner-row" data-org="${esc(x.id)}">${ring('store', 'sm')}
    <div class="grow"><div class="uname">${esc(x.name)}</div><div class="usub">${esc(sub.filter(Boolean).join(' · '))}</div>
      ${x.about ? `<p class="reward-desc">${esc(x.about)}</p>` : ''}</div>
    <div class="row-side">${orgStatusChip('pending')}<a class="btn btn-sm btn-primary" href="${esc(urlFor({ section: 'staff-org', id: x.id }))}" data-nav>Review</a></div></div>`;
}
function staffPartnersPage() {
  const head = staffHead('Partner reviews', "Partners' Sponsored Challenges, rewards and offers, new or changed, and partner businesses waiting to be verified.");
  const wait = pageBody(['staffPartners']);
  if (wait) return head + wait;
  const d = S.data.staffPartners;
  const list = d.campaigns;
  return `${head}
    ${label(`Waiting for review (${list.length})`)}
    ${list.length ? `<div class="ch-list staff-reviews">${list.map(staffCampaignCard).join('')}</div>`
    : `<section class="glass list">${emptyRow('check', 'Nothing waiting', 'Sponsored Challenges, rewards and offers partners send show here, and so do their changes to approved ones.')}</section>`}
    ${label(`Partner businesses waiting for verification (${d.partners_waiting.length})`)}
    <section class="glass list staff-partners-waiting">${d.partners_waiting.map(staffPartnerRow).join('')
    || emptyRow('store', 'No partner businesses waiting', 'New partner businesses show here until InneRISE approves or declines them.')}</section>
    <p class="foot-note">${icon('shield')}<span>The partner sees every note you write. A partner's campaigns can be approved once the business is verified, and its rewards and offers once it has accepted the Sponsor Reward Terms.</span></p>`;
}
function staffCampaignModal(id, approve) {
  const c = ((S.data.staffPartners || {}).campaigns || []).find((x) => x.id === id);
  if (!c) return;
  const who = (c.partner || {}).name || 'The partner';
  const text = approve
    ? (c.re_review ? `People see the changes to "${c.title}" at once.` : `People can find "${c.title}" in the InneRISE app once it starts.`)
    : (c.re_review ? `The changes go back to ${who}, and people keep seeing the version approved before. Say what to change.`
      : `"${c.title}" goes back to ${who}. Say what to change.`);
  openModal({ title: esc(approve ? `Approve "${c.title}"?` : `Send "${c.title}" back?`), submit: approve ? 'Approve' : 'Send back',
    body: `<p>${esc(text)}</p>
      <label class="field"><span class="field-label">Note to ${esc(who)}${approve ? ' (optional)' : ''}</span>
        <textarea class="input" name="note" rows="3" maxlength="300" data-autofocus></textarea>
        <span class="field-help">${approve ? 'Up to 300 characters.' : '5 to 300 characters.'} The partner sees it.</span></label>`,
    async onSubmit(form) {
      const res = await rpc.staffPartnerDecide(c.id, approve, form.elements.note.value.trim() || null);
      toast(approve ? (res && res.revision ? `Approved. People see the changes to "${c.title}" now.` : `Approved. "${c.title}" is approved.`)
        : `Sent "${c.title}" back to ${who} with your note.`);
      await refresh(['staffPartners'], ['staffOverview']);
    } });
}

// Library: InneRISE's own templates (075), draft, published or retired.
const TPL_STATUS = { draft: ['Draft', 'chip-wait'], published: ['Published', 'chip-ok'], retired: ['Retired', 'chip-muted'] };
function staffTemplateCard(t) {
  const ic = t.kind === 'reward' ? (t.reward_kind === 'recognition' ? 'star' : 'gift')
    : t.tracking === 'device' ? (t.metric === 'floors' ? 'stairs' : 'trophy') : (HABITS[t.habit] || HABITS.positive_habit)[1];
  const ages = AGES.filter(([k]) => (t.age_groups || []).includes(k)).map(([, x]) => x).join(', ');
  const kinds = listWords((t.for_kinds || []).map((k) => KIND_PLURAL[k] || k));
  const [stText, stCls] = TPL_STATUS[t.status] || [ucFirst(t.status), ''];
  const b = (to, text, primary = false) => `<button class="btn btn-sm${primary ? ' btn-primary' : ''}" data-act="staff-lib-set" data-template="${esc(t.id)}" data-to="${to}">${text}</button>`;
  const acts = t.status === 'draft' ? b('published', `${icon('check')}<span>Publish</span>`, true) + b('retired', 'Retire')
    : t.status === 'published' ? b('retired', 'Retire') + b('draft', 'Back to draft')
      : b('published', `${icon('check')}<span>Publish again</span>`, true) + b('draft', 'Back to draft');
  return `<article class="glass card ch-card tpl-card staff-tpl" data-template="${esc(t.id)}">
    <div class="ch-top">${ring(ic)}
      <div class="ch-head"><h3 class="ch-title">${esc(t.title)}</h3>
        <div class="chips"><span class="chip ${stCls}">${t.status === 'published' ? '<span class="dot"></span>' : ''}<span>${esc(stText)}</span></span>
          <span class="chip${t.kind === 'reward' ? ' chip-accent' : ''}">${icon(t.kind === 'reward' ? 'gift' : 'trophy')}<span>${t.kind === 'reward' ? 'Reward' : 'Challenge'}</span></span>
          ${ages ? `<span class="chip">${icon('people')}<span>${esc(ages)}</span></span>` : ''}</div></div></div>
    ${t.description ? `<p class="ch-desc">${esc(t.description)}</p>` : ''}
    ${templateFacts(t)}
    ${kinds ? `<p class="usub-line">${icon('building')}<span>For ${esc(kinds)}</span></p>` : ''}
    <div class="ch-actions">${acts}</div>
  </article>`;
}
function staffLibraryPage() {
  const st = staffSt(LIB_STATUS, 'draft');
  const head = staffHead('Library', "InneRISE's own templates in the Challenge & Rewards Library. Publish a draft so organizations can use it, or retire one.");
  if (S.data.staffLibrary && S.data.staffLibrary.st !== st) delete S.data.staffLibrary;
  const tools = `<div class="lib-filters staff-tools"><select id="staff-lib-st" class="input" data-change="staff-lib-st" aria-label="Show">${LIB_STATUS
    .map(([k, t]) => `<option value="${k}"${k === st ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  const wait = pageBody(['staffLibrary']);
  if (wait) return head + tools + wait;
  const list = S.data.staffLibrary.list;
  const named = Object.fromEntries(LIB_STATUS)[st];
  return `${head}${tools}
    ${label(`${st === 'all' ? 'Every template' : named} (${list.length})`)}
    ${list.length ? `<div class="ch-list tpl-list">${list.map(staffTemplateCard).join('')}</div>`
    : `<section class="glass list">${emptyRow('book', st === 'draft' ? 'No drafts waiting' : 'Nothing here', st === 'draft'
      ? "Templates InneRISE's team writes show here as drafts until someone publishes them." : 'Templates with this status show here.')}</section>`}
    <p class="foot-note">${icon('shield')}<span>Templates hold no prices, codes or brands. A published template shows in the library of every kind of organization it is for. Retiring one takes it out; what organizations already made from it stays as it is.</span></p>`;
}
function staffLibraryModal(id, to) {
  const t = ((S.data.staffLibrary || {}).list || []).find((x) => x.id === id);
  if (!t) return;
  const who = listWords((t.for_kinds || []).map((k) => KIND_PLURAL[k] || k)) || 'every kind of organization';
  const spec = {
    published: [`Publish "${t.title}"?`, 'Publish', `It shows in the Challenge & Rewards Library for ${who} at once.`, `Published. "${t.title}" is in the library now.`],
    retired: [`Retire "${t.title}"?`, 'Retire', 'It comes out of the library. What organizations already made from it stays as it is.', `Retired. "${t.title}" is out of the library.`],
    draft: [`Move "${t.title}" back to drafts?`, 'Back to draft', 'It comes out of the library until someone publishes it again.', `"${t.title}" is a draft again.`],
  }[to];
  if (!spec) return;
  openModal({ title: esc(spec[0]), submit: spec[1], danger: to === 'retired', body: `<p>${esc(spec[2])}</p>`,
    async onSubmit() {
      await rpc.staffLibrarySetStatus(t.id, to);
      toast(spec[3]);
      await refresh(['staffLibrary'], ['staffOverview']);
    } });
}

// Prize logos and terms (078): a partner's new logo, and its new or changed prize terms, before winners see them.
function staffTermsCard(x) {
  const t = x.terms || {};
  const whose = "the partner's";
  return `<article class="glass card ch-card staff-terms" data-campaign="${esc(x.campaign_id)}">
    <div class="ch-top">${ring('tag')}
      <div class="ch-head"><h3 class="ch-title">${esc(x.title || 'An offer')}</h3>
        <div class="chips"><span class="chip chip-wait">${icon('clock')}<span>${x.live ? 'Changed prize terms' : 'New prize terms'}</span></span>
          <span class="chip"><span>${x.reward_type === 'achievement' ? 'Challenge reward' : 'Offer'}</span></span>
          <span class="chip">${icon('store')}<span>${esc(x.partner || '')}</span></span></div></div></div>
    <div class="terms-lines">
      <span class="usub-line terms-line">${icon('clock')}<span>New: ${esc(ucFirst(termsLine(t, whose)))}</span></span>
      ${x.live ? `<span class="usub-line terms-line">${icon('tag')}<span>Approved before: ${esc(ucFirst(termsLine(x.live, whose)))}</span></span>` : ''}
      ${t.shared_code_set ? `<span class="usub-line">${icon('key')}<span>A business code is set. It isn't shown here.</span></span>` : ''}</div>
    ${t.instructions ? `<div class="review-note">${icon('mail')}<div><div class="review-note-label">What winners are told</div><p>${esc(t.instructions)}</p></div></div>` : ''}
    ${facts([['Who can win', esc(t.min_age ? `People ${num(t.min_age)} and older` : 'Any age')], ['Area', esc(areaText(t))], ['Sent', esc(staffDay(x.since))]])}
    <div class="ch-actions"><button class="btn btn-sm btn-primary" data-act="staff-prize" data-k="terms" data-id="${esc(x.campaign_id)}" data-approve="1">${icon('check')}<span>Approve</span></button>
      <button class="btn btn-sm" data-act="staff-prize" data-k="terms" data-id="${esc(x.campaign_id)}" data-approve="0">${icon('back')}<span>Send back</span></button></div>
  </article>`;
}
function staffPrizesPage() {
  const head = staffHead('Prize logos & terms', "Partners' logos and prize terms, waiting for InneRISE before winners see them.");
  const wait = pageBody(['staffPrizes']);
  if (wait) return head + wait;
  const d = S.data.staffPrizes;
  const logoRows = d.logos.map((x) => `<div class="row staff-logo-row" data-org="${esc(x.org_id)}">
    <div class="giver-logo">${x.url ? `<img src="${esc(x.url)}" alt="${esc(x.name)} logo">` : ring('store', 'lg')}</div>
    <div class="grow"><div class="uname">${esc(x.name)}</div><div class="usub">${esc(`${kindName(x.kind)} · sent ${staffDay(x.since)}`)}</div>
      <p class="field-help">Winners see it on each prize from ${esc(x.name)}, beside its name, city and website.</p></div>
    <div class="row-side"><button class="btn btn-sm btn-primary" data-act="staff-prize" data-k="logo" data-id="${esc(x.org_id)}" data-approve="1">${icon('check')}<span>Approve</span></button>
      <button class="btn btn-sm" data-act="staff-prize" data-k="logo" data-id="${esc(x.org_id)}" data-approve="0">${icon('back')}<span>Send back</span></button></div></div>`).join('');
  return `${head}
    ${label(`Logos (${d.logos.length})`)}
    <section class="glass list staff-logos" aria-label="Logos">${logoRows || emptyRow('check', 'No logos waiting', "A partner's new logo shows here before winners see it.")}</section>
    ${label(`Prize terms (${d.terms.length})`)}
    ${d.terms.length ? `<div class="ch-list staff-terms-list">${d.terms.map(staffTermsCard).join('')}</div>`
    : `<section class="glass list">${emptyRow('check', 'No prize terms waiting', "A partner's new or changed prize terms show here before prizes follow them.")}</section>`}
    <p class="foot-note">${icon('shield')}<span>The partner sees every note you write. Until you approve them, winners see the partner's name instead of a new logo, and new prize terms aren't used.</span></p>`;
}
function staffPrizeModal(k, id, approve) {
  const d = S.data.staffPrizes || {};
  const x = k === 'logo' ? (d.logos || []).find((y) => y.org_id === id) : (d.terms || []).find((y) => y.campaign_id === id);
  if (!x) return;
  const who = (k === 'logo' ? x.name : x.partner) || 'the partner';
  const what = k === 'logo' ? `${who}'s logo` : `the prize terms for "${x.title}"`;
  const text = approve ? (k === 'logo' ? `Winners see it on ${who}'s prizes at once.` : 'New prizes follow these terms at once.')
    : `${ucFirst(what)} ${k === 'logo' ? 'goes' : 'go'} back to ${who}. Say what to change.`;
  openModal({ title: esc(approve ? `Approve ${what}?` : `Send ${what} back?`), submit: approve ? 'Approve' : 'Send back',
    body: `<p>${esc(text)}</p>
      <label class="field"><span class="field-label">Note to ${esc(who)}${approve ? ' (optional)' : ''}</span>
        <textarea class="input" name="note" rows="3" maxlength="300" data-autofocus></textarea>
        <span class="field-help">Up to 300 characters. The partner sees it.</span></label>`,
    async onSubmit(form) {
      const note = form.elements.note.value.trim() || null;
      if (k === 'logo') await rpc.staffPrizeLogo(x.org_id, approve, note);
      else await rpc.staffPrizeTerms(x.campaign_id, approve, note);
      toast(approve ? `Approved. ${ucFirst(what)} ${k === 'logo' ? 'shows on its prizes now' : 'are in use now'}.` : `Sent ${what} back to ${who} with your note.`);
      await refresh(['staffPrizes'], ['staffOverview']);
    } });
}

// Modal, menu, toast -------------------------------------------------------------------------------
let openMenuState = null;

function openMenu(anchor, html) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu glass';
  m.setAttribute('role', 'menu');
  m.innerHTML = html;
  layer.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth;
  const h = m.offsetHeight;
  const left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12));
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 6);
  m.style.left = `${left}px`;
  m.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');
  openMenuState = { el: m, anchor };
  const first = m.querySelector('.menu-item:not([disabled])');
  if (first) first.focus({ preventScroll: true });
}

function closeMenu() {
  if (!openMenuState) return;
  openMenuState.el.remove();
  openMenuState.anchor.setAttribute('aria-expanded', 'false');
  openMenuState = null;
}

let modalOpen = null;
function openModal({ title, body, submit, danger = false, onSubmit, cancel = 'Cancel', onOpen }) {
  closeMenu();
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <form class="modal-form stack" novalidate>
      <h2 class="modal-title" id="modal-title">${title}</h2>
      <div class="modal-body stack">${body}</div>
      <p class="form-error" role="alert" hidden></p>
      <div class="modal-actions"><button type="button" class="btn" data-modal-cancel>${esc(cancel)}</button>
        ${submit ? `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submit)}</button>` : ''}</div>
    </form></div>`;
  layer.appendChild(wrap);
  const form = wrap.querySelector('form');
  const back = document.activeElement;
  const close = () => { wrap.remove(); modalOpen = null; if (back && back.isConnected) back.focus({ preventScroll: true }); };
  modalOpen = { wrap, close };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-modal-cancel]').addEventListener('click', close);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = form.querySelector('[type=submit]');
    setError(form, null);
    busy(btn, true);
    try {
      const keepOpen = await onSubmit(form);
      if (keepOpen !== true) close();
    } catch (err) {
      if (!(await signedOut(err))) setError(form, err.message);
    } finally {
      busy(btn, false);
    }
  });
  const focusEl = wrap.querySelector('[data-autofocus]') || wrap.querySelector('input, select') || wrap.querySelector('[type=submit]');
  if (focusEl) focusEl.focus();
  if (onOpen) onOpen(form);
}
function closeModal() { if (modalOpen) modalOpen.close(); }

function setError(form, msg) {
  const el = form.querySelector(':scope > .form-error, .form-error');
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('is-busy', on);
  if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast glass';
  t.textContent = msg;
  toasts.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3400);
  setTimeout(() => t.remove(), 3800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Keep what someone typed when the page re-renders around them.
function keepForms() {
  const out = {};
  app.querySelectorAll('form[data-keep] [name]').forEach((el) => {
    if (el.type === 'radio' || el.type === 'checkbox' || el.type === 'hidden') return; // their state lives in S
    if (el.dataset.dirty && el.form) out[`${el.form.dataset.keep}:${el.name}`] = el.value;
  });
  return out;
}
function restoreForms(kept) {
  for (const [key, value] of Object.entries(kept)) {
    const [form, name] = key.split(':');
    const el = app.querySelector(`form[data-keep="${form}"] [name="${name}"]`);
    if (el) { el.value = value; el.dataset.dirty = '1'; }
  }
}
const clean = (form) => form.querySelectorAll('[data-dirty]').forEach((el) => delete el.dataset.dirty);

// Actions ------------------------------------------------------------------------------------------
const org = () => S.orgId;

const actions = {
  'nav-toggle'() { S.navOpen = !S.navOpen; render(); },
  'nav-close'() { if (S.navOpen) { S.navOpen = false; render(); } },
  'notice-close'() { S.notice = null; S.noticeKind = 'ok'; render(); },
  retry() { S.loadError = null; S.data = {}; render(); },
  async 'retry-orgs'() { S.orgsError = null; render(); await loadOrgs(); render(); },
  async 'sign-out'() {
    await auth.signOut();
    reset();
    render();
  },

  // Sign in
  async apple(btn) {
    S.signin.error = null;
    busy(btn, true);
    if (param('org') || param('section') || param('kind')) tabStore.set(AFTER_KEY, location.search);
    try {
      await auth.apple();
      const s = await auth.session();
      if (s) await enter(s);
    } catch (e) {
      S.signin.error = e.message;
      render();
    } finally { if (btn.isConnected) busy(btn, false); }
  },
  'email-start'() { S.signin = { ...S.signin, step: 'email', error: null }; render(); },
  'email-back'() { S.signin = { ...S.signin, step: 'email', error: null }; render(); },
  async resend(btn) {
    busy(btn, true);
    try { await auth.sendCode(S.signin.email); toast(`We sent a new code to ${S.signin.email}.`); S.signin.error = null; }
    catch (e) { S.signin.error = e.message; render(); }
    finally { if (btn.isConnected) busy(btn, false); }
  },

  // Registration
  'reg-skip'() { S.registering = { ...S.registering, step: 3 }; render(); },
  'reg-finish'() { finishRegistration(); },

  // People
  'person-menu'(btn) {
    if (openMenuState && openMenuState.anchor === btn) return closeMenu();
    const m = findPerson(btn.dataset.user);
    if (m) openMenu(btn, personMenu(m));
  },
  async 'people-more'(btn) {
    busy(btn, true);
    try {
      const p = S.data.people;
      const next = await fetchPeople(p.list.length, 200);
      if (next.unit === p.unit) S.data.people = { unit: p.unit, list: [...p.list, ...next.list], more: next.more };
      render();
    } catch (e) { if (!(await signedOut(e))) toast(e.message); }
    finally { if (btn.isConnected) busy(btn, false); }
  },
  'role-admin'(el) {
    const m = findPerson(el.dataset.user);
    closeMenu();
    openModal({
      title: `Make ${esc(personName(m))} an administrator?`,
      body: `<p>Administrators can do everything here: invite and remove people, give roles, and change the ${words().org}'s details.</p>`,
      submit: 'Make administrator',
      onSubmit: async () => {
        await rpc.roleSet(org(), m.user_id, 'admin', null, true);
        await afterPeopleChange(`${personName(m)} is now an administrator.`);
      },
    });
  },
  async 'role-give'(el) {
    const m = findPerson(el.dataset.user);
    const role = el.dataset.role;
    closeMenu();
    try {
      await rpc.roleSet(org(), m.user_id, role, null, true);
      await afterPeopleChange(`${personName(m)} is now ${article(roleLabel(role).toLowerCase())}.`);
    } catch (e) { if (!(await signedOut(e))) toast(e.message); }
  },
  async 'role-take'(el) {
    const m = findPerson(el.dataset.user);
    const role = el.dataset.role;
    const unit = el.dataset.unit || null;
    closeMenu();
    try {
      await rpc.roleSet(org(), m.user_id, role, unit, false);
      const units = S.data.view.units || [];
      const what = `${roleLabel(role).toLowerCase()} role${unit ? ` for ${unitPath(unit, units)}` : ''}`;
      await afterPeopleChange(role === 'prize_redeemer'
        ? `${personName(m)} can't redeem prizes${unit ? ` at ${unitPath(unit, units)}` : ''} anymore.` : `Removed ${personName(m)}'s ${what}.`);
    } catch (e) { if (!(await signedOut(e))) toast(e.message); }
  },
  // A role for one place and everything under it (manager, leader, teacher).
  'role-unit'(el) {
    const m = findPerson(el.dataset.user);
    const w = words();
    const def = roleDef(el.dataset.role, w);
    const units = S.data.view.units || [];
    closeMenu();
    if (!units.length) {
      openModal({ title: 'Nothing to look after yet', body: `<p>${esc(article(def.label))} looks after one of your ${esc(w.unitsLower)}. Add one in ${esc(w.units)}, then come back.</p>`, cancel: 'OK' });
      return;
    }
    openModal({
      title: `Make ${esc(personName(m))} ${esc(article(def.label.toLowerCase()))}`,
      body: `<label class="field"><span class="field-label">${esc(def.label)} of</span>
        <select class="input" name="unit" data-autofocus>${unitOptions(units, (m.units && m.units[0] && m.units[0].id) || '', null)}</select>
        <span class="field-help">${esc(def.help || '')}</span></label>`,
      submit: `Make ${def.label.toLowerCase()}`,
      onSubmit: async (form) => {
        const unit = form.elements.unit.value;
        await rpc.roleSet(org(), m.user_id, def.role, unit, true);
        await afterPeopleChange(`${personName(m)} is now ${def.label.toLowerCase()} of ${unitPath(unit, units)}.`);
      },
    });
  },
  'member-remove'(el) {
    const m = findPerson(el.dataset.user);
    closeMenu();
    openModal({
      title: `Remove ${esc(personName(m))} from ${esc(currentOrg().name)}?`,
      body: `<p>They leave the ${words().org} and lose any roles. Their own InneRISE account and everything in it stay theirs.</p>
        <p class="muted">They can't rejoin with a code after being removed.</p>`,
      submit: `Remove from ${words().org}`,
      danger: true,
      onSubmit: async () => {
        await rpc.memberRemove(org(), m.user_id);
        await afterPeopleChange(`Removed ${personName(m)} from the ${words().org}.`);
      },
    });
  },

  // Locations & departments
  'unit-menu'(btn) {
    if (openMenuState && openMenuState.anchor === btn) return closeMenu();
    const units = S.data.view.units || [];
    const u = units.find((x) => x.id === btn.dataset.unit);
    if (u) openMenu(btn, unitMenu(u, unitRights(u, units)));
  },
  'unit-add'(el) {
    const units = S.data.view.units || [];
    const parent = el.dataset.parent || null;
    const p = parent ? units.find((u) => u.id === parent) : null;
    closeMenu();
    const w = words();
    const kinds = p ? childKinds(p.kind) : topKindsToAdd();
    openModal({
      title: p ? `Add under ${esc(p.name)}` : 'Add at the top',
      body: `<label class="field"><span class="field-label">Kind</span>
          <select class="input" name="kind">${kinds.map((k) => `<option value="${k}">${KIND_LABEL[k]}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Name</span>
          <input class="input" name="name" maxlength="80" placeholder="${esc(p ? w.placeholders.child : w.placeholders.top)}" data-autofocus></label>
        ${p ? `<p class="field-help">Inside ${esc(unitPath(p.id, units))}.</p>` : ''}`,
      submit: 'Add',
      onSubmit: async (form) => {
        const name = form.elements.name.value.trim();
        if (!name) throw new Error('Give it a name.');
        const k = form.elements.kind.value;
        await rpc.unitAdd(org(), parent, k, name);
        toast(`Added ${name}.`);
        await refresh(['view', 'details'], ['people', 'all']);
      },
    });
  },
  'unit-rename'(el) {
    const u = (S.data.view.units || []).find((x) => x.id === el.dataset.unit);
    closeMenu();
    openModal({
      title: `Rename ${esc(u.name)}`,
      body: `<label class="field"><span class="field-label">Name</span><input class="input" name="name" maxlength="80" value="${esc(u.name)}" data-autofocus></label>`,
      submit: 'Rename',
      onSubmit: async (form) => {
        const name = form.elements.name.value.trim();
        if (!name) throw new Error('Give it a name.');
        if (name !== u.name) {
          await rpc.unitRename(u.id, name);
          toast(`Renamed to ${name}.`);
          await refresh(['view', 'details'], ['people', 'all']);
        }
      },
    });
  },
  'unit-remove'(el) {
    const units = S.data.view.units || [];
    const u = units.find((x) => x.id === el.dataset.unit);
    const codes = (S.data.view.invitations || []).filter((i) => i.unit_id === u.id).length;
    closeMenu();
    openModal({
      title: `Remove ${esc(u.name)}?`,
      body: `<p>Only an empty ${esc((KIND_LABEL[u.kind] || 'place').toLowerCase())} can be removed: nothing under it and no one in it.</p>
        ${codes ? `<p class="muted">Its ${plural(codes, 'open invite code', 'open invite codes')} will stop working.</p>` : ''}`,
      submit: 'Remove',
      danger: true,
      onSubmit: async () => {
        await rpc.unitRemove(u.id);
        toast(`Removed ${u.name}.`);
        await refresh(['view', 'details'], ['people', 'all']);
      },
    });
  },
  'unit-address'(el) {
    const u = (S.data.view.units || []).find((x) => x.id === el.dataset.unit);
    const d = (S.data.details.units || []).find((x) => x.id === u.id) || {};
    const orgTz = S.data.view.org.time_zone;
    closeMenu();
    const f = (name, text, attrs = '') => `<label class="field"><span class="field-label">${text}</span><input class="input" name="${name}" value="${esc(d[name] || '')}" ${attrs}></label>`;
    openModal({
      title: `${esc(u.name)}: address and time zone`,
      body: `<div class="form-grid">
          ${f('street', 'Street address', 'maxlength="200" data-autofocus').replace('class="field"', 'class="field span-2"')}
          ${f('city', 'City', 'maxlength="100"')}
          ${f('region', 'State or region', 'maxlength="100"')}
          ${f('postal_code', 'Postal code', 'maxlength="20"')}
          <label class="field"><span class="field-label">Country</span><select class="input" name="country">${countryOptions(d.country || '')}</select></label>
          <label class="field span-2"><span class="field-label">Time zone</span>
            <select class="input" name="time_zone">${tzOptions(d.time_zone || '', `Same as the ${words().org} (${tzLabel(orgTz)})`)}</select></label>
        </div>`,
      submit: 'Save',
      onSubmit: async (form) => {
        const payload = {};
        for (const k of ['street', 'city', 'region', 'postal_code', 'country', 'time_zone']) {
          const val = String(form.elements[k].value || '').trim();
          if ((d[k] || '') !== val) payload[k] = val;
        }
        if (Object.keys(payload).length) {
          await rpc.unitDetailsSet(u.id, payload);
          toast(`Saved ${u.name}'s address.`);
          await refresh(['details']);
        }
      },
    });
  },

  // Invite codes
  async 'code-copy'(btn) {
    const ok = await copyText(btn.dataset.code);
    toast(ok ? `Copied ${btn.dataset.code}.` : "Couldn't copy. Select the code and copy it yourself.");
  },
  'new-code-done'() { S.newCode = null; render(); },
  'code-close'(btn) {
    const code = btn.dataset.code;
    openModal({
      title: `Close code ${esc(code)}?`,
      body: `<p>No one else can join with it. People who already joined stay in the ${words().org}.</p>`,
      submit: 'Close code',
      danger: true,
      onSubmit: async () => {
        await rpc.inviteClose(code);
        if (S.newCode && S.newCode.code === code) S.newCode = null;
        toast(`Closed ${code}.`);
        await refresh(['view']);
      },
    });
  },

  // Billing
  'billing-set'() {
    const all = S.data.all || [];
    const eligible = sortPeople(all.filter((m) => m.can_be_admin && !isBillingContact(m)));
    if (!eligible.length) {
      openModal({ title: 'No one to choose yet', body: "<p>The billing contact has to be an active adult member who isn't a student.</p>", cancel: 'OK' });
      return;
    }
    openModal({
      title: 'Choose a billing contact',
      body: `<label class="field"><span class="field-label">Billing contact</span>
          <select class="input" name="who" data-autofocus><option value="">Choose a person</option>
          ${eligible.map((m) => `<option value="${esc(m.user_id)}">${m.user_id === S.user.id ? 'You' : esc(personName(m))}${m.units && m.units[0] ? ` · ${esc(m.units[0].name)}` : ''}</option>`).join('')}</select>
          <span class="field-help">They can open Billing here. It gives them nothing else.</span></label>`,
      submit: 'Make billing contact',
      onSubmit: async (form) => {
        const who = form.elements.who.value;
        if (!who) throw new Error('Choose who looks after billing.');
        const m = eligible.find((x) => x.user_id === who);
        await rpc.roleSet(org(), who, 'billing_contact', null, true);
        toast(`${who === S.user.id ? 'You are' : `${personName(m)} is`} now the billing contact.`);
        await refresh(['all'], ['people']);
      },
    });
  },
  'billing-remove'(btn) {
    const m = findPerson(btn.dataset.user);
    if (!m) return;
    const you = m.user_id === S.user.id;
    openModal({
      title: you ? 'Stop being the billing contact?' : `Remove ${esc(personName(m))} as billing contact?`,
      body: `<p>${you ? 'You stay' : 'They stay'} in the ${words().org}, with any other roles.</p>`,
      submit: 'Remove',
      danger: true,
      onSubmit: async () => {
        await rpc.roleSet(org(), m.user_id, 'billing_contact', null, false);
        toast(you ? "You're no longer the billing contact." : `${personName(m)} is no longer the billing contact.`);
        await refresh(['all'], ['people']);
      },
    });
  },

  // Bulk enrollment
  'enroll-all'() { S.enrollPick = new Set(((S.data.view && S.data.view.units) || []).map((u) => u.id)); render(); },
  'enroll-none'() { S.enrollPick = new Set(); render(); },
  'enroll-done'() { S.enroll = null; render(); },
  'enroll-print'() { window.print(); },
  'enroll-csv'() {
    const r = S.enroll;
    const v = S.data.view;
    if (!r || !v) return;
    const tz = v.org.time_zone;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([enrollCsv(r, tz)], { type: 'text/csv;charset=utf-8' }));
    a.download = `${slug(v.org.name)}-invite-codes-${isoDay(r.at, tz)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast('Downloaded the codes as a CSV file.');
  },

  // Settings
  'domain-remove'(btn) {
    const dom = btn.dataset.domain;
    openModal({
      title: `Remove ${esc(dom)}?`,
      body: `<p>People joining won't see it as your ${words().org}'s confirmed domain any more. You can add it again later.</p>`,
      submit: 'Remove domain',
      danger: true,
      onSubmit: async () => {
        await rpc.domainRemove(org(), dom);
        toast(`Removed ${dom}.`);
        await refresh(['details']);
      },
    });
  },
  handover() {
    const all = S.data.all || [];
    const name = currentOrg().name;
    const eligible = sortPeople(all.filter((m) => m.user_id !== S.user.id && m.can_be_admin));
    openModal({
      title: 'Hand over and leave',
      body: `<label class="field"><span class="field-label">Who takes over as administrator</span>
          <select class="input" name="who" data-autofocus><option value="">Choose a person</option>
          ${eligible.map((m) => `<option value="${esc(m.user_id)}">${esc(personName(m))}${m.units && m.units[0] ? ` · ${esc(m.units[0].name)}` : ''}</option>`).join('')}</select></label>
        <p>They become an administrator of ${esc(name)}. Then you leave ${esc(name)}: you stop being a member and lose access to this portal.</p>`,
      submit: 'Hand over and leave',
      danger: true,
      onSubmit: async (form) => {
        const who = form.elements.who.value;
        if (!who) throw new Error('Choose who takes over.');
        const m = eligible.find((x) => x.user_id === who);
        await rpc.adminTransfer(org(), who);
        try {
          await rpc.leave(org());
        } catch (e) {
          // The hand-over went through, so this company is no longer ours to manage here.
          await afterLeaving(`${personName(m)} is now the administrator of ${name}, but leaving didn't work: ${e.message}`);
          return;
        }
        await afterLeaving(`You handed ${name} over to ${personName(m)} and left.`);
      },
    });
  },
  leave() {
    const name = currentOrg().name;
    const alone = !(S.data.all || []).some((m) => m.user_id !== S.user.id);
    openModal({
      title: alone ? `Leave and close ${esc(name)}?` : `Leave ${esc(name)}?`,
      body: alone
        ? '<p>You are the only person in it. When you leave, it closes and its invite codes stop working.</p>'
        : "<p>You stop being a member and lose access to this portal. The other administrators keep running it.</p>",
      submit: alone ? 'Leave and close' : `Leave ${words().org}`,
      danger: true,
      onSubmit: async () => {
        await rpc.leave(org());
        await afterLeaving(alone ? `You left ${name}, and it is now closed.` : `You left ${name}.`);
      },
    });
  },
};

// Where an organization opens by default: its overview, or the one section this account has there.
const homeOf = (o) => (sectionsFor(o).includes('overview') ? 'overview' : sectionsFor(o)[0]);

async function afterLeaving(msg) {
  say(msg);
  setOrg(null);
  S.orgs = null;
  render();
  await loadOrgs();
  const o = currentOrg();
  go(o ? { org: o.org_id, section: homeOf(o) } : { section: 'register' }, true);
  render();
}

function finishRegistration() {
  const r = S.registering;
  const o = dashOrgs().find((x) => x.org_id === (r && r.orgId));
  S.registering = null;
  const w = words(o ? o.kind : r && r.kind);
  say(o && o.status === 'pending'
    ? `${o.name} is registered. Set up your ${w.unitsLower} while InneRISE checks it.`
    : `${o ? o.name : `Your ${w.org}`} is ready. Next, add your ${w.topLabel.toLowerCase()} and create an invite code.`);
  setOrg(r ? r.orgId : S.orgId);
  S.data = {};
  go({ org: S.orgId, section: 'overview' }, true);
  render();
}

const forms = {
  async enroll(form) {
    const o = org();
    const units = (S.data.view && S.data.view.units) || [];
    const ids = unitTree(units).map(({ unit }) => unit.id).filter((id) => S.enrollPick.has(id));
    if (!ids.length) return setError(form, 'Pick at least one place.');
    if (ids.length > ENROLL_MAX) return setError(form, `Pick up to ${ENROLL_MAX} places at a time.`);
    const uses = Number(form.elements.uses.value);
    const days = Number(form.elements.days.value);
    if (!Number.isInteger(uses) || uses < 1) return setError(form, 'Pick how many people can use each code: a whole number, 1 or more.');
    if (!Number.isInteger(days) || days < 1 || days > 90) return setError(form, 'Pick when the codes expire: a whole number of days from 1 to 90.');
    const mtype = form.elements.mtype.value;
    const btn = form.querySelector('[type=submit]');
    const text = btn.textContent;
    busy(btn, true);
    const made = [];
    let failed = null;
    for (const u of ids) {
      btn.textContent = `Creating ${made.length + 1} of ${ids.length}…`;
      try {
        const res = await rpc.inviteCreate(o, u, mtype, uses, days);
        made.push({ unit: u, code: res.code });
      } catch (e) {
        if (await signedOut(e)) return;
        failed = { unit: u, place: unitPath(u, units), message: e.message, left: ids.length - made.length };
        break;
      }
      if (S.orgId !== o) return;
    }
    if (!made.length) {
      btn.textContent = text;
      busy(btn, false);
      setError(form, failed ? failed.message : 'No codes were made.');
      return;
    }
    // The expiry dates exactly as the server set them.
    let view = S.data.view;
    try { view = await rpc.adminView(o); } catch { /* fall back to the dates asked for */ }
    if (S.orgId !== o) return;
    S.data.view = view;
    const inv = new Map((view.invitations || []).map((i) => [i.code, i]));
    S.enroll = {
      type: mtype,
      at: Date.now(),
      failed,
      codes: made.map(({ unit, code }) => {
        const i = inv.get(code);
        return { unit, place: unitPath(unit, units), code, uses: i ? i.max_uses : uses, expires: i ? i.expires_at : new Date(Date.now() + days * DAY).toISOString() };
      }),
    };
    S.enrollPick = new Set();
    clean(form);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  async 'send-code'(form) {
    const email = form.elements.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { S.signin.error = 'Enter your email address, like you@company.com.'; S.signin.email = email; render(); return; }
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await auth.sendCode(email);
      S.signin = { step: 'code', email, error: null };
    } catch (e) {
      S.signin = { ...S.signin, email, error: e.message };
    }
    render();
  },
  async 'verify-code'(form) {
    const code = form.elements.code.value.replace(/\D/g, '');
    if (code.length !== 6) { S.signin.error = 'Enter the 6-digit code from the email.'; render(); return; }
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      const session = await auth.verifyCode(S.signin.email, code);
      if (session) await enter(session);
    } catch (e) {
      S.signin.error = e.message;
      render();
    }
  },
  async 'reg-1'(form) {
    const name = form.elements.name.value.trim();
    const kind = S.regKind || 'business';
    if (name.length < 2) return setError(form, `Enter your ${words(kind).org} name (at least 2 characters).`);
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      const res = await rpc.create(kind, name, form.elements.tz.value);
      clean(form);
      S.registering = { step: 2, orgId: res.org_id, kind };
      await loadOrgs(res.org_id);
      render();
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
  async 'reg-2'(form) {
    const d = readDetails(form, {});
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      if (Object.keys(d).length) await rpc.profileSet(S.registering.orgId, d);
      S.registering = { ...S.registering, step: 3 };
      render();
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
  async 'reg-3'(form) {
    const dom = cleanDomain(form.elements.domain.value);
    if (!dom) return setError(form, 'Enter your email domain, or choose Skip.');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await rpc.domainAdd(S.registering.orgId, dom);
      finishRegistration();
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, domainError(e)); }
    }
  },
  async profile(form) {
    const before = S.data.details.org;
    const d = readDetails(form, before);
    if ('name' in d && d.name.length < 2) return setError(form, `Enter the ${words().org} name (at least 2 characters).`);
    if (!Object.keys(d).length) { toast('No changes to save.'); return; }
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await rpc.profileSet(org(), d);
      clean(form);
      toast(`Saved the ${words().org} details.`);
      if ('name' in d) S.orgs = (await rpc.mine()) || S.orgs;
      await refresh(['details', 'view']);
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
  async 'domain-add'(form) {
    const dom = cleanDomain(form.elements.domain.value);
    if (!dom) return setError(form, 'Enter a domain, like acme.com.');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      const res = await rpc.domainAdd(org(), dom);
      clean(form);
      toast(`${res.domain || dom} is confirmed.`);
      await refresh(['details']);
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, domainError(e)); }
    }
  },
  async 'report-floor'(form) {
    const n = Number(form.elements.min_group.value);
    if (!Number.isInteger(n) || n < 3 || n > 50) return setError(form, 'Pick a whole number from 3 to 50.');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await rpc.settingsSet(org(), n);
      clean(form);
      toast(`Reports now show groups of ${n} or more.`);
      await refresh(['view'], ['placeCounts']);
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
  async 'invite-create'(form) {
    const uses = Number(form.elements.uses.value);
    const days = Number(form.elements.days.value);
    if (!Number.isInteger(uses) || uses < 1) return setError(form, 'Pick how many people can use it: a whole number, 1 or more.');
    if (!Number.isInteger(days) || days < 1 || days > 90) return setError(form, 'Pick when it expires: a whole number of days from 1 to 90.');
    const unit = form.elements.unit.value || null;
    const mtype = form.elements.mtype.value;
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      const res = await rpc.inviteCreate(org(), unit, mtype, uses, days);
      S.newCode = { code: res.code, unit, type: mtype, uses, expires: new Date(Date.now() + days * DAY).toISOString() };
      clean(form);
      await refresh(['view']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
};

// Programs: actions, forms and changes ----------------------------------------------------------------
const findChallenge = (id) => (S.data.challenges || []).find((x) => x.id === id) || null;
const splitCodes = (text) => String(text || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
async function tryAct(btn, fn) {
  if (btn) busy(btn, true);
  try {
    await fn();
  } catch (e) {
    if (!(await signedOut(e))) toast(e.message);
  } finally {
    if (btn && btn.isConnected) busy(btn, false);
  }
}
const codesBody = (what) => `<label class="field"><span class="field-label">Codes, one per line</span>
    <textarea class="input input-codes" name="codes" rows="7" autocapitalize="off" autocorrect="off" spellcheck="false" data-autofocus></textarea>
    <span class="field-help">${esc(what)}</span></label>`;

Object.assign(actions, {
  // Workplace App Management / School Focus
  async 'fx-new'() { await tryAct(null, () => openFocusForm(null)); },
  async 'fx-edit'(btn) { const s = findSchedule(btn.dataset.schedule); if (s) await tryAct(null, () => openFocusForm(s)); },
  'fx-remove'(btn) {
    const s = findSchedule(btn.dataset.schedule);
    if (!s) return;
    openModal({
      title: `Remove ${esc(s.name)}?`,
      body: `<p>It stops applying to the enrolled phones it reaches${s.kind === 'focus_hours' ? '' : ', so focus hours run through it'}. People don't get a separate notice.</p>
        <p class="muted">Its history goes with it. To pause it instead, change its days.</p>`,
      submit: 'Remove schedule',
      danger: true,
      onSubmit: async () => {
        await rpc.focusRemove(S.orgId, s.id);
        toast(`Removed ${s.name}.`);
        await refresh(['focus'], ['summary']);
      },
    });
  },
  async 'fx-approve'(btn) { await answerRequest(btn, true); },
  async 'fx-deny'(btn) { await answerRequest(btn, false); },
  async 'fx-device-add'(btn) {
    await tryAct(btn, async () => {
      await ensure(['all']);
      const people = sortPeople(S.data.all.filter((m) => m.status === 'active'));
      openModal({
        title: 'Add a company phone',
        body: `<p>For a phone your ${esc(words().org)} owns and gives to someone. It counts as enrolled, so the schedules that reach that person apply to it.</p>
          <label class="field"><span class="field-label">Who uses it</span><select class="input" name="who" data-autofocus><option value="">Pick someone</option>
            ${people.map((m) => `<option value="${esc(m.user_id)}">${esc(personName(m))}${(m.units || []).length ? ` · ${esc(m.units.map((u) => u.name).join(', '))}` : ''}</option>`).join('')}</select>
            <span class="field-help">Company phones are for people 18 or older.</span></label>
          <label class="field"><span class="field-label">Phone ID</span><input class="input" name="ref" maxlength="100" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="NH-RC-0233">
            <span class="field-help">The ID your device-management system uses for it, so you can find it there.</span></label>`,
        submit: 'Add phone',
        onSubmit: async (form) => {
          const who = form.elements.who.value;
          const ref = form.elements.ref.value.trim();
          if (!who) throw new Error('Pick who uses the phone.');
          if (!ref) throw new Error("Enter the phone's ID from your device-management system (1 to 100 characters).");
          await rpc.focusDevice(S.orgId, who, ref, true);
          toast(`Added ${ref} for ${personName(people.find((m) => m.user_id === who) || {})}.`);
          await refresh(['focusPeople'], ['summary']);
        },
      });
    });
  },
  'fx-device-remove'(btn) {
    const p = ((S.data.focusPeople || {}).list || []).find((x) => x.id === btn.dataset.enrolled);
    if (!p) return;
    openModal({
      title: `Remove ${esc(p.device_ref)}?`,
      body: `<p>The company phone ${esc(p.device_ref)} stops counting as enrolled for ${esc(p.first_name || 'this person')}. Their own phone, if they enrolled it, stays as it is.</p>`,
      submit: 'Remove phone',
      danger: true,
      onSubmit: async () => {
        await rpc.focusDevice(S.orgId, p.user_id, p.device_ref, false);
        toast(`Removed ${p.device_ref}.`);
        await refresh(['focusPeople'], ['summary']);
      },
    });
  },
  'fx-rules'() {
    const r = S.data.focusRules;
    if (!r) return;
    openModal({
      title: 'Temporary access',
      body: rulesForm(r),
      submit: 'Save rules',
      onSubmit: async (form) => {
        const d = readAccessRules(form);
        await rpc.focusRules(S.orgId, d);
        toast('Saved the rules for temporary access.');
        await refresh(['focusRules']);
      },
    });
  },
  async 'fx-more'(btn) {
    await tryAct(btn, async () => {
      const cur = S.data.focusPeople;
      S.data.focusPeople = await loadFocusPeople(cur.list.length, cur.list);
      render();
    });
  },
});

Object.assign(actions, {
  // Challenges & Competitions
  async 'ch-new'() {
    await tryAct(null, async () => {
      await ensure(canView() ? ['challenges', 'view'] : ['challenges']);
      openNewChallenge(); // a phone-or-watch challenge (072's form) or a habit challenge (075)
    });
  },
  async 'ch-edit'(el) {
    closeMenu();
    const c = findChallenge(el.dataset.ch);
    if (!c) return;
    await tryAct(null, async () => {
      if (canView()) await ensure(['view']);
      if (c.habit) openHabitEdit(c); // 075's org_habit_edit (072's edit refuses a habit challenge)
      else openChallengeForm(c);
    });
  },
  'ch-open'(el) {
    S.chOpen = el.dataset.ch;
    S.chNamed = null;
    delete S.data.chReport;
    render();
    window.scrollTo(0, 0);
  },
  'ch-back'() {
    S.chOpen = null;
    S.chNamed = null;
    delete S.data.chReport;
    render();
  },
  async 'ch-more'(btn) {
    await tryAct(btn, async () => {
      const have = S.chNamed || S.data.chReport.named;
      const next = await rpc.challengeReport(S.chOpen, have.length, 100);
      S.chNamed = [...have, ...(next.named || [])];
      render();
    });
  },
  'ch-menu'(btn) {
    if (openMenuState && openMenuState.anchor === btn) return closeMenu();
    const c = findChallenge(btn.dataset.ch);
    if (!c) return;
    openMenu(btn, `<div class="menu-title">${esc(c.title)}</div>
      <button class="menu-item" role="menuitem" data-act="ch-edit" data-ch="${esc(c.id)}">Edit</button>
      ${libraryOn() && templateSaver() ? `<button class="menu-item" role="menuitem" data-act="lib-from" data-ch="${esc(c.id)}">Save as a template</button>` : ''}
      <div class="menu-sep"></div>
      <button class="menu-item danger" role="menuitem" data-act="ch-cancel" data-ch="${esc(c.id)}">Cancel challenge</button>`);
  },
  'ch-cancel'(el) {
    closeMenu();
    const c = findChallenge(el.dataset.ch);
    if (!c) return;
    const started = c.starts_on <= dayIn(orgTz());
    openModal({
      title: `Cancel ${esc(c.title)}?`,
      body: started
        ? "<p>It stops today. What people did so far stays in their own history, and its rewards won't be earned.</p>"
        : "<p>It won't start, and its rewards won't be earned.</p>",
      submit: 'Cancel challenge',
      cancel: 'Keep it',
      danger: true,
      onSubmit: async () => {
        await rpc.challengeCancel(c.id);
        toast(`Cancelled ${c.title}.`);
        await refresh(['challenges'], ['rewards', 'summary', 'chReport']);
      },
    });
  },

  // Rewards
  async 'rw-new'(el) {
    await tryAct(null, async () => {
      await ensure(['rewards']);
      const pool = S.data.rewards.list.filter((c) => c.can_reward && c.status !== 'cancelled');
      if (!pool.length) {
        openModal({ title: 'Create a challenge first', body: '<p>A reward belongs to a challenge. Create the challenge, then add its rewards.</p>', cancel: 'OK' });
        return;
      }
      const c = pool.find((x) => x.id === el.dataset.ch) || pool[0];
      openRewardForm(c, null, el.dataset.ch ? null : pool);
    });
  },
  'rw-edit'(el) {
    closeMenu();
    const [c, x] = findReward(el.dataset.reward);
    if (x) openRewardForm(c, x);
  },
  async 'rw-approve'(btn) {
    const [c, x] = findReward(btn.dataset.reward);
    if (!x) return;
    await tryAct(btn, async () => {
      await rpc.rewardApprove(x.id, true);
      toast(c.status === 'finished' ? `Approved ${x.title}. It's earned from the final results now.` : `Approved ${x.title}. It counts now.`);
      await refresh(['rewards'], ['challenges', 'summary']);
    });
  },
  'rw-menu'(btn) {
    if (openMenuState && openMenuState.anchor === btn) return closeMenu();
    const [c, x] = findReward(btn.dataset.reward);
    if (!x) return;
    const item = (act, text, cls = '') => `<button class="menu-item ${cls}" role="menuitem" data-act="${act}" data-reward="${esc(x.id)}">${esc(text)}</button>`;
    openMenu(btn, `<div class="menu-title">${esc(x.title)}</div>
      ${c.can_reward && !x.awarded_at ? item('rw-edit', 'Edit') : ''}
      ${amAdmin() && x.approved && !x.awarded_at ? item('rw-unapprove', 'Take back approval') : ''}
      ${c.can_reward && !x.awarded_at ? `<div class="menu-sep"></div>${item('rw-remove', 'Remove reward', 'danger')}` : ''}`);
  },
  async 'rw-unapprove'(el) {
    closeMenu();
    const [, x] = findReward(el.dataset.reward);
    if (!x) return;
    await tryAct(null, async () => {
      await rpc.rewardApprove(x.id, false);
      toast(`${x.title} is waiting for approval again.`);
      await refresh(['rewards'], ['challenges', 'summary']);
    });
  },
  'rw-remove'(el) {
    closeMenu();
    const [, x] = findReward(el.dataset.reward);
    if (!x) return;
    openModal({
      title: `Remove ${esc(x.title)}?`,
      body: `<p>It comes off the challenge${x.codes ? `, with its ${plural(x.codes, 'code', 'codes')}` : ''}.</p>`,
      submit: 'Remove reward',
      cancel: 'Keep it',
      danger: true,
      onSubmit: async () => {
        await rpc.rewardRemove(x.id);
        toast(`Removed ${x.title}.`);
        await refresh(['rewards'], ['challenges', 'summary']);
      },
    });
  },
  'rw-codes'(el) {
    const [, x] = findReward(el.dataset.reward);
    if (!x) return;
    openModal({
      title: `Add codes for ${esc(x.title)}`,
      body: sponsorTermsCard('modal') + codesBody('Each code goes privately to one person who earns this, in the order they earn it. You won\'t see the codes here again.'),
      submit: 'Add codes',
      onSubmit: async (form) => {
        const codes = splitCodes(form.elements.codes.value);
        if (!codes.length) throw new Error('Paste at least one code.');
        const res = await rpc.rewardCodesAdd(x.id, codes);
        toast(`Added ${plural(res.added, 'code', 'codes')}${res.added < codes.length ? `. ${codes.length - res.added === 1 ? '1 was' : `${num(codes.length - res.added)} were`} already there or repeated` : ''}.`);
        await refresh(['rewards']);
      },
    });
  },
  // The Sponsor Reward Terms: an administrator accepts the version the state call gave (on a page or in a form).
  async 'sponsor-accept'(btn) {
    const st = S.data.sponsorTerms;
    if (!st || st.none || !amAdmin()) return;
    const org = S.orgId;
    await tryAct(btn, async () => {
      let res;
      try {
        res = await rpc.sponsorTermsAccept(org, st.version);
      } catch (e) {
        // A new version came out while the page was open: show the current one, to read and accept again.
        if (e.code === 'version') await refresh(['sponsorTerms']);
        throw e;
      }
      if (org !== S.orgId) return;
      S.data.sponsorTerms = res;
      for (const el of document.querySelectorAll('.modal [data-sponsor-terms]')) el.remove();
      toast(`Accepted the Sponsor Reward Terms for ${currentOrg().name}.`);
      render();
    });
  },
  async 'rw-given'(btn) {
    const name = btn.dataset.name;
    await tryAct(btn, async () => {
      await rpc.rewardGiven(Number(btn.dataset.earned));
      toast(name ? `Marked as given to ${name}.` : 'Marked as given.');
      await refresh(['rewards']);
    });
  },

  // Sponsored Challenges, Rewards & offers
  async 'sp-new'() { await tryAct(null, async () => { await ensure(['campaigns']); openCampaignForm('sponsored_challenge', null, null); }); },
  async 'of-new'() { await tryAct(null, async () => { await ensure(['campaigns']); openCampaignForm('reward_offer', 'offer', null); }); },
  async 'ar-new'() { await tryAct(null, async () => { await ensure(['campaigns']); openCampaignForm('reward_offer', 'achievement', null); }); },
  'cp-edit'(el) {
    const c = findCampaign(el.dataset.campaign);
    if (c) openCampaignForm(c.kind, c.reward_type, c);
  },
  async 'cp-submit'(btn) {
    const c = findCampaign(btn.dataset.campaign);
    if (!c) return;
    await tryAct(btn, async () => {
      await rpc.campaignSubmit(c.id);
      toast(`Sent ${c.title} to InneRISE for review.`);
      await refresh(['campaigns'], ['summary', 'partner']);
    });
  },
  async 'cp-pause'(btn) {
    const c = findCampaign(btn.dataset.campaign);
    if (!c) return;
    await tryAct(btn, async () => {
      await rpc.campaignPause(c.id, true);
      toast(`Paused ${c.title}. It's hidden in the app until you resume it.`);
      await refresh(['campaigns'], ['summary', 'partner']);
    });
  },
  async 'cp-resume'(btn) {
    const c = findCampaign(btn.dataset.campaign);
    if (!c) return;
    await tryAct(btn, async () => {
      await rpc.campaignPause(c.id, false);
      toast(`${c.title} is on again.`);
      await refresh(['campaigns'], ['summary', 'partner']);
    });
  },
  'cp-withdraw'(el) {
    const c = findCampaign(el.dataset.campaign);
    if (!c) return;
    const sponsored = c.kind === 'sponsored_challenge';
    openModal({
      title: `Withdraw ${esc(c.title)}?`,
      body: c.approved_at ? `<p>It comes out of the app for good${sponsored ? ', with its rewards. If the challenge is running, it stops today' : ''}.</p>
        <p class="muted">${sponsored ? 'People keep what they did in their own history.' : 'Codes already given out still work.'} To run it again, make a new one.</p>`
        : `<p>It's set aside for good${sponsored ? ', with its rewards' : ''}${c.status === 'submitted' ? ', and InneRISE stops reviewing it' : ''}.</p>
        <p class="muted">To run it later, make a new one.</p>`,
      submit: 'Withdraw',
      cancel: 'Keep it',
      danger: true,
      onSubmit: async () => {
        await rpc.campaignWithdraw(c.id);
        toast(`Withdrew ${c.title}.`);
        await refresh(['campaigns'], ['summary', 'partner', 'perf']);
      },
    });
  },
  'cp-codes'(el) {
    const c = findCampaign(el.dataset.campaign);
    if (!c) return;
    openModal({
      title: `Add codes for ${esc(c.title)}`,
      body: codesBody('4 to 64 characters each, no spaces. Each one goes privately to one person, and works once.'),
      submit: 'Add codes',
      onSubmit: async (form) => {
        const codes = splitCodes(form.elements.codes.value);
        if (!codes.length) throw new Error('Paste at least one code.');
        const res = await rpc.partnerCodesAdd(c.id, codes);
        toast(`Added ${plural(res.added, 'code', 'codes')}${res.skipped ? `. Skipped ${num(res.skipped)}: repeats, codes already used here, or not 4 to 64 characters` : ''}.`);
        await refresh(['campaigns'], ['perf']);
      },
    });
  },
  'perf-all'() { S.perfAll = true; render(); },
});

Object.assign(forms, {
  async 'partner-about'(form) {
    const about = form.elements.about.value.trim();
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await rpc.partnerProfileSet(org(), { about: about || null });
      clean(form);
      toast('Saved your profile.');
      await refresh(['partner']);
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
  async 'partner-plan'(form) {
    const pick = form.querySelector('input[name="plan"]:checked');
    if (!pick) return setError(form, 'Pick a plan.');
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await rpc.partnerPlanSet(org(), PLAN_KEY[pick.value]);
      toast(`Saved. You asked for the ${planName(PLAN_KEY[pick.value])} plan.`);
      await refresh(['partner']);
    } catch (e) {
      if (!(await signedOut(e))) { busy(btn, false); setError(form, e.message); }
    }
  },
});


function cleanDomain(v) {
  return String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^.*@/, '').replace(/^www\./, '');
}
function domainError(e) {
  if (e.code === 'email_not_at_domain') {
    return `Your sign-in email (${S.user.email}) isn't at that domain, so we can't confirm it. Sign in with your work email at that domain, then add it.`;
  }
  return e.message;
}

const changes = {
  'switch-org'(el) {
    if (el.value === STAFF_PICK && S.staff) {
      S.navOpen = false;
      S.notice = null;
      go({ section: 'staff' }, true);
      render();
      return;
    }
    const o = dashOrgs().find((x) => x.org_id === el.value);
    if (!o) return;
    setOrg(o.org_id);
    S.navOpen = false;
    S.notice = null;
    go({ org: o.org_id, section: sectionsFor(o).includes(S.section) ? S.section : homeOf(o) }, true);
    render();
  },
  'enroll-pick'(el) {
    if (el.checked) S.enrollPick.add(el.value); else S.enrollPick.delete(el.value);
    render();
  },
  'people-filter'(el) { S.peopleUnit = el.value || null; delete S.data.people; render(); },
  'reg-kind'(el) { S.regKind = el.value; render(); },
};

Object.assign(changes, {
  'perf-pick'(el) {
    S.perfCampaign = el.value;
    S.perfAll = false;
    delete S.data.perf;
    render();
  },
});

Object.assign(actions, {
  // Challenge & Rewards Library (075)
  async 'lib-use'(btn) {
    const t = findTemplate(btn.dataset.template);
    if (!t) return;
    await tryAct(btn, async () => {
      if (t.kind === 'reward') return openUseReward(t);
      if (currentOrg().kind === 'partner') { await ensure(['campaigns']); return openUseSponsored(t); }
      if (canView()) await ensure(['view']);
      // The finished challenges a final round can follow; the template works without them.
      try { await ensure(['challenges']); } catch (e) { if (e.code === 'signed_out') throw e; }
      return openUseChallenge(t);
    });
  },
  async 'lib-save'(btn) {
    await tryAct(btn, async () => {
      await ensure(canView() ? ['challenges', 'view'] : ['challenges']);
      openSaveOwn();
    });
  },
  async 'lib-edit'(btn) {
    const t = findTemplate(btn.dataset.template);
    if (!t) return;
    await tryAct(btn, async () => {
      if (canView()) await ensure(['view']);
      openTemplateForm(t.kind, t);
    });
  },
  'lib-remove'(btn) {
    const t = findTemplate(btn.dataset.template);
    if (!t) return;
    openModal({
      title: `Remove ${esc(t.title)}?`,
      body: `<p>It leaves ${esc(currentOrg().name)}'s library. Challenges and rewards already made from it stay as they are.</p>`,
      submit: 'Remove template',
      cancel: 'Keep it',
      danger: true,
      onSubmit: async () => {
        await rpc.libraryRemove(org(), t.id);
        toast(`Removed ${t.title}.`);
        await refresh(['library']);
      },
    });
  },
  'lib-clear'() {
    S.libFilter = {};
    delete S.data.library;
    render();
  },
  async 'lib-from'(el) {
    closeMenu();
    const c = findChallenge(el.dataset.ch);
    if (c) openFromChallenge(c);
  },

  // Habit challenges: confirming days (075)
  'hb-open'(el) {
    S.hbOpen = el.dataset.ch;
    const t = (S.data.toConfirm || []).find((x) => x.id === S.hbOpen);
    S.hbDay = t && t.window ? t.window.to : null;
    delete S.data.hbSheet;
    render();
    window.scrollTo(0, 0);
  },
  'hb-back'() {
    S.hbOpen = null;
    S.hbDay = null;
    delete S.data.hbSheet;
    render();
  },
  'hb-all'(btn) {
    btn.closest('form').querySelectorAll('input[name=members]:not(:disabled)').forEach((x) => { x.checked = true; });
  },

  // Billing (076)
  async 'bill-choose'(btn) {
    await tryAct(btn, async () => {
      await ensure(amAdmin() ? ['billing', 'all'] : ['billing']);
      openChoosePlan(btn.dataset.plan || null);
    });
  },
  async 'bill-manage'(btn) {
    busy(btn, true);
    try {
      const url = await billing.portal(org());
      location.assign(url);
    } catch (e) {
      if (!(await signedOut(e))) {
        openModal({ title: e.code === 'demo_payments_off' ? 'Payments are off in this demo' : "Manage billing didn't open",
          body: `<p>${esc(e.message)}</p>`, cancel: 'OK' });
      }
    } finally {
      if (btn.isConnected) busy(btn, false);
    }
  },
  async 'bill-check'(btn) {
    await tryAct(btn, async () => {
      await refresh(['billing']);
      const b = S.data.billing && S.data.billing.billing;
      toast(b ? `Up to date: ${(BILL_STATUS[b.status] || BILL_STATUS.none)[0].toLowerCase()}.` : 'Up to date.');
    });
  },
});

Object.assign(forms, {
  // Save one day's confirmations: who's newly done, and who's taken back (075's org_habit_confirm, up to 500 at a time).
  async 'hb-save'(form) {
    const btn = form.querySelector('[type=submit]');
    const sh = S.data.hbSheet;
    if (!sh) return;
    const boxes = [...form.querySelectorAll('input[name=members]:not(:disabled)')];
    const add = boxes.filter((x) => x.checked && x.dataset.was !== '1').map((x) => x.value);
    const back = boxes.filter((x) => !x.checked && x.dataset.was === '1').map((x) => x.value);
    if (!add.length && !back.length) { toast('Nothing changed.'); return; }
    busy(btn, true);
    try {
      let done = 0;
      let undone = 0;
      let skipped = 0;
      let left = null;
      for (let i = 0; i < add.length; i += 500) {
        const r = await rpc.habitConfirm(sh.challenge.id, sh.day, add.slice(i, i + 500), true, localToday());
        done += r.people || 0; skipped += r.skipped || 0; left = r.left_today ?? left;
      }
      for (let i = 0; i < back.length; i += 500) {
        const r = await rpc.habitConfirm(sh.challenge.id, sh.day, back.slice(i, i + 500), false, localToday());
        undone += r.people || 0; skipped += r.skipped || 0; left = r.left_today ?? left;
      }
      const parts = [done && `${num(done)} confirmed`, undone && `${num(undone)} taken back`].filter(Boolean);
      toast(`${fmtDay(sh.day)}: ${parts.join(', ') || 'nothing changed'}.${skipped ? ` ${plural(skipped, 'person', 'people')} couldn't be changed.` : ''}${
        left != null && left < 500 ? ` You can confirm ${plural(Math.max(left, 0), 'more person', 'more people')} today.` : ''}`);
      await refresh(['hbSheet'], ['toConfirm', 'chReport', 'summary']);
    } catch (e) {
      // The daily count starts again at midnight UTC (075), whatever the local time.
      const again = new Date((Math.floor(Date.now() / DAY) + 1) * DAY).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (!(await signedOut(e))) setError(form, e.code === 'rate_limited' ? `${e.message} It starts again at ${again}.` : e.message);
    } finally {
      if (btn.isConnected) busy(btn, false);
    }
  },
});

Object.assign(changes, {
  'lib-filter'(el) {
    S.libFilter = { ...(S.libFilter || {}), [el.name]: el.value };
    delete S.data.library;
    render();
  },
  'hb-day'(el) {
    S.hbDay = el.value;
    delete S.data.hbSheet;
    render();
  },
});

// The Prize Wallet (078): actions, forms and changes ---------------------------------------------------------------------
// A confirm with no answer yet, or one whose fate is still unknown: the counter finishes it before it takes another code.
const counterBusy = () => !!(S.counter && S.counter.org === S.orgId && ['checking', 'confirming', 'unknown', 'offline'].includes(S.counter.step));
const termsFor = (k) => (k === 'reward' ? 'rewards' : 'campaigns');
// Every row of the report for its days and place, page after page (for the CSV).
async function allReportRows(r) {
  const rows = [];
  let after = null;
  for (let page = 0; page < 40; page++) {
    const res = await rpc.prizeReport(S.orgId, r.from || null, r.to || null, r.unit || null, after, 5000);
    rows.push(...(res.rows || []));
    if (!res.next_after) break;
    after = res.next_after;
  }
  return rows;
}

Object.assign(actions, {
  // The counter
  'counter-camera'() { if (!counterBusy()) openCamera(); },
  'counter-confirm'() { counterConfirm(); },
  'counter-status'() { counterStatus(); },
  'counter-clear'() { if (!counterBusy()) { S.counter = null; render(); } },
  'counter-next'() { S.counter = null; render(); },

  // How the prizes look: the logo
  'logo-pick'() { const input = document.getElementById('logo-file'); if (input) input.click(); },
  'logo-remove'() {
    const g = S.data.giver;
    if (!g || !g.path) return;
    const orgId = S.orgId;
    openModal({
      title: 'Remove the logo?',
      body: '<p>Winners see your name on your prizes instead, until you upload a logo again.</p>',
      submit: 'Remove logo',
      danger: true,
      onSubmit: async () => {
        await rpc.prizeGiverSet(orgId, { logo_path: null });
        const files = ((await logos.list(orgId)) || []).filter((f) => /^logo\./i.test(f.name)).map((f) => `${orgId}/${f.name}`);
        if (files.length) await logos.remove(files);
        toast('Removed the logo.');
        await refresh(['giver']);
      },
    });
  },

  // Disputes
  'disputes-all'() { S.disputesAll = !S.disputesAll; delete S.data.disputes; render(); },
  async 'disputes-more'(btn) {
    await tryAct(btn, async () => {
      const d = S.data.disputes;
      const next = await rpc.prizeDisputes(org(), !S.disputesAll, d.next_before, 50);
      S.data.disputes = { disputes: [...d.disputes, ...(next.disputes || [])], next_before: next.next_before };
      render();
    });
  },
  'dispute-answer'(btn) {
    const x = ((S.data.disputes && S.data.disputes.disputes) || []).find((y) => String(y.id) === btn.dataset.dispute);
    if (!x) return;
    openModal({
      title: `Answer about ${esc(x.title)}`,
      body: `${facts([['Prize', `${esc(x.title)} <span class="ref-mono">${esc(x.prize_ref)}</span>`], ['About', esc(TOPIC[x.topic] || TOPIC.other)],
        ['From', x.first_name ? esc(x.first_name) : 'Name not shared']])}
        ${x.note ? `<p class="reward-desc">“${esc(x.note)}”</p>` : ''}
        <fieldset class="plain"><legend class="field-label">Outcome</legend><div class="pill-options">
          <label class="pill-opt"><input type="radio" name="outcome" value="resolved" checked><span class="pill">Resolved</span></label>
          <label class="pill-opt"><input type="radio" name="outcome" value="declined"><span class="pill">Declined</span></label></div></fieldset>
        <label class="field"><span class="field-label">Your answer</span>
          <textarea class="input" name="answer" rows="4" maxlength="500" data-autofocus placeholder="What you did, or why not."></textarea>
          <span class="field-help">The winner sees it in their InneRISE app. To give a use back, undo it in the report below first.</span></label>`,
      submit: 'Send answer',
      onSubmit: async (form) => {
        const answer = form.elements.answer.value.trim();
        if (!answer) throw new Error('Write an answer of 1 to 500 characters.');
        await rpc.prizeDisputeAnswer(org(), x.id, form.elements.outcome.value, answer);
        toast(`Answered the dispute about ${x.title}.`);
        await refresh(['disputes']);
      },
    });
  },

  // Pickups and deliveries
  async 'pick-step'(btn) {
    const p = ((S.data.pickups && S.data.pickups.prizes) || []).find((y) => y.id === btn.dataset.prize);
    if (!p) return;
    const step = btn.dataset.step;
    const run = async () => {
      await rpc.prizeFulfill(org(), p.id, step);
      toast(step === 'ready' ? `${p.title} is ready for pickup. The winner sees it in their app.`
        : step === 'shipped' ? `Marked ${p.title} shipped.` : `Marked ${p.title} delivered. It counts as used now.`);
      await refresh(['pickups'], ['prizeReport']);
    };
    if (step !== 'delivered') { await tryAct(btn, run); return; }
    openModal({
      title: `Mark ${esc(p.title)} delivered?`,
      body: `<p>The prize counts as used once it's delivered${p.first_name ? ` to ${esc(p.first_name)}` : ''}, and the winner sees that in their app.</p>`,
      submit: 'Mark delivered',
      onSubmit: run,
    });
  },
  async 'pick-address'(btn) {
    const p = ((S.data.pickups && S.data.pickups.prizes) || []).find((y) => y.id === btn.dataset.prize);
    if (!p) return;
    await tryAct(btn, async () => {
      const a = await rpc.prizeAddress(org(), p.id);
      openModal({
        title: `Where to send ${esc(p.title)}`,
        body: `<address class="address-card">${[a.name, a.line1, a.line2, [a.city, a.region, a.postal_code].filter(Boolean).join(', '), countryName(a.country)]
          .filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join('')}</address>
          ${a.phone ? facts([['Phone', esc(a.phone)]]) : ''}
          <p class="field-help">The winner gave this address for this prize only. Each time someone opens it is noted, and it's removed 30 days after delivery.</p>`,
        cancel: 'Close',
      });
    });
  },
  async 'pickups-more'(btn) {
    await tryAct(btn, async () => {
      const f = S.data.pickups;
      const next = await rpc.prizeFulfillmentList(org(), S.pickState || null, f.next, 100);
      S.data.pickups = { prizes: [...f.prizes, ...(next.prizes || [])], next: next.next };
      render();
    });
  },

  // The report
  async 'prize-csv'(btn) {
    const o = currentOrg();
    const r = reportRange();
    await tryAct(btn, async () => {
      const rows = await allReportRows(r);
      const tz = orgTz();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([prizeCsv(rows, tz)], { type: 'text/csv;charset=utf-8' }));
      a.download = `${slug(o.name)}-prizes-${r.from || 'start'}-to-${r.to || dayIn(tz)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast(`Downloaded ${plural(rows.length, 'row', 'rows')} as a CSV file.`);
    });
  },
  'prize-undo'(btn) {
    const x = findReportRow(btn.dataset.event);
    if (!x) return;
    openModal({
      title: `Undo ${esc(x.confirmation)}?`,
      body: `${facts([['Prize', `${esc(x.title)} <span class="ref-mono">${esc(x.prize_ref)}</span>`], ['Used', esc(`${dayAt(x.at)} ${clockAt(x.at)}`)], ['Place', esc(x.place || 'Any place')]])}
        <p>The prize can be used again, and the winner sees that in their app. The use stays in the report with its undo.</p>
        <label class="field"><span class="field-label">Why</span>
          <textarea class="input" name="reason" rows="3" maxlength="500" data-autofocus placeholder="The class was cancelled, so the prize goes back."></textarea>
          <span class="field-help">Required. The winner sees it, and so does anyone who reads the report.</span></label>`,
      submit: 'Undo this use',
      danger: true,
      onSubmit: async (form) => {
        const reason = form.elements.reason.value.trim();
        if (!reason) throw new Error('Say why, in 1 to 500 characters.');
        const res = await rpc.prizeReverse(org(), x.event_id, reason);
        toast(`Undid ${res.reversed}. Its undo has the number ${res.confirmation}.`);
        await refresh(['prizeReport', 'pickups', 'disputes']);
      },
    });
  },
  async 'report-more'(btn) {
    await tryAct(btn, async () => {
      const r = S.data.prizeReport;
      const range = r.range || reportRange();
      const next = await rpc.prizeReport(org(), range.from || null, range.to || null, range.unit || null, r.next_after, 500);
      S.data.prizeReport = { ...r, rows: [...r.rows, ...(next.rows || [])], next_after: next.next_after };
      render();
    });
  },

  // Prize terms on a reward or an offer
  async 'pt-edit'(btn) { await tryAct(btn, () => openTermsForm(btn.dataset.k, btn.dataset.target)); },
  async 'pt-codes'(btn) { await tryAct(btn, () => openBizCodes(btn.dataset.k, btn.dataset.target)); },
  'pt-remove'(btn) {
    const k = btn.dataset.k;
    const id = btn.dataset.target;
    const tg = termsTarget(k, id);
    if (!tg) return;
    openModal({
      title: `Remove the prize terms for ${esc(tg.title)}?`,
      body: `<p>People who earn it from now on get no prize in their My rewards. Prizes already won keep their terms.</p>
        ${k === 'reward' && tg.approved ? '<p class="muted">An administrator approves the reward again before it counts.</p>' : ''}`,
      submit: 'Remove the terms',
      danger: true,
      onSubmit: async () => {
        await rpc.prizeTermsSet(k, id, null);
        toast(`Removed the prize terms for ${tg.title}.`);
        await refresh([termsFor(k)], ['summary']);
      },
    });
  },

  // Can Redeem Prizes (068's role prize_redeemer): for the whole organization, or one place and everything under it.
  'role-redeem'(el) {
    const m = findPerson(el.dataset.user);
    const w = words();
    const units = S.data.view.units || [];
    closeMenu();
    openModal({
      title: `Give ${esc(personName(m))} Can Redeem Prizes`,
      body: `<p class="muted">They can check prize codes and confirm prizes at the counter, and nothing else. Administrators and rewards managers can already.</p>
        <label class="field"><span class="field-label">Where</span>
        <select class="input" name="unit" data-autofocus>${unitOptions(units, '', `The whole ${w.org}`)}</select>
        <span class="field-help">A place covers everything under it.</span></label>`,
      submit: 'Give Can Redeem Prizes',
      onSubmit: async (form) => {
        const unit = form.elements.unit.value || null;
        await rpc.roleSet(org(), m.user_id, 'prize_redeemer', unit, true);
        await afterPeopleChange(`${personName(m)} can redeem prizes ${unit ? `at ${unitPath(unit, units)}` : `anywhere in the ${w.org}`} now.`);
      },
    });
  },
});

Object.assign(forms, {
  'counter-check'(form) {
    const code = form.elements.code.value.trim();
    if (!code) return setError(form, 'Scan or type a code first.');
    if (counterBusy()) {
      return setError(form, S.counter.step === 'offline' ? "We can't tell yet whether the last prize was used. Press Check again first." : 'One moment: the last code is still being checked.');
    }
    form.elements.code.value = '';
    clean(form);
    counterCheck(code);
  },
  'prize-report'(form) {
    const f = form.elements;
    const from = f.from.value || null;
    const to = f.to.value || null;
    if (from && to && from > to) return setError(form, 'Pick a first day before the last day.');
    S.prizeRange = { org: S.orgId, from, to, unit: f.unit ? f.unit.value : '' };
    delete S.data.prizeReport;
    render();
  },
});

Object.assign(changes, {
  'counter-place'(el) {
    S.counterPlace[S.orgId] = el.value;
    store.set(PLACE_KEY + S.orgId, el.value);
    // A code checked for another place is checked again here before it can be confirmed.
    if (S.counter && S.counter.org === S.orgId && !counterBusy()) S.counter = null;
    render();
  },
  async 'logo-file'(el) {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast('Use a PNG, JPEG or WebP picture.'); return; }
    if (file.size > 1024 * 1024) { toast('That picture is too large. Use one under 1 MB.'); return; }
    const orgId = S.orgId;
    const path = `${orgId}/logo.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
    await tryAct(document.querySelector('[data-act=logo-pick]'), async () => {
      await logos.upload(path, file);
      const res = await rpc.prizeGiverSet(orgId, { logo_path: path });
      // The last picture under another name goes once the new one is set.
      const old = ((await logos.list(orgId)) || []).filter((f) => /^logo\./i.test(f.name) && `${orgId}/${f.name}` !== path).map((f) => `${orgId}/${f.name}`);
      if (old.length) await logos.remove(old);
      toast(res.logo_state === 'waiting' ? 'Sent your new logo to InneRISE for review. Winners see it once InneRISE approves it.' : 'Saved. Your logo shows on your prizes now.');
      if (S.orgId === orgId) await refresh(['giver']);
    });
  },
  'pick-filter'(el) { S.pickState = el.value; delete S.data.pickups; render(); },
  async 'codes-file'(el) {
    const file = el.files && el.files[0];
    const form = el.form;
    if (!file || !form) return;
    try {
      const codes = codesFromFile(await file.text());
      form.elements.codes.value = codes.join('\n');
      setError(form, codes.length ? null : 'That file has no codes in its first column.');
    } catch {
      setError(form, "That file couldn't be read. Save it as a CSV or plain text file and try again.");
    }
  },
});

// InneRISE administration (082): its buttons, filters and search. Every change is confirmed in a dialog on the page first.
Object.assign(actions, {
  'staff-clear'() { go({ section: 'staff-orgs', st: staffSt(ORG_STATUS, 'pending') }, true); render(); },
  async 'staff-orgs-more'(btn) {
    const have = S.data.staffOrgs;
    if (!have) return;
    await tryAct(btn, async () => {
      const next = await loadStaffOrgs(have);
      if (S.data.staffOrgs === have) S.data.staffOrgs = next;
      render();
    });
  },
  'staff-org-set'(el) { staffOrgModal(el.dataset.to); },
  'staff-cp'(el) { staffCampaignModal(el.dataset.campaign, el.dataset.approve === '1'); },
  'staff-lib-set'(el) { staffLibraryModal(el.dataset.template, el.dataset.to); },
  'staff-prize'(el) { staffPrizeModal(el.dataset.k, el.dataset.id, el.dataset.approve === '1'); },
});
Object.assign(forms, {
  'staff-search'(form) {
    const q = String(form.elements.q.value || '').trim().slice(0, 100);
    go({ section: 'staff-orgs', st: form.elements.st.value, q: q || null }, true);
    render();
  },
});
Object.assign(changes, {
  'staff-st'(el) { go({ section: 'staff-orgs', st: el.value, q: staffQ() || null }, true); render(); },
  'staff-lib-st'(el) { go({ section: 'staff-library', st: el.value }, true); render(); },
});

// Events -------------------------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-nav]');
  if (link && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    closeMenu();
    S.navOpen = false;
    if (link.dataset.campaign) { S.perfCampaign = link.dataset.campaign; S.perfAll = false; delete S.data.perf; }
    go(link.getAttribute('href'), true);
    render();
    // A link that also starts something there (the overview's "Create a challenge"): open it on arrival.
    if (link.dataset.then && actions[link.dataset.then]) actions[link.dataset.then](link);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (openMenuState && !openMenuState.el.contains(e.target) && el !== openMenuState.anchor) closeMenu();
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  setError(form, null);
  if (forms[form.dataset.form]) forms[form.dataset.form](form, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  if (!e.target.name) return;
  e.target.dataset.dirty = '1';
  // Once someone starts fixing what a form complained about, the old complaint goes away.
  const form = e.target.form;
  if (form && form.querySelector('.form-error:not([hidden])')) setError(form, null);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (modalOpen) modalOpen.close();
  else if (openMenuState) { const a = openMenuState.anchor; closeMenu(); a.focus(); }
  else if (S.navOpen) { S.navOpen = false; render(); }
});
window.addEventListener('popstate', () => { S.navOpen = false; closeModal(); render(); });
window.addEventListener('hashchange', () => {
  // The app handed over a sign-in to a page that was already open: start again so it is used.
  if (/^#handoff=/.test(location.hash)) { location.reload(); return; }
  if (fromOldAddress()) { S.navOpen = false; render(); }
});
window.addEventListener('resize', closeMenu);
window.addEventListener('scroll', closeMenu, { passive: true });

boot();
