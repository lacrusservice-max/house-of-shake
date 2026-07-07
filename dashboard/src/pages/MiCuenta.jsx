import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/mi-cuenta.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LEVEL_CONFIG = {
  BRONZE: { color: '#cd7f32', cls: '',       emoji: '🥉', label: 'Bronze', next: 'Silver', nextAt: 101 },
  SILVER: { color: '#c0c0c0', cls: 'silver', emoji: '🥈', label: 'Silver', next: 'Gold',   nextAt: 301 },
  GOLD:   { color: '#ffd700', cls: 'gold',   emoji: '🥇', label: 'Gold',   next: null,     nextAt: null },
};

const TX_TYPE = {
  EARN:          { label: 'Puntos ganados',    color: '#5EC97A' },
  REDEEM:        { label: 'Canje',             color: '#4a9fd4' },
  WELCOME_BONUS: { label: 'Bono bienvenida',   color: '#F5C842' },
  BIRTHDAY:      { label: 'Regalo cumpleaños', color: '#FF80B0' },
  REVERSAL:      { label: 'Reversión',         color: '#E05C5C' },
  ADJUSTMENT:    { label: 'Ajuste',            color: '#b07bff' },
};

const REWARDS = [
  { pts: 50,  icon: '⬆️', title: 'Upgrade gratis',       desc: 'Sube tu bebida al siguiente tamaño' },
  { pts: 100, icon: '💵', title: '$5 MXN de descuento',   desc: 'Descuento directo en tu próxima compra' },
  { pts: 150, icon: '🥤', title: 'Bebida fría mediana',   desc: 'Cualquier bebida fría tamaño mediano' },
  { pts: 200, icon: '☕', title: 'Bebida especialidad',    desc: 'Bebida de especialidad a tu elección' },
  { pts: 300, icon: '🎁', title: 'Pack Combo',            desc: 'Bebida + snack de la casa' },
];

const LEVELS_INFO = [
  {
    key: 'BRONZE', emoji: '🥉', label: 'Bronze', color: '#cd7f32',
    range: '0 – 100 pts', pts: 0,
    perks: ['1 pto por cada $1 MXN', 'Bono de bienvenida', 'Acceso al programa de lealtad'],
  },
  {
    key: 'SILVER', emoji: '🥈', label: 'Silver', color: '#c0c0c0',
    range: '101 – 300 pts', pts: 101,
    perks: ['1 pto por cada $1 MXN', '+10% bonus de puntos', 'Acceso prioritario', 'Canjes exclusivos'],
  },
  {
    key: 'GOLD', emoji: '🥇', label: 'Gold', color: '#ffd700',
    range: '301+ pts', pts: 301,
    perks: ['1 pto por cada $1 MXN', '+20% bonus de puntos', 'Beneficios exclusivos', 'Sorpresas especiales', 'Atención VIP'],
  },
];

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

  // Profile editing
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '', birthday: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Birthday reward
  const [claimingBd, setClaimingBd] = useState(false);
  const [bdMsg, setBdMsg] = useState('');

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
      setBdMsg(data.message || '¡+200 puntos de cumpleaños! 🎂');
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

  const level = LEVEL_CONFIG[customer.level] || LEVEL_CONFIG.BRONZE;
  const progressPct = level.nextAt
    ? Math.min(100, Math.round((customer.lifetimePoints / level.nextAt) * 100))
    : 100;
  const ptsToNext = level.nextAt ? Math.max(0, level.nextAt - customer.lifetimePoints) : 0;
  const redeemable = Math.floor(customer.availablePoints / 100) * 5;
  const nextReward = REWARDS.find(r => r.pts > customer.availablePoints);
  const ptsToNextReward = nextReward ? nextReward.pts - customer.availablePoints : 0;

  return (
    <div className="mc-root">

      {/* NAV */}
      <nav className="mc-nav">
        <Link to="/" className="mc-nav-brand">
          <div className="mc-nav-logo">☕</div>
          <span className="mc-nav-title">HOUSE OF SHAKE</span>
        </Link>
        <div className="mc-nav-right">
          <span className="mc-nav-user">Hola, {customer.firstName}</span>
          <button onClick={handleLogout} className="mc-nav-logout">Salir</button>
        </div>
      </nav>

      <div className="mc-wrap">

        {/* BIRTHDAY BANNER */}
        {customer.isBirthday && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,128,176,.15), rgba(245,200,66,.08))',
            border: '1px solid rgba(255,128,176,.35)',
            borderRadius: 14, padding: '14px 18px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>🎂</span>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: '#FF80B0', margin: 0 }}>¡Feliz cumpleaños, {customer.firstName}!</p>
              <p style={{ fontSize: 12, color: 'rgba(251,247,240,.55)', margin: '2px 0 0' }}>
                {customer.birthdayRewardAvailable
                  ? 'Ve a tu Perfil para reclamar tu regalo de +200 puntos 🎁'
                  : '¡Que lo disfrutes mucho! 🎉'}
              </p>
            </div>
          </div>
        )}

        {/* DOUBLE POINTS BANNER */}
        {customer.doublePointsActive && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,200,66,.12), rgba(245,200,66,.04))',
            border: '1px solid rgba(245,200,66,.3)',
            borderRadius: 14, padding: '14px 18px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', margin: 0 }}>¡Puntos dobles activos hoy!</p>
              <p style={{ fontSize: 12, color: 'rgba(251,247,240,.55)', margin: '2px 0 0' }}>
                Ganas el doble de puntos en cada compra ahora mismo
              </p>
            </div>
          </div>
        )}

        {/* WELCOME */}
        <div className="mc-eyebrow">Mi cuenta</div>
        <h1 className="mc-heading">
          Hola, <span>{customer.firstName}</span> {level.emoji}
        </h1>
        <p className="mc-sub">Miembro {level.label}{customer.visitCount > 0 ? ` · ${customer.visitCount} visitas` : ''}</p>

        {/* STATS */}
        <div className="mc-stats">
          <div className="mc-stat">
            <p className="mc-stat-label">Disponibles</p>
            <p className="mc-stat-value gold">{customer.availablePoints}</p>
            <p className="mc-stat-unit">puntos</p>
          </div>
          <div className="mc-stat">
            <p className="mc-stat-label">Acumulados</p>
            <p className="mc-stat-value">{customer.lifetimePoints}</p>
            <p className="mc-stat-unit">total</p>
          </div>
          <div className="mc-stat">
            <p className="mc-stat-label">Canjeable</p>
            <p className="mc-stat-value green">${redeemable}</p>
            <p className="mc-stat-unit">MXN</p>
          </div>
        </div>

        {/* NEXT REWARD HINT */}
        {nextReward && (
          <div style={{
            background: 'rgba(245,200,66,.05)', border: '1px solid rgba(245,200,66,.14)',
            borderRadius: 12, padding: '10px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{nextReward.icon}</span>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(251,247,240,.4)', margin: 0, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Próximo canje</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--cream)', margin: 0 }}>{nextReward.title}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", color: 'var(--gold)', margin: 0, lineHeight: 1 }}>+{ptsToNextReward}</p>
              <p style={{ fontSize: 9, color: 'rgba(251,247,240,.3)', margin: 0 }}>pts necesarios</p>
            </div>
          </div>
        )}

        {/* LEVEL PROGRESS */}
        {level.nextAt ? (
          <div className="mc-level">
            <div className="mc-level-top">
              <span className="mc-level-name">{level.emoji} {level.label}</span>
              <span className="mc-level-next">{ptsToNext} pts para {level.next} →</span>
            </div>
            <div className="mc-bar-bg">
              <div className="mc-bar-fill" style={{ width: `${progressPct}%`, background: level.color }} />
            </div>
            <p className="mc-bar-pts">{customer.lifetimePoints} / {level.nextAt} puntos</p>
          </div>
        ) : (
          <div className="mc-gold-badge">
            <p>🥇 ¡Eres Gold! Nivel máximo alcanzado</p>
            <p>Tienes +20% de puntos bonus en cada compra</p>
          </div>
        )}

        <hr className="mc-divider" />

        {/* TABS */}
        <div className="mc-tabs">
          {[
            { key: 'tarjeta',  label: '📱 Tarjeta' },
            { key: 'historial', label: '📋 Historial' },
            { key: 'lealtad', label: '🏆 Lealtad' },
            { key: 'perfil', label: '👤 Perfil' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`mc-tab${activeTab === t.key ? ' active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB — TARJETA */}
        {activeTab === 'tarjeta' && (
          <div className="mc-card-wrap">
            <div className="mc-qr-hero" onClick={() => setQrFullscreen(true)}>
              <div className="mc-qr-hero-inner" style={{ borderColor: `${level.color}55` }}>
                <div className="mc-qr-hero-header">
                  <div>
                    <p className="mc-qr-hero-brand">House of Shake</p>
                    <p className="mc-qr-hero-name">{customer.firstName} {customer.lastName}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 26 }}>{level.emoji}</span>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: level.color, lineHeight: 1 }}>{level.label}</p>
                  </div>
                </div>
                <div className="mc-qr-center">
                  <div className="mc-qr-box">
                    <QRCodeSVG value={customer.id} size={180} bgColor="#ffffff" fgColor="#0B1509" level="H" includeMargin={true} />
                  </div>
                  <p className="mc-qr-tap-hint">Toca para ampliar</p>
                </div>
                <div className="mc-qr-hero-footer" style={{ borderTopColor: `${level.color}20` }}>
                  <div>
                    <p className="mc-qr-pts-label">Puntos disponibles</p>
                    <p className="mc-qr-pts-value" style={{ color: level.color }}>{customer.availablePoints.toLocaleString()}</p>
                  </div>
                  {redeemable > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <p className="mc-qr-pts-label">Canjeable</p>
                      <p className="mc-qr-pts-value" style={{ color: '#5EC97A' }}>${redeemable} MXN</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="mc-qr-instruction">📷 Muestra este QR al staff al momento de pagar</p>
            </div>

            <div className="mc-info-grid">
              <div className="mc-info-card">
                <div className="mc-info-icon">⚡</div>
                <p className="mc-info-title">1 pto = $1 MXN</p>
                <p className="mc-info-desc">Ganas puntos en cada compra</p>
              </div>
              <div className="mc-info-card">
                <div className="mc-info-icon">🎁</div>
                <p className="mc-info-title">100 pts = $5 MXN</p>
                <p className="mc-info-desc">Canjea tu saldo en tienda</p>
              </div>
            </div>

            <button
              onClick={handleAddToWallet}
              disabled={walletLoading}
              className="mc-wallet-btn"
              style={{ cursor: walletLoading ? 'not-allowed' : 'pointer', opacity: walletLoading ? .7 : 1, border: 'none', textAlign: 'center', width: '100%' }}
            >
              {walletLoading ? '⏳ Descargando pass...' : '🍎 Agregar a Apple Wallet'}
            </button>
            {walletError && (
              <p style={{ fontSize: 12, color: 'rgba(224,92,92,.9)', textAlign: 'center', marginTop: 8, padding: '8px 12px', background: 'rgba(224,92,92,.08)', borderRadius: 10, border: '1px solid rgba(224,92,92,.2)' }}>
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
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: 'rgba(251,247,240,.4)', textTransform: 'uppercase' }}>
              House of Shake
            </p>
            <div style={{ background: '#fff', padding: 20, borderRadius: 20, boxShadow: '0 0 80px rgba(245,200,66,.3)' }}>
              <QRCodeSVG value={customer.id} size={Math.min(280, window.innerWidth - 100)} bgColor="#ffffff" fgColor="#0B1509" level="H" includeMargin={false} />
            </div>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2, color: '#F5C842' }}>
              {customer.availablePoints.toLocaleString()} pts
            </p>
            <p style={{ fontSize: 12, color: 'rgba(251,247,240,.35)', letterSpacing: 1, fontWeight: 600 }}>
              {customer.firstName} {customer.lastName} · {level.emoji} {level.label}
            </p>
            <button
              onClick={() => setQrFullscreen(false)}
              style={{
                marginTop: 8, padding: '12px 32px',
                background: 'rgba(251,247,240,.08)',
                border: '1px solid rgba(251,247,240,.15)',
                borderRadius: 12, color: 'rgba(251,247,240,.5)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Montserrat', sans-serif", letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              ✕ Cerrar
            </button>
          </div>
        )}

        {/* TAB — HISTORIAL */}
        {activeTab === 'historial' && (
          <div>
            {txLoading ? (
              <div className="mc-empty">
                <div className="mc-empty-icon">⏳</div>
                <p className="mc-empty-title">Cargando...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="mc-empty">
                <div className="mc-empty-icon">☕</div>
                <p className="mc-empty-title">Sin transacciones aún</p>
                <p className="mc-empty-sub">¡Visita la sucursal y empieza a acumular puntos!</p>
              </div>
            ) : (
              <div>
                <div className="mc-tx-list">
                  {transactions.map(t => {
                    const cfg = TX_TYPE[t.type] || { label: t.type, color: '#8A7B6A' };
                    const isPos = t.points > 0;
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
                            {isPos ? '+' : ''}{t.points}
                          </p>
                          <p className="mc-tx-unit">pts</p>
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
                      background: 'rgba(251,247,240,.05)',
                      border: '1px solid rgba(251,247,240,.12)',
                      borderRadius: 12, color: 'rgba(251,247,240,.5)',
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      letterSpacing: 1,
                    }}
                  >
                    {txLoadingMore ? '⏳ Cargando...' : '↓ Ver más transacciones'}
                  </button>
                )}
                {!txHasMore && transactions.length >= TX_PAGE_SIZE && (
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(251,247,240,.2)', marginTop: 16, letterSpacing: 1 }}>
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

            {/* Rewards catalog */}
            <p className="mc-loyalty-section-title">Catálogo de recompensas</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {REWARDS.map(r => {
                const unlocked = customer.availablePoints >= r.pts;
                return (
                  <div key={r.pts} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: unlocked ? 'rgba(94,201,122,.07)' : 'rgba(251,247,240,.03)',
                    border: `1px solid ${unlocked ? 'rgba(94,201,122,.25)' : 'rgba(251,247,240,.07)'}`,
                    borderRadius: 14, padding: '14px 16px',
                  }}>
                    <span style={{ fontSize: 26, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: unlocked ? '#5EC97A' : 'var(--cream)', margin: 0 }}>{r.title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(251,247,240,.4)', margin: '2px 0 0' }}>{r.desc}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: unlocked ? '#5EC97A' : 'var(--gold)', margin: 0, lineHeight: 1 }}>{r.pts}</p>
                      <p style={{ fontSize: 9, color: 'rgba(251,247,240,.3)', margin: 0 }}>pts</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current level highlight */}
            <div className="mc-loyalty-hero" style={{ borderColor: `${level.color}40`, background: `${level.color}0d` }}>
              <div className="mc-loyalty-hero-emoji">{level.emoji}</div>
              <div>
                <p className="mc-loyalty-hero-label">Tu nivel actual</p>
                <p className="mc-loyalty-hero-name" style={{ color: level.color }}>{level.label}</p>
                {level.nextAt ? (
                  <p className="mc-loyalty-hero-hint">{ptsToNext} pts para alcanzar {level.next}</p>
                ) : (
                  <p className="mc-loyalty-hero-hint" style={{ color: '#ffd700' }}>¡Nivel máximo! 🎉</p>
                )}
              </div>
            </div>

            {/* Level cards */}
            <p className="mc-loyalty-section-title">Niveles del programa</p>
            <div className="mc-loyalty-levels">
              {LEVELS_INFO.map(lvl => {
                const isActive = customer.level === lvl.key;
                return (
                  <div key={lvl.key}
                    className={`mc-loyalty-level-card${isActive ? ' active' : ''}`}
                    style={{ borderColor: isActive ? lvl.color : 'rgba(251,247,240,.08)', background: isActive ? `${lvl.color}0d` : 'rgba(251,247,240,.03)' }}>
                    <div className="mc-loyalty-level-header">
                      <span style={{ fontSize: 24 }}>{lvl.emoji}</span>
                      <div>
                        <p className="mc-loyalty-level-name" style={{ color: isActive ? lvl.color : 'var(--cream)' }}>{lvl.label}</p>
                        <p className="mc-loyalty-level-range">{lvl.range} vitalicio</p>
                      </div>
                      {isActive && <span className="mc-loyalty-current-badge">ACTUAL</span>}
                    </div>
                    <ul className="mc-loyalty-perks">
                      {lvl.perks.map(p => (
                        <li key={p}><span className="mc-loyalty-check" style={{ color: lvl.color }}>✓</span> {p}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* How it works */}
            <p className="mc-loyalty-section-title" style={{ marginTop: 28 }}>¿Cómo funciona?</p>
            <div className="mc-loyalty-how">
              {[
                { icon: '☕', title: 'Compra en sucursal', desc: 'Muestra tu tarjeta QR al pagar en el mostrador' },
                { icon: '⚡', title: 'Gana puntos al instante', desc: '1 punto por cada $1 MXN (más bonus por nivel)' },
                { icon: '🎁', title: 'Canjea recompensas', desc: 'Desde 50 puntos — upgrades, descuentos y bebidas gratis' },
                { icon: '🏆', title: 'Sube de nivel', desc: 'Acumula puntos de por vida para desbloquear beneficios exclusivos' },
              ].map(s => (
                <div key={s.icon} className="mc-loyalty-step">
                  <div className="mc-loyalty-step-icon">{s.icon}</div>
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
                background: 'linear-gradient(135deg, rgba(255,128,176,.12), rgba(245,200,66,.08))',
                border: '1px solid rgba(255,128,176,.4)',
                borderRadius: 18, padding: '22px', marginBottom: 20,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎂</div>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: '#FF80B0', margin: '0 0 4px' }}>
                  ¡Feliz cumpleaños!
                </p>
                <p style={{ fontSize: 12, color: 'rgba(251,247,240,.5)', margin: '0 0 14px' }}>
                  Tienes un regalo especial esperándote
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: 'var(--gold)', margin: '0 0 16px', letterSpacing: 2 }}>
                  +200 puntos
                </p>
                <button
                  onClick={handleClaimBirthday}
                  disabled={claimingBd}
                  style={{
                    padding: '14px 32px', background: '#FF80B0', border: 'none',
                    borderRadius: 12, color: '#2C1A0E', fontWeight: 900, fontSize: 14,
                    cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
                    letterSpacing: 1, opacity: claimingBd ? .7 : 1,
                  }}
                >
                  {claimingBd ? '⏳ Reclamando...' : '🎁 ¡Reclamar mi regalo!'}
                </button>
                {bdMsg && (
                  <p style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: bdMsg.includes('ya') || bdMsg.includes('no') ? '#E05C5C' : '#5EC97A' }}>
                    {bdMsg}
                  </p>
                )}
              </div>
            )}

            {/* Birthday claim result (if not available but has a msg) */}
            {!customer.birthdayRewardAvailable && bdMsg && (
              <div style={{
                background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.25)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#5EC97A', margin: 0 }}>{bdMsg}</p>
              </div>
            )}

            {/* Profile form */}
            <div style={{ background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.08)', borderRadius: 18, padding: '20px' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, margin: '0 0 18px', color: 'var(--cream)' }}>
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
                      onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                    />
                  </div>
                  <div>
                    <label style={pLbl}>Apellido</label>
                    <input
                      value={profile.lastName}
                      onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                      style={pInp}
                      onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={pLbl}>Email (no editable)</label>
                  <input value={customer.email} disabled style={{ ...pInp, opacity: .35, cursor: 'not-allowed' }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={pLbl}>Teléfono (opcional)</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+52 55 0000 0000"
                    style={pInp}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={pLbl}>🎂 Fecha de cumpleaños</label>
                  <input
                    type="date"
                    value={profile.birthday}
                    onChange={e => setProfile(p => ({ ...p, birthday: e.target.value }))}
                    style={pInp}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(251,247,240,.12)'}
                  />
                  <p style={{ fontSize: 10, color: 'rgba(251,247,240,.3)', marginTop: 4, letterSpacing: .5, fontFamily: "'Montserrat', sans-serif" }}>
                    Recibirás +200 puntos de regalo el día de tu cumpleaños
                  </p>
                </div>

                {profileMsg && (
                  <p style={{
                    fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 12,
                    color: profileMsg.includes('✓') ? '#5EC97A' : '#E05C5C',
                  }}>
                    {profileMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    width: '100%', padding: '14px', background: 'var(--gold)',
                    color: '#2C1A0E', border: 'none', borderRadius: 12,
                    fontWeight: 900, fontSize: 14, cursor: 'pointer',
                    fontFamily: "'Montserrat', sans-serif", letterSpacing: 1,
                    opacity: profileSaving ? .7 : 1,
                  }}
                >
                  {profileSaving ? '⏳ Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>

            {/* Visit stats */}
            {(customer.visitCount > 0 || customer.lastVisitAt) && (
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.07)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: 'var(--gold)', margin: 0, lineHeight: 1 }}>{customer.visitCount || 0}</p>
                  <p style={{ fontSize: 10, color: 'rgba(251,247,240,.35)', margin: '4px 0 0', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Visitas totales</p>
                </div>
                <div style={{ background: 'rgba(251,247,240,.03)', border: '1px solid rgba(251,247,240,.07)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)', margin: 0, paddingTop: 8 }}>
                    {customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(251,247,240,.35)', margin: '4px 0 0', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Última visita</p>
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
  textTransform: 'uppercase', color: 'rgba(251,247,240,.4)', marginBottom: 6,
  fontFamily: "'Montserrat', sans-serif",
};

const pInp = {
  width: '100%', background: 'rgba(251,247,240,.05)', color: 'var(--cream)',
  border: '1px solid rgba(251,247,240,.12)', borderRadius: 12,
  padding: '12px 14px', outline: 'none',
  fontFamily: "'Montserrat', sans-serif", fontSize: 14,
  transition: 'border-color .2s', boxSizing: 'border-box',
  WebkitAppearance: 'none',
};
