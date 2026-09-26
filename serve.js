// Minimal static file server for local preview: node serve.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = +process.argv[2] || 8777;
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // dev aid: POST a PNG data URL to /__shot?name=x to save it for inspection (only with --shots=DIR)
  if (req.method === 'POST' && url === '/__shot' && shots) {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      const name = (req.url.split('name=')[1] || 'shot').replace(/[^\w-]/g, '');
      fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(body.split(',')[1], 'base64'));
      res.writeHead(204); res.end();
    });
    return;
  }
  const file = path.normalize(path.join(root, url === '/' ? 'index.html' : url));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`GENESIS on http://localhost:${port}`));
