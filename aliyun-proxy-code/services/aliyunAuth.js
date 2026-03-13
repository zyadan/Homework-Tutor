'use strict';
const RPCClient = require('@alicloud/pop-core');
const config = require('../config');
const logger = require('../utils/logger');

let cachedToken = { value: '', expireTime: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken.value && cachedToken.expireTime > now + 600) {
    return cachedToken.value;
  }
  
  logger.debug('Token expired or missing, fetching new Token...');
  const client = new RPCClient({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.nlsEndpoint,
    apiVersion: config.apiVersion
  });
  
  try {
    const result = await client.request('CreateToken', {}, { method: 'POST' });
    cachedToken = {
      value: result.Token.Id,
      expireTime: result.Token.ExpireTime
    };
    return cachedToken.value;
  } catch (error) {
    logger.error('Failed to get Aliyun Access Token:', error);
    throw error;
  }
}

module.exports = { getAccessToken };