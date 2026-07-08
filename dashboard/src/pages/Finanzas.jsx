import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week',  label: '7 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year',  label: 'Este año' },
  { value: 'all',   label: 'Todo' },
];

function fmt(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

export default function Finanzas() {
  const [period, setPeriod]     = useState('month');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [exporting, setExporting] = useState(false);

  const token = localStorage.getItem('hos_admin_token');
  const headers = { Authorization: `Bearer ${token}` };
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  async function exportTransactionsCSV() {
    setExporting(true);
    try {
      const res = await fetch(`${API}/admin/export/transactions?period=${period}`, { headers });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacciones_${period}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API}/admin/financials?period=${period}`, { headers })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Error al cargar finanzas'); setLoading(false); });
  }, [period]);

  const graficaData = (data?.grafica_diaria || []).map(d => ({
    fecha: new Date(d.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
    ingresos: parseFloat(d.ingresos) || 0,
    txns: parseInt(d.transacciones) || 0,
  }));

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#c85032', textTransform: 'uppercase', marginBottom: 6 }}>Panel financiero</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111', margin: 0 }}>Finanzas</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Ingresos, canjes y actividad del personal</p>
        </div>
        <button onClick={exportTransactionsCSV} disabled={exporting} style={{
          padding: '10px 20px', background: '#2c9e5e', color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12,
          cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? .6 : 1,
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, height: 'fit-content',
        }}>
          {exporting ? '⏳ Exportando...' : '⬇️ Exportar CSV'}
        </button>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)} style={{
            padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
            background: period === p.value ? '#c85032' : '#f5f5f5',
            color: period === p.value ? '#fff' : '#555',
            transition: 'all .15s',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 14 }}>
          Cargando datos financieros…
        </div>
      )}

      {error && (
        <div style={{ background: '#fff0ee', border: '1px solid #ffd0c8', color: '#c85032', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <KpiCard
              title="Ingresos registrados"
              value={fmt(data.ingresos?.total)}
              sub={`${data.ingresos?.transacciones || 0} transacciones`}
              color="#c85032"
              icon="💰"
            />
            <KpiCard
              title="Descuentos otorgados"
              value={fmt(data.canjes?.total_descuento_mxn)}
              sub={`${data.canjes?.transacciones || 0} canjes · ${data.canjes?.total_puntos || 0} pts`}
              color="#e8a020"
              icon="🎁"
            />
            <KpiCard
              title="Balance neto"
              value={fmt(data.balance_neto)}
              sub="Ingresos − descuentos"
              color={data.balance_neto >= 0 ? '#2c9e5e' : '#dc2626'}
              icon="📊"
            />
            <KpiCard
              title="Puntos otorgados"
              value={(data.ingresos?.puntos_otorgados || 0).toLocaleString()}
              sub="pts acumulados en el período"
              color="#7c3aed"
              icon="⭐"
            />
          </div>

          {/* Gráfica de ingresos */}
          {graficaData.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 24, border: '1px solid #f0f0f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 16 }}>Ingresos diarios (últimos 30 días)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={graficaData}>
                  <defs>
                    <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c85032" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#c85032" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#aaa' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#aaa' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [fmt(v), 'Ingresos']} labelStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="ingresos" stroke="#c85032" fill="url(#gradRed)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Actividad por staff */}
          {data.actividad_staff?.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 24, border: '1px solid #f0f0f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 16 }}>Actividad por personal</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f5f5f5' }}>
                      {['Personal', 'Transacciones', 'Ingresos generados'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.actividad_staff.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff4f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                              👤
                            </div>
                            <span style={{ fontWeight: 600, color: '#333' }}>{s.staff || 'Sistema'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>
                          <span style={{ background: '#f5f5f5', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{s.transacciones}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#2c9e5e' }}>
                          {fmt(s.ingresos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary insight */}
          <div style={{ background: 'linear-gradient(135deg, #fff8f6, #fff)', borderRadius: 16, padding: '20px 24px', border: '1px solid #ffe0d8' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#c85032', marginBottom: 12 }}>Resumen del período</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: '#888' }}>Ingreso promedio por transacción: </span>
                <strong style={{ color: '#333' }}>
                  {data.ingresos?.transacciones
                    ? fmt((data.ingresos?.total || 0) / data.ingresos.transacciones)
                    : '$0'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#888' }}>Costo del programa de lealtad: </span>
                <strong style={{ color: '#e8a020' }}>{fmt(data.canjes?.total_descuento_mxn)}</strong>
              </div>
              <div>
                <span style={{ color: '#888' }}>% en descuentos: </span>
                <strong style={{ color: '#333' }}>
                  {data.ingresos?.total
                    ? ((data.canjes?.total_descuento_mxn / data.ingresos.total) * 100).toFixed(1) + '%'
                    : '0%'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#888' }}>Personal activo: </span>
                <strong style={{ color: '#333' }}>{data.actividad_staff?.length || 0}</strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, sub, color, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#bbb' }}>{sub}</div>
    </div>
  );
}
