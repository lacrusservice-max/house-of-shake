import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const QRScanner = lazy(() => import('../components/QRScanner'));

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LEVEL = {
  BRONZE: { color: '#cd7f32', bg: 'rgba(205,127,50,.15)', emoji: '🥉', label: 'Bronze' },
  SILVER: { color: '#c0c0c0', bg: 'rgba(192,192,192,.12)', emoji: '🥈', label: 'Silver' },
  GOLD:   { color: '#ffd700', bg: 'rgba(255,215,0,.12)',   emoji: '🥇', label: 'Gold'   },
};

export default function Staff() {
  const navigate = useNavigate();
  const token = localStorage.getItem('hos_staff_token') || localStorage.getItem('hos_admin_token') || '';

  if (!token) {
    // Redirect to unified login
    navigate('/login');
    return null;
  }

  function handleLogout() {
    localStorage.removeItem('hos_staff_token');
    localStorage.removeItem('hos_admin_token');
    navigate('/login');
  }

  return <POSView token={token} onLogout={handleLogout} />;
}

/* ─── POS View ─── */
function POSView({ token, onLogout }) {
  const [screen, setScreen]     = useState('home');
  const [searchMode, setSearchMode] = useState('qr'); // qr | manual | email
  const [codeInput, setCodeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [amount, setAmount]     = useState('');
  const [redeemPts, setRedeemPts] = useState('');
  const [result, setResult]     = useState(null);
  const [quickReg, setQuickReg] = useState({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Extract UUID from scanned text (handles extra characters from some QR scanners)
  function extractCode(raw) {
    const uuid = raw?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return uuid ? uuid[0] : raw?.trim();
  }

  async function lookupByCode(code) {
    if (!code?.trim() || loading) return;
    const cleanCode = extractCode(code);
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${encodeURIComponent(cleanCode)}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
        if (res.status === 404) throw new Error(`NOTFOUND:${cleanCode}`);
        throw new Error(data.error || 'Error al buscar cliente');
      }
      const cust = data.customer || data;
      setCustomer(cust);
      setScreen('customer');
    } catch (err) {
      if (err.name === 'TypeError') {
        setError('Sin conexión al servidor. Verifica tu internet e intenta de nuevo.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function lookupByEmail(email) {
    if (!email?.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/customers/email/${encodeURIComponent(email.trim().toLowerCase())}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
        if (res.status === 404) throw new Error('No se encontró ningún cliente con ese email. ¿Ya se registró en la app?');
        throw new Error(data.error || 'Error al buscar cliente');
      }
      const cust = data.customer || data;
      setCustomer({
        id: cust.id,
        firstName: cust.firstName,
        lastName: cust.lastName,
        email: cust.email,
        availablePoints: cust.availablePoints,
        totalPoints: cust.totalPoints,
        lifetimePoints: cust.lifetimePoints,
        level: cust.level,
        recentTransactions: cust.transactions || [],
      });
      setScreen('customer');
    } catch (err) {
      if (err.name === 'TypeError') {
        setError('Sin conexión al servidor. Verifica tu internet.');
      } else {
        setError(err.message);
      }
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
      setAmount(''); setScreen('success');
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
      const res = await fetch(`${API}/pos/customer/${customer.id}/redeem`, {
        method: 'POST', headers,
        body: JSON.stringify({ points: parseInt(redeemPts) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al canjear');
      setResult({ type: 'redeem', ...data });
      setRedeemPts(''); setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickRegister(e) {
    e.preventDefault();
    setQuickReg(q => ({ ...q, loading: true, error: '' }));
    try {
      const res = await fetch(`${API}/pos/quick-register`, {
        method: 'POST', headers,
        body: JSON.stringify({ firstName: quickReg.firstName, lastName: quickReg.lastName, email: quickReg.email }),
      });
      const data = await res.json();
      if (res.status === 409 && data.customer) {
        setCustomer(data.customer);
        setError('');
        setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
        setScreen('customer');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
      setCustomer(data.customer);
      setError('');
      setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
      setScreen('customer');
    } catch (err) {
      setQuickReg(q => ({ ...q, loading: false, error: err.message }));
    }
  }

  function reset() {
    setScreen('home'); setCustomer(null); setError(''); setResult(null);
    setCodeInput(''); setEmailInput(''); setAmount(''); setRedeemPts('');
    setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
  }

  const lvl = LEVEL[customer?.level] || LEVEL.BRONZE;
  const redeemable = customer ? Math.floor(customer.availablePoints / 100) * 5 : 0;
  const maxRedeem = customer ? Math.floor(customer.availablePoints / 100) * 100 : 0;

  return (
    <div className="mc-root" style={{ minHeight: '100vh' }}>
      {/* Top nav */}
      <nav className="mc-nav">
        <div className="mc-nav-brand">
          <div className="mc-nav-logo">☕</div>
          <span className="mc-nav-title">POS · COBRAR</span>
        </div>
        <button onClick={onLogout} className="mc-nav-logout">Salir</button>
      </nav>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>

        {/* ── HOME ── */}
        {screen === 'home' && (
          <div>
            <div className="mc-eyebrow" style={{ marginBottom: 8 }}>Punto de venta</div>
            <h1 className="mc-heading" style={{ fontSize: 46, marginBottom: 6 }}>
              Cobrar <span>cliente</span>
            </h1>
            <p style={{ color: 'rgba(251,247,240,.4)', fontSize: 13, fontWeight: 600, marginBottom: 28 }}>
              Selecciona cómo identificar al cliente
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              {/* Cámara QR */}
              <button onClick={() => { setSearchMode('qr'); setScreen('camera'); }} style={S.bigBtn('#F5C842', '#2C1A0E')}>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Escanear QR con cámara</div>
                  <div style={{ fontSize: 11, opacity: .7 }}>Apunta al código QR del cliente</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .5 }}>›</span>
              </button>

              {/* Email */}
              <button onClick={() => { setSearchMode('email'); setScreen('searchEmail'); }} style={S.bigBtn('rgba(94,201,122,.12)', 'var(--cream)', '1px solid rgba(94,201,122,.25)')}>
                <div style={{ fontSize: 32 }}>📧</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Buscar por email</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>El cliente dice su correo</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>

              {/* Manual ID */}
              <button onClick={() => { setSearchMode('manual'); setScreen('searchManual'); }} style={S.bigBtn('rgba(251,247,240,.05)', 'var(--cream)', '1px solid rgba(251,247,240,.1)')}>
                <div style={{ fontSize: 32 }}>⌨️</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Ingresar ID manual</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>Pega el código del QR</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>
            </div>
          </div>
        )}

        {/* ── CAMERA QR ── */}
        {screen === 'camera' && (() => {
          const isNotFound = error?.startsWith('NOTFOUND:');
          const scannedId = isNotFound ? error.replace('NOTFOUND:', '') : null;
          return (
            <div>
              <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
              <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>
                Escanear <span>QR</span>
              </h2>

              {/* NOT FOUND: show clear explanation + options */}
              {isNotFound && !quickReg.show && (
                <div style={{ ...S.err, marginBottom: 14 }}>
                  <p style={{ fontWeight: 800, marginBottom: 6 }}>⚠️ Cliente no encontrado</p>
                  <p style={{ fontSize: 11, opacity: .8, marginBottom: 10 }}>
                    QR escaneado: <code style={{ background: 'rgba(224,92,92,.15)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }}>{scannedId?.substring(0, 16)}...</code>
                  </p>
                  <p style={{ fontSize: 12, opacity: .75, marginBottom: 12, lineHeight: 1.5 }}>
                    Este cliente no está registrado. Regístralo ahora o pídele ir a:<br/>
                    <strong>house-of-shake.vercel.app/registro</strong>
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setQuickReg(q => ({ ...q, show: true }))}
                      style={{ flex: 1, padding: '9px 12px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#2C1A0E', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                      ✚ Registrar aquí
                    </button>
                    <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                      style={{ flex: 1, padding: '9px 12px', background: 'none', border: '1px solid rgba(224,92,92,.5)', borderRadius: 8, color: '#E05C5C', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Buscar email
                    </button>
                    <button onClick={() => setError('')}
                      style={{ flex: 1, padding: '9px 12px', background: 'none', border: '1px solid rgba(251,247,240,.15)', borderRadius: 8, color: 'rgba(251,247,240,.5)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Reintentar
                    </button>
                  </div>
                </div>
              )}

              {/* Quick register form */}
              {isNotFound && quickReg.show && (
                <div style={{ background: 'rgba(245,200,66,.06)', border: '1px solid rgba(245,200,66,.2)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 12, fontSize: 14 }}>✚ Registrar cliente rápido</p>
                  <form onSubmit={handleQuickRegister}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input required placeholder="Nombre *" value={quickReg.firstName}
                        onChange={e => setQuickReg(q => ({ ...q, firstName: e.target.value }))}
                        style={{ ...S.inp, fontSize: 13, padding: '10px 12px' }} />
                      <input placeholder="Apellido" value={quickReg.lastName}
                        onChange={e => setQuickReg(q => ({ ...q, lastName: e.target.value }))}
                        style={{ ...S.inp, fontSize: 13, padding: '10px 12px' }} />
                    </div>
                    <input required type="email" placeholder="Email *" value={quickReg.email}
                      onChange={e => setQuickReg(q => ({ ...q, email: e.target.value }))}
                      style={{ ...S.inp, fontSize: 13, padding: '10px 12px', marginBottom: 8 }} />
                    {quickReg.error && <div style={{ ...S.err, marginBottom: 8 }}>{quickReg.error}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" disabled={quickReg.loading}
                        style={{ flex: 1, padding: '10px', background: 'var(--gold)', border: 'none', borderRadius: 10, color: '#2C1A0E', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: quickReg.loading ? .6 : 1 }}>
                        {quickReg.loading ? 'Registrando…' : 'Crear cuenta →'}
                      </button>
                      <button type="button" onClick={() => setQuickReg(q => ({ ...q, show: false }))}
                        style={{ padding: '10px 14px', background: 'none', border: '1px solid rgba(251,247,240,.15)', borderRadius: 10, color: 'rgba(251,247,240,.4)', cursor: 'pointer', fontSize: 11 }}>
                        ✕
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Generic error */}
              {error && !isNotFound && (
                <div style={{ ...S.err, marginBottom: 14 }}>
                  {error}
                  <br/>
                  <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                    style={{ marginTop: 8, background: 'none', border: '1px solid rgba(224,92,92,.4)', borderRadius: 8, color: '#E05C5C', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    Buscar por email en cambio
                  </button>
                </div>
              )}

              {loading && <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 16, fontWeight: 600 }}>Buscando cliente…</div>}

              {/* Re-mount scanner when user clicks "intentar de nuevo" */}
              <Suspense fallback={<div style={{ color: 'rgba(251,247,240,.4)', textAlign: 'center', padding: 40, fontSize: 13 }}>Cargando cámara…</div>}>
                <QRScanner
                  key={error ? 'error' : 'scanning'} // re-mount after error reset
                  onScan={(code) => { setCodeInput(code); lookupByCode(code); }}
                  onClose={() => setScreen('home')}
                />
              </Suspense>
            </div>
          );
        })()}

        {/* ── SEARCH BY EMAIL ── */}
        {screen === 'searchEmail' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>
              Buscar por <span>email</span>
            </h2>
            <p style={{ color: 'rgba(251,247,240,.4)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              El cliente dice su correo electrónico
            </p>
            <form onSubmit={e => { e.preventDefault(); lookupByEmail(emailInput); }}>
              <label style={S.lbl}>Correo del cliente</label>
              <input
                type="email" required autoFocus
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="cliente@email.com"
                style={S.inp}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.goldBtn, marginTop: 14 }}>
                {loading ? 'Buscando…' : 'Buscar cliente →'}
              </button>
            </form>
          </div>
        )}

        {/* ── SEARCH MANUAL ── */}
        {screen === 'searchManual' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>
              Código <span>manual</span>
            </h2>
            <form onSubmit={e => { e.preventDefault(); lookupByCode(codeInput); }}>
              <label style={S.lbl}>ID del cliente (del QR)</label>
              <input
                type="text" required autoFocus
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                placeholder="Pega el ID aquí..."
                style={{ ...S.inp, fontFamily: 'monospace', fontSize: 13 }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.goldBtn, marginTop: 14 }}>
                {loading ? 'Buscando…' : 'Buscar cliente →'}
              </button>
            </form>
          </div>
        )}

        {/* ── CUSTOMER PROFILE ── */}
        {screen === 'customer' && customer && (
          <div>
            <button onClick={reset} style={S.back}>← Nueva búsqueda</button>

            {/* Customer card */}
            <div style={{
              background: `linear-gradient(135deg, #2C1A0E 0%, #1a0e06 100%)`,
              border: `2px solid ${lvl.color}40`,
              borderRadius: 20, padding: '20px 22px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ minWidth: 0, marginRight: 12 }}>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 4 }}>House of Shake</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--cream)', lineHeight: 1.1 }}>
                    {customer.firstName} {customer.lastName}
                  </div>
                  {customer.email && (
                    <div style={{ fontSize: 11, color: 'rgba(251,247,240,.35)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer.email}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0, background: lvl.bg, borderRadius: 12, padding: '8px 12px' }}>
                  <div style={{ fontSize: 24 }}>{lvl.emoji}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, color: lvl.color }}>{lvl.label}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(251,247,240,.06)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 4 }}>Disponibles</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: 'var(--gold)', lineHeight: 1 }}>{customer.availablePoints}</div>
                  <div style={{ fontSize: 9, color: 'rgba(251,247,240,.25)', marginTop: 2 }}>puntos</div>
                </div>
                <div style={{ background: 'rgba(251,247,240,.06)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 4 }}>Canjeable</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: '#5EC97A', lineHeight: 1 }}>${redeemable}</div>
                  <div style={{ fontSize: 9, color: 'rgba(251,247,240,.25)', marginTop: 2 }}>MXN desc.</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <button onClick={() => { setScreen('addPoints'); setError(''); }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '20px 16px', borderRadius: 16,
                background: 'rgba(94,201,122,.1)', border: '1px solid rgba(94,201,122,.3)',
                color: '#5EC97A', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
              }}>
                <span style={{ fontSize: 28 }}>✚</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>Acumular</span>
                <span style={{ fontSize: 10, opacity: .7 }}>Agregar puntos</span>
              </button>
              <button
                disabled={customer.availablePoints < 100}
                onClick={() => { setScreen('redeem'); setError(''); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 16px', borderRadius: 16,
                  background: 'rgba(74,159,212,.1)', border: '1px solid rgba(74,159,212,.3)',
                  color: '#4a9fd4', cursor: customer.availablePoints < 100 ? 'not-allowed' : 'pointer',
                  opacity: customer.availablePoints < 100 ? .4 : 1,
                  fontFamily: "'Montserrat', sans-serif",
                }}>
                <span style={{ fontSize: 28 }}>🎁</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>Canjear</span>
                <span style={{ fontSize: 10, opacity: .7 }}>
                  {customer.availablePoints < 100 ? 'Sin saldo' : `$${redeemable} disp.`}
                </span>
              </button>
            </div>

            {/* Recent txns */}
            {customer.recentTransactions?.length > 0 && (
              <div style={{ background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.07)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Últimas transacciones</div>
                {customer.recentTransactions.slice(0, 4).map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(251,247,240,.04)' }}>
                    <span style={{ color: 'rgba(251,247,240,.5)', fontSize: 12, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: t.points > 0 ? '#5EC97A' : '#E05C5C', flexShrink: 0 }}>
                      {t.points > 0 ? '+' : ''}{t.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ADD POINTS ── */}
        {screen === 'addPoints' && customer && (
          <div>
            <button onClick={() => setScreen('customer')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 36, marginBottom: 4 }}>
              Acumular <span>puntos</span>
            </h2>
            <p style={{ color: 'rgba(251,247,240,.45)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Para: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            <div style={{ background: 'rgba(245,200,66,.06)', border: '1px solid rgba(245,200,66,.2)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 20 }}>
              1 punto por cada $1 MXN · {lvl.label} tiene bonus extra
            </div>

            <form onSubmit={handleAddPoints}>
              <label style={S.lbl}>Monto de la compra (MXN)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'rgba(251,247,240,.4)', fontSize: 24, pointerEvents: 'none' }}>$</span>
                <input
                  type="number" required min="1" step="0.01" autoFocus
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ ...S.inp, paddingLeft: 46, fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, height: 72 }}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                />
              </div>
              {amount && parseFloat(amount) > 0 && (
                <div style={{ textAlign: 'center', color: '#5EC97A', fontSize: 16, fontWeight: 800, marginTop: 10, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
                  +{Math.floor(parseFloat(amount) || 0)} puntos → {customer.firstName}
                </div>
              )}
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0} style={{ ...S.goldBtn, marginTop: 20, fontSize: 15, height: 56, opacity: (loading || !amount) ? .6 : 1 }}>
                {loading ? '⏳ Procesando…' : '✓ Confirmar compra'}
              </button>
            </form>
          </div>
        )}

        {/* ── REDEEM ── */}
        {screen === 'redeem' && customer && (
          <div>
            <button onClick={() => setScreen('customer')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 36, marginBottom: 4 }}>
              Canjear <span>puntos</span>
            </h2>
            <p style={{ color: 'rgba(251,247,240,.45)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Para: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            {/* Points balance */}
            <div style={{ background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.08)', borderRadius: 16, padding: '18px 20px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 6 }}>Puntos disponibles</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: 'var(--gold)', lineHeight: 1 }}>{customer.availablePoints}</div>
              <div style={{ fontSize: 11, color: 'rgba(251,247,240,.3)', marginTop: 4 }}>100 pts = $5 MXN de descuento</div>
            </div>

            {/* Quick select buttons */}
            {maxRedeem > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, Math.floor(maxRedeem/100))}, 1fr)`, gap: 8, marginBottom: 16 }}>
                {[100, 200, 300, 400, 500].filter(v => v <= maxRedeem).slice(0, 4).map(v => (
                  <button key={v} onClick={() => setRedeemPts(String(v))}
                    style={{
                      padding: '12px 6px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${redeemPts === String(v) ? 'var(--gold)' : 'rgba(251,247,240,.1)'}`,
                      background: redeemPts === String(v) ? 'var(--gold)' : 'rgba(251,247,240,.05)',
                      color: redeemPts === String(v) ? '#2C1A0E' : 'var(--cream)',
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textAlign: 'center',
                    }}>
                    <div style={{ fontSize: 13 }}>{v}</div>
                    <div style={{ fontSize: 10, opacity: .8 }}>=${(v/100)*5} MXN</div>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleRedeem}>
              <label style={S.lbl}>Puntos a canjear (múltiplos de 100)</label>
              <input
                type="number" required min="100" step="100" max={maxRedeem}
                value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                placeholder="100, 200, 300..."
                style={{ ...S.inp, textAlign: 'center', fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
              />
              {redeemPts && parseInt(redeemPts) >= 100 && (
                <div style={{ textAlign: 'center', color: '#4a9fd4', fontWeight: 800, fontSize: 16, marginTop: 10, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
                  Descuento: ${(Math.floor(parseInt(redeemPts) / 100) * 5).toFixed(0)} MXN
                </div>
              )}
              {error && <div style={S.err}>{error}</div>}
              <button type="submit"
                disabled={loading || !redeemPts || parseInt(redeemPts) < 100 || parseInt(redeemPts) > maxRedeem}
                style={{ ...S.goldBtn, marginTop: 16, fontSize: 15, height: 56, opacity: (loading || !redeemPts || parseInt(redeemPts) < 100) ? .5 : 1 }}>
                {loading ? '⏳ Procesando…' : '✓ Confirmar canje'}
              </button>
            </form>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {screen === 'success' && result && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ fontSize: 72, marginBottom: 12 }}>{result.type === 'earn' ? '🎉' : '🎁'}</div>

            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 2, lineHeight: 1, color: result.type === 'earn' ? '#5EC97A' : '#4a9fd4', marginBottom: 8 }}>
              {result.type === 'earn'
                ? `+${result.pointsAdded} pts`
                : `$${result.discountUsd?.toFixed(0)} MXN desc.`
              }
            </div>
            <p style={{ color: 'rgba(251,247,240,.55)', fontSize: 14, marginBottom: 24 }}>
              {result.type === 'earn' ? 'agregados a' : 'descuento para'}{' '}
              <strong style={{ color: 'var(--cream)' }}>{customer?.firstName}</strong>
            </p>

            {/* New balance */}
            <div style={{ background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.09)', borderRadius: 18, padding: '20px 24px', marginBottom: 28 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 6 }}>Nuevo saldo</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: 'var(--gold)', lineHeight: 1 }}>
                {result.newBalance}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(251,247,240,.25)', marginTop: 4 }}>puntos disponibles</div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={() => { setScreen('customer'); setResult(null); }} style={{ ...S.ghostBtn }}>
                Ver perfil del cliente
              </button>
              <button onClick={reset} style={S.goldBtn}>
                Nueva transacción
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── Shared styles ─── */
const S = {
  lbl: {
    display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: 'rgba(251,247,240,.4)', marginBottom: 8,
    fontFamily: "'Montserrat', sans-serif",
  },
  inp: {
    width: '100%', background: 'rgba(251,247,240,.05)', color: 'var(--cream)',
    border: '1px solid rgba(251,247,240,.12)', borderRadius: 12,
    padding: '14px 16px', outline: 'none',
    fontFamily: "'Montserrat', sans-serif", fontSize: 15,
    transition: 'border-color .2s', boxSizing: 'border-box',
    WebkitAppearance: 'none',
  },
  goldBtn: {
    width: '100%', padding: '16px', background: 'var(--gold)', color: '#2C1A0E',
    border: 'none', borderRadius: 14, fontFamily: "'Montserrat', sans-serif",
    fontWeight: 900, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  ghostBtn: {
    width: '100%', padding: '15px', background: 'rgba(251,247,240,.07)',
    color: 'var(--cream)', border: '1px solid rgba(251,247,240,.12)',
    borderRadius: 14, fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  back: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(251,247,240,.4)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1, padding: 0, marginBottom: 20,
    fontFamily: "'Montserrat', sans-serif", display: 'block',
  },
  err: {
    background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.25)',
    color: '#E05C5C', fontSize: 13, padding: '12px 16px',
    borderRadius: 12, marginTop: 12,
  },
  bigBtn: (bg, color, border = 'none') => ({
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '18px 20px', borderRadius: 16,
    background: bg, color, border,
    cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
    transition: 'opacity .15s', width: '100%', textAlign: 'left',
  }),
};
