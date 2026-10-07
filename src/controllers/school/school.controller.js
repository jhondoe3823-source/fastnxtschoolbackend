/**
 * School controller — thin HTTP layer over the school service.
 *
 * Every handler reads the school from the session (`req.auth.schoolId` set by
 * `requireAuth`), never from the URL or the body, so an admin can only ever read
 * and write the institution they are signed in to.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const schoolService = require('../../services/school/school.service');

/** GET /api/school/profile — the school that owns the current session. */
const getProfile = asyncHandler(async (req, res) => {
  const school = await schoolService.getProfile(req.auth.schoolId);
  return ApiResponse.ok(res, 'School profile loaded.', { school });
});

/** PATCH /api/school/profile — partial update; returns the fresh profile. */
const updateProfile = asyncHandler(async (req, res) => {
  const school = await schoolService.updateProfile(req.auth.schoolId, req.body || {});
  return ApiResponse.ok(res, 'Institute profile updated successfully.', { school });
});

module.exports = { getProfile, updateProfile };
