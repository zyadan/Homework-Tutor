export function getSettings() {
  return {
    otsEndpoint: process.env.OTS_ENDPOINT || '',
    otsInstanceName: process.env.OTS_INSTANCE_NAME || '',
    otsAccessKeyId: process.env.OTS_ACCESS_KEY_ID || '',
    otsAccessKeySecret: process.env.OTS_ACCESS_KEY_SECRET || '',
    activationTable: process.env.ACTIVATION_TABLE || 'activation_codes',
    userLicenseTable: process.env.USER_LICENSE_TABLE || 'user_license',
    activationLogTable: process.env.ACTIVATION_LOG_TABLE || 'activation_logs',
    metaTable: process.env.META_TABLE || 'system_meta',
    mockDataFile: process.env.MOCK_DATA_FILE || './.mock-license-store.json',
    adminToken: process.env.ADMIN_TOKEN || '',
    defaultSubRole: process.env.DEFAULT_SUB_ROLE || 'normal',
    defaultDurationDays: Number.parseInt(process.env.DEFAULT_DURATION_DAYS || '30', 10),
    dataProvider: process.env.DATA_PROVIDER || 'tablestore'
  };
}

export function validateTablestoreSettings(settings) {
  const required = [
    ['OTS_ENDPOINT', settings.otsEndpoint],
    ['OTS_INSTANCE_NAME', settings.otsInstanceName],
    ['OTS_ACCESS_KEY_ID', settings.otsAccessKeyId],
    ['OTS_ACCESS_KEY_SECRET', settings.otsAccessKeySecret]
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
