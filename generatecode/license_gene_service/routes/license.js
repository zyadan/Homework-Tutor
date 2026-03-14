const express = require('express');
const config = require('../config');
const licenseService = require('../services/licenseService');

function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token');
  if (token !== config.adminToken) {
    res.status(401).json({
      success: false,
      message: '管理员令牌无效'
    });
    return;
  }
  next();
}

module.exports = function createLicenseRouter() {
  const router = express.Router();

  router.post('/admin/generateCodes', requireAdmin, async function handleGenerate(req, res, next) {
    try {
      const result = await licenseService.generateCodes(req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/license/activate', async function handleActivate(req, res, next) {
    try {
      const body = req.body || {};
      const result = await licenseService.activateCode({
        code: body.code,
        deviceType: body.deviceType || body.deviceId || 'unknown'
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/license/verify', async function handleVerify(req, res, next) {
    try {
      const body = req.body || {};
      const result = await licenseService.verifyCode({
        code: body.code,
        tokenId: body.tokenId || '',
        deviceType: body.deviceType || body.deviceId || 'unknown'
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/token/status', async function handleStatus(req, res, next) {
    try {
      const result = await licenseService.getTokenStatus({
        tokenId: req.query.tokenId || ''
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
