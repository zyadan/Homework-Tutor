'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const logger = require('./utils/logger');

// 导入路由
const audioRoutes = require('./routes/audio');
const llmRoutes = require('./routes/llm');
const historyRoutes = require('./routes/history');

const app = express();

// 1. 全局中间件
app.use(bodyParser.json({ limit: '10mb' }));

// 跨域处理
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// 2. 挂载路由
app.use(audioRoutes);  // 挂载 /asr 和 /tts
app.use(llmRoutes);    // 挂载 /qwen
app.use(historyRoutes);// 挂载 /upload-chat

// 3. 启动服务器
app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`);
  if (config.DEBUG) {
    logger.info('⚠️ DEBUG MODE IS ENABLED. Verbose logs will be printed.');
  }
});