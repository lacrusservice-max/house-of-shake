import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BLUE   = '#0F448B';
const WHITE  = '#FFFFFF';
const BORDER = 'rgba(15,68,139,.15)';
const MUTED  = 'rgba(15,68,139,.5)';

/* ── Field definido FUERA de Register para evitar desmontaje en cada render ── */
function Field({ label, type, placeholder, required, value, onChange, autoComplete, inputMode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type || 'text'}
        required={required !== false}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        placeholder={placeholder || ''}
        style={inputStyle}
        onFocus={e => e.target.style.borderColor = BLUE}
        onBlur={e => e.target.style.borderColor = BORDER}
      />
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    phone: '', birthday: '', password: '', confirm: '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          email:     form.email,
          phone:     form.phone || undefined,
          password:  form.password,
          birthday:  form.birthday || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
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

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 className="mc-heading">
              Crear <span>cuenta</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>
              Empieza a ganar Pinos desde hoy
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(15,68,139,.06)', border: '1px solid rgba(15,68,139,.18)',
              color: BLUE, fontSize: 12, fontWeight: 700, letterSpacing: 1,
              padding: '8px 18px', borderRadius: 99, marginTop: 14,
              fontFamily: "'Montserrat', sans-serif",
            }}>
              🌲 Recibes 10 Pinos de bienvenida
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            <div className="auth-name-grid">
              <Field
                label="Nombre" placeholder="Juan"
                value={form.firstName} onChange={set('firstName')}
                autoComplete="given-name"
              />
              <Field
                label="Apellido" placeholder="García"
                value={form.lastName} onChange={set('lastName')}
                autoComplete="family-name"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <Field
                label="Email" type="email" placeholder="tu@email.com"
                value={form.email} onChange={set('email')}
                autoComplete="email" inputMode="email"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <Field
                label="Teléfono (opcional)" type="tel"
                placeholder="+52 55 0000 0000" required={false}
                value={form.phone} onChange={set('phone')}
                autoComplete="tel" inputMode="tel"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Fecha de cumpleaños (opcional)</label>
              <input
                type="date"
                value={form.birthday}
                onChange={set('birthday')}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = BLUE}
                onBlur={e => e.target.style.borderColor = BORDER}
              />
              <p style={{ fontSize: 11, color: MUTED, marginTop: 5, fontFamily: "'Montserrat', sans-serif" }}>
                🎂 Recibirás +20 Pinos de regalo el día de tu cumpleaños
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <Field
                label="Contraseña" type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password} onChange={set('password')}
                autoComplete="new-password"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <Field
                label="Confirmar contraseña" type="password"
                placeholder="••••••••"
                value={form.confirm} onChange={set('confirm')}
                autoComplete="new-password"
              />
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: 12,
                background: BLUE, color: WHITE,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 800, letterSpacing: 1.5,
                textTransform: 'uppercase', fontFamily: "'Montserrat', sans-serif",
                opacity: loading ? .6 : 1, transition: 'opacity .2s',
                display: 'block',
              }}
            >
              {loading ? 'Creando cuenta...' : '¡Crear mi cuenta! →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: MUTED }}>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: 'none' }}>
              Iniciar sesión
            </Link>
          </p>

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
  color: 'rgba(15,68,139,.5)',
  marginBottom: 8,
  fontFamily: "'Montserrat', sans-serif",
};

const inputStyle = {
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
};

const errorStyle = {
  background: 'rgba(224,92,92,.08)',
  border: '1px solid rgba(224,92,92,.25)',
  color: '#E05C5C',
  fontSize: 13,
  padding: '12px 16px',
  borderRadius: 10,
  marginBottom: 16,
};
