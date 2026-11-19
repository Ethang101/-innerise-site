// InneRISE Dashboard demo: organization billing (076_org_billing.sql) and its two Edge Functions (billing-checkout and
// billing-portal), with made-up sample data. Plugs into demo.js the way demo-programs.js does, on the same database.
// org_billing_view mirrors its SQL: the same argument, the same order of checks, the same errors and the same answer.
// The Edge Functions run every check the real ones do, in the same order, with the same { error, message } answers
// (functions/_shared/billing/http.ts). Then, where the real ones would ask Stripe for a checkout or portal address,
// this one stops: payments are off in the demo, nothing is charged and nothing is recorded.
// InneRISE adds no plans in 076 (prices live only in Stripe), so the demo has none either, except with ?demo=billing,
// whose plan names are made up to show the page with plans to choose from.

const DAY = 864e5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BILLING_SIGNATURES = {
  org_billing_view: { args: ['o'], required: ['o'], uuids: ['o'] },
};
// The Edge Functions' and InneRISE staff's (service role), and the helpers only 076 itself calls: never the portal's.
export const BILLING_SERVICE_ROLE = ['org_billing_checkout_start', 'org_billing_customer_set', 'org_billing_portal_start',
  'org_billing_record', 'org_billing_plan_set', 'org_billing_staff_forget_test_mode', 'org_billing_status_of', 'org_billing_stage',
  'org_billing_access'];

// functions/_shared/billing/http.ts, word for word.
const MESSAGES = {
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
const STATUS = {
  method_not_allowed: 405, origin: 403, not_signed_in: 401, parent_approval_required: 403, bad_request: 400, not_found: 404,
  suspended: 409, closed: 409, not_allowed: 403, not_verified: 409, no_plans: 409, plan: 400, seats: 400, already_subscribed: 409,
  no_customer: 409, mode_mismatch: 409, not_configured: 503, stripe_error: 502, try_again: 503,
};
const fail = (code) => {
  const c = Object.prototype.hasOwnProperty.call(MESSAGES, code) ? code : 'try_again';
  return { status: STATUS[c], body: { error: c, message: MESSAGES[c] } };
};
// Where the real functions would answer { url } from Stripe. Not one of http.ts's codes: the demo's own.
const DEMO_STOP = {
  'billing-checkout': "Payments are off in this demo, so nothing was charged. On innerise.app, this opens Stripe's secure checkout, which shows the price before you pay.",
  'billing-portal': "Payments are off in this demo. On innerise.app, this opens Stripe's billing portal, where the card, invoices, plan and seats are managed.",
};

// h: db(), me(), org(o), hasRole(o, uid, roles, u) (068's org_has_role).
export function billingFunctions(h) {
  const D = () => h.db();
  const row = (o) => D().billing.find((b) => b.org_id === o) || null;
  const offered = (g) => D().billingPlans.filter((p) => p.active && p.org_kinds.includes(g.kind))
    .sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name) || a.key.localeCompare(b.key));
  const access = () => 'full'; // org_billing_access: record only, for every status (Ethan's decision, pending)

  const fns = {
    org_billing_view({ o }) {
      const me = h.me();
      const g = h.org(o);
      if (!g) return { error: 'not_found' };
      if (['suspended', 'closed'].includes(g.status)) return { error: g.status };
      if (!h.hasRole(o, me, ['billing_contact'])) return { error: 'not_allowed' };
      const b = row(o);
      const p = b && b.plan_key ? D().billingPlans.find((x) => x.key === b.plan_key) : null;
      const plans = offered(g).map((x) => ({ key: x.key, name: x.display_name, interval: x.billing_interval, seat_based: x.seat_based }));
      const status = (b && b.status) || 'none';
      const why = g.status !== 'active' ? 'not_verified'
        : ['trialing', 'active', 'past_due'].includes(status) ? 'already_subscribed'
          : !plans.length ? 'no_plans' : null;
      return {
        ok: true,
        org: { id: g.id, name: g.name, kind: g.kind, status: g.status },
        billing: {
          status,
          plan: p ? { key: p.key, name: p.display_name, interval: p.billing_interval, seat_based: p.seat_based } : null,
          plan_unknown: !!(b && b.stripe_price_id && !p),
          seats: b ? b.seats : null,
          current_period_end: b ? b.current_period_end : null,
          cancel_at_period_end: !!(b && b.cancel_at_period_end),
          payment_failed_at: b ? b.payment_failed_at : null,
          last_paid_at: b ? b.last_paid_at : null,
          can_manage: !!(b && b.stripe_customer_id),
          updated_at: b ? b.updated_at : null,
        },
        access: access(o),
        checkout: { allowed: why == null, reason: why },
        plans,
      };
    },
  };

  // supabase-js's functions.invoke(name, { body }) for the signed-in person (uid: null when signed out): { status, body }.
  function invoke(name, uid, body) {
    if (!DEMO_STOP[name]) return { status: 404, body: { error: 'not_found', message: 'Requested function was not found' } }; // Supabase's own answer
    // signedIn (http.ts): POST from innerise.app with a JSON body naming an organization, and a signed-in person.
    if (!uid) return fail('not_signed_in');
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('bad_request');
    if (typeof body.org_id !== 'string' || !UUID.test(body.org_id)) return fail('bad_request');
    const o = body.org_id.toLowerCase();
    const g = h.org(o);
    const b = row(o);
    if (name === 'billing-checkout') {
      const { plan, seats } = body;
      if (typeof plan !== 'string' || plan.length > 40) return fail('bad_request');
      if (seats !== undefined && seats !== null && !(typeof seats === 'number' && Number.isInteger(seats) && seats >= 1 && seats <= 100000)) return fail('seats');
      // org_billing_checkout_start(o, uid, plan, seats, live = false)
      if (!g) return fail('not_found');
      if (['suspended', 'closed'].includes(g.status)) return fail(g.status);
      if (!h.hasRole(o, uid, ['billing_contact'])) return fail('not_allowed');
      if (g.status !== 'active') return fail('not_verified');
      if (b && b.livemode != null && b.livemode !== false) return fail('mode_mismatch');
      if (b && ['trialing', 'active', 'past_due'].includes(b.status)) return fail('already_subscribed');
      if (!offered(g).length) return fail('no_plans');
      const p = offered(g).find((x) => x.key === plan);
      if (!p) return fail('plan');
      if (p.seat_based) {
        const n = seats ?? Math.max(1, D().members.filter((m) => m.org_id === o && m.status === 'active').length);
        if (n < 1 || n > 100000) return fail('seats');
      }
    } else {
      // org_billing_portal_start(o, uid, live = false)
      if (!g) return fail('not_found');
      if (['suspended', 'closed'].includes(g.status)) return fail(g.status);
      if (!h.hasRole(o, uid, ['billing_contact'])) return fail('not_allowed');
      if (!b || !b.stripe_customer_id) return fail('no_customer');
      if (b.livemode !== false) return fail('mode_mismatch');
    }
    return { status: 503, body: { error: 'demo_payments_off', message: DEMO_STOP[name] } };
  }

  // What Stripe's signed messages would change (stripe-webhook, org_billing_record): only the flow test uses it, to show the
  // page in each state Stripe can report.
  function stripe(o, fields) {
    let b = row(o);
    if (!b) { b = blank(o); D().billing.push(b); }
    Object.assign(b, fields, { updated_at: new Date().toISOString() });
    return { ...b };
  }
  return { fns, invoke, stripe };
}

const blank = (o) => ({ org_id: o, stripe_customer_id: null, stripe_subscription_id: null, livemode: null, plan_key: null, stripe_price_id: null,
  status: 'none', seats: null, current_period_end: null, cancel_at_period_end: false, payment_failed_at: null, last_paid_at: null,
  updated_at: null });

export function seedBilling(db, start, refs) {
  Object.assign(db, { billingPlans: [], billing: [] });
  if (start !== 'billing') return db; // as on the real server today: no plans yet
  const now = Date.now();
  const at = (days) => new Date(now + days * DAY).toISOString();
  // Made-up plans (InneRISE staff add the real ones with org_billing_plan_set; the price is only on Stripe).
  const plan = (key, name, kinds, price, ivl, seat, sort) => db.billingPlans.push({ key, display_name: name, org_kinds: kinds,
    stripe_price_id: price, billing_interval: ivl, seat_based: seat, active: true, sort_order: sort });
  plan('enterprise_monthly', 'Enterprise, monthly', ['business'], 'price_demoEnterpriseMonth', 'month', true, 10);
  plan('enterprise_yearly', 'Enterprise, yearly', ['business'], 'price_demoEnterpriseYear', 'year', true, 20);
  plan('education_yearly', 'Education, yearly', ['school', 'district', 'college'], 'price_demoEducationYear', 'year', true, 10);
  plan('partner_monthly', 'Partner, monthly', ['partner'], 'price_demoPartnerMonth', 'month', false, 10);
  // Peak Fitness (verified in this demo) already subscribes: test mode, as before going live.
  db.billing.push({ ...blank(refs.peak), stripe_customer_id: 'cus_demoPeakFitness', stripe_subscription_id: 'sub_demoPeakFitness', livemode: false,
    plan_key: 'partner_monthly', stripe_price_id: 'price_demoPartnerMonth', status: 'active', seats: 1, current_period_end: at(18),
    last_paid_at: at(-12), updated_at: at(-12) });
  return db;
}
