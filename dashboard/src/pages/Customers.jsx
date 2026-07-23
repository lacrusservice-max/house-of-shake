import { useState, useEffect } from 'react';
import { customersApi } from '../services/api';

const LEVEL_COLOR = { BRONZE: '#cd7f32', SILVER: '#b0b0b0', GOLD: '#f5c842' };
const LEVEL_LABEL = { BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro' };

function LevelBadge({ level }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: .5,
      background: `${LEVEL_COLOR[level]}22`,
      color: LEVEL_COLOR[level],
      border: `1px solid ${LEVEL_COLOR[level]}44`,
    }}>
      {LEVEL_LABEL[level] || level}
    </span>
  );
}

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
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetPwMsg, setResetPwMsg] = useState('');

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

  async function handleResetPassword() {
    if (!selected || newPassword.length < 6) {
      setResetPwMsg('❌ Mínimo 6 caracteres');
      return;
    }
    try {
      await customersApi.resetPassword(selected.id, newPassword);
      setResetPwMsg(`✅ Contraseña actualizada para ${selected.email}`);
      setNewPassword('');
      setTimeout(() => { setResetPwMsg(''); setShowResetPw(false); }, 2000);
    } catch (err) {
      setResetPwMsg('❌ ' + (err.response?.data?.error || 'Error'));
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
    <div style={{ maxWidth: 1100 }}>
      <style>{`
        .cust-table { display: none; }
        .cust-cards { display: flex; flex-direction: column; gap: 10px; }
        @media (min-width: 700px) {
          .cust-table { display: block; }
          .cust-cards { display: none; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111', margin: 0 }}>Clientes ({total})</h1>
        <button onClick={handleExport}
          style={{ padding: '9px 16px', background: '#1f2937', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          📥 Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Buscar por nombre o email..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
        <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }}
          style={{ padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Todos los niveles</option>
          <option value="BRONZE">Bronce</option>
          <option value="SILVER">Plata</option>
          <option value="GOLD">Oro</option>
        </select>
      </div>

      {/* DESKTOP TABLE */}
      <div className="cust-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>Cliente</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#555' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#555' }}>Puntos</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#555' }}>Nivel</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#555' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#bbb', fontSize: 13 }}>Cargando...</td></tr>
              )}
              {!loading && customers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f9f9f9', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,200,66,.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{c.firstName} {c.lastName}</td>
                  <td style={{ padding: '12px 16px', color: '#888' }}>{c.email}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{c.availablePoints.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}><LevelBadge level={c.level} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => setSelected(c)}
                        style={{ fontSize: 11, padding: '5px 10px', background: 'rgba(245,200,66,.14)', color: '#8A6205', border: '1px solid rgba(245,200,66,.4)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                        Ajustar
                      </button>
                      <button onClick={() => handlePush(c.id)}
                        style={{ fontSize: 11, padding: '5px 10px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                        Push 🍎
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#bbb', fontSize: 13 }}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
      </div>

      {/* MOBILE CARDS */}
      <div className="cust-cards">
        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>Cargando...</div>
        )}
        {!loading && customers.map(c => (
          <div key={c.id} style={{
            background: '#fff', borderRadius: 14, padding: '14px 16px',
            boxShadow: '0 1px 6px rgba(0,0,0,.06)', border: '1px solid #f0f0f0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111', margin: 0 }}>{c.firstName} {c.lastName}</p>
                <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>{c.email}</p>
              </div>
              <LevelBadge level={c.level} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#888' }}>
                <strong style={{ fontSize: 18, fontWeight: 900, color: '#111' }}>{c.availablePoints.toLocaleString()}</strong> pts disponibles
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSelected(c)}
                  style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(245,200,66,.14)', color: '#8A6205', border: '1px solid rgba(245,200,66,.4)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                  Ajustar
                </button>
                <button onClick={() => handlePush(c.id)}
                  style={{ fontSize: 11, padding: '6px 12px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                  Push
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && customers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>Sin resultados</div>
        )}
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
      </div>

      {/* MODAL */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Ajuste de Puntos</h3>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 18px' }}>{selected.firstName} {selected.lastName} · {selected.availablePoints} pts actuales</p>

            <input type="number" placeholder="Puntos (+ agregar, − quitar)"
              value={adjustForm.points} onChange={e => setAdjustForm({ ...adjustForm, points: e.target.value })}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />

            <input type="text" placeholder="Descripción (opcional)"
              value={adjustForm.description} onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, marginBottom: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />

            {adjustMsg && <p style={{ fontSize: 13, marginBottom: 10 }}>{adjustMsg}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSelected(null)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#f5f5f5', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleAdjust}
                style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#F5C842', color: '#1B2F56', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                Aplicar
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '18px 0' }} />

            {!showResetPw ? (
              <button onClick={() => { setShowResetPw(true); setResetPwMsg(''); setNewPassword(''); }}
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'rgba(245,200,66,.14)', color: '#8A6205', border: '1px solid rgba(245,200,66,.4)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                🔑 Restablecer contraseña — cliente no puede entrar
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px' }}>
                  Nueva contraseña para {selected.email}. Compártela con el cliente para que inicie sesión.
                </p>
                <input type="text" placeholder="Nueva contraseña (mín. 6 caracteres)"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                {resetPwMsg && <p style={{ fontSize: 13, marginBottom: 10 }}>{resetPwMsg}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowResetPw(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#f5f5f5', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancelar
                  </button>
                  <button onClick={handleResetPassword}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#F5C842', color: '#1B2F56', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Guardar contraseña
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
