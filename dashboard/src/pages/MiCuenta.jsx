import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LEVEL_CONFIG = {
  BRONZE: { color: '#cd7f32', bg: 'from-amber-900/40', emoji: '🥉', label: 'Bronze', next: 'Silver', nextAt: 101 },
  SILVER: { color: '#c0c0c0', bg: 'from-gray-600/40', emoji: '🥈', label: 'Silver', next: 'Gold', nextAt: 301 },
  GOLD:   { color: '#ffd700', bg: 'from-yellow-700/40', emoji: '🥇', label: 'Gold', next: null, nextAt: null },
};

const TX_TYPE_LABEL = {
  EARN: { label: 'Puntos ganados', color: 'text-green-400', sign: '+' },
  REDEEM: { label: 'Canje', color: 'text-blue-400', sign: '' },
  WELCOME_BONUS: { label: 'Bono de bienvenida', color: 'text-amber-400', sign: '+' },
  REVERSAL: { label: 'Reversión', color: 'text-red-400', sign: '' },
  ADJUSTMENT: { label: 'Ajuste', color: 'text-purple-400', sign: '' },
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
    // Refresh customer data
    fetch(`${API}/me`, { headers })
      .then(r => {
        if (r.status === 401) { handleLogout(); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setCustomer(data.customer);
        localStorage.setItem('hos_customer', JSON.stringify(data.customer));
      })
      .catch(() => {});

    // Load transactions
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
    <div className="min-h-screen bg-[#120800] text-white">

      {/* NAV */}
      <nav className="bg-[#1a0e04] border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">☕</span>
          <span className="font-black text-sm tracking-tight">HOUSE OF SHAKE</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm hidden sm:block">Hola, {customer.firstName}</span>
          <button onClick={handleLogout} className="text-white/30 hover:text-white/60 text-xs transition">
            Salir
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* WELCOME */}
        <div className="mb-6">
          <h1 className="text-2xl font-black">Hola, {customer.firstName} {level.emoji}</h1>
          <p className="text-white/40 text-sm mt-0.5">Miembro {level.label}</p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-white/40 text-xs mb-1">Disponibles</p>
            <p className="text-2xl font-black text-amber-400">{customer.availablePoints}</p>
            <p className="text-white/30 text-xs">puntos</p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-white/40 text-xs mb-1">Acumulados</p>
            <p className="text-2xl font-black text-white">{customer.lifetimePoints}</p>
            <p className="text-white/30 text-xs">total</p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-white/40 text-xs mb-1">Canjeable</p>
            <p className="text-2xl font-black text-green-400">${redeemable}</p>
            <p className="text-white/30 text-xs">MXN</p>
          </div>
        </div>

        {/* LEVEL PROGRESS */}
        {level.nextAt && (
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">{level.emoji} {level.label}</span>
              <span className="text-xs text-white/40">{ptsToNext} pts para {level.next} →</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: level.color }} />
            </div>
            <p className="text-white/30 text-xs mt-1.5">{customer.lifetimePoints} / {level.nextAt} puntos</p>
          </div>
        )}
        {customer.level === 'GOLD' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6 text-center">
            <p className="text-yellow-400 font-bold">🥇 ¡Eres Gold! Nivel máximo alcanzado</p>
            <p className="text-white/40 text-xs mt-1">Tienes +20% de puntos bonus en cada compra</p>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
          {[
            { key: 'tarjeta', label: '📱 Mi Tarjeta' },
            { key: 'historial', label: '📋 Historial' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === t.key ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: TARJETA */}
        {activeTab === 'tarjeta' && (
          <div>
            {/* Loyalty Card */}
            <div className={`rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${level.bg} to-[#1a0a00] border`}
              style={{ borderColor: `${level.color}30` }}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-widest">House of Shake</p>
                    <h2 className="text-white text-xl font-bold mt-1">{customer.firstName} {customer.lastName}</h2>
                    <p className="text-white/30 text-xs mt-0.5">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl">{level.emoji}</span>
                    <p className="text-xs mt-0.5 font-bold" style={{ color: level.color }}>{level.label}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider">Puntos disponibles</p>
                    <p className="text-5xl font-black text-amber-400 leading-none mt-1">{customer.availablePoints}</p>
                    {redeemable > 0 && (
                      <p className="text-green-400 text-xs mt-1 font-semibold">
                        = ${redeemable} MXN canjeables
                      </p>
                    )}
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-lg">
                    <QRCodeSVG value={customer.id} size={90} />
                  </div>
                </div>
              </div>

              <div className="bg-black/20 px-6 py-3 text-center">
                <p className="text-white/40 text-xs">Muestra este código QR al staff para acumular o canjear puntos</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">📱</p>
                <p className="text-white text-sm font-semibold">Muestra el QR</p>
                <p className="text-white/40 text-xs mt-0.5">Al pagar en el mostrador</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">🎁</p>
                <p className="text-white text-sm font-semibold">100 pts = $5 MXN</p>
                <p className="text-white/40 text-xs mt-0.5">Descuento en tu compra</p>
              </div>
            </div>

            {customer.walletPassUrl && (
              <a href={customer.walletPassUrl}
                className="mt-3 flex items-center justify-center gap-2 bg-black border border-white/20 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-white/5 transition">
                <span>🍎</span> Agregar a Apple Wallet
              </a>
            )}
          </div>
        )}

        {/* TAB: HISTORIAL */}
        {activeTab === 'historial' && (
          <div>
            {txLoading ? (
              <div className="text-center py-12 text-white/30">Cargando historial...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">☕</p>
                <p className="text-white/40">Aún no tienes transacciones.</p>
                <p className="text-white/25 text-sm mt-1">¡Visita la sucursal y empieza a acumular!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(t => {
                  const cfg = TX_TYPE_LABEL[t.type] || { label: t.type, color: 'text-white/60', sign: '' };
                  const isPositive = t.points > 0;
                  return (
                    <div key={t.id}
                      className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-white text-sm font-medium truncate">{t.description}</p>
                        <p className={`text-xs mt-0.5 ${cfg.color}`}>{cfg.label}</p>
                        <p className="text-white/25 text-xs mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{t.points}
                        </p>
                        <p className="text-white/30 text-xs">pts</p>
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
