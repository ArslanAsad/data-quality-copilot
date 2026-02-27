import multer from "multer";
import { config } from "../config";
import { Request } from "express";

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  if (config.upload.allowedMimeTypes.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only CSV files are allowed."));
  }
};

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter,
});
