'use strict';
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { tsClient, TableStore } = require('../services/tablestore');

router.post('/upload-chat', async (req, res) => {
  logger.debug('收到 /upload-chat POST 请求');
  logger.debug('请求头:', req.headers);
  logger.debug('请求体大小:', req.body ? JSON.stringify(req.body).length : 0, 'bytes');

  try {
    const body = req.body;
    logger.debug('请求体预览:', JSON.stringify(body, null, 2).substring(0, 800));

    const { user_id, session_id, device_time, messages } = body;

    if (!user_id || !session_id || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段：user_id, session_id, messages（必须是数组且非空）'
      });
    }

    const timestampStr = device_time || new Date().toISOString();
    const sessionTimestamp = `${session_id}_${timestampStr}`;

    const primaryKey = [
      { user_id: user_id },
      { session_timestamp: sessionTimestamp }
    ];

    const attributeColumns = [
      { messages: JSON.stringify(messages) },
      { device_time: timestampStr },
      { message_count: messages.length }
    ];

    const condition = new TableStore.Condition(
      TableStore.RowExistenceExpectation.IGNORE,
      null
    );

    const params = {
      tableName: 'study_chat_history',
      condition: condition,
      primaryKey: primaryKey,
      attributeColumns: attributeColumns,
    };

    logger.debug('准备写入 Tablestore，表名:', params.tableName);

    const putResult = await new Promise((resolve, reject) => {
      tsClient.putRow(params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    logger.debug('写入成功，消耗写 CU:', putResult.consumed?.write || 0);

    res.status(200).json({
      success: true,
      message: '聊天记录已保存',
      rowKey: sessionTimestamp,
      consumedWriteCU: putResult.consumed?.write || 0,
    });

  } catch (error) {
    logger.error('/upload-chat 处理异常:', error);
    let status = 500;
    let errorMsg = '服务器内部错误';

    if (error.code) {
      if (error.code === 'OTSParameterInvalid') {
        status = 400;
        errorMsg = `参数无效：${error.message}`;
      } else if (error.code === 'OTSAuthFailed' || error.code === 'AccessDenied') {
        status = 403;
        errorMsg = '权限不足';
      } else if (error.code === 'OTSObjectNotExist') {
        status = 404;
        errorMsg = '表不存在';
      } else if (error.code === 'OTSRowOperationConflict') {
        status = 409;
        errorMsg = '行冲突';
      }
    }

    res.status(status).json({ success: false, error: errorMsg, details: error.message, code: error.code });
  }
});

module.exports = router;