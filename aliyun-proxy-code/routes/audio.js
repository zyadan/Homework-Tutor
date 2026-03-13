'use strict';
const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../utils/logger');
const { getAccessToken } = require('../services/aliyunAuth');
const { generateTTSAudio } = require('../services/aliyunTTS');

// --- ASR 接口 ---
router.post('/asr', async (req, res) => {
  try {
    const { audioData, format = 'wav', sample_rate = 16000 } = req.body;
    if (!audioData) return res.status(400).json({ error: "音频数据为空" });

    const audioBuffer = Buffer.from(audioData, 'base64');
    const token = await getAccessToken();
    const url = `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${config.appKey}&format=${format}&sample_rate=${sample_rate}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-NLS-Token': token,
        'Content-Type': 'application/octet-stream',
        'Content-Length': audioBuffer.length.toString()
      },
      body: audioBuffer
    });

    const result = await response.json();
    logger.debug("ASR Result:", JSON.stringify(result));
    res.json({ text: result.result || "", status: result.status, message: result.message });
  } catch (e) {
    logger.error("ASR Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- 单独的 TTS 接口 ---
router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'Zhiqi' } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const buffer = await generateTTSAudio(text, voice);
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    logger.error("Standard TTS Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;