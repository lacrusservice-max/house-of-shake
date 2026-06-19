import { useState, useEffect } from 'react';
import api from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const CHECK = ({ ok }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: 800,
    background: ok ? 'rgba(94,201,122,.15)' : 'rgba(224,92,92,.15)',
    color: ok ? '#5EC97A' : '#E05C5C',
    border: `1px solid ${ok ? 'rgba(94,201,122,.3)' : 'rgba(224,92,92,.3)'}`,
    flexShrink: 0,
  }}>
    {ok ? '✓' : '✕'}
  </span>
);

export default function WalletSetup() {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [wwdrLoading, setWwdrLoading] = useState(false);
  const [wwdrResult, setWwdrResult]   = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied]   = useState('');

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/wallet/status');
      setStatus(data);
    } catch {}
    setLoading(false);
  }

  async function handleDownloadWwdr() {
    setWwdrLoading(true);
    setWwdrResult(null);
    try {
      const { data } = await api.post('/admin/wallet/download-wwdr');
      setWwdrResult(data);
    } catch (err) {
      setWwdrResult({ error: err.response?.data?.error || 'Error descargando WWDR' });
    }
    setWwdrLoading(false);
  }

  async function handleTestPass() {
    setTestLoading(true);
    try {
      const res = await fetch(`${API}/admin/wallet/test-pass`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('hos_admin_token')}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Error: ' + (data.error || 'Verifica la configuración'));
        setTestLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'test_houseofshake.pkpass';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setTestLoading(false);
  }

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  return (
    <div style={{ maxWidth: 760, fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <span style={{ fontSize: 36 }}>🍎</span>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: 0 }}>Apple Wallet Setup</h1>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Tarjetas de lealtad en el iPhone de tus clientes</p>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {!loading && status && (
        <div style={{
          padding: '16px 20px', borderRadius: 14, marginBottom: 28,
          background: status.ready ? 'rgba(94,201,122,.08)' : 'rgba(245,200,66,.08)',
          border: `1px solid ${status.ready ? 'rgba(94,201,122,.25)' : 'rgba(245,200,66,.25)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>{status.ready ? '✅' : '⚠️'}</span>
          <div>
            <p style={{ fontWeight: 800, margin: 0, color: status.ready ? '#166534' : '#92400e', fontSize: 14 }}>
              {status.ready ? 'Apple Wallet configurado y listo' : 'Configuración incompleta'}
            </p>
            <p style={{ fontSize: 12, color: '#666', margin: 0, marginTop: 2 }}>
              {status.ready
                ? 'Los clientes ya pueden agregar su tarjeta a Apple Wallet'
                : 'Sigue los pasos a continuación para activar Apple Wallet'}
            </p>
          </div>
          {status.ready && (
            <button onClick={handleTestPass} disabled={testLoading}
              style={{ marginLeft: 'auto', padding: '8px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {testLoading ? '⏳' : '📱 Probar pass'}
            </button>
          )}
        </div>
      )}

      {/* Current checks */}
      {!loading && status && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#111', marginTop: 0, marginBottom: 16 }}>Estado de la configuración</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'p12_certificate',  label: 'Certificado .p12 (firma del pass)',   env: 'WALLET_CERT_BASE64' },
              { key: 'wwdr_certificate', label: 'Certificado WWDR de Apple',          env: 'WWDR_CERT_BASE64' },
              { key: 'team_id',          label: 'Apple Team ID',                       env: 'WALLET_TEAM_ID', val: status.checks?.team_id_value },
              { key: 'pass_type_id',     label: 'Pass Type Identifier',               env: 'WALLET_PASS_TYPE_ID', val: status.checks?.pass_type_id_value },
              { key: 'apns_key',         label: 'APNs Key (actualizaciones push)',     env: 'APN_KEY_BASE64', optional: true },
            ].map(({ key, label, env, val, optional }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 10 }}>
                <CHECK ok={status.checks?.[key]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>
                    {label} {optional && <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>(opcional)</span>}
                  </p>
                  {val && <p style={{ fontSize: 11, color: '#888', margin: 0, fontFamily: 'monospace' }}>{val}</p>}
                </div>
                <code style={{ fontSize: 10, color: '#888', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                  {env}
                </code>
              </div>
            ))}
          </div>
          <button onClick={loadStatus} style={{ marginTop: 14, padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#555' }}>
            🔄 Refrescar estado
          </button>
        </div>
      )}

      {/* Step 1 — Apple Developer */}
      <Step number="1" title="Cuenta de Apple Developer" done={status?.checks?.team_id}>
        <p style={pStyle}>Necesitas una cuenta de Apple Developer ($99 USD/año) para generar certificados de pass. Si ya tienes una, continúa al paso 2.</p>
        <a href="https://developer.apple.com/programs/enroll/" target="_blank" rel="noopener noreferrer"
          style={linkBtn}>
          Registrarse en Apple Developer →
        </a>

        <div style={infoBox}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e40af' }}>¿Dónde encuentro mi Team ID?</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#3b82f6' }}>
            developer.apple.com → Account → Membership → Team ID
          </p>
        </div>

        {status?.checks?.team_id_value && (
          <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginTop: 10 }}>
            ✅ Team ID configurado: {status.checks.team_id_value}
          </p>
        )}
      </Step>

      {/* Step 2 — Pass Type ID */}
      <Step number="2" title="Crear Pass Type Identifier" done={status?.checks?.pass_type_id}>
        <p style={pStyle}>El Pass Type ID es el identificador único de tu tarjeta. Ya tienes uno preconfigurado:</p>
        <CodeBlock value="pass.com.houseofshake.fidelidad" onCopy={() => copyToClipboard('pass.com.houseofshake.fidelidad', 'passid')} copied={copied === 'passid'} />

        <div style={stepsBox}>
          <p style={{ fontWeight: 700, margin: '0 0 8px', fontSize: 13 }}>Pasos en el portal Apple:</p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 2, color: '#555' }}>
            <li>Ve a <strong>developer.apple.com/account</strong></li>
            <li>Selecciona <strong>Certificates, IDs & Profiles</strong></li>
            <li>En el menú izquierdo: <strong>Identifiers → Pass Type IDs → +</strong></li>
            <li>Description: <code>House of Shake Loyalty</code></li>
            <li>Identifier: <code>pass.com.houseofshake.fidelidad</code></li>
            <li>Click <strong>Register</strong></li>
          </ol>
        </div>
      </Step>

      {/* Step 3 — Certificate */}
      <Step number="3" title="Generar y descargar el certificado (.p12)" done={status?.checks?.p12_certificate}>
        <p style={pStyle}>Genera el certificado de firma para tu Pass Type ID:</p>
        <div style={stepsBox}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 2, color: '#555' }}>
            <li>En <strong>Identifiers → Pass Type IDs</strong>, selecciona tu Pass ID</li>
            <li>Click <strong>Create Certificate</strong></li>
            <li>Sube un CSR (desde Keychain Access: <em>Certificate Assistant → Request a Certificate</em>)</li>
            <li>Descarga el certificado generado (<code>.cer</code>)</li>
            <li>Doble-click en el <code>.cer</code> para importarlo en Keychain Access</li>
            <li>En Keychain: click derecho → <strong>Export</strong> → guarda como <code>.p12</code></li>
            <li>Pon una contraseña al exportar (guárdala también)</li>
          </ol>
        </div>

        <p style={{ ...pStyle, marginTop: 16, fontWeight: 700 }}>Convertir .p12 a base64 para Railway:</p>
        <CodeBlock
          value="base64 -i certificate.p12 | tr -d '\n'"
          language="bash"
          onCopy={() => copyToClipboard("base64 -i certificate.p12 | tr -d '\\n'", 'p12cmd')}
          copied={copied === 'p12cmd'}
        />
        <p style={pStyle}>Copia el resultado y agrégalo como variable de entorno en Railway:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <EnvVar name="WALLET_CERT_BASE64" value="<resultado del comando base64>" />
          <EnvVar name="WALLET_CERTIFICATE_PASSWORD" value="<contraseña del .p12>" />
        </div>
      </Step>

      {/* Step 4 — WWDR */}
      <Step number="4" title="Certificado WWDR de Apple" done={status?.checks?.wwdr_certificate}>
        <p style={pStyle}>El certificado WWDR (Apple Worldwide Developer Relations) es público. Puedes descargarlo automáticamente:</p>
        <button onClick={handleDownloadWwdr} disabled={wwdrLoading}
          style={{ padding: '10px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: wwdrLoading ? .6 : 1, marginBottom: 14 }}>
          {wwdrLoading ? '⏳ Descargando...' : '⬇️ Descargar WWDR G4 de Apple'}
        </button>

        {wwdrResult?.error && (
          <div style={{ padding: '10px 14px', background: 'rgba(224,92,92,.08)', border: '1px solid rgba(224,92,92,.2)', borderRadius: 10, color: '#dc2626', fontSize: 12, marginBottom: 12 }}>
            {wwdrResult.error}
          </div>
        )}

        {wwdrResult?.base64 && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#16a34a', marginBottom: 8 }}>
              ✅ WWDR descargado ({wwdrResult.size?.toLocaleString()} bytes). Copia el base64:
            </p>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <textarea
                readOnly
                value={wwdrResult.base64}
                style={{ width: '100%', height: 80, fontFamily: 'monospace', fontSize: 10, padding: 10, border: '1px solid #ddd', borderRadius: 10, resize: 'none', background: '#f9fafb', boxSizing: 'border-box' }}
              />
              <button onClick={() => copyToClipboard(wwdrResult.base64, 'wwdr')}
                style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', background: copied === 'wwdr' ? '#16a34a' : '#374151', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                {copied === 'wwdr' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <EnvVar name="WWDR_CERT_BASE64" value="<pegar el base64 copiado>" />
          </div>
        )}

        <p style={{ ...pStyle, marginTop: 14 }}>O descárgalo manualmente:</p>
        <a href="https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" target="_blank" rel="noopener noreferrer" style={linkBtn}>
          Descargar AppleWWDRCAG4.cer directamente →
        </a>
        <p style={{ ...pStyle, marginTop: 10 }}>Si descargaste el .cer, convierte a base64:</p>
        <CodeBlock
          value="base64 -i AppleWWDRCAG4.cer | tr -d '\n'"
          language="bash"
          onCopy={() => copyToClipboard("base64 -i AppleWWDRCAG4.cer | tr -d '\\n'", 'wwdrcmd')}
          copied={copied === 'wwdrcmd'}
        />
      </Step>

      {/* Step 5 — Team ID */}
      <Step number="5" title="Configurar variables en Railway" done={status?.checks?.team_id && status?.checks?.pass_type_id}>
        <p style={pStyle}>Agrega estas variables en tu proyecto Railway (<strong>Variables</strong> tab):</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EnvVar name="WALLET_TEAM_ID"       value="<tu Team ID de 10 caracteres>" />
          <EnvVar name="WALLET_PASS_TYPE_ID"  value="pass.com.houseofshake.fidelidad" copyValue="pass.com.houseofshake.fidelidad" onCopy={() => copyToClipboard('pass.com.houseofshake.fidelidad', 'ptid')} copied={copied === 'ptid'} />
          <EnvVar name="WALLET_CERT_BASE64"   value="<base64 del .p12>" />
          <EnvVar name="WALLET_CERTIFICATE_PASSWORD" value="<contraseña del .p12>" />
          <EnvVar name="WWDR_CERT_BASE64"     value="<base64 del WWDR>" />
        </div>
        <div style={{ ...infoBox, marginTop: 14 }}>
          <p style={{ margin: 0, fontSize: 12 }}>
            <strong>Importante:</strong> Después de agregar las variables, Railway hace un redeploy automático. Espera ~1 minuto y luego refresca el estado arriba.
          </p>
        </div>
      </Step>

      {/* Step 6 — APNs (optional) */}
      <Step number="6" title="APNs — Actualizaciones push (opcional)" done={status?.checks?.apns_key} optional>
        <p style={pStyle}>Sin APNs, el pass se descarga pero los puntos NO se actualizan automáticamente en el wallet (el cliente tiene que abrir la app para ver el saldo nuevo). Con APNs activado, el pass se actualiza solo en segundos.</p>
        <div style={stepsBox}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 2, color: '#555' }}>
            <li>Apple Developer → <strong>Keys → +</strong></li>
            <li>Name: <code>House of Shake Pass Update</code></li>
            <li>Activa <strong>Apple Push Notifications service (APNs)</strong></li>
            <li>Descarga el <code>.p8</code> y guarda el <strong>Key ID</strong></li>
            <li>Convierte a base64: <code>base64 -i AuthKey_XXXX.p8</code></li>
          </ol>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <EnvVar name="APN_KEY_BASE64" value="<base64 del .p8>" />
          <EnvVar name="APN_KEY_ID"     value="<Key ID (10 chars)>" />
          <EnvVar name="APN_TEAM_ID"    value="<mismo Team ID>" />
        </div>
      </Step>

      {/* Test section */}
      {status?.ready && (
        <div style={{ background: 'linear-gradient(135deg, #1a3a1a, #0f2b0f)', borderRadius: 18, padding: '24px', marginTop: 8 }}>
          <h3 style={{ color: '#5EC97A', fontSize: 18, fontWeight: 900, marginTop: 0, marginBottom: 8 }}>
            🎉 ¡Todo listo! Prueba el pass
          </h3>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginBottom: 16 }}>
            Descarga un pass de prueba y ábrelo desde tu iPhone para agregarlo a Wallet:
          </p>
          <button onClick={handleTestPass} disabled={testLoading}
            style={{ padding: '14px 28px', background: '#5EC97A', color: '#0f2b0f', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: .5 }}>
            {testLoading ? '⏳ Generando...' : '📱 Descargar .pkpass de prueba'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Step({ number, title, done, optional, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: 16,
      borderLeft: `4px solid ${done ? '#5EC97A' : optional ? '#f59e0b' : '#e5e7eb'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: done ? '#5EC97A' : optional ? '#f59e0b' : '#e5e7eb',
          color: done ? '#fff' : optional ? '#fff' : '#666',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 900,
        }}>
          {done ? '✓' : number}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111' }}>{title}</h3>
          {optional && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: .5 }}>OPCIONAL</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ value, onCopy, copied, language = 'bash' }) {
  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <code style={{
        display: 'block', background: '#1e1e1e', color: '#d4d4d4',
        padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 12,
        fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        {value}
      </code>
      {onCopy && (
        <button onClick={onCopy}
          style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', background: copied ? '#16a34a' : '#374151', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
          {copied ? '✓' : 'Copiar'}
        </button>
      )}
    </div>
  );
}

function EnvVar({ name, value, copyValue, onCopy, copied }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <code style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', flexShrink: 0 }}>{name}</code>
      <span style={{ fontSize: 11, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>=</span>
      <code style={{ fontSize: 10, color: '#555', flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
      {onCopy && (
        <button onClick={onCopy}
          style={{ padding: '2px 8px', background: copied ? '#16a34a' : '#e5e7eb', color: copied ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
          {copied ? '✓' : 'Copiar'}
        </button>
      )}
    </div>
  );
}

const pStyle = { fontSize: 13, color: '#555', margin: '0 0 10px', lineHeight: 1.6 };
const linkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb',
  borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#0284c7',
  textDecoration: 'none', marginBottom: 12,
};
const infoBox = {
  background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)',
  borderRadius: 10, padding: '10px 14px', marginTop: 8, fontSize: 12, color: '#3b82f6',
};
const stepsBox = {
  background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: 12, padding: '14px 18px', marginBottom: 12,
};
