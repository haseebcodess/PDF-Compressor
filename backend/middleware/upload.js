

const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadsDir = path.join(__dirname, '..', 'uploads');



// naming files after compressed
const storage = multer.diskStorage({

  

  destination: (_req, _file, cb) => cb(null, uploadsDir),

  
  filename: (_req, file, cb) => {
    const safe = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    cb(null, `${uuidv4()}-${safe}`);
  }

});


// only pdf allowed
const fileFilter = (_req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ext === '.pdf' && mime === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are accepted.'), false);
  }
};



module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024  
  }
});
