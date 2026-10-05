// ============================================
// Upload Service — Bond (Complete)
// ============================================

import api from './api';

export const uploadService = {
  // ============================================
  // Upload single image
  // ============================================
  uploadImage: async (asset, folder = 'temp') => {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'image.jpg',
      });

      const res = await api.post(`/upload/${folder}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      return res.data?.data;
    } catch (error) {
      console.error('Upload image error:', error);
      throw error;
    }
  },

  // ============================================
  // ⭐ Upload chat media (image / video / audio)
  // ============================================
  uploadChatMedia: async (asset) => {
    try {
      const formData = new FormData();

      // Detect type
      const isVideo = asset.type === 'video';
      const isAudio = asset.type === 'audio';

      // Determine MIME
      let mimeType = asset.mimeType;
      let fileName = asset.fileName;

      if (!mimeType || mimeType === 'application/octet-stream') {
        if (isAudio) {
          mimeType = 'audio/m4a';
          fileName = fileName || `voice-${Date.now()}.m4a`;
        } else if (isVideo) {
          mimeType = 'video/mp4';
          fileName = fileName || `video-${Date.now()}.mp4`;
        } else {
          mimeType = 'image/jpeg';
          fileName = fileName || `image-${Date.now()}.jpg`;
        }
      }

      // Ensure filename has extension
      if (!fileName || !fileName.includes('.')) {
        const ext = isAudio ? '.m4a' : isVideo ? '.mp4' : '.jpg';
        fileName = `${asset.type || 'file'}-${Date.now()}${ext}`;
      }

      console.log('📤 Uploading chat media:', {
        type: asset.type,
        mimeType,
        fileName,
        uri: asset.uri,
      });

      // ⭐ KEY: field name must be 'file' (matches backend multer.single('file'))
      formData.append('file', {
        uri: asset.uri,
        type: mimeType,
        name: fileName,
      });

      const res = await api.post('/upload/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000, // 3 min for large videos
      });

      return res.data?.data;
    } catch (error) {
      console.error(
        'Upload chat media error:',
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // ============================================
  // Upload profile image
  // ============================================
  uploadProfileImage: async (asset) => {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: 'profile.jpg',
      });

      const res = await api.post('/upload/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      return res.data?.data;
    } catch (error) {
      console.error('Upload profile error:', error);
      throw error;
    }
  },

  // ============================================
  // Upload verification documents
  // ============================================
  uploadVerification: async (asset, type = 'idProof') => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `${type}.jpg`,
      });

      const res = await api.post('/upload/verification', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      return res.data?.data;
    } catch (error) {
      console.error('Upload verification error:', error);
      throw error;
    }
  },
};

export default uploadService;