const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_SIZE_BYTES = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 10) * 1024 * 1024;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subfolder) {
  const dest = path.join(UPLOAD_DIR, subfolder);
  ensureDir(dest);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const uniqueName = crypto.randomBytes(16).toString("hex");
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uniqueName}${ext}`);
    },
  });
}

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const CONFIG_EXTENSIONS = [".txt", ".cfg", ".conf", ".json", ".xml"];

function fileFilterFactory(allowedExtensions) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`Tipe file tidak diizinkan. Gunakan salah satu dari: ${allowedExtensions.join(", ")}`));
    }
    cb(null, true);
  };
}

const uploadPhoto = multer({
  storage: makeStorage("photos"),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: fileFilterFactory(PHOTO_EXTENSIONS),
});

const uploadConfig = multer({
  storage: makeStorage("configs"),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: fileFilterFactory(CONFIG_EXTENSIONS),
});

module.exports = { uploadPhoto, uploadConfig };
