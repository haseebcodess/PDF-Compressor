
const express    = require('express');
const router     = express.Router();
const path       = require('path');
const fs         = require('fs');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const upload     = require('../middleware/upload');

const uploadsDir    = path.join(__dirname, '..', 'uploads');
const compressedDir = path.join(__dirname, '..', 'compressed');


const GS_SETTINGS = {
  low:    '/printer',   
  medium: '/ebook',     
  high:   '/screen'     
};



// file uploading
const fileStore = new Map();


router.post('/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid file type.' });

  const fileId = uuidv4();
  fileStore.set(fileId, {
    fileId,
    originalName: req.file.originalname,
    storedName:   req.file.filename,
    originalSize: req.file.size,
    uploadedAt:   Date.now(),
    compressed:   {}
  });

  res.json({ success: true, fileId, originalName: req.file.originalname, originalSize: req.file.size });
});



// compressed data
router.post('/compress', async (req, res) => {
  const { fileId, level } = req.body;

  if (!fileId || !level)           return res.status(400).json({ error: 'fileId and level are required.' });
  if (!GS_SETTINGS[level])         return res.status(400).json({ error: 'Invalid level. Use: low | medium | high' });

  const info = fileStore.get(fileId);
  if (!info)                        return res.status(404).json({ error: 'File not found. Please upload again.' });

  const inputPath  = path.join(uploadsDir, info.storedName);
  if (!fs.existsSync(inputPath))   return res.status(404).json({ error: 'Original file missing on server.' });

  const outName  = `${fileId}-${level}.pdf`;
  const outPath  = path.join(compressedDir, outName);




  // ghostscript used
  const gsCmd  = process.platform === 'win32' ? 'gswin64c' : 'gs';
  const gsArgs = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${GS_SETTINGS[level]}`,
    '-dNOPAUSE', '-dQUIET', '-dBATCH',
    `-sOutputFile=${outPath}`,
    inputPath
  ];

  try {
    await runGS(gsCmd, gsArgs);

    const compressedSize = fs.statSync(outPath).size;
    info.compressed[level] = { name: outName, size: compressedSize };
    fileStore.set(fileId, info);

    res.json({
      success: true,
      fileId,
      level,
      originalSize: info.originalSize,
      compressedSize,
      downloadToken: `${fileId}__${level}`
    });
  } catch (err) {
    console.error('GS error:', err.message);
    res.status(500).json({ error: 'Compression failed. Make sure Ghostscript is installed.', details: err.message });
  }
});



// downloading the file
router.get('/download/:token', (req, res) => {
  const { token } = req.params;
  const sep = token.lastIndexOf('__');
  if (sep === -1) return res.status(400).json({ error: 'Invalid token.' });

  const fileId = token.slice(0, sep);
  const level  = token.slice(sep + 2);

  const info = fileStore.get(fileId);
  if (!info || !info.compressed[level]) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(compressedDir, info.compressed[level].name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File expired or missing.' });



  // file name building
  const dlName = `compressed-${info.originalName}`.replace(/[^a-zA-Z0-9._-]/g, '_');

  

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  res.download(filePath, dlName, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Download failed.' });
  });
});



function runGS(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (err, _out, stderr) => {
      err ? reject(new Error(stderr || err.message)) : resolve();
    });
  });
}

module.exports = router;
