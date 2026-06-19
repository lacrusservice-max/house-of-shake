import { useState, useEffect } from 'react';
import { statsApi, setupApi } from '../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const levelColors = { BRONZE: '#cd7f32', SILVER: '#b0b0b0', GOLD: '#f5c842' };
const levelLabels = { BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro' };
const txTypeLabel = {
  EARN: 'Puntos ganados', REDEEM: 'Canje', WELCOME_BONUS: 'Bienvenida',
  EXPIRY: 'Expiración', ADJUSTMENT: 'Ajuste manual', REVERSAL: 'Reversión',
};

function StatCard({ title, value, subtitle, gradient, icon }) {
  return (
    <div style={{
      background: gradient, borderRadius: 18, padding: '20px 24px',
      color: '#fff', minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, opacity: .8, marginBottom: 6, letterSpacing: .5 }}>{title}</p>
          <p style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 2 }}>{value}</p>
          {subtitle && <p style={{ fontSize: 11, opacity: .65 }}>{subtitle}</p>}
        </div>
        {icon && <span style={{ fontSize: 28, opacity: .7 }}>{icon}</span>}
      </div>
    </div>
  );
}

function MiniTopCustomer({ customer, rank }) {
  const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][rank];
  const lvlColor = levelColors[customer.level] || '#cd7f32';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{medal}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {customer.firstName} {customer.lastName}
        </p>
        <p style={{ fontSize: 10, color: lvlColor, fontWeight: 700, margin: 0, letterSpacing: .5 }}>{levelLabels[customer.level]}</p>
      </div>
      <span style={{ fontWeight: 900, fontSize: 14, color: '#c85032', flexShrink: 0 }}>
        {customer.lifetimePoints?.toLocaleString()} pts
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupResult, setSetupResult] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    statsApi.getDashboard()
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
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
        <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
        <p style={{ fontSize: 13 }}>Cargando estadísticas...</p>
      </div>
    </div>
  );

  const levelData = stats?.levelDistribution?.map(l => ({
    name: levelLabels[l.level] || l.level,
    clientes: l._count.level,
    color: levelColors[l.level],
  })) || [];

  const pieData = levelData.map(l => ({ name: l.name, value: l.clientes, color: levelColors[Object.keys(levelLabels).find(k => levelLabels[k] === l.name)] || '#ccc' }));

  const engagementRate = stats?.totalCustomers
    ? Math.round((stats.activeCustomers30d / stats.totalCustomers) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: 0 }}>Dashboard</h1>
        <button onClick={handleSetupShopify} disabled={setupLoading}
          style={{
            padding: '9px 18px', background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', opacity: setupLoading ? .6 : 1,
            fontFamily: 'inherit',
          }}>
          {setupLoading ? '⏳ Configurando...' : '🔧 Setup Shopify'}
        </button>
      </div>

      {setupResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ fontWeight: 700, color: '#166534', marginBottom: 8, fontSize: 13 }}>✅ Setup completado</p>
          <pre style={{ fontSize: 11, color: '#15803d', overflow: 'auto', margin: 0 }}>{JSON.stringify(setupResult, null, 2)}</pre>
        </div>
      )}

      {/* Primary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard icon="👥" title="Total Clientes" value={stats?.totalCustomers?.toLocaleString() || 0} gradient="linear-gradient(135deg,#c85032,#e8401a)" />
        <StatCard icon="⭐" title="Puntos en Circulación" value={stats?.totalAvailablePoints?.toLocaleString() || 0} subtitle="disponibles" gradient="linear-gradient(135deg,#f59e0b,#ea580c)" />
        <StatCard icon="🎁" title="Canjes Hoy" value={stats?.redemptionsToday || 0} gradient="linear-gradient(135deg,#16a34a,#059669)" />
      </div>

      {/* Loyalty KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon="🆕" title="Nuevos este mes" value={stats?.newCustomersThisMonth || 0} subtitle="clientes registrados" gradient="linear-gradient(135deg,#7c3aed,#6d28d9)" />
        <StatCard icon="⚡" title="Puntos ganados (mes)" value={(stats?.pointsEarnedThisMonth || 0).toLocaleString()} subtitle="pts acumulados" gradient="linear-gradient(135deg,#0284c7,#0369a1)" />
        <StatCard icon="🔥" title="Activos 30 días" value={stats?.activeCustomers30d || 0} subtitle={`${engagementRate}% engagement`} gradient="linear-gradient(135deg,#db2777,#be185d)" />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>

        {/* Distribución por nivel - Bar */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16, marginTop: 0 }}>Distribución por Nivel</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={levelData} barCategoryGap="30%">
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontSize: 12 }} />
              <Bar dataKey="clientes" radius={[6, 6, 0, 0]}>
                {levelData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || '#c85032'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart de niveles */}
        {pieData.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16, marginTop: 0 }}>Porcentaje por Nivel</h2>
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
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 16, marginTop: 0 }}>🏆 Top Clientes</h2>
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
                  {tx.points > 0 ? '+' : ''}{tx.points}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
