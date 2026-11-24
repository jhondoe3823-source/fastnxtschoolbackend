

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function buildMeta({ page, pageSize }, total) {
  const safeTotal = Number(total) || 0;
  return {
    page,
    pageSize,
    total: safeTotal,
    totalPages: Math.max(1, Math.ceil(safeTotal / pageSize)),
    hasNext: page * pageSize < safeTotal,
    hasPrev: page > 1,
  };
}

module.exports = { parsePagination, buildMeta, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
