// ============================================
// Razorpay Config
// ============================================

const config = require('./index');

let razorpay = null;
let ready = false;

const initRazorpay = () => {
  if (ready) return razorpay;
  if (!config.RAZORPAY.KEY_ID || !config.RAZORPAY.KEY_SECRET) {
    console.log('⚠️  Razorpay credentials missing — payment disabled');
    return null;
  }

  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: config.RAZORPAY.KEY_ID,
    key_secret: config.RAZORPAY.KEY_SECRET,
  });

  ready = true;
  console.log('✅ Razorpay initialized');
  return razorpay;
};

module.exports = { initRazorpay };