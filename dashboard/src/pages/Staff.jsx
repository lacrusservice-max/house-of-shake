import { useState, useRef, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Staff() {
  const [token, setToken] = useState(() => localStorage.getItem('hos_staff_token') || '');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // If no token, show login
  if (!token) {
    return <StaffLogin form={loginForm} setForm={setLoginForm} error={loginError} setError={setLoginError}
      loading={loginLoading} setLoading={setLoginLoading} onLogin={setToken} />;
  }

  return <POSView token={token} onLogout={() => { localStorage.removeItem('hos_staff_token'); setToken(''); }} />;
}

function StaffLogin({ form, setForm, error, setError, loading, setLoading, onLogin }) {
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas');
      localStorage.setItem('hos_staff_token', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a0a00] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-white text-2xl font-bold">House of Shake</h1>
          <p className="text-amber-400 text-sm mt-1">Acceso para staff</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required placeholder="Email" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-amber-400"
          />
          <input type="password" required placeholder="Contraseña" value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-amber-400"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl font-bold transition disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function POSView({ token, onLogout }) {
  const [screen, setScreen] = useState('home'); // home | scan | customer | addPoints | redeem | success
  const [codeInput, setCodeInput] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const [result, setResult] = useState(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  async function lookupByCode(code) {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${encodeURIComponent(code.trim())}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cliente no encontrado');
      setCustomer(data);
      setScreen('customer');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPoints(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/add-points`, {
        method: 'POST', headers,
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar puntos');
      setResult({ type: 'earn', ...data });
      setAmount('');
      setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const pts = parseInt(redeemPoints);
      const res = await fetch(`${API}/pos/customer/${customer.id}/redeem`, {
        method: 'POST', headers,
        body: JSON.stringify({ points: pts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al canjear');
      setResult({ type: 'redeem', ...data });
      setRedeemPoints('');
      setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() { setScreen('home'); setCustomer(null); setError(''); setResult(null); setCodeInput(''); }

  const levelColors = { BRONZE: '#cd7f32', SILVER: '#9e9e9e', GOLD: '#ffd700' };
  const levelEmoji = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇' };

  return (
    <div className="min-h-screen bg-[#1a0a00] text-white">
      {/* Header */}
      <header className="bg-[#2a1200] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">☕</span>
          <span className="font-bold text-amber-400">POS Staff</span>
        </div>
        <button onClick={onLogout} className="text-white/40 text-xs hover:text-white/70 transition">Salir</button>
      </header>

      <div className="max-w-md mx-auto px-4 py-6">

        {/* HOME */}
        {screen === 'home' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center mb-6">¿Qué deseas hacer?</h2>
            <button onClick={() => setScreen('scan')}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black py-5 rounded-2xl font-bold text-lg transition flex items-center justify-center gap-3">
              <span className="text-2xl">📷</span> Escanear / Buscar Cliente
            </button>
          </div>
        )}

        {/* SCAN / LOOKUP */}
        {screen === 'scan' && (
          <div className="space-y-4">
            <button onClick={reset} className="text-white/50 text-sm hover:text-white">← Volver</button>
            <h2 className="text-xl font-bold">Buscar cliente</h2>
            <p className="text-white/60 text-sm">Ingresa el ID del cliente que aparece en su tarjeta, o escanea el QR con tu lector.</p>
            <form onSubmit={e => { e.preventDefault(); lookupByCode(codeInput); }} className="space-y-3">
              <input
                type="text" required autoFocus
                placeholder="ID de cliente o código QR"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-4 text-lg outline-none focus:border-amber-400 font-mono"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl font-bold text-lg transition disabled:opacity-50">
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
          </div>
        )}

        {/* CUSTOMER PROFILE */}
        {screen === 'customer' && customer && (
          <div className="space-y-4">
            <button onClick={reset} className="text-white/50 text-sm hover:text-white">← Nueva búsqueda</button>

            {/* Card */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'linear-gradient(135deg, #1a0a00, #3d1a00)', borderColor: `${levelColors[customer.level]}40` }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-amber-300/60 text-xs uppercase tracking-widest">House of Shake</p>
                  <h3 className="text-white text-xl font-bold mt-0.5">{customer.firstName} {customer.lastName}</h3>
                  <p className="text-white/40 text-xs mt-0.5">{customer.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl">{levelEmoji[customer.level]}</span>
                  <p className="text-xs mt-0.5" style={{ color: levelColors[customer.level] }}>{customer.level}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/50 text-xs mb-1">PUNTOS DISPONIBLES</p>
                  <p className="text-3xl font-bold text-amber-400">{customer.availablePoints}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/50 text-xs mb-1">ACUMULADOS TOTAL</p>
                  <p className="text-3xl font-bold text-white">{customer.lifetimePoints}</p>
                </div>
              </div>
              {customer.availablePoints >= 100 && (
                <p className="text-center text-amber-400 text-sm mt-3">
                  🎉 Puede canjear ${Math.floor(customer.availablePoints / 100) * 5} MXN
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setScreen('addPoints'); setError(''); }}
                className="bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold transition flex flex-col items-center gap-1">
                <span className="text-2xl">+</span>
                <span className="text-sm">Acumular Puntos</span>
              </button>
              <button
                disabled={customer.availablePoints < 100}
                onClick={() => { setScreen('redeem'); setError(''); }}
                className="bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition flex flex-col items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="text-2xl">🎁</span>
                <span className="text-sm">Canjear Puntos</span>
              </button>
            </div>

            {/* Recent transactions */}
            {customer.recentTransactions?.length > 0 && (
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3">Últimas transacciones</p>
                <div className="space-y-2">
                  {customer.recentTransactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-sm">
                      <span className="text-white/60 truncate flex-1 mr-2">{t.description}</span>
                      <span className={t.points > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {t.points > 0 ? '+' : ''}{t.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADD POINTS */}
        {screen === 'addPoints' && customer && (
          <div className="space-y-4">
            <button onClick={() => setScreen('customer')} className="text-white/50 text-sm hover:text-white">← Volver</button>
            <h2 className="text-xl font-bold">Acumular Puntos</h2>
            <p className="text-white/60 text-sm">Cliente: <span className="text-white font-semibold">{customer.firstName} {customer.lastName}</span></p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
              <p className="text-amber-300 text-sm">1 punto por cada $1 MXN gastado</p>
            </div>
            <form onSubmit={handleAddPoints} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">Monto de la compra (MXN)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-lg">$</span>
                  <input type="number" required min="1" step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl pl-8 pr-4 py-4 text-2xl font-bold outline-none focus:border-amber-400"
                  />
                </div>
                {amount && (
                  <p className="text-amber-400 text-sm mt-2 text-center">
                    +{Math.floor(parseFloat(amount) || 0)} puntos para {customer.firstName}
                  </p>
                )}
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold text-lg transition disabled:opacity-50">
                {loading ? 'Procesando...' : 'Confirmar Compra'}
              </button>
            </form>
          </div>
        )}

        {/* REDEEM */}
        {screen === 'redeem' && customer && (
          <div className="space-y-4">
            <button onClick={() => setScreen('customer')} className="text-white/50 text-sm hover:text-white">← Volver</button>
            <h2 className="text-xl font-bold">Canjear Puntos</h2>
            <p className="text-white/60 text-sm">Cliente: <span className="text-white font-semibold">{customer.firstName} {customer.lastName}</span></p>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm mb-1">Puntos disponibles</p>
              <p className="text-4xl font-bold text-amber-400">{customer.availablePoints}</p>
              <p className="text-white/40 text-xs mt-1">100 puntos = $5 MXN de descuento</p>
            </div>

            {/* Quick redeem buttons */}
            <div>
              <p className="text-white/60 text-sm mb-2">Cantidad a canjear:</p>
              <div className="grid grid-cols-3 gap-2">
                {[100, 200, 300].filter(v => v <= customer.availablePoints).map(v => (
                  <button key={v} onClick={() => setRedeemPoints(String(v))}
                    className={`py-3 rounded-xl text-sm font-bold transition ${redeemPoints === String(v) ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {v} pts<br /><span className="text-xs font-normal">${(v / 100) * 5} MXN</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleRedeem} className="space-y-3">
              <input type="number" required min="100" step="100"
                value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)}
                placeholder="Múltiplos de 100"
                className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 text-xl font-bold outline-none focus:border-amber-400 text-center"
              />
              {redeemPoints && parseInt(redeemPoints) >= 100 && (
                <p className="text-blue-400 text-sm text-center">
                  Descuento: ${(Math.floor(parseInt(redeemPoints) / 100) * 5).toFixed(2)} MXN
                </p>
              )}
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading || !redeemPoints || parseInt(redeemPoints) < 100}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg transition disabled:opacity-50">
                {loading ? 'Procesando...' : 'Confirmar Canje'}
              </button>
            </form>
          </div>
        )}

        {/* SUCCESS */}
        {screen === 'success' && result && (
          <div className="text-center space-y-6 py-8">
            <div className="text-7xl">{result.type === 'earn' ? '🎉' : '🎁'}</div>
            {result.type === 'earn' ? (
              <>
                <h2 className="text-2xl font-bold text-green-400">+{result.pointsAdded} puntos</h2>
                <p className="text-white/70">agregados a la cuenta de<br /><span className="text-white font-semibold">{customer?.firstName} {customer?.lastName}</span></p>
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-white/50 text-sm">Saldo actual</p>
                  <p className="text-3xl font-bold text-amber-400">{result.newBalance}</p>
                  <p className="text-white/40 text-xs">puntos disponibles</p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-blue-400">${result.discountUsd?.toFixed(2)} MXN</h2>
                <p className="text-white/70">de descuento aplicado a<br /><span className="text-white font-semibold">{customer?.firstName} {customer?.lastName}</span></p>
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-white/50 text-sm">Saldo restante</p>
                  <p className="text-3xl font-bold text-amber-400">{result.newBalance}</p>
                  <p className="text-white/40 text-xs">puntos disponibles</p>
                </div>
              </>
            )}
            <div className="space-y-3">
              <button onClick={() => { setScreen('customer'); setResult(null); }}
                className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition">
                Volver al perfil
              </button>
              <button onClick={reset}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl font-bold transition">
                Nueva transacción
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
