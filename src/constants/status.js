/**
 * Subscription vocabulary.
 *
 * These strings mirror the Prisma enums in `prisma/schema.prisma` exactly.
 * They live here as well so services, validators and responses can reference
 * one source of truth without importing the generated client.
 */

const SUBSCRIPTION_PLAN = {
  TRIAL: 'TRIAL',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
};

const SUBSCRIPTION_STATUS = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
};

/** Plans a school actually pays for (used by future upgrade flows). */
const PAID_PLANS = [SUBSCRIPTION_PLAN.MONTHLY, SUBSCRIPTION_PLAN.YEARLY];

/** Length of a paid period, in days. */
const PLAN_DURATION_DAYS = {
  [SUBSCRIPTION_PLAN.MONTHLY]: 30,
  [SUBSCRIPTION_PLAN.YEARLY]: 365,
};

/** Standard HTTP codes used by the response helpers. */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
};

/** Machine-readable error codes returned in the response envelope. */
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  CODE_IN_USE: 'CODE_IN_USE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SCHOOL_DEACTIVATED: 'SCHOOL_DEACTIVATED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',
};

module.exports = {
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  PAID_PLANS,
  PLAN_DURATION_DAYS,
  HTTP_STATUS,
  ERROR_CODES,
};
