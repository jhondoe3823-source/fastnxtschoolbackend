/**
 * Per-school admission application form config.
 * Default is the standard StudentForm; "apl-legal-it" matches A+ INSTITUTE IT & LAW paper form.
 */

const { prisma } = require('../../config/database');
const { notFound } = require('../../utils/errors');

const APL_PROGRAMS = [
  'LLB',
  'IT / E-Commerce',
  '9th Class',
  '10th Class',
  'Computer / OMC',
  'Graphic / Web',
  'Digital Marketing',
  'Other',
];

const APL_DOCUMENTS = [
  'CNIC / B-Form Copy',
  'Matric Result Card',
  'Intermediate Result Card',
  'LAT Result (LLB)',
  'Passport Size Photos',
  'Other',
];

const DEFAULT_CONFIG = {
  variant: 'standard',
  instituteTitle: '',
  formTitle: 'ADMISSION FORM',
  programs: [],
  documentChecklist: [],
  showQualificationTable: false,
  showFeeDetails: false,
  requireLatForLlb: false,
};

const APL_CONFIG = {
  variant: 'apl-legal-it',
  instituteTitle: 'A+ INSTITUTE IT & LAW',
  formTitle: 'ADMISSION FORM',
  programs: APL_PROGRAMS,
  documentChecklist: APL_DOCUMENTS,
  showQualificationTable: true,
  showFeeDetails: true,
  requireLatForLlb: true,
};

function looksLikeAplInstitute(school) {
  const name = String(school?.name || '').toUpperCase();
  const shortName = String(school?.shortName || '').toUpperCase();
  const hay = `${name} ${shortName}`;
  const compact = hay.replace(/[^A-Z0-9]/g, '');
  // "A Plus Institute", "A+ Institute", and the existing IT & Law name.
  if (compact.includes('APLUSINSTITUT')) return true;
  if (hay.includes('A+') && hay.includes('INSTITUT')) return true;
  if (hay.includes('IT & LAW') || hay.includes('IT AND LAW')) return true;
  if (hay.includes('APL-LEGAL') || hay.includes('APL LEGAL')) return true;
  return false;
}

function normalizeConfig(raw, school) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  let variant = String(src.variant || '').trim() || null;

  if (!variant) {
    variant = looksLikeAplInstitute(school) ? 'apl-legal-it' : 'standard';
  }

  if (variant === 'apl-legal-it') {
    return {
      ...APL_CONFIG,
      ...src,
      variant: 'apl-legal-it',
      instituteTitle: String(src.instituteTitle || school?.name || APL_CONFIG.instituteTitle).trim() || APL_CONFIG.instituteTitle,
      formTitle: String(src.formTitle || APL_CONFIG.formTitle).trim() || APL_CONFIG.formTitle,
      programs: Array.isArray(src.programs) && src.programs.length ? src.programs.map(String) : APL_PROGRAMS,
      documentChecklist:
        Array.isArray(src.documentChecklist) && src.documentChecklist.length
          ? src.documentChecklist.map(String)
          : APL_DOCUMENTS,
      showQualificationTable: src.showQualificationTable !== false,
      showFeeDetails: src.showFeeDetails !== false,
      requireLatForLlb: src.requireLatForLlb !== false,
    };
  }

  return {
    ...DEFAULT_CONFIG,
    ...src,
    variant: 'standard',
    instituteTitle: String(src.instituteTitle || school?.name || '').trim(),
    formTitle: String(src.formTitle || DEFAULT_CONFIG.formTitle).trim() || DEFAULT_CONFIG.formTitle,
    programs: Array.isArray(src.programs) ? src.programs.map(String) : [],
    documentChecklist: Array.isArray(src.documentChecklist) ? src.documentChecklist.map(String) : [],
    showQualificationTable: Boolean(src.showQualificationTable),
    showFeeDetails: Boolean(src.showFeeDetails),
    requireLatForLlb: Boolean(src.requireLatForLlb),
  };
}

function schoolInfo(school) {
  return {
    id: school.id,
    name: school.name,
    shortName: school.shortName || null,
    address: school.address || null,
    phone: school.phone,
    email: school.email,
    website: school.website || null,
    principal: school.principal || null,
    logoUrl: school.logoUrl || null,
    academicSession: school.academicSession || null,
  };
}

async function getSchoolOrThrow(schoolId) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw notFound('School not found.');
  return school;
}

async function getAdmissionFormConfig(schoolId) {
  const school = await getSchoolOrThrow(schoolId);
  return {
    config: normalizeConfig(school.admissionFormConfig, school),
    school: schoolInfo(school),
  };
}

async function updateAdmissionFormConfig(schoolId, patch) {
  const school = await getSchoolOrThrow(schoolId);
  const current = normalizeConfig(school.admissionFormConfig, school);
  const next = normalizeConfig({ ...current, ...(patch || {}) }, school);
  const updated = await prisma.school.update({
    where: { id: schoolId },
    data: { admissionFormConfig: next },
  });
  return {
    config: normalizeConfig(updated.admissionFormConfig, updated),
    school: schoolInfo(updated),
  };
}

module.exports = {
  DEFAULT_CONFIG,
  APL_CONFIG,
  APL_PROGRAMS,
  APL_DOCUMENTS,
  looksLikeAplInstitute,
  normalizeConfig,
  getAdmissionFormConfig,
  updateAdmissionFormConfig,
};
