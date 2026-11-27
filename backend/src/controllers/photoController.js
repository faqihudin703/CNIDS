const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { removeUpload } = require("../utils/fileStore");

async function uploadPhoto(req, res) {
  if (!req.file) return res.status(400).json({ error: "File foto wajib disertakan" });

  const fileUrl = `/uploads/photos/${req.file.filename}`;
  const caption = typeof req.body.caption === "string" && req.body.caption.trim() ? req.body.caption.trim().slice(0, 255) : null;

  let photo;
  try {
    photo = await prisma.devicePhoto.create({ data: { deviceId: req.device.id, fileUrl, caption } });
  } catch (err) {
    await removeUpload(fileUrl); // simpan ke DB gagal -> jangan tinggalkan file yatim di disk
    throw err;
  }

  await logActivity(req.user.id, `Mengunggah foto untuk perangkat "${req.device.name}"`);
  return res.status(201).json(photo);
}

async function deletePhoto(req, res) {
  const photoId = Number(req.params.photoId);
  const photo = await prisma.devicePhoto.findUnique({ where: { id: photoId } });
  if (!photo) return res.status(404).json({ error: "Foto tidak ditemukan" });

  // Baris DB dihapus dulu: kalau gagal, file tetap ada dan datanya konsisten. File yang gagal dihapus hanya sisa di disk.
  await prisma.devicePhoto.delete({ where: { id: photoId } });
  await removeUpload(photo.fileUrl);

  await logActivity(req.user.id, `Menghapus foto (ID ${photoId}) dari perangkat ID ${photo.deviceId}`);
  return res.status(204).send();
}

module.exports = { uploadPhoto, deletePhoto };
