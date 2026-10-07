/**
 * Complaints & Tickets service.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serializeTicket(ticket) {
  if (!ticket) return null;
  return {
    id: ticket.id,
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    raisedBy: ticket.raisedBy,
    assignedTo: ticket.assignedTo || 'Unassigned',
    due: ticket.due || 'N/A',
    description: ticket.description || '',
    branchId: ticket.branchId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

async function listTickets(schoolId, { branchId, q, category, priority, status } = {}) {
  const where = { schoolId };

  if (branchId) {
    where.branchId = branchId;
  }

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { category: { contains: query, mode: 'insensitive' } },
      { raisedBy: { contains: query, mode: 'insensitive' } },
      { assignedTo: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (category) where.category = category;
  if (priority) where.priority = priority;
  if (status) where.status = status;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return tickets.map(serializeTicket);
}

async function getTicket(schoolId, ticketId) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, schoolId },
  });

  if (!ticket) {
    throw notFound('Ticket not found.');
  }

  return serializeTicket(ticket);
}

async function createTicket(schoolId, input, raisedByName) {
  const title = trimmed(input.title);
  const category = trimmed(input.category) || 'General';
  const priority = trimmed(input.priority) || 'Medium';
  const status = trimmed(input.status) || 'Open';
  const raisedBy = trimmed(input.raisedBy) || raisedByName || 'Staff';
  const assignedTo = trimmed(input.assignedTo) || 'Unassigned';
  const due = trimmed(input.due) || null;
  const description = trimmed(input.description) || null;
  const branchId = input.branchId || null;

  if (!title) throw badRequest('Ticket title is required.');

  const ticket = await prisma.ticket.create({
    data: {
      schoolId,
      branchId,
      title,
      category,
      priority,
      status,
      raisedBy,
      assignedTo,
      due,
      description,
    },
  });

  logger.info(`Created ticket "${ticket.title}" (${ticket.id}) for school ${schoolId}.`);
  return serializeTicket(ticket);
}

async function updateTicket(schoolId, ticketId, input) {
  const existing = await prisma.ticket.findFirst({
    where: { id: ticketId, schoolId },
  });

  if (!existing) {
    throw notFound('Ticket not found.');
  }

  const data = {};
  if (input.title !== undefined) data.title = trimmed(input.title);
  if (input.category !== undefined) data.category = trimmed(input.category);
  if (input.priority !== undefined) data.priority = trimmed(input.priority);
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.raisedBy !== undefined) data.raisedBy = trimmed(input.raisedBy);
  if (input.assignedTo !== undefined) data.assignedTo = trimmed(input.assignedTo);
  if (input.due !== undefined) data.due = trimmed(input.due);
  if (input.description !== undefined) data.description = trimmed(input.description);

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data,
  });

  logger.info(`Updated ticket "${updated.id}".`);
  return serializeTicket(updated);
}

async function deleteTicket(schoolId, ticketId) {
  const existing = await prisma.ticket.findFirst({
    where: { id: ticketId, schoolId },
  });

  if (!existing) {
    throw notFound('Ticket not found.');
  }

  await prisma.ticket.delete({ where: { id: ticketId } });
  logger.info(`Deleted ticket "${ticketId}".`);
}

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  serializeTicket,
};
