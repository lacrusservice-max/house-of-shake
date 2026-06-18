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
  REVERSAL:      { label: 'Reversión',         color: '#E05C5C' },
  ADJUSTMENT:    { label: 'Ajuste',            color: '#b07bff' },
};

export default function MiCuenta() {
  const [customer, setCustomer] = useState(() => JSON.parse(localStorage.getItem('hos_customer') || 'null'));
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tarjeta');
  const [qrFullscreen, setQrFullscreen] = useState(false);

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
      })
      .catch(() => {});

    fetch(`${API}/me/transactions`, { headers })
      .then(r => r.json())
      .then(data => setTransactions(data.transactions || []))
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, []);

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

        {/* WELCOME */}
        <div className="mc-eyebrow">Mi cuenta</div>
        <h1 className="mc-heading">
          Hola, <span>{customer.firstName}</span> {level.emoji}
        </h1>
        <p className="mc-sub">Miembro {level.label}</p>

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

            {/* ── QR HERO ── tappable, opens fullscreen */}
            <div className="mc-qr-hero" onClick={() => setQrFullscreen(true)}>
              <div className="mc-qr-hero-inner" style={{ borderColor: `${level.color}55` }}>
                {/* Header */}
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

                {/* QR Code — center stage */}
                <div className="mc-qr-center">
                  <div className="mc-qr-box">
                    <QRCodeSVG
                      value={customer.id}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#0B1509"
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="mc-qr-tap-hint">Toca para ampliar</p>
                </div>

                {/* Points footer */}
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

              <p className="mc-qr-instruction">
                📷 Muestra este QR al staff al momento de pagar
              </p>
            </div>

            {/* Info tiles */}
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

            {customer.walletPassUrl && (
              <a href={customer.walletPassUrl} className="mc-wallet-btn">
                🍎 Agregar a Apple Wallet
              </a>
            )}
          </div>
        )}

        {/* ── QR FULLSCREEN OVERLAY ── */}
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
              <QRCodeSVG
                value={customer.id}
                size={Math.min(280, window.innerWidth - 100)}
                bgColor="#ffffff"
                fgColor="#0B1509"
                level="H"
                includeMargin={false}
              />
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
            )}
          </div>
        )}

        {/* TAB — LEALTAD */}
        {activeTab === 'lealtad' && (
          <div className="mc-loyalty">

            {/* Current level highlight */}
            <div className="mc-loyalty-hero" style={{ borderColor: `${level.color}40`, background: `${level.color}0d` }}>
              <div className="mc-loyalty-hero-emoji">{level.emoji}</div>
              <div>
                <p className="mc-loyalty-hero-label">Tu nivel actual</p>
                <p className="mc-loyalty-hero-name" style={{ color: level.color }}>{level.label}</p>
                {level.nextAt && (
                  <p className="mc-loyalty-hero-hint">{ptsToNext} pts para alcanzar {level.next}</p>
                )}
                {!level.nextAt && (
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
              <div className="mc-loyalty-step">
                <div className="mc-loyalty-step-icon">☕</div>
                <div>
                  <p className="mc-loyalty-step-title">Compra en sucursal</p>
                  <p className="mc-loyalty-step-desc">Muestra tu tarjeta QR al pagar en el mostrador</p>
                </div>
              </div>
              <div className="mc-loyalty-step">
                <div className="mc-loyalty-step-icon">⚡</div>
                <div>
                  <p className="mc-loyalty-step-title">Gana puntos al instante</p>
                  <p className="mc-loyalty-step-desc">1 punto por cada $1 MXN gastado (más bonus por nivel)</p>
                </div>
              </div>
              <div className="mc-loyalty-step">
                <div className="mc-loyalty-step-icon">🎁</div>
                <div>
                  <p className="mc-loyalty-step-title">Canjea tu saldo</p>
                  <p className="mc-loyalty-step-desc">100 puntos = $5 MXN de descuento en tu próxima compra</p>
                </div>
              </div>
              <div className="mc-loyalty-step">
                <div className="mc-loyalty-step-icon">🏆</div>
                <div>
                  <p className="mc-loyalty-step-title">Sube de nivel</p>
                  <p className="mc-loyalty-step-desc">Acumula puntos de por vida para desbloquear beneficios exclusivos</p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
