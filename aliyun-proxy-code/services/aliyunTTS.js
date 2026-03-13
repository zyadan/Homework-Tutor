'use strict';
const config = require('../config');
const { getAccessToken } = require('./aliyunAuth');

async function generateTTSAudio(text, voice = 'Zhiqi') {
  const token = await getAccessToken();
  const url = 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appkey: config.appKey,
      token: token,
      text: text,
      format: 'mp3',
      sample_rate: 16000,
      voice: voice
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TTS API Error: ${errText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const err = await response.json();
    throw new Error(JSON.stringify(err));
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { generateTTSAudio };