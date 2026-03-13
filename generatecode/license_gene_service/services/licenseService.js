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

function padUserId(seq) {
  return 'U' + ('000000' + String(seq)).slice(-6);
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

function computeRemainDays(expireAt) {
  if (!expireAt) {
    return 0;
  }

  const remain = expireAt - nowMs();
  if (remain <= 0) {
    return 0;
  }

  return Math.ceil(remain / (24 * 60 * 60 * 1000));
}

function normalizeLicense(license) {
  if (!license) {
    return null;
  }

  const remainDays = computeRemainDays(license.expireAt);
  const active = remainDays > 0 && license.licenseStatus !== 'banned';

  return {
    userId: license.userId,
    deviceType: license.deviceType || 'unknown',
    subRole: license.subRole || 'normal',
    expireAt: license.expireAt || 0,
    activatedCode: license.activatedCode || '',
    updatedAt: license.updatedAt || 0,
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

  const userIds = await repository.allocateUserIds(count);
  const currentTime = nowMs();

  const items = userIds.map(function mapUserId(userId) {
    return {
      userId: userId,
      code: createActivationCode(prefix),
      durationDays: durationDays,
      batchId: batchId,
      remark: remark,
      status: 'unused',
      createdAt: currentTime,
      usedAt: 0,
      usedByDeviceType: ''
    };
  });

  const initialLicenses = items.map(function mapItem(item) {
    return {
      userId: item.userId,
      deviceType: '',
      subRole: 'normal',
      expireAt: 0,
      activatedCode: item.code,
      updatedAt: currentTime,
      licenseStatus: 'inactive'
    };
  });

  console.log('generateCodes items =>', JSON.stringify(items));
  console.log('generateCodes initialLicenses =>', JSON.stringify(initialLicenses));

  await repository.batchCreateActivationCodes(items);
  await repository.batchCreateUserLicenses(initialLicenses);

  await repository.appendActivationLog({
    action: 'generate',
    code: '',
    userId: '',
    deviceType: '',
    result: 'success',
    message: 'generated ' + count + ' codes',
    time: currentTime,
    batchId: batchId
  });

  return {
    count: count,
    durationDays: durationDays,
    batchId: batchId,
    startUserId: items.length > 0 ? items[0].userId : null,
    endUserId: items.length > 0 ? items[items.length - 1].userId : null,
    items: items.map(function mapItem(item) {
      return {
        userId: item.userId,
        code: item.code
      };
    })
  };
}

async function activateCode(params) {
  const code = (params.code || '').trim().toUpperCase();
  const deviceType = (params.deviceType || 'unknown').trim() || 'unknown';

  console.log('activateCode params =>', JSON.stringify({
    code: code,
    deviceType: deviceType
  }));

  if (!code) {
    throw createHttpError(400, '激活码不能为空');
  }

  const activation = await repository.findActivationCode(code);
  console.log('activation from table =>', JSON.stringify(activation));

  if (!activation) {
    throw createHttpError(404, '激活码不存在');
  }

  if (!activation.userId) {
    throw createHttpError(500, '激活码记录缺少 userId');
  }

  if (activation.status === 'used') {
    throw createHttpError(409, '激活码已使用');
  }

  const existing = await repository.findUserLicense(activation.userId);
  console.log('existing license =>', JSON.stringify(existing));

  const current = nowMs();
  const baseExpireAt = existing && existing.expireAt > current ? existing.expireAt : current;
  const expireAt = baseExpireAt + daysToMs(activation.durationDays);

  const payload = {
    userId: activation.userId,
    deviceType: deviceType,
    subRole: existing && existing.subRole ? existing.subRole : 'normal',
    expireAt: expireAt,
    activatedCode: code,
    updatedAt: current,
    licenseStatus: 'active'
  };

  console.log('upsertUserLicense payload =>', JSON.stringify(payload));

  const saved = await repository.upsertUserLicense(payload);

  await repository.markActivationCodeUsed({
    code: code,
    usedAt: current,
    usedByDeviceType: deviceType
  });

  await repository.appendActivationLog({
    action: 'activate',
    code: code,
    userId: activation.userId,
    deviceType: deviceType,
    result: 'success',
    message: 'activated',
    time: current,
    batchId: activation.batchId || ''
  });

  const normalized = normalizeLicense(saved);
  return {
    success: true,
    userId: normalized.userId,
    deviceType: normalized.deviceType,
    subRole: normalized.subRole,
    expireAt: normalized.expireAt,
    remainDays: normalized.remainDays,
    licenseStatus: normalized.licenseStatus,
    active: normalized.active,
    activatedCode: normalized.activatedCode,
    updatedAt: normalized.updatedAt
  };
}

async function verifyCode(params) {
  const code = (params.code || '').trim().toUpperCase();
  const userId = (params.userId || '').trim().toUpperCase();
  const deviceType = (params.deviceType || 'unknown').trim() || 'unknown';

  console.log('verifyCode params =>', JSON.stringify({
    code: code,
    userId: userId,
    deviceType: deviceType
  }));

  if (code) {
    const activation = await repository.findActivationCode(code);
    console.log('verify activation from table =>', JSON.stringify(activation));

    if (!activation) {
      return {
        active: false,
        userId: '',
        deviceType: deviceType,
        subRole: 'normal',
        remainDays: 0,
        expireAt: 0,
        licenseStatus: 'code_not_found',
        activatedCode: code
      };
    }

    if (activation.status !== 'used') {
      return {
        active: false,
        userId: activation.userId,
        deviceType: deviceType,
        subRole: 'normal',
        remainDays: 0,
        expireAt: 0,
        licenseStatus: 'unused',
        activatedCode: code
      };
    }

    const license = await repository.findUserLicense(activation.userId);
    console.log('verify license from table =>', JSON.stringify(license));

    if (!license) {
      return {
        active: false,
        userId: activation.userId,
        deviceType: deviceType,
        subRole: 'normal',
        remainDays: 0,
        expireAt: 0,
        licenseStatus: 'inactive',
        activatedCode: code
      };
    }

    return normalizeLicense(license);
  }

  if (!userId) {
    throw createHttpError(400, '验证时必须提供激活码或用户 ID');
  }

  return getUserStatus({ userId: userId });
}

async function getUserStatus(params) {
  const userId = (params.userId || '').trim().toUpperCase();

  console.log('getUserStatus params =>', JSON.stringify({
    userId: userId
  }));

  if (!userId) {
    throw createHttpError(400, 'userId 不能为空');
  }

  const license = await repository.findUserLicense(userId);
  console.log('getUserStatus license =>', JSON.stringify(license));

  if (!license) {
    return {
      active: false,
      userId: userId,
      deviceType: 'unknown',
      subRole: 'normal',
      remainDays: 0,
      expireAt: 0,
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
  getUserStatus,
  padUserId
};
