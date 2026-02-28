# Compresso v2 — PDF Compressor

Adobe Acrobat–style PDF compressor with **dark / light theme toggle**.

---

## 📁 Folder Structure

```
pdf-compressor/
├── backend/
│   ├── middleware/upload.js     # Multer (PDF-only, 25MB, UUID filenames)
│   ├── routes/pdf.js            # upload / compress / download routes
│   ├── uploads/                 # original PDFs (auto-created)
│   ├── compressed/              # compressed PDFs (auto-created)
│   └── server.js
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.js               # React app (3 views + theme toggle)
        ├── App.css              # Full dark/light CSS variables
        └── index.js
```

---

## 🛠 Prerequisites

### Node.js 18+
https://nodejs.org

### Ghostscript (compression engine)

**macOS:**  `brew install ghostscript`
**Ubuntu:** `sudo apt-get install -y ghostscript`
**Windows:** Download from https://www.ghostscript.com → install → add to PATH
- Verify: `gs --version` (mac/linux) or `gswin64c --version` (windows)

---

## 🚀 Running the App

### Terminal 1 — Backend
```
cd pdf-compressor/backend
npm install
npm start
# → http://localhost:5000
```

### Terminal 2 — Frontend
```
cd pdf-compressor/frontend
npm install
npm start
# → http://localhost:3000
```

**Tip on Windows:** In File Explorer, Shift+Right-click each folder → "Open in Terminal"

---

## ✨ Features

- **3-view flow:** Upload → Compression options → Result + Download
- **Dark / Light theme** toggle (persists across sessions via localStorage)
- **Drag & drop** or file picker upload
- **3 compression levels:** High / Medium / Low with estimated output sizes
- **Animated progress bar** during Ghostscript compression
- **Download guaranteed** to save to your PC (uses anchor `download` attribute + `Content-Disposition: attachment` header)
- **Auto-cleanup:** files deleted after 1 hour

---

## 🔒 Security

- PDF-only (MIME type + extension checked)
- 25MB size limit
- UUID-prefixed filenames (no overwrites)
- Sanitised download filenames
- `Content-Disposition: attachment` prevents in-browser navigation
