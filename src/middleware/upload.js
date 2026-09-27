// ============================================
// File Upload (Multer)
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const AppError = require('../utils/AppError');

// ============================================
// Ensure upload dir exists
// ============================================
const uploadRoot = path.resolve(process.cwd(), config.UPLOAD_DIR);
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

// ✅ All sub-folders (add promos, coin-packages)
// ✅ All sub-folders (add subscription-plans)
const subFolders = [
  'profiles',
  'covers',
  'banners',
  'gifts',
  'chats',
  'verification',
  'promos',
  'coin-packages',
  'subscription-plans',   // ✅ NEW
  'temp',
];
for (const sub of subFolders) {
  const dir = path.join(uploadRoot, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================
// Storage
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'temp';
    if (req.uploadFolder && subFolders.includes(req.uploadFolder)) {
      folder = req.uploadFolder;
    }
    cb(null, path.join(uploadRoot, folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    cb(null, `${timestamp}-${unique}${ext}`);
  },
});

// ============================================
// File filters
// ============================================
const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only image files (jpg, png, webp, gif) are allowed', 400), false);
};

const videoFilter = (req, file, cb) => {
  const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only video files (mp4, webm, mov) are allowed', 400), false);
};

const audioFilter = (req, file, cb) => {
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only audio files are allowed', 400), false);
};

const documentFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/jpg', 'image/png',
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only PDF, DOC, JPG, PNG allowed', 400), false);
};

const mediaFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only images and videos are allowed', 400), false);
};

// ============================================
// Limits
// ============================================
const limits = {
  fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024, // default 10 MB
  files: 5,
};

// ============================================
// Exported upload instances
// ============================================
const upload = multer({ storage, limits });

const uploadImage = multer({ storage, fileFilter: imageFilter, limits });
const uploadVideo = multer({ storage, fileFilter: videoFilter, limits });
const uploadAudio = multer({ storage, fileFilter: audioFilter, limits });
const uploadDocument = multer({ storage, fileFilter: documentFilter, limits });
const uploadMedia = multer({ storage, fileFilter: mediaFilter, limits });

// ============================================
// Multer error wrapper
// ============================================
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(`File too large. Max ${config.MAX_FILE_SIZE_MB}MB allowed`, 400));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Unexpected file field', 400));
    }
    return next(new AppError(err.message, 400));
  }
  next(err);
};

module.exports = {
  upload,
  uploadImage,
  uploadVideo,
  uploadAudio,
  uploadDocument,
  uploadMedia,
  handleMulterError,
  uploadRoot,
  subFolders,
};