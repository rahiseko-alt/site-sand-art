const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SITE_DIR = path.join(__dirname, 'site');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.rsc': 'text/x-component; charset=utf-8'
};

function serveFile(req, res, filePath, customMime) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = customMime || MIME_TYPES[ext] || 'application/octet-stream';

    // Handle range requests for MP4 videos
    if (ext === '.mp4' && req.headers.range) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      file.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname || '/');

  // 1. Handle /_next/image?url=...
  if (pathname === '/_next/image') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400);
      res.end('Missing url param');
      return;
    }
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      try {
        const u = new URL(targetUrl);
        const rel = u.pathname.replace('/storage/v1/object/public/', '_supabase/');
        const localSupa = path.join(SITE_DIR, rel);
        if (fs.existsSync(localSupa)) {
          return serveFile(req, res, localSupa);
        }
      } catch (e) {}
      res.writeHead(302, { Location: targetUrl });
      res.end();
      return;
    } else {
      const localImg = path.join(SITE_DIR, targetUrl.split('?')[0]);
      return serveFile(req, res, localImg);
    }
  }

  // 2. Stub out analytics scripts if missing
  if (pathname === '/_vercel/insights/script.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end('// vercel insights stub');
    return;
  }

  // 3. Root redirect / serve
  if (pathname === '/') {
    pathname = '/en';
  }

  const cleanPath = pathname.replace(/\/+$/, '');

  // 4. Check if client is requesting Next.js RSC payload
  if (req.headers['rsc'] === '1') {
    const rscFile = path.join(SITE_DIR, cleanPath + '.rsc');
    if (fs.existsSync(rscFile)) {
      return serveFile(req, res, rscFile, 'text/x-component; charset=utf-8');
    }
  }

  // 5. Direct file match in SITE_DIR
  const exactPath = path.join(SITE_DIR, cleanPath);
  if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
    return serveFile(req, res, exactPath);
  }

  // 6. HTML page match (cleanPath.html or cleanPath/index.html)
  const htmlFile = path.join(SITE_DIR, cleanPath + '.html');
  if (fs.existsSync(htmlFile)) {
    return serveFile(req, res, htmlFile, 'text/html; charset=utf-8');
  }

  const indexFile = path.join(SITE_DIR, cleanPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    return serveFile(req, res, indexFile, 'text/html; charset=utf-8');
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found: ' + pathname);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
