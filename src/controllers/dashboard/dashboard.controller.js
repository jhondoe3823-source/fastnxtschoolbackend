const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const dashboardService = require('../../services/dashboard/dashboard.service');

const getOverview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverview(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Dashboard loaded successfully.', data);
});

module.exports = { getOverview };
