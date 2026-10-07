/**
 * Admission Enquiry service
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serialize(r) {
  return {
    id: r.id,
    applicant: r.applicant,
    guardian: r.guardian || '',
    phone: r.phone || '',
    cls: r.cls || '',
    source: r.source || '',
    followUp: r.followUp || '',
    counselor: r.counselor || '',
    stage: r.stage || 'Enquiry',
    branchId: r.branchId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listEnquiries(schoolId, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.admissionEnquiry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getEnquiry(schoolId, id) {
  const row = await prisma.admissionEnquiry.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Enquiry not found.');
  return serialize(row);
}

async function createEnquiry(schoolId, input) {
  const applicant = trimmed(input.applicant);
  if (!applicant) throw badRequest('Applicant name is required.');

  const row = await prisma.admissionEnquiry.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      applicant,
      guardian: trimmed(input.guardian) || null,
      phone: trimmed(input.phone) || null,
      cls: trimmed(input.cls) || null,
      source: trimmed(input.source) || null,
      followUp: trimmed(input.followUp) || null,
      counselor: trimmed(input.counselor) || null,
      stage: trimmed(input.stage) || 'Enquiry',
    },
  });
  return serialize(row);
}

async function updateEnquiry(schoolId, id, input) {
  const existing = await prisma.admissionEnquiry.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Enquiry not found.');

  const data = {};
  if (input.applicant !== undefined) data.applicant = trimmed(input.applicant);
  if (input.guardian !== undefined) data.guardian = trimmed(input.guardian) || null;
  if (input.phone !== undefined) data.phone = trimmed(input.phone) || null;
  if (input.cls !== undefined) data.cls = trimmed(input.cls) || null;
  if (input.source !== undefined) data.source = trimmed(input.source) || null;
  if (input.followUp !== undefined) data.followUp = trimmed(input.followUp) || null;
  if (input.counselor !== undefined) data.counselor = trimmed(input.counselor) || null;
  if (input.stage !== undefined) data.stage = trimmed(input.stage) || 'Enquiry';
  if (input.branchId !== undefined) data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const updated = await prisma.admissionEnquiry.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteEnquiry(schoolId, id) {
  const existing = await prisma.admissionEnquiry.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Enquiry not found.');
  await prisma.admissionEnquiry.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listEnquiries, getEnquiry, createEnquiry, updateEnquiry, deleteEnquiry };
