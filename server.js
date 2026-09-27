const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const file = clean === '/' ? 'index.html' : `${clean.replace(/^\/+/, '').replace(/\/$/, '')}${clean.endsWith('/') ? '/index.html' : ''}`;
  const target = path.resolve(root, file);
  if (!target.startsWith(root)) return res.writeHead(403).end('Forbidden');
  fs.readFile(target, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log('FixBondhu MVP → http://localhost:3000'));
