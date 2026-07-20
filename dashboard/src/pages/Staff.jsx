import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';
import { CoffeeIcon, GiftIcon, StarIcon, CakeIcon, LightningIcon, SearchIcon, WarningIcon, CheckIcon } from '../components/Icons';

const QRScanner = lazy(() => import('../components/QRScanner'));

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Pino calc: ciclo basado en availablePoints para que el canje reinicie el ciclo
function calcPines(availablePoints = 0, lifetimePoints = 0) {
  const availPines   = Math.floor(availablePoints / 10);
  const pinesInCycle = availPines % 120;
  const slotsEarned  = (pinesInCycle === 0 && availPines > 0) ? 10 : Math.floor(pinesInCycle / 12);
  const cardComplete = slotsEarned === 10;
  const pinesLeft    = cardComplete ? 0 : 120 - pinesInCycle;
  const totalPines   = Math.floor(lifetimePoints / 10);
  return { availPines, pinesInCycle, slotsEarned, cardComplete, pinesLeft, totalPines };
}

export default function Staff() {
  const navigate = useNavigate();
  const token = localStorage.getItem('hos_staff_token') || localStorage.getItem('hos_admin_token') || '';
  if (!token) { navigate('/login'); return null; }
  function handleLogout() {
    localStorage.removeItem('hos_staff_token');
    localStorage.removeItem('hos_admin_token');
    navigate('/login');
  }
  return <POSView token={token} onLogout={handleLogout} />;
}

function POSView({ token, onLogout }) {
  const [screen, setScreen]         = useState('home');
  const [searchMode, setSearchMode] = useState('qr');
  const [codeInput, setCodeInput]   = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput]   = useState('');
  const [nameResults, setNameResults] = useState([]);
  const [customer, setCustomer]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [amount, setAmount]         = useState('');
  const [result, setResult]         = useState(null);
  const [quickReg, setQuickReg]     = useState({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

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
      setCustomer(data.customer || data);
      setScreen('customer');
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Sin conexión al servidor.' : err.message);
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
        if (res.status === 404) throw new Error('No se encontró cliente con ese email. ¿Ya se registró?');
        throw new Error(data.error || 'Error');
      }
      const cust = data.customer || data;
      const posRes = await fetch(`${API}/pos/customer/${cust.id}`, { headers });
      const posData = posRes.ok ? await posRes.json() : {};
      setCustomer({ ...cust, recentTransactions: cust.transactions || [], ...posData });
      setScreen('customer');
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Sin conexión.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchByName(q) {
    setNameInput(q);
    if (q.trim().length < 2) { setNameResults([]); return; }
    try {
      const res = await fetch(`${API}/pos/search?q=${encodeURIComponent(q.trim())}`, { headers });
      const data = await res.json();
      setNameResults(data.customers || []);
    } catch { setNameResults([]); }
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
      if (!res.ok) throw new Error(data.error || 'Error al agregar Pinos');
      setResult({ type: 'earn', customerName: customer.firstName, ...data });
      setAmount(''); setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeemDrink() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/redeem-drink`, {
        method: 'POST', headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al canjear');
      setResult({ type: 'redeemDrink', customerName: customer.firstName, ...data });
      setScreen('success');
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
    setCodeInput(''); setEmailInput(''); setAmount('');
    setNameInput(''); setNameResults([]);
    setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
  }

  const pines = customer ? calcPines(customer.availablePoints, customer.lifetimePoints) : null;
  const pinesPreview = amount && parseFloat(amount) > 0 ? Math.floor(parseFloat(amount) / 10) : 0;

  return (
    <div className="mc-root" style={{ minHeight: '100vh' }}>
      <nav className="mc-nav">
        <div className="mc-nav-brand">
          <div className="mc-nav-logo"><CoffeeIcon size={28} color="#c8961e" /></div>
          <span className="mc-nav-title">POS · HOUSE OF SHAKE</span>
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
              Identifica al cliente antes de cobrar para acumular Pinos 🌲
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={() => { setSearchMode('qr'); setScreen('camera'); }} style={S.bigBtn('#F5C842', '#2C1A0E')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><SearchIcon size={28} color="#2C1A0E" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Escanear QR con cámara</div>
                  <div style={{ fontSize: 11, opacity: .7 }}>Apunta al código QR del cliente</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .5 }}>›</span>
              </button>

              <button onClick={() => { setSearchMode('email'); setScreen('searchEmail'); }} style={S.bigBtn('rgba(94,201,122,.12)', 'var(--cream)', '1px solid rgba(94,201,122,.25)')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><StarIcon size={28} color="#5EC97A" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Buscar por email</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>El cliente dice su correo</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>

              <button onClick={() => { setSearchMode('name'); setNameInput(''); setNameResults([]); setScreen('searchName'); }} style={S.bigBtn('rgba(74,159,212,.08)', 'var(--cream)', '1px solid rgba(74,159,212,.2)')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><SearchIcon size={28} color="#4a9fd4" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Buscar por nombre</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>El cliente no trae su teléfono</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>

              <button onClick={() => { setSearchMode('manual'); setScreen('searchManual'); }} style={S.bigBtn('rgba(251,247,240,.05)', 'var(--cream)', '1px solid rgba(251,247,240,.1)')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><CoffeeIcon size={28} color="rgba(251,247,240,.5)" /></div>
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
          const scannedId  = isNotFound ? error.replace('NOTFOUND:', '') : null;
          return (
            <div>
              <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
              <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Escanear <span>QR</span></h2>

              {isNotFound && !quickReg.show && (
                <div style={{ ...S.err, marginBottom: 14 }}>
                  <p style={{ fontWeight: 800, marginBottom: 6, display:'flex', alignItems:'center', gap:6 }}><WarningIcon size={16} color="#E05C5C" /> Cliente no encontrado</p>
                  <p style={{ fontSize: 11, opacity: .8, marginBottom: 10 }}>
                    QR: <code style={{ background: 'rgba(224,92,92,.15)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }}>{scannedId?.substring(0, 16)}…</code>
                  </p>
                  <p style={{ fontSize: 12, opacity: .75, marginBottom: 12, lineHeight: 1.5 }}>
                    Regístralo ahora o pídele ir a: <strong>house-of-shake.vercel.app/registro</strong>
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

              {error && !isNotFound && (
                <div style={{ ...S.err, marginBottom: 14 }}>
                  {error}
                  <br />
                  <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                    style={{ marginTop: 8, background: 'none', border: '1px solid rgba(224,92,92,.4)', borderRadius: 8, color: '#E05C5C', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    Buscar por email
                  </button>
                </div>
              )}

              {loading && <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 16, fontWeight: 600 }}>Buscando…</div>}

              <Suspense fallback={<div style={{ color: 'rgba(251,247,240,.4)', textAlign: 'center', padding: 40, fontSize: 13 }}>Cargando cámara…</div>}>
                <QRScanner
                  key={error ? 'error' : 'scanning'}
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
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Buscar por <span>email</span></h2>
            <p style={{ color: 'rgba(251,247,240,.4)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>El cliente dice su correo electrónico</p>
            <form onSubmit={e => { e.preventDefault(); lookupByEmail(emailInput); }}>
              <label style={S.lbl}>Correo del cliente</label>
              <input type="email" required autoFocus value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="cliente@email.com" style={S.inp}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'} />
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.goldBtn, marginTop: 14 }}>
                {loading ? 'Buscando…' : 'Buscar cliente →'}
              </button>
            </form>
          </div>
        )}

        {/* ── SEARCH BY NAME ── */}
        {screen === 'searchName' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Buscar por <span>nombre</span></h2>
            <label style={S.lbl}>Nombre del cliente</label>
            <input type="text" autoFocus value={nameInput}
              onChange={e => searchByName(e.target.value)}
              placeholder="Ej: Juan, García..." style={S.inp}
              onFocus={e => e.target.style.borderColor = 'var(--gold)'}
              onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'} />
            {error && <div style={S.err}>{error}</div>}
            {nameResults.length > 0 && (
              <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                {nameResults.map(c => {
                  const cp = calcPines(c.availablePoints || 0);
                  return (
                    <button key={c.id} onClick={() => lookupByCode(c.id)} style={{
                      background: 'rgba(251,247,240,.05)', border: '1px solid rgba(251,247,240,.1)',
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      color: 'var(--cream)', fontFamily: 'inherit',
                    }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.firstName} {c.lastName}</div>
                        {c.phone && <div style={{ fontSize: 11, color: 'rgba(251,247,240,.35)', marginTop: 2 }}>Tel: {c.phone}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: cp.cardComplete ? '#5EC97A' : 'var(--gold)' }}>
                          {cp.pinesInCycle}<span style={{ fontSize: 12, opacity: .5 }}>/120</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(251,247,240,.3)', marginTop: 1 }}>Pinos 🌲</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {nameInput.length >= 2 && nameResults.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'rgba(251,247,240,.3)', fontSize: 13, marginTop: 20 }}>Sin resultados para "{nameInput}"</div>
            )}
          </div>
        )}

        {/* ── SEARCH MANUAL ── */}
        {screen === 'searchManual' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Código <span>manual</span></h2>
            <form onSubmit={e => { e.preventDefault(); lookupByCode(codeInput); }}>
              <label style={S.lbl}>ID del cliente (del QR)</label>
              <input type="text" required autoFocus value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                placeholder="Pega el ID aquí..."
                style={{ ...S.inp, fontFamily: 'monospace', fontSize: 13 }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'} />
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.goldBtn, marginTop: 14 }}>
                {loading ? 'Buscando…' : 'Buscar cliente →'}
              </button>
            </form>
          </div>
        )}

        {/* ── CUSTOMER PROFILE ── */}
        {screen === 'customer' && customer && pines && (
          <div>
            <button onClick={reset} style={S.back}>← Nueva búsqueda</button>

            {/* Birthday banner */}
            {customer.isBirthday && (
              <div style={{ background: 'linear-gradient(135deg, rgba(255,128,176,.15), rgba(245,200,66,.08))', border: '1px solid rgba(255,128,176,.4)', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <CakeIcon size={26} color="#FF80B0" animated />
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#FF80B0', margin: 0 }}>¡Hoy es el cumpleaños de {customer.firstName}!</p>
                  <p style={{ fontSize: 12, color: 'rgba(251,247,240,.55)', margin: '2px 0 0' }}>Pídele que reclame sus +20 Pinos 🌲 de regalo en su app</p>
                </div>
              </div>
            )}

            {/* Double pines banner */}
            {customer.doublePointsActive && (
              <div style={{ background: 'rgba(245,200,66,.1)', border: '1px solid rgba(245,200,66,.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <LightningIcon size={20} color="#F5C842" animated />
                <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--gold)', margin: 0 }}>🌲 ¡Pinos dobles activos! Esta compra suma el doble de Pinos automáticamente</p>
              </div>
            )}

            {/* Card complete banner */}
            {pines.cardComplete && (
              <div style={{ background: 'rgba(94,201,122,.1)', border: '1px solid rgba(94,201,122,.4)', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>🌲</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#5EC97A', margin: 0 }}>¡120 Pinos completados!</p>
                  <p style={{ fontSize: 12, color: 'rgba(251,247,240,.6)', margin: '2px 0 0' }}>Este cliente puede canjear su bebida gratis hasta $90</p>
                </div>
              </div>
            )}

            {/* Customer card */}
            <div style={{ background: 'linear-gradient(135deg, #0A2850, #071E3D)', border: '2px solid rgba(245,200,66,.25)', borderRadius: 20, padding: '20px 22px', marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 4 }}>House of Shake Rewards</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--cream)', lineHeight: 1.1 }}>
                  {customer.firstName} {customer.lastName}
                </div>
                {customer.email && (
                  <div style={{ fontSize: 11, color: 'rgba(251,247,240,.35)', marginTop: 3 }}>{customer.email}</div>
                )}
              </div>

              {/* Pine stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'rgba(251,247,240,.06)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 4 }}>Ciclo</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: pines.cardComplete ? '#5EC97A' : 'var(--gold)', lineHeight: 1 }}>
                    {pines.pinesInCycle}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(251,247,240,.25)', marginTop: 2 }}>/ 120 Pinos</div>
                </div>
                <div style={{ background: 'rgba(251,247,240,.06)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 4 }}>Totales</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'rgba(251,247,240,.7)', lineHeight: 1 }}>{pines.totalPines}</div>
                  <div style={{ fontSize: 9, color: 'rgba(251,247,240,.25)', marginTop: 2 }}>Pinos 🌲</div>
                </div>
                <div style={{ background: pines.cardComplete ? 'rgba(94,201,122,.12)' : 'rgba(251,247,240,.06)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: pines.cardComplete ? 'rgba(94,201,122,.7)' : 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {pines.cardComplete ? 'Estado' : 'Faltan'}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: pines.cardComplete ? '#5EC97A' : 'rgba(251,247,240,.7)', lineHeight: 1 }}>
                    {pines.cardComplete ? '🎉' : pines.pinesLeft}
                  </div>
                  <div style={{ fontSize: 9, color: pines.cardComplete ? 'rgba(94,201,122,.6)' : 'rgba(251,247,240,.25)', marginTop: 2 }}>
                    {pines.cardComplete ? '¡Bebida lista!' : 'para bebida'}
                  </div>
                </div>
              </div>

              {/* Pine progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(251,247,240,.4)', letterSpacing: 1 }}>PROGRESO DEL CICLO</span>
                  <span style={{ fontSize: 10, color: pines.cardComplete ? '#5EC97A' : 'rgba(251,247,240,.4)' }}>
                    {pines.slotsEarned}/10 slots
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.round((pines.pinesInCycle / 120) * 100)}%`,
                    background: pines.cardComplete ? '#5EC97A' : 'var(--gold)',
                    transition: 'width .4s ease',
                    minWidth: pines.pinesInCycle > 0 ? 8 : 0,
                  }} />
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
                <span style={{ fontSize: 10, opacity: .7 }}>Agregar Pinos</span>
              </button>

              <button
                disabled={!pines.cardComplete || loading}
                onClick={() => { setScreen('confirmDrink'); setError(''); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 16px', borderRadius: 16,
                  background: pines.cardComplete ? 'rgba(94,201,122,.15)' : 'rgba(251,247,240,.04)',
                  border: `1px solid ${pines.cardComplete ? 'rgba(94,201,122,.4)' : 'rgba(251,247,240,.1)'}`,
                  color: pines.cardComplete ? '#5EC97A' : 'rgba(251,247,240,.25)',
                  cursor: pines.cardComplete ? 'pointer' : 'not-allowed',
                  fontFamily: "'Montserrat', sans-serif",
                }}>
                <span style={{ fontSize: 28 }}>🌲</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>Bebida gratis</span>
                <span style={{ fontSize: 10, opacity: .7 }}>
                  {pines.cardComplete ? '120 Pinos ✓' : `Faltan ${pines.pinesLeft}`}
                </span>
              </button>
            </div>

            {/* Recent transactions */}
            {customer.recentTransactions?.length > 0 && (
              <div style={{ background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.07)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Últimos movimientos</div>
                {customer.recentTransactions.slice(0, 4).map(t => {
                  const pinosValue = (Math.abs(t.points) / 10);
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(251,247,240,.04)' }}>
                      <span style={{ color: 'rgba(251,247,240,.5)', fontSize: 12, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: t.points > 0 ? '#5EC97A' : '#E05C5C', flexShrink: 0 }}>
                        {t.points > 0 ? '+' : ''}{pinosValue % 1 === 0 ? pinosValue.toFixed(0) : pinosValue.toFixed(1)} 🌲
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADD POINTS ── */}
        {screen === 'addPoints' && customer && (
          <div>
            <button onClick={() => setScreen('customer')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 36, marginBottom: 4 }}>
              Acumular <span>Pinos</span>
            </h2>
            <p style={{ color: 'rgba(251,247,240,.45)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Para: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            <div style={{ background: 'rgba(245,200,66,.06)', border: '1px solid rgba(245,200,66,.2)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 20 }}>
              {customer.doublePointsActive ? '🌲🌲 PINOS DOBLES ACTIVOS — gana el doble hoy' : '1 Pino por cada $10 MXN · 120 Pinos = bebida gratis'}
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
              {pinesPreview > 0 && (
                <div style={{ background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.2)', borderRadius: 12, padding: '14px 18px', textAlign: 'center', marginTop: 12 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: '#5EC97A', lineHeight: 1 }}>
                    +{customer.doublePointsActive ? pinesPreview * 2 : pinesPreview} 🌲
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(94,201,122,.7)', fontWeight: 700 }}>
                    {customer.doublePointsActive ? 'Pinos dobles' : 'Pinos'} para {customer.firstName}
                  </div>
                  {pines && (
                    <div style={{ fontSize: 11, color: 'rgba(251,247,240,.35)', marginTop: 6 }}>
                      Ciclo actual: {pines.pinesInCycle} → {Math.min(120, pines.pinesInCycle + (customer.doublePointsActive ? pinesPreview * 2 : pinesPreview))}/120 Pinos
                    </div>
                  )}
                </div>
              )}
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0}
                style={{ ...S.goldBtn, marginTop: 20, fontSize: 15, height: 56, opacity: (loading || !amount) ? .6 : 1 }}>
                {loading ? 'Procesando…' : 'Confirmar compra'}
              </button>
            </form>
          </div>
        )}

        {/* ── CONFIRM DRINK REDEMPTION ── */}
        {screen === 'confirmDrink' && customer && pines && (
          <div>
            <button onClick={() => setScreen('customer')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 36, marginBottom: 4 }}>
              Canjear <span>bebida</span>
            </h2>
            <p style={{ color: 'rgba(251,247,240,.45)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              Para: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            <div style={{ background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.3)', borderRadius: 20, padding: '24px', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>🌲</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: '#5EC97A', letterSpacing: 2, lineHeight: 1, marginBottom: 8 }}>
                120 PINOS
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--cream)', marginBottom: 6 }}>Bebida gratis hasta $90 MXN</div>
              <div style={{ fontSize: 12, color: 'rgba(251,247,240,.45)', lineHeight: 1.5 }}>
                Si la bebida cuesta más de $90, el cliente paga la diferencia.<br/>
                Se descontarán 120 Pinos de su tarjeta.
              </div>
            </div>

            <div style={{ background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.08)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'rgba(251,247,240,.5)' }}>Pinos en ciclo actual</span>
                <span style={{ fontWeight: 800, color: '#5EC97A' }}>{pines.pinesInCycle} / 120 🌲</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'rgba(251,247,240,.5)' }}>Después del canje</span>
                <span style={{ fontWeight: 800, color: 'rgba(251,247,240,.6)' }}>
                  {Math.floor(((customer.availablePoints || 0) - 1200) / 10) % 120} / 120 Pinos
                </span>
              </div>
            </div>

            {error && <div style={{ ...S.err, marginBottom: 14 }}>{error}</div>}

            <button onClick={handleRedeemDrink} disabled={loading}
              style={{ ...S.goldBtn, background: '#5EC97A', marginBottom: 10, fontSize: 15, height: 56, opacity: loading ? .6 : 1 }}>
              {loading ? 'Procesando…' : '🌲 Confirmar bebida gratis'}
            </button>
            <button onClick={() => { setScreen('customer'); setError(''); }} style={S.ghostBtn}>
              Cancelar
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {screen === 'success' && result && (
          <SuccessScreen result={result} customer={customer} onViewProfile={() => { setScreen('customer'); setResult(null); }} onReset={reset} />
        )}

      </div>
    </div>
  );
}

/* ─── Success Screen ─── */
function SuccessScreen({ result, customer, onViewProfile, onReset }) {
  const newPines = calcPines(result.newBalance || result.newAvailablePoints || 0);

  return (
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <div style={{ marginBottom: 12, display:'flex', justifyContent:'center' }}>
        {result.type === 'earn'
          ? <StarIcon size={72} color="#F5C842" animated />
          : <span style={{ fontSize: 72 }}>🌲</span>}
      </div>

      {result.type === 'earn' && (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 2, lineHeight: 1, color: '#5EC97A', marginBottom: 4 }}>
            +{Math.floor((result.pointsAdded || 0) / 10)} Pinos 🌲
          </div>
          <p style={{ color: 'rgba(251,247,240,.55)', fontSize: 14, marginBottom: 16 }}>
            acumulados para <strong style={{ color: 'var(--cream)' }}>{result.customerName || customer?.firstName}</strong>
          </p>
        </>
      )}

      {result.type === 'redeemDrink' && (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, lineHeight: 1, color: '#5EC97A', marginBottom: 8 }}>
            ¡Bebida gratis!
          </div>
          <p style={{ color: 'rgba(251,247,240,.55)', fontSize: 14, marginBottom: 16 }}>
            120 Pinos canjeados para <strong style={{ color: 'var(--cream)' }}>{result.customerName || customer?.firstName}</strong>
          </p>
        </>
      )}

      <div style={{ background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.09)', borderRadius: 18, padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(251,247,240,.3)', textTransform: 'uppercase', marginBottom: 6 }}>Pinos en ciclo actual</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: newPines.cardComplete ? '#5EC97A' : 'var(--gold)', lineHeight: 1 }}>
          {result.newPinesInCycle ?? newPines.pinesInCycle} / 120
        </div>
        {newPines.cardComplete && (
          <div style={{ fontSize: 13, color: '#5EC97A', fontWeight: 800, marginTop: 8 }}>
            🌲 ¡Tarjeta completa! El cliente puede canjear otra bebida
          </div>
        )}
        {!newPines.cardComplete && (
          <div style={{ fontSize: 11, color: 'rgba(251,247,240,.3)', marginTop: 6 }}>
            {newPines.pinesLeft} Pinos más para bebida gratis
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        <button onClick={onViewProfile} style={S.ghostBtn}>Ver perfil del cliente</button>
        <button onClick={onReset} style={S.goldBtn}>Nueva transacción</button>
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
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
