// middleware/upload.js
// handles incoming file uploads using multer
// validates that only PDFs come through and enforces the 100MB size cap

const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadsDir = path.join(__dirname, '..', 'uploads');


// storage config — tells multer where to save files and what to name them
const storage = multer.diskStorage({

  // save to the uploads folder
  destination: (_req, _file, cb) => cb(null, uploadsDir),

  // prefix filename with a UUID to prevent any two files overwriting each other
  // also strips unsafe characters from the original name
  filename: (_req, file, cb) => {
    const safe = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    cb(null, `${uuidv4()}-${safe}`);
  }

});


// filter — reject anything that isn't a PDF
const fileFilter = (_req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ext === '.pdf' && mime === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are accepted.'), false);
  }
};


// export configured multer instance with 100MB limit
module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024  // 100MB
  }
});
