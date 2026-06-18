import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, password: form.password }),
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

  function Field({ name, label, type = 'text', placeholder = '', required = true }) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input type={type} required={required}
          value={form[name]}
          onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          placeholder={placeholder}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'var(--gold)'}
          onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
        />
      </div>
    );
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
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="mc-eyebrow" style={{ justifyContent: 'center' }}>
              <span>Únete al programa</span>
            </div>
            <h1 className="mc-heading" style={{ fontSize: 46 }}>
              Crear <span>cuenta</span>
            </h1>
            <p className="mc-sub" style={{ marginTop: 8 }}>Empieza a ganar puntos desde hoy</p>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(245,200,66,.08)', border: '1px solid rgba(245,200,66,.2)',
              color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: 1,
              padding: '8px 16px', borderRadius: 99, marginTop: 14,
              fontFamily: "'Montserrat', sans-serif",
            }}>
              🎁 Recibes 50 puntos de bienvenida
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field name="firstName" label="Nombre" placeholder="Juan" />
              <Field name="lastName"  label="Apellido" placeholder="García" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Field name="email" label="Email" type="email" placeholder="tu@email.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Field name="phone" label="Teléfono (opcional)" type="tel" placeholder="+52 55 0000 0000" required={false} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Field name="password" label="Contraseña" type="password" placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <Field name="confirm" label="Confirmar contraseña" type="password" placeholder="••••••••" />
            </div>

            {error && (
              <div style={errorStyle}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="hs-btn hs-btn-gold"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 12, opacity: loading ? .6 : 1 }}>
              {loading ? 'Creando cuenta...' : '¡Crear mi cuenta!'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(251,247,240,.4)' }}>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>
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
