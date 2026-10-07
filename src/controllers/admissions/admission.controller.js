/**
 * Admission controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const admissionService = require('../../services/admissions/admission.service');

const listEnquiries = asyncHandler(async (req, res) => {
  const enquiries = await admissionService.listEnquiries(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Enquiries loaded successfully.', { enquiries });
});

const getEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await admissionService.getEnquiry(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Enquiry loaded successfully.', { enquiry });
});

const createEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await admissionService.createEnquiry(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Enquiry created successfully.', { enquiry });
});

const updateEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await admissionService.updateEnquiry(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Enquiry updated successfully.', { enquiry });
});

const deleteEnquiry = asyncHandler(async (req, res) => {
  await admissionService.deleteEnquiry(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Enquiry deleted successfully.', { deleted: true });
});

module.exports = { listEnquiries, getEnquiry, createEnquiry, updateEnquiry, deleteEnquiry };
