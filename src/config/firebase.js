// ============================================
// Firebase Admin SDK — for Phone Auth Verification
// ============================================

const admin = require('firebase-admin');
const config = require('./index');
const { logInfo, logError, logWarn } = require('../utils/logger');

let firebaseReady = false;
let firebaseInitialized = false;

// ============================================
// Initialize Firebase Admin SDK (lazy)
// ============================================
const initFirebase = () => {
  if (firebaseInitialized) return firebaseReady;
  firebaseInitialized = true;

  const { PROJECT_ID, PRIVATE_KEY, CLIENT_EMAIL } = config.FIREBASE;

  if (!PROJECT_ID || !PRIVATE_KEY || !CLIENT_EMAIL) {
    logWarn('Firebase disabled — credentials missing');
    firebaseReady = false;
    return false;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: PROJECT_ID,
          privateKey: PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: CLIENT_EMAIL,
        }),
      });
    }

    firebaseReady = true;
    logInfo('✅ Firebase Admin SDK initialized');
    return true;
  } catch (error) {
    logError('Firebase initialization failed', error);
    firebaseReady = false;
    return false;
  }
};

// ============================================
// ✅ Verify Firebase ID Token (from mobile)
// Returns decoded token with phone_number
// ============================================
const verifyFirebaseToken = async (idToken) => {
  if (!idToken) {
    throw new Error('ID token is required');
  }

  if (!firebaseInitialized) initFirebase();

  if (!firebaseReady) {
    throw new Error('Firebase not configured on server');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logError('Firebase token verification failed', error);
    throw new Error('Invalid or expired Firebase token');
  }
};

// ============================================
// Get Firebase Auth instance
// ============================================
const getFirebaseAuth = () => {
  if (!firebaseInitialized) initFirebase();
  return admin.auth();
};

// ============================================
// Is Firebase available?
// ============================================
const isFirebaseAvailable = () => {
  if (!firebaseInitialized) initFirebase();
  return firebaseReady;
};

module.exports = {
  admin,
  initFirebase,
  verifyFirebaseToken,
  getFirebaseAuth,
  isFirebaseAvailable,
};