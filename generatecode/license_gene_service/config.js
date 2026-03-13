const path = require('path');

const port = Number(process.env.PORT || 9000);

module.exports = {
  port: Number.isFinite(port) && port > 0 ? port : 9000,
  debug: process.env.DEBUG === '1' || process.env.DEBUG === 'true',
  adminToken: process.env.ADMIN_TOKEN || 'test-admin',
  dataProvider: process.env.DATA_PROVIDER || 'mock',
  mockDataFile: path.resolve(
    process.cwd(),
    process.env.MOCK_DATA_FILE || './.mock-license-store.json'
  ),
  ots: {
    endpoint: process.env.OTS_ENDPOINT || '',
    instanceName: process.env.OTS_INSTANCE_NAME || '',
    accessKeyId: process.env.OTS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OTS_ACCESS_KEY_SECRET || ''
  },
  tables: {
    activationCodes: process.env.OTS_TABLE_ACTIVATION_CODES || 'activation_codes',
    userLicense: process.env.OTS_TABLE_USER_LICENSE || 'user_license',
    activationLogs: process.env.OTS_TABLE_ACTIVATION_LOGS || 'activation_logs',
    systemMeta: process.env.OTS_TABLE_SYSTEM_META || 'system_meta'
  }
};
