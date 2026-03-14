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

function padTokenId(seq) {
  return 'T' + ('000000' + String(seq)).slice(-6);
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
    currentTokenSeq: 0,
    activationCodes: {},
    tokenLicenses: {},
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

async function allocateTokenIdsMock(count) {
  const store = readMockStore();
  const ids = [];
  let index = 0;

  while (index < count) {
    store.currentTokenSeq += 1;
    ids.push(padTokenId(store.currentTokenSeq));
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

async function batchCreateTokenLicensesMock(items) {
  const store = readMockStore();
  items.forEach(function eachItem(item) {
    store.tokenLicenses[item.tokenId] = {
      tokenId: item.tokenId,
      deviceType: item.deviceType,
      subRole: item.subRole,
      expireAt: formatDateTime(item.expireAtTs || 0),
      expireAtTs: item.expireAtTs || 0,
      activatedCode: item.activatedCode,
      updatedAt: formatDateTime(item.updatedAtTs || 0),
      updatedAtTs: item.updatedAtTs || 0,
      licenseStatus: item.licenseStatus
    };
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
  row.usedAtTs = params.usedAtTs;
  row.usedAt = formatDateTime(params.usedAtTs || 0);
  row.usedByDeviceType = params.usedByDeviceType;
  store.activationCodes[params.code] = row;
  writeMockStore(store);
}

async function findTokenLicenseMock(tokenId) {
  const store = readMockStore();
  return store.tokenLicenses[tokenId] || null;
}

async function upsertTokenLicenseMock(license) {
  const store = readMockStore();
  store.tokenLicenses[license.tokenId] = {
    tokenId: license.tokenId,
    deviceType: license.deviceType,
    subRole: license.subRole,
    expireAt: formatDateTime(license.expireAtTs || 0),
    expireAtTs: license.expireAtTs || 0,
    activatedCode: license.activatedCode,
    updatedAt: formatDateTime(license.updatedAtTs || 0),
    updatedAtTs: license.updatedAtTs || 0,
    licenseStatus: license.licenseStatus
  };
  writeMockStore(store);
  return store.tokenLicenses[license.tokenId];
}

async function appendActivationLogMock(log) {
  const store = readMockStore();
  store.activationLogs.push({
    action: log.action,
    code: log.code,
    tokenId: log.tokenId,
    deviceType: log.deviceType,
    result: log.result,
    message: log.message,
    time: formatDateTime(log.timeTs || 0),
    timeTs: log.timeTs || 0,
    batchId: log.batchId
  });
  writeMockStore(store);
}

async function getCurrentSequenceFromTable(client) {
  try {
    const response = await client.getRow({
      tableName: config.tables.systemMeta,
      primaryKey: [{ meta_key: 'token_id_sequence' }],
      maxVersions: 1
    });

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

    return parseInt(attrs.current_value || 0, 10);
  } catch (error) {
    if (String(error && error.message || '').indexOf('OTSObjectNotExist') >= 0) {
      return 0;
    }
    throw error;
  }
}

async function saveCurrentSequenceToTable(client, value) {
  const updatedAtTs = Date.now();

  await client.putRow({
    tableName: config.tables.systemMeta,
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [{ meta_key: 'token_id_sequence' }],
    attributeColumns: toAttributeColumns({
      current_value: Number(value || 0),
      updated_at: formatDateTime(updatedAtTs),
      updated_at_ts: Number(updatedAtTs)
    })
  });
}

async function allocateTokenIdsTable(count) {
  const client = createClient();
  const current = await getCurrentSequenceFromTable(client);
  const ids = [];
  let seq = current;
  let index = 0;

  while (index < count) {
    seq += 1;
    ids.push(padTokenId(seq));
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

    await client.putRow({
      tableName: config.tables.activationCodes,
      condition: new Tablestore.Condition(
        Tablestore.RowExistenceExpectation.IGNORE,
        null
      ),
      primaryKey: [{ code: item.code }],
      attributeColumns: toAttributeColumns({
        token_id: String(item.tokenId || ''),
        duration_days: Number(item.durationDays || 0),
        batch_id: String(item.batchId || ''),
        remark: String(item.remark || ''),
        status: String(item.status || 'inactivate'),
        created_at: formatDateTime(item.createdAtTs || 0),
        created_at_ts: Number(item.createdAtTs || 0),
        used_at: formatDateTime(item.usedAtTs || 0),
        used_at_ts: Number(item.usedAtTs || 0),
        used_by_device_type: String(item.usedByDeviceType || '')
      })
    });

    index += 1;
  }
}

async function batchCreateTokenLicensesTable(items) {
  const client = createClient();
  let index = 0;

  while (index < items.length) {
    const item = items[index];

    await client.putRow({
      tableName: config.tables.tokenLicense,
      condition: new Tablestore.Condition(
        Tablestore.RowExistenceExpectation.IGNORE,
        null
      ),
      primaryKey: [{ token_id: String(item.tokenId || '') }],
      attributeColumns: toAttributeColumns({
        device_type: String(item.deviceType || ''),
        sub_role: String(item.subRole || 'normal'),
        expire_at: formatDateTime(item.expireAtTs || 0),
        expire_at_ts: Number(item.expireAtTs || 0),
        activated_code: String(item.activatedCode || ''),
        updated_at: formatDateTime(item.updatedAtTs || 0),
        updated_at_ts: Number(item.updatedAtTs || 0),
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

  return {
    code: code,
    tokenId: attrs.token_id || '',
    durationDays: parseInt(attrs.duration_days || 0, 10),
    batchId: attrs.batch_id || '',
    remark: attrs.remark || '',
    status: attrs.status || 'inactivate',
    createdAt: attrs.created_at || '',
    createdAtTs: parseInt(attrs.created_at_ts || 0, 10),
    usedAt: attrs.used_at || '',
    usedAtTs: parseInt(attrs.used_at_ts || 0, 10),
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
          { used_at: formatDateTime(params.usedAtTs || 0) },
          { used_at_ts: Number(params.usedAtTs || 0) },
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

async function findTokenLicenseTable(tokenId) {
  const client = createClient();
  const response = await client.getRow({
    tableName: config.tables.tokenLicense,
    primaryKey: [{ token_id: tokenId }],
    maxVersions: 1
  });

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

  return {
    tokenId: tokenId,
    deviceType: attrs.device_type || '',
    subRole: attrs.sub_role || 'normal',
    expireAt: attrs.expire_at || '',
    expireAtTs: parseInt(attrs.expire_at_ts || 0, 10),
    activatedCode: attrs.activated_code || '',
    updatedAt: attrs.updated_at || '',
    updatedAtTs: parseInt(attrs.updated_at_ts || 0, 10),
    licenseStatus: attrs.license_status || 'inactive'
  };
}

async function upsertTokenLicenseTable(license) {
  const client = createClient();

  await client.putRow({
    tableName: config.tables.tokenLicense,
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [{ token_id: String(license.tokenId || '') }],
    attributeColumns: toAttributeColumns({
      device_type: String(license.deviceType || ''),
      sub_role: String(license.subRole || 'normal'),
      expire_at: formatDateTime(license.expireAtTs || 0),
      expire_at_ts: Number(license.expireAtTs || 0),
      activated_code: String(license.activatedCode || ''),
      updated_at: formatDateTime(license.updatedAtTs || 0),
      updated_at_ts: Number(license.updatedAtTs || 0),
      license_status: String(license.licenseStatus || 'inactive')
    })
  });

  return {
    tokenId: license.tokenId,
    deviceType: license.deviceType || '',
    subRole: license.subRole || 'normal',
    expireAt: formatDateTime(license.expireAtTs || 0),
    expireAtTs: Number(license.expireAtTs || 0),
    activatedCode: license.activatedCode || '',
    updatedAt: formatDateTime(license.updatedAtTs || 0),
    updatedAtTs: Number(license.updatedAtTs || 0),
    licenseStatus: license.licenseStatus || 'inactive'
  };
}

async function appendActivationLogTable(log) {
  const client = createClient();

  await client.putRow({
    tableName: config.tables.activationLogs,
    condition: new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [{ log_id: String(log.timeTs) + '_' + Math.random() }],
    attributeColumns: toAttributeColumns({
      action: String(log.action || ''),
      code: String(log.code || ''),
      token_id: String(log.tokenId || ''),
      device_type: String(log.deviceType || ''),
      result: String(log.result || ''),
      message: String(log.message || ''),
      time: formatDateTime(log.timeTs || 0),
      time_ts: Number(log.timeTs || 0),
      batch_id: String(log.batchId || '')
    })
  });
}

async function allocateTokenIds(count) {
  return isMock() ? allocateTokenIdsMock(count) : allocateTokenIdsTable(count);
}

async function batchCreateActivationCodes(items) {
  return isMock() ? batchCreateActivationCodesMock(items) : batchCreateActivationCodesTable(items);
}

async function batchCreateTokenLicenses(items) {
  return isMock() ? batchCreateTokenLicensesMock(items) : batchCreateTokenLicensesTable(items);
}

async function findActivationCode(code) {
  return isMock() ? findActivationCodeMock(code) : findActivationCodeTable(code);
}

async function markActivationCodeUsed(params) {
  return isMock() ? markActivationCodeUsedMock(params) : markActivationCodeUsedTable(params);
}

async function findTokenLicense(tokenId) {
  return isMock() ? findTokenLicenseMock(tokenId) : findTokenLicenseTable(tokenId);
}

async function upsertTokenLicense(license) {
  return isMock() ? upsertTokenLicenseMock(license) : upsertTokenLicenseTable(license);
}

async function appendActivationLog(log) {
  return isMock() ? appendActivationLogMock(log) : appendActivationLogTable(log);
}

module.exports = {
  allocateTokenIds,
  batchCreateActivationCodes,
  batchCreateTokenLicenses,
  findActivationCode,
  markActivationCodeUsed,
  findTokenLicense,
  upsertTokenLicense,
  appendActivationLog
};
