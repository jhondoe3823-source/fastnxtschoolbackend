/**
 * Barrel for all constants. Import from here:
 *
 *   const { ROLES, SUBSCRIPTION_STATUS, HTTP_STATUS } = require('../constants');
 */

const { ROLES, PANELS, DEFAULT_ROLE, DEFAULT_PANEL } = require('./roles');
const {
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  PAID_PLANS,
  PLAN_DURATION_DAYS,
  HTTP_STATUS,
  ERROR_CODES,
} = require('./status');
const { MODULES, ALL_MODULES } = require('./modules');

module.exports = {
  ROLES,
  PANELS,
  DEFAULT_ROLE,
  DEFAULT_PANEL,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  PAID_PLANS,
  PLAN_DURATION_DAYS,
  HTTP_STATUS,
  ERROR_CODES,
  MODULES,
  ALL_MODULES,
};
