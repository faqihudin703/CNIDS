const prisma = require("../config/prisma");
const { parseSort } = require("../utils/sorting");
const { activityWhereFor } = require("../utils/activityVisibility");

const LOG_ORDER = {
  loggedAt: (d) => ({ loggedAt: d }),
  user: (d) => ({ user: { fullName: d } }),
  action: (d) => ({ action: d }),
};

async function listActivityLogs(req, res) {
  const { page = 1, pageSize = 50 } = req.query;
  const take = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
  const skip = Math.max((Number(page) || 1) - 1, 0) * take;

  // Filter yang sama dipakai untuk daftar dan hitung total, supaya paginasi tidak bocor/janggal.
  const where = activityWhereFor(req.user.role);
  // Pencarian hanya pada kolom yang tampil: Pengguna dan Aksi. Digabung (AND) dengan filter visibilitas peran.
  const q = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (q) {
    where.AND = [...(where.AND || []), { OR: [{ action: { contains: q } }, { user: { fullName: { contains: q } } }, { user: { username: { contains: q } } }] }];
  }

  const sort = parseSort(req.query, Object.keys(LOG_ORDER));
  const orderBy = sort ? [LOG_ORDER[sort.key](sort.dir), { id: "desc" }] : [{ loggedAt: "desc" }, { id: "desc" }];

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy,
      take,
      skip,
      include: { user: { select: { id: true, username: true, fullName: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return res.json({ data: logs, total, page: Number(page), pageSize: take });
}

module.exports = { listActivityLogs };
