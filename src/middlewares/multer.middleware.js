import fs from 'fs';
import multer from 'multer';
import path from 'path';

// This function creates and returns a multer middleware with a custom path
export const mediaUpload = (folderPath) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadPath = path.join('public', 'contents', folderPath);

      // Ensure the folder exists, if not, create it
      fs.mkdirSync(uploadPath, { recursive: true });

      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });

  return multer({ storage });
};
