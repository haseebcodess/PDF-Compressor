/**
 * Compresso Backend - server.js
 * Express server with auto file cleanup
 */
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const pdfRoutes = require('./routes/pdf');

const app  = express();
const PORT = process.env.PORT || 5000;

// Files older than 1 hour are auto-deleted
const FILE_TTL_MS = 60 * 60 * 1000;

// Ensure storage dirs exist
const uploadsDir   = path.join(__dirname, 'uploads');
const compressedDir = path.join(__dirname, 'compressed');
[uploadsDir, compressedDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json());

// Routes
app.use('/api/pdf', pdfRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auto-cleanup old files every 30 min
setInterval(() => {
  const now = Date.now();
  [uploadsDir, compressedDir].forEach(dir => {
    fs.readdir(dir, (_err, files) => {
      if (!files) return;
      files.forEach(f => {
        const fp = path.join(dir, f);
        fs.stat(fp, (_e, s) => { if (s && now - s.mtimeMs > FILE_TTL_MS) fs.unlink(fp, () => {}); });
      });
    });
  });
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`\n  Compresso running at http://localhost:${PORT}`);
  console.log(`📁  Uploads   → ${uploadsDir}`);
  console.log(`📁  Compressed → ${compressedDir}\n`);
});

// serve the built React frontend
app.use(express.static(path.join(__dirname, '../frontend/build')));

// for any unknown route, send back the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});
