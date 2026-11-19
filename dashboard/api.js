// InneRISE Dashboard: the only door to the server.
// Every call goes through the database functions (068_organizations.sql, 070_org_details.sql, Challenges and
// Rewards in 072_company_challenges.sql, InneRISE Partners in 074_partners.sql, Workplace App Management and School
// Focus in 071a/071b, the Challenge & Rewards Library and habit challenges in 075_library_habits.sql, billing in
// 076_org_billing.sql, the Prize Wallet's counter and prize management in 078_prize_wallet.sql) and comes back either as
// data or as an ApiError whose message is plain English. Billing's two Edge Functions (billing-checkout, billing-portal)
// answer only a Stripe address or an error. A giver's logo goes to Storage (the private bucket prize-logos, under the
// organization's id). Service-role functions (org_staff_*, org_last_admin_of, partner_staff_*, org_library_staff_*,
// org_billing_* other than org_billing_view, prize_staff_queue, prize_staff_logo, prize_staff_terms, prize_push_work,
// prize_daily) are never called from here. The Sponsor Reward Terms (072's terms round): org_sponsor_terms_state and _accept.
// The gaps round: prize_giver_get (the logo's review state and InneRISE's note), and every redeemer of a partner uses 074's counter.
// InneRISE administration (082): innerise_is_staff() and the staff_* functions, which wrap the service-role ones above for a
// signed-in InneRISE staff member (each raises not_staff for anyone else); and the Reports section's org_report_places, whose
// small counts arrive already hidden (null, with *_hidden 'fewer_than' and *_fewer_than, or 'protects'). See APP_CONTRACT_082.md.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// The app opens the dashboard already signed in: ...#handoff=<token_hash>. Take it out of the address at once,
// before anything else runs, so it never stays in the browser history or in a link someone copies.
export const HANDOFF = (() => {
  const m = location.hash.match(/^#handoff=([^&]+)/);
  if (!m) return null;
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch { /* it is still used only once */ }
  try { return decodeURIComponent(m[1]); } catch { return null; }
})();
const query = new URLSearchParams(location.search);
const placeholderKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'PASTE_ANON_KEY';

export const DEMO = query.has('demo') || placeholderKey;
export const DEMO_START = ['new', 'school', 'partner', 'manager', 'district', 'sponsor', 'counter', 'teacher', 'billing', 'dealers', 'redeemer', 'gymdesk', 'staff'].includes(query.get('demo')) ? query.get('demo') : 'sample';

let client = null;

export async function connect() {
  if (client) return client;
  if (DEMO) {
    const { createDemoClient } = await import('./demo.js');
    client = createDemoClient(DEMO_START);
    window.inneriseDemo = client; // lets the flow test look inside the demo
  } else {
    const { createClient } = await import(SUPABASE_JS);
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

// In demo mode, the organization to open first (?demo=school, ?demo=partner).
export const demoStartOrg = () => (DEMO && client && client.demo ? client.demo.startOrg : null);

// Nouns for the kind of organization being managed (set by app.js from its WORDS map), so error
// messages say "company" for a business and "school" for a school without hard-coding either.
let nouns = { org: 'company', addressKinds: 'locations' };
export function useWords(w) {
  if (w) nouns = w;
}

export class ApiError extends Error {
  constructor(code, message, data = null) {
    super(message);
    this.code = code;
    this.data = data; // anything else the server said (partner_redeem_check's redeemed_on, prize_confirm's prize)
  }
}

// Plain-English messages --------------------------------------------------------------------------
const GENERAL = {
  network: "We couldn't reach InneRISE. Check your connection and try again.",
  signed_out: 'You were signed out. Please sign in again.',
  no_access: "This sign-in can't reach InneRISE yet. Sign out, sign in again, and try once more.",
  parent_approval_required: 'This account needs a parent to approve this sign-in first.',
  missing_function: "This part of InneRISE isn't switched on yet. Please try again later.",
  last_admin: "You're the only administrator. Hand the role to someone else before you leave.",
  not_allowed: "You don't have permission to do that here. Ask one of the administrators.",
  not_found: "We couldn't find that {org}. It may have been closed.",
  suspended: 'This {org} is paused by InneRISE. Write to InneRISE to reopen it.',
  closed: 'This {org} is closed.',
  not_verified: "InneRISE hasn't verified this organization yet, so it can't invite people.",
  kind: "That kind isn't available here.",
  name: 'Use a name between 2 and 80 characters.',
  time_zone: 'Pick a time zone from the list.',
  rate_limited: "You've reached today's limit for this. Please try again tomorrow.",
  parent: 'That place is no longer there. Refresh the page and try again.',
  unit: 'That place is no longer there. Refresh the page and try again.',
  name_taken: 'There is already one with that name in the same place. Pick another name.',
  invalid: 'Use a name between 1 and 80 characters.',
  not_empty: 'Something is still inside it: places under it, or people in it. Move or remove those first.',
  member_type: "That kind of member isn't available.",
  use_leave: 'To stop being an administrator yourself, use Hand over and leave in Settings.',
  not_member: 'That person is no longer in the {org}.',
  role: "That role isn't available.",
  admin_whole_org: 'An administrator looks after the whole {org}, not one part of it.',
  not_eligible: "Only adults who aren't students can have a role.",
  details: 'Something in the form went wrong. Refresh the page and try again.',
  legal_name: 'Use a legal name between 2 and 120 characters.',
  website: 'Enter the website starting with https://, for example https://example.com.',
  contact_email: "That contact email doesn't look right.",
  contact_phone: 'Use 7 to 32 digits for the phone number (spaces and + ( ) . - are fine).',
  street: 'The street can be 200 characters at most.',
  city: 'The city can be 100 characters at most.',
  region: 'The state or region can be 100 characters at most.',
  postal_code: 'The postal code can be 20 characters at most.',
  country: 'Pick a country from the list.',
  ask_innerise: "InneRISE checked this name by hand, so it can't be changed here. Write to InneRISE and we'll gladly change it for you.",
  domain: "That doesn't look like a domain. Enter just the part after the @, like acme.com.",
  free_mail: "That's a free email service, not your {org}'s own domain. Enter the domain your work email uses, like acme.com.",
  too_many: 'A {org} can have up to 10 email domains.',
  email_not_at_domain: "Your sign-in email isn't at that domain, so we can't confirm it. Sign in with your work email at that domain, then add it.",
};

const BY_FUNCTION = {
  org_create: {
    not_allowed: "This account can't register a {org}. Only an adult's own InneRISE account can.",
    rate_limited: "You've registered 3 organizations today, the daily limit. Please try again tomorrow.",
    kind: "That kind of organization isn't available.",
  },
  org_invite_create: {
    rate_limited: "You've made 200 codes today, the daily limit. Please try again tomorrow.",
  },
  org_invite_close: { not_allowed: "You can't close that code. It may belong to another {org}." },
  org_member_remove: { use_leave: "You can't remove yourself. To leave the {org}, use Leave in Settings." },
  org_role_set: { use_leave: "You can't take away your own administrator role here. Use Hand over and leave in Settings." },
  org_admin_transfer: {
    not_eligible: "That person can't take over. They need to be an active adult member who isn't a student.",
  },
  org_leave: { not_member: "You're no longer in this {org}." },
  org_unit_details_set: { kind: 'Only {addressKinds} have an address and time zone.' },
  org_members_list: { unit: 'That place is no longer there. Pick another one.' },
};

// Challenges and Rewards (072) ----------------------------------------------------------------------
const CHALLENGE = {
  not_allowed: "You can't run a challenge there. Challenge coordinators can for the whole {org}; managers and teachers for their own part of it.",
  partner_campaign: 'A partner\'s challenges are Sponsored Challenges. Make one under Sponsored Challenges and InneRISE reviews it.',
  not_verified: "InneRISE hasn't verified this {org} yet, so challenges can't start. You'll be able to once it's verified.",
  not_offered: "Challenges aren't switched on for this {org}. Write to InneRISE to switch them on.",
  too_many: 'This {org} already has as many challenges running as InneRISE allows. Wait for some to finish, or cancel one you no longer need.',
  unit: 'That place is no longer there. Pick another one.',
  title: 'Give the challenge a name of 1 to 60 characters.',
  description: 'The description can be 500 characters at most.',
  metric: 'Pick what to count: steps, walking or running distance, cycling distance, or floors.',
  mode: 'Pick how the challenge is scored.',
  children_rules: "With students, a challenge counts active days or days at a daily goal, never totals, and a final round takes the top sides, never the top people.",
  invalid: "One of the numbers or dates isn't right. Check them and try again.",
  days: 'A challenge runs for 1 to 365 days.',
  daily_goal: "Set a daily goal above 0 and within a healthy day's limit: at most 100,000 steps, 120 km walking or running, 400 km cycling, or 500 floors.",
  target: "That target is out of reach: it can't be more than the number of days, or for a total, more than a healthy day's limit for every day.",
  starts_on: 'Pick a start date from today up to a year from now.',
  sides: 'Pick which kind of place people compete as, or no sides.',
  group_kind: 'Groups need sides, and a different kind of place from the sides, like regions for locations. Pick another, or no groups.',
  max_people: 'Leave it empty for no limit, or allow at least 2 people: no fewer than have joined already, and no more than InneRISE allows.',
  final_of: 'A final round follows a finished challenge of this {org} that you run. Pick one of those, or make it an ordinary challenge.',
  advance: 'Pick who goes through to the final: the top sides (the first round needs sides for that), or the top people.',
  advance_n: 'Set how many go through: a whole number, 1 or more.',
  not_qualified: 'Only the people who went through from the first round can join this final.',
  locked: 'People have joined, so the rules are set. You can still change the name, the description and how many people can join.',
  not_open: 'This challenge has ended or was cancelled, so it can no longer change.',
};
const REWARD = {
  not_allowed: "You can't change rewards for this challenge. Rewards managers can, and so can the person who set the challenge up.",
  not_open: 'This challenge was cancelled, so its rewards can no longer change.',
  not_found: "That reward isn't there any more. Refresh the page.",
  earned: 'People have already earned this reward, so it stays as it is.',
  title: 'Give the reward a name of 1 to 80 characters.',
  description: 'The description can be 500 characters at most.',
  kind: 'Pick a prize or recognition.',
  earns: 'Pick who earns it. A reward for the winning side needs a challenge with sides, and one for reaching the target needs a target.',
  children_rules: 'With students, rewards go to everyone who takes part, everyone who reaches the target, or a winning side: never to one winner or a top few.',
  top_n: 'Set how many top places earn it: at least 1, and no more than InneRISE allows.',
  quantity: 'Set how many there are: at least 1 and no more than InneRISE allows, or leave it empty for no limit.',
  each_group: "This challenge doesn't group its sides, so a reward can't be worked out in each group. Turn that off, or group the sides first.",
  codes: 'This reward has codes, so it stays a prize.',
  invalid: "One of the numbers isn't right. Check it and try again.",
};

// InneRISE Partners (074) ---------------------------------------------------------------------------
const CAMPAIGN = {
  not_allowed: "Your role doesn't cover this. Challenge coordinators run Sponsored Challenges, rewards managers run rewards and offers, and administrators run both.",
  kind: 'Pick a Sponsored Challenge, or a reward or offer.',
  reward_type: 'Pick an offer, or a reward for a Sponsored Challenge.',
  for_campaign: 'Pick one of your Sponsored Challenges for this reward.',
  title: 'Use a title of 2 to 60 characters for a challenge, or 2 to 80 for a reward or offer.',
  summary: 'Keep the summary to 280 characters.',
  link: 'The link must start with https:// and be 300 characters at most.',
  image_path: "That picture can't be used.",
  country: 'Pick a country from the list.',
  region: 'The state or region can be 100 characters at most.',
  city: 'The city can be 100 characters at most.',
  area: 'Pick a country before a state or city.',
  unit: "Sponsored Challenges are open to everyone, so they can't be limited to one place.",
  sides: "Sponsored Challenges are open to everyone, so they can't be split into sides.",
  metric: CHALLENGE.metric,
  mode: CHALLENGE.mode,
  days: CHALLENGE.days,
  daily_goal: CHALLENGE.daily_goal,
  target: CHALLENGE.target,
  max_people: 'Leave it empty for no limit, or allow at least 2 people and no more than InneRISE allows.',
  invalid: CHALLENGE.invalid,
  starts_on: 'Pick a start date from today up to a year from now.',
  ends_on: 'Pick an end date on or after the start, within a year of it, and not in the past.',
  quantity: 'Set how many there are: at least 1, and no fewer than are already given out. A challenge reward can have no more than InneRISE allows.',
  per_person: 'Set how many each person can have: 1 or more.',
  code_source: 'Pick where the codes come from: InneRISE makes them, or you upload your own.',
  earns: 'Pick who earns it: everyone who takes part, or everyone who reaches the target (the challenge needs a target for that).',
  locked: "That part is set now. Once InneRISE approves them, a challenge's rules and dates and a reward's terms stay as they are, and where codes come from never changes.",
  withdrawn: 'This was withdrawn. Make a new one instead.',
  ended: 'This has ended, so it can no longer change.',
  earned: 'People have already earned this reward, so it stays as it is.',
  needs_admin: 'Only an administrator can change a reward or offer once it has been sent to InneRISE.',
  // An uploaded pool holds fewer codes than it gives out ({short}: how many more, from the server's answer).
  codes_short: "Upload {short} first, so there's a code for each one it gives out.",
};
Object.assign(BY_FUNCTION, {
  org_challenge_create: CHALLENGE,
  org_challenge_edit: CHALLENGE,
  org_challenge_cancel: { ...CHALLENGE, not_open: 'This challenge has already ended or was cancelled.' },
  org_challenge_list: { not_allowed: CHALLENGE.not_allowed },
  org_challenge_report: { not_allowed: 'Only the people who run this challenge can see its results.' },
  org_reward_set: REWARD,
  org_reward_approve: { ...REWARD, not_allowed: 'Only an administrator can approve rewards.',
    partner_campaign: 'InneRISE reviews partner rewards.', earns: "This reward no longer fits the challenge's rules. Change who earns it first.",
    each_group: "The challenge no longer groups its sides, so this reward can't be worked out in each group. Change the reward first." },
  org_reward_remove: REWARD,
  org_reward_codes_add: { ...REWARD, kind: 'Only prizes have codes. Recognition is shown in the app instead.',
    sponsor_terms: 'An administrator needs to accept the Sponsor Reward Terms first.',
    codes: 'Paste 1 to 5,000 codes at a time, one per line.', too_many: 'This reward already holds as many codes as InneRISE allows.' },
  org_reward_status: { not_allowed: REWARD.not_allowed },
  // The Sponsor Reward Terms (terms round): an administrator accepts the current version once for the organization.
  org_sponsor_terms_state: { not_allowed: 'Only the people who run challenges or rewards here can see the Sponsor Reward Terms.' },
  org_sponsor_terms_accept: { not_allowed: 'Only an administrator can accept the Sponsor Reward Terms.',
    version: 'The Sponsor Reward Terms changed while this page was open. Read them again, then accept.' },
  org_reward_given: { ...REWARD, not_claimed: "They haven't claimed it in the app yet. You can mark it given once they do." },
  partner_profile_set: { not_allowed: 'Only an administrator can change the business profile.', about: 'Keep the description to 280 characters.',
    logo_path: "That logo can't be used." },
  partner_plan_set: { not_allowed: 'Only an administrator or the billing contact can choose the plan.', plan: 'Pick one of the plans.' },
  partner_overview: { not_allowed: "You don't have a role at this partner yet. Ask one of the administrators." },
  partner_campaign_create: CAMPAIGN,
  partner_campaign_edit: CAMPAIGN,
  partner_campaign_submit: { ...CAMPAIGN,
    needs_admin: 'Only an administrator can send a reward or offer to InneRISE for review.',
    not_verified: "InneRISE is still verifying your business. You can send things for review once it's verified.",
    not_draft: 'Only a draft, or one InneRISE sent back, can be sent for review.',
    starts_on: 'Its start date has passed or is more than a year away. Edit it to pick a start from today on, then send it.',
    for_campaign: 'The Sponsored Challenge this reward is for was withdrawn.' },
  partner_campaign_withdraw: { ...CAMPAIGN, needs_admin: 'Only an administrator can withdraw a reward or offer once it has been sent to InneRISE.' },
  partner_campaign_pause: { ...CAMPAIGN, not_live: 'Only something approved or waiting for review can be paused, and only a paused one turned back on.',
    needs_admin: 'Only an administrator can turn a reward or offer back on.' },
  partner_campaign_list: CAMPAIGN,
  partner_campaign_details: CAMPAIGN,
  partner_campaign_report: CAMPAIGN,
  partner_codes_add: { ...CAMPAIGN, code_source: 'InneRISE makes the codes for this one, so there are none to upload.',
    not_open: 'This was withdrawn or has ended, so it takes no more codes.', codes: 'Paste 1 to 5,000 codes at a time, one per line.',
    too_many: 'This already holds as many codes as InneRISE allows.' },
});

// The Prize Wallet (078) and 074's two-step counter -----------------------------------------------------------------
// Why a prize can't be used at the counter now (prize_check's reason, and prize_confirm's error with the same name).
export const PRIZE_REASON = {
  void: 'This prize was cancelled, so it can\'t be used.',
  used: 'This prize was already used.',
  expired: 'This prize has expired.',
  not_yet: "This prize can't be used yet. Its first day hasn't come.",
  delivery: "This prize is being delivered to the winner, so it isn't used at the counter.",
  no_code: "This prize is still waiting for its code from you, so it can't be used yet. Upload more business codes and it gets one.",
  location: "This prize can't be used at this place. Check the places it's good at, or pick another place.",
};
const COUNTER = {
  ...PRIZE_REASON,
  not_allowed: "You can't confirm prizes here. Ask an administrator to give you Can Redeem Prizes for this place.",
  unit: 'That place is no longer there. Refresh the page and pick a place again.',
  rate_limited: "Too many codes didn't match today, so checking is paused here until tomorrow.",
  not_valid: "That code isn't valid here. Check each character and try again.",
  code_expired: "That code has already changed on the winner's phone. Ask them to show it again, then scan or type it once more.",
  shared_code: "That code is the same for every winner, so it can't show whose prize it is. Scan or type the winner's own code from their InneRISE app.",
  request_key: 'That confirm was sent for another code. Check the code again, then confirm.',
  not_found: 'Nothing was confirmed with that attempt.',
  already_redeemed: 'That code was already used.',
};
const PARTNER_COUNTER = { ...COUNTER, not_allowed: "You can't check codes here. Ask an administrator to give you Can Redeem Prizes." };
const PRIZE_MANAGER = { not_allowed: 'Only administrators and rewards managers can do that.' };
const PRIZE_TERMS = {
  kind: 'Prize terms go on a reward or an offer.',
  not_allowed: "Only the people who look after this reward can change its prize terms.",
  partner_reward: "This reward belongs to a Sponsored Challenge. Set its prize terms in Rewards & offers.",
  earned: 'People have already earned this reward, so its prize terms stay as they are.',
  not_open: "This was withdrawn, so its prize terms can't change.",
  details: 'Something in the form went wrong. Refresh the page and try again.',
  sponsor_terms: 'An administrator needs to accept the Sponsor Reward Terms first.',
  invalid: "Something in the form isn't right. Check the dates and numbers, then save again.",
  locations: 'Pick at least one place, or every place.',
  prize_type: 'Pick what kind of prize it is.',
  method: 'Pick how it is used: an InneRISE voucher, or codes from your business.',
  code_mode: 'Pick one code for every winner, or a list with one code for each winner.',
  barcode: 'Pick the barcode your register reads, or no barcode.',
  shared_code: 'Enter the code every winner uses: up to 200 characters, and not one that is already on your uploaded list.',
  voucher_format: "That code looks like an InneRISE prize code. Use one of your business's own codes.",
  instructions: 'Keep the instructions to 1,000 characters.',
  contact_email: 'Enter an email address winners can write to, up to 254 characters. "Email the business to claim" needs one.',
  valid: 'Check the dates: a last day that has not passed, or a number of days after winning, not both.',
  min_age: 'Pick 18 or 21, or no age limit.',
  area: 'Pick a country before a state or city, and keep each to 100 characters.',
  fulfillment: 'Pick how the winner gets it: at the counter, pickup, delivery, pickup or delivery, or by email.',
  pickup_unit: 'Pick the place where winners pick it up.',
};
Object.assign(BY_FUNCTION, {
  partner_redeem_check: PARTNER_COUNTER,
  partner_redeem_confirm: PARTNER_COUNTER,
  partner_redeem_status: PARTNER_COUNTER,
  prize_check: COUNTER,
  prize_confirm: COUNTER,
  prize_status: COUNTER,
  prize_giver_get: PRIZE_MANAGER,
  prize_giver_set: { not_allowed: 'Only an administrator can change the logo.', logo_path: "That logo can't be used. Upload a PNG, JPEG or WebP picture again.",
    details: 'Something in the form went wrong. Refresh the page and try again.' },
  prize_terms_set: PRIZE_TERMS,
  prize_terms_get: PRIZE_TERMS,
  prize_codes_add: { ...PRIZE_TERMS, codes: 'Paste at least one code, one per line.',
    not_list: "These prize terms use one code for every winner, so there's no list to upload. Change the terms to a list first." },
  prize_reverse: { not_allowed: 'Only an administrator, or a rewards manager for that place, can undo a use.',
    not_found: "We couldn't find that use. Refresh the report and try again.", reason: 'Say why, in 1 to 500 characters.',
    already_reversed: 'That use was already undone.' },
  prize_disputes: PRIZE_MANAGER,
  prize_dispute_answer: { ...PRIZE_MANAGER, not_found: "We couldn't find that dispute. Refresh and try again.", closed: 'That dispute was already answered.',
    outcome: 'Pick Resolved or Declined.', answer: 'Write an answer of 1 to 500 characters.' },
  prize_fulfillment_list: { ...PRIZE_MANAGER, state: 'Pick waiting, ready or shipped.', after: 'Refresh the page and try again.' },
  prize_fulfill: { not_allowed: 'Only an administrator, or a rewards manager for the pickup place, can do that.',
    not_found: "We couldn't find that prize. Refresh and try again.", step: "That step isn't available.",
    state: 'That prize has already moved on. Refresh to see where it is now.' },
  prize_address: { not_allowed: 'Only administrators and rewards managers for the whole organization see delivery addresses.',
    not_found: "There's no address for this prize anymore. An address is removed 30 days after delivery." },
  prize_report: { ...PRIZE_MANAGER, unit: 'That place is no longer there. Refresh the page and pick a place again.' },
});

// Workplace App Management and School Focus (071a, 071b) ----------------------------------------------------------------
const FOCUS = {
  not_allowed: 'You can only set schedules for the {unitsLower} you look after. Ask an administrator for the rest.',
  not_offered: "{focusTitle} isn't switched on for this {org}. Write to InneRISE to turn it on.",
  details: "Something in the form isn't right. Check it and try again.",
  unknown_field: "Something in the form isn't right. Check it and try again.",
  not_found: 'That schedule was removed. The list now shows the current ones.',
  unit: 'Pick the whole {org}, or one of the places you look after.',
  name: 'Give it a name of 2 to 60 characters.',
  kind: 'Pick focus hours, lunch or a break.',
  days: 'Pick at least one day.',
  start: 'Set a start time.',
  end: 'Set an end time.',
  too_short: 'Make it at least 15 minutes long. An end before the start runs past midnight.',
  time_zone: 'Pick a time zone from the list.',
  app_categories: 'Pick at least one kind of app for focus hours to limit.',
  note: 'Keep the note to 200 characters.',
  too_many: 'There can be up to 1,000 schedules.',
  name_taken: 'Another schedule for the same place already has that name. Pick another name.',
  invalid: "Something in the form isn't right. Check it and try again.",
};
Object.assign(BY_FUNCTION, {
  org_focus_save: FOCUS,
  org_focus_remove: { not_allowed: FOCUS.not_allowed, not_found: FOCUS.not_found },
  org_focus_list: { not_allowed: 'Only administrators, managers and teachers can see {focusTitle}.' },
  org_focus_enrolled: { not_allowed: 'Only administrators, managers and teachers can see who enrolled.' },
  org_focus_device: { not_allowed: 'Only administrators can add or remove company phones.',
    device_ref: "Enter the phone's ID from your device-management system (1 to 100 characters).",
    not_offered: FOCUS.not_offered, not_member: 'Pick someone who is an active member here.',
    under_18: 'Company phones are only for people 18 or older.', device_taken: 'That phone is already listed for someone here.',
    not_found: "That phone isn't listed anymore." },
  org_focus_access_rules: { not_allowed: 'Only administrators can change these rules.', details: FOCUS.details,
    approvers: 'Pick who approves requests.', max_minutes: 'Allow 5 to 120 minutes for one request.',
    max_day_minutes: 'Allow 5 to 480 minutes a day, and at least as many as one request.', reason_required: 'Say whether a reason is needed.' },
  org_focus_answer: { not_found: "This request isn't waiting for you anymore.", answer: 'Pick Approve or Deny.',
    expired: "This request ran out of time before anyone answered. They can ask again in the app.",
    already_answered: 'Someone already answered this request.', 'already_answered.approved': 'Someone already approved this request.',
    'already_answered.denied': 'Someone already denied this request.',
    'already_answered.expired': 'This request ran out of time before anyone answered. They can ask again in the app.',
    day_limit: "Approving this would go over their minutes for today, so it can't be approved." },
});

// The Challenge & Rewards Library and habit challenges (075) -----------------------------------------------------------
// Using a template runs 072's org_challenge_create, 075's org_habit_create or 074's partner_campaign_create, and their
// refusals come back as they are; so do 072's org_reward_set's for a reward template.
const HABIT = {
  not_allowed: CHALLENGE.not_allowed,
  not_for_partners: "Habit challenges are for workplaces and schools. A partner's challenges count steps, distance or floors from a phone or watch.",
  not_verified: CHALLENGE.not_verified,
  not_offered: CHALLENGE.not_offered,
  too_many: 'This {org} already has as many challenges running as InneRISE allows. Wait for some to finish, or cancel one you no longer need.',
  unit: CHALLENGE.unit,
  details: "Something in the form isn't right. Check it and try again.",
  title: CHALLENGE.title,
  description: CHALLENGE.description,
  habit: 'Pick the habit: reading, wellness or a positive habit.',
  tracking: 'Pick how days are counted: a self check-in, or confirmed by a teacher or manager.',
  mode: "Pick how it's scored: days done, or days done toward a target.",
  daily_goal: 'A habit has no daily goal: each day is done or not.',
  invalid: CHALLENGE.invalid,
  days: 'Pick how many days it runs: at least 1, and no longer than InneRISE allows for one challenge.',
  target: "Set a target from 1 up to the number of days it runs. Scoring toward a target needs one.",
  starts_on: CHALLENGE.starts_on,
  sides: CHALLENGE.sides,
  group_kind: CHALLENGE.group_kind,
  max_people: CHALLENGE.max_people,
  final_of: CHALLENGE.final_of,
  advance: CHALLENGE.advance,
  children_rules: 'With students, a final round takes the top sides, never the top people.',
  advance_n: CHALLENGE.advance_n,
  locked: CHALLENGE.locked,
  not_open: CHALLENGE.not_open,
};
const CONFIRM = {
  not_allowed: "Days are confirmed by the teacher of a classroom, grade, program or group, or in a business by the manager of a team. Your role doesn't cover this challenge.",
  self_checkin: 'People check in for this challenge themselves, in the InneRISE app.',
  not_open: "This challenge's results are final, or it was cancelled, so its days can no longer be confirmed.",
  invalid: 'Pick a day and who to confirm.',
  members: 'Pick 1 to 500 people at a time.',
  day: "Your computer's date doesn't look right. Check its date and time, then try again.",
  window: "A day can be confirmed on the day and up to 3 days after it, within the challenge's dates. Pick a day in that window.",
  outside_dates: "That day is outside the challenge's dates. Pick one of the days it ran.",
  rate_limited: "You've reached today's limit for confirming days: 5,000 people a day.",
};
const TEMPLATE = {
  not_allowed: "Only administrators and challenge coordinators for the whole {org} can save or remove the {org}'s own templates.",
  details: "Something in the form isn't right. Check it and try again.",
  kind: 'Pick a challenge or a reward.',
  from_challenge: "That challenge isn't in this {org} anymore. Pick another one.",
  not_found: "That template isn't there anymore. Refresh the page.",
  too_many: "This {org} already keeps as many of its own templates as InneRISE allows. Remove one you no longer use first.",
  title: 'Give it a name: up to 60 characters for a challenge, or 80 for a reward.',
  description: CHALLENGE.description,
  no_prices_or_brands: "Templates can't hold prices, money words, percentages, links, email addresses or trademark signs. Take those out of the name and description.",
  for_kinds: "Something in the form isn't right. Check it and try again.",
  age_groups: 'Pick at least one age group: adults, teens or children.',
  children_rules: 'A template for teens, children or a school never scores totals, and never rewards one winner or a top few.',
  tracking: 'Pick how days are counted.',
  metric: 'Pick what counts: steps, distance or floors from a phone or watch, or reading, wellness or a positive habit.',
  mode: "Pick how it's scored. A habit counts days done, with or without a target; only a phone or watch can count a total.",
  invalid: CHALLENGE.invalid,
  days: HABIT.days,
  daily_goal: "A daily goal is only for days at a goal from a phone or watch: above 0 and within a healthy day's limit (100,000 steps, 120 km walking or running, 400 km cycling, or 500 floors).",
  target: "That target is out of reach: it can't be more than the number of days, or for a total, more than a healthy day's limit for every day. A habit toward a target needs one.",
  sides: CHALLENGE.sides,
  partner: "A partner's templates count steps, distance or floors from a phone or watch, with no sides. Rewards and offers aren't templates.",
  reward_kind: REWARD.kind,
  earns: 'Pick who earns it.',
  top_n: 'Set how many top places earn it: at least 1, and no more than InneRISE allows.',
  quantity: 'Set how many there are: at least 1 and no more than InneRISE allows, or leave it empty for no limit.',
};
const HABIT_REWARDS = "A habit challenge's rewards go to everyone who reaches the target or everyone who takes part. Pick one of those.";
Object.assign(BY_FUNCTION, {
  org_habit_create: HABIT,
  org_habit_edit: { ...HABIT, not_allowed: "You can't change this challenge. The people who run it can: challenge coordinators, and managers and teachers for their own part of the {org}." },
  org_habit_confirm: CONFIRM,
  org_habit_sheet: CONFIRM,
  org_library_browse: { not_allowed: 'The library is for administrators, challenge coordinators, managers, teachers and rewards managers.',
    what: 'That filter is no longer there. Refresh the page.', age_group: 'That filter is no longer there. Refresh the page.',
    counted_by: 'That filter is no longer there. Refresh the page.' },
  org_library_save: TEMPLATE,
  org_library_remove: { not_allowed: TEMPLATE.not_allowed, not_found: TEMPLATE.not_found },
  // The template's challenge, made by 072, 075 or (for a partner, as a draft) 074.
  org_library_use: { ...CAMPAIGN, ...CHALLENGE, ...HABIT, not_found: "That template isn't available here anymore. Refresh the page.",
    details: HABIT.details, children_rules: CHALLENGE.children_rules },
  org_library_use_reward: { ...REWARD, not_found: "That template isn't available here anymore. Refresh the page.", details: HABIT.details,
    habit_rewards: HABIT_REWARDS },
});
GENERAL.habit_rewards = HABIT_REWARDS;
GENERAL.not_qualified = CHALLENGE.not_qualified;

// Billing (076): org_billing_view, and the two Edge Functions' errors (functions/_shared/billing/http.ts, word for word;
// each answer also carries its message, which is shown when the code isn't one of these).
const BILLING = {
  method_not_allowed: 'Something went wrong. Refresh the page and try again.',
  origin: 'Billing can only be opened from innerise.app.',
  not_signed_in: 'You were signed out. Please sign in again.',
  parent_approval_required: 'This account needs a parent to approve this sign-in first.',
  bad_request: 'Something went wrong. Refresh the page and try again.',
  not_found: "We couldn't find that organization. It may have been closed.",
  suspended: 'This organization is paused by InneRISE. Write to InneRISE to reopen it.',
  closed: 'This organization is closed.',
  not_allowed: 'Only administrators and the billing contact can manage billing.',
  not_verified: "InneRISE hasn't verified this organization yet, so it can't subscribe yet.",
  no_plans: 'No plans are available yet.',
  plan: "That plan isn't available for this organization.",
  seats: 'Choose between 1 and 100,000 seats.',
  already_subscribed: 'This organization already has a subscription. Use Manage billing to change it.',
  no_customer: "There's no billing account for this organization yet. Choose a plan first.",
  mode_mismatch: 'Billing is being switched over by InneRISE. Please try again later.',
  not_configured: "Billing isn't switched on yet. Please try again later.",
  stripe_error: "We couldn't reach the payment service. Please try again in a few minutes.",
  try_again: 'Something went wrong on our side. Please try again in a few minutes.',
};
Object.assign(BY_FUNCTION, {
  org_billing_view: { not_allowed: BILLING.not_allowed, not_found: BILLING.not_found, suspended: BILLING.suspended, closed: BILLING.closed },
  'billing-checkout': BILLING,
  'billing-portal': BILLING,
});

// InneRISE administration (082, APP_CONTRACT_082.md): the staff_* functions wrap 068's org_staff_set_status, 074's
// partner_staff_*, 075's org_library_staff_* and 078's prize_staff_* for a signed-in InneRISE staff member
// (innerise_is_staff()). For anyone else each raises not_staff (fromError). Their refusals come back as {error: ...}, and
// these are those answers in plain English.
const STAFF_ONLY = 'Only InneRISE staff can do this. Sign in with your InneRISE staff account.';
const STAFF_REVIEW_NOTE = 'Write a note of up to 300 characters saying what to change. The partner sees it.';
const STAFF_SETTING = "One of its settings can't be used now. Send it back with a note so the partner can change it.";
Object.assign(BY_FUNCTION, {
  staff_overview: { not_staff: STAFF_ONLY },
  staff_org_list: { not_staff: STAFF_ONLY, status: "That filter isn't available. Refresh the page." },
  staff_org_set_status: { not_staff: STAFF_ONLY, not_found: "We couldn't find that organization. Refresh the list and try again.",
    status: "That status isn't available. Refresh the page and try again.", note: 'Keep the note to 200 characters or fewer. The organization sees it.',
    failed: "That didn't go through, and nothing was changed. Refresh the page and try again." },
  staff_partner_queue: { not_staff: STAFF_ONLY },
  staff_partner_decide: {
    not_staff: STAFF_ONLY,
    approve: 'Pick Approve or Send back.',
    not_found: "We couldn't find that. The partner may have withdrawn it. Refresh the list.",
    not_submitted: "It isn't waiting for review any more: the partner changed or withdrew it, or someone at InneRISE already decided. Refresh the list.",
    'not_submitted.withdrawn': 'The partner withdrew it, so there is nothing to review any more.',
    'not_submitted.rejected': 'It was already sent back to the partner.',
    'not_submitted.draft': 'The partner took it back to change it, so there is nothing to review until they send it again.',
    not_verified: "This partner isn't verified yet. Check the business under Organizations and approve it first, then approve this.",
    note: 'Write a note of 5 to 300 characters. The partner sees it.',
    ended: 'Its last day has passed, so it can no longer be approved. Send it back so the partner can change the dates.',
    for_campaign: 'The Sponsored Challenge this reward belongs to was withdrawn, so the reward can no longer be approved.',
    starts_on: 'Its start date has passed, so it can no longer start as sent. Send it back so the partner can pick new dates.',
    sponsor_terms: "This partner hasn't accepted the current Sponsor Reward Terms, so its rewards and offers can't be approved yet. One of its administrators accepts them in Rewards & offers.",
    not_approved: "It couldn't be approved: one of its settings can't be used now. Send it back with a note so the partner can change it.",
    invalid: STAFF_SETTING, days: STAFF_SETTING, daily_goal: STAFF_SETTING, target: STAFF_SETTING, max_people: STAFF_SETTING,
  },
  staff_library_list: { not_staff: STAFF_ONLY },
  staff_library_set_status: { not_staff: STAFF_ONLY, not_found: "That template isn't there any more. Refresh the page.",
    status: "That status isn't available. Refresh the page and try again." },
  staff_prize_queue: { not_staff: STAFF_ONLY },
  staff_prize_logo: { not_staff: STAFF_ONLY, approve: 'Pick Approve or Send back.', note: STAFF_REVIEW_NOTE,
    not_waiting: "That logo isn't waiting any more: the business changed or removed it, or someone at InneRISE already decided. Refresh the page." },
  staff_prize_terms: { not_staff: STAFF_ONLY, approve: 'Pick Approve or Send back.', note: STAFF_REVIEW_NOTE,
    not_waiting: "Those prize terms aren't waiting any more: the partner changed them, or someone at InneRISE already decided. Refresh the page." },
  // The Reports section (082): counts per place, those under the smallest group (and those that would give one away) already
  // hidden by the server.
  org_report_places: { not_allowed: 'Only administrators, and managers and teachers for their own places, can see reports.',
    not_found: "We couldn't find that organization. Refresh the page.", suspended: "This organization is paused by InneRISE, so its reports can't be opened.",
    closed: "This organization is closed, so there are no reports to show." },
});

export function explain(fn, code, data = null) {
  // Some refusals say more with the state they report (org_focus_answer's already_answered carries the request's status).
  const keyed = data && typeof data.status === 'string' && BY_FUNCTION[fn] ? BY_FUNCTION[fn][`${code}.${data.status}`] : null;
  const text = keyed || (BY_FUNCTION[fn] && BY_FUNCTION[fn][code]) || GENERAL[code] || 'Something went wrong. Please try again.';
  const n = data && Number.isInteger(data.short) && data.short > 0 ? data.short : null;
  const vars = { ...nouns, short: n ? `${n.toLocaleString('en-US')} more ${n === 1 ? 'code' : 'codes'}` : 'more codes' };
  return text.replace(/\{(\w+)\}/g, (all, k) => (vars[k] != null ? vars[k] : all));
}

// A database error (raised, not returned) or a network failure.
function fromError(fn, error) {
  const msg = String(error.message || '');
  const code = String(error.code || '');
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return new ApiError('network', GENERAL.network);
  if (/not_signed_in|session_ended|JWT expired/i.test(msg) || code === 'PGRST301' || code === '28000') {
    return new ApiError('signed_out', GENERAL.signed_out);
  }
  if (/org_last_admin/.test(msg)) return new ApiError('last_admin', GENERAL.last_admin);
  // 075's trigger on 072's rewards: a habit challenge's rewards are goal or finish only.
  if (/^habit_rewards\b/.test(msg)) return new ApiError('habit_rewards', HABIT_REWARDS);
  if (/parent_approval_required/.test(msg)) return new ApiError('parent_approval_required', GENERAL.parent_approval_required);
  // 082: every staff call raises not_staff for anyone who isn't InneRISE staff.
  if (/^not_staff\b/.test(msg)) return new ApiError('not_staff', explain(fn, 'not_staff'));
  if (code === 'PGRST202') return new ApiError('missing_function', GENERAL.missing_function);
  if (code === '42501' || /permission denied/i.test(msg)) return new ApiError('no_access', GENERAL.no_access);
  return new ApiError('unknown', 'Something went wrong. Please try again.');
}

async function call(fn, args) {
  let res;
  try {
    res = await client.rpc(fn, args);
  } catch {
    throw new ApiError('network', GENERAL.network);
  }
  const { data, error } = res;
  if (error) throw fromError(fn, error);
  if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.error === 'string') {
    throw new ApiError(data.error, explain(fn, data.error, data), data);
  }
  return data;
}

// The functions the portal uses (argument names match the SQL exactly) ----------------------------
export const rpc = {
  mine: () => call('org_mine'),
  create: (k, nm, tz) => call('org_create', { k, nm, tz }),
  profileSet: (o, d) => call('org_profile_set', { o, d }),
  details: (o) => call('org_details', { o }),
  domainAdd: (o, dom) => call('org_domain_add', { o, dom }),
  domainRemove: (o, dom) => call('org_domain_remove', { o, dom }),
  adminView: (o) => call('org_admin_view', { o }),
  members: (o, u = null, skip = 0, max_rows = 200) => call('org_members_list', { o, u, max_rows, skip }),
  roleSet: (o, who, r, u, give) => call('org_role_set', { o, who, r, u, give }),
  memberRemove: (o, who) => call('org_member_remove', { o, who }),
  unitAdd: (o, parent, k, nm) => call('org_unit_add', { o, parent, k, nm }),
  unitRename: (u, nm) => call('org_unit_rename', { u, nm }),
  unitRemove: (u) => call('org_unit_remove', { u }),
  unitDetailsSet: (u, d) => call('org_unit_details_set', { u, d }),
  inviteCreate: (o, u, mtype, uses, days) => call('org_invite_create', { o, u, mtype, uses, days }),
  inviteClose: (code_in) => call('org_invite_close', { code_in }),
  settingsSet: (o, min_group) => call('org_settings_set', { o, min_group }),
  adminTransfer: (o, who) => call('org_admin_transfer', { o, who }),
  leave: (o) => call('org_leave', { o }),
  // Challenges and Rewards (072)
  challengeCreate: (o, d) => call('org_challenge_create', { o, d }),
  challengeEdit: (ch, d) => call('org_challenge_edit', { ch, d }),
  challengeCancel: (ch) => call('org_challenge_cancel', { ch }),
  challengeList: (o) => call('org_challenge_list', { o }),
  challengeReport: (ch, skip = 0, max_rows = 100) => call('org_challenge_report', { ch, max_rows, skip }),
  rewardSet: (ch, reward, d) => call('org_reward_set', { ch, reward, d }),
  rewardApprove: (reward, yes) => call('org_reward_approve', { reward, yes }),
  rewardRemove: (reward) => call('org_reward_remove', { reward }),
  rewardCodesAdd: (reward, codes) => call('org_reward_codes_add', { reward, codes }),
  rewardStatus: (ch) => call('org_reward_status', { ch }),
  rewardGiven: (earned) => call('org_reward_given', { earned }),
  sponsorTermsState: (o) => call('org_sponsor_terms_state', { o }),
  sponsorTermsAccept: (o, version) => call('org_sponsor_terms_accept', { o, version }),
  // InneRISE Partners (074)
  partnerOptions: () => call('partner_options'),
  partnerProfileSet: (o, d) => call('partner_profile_set', { o, d }),
  partnerPlanSet: (o, plan) => call('partner_plan_set', { o, plan }),
  partnerOverview: (o) => call('partner_overview', { o }),
  campaignCreate: (o, k, d) => call('partner_campaign_create', { o, k, d }),
  campaignEdit: (campaign, d) => call('partner_campaign_edit', { campaign, d }),
  campaignSubmit: (campaign) => call('partner_campaign_submit', { campaign }),
  campaignWithdraw: (campaign) => call('partner_campaign_withdraw', { campaign }),
  campaignPause: (campaign, pause) => call('partner_campaign_pause', { campaign, pause }),
  campaignList: (o) => call('partner_campaign_list', { o }),
  campaignDetails: (campaign) => call('partner_campaign_details', { campaign }),
  campaignReport: (campaign) => call('partner_campaign_report', { campaign }),
  partnerCodesAdd: (campaign, codes) => call('partner_codes_add', { campaign, codes }),
  // 074's two-step counter (prize round): check reads only; confirm uses it once, under one request key per attempt.
  partnerRedeemCheck: (o, code_in) => call('partner_redeem_check', { o, code_in }),
  partnerRedeemConfirm: (o, code_in, request_key) => call('partner_redeem_confirm', { o, code_in, request_key }),
  partnerRedeemStatus: (o, request_key) => call('partner_redeem_status', { o, request_key }),
  // Workplace App Management and School Focus (071a, 071b)
  focusList: (o) => call('org_focus_list', { o }),
  focusSave: (o, d) => call('org_focus_save', { o, d }),
  focusRemove: (o, s) => call('org_focus_remove', { o, s }),
  focusEnrolled: (o, skip = 0) => call('org_focus_enrolled', { o, skip }),
  focusDevice: (o, who, ref, add) => call('org_focus_device', { o, who, ref, add }),
  focusRules: (o, d = null) => call('org_focus_access_rules', d == null ? { o } : { o, d }),
  focusWaiting: () => call('org_focus_waiting'),
  focusAnswer: (r, approve) => call('org_focus_answer', { r, approve }),
  // The Challenge & Rewards Library and habit challenges (075)
  libraryBrowse: (o, what = null, age_group = null, counted_by = null) => call('org_library_browse', { o, what, age_group, counted_by }),
  librarySave: (o, template, d) => call('org_library_save', { o, template, d }),
  libraryRemove: (o, template) => call('org_library_remove', { o, template }),
  libraryUse: (o, template, d) => call('org_library_use', { o, template, d }),
  libraryUseReward: (ch, template, d) => call('org_library_use_reward', { ch, template, d }),
  habitCreate: (o, d) => call('org_habit_create', { o, d }),
  habitEdit: (ch, d) => call('org_habit_edit', { ch, d }),
  habitConfirm: (ch, on_day, members, done, local_today) => call('org_habit_confirm', { ch, on_day, members, done, local_today }),
  habitSheet: (ch, on_day, local_today, skip = 0, max_rows = 500) => call('org_habit_sheet', { ch, on_day, local_today, max_rows, skip }),
  habitToConfirm: (local_today) => call('org_habit_to_confirm', { local_today }),
  habitAbout: (ids) => call('org_habit_about', { ids }),
  // Billing (076)
  billingView: (o) => call('org_billing_view', { o }),
  // The Prize Wallet (078): the counter
  prizeStaffPlaces: (o) => call('prize_staff_places', { o }),
  prizeCheck: (o, code_in, at_unit = null) => call('prize_check', { o, code_in, at_unit }),
  // Every prize is confirmed once, with no amount: exactly these four arguments.
  prizeConfirm: (o, code_in, at_unit, request_key) => call('prize_confirm', { o, code_in, at_unit, request_key }),
  prizeStatus: (o, request_key) => call('prize_status', { o, request_key }),
  // The Prize Wallet (078): givers' managers
  prizeGiverGet: (o) => call('prize_giver_get', { o }),
  prizeGiverSet: (o, d) => call('prize_giver_set', { o, d }),
  prizeTermsSet: (k, target, d) => call('prize_terms_set', { k, target, d }),
  prizeTermsGet: (k, target) => call('prize_terms_get', { k, target }),
  prizeCodesAdd: (k, target, codes) => call('prize_codes_add', { k, target, codes }),
  prizeReverse: (o, event_id, reason) => call('prize_reverse', { o, event_id, reason }),
  prizeDisputes: (o, open_only = true, before_id = null, max_rows = 50) => call('prize_disputes', { o, open_only, before_id, max_rows }),
  prizeDisputeAnswer: (o, dispute, outcome, answer) => call('prize_dispute_answer', { o, dispute, outcome, answer }),
  prizeFulfillmentList: (o, state = null, after = null, max_rows = 100) => call('prize_fulfillment_list', { o, state, after, max_rows }),
  prizeFulfill: (o, prize, step) => call('prize_fulfill', { o, prize, step }),
  prizeAddress: (o, prize) => call('prize_address', { o, prize }),
  prizeReport: (o, from_day = null, to_day = null, unit = null, after_id = null, max_rows = 500) => call('prize_report', { o, from_day, to_day, unit, after_id, max_rows }),
  // Reports (082): how many people are in each place; a count under the smallest group comes back as null, with *_fewer_than.
  reportPlaces: (o) => call('org_report_places', { o }),
  // InneRISE administration (082): for InneRISE staff only. The server checks innerise_is_staff() on every call.
  isStaff: () => call('innerise_is_staff'),
  staffOverview: () => call('staff_overview'),
  staffOrgList: (st = 'pending', q = null, lim = 50, off = 0) => call('staff_org_list', { st, q, lim, off }),
  staffOrgSetStatus: (o, st, note) => call('staff_org_set_status', { o, st, note }),
  staffPartnerQueue: () => call('staff_partner_queue'),
  staffPartnerDecide: (campaign, approve, note) => call('staff_partner_decide', { campaign, approve, note }),
  staffLibraryList: (st = null) => call('staff_library_list', { st }),
  staffLibrarySetStatus: (template, st) => call('staff_library_set_status', { template, st }),
  staffPrizeQueue: () => call('staff_prize_queue'),
  staffPrizeLogo: (o, approve, note) => call('staff_prize_logo', { o, approve, note }),
  staffPrizeTerms: (campaign, approve, note) => call('staff_prize_terms', { campaign, approve, note }),
};

// A giver's logo (078): the private bucket prize-logos, under the organization's id. An administrator uploads, replaces and
// removes; the organization's members read. Only PNG, JPEG and WebP.
const LOGO_BUCKET = 'prize-logos';
async function store(fn) {
  let res;
  try {
    res = await fn(client.storage.from(LOGO_BUCKET));
  } catch {
    throw new ApiError('network', GENERAL.network);
  }
  if (res && res.error) {
    const msg = String(res.error.message || '');
    if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) throw new ApiError('network', GENERAL.network);
    if (/mime|type/i.test(msg)) throw new ApiError('logo_type', 'Use a PNG, JPEG or WebP picture.');
    if (/size|large/i.test(msg)) throw new ApiError('logo_size', 'That picture is too large. Use one under 1 MB.');
    if (/policy|permission|unauthorized|403/i.test(msg)) throw new ApiError('not_allowed', 'Only an administrator can change the logo.');
    throw new ApiError('storage', "The logo couldn't be saved. Please try again.");
  }
  return res ? res.data : null;
}
export const logos = {
  upload: (path, file) => store((b) => b.upload(path, file, { upsert: true, contentType: file.type, cacheControl: '60' })),
  list: (orgId) => store((b) => b.list(orgId, { limit: 20, sortBy: { column: 'updated_at', order: 'desc' } })),
  url: async (path) => ((await store((b) => b.createSignedUrl(path, 600))) || {}).signedUrl || null,
  remove: (paths) => store((b) => b.remove(paths)),
};

// Billing's Edge Functions (076): POST { org_id, plan, seats? } to billing-checkout, or { org_id } to billing-portal, with
// the signed-in person's token (supabase-js adds it). The answer is { url } of Stripe's page: the only thing used from it.
async function invoke(fn, body) {
  let res;
  try {
    res = await client.functions.invoke(fn, { body });
  } catch {
    throw new ApiError('network', GENERAL.network);
  }
  const { data, error } = res;
  if (error) {
    // FunctionsHttpError: the function answered { error, message } with a non-2xx status (the Response is its context).
    let said = null;
    if (error.context && typeof error.context.json === 'function') {
      try { said = await error.context.json(); } catch { said = null; }
    }
    // Signed out: the function's own not_signed_in, or the gateway turning down an expired token (401).
    if ((said && said.error === 'not_signed_in') || (error.context && error.context.status === 401)) throw new ApiError('signed_out', GENERAL.signed_out);
    if (said && typeof said.error === 'string') {
      const known = BILLING[said.error];
      throw new ApiError(said.error, known || (typeof said.message === 'string' && said.message) || BILLING.try_again, said);
    }
    if (error.name === 'FunctionsFetchError' || /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(String(error.message || ''))) {
      throw new ApiError('network', GENERAL.network);
    }
    throw new ApiError('try_again', BILLING.try_again);
  }
  const url = data && typeof data.url === 'string' ? data.url : '';
  if (!/^https:\/\//.test(url)) throw new ApiError('try_again', BILLING.try_again);
  return url;
}
export const billing = {
  checkout: (org_id, plan, seats = null) => invoke('billing-checkout', seats == null ? { org_id, plan } : { org_id, plan, seats }),
  portal: (org_id) => invoke('billing-portal', { org_id }),
};

// Sign-in -----------------------------------------------------------------------------------------
function authMessage(error) {
  const msg = String((error && error.message) || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return GENERAL.network;
  const wait = msg.match(/after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds before asking for another code.`;
  if (/expired|invalid.*token|token.*invalid|otp/i.test(msg)) return "That code didn't work. Check the 6 digits, or send a new code.";
  if (/rate limit|too many/i.test(msg)) return 'Too many tries for now. Please wait a few minutes and try again.';
  if (/email.*(invalid|format)|invalid.*email/i.test(msg)) return "That email address doesn't look right.";
  if (/sending.*email|email.*send/i.test(msg)) return "We couldn't send the email just now. Please try again in a few minutes.";
  if (/provider is not enabled|unsupported provider/i.test(msg)) return "Sign in with Apple isn't available here yet. Use Email me a code instead.";
  return "Sign-in didn't work. Please try again.";
}

function authFail(error) {
  throw new ApiError('auth', authMessage(error));
}

export const auth = {
  async session() {
    const { data, error } = await client.auth.getSession();
    if (error) authFail(error);
    return data.session;
  },
  onChange(fn) {
    // Supabase advises not to call it again from inside this callback; run the handler right after.
    client.auth.onAuthStateChange((event, session) => setTimeout(() => fn(event, session), 0));
  },
  async apple() {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) authFail(error);
  },
  async sendCode(email) {
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) authFail(error);
  },
  // The one-time sign-in the app hands over (a magic-link token hash made for this person by the app).
  async verifyHandoff(token_hash) {
    const { data, error } = await client.auth.verifyOtp({ token_hash, type: 'magiclink' });
    if (error) authFail(error);
    return data.session;
  },
  async verifyCode(email, token) {
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) authFail(error);
    return data.session;
  },
  // Signs out of this browser only. A global sign-out would also sign the person out of the InneRISE app.
  async signOut() {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      /* signed out locally either way */
    }
  },
};

// A sign-in error sent back in the address after Apple (?error=...&error_description=...).
export function redirectError() {
  const d = query.get('error_description') || query.get('error');
  return d ? authMessage({ message: d }) : null;
}
