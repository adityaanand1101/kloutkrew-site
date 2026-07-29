const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const ROOT = __dirname;
const PORT = 8000;
const SUBMISSIONS_FILE = path.join(ROOT, '_submissions.json');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function saveSubmission(data) {
  let submissions = [];
  try {
    submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
  } catch (_) {}
  submissions.push({ ...data, receivedAt: new Date().toISOString() });
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

http.createServer((req, res) => {
  const method = req.method.toUpperCase();

  // --- API: Handle form submissions ---
  if (method === 'POST' && req.url === '/api/contact') {
    readBody(req).then(body => {
      const params = querystring.parse(body);
      const name = params.name || '';
      const email = params.email || '';
      const message = params.message || '';
      const phone = params.phone || '';
      const source = params.source || params['email-form-name'] || '';

      saveSubmission({ name, email, phone, message, source });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Thank you! We\'ll be in touch soon.' }));
    }).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: 'Server error' }));
    });
    return;
  }

  // --- API: View submissions (only from localhost) ---
  if (method === 'GET' && req.url === '/api/submissions') {
    const ip = req.socket.remoteAddress;
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    try {
      const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (_) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // --- Static file serving ---
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/service' || urlPath === '/services') urlPath = '/services.html';
  if (urlPath === '/about' || urlPath === '/about-us' || urlPath === '/aboutus' || urlPath === '/about-us.html' || urlPath === '/About Us.html') urlPath = '/about.html';
  if (urlPath === '/projects' || urlPath === '/work' || urlPath === '/works') urlPath = '/works.html';
  if (urlPath === '/favicon.ico') urlPath = '/favicon.svg';
  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found: ' + urlPath); }
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    const cacheMaxAge = isHtml ? 0 : 31536000;
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=' + cacheMaxAge + (isHtml ? ', must-revalidate' : ', immutable'),
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => console.log('Serving ' + ROOT + ' on http://localhost:' + PORT));
