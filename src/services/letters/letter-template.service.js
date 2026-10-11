/**
 * Admission + job letter templates stored on School (same pattern as fee voucher).
 */

const { prisma } = require('../../config/database');
const { notFound } = require('../../utils/errors');

const DEFAULT_ADMISSION = {
  title: 'ADMISSION LETTER',
  salutation: 'Dear Parent / Guardian,',
  bodyIntro:
    'We are pleased to inform you that your child {studentName} has been granted admission to {schoolName} in {classSection}. Please find the admission details below.',
  bodyClosing:
    'Kindly report to the school office on or before the first day of the academic session to complete the remaining formalities and documentation. We look forward to welcoming your child to our school community.',
  signOff: 'Yours sincerely,',
  signerTitle: 'Principal / Administration',
  footerNote: 'This is a computer-generated document.',
  showLogo: true,
  showRef: true,
  accentColor: '#0f4c81',
};

const DEFAULT_JOB = {
  title: 'APPOINTMENT LETTER',
  salutation: 'Dear {employeeName},',
  bodyIntro:
    'We are pleased to offer you the position of {designation} in the {department} department at {schoolName}, effective from the date of joining.',
  bodyClosing:
    'Please report to the administration office with original documents. We look forward to your valuable contribution to our institution.',
  signOff: 'Yours sincerely,',
  signerTitle: 'Principal / HR Administration',
  footerNote: 'This is a computer-generated employment letter.',
  showLogo: true,
  showRef: true,
  accentColor: '#0f4c81',
};

function normalize(defaults, raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { ...defaults, ...src };
}

async function getSchoolOrThrow(schoolId) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw notFound('School not found.');
  return school;
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

async function getAdmissionTemplate(schoolId) {
  const school = await getSchoolOrThrow(schoolId);
  return {
    template: normalize(DEFAULT_ADMISSION, school.admissionLetterTemplate),
    school: schoolInfo(school),
  };
}

async function updateAdmissionTemplate(schoolId, patch) {
  const school = await getSchoolOrThrow(schoolId);
  const next = normalize(DEFAULT_ADMISSION, {
    ...normalize(DEFAULT_ADMISSION, school.admissionLetterTemplate),
    ...(patch || {}),
  });
  const updated = await prisma.school.update({
    where: { id: schoolId },
    data: { admissionLetterTemplate: next },
  });
  return {
    template: normalize(DEFAULT_ADMISSION, updated.admissionLetterTemplate),
    school: schoolInfo(updated),
  };
}

async function getJobTemplate(schoolId) {
  const school = await getSchoolOrThrow(schoolId);
  return {
    template: normalize(DEFAULT_JOB, school.jobLetterTemplate),
    school: schoolInfo(school),
  };
}

async function updateJobTemplate(schoolId, patch) {
  const school = await getSchoolOrThrow(schoolId);
  const next = normalize(DEFAULT_JOB, {
    ...normalize(DEFAULT_JOB, school.jobLetterTemplate),
    ...(patch || {}),
  });
  const updated = await prisma.school.update({
    where: { id: schoolId },
    data: { jobLetterTemplate: next },
  });
  return {
    template: normalize(DEFAULT_JOB, updated.jobLetterTemplate),
    school: schoolInfo(updated),
  };
}

module.exports = {
  DEFAULT_ADMISSION,
  DEFAULT_JOB,
  getAdmissionTemplate,
  updateAdmissionTemplate,
  getJobTemplate,
  updateJobTemplate,
};
