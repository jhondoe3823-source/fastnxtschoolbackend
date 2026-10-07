/**
 * Student service — manage student registrations, admissions, promotions and ID cards.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const bcrypt = require('bcryptjs');

const trimmed = (val) => String(val ?? '').trim();

function serializeStudent(s) {
  if (!s) return null;
  return {
    id: s.id,
    studentId: s.studentId,
    name: s.name,
    gender: s.gender || 'Male',
    dob: s.dob || '',
    blood: s.blood || '',
    photo: s.photo || '',
    admissionNo: s.admissionNo || '',
    admissionDate: s.admissionDate || (s.createdAt ? s.createdAt.toISOString().slice(0, 10) : ''),
    session: s.session || '2025-2026',
    cls: s.cls,
    classId: s.classId || null,
    section: s.section || 'A',
    father: s.father || '',
    mother: s.mother || '',
    guardian: s.guardian || s.father || '',
    phone: s.phone || '',
    contact: s.phone || '',
    email: s.email || '',
    address: s.address || '',
    prevSchool: s.prevSchool || '',
    medical: s.medical || '',
    notes: s.notes || '',
    status: s.status || 'Active',
    branchId: s.branchId || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function serializeAdmissionLetter(a) {
  if (!a) return null;
  return {
    id: a.id,
    studentId: a.studentId || null,
    student: a.student,
    admissionNo: a.admissionNo,
    cls: a.cls,
    section: a.section,
    date: a.date,
    status: a.status || 'Generated',
    branchId: a.branchId || null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function syncClassStudentCounts(schoolId) {
  try {
    const classes = await prisma.class.findMany({ where: { schoolId } });
    for (const c of classes) {
      const count = await prisma.student.count({
        where: { schoolId, cls: c.name, status: 'Active' },
      });
      if (c.students !== count) {
        await prisma.class.update({
          where: { id: c.id },
          data: { students: count },
        });
      }
    }
  } catch (err) {
    logger.warn('Failed to sync class student counts', { err });
  }
}

async function ensureFamilyExists(schoolId, branchId, guardianName, phone, email, address) {
  const guardian = trimmed(guardianName);
  if (!guardian) return;
  try {
    const existing = await prisma.family.findFirst({
      where: {
        schoolId,
        guardian: { equals: guardian, mode: 'insensitive' },
      },
    });

    if (!existing) {
      const count = await prisma.family.count({ where: { schoolId } });
      const familyCode = `FAM-${String(count + 1).padStart(3, '0')}`;
      await prisma.family.create({
        data: {
          schoolId,
          branchId: branchId || null,
          familyCode,
          guardian,
          phone: trimmed(phone) || null,
          email: trimmed(email) || null,
          address: trimmed(address) || null,
          status: 'Active',
        },
      });
      logger.info(`Auto-created Family record for Guardian "${guardian}".`);
    } else {
      const updateData = {};
      if (!existing.phone && phone) updateData.phone = trimmed(phone);
      if (!existing.email && email) updateData.email = trimmed(email);
      if (!existing.address && address) updateData.address = trimmed(address);
      if (Object.keys(updateData).length > 0) {
        await prisma.family.update({ where: { id: existing.id }, data: updateData });
      }
    }
  } catch (err) {
    logger.warn(`Failed to auto-create family for guardian: ${err.message}`);
  }
}

async function listStudents(schoolId, { q, cls, section, status, gender, session, branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (cls && cls !== 'All') where.cls = cls;
  if (section && section !== 'All') where.section = section;
  if (status && status !== 'All') where.status = status;
  if (gender && gender !== 'All') where.gender = gender;
  if (session && session !== 'All') where.session = session;

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { studentId: { contains: query, mode: 'insensitive' } },
      { admissionNo: { contains: query, mode: 'insensitive' } },
      { guardian: { contains: query, mode: 'insensitive' } },
      { father: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return students.map(serializeStudent);
}

async function getStudent(schoolId, id) {
  const student = await prisma.student.findFirst({
    where: {
      schoolId,
      OR: [{ id }, { studentId: id }],
    },
  });
  if (!student) throw notFound('Student not found.');
  return serializeStudent(student);
}

async function createStudent(schoolId, input) {
  const name = trimmed(input.name || `${input.first || ''} ${input.last || ''}`.trim());
  if (!name) throw badRequest('Student name is required.');

  const cls = trimmed(input.cls);
  if (!cls) throw badRequest('Class is required.');

  const count = await prisma.student.count({ where: { schoolId } });
  const studentId = trimmed(input.studentId) || `STD-${1000 + count + 1}`;
  const admissionNo = trimmed(input.admissionNo) || `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  const admissionDate = trimmed(input.admissionDate) || new Date().toISOString().slice(0, 10);
  const branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const student = await prisma.student.create({
    data: {
      schoolId,
      branchId,
      studentId,
      admissionNo,
      admissionDate,
      name,
      gender: trimmed(input.gender) || 'Male',
      dob: trimmed(input.dob) || null,
      blood: trimmed(input.blood) || null,
      photo: trimmed(input.photo) || null,
      session: trimmed(input.session) || '2025-2026',
      cls,
      classId: input.classId || null,
      section: trimmed(input.section) || 'A',
      father: trimmed(input.father) || null,
      mother: trimmed(input.mother) || null,
      guardian: trimmed(input.guardian || input.father) || null,
      phone: trimmed(input.phone || input.contact) || null,
      email: trimmed(input.email) || null,
      address: trimmed(input.address) || null,
      prevSchool: trimmed(input.prevSchool) || null,
      medical: trimmed(input.medical) || null,
      notes: trimmed(input.notes) || null,
      status: trimmed(input.status) || 'Active',
    },
  });

  // Auto sync Family record for the guardian
  if (student.guardian) {
    ensureFamilyExists(
      schoolId,
      student.branchId,
      student.guardian,
      student.phone,
      student.email,
      student.address
    );
  }

  // Automatically update class students count
  await syncClassStudentCounts(schoolId);

  // Auto create User account for login if student has an email
  if (student.email) {
    try {
      const email = student.email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        const passwordHash = await bcrypt.hash(input.password || 'Password123', 10);
        await prisma.user.create({
          data: {
            schoolId,
            branchId: student.branchId || null,
            name: student.name,
            email,
            passwordHash,
            role: 'Student',
            panel: 'student',
            isActive: true,
            emailVerified: true,
          },
        });
        logger.info(`Auto-created User account for Student "${email}".`);
      }
    } catch (err) {
      logger.warn(`Failed to auto-create user account for student: ${err.message}`);
    }
  }

  return serializeStudent(student);
}

async function updateStudent(schoolId, id, input) {
  const existing = await prisma.student.findFirst({
    where: {
      schoolId,
      OR: [{ id }, { studentId: id }],
    },
  });
  if (!existing) throw notFound('Student not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.first !== undefined || input.last !== undefined) {
    const f = input.first !== undefined ? input.first : '';
    const l = input.last !== undefined ? input.last : '';
    const combined = `${f} ${l}`.trim();
    if (combined) data.name = combined;
  }
  if (input.studentId !== undefined) data.studentId = trimmed(input.studentId);
  if (input.admissionNo !== undefined) data.admissionNo = trimmed(input.admissionNo);
  if (input.admissionDate !== undefined) data.admissionDate = trimmed(input.admissionDate);
  if (input.gender !== undefined) data.gender = trimmed(input.gender);
  if (input.dob !== undefined) data.dob = trimmed(input.dob);
  if (input.blood !== undefined) data.blood = trimmed(input.blood);
  if (input.photo !== undefined) data.photo = trimmed(input.photo);
  if (input.session !== undefined) data.session = trimmed(input.session);
  if (input.cls !== undefined) data.cls = trimmed(input.cls);
  if (input.classId !== undefined) data.classId = input.classId || null;
  if (input.section !== undefined) data.section = trimmed(input.section);
  if (input.father !== undefined) data.father = trimmed(input.father);
  if (input.mother !== undefined) data.mother = trimmed(input.mother);
  if (input.guardian !== undefined) data.guardian = trimmed(input.guardian);
  if (input.phone !== undefined || input.contact !== undefined) {
    data.phone = trimmed(input.phone || input.contact);
  }
  if (input.email !== undefined) data.email = trimmed(input.email);
  if (input.address !== undefined) data.address = trimmed(input.address);
  if (input.prevSchool !== undefined) data.prevSchool = trimmed(input.prevSchool);
  if (input.medical !== undefined) data.medical = trimmed(input.medical);
  if (input.notes !== undefined) data.notes = trimmed(input.notes);
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  const updated = await prisma.student.update({
    where: { id: existing.id },
    data,
  });

  // If class or status changed, sync class counts
  if (data.cls || data.status) {
    await syncClassStudentCounts(schoolId);
  }

  // Auto-sync Family record if guardian was set/changed
  const guardianName = updated.guardian || updated.father;
  if (guardianName) {
    ensureFamilyExists(
      schoolId,
      updated.branchId,
      guardianName,
      updated.phone,
      updated.email,
      updated.address
    );
  }

  return serializeStudent(updated);
}

async function deleteStudent(schoolId, id) {
  const existing = await prisma.student.findFirst({
    where: {
      schoolId,
      OR: [{ id }, { studentId: id }],
    },
  });
  if (!existing) throw notFound('Student not found.');

  // Delete associated admission letters
  await prisma.admissionLetter.deleteMany({
    where: { schoolId, student: existing.name },
  });

  await prisma.student.delete({ where: { id: existing.id } });
  await syncClassStudentCounts(schoolId);

  return { id: existing.id, deleted: true };
}

/**
 * Batch promote students to new session, class, and section
 */
async function promoteStudents(schoolId, { studentIds, newSession, newClass, newSection }) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw badRequest('Please select at least one student to promote.');
  }
  if (!newClass) throw badRequest('Destination class is required.');
  if (!newSection) throw badRequest('Destination section is required.');

  const result = await prisma.student.updateMany({
    where: {
      schoolId,
      OR: [
        { id: { in: studentIds } },
        { studentId: { in: studentIds } },
      ],
    },
    data: {
      cls: newClass,
      section: newSection,
      session: newSession || '2025-2026',
    },
  });

  await syncClassStudentCounts(schoolId);

  return { count: result.count, promoted: true };
}

// ================= ADMISSION LETTERS =================

async function listAdmissionLetters(schoolId, { q, status, branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status && status !== 'All') where.status = status;

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { student: { contains: query, mode: 'insensitive' } },
      { admissionNo: { contains: query, mode: 'insensitive' } },
      { cls: { contains: query, mode: 'insensitive' } },
    ];
  }

  const letters = await prisma.admissionLetter.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return letters.map(serializeAdmissionLetter);
}

async function generateAdmissionLetter(schoolId, input) {
  const student = trimmed(input.student);
  if (!student) throw badRequest('Student is required.');

  const cls = trimmed(input.cls) || 'Grade 1';
  const section = trimmed(input.section) || 'A';
  const admissionNo = trimmed(input.admissionNo) || `ADM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const date = trimmed(input.date) || new Date().toISOString().slice(0, 10);
  const branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const letter = await prisma.admissionLetter.create({
    data: {
      schoolId,
      branchId,
      studentId: input.studentId || null,
      student,
      admissionNo,
      cls,
      section,
      date,
      status: 'Generated',
    },
  });

  return serializeAdmissionLetter(letter);
}

async function updateAdmissionLetterStatus(schoolId, id, status) {
  const existing = await prisma.admissionLetter.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Admission letter not found.');

  const updated = await prisma.admissionLetter.update({
    where: { id },
    data: { status: trimmed(status) || 'Printed' },
  });

  return serializeAdmissionLetter(updated);
}

async function deleteAdmissionLetter(schoolId, id) {
  const existing = await prisma.admissionLetter.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Admission letter not found.');

  await prisma.admissionLetter.delete({ where: { id } });
  return { id, deleted: true };
}

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  promoteStudents,
  listAdmissionLetters,
  generateAdmissionLetter,
  updateAdmissionLetterStatus,
  deleteAdmissionLetter,
};
