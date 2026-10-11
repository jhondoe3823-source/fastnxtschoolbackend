/**
 * Mail usage API — available for later quotas/billing.
 * Do not wire into the frontend yet.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const mailUsageService = require('../../services/email/mail-usage.service');

/** GET /api/mail/usage — emails sent by the signed-in school. */
const usage = asyncHandler(async (req, res) => {
  const usageData = await mailUsageService.getSchoolMailUsage(req.auth.schoolId);
  return ApiResponse.ok(res, 'School mail usage loaded.', { usage: usageData });
});

module.exports = { usage };
