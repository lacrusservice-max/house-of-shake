import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week',  label: '7 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'all',   label: 'Todo' },
];

const ROLE_LABEL = { admin: '👑 Admin', staff: '👤 Staff' };
const ROLE_COLOR = { admin: '#8A6205', staff: '#555' };
const ROLE_BG    = { admin: 'rgba(245,200,66,.14)', staff: '#f5f5f5' };

export default function Personal() {
  const [staff, setStaff]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const token = localStorage.getItem('hos_admin_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [statsData, setStatsData]   = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('week');
  const [statsLoading, setStatsLoading] = useState(false);

  function loadStaffStats(period) {
    setStatsLoading(true);
    fetch(`${API}/admin/staff/stats?period=${period}`, { headers })
      .then(r => r.json())
      .then(d => { setStatsData(d); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }

  function loadStaff() {
    setLoading(true);
    fetch(`${API}/admin/staff`, { headers })
      .then(r => r.json())
      .then(d => { setStaff(d.staff || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadStaff();
    loadStaffStats('week');
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/admin/staff`, {
        method: 'POST', headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear');
      setSuccess(`Cuenta creada: ${data.user.email}`);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    if (user.permanent && user.active) {
      setError('Las cuentas permanentes no se pueden desactivar.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/staff/${user.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccess(`${user.email} ${!user.active ? 'activado' : 'desactivado'}`);
      loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user) {
    const pwd = prompt(`Nueva contraseña para ${user.email}:`);
    if (!pwd || pwd.length < 6) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/staff/${user.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccess(`Contraseña actualizada para ${user.email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#8A6205', textTransform: 'uppercase', marginBottom: 6 }}>Gestión de accesos</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111', margin: 0 }}>Personal</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Cuentas de acceso al sistema</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setSuccess(''); }} style={{
          padding: '10px 20px', background: '#F5C842', color: '#1B2F56',
          border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Nuevo usuario
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: 'rgba(224,92,92,.08)', border: '1px solid rgba(224,92,92,.25)', color: '#E05C5C', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#E05C5C', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ background: '#f0fff4', border: '1px solid #c3f0d4', color: '#1a7a40', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          ✓ {success}
          <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#1a7a40', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px', marginBottom: 24, border: '2px solid #F5C842' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 20 }}>Crear nueva cuenta</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={S.lbl}>Nombre completo *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Juan García" style={S.inp} />
              </div>
              <div>
                <label style={S.lbl}>Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="juan@houseofshake.com" style={S.inp} />
              </div>
              <div>
                <label style={S.lbl}>Contraseña *</label>
                <input required type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres" style={S.inp} />
              </div>
              <div>
                <label style={S.lbl}>Rol *</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ ...S.inp, cursor: 'pointer' }}>
                  <option value="staff">👤 Staff — Solo POS y fidelización</option>
                  <option value="admin">👑 Admin — Acceso total</option>
                </select>
              </div>
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#666', marginBottom: 16 }}>
              <strong>Staff:</strong> puede escanear QR, acumular y canjear puntos. No ve datos privados de clientes.<br/>
              <strong>Admin:</strong> acceso total al sistema: clientes, transacciones, finanzas, configuración.
            </div>
            {error && <div style={{ color: '#E05C5C', fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={{ padding: '10px 24px', background: '#F5C842', color: '#1B2F56', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Creando…' : 'Crear cuenta'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 14 }}>Cargando personal…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {staff.map(user => (
            <div key={user.id} style={{
              background: '#fff', borderRadius: 14, padding: '16px 20px',
              border: '1px solid #f0f0f0',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              opacity: user.active ? 1 : 0.5,
            }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: ROLE_BG[user.role], flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                {user.role === 'admin' ? '👑' : '👤'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{user.name}</span>
                  {user.permanent && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: '#2c9e5e', color: '#fff', borderRadius: 4, padding: '2px 6px', letterSpacing: 1 }}>PERMANENTE</span>
                  )}
                  {!user.active && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: '#f5f5f5', color: '#aaa', borderRadius: 4, padding: '2px 6px', letterSpacing: 1 }}>INACTIVO</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{user.email}</div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                  Último acceso: {user.lastLogin ? new Date(user.lastLogin).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                  {' · '}Creado: {new Date(user.createdAt).toLocaleDateString('es-MX')}
                </div>
              </div>

              {/* Role badge */}
              <div style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: ROLE_BG[user.role], color: ROLE_COLOR[user.role],
              }}>
                {ROLE_LABEL[user.role]}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => resetPassword(user)} style={S.actionBtn} title="Cambiar contraseña">
                  🔑
                </button>
                <button
                  onClick={() => toggleActive(user)}
                  disabled={user.permanent && user.active}
                  title={user.permanent && user.active ? 'Cuenta permanente' : user.active ? 'Desactivar' : 'Activar'}
                  style={{
                    ...S.actionBtn,
                    background: user.active ? 'rgba(245,200,66,.14)' : '#f0fff4',
                    color: user.active ? '#8A6205' : '#2c9e5e',
                    opacity: user.permanent && user.active ? 0.4 : 1,
                    cursor: user.permanent && user.active ? 'not-allowed' : 'pointer',
                  }}>
                  {user.active ? '⏸' : '▶'}
                </button>
              </div>
            </div>
          ))}

          {staff.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#bbb', fontSize: 14 }}>
              No hay usuarios registrados.
            </div>
          )}
        </div>
      )}

      {/* Staff activity stats */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginTop: 28, border: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#111', margin: 0 }}>Actividad del personal</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => { setStatsPeriod(p.value); loadStaffStats(p.value); }} style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                background: statsPeriod === p.value ? '#F5C842' : '#f5f5f5',
                color: statsPeriod === p.value ? '#1B2F56' : '#555',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {statsLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#aaa', fontSize: 13 }}>Cargando estadísticas…</div>
        ) : !statsData?.stats?.length ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#ccc', fontSize: 13 }}>Sin actividad en este período</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f5f5f5' }}>
                  {['Empleado', 'Acumulaciones', 'Canjes', 'Pts otorgados', 'Pts canjeados', 'Ingresos', 'Última acción'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statsData.stats.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontWeight: 600, color: '#333' }}>{s.email}</span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: '#f0fff4', color: '#2c9e5e', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{s.earnCount}</span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: '#fff8f0', color: '#e8a020', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{s.redeemCount}</span>
                    </td>
                    <td style={{ padding: '10px 10px', color: '#2c9e5e', fontWeight: 700 }}>+{s.ptsEarned.toLocaleString()}</td>
                    <td style={{ padding: '10px 10px', color: '#e8a020', fontWeight: 700 }}>-{s.ptsRedeemed.toLocaleString()}</td>
                    <td style={{ padding: '10px 10px', color: '#8A6205', fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(s.amountMxn)}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#aaa', fontSize: 11 }}>
                      {s.lastAction ? new Date(s.lastAction).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: '#bbb' }}>
          * Si un empleado suma más de 500 pts en menos de 1 hora, se recomienda revisar manualmente.
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: '#f8f8f8', borderRadius: 14, padding: '16px 20px', marginTop: 24, fontSize: 12, color: '#777' }}>
        <strong style={{ color: '#555' }}>🔐 Accesos del sistema:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
          <li><strong>Admin</strong> → <code>/admin/login</code> — Acceso al panel completo</li>
          <li><strong>Staff</strong> → <code>/staff</code> — Solo POS de fidelización</li>
          <li>Las cuentas <span style={{ background: '#2c9e5e', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>PERMANENTES</span> no se pueden eliminar ni desactivar</li>
        </ul>
      </div>
    </div>
  );
}

const S = {
  lbl: {
    display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    color: '#999', textTransform: 'uppercase', marginBottom: 6,
  },
  inp: {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid #eee', outline: 'none', fontSize: 13,
    fontFamily: 'inherit', background: '#fafafa', color: '#111',
    boxSizing: 'border-box', transition: 'border-color .2s',
  },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8, border: 'none',
    background: '#f5f5f5', cursor: 'pointer', fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background .15s',
  },
};
