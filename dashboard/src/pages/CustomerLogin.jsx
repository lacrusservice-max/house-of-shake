import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BLUE   = '#0F448B';
const BORDER = 'rgba(15,68,139,.15)';
const MUTED  = 'rgba(15,68,139,.5)';

export default function CustomerLogin() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(''); setNeedsPassword(false);
    const body = JSON.stringify(form);
    const headers = { 'Content-Type': 'application/json' };

    try {
      const adminRes = await fetch(`${API}/admin/login`, { method: 'POST', headers, body });
      if (adminRes.ok) {
        const d = await adminRes.json();
        if (d.admin?.role === 'admin') {
          localStorage.setItem('hos_admin_token', d.token);
          localStorage.setItem('hos_admin', JSON.stringify(d.admin));
          navigate('/admin/');
          return;
        }
        if (d.admin?.role === 'staff') {
          localStorage.setItem('hos_staff_token', d.token);
          navigate('/staff');
          return;
        }
      }
    } catch { /* fall through */ }

    try {
      const res = await fetch(`${API}/auth/login`, { method: 'POST', headers, body });
      const d = await res.json();
      if (!res.ok) {
        // El servidor distingue "no existe / contraseña mal" de "tu cuenta la
        // creó el staff y aún no tiene contraseña". Tragarse ese mensaje dejaba
        // al cliente sin saber que debe usar "¿Olvidaste tu contraseña?".
        setError(d.error || 'Email o contraseña incorrectos');
        setNeedsPassword(!!d.needsPassword);
        return;
      }
      localStorage.setItem('hos_customer_token', d.token);
      localStorage.setItem('hos_customer', JSON.stringify(d.customer));
      navigate('/mi-cuenta');
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mc-root auth-page">

      <header className="auth-header">
        <Link to="/" className="auth-back">← Inicio</Link>
        <Link to="/" className="auth-logo-link">
          <img src="/logo-encabezado.png" alt="House of Shake" className="auth-logo" />
        </Link>
        <span className="auth-header-spacer" />
      </header>

      <div className="auth-body">
        <div className="auth-card">

          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 className="mc-heading">
              Bienvenido<br /><span>de regreso</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>
              Clientes, staff y administradores
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="tu@email.com"
                style={S.input}
                onFocus={e => e.target.style.borderColor = BLUE}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>Contraseña</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={S.input}
                onFocus={e => e.target.style.borderColor = BLUE}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
            </div>

            <p style={{ textAlign: 'right', marginBottom: 20 }}>
              <Link to="/olvide-password" style={{ color: MUTED, fontSize: 12, textDecoration: 'none' }}>
                ¿Olvidaste tu contraseña?
              </Link>
            </p>

            {error && (
              <div style={needsPassword ? S.notice : S.error}>
                {error}
                {needsPassword && (
                  <Link to="/olvide-password" style={{ display: 'block', marginTop: 8, color: BLUE, fontWeight: 800, textDecoration: 'underline' }}>
                    Crear mi contraseña →
                  </Link>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} style={S.btn(loading)}>
              {loading ? 'Ingresando…' : 'Iniciar sesión →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: MUTED }}>
            ¿No tienes cuenta?{' '}
            <Link to="/registro" style={{ color: BLUE, fontWeight: 700, textDecoration: 'none' }}>
              Regístrate gratis
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

const S = {
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(15,68,139,.5)',
    marginBottom: 8,
    fontFamily: "'Montserrat', sans-serif",
  },
  input: {
    width: '100%',
    background: '#FFFFFF',
    color: '#0F448B',
    border: '1px solid rgba(15,68,139,.15)',
    borderRadius: 12,
    padding: '14px 16px',
    outline: 'none',
    fontSize: 16,
    fontFamily: "'Montserrat', sans-serif",
    transition: 'border-color .2s',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  error: {
    background: 'rgba(224,92,92,.08)',
    border: '1px solid rgba(224,92,92,.25)',
    color: '#E05C5C',
    fontSize: 13,
    padding: '12px 16px',
    borderRadius: 10,
    marginBottom: 16,
  },
  // La cuenta existe y tiene Pinos: no es un error del cliente, es un paso pendiente.
  notice: {
    background: 'rgba(15,68,139,.06)',
    border: '1px solid rgba(15,68,139,.2)',
    color: BLUE,
    fontSize: 13,
    lineHeight: 1.5,
    padding: '12px 16px',
    borderRadius: 10,
    marginBottom: 16,
  },
  btn: (loading) => ({
    width: '100%',
    padding: '16px',
    borderRadius: 12,
    background: BLUE,
    color: '#FFFFFF',
    border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: "'Montserrat', sans-serif",
    opacity: loading ? .6 : 1,
    transition: 'opacity .2s',
    marginTop: 4,
    display: 'block',
  }),
};
