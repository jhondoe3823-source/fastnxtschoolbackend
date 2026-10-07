/**
 * Job letter service — manage employment & appointment letters.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serializeJobLetter(letter) {
  if (!letter) return null;
  return {
    id: letter.id,
    employeeId: letter.employeeId || null,
    employee: letter.employee,
    designation: letter.designation,
    department: letter.department,
    date: letter.date,
    status: letter.status || 'Generated',
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  };
}

async function listJobLetters(schoolId, { q, status } = {}) {
  const where = { schoolId };

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { employee: { contains: query, mode: 'insensitive' } },
      { designation: { contains: query, mode: 'insensitive' } },
      { department: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (status) where.status = status;

  const letters = await prisma.jobLetter.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return letters.map(serializeJobLetter);
}

async function getJobLetter(schoolId, id) {
  const letter = await prisma.jobLetter.findFirst({
    where: { id, schoolId },
  });

  if (!letter) {
    throw notFound('Job letter not found.');
  }

  return serializeJobLetter(letter);
}

async function createJobLetter(schoolId, input) {
  const employee = trimmed(input.employee);
  if (!employee) throw badRequest('Employee name is required to generate a job letter.');

  const designation = trimmed(input.designation) || 'Staff';
  const department = trimmed(input.department) || 'General';
  const date = trimmed(input.date) || new Date().toISOString().slice(0, 10);
  const status = trimmed(input.status) || 'Generated';

  const letter = await prisma.jobLetter.create({
    data: {
      schoolId,
      employeeId: input.employeeId || null,
      employee,
      designation,
      department,
      date,
      status,
    },
  });

  logger.info(`Generated job letter "${letter.id}" for employee "${letter.employee}".`);
  return serializeJobLetter(letter);
}

async function updateJobLetterStatus(schoolId, id, status) {
  const existing = await prisma.jobLetter.findFirst({
    where: { id, schoolId },
  });

  if (!existing) {
    throw notFound('Job letter not found.');
  }

  const updated = await prisma.jobLetter.update({
    where: { id },
    data: { status },
  });

  logger.info(`Updated job letter "${id}" status to ${status}.`);
  return serializeJobLetter(updated);
}

async function deleteJobLetter(schoolId, id) {
  const existing = await prisma.jobLetter.findFirst({
    where: { id, schoolId },
  });

  if (!existing) {
    throw notFound('Job letter not found.');
  }

  await prisma.jobLetter.delete({ where: { id } });
  logger.info(`Deleted job letter "${id}".`);
}

module.exports = {
  listJobLetters,
  getJobLetter,
  createJobLetter,
  updateJobLetterStatus,
  deleteJobLetter,
  serializeJobLetter,
};
