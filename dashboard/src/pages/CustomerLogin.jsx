import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function CustomerLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
      localStorage.setItem('hos_customer_token', data.token);
      localStorage.setItem('hos_customer', JSON.stringify(data.customer));
      navigate('/mi-cuenta');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mc-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* NAV */}
      <nav className="mc-nav">
        <Link to="/" className="mc-nav-brand">
          <div className="mc-nav-logo">☕</div>
          <span className="mc-nav-title">HOUSE OF SHAKE</span>
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="mc-eyebrow" style={{ justifyContent: 'center' }}>
              <span>Programa de lealtad</span>
            </div>
            <h1 className="mc-heading" style={{ fontSize: 46 }}>
              Bienvenido<br /><span>de regreso</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>Inicia sesión en tu cuenta</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="tu@email.com"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Contraseña</label>
              <input type="password" required
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
            </div>

            {error && (
              <div style={errorStyle}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="hs-btn hs-btn-gold"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 12, marginTop: 4, opacity: loading ? .6 : 1 }}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(251,247,240,.4)' }}>
            ¿No tienes cuenta?{' '}
            <Link to="/registro" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>
              Regístrate gratis
            </Link>
          </p>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(251,247,240,.06)', textAlign: 'center' }}>
            <Link to="/admin/login" style={{ color: 'rgba(251,247,240,.2)', fontSize: 11, letterSpacing: 1, textDecoration: 'none', fontWeight: 600 }}
              onMouseOver={e => e.target.style.color = 'rgba(251,247,240,.45)'}
              onMouseOut={e => e.target.style.color = 'rgba(251,247,240,.2)'}>
              Acceso para staff / administradores →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'rgba(251,247,240,.4)',
  marginBottom: 8,
  fontFamily: "'Montserrat', sans-serif",
};

const inputStyle = {
  width: '100%',
  background: 'rgba(251,247,240,.04)',
  color: 'var(--cream)',
  border: '1px solid rgba(251,247,240,.12)',
  borderRadius: 12,
  padding: '14px 16px',
  outline: 'none',
  fontSize: 14,
  fontFamily: "'Montserrat', sans-serif",
  transition: 'border-color .2s',
  boxSizing: 'border-box',
};

const errorStyle = {
  background: 'rgba(224,92,92,.1)',
  border: '1px solid rgba(224,92,92,.25)',
  color: '#E05C5C',
  fontSize: 13,
  padding: '12px 16px',
  borderRadius: 10,
  marginBottom: 16,
};
