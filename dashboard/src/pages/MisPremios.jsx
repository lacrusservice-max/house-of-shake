import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';
import { GiftIcon, CheckIcon, CoffeeIcon } from '../components/Icons';
import { fmtPinos, rewardStatus, pinosDeProducto } from '../lib/pinos';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BLUE    = '#0F448B';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(15,68,139,.5)';
const BORDER  = 'rgba(15,68,139,.12)';
const BG_SOFT = 'rgba(15,68,139,.04)';
const GREEN   = '#1C9A5B';

const CAT_LABEL = {
  'cold-coffees': 'Cold Coffees', 'cold-brew': 'Cold Brew', matcha: 'Matcha',
  fitfresh: 'Fitfresh', chai: 'Chai', milkshakes: 'Milkshakes',
  reposteria: 'Repostería', alimentos: 'Alimentos',
  bebida: 'Bebidas', especiales: 'Especiales',
};
const catLabel = (c) => CAT_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : 'Otros');

// Categorías que cuentan como bebida — el cliente pregunta "¿me alcanza para
// una bebida?", no "¿me alcanza para un cold-brew?".
const DRINK_CATS = new Set(['cold-coffees', 'cold-brew', 'matcha', 'fitfresh', 'chai', 'milkshakes', 'bebida', 'especiales']);
const esBebida = (p) => DRINK_CATS.has(String(p.category || '').toLowerCase());

export default function MisPremios() {
  const [customer, setCustomer] = useState(() => JSON.parse(localStorage.getItem('hos_customer') || 'null'));
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState('all');
  const navigate = useNavigate();

  const token = localStorage.getItem('hos_customer_token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    window.scrollTo(0, 0);

    Promise.all([
      fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.status === 401 ? null : r.json())),
      fetch(`${API}/products`).then(r => r.json()),
    ])
      .then(([me, prods]) => {
        if (!me) {
          localStorage.removeItem('hos_customer_token');
          navigate('/login');
          return;
        }
        setCustomer(me.customer);
        localStorage.setItem('hos_customer', JSON.stringify(me.customer));
        setProducts(Array.isArray(prods) ? prods : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saldoPuntos = customer?.availablePoints || 0;
  const reward = useMemo(
    () => customer?.reward || rewardStatus(saldoPuntos, products),
    [customer, products, saldoPuntos]
  );

  // Cada producto con su costo y si el cliente ya lo alcanza.
  const items = useMemo(() => {
    const saldo = reward.balance;
    return products
      .map(p => {
        const costo = pinosDeProducto(p);
        return { ...p, costo, alcanza: costo <= saldo, faltan: Math.max(0, Math.round((costo - saldo) * 10) / 10) };
      })
      // Primero lo que ya puede llevarse, y dentro de cada grupo lo más barato.
      .sort((a, b) => (a.alcanza === b.alcanza ? a.costo - b.costo : a.alcanza ? -1 : 1));
  }, [products, reward.balance]);

  const disponibles = items.filter(i => i.alcanza);
  const bebidasDisponibles = disponibles.filter(esBebida);
  const comidaDisponible   = disponibles.filter(p => !esBebida(p));

  const categorias = useMemo(() => {
    const orden = ['cold-coffees', 'cold-brew', 'matcha', 'fitfresh', 'chai', 'milkshakes', 'reposteria', 'alimentos'];
    const presentes = [...new Set(items.map(i => i.category).filter(Boolean))];
    return presentes.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
  }, [items]);

  const mostrados = filtro === 'all'
    ? items
    : filtro === 'disponibles'
      ? disponibles
      : items.filter(i => i.category === filtro);

  if (loading) {
    return (
      <div className="mc-root" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: MUTED, fontSize: 14 }}>Cargando tus premios…</p>
      </div>
    );
  }
  if (!customer) return null;

  return (
    <div className="mc-root" style={{ minHeight: '100vh', background: WHITE }}>

      {/* ── NAV ── */}
      <nav className="mc-nav">
        <div className="mc-nav-left">
          <Link to="/mi-cuenta" style={{
            color: BLUE, textDecoration: 'none', fontSize: 11, fontWeight: 800,
            letterSpacing: 1.5, textTransform: 'uppercase',
          }}>
            ← Mi cuenta
          </Link>
        </div>
        <Link to="/" className="mc-nav-brand">
          <img src="/logo-encabezado.png" alt="House of Shake" className="mc-nav-logo-img" />
        </Link>
        <div className="mc-nav-right" />
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* ── RESUMEN ── */}
        <div style={{
          background: reward.hasReward
            ? 'linear-gradient(135deg, rgba(15,68,139,.07), rgba(26,91,181,.04))'
            : BG_SOFT,
          border: `1.5px solid ${reward.hasReward ? BLUE : BORDER}`,
          borderRadius: 20, padding: '26px 24px', marginBottom: 22, textAlign: 'center',
        }}>
          <p style={{ fontSize: 10, letterSpacing: 2.5, color: MUTED, textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>
            Tus Pinos para canjear
          </p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 68, color: BLUE, margin: '2px 0 0', lineHeight: 1 }}>
            {fmtPinos(saldoPuntos)}
          </p>

          {reward.hasReward ? (
            <>
              <p style={{ fontSize: 16, fontWeight: 900, color: BLUE, margin: '10px 0 0', lineHeight: 1.35 }}>
                🎉 Te alcanza para {reward.redeemableCount} producto{reward.redeemableCount === 1 ? '' : 's'} gratis
              </p>

              {/* Desglose: bebida vs alimento — es lo que el cliente pregunta */}
              <div style={{
                display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12,
              }}>
                {bebidasDisponibles.length > 0 && (
                  <span style={pill(GREEN)}>
                    ☕ {bebidasDisponibles.length} bebida{bebidasDisponibles.length === 1 ? '' : 's'} a tu alcance
                  </span>
                )}
                {comidaDisponible.length > 0 && (
                  <span style={pill(BLUE)}>
                    🥐 {comidaDisponible.length} alimento{comidaDisponible.length === 1 ? '' : 's'} a tu alcance
                  </span>
                )}
              </div>

              <p style={{ fontSize: 12.5, color: MUTED, margin: '14px 0 0', lineHeight: 1.55 }}>
                Muestra tu <strong style={{ color: BLUE }}>QR al staff</strong> y pide lo que quieras de esta lista.<br />
                Tus Pinos se descuentan solo cuando canjeas.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 800, color: BLUE, margin: '10px 0 0' }}>
                Te faltan {reward.pinosToNextGoal} Pinos para tu primer premio
              </p>
              <div style={{
                height: 8, borderRadius: 99, background: 'rgba(15,68,139,.1)',
                margin: '14px auto 0', maxWidth: 320, overflow: 'hidden',
              }}>
                <div style={{ height: '100%', width: `${reward.progressPct}%`, background: BLUE, borderRadius: 99, transition: 'width .4s ease' }} />
              </div>
              <p style={{ fontSize: 12, color: MUTED, margin: '8px 0 0' }}>
                Gasta ${Math.ceil(reward.pinosToNextGoal * 10)} MXN más para llegar
              </p>
            </>
          )}
        </div>

        {/* ── TARIFAS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10, marginBottom: 22,
        }}>
          {[
            { label: 'Repostería', cost: 100 },
            { label: 'Cafés y bebidas', cost: 110 },
            { label: 'Milkshakes y alimentos', cost: 120 },
          ].map(t => {
            const listo = reward.balance >= t.cost;
            return (
              <div key={t.cost} style={{
                background: listo ? 'rgba(28,154,91,.07)' : BG_SOFT,
                border: `1px solid ${listo ? 'rgba(28,154,91,.3)' : BORDER}`,
                borderRadius: 14, padding: '13px 15px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 10.5, color: MUTED, margin: 0, fontWeight: 700, letterSpacing: .5 }}>{t.label}</p>
                <p style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, lineHeight: 1,
                  color: listo ? GREEN : BLUE, margin: '4px 0 0',
                }}>
                  {t.cost} <span style={{ fontSize: 13 }}>Pinos</span>
                </p>
                {listo && (
                  <p style={{ fontSize: 10, color: GREEN, fontWeight: 800, margin: '3px 0 0', letterSpacing: .5 }}>
                    ✓ A TU ALCANCE
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* ── FILTROS ── */}
        <div style={{
          display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 10, marginBottom: 14,
          WebkitOverflowScrolling: 'touch',
        }}>
          {[
            { id: 'all', label: `Todo (${items.length})` },
            ...(disponibles.length ? [{ id: 'disponibles', label: `✓ A mi alcance (${disponibles.length})` }] : []),
            ...categorias.map(c => ({ id: c, label: catLabel(c) })),
          ].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)} style={{
              flexShrink: 0, padding: '8px 15px', borderRadius: 20, cursor: 'pointer',
              fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
              background: filtro === f.id ? BLUE : 'rgba(15,68,139,.05)',
              color: filtro === f.id ? WHITE : MUTED,
              border: `1px solid ${filtro === f.id ? BLUE : BORDER}`,
              transition: 'background .15s, color .15s',
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* ── CATÁLOGO ── */}
        {/* minmax 152px ⇒ 2 columnas en móvil (una sola dejaba tarjetas enormes
            y obligaba a scrollear medio menú para comparar) */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(152px, 1fr))', gap: 12,
        }}>
          {mostrados.map(p => <PremioCard key={p.id} item={p} />)}
        </div>

        {mostrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED }}>
            <GiftIcon size={44} color={BLUE} />
            <p style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>No hay productos en esta categoría</p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <Link to="/mi-cuenta" style={{
            display: 'inline-block', padding: '14px 30px', borderRadius: 12,
            background: BLUE, color: WHITE, textDecoration: 'none',
            fontWeight: 800, fontSize: 12.5, letterSpacing: 1.5, textTransform: 'uppercase',
          }}>
            Ver mi QR para canjear →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Tarjeta de premio ─── */
function PremioCard({ item }) {
  const [imgError, setImgError] = useState(false);
  const { alcanza, costo, faltan } = item;

  return (
    <div style={{
      background: WHITE,
      border: `1.5px solid ${alcanza ? 'rgba(28,154,91,.35)' : BORDER}`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: alcanza ? '0 4px 18px rgba(28,154,91,.12)' : '0 1px 6px rgba(15,68,139,.05)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Imagen */}
      <div style={{ position: 'relative', height: 150, background: BG_SOFT, overflow: 'hidden' }}>
        {item.imageUrl && !imgError ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: '100%',
              // `contain`, no `cover`: las fotos son cuadradas (1000×1000) con el
              // producto centrado, y recortarlas dejaba fuera la mitad del vaso.
              // Aquí el cliente elige qué pedir, así que debe verlo completo.
              objectFit: 'contain',
              padding: 8, boxSizing: 'border-box',
              // Los bloqueados se ven apagados pero NUNCA invisibles: con
              // opacity .45 sobre fondo claro el producto desaparecía y el
              // cliente no podía ver qué está por desbloquear.
              filter: alcanza ? 'none' : 'grayscale(.85) opacity(.8)',
              transition: 'filter .25s',
            }}
          />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <CoffeeIcon size={38} color={BLUE} opacity={alcanza ? 0.5 : 0.2} />
          </div>
        )}

        <div style={{
          position: 'absolute', top: 9, right: 9,
          background: alcanza ? GREEN : 'rgba(15,68,139,.75)',
          color: WHITE, borderRadius: 20, padding: '4px 11px',
          fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 4,
          backdropFilter: 'blur(6px)',
        }}>
          {costo} <span style={{ fontSize: 9, opacity: .85 }}>PINOS</span>
        </div>

        {alcanza && (
          <div style={{
            position: 'absolute', top: 9, left: 9,
            background: GREEN, color: WHITE, borderRadius: 20,
            width: 24, height: 24, display: 'grid', placeItems: 'center',
          }}>
            <CheckIcon size={13} color={WHITE} />
          </div>
        )}
      </div>

      {/* Datos */}
      <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p style={{
          fontSize: 13.5, fontWeight: 800, color: BLUE, margin: 0, lineHeight: 1.3,
        }}>
          {item.name}
        </p>
        <p style={{ fontSize: 11, color: MUTED, margin: '3px 0 0' }}>
          {catLabel(item.category)} · ${item.price} MXN
        </p>

        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          {alcanza ? (
            <div style={{
              background: 'rgba(28,154,91,.1)', border: '1px solid rgba(28,154,91,.28)',
              borderRadius: 9, padding: '7px 10px', textAlign: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: GREEN, letterSpacing: .3, whiteSpace: 'nowrap' }}>
                ✓ PÍDELO GRATIS
              </span>
            </div>
          ) : (
            <div style={{
              background: BG_SOFT, border: `1px solid ${BORDER}`,
              borderRadius: 9, padding: '7px 10px', textAlign: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>
                Te faltan {faltan} Pinos
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pill = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: `${color}14`, border: `1px solid ${color}44`, color,
  borderRadius: 100, padding: '6px 13px', fontSize: 11.5, fontWeight: 800,
});
