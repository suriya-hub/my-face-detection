import { useRef, useEffect, useState, useCallback } from 'react';
import './App.css';
import * as faceapi from 'face-api.js';

const EXPRESSIONS = {
  happy: { label: 'Happy', emoji: '😄', color: '#facc15' },
  neutral: { label: 'Neutral', emoji: '😐', color: '#94a3b8' },
  surprised: { label: 'Surprised', emoji: '😮', color: '#38bdf8' },
  sad: { label: 'Sad', emoji: '😢', color: '#818cf8' },
  angry: { label: 'Angry', emoji: '😠', color: '#f87171' },
  fearful: { label: 'Fearful', emoji: '😨', color: '#c084fc' },
  disgusted: { label: 'Disgusted', emoji: '🤢', color: '#4ade80' },
};

const DETECTION_INTERVAL = 150;

// Draw a box with corner brackets around each face
const drawBox = (ctx, { x, y, width, height }, color) => {
  const len = Math.min(width, height) * 0.22;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  [
    [x, y + len, x, y, x + len, y],
    [x + width - len, y, x + width, y, x + width, y + len],
    [x + width, y + height - len, x + width, y + height, x + width - len, y + height],
    [x + len, y + height, x, y + height, x, y + height - len],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
  });
  ctx.stroke();

  ctx.strokeStyle = `${color}55`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
};

const drawLandmarks = (ctx, points) => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  points.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
};

const getDominant = (expressions) =>
  Object.keys(expressions).reduce((a, b) => (expressions[a] > expressions[b] ? a : b));

function App() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const optionsRef = useRef({ showBox: true, showLandmarks: true });

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [expressions, setExpressions] = useState({});
  const [dominant, setDominant] = useState(null);
  const [faceCount, setFaceCount] = useState(0);
  const [latency, setLatency] = useState(0);
  const [showBox, setShowBox] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // storage unavailable — theme just won't persist
    }
  }, [theme]);

  useEffect(() => {
    optionsRef.current = { showBox, showLandmarks };
  }, [showBox, showLandmarks]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    let stream;

    const detect = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (cancelled || !video || !canvas) return;

      const start = performance.now();
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceExpressions();
      if (cancelled) return;

      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);
      const resized = faceapi.resizeResults(detections, displaySize);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { showBox, showLandmarks } = optionsRef.current;
      resized.forEach((d) => {
        const color = EXPRESSIONS[getDominant(d.expressions)]?.color ?? '#6366f1';
        if (showBox) drawBox(ctx, d.detection.box, color);
        if (showLandmarks) drawLandmarks(ctx, d.landmarks.positions);
      });

      setLatency(Math.round(performance.now() - start));
      setFaceCount(detections.length);
      if (detections.length > 0) {
        const detected = detections[0].expressions;
        setExpressions({ ...detected });
        setDominant(getDominant(detected));
      } else {
        setExpressions({});
        setDominant(null);
      }

      timer = setTimeout(detect, DETECTION_INTERVAL);
    };

    const init = async () => {
      try {
        const [mediaStream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } }),
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        ]);
        stream = mediaStream;
        if (cancelled) return;

        const video = videoRef.current;
        video.srcObject = stream;
        await new Promise((resolve) => {
          if (video.readyState >= 2) resolve();
          else video.onloadeddata = resolve;
        });
        if (cancelled) return;

        setStatus('ready');
        detect();
      } catch (err) {
        console.error('Initialization failed:', err);
        if (cancelled) return;
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera permission in your browser and reload.'
            : err?.name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'Something went wrong while starting the detector.'
        );
        setStatus('error');
      }
    };

    init();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleReload = useCallback(() => window.location.reload(), []);

  const sorted = Object.keys(EXPRESSIONS)
    .map((key) => ({ key, value: expressions[key] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const current = dominant ? EXPRESSIONS[dominant] : null;
  const confidence = dominant ? Math.round(expressions[dominant] * 100) : 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
              <path d="M8.5 15a4 4 0 0 0 7 0" />
            </svg>
          </div>
          <div>
            <h1>FaceSense</h1>
            <p>Real-time face &amp; emotion detection</p>
          </div>
        </div>
        <div className="header-actions">
          <span className={`status-pill status-${status}`}>
            <span className="status-dot" />
            {status === 'loading' ? 'Initializing' : status === 'ready' ? 'Live' : 'Error'}
          </span>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="card stage-card">
          <div className="stage">
            <video ref={videoRef} autoPlay muted playsInline />
            <canvas ref={canvasRef} />

            {status === 'loading' && (
              <div className="overlay">
                <div className="spinner" />
                <p>Loading models &amp; starting camera…</p>
              </div>
            )}
            {status === 'error' && (
              <div className="overlay">
                <div className="error-icon">!</div>
                <p>{error}</p>
                <button className="btn" onClick={handleReload}>Try again</button>
              </div>
            )}
            {status === 'ready' && (
              <div className="stage-badge">
                <span className="rec-dot" /> {faceCount} {faceCount === 1 ? 'face' : 'faces'} detected
              </div>
            )}
          </div>

          <div className="toolbar">
            <label className="toggle">
              <input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} />
              <span className="switch" />
              Bounding box
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showLandmarks} onChange={(e) => setShowLandmarks(e.target.checked)} />
              <span className="switch" />
              Landmarks
            </label>
          </div>
        </section>

        <aside className="sidebar">
          <section className="card dominant-card" style={{ '--accent': current?.color ?? '#475569' }}>
            <span className="card-label">Dominant expression</span>
            <div className="dominant">
              <span className="dominant-emoji">{current?.emoji ?? '👤'}</span>
              <div>
                <h2>{current?.label ?? (status === 'ready' ? 'No face' : '—')}</h2>
                <p>{current ? `${confidence}% confidence` : 'Look at the camera'}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <span className="card-label">Expression breakdown</span>
            <ul className="bars">
              {sorted.map(({ key, value }) => (
                <li key={key} className={key === dominant ? 'active' : ''}>
                  <div className="bar-head">
                    <span>{EXPRESSIONS[key].emoji} {EXPRESSIONS[key].label}</span>
                    <span className="bar-value">{(value * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${value * 100}%`, background: EXPRESSIONS[key].color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="stats">
            <div className="card stat">
              <span className="card-label">Faces</span>
              <strong>{faceCount}</strong>
            </div>
            <div className="card stat">
              <span className="card-label">Latency</span>
              <strong>{latency}<small>ms</small></strong>
            </div>
          </section>
        </aside>
      </main>

      <footer className="footer">
        Runs entirely in your browser with face-api.js — no video ever leaves your device.
      </footer>
    </div>
  );
}

export default App;
