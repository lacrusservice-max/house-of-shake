import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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

  const field = (key, label, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-white/60 text-sm mb-1.5">{label}</label>
      <input type={type} required={key !== 'phone'}
        value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-white/8 text-white placeholder-white/25 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:bg-white/10 transition"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#120800] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <span className="text-3xl">☕</span>
            </Link>
            <h1 className="text-white text-2xl font-black">Crear cuenta</h1>
            <p className="text-white/40 text-sm mt-1">Únete y empieza a ganar puntos desde hoy</p>
            <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3 py-1.5 rounded-full">
              <span>🎁</span> Recibes 50 puntos de bienvenida
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {field('firstName', 'Nombre', 'text', 'Juan')}
              {field('lastName', 'Apellido', 'text', 'García')}
            </div>
            {field('email', 'Email', 'email', 'tu@email.com')}
            {field('phone', 'Teléfono (opcional)', 'tel', '+52 55 0000 0000')}
            {field('password', 'Contraseña', 'password', 'Mínimo 6 caracteres')}
            {field('confirm', 'Confirmar contraseña', 'password', '••••••••')}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3.5 rounded-xl font-bold transition disabled:opacity-50 mt-2">
              {loading ? 'Creando cuenta...' : '¡Crear mi cuenta!'}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-semibold transition">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
