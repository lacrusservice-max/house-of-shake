import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.login(form.email, form.password);
      localStorage.setItem('hos_admin_token', data.token);
      localStorage.setItem('hos_admin', JSON.stringify(data.admin));
      navigate('/admin/');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600 rounded-2xl mb-4">
              <span className="text-white text-xl font-black">HoS</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Panel de administración</h1>
            <p className="text-gray-500 text-sm mt-1">Acceso restringido al equipo de House of Shake</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Email</label>
              <input type="email" required
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@houseofshake.com"
                className="w-full bg-gray-900 text-white placeholder-gray-600 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Contraseña</label>
              <input type="password" required
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-gray-900 text-white placeholder-gray-600 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold transition disabled:opacity-50">
              {loading ? 'Ingresando...' : 'Entrar al panel'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/" className="text-gray-600 hover:text-gray-400 text-xs transition">
              ← Volver al sitio principal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
