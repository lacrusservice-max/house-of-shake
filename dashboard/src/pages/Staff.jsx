import { useState, lazy, Suspense } from 'react';
import '../styles/mi-cuenta.css';

const QRScanner = lazy(() => import('../components/QRScanner'));

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LEVEL = {
  BRONZE: { color: '#cd7f32', emoji: '🥉', label: 'Bronze' },
  SILVER: { color: '#c0c0c0', emoji: '🥈', label: 'Silver' },
  GOLD:   { color: '#ffd700', emoji: '🥇', label: 'Gold' },
};

export default function Staff() {
  const [token, setToken] = useState(() => localStorage.getItem('hos_staff_token') || '');

  if (!token) return <StaffLogin onLogin={setToken} />;
  return <POSView token={token} onLogout={() => { localStorage.removeItem('hos_staff_token'); setToken(''); }} />;
}

function StaffLogin({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="mc-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <nav className="mc-nav">
        <div className="mc-nav-brand">
          <div className="mc-nav-logo">☕</div>
          <span className="mc-nav-title">HOUSE OF SHAKE</span>
        </div>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="mc-eyebrow" style={{ justifyContent: 'center' }}>Acceso staff</div>
            <h1 className="mc-heading" style={{ fontSize: 42 }}>POS <span>Cobrar</span></h1>
            <p className="mc-sub">Inicia sesión para continuar</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@houseofshake.com"
                style={inp}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Contraseña</label>
              <input type="password" required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={inp}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
            </div>
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={loading} className="hs-btn hs-btn-gold"
              style={{ width: '100%', justifyContent: 'center', padding: 16, borderRadius: 12, opacity: loading ? .6 : 1 }}>
              {loading ? 'Entrando…' : 'Entrar al POS'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function POSView({ token, onLogout }) {
  const [screen, setScreen]     = useState('home');
  const [codeInput, setCodeInput] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [amount, setAmount]     = useState('');
  const [redeemPts, setRedeemPts] = useState('');
  const [result, setResult]     = useState(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  async function lookupByCode(code) {
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${encodeURIComponent(code.trim())}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cliente no encontrado');
      setCustomer(data);
      setScreen('customer');
    } catch (err) {
      setError(err.message);
      if (screen === 'camera') setScreen('camera'); // stay on camera to retry
    } finally {
      setLoading(false);
    }
  }

  function handleQRScan(code) {
    setCodeInput(code);
    lookupByCode(code);
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
      if (!res.ok) throw new Error(data.error || 'Error');
      setResult({ type: 'earn', ...data });
      setAmount(''); setScreen('success');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/redeem`, {
        method: 'POST', headers,
        body: JSON.stringify({ points: parseInt(redeemPts) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setResult({ type: 'redeem', ...data });
      setRedeemPts(''); setScreen('success');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function reset() { setScreen('home'); setCustomer(null); setError(''); setResult(null); setCodeInput(''); setAmount(''); setRedeemPts(''); }

  const lvl = LEVEL[customer?.level] || LEVEL.BRONZE;
  const redeemable = customer ? Math.floor(customer.availablePoints / 100) * 5 : 0;

  return (
    <div className="mc-root">
      <nav className="mc-nav">
        <div className="mc-nav-brand">
          <div className="mc-nav-logo">☕</div>
          <span className="mc-nav-title">POS · STAFF</span>
        </div>
        <button onClick={onLogout} className="mc-nav-logout">Salir</button>
      </nav>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* HOME */}
        {screen === 'home' && (
          <div>
            <div className="mc-eyebrow">Punto de venta</div>
            <h1 className="mc-heading">Cobrar <span>cliente</span></h1>
            <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
              <button onClick={() => setScreen('camera')}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 16, background: 'var(--gold)', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", color: '#2C1A0E' }}>
                <span style={{ fontSize: 28 }}>📷</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Escanear QR con cámara</div>
                  <div style={{ fontSize: 11, opacity: .7 }}>Usa la cámara del dispositivo</div>
                </div>
              </button>
              <button onClick={() => setScreen('scan')}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 16, background: 'rgba(251,247,240,.05)', border: '1px solid rgba(251,247,240,.1)', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", color: 'var(--cream)' }}>
                <span style={{ fontSize: 28 }}>⌨️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Ingresar código manual</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>Pega o escribe el ID del cliente</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* CAMERA */}
        {screen === 'camera' && (
          <div>
            <button onClick={() => setScreen('home')} style={sBack}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 32 }}>Escanear <span>QR</span></h2>
            {error && <div style={sErr}>{error}</div>}
            {loading && <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 16, fontWeight: 600 }}>Buscando cliente…</div>}
            <Suspense fallback={<div style={{ color: 'rgba(251,247,240,.4)', textAlign: 'center', padding: 24 }}>Cargando cámara…</div>}>
              <QRScanner onScan={handleQRScan} onClose={() => setScreen('home')} />
            </Suspense>
          </div>
        )}

        {/* MANUAL SCAN */}
        {screen === 'scan' && (
          <div>
            <button onClick={() => setScreen('home')} style={sBack}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 32 }}>Buscar <span>cliente</span></h2>
            <form onSubmit={e => { e.preventDefault(); lookupByCode(codeInput); }}>
              <label style={sLbl}>ID del cliente (del código QR)</label>
              <input type="text" required autoFocus
                value={codeInput} onChange={e => setCodeInput(e.target.value)}
                placeholder="Pega el código aquí..."
                style={{ ...sInp, fontFamily: 'monospace', fontSize: 13 }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
              {error && <div style={sErr}>{error}</div>}
              <button type="submit" disabled={loading} className="hs-btn hs-btn-gold"
                style={{ width: '100%', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 12, opacity: loading ? .6 : 1 }}>
                {loading ? 'Buscando…' : 'Buscar cliente'}
              </button>
            </form>
          </div>
        )}

        {/* CUSTOMER */}
        {screen === 'customer' && customer && (
          <div>
            <button onClick={reset} style={sBack}>← Nueva búsqueda</button>
            <div style={{ background: `linear-gradient(135deg, #2C1A0E, #1a0e06)`, border: `1px solid ${lvl.color}30`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 4 }}>House of Shake</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(251,247,240,.4)', marginTop: 2 }}>{customer.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 26 }}>{lvl.emoji}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: lvl.color }}>{lvl.label}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(251,247,240,.05)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase' }}>Disponibles</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: 'var(--gold)' }}>{customer.availablePoints}</div>
                </div>
                <div style={{ background: 'rgba(251,247,240,.05)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase' }}>Canjeable</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: '#5EC97A' }}>${redeemable}</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <button onClick={() => { setScreen('addPoints'); setError(''); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px', borderRadius: 14, background: 'rgba(94,201,122,.1)', border: '1px solid rgba(94,201,122,.25)', color: '#5EC97A', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" }}>
                <span style={{ fontSize: 24 }}>+</span>
                <span style={{ fontWeight: 700, fontSize: 12 }}>Acumular</span>
              </button>
              <button disabled={customer.availablePoints < 100}
                onClick={() => { setScreen('redeem'); setError(''); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px', borderRadius: 14, background: 'rgba(74,125,156,.1)', border: '1px solid rgba(74,125,156,.25)', color: '#4a9fd4', cursor: customer.availablePoints < 100 ? 'not-allowed' : 'pointer', opacity: customer.availablePoints < 100 ? .4 : 1, fontFamily: "'Montserrat', sans-serif" }}>
                <span style={{ fontSize: 24 }}>🎁</span>
                <span style={{ fontWeight: 700, fontSize: 12 }}>Canjear</span>
              </button>
            </div>
            {customer.recentTransactions?.length > 0 && (
              <div style={{ background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.07)', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 10 }}>Últimas transacciones</div>
                {customer.recentTransactions.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(251,247,240,.04)' }}>
                    <span style={{ color: 'rgba(251,247,240,.5)', fontSize: 12, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: t.points > 0 ? '#5EC97A' : '#E05C5C' }}>{t.points > 0 ? '+' : ''}{t.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD POINTS */}
        {screen === 'addPoints' && customer && (
          <div>
            <button onClick={() => setScreen('customer')} style={sBack}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 32 }}>Acumular <span>puntos</span></h2>
            <p style={{ color: 'rgba(251,247,240,.5)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Cliente: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
            </p>
            <div style={{ background: 'rgba(245,200,66,.06)', border: '1px solid rgba(245,200,66,.2)', borderRadius: 10, padding: '10px 16px', textAlign: 'center', color: 'var(--gold)', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              1 punto por cada $1 MXN gastado
            </div>
            <form onSubmit={handleAddPoints}>
              <label style={sLbl}>Monto de la compra (MXN)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(251,247,240,.4)', fontSize: 22 }}>$</span>
                <input type="number" required min="1" step="0.01" autoFocus
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ ...sInp, paddingLeft: 40, fontSize: 30, fontFamily: "'Bebas Neue', sans-serif" }}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                />
              </div>
              {amount && <div style={{ textAlign: 'center', color: 'var(--gold)', fontSize: 14, fontWeight: 700, marginTop: 8 }}>+{Math.floor(parseFloat(amount) || 0)} puntos para {customer.firstName}</div>}
              {error && <div style={sErr}>{error}</div>}
              <button type="submit" disabled={loading} className="hs-btn hs-btn-gold"
                style={{ width: '100%', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 16, opacity: loading ? .6 : 1 }}>
                {loading ? 'Procesando…' : 'Confirmar compra ✓'}
              </button>
            </form>
          </div>
        )}

        {/* REDEEM */}
        {screen === 'redeem' && customer && (
          <div>
            <button onClick={() => setScreen('customer')} style={sBack}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 32 }}>Canjear <span>puntos</span></h2>
            <p style={{ color: 'rgba(251,247,240,.5)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Cliente: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
            </p>
            <div style={{ background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.08)', borderRadius: 14, padding: 18, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 6 }}>Puntos disponibles</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: 'var(--gold)' }}>{customer.availablePoints}</div>
              <div style={{ fontSize: 11, color: 'rgba(251,247,240,.35)' }}>100 puntos = $5 MXN de descuento</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {[100, 200, 300].filter(v => v <= customer.availablePoints).map(v => (
                <button key={v} onClick={() => setRedeemPts(String(v))}
                  style={{ padding: '12px 8px', borderRadius: 12, border: `1px solid ${redeemPts === String(v) ? 'var(--gold)' : 'rgba(251,247,240,.1)'}`, background: redeemPts === String(v) ? 'var(--gold)' : 'rgba(251,247,240,.05)', color: redeemPts === String(v) ? '#2C1A0E' : 'var(--cream)', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>
                  <div>{v} pts</div>
                  <div style={{ fontSize: 10, opacity: .8 }}>${(v/100)*5} MXN</div>
                </button>
              ))}
            </div>
            <form onSubmit={handleRedeem}>
              <input type="number" required min="100" step="100"
                value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                placeholder="Múltiplos de 100"
                style={{ ...sInp, textAlign: 'center', fontSize: 24, fontFamily: "'Bebas Neue', sans-serif" }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
              {redeemPts && parseInt(redeemPts) >= 100 && (
                <div style={{ textAlign: 'center', color: '#4a9fd4', fontWeight: 700, fontSize: 14, marginTop: 8 }}>
                  Descuento: ${(Math.floor(parseInt(redeemPts)/100)*5).toFixed(2)} MXN
                </div>
              )}
              {error && <div style={sErr}>{error}</div>}
              <button type="submit" disabled={loading || !redeemPts || parseInt(redeemPts) < 100} className="hs-btn hs-btn-gold"
                style={{ width: '100%', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 14, opacity: (loading || !redeemPts || parseInt(redeemPts) < 100) ? .5 : 1 }}>
                {loading ? 'Procesando…' : 'Confirmar canje ✓'}
              </button>
            </form>
          </div>
        )}

        {/* SUCCESS */}
        {screen === 'success' && result && (
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{result.type === 'earn' ? '🎉' : '🎁'}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, color: result.type === 'earn' ? '#5EC97A' : '#4a9fd4' }}>
              {result.type === 'earn' ? `+${result.pointsAdded} puntos` : `$${result.discountUsd?.toFixed(2)} MXN`}
            </div>
            <p style={{ color: 'rgba(251,247,240,.6)', marginBottom: 20 }}>
              {result.type === 'earn' ? 'agregados a' : 'descuento aplicado a'}{' '}
              <strong style={{ color: 'var(--cream)' }}>{customer?.firstName}</strong>
            </p>
            <div style={{ background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.08)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 6 }}>Saldo actual</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: 'var(--gold)' }}>{result.newBalance}</div>
              <div style={{ fontSize: 11, color: 'rgba(251,247,240,.3)' }}>puntos disponibles</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={() => { setScreen('customer'); setResult(null); }} className="hs-btn hs-btn-ghost"
                style={{ width: '100%', justifyContent: 'center', borderRadius: 12 }}>
                Ver perfil del cliente
              </button>
              <button onClick={reset} className="hs-btn hs-btn-gold"
                style={{ width: '100%', justifyContent: 'center', borderRadius: 12 }}>
                Nueva transacción
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(251,247,240,.4)', marginBottom: 8, fontFamily: "'Montserrat', sans-serif" };
const inp = { width: '100%', background: 'rgba(251,247,240,.04)', color: 'var(--cream)', border: '1px solid rgba(251,247,240,.12)', borderRadius: 12, padding: '14px 16px', outline: 'none', fontFamily: "'Montserrat', sans-serif", fontSize: 15, transition: 'border-color .2s', boxSizing: 'border-box' };
const errBox = { background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.25)', color: '#E05C5C', fontSize: 12, padding: '10px 14px', borderRadius: 10, marginTop: 10 };
const sBack = { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(251,247,240,.4)', fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: 0, marginBottom: 16, fontFamily: "'Montserrat', sans-serif" };
const sLbl = lbl;
const sInp = inp;
const sErr = errBox;
