const repository = require('./repository');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function nowMs() {
  return Date.now();
}

function daysToMs(days) {
  return parseInt(days || 0, 10) * 24 * 60 * 60 * 1000;
}

function padTokenId(seq) {
  return 'T' + ('000000' + String(seq)).slice(-6);
}

function randomString(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  let index = 0;
  while (index < length) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
    index += 1;
  }
  return out;
}

function createActivationCode(prefix) {
  const safePrefix = (prefix || 'VIP').trim().toUpperCase();
  return [safePrefix, randomString(4), randomString(4), randomString(4)].join('-');
}

function computeRemainDays(expireAtTs) {
  if (!expireAtTs) {
    return 0;
  }

  const remain = expireAtTs - nowMs();
  if (remain <= 0) {
    return 0;
  }

  return Math.ceil(remain / (24 * 60 * 60 * 1000));
}

function normalizeLicense(license) {
  if (!license) {
    return null;
  }

  const expireAtTs = license.expireAtTs || 0;
  const remainDays = computeRemainDays(expireAtTs);
  const active = remainDays > 0 && license.licenseStatus !== 'banned';

  return {
    tokenId: license.tokenId,
    deviceType: license.deviceType || 'unknown',
    subRole: license.subRole || 'normal',
    expireAt: license.expireAt || '',
    expireAtTs: expireAtTs,
    activatedCode: license.activatedCode || '',
    updatedAt: license.updatedAt || '',
    updatedAtTs: license.updatedAtTs || 0,
    remainDays: remainDays,
    licenseStatus: active ? 'active' : (license.licenseStatus || 'inactive'),
    active: active
  };
}

async function generateCodes(params) {
  const count = parseInt(params.count || 0, 10);
  const durationDays = parseInt(params.durationDays || 30, 10);
  const prefix = (params.prefix || 'VIP').trim().toUpperCase();
  const batchId = (params.batchId || '').trim() || ('BATCH_' + nowMs());
  const remark = (params.remark || '').trim();

  if (!count || count < 1) {
    throw createHttpError(400, '生成数量必须大于 0');
  }

  const tokenIds = await repository.allocateTokenIds(count);
  const currentTime = nowMs();

  const items = tokenIds.map(function mapTokenId(tokenId) {
    return {
      tokenId: tokenId,
      code: createActivationCode(prefix),
      durationDays: durationDays,
      batchId: batchId,
      remark: remark,
      status: 'inactivate',
      createdAtTs: currentTime,
      usedAtTs: 0,
      usedByDeviceType: ''
    };
  });

  const initialLicenses = items.map(function mapItem(item) {
    return {
      tokenId: item.tokenId,
      deviceType: '',
      subRole: 'normal',
      expireAtTs: 0,
      activatedCode: item.code,
      updatedAtTs: currentTime,
      licenseStatus: 'inactive'
    };
  });

  await repository.batchCreateActivationCodes(items);
  await repository.batchCreateTokenLicenses(initialLicenses);

  await repository.appendActivationLog({
    action: 'generate',
    code: '',
    tokenId: '',
    deviceType: '',
    result: 'success',
    message: 'generated ' + count + ' codes',
    timeTs: currentTime,
    batchId: batchId
  });

  return {
    count: count,
    durationDays: durationDays,
    batchId: batchId,
    startTokenId: items.length > 0 ? items[0].tokenId : null,
    endTokenId: items.length > 0 ? items[items.length - 1].tokenId : null,
    items: items.map(function mapItem(item) {
      return {
        tokenId: item.tokenId,
        code: item.code
      };
    })
  };
}

async function activateCode(params) {
  const code = (params.code || '').trim().toUpperCase();
  const deviceType = (params.deviceType || 'unknown').trim() || 'unknown';

  if (!code) {
    throw createHttpError(400, '激活码不能为空');
  }

  const activation = await repository.findActivationCode(code);

  if (!activation) {
    throw createHttpError(404, '激活码不存在');
  }

  if (!activation.tokenId) {
    throw createHttpError(500, '激活码记录缺少 tokenId');
  }

  if (activation.status === 'used') {
    throw createHttpError(409, '激活码已使用');
  }

  const existing = await repository.findTokenLicense(activation.tokenId);
  const current = nowMs();
  const baseExpireAtTs = existing && existing.expireAtTs > current ? existing.expireAtTs : current;
  const expireAtTs = baseExpireAtTs + daysToMs(activation.durationDays);

  const payload = {
    tokenId: activation.tokenId,
    deviceType: deviceType,
    subRole: existing && existing.subRole ? existing.subRole : 'normal',
    expireAtTs: expireAtTs,
    activatedCode: code,
    updatedAtTs: current,
    licenseStatus: 'active'
  };

  const saved = await repository.upsertTokenLicense(payload);

  await repository.markActivationCodeUsed({
    code: code,
    usedAtTs: current,
    usedByDeviceType: deviceType
  });

  await repository.appendActivationLog({
    action: 'activate',
    code: code,
    tokenId: activation.tokenId,
    deviceType: deviceType,
    result: 'success',
    message: 'activated',
    timeTs: current,
    batchId: activation.batchId || ''
  });

  const normalized = normalizeLicense(saved);
  return {
    success: true,
    tokenId: normalized.tokenId,
    deviceType: normalized.deviceType,
    subRole: normalized.subRole,
    expireAt: normalized.expireAt,
    expireAtTs: normalized.expireAtTs,
    remainDays: normalized.remainDays,
    licenseStatus: normalized.licenseStatus,
    active: normalized.active,
    activatedCode: normalized.activatedCode,
    updatedAt: normalized.updatedAt,
    updatedAtTs: normalized.updatedAtTs
  };
}

async function verifyCode(params) {
  const code = (params.code || '').trim().toUpperCase();
  const tokenId = (params.tokenId || '').trim().toUpperCase();
  const deviceType = (params.deviceType || 'unknown').trim() || 'unknown';

  if (code) {
    const activation = await repository.findActivationCode(code);

    if (!activation) {
      return {
        active: false,
        tokenId: '',
        deviceType: deviceType,
        subRole: 'normal',
        remainDays: 0,
        expireAt: '',
        expireAtTs: 0,
        licenseStatus: 'code_not_found',
        activatedCode: code
      };
    }

    if (activation.status !== 'used') {
      return {
        active: false,
        tokenId: activation.tokenId,
        deviceType: deviceType,
        subRole: 'normal',
        remainDays: 0,
        expireAt: '',
        expireAtTs: 0,
        licenseStatus: 'inactivate',
        activatedCode: code
      };
    }

    const license = await repository.findTokenLicense(activation.tokenId);

    if (!license) {
      return {
        active: false,
        tokenId: activation.tokenId,
        deviceType: deviceType,
        subRole: 'normal',
        remainDays: 0,
        expireAt: '',
        expireAtTs: 0,
        licenseStatus: 'inactive',
        activatedCode: code
      };
    }

    return normalizeLicense(license);
  }

  if (!tokenId) {
    throw createHttpError(400, '验证时必须提供激活码或 tokenId');
  }

  return getTokenStatus({ tokenId: tokenId });
}

async function getTokenStatus(params) {
  const tokenId = (params.tokenId || '').trim().toUpperCase();

  if (!tokenId) {
    throw createHttpError(400, 'tokenId 不能为空');
  }

  const license = await repository.findTokenLicense(tokenId);

  if (!license) {
    return {
      active: false,
      tokenId: tokenId,
      deviceType: 'unknown',
      subRole: 'normal',
      remainDays: 0,
      expireAt: '',
      expireAtTs: 0,
      licenseStatus: 'inactive',
      activatedCode: ''
    };
  }

  return normalizeLicense(license);
}

module.exports = {
  generateCodes,
  activateCode,
  verifyCode,
  getTokenStatus,
  padTokenId
};
