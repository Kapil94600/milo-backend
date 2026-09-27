// ============================================
// Upload Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const UploadService = require('../services/upload.service');
const ApiResponse = require('../utils/response');

// ============================================
// POST /upload/image
// ============================================
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.badRequest(res, 'No image uploaded');

  const result = await UploadService.uploadFile(req.file, req.uploadFolder || 'temp');
  return ApiResponse.success(res, result, 'Image uploaded');
});

// ============================================
// POST /upload/images
// ============================================
const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) {
    return ApiResponse.badRequest(res, 'No images uploaded');
  }

  const results = await UploadService.uploadFiles(req.files, req.uploadFolder || 'temp');
  return ApiResponse.success(res, results, 'Images uploaded');
});

// ============================================
// DELETE /upload/:publicId
// ============================================
const deleteFile = asyncHandler(async (req, res) => {
  const result = await UploadService.deleteFile(req.params.publicId);
  return ApiResponse.success(res, result, 'File deleted');
});

// ============================================
// Exports
// ============================================
module.exports = {
  uploadImage,
  uploadImages,
  deleteFile,
};