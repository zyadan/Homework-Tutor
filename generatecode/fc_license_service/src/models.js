export const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export function nowMillis() {
  return Date.now();
}

export function daysToMillis(days) {
  return days * MILLIS_PER_DAY;
}

export function remainDays(expireAt, now = nowMillis()) {
  if (expireAt <= now) {
    return 0;
  }
  return Math.ceil((expireAt - now) / MILLIS_PER_DAY);
}

export function formatInternalUserId(index) {
  return `U${String(index).padStart(6, '0')}`;
}

export function mapActivationCode(row) {
  if (!row) {
    return null;
  }

  const attrs = row.attributes || {};
  return {
    code: row.code,
    durationDays: Number(attrs.duration_days || 30),
    status: attrs.status || 'unused',
    maxBindCount: Number(attrs.max_bind_count || 1),
    targetUserId: attrs.target_user_id || null,
    usedByUserId: attrs.used_by_user_id || null,
    usedByDeviceId: attrs.used_by_device_id || null,
    usedAt: attrs.used_at || null,
    createdAt: Number(attrs.created_at || 0),
    batchId: attrs.batch_id || null,
    remark: attrs.remark || null
  };
}

export function mapUserLicense(row) {
  if (!row) {
    return null;
  }

  const attrs = row.attributes || {};
  const expireAt = Number(attrs.expire_at || 0);
  return {
    userId: row.userId,
    subRole: attrs.sub_role || 'normal',
    deviceId: attrs.device_id || '',
    licenseStatus: attrs.license_status || 'expired',
    expireAt,
    remainDays: remainDays(expireAt),
    activatedCode: attrs.activated_code || null,
    updatedAt: Number(attrs.updated_at || 0),
    active: attrs.license_status === 'active' && expireAt > nowMillis()
  };
}
