'use strict';
const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../utils/logger');
const { generateTTSAudio } = require('../services/aliyunTTS');

router.post('/qwen', async (req, res) => {
  try {
    const { messages, image, auto_tts = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ reply: "参数错误: messages 必须是数组" });
    }

    let processedMessages = JSON.parse(JSON.stringify(messages));
    let lastMessage = processedMessages[processedMessages.length - 1];

    if (image) {
      const textContent = lastMessage.content;
      lastMessage.content = [
        { image: `data:image/jpeg;base64,${image}` },
        { text: textContent }
      ];
    } 

    logger.debug("Sending to DashScope..."); 

    const qwenResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscopeApiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'disable' 
      },
      body: JSON.stringify({
        model: "qwen-vl-plus", 
        input: { messages: processedMessages },
        parameters: { result_format: "message" }
      })
    });

    const data = await qwenResponse.json();
    
    if (data.code) {
      return res.status(500).json({ reply: `AI 思考失败: ${data.message}` });
    }

    let replyText = "";
    const content = data.output.choices[0].message.content;

    if (Array.isArray(content)) {
      const textItem = content.find(item => item.text);
      replyText = textItem ? textItem.text : "我没能生成回答。";
    } else {
      replyText = content; 
    }
    if (!replyText && typeof content === 'string') {
        replyText = content;
    }

    logger.debug(`Qwen Reply generated, length: ${replyText.length}`);

    if (auto_tts) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const textPayload = JSON.stringify({ type: 'text', content: replyText });
      res.write(`data: ${textPayload}\n\n`);

      try {
        logger.debug("Starting auto TTS generation...");
        const audioBuffer = await generateTTSAudio(replyText);
        const base64Audio = audioBuffer.toString('base64');
        const audioPayload = JSON.stringify({ type: 'audio', content: base64Audio });
        res.write(`data: ${audioPayload}\n\n`);
        logger.debug("Auto TTS audio pushed to client.");
      } catch (ttsError) {
        logger.error("Auto TTS Error:", ttsError);
        const errorPayload = JSON.stringify({ type: 'error', content: 'TTS Generation Failed' });
        res.write(`data: ${errorPayload}\n\n`);
      }
      res.end();
    } else {
      res.json({ reply: replyText, status: 200 });
    }

  } catch (error) {
    logger.error("Qwen Proxy Error:", error);
    if (!res.headersSent) {
        res.status(500).json({ reply: `服务器代理异常: ${error.message}` });
    } else {
        res.end();
    }
  }
});

module.exports = router;