// ============================================
// Upload Service (Backend) — Bond
// Local + Cloudinary with fallback
// ============================================

const path = require('path');
const fs = require('fs');
const config = require('../config');
const AppError = require('../utils/AppError');
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require('../config/cloudinary');
const { logInfo, logError } = require('../utils/logger');

class UploadService {
  // ============================================
  // Upload single file
  // ============================================
  static async uploadFile(file, folder = 'temp') {
    if (!file) throw AppError.badRequest('No file provided');

    // Cloudinary (if configured)
    const cloudinaryConfigured =
      config.CLOUDINARY.CLOUD_NAME &&
      config.CLOUDINARY.API_KEY &&
      config.CLOUDINARY.API_SECRET;

    if (cloudinaryConfigured) {
      try {
        const cloudFolder = `${config.CLOUDINARY.FOLDER}/${folder}`;
        const result = await uploadToCloudinary(file.path, cloudFolder);

        // Delete local temp file
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // silent
        }

        return {
          url: result.url,
          publicId: result.publicId,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          storage: 'cloudinary',
        };
      } catch (error) {
        logError('Cloudinary upload failed, falling back to local', error);
      }
    }

    // Local storage fallback
    const relativeUrl = `/uploads/${folder}/${file.filename}`;
    const absoluteUrl = this.buildAbsoluteUrl(relativeUrl);

    logInfo(`File saved locally: ${relativeUrl}`);

    return {
      url: absoluteUrl,
      relativeUrl,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      storage: 'local',
    };
  }

  // ============================================
  // Upload multiple files
  // ============================================
  static async uploadFiles(files, folder = 'temp') {
    if (!files || files.length === 0) {
      throw AppError.badRequest('No files provided');
    }
    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }

  // ============================================
  // Delete file
  // ============================================
  static async deleteFile(publicId, storage = 'cloudinary') {
    if (storage === 'cloudinary') {
      try {
        await deleteFromCloudinary(publicId);
      } catch (e) {
        logError('Cloudinary delete failed', e);
      }
    }
    return { message: 'File deleted' };
  }

  // ============================================
  // Helpers
  // ============================================
  static buildAbsoluteUrl(relativeUrl) {
    if (!relativeUrl) return null;
    if (relativeUrl.startsWith('http')) return relativeUrl;

    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      (config.IS_PRODUCTION
        ? `https://api.${(config.APP_NAME || 'bond').toLowerCase()}.app`
        : `http://localhost:${config.PORT}`);

    return `${baseUrl}${relativeUrl}`;
  }

  static normalizeImageUrl(url) {
    if (!url) return null;
    return this.buildAbsoluteUrl(url);
  }
}

module.exports = UploadService;