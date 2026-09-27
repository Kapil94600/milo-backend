// ============================================
// Banner Validators — with multipart support
// ============================================

const Joi = require('joi');

const createBanner = {
  body: Joi.object({
    title: Joi.string().min(1).max(100).required(),
    subtitle: Joi.string().max(200).allow('', null),
    image: Joi.string().allow(''),
    linkType: Joi.string()
      .valid(
        'URL',
        'PAGE',
        'PRODUCT',
        'USER',
        'GIRL',
        'SUBSCRIPTION',
        'COIN_PACKAGE',
        'NONE'
      )
      .default('NONE'),
    link: Joi.string().allow('', null),
    linkData: Joi.any(),
    position: Joi.number().integer().default(0),
    displayOrder: Joi.number().integer().default(0),
    isActive: Joi.boolean().default(true),
    isFeatured: Joi.boolean().default(false),
    startDate: Joi.any(),
    endDate: Joi.any(),
    platform: Joi.any(),
    roles: Joi.any(),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

const updateBanner = {
  body: Joi.object({
    title: Joi.string().min(1).max(100),
    subtitle: Joi.string().max(200).allow('', null),
    image: Joi.string().allow(''),
    linkType: Joi.string().valid(
      'URL',
      'PAGE',
      'PRODUCT',
      'USER',
      'GIRL',
      'SUBSCRIPTION',
      'COIN_PACKAGE',
      'NONE'
    ),
    link: Joi.string().allow('', null),
    linkData: Joi.any(),
    position: Joi.number().integer(),
    displayOrder: Joi.number().integer(),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    startDate: Joi.any(),
    endDate: Joi.any(),
    platform: Joi.any(),
    roles: Joi.any(),
  })
    .unknown(true)
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

const toggleBanner = {
  body: Joi.object({
    isActive: Joi.boolean().required(),
  }).unknown(true),
};

const reorderBanners = {
  body: Joi.object({
    orders: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          displayOrder: Joi.number().integer().required(),
        })
      )
      .min(1)
      .required(),
  }).unknown(true),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    isActive: Joi.string().valid('true', 'false'),
    search: Joi.string().max(100).allow(''),
  }).unknown(true),
};

module.exports = {
  createBanner,
  updateBanner,
  toggleBanner,
  reorderBanners,
  paginationQuery,
};