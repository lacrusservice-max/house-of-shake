import { useState, useEffect } from 'react';
import { configApi } from '../services/api';

export default function Config() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    configApi.get().then(({ data }) => {
      setConfig(data.config);
      setForm(data.config);
    });
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

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{f.label}</label>
            <input
              type={f.type}
              step={f.step}
              value={form[f.key] ?? ''}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
          </div>
        ))}

        {msg && <p className="text-sm font-medium">{msg}</p>}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
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
