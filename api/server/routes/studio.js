const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const rateLimit = require('express-rate-limit');
const { limiterCache } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const router = express.Router();

const MUAPI_BASE = 'https://api.muapi.ai/api/v1';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const generateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => String(req.user?.id ?? 'anonymous'),
  skipFailedRequests: true,
  store: limiterCache('studio_limiter'),
});

router.post('/generate', requireJwtAuth, generateLimiter, async (req, res) => {
  try {
    const { endpoint, prompt, params } = req.body;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    const hasPrompt = prompt || params?.prompt;
    const hasMedia = params?.image_url || params?.video_url || params?.audio_url || params?.target_image_url;
    if (!hasPrompt && !hasMedia) {
      return res.status(400).json({ error: 'prompt or media input is required' });
    }

    const response = await axios.post(
      `${MUAPI_BASE}/${endpoint}`,
      { prompt, ...params },
      {
        headers: {
          'x-api-key': process.env.MUAPI_API_KEY,
          'Content-Type': 'application/json',
        },
      },
    );

    logger.info('[studio] Generation request submitted', { requestId: response.data.request_id });

    return res.json({
      requestId: response.data.request_id,
      status: response.data.status,
    });
  } catch (error) {
    logger.error('[studio] Generate error', { message: error.message });
    return res.status(500).json({ error: 'Failed to submit generation request' });
  }
});

router.get('/status/:requestId', requireJwtAuth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const response = await axios.get(`${MUAPI_BASE}/predictions/${requestId}/result`, {
      headers: { 'x-api-key': process.env.MUAPI_API_KEY },
    });

    const { data } = response;
    const outputUrl = Array.isArray(data.outputs) && data.outputs.length > 0 ? data.outputs[0] : null;

    return res.json({
      status: data.status,
      output: outputUrl,
      error: data.error || null,
    });
  } catch (error) {
    logger.error('[studio] Status check error', { message: error.message });
    return res.status(500).json({ error: 'Failed to check generation status' });
  }
});

router.post('/upload', requireJwtAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(`${MUAPI_BASE}/upload_file`, formData, {
      headers: {
        'x-api-key': process.env.MUAPI_API_KEY,
        ...formData.getHeaders(),
      },
    });

    logger.info('[studio] File uploaded successfully', { fileUrl: response.data.file_url });

    return res.json({ fileUrl: response.data.file_url });
  } catch (error) {
    logger.error('[studio] Upload error', { message: error.message });
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
