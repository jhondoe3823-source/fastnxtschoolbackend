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
const admissionFormConfigService = require('../../services/admissions/admission-form-config.service');
const cloudinaryService = require('../../services/cloudinary/cloudinary.service');
const { badRequest } = require('../../utils/errors');

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

/** POST /api/school/logo — upload logo to Cloudinary and save URL on the school. */
const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No logo file uploaded. Use form field "file".');

  const uploaded = await cloudinaryService.uploadBuffer(req.file.buffer, {
    folder: `fastnxt/schools/${req.auth.schoolId}/logo`,
    publicId: 'logo',
    overwrite: true,
    resourceType: 'image',
    tags: [`school:${req.auth.schoolId}`, 'logo'],
    schoolId: req.auth.schoolId,
    uploadedById: req.auth.userId || null,
    originalName: req.file.originalname,
    purpose: 'logo',
  });

  const school = await schoolService.updateProfile(req.auth.schoolId, {
    logoUrl: uploaded.url,
  });

  return ApiResponse.ok(res, 'School logo uploaded successfully.', {
    school,
    upload: uploaded,
  });
});

/** GET /api/school/admission-form-config — standard vs institute-specific admission form. */
const getAdmissionFormConfig = asyncHandler(async (req, res) => {
  const result = await admissionFormConfigService.getAdmissionFormConfig(req.auth.schoolId);
  return ApiResponse.ok(res, 'Admission form config loaded.', result);
});

/** PATCH /api/school/admission-form-config — set variant / labels for this school only. */
const updateAdmissionFormConfig = asyncHandler(async (req, res) => {
  const result = await admissionFormConfigService.updateAdmissionFormConfig(
    req.auth.schoolId,
    req.body || {},
  );
  return ApiResponse.ok(res, 'Admission form config updated.', result);
});

module.exports = {
  getProfile,
  updateProfile,
  uploadLogo,
  getAdmissionFormConfig,
  updateAdmissionFormConfig,
};
