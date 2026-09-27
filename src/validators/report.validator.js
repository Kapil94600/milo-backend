// ============================================
// Report Validators (Joi)
// ============================================

const Joi = require('joi');

const createReport = {
  body: Joi.object({
    reportedId: Joi.string().required(),
    type: Joi.string().valid('USER', 'MESSAGE', 'CHAT', 'CALL', 'PROFILE', 'PAYMENT', 'OTHER').required(),
    category: Joi.string()
      .valid('SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'SCAM', 'ABUSE', 'HATE_SPEECH', 'VIOLENCE', 'NUDITY', 'COPYRIGHT', 'OTHER')
      .required(),
    description: Joi.string().min(10).max(1000).required(),
    evidence: Joi.array().items(Joi.string().uri()).max(10),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
  }),
};

const updateReport = {
  body: Joi.object({
    status: Joi.string().valid('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED').required(),
    resolution: Joi.string().max(1000).allow(''),
    resolutionAction: Joi.string().valid('WARNING', 'SUSPEND', 'BAN', 'DELETE', 'IGNORE', 'OTHER'),
    assignedToId: Joi.string(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
    adminNotes: Joi.string().max(1000).allow(''),
  }),
};

const getReports = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED'),
    type: Joi.string().valid('USER', 'MESSAGE', 'CHAT', 'CALL', 'PROFILE', 'PAYMENT', 'OTHER'),
    category: Joi.string(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
  }),
};

module.exports = { createReport, updateReport, getReports };