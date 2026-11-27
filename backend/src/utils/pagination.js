// Parsing page/pageSize dari query string, dengan batas atas agar skip/take tidak bisa dibuat raksasa.
function parsePagination(query, { defaultSize = 25, maxSize = 100 } = {}) {
  const page = Math.min(Math.max(parseInt(query.page, 10) || 1, 1), 100000);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || defaultSize, 1), maxSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

module.exports = { parsePagination };
