import { useState, useEffect } from 'react';
import { configApi } from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('hos_admin_token')}`,
  'Content-Type': 'application/json',
});

export default function Config() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  // Licencia de servicio: solo se administra desde aquí.
  const [lic, setLic] = useState(null);
  const [licMsg, setLicMsg] = useState('');
  const [licBusy, setLicBusy] = useState(false);

  const cargarLicencia = () =>
    fetch(`${API}/admin/license`, { headers: authHeaders() })
      .then(r => r.json()).then(setLic).catch(() => {});

  async function renovar(dias) {
    setLicBusy(true); setLicMsg('');
    try {
      const r = await fetch(`${API}/admin/license/renew`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ days: dias }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo renovar');
      setLic(d);
      setLicMsg(`Renovada ${dias} días ✓`);
    } catch (e) { setLicMsg(e.message); }
    setLicBusy(false);
  }

  async function fijarLicencia(until) {
    setLicBusy(true); setLicMsg('');
    try {
      const r = await fetch(`${API}/admin/license`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ until }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      setLic(d);
      setLicMsg(until === null ? 'Sin límite ✓' : 'Fecha guardada ✓');
    } catch (e) { setLicMsg(e.message); }
    setLicBusy(false);
  }

  useEffect(() => {
    configApi.get().then(({ data }) => {
      setConfig(data.config);
      setForm(data.config);
    });
    cargarLicencia();
  }, []);

  async function handleSave() {
    setLoading(true);
    setMsg('');
    try {
      await configApi.update({
        pointsPerDollar: parseFloat(form.pointsPerDollar),
        pointsToRedeem: parseInt(form.pointsToRedeem),
        redeemValueUsd: parseFloat(form.redeemValueUsd),
        welcomeBonus: parseInt(form.welcomeBonus),
        expiryMonths: parseInt(form.expiryMonths),
        silverThreshold: parseInt(form.silverThreshold),
        goldThreshold: parseInt(form.goldThreshold),
        silverBonusPercent: parseFloat(form.silverBonusPercent),
        goldBonusPercent: parseFloat(form.goldBonusPercent),
      });
      setMsg('✅ Configuración guardada correctamente');
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error al guardar'));
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { key: 'pointsPerDollar', label: 'Puntos por dólar gastado', type: 'number', step: '0.1', hint: 'Ej: 1 = 1 punto por $1 USD' },
    { key: 'pointsToRedeem', label: 'Puntos necesarios para canjear', type: 'number', hint: 'Ej: 100 puntos para obtener descuento' },
    { key: 'redeemValueUsd', label: 'Valor del canje (USD)', type: 'number', step: '0.5', hint: 'Ej: 5 = $5 USD de descuento por canje' },
    { key: 'welcomeBonus', label: 'Bonus de bienvenida (puntos)', type: 'number', hint: 'Puntos al registrar nuevo cliente' },
    { key: 'expiryMonths', label: 'Expiración de puntos (meses)', type: 'number', hint: 'Meses antes de que expiren los puntos' },
    { key: 'silverThreshold', label: 'Umbral nivel Plata (puntos totales)', type: 'number' },
    { key: 'goldThreshold', label: 'Umbral nivel Oro (puntos totales)', type: 'number' },
    { key: 'silverBonusPercent', label: 'Bonus extra nivel Plata (%)', type: 'number', step: '1' },
    { key: 'goldBonusPercent', label: 'Bonus extra nivel Oro (%)', type: 'number', step: '1' },
  ];

  if (!config) return <div className="text-center py-12 text-gray-400">Cargando configuración...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h1>

      {/* ── LICENCIA DE SERVICIO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border-2"
           style={{ borderColor: lic ? (lic.active ? (lic.expiringSoon ? '#F5A623' : '#1C9A5B') : '#E05C5C') : '#e5e7eb' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Licencia de servicio</h2>
            <p className="text-sm text-gray-500 mt-1">
              Al vencer, la caja, la cuenta del cliente y el pass de Apple Wallet quedan
              suspendidos. No se borra ningún dato: los Pinos reaparecen al renovar.
            </p>
          </div>
          {lic && (
            <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                  style={{
                    background: lic.active ? (lic.expiringSoon ? '#FEF3C7' : '#DCFCE7') : '#FEE2E2',
                    color:      lic.active ? (lic.expiringSoon ? '#92400E' : '#166534') : '#991B1B',
                  }}>
              {!lic.active ? 'SUSPENDIDO'
                : lic.unlimited ? 'SIN LÍMITE'
                : `${lic.daysLeft} día${lic.daysLeft === 1 ? '' : 's'}`}
            </span>
          )}
        </div>

        {lic && !lic.unlimited && (
          <p className="text-sm text-gray-600 mb-4">
            {lic.active ? 'Vigente hasta' : 'Venció el'}{' '}
            <strong>{new Date(lic.until).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</strong>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {[6, 15, 30, 90].map(d => (
            <button key={d} onClick={() => renovar(d)} disabled={licBusy}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#0F448B' }}>
              +{d} días
            </button>
          ))}
          <button onClick={() => fijarLicencia(null)} disabled={licBusy}
            className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-300 text-gray-700 disabled:opacity-50">
            Sin límite
          </button>
          <button onClick={() => fijarLicencia(new Date().toISOString())} disabled={licBusy}
            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#FEE2E2', color: '#991B1B' }}>
            Suspender ahora
          </button>
        </div>

        {licMsg && <p className="text-sm mt-3 font-semibold" style={{ color: '#0F448B' }}>{licMsg}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{f.label}</label>
            <input
              type={f.type}
              step={f.step}
              value={form[f.key] ?? ''}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]"
            />
            {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
          </div>
        ))}

        {msg && <p className="text-sm font-medium">{msg}</p>}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 bg-[#F5C842] hover:bg-[#D9A62B] text-[#1B2F56] font-bold rounded-xl transition-colors disabled:opacity-60"
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <h3 className="font-semibold text-amber-800 mb-2">📋 Resumen actual</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• {form.pointsPerDollar} punto(s) por cada $1 USD</li>
          <li>• {form.pointsToRedeem} puntos = ${form.redeemValueUsd} USD de descuento</li>
          <li>• Bienvenida: {form.welcomeBonus} puntos</li>
          <li>• Los puntos expiran en {form.expiryMonths} meses</li>
          <li>• Plata desde {form.silverThreshold} pts (+{form.silverBonusPercent}% bonus)</li>
          <li>• Oro desde {form.goldThreshold} pts (+{form.goldBonusPercent}% bonus)</li>
        </ul>
      </div>
    </div>
  );
}
