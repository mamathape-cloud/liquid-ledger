function saveFiles(files: Express.Multer.File[]): string[] {
  // TODO: swap this to S3 or Cloudinary later
  return files.map((file) => `/uploads/${file.filename}`);
}

export = { saveFiles };
