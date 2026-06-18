import { useState, useEffect } from 'react';
import { transactionsApi } from '../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const txTypeLabel = {
  EARN: { label: 'Compra', color: 'bg-green-100 text-green-700' },
  REDEEM: { label: 'Canje', color: 'bg-red-100 text-red-700' },
  WELCOME_BONUS: { label: 'Bienvenida', color: 'bg-blue-100 text-blue-700' },
  EXPIRY: { label: 'Expiración', color: 'bg-gray-100 text-gray-600' },
  ADJUSTMENT: { label: 'Ajuste', color: 'bg-purple-100 text-purple-700' },
  REVERSAL: { label: 'Reversión', color: 'bg-orange-100 text-orange-700' },
};

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => { load(); }, [page, type]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await transactionsApi.list({ page, limit, type: type || undefined });
      setTransactions(data.transactions);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transacciones ({total})</h1>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Todos los tipos</option>
          {Object.entries(txTypeLabel).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Puntos</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Cargando...</td></tr>}
              {!loading && transactions.map(tx => {
                const typeInfo = txTypeLabel[tx.type] || { label: tx.type, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{tx.customer?.firstName} {tx.customer?.lastName}</p>
                      <p className="text-gray-400 text-xs">{tx.customer?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{tx.description}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                    </td>
                  </tr>
                );
              })}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin transacciones</td></tr>
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}
