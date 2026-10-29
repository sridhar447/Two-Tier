// Tier 2: Backend API & Telemetry Data Store
// Supports both Express (if installed) or Native Node.js HTTP fallback (zero dependencies required)

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// In-Memory Database (Tier 2 Data Tier)
let telemetryLogs = [];
let leaderboard = [
  { id: 1, driver: "ApexPredator", lapTime: "01:14.220", topSpeed: 285, carColor: "#00f0ff", date: "2026-10-28" },
  { id: 2, driver: "CyberRacer", lapTime: "01:16.890", topSpeed: 278, carColor: "#ff0055", date: "2026-10-29" },
  { id: 3, driver: "GhostRider", lapTime: "01:18.450", topSpeed: 270, carColor: "#ffbb00", date: "2026-10-29" },
  { id: 4, driver: "NeonDrifter", lapTime: "01:21.050", topSpeed: 262, carColor: "#00ff66", date: "2026-10-29" }
];

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function handleApiRequest(req, res, parsedUrl, bodyData) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // 1. GET /api/leaderboard
  if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const sorted = [...leaderboard].sort((a, b) => a.lapTime.localeCompare(b.lapTime));
    res.end(JSON.stringify(sorted));
    return true;
  }

  // 2. POST /api/telemetry
  if (parsedUrl.pathname === '/api/telemetry' && req.method === 'POST') {
    try {
      const payload = JSON.parse(bodyData || '{}');
      const entry = {
        timestamp: Date.now(),
        speed: Math.round(payload.speed || 0),
        rpm: Math.round(payload.rpm || 0),
        gear: payload.gear || 1,
        progress: Number((payload.progress || 0).toFixed(3)),
        steerAngle: Number((payload.steerAngle || 0).toFixed(2)),
        mode: payload.mode || 'scroll'
      };
      telemetryLogs.push(entry);
      if (telemetryLogs.length > 500) telemetryLogs.shift();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: telemetryLogs.length }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }
    return true;
  }

  // 3. GET /api/telemetry (Latest state)
  if (parsedUrl.pathname === '/api/telemetry' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(telemetryLogs.slice(-20)));
    return true;
  }

  // 4. POST /api/lap
  if (parsedUrl.pathname === '/api/lap' && req.method === 'POST') {
    try {
      const payload = JSON.parse(bodyData || '{}');
      const newEntry = {
        id: leaderboard.length + 1,
        driver: (payload.driver || 'Anonymous').slice(0, 16),
        lapTime: payload.lapTime || '01:25.000',
        topSpeed: Math.round(payload.topSpeed || 200),
        carColor: payload.carColor || '#00f0ff',
        date: new Date().toISOString().split('T')[0]
      };
      leaderboard.push(newEntry);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, entry: newEntry }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    return true;
  }

  // 5. GET /api/track
  if (parsedUrl.pathname === '/api/track' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: "Neo-Tokyo HyperSpeed Circuit",
      lengthMeters: 4800,
      elevationDelta: 45,
      sectors: [
        { name: "Starting Grid & Launchpad", length: "1200m" },
        { name: "Neon Cyber Tunnel & S-Turns", length: "1800m" },
        { name: "Drift Hairpin & Grandstand Bridge", length: "1800m" }
      ],
      lightingMode: "Night Cyberpunk",
      version: "2.0-Production"
    }));
    return true;
  }

  return false;
}

function serveStaticFile(req, res, parsedUrl) {
  let reqPath = parsedUrl.pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.connection.destroy();
    });
    req.on('end', () => {
      if (!handleApiRequest(req, res, parsedUrl, body)) {
        serveStaticFile(req, res, parsedUrl);
      }
    });
  } else {
    if (!handleApiRequest(req, res, parsedUrl, null)) {
      serveStaticFile(req, res, parsedUrl);
    }
  }
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log('🏎️  TWO-TIER 3D CAR RACE TRACK APPLICATION RUNNING');
  console.log(`📡 Tier 2 API & Static Server: http://localhost:${PORT}`);
  console.log('🏁 Track Mode: 3D Scroll-Driven Animation & Interactive Racing');
  console.log('================================================================');
});

