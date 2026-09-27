// ============================================
// Upload Service
// Works with local storage OR Cloudinary
// ============================================

const path = require('path');
const fs = require('fs');
const config = require('../config');
const AppError = require('../utils/AppError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { logInfo, logError } = require('../utils/logger');

class UploadService {
  // ============================================
  // Upload single file
  // ============================================
  static async uploadFile(file, folder = 'temp') {
    if (!file) throw AppError.badRequest('No file provided');

    // If Cloudinary configured, upload there
    if (config.CLOUDINARY.CLOUD_NAME && config.CLOUDINARY.API_KEY) {
      try {
        const cloudFolder = `${config.CLOUDINARY.FOLDER}/${folder}`;
        const result = await uploadToCloudinary(file.path, cloudFolder);

        // Delete local file after upload
        try {
          fs.unlinkSync(file.path);
        } catch {}

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
        // Fall through to local
      }
    }

    // Local storage — return absolute URL for mobile compatibility
    const relativeUrl = `/uploads/${folder}/${file.filename}`;
    const absoluteUrl = this.buildAbsoluteUrl(relativeUrl);

    return {
      url: absoluteUrl,          // ✅ absolute URL for mobile
      relativeUrl,               // ✅ relative path for web admin
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

    const results = await Promise.all(
      files.map((file) => this.uploadFile(file, folder))
    );

    return results;
  }

  // ============================================
  // Delete file
  // ============================================
  static async deleteFile(publicId, storage = 'cloudinary') {
    if (storage === 'cloudinary') {
      try {
        await deleteFromCloudinary(publicId);
      } catch {}
    }
    return { message: 'File deleted' };
  }

  // ============================================
  // Helper: build absolute URL
  // ============================================
  static buildAbsoluteUrl(relativeUrl) {
    if (!relativeUrl) return null;
    if (relativeUrl.startsWith('http')) return relativeUrl;

    // Use config or default localhost
    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      (config.IS_PRODUCTION
        ? `https://api.${config.APP_NAME.toLowerCase()}.com`
        : `http://localhost:${config.PORT}`);

    return `${baseUrl}${relativeUrl}`;
  }

  // ============================================
  // Helper: normalize any image URL
  // - If it's a relative path (/uploads/...), convert to absolute
  // - If it's already absolute (http...), return as-is
  // ============================================
  static normalizeImageUrl(url) {
    if (!url) return null;
    return this.buildAbsoluteUrl(url);
  }
}

module.exports = UploadService;