'use strict';
const config = require('../config');

module.exports = {
  // 始终打印 (服务器启动等)
  info: (...args) => console.log('[INFO]', ...args),
  
  // 始终打印报错
  error: (...args) => console.error('[ERROR]', ...args),
  
  // 仅在 DEBUG 模式开启时打印
  debug: (...args) => {
    if (config.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }
};