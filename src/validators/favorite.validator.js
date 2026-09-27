// ============================================
// Favorite Validators (Joi)
// ============================================

const Joi = require('joi');

const addFavorite = {
  body: Joi.object({
    favoriteId: Joi.string().required(),
    notes: Joi.string().max(200).allow('', null),
  }),
};

const updateNotes = {
  body: Joi.object({
    notes: Joi.string().max(200).allow(''),
  }),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = { addFavorite, updateNotes, paginationQuery };