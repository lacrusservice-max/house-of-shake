import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al enviar el correo');
      }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mc-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <nav className="mc-nav">
        <Link to="/" className="mc-nav-brand">
          <img src="/logo-white.png" alt="House of Shake" width="32" height="32" style={{ objectFit: 'contain', borderRadius: 6 }} />
          <span className="mc-nav-title">HOUSE OF SHAKE</span>
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="mc-eyebrow" style={{ justifyContent: 'center' }}>
              <span>House of Shake</span>
            </div>
            <h1 className="mc-heading" style={{ fontSize: 40 }}>
              Recupera tu<br /><span>contraseña</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>
              Te enviamos un enlace a tu correo para crear una nueva
            </p>
          </div>

          {done ? (
            <div style={{
              background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.3)',
              borderRadius: 14, padding: '20px 18px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#5EC97A', margin: '0 0 8px' }}>
                ✓ Revisa tu correo
              </p>
              <p style={{ fontSize: 13, color: 'rgba(251,247,240,.6)', margin: 0, lineHeight: 1.6 }}>
                Si existe una cuenta con <strong style={{ color: 'var(--cream)' }}>{email}</strong>, te enviamos un enlace
                para crear una nueva contraseña. El enlace expira en 30 minutos.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(251,247,240,.4)', marginBottom: 8, fontFamily: "'Montserrat', sans-serif" }}>
                  Email de tu cuenta
                </label>
                <input type="email" required autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={{
                    width: '100%', background: 'rgba(251,247,240,.04)', color: 'var(--cream)',
                    border: '1px solid rgba(251,247,240,.12)', borderRadius: 12,
                    padding: '14px 16px', outline: 'none', fontSize: 14,
                    fontFamily: "'Montserrat', sans-serif", transition: 'border-color .2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                />
              </div>

              {error && (
                <div style={{
                  background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.25)',
                  color: '#E05C5C', fontSize: 13, padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="hs-btn hs-btn-gold"
                style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 12, opacity: loading ? .6 : 1 }}>
                {loading ? 'Enviando…' : 'Enviar enlace →'}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(251,247,240,.4)' }}>
            <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>
              ← Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
