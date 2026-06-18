import { useState, useEffect } from 'react';
import { transactionsApi } from '../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TX_TYPE = {
  EARN:          { label: 'Compra',     color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  REDEEM:        { label: 'Canje',      color: '#c85032', bg: '#fff4f2', border: '#fecaca' },
  WELCOME_BONUS: { label: 'Bienvenida', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  EXPIRY:        { label: 'Expiración', color: '#666',    bg: '#f9fafb', border: '#e5e7eb' },
  ADJUSTMENT:    { label: 'Ajuste',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  REVERSAL:      { label: 'Reversión',  color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
};

function TypeBadge({ type }) {
  const t = TX_TYPE[type] || { label: type, color: '#666', bg: '#f9fafb', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: .3,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
    }}>{t.label}</span>
  );
}

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
    <div style={{ maxWidth: 1100 }}>
      <style>{`
        .tx-table { display: none; }
        .tx-cards { display: flex; flex-direction: column; gap: 10px; }
        @media (min-width: 700px) {
          .tx-table { display: block; }
          .tx-cards { display: none; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111', margin: 0 }}>Transacciones ({total})</h1>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          style={{ padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Todos los tipos</option>
          {Object.entries(TX_TYPE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* DESKTOP TABLE */}
      <div className="tx-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#555' }}>Cliente</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#555' }}>Descripción</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#555' }}>Tipo</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#555' }}>Puntos</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>Cargando...</td></tr>
              )}
              {!loading && transactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f9f9f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontWeight: 600, color: '#111', margin: 0 }}>{tx.customer?.firstName} {tx.customer?.lastName}</p>
                    <p style={{ color: '#aaa', fontSize: 11, margin: '2px 0 0' }}>{tx.customer?.email}</p>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}><TypeBadge type={tx.type} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: tx.points > 0 ? '#16a34a' : '#dc2626', fontSize: 14 }}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#aaa', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>Sin transacciones</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
      </div>

      {/* MOBILE CARDS */}
      <div className="tx-cards">
        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>Cargando...</div>
        )}
        {!loading && transactions.map(tx => (
          <div key={tx.id} style={{
            background: '#fff', borderRadius: 14, padding: '14px 16px',
            boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid #f0f0f0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#111', margin: 0 }}>
                  {tx.customer?.firstName} {tx.customer?.lastName}
                </p>
                <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 4px' }}>{tx.customer?.email}</p>
                <p style={{ fontSize: 12, color: '#666', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontWeight: 900, fontSize: 18, color: tx.points > 0 ? '#16a34a' : '#dc2626', margin: '0 0 4px' }}>
                  {tx.points > 0 ? '+' : ''}{tx.points}
                </p>
                <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>pts</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <TypeBadge type={tx.type} />
              <span style={{ fontSize: 11, color: '#bbb' }}>
                {format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
              </span>
            </div>
          </div>
        ))}
        {!loading && transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>Sin transacciones</div>
        )}
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, setPage }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '14px 16px' }}>
      <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
        style={{ padding: '6px 12px', borderRadius: 8, background: '#f5f5f5', border: 'none', fontSize: 13, color: '#555', cursor: 'pointer', opacity: page === 1 ? .4 : 1, fontFamily: 'inherit' }}>
        ← Anterior
      </button>
      <span style={{ fontSize: 13, color: '#888' }}>{page} / {totalPages}</span>
      <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
        style={{ padding: '6px 12px', borderRadius: 8, background: '#f5f5f5', border: 'none', fontSize: 13, color: '#555', cursor: 'pointer', opacity: page === totalPages ? .4 : 1, fontFamily: 'inherit' }}>
        Siguiente →
      </button>
    </div>
  );
}
