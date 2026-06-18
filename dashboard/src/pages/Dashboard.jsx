import { useState, useEffect } from 'react';
import { statsApi, setupApi } from '../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const levelColors = { BRONZE: '#cd7f32', SILVER: '#b0b0b0', GOLD: '#f5c842' };
const levelLabels = { BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro' };
const txTypeLabel = {
  EARN: 'Puntos ganados', REDEEM: 'Canje', WELCOME_BONUS: 'Bienvenida',
  EXPIRY: 'Expiración', ADJUSTMENT: 'Ajuste manual', REVERSAL: 'Reversión',
};

function StatCard({ title, value, subtitle, color = 'red' }) {
  const colors = {
    red: 'from-red-500 to-red-600',
    amber: 'from-amber-500 to-orange-500',
    green: 'from-green-500 to-emerald-600',
    blue: 'from-blue-500 to-indigo-500',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-6 text-white`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-extrabold mt-1">{value}</p>
      {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
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
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <div className="text-4xl mb-2">⏳</div>
        <p>Cargando estadísticas...</p>
      </div>
    </div>
  );

  const levelData = stats?.levelDistribution?.map(l => ({
    name: levelLabels[l.level] || l.level,
    clientes: l._count.level,
    color: levelColors[l.level],
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={handleSetupShopify}
          disabled={setupLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          {setupLoading ? '⏳ Configurando...' : '🔧 Setup Shopify'}
        </button>
      </div>

      {setupResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-medium text-green-800 mb-2">✅ Setup completado</p>
          <pre className="text-xs text-green-700 overflow-auto">{JSON.stringify(setupResult, null, 2)}</pre>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Clientes" value={stats?.totalCustomers?.toLocaleString() || 0} color="red" />
        <StatCard title="Puntos en Circulación" value={stats?.totalAvailablePoints?.toLocaleString() || 0} subtitle="puntos disponibles" color="amber" />
        <StatCard title="Canjes Hoy" value={stats?.redemptionsToday || 0} color="green" />
      </div>

      {/* Distribución por nivel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Distribución por Nivel</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levelData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="clientes" radius={[6, 6, 0, 0]} fill="#c85032" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Últimas transacciones */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Últimos Movimientos</h2>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {stats?.recentTransactions?.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">Sin movimientos aún</p>
            )}
            {stats?.recentTransactions?.map(tx => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">
                    {tx.customer?.firstName} {tx.customer?.lastName}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {txTypeLabel[tx.type]} · {format(new Date(tx.createdAt), 'dd MMM HH:mm', { locale: es })}
                  </p>
                </div>
                <span className={`font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
