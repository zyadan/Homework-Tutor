const fs = require('fs');
const path = require('path');
const Tablestore = require('tablestore');
const config = require('../config');

function toAttributeColumns(data) {
  const columns = [];
  Object.keys(data).forEach(function eachKey(key) {
    const value = data[key];
    if (value !== undefined && value !== null) {
      const column = {};
      column[key] = value;
      columns.push(column);
    }
  });
  return columns;
}

function padUserId(seq) {
  return 'U' + ('000000' + String(seq)).slice(-6);
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
}

function createEmptyStore() {
  return {
    currentUserSeq: 0,
    activationCodes: {},
    userLicenses: {},
    activationLogs: []
  };
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readMockStore() {
  if (!fs.existsSync(config.mockDataFile)) {
    return createEmptyStore();
  }

  try {
    return JSON.parse(fs.readFileSync(config.mockDataFile, 'utf8'));
  } catch (error) {
    return createEmptyStore();
  }
}

function writeMockStore(store) {
  ensureDir(config.mockDataFile);
  fs.writeFileSync(config.mockDataFile, JSON.stringify(store, null, 2), 'utf8');
}

function isMock() {
  return config.dataProvider === 'mock';
}

function createClient() {
  return new Tablestore.Client({
    accessKeyId: config.ots.accessKeyId,
    secretAccessKey: config.ots.accessKeySecret,
    endpoint: config.ots.endpoint,
    instancename: config.ots.instanceName
  });
}

function rowToObject(columns) {
  const out = {};

  if (!columns || !Array.isArray(columns)) {
    return out;
  }

  let index = 0;
  while (index < columns.length) {
    const column = columns[index];

    if (Array.isArray(column) && column.length >= 2) {
      out[column[0]] = column[1];
    } else if (column && typeof column === 'object') {
      if (column.columnName !== undefined && column.columnValue !== undefined) {
        out[column.columnName] = column.columnValue;
      } else if (column.name !== undefined && column.value !== undefined) {
        out[column.name] = column.value;
      }
    }

    index += 1;
  }

  return out;
}

async function allocateUserIdsMock(count) {
  const store = readMockStore();
  const ids = [];
  let index = 0;

  while (index < count) {
    store.currentUserSeq += 1;
    ids.push(padUserId(store.currentUserSeq));
    index += 1;
  }

  writeMockStore(store);
  return ids;
}

async function batchCreateActivationCodesMock(items) {
  const store = readMockStore();
  items.forEach(function eachItem(item) {
    store.activationCodes[item.code] = item;
  });
  writeMockStore(store);
}

async function batchCreateUserLicensesMock(items) {
  const store = readMockStore();
  items.forEach(function eachItem(item) {
    store.userLicenses[item.userId] = item;
  });
  writeMockStore(store);
}

async function findActivationCodeMock(code) {
  const store = readMockStore();
  return store.activationCodes[code] || null;
}

async function markActivationCodeUsedMock(params) {
  const store = readMockStore();
  const row = store.activationCodes[params.code];

  if (!row) {
    return;
  }

  row.status = 'used';
  row.usedAt = params.usedAt;
  row.usedByDeviceType = params.usedByDeviceType;
  store.activationCodes[params.code] = row;
  writeMockStore(store);
}

async function findUserLicenseMock(userId) {
  const store = readMockStore();
  return store.userLicenses[userId] || null;
}

async function upsertUserLicenseMock(license) {
  const store = readMockStore();
  store.userLicenses[license.userId] = license;
  writeMockStore(store);
  return license;
}

async function appendActivationLogMock(log) {
  const store = readMockStore();
  store.activationLogs.push(log);
  writeMockStore(store);
}

async function getCurrentSequenceFromTable(client) {
  try {
    const response = await client.getRow({
      tableName: config.tables.systemMeta,
      primaryKey: [{ meta_key: 'user_id_sequence' }],
      maxVersions: 1
    });

    console.log('getCurrentSequenceFromTable raw response =>', JSON.stringify(response));

    if (!response || !response.row) {
      return 0;
    }

    const row = response.row;
    const attrs = rowToObject(
      row.attributes ||
      row.attributeColumns ||
      row.columns ||
      []
    );

    console.log('getCurrentSequenceFromTable parsed attrs =>', JSON.stringify(attrs));

    return parseInt(attrs.current_value || 0, 10);
  } catch (error) {
    if (String(error && error.message || '').indexOf('OTSObjectNotExist') >= 0) {
      return 0;
    }
    throw error;
  }
}

async function saveCurrentSequenceToTable(client, value) {
  const updatedAt = Date.now();

  await client.putRow({
    tableName: config.tables.systemMeta,
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [{ meta_key: 'user_id_sequence' }],
    attributeColumns: toAttributeColumns({
      current_value: Number(value || 0),
      updated_at: Number(updatedAt),
      updated_at_text: formatDateTime(updatedAt)
    })
  });
}

async function allocateUserIdsTable(count) {
  const client = createClient();
  const current = await getCurrentSequenceFromTable(client);
  const ids = [];
  let seq = current;
  let index = 0;

  while (index < count) {
    seq += 1;
    ids.push(padUserId(seq));
    index += 1;
  }

  await saveCurrentSequenceToTable(client, seq);
  return ids;
}

async function batchCreateActivationCodesTable(items) {
  const client = createClient();
  let index = 0;

  while (index < items.length) {
    const item = items[index];

    console.log('writing activation code row =>', JSON.stringify({
      code: item.code,
      user_id: item.userId,
      duration_days: item.durationDays,
      batch_id: item.batchId,
      status: item.status
    }));

    await client.putRow({
      tableName: config.tables.activationCodes,
      condition: new Tablestore.Condition(
        Tablestore.RowExistenceExpectation.IGNORE,
        null
      ),
      primaryKey: [{ code: item.code }],
      attributeColumns: toAttributeColumns({
        user_id: String(item.userId || ''),
        duration_days: Number(item.durationDays || 0),
        batch_id: String(item.batchId || ''),
        remark: String(item.remark || ''),
        status: String(item.status || 'unused'),
        created_at: Number(item.createdAt || 0),
        created_at_text: formatDateTime(item.createdAt || 0),
        used_at: Number(item.usedAt || 0),
        used_at_text: formatDateTime(item.usedAt || 0),
        used_by_device_type: String(item.usedByDeviceType || '')
      })
    });

    index += 1;
  }
}

async function batchCreateUserLicensesTable(items) {
  const client = createClient();
  let index = 0;

  while (index < items.length) {
    const item = items[index];

    console.log('writing initial user license row =>', JSON.stringify(item));

    await client.putRow({
      tableName: config.tables.userLicense,
      condition: new Tablestore.Condition(
        Tablestore.RowExistenceExpectation.IGNORE,
        null
      ),
      primaryKey: [{ user_id: String(item.userId || '') }],
      attributeColumns: toAttributeColumns({
        device_type: String(item.deviceType || ''),
        sub_role: String(item.subRole || 'normal'),
        expire_at: Number(item.expireAt || 0),
        expire_at_text: formatDateTime(item.expireAt || 0),
        activated_code: String(item.activatedCode || ''),
        updated_at: Number(item.updatedAt || 0),
        updated_at_text: formatDateTime(item.updatedAt || 0),
        license_status: String(item.licenseStatus || 'inactive')
      })
    });

    index += 1;
  }
}

async function findActivationCodeTable(code) {
  const client = createClient();
  const response = await client.getRow({
    tableName: config.tables.activationCodes,
    primaryKey: [{ code: code }],
    maxVersions: 1
  });

  console.log('findActivationCodeTable raw response =>', JSON.stringify(response));

  if (!response || !response.row) {
    return null;
  }

  const row = response.row;
  const attrs = rowToObject(
    row.attributes ||
    row.attributeColumns ||
    row.columns ||
    []
  );

  console.log('findActivationCodeTable parsed attrs =>', JSON.stringify(attrs));

  return {
    code: code,
    userId: attrs.user_id || '',
    durationDays: parseInt(attrs.duration_days || 0, 10),
    batchId: attrs.batch_id || '',
    remark: attrs.remark || '',
    status: attrs.status || 'unused',
    createdAt: parseInt(attrs.created_at || 0, 10),
    usedAt: parseInt(attrs.used_at || 0, 10),
    usedByDeviceType: attrs.used_by_device_type || ''
  };
}

async function markActivationCodeUsedTable(params) {
  const client = createClient();
  await client.updateRow({
    tableName: config.tables.activationCodes,
    primaryKey: [{ code: params.code }],
    updateOfAttributeColumns: [
      {
        PUT: [
          { status: 'used' },
          { used_at: Number(params.usedAt || 0) },
          { used_at_text: formatDateTime(params.usedAt || 0) },
          { used_by_device_type: String(params.usedByDeviceType || '') }
        ]
      }
    ],
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    )
  });
}

async function findUserLicenseTable(userId) {
  const client = createClient();
  const response = await client.getRow({
    tableName: config.tables.userLicense,
    primaryKey: [{ user_id: userId }],
    maxVersions: 1
  });

  console.log('findUserLicenseTable raw response =>', JSON.stringify(response));

  if (!response || !response.row) {
    return null;
  }

  const row = response.row;
  const attrs = rowToObject(
    row.attributes ||
    row.attributeColumns ||
    row.columns ||
    []
  );

  console.log('findUserLicenseTable parsed attrs =>', JSON.stringify(attrs));

  return {
    userId: userId,
    deviceType: attrs.device_type || '',
    subRole: attrs.sub_role || 'normal',
    expireAt: parseInt(attrs.expire_at || 0, 10),
    activatedCode: attrs.activated_code || '',
    updatedAt: parseInt(attrs.updated_at || 0, 10),
    licenseStatus: attrs.license_status || 'inactive'
  };
}

async function upsertUserLicenseTable(license) {
  const client = createClient();

  console.log('upsertUserLicenseTable input =>', JSON.stringify(license));

  await client.putRow({
    tableName: config.tables.userLicense,
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [{ user_id: String(license.userId || '') }],
    attributeColumns: toAttributeColumns({
      device_type: String(license.deviceType || ''),
      sub_role: String(license.subRole || 'normal'),
      expire_at: Number(license.expireAt || 0),
      expire_at_text: formatDateTime(license.expireAt || 0),
      activated_code: String(license.activatedCode || ''),
      updated_at: Number(license.updatedAt || 0),
      updated_at_text: formatDateTime(license.updatedAt || 0),
      license_status: String(license.licenseStatus || 'inactive')
    })
  });

  return license;
}

async function appendActivationLogTable(log) {
  const client = createClient();

  await client.putRow({
    tableName: config.tables.activationLogs,
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [{ log_id: String(log.time) + '_' + Math.random() }],
    attributeColumns: toAttributeColumns({
      action: String(log.action || ''),
      code: String(log.code || ''),
      user_id: String(log.userId || ''),
      device_type: String(log.deviceType || ''),
      result: String(log.result || ''),
      message: String(log.message || ''),
      time: Number(log.time || 0),
      time_text: formatDateTime(log.time || 0),
      batch_id: String(log.batchId || '')
    })
  });
}

async function allocateUserIds(count) {
  return isMock() ? allocateUserIdsMock(count) : allocateUserIdsTable(count);
}

async function batchCreateActivationCodes(items) {
  return isMock() ? batchCreateActivationCodesMock(items) : batchCreateActivationCodesTable(items);
}

async function batchCreateUserLicenses(items) {
  return isMock() ? batchCreateUserLicensesMock(items) : batchCreateUserLicensesTable(items);
}

async function findActivationCode(code) {
  return isMock() ? findActivationCodeMock(code) : findActivationCodeTable(code);
}

async function markActivationCodeUsed(params) {
  return isMock() ? markActivationCodeUsedMock(params) : markActivationCodeUsedTable(params);
}

async function findUserLicense(userId) {
  return isMock() ? findUserLicenseMock(userId) : findUserLicenseTable(userId);
}

async function upsertUserLicense(license) {
  return isMock() ? upsertUserLicenseMock(license) : upsertUserLicenseTable(license);
}

async function appendActivationLog(log) {
  return isMock() ? appendActivationLogMock(log) : appendActivationLogTable(log);
}

module.exports = {
  allocateUserIds,
  batchCreateActivationCodes,
  batchCreateUserLicenses,
  findActivationCode,
  markActivationCodeUsed,
  findUserLicense,
  upsertUserLicense,
  appendActivationLog
};
