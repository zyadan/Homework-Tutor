import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Tablestore from 'tablestore';

import { validateTablestoreSettings } from './config.js';
import { formatInternalUserId, mapActivationCode, mapUserLicense, nowMillis, remainDays } from './models.js';

function createUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return [
    crypto.randomBytes(4).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(6).toString('hex')
  ].join('-');
}

function attrsToObject(attributes = []) {
  const result = {};
  for (const item of attributes) {
    if (Array.isArray(item) && item.length >= 2) {
      result[item[0]] = item[1];
    }
  }
  return result;
}

function wrapGetRow(client, params) {
  return new Promise((resolve, reject) => {
    client.getRow(params, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data.row || null);
    });
  });
}

function wrapPutRow(client, params) {
  return new Promise((resolve, reject) => {
    client.putRow(params, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

export class MockLicenseRepository {
  constructor(settings) {
    this.settings = settings;
    this.storeFile = path.resolve(settings.mockDataFile);
    this.activationCodes = new Map();
    this.userLicenses = new Map();
    this.logs = [];
    this.currentUserSeq = 0;
    this._load();
  }

  _load() {
    if (!fs.existsSync(this.storeFile)) {
      return;
    }

    const raw = fs.readFileSync(this.storeFile, 'utf8');
    if (!raw.trim()) {
      return;
    }

    const data = JSON.parse(raw);
    this.currentUserSeq = Number(data.currentUserSeq || 0);
    this.activationCodes = new Map(Object.entries(data.activationCodes || {}));
    this.userLicenses = new Map(Object.entries(data.userLicenses || {}));
    this.logs = Array.isArray(data.logs) ? data.logs : [];
  }

  _save() {
    const payload = {
      currentUserSeq: this.currentUserSeq,
      activationCodes: Object.fromEntries(this.activationCodes.entries()),
      userLicenses: Object.fromEntries(this.userLicenses.entries()),
      logs: this.logs
    };
    fs.writeFileSync(this.storeFile, JSON.stringify(payload, null, 2), 'utf8');
  }

  async reserveUserIds(count) {
    const start = this.currentUserSeq + 1;
    this.currentUserSeq += count;
    this._save();
    return Array.from({ length: count }, (_, index) => formatInternalUserId(start + index));
  }

  async getActivationCode(code) {
    return this.activationCodes.get(code) || null;
  }

  async saveActivationCode(code, durationDays, batchId, remark, maxBindCount = 1, targetUserId = null) {
    this.activationCodes.set(code, {
      code,
      durationDays,
      status: 'unused',
      maxBindCount,
      usedByUserId: null,
      usedByDeviceId: null,
      usedAt: null,
      createdAt: nowMillis(),
      batchId,
      remark,
      targetUserId
    });
    this._save();
  }

  async markCodeUsed(code, userId, deviceId) {
    const current = this.activationCodes.get(code);
    if (!current) {
      return;
    }
    this.activationCodes.set(code, {
      ...current,
      status: 'used',
      usedByUserId: userId,
      usedByDeviceId: deviceId,
      usedAt: nowMillis()
    });
    this._save();
  }

  async getUserLicense(userId) {
    const row = this.userLicenses.get(userId);
    if (!row) {
      return null;
    }
    return {
      ...row,
      remainDays: remainDays(row.expireAt),
      active: row.licenseStatus === 'active' && row.expireAt > nowMillis()
    };
  }

  async upsertUserLicense(userId, deviceId, subRole, expireAt, activatedCode) {
    const current = nowMillis();
    const next = {
      userId,
      deviceId,
      subRole,
      expireAt,
      activatedCode,
      updatedAt: current,
      remainDays: remainDays(expireAt, current),
      licenseStatus: expireAt > current ? 'active' : 'expired',
      active: expireAt > current
    };
    this.userLicenses.set(userId, next);
    this._save();
    return next;
  }

  async writeLog(userId, deviceId, code, action, result, message) {
    this.logs.push({
      logId: createUuid(),
      userId,
      deviceId,
      code,
      action,
      result,
      message,
      time: nowMillis()
    });
    this._save();
  }
}

export class TablestoreLicenseRepository {
  constructor(settings) {
    validateTablestoreSettings(settings);
    this.settings = settings;
    this.client = new Tablestore.Client({
      accessKeyId: settings.otsAccessKeyId,
      secretAccessKey: settings.otsAccessKeySecret,
      endpoint: settings.otsEndpoint,
      instancename: settings.otsInstanceName
    });
  }

  async reserveUserIds(count) {
    const row = await wrapGetRow(this.client, {
      tableName: this.settings.metaTable,
      primaryKey: [{ meta_key: 'user_id_sequence' }],
      maxVersions: 1
    });

    const attrs = row ? attrsToObject(row.attributes) : {};
    const currentValue = Number(attrs.current_value || 0);
    const nextValue = currentValue + count;

    await wrapPutRow(this.client, {
      tableName: this.settings.metaTable,
      condition: new Tablestore.Condition(Tablestore.RowExistenceExpectation.IGNORE, null),
      primaryKey: [{ meta_key: 'user_id_sequence' }],
      attributeColumns: [
        { current_value: nextValue },
        { updated_at: nowMillis() }
      ]
    });

    return Array.from({ length: count }, (_, index) => formatInternalUserId(currentValue + index + 1));
  }

  async getActivationCode(code) {
    const row = await wrapGetRow(this.client, {
      tableName: this.settings.activationTable,
      primaryKey: [{ code }],
      maxVersions: 1
    });

    if (!row) {
      return null;
    }

    return mapActivationCode({
      code,
      attributes: attrsToObject(row.attributes)
    });
  }

  async saveActivationCode(code, durationDays, batchId, remark, maxBindCount = 1, targetUserId = null) {
    await wrapPutRow(this.client, {
      tableName: this.settings.activationTable,
      condition: new Tablestore.Condition(Tablestore.RowExistenceExpectation.IGNORE, null),
      primaryKey: [{ code }],
      attributeColumns: [
        { duration_days: durationDays },
        { status: 'unused' },
        { max_bind_count: maxBindCount },
        { created_at: nowMillis() },
        { batch_id: batchId || '' },
        { remark: remark || '' },
        { target_user_id: targetUserId || '' }
      ]
    });
  }

  async markCodeUsed(code, userId, deviceId) {
    await wrapPutRow(this.client, {
      tableName: this.settings.activationTable,
      condition: new Tablestore.Condition(Tablestore.RowExistenceExpectation.IGNORE, null),
      primaryKey: [{ code }],
      attributeColumns: [
        { status: 'used' },
        { used_by_user_id: userId },
        { used_by_device_id: deviceId },
        { used_at: nowMillis() }
      ]
    });
  }

  async getUserLicense(userId) {
    const row = await wrapGetRow(this.client, {
      tableName: this.settings.userLicenseTable,
      primaryKey: [{ user_id: userId }],
      maxVersions: 1
    });

    if (!row) {
      return null;
    }

    return mapUserLicense({
      userId,
      attributes: attrsToObject(row.attributes)
    });
  }

  async upsertUserLicense(userId, deviceId, subRole, expireAt, activatedCode) {
    const current = nowMillis();
    await wrapPutRow(this.client, {
      tableName: this.settings.userLicenseTable,
      condition: new Tablestore.Condition(Tablestore.RowExistenceExpectation.IGNORE, null),
      primaryKey: [{ user_id: userId }],
      attributeColumns: [
        { sub_role: subRole },
        { device_id: deviceId },
        { license_status: expireAt > current ? 'active' : 'expired' },
        { expire_at: expireAt },
        { remain_days: remainDays(expireAt, current) },
        { activated_code: activatedCode },
        { updated_at: current }
      ]
    });

    return this.getUserLicense(userId);
  }

  async writeLog(userId, deviceId, code, action, result, message) {
    await wrapPutRow(this.client, {
      tableName: this.settings.activationLogTable,
      condition: new Tablestore.Condition(Tablestore.RowExistenceExpectation.IGNORE, null),
      primaryKey: [{ log_id: createUuid() }],
      attributeColumns: [
        { user_id: userId },
        { device_id: deviceId },
        { code },
        { action },
        { result },
        { message },
        { time: nowMillis() }
      ]
    });
  }
}

export function createRepository(settings) {
  if (settings.dataProvider === 'mock') {
    return new MockLicenseRepository(settings);
  }
  return new TablestoreLicenseRepository(settings);
}
