import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen bg-[#120800] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <span className="text-3xl">☕</span>
            </Link>
            <h1 className="text-white text-2xl font-black">Bienvenido de regreso</h1>
            <p className="text-white/40 text-sm mt-1">Inicia sesión en tu cuenta de House of Shake</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Email</label>
              <input type="email" required
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="tu@email.com"
                className="w-full bg-white/8 text-white placeholder-white/25 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:bg-white/10 transition"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Contraseña</label>
              <input type="password" required
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-white/8 text-white placeholder-white/25 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:bg-white/10 transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3.5 rounded-xl font-bold transition disabled:opacity-50 mt-2">
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="text-amber-400 hover:text-amber-300 font-semibold transition">
              Regístrate gratis
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <Link to="/admin/login" className="text-white/20 hover:text-white/40 text-xs transition">
              Acceso para staff / administradores →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
