/**
 * School service — the institution profile behind
 * Admin Panel → Settings → Institute Profile.
 *
 * The profile is the same `School` row that registration creates, so the data
 * captured at signup ("Green Valley School", owner, phone, city …) is already
 * there the first time the page is opened; this module only adds the optional
 * half (short name, address, website, motto, principal, session, …).
 *
 * `serializeSchool` is the single source of truth for the school JSON: the auth
 * service uses it too, so `/api/auth/me`, login, register and
 * `/api/school/profile` are guaranteed to agree on the shape.
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { conflict, notFound } = require('../../utils/errors');
const { ERROR_CODES } = require('../../constants');

/** Columns the client is allowed to see. Nothing else on the row leaks out. */
const SCHOOL_FIELDS = [
  'id',
  'name',
  'shortName',
  'ownerName',
  'email',
  'phone',
  'country',
  'city',
  'address',
  'website',
  'motto',
  'principal',
  'academicSession',
  'instituteNo',
  'logoUrl',
  'createdAt',
  'updatedAt',
];

/**
 * Fields the profile form owns, and whether they may be cleared.
 * `required: true` maps to a NOT NULL column — an empty value is a validation
 * error there, never a `null` write.
 */
const WRITABLE_FIELDS = {
  name: { required: true, maxLength: 120 },
  shortName: { maxLength: 60 },
  ownerName: { required: true, maxLength: 120 },
  email: { required: true, maxLength: 160 },
  phone: { required: true, maxLength: 40 },
  country: { required: true, maxLength: 80 },
  city: { required: true, maxLength: 80 },
  address: { maxLength: 300 },
  website: { maxLength: 200 },
  motto: { maxLength: 160 },
  principal: { maxLength: 120 },
  academicSession: { maxLength: 40 },
  instituteNo: { maxLength: 60 },
  // Data-URL logos (PNG/JPEG base64) need a generous limit; plain http(s) URLs are short.
  logoUrl: { maxLength: 2_500_000 },
};

const trimmed = (value) => String(value ?? '').trim();
const normalizeEmail = (email) => trimmed(email).toLowerCase();

/** The canonical school payload. Never carries anything not in SCHOOL_FIELDS. */
function serializeSchool(school) {
  if (!school) return null;

  const payload = { id: school.id };

  for (const field of SCHOOL_FIELDS) {
    if (field === 'id') continue;
    const value = school[field];
    // Optional columns stay `null` when unset so the UI can tell "not filled in"
    // apart from "filled in and then cleared".
    payload[field] = value === undefined ? null : value;
  }

  return payload;
}

/** Load one school, or throw the 404 the profile page can render. */
async function getProfile(schoolId) {
  if (!schoolId) throw notFound('No school is linked to this session.');

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw notFound('This school no longer exists.');

  return serializeSchool(school);
}

/**
 * Apply a partial update (PATCH semantics).
 *
 * Only the keys actually present in `input` are touched, so a form that submits
 * three fields cannot blank the other eight. An empty string clears an optional
 * field (`null`) — that is how the admin removes a value they no longer want.
 */
async function updateProfile(schoolId, input) {
  if (!schoolId) throw notFound('No school is linked to this session.');

  const existing = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!existing) throw notFound('This school no longer exists.');

  const data = {};

  for (const [field, rules] of Object.entries(WRITABLE_FIELDS)) {
    if (input[field] === undefined) continue;

    const value = field === 'email' ? normalizeEmail(input[field]) : trimmed(input[field]);
    data[field] = value === '' && !rules.required ? null : value;
  }

  if (Object.keys(data).length === 0) {
    return serializeSchool(existing);
  }

  // `schools.email` is unique. Reusing the email of another school would break
  // that constraint, so answer with the same code the register form already
  // understands instead of letting Prisma raise P2002.
  if (data.email && data.email !== existing.email) {
    const taken = await prisma.school.findUnique({ where: { email: data.email } });
    if (taken && taken.id !== schoolId) {
      throw conflict(
        'Another school already uses this email address.',
        ERROR_CODES.EMAIL_IN_USE
      );
    }
  }

  const updated = await prisma.school.update({ where: { id: schoolId }, data });
  logger.info(`Updated the profile of school "${updated.name}" (${updated.id}).`);

  return serializeSchool(updated);
}

module.exports = {
  SCHOOL_FIELDS,
  WRITABLE_FIELDS,
  serializeSchool,
  getProfile,
  updateProfile,
};
