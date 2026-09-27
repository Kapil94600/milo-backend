// ============================================
// Cloudinary Configuration (optional)
// ============================================

const config = require('./index');

let cloudinary = null;
let cloudinaryReady = false;

const initCloudinary = () => {
  if (cloudinaryReady) return cloudinary;

  const { CLOUD_NAME, API_KEY, API_SECRET } = config.CLOUDINARY;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return null;
  }

  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: API_KEY,
      api_secret: API_SECRET,
      secure: true,
    });
    cloudinaryReady = true;
    console.log('✅ Cloudinary initialized');
    return cloudinary;
  } catch (error) {
    console.error('❌ Cloudinary init failed:', error.message);
    return null;
  }
};

// ============================================
// Upload single file
// ============================================
const uploadToCloudinary = async (filePath, folder = 'social-platform') => {
  const cld = initCloudinary();
  if (!cld) throw new Error('Cloudinary not configured');

  const result = await cld.uploader.upload(filePath, {
    folder,
    resource_type: 'auto',
    use_filename: true,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
};

// ============================================
// Delete file
// ============================================
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  const cld = initCloudinary();
  if (!cld) throw new Error('Cloudinary not configured');

  return await cld.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = {
  initCloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};