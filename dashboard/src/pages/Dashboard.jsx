import { useState, useEffect, useRef } from 'react';
import { statsApi, setupApi, loyaltyApi } from '../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PeopleIcon, StarIcon, GiftIcon, UserPlusIcon, LightningIcon, FlameIcon, RankIcon, CakeIcon, TrophyIcon, CheckIcon } from '../components/Icons';

const engagementColors = { BRONZE: '#5EC97A', SILVER: '#1A5BB5', GOLD: '#F5C842' };
const engagementLabels = { BRONZE: 'Nuevos (1–39 🌲)', SILVER: 'Activos (40–119 🌲)', GOLD: 'Fieles (120+ 🌲)' };
const txTypeLabel = {
  EARN: 'Pinos ganados', REDEEM: 'Canje', WELCOME_BONUS: 'Bienvenida',
  EXPIRY: 'Expiración', ADJUSTMENT: 'Ajuste manual', REVERSAL: 'Reversión',
};

function StatCard({ title, value, subtitle, gradient, dark, icon }) {
  const textColor = dark ? '#1B2F56' : '#fff';
  return (
    <div style={{
      background: gradient, borderRadius: 18, padding: '20px 24px',
      color: textColor, minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: dark ? .7 : .85, marginBottom: 6, letterSpacing: .5, textTransform: 'uppercase' }}>{title}</p>
          <p style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 2 }}>{value}</p>
          {subtitle && <p style={{ fontSize: 11, opacity: dark ? .6 : .7 }}>{subtitle}</p>}
        </div>
        {icon && <span style={{ opacity: dark ? .55 : .75 }}>{icon}</span>}
      </div>
    </div>
  );
}

function MiniTopCustomer({ customer, rank }) {
  const totalPines = Math.floor((customer.lifetimePoints || 0) / 10);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ flexShrink: 0 }}><RankIcon size={22} rank={rank + 1} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {customer.firstName} {customer.lastName}
        </p>
        <p style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, margin: 0, letterSpacing: .5 }}>
          {totalPines >= 120 ? '🌲 Fiel' : totalPines >= 40 ? '🌱 Activo' : '🪴 Nuevo'}
        </p>
      </div>
      <span style={{ fontWeight: 900, fontSize: 14, color: '#D9A62B', flexShrink: 0 }}>
        {totalPines.toLocaleString()} 🌲
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupResult, setSetupResult] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [birthdayCustomers, setBirthdayCustomers] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef = useRef(null);

  function loadStats() {
    statsApi.getDashboard()
      .then(({ data }) => { setStats(data); setLastUpdated(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStats();

    loyaltyApi.getBirthdayCustomers()
      .then(({ data }) => setBirthdayCustomers(data.customers || []))
      .catch(() => {});

    // Auto-refresh stats every 30 seconds
    pollRef.current = setInterval(loadStats, 30000);
    return () => clearInterval(pollRef.current);
  }, []);

  async function handleSetupShopify() {
    if (!confirm('¿Registrar webhooks y ScriptTag en Shopify?')) return;
    setSetupLoading(true);
    try {
      const { data } = await setupApi.shopify();
      setSetupResult(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Error en setup');
    } finally {
      setSetupLoading(false);
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>
        <div style={{ marginBottom: 8 }}><LightningIcon size={36} color="#aaa" /></div>
        <p style={{ fontSize: 13 }}>Cargando estadísticas...</p>
      </div>
    </div>
  );

  const levelData = stats?.levelDistribution?.map(l => ({
    name: engagementLabels[l.level] || l.level,
    clientes: l._count.level,
    color: engagementColors[l.level] || '#ccc',
  })) || [];

  const pieData = levelData.map(l => ({ name: l.name, value: l.clientes, color: l.color }));

  const engagementRate = stats?.totalCustomers
    ? Math.round((stats.activeCustomers30d / stats.totalCustomers) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0F448B', margin: 0 }}>Dashboard</h1>
          {lastUpdated && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
              Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto-refresh cada 30s
            </div>
          )}
        </div>
      </div>

      {/* Primary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard icon={<PeopleIcon size={28} color="white" />} title="Total Clientes" value={stats?.totalCustomers?.toLocaleString() || 0} gradient="linear-gradient(135deg,#0F448A,#071E3D)" />
        <StatCard icon={<StarIcon size={28} color="#1B2F56" />} title="Pinos Activos" value={Math.floor((stats?.totalAvailablePoints || 0) / 10).toLocaleString()} subtitle="en circulación 🌲" gradient="linear-gradient(135deg,#F5C842,#D9A62B)" dark />
        <StatCard icon={<GiftIcon size={28} color="white" animated={false} />} title="Canjes Hoy" value={stats?.redemptionsToday || 0} gradient="linear-gradient(135deg,#5EC97A,#3FA860)" />
      </div>

      {/* Loyalty KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<UserPlusIcon size={28} color="white" />} title="Nuevos este mes" value={stats?.newCustomersThisMonth || 0} subtitle="clientes registrados" gradient="linear-gradient(135deg,#1A5BB5,#0F448A)" />
        <StatCard icon={<LightningIcon size={28} color="#1B2F56" />} title="Pinos Ganados (Mes)" value={Math.floor((stats?.pointsEarnedThisMonth || 0) / 10).toLocaleString()} subtitle="🌲 acumulados" gradient="linear-gradient(135deg,#F5C842,#D9A62B)" dark />
        <StatCard icon={<FlameIcon size={28} color="white" />} title="Activos 30 días" value={stats?.activeCustomers30d || 0} subtitle={`${engagementRate}% engagement`} gradient="linear-gradient(135deg,#0A2850,#071E3D)" />
      </div>

      {/* Birthday customers today */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4, marginTop: 0, display:'flex', alignItems:'center', gap:6 }}><CakeIcon size={16} color="#111" /> Cumpleaños hoy</h2>
          <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 14px' }}>{birthdayCustomers.length} cliente(s) celebra(n) hoy</p>
          {birthdayCustomers.length === 0 ? (
            <p style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Sin cumpleaños hoy</p>
          ) : (
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {birthdayCustomers.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{c.firstName} {c.lastName}</p>
                    <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{c.email} · {Math.floor((c.lifetimePoints || 0) / 10)} Pinos 🌲</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: Number(c.birthday_reward_year) === new Date().getFullYear() ? '#5EC97A' : '#D9A62B', flexShrink: 0 }}>
                    {Number(c.birthday_reward_year) === new Date().getFullYear() ? '✓ Reclamado' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>

        {/* Distribución por nivel - Bar */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4, marginTop: 0 }}>Distribución de Engagement 🌲</h2>
          <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 14px' }}>Basado en Pinos totales históricos por cliente</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={levelData} barCategoryGap="30%">
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontSize: 12 }} />
              <Bar dataKey="clientes" radius={[6, 6, 0, 0]}>
                {levelData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || '#D9A62B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart de niveles */}
        {pieData.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16, marginTop: 0 }}>Mix de Fidelización</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieData.map(d => {
                  const total = pieData.reduce((s, x) => s + x.value, 0);
                  const pct = total ? Math.round((d.value / total) * 100) : 0;
                  return (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#555', flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* Top clientes */}
        {stats?.topCustomers?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16, marginTop: 0, display:'flex', alignItems:'center', gap:6 }}><TrophyIcon size={16} color="#111" /> Top Clientes</h2>
            {stats.topCustomers.map((c, i) => <MiniTopCustomer key={i} customer={c} rank={i} />)}
          </div>
        )}

        {/* Últimas transacciones */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16, marginTop: 0 }}>Últimos Movimientos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto' }}>
            {!stats?.recentTransactions?.length && (
              <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sin movimientos aún</p>
            )}
            {stats?.recentTransactions?.map(tx => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.customer?.firstName} {tx.customer?.lastName}
                  </p>
                  <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                    {txTypeLabel[tx.type]} · {format(new Date(tx.createdAt), 'dd MMM HH:mm', { locale: es })}
                  </p>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: tx.points > 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                  {tx.points > 0 ? '+' : ''}{(tx.points / 10) % 1 === 0 ? tx.points / 10 : (tx.points / 10).toFixed(1)} 🌲
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
