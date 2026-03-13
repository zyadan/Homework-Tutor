const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const createLicenseRouter = require('./routes/license');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/health', function healthHandler(req, res) {
  res.json({
    ok: true,
    service: 'license-gene-service',
    provider: config.dataProvider,
    port: config.port
  });
});

app.use('/', createLicenseRouter());

app.use(function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Not Found'
  });
});

app.use(function errorHandler(err, req, res, next) {
  logger.error('request failed', err && err.stack ? err.stack : err);

  res.status(err && err.statusCode ? err.statusCode : 500).json({
    success: false,
    message: err && err.message ? err.message : 'Internal Server Error'
  });
});

if (require.main === module) {
  const listenPort = config.port || 9000;
  const listenHost = '0.0.0.0';

  app.listen(listenPort, listenHost, function onListen() {
    logger.info('license service listening on http://' + listenHost + ':' + listenPort);
  });
}

