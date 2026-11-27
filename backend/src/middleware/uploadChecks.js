const fs = require("fs");

// Ekstensi saja mudah dipalsukan (file apa pun bisa dinamai .jpg). Periksa isi file yang sebenarnya.
const SIGNATURES = {
  jpeg: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

function isImage(head) {
  return SIGNATURES.jpeg(head) || SIGNATURES.png(head) || SIGNATURES.webp(head);
}

// File konfigurasi harus teks: tidak boleh mengandung byte NUL (ciri biner/executable).
function isTextLike(head) {
  return !head.includes(0);
}

function readHead(filePath, bytes = 8192) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function verifyUpload(kind) {
  const check = kind === "image" ? isImage : isTextLike;
  const message =
    kind === "image"
      ? "Isi file bukan gambar JPG/PNG/WEBP yang valid"
      : "File konfigurasi harus berupa teks (terdeteksi data biner)";

  return (req, res, next) => {
    if (!req.file) return next(); // controller yang memutuskan (400: file wajib)
    let ok = false;
    try {
      ok = check(readHead(req.file.path));
    } catch {
      ok = false;
    }
    if (!ok) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: message });
    }
    next();
  };
}

module.exports = { verifyUpload, isImage, isTextLike };
