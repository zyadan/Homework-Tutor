import { getSettings } from './config.js';
import { LicenseError } from './errors.js';
import { createRepository } from './repository.js';
import { LicenseService } from './service.js';

const settings = getSettings();
const repository = createRepository(settings);
const service = new LicenseService(repository, settings);

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  };
}

function normalizeHeaders(headers = {}) {
  const next = {};
  for (const [key, value] of Object.entries(headers)) {
    next[key.toLowerCase()] = value;
  }
  return next;
}

function parseBody(body) {
  if (!body) {
    return {};
  }
  if (typeof body === 'string') {
    return JSON.parse(body);
  }
  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString('utf8'));
  }
  return body;
}

function parseQuery(queryString = '') {
  const params = new URLSearchParams(queryString);
  return Object.fromEntries(params.entries());
}

export async function handler(event, context, callback) {
  const method = String(event.method || event.requestMethod || 'GET').toUpperCase();
  const path = event.path || '/';
  const headers = normalizeHeaders(event.headers || {});

  try {
    let response;

    if (method === 'POST' && path === '/admin/generateCodes') {
      const token = headers['x-admin-token'] || '';
      if (settings.adminToken && token !== settings.adminToken) {
        throw new LicenseError('管理员鉴权失败', 401);
      }

      const body = parseBody(event.body);
      response = jsonResponse(200, await service.generateCodes({
        count: Number.parseInt(body.count || 1, 10),
        durationDays: Number.parseInt(body.durationDays || settings.defaultDurationDays, 10),
        prefix: String(body.prefix || 'VIP'),
        batchId: body.batchId || null,
        remark: body.remark || null,
        maxBindCount: Number.parseInt(body.maxBindCount || 1, 10)
      }));
    } else if (method === 'POST' && path === '/license/activate') {
      const body = parseBody(event.body);
      response = jsonResponse(200, await service.activate({
        userId: body.userId ? String(body.userId) : null,
        deviceId: String(body.deviceId),
        code: String(body.code).trim().toUpperCase(),
        subRole: body.subRole || null
      }));
    } else if (method === 'POST' && path === '/license/verify') {
      const body = parseBody(event.body);
      response = jsonResponse(200, await service.verify({
        userId: body.userId ? String(body.userId) : null,
        deviceId: body.deviceId ? String(body.deviceId) : '',
        code: body.code ? String(body.code).trim().toUpperCase() : null
      }));
    } else if (method === 'GET' && path === '/user/status') {
      const query = parseQuery(event.queryString || '');
      response = jsonResponse(200, await service.getUserStatus({
        userId: String(query.userId),
        deviceId: String(query.deviceId)
      }));
    } else {
      response = jsonResponse(404, { message: 'Not Found' });
    }

    callback(null, response);
  } catch (error) {
    if (error instanceof LicenseError) {
      callback(null, jsonResponse(error.statusCode, { success: false, message: error.message }));
      return;
    }

    callback(null, jsonResponse(500, { success: false, message: error.message || 'Internal Server Error' }));
  }
}
