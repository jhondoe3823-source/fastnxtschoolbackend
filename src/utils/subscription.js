/**
 * Subscription rules — the single source of truth for trial windows, expiry and
 * the payload the frontend consumes.
 *
 * Status is DERIVED (not trusted from the DB) every time it is read, so a
 * school whose trial lapsed overnight is reported as EXPIRED without needing a
 * cron job. `persistedStatus` is used when writing the row so the stored value
 * is corrected lazily whenever the school signs in or loads /me.
 */

const env = require('../config/env');
const {
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  PLAN_DURATION_DAYS,
} = require('../constants');

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const toIso = (value) => (value ? new Date(value).toISOString() : null);

/** The 5-day (configurable) free window granted at registration. */
function trialWindow(now = new Date()) {
  return { startedAt: now, expiresAt: addDays(now, env.subscription.trialDays) };
}

/** The paid window for a plan. */
function paidWindow(plan, now = new Date()) {
  const days = PLAN_DURATION_DAYS[plan];
  if (!days) throw new Error(`No duration configured for plan "${plan}"`);
  return { startedAt: now, expiresAt: addDays(now, days) };
}

/** Whole days left, floored at 0. */
function daysRemaining(expiresAt, now = new Date()) {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

function isExpired(subscription, now = new Date()) {
  if (!subscription || !subscription.expiresAt) return true;
  return new Date(subscription.expiresAt).getTime() <= now.getTime();
}

/** Effective status right now — never stored blindly. */
function deriveStatus(subscription, now = new Date()) {
  if (!subscription) return SUBSCRIPTION_STATUS.EXPIRED;
  if (isExpired(subscription, now)) return SUBSCRIPTION_STATUS.EXPIRED;
  return subscription.plan === SUBSCRIPTION_PLAN.TRIAL
    ? SUBSCRIPTION_STATUS.TRIAL
    : SUBSCRIPTION_STATUS.ACTIVE;
}

/** Status as it should be persisted (keeps the column self-healing). */
const persistedStatus = (subscription, now = new Date()) =>
  deriveStatus(subscription, now);

/** A school may use the product while its subscription has not lapsed. */
const hasAccess = (subscription, now = new Date()) =>
  deriveStatus(subscription, now) !== SUBSCRIPTION_STATUS.EXPIRED;

/**
 * Pick the school's live subscription: the non-expired row with the furthest
 * expiry. Falls back to the most recent row so an expired school still sees
 * when it lapsed.
 */
function selectCurrent(subscriptions, now = new Date()) {
  const rows = (subscriptions || []).filter(Boolean);
  if (rows.length === 0) return null;

  const byExpiryDesc = [...rows].sort(
    (a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime()
  );

  return byExpiryDesc.find((row) => !isExpired(row, now)) || byExpiryDesc[0];
}

/** Shape handed to the frontend / auth-context. */
function toPayload(subscription, now = new Date()) {
  if (!subscription) {
    return {
      id: null,
      plan: null,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      active: false,
      isTrial: false,
      isExpired: true,
      needsAttention: false,
      daysRemaining: 0,
      trialDaysRemaining: 0,
      startedAt: null,
      expiresAt: null,
    };
  }

  const status = deriveStatus(subscription, now);
  const remaining = daysRemaining(subscription.expiresAt, now);
  const isTrial = subscription.plan === SUBSCRIPTION_PLAN.TRIAL;
  const active = status !== SUBSCRIPTION_STATUS.EXPIRED;

  return {
    id: subscription.id,
    plan: subscription.plan,
    status,
    active,
    isTrial,
    isExpired: !active,
    needsAttention: active && remaining <= env.subscription.warningDays,
    daysRemaining: remaining,
    trialDaysRemaining: isTrial ? remaining : 0,
    startedAt: toIso(subscription.startedAt),
    expiresAt: toIso(subscription.expiresAt),
  };
}

module.exports = {
  DAY_MS,
  addDays,
  trialWindow,
  paidWindow,
  daysRemaining,
  isExpired,
  deriveStatus,
  persistedStatus,
  hasAccess,
  selectCurrent,
  toPayload,
  trialDays: env.subscription.trialDays,
  warningDays: env.subscription.warningDays,
};