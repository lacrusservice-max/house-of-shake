import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/mi-cuenta.css';
import { CoffeeIcon, GiftIcon, ShakeIcon, StarIcon, LightningIcon, TrophyIcon, CardIcon, CheckIcon, CakeIcon } from '../components/Icons';
import { fmtPinos, pinosEnteros, pinosDeProducto, rewardStatus } from '../lib/pinos';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BLUE    = '#0F448B';
const BLUE_LT = '#1A5BB5';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(15,68,139,.5)';
const BORDER  = 'rgba(15,68,139,.12)';
const BG_SOFT = 'rgba(15,68,139,.04)';

// Costo de canje: fijo por categoría (100 / 110 / 120 Pinos), no por precio.
const pinosDe = (pointsValue = 0) => Math.round(pointsValue / 10);

const CAT_LABEL = {
  'bebida': 'Bebidas', 'bebidas': 'Bebidas', 'cold-coffees': 'Cold Coffees',
  'cold-brew': 'Cold Brew', 'matcha': 'Matcha', 'fitfresh': 'Fitfresh',
  'chai': 'Chai', 'milkshakes': 'Milkshakes', 'reposteria': 'Repostería',
  'alimentos': 'Alimentos', 'especiales': 'Especiales',
};
const catLabel = (c) => CAT_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : 'Otros');

const TX_TYPE = {
  EARN:          { label: 'Pinos ganados',      color: BLUE },
  REDEEM:        { label: 'Canje',              color: BLUE_LT },
  WELCOME_BONUS: { label: 'Bono bienvenida',    color: BLUE },
  BIRTHDAY:      { label: 'Regalo cumpleaños',  color: BLUE },
  REVERSAL:      { label: 'Reversión',          color: '#E05C5C' },
  ADJUSTMENT:    { label: 'Ajuste',             color: '#5A7BAA' },
};

export default function MiCuenta() {
  const [customer, setCustomer] = useState(() => JSON.parse(localStorage.getItem('hos_customer') || 'null'));
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('tarjeta');
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');

  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '', birthday: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [claimingBd, setClaimingBd] = useState(false);
  const [bdMsg, setBdMsg] = useState('');

  const [products, setProducts] = useState([]);
  const [rewardCat, setRewardCat] = useState('all');

  const TX_PAGE_SIZE = 10;
  const navigate = useNavigate();

  const token = localStorage.getItem('hos_customer_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/me`, { headers })
      .then(r => { if (r.status === 401) { handleLogout(); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        setCustomer(data.customer);
        localStorage.setItem('hos_customer', JSON.stringify(data.customer));
        setProfile({
          firstName: data.customer.firstName || '',
          lastName: data.customer.lastName || '',
          phone: data.customer.phone || '',
          birthday: data.customer.birthday ? data.customer.birthday.split('T')[0] : '',
        });
      })
      .catch(() => {});

    fetch(`${API}/me/transactions?limit=${TX_PAGE_SIZE}&offset=0`, { headers })
      .then(r => r.json())
      .then(data => {
        const txs = data.transactions || [];
        setTransactions(txs);
        setTxHasMore(txs.length === TX_PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));

    fetch(`${API}/products`)
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function loadMoreTransactions() {
    if (txLoadingMore) return;
    setTxLoadingMore(true);
    const nextPage = txPage + 1;
    try {
      const res = await fetch(`${API}/me/transactions?limit=${TX_PAGE_SIZE}&offset=${txPage * TX_PAGE_SIZE}`, { headers });
      const data = await res.json();
      const more = data.transactions || [];
      setTransactions(prev => [...prev, ...more]);
      setTxHasMore(more.length === TX_PAGE_SIZE);
      setTxPage(nextPage);
    } catch {}
    setTxLoadingMore(false);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const res = await fetch(`${API}/me/profile`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      const updated = { ...customer, ...data.customer };
      setCustomer(updated);
      localStorage.setItem('hos_customer', JSON.stringify(updated));
      setProfileMsg('¡Perfil actualizado! ✓');
    } catch (err) {
      setProfileMsg(err.message);
    }
    setProfileSaving(false);
  }

  async function handleClaimBirthday() {
    setClaimingBd(true);
    setBdMsg('');
    try {
      const res = await fetch(`${API}/me/birthday-reward`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reclamar');
      setCustomer(prev => ({ ...prev, availablePoints: data.newBalance, birthdayRewardAvailable: false }));
      setBdMsg(data.message || '¡+20 Pinos de cumpleaños!');
    } catch (err) {
      setBdMsg(err.message);
    }
    setClaimingBd(false);
  }

  async function handleAddToWallet() {
    if (walletLoading) return;
    setWalletLoading(true);
    setWalletError('');
    try {
      const res = await fetch(`${API}/customers/${customer.id}/wallet-pass`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWalletError(data.error || 'Apple Wallet no está activado aún en House of Shake');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'houseofshake.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setWalletError('Error de conexión. Intenta de nuevo.');
    }
    setWalletLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem('hos_customer_token');
    localStorage.removeItem('hos_customer');
    navigate('/login');
  }

  if (!customer) return null;

  const availPines      = pinosEnteros(customer.availablePoints);
  const availPinesLabel = fmtPinos(customer.availablePoints);
  const totalPines      = pinosEnteros(customer.lifetimePoints);
  const totalPinesLabel = fmtPinos(customer.lifetimePoints);

  // El saldo ES el progreso. Antes se calculaba `saldo % 120`, así que alguien
  // con 243 Pinos veía "3 / 120" — como si empezara de cero — y al cruzar la
  // meta el contador se reiniciaba solo, sin avisarle que ya tenía premio.
  const reward = customer.reward || rewardStatus(customer.availablePoints, products);
  const cardComplete = reward.hasReward;
  const pinesLeft    = reward.pinosToNextGoal;
  const progressPct  = reward.progressPct;
  const goalCost     = reward.nextGoalCost;
  // Progreso hacia la meta: si ya tiene premio, lo que lleva del siguiente.
  const pinesInCycle = cardComplete
    ? Math.max(0, Math.round((goalCost - pinesLeft) * 10) / 10)
    : availPines;
  const PINES_PER_CYCLE = goalCost;
  const PINES_PER_SLOT  = Math.max(1, Math.round(goalCost / 10));
  const slotsEarned     = Math.min(10, Math.floor(pinesInCycle / PINES_PER_SLOT));

  return (
    <div className="mc-root">

      {/* NAV — logo centrado, usuario izquierda, salir derecha */}
      <nav className="mc-nav">
        <div className="mc-nav-left">
          <span className="mc-nav-user">Hola, {customer.firstName}</span>
        </div>
        <Link to="/" className="mc-nav-brand">
          <img src="/logo-encabezado.png" alt="House of Shake" className="mc-nav-logo-img" />
        </Link>
        <div className="mc-nav-right">
          <button onClick={handleLogout} className="mc-nav-logout">Salir</button>
        </div>
      </nav>

      <div className="mc-wrap">

        {/* BIRTHDAY BANNER */}
        {customer.isBirthday && (
          <div style={{
            background: BG_SOFT, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: '14px 18px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CakeIcon size={28} color={BLUE} animated />
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: BLUE, margin: 0 }}>¡Feliz cumpleaños, {customer.firstName}!</p>
              <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>
                {customer.birthdayRewardAvailable
                  ? 'Ve a tu Perfil para reclamar tu regalo de +20 Pinos'
                  : '¡Que lo disfrutes mucho!'}
              </p>
            </div>
          </div>
        )}

        {/* DOUBLE PINES BANNER */}
        {customer.doublePointsActive && (
          <div style={{
            background: BG_SOFT, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: '14px 18px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <LightningIcon size={28} color={BLUE} animated />
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: BLUE, margin: 0 }}>¡Pinos dobles activos hoy!</p>
              <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>
                Ganas el doble de Pinos en cada compra ahora mismo
              </p>
            </div>
          </div>
        )}

        {/* WELCOME */}
        <div className="mc-eyebrow">Mi cuenta</div>
        <h1 className="mc-heading">Hola, <span>{customer.firstName}</span></h1>
        <p className="mc-sub">House of Shake Rewards{totalPines > 0 ? ` · ${totalPinesLabel} Pinos acumulados` : ''}</p>

        {/* Número de socio — el cliente puede dictarlo en caja si no trae el QR */}
        {customer.memberNumber && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 100,
            padding: '8px 16px', marginTop: 4,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED }}>
              Socio
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5,
              color: BLUE, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              #{customer.memberNumber}
            </span>
          </div>
        )}

        {/* STATS */}
        <div className="mc-stats">
          <div className="mc-stat">
            <p className="mc-stat-label">Este ciclo</p>
            <p className="mc-stat-value gold">{pinesInCycle}</p>
            <p className="mc-stat-unit">pinos</p>
          </div>
          <div className="mc-stat">
            <p className="mc-stat-label">Totales</p>
            <p className="mc-stat-value">{totalPinesLabel}</p>
            <p className="mc-stat-unit">acumulados</p>
          </div>
          <div className="mc-stat">
            <p className="mc-stat-label">Para bebida</p>
            <p className="mc-stat-value green">{cardComplete ? '¡YA!' : pinesLeft}</p>
            <p className="mc-stat-unit">{cardComplete ? 'canjeable' : 'pinos más'}</p>
          </div>
        </div>

        {/* NEXT REWARD HINT */}
        {!cardComplete && (
          <div style={{
            background: BG_SOFT, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: '10px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CoffeeIcon size={20} color={BLUE} animated />
              <div>
                <p style={{ fontSize: 10, color: MUTED, margin: 0, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Próxima recompensa</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: BLUE, margin: 0 }}>Producto gratis desde {reward.cheapestCost} Pinos</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", color: BLUE, margin: 0, lineHeight: 1 }}>{pinesLeft}</p>
              <p style={{ fontSize: 9, color: MUTED, margin: 0 }}>Pinos más</p>
            </div>
          </div>
        )}
        {cardComplete && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(15,68,139,.08), rgba(26,91,181,.05))',
            border: `1.5px solid ${BLUE}`,
            borderRadius: 14, padding: '16px 18px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <GiftIcon size={26} color={BLUE} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 900, fontSize: 15, color: BLUE, margin: 0, lineHeight: 1.25 }}>
                  🎉 ¡Llegaste a la meta!
                </p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: '3px 0 0', lineHeight: 1.45 }}>
                  Tienes <strong style={{ color: BLUE }}>{availPinesLabel} Pinos</strong> — te alcanza para{' '}
                  <strong style={{ color: BLUE }}>
                    {reward.redeemableCount} producto{reward.redeemableCount === 1 ? '' : 's'} gratis
                  </strong>.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setActiveTab('premios'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                width: '100%', padding: '12px', borderRadius: 11, border: 'none',
                background: BLUE, color: WHITE, cursor: 'pointer',
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 12.5,
                letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              Ver para qué me alcanza →
            </button>
            <p style={{ fontSize: 11, color: MUTED, margin: '9px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
              Muestra tu QR al staff para canjearlo. Tus Pinos se descuentan solo al canjear.
            </p>
          </div>
        )}

        {/* PINE PROGRESS */}
        <div className="mc-level">
          <div className="mc-level-top">
            <span className="mc-level-name">{cardComplete ? 'Progreso al siguiente premio' : 'Progreso a tu primer premio'}</span>
            <span className="mc-level-next">{cardComplete ? `${pinesLeft} para el siguiente →` : `${pinesLeft} Pinos más →`}</span>
          </div>
          <div className="mc-bar-bg">
            <div className="mc-bar-fill" style={{ width: `${progressPct}%`, background: BLUE }} />
          </div>
          <p className="mc-bar-pts">{fmtPinos(pinesInCycle * 10)} / {PINES_PER_CYCLE} Pinos · saldo total {availPinesLabel}</p>
        </div>

        <hr className="mc-divider" />

        {/* TABS */}
        <div className="mc-tabs">
          {[
            { key: 'tarjeta',   Icon: CardIcon,    label: 'Tarjeta' },
            { key: 'premios',   Icon: GiftIcon,    label: 'Premios' },
            { key: 'historial', Icon: CheckIcon,   label: 'Historial' },
            { key: 'lealtad',   Icon: TrophyIcon,  label: 'Lealtad' },
            { key: 'perfil',    Icon: StarIcon,    label: 'Perfil' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`mc-tab${activeTab === t.key ? ' active' : ''}`}
            >
              <t.Icon size={13} color={activeTab === t.key ? WHITE : 'rgba(15,68,139,.4)'} /> {t.label}
            </button>
          ))}
        </div>

        {/* TAB — TARJETA */}
        {activeTab === 'tarjeta' && (
          <div className="mc-card-wrap">

            <div className="mc-qr-hero" onClick={() => setQrFullscreen(true)}>
              <div className="mc-qr-hero-inner" style={{ borderColor: 'rgba(255,255,255,.2)' }}>
                <div className="mc-qr-hero-header">
                  <div>
                    <p className="mc-qr-hero-brand">House of Shake</p>
                    <p className="mc-qr-hero-name">{customer.firstName} {customer.lastName}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 1, color: WHITE, lineHeight: 1, margin: 0 }}>{totalPinesLabel}</p>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', margin: 0, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Pinos</p>
                  </div>
                </div>
                <div className="mc-qr-center">
                  <div className="mc-qr-box">
                    <QRCodeSVG value={customer.id} size={180} bgColor="#ffffff" fgColor="#071E3D" level="H" includeMargin={true} />
                  </div>
                  <p className="mc-qr-tap-hint">Toca para ampliar</p>
                </div>
                <div className="mc-qr-hero-footer" style={{ borderTopColor: 'rgba(255,255,255,.15)' }}>
                  <div>
                    <p className="mc-qr-pts-label">Pinos en ciclo</p>
                    <p className="mc-qr-pts-value" style={{ color: WHITE }}>{pinesInCycle} / 120</p>
                  </div>
                  {cardComplete ? (
                    <div style={{ textAlign: 'right' }}>
                      <p className="mc-qr-pts-label">Estado</p>
                      <p className="mc-qr-pts-value" style={{ color: WHITE }}>¡Bebida lista!</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'right' }}>
                      <p className="mc-qr-pts-label">Para bebida gratis</p>
                      <p className="mc-qr-pts-value" style={{ color: WHITE }}>{pinesLeft} Pinos más</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="mc-qr-instruction">Muestra este QR al staff al momento de pagar</p>
            </div>

            <div className="mc-info-grid">
              <div className="mc-info-card">
                <div className="mc-info-icon"><LightningIcon size={24} color={BLUE} animated /></div>
                <p className="mc-info-title">1 Pino = $10 MXN</p>
                <p className="mc-info-desc">Un Pino por cada $10 gastados</p>
              </div>
              <div className="mc-info-card">
                <div className="mc-info-icon"><GiftIcon size={24} color={BLUE} animated /></div>
                <p className="mc-info-title">120 Pinos = bebida</p>
                <p className="mc-info-desc">Bebida gratis hasta $90 MXN</p>
              </div>
            </div>

            <button
              onClick={handleAddToWallet}
              disabled={walletLoading}
              className="mc-wallet-btn"
              style={{ cursor: walletLoading ? 'not-allowed' : 'pointer', opacity: walletLoading ? .7 : 1, border: 'none', textAlign: 'center', width: '100%' }}
            >
              {walletLoading ? 'Descargando pass...' : 'Agregar a Apple Wallet'}
            </button>
            {walletError && (
              <p style={{ fontSize: 12, color: '#E05C5C', textAlign: 'center', marginTop: 8, padding: '8px 12px', background: 'rgba(224,92,92,.06)', borderRadius: 10, border: '1px solid rgba(224,92,92,.2)' }}>
                {walletError}
              </p>
            )}
          </div>
        )}

        {/* QR FULLSCREEN */}
        {qrFullscreen && (
          <div
            onClick={() => setQrFullscreen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,.92)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 20, padding: 24,
            }}
          >
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase' }}>
              House of Shake
            </p>
            <div style={{ background: '#fff', padding: 20, borderRadius: 20, boxShadow: '0 0 80px rgba(15,68,139,.4)' }}>
              <QRCodeSVG value={customer.id} size={Math.min(280, window.innerWidth - 100)} bgColor="#ffffff" fgColor="#071E3D" level="H" includeMargin={false} />
            </div>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2, color: WHITE }}>
              {totalPinesLabel} Pinos
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: 1, fontWeight: 600, textAlign: 'center' }}>
              {customer.firstName} {customer.lastName}
            </p>
            {/* Respaldo si la cámara no logra leer el QR: el staff teclea este número */}
            {customer.memberNumber && (
              <p style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
                color: 'rgba(255,255,255,.55)', margin: 0, fontVariantNumeric: 'tabular-nums',
              }}>
                Socio #{customer.memberNumber}
              </p>
            )}
            <button
              onClick={() => setQrFullscreen(false)}
              style={{
                marginTop: 8, padding: '12px 32px',
                background: 'rgba(255,255,255,.1)',
                border: '1px solid rgba(255,255,255,.2)',
                borderRadius: 12, color: 'rgba(255,255,255,.6)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Montserrat', sans-serif", letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              ✕ Cerrar
            </button>
          </div>
        )}

        {/* TAB — PREMIOS */}
        {activeTab === 'premios' && (() => {
          const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
          const shown = (rewardCat === 'all' ? products : products.filter(p => p.category === rewardCat))
            .slice().sort((a, b) => a.pointsValue - b.pointsValue);
          const canGet = products.filter(p => pinosDe(p.pointsValue) <= availPines);
          const nextUp = products
            .filter(p => pinosDe(p.pointsValue) > availPines)
            .sort((a, b) => a.pointsValue - b.pointsValue)[0];
          // Cuántos premios puede LLEVARSE. `canGet.length` es cuántos
          // productos distintos puede elegir: con 243 Pinos podía elegir entre
          // 40, pero llevarse solo 2 — y la tarjeta decía "40 productos gratis".
          const puedeLlevar = reward.redeemableCount;

          return (
            <div>
              {/* Saldo canjeable */}
              <div style={{
                background: BG_SOFT, border: `1px solid ${BORDER}`,
                borderRadius: 18, padding: '22px', marginBottom: 16, textAlign: 'center',
              }}>
                <p style={{ fontSize: 10, letterSpacing: 2, color: MUTED, textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>
                  Tus Pinos para canjear
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: BLUE, margin: '4px 0 0', lineHeight: 1 }}>
                  {availPinesLabel}
                </p>
                <p style={{ fontSize: 13, color: MUTED, margin: '6px 0 0' }}>
                  Repostería 100 · Bebidas 110 · Milkshakes 120 Pinos
                </p>
                <p style={{ fontSize: 13, fontWeight: 800, margin: '14px 0 0', color: BLUE }}>
                  {puedeLlevar > 0
                    ? `🎉 Te alcanza para ${puedeLlevar} producto${puedeLlevar === 1 ? '' : 's'} gratis`
                    : nextUp
                      ? `Te faltan ${fmtPinos((pinosDe(nextUp.pointsValue) - availPines) * 10)} Pinos para tu primer premio`
                      : 'Sigue acumulando Pinos'}
                </p>
                {puedeLlevar > 0 && (
                  <p style={{ fontSize: 11.5, color: MUTED, margin: '4px 0 0' }}>
                    Puedes elegir entre {canGet.length} producto{canGet.length === 1 ? '' : 's'} del menú
                  </p>
                )}
              </div>

              {canGet.length > 0 && (
                <div style={{
                  background: BG_SOFT, border: `1px solid ${BORDER}`,
                  borderRadius: 12, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <CheckIcon size={20} color={BLUE} />
                  <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                    Muestra tu <strong style={{ color: BLUE }}>QR al staff</strong> y pide el producto que quieras canjear.
                  </p>
                </div>
              )}

              {/* Filtro categorías */}
              {cats.length > 1 && (
                <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
                  {['all', ...cats].map(c => (
                    <button key={c} onClick={() => setRewardCat(c)} style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                      fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                      background: rewardCat === c ? BLUE : 'rgba(15,68,139,.05)',
                      color: rewardCat === c ? WHITE : MUTED,
                      border: `1px solid ${rewardCat === c ? BLUE : BORDER}`,
                    }}>
                      {c === 'all' ? 'Todo' : catLabel(c)}
                    </button>
                  ))}
                </div>
              )}

              {products.length === 0 && (
                <div className="mc-empty">
                  <div className="mc-empty-icon"><GiftIcon size={48} color={BLUE} /></div>
                  <p className="mc-empty-title">Cargando premios…</p>
                </div>
              )}

              {/* Catálogo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shown.map(p => {
                  const cost = pinosDe(p.pointsValue);
                  const unlocked = cost <= availPines;
                  const faltan = cost - availPines;
                  const pct = Math.min(100, Math.round((availPines / cost) * 100));
                  return (
                    <div key={p.id} style={{
                      padding: '14px 16px', borderRadius: 14,
                      background: unlocked ? 'rgba(15,68,139,.06)' : BG_SOFT,
                      border: `1px solid ${unlocked ? BLUE : BORDER}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flexShrink: 0 }}>
                          {unlocked
                            ? <GiftIcon size={24} color={BLUE} animated />
                            : <CoffeeIcon size={24} color="rgba(15,68,139,.3)" animated={false} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: 14, color: BLUE, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </p>
                          <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0' }}>
                            ${p.price} MXN · {catLabel(p.category)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1, margin: 0, color: BLUE }}>
                            {cost}
                          </p>
                          <p style={{ fontSize: 9, color: unlocked ? BLUE : MUTED, margin: 0, letterSpacing: .5, fontWeight: 700 }}>
                            {unlocked ? 'PINOS ✓' : 'PINOS'}
                          </p>
                        </div>
                      </div>
                      {!unlocked && (
                        <div style={{ marginTop: 10 }}>
                          <div className="mc-bar-bg" style={{ height: 5 }}>
                            <div className="mc-bar-fill" style={{ width: `${pct}%`, background: BLUE }} />
                          </div>
                          <p style={{ fontSize: 10, color: MUTED, margin: '5px 0 0' }}>
                            Te faltan <strong style={{ color: BLUE }}>{faltan} Pinos</strong> · gasta ${faltan * 10} MXN más
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* TAB — HISTORIAL */}
        {activeTab === 'historial' && (
          <div>
            {txLoading ? (
              <div className="mc-empty">
                <div className="mc-empty-icon"><LightningIcon size={48} color={BLUE} /></div>
                <p className="mc-empty-title">Cargando...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="mc-empty">
                <div className="mc-empty-icon"><CoffeeIcon size={48} color={BLUE} /></div>
                <p className="mc-empty-title">Sin transacciones aún</p>
                <p className="mc-empty-sub">¡Visita la sucursal y empieza a acumular Pinos!</p>
              </div>
            ) : (
              <div>
                <div className="mc-tx-list">
                  {transactions.map(t => {
                    const cfg = TX_TYPE[t.type] || { label: t.type, color: '#5A7BAA' };
                    const isPos = t.points > 0;
                    const pinesValue = Math.round(Math.abs(t.points) / 10 * 10) / 10;
                    return (
                      <div key={t.id} className="mc-tx-row">
                        <div style={{ flex: 1, marginRight: 16, minWidth: 0 }}>
                          <p className="mc-tx-desc">{t.description}</p>
                          <p className="mc-tx-type" style={{ color: cfg.color }}>{cfg.label}</p>
                          <p className="mc-tx-date">
                            {new Date(t.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p className={`mc-tx-pts ${isPos ? 'pos' : 'neg'}`}>
                            {isPos ? '+' : ''}{pinesValue % 1 === 0 ? pinesValue.toFixed(0) : pinesValue.toFixed(1)}
                          </p>
                          <p className="mc-tx-unit">pinos</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {txHasMore && (
                  <button
                    onClick={loadMoreTransactions}
                    disabled={txLoadingMore}
                    style={{
                      width: '100%', marginTop: 16, padding: '12px',
                      background: BG_SOFT, border: `1px solid ${BORDER}`,
                      borderRadius: 12, color: MUTED,
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
                    }}
                  >
                    {txLoadingMore ? 'Cargando...' : '↓ Ver más transacciones'}
                  </button>
                )}
                {!txHasMore && transactions.length >= TX_PAGE_SIZE && (
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(15,68,139,.3)', marginTop: 16, letterSpacing: 1 }}>
                    — Todo el historial cargado —
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB — LEALTAD */}
        {activeTab === 'lealtad' && (
          <div className="mc-loyalty">

            <p className="mc-loyalty-section-title">Tu recompensa</p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: BG_SOFT, border: `1px solid ${BORDER}`,
              borderRadius: 16, padding: '18px 16px', marginBottom: 20,
            }}>
              <CoffeeIcon size={40} color={BLUE} animated style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 16, color: BLUE, margin: 0 }}>
                  Bebida gratis hasta $90 MXN
                </p>
                <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0', lineHeight: 1.5 }}>
                  Cualquier bebida de hasta $90. Si cuesta más, solo pagas la diferencia.
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: BLUE, margin: 0, lineHeight: 1 }}>120</p>
                <p style={{ fontSize: 9, color: MUTED, margin: 0, letterSpacing: 1 }}>PINOS</p>
              </div>
            </div>

            {/* Progreso */}
            <div style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: BLUE }}>{pinesInCycle} / 120 Pinos</span>
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>
                  {cardComplete ? '¡Bebida lista!' : `${pinesLeft} para tu bebida`}
                </span>
              </div>
              <div className="mc-bar-bg">
                <div className="mc-bar-fill" style={{ width: `${progressPct}%`, background: BLUE }} />
              </div>
              <p style={{ fontSize: 10, color: MUTED, marginTop: 8, fontFamily: "'Montserrat', sans-serif", letterSpacing: .5 }}>
                {totalPinesLabel} Pinos totales acumulados desde que te uniste
              </p>
            </div>

            {/* Bonos especiales */}
            <p className="mc-loyalty-section-title">Bonos especiales</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { Icon: CakeIcon,      title: '+20 Pinos de cumpleaños',    desc: 'Recibe 20 Pinos gratis el día de tu cumpleaños. Regístralo en Perfil.' },
                { Icon: StarIcon,      title: '+10 Pinos al registrarte',   desc: 'Bono de bienvenida al unirte a House of Shake Rewards.' },
                { Icon: LightningIcon, title: 'Pinos dobles en temporada',  desc: 'Gana el doble de Pinos durante lanzamientos de bebidas especiales.' },
              ].map(b => (
                <div key={b.title} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  background: BG_SOFT, border: `1px solid ${BORDER}`,
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <b.Icon size={26} color={BLUE} animated style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: BLUE, margin: 0 }}>{b.title}</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0', lineHeight: 1.5 }}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Cómo funciona */}
            <p className="mc-loyalty-section-title">¿Cómo funciona?</p>
            <div className="mc-loyalty-how">
              {[
                { Icon: CoffeeIcon,    title: 'Muestra tu QR antes de pagar',  desc: 'Presenta tu tarjeta al staff al llegar al mostrador' },
                { Icon: LightningIcon, title: '1 Pino por cada $10 MXN',       desc: 'Gana Pinos en cada compra. Pinos dobles en eventos especiales.' },
                { Icon: ShakeIcon,     title: '120 Pinos = bebida gratis',      desc: 'Bebida de hasta $90 MXN gratis. Si cuesta más, solo pagas la diferencia.' },
                { Icon: CakeIcon,      title: 'Bonos especiales',               desc: '+20 Pinos en tu cumpleaños. +10 Pinos de bienvenida al registrarte.' },
              ].map(s => (
                <div key={s.title} className="mc-loyalty-step">
                  <div className="mc-loyalty-step-icon"><s.Icon size={24} color={BLUE} animated /></div>
                  <div>
                    <p className="mc-loyalty-step-title">{s.title}</p>
                    <p className="mc-loyalty-step-desc">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB — PERFIL */}
        {activeTab === 'perfil' && (
          <div>

            {/* Birthday reward card */}
            {customer.birthdayRewardAvailable && (
              <div style={{
                background: BG_SOFT, border: `1px solid ${BORDER}`,
                borderRadius: 18, padding: '22px', marginBottom: 20, textAlign: 'center',
              }}>
                <div style={{ marginBottom: 8 }}><CakeIcon size={48} color={BLUE} animated /></div>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: BLUE, margin: '0 0 4px' }}>
                  ¡Feliz cumpleaños!
                </p>
                <p style={{ fontSize: 12, color: MUTED, margin: '0 0 14px' }}>
                  Tienes un regalo especial esperándote
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: BLUE, margin: '0 0 16px', letterSpacing: 2 }}>
                  +20 PINOS
                </p>
                <button
                  onClick={handleClaimBirthday}
                  disabled={claimingBd}
                  style={{
                    padding: '14px 32px', background: BLUE, border: 'none',
                    borderRadius: 12, color: WHITE, fontWeight: 900, fontSize: 14,
                    cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
                    letterSpacing: 1, opacity: claimingBd ? .7 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <GiftIcon size={16} color={WHITE} /> {claimingBd ? 'Reclamando...' : '¡Reclamar mis Pinos!'}
                </button>
                {bdMsg && (
                  <p style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: bdMsg.includes('ya') || bdMsg.includes('no') ? '#E05C5C' : BLUE }}>
                    {bdMsg}
                  </p>
                )}
              </div>
            )}

            {!customer.birthdayRewardAvailable && bdMsg && (
              <div style={{
                background: BG_SOFT, border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: BLUE, margin: 0 }}>{bdMsg}</p>
              </div>
            )}

            {/* Profile form */}
            <div style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '20px' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, margin: '0 0 18px', color: BLUE }}>
                Mis datos
              </p>
              <form onSubmit={handleSaveProfile}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={pLbl}>Nombre</label>
                    <input
                      value={profile.firstName}
                      onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                      style={pInp}
                      onFocus={e => e.target.style.borderColor = BLUE}
                      onBlur={e => e.target.style.borderColor = BORDER}
                    />
                  </div>
                  <div>
                    <label style={pLbl}>Apellido</label>
                    <input
                      value={profile.lastName}
                      onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                      style={pInp}
                      onFocus={e => e.target.style.borderColor = BLUE}
                      onBlur={e => e.target.style.borderColor = BORDER}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={pLbl}>Email (no editable)</label>
                  <input value={customer.email} disabled style={{ ...pInp, opacity: .45, cursor: 'not-allowed' }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={pLbl}>Teléfono (opcional)</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+52 55 0000 0000"
                    style={pInp}
                    onFocus={e => e.target.style.borderColor = BLUE}
                    onBlur={e => e.target.style.borderColor = BORDER}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ ...pLbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CakeIcon size={12} color={MUTED} /> Fecha de cumpleaños
                  </label>
                  <input
                    type="date"
                    value={profile.birthday}
                    onChange={e => setProfile(p => ({ ...p, birthday: e.target.value }))}
                    style={pInp}
                    onFocus={e => e.target.style.borderColor = BLUE}
                    onBlur={e => e.target.style.borderColor = BORDER}
                  />
                  <p style={{ fontSize: 10, color: MUTED, marginTop: 4, letterSpacing: .5, fontFamily: "'Montserrat', sans-serif" }}>
                    Recibirás +20 Pinos de regalo el día de tu cumpleaños
                  </p>
                </div>

                {profileMsg && (
                  <p style={{
                    fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 12,
                    color: profileMsg.includes('✓') ? BLUE : '#E05C5C',
                  }}>
                    {profileMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    width: '100%', padding: '14px', background: BLUE,
                    color: WHITE, border: 'none', borderRadius: 12,
                    fontWeight: 900, fontSize: 14, cursor: 'pointer',
                    fontFamily: "'Montserrat', sans-serif", letterSpacing: 1,
                    opacity: profileSaving ? .7 : 1,
                  }}
                >
                  {profileSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>

            {/* Pine stats */}
            {totalPines > 0 && (
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: BLUE, margin: 0, lineHeight: 1 }}>{totalPinesLabel}</p>
                  <p style={{ fontSize: 10, color: MUTED, margin: '4px 0 0', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Pinos totales</p>
                </div>
                <div style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: BLUE, margin: 0, lineHeight: 1 }}>
                    {cardComplete ? '¡Listo!' : pinesLeft}
                  </p>
                  <p style={{ fontSize: 10, color: MUTED, margin: '4px 0 0', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                    {cardComplete ? '¡Bebida lista!' : 'Para bebida gratis'}
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

const pLbl = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 2,
  textTransform: 'uppercase', color: 'rgba(15,68,139,.5)', marginBottom: 6,
  fontFamily: "'Montserrat', sans-serif",
};

const pInp = {
  width: '100%', background: '#FFFFFF', color: '#0F448B',
  border: '1px solid rgba(15,68,139,.15)', borderRadius: 12,
  padding: '12px 14px', outline: 'none',
  fontFamily: "'Montserrat', sans-serif", fontSize: 14,
  transition: 'border-color .2s', boxSizing: 'border-box',
  WebkitAppearance: 'none',
};
