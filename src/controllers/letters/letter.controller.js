const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const letterTemplateService = require('../../services/letters/letter-template.service');
const emailService = require('../../services/email/email.service');
const { prisma } = require('../../config/database');
const { badRequest } = require('../../utils/errors');

const getAdmissionTemplate = asyncHandler(async (req, res) => {
  const data = await letterTemplateService.getAdmissionTemplate(req.auth.schoolId);
  return ApiResponse.ok(res, 'Admission letter template loaded.', data);
});

const updateAdmissionTemplate = asyncHandler(async (req, res) => {
  const data = await letterTemplateService.updateAdmissionTemplate(req.auth.schoolId, req.body || {});
  return ApiResponse.ok(res, 'Admission letter template saved.', data);
});

const getJobTemplate = asyncHandler(async (req, res) => {
  const data = await letterTemplateService.getJobTemplate(req.auth.schoolId);
  return ApiResponse.ok(res, 'Job letter template loaded.', data);
});

const updateJobTemplate = asyncHandler(async (req, res) => {
  const data = await letterTemplateService.updateJobTemplate(req.auth.schoolId, req.body || {});
  return ApiResponse.ok(res, 'Job letter template saved.', data);
});

/**
 * POST /api/letters/send-email
 * Body: { to, subject?, title, messageHtml, template? }
 * School-branded email via Resend.
 */
const sendLetterEmail = asyncHandler(async (req, res) => {
  const to = String(req.body?.to || '').trim().toLowerCase();
  const title = String(req.body?.title || req.body?.subject || '').trim();
  const messageHtml = String(req.body?.messageHtml || req.body?.html || '').trim();
  if (!to || !to.includes('@')) throw badRequest('A valid recipient email (to) is required.');
  if (!title) throw badRequest('Email title is required.');
  if (!messageHtml) throw badRequest('Email body is required.');

  const school = await prisma.school.findUnique({ where: { id: req.auth.schoolId } });
  if (!school) throw badRequest('School not found.');

  const result = await emailService.sendSchoolEmail({
    to,
    school,
    title,
    messageHtml,
    cta: req.body?.ctaHref
      ? { label: req.body?.ctaLabel || 'Open portal', href: req.body.ctaHref }
      : null,
    userId: req.auth.userId,
    template: String(req.body?.template || 'letter_email'),
  });

  return ApiResponse.ok(res, result.delivered ? 'Email sent successfully.' : 'Email was not delivered.', {
    delivered: result.delivered,
    reason: result.reason || null,
    id: result.id || null,
  });
});

module.exports = {
  getAdmissionTemplate,
  updateAdmissionTemplate,
  getJobTemplate,
  updateJobTemplate,
  sendLetterEmail,
};
