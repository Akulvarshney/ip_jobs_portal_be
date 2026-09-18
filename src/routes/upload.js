const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const authenticate = require('../middleware/authMiddleware');

// 3 MB Hard Limit for ALL uploads (documents, images, CVs, logos)
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3,145,728 bytes

// Configure multer with memory storage
const storage = multer.memoryStorage();

// Multer filters for specific file types with strict 3MB size limit
const resumeUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx|txt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, DOC, and DOCX documents are allowed.'));
    }
  }
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Only JPG, PNG, and WebP are allowed.'));
    }
  }
});

const documentUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, DOC, DOCX, JPG, and PNG are allowed.'));
    }
  }
});

const logoUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|svg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid logo image format. Only JPG, PNG, WebP, and SVG are allowed.'));
    }
  }
});

// Cloudflare R2 Upload Endpoints
router.get('/status', uploadController.getStatus);
router.post('/resume', authenticate, resumeUpload.single('file'), uploadController.uploadResume);
router.post('/avatar', authenticate, avatarUpload.single('file'), uploadController.uploadAvatar);
router.post('/document', authenticate, documentUpload.single('file'), uploadController.uploadDocument);
router.post('/company-logo', authenticate, logoUpload.single('file'), uploadController.uploadCompanyLogo);

// Proxy streaming endpoint for R2 objects
router.get('/file/*key', uploadController.getFileProxy);

// Multer and File Upload Error Handling Middleware
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 3MB limit. Please upload a file under 3MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error'
    });
  }
  next();
});

module.exports = router;
