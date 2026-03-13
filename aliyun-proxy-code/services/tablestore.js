'use strict';
const TableStore = require('tablestore');
const config = require('../config');

const tsClient = new TableStore.Client({
  accessKeyId: config.tableDataAccessKeyId,
  secretAccessKey: config.tableDataSecretAccessKey,
  endpoint: config.tablestoreEndpoint,
  instancename: config.tablestoreInstance,
  timeout: 30000, 
});

module.exports = {
  tsClient,
  TableStore
};