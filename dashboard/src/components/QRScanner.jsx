import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

/**
 * QR Scanner using @zxing/browser.
 *
 * Critical fix: controls come from the Promise returned by decodeFromConstraints,
 * NOT from the callback (which only receives result + error in v0.2.0).
 * The original code checked `controls` inside the callback → always undefined →
 * setReady(true) never ran → "Iniciando cámara..." overlay stuck forever.
 */
export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const scannedRef = useRef(false); // lock: prevent double-scan
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    async function start() {
      try {
        // facingMode:environment → back camera on mobile; ideal so it degrades gracefully
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result, err) => {
            if (cancelled || scannedRef.current) return;
            if (result) {
              const text = result.getText();
              if (text) {
                scannedRef.current = true; // lock immediately — no double triggers
                try { controlsRef.current?.stop(); } catch {}
                onScan(text);
              }
            }
          }
        );

        if (!cancelled) {
          controlsRef.current = controls;
          setReady(true); // NOW this actually runs (controls from Promise, not callback)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = (err?.message || '').toLowerCase();
          if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
            setError('Permiso de cámara denegado. Ve a la configuración del navegador y activa la cámara.');
          } else if (msg.includes('notfound') || msg.includes('devices') || msg.includes('no camera')) {
            setError('No se encontró ninguna cámara en este dispositivo.');
          } else if (msg.includes('https') || msg.includes('secure')) {
            setError('La cámara requiere conexión segura (HTTPS).');
          } else {
            setError('No se pudo iniciar la cámara. Recarga la página e intenta de nuevo.');
          }
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes qr-spin { to { transform: rotate(360deg); } }
        @keyframes qr-scan { 0%,100%{top:15%} 50%{top:75%} }
      `}</style>

      {/* Camera viewport */}
      <div style={{
        background: '#000', borderRadius: 20, overflow: 'hidden',
        position: 'relative', aspectRatio: '1',
        maxHeight: '65vh', border: '2px solid rgba(245,200,66,.4)',
        boxShadow: ready ? '0 0 0 3px rgba(245,200,66,.15)' : 'none',
        transition: 'box-shadow .3s',
      }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          playsInline
          muted
        />

        {/* Viewfinder overlay — only when ready */}
        {ready && !error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {/* Dark vignette */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)' }} />

            {/* Gold frame — 60% of viewport */}
            <div style={{
              position: 'relative', zIndex: 1,
              width: '62%', height: '62%',
            }}>
              {/* Corner brackets */}
              {[
                { top: 0, left: 0, borderTop: '3px solid #F5C842', borderLeft: '3px solid #F5C842', borderRadius: '6px 0 0 0' },
                { top: 0, right: 0, borderTop: '3px solid #F5C842', borderRight: '3px solid #F5C842', borderRadius: '0 6px 0 0' },
                { bottom: 0, left: 0, borderBottom: '3px solid #F5C842', borderLeft: '3px solid #F5C842', borderRadius: '0 0 0 6px' },
                { bottom: 0, right: 0, borderBottom: '3px solid #F5C842', borderRight: '3px solid #F5C842', borderRadius: '0 0 6px 0' },
              ].map((style, i) => (
                <div key={i} style={{ position: 'absolute', width: 26, height: 26, ...style }} />
              ))}

              {/* Scanning line */}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #F5C842, transparent)',
                animation: 'qr-scan 2s ease-in-out infinite',
                boxShadow: '0 0 8px rgba(245,200,66,.6)',
              }} />
            </div>
          </div>
        )}

        {/* Loading spinner — before ready */}
        {!ready && !error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.8)', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44,
              border: '3px solid rgba(245,200,66,.25)',
              borderTopColor: '#F5C842',
              borderRadius: '50%',
              animation: 'qr-spin 0.9s linear infinite',
            }} />
            <p style={{ color: 'rgba(245,200,66,.85)', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
              Iniciando cámara...
            </p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.85)', padding: 24, gap: 12, textAlign: 'center',
          }}>
            <span style={{ fontSize: 36 }}>📷</span>
            <p style={{ color: '#E05C5C', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{error}</p>
          </div>
        )}
      </div>

      {/* Status text */}
      {!error && ready && (
        <p style={{
          color: 'rgba(245,200,66,.7)', fontSize: 12, textAlign: 'center',
          marginTop: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          Apunta al código QR del cliente
        </p>
      )}

      {/* Close button */}
      <button onClick={onClose} style={{
        marginTop: 12, width: '100%', padding: '13px',
        background: 'rgba(251,247,240,.06)',
        border: '1px solid rgba(251,247,240,.1)',
        borderRadius: 12, color: 'rgba(251,247,240,.5)',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        fontFamily: "'Montserrat', sans-serif",
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        Cerrar cámara
      </button>
    </div>
  );
}
