/**
 * Estate Sales Routes — DynamoDB backend
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { protect, optionalAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const SaleModel = require('../models/EstateSale');

// ─── GET /api/sales ───────────────────────────────────────────────────────────
// Public: list active sales, optionally near a lat/lng
router.get('/', [
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius').optional().isFloat({ min: 1, max: 500 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;
  const radius = parseFloat(req.query.radius) || 50;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const result = await SaleModel.getActiveSalesNear({ lat, lng, radiusMiles: radius, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('GET /sales error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales.' });
  }
});

// ─── GET /api/sales/user/my-sales ─────────────────────────────────────────────
router.get('/user/my-sales', protect, async (req, res) => {
  try {
    const sales = await SaleModel.getByUserId(req.user.userId);
    res.json({ success: true, sales });
  } catch (err) {
    console.error('GET my-sales error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch your sales.' });
  }
});

// ─── GET /api/sales/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const sale = await SaleModel.getById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Estate sale not found.' });
    res.json({ success: true, sale });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch sale.' });
  }
});

// ─── POST /api/sales ──────────────────────────────────────────────────────────
router.post('/',
  protect,
  writeLimiter,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
    body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
    body('address.street').notEmpty().withMessage('Street address is required'),
    body('address.city').notEmpty().withMessage('City is required'),
    body('address.state').notEmpty().withMessage('State is required'),
    body('address.zip').notEmpty().withMessage('ZIP code is required'),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
    body('endDate').isISO8601().withMessage('Valid end date required'),
    body('startTime').notEmpty().withMessage('Start time required'),
    body('endTime').notEmpty().withMessage('End time required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, description, imageUrl, address, lat, lng,
      startDate, endDate, startTime, endTime, tags } = req.body;

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ success: false, message: 'End date must be on or after start date.' });
    }

    try {
      const sale = await SaleModel.create({
        userId: req.user.userId,
        postedByName: req.user.name,
        title, description, imageUrl,
        address: {
          ...address,
          full: `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
        },
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        startDate, endDate, startTime, endTime,
        tags: Array.isArray(tags) ? tags : [],
      });
      res.status(201).json({ success: true, sale });
    } catch (err) {
      console.error('POST /sales error:', err);
      res.status(500).json({ success: false, message: 'Failed to create sale.' });
    }
  }
);

// ─── PUT /api/sales/:id ───────────────────────────────────────────────────────
router.put('/:id',
  protect,
  writeLimiter,
  async (req, res) => {
    try {
      const sale = await SaleModel.getById(req.params.id);
      if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
      if (sale.userId !== req.user.userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this sale.' });
      }
      const updated = await SaleModel.update(req.params.id, req.body);
      res.json({ success: true, sale: updated });
    } catch (err) {
      console.error('PUT /sales error:', err);
      res.status(500).json({ success: false, message: 'Failed to update sale.' });
    }
  }
);

// ─── DELETE /api/sales/:id ────────────────────────────────────────────────────
router.delete('/:id', protect, writeLimiter, async (req, res) => {
  try {
    const sale = await SaleModel.getById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    if (sale.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this sale.' });
    }
    await SaleModel.delete(req.params.id);
    res.json({ success: true, message: 'Estate sale deleted.' });
  } catch (err) {
    console.error('DELETE /sales error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete sale.' });
  }
});

module.exports = router;
