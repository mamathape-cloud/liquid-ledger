import express = require("express");
import uploadMiddleware = require("../config/upload");
import authMiddleware = require("../middleware/auth");
import fileService = require("../services/fileService");

const router = express.Router();

router.post(
  "/proof",
  authMiddleware.verifyToken,
  uploadMiddleware.array("files", 10),
  (req, res): void => {
    const files = Array.isArray(req.files) ? req.files : [];
    const urls = fileService.saveFiles(files);

    res.json({
      success: true,
      data: { urls },
    });
  },
);

export = router;
