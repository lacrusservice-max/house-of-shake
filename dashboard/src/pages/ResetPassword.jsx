import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
      if (!res.ok) throw new Error(d.error || 'Error al restablecer la contraseña');

      // Log in inmediato — el backend ya devuelve un token de sesión
      localStorage.setItem('hos_customer_token', d.token);
      localStorage.setItem('hos_customer', JSON.stringify(d.customer));
      navigate('/mi-cuenta');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mc-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <nav className="mc-nav">
          <Link to="/" className="mc-nav-brand">
            <img src="/logo-white.png" alt="House of Shake" width="32" height="32" style={{ objectFit: 'contain', borderRadius: 6 }} />
            <span className="mc-nav-title">HOUSE OF SHAKE</span>
          </Link>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
          <div>
            <p style={{ color: 'var(--cream)', fontSize: 15, marginBottom: 16 }}>Enlace inválido o incompleto.</p>
            <Link to="/olvide-password" className="hs-btn hs-btn-gold" style={{ padding: '12px 24px', borderRadius: 10 }}>
              Solicitar un nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
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
              Nueva<br /><span>contraseña</span>
            </h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Nueva contraseña</label>
              <input type="password" required autoFocus minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={S.input}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Confirma la contraseña</label>
              <input type="password" required minLength={6}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                style={S.input}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
            </div>

            {error && <div style={S.error}>{error}</div>}

            <button type="submit" disabled={loading}
              className="hs-btn hs-btn-gold"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 12, opacity: loading ? .6 : 1 }}>
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
    textTransform: 'uppercase', color: 'rgba(251,247,240,.4)', marginBottom: 8,
    fontFamily: "'Montserrat', sans-serif",
  },
  input: {
    width: '100%', background: 'rgba(251,247,240,.04)', color: 'var(--cream)',
    border: '1px solid rgba(251,247,240,.12)', borderRadius: 12,
    padding: '14px 16px', outline: 'none', fontSize: 14,
    fontFamily: "'Montserrat', sans-serif", transition: 'border-color .2s',
    boxSizing: 'border-box',
  },
  error: {
    background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.25)',
    color: '#E05C5C', fontSize: 13, padding: '12px 16px',
    borderRadius: 10, marginBottom: 16,
  },
};
