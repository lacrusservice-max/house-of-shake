import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BLUE   = '#0F448B';
const BORDER = 'rgba(15,68,139,.15)';
const MUTED  = 'rgba(15,68,139,.5)';
const GREEN  = '#1C9A5B';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [needsStaff, setNeedsStaff] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(''); setNeedsStaff(false);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // El servidor distingue "no hay proveedor de correo" de un fallo puntual:
        // en el primer caso reintentar no sirve, hay que ir con el staff.
        setNeedsStaff(!!d.emailNotConfigured);
        throw new Error(d.error || 'No se pudo enviar el correo');
      }
      setDone(true);
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Sin conexión. Revisa tu internet.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mc-root auth-page">

      {/* El logo azul sobre fondo claro y centrado — antes era logo-white.png
          sobre nav blanco, o sea invisible. */}
      <header className="auth-header">
        <Link to="/login" className="auth-back">← Iniciar sesión</Link>
        <Link to="/" className="auth-logo-link">
          <img src="/logo-encabezado.png" alt="House of Shake" className="auth-logo" />
        </Link>
        <span className="auth-header-spacer" />
      </header>

      <div className="auth-body">
        <div className="auth-card">

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 className="mc-heading">
              Recupera tu<br /><span>contraseña</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>
              Te enviamos un enlace a tu correo para crear una nueva
            </p>
          </div>

          {done ? (
            <>
              <div style={{
                background: 'rgba(28,154,91,.07)', border: `1px solid rgba(28,154,91,.3)`,
                borderRadius: 14, padding: '20px 18px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: GREEN, margin: '0 0 8px' }}>
                  ✓ Revisa tu correo
                </p>
                {/* Este texto iba en crema sobre verde claro: ilegible. */}
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.65 }}>
                  Si existe una cuenta con <strong style={{ color: BLUE }}>{email}</strong>,
                  te enviamos un enlace para crear una nueva contraseña.
                  El enlace expira en 30 minutos.
                </p>
              </div>

              <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                ¿No te llegó? Revisa tu carpeta de spam o{' '}
                <button
                  onClick={() => { setDone(false); setError(''); }}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: BLUE, fontWeight: 800, fontSize: 12, fontFamily: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  inténtalo de nuevo
                </button>.
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>Email de tu cuenta</label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={S.input}
                  onFocus={e => e.target.style.borderColor = BLUE}
                  onBlur={e => e.target.style.borderColor = BORDER}
                />
              </div>

              {error && (
                <div style={needsStaff ? S.notice : S.error}>
                  {error}
                  {needsStaff && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.55 }}>
                      Muestra tu correo en caja y el staff te la restablece al momento.
                    </p>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} style={S.btn(loading)}>
                {loading ? 'Enviando…' : 'Enviar enlace →'}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: MUTED }}>
            <Link to="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: 'none' }}>
              ← Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: MUTED, marginBottom: 8,
    fontFamily: "'Montserrat', sans-serif",
  },
  input: {
    width: '100%', background: '#FFFFFF', color: BLUE,
    border: `1px solid ${BORDER}`, borderRadius: 12,
    padding: '14px 16px', outline: 'none', fontSize: 16,
    fontFamily: "'Montserrat', sans-serif", transition: 'border-color .2s',
    boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none',
  },
  error: {
    background: 'rgba(224,92,92,.08)', border: '1px solid rgba(224,92,92,.25)',
    color: '#E05C5C', fontSize: 13, padding: '12px 16px',
    borderRadius: 10, marginBottom: 16,
  },
  // No es culpa del cliente ni un error suyo: es un paso que resuelve el staff.
  notice: {
    background: 'rgba(15,68,139,.06)', border: `1px solid rgba(15,68,139,.2)`,
    color: BLUE, fontSize: 13, lineHeight: 1.55, padding: '12px 16px',
    borderRadius: 10, marginBottom: 16,
  },
  btn: (loading) => ({
    width: '100%', padding: '16px', borderRadius: 12,
    background: BLUE, color: '#FFFFFF', border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800,
    letterSpacing: 1.5, textTransform: 'uppercase',
    fontFamily: "'Montserrat', sans-serif",
    opacity: loading ? .6 : 1, transition: 'opacity .2s', display: 'block',
  }),
};
