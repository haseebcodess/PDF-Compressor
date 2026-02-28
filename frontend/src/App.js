import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';


// the API base url — points to our express backend
const API = '/api/pdf';

// file size limit set to 100MB
const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

// these are the 4 screens the app can show
const VIEW = {
  UPLOAD:      'upload',
  OPTIONS:     'options',
  COMPRESSING: 'compressing',
  RESULT:      'result'
};

// the 3 compression options the user can pick from
const LEVELS = [
  {
    id:    'high',
    label: 'High',
    badge: 'Best compression',
    desc:  'Smallest size, standard quality',
    ratio: 0.40
  },

  {
    id:    'medium',
    label: 'Medium',
    badge: null,
    desc:  'Medium size, better quality',
    ratio: 0.62
  },

  {
    id:    'low',
    label: 'Low',
    badge: null,
    desc:  'Larger size, highest quality',
    ratio: 0.80
  }
];


// turns raw bytes into a readable string like "1.2 MB" or "340 KB"
const fmt = (b) => {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
};

// calculates how much % smaller the compressed file is
const pct = (orig, comp) => Math.max(0, ((orig - comp) / orig) * 100).toFixed(0);

// estimates output file size before compressing
const est = (bytes, ratio) => Math.round(bytes * ratio);


// ── SVG icon components ──────────────────────────────────────────────────────
// these are just small inline SVGs wrapped in React components
// so we can use them like <IconUpload /> anywhere in JSX

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconPDF = () => (
  <svg viewBox="0 0 32 40" fill="none">
    <rect x="1" y="1" width="30" height="38" rx="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 10h20M6 16h14M6 22h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <text x="16" y="36" fontSize="7" textAnchor="middle" fill="currentColor" fontFamily="DM Sans,sans-serif" fontWeight="600">PDF</text>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconLogo = () => (
  <svg viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="currentColor"/>
    <path d="M10 26V10h10a6 6 0 0 1 0 12H14v4H10z" fill="white" stroke="none"/>
  </svg>
);


// ── Main App component ───────────────────────────────────────────────────────

export default function App() {

  // reads saved theme from localStorage, falls back to system preference
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('compresso-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // whenever dark changes, update the html attribute and save to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('compresso-theme', dark ? 'dark' : 'light');
  }, [dark]);


  // which screen are we showing right now
  const [view, setView] = useState(VIEW.UPLOAD);

  // true when the user is dragging a file over the drop zone
  const [dragOver, setDragOver] = useState(false);

  // true while the file is being sent to the backend
  const [uploading, setUploading] = useState(false);

  // error message to show under the upload zone
  const [uploadErr, setUploadErr] = useState('');

  // stores info about the uploaded file once upload succeeds
  const [fileInfo, setFileInfo] = useState(null);

  // which compression level the user has selected
  const [level, setLevel] = useState('high');

  // error message to show if compression fails
  const [compressErr, setCompressErr] = useState('');

  // 0-100 number for the progress bar animation
  const [progress, setProgress] = useState(0);

  // stores the result after compression finishes
  const [result, setResult] = useState(null);

  // ref to the hidden file input element
  const inputRef = useRef(null);


  // ── handleFile ─────────────────────────────────────────────────────────────
  // called when a file is chosen via the picker or dropped onto the zone
  // validates type and size, then POSTs it to /api/pdf/upload

  const handleFile = useCallback(async (file) => {

    setUploadErr('');
    if (!file) return;

    // reject non-PDFs
    if (file.type !== 'application/pdf') {
      setUploadErr('Only PDF files are accepted.');
      return;
    }

    // reject files over 100MB
    if (file.size > MAX_BYTES) {
      setUploadErr(`File exceeds ${MAX_MB}MB limit.`);
      return;
    }

    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('pdf', file);

      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      // save file info so we can show it on the options screen
      setFileInfo({ fileId: data.fileId, name: data.originalName, size: data.originalSize });
      setLevel('high');
      setView(VIEW.OPTIONS);

    } catch (e) {
      setUploadErr(e.message);
    } finally {
      setUploading(false);
    }

  }, []);


  // ── onDrop ─────────────────────────────────────────────────────────────────
  // handles the drag-and-drop event, extracts the first file and passes it to handleFile

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);


  // ── handleCompress ─────────────────────────────────────────────────────────
  // sends the fileId and chosen level to /api/pdf/compress
  // while waiting it runs a fake progress bar animation so the screen isn't boring

  const handleCompress = async () => {
    if (!fileInfo) return;

    setCompressErr('');
    setProgress(0);
    setView(VIEW.COMPRESSING);

    // fake progress — ticks up randomly every 300ms until capped at 88
    // the real jump to 100 happens after the server responds
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(p + Math.random() * 12, 88);
      setProgress(Math.round(p));
    }, 300);

    try {
      const res = await fetch(`${API}/compress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fileInfo.fileId, level })
      });

      const data = await res.json();
      clearInterval(tick);

      if (!res.ok) throw new Error(data.error || 'Compression failed.');

      // jump bar to 100, then after a short pause show the result screen
      setProgress(100);
      setTimeout(() => {
        setResult({ compressedSize: data.compressedSize, token: data.downloadToken });
        setView(VIEW.RESULT);
      }, 600);

    } catch (e) {
      clearInterval(tick);
      setCompressErr(e.message);
      setView(VIEW.OPTIONS);
    }
  };


  // ── handleDownload ─────────────────────────────────────────────────────────
  // creates a hidden <a> tag and clicks it programmatically
  // this forces the browser to download the file to the user's PC
  // instead of navigating away or opening it in the browser

  const handleDownload = () => {
    if (!result) return;

    const a = document.createElement('a');
    a.href = `${API}/download/${result.token}`;
    a.download = `compressed-${fileInfo?.name || 'file.pdf'}`;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // clean up the element after a short delay
    setTimeout(() => document.body.removeChild(a), 200);
  };


  // ── reset ──────────────────────────────────────────────────────────────────
  // clears everything and goes back to the upload screen

  const reset = () => {
    setView(VIEW.UPLOAD);
    setFileInfo(null);
    setResult(null);
    setUploadErr('');
    setCompressErr('');
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };


  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app">


      {/* HEADER — always visible at the top */}
      <header className="header">
        <div className="header-inner">

          {/* logo — clicking it resets the app */}
          <a className="logo" href="/" onClick={(e) => { e.preventDefault(); reset(); }}>
            <span className="logo-icon"><IconLogo /></span>
            <span className="logo-wordmark">Compresso</span>
          </a>

          <nav className="header-nav">
            <span className="nav-tag">PDF Tools</span>
          </nav>

          {/* theme toggle button */}
          <button
            className="theme-toggle"
            onClick={() => setDark(d => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            <span className="theme-icon">{dark ? <IconSun /> : <IconMoon />}</span>
            <span className="theme-label">{dark ? 'Light' : 'Dark'}</span>
          </button>

        </div>
      </header>


      {/* HERO BAND — only shows on the upload screen */}
      {view === VIEW.UPLOAD && (
        <div className="hero-band">
          <div className="hero-inner">

            <div className="hero-left">
              <p className="hero-eyebrow">Free online tool</p>
              <h1 className="hero-title">Compress a PDF</h1>
              <p className="hero-sub">Drag and drop a PDF to reduce file size without losing quality.</p>
            </div>

            {/* decorative illustration — hidden on mobile */}
            <div className="hero-right" aria-hidden="true">
              <div className="hero-illustration">
                <div className="ill-doc ill-back">
                  <div className="ill-line" />
                  <div className="ill-line short" />
                  <div className="ill-line" />
                </div>
                <div className="ill-arrow">⟶</div>
                <div className="ill-doc ill-front">
                  <div className="ill-line" />
                  <div className="ill-line short" />
                  <div className="ill-line" />
                  <span className="ill-badge">–60%</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* MAIN — the white card area that switches between views */}
      <main className="main">


        {/* ── VIEW 1: UPLOAD ──────────────────────────────────────────── */}
        {view === VIEW.UPLOAD && (
          <div className="card animate-in">

            {/* hidden file input — triggered by clicking the drop zone or the button */}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={e => handleFile(e.target.files[0])}
            />

            {/* drop zone — the big dashed rectangle */}
            <div
              className={`drop-zone ${dragOver ? 'dz-active' : ''} ${uploading ? 'dz-loading' : ''}`}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !uploading && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
              aria-label="Upload PDF"
            >
              {uploading ? (
                <div className="dz-body">
                  <div className="spinner lg" />
                  <p className="dz-hint">Uploading…</p>
                </div>
              ) : (
                <div className="dz-body">
                  <div className="dz-upload-icon"><IconUpload /></div>
                  <p className="dz-primary">Drag &amp; drop your PDF here</p>
                  <p className="dz-or">— or —</p>
                  <button
                    className="btn-select"
                    type="button"
                    onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  >
                    Select a file
                  </button>
                  <p className="dz-hint">PDF only · Max {MAX_MB}MB</p>
                </div>
              )}
            </div>

            {/* error message shown below the drop zone */}
            {uploadErr && (
              <div className="error-bar">
                <span className="err-icon">⚠</span>
                {uploadErr}
              </div>
            )}

          </div>
        )}


        {/* ── VIEW 2: OPTIONS ─────────────────────────────────────────── */}
        {view === VIEW.OPTIONS && fileInfo && (
          <div className="card animate-in">

            <h2 className="card-title">Compress PDF</h2>

            {/* shows the uploaded file name and size */}
            <div className="file-row">
              <span className="file-row-pdf"><IconPDF /></span>
              <div className="file-row-info">
                <span className="file-row-name">{fileInfo.name}</span>
                <span className="file-row-meta">PDF · {fmt(fileInfo.size)}</span>
              </div>
            </div>

            <p className="section-label">Select compression level:</p>

            {/* renders the 3 compression level cards using .map() */}
            <div className="levels-grid">
              {LEVELS.map(lv => (
                <label key={lv.id} className={`level-card ${level === lv.id ? 'lc-selected' : ''}`}>

                  {/* hidden radio input — the label handles the click */}
                  <input
                    type="radio"
                    name="lvl"
                    value={lv.id}
                    checked={level === lv.id}
                    onChange={() => setLevel(lv.id)}
                    className="sr-only"
                  />

                  {/* "Best compression" badge only shows on the High card */}
                  {lv.badge && <span className="lc-badge">{lv.badge}</span>}

                  <div className="lc-top">
                    <span className={`radio-ring ${level === lv.id ? 'rr-checked' : ''}`} />
                    <span className="lc-name">{lv.label}</span>
                  </div>

                  <p className="lc-desc">{lv.desc}</p>
                  <p className="lc-est">Estimated {fmt(est(fileInfo.size, lv.ratio))}</p>

                </label>
              ))}
            </div>

            {/* compression error (e.g. ghostscript not found) */}
            {compressErr && (
              <div className="error-bar">
                <span className="err-icon">⚠</span>
                {compressErr}
              </div>
            )}

            <div className="card-actions">
              <button className="btn-ghost" onClick={reset}>Cancel</button>
              <button className="btn-primary" onClick={handleCompress}>Compress</button>
            </div>

          </div>
        )}


        {/* ── VIEW 3: COMPRESSING ─────────────────────────────────────── */}
        {view === VIEW.COMPRESSING && (
          <div className="card animate-in compressing-card">

            <div className="compress-logo"><IconLogo /></div>
            <h2 className="compress-title">Compresso</h2>
            <p className="compress-sub">Compressing your PDF…</p>

            {/* progress bar — width is driven by the progress state (0-100) */}
            <div className="prog-track">
              <div className="prog-fill" style={{ width: `${progress}%` }} />
            </div>

            <p className="prog-label">{progress}%</p>
            <button className="btn-ghost sm" onClick={reset}>Cancel</button>

          </div>
        )}


        {/* ── VIEW 4: RESULT ──────────────────────────────────────────── */}
        {view === VIEW.RESULT && result && fileInfo && (
          <div className="card animate-in result-card">

            <div className="result-check"><IconCheck /></div>

            <h2 className="result-title">Compression complete!</h2>

            <p className="result-sub">
              Your PDF is now{' '}
              <strong className="accent-text">{pct(fileInfo.size, result.compressedSize)}% smaller</strong>
              {' '}— saved {fmt(fileInfo.size - result.compressedSize)}
            </p>

            {/* side-by-side original vs compressed size boxes */}
            <div className="size-row">

              <div className="size-box">
                <p className="sb-label">Original size</p>
                <p className="sb-value">{fmt(fileInfo.size)}</p>
                <div className="sb-bar">
                  <div className="sb-fill orig" style={{ width: '100%' }} />
                </div>
              </div>

              <span className="size-arrow"><IconArrow /></span>

              <div className="size-box">
                <p className="sb-label">Compressed</p>
                <p className="sb-value green">{fmt(result.compressedSize)}</p>
                <div className="sb-bar">
                  <div
                    className="sb-fill comp"
                    style={{ width: `${Math.max(6, (result.compressedSize / fileInfo.size) * 100)}%` }}
                  />
                </div>
              </div>

            </div>

            <p className="result-filename">{fileInfo.name}</p>

            {/* clicking this triggers the hidden anchor download trick */}
            <button className="btn-download" onClick={handleDownload}>
              <span className="dl-icon"><IconDownload /></span>
              Download compressed PDF
            </button>

            <button className="btn-ghost wide" onClick={reset}>Compress another file</button>

            <p className="ttl-note">Files are automatically deleted from the server after 1 hour.</p>

          </div>
        )}


      </main>


      <footer className="footer">
        <p>Compresso · Powered by Ghostscript · Files processed locally on your server</p>
      </footer>


    </div>
  );
}
