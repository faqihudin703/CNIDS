const fs = require("fs");
const path = require("path");

const root = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");

// Mengubah "/uploads/photos/x.jpg" (nilai di DB) menjadi path disk, dan menolak apa pun yang keluar dari folder upload.
function resolveUpload(fileUrl) {
  const full = path.resolve(root(), String(fileUrl).replace(/^\/uploads\//, ""));
  return full.startsWith(root() + path.sep) ? full : null;
}

async function removeUpload(fileUrl) {
  const full = resolveUpload(fileUrl);
  if (full) await fs.promises.unlink(full).catch(() => {}); // sudah tidak ada = tidak masalah
}

const removeUploads = (fileUrls) => Promise.all(fileUrls.map(removeUpload));

module.exports = { resolveUpload, removeUpload, removeUploads };
