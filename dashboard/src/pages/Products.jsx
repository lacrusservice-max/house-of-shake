import { useState, useEffect } from 'react';
import api from '../services/api';

const CATEGORIES = ['café', 'frío', 'especiales', 'alimentos'];
const CATEGORY_LABELS = {
  café: '☕ Cafés Calientes',
  frío: '🧊 Bebidas Frías',
  especiales: '✨ Especiales',
  alimentos: '🥐 Alimentos',
};

const EMPTY_FORM = { name: '', description: '', price: '', pointsValue: '', category: 'café', sortOrder: '0', active: true };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/products');
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p.id);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), pointsValue: String(p.pointsValue), category: p.category, sortOrder: String(p.sortOrder || 0), active: p.active });
    setError('');
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form, price: parseFloat(form.price), pointsValue: parseInt(form.pointsValue), sortOrder: parseInt(form.sortOrder) };
      if (editing) {
        await api.put(`/admin/products/${editing}`, payload);
      } else {
        await api.post('/admin/products', payload);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Desactivar este producto?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      await load();
    } catch {
      alert('Error al eliminar');
    }
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = products.filter(p => p.category === cat);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menú / Productos</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona los productos y sus puntos por compra</p>
        </div>
        <button onClick={openCreate}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition">
          + Agregar producto
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map(cat => {
            const items = grouped[cat];
            if (!items?.length) return null;
            return (
              <div key={cat}>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">{CATEGORY_LABELS[cat] || cat}</h2>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Puntos</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{p.name}</p>
                            {p.description && <p className="text-gray-400 text-xs mt-0.5">{p.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 font-semibold">${p.price} MXN</td>
                          <td className="px-4 py-3 text-right">
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">+{p.pointsValue} pts</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {p.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => openEdit(p)}
                                className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">
                                Editar
                              </button>
                              {p.active && (
                                <button onClick={() => handleDelete(p.id)}
                                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition">
                                  Desactivar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🍵</p>
              <p>No hay productos aún. ¡Agrega el primero!</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio MXN *</label>
                  <input required type="number" min="0" step="0.01" value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puntos *</label>
                  <input required type="number" min="0" value={form.pointsValue}
                    onChange={e => setForm(p => ({ ...p, pointsValue: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input type="number" min="0" value={form.sortOrder}
                    onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                    className="rounded" />
                  Producto activo
                </label>
              )}
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
