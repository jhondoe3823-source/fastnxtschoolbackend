/**
 * Job letter controller — HTTP handlers for employment job letters.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const jobLetterService = require('../../services/job-letters/job-letter.service');

const listJobLetters = asyncHandler(async (req, res) => {
  const jobLetters = await jobLetterService.listJobLetters(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Job letters loaded successfully.', { jobLetters });
});

const getJobLetter = asyncHandler(async (req, res) => {
  const jobLetter = await jobLetterService.getJobLetter(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Job letter loaded successfully.', { jobLetter });
});

const createJobLetter = asyncHandler(async (req, res) => {
  const jobLetter = await jobLetterService.createJobLetter(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Job letter created successfully.', { jobLetter });
});

const updateJobLetterStatus = asyncHandler(async (req, res) => {
  const jobLetter = await jobLetterService.updateJobLetterStatus(req.auth.schoolId, req.params.id, req.body.status);
  return ApiResponse.ok(res, 'Job letter status updated successfully.', { jobLetter });
});

const deleteJobLetter = asyncHandler(async (req, res) => {
  await jobLetterService.deleteJobLetter(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Job letter deleted successfully.', { deleted: true });
});

module.exports = {
  listJobLetters,
  getJobLetter,
  createJobLetter,
  updateJobLetterStatus,
  deleteJobLetter,
};
