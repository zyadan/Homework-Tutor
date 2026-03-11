import { generateActivationCodes } from './codegen.js';
import { LicenseError } from './errors.js';
import { daysToMillis, nowMillis } from './models.js';

export class LicenseService {
  constructor(repository, settings) {
    this.repository = repository;
    this.settings = settings;
  }

  async generateCodes({
    count,
    durationDays,
    prefix = 'VIP',
    batchId = null,
    remark = null,
    maxBindCount = 1
  }) {
    const actualDuration = durationDays || this.settings.defaultDurationDays;
    if (!Number.isInteger(count) || count <= 0) {
      throw new LicenseError('count must be greater than 0');
    }
    if (!Number.isInteger(actualDuration) || actualDuration <= 0) {
      throw new LicenseError('durationDays must be greater than 0');
    }

    const userIds = await this.repository.reserveUserIds(count);
    const codes = generateActivationCodes(count, prefix);
    const items = [];

    for (let i = 0; i < codes.length; i += 1) {
      const code = codes[i];
      const targetUserId = userIds[i];
      items.push({ userId: targetUserId, code });
      await this.repository.saveActivationCode(
        code,
        actualDuration,
        batchId,
        remark,
        maxBindCount,
        targetUserId
      );
      await this.repository.writeLog(
        targetUserId,
        '',
        code,
        'generate',
        'success',
        `duration=${actualDuration}`
      );
    }

    return {
      count: items.length,
      durationDays: actualDuration,
      batchId,
      startUserId: items.length > 0 ? items[0].userId : null,
      endUserId: items.length > 0 ? items[items.length - 1].userId : null,
      items
    };
  }

  async activate({ userId = null, deviceId, code, subRole = null }) {
    const activationCode = await this.repository.getActivationCode(code);
    const resolvedUserId = activationCode && activationCode.targetUserId
      ? activationCode.targetUserId
      : userId;
    if (!activationCode) {
      await this.repository.writeLog(userId || '', deviceId, code, 'activate', 'reject', 'code_not_found');
      throw new LicenseError('激活码不存在', 404);
    }
    if (activationCode.status !== 'unused') {
      await this.repository.writeLog(resolvedUserId || '', deviceId, code, 'activate', 'reject', 'code_used');
      throw new LicenseError('激活码已使用');
    }
    if (!resolvedUserId) {
      await this.repository.writeLog('', deviceId, code, 'activate', 'reject', 'user_missing');
      throw new LicenseError('激活码未绑定内部用户ID', 500);
    }
    if (userId && activationCode.targetUserId && activationCode.targetUserId !== userId) {
      await this.repository.writeLog(userId, deviceId, code, 'activate', 'reject', 'user_mismatch');
      throw new LicenseError('该激活码不属于当前用户', 403);
    }

    const currentLicense = await this.repository.getUserLicense(resolvedUserId);
    const now = nowMillis();
    const baseExpireAt = currentLicense && currentLicense.expireAt > now ? currentLicense.expireAt : now;
    const newExpireAt = baseExpireAt + daysToMillis(activationCode.durationDays);
    const targetSubRole = subRole || (currentLicense ? currentLicense.subRole : this.settings.defaultSubRole);

    const licenseRecord = await this.repository.upsertUserLicense(
      resolvedUserId,
      deviceId,
      targetSubRole,
      newExpireAt,
      code
    );
    await this.repository.markCodeUsed(code, resolvedUserId, deviceId);
    await this.repository.writeLog(resolvedUserId, deviceId, code, 'activate', 'success', `expire_at=${newExpireAt}`);

    return {
      success: true,
      ...licenseRecord
    };
  }

  async verify({ userId = null, deviceId = '', code = null }) {
    if (code) {
      const activationCode = await this.repository.getActivationCode(code);
      if (!activationCode) {
        await this.repository.writeLog('', deviceId, code, 'verify', 'reject', 'code_not_found');
        return {
          active: false,
          userId: '',
          deviceId,
          subRole: this.settings.defaultSubRole,
          remainDays: 0,
          expireAt: 0,
          licenseStatus: 'code_not_found',
          activatedCode: code
        };
      }

      if (activationCode.status === 'unused') {
        await this.repository.writeLog(
          activationCode.targetUserId || '',
          deviceId,
          code,
          'verify',
          'success',
          'unused'
        );
        return {
          active: false,
          userId: activationCode.targetUserId || '',
          deviceId,
          subRole: this.settings.defaultSubRole,
          remainDays: 0,
          expireAt: 0,
          licenseStatus: 'unused',
          activatedCode: code
        };
      }

      const resolvedUserId = activationCode.targetUserId || userId || '';
      const licenseRecord = await this.repository.getUserLicense(resolvedUserId);
      if (!licenseRecord) {
        await this.repository.writeLog(resolvedUserId, deviceId, code, 'verify', 'reject', 'license_not_found');
        return {
          active: false,
          userId: resolvedUserId,
          deviceId,
          subRole: this.settings.defaultSubRole,
          remainDays: 0,
          expireAt: 0,
          licenseStatus: 'not_found',
          activatedCode: code
        };
      }

      await this.repository.writeLog(
        resolvedUserId,
        deviceId,
        code,
        'verify',
        'success',
        licenseRecord.licenseStatus
      );
      return licenseRecord;
    }

    const licenseRecord = await this.repository.getUserLicense(userId);
    if (!licenseRecord) {
      await this.repository.writeLog(userId || '', deviceId, '', 'verify', 'reject', 'license_not_found');
      return {
        active: false,
        userId: userId || '',
        deviceId,
        subRole: this.settings.defaultSubRole,
        remainDays: 0,
        expireAt: 0,
        licenseStatus: 'not_found'
      };
    }

    await this.repository.writeLog(
      userId || '',
      deviceId,
      licenseRecord.activatedCode || '',
      'verify',
      'success',
      licenseRecord.licenseStatus
    );
    return licenseRecord;
  }

  async getUserStatus({ userId, deviceId }) {
    return this.verify({ userId: userId, deviceId: deviceId });
  }
}
