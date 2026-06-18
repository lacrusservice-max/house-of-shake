import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
      if (cancelled) return;
      if (!controlsRef.current && controls) {
        controlsRef.current = controls;
        setReady(true);
      }
      if (result) {
        const text = result.getText();
        if (text) onScan(text);
      }
    }).catch(() => {
      if (!cancelled) setError('No se pudo acceder a la cámara. Usa el campo manual.');
    });

    return () => {
      cancelled = true;
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: '#000',
        borderRadius: 16,
        overflow: 'hidden',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid rgba(245,200,66,.3)',
      }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {/* Viewfinder overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '60%', height: '60%',
            border: '2px solid rgba(245,200,66,.8)',
            borderRadius: 12,
            boxShadow: '0 0 0 999px rgba(0,0,0,.4)',
          }} />
        </div>
        {!ready && !error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.7)',
            color: 'rgba(245,200,66,.8)', fontSize: 13, fontWeight: 600,
          }}>
            Iniciando cámara...
          </div>
        )}
      </div>
      {error && (
        <p style={{ color: '#E05C5C', fontSize: 12, textAlign: 'center', marginTop: 8 }}>{error}</p>
      )}
      {!error && (
        <p style={{ color: 'rgba(251,247,240,.4)', fontSize: 11, textAlign: 'center', marginTop: 8, letterSpacing: 1 }}>
          Apunta la cámara al código QR del cliente
        </p>
      )}
      <button onClick={onClose} style={{
        marginTop: 12,
        width: '100%',
        padding: '10px',
        background: 'rgba(251,247,240,.06)',
        border: '1px solid rgba(251,247,240,.12)',
        borderRadius: 10,
        color: 'rgba(251,247,240,.5)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Montserrat', sans-serif",
      }}>
        Cerrar cámara
      </button>
    </div>
  );
}
