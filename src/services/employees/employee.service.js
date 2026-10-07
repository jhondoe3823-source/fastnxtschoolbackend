/**
 * Employee service — manage staff records, profiles, and attached documents.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const bcrypt = require('bcryptjs');

const trimmed = (val) => String(val ?? '').trim();

function serializeEmployee(emp) {
  if (!emp) return null;
  return {
    id: emp.id,
    employeeId: emp.employeeId,
    name: emp.name,
    gender: emp.gender || 'Male',
    dob: emp.dob || '',
    cnic: emp.cnic || '',
    phone: emp.phone || '',
    email: emp.email || '',
    address: emp.address || '',
    photo: emp.photo || '',
    designation: emp.designation,
    department: emp.department,
    joining: emp.joining,
    type: emp.type || 'Permanent',
    status: emp.status || 'Active',
    documents: emp.documents || [],
    branchId: emp.branchId || null,
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  };
}

async function listEmployees(schoolId, { q, dept, designation, status, branchId } = {}) {
  const where = { schoolId };

  if (branchId && branchId !== 'all') {
    where.branchId = branchId;
  }

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { employeeId: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
      { department: { contains: query, mode: 'insensitive' } },
      { designation: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (dept) where.department = dept;
  if (designation) where.designation = designation;
  if (status) where.status = status;

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return employees.map(serializeEmployee);
}

async function getEmployee(schoolId, id) {
  const emp = await prisma.employee.findFirst({
    where: {
      schoolId,
      OR: [{ id }, { employeeId: id }],
    },
  });

  if (!emp) {
    throw notFound('Employee not found.');
  }

  return serializeEmployee(emp);
}

async function createEmployee(schoolId, input) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Employee full name is required.');

  const designation = trimmed(input.designation) || 'Teacher';
  const department = trimmed(input.department) || 'Academics';
  const joining = trimmed(input.joining) || new Date().toISOString().slice(0, 10);
  const employeeId = trimmed(input.employeeId) || `EMP-${String(Date.now()).slice(-4)}`;

  const emp = await prisma.employee.create({
    data: {
      schoolId,
      branchId: input.branchId || null,
      employeeId,
      name,
      gender: trimmed(input.gender) || 'Male',
      dob: trimmed(input.dob) || null,
      cnic: trimmed(input.cnic) || null,
      phone: trimmed(input.phone) || null,
      email: trimmed(input.email) || null,
      address: trimmed(input.address) || null,
      photo: trimmed(input.photo) || null,
      designation,
      department,
      joining,
      type: trimmed(input.type) || 'Permanent',
      status: trimmed(input.status) || 'Active',
      documents: input.documents || [],
    },
  });

  logger.info(`Created employee "${emp.name}" (${emp.employeeId}) for school ${schoolId}.`);

  // Auto create User account for login if email is provided
  if (emp.email) {
    try {
      const email = emp.email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        const passwordHash = await bcrypt.hash(input.password || 'Password123', 10);
        const role = emp.designation || 'Teacher';
        const roleLower = role.toLowerCase();
        const panel = (roleLower.includes('teacher') || roleLower.includes('staff')) ? 'teacher' : 'user';
        await prisma.user.create({
          data: {
            schoolId,
            branchId: emp.branchId || null,
            name: emp.name,
            email,
            passwordHash,
            role,
            panel,
            isActive: true,
            emailVerified: true,
          },
        });
        logger.info(`Auto-created User account for Employee "${email}" (${role}).`);
      }
    } catch (err) {
      logger.warn(`Failed to auto-create user account for employee: ${err.message}`);
    }
  }

  return serializeEmployee(emp);
}

async function updateEmployee(schoolId, id, input) {
  const existing = await prisma.employee.findFirst({
    where: { schoolId, OR: [{ id }, { employeeId: id }] },
  });

  if (!existing) {
    throw notFound('Employee not found.');
  }

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.employeeId !== undefined) data.employeeId = trimmed(input.employeeId);
  if (input.gender !== undefined) data.gender = trimmed(input.gender);
  if (input.dob !== undefined) data.dob = trimmed(input.dob);
  if (input.cnic !== undefined) data.cnic = trimmed(input.cnic);
  if (input.phone !== undefined) data.phone = trimmed(input.phone);
  if (input.email !== undefined) data.email = trimmed(input.email);
  if (input.address !== undefined) data.address = trimmed(input.address);
  if (input.photo !== undefined) data.photo = trimmed(input.photo);
  if (input.designation !== undefined) data.designation = trimmed(input.designation);
  if (input.department !== undefined) data.department = trimmed(input.department);
  if (input.joining !== undefined) data.joining = trimmed(input.joining);
  if (input.type !== undefined) data.type = trimmed(input.type);
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.documents !== undefined) data.documents = input.documents;

  const updated = await prisma.employee.update({
    where: { id: existing.id },
    data,
  });

  logger.info(`Updated employee "${updated.name}" (${updated.id}).`);
  return serializeEmployee(updated);
}

async function deleteEmployee(schoolId, id) {
  const existing = await prisma.employee.findFirst({
    where: { schoolId, OR: [{ id }, { employeeId: id }] },
  });

  if (!existing) {
    throw notFound('Employee not found.');
  }

  await prisma.employee.delete({ where: { id: existing.id } });
  logger.info(`Deleted employee "${existing.name}" (${existing.id}).`);
}

/** Add a document to an employee's document collection. */
async function addEmployeeDocument(schoolId, id, document) {
  const emp = await prisma.employee.findFirst({
    where: { schoolId, OR: [{ id }, { employeeId: id }] },
  });

  if (!emp) throw notFound('Employee not found.');

  const existingDocs = Array.isArray(emp.documents) ? emp.documents : [];
  const newDoc = {
    id: `DOC-${Date.now()}`,
    name: trimmed(document.name) || 'Untitled Document',
    type: trimmed(document.type) || 'Other',
    url: trimmed(document.url) || '',
    uploadDate: new Date().toISOString().slice(0, 10),
  };

  const updatedDocs = [...existingDocs, newDoc];

  const updated = await prisma.employee.update({
    where: { id: emp.id },
    data: { documents: updatedDocs },
  });

  return serializeEmployee(updated);
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addEmployeeDocument,
  serializeEmployee,
};
