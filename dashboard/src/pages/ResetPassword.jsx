import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BLUE   = '#0F448B';
const BORDER = 'rgba(15,68,139,.15)';
const MUTED  = 'rgba(15,68,139,.5)';

function Header() {
  return (
    <header className="auth-header">
      <Link to="/login" className="auth-back">← Iniciar sesión</Link>
      <Link to="/" className="auth-logo-link">
        <img src="/logo-encabezado.png" alt="House of Shake" className="auth-logo" />
      </Link>
      <span className="auth-header-spacer" />
    </header>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (password !== confirm) return setError('Las contraseñas no coinciden');

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo cambiar la contraseña');

      // Log in inmediato — el backend ya devuelve un token de sesión
      localStorage.setItem('hos_customer_token', d.token);
      localStorage.setItem('hos_customer', JSON.stringify(d.customer));
      navigate('/mi-cuenta');
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Sin conexión. Revisa tu internet.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mc-root auth-page">
        <Header />
        <div className="auth-body">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <h1 className="mc-heading" style={{ fontSize: 32 }}>Enlace<br /><span>inválido</span></h1>
            <p className="mc-sub" style={{ marginTop: 10, marginBottom: 24 }}>
              Este enlace está incompleto o ya expiró. Pide uno nuevo, tarda un segundo.
            </p>
            <Link
              to="/olvide-password"
              style={{
                display: 'block', padding: '15px', borderRadius: 12, background: BLUE,
                color: '#FFFFFF', textDecoration: 'none', fontWeight: 800, fontSize: 13,
                letterSpacing: 1.5, textTransform: 'uppercase',
              }}
            >
              Solicitar un nuevo enlace →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mc-root auth-page">
      <Header />

      <div className="auth-body">
        <div className="auth-card">

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 className="mc-heading">
              Nueva<br /><span>contraseña</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>
              Elige una nueva y entrarás a tu cuenta al instante
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Nueva contraseña</label>
              <input
                type="password" required autoFocus minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={S.input}
                onFocus={e => e.target.style.borderColor = BLUE}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Confirma la contraseña</label>
              <input
                type="password" required minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                style={S.input}
                onFocus={e => e.target.style.borderColor = BLUE}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
            </div>

            {error && <div style={S.error}>{error}</div>}

            <button type="submit" disabled={loading} style={S.btn(loading)}>
              {loading ? 'Guardando…' : 'Guardar y entrar →'}
            </button>
          </form>
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
  btn: (loading) => ({
    width: '100%', padding: '16px', borderRadius: 12,
    background: BLUE, color: '#FFFFFF', border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800,
    letterSpacing: 1.5, textTransform: 'uppercase',
    fontFamily: "'Montserrat', sans-serif",
    opacity: loading ? .6 : 1, transition: 'opacity .2s', display: 'block',
  }),
};
