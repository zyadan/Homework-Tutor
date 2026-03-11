import http from 'node:http';

import { handler } from './app.js';

const port = Number.parseInt(process.env.PORT || '9000', 10);

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    handler({
      method: req.method,
      path: req.url.split('?')[0],
      queryString: req.url.includes('?') ? req.url.split('?')[1] : '',
      headers: req.headers,
      body
    }, {}, (error, response) => {
      if (error) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }));
        return;
      }

      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
    });
  });
});

server.listen(port, () => {
  console.log(`license service listening on http://127.0.0.1:${port}`);
});
