const mongoose = require('mongoose');
const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const suggestionEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: String, index: true },
    endpoint: { type: String },
    text: { type: String, required: true },
    type: { type: String, default: 'suggestion_click' },
  },
  { timestamps: true },
);

const SuggestionEvent =
  mongoose.models['SuggestionEvent'] ||
  mongoose.model('SuggestionEvent', suggestionEventSchema);

/**
 * POST /api/suggestions/event
 * Logs a suggestion click event for analytics.
 * Body: { text: string, endpoint?: string, conversationId?: string }
 */
router.post('/event', requireJwtAuth, async (req, res) => {
  const { text, endpoint, conversationId } = req.body;

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }

  try {
    await SuggestionEvent.create({
      userId: req.user.id,
      text: text.trim().slice(0, 200),
      endpoint: endpoint ?? '',
      conversationId: conversationId ?? '',
      type: 'suggestion_click',
    });
    res.json({ logged: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
