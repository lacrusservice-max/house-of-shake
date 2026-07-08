import { useState, lazy, Suspense } from 'react';
import api from '../services/api';

const QRScanner = lazy(() => import('../components/QRScanner'));

const LEVEL = {
  BRONZE: { color: '#cd7f32', emoji: '🥉', label: 'Bronze' },
  SILVER: { color: '#c0c0c0', emoji: '🥈', label: 'Silver' },
  GOLD:   { color: '#ffd700', emoji: '🥇', label: 'Gold' },
};

export default function POS() {
  const [screen, setScreen]     = useState('home');  // home | scan | camera | searchEmail | customer | addPoints | redeem | success
  const [codeInput, setCodeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [amount, setAmount]     = useState('');
  const [redeemPts, setRedeemPts] = useState('');
  const [result, setResult]     = useState(null);
  const [quickReg, setQuickReg] = useState({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });

  function extractCode(raw) {
    const uuid = raw?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return uuid ? uuid[0] : raw?.trim();
  }

  async function lookupByCode(code) {
    if (!code.trim() || loading) return;
    const cleanCode = extractCode(code);
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/pos/customer/${encodeURIComponent(cleanCode)}`);
      const cust = data.customer || data;
      setCustomer(cust);
      setScreen('customer');
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setError(`NOTFOUND:${cleanCode}`);
      } else if (status === 401) {
        setError('Sesión expirada. Vuelve a iniciar sesión.');
      } else {
        setError(err.response?.data?.error || 'Error al buscar cliente');
      }
    } finally {
      setLoading(false);
    }
  }

  async function lookupByEmail(email) {
    if (!email.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/customers/email/${encodeURIComponent(email.trim().toLowerCase())}`);
      const cust = data.customer || data;
      // Get full POS data (includes affordableProducts)
      const posData = await api.get(`/pos/customer/${cust.id}`).then(r => r.data).catch(() => ({}));
      setCustomer({ ...cust, recentTransactions: cust.transactions || [], ...posData });
      setScreen('customer');
    } catch (err) {
      setError(err.response?.data?.error || 'Cliente no encontrado');
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
      const { data } = await api.post(`/pos/customer/${customer.id}/add-points`, {
        amount: parseFloat(amount),
      });
      setResult({ type: 'earn', ...data });
      setAmount('');
      setScreen('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al agregar puntos');
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post(`/pos/customer/${customer.id}/redeem`, {
        points: parseInt(redeemPts),
      });
      setResult({ type: 'redeem', ...data });
      setRedeemPts('');
      setScreen('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al canjear');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickRegister(e) {
    e.preventDefault();
    setQuickReg(q => ({ ...q, loading: true, error: '' }));
    try {
      const { data } = await api.post('/pos/quick-register', {
        firstName: quickReg.firstName,
        lastName: quickReg.lastName,
        email: quickReg.email,
      });
      const cust = data.customer;
      setCustomer(cust);
      setError('');
      setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
      setScreen('customer');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409 && err.response?.data?.customer) {
        setCustomer(err.response.data.customer);
        setError('');
        setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
        setScreen('customer');
      } else {
        setQuickReg(q => ({ ...q, loading: false, error: err.response?.data?.error || 'Error al registrar' }));
      }
    }
  }

  function reset() {
    setScreen('home'); setCustomer(null); setError('');
    setResult(null); setCodeInput(''); setEmailInput(''); setAmount(''); setRedeemPts('');
    setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
  }

  const lvl = LEVEL[customer?.level] || LEVEL.BRONZE;
  const redeemable = customer ? Math.floor(customer.availablePoints / 100) * 5 : 0;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── HOME ── */}
      {screen === 'home' && (
        <div>
          <h1 style={styles.title}>POS · Cobrar</h1>
          <p style={styles.sub}>Escanea el QR del cliente para acumular o canjear puntos</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 32 }}>
            <button onClick={() => setScreen('camera')} style={{ ...styles.bigBtn, background: 'var(--gold)', color: '#2C1A0E' }}>
              <span style={{ fontSize: 28 }}>📷</span>
              <div>
                <div style={styles.bigBtnTitle}>Escanear con cámara</div>
                <div style={styles.bigBtnSub}>Apunta al código QR del cliente</div>
              </div>
            </button>
            <button onClick={() => { setScreen('searchEmail'); setError(''); }} style={{ ...styles.bigBtn, background: 'rgba(245,200,66,.10)', color: 'var(--gold)', border: '1px solid rgba(245,200,66,.25)' }}>
              <span style={{ fontSize: 28 }}>📧</span>
              <div>
                <div style={styles.bigBtnTitle}>Buscar por email</div>
                <div style={{ ...styles.bigBtnSub, opacity: .7 }}>Escribe el correo del cliente</div>
              </div>
            </button>
            <button onClick={() => setScreen('scan')} style={{ ...styles.bigBtn, background: 'rgba(251,247,240,.06)', color: 'var(--cream)', border: '1px solid rgba(251,247,240,.12)' }}>
              <span style={{ fontSize: 28 }}>⌨️</span>
              <div>
                <div style={styles.bigBtnTitle}>Ingresar código manual</div>
                <div style={{ ...styles.bigBtnSub, opacity: .6 }}>Pega o escribe el ID del cliente</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── CAMERA SCAN ── */}
      {screen === 'camera' && (() => {
        const isNotFound = error?.startsWith('NOTFOUND:');
        const scannedId = isNotFound ? error.replace('NOTFOUND:', '') : null;
        return (
          <div>
            <button onClick={() => setScreen('home')} style={styles.back}>← Volver</button>
            <h2 style={styles.title}>Escanear QR</h2>

            {isNotFound && !quickReg.show && (
              <div style={{ ...styles.errorBox, marginBottom: 14 }}>
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
                    style={{ flex: 1, padding: '9px 12px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#2C1A0E', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: "'Montserrat', sans-serif" }}>
                    ✚ Registrar aquí
                  </button>
                  <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                    style={{ flex: 1, padding: '9px 12px', background: 'none', border: '1px solid rgba(224,92,92,.5)', borderRadius: 8, color: '#E05C5C', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
                    Buscar email
                  </button>
                  <button onClick={() => setError('')}
                    style={{ flex: 1, padding: '9px 12px', background: 'none', border: '1px solid rgba(251,247,240,.15)', borderRadius: 8, color: 'rgba(251,247,240,.5)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
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
                      style={{ ...styles.input, fontSize: 13, padding: '10px 12px' }} />
                    <input placeholder="Apellido" value={quickReg.lastName}
                      onChange={e => setQuickReg(q => ({ ...q, lastName: e.target.value }))}
                      style={{ ...styles.input, fontSize: 13, padding: '10px 12px' }} />
                  </div>
                  <input required type="email" placeholder="Email *" value={quickReg.email}
                    onChange={e => setQuickReg(q => ({ ...q, email: e.target.value }))}
                    style={{ ...styles.input, fontSize: 13, padding: '10px 12px', marginBottom: 8 }} />
                  {quickReg.error && <div style={{ ...styles.errorBox, marginBottom: 8 }}>{quickReg.error}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={quickReg.loading}
                      style={{ flex: 1, padding: '10px', background: 'var(--gold)', border: 'none', borderRadius: 10, color: '#2C1A0E', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", opacity: quickReg.loading ? .6 : 1 }}>
                      {quickReg.loading ? 'Registrando…' : 'Crear cuenta →'}
                    </button>
                    <button type="button" onClick={() => setQuickReg(q => ({ ...q, show: false }))}
                      style={{ padding: '10px 14px', background: 'none', border: '1px solid rgba(251,247,240,.15)', borderRadius: 10, color: 'rgba(251,247,240,.4)', cursor: 'pointer', fontSize: 11, fontFamily: "'Montserrat', sans-serif" }}>
                      ✕
                    </button>
                  </div>
                </form>
              </div>
            )}

            {error && !isNotFound && (
              <div style={{ ...styles.errorBox, marginBottom: 14 }}>
                {error}
                <br/>
                <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                  style={{ marginTop: 8, background: 'none', border: '1px solid rgba(224,92,92,.4)', borderRadius: 8, color: '#E05C5C', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
                  Buscar por email
                </button>
              </div>
            )}

            {loading && <div style={styles.loadingBox}>Buscando cliente…</div>}

            <Suspense fallback={<div style={styles.loadingBox}>Cargando cámara…</div>}>
              <QRScanner
                key={error ? 'error' : 'scanning'}
                onScan={handleQRScan}
                onClose={() => setScreen('home')}
              />
            </Suspense>
          </div>
        );
      })()}

      {/* ── EMAIL SEARCH ── */}
      {screen === 'searchEmail' && (
        <div>
          <button onClick={() => setScreen('home')} style={styles.back}>← Volver</button>
          <h2 style={styles.title}>Buscar por email</h2>
          <p style={{ ...styles.sub, marginBottom: 20 }}>Escribe el correo electrónico del cliente</p>
          <form onSubmit={e => { e.preventDefault(); lookupByEmail(emailInput); }}>
            <input
              type="email" required autoFocus
              placeholder="correo@ejemplo.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              style={{ ...styles.input, fontSize: 15 }}
            />
            {error && <div style={styles.errorBox}>{error}</div>}
            <button type="submit" disabled={loading} style={styles.goldBtn}>
              {loading ? 'Buscando…' : 'Buscar cliente'}
            </button>
          </form>
        </div>
      )}

      {/* ── MANUAL SCAN ── */}
      {screen === 'scan' && (
        <div>
          <button onClick={() => setScreen('home')} style={styles.back}>← Volver</button>
          <h2 style={styles.title}>Buscar cliente</h2>
          <p style={{ ...styles.sub, marginBottom: 20 }}>Pega el código QR escaneado o ingresa el ID del cliente</p>
          <form onSubmit={e => { e.preventDefault(); lookupByCode(codeInput); }}>
            <input
              type="text" required autoFocus
              placeholder="ID del cliente (del QR)"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              style={{ ...styles.input, fontFamily: 'monospace', fontSize: 13 }}
            />
            {error && <div style={styles.errorBox}>{error}</div>}
            <button type="submit" disabled={loading} style={styles.goldBtn}>
              {loading ? 'Buscando…' : 'Buscar cliente'}
            </button>
          </form>
        </div>
      )}

      {/* ── CUSTOMER PROFILE ── */}
      {screen === 'customer' && customer && (
        <div>
          <button onClick={reset} style={styles.back}>← Nueva búsqueda</button>

          {/* Customer card */}
          <div style={{
            background: 'linear-gradient(135deg, #2C1A0E 0%, #1a0e06 100%)',
            border: `1px solid ${lvl.color}30`,
            borderRadius: 20,
            padding: 24,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(251,247,240,.35)', textTransform: 'uppercase', marginBottom: 6 }}>
                  House of Shake
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, color: 'var(--cream)' }}>
                  {customer.firstName} {customer.lastName}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(251,247,240,.4)', marginTop: 2 }}>{customer.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28 }}>{lvl.emoji}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, color: lvl.color }}>{lvl.label}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Puntos disponibles</div>
                <div style={{ ...styles.statValue, color: 'var(--gold)' }}>{customer.availablePoints}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Canjeable</div>
                <div style={{ ...styles.statValue, color: '#5EC97A' }}>${redeemable} MXN</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <button onClick={() => { setScreen('addPoints'); setError(''); }} style={{ ...styles.actionBtn, background: 'rgba(94,201,122,.12)', border: '1px solid rgba(94,201,122,.3)', color: '#5EC97A' }}>
              <span style={{ fontSize: 26 }}>+</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Acumular puntos</span>
            </button>
            <button
              disabled={customer.availablePoints < 100}
              onClick={() => { setScreen('redeem'); setError(''); }}
              style={{ ...styles.actionBtn, background: 'rgba(74,125,156,.12)', border: '1px solid rgba(74,125,156,.3)', color: '#4a9fd4', opacity: customer.availablePoints < 100 ? .4 : 1, cursor: customer.availablePoints < 100 ? 'not-allowed' : 'pointer' }}>
              <span style={{ fontSize: 26 }}>🎁</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Canjear puntos</span>
            </button>
          </div>

          {/* ── TE ALCANZA PARA ── */}
          <AffordableSection
            affordable={customer.affordableProducts}
            almost={customer.almostAffordableProducts}
            points={customer.availablePoints}
          />

          {/* Recent transactions */}
          {customer.recentTransactions?.length > 0 && (
            <div style={{ ...styles.recentBox, marginTop: 12 }}>
              <div style={styles.recentTitle}>Últimas transacciones</div>
              {customer.recentTransactions.map(t => (
                <div key={t.id} style={styles.recentRow}>
                  <span style={{ color: 'rgba(251,247,240,.6)', fontSize: 12, flex: 1 }}>{t.description}</span>
                  <span style={{ fontWeight: 700, color: t.points > 0 ? '#5EC97A' : '#E05C5C', fontSize: 13 }}>
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
          <button onClick={() => setScreen('customer')} style={styles.back}>← Volver</button>
          <h2 style={styles.title}>Acumular puntos</h2>
          <p style={styles.sub}>
            Cliente: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
          </p>
          <div style={{ ...styles.infoBanner, borderColor: 'rgba(245,200,66,.25)', background: 'rgba(245,200,66,.06)', color: 'var(--gold)', marginBottom: 20, marginTop: 16 }}>
            1 punto por cada $1 MXN gastado
          </div>
          <form onSubmit={handleAddPoints}>
            <label style={styles.label}>Monto de la compra (MXN)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(251,247,240,.4)', fontSize: 20 }}>$</span>
              <input
                type="number" required min="1" step="0.01" autoFocus
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ ...styles.input, paddingLeft: 36, fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}
              />
            </div>
            {amount && (
              <div style={{ textAlign: 'center', color: 'var(--gold)', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                +{Math.floor(parseFloat(amount) || 0)} puntos para {customer.firstName}
              </div>
            )}
            {error && <div style={styles.errorBox}>{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.goldBtn, marginTop: 20 }}>
              {loading ? 'Procesando…' : 'Confirmar compra ✓'}
            </button>
          </form>
        </div>
      )}

      {/* ── REDEEM ── */}
      {screen === 'redeem' && customer && (
        <div>
          <button onClick={() => setScreen('customer')} style={styles.back}>← Volver</button>
          <h2 style={styles.title}>Canjear puntos</h2>
          <p style={styles.sub}>
            Cliente: <strong style={{ color: 'var(--cream)' }}>{customer.firstName} {customer.lastName}</strong>
          </p>

          <div style={styles.statBox2}>
            <div style={styles.statLabel}>Puntos disponibles</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: 'var(--gold)', letterSpacing: 2 }}>{customer.availablePoints}</div>
            <div style={{ fontSize: 11, color: 'rgba(251,247,240,.35)', letterSpacing: 1 }}>100 puntos = $5 MXN de descuento</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '16px 0' }}>
            {[100, 200, 300].filter(v => v <= customer.availablePoints).map(v => (
              <button key={v} onClick={() => setRedeemPts(String(v))}
                style={{
                  padding: '14px 8px', borderRadius: 12,
                  background: redeemPts === String(v) ? 'var(--gold)' : 'rgba(251,247,240,.06)',
                  color: redeemPts === String(v) ? '#2C1A0E' : 'var(--cream)',
                  border: `1px solid ${redeemPts === String(v) ? 'var(--gold)' : 'rgba(251,247,240,.1)'}`,
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700, cursor: 'pointer', textAlign: 'center', fontSize: 12,
                }}>
                <div>{v} pts</div>
                <div style={{ fontSize: 11, opacity: .8 }}>${(v / 100) * 5} MXN</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleRedeem}>
            <input
              type="number" required min="100" step="100"
              value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
              placeholder="Múltiplos de 100"
              style={{ ...styles.input, textAlign: 'center', fontSize: 24, fontFamily: "'Bebas Neue', sans-serif" }}
            />
            {redeemPts && parseInt(redeemPts) >= 100 && (
              <div style={{ textAlign: 'center', color: '#4a9fd4', fontWeight: 700, fontSize: 14, marginTop: 8 }}>
                Descuento: ${(Math.floor(parseInt(redeemPts) / 100) * 5).toFixed(2)} MXN
              </div>
            )}
            {error && <div style={styles.errorBox}>{error}</div>}
            <button type="submit"
              disabled={loading || !redeemPts || parseInt(redeemPts) < 100}
              style={{ ...styles.goldBtn, marginTop: 16 }}>
              {loading ? 'Procesando…' : 'Confirmar canje ✓'}
            </button>
          </form>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {screen === 'success' && result && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{result.type === 'earn' ? '🎉' : '🎁'}</div>

          {result.type === 'earn' ? (
            <>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 2, color: '#5EC97A' }}>
                +{result.pointsAdded} puntos
              </div>
              <p style={{ color: 'rgba(251,247,240,.6)', marginBottom: 12 }}>
                agregados a <strong style={{ color: 'var(--cream)' }}>{customer?.firstName}</strong>
              </p>
              {result.levelChanged && (
                <div style={{ background: 'rgba(255,215,0,.12)', border: '1px solid rgba(255,215,0,.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 12 }}>
                  <span style={{ fontWeight: 800, color: '#FFD700', fontSize: 13 }}>¡Subió de nivel! 🎖 {result.level}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 2, color: '#4a9fd4' }}>
                -${result.discountMxn || (result.discountUsd * 20)?.toFixed(0)} MXN
              </div>
              <p style={{ color: 'rgba(251,247,240,.6)', marginBottom: 12 }}>
                descuento aplicado a <strong style={{ color: 'var(--cream)' }}>{customer?.firstName}</strong>
              </p>
            </>
          )}

          <div style={styles.statBox2}>
            <div style={styles.statLabel}>Saldo actualizado</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: 'var(--gold)', letterSpacing: 2 }}>
              {result.newBalance}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(251,247,240,.3)', letterSpacing: 1 }}>puntos disponibles</div>
          </div>

          {/* Productos asequibles post-transacción */}
          <div style={{ textAlign: 'left', marginTop: 4 }}>
            <AffordableSection
              affordable={result.affordableProducts}
              almost={result.almostAffordableProducts}
              points={result.newBalance}
              title={result.type === 'earn' ? 'Ahora puede canjear:' : 'Todavía puede canjear:'}
            />
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            <button onClick={() => { setScreen('customer'); setResult(null); }} style={{ ...styles.goldBtn, background: 'rgba(251,247,240,.08)', color: 'var(--cream)' }}>
              Ver perfil del cliente
            </button>
            <button onClick={reset} style={styles.goldBtn}>
              Nueva transacción
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── shared styles ── */
const styles = {
  title: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 40,
    letterSpacing: 2,
    color: 'var(--cream)',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(251,247,240,.45)',
    fontWeight: 600,
  },
  back: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(251,247,240,.4)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1, padding: 0, marginBottom: 16,
    fontFamily: "'Montserrat', sans-serif",
  },
  bigBtn: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '20px 24px', borderRadius: 16,
    border: 'none', cursor: 'pointer',
    fontFamily: "'Montserrat', sans-serif",
    transition: 'transform .15s',
    textAlign: 'left',
  },
  bigBtnTitle: { fontSize: 15, fontWeight: 800, marginBottom: 2 },
  bigBtnSub: { fontSize: 11, letterSpacing: .5 },
  input: {
    width: '100%',
    background: 'rgba(251,247,240,.05)',
    color: 'var(--cream)',
    border: '1px solid rgba(251,247,240,.12)',
    borderRadius: 12,
    padding: '14px 16px',
    outline: 'none',
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 15,
    boxSizing: 'border-box',
    marginBottom: 0,
  },
  label: {
    display: 'block',
    fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(251,247,240,.4)', marginBottom: 8,
    fontFamily: "'Montserrat', sans-serif",
  },
  goldBtn: {
    width: '100%', padding: '16px',
    background: 'var(--gold)', color: '#2C1A0E',
    border: 'none', borderRadius: 12,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase',
    cursor: 'pointer', marginTop: 12, display: 'block',
  },
  errorBox: {
    background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.25)',
    color: '#E05C5C', fontSize: 12, padding: '10px 14px',
    borderRadius: 10, marginTop: 10,
  },
  loadingBox: {
    textAlign: 'center', padding: 24,
    color: 'rgba(251,247,240,.4)', fontSize: 13, fontWeight: 600,
  },
  infoBanner: {
    padding: '10px 16px', borderRadius: 10, border: '1px solid',
    fontSize: 12, fontWeight: 700, letterSpacing: 1, textAlign: 'center',
    fontFamily: "'Montserrat', sans-serif",
  },
  statBox: {
    background: 'rgba(251,247,240,.05)',
    borderRadius: 12, padding: '14px',
    textAlign: 'center',
  },
  statBox2: {
    background: 'rgba(251,247,240,.04)', border: '1px solid rgba(251,247,240,.08)',
    borderRadius: 16, padding: '20px', textAlign: 'center', margin: '12px 0',
  },
  statLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: 3,
    textTransform: 'uppercase', color: 'rgba(251,247,240,.35)', marginBottom: 4,
    fontFamily: "'Montserrat', sans-serif",
  },
  statValue: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 36, letterSpacing: 2,
  },
  actionBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '20px 16px', borderRadius: 16,
    fontFamily: "'Montserrat', sans-serif",
    cursor: 'pointer', transition: 'opacity .2s',
  },
  recentBox: {
    background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.07)',
    borderRadius: 16, padding: '16px 20px',
  },
  recentTitle: {
    fontSize: 9, fontWeight: 700, letterSpacing: 3,
    textTransform: 'uppercase', color: 'rgba(251,247,240,.3)',
    marginBottom: 12, fontFamily: "'Montserrat', sans-serif",
  },
  recentRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '6px 0',
    borderBottom: '1px solid rgba(251,247,240,.04)',
  },
};

function AffordableSection({ affordable = [], almost = [], points = 0, title = 'Le alcanza para:' }) {
  if (!affordable?.length && !almost?.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      {affordable.length > 0 && (
        <div style={{ background: 'rgba(94,201,122,.06)', border: '1px solid rgba(94,201,122,.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: '#5EC97A', textTransform: 'uppercase', marginBottom: 10, fontWeight: 800, fontFamily: "'Montserrat', sans-serif" }}>
            ✓ {title}
          </div>
          {affordable.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(94,201,122,.05)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
              <div style={{ flex: 1, marginRight: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cream)', fontFamily: "'Montserrat', sans-serif" }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 11, color: 'rgba(251,247,240,.4)', marginTop: 2 }}>{p.description}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: '#5EC97A', lineHeight: 1 }}>{p.pointsValue} pts</div>
                {p.price != null && <div style={{ fontSize: 10, color: 'rgba(251,247,240,.3)', marginTop: 1 }}>${p.price.toFixed(0)} MXN</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {almost.length > 0 && (
        <div style={{ background: 'rgba(160,120,30,.06)', border: '1px solid rgba(160,120,30,.2)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 800, fontFamily: "'Montserrat', sans-serif" }}>
            ◎ Casi alcanza para:
          </div>
          {almost.map(p => {
            const needed = p.pointsValue - points;
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(160,120,30,.05)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cream)', fontFamily: "'Montserrat', sans-serif" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(251,247,240,.4)', marginTop: 2 }}>Faltan {needed} pts más</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>{p.pointsValue} pts</div>
                  {p.price != null && <div style={{ fontSize: 10, color: 'rgba(251,247,240,.3)', marginTop: 1 }}>${p.price.toFixed(0)} MXN</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
