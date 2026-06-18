import { useState, useEffect } from 'react';
import { customersApi } from '../services/api';

const levelBadge = {
  BRONZE: 'bg-amber-100 text-amber-800',
  SILVER: 'bg-gray-100 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-800',
};
const levelLabel = { BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ points: '', description: '' });
  const [adjustMsg, setAdjustMsg] = useState('');

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => { load(); }, [page, search, level]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await customersApi.list({ page, limit, search, level: level || undefined });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const { data } = await customersApi.exportCSV();
    const url = URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAdjust() {
    if (!selected || !adjustForm.points) return;
    try {
      await customersApi.adjustPoints(selected.id, parseInt(adjustForm.points), adjustForm.description);
      setAdjustMsg('✅ Ajuste aplicado');
      setTimeout(() => { setAdjustMsg(''); setSelected(null); load(); }, 1500);
    } catch (err) {
      setAdjustMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  }

  async function handlePush(id) {
    try {
      await customersApi.forceWalletUpdate(id);
      alert('Push enviado correctamente');
    } catch {
      alert('Error enviando push');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes ({total})</h1>
        <button onClick={handleExport} className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700">
          📥 Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-48 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <select
          value={level}
          onChange={e => { setLevel(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Todos los niveles</option>
          <option value="BRONZE">Bronce</option>
          <option value="SILVER">Plata</option>
          <option value="GOLD">Oro</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Puntos</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Nivel</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              )}
              {!loading && customers.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-red-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.firstName} {c.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{c.availablePoints.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${levelBadge[c.level]}`}>
                      {levelLabel[c.level]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => setSelected(c)} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                        Ajustar
                      </button>
                      <button onClick={() => handlePush(c.id)} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                        Push 🍎
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-40 text-sm">← Anterior</button>
            <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-40 text-sm">Siguiente →</button>
          </div>
        )}
      </div>

      {/* Modal ajuste de puntos */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Ajuste de Puntos</h3>
            <p className="text-sm text-gray-500 mb-4">{selected.firstName} {selected.lastName} · {selected.availablePoints} pts actuales</p>

            <input type="number" placeholder="Puntos (+ agregar, - quitar)"
              value={adjustForm.points}
              onChange={e => setAdjustForm({ ...adjustForm, points: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm" />

            <input type="text" placeholder="Descripción (opcional)"
              value={adjustForm.description}
              onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm" />

            {adjustMsg && <p className="text-sm mb-3">{adjustMsg}</p>}

            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancelar</button>
              <button onClick={handleAdjust} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
