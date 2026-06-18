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
            { key: 'tarjeta',  label: '📱 Mi Tarjeta' },
            { key: 'historial', label: '📋 Historial' },
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
            <div className="mc-card">
              <div className={`mc-card-body ${level.cls}`}>
                <div className="mc-card-header">
                  <div>
                    <p className="mc-card-brand">House of Shake</p>
                    <p className="mc-card-name">{customer.firstName} {customer.lastName}</p>
                    <p className="mc-card-email">{customer.email}</p>
                  </div>
                  <div className="mc-card-level-badge">
                    <div className="emoji">{level.emoji}</div>
                    <div className="lbl" style={{ color: level.color }}>{level.label}</div>
                  </div>
                </div>

                <div className="mc-card-bottom">
                  <div>
                    <p className="mc-card-pts-label">Puntos disponibles</p>
                    <p className="mc-card-pts-value">{customer.availablePoints}</p>
                    {redeemable > 0 && (
                      <p className="mc-card-pts-redeem">= ${redeemable} MXN canjeables</p>
                    )}
                  </div>
                  <div className="mc-card-qr">
                    <QRCodeSVG value={customer.id} size={96} />
                  </div>
                </div>
              </div>
              <div className="mc-card-footer">
                Muestra este código QR al staff para acumular o canjear puntos
              </div>
            </div>

            <div className="mc-info-grid">
              <div className="mc-info-card">
                <div className="mc-info-icon">📱</div>
                <p className="mc-info-title">Muestra el QR</p>
                <p className="mc-info-desc">Al pagar en el mostrador</p>
              </div>
              <div className="mc-info-card">
                <div className="mc-info-icon">🎁</div>
                <p className="mc-info-title">100 pts = $5 MXN</p>
                <p className="mc-info-desc">Descuento en tu compra</p>
              </div>
            </div>

            {customer.walletPassUrl && (
              <a href={customer.walletPassUrl} className="mc-wallet-btn">
                🍎 Agregar a Apple Wallet
              </a>
            )}
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

      </div>
    </div>
  );
}
