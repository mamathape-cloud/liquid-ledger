import path = require("path");
import crypto = require("crypto");
import fs = require("fs");
import multer = require("multer");

const uploadDirectory = path.resolve(__dirname, "../../uploads");
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxFileSizeBytes = 5 * 1024 * 1024;
const maxFilesPerRequest = 10;

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
    cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
    return;
  }

  cb(null, true);
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeBytes,
    files: maxFilesPerRequest,
  },
});

export = uploadMiddleware;
