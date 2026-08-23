import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/mi-cuenta.css';
import { CoffeeIcon, GiftIcon, StarIcon, CakeIcon, LightningIcon, SearchIcon, WarningIcon, CheckIcon } from '../components/Icons';
import { fmtPinos, pinosEnteros, rewardStatus } from '../lib/pinos';
import ServicioSuspendido from '../components/ServicioSuspendido';

const QRScanner = lazy(() => import('../components/QRScanner'));

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Costo de canje: fijo por categoría (100 / 110 / 120 Pinos), no por precio.
const pinosDe = (pointsValue = 0) => Math.round(pointsValue / 10);

const CAT_LABEL = {
  'bebida': 'Bebidas', 'bebidas': 'Bebidas', 'cold-coffees': 'Cold Coffees',
  'cold-brew': 'Cold Brew', 'matcha': 'Matcha', 'fitfresh': 'Fitfresh',
  'chai': 'Chai', 'milkshakes': 'Milkshakes', 'reposteria': 'Repostería',
  'alimentos': 'Alimentos', 'especiales': 'Especiales',
};
const catLabel = (c) => CAT_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : 'Otros');

// Progreso del cliente. El saldo ES el progreso: no hay ciclos ni módulos.
//
// Se apoya en el rewardStatus que calcula el backend. Cuando no viene (p. ej.
// en los resultados de búsqueda, que traen solo el saldo), se recalcula con la
// misma fórmula en vez de improvisar otra: antes, sin `reward`, cualquiera con
// premio disponible colapsaba a "100" y con saldo múltiplo exacto de la meta el
// progreso aparecía en 0.
function calcPines(availablePoints = 0, lifetimePoints = 0, reward = null) {
  const r = reward || rewardStatus(availablePoints, []);
  const availPines   = pinosEnteros(availablePoints);
  const meta         = r.cheapestCost || 100;
  const cardComplete = r.hasReward;
  const pinesLeft    = r.pinosToNextGoal;
  // Lo que lleva avanzado del SIGUIENTE premio, con su decimal intacto.
  const pinesInCycle = Math.max(0, Math.round((meta - pinesLeft) * 10) / 10);
  const totalPines   = pinosEnteros(lifetimePoints);
  // Etiquetas con decimales: una compra de $65 da 6.5 Pinos, no 6.
  const availLabel   = fmtPinos(availablePoints);
  const totalLabel   = fmtPinos(lifetimePoints);
  return { availPines, pinesInCycle, cardComplete, pinesLeft, totalPines, availLabel, totalLabel, meta,
           redeemableCount: r.redeemableCount, progressPct: r.progressPct };
}

export default function Staff() {
  const navigate = useNavigate();
  const token = localStorage.getItem('hos_staff_token') || localStorage.getItem('hos_admin_token') || '';
  if (!token) { navigate('/login'); return null; }
  function handleLogout() {
    localStorage.removeItem('hos_staff_token');
    localStorage.removeItem('hos_admin_token');
    navigate('/login');
  }
  return <POSView token={token} onLogout={handleLogout} />;
}

function POSView({ token, onLogout }) {
  const [screen, setScreen]         = useState('home');
  const [searchMode, setSearchMode] = useState('qr');
  const [codeInput, setCodeInput]   = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput]   = useState('');
  const [nameResults, setNameResults] = useState([]);
  const [customer, setCustomer]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [notice, setNotice]         = useState('');
  // El backend responde 402 cuando la licencia del servicio venció.
  const [suspended, setSuspended]   = useState(false);
  const [amount, setAmount]         = useState('');
  // Carrito del cobro por producto: el barista arma la venta desde el catálogo
  // y el backend recalcula el precio desde la base.
  const [carrito, setCarrito]       = useState([]);
  const [ventaBusca, setVentaBusca] = useState('');
  // 'producto' = elige del catálogo · 'monto' = teclea el importe exacto
  const [modoCobro, setModoCobro]   = useState('producto');
  const [result, setResult]         = useState(null);
  const [quickReg, setQuickReg]     = useState({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
  const [products, setProducts]     = useState([]);
  const [pickedProduct, setPickedProduct] = useState(null);
  const [catFilter, setCatFilter]   = useState('all');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Menú completo con su costo en Pinos — el staff siempre lo tiene a la mano
  useEffect(() => {
    fetch(`${API}/products`)
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function handleRedeemProduct(override = null) {
    // `onClick={handleRedeemProduct}` le pasa el EVENTO del clic como primer
    // argumento. Sin este filtro, el evento se tomaba por producto, se enviaba
    // productId: undefined y el backend respondía "productId requerido": el
    // canje fallaba y al cliente no se le descontaba nada.
    const esProducto = override && typeof override === 'object' && typeof override.id === 'string';
    const target = esProducto ? override : pickedProduct;
    if (!target?.id) {
      setError('Elige el producto que vas a canjear.');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/redeem-product`, {
        method: 'POST', headers,
        body: JSON.stringify({ productId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al canjear');
      setResult({ type: 'redeemProduct', customerName: customer.firstName, ...data });
      setCustomer(c => ({ ...c, availablePoints: data.newAvailablePoints }));
      setPickedProduct(null);
      setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function extractCode(raw) {
    const uuid = raw?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return uuid ? uuid[0] : raw?.trim();
  }

  async function lookupByCode(code) {
    if (!code?.trim() || loading) return;
    const cleanCode = extractCode(code);
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${encodeURIComponent(cleanCode)}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
        if (res.status === 404) throw new Error(`NOTFOUND:${cleanCode}`);
        throw new Error(data.error || 'Error al buscar cliente');
      }
      setCustomer(data.customer || data);
      setScreen('customer');
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Sin conexión al servidor.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  // Acepta email o número de socio: el endpoint del POS resuelve ambos y ya
  // devuelve la ficha completa (Pinos, productos canjeables, movimientos).
  async function lookupByEmail(term) {
    if (!term?.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${encodeURIComponent(term.trim())}`, { headers });
      if (res.status === 402) { setSuspended(true); return; }
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) throw new Error('No se encontró ningún cliente con ese dato. ¿Ya se registró?');
        throw new Error(data.error || 'Error');
      }
      setCustomer(data);
      setScreen('customer');
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Sin conexión.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchByName(q) {
    setNameInput(q);
    if (q.trim().length < 2) { setNameResults([]); return; }
    try {
      const res = await fetch(`${API}/pos/search?q=${encodeURIComponent(q.trim())}`, { headers });
      const data = await res.json();
      setNameResults(data.customers || []);
    } catch { setNameResults([]); }
  }

  function agregarAlCarrito(prod) {
    setError('');
    setCarrito(c => {
      const yaEsta = c.find(i => i.id === prod.id);
      if (yaEsta) return c.map(i => i.id === prod.id ? { ...i, qty: Math.min(20, i.qty + 1) } : i);
      return [...c, { id: prod.id, name: prod.name, price: prod.price, qty: 1 }];
    });
  }

  function cambiarCantidad(id, delta) {
    setCarrito(c => c
      .map(i => i.id === id ? { ...i, qty: Math.max(0, Math.min(20, i.qty + delta)) } : i)
      .filter(i => i.qty > 0));
  }

  async function handleAddProducts() {
    if (!carrito.length) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/add-products`, {
        method: 'POST', headers,
        body: JSON.stringify({ items: carrito.map(i => ({ productId: i.id, qty: i.qty })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la venta');
      setResult({ type: 'earn', customerName: customer.firstName, ...data });
      setCustomer(c => ({ ...c, availablePoints: data.newAvailablePoints, reward: data.reward }));
      setCarrito([]); setVentaBusca(''); setModoCobro('producto');
      setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPoints(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/add-points`, {
        method: 'POST', headers,
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar Pinos');
      setResult({ type: 'earn', customerName: customer.firstName, ...data });
      setAmount(''); setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeemDrink() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/pos/customer/${customer.id}/redeem-drink`, {
        method: 'POST', headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al canjear');
      setResult({ type: 'redeemDrink', customerName: customer.firstName, ...data });
      setScreen('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickRegister(e) {
    e.preventDefault();
    setQuickReg(q => ({ ...q, loading: true, error: '' }));
    try {
      const res = await fetch(`${API}/pos/quick-register`, {
        method: 'POST', headers,
        body: JSON.stringify({ firstName: quickReg.firstName, lastName: quickReg.lastName, email: quickReg.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');

      // Recarga la ficha por el POS para traer Pinos y catálogo de canje,
      // que el alta no devuelve.
      let full = data.customer;
      try {
        const posRes = await fetch(`${API}/pos/customer/${data.customer.id}`, { headers });
        if (posRes.ok) full = { ...full, ...(await posRes.json()) };
      } catch { /* la ficha básica basta para cobrar */ }

      setCustomer(full);
      setError('');
      setNotice(data.alreadyExisted ? data.message : `Cuenta creada — socio #${data.customer.memberNumber}`);
      setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
      setScreen('customer');
    } catch (err) {
      setQuickReg(q => ({ ...q, loading: false, error: err.message }));
    }
  }

  function reset() {
    setScreen('home'); setCustomer(null); setError(''); setResult(null); setNotice('');
    setCarrito([]); setVentaBusca('');
    setCodeInput(''); setEmailInput(''); setAmount('');
    setNameInput(''); setNameResults([]);
    setPickedProduct(null); setCatFilter('all');
    setQuickReg({ show: false, firstName: '', lastName: '', email: '', loading: false, error: '' });
  }

  const pines = customer ? calcPines(customer.availablePoints, customer.lifetimePoints, customer.reward) : null;
  const pinesPreview = amount && parseFloat(amount) > 0
    ? Math.round((parseFloat(amount) / 10) * 10) / 10
    : 0;

  // Pinos canjeables del cliente
  const availPinos = customer ? pinosEnteros(customer.availablePoints) : 0;
  const availPinosLabel = customer ? fmtPinos(customer.availablePoints) : '0';
  const totalVenta = carrito.reduce((t, i) => t + i.price * i.qty, 0);
  // Vista previa: misma regla que el backend (1 Pino por cada $10, con decimal)
  const pinosVenta = Math.round((totalVenta / 10) * (customer?.doublePointsActive ? 2 : 1) * 10) / 10;
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const shownProducts = (catFilter === 'all' ? products : products.filter(p => p.category === catFilter))
    .slice()
    .sort((a, b) => a.pointsValue - b.pointsValue);
  // Cuántos productos DISTINTOS puede elegir del menú.
  const affordableCount = products.filter(p => pinosDe(p.pointsValue) <= availPinos).length;
  // Cuántos premios puede LLEVARSE realmente. Con 243 Pinos podía elegir entre
  // 40 productos pero llevarse solo 2 — la caja decía "le alcanza para 40".
  const reward = customer?.reward || rewardStatus(customer?.availablePoints || 0, products);
  const puedeLlevar = reward.redeemableCount;

  if (suspended) return <ServicioSuspendido />;

  return (
    <div className="mc-root" style={{ minHeight: '100vh' }}>
      <nav className="mc-nav">
        <div className="mc-nav-left" />
        <Link to="/" className="mc-nav-brand">
          <img src="/logo-encabezado.png" alt="House of Shake" className="mc-nav-logo-img" />
        </Link>
        <div className="mc-nav-right">
          <button onClick={onLogout} className="mc-nav-logout" style={{
            background: '#0F448B', color: '#FFFFFF', padding: '8px 18px',
            borderRadius: 20, fontWeight: 700, fontSize: 12, letterSpacing: 1.5,
          }}>Salir</button>
        </div>
      </nav>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>

        {/* ── HOME ── */}
        {screen === 'home' && (
          <div>
            <div className="mc-eyebrow" style={{ marginBottom: 8 }}>Punto de venta</div>
            <h1 className="mc-heading" style={{ fontSize: 46, marginBottom: 6 }}>
              Cobrar <span>cliente</span>
            </h1>
            <p style={{ color: 'rgba(15,68,139,.55)', fontSize: 13, fontWeight: 600, marginBottom: 28 }}>
              Identifica al cliente antes de cobrar para acumular Pinos 🌲
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={() => { setSearchMode('qr'); setScreen('camera'); }} style={S.bigBtn('#0F448B', '#FFFFFF')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><SearchIcon size={28} color="#FFFFFF" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Escanear QR con cámara</div>
                  <div style={{ fontSize: 11, opacity: .7 }}>Apunta al código QR del cliente</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .5 }}>›</span>
              </button>

              <button onClick={() => { setSearchMode('email'); setScreen('searchEmail'); }} style={S.bigBtn('rgba(94,201,122,.12)', '#0F448B', '1px solid rgba(94,201,122,.25)')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><StarIcon size={28} color="#5EC97A" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Buscar por email</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>El cliente dice su correo</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>

              <button onClick={() => { setSearchMode('name'); setNameInput(''); setNameResults([]); setScreen('searchName'); }} style={S.bigBtn('rgba(74,159,212,.08)', '#0F448B', '1px solid rgba(74,159,212,.2)')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><SearchIcon size={28} color="#4a9fd4" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Buscar por nombre</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>El cliente no trae su teléfono</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>

              <button onClick={() => { setSearchMode('manual'); setScreen('searchManual'); }} style={S.bigBtn('rgba(15,68,139,.04)', '#0F448B', '1px solid rgba(15,68,139,.1)')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><CoffeeIcon size={28} color="rgba(15,68,139,.65)" /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Ingresar ID manual</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>Pega el código del QR</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
              </button>
            </div>

            {/* Consultar menú y costos en Pinos — sin necesidad de un cliente */}
            <button onClick={() => { setCatFilter('all'); setScreen('menu'); }} style={{
              ...S.bigBtn('rgba(15,68,139,.06)', '#0F448B', '1px solid rgba(15,68,139,.18)'),
              marginTop: 10,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32 }}><GiftIcon size={28} color="#0F448B" animated /></div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Ver menú y costos en Pinos</div>
                <div style={{ fontSize: 11, opacity: .55 }}>Consulta cuánto cuesta canjear cada producto</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 18, opacity: .4 }}>›</span>
            </button>
          </div>
        )}

        {/* ── MENÚ DE REFERENCIA (sin cliente) ── */}
        {screen === 'menu' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 4 }}>
              Menú y <span>Pinos</span>
            </h2>
            <p style={{ color: 'rgba(15,68,139,.6)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              1 Pino = $1 MXN · así se canjea cada producto
            </p>

            {categories.length > 1 && (
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
                {['all', ...categories].map(c => (
                  <button key={c} onClick={() => setCatFilter(c)} style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                    fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                    background: catFilter === c ? '#0F448B' : 'rgba(15,68,139,.04)',
                    color: catFilter === c ? '#FFFFFF' : 'rgba(15,68,139,.7)',
                    border: `1px solid ${catFilter === c ? '#0F448B' : 'rgba(15,68,139,.15)'}`,
                  }}>
                    {c === 'all' ? 'Todo el menú' : catLabel(c)}
                  </button>
                ))}
              </div>
            )}

            {products.length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(15,68,139,.45)', fontSize: 13, padding: '30px 0' }}>Cargando menú…</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shownProducts.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px', borderRadius: 14,
                  background: 'rgba(15,68,139,.04)', border: '1px solid rgba(15,68,139,.06)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#0F448B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(15,68,139,.55)', margin: '2px 0 0' }}>${p.price} MXN · {catLabel(p.category)}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#0F448B', margin: 0, lineHeight: 1 }}>{pinosDe(p.pointsValue)}</p>
                    <p style={{ fontSize: 9, color: 'rgba(15,68,139,.4)', margin: 0, letterSpacing: .5, fontWeight: 700 }}>PINOS</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CAMERA QR ── */}
        {screen === 'camera' && (() => {
          const isNotFound = error?.startsWith('NOTFOUND:');
          const scannedId  = isNotFound ? error.replace('NOTFOUND:', '') : null;
          return (
            <div>
              <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
              <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Escanear <span>QR</span></h2>

              {isNotFound && !quickReg.show && (
                <div style={{ ...S.err, marginBottom: 14 }}>
                  <p style={{ fontWeight: 800, marginBottom: 6, display:'flex', alignItems:'center', gap:6 }}><WarningIcon size={16} color="#E05C5C" /> Cliente no encontrado</p>
                  <p style={{ fontSize: 11, opacity: .8, marginBottom: 10 }}>
                    QR: <code style={{ background: 'rgba(224,92,92,.15)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }}>{scannedId?.substring(0, 16)}…</code>
                  </p>
                  <p style={{ fontSize: 12, opacity: .75, marginBottom: 12, lineHeight: 1.5 }}>
                    Regístralo ahora o pídele ir a: <strong>house-of-shake.vercel.app/registro</strong>
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setQuickReg(q => ({ ...q, show: true }))}
                      style={{ flex: 1, padding: '9px 12px', background: '#0F448B', border: 'none', borderRadius: 8, color: '#FFFFFF', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                      ✚ Registrar aquí
                    </button>
                    <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                      style={{ flex: 1, padding: '9px 12px', background: 'none', border: '1px solid rgba(224,92,92,.5)', borderRadius: 8, color: '#E05C5C', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Buscar email
                    </button>
                    <button onClick={() => setError('')}
                      style={{ flex: 1, padding: '9px 12px', background: 'none', border: '1px solid rgba(15,68,139,.15)', borderRadius: 8, color: 'rgba(15,68,139,.65)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Reintentar
                    </button>
                  </div>
                </div>
              )}

              {isNotFound && quickReg.show && (
                <div style={{ background: 'rgba(15,68,139,.06)', border: '1px solid rgba(15,68,139,.15)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontWeight: 800, color: '#0F448B', marginBottom: 12, fontSize: 14 }}>✚ Registrar cliente rápido</p>
                  <form onSubmit={handleQuickRegister}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input required placeholder="Nombre *" value={quickReg.firstName}
                        onChange={e => setQuickReg(q => ({ ...q, firstName: e.target.value }))}
                        style={{ ...S.inp, fontSize: 13, padding: '10px 12px' }} />
                      <input placeholder="Apellido" value={quickReg.lastName}
                        onChange={e => setQuickReg(q => ({ ...q, lastName: e.target.value }))}
                        style={{ ...S.inp, fontSize: 13, padding: '10px 12px' }} />
                    </div>
                    <input required type="email" placeholder="Email *" value={quickReg.email}
                      onChange={e => setQuickReg(q => ({ ...q, email: e.target.value }))}
                      style={{ ...S.inp, fontSize: 13, padding: '10px 12px', marginBottom: 8 }} />
                    {quickReg.error && <div style={{ ...S.err, marginBottom: 8 }}>{quickReg.error}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" disabled={quickReg.loading}
                        style={{ flex: 1, padding: '10px', background: '#0F448B', border: 'none', borderRadius: 10, color: '#FFFFFF', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: quickReg.loading ? .6 : 1 }}>
                        {quickReg.loading ? 'Registrando…' : 'Crear cuenta →'}
                      </button>
                      <button type="button" onClick={() => setQuickReg(q => ({ ...q, show: false }))}
                        style={{ padding: '10px 14px', background: 'none', border: '1px solid rgba(15,68,139,.15)', borderRadius: 10, color: 'rgba(15,68,139,.55)', cursor: 'pointer', fontSize: 11 }}>
                        ✕
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {error && !isNotFound && (
                <div style={{ ...S.err, marginBottom: 14 }}>
                  {error}
                  <br />
                  <button onClick={() => { setError(''); setScreen('searchEmail'); }}
                    style={{ marginTop: 8, background: 'none', border: '1px solid rgba(224,92,92,.4)', borderRadius: 8, color: '#E05C5C', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    Buscar por email
                  </button>
                </div>
              )}

              {loading && <div style={{ textAlign: 'center', color: '#0F448B', padding: 16, fontWeight: 600 }}>Buscando…</div>}

              <Suspense fallback={<div style={{ color: 'rgba(15,68,139,.55)', textAlign: 'center', padding: 40, fontSize: 13 }}>Cargando cámara…</div>}>
                <QRScanner
                  key={error ? 'error' : 'scanning'}
                  onScan={(code) => { setCodeInput(code); lookupByCode(code); }}
                  onClose={() => setScreen('home')}
                />
              </Suspense>
            </div>
          );
        })()}

        {/* ── SEARCH BY EMAIL ── */}
        {screen === 'searchEmail' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Buscar por <span>email</span></h2>
            <p style={{ color: 'rgba(15,68,139,.55)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>El cliente dice su correo electrónico</p>
            <form onSubmit={e => { e.preventDefault(); lookupByEmail(emailInput); }}>
              <label style={S.lbl}>Correo del cliente</label>
              <input type="email" required autoFocus value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="cliente@email.com" style={S.inp}
                onFocus={e => e.target.style.borderColor = '#0F448B'}
                onBlur={e => e.target.style.borderColor = 'rgba(15,68,139,.15)'} />
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.goldBtn, marginTop: 14 }}>
                {loading ? 'Buscando…' : 'Buscar cliente →'}
              </button>
            </form>
          </div>
        )}

        {/* ── SEARCH BY NAME ── */}
        {screen === 'searchName' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Buscar por <span>nombre</span></h2>
            <label style={S.lbl}>Nombre del cliente</label>
            <input type="text" autoFocus value={nameInput}
              onChange={e => searchByName(e.target.value)}
              placeholder="Ej: Juan, García..." style={S.inp}
              onFocus={e => e.target.style.borderColor = '#0F448B'}
              onBlur={e => e.target.style.borderColor = 'rgba(15,68,139,.15)'} />
            {error && <div style={S.err}>{error}</div>}
            {nameResults.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nameResults.map(c => {
                  const cp = calcPines(c.availablePoints || 0);
                  return (
                    <button key={c.id} onClick={() => lookupByCode(c.id)} style={{
                      background: 'rgba(15,68,139,.04)', border: '1px solid rgba(15,68,139,.1)',
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      color: '#0F448B', fontFamily: 'inherit',
                    }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.firstName} {c.lastName}</div>
                        {c.phone && <div style={{ fontSize: 11, color: 'rgba(15,68,139,.45)', marginTop: 2 }}>Tel: {c.phone}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: cp.cardComplete ? '#5EC97A' : '#0F448B' }}>
                          {cp.availLabel}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(15,68,139,.4)', marginTop: 1 }}>Pinos 🌲</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {nameInput.length >= 2 && nameResults.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'rgba(15,68,139,.4)', fontSize: 13, marginTop: 20 }}>Sin resultados para "{nameInput}"</div>
            )}
          </div>
        )}

        {/* ── SEARCH MANUAL ── */}
        {screen === 'searchManual' && (
          <div>
            <button onClick={() => setScreen('home')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 6 }}>Código <span>manual</span></h2>
            <form onSubmit={e => { e.preventDefault(); lookupByCode(codeInput); }}>
              <label style={S.lbl}>ID del cliente (del QR)</label>
              <input type="text" required autoFocus value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                placeholder="Pega el ID aquí..."
                style={{ ...S.inp, fontFamily: 'monospace', fontSize: 13 }}
                onFocus={e => e.target.style.borderColor = '#0F448B'}
                onBlur={e => e.target.style.borderColor = 'rgba(15,68,139,.15)'} />
              {error && <div style={S.err}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.goldBtn, marginTop: 14 }}>
                {loading ? 'Buscando…' : 'Buscar cliente →'}
              </button>
            </form>
          </div>
        )}

        {/* ── CUSTOMER PROFILE ── */}
        {screen === 'customer' && customer && pines && (
          <div>
            <button onClick={reset} style={S.back}>← Nueva búsqueda</button>

            {/* Birthday banner */}
            {customer.isBirthday && (
              <div style={{ background: 'linear-gradient(135deg, rgba(255,128,176,.15), rgba(15,68,139,.06))', border: '1px solid rgba(255,128,176,.4)', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <CakeIcon size={26} color="#FF80B0" animated />
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#FF80B0', margin: 0 }}>¡Hoy es el cumpleaños de {customer.firstName}!</p>
                  <p style={{ fontSize: 12, color: 'rgba(15,68,139,.7)', margin: '2px 0 0' }}>Pídele que reclame sus +20 Pinos 🌲 de regalo en su app</p>
                </div>
              </div>
            )}

            {/* Double pines banner */}
            {customer.doublePointsActive && (
              <div style={{ background: 'rgba(15,68,139,.08)', border: '1px solid rgba(15,68,139,.25)', borderRadius: 12, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <LightningIcon size={20} color="#0F448B" animated />
                <p style={{ fontWeight: 800, fontSize: 13, color: '#0F448B', margin: 0 }}>🌲 ¡Pinos dobles activos! Esta compra suma el doble de Pinos automáticamente</p>
              </div>
            )}

            {/* Card complete banner */}
            {pines.cardComplete && (
              <div style={{ background: 'rgba(94,201,122,.1)', border: '1px solid rgba(94,201,122,.4)', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>🌲</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#5EC97A', margin: 0 }}>
                    ¡Llegó a la meta!
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(15,68,139,.75)', margin: '2px 0 0' }}>
                    Le alcanza para {puedeLlevar} producto{puedeLlevar === 1 ? '' : 's'} gratis · {availPinosLabel} Pinos
                  </p>
                </div>
              </div>
            )}

            {/* ── Decisión primero: ¿acumular o canjear? Con el saldo canjeable
                visible en ambas opciones, para que staff y cliente decidan juntos ── */}
            {notice && (
              <div style={{
                background: 'rgba(94,201,122,.12)', border: '1px solid rgba(94,201,122,.35)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 14,
                fontSize: 12.5, fontWeight: 700, color: '#3FA65C',
              }}>
                ✓ {notice}
              </div>
            )}

            {customer.memberNumber && (
              <p style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: 'rgba(15,68,139,.45)', marginBottom: 6 }}>
                SOCIO #{customer.memberNumber}
              </p>
            )}

            {/* Lo que el cliente ya eligió desde su cuenta: se muestra primero
                y con foto, para no preguntarle otra vez qué quería. */}
            {customer.pendingIntent && (
              <div style={{
                background: 'rgba(94,201,122,.09)',
                border: '1.5px solid rgba(94,201,122,.45)',
                borderRadius: 16, padding: 14, marginBottom: 16,
              }}>
                <p style={{
                  fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 800,
                  color: '#3FA65C', margin: '0 0 10px',
                }}>
                  🎯 El cliente pidió canjear
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 12, background: '#FFFFFF',
                    flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center',
                    border: '1px solid rgba(15,68,139,.08)',
                  }}>
                    {customer.pendingIntent.imageUrl ? (
                      <img
                        src={customer.pendingIntent.imageUrl}
                        alt={customer.pendingIntent.productName}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 5, boxSizing: 'border-box' }}
                      />
                    ) : <GiftIcon size={26} color="#3FA65C" />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 900, color: '#0F448B', margin: 0, lineHeight: 1.25 }}>
                      {customer.pendingIntent.productName}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(15,68,139,.55)', margin: '3px 0 0' }}>
                      {customer.pendingIntent.pinosCost} Pinos · ${customer.pendingIntent.price} MXN
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRedeemProduct({ id: customer.pendingIntent.productId })}
                  disabled={loading}
                  style={{
                    width: '100%', marginTop: 12, padding: '13px', borderRadius: 11,
                    background: '#3FA65C', border: 'none', color: '#FFFFFF',
                    cursor: loading ? 'wait' : 'pointer', fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase',
                    opacity: loading ? .6 : 1,
                  }}
                >
                  {loading ? 'Canjeando…' : 'Entregar y canjear →'}
                </button>
              </div>
            )}
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, color: 'rgba(15,68,139,.55)', marginBottom: 10 }}>
              {customer.firstName} tiene {availPinosLabel} Pinos — ¿qué va a hacer?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <button onClick={() => { setScreen('addPoints'); setError(''); }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '20px 16px', borderRadius: 16,
                background: 'rgba(94,201,122,.1)', border: '1px solid rgba(94,201,122,.3)',
                color: '#5EC97A', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
              }}>
                <span style={{ fontSize: 28 }}>✚</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>Acumular Pinos</span>
                <span style={{ fontSize: 10, opacity: .8, textAlign: 'center' }}>
                  {puedeLlevar > 0
                    ? `Ya le alcanza para ${puedeLlevar} — puede seguir sumando`
                    : `Va por ${availPinosLabel} Pinos`}
                </span>
              </button>

              <button
                disabled={loading}
                onClick={() => { setScreen('redeem'); setError(''); setCatFilter('all'); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 16px', borderRadius: 16,
                  background: affordableCount > 0 ? 'rgba(15,68,139,.1)' : 'rgba(15,68,139,.04)',
                  border: `1px solid ${affordableCount > 0 ? 'rgba(15,68,139,.3)' : 'rgba(15,68,139,.1)'}`,
                  color: affordableCount > 0 ? '#0F448B' : 'rgba(15,68,139,.45)',
                  cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
                }}>
                <GiftIcon size={28} color={affordableCount > 0 ? '#0F448B' : 'rgba(15,68,139,.45)'} animated={affordableCount > 0} />
                <span style={{ fontWeight: 800, fontSize: 13 }}>Canjear premio</span>
                <span style={{ fontSize: 10, opacity: .8, textAlign: 'center' }}>
                  {puedeLlevar > 0 ? `Le alcanza para ${puedeLlevar} producto${puedeLlevar === 1 ? '' : 's'}` : 'Aún no le alcanza — sigue sumando'}
                </span>
              </button>
            </div>

            {/* Customer card */}
            <div style={{ background: '#FFFFFF', border: '2px solid rgba(15,68,139,.2)', borderRadius: 20, padding: '20px 22px', marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(15,68,139,.4)', textTransform: 'uppercase', marginBottom: 4 }}>House of Shake Rewards</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: '#0F448B', lineHeight: 1.1 }}>
                  {customer.firstName} {customer.lastName}
                </div>
                {customer.email && (
                  <div style={{ fontSize: 11, color: 'rgba(15,68,139,.45)', marginTop: 3 }}>{customer.email}</div>
                )}
              </div>

              {/* Pine stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'rgba(15,68,139,.05)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(15,68,139,.45)', textTransform: 'uppercase', marginBottom: 4 }}>Hacia su premio</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: pines.cardComplete ? '#5EC97A' : '#0F448B', lineHeight: 1 }}>
                    {pines.pinesInCycle}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(15,68,139,.3)', marginTop: 2 }}>/ {pines.meta} Pinos</div>
                </div>
                <div style={{ background: 'rgba(15,68,139,.05)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(15,68,139,.45)', textTransform: 'uppercase', marginBottom: 4 }}>Totales</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'rgba(15,68,139,.85)', lineHeight: 1 }}>{pines.totalLabel}</div>
                  <div style={{ fontSize: 9, color: 'rgba(15,68,139,.3)', marginTop: 2 }}>Pinos 🌲</div>
                </div>
                <div style={{ background: pines.cardComplete ? 'rgba(94,201,122,.12)' : 'rgba(15,68,139,.05)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: pines.cardComplete ? 'rgba(94,201,122,.7)' : 'rgba(15,68,139,.45)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {pines.cardComplete ? 'Estado' : 'Faltan'}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: pines.cardComplete ? '#5EC97A' : 'rgba(15,68,139,.85)', lineHeight: 1 }}>
                    {pines.cardComplete ? '🎉' : pines.pinesLeft}
                  </div>
                  <div style={{ fontSize: 9, color: pines.cardComplete ? 'rgba(94,201,122,.6)' : 'rgba(15,68,139,.3)', marginTop: 2 }}>
                    {pines.cardComplete ? '¡Ya puede canjear!' : 'para su premio'}
                  </div>
                </div>
              </div>

              {/* Pine progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(15,68,139,.55)', letterSpacing: 1 }}>
                    {pines.cardComplete ? 'PROGRESO AL SIGUIENTE' : 'PROGRESO A SU PREMIO'}
                  </span>
                  <span style={{ fontSize: 10, color: pines.cardComplete ? '#5EC97A' : 'rgba(15,68,139,.55)' }}>
                    {pines.pinesInCycle} / {pines.meta} Pinos
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${pines.progressPct}%`,
                    background: pines.cardComplete ? '#5EC97A' : '#0F448B',
                    transition: 'width .4s ease',
                    minWidth: pines.pinesInCycle > 0 ? 8 : 0,
                  }} />
                </div>
              </div>
            </div>

            {/* Balance canjeable — lo que el staff necesita saber de un vistazo */}
            <div style={{
              background: 'rgba(15,68,139,.06)', border: '1px solid rgba(15,68,139,.18)',
              borderRadius: 14, padding: '14px 18px', marginBottom: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <p style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(15,68,139,.55)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>
                  Saldo para canjear
                </p>
                <p style={{ fontSize: 12, color: 'rgba(15,68,139,.7)', margin: '3px 0 0' }}>
                  Repostería 100 · Cafés y bebidas 110 · Milkshakes y alimentos 120 Pinos
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: '#0F448B', margin: 0, lineHeight: 1 }}>
                  {availPinosLabel}
                </p>
                <p style={{ fontSize: 9, color: 'rgba(15,68,139,.45)', margin: 0, letterSpacing: 1 }}>PINOS 🌲</p>
              </div>
            </div>

            {/* Recent transactions */}
            {customer.recentTransactions?.length > 0 && (
              <div style={{ background: 'rgba(15,68,139,.03)', border: '1px solid rgba(15,68,139,.05)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(15,68,139,.4)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Últimos movimientos</div>
                {customer.recentTransactions.slice(0, 4).map(t => {
                  const pinosValue = (Math.abs(t.points) / 10);
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(15,68,139,.04)' }}>
                      <span style={{ color: 'rgba(15,68,139,.65)', fontSize: 12, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: t.points > 0 ? '#5EC97A' : '#E05C5C', flexShrink: 0 }}>
                        {t.points > 0 ? '+' : ''}{pinosValue % 1 === 0 ? pinosValue.toFixed(0) : pinosValue.toFixed(1)} 🌲
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADD POINTS ── */}
        {screen === 'addPoints' && customer && (
          <div>
            <button onClick={() => setScreen('customer')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 36, marginBottom: 4 }}>
              Acumular <span>Pinos</span>
            </h2>
            <p style={{ color: 'rgba(15,68,139,.6)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Para: <strong style={{ color: '#0F448B' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            <div style={{ background: 'rgba(15,68,139,.06)', border: '1px solid rgba(15,68,139,.15)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', color: '#0F448B', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>
              {customer.doublePointsActive ? '🌲🌲 PINOS DOBLES ACTIVOS — gana el doble hoy' : '1 Pino por cada $10 MXN · desde 100 Pinos, un producto gratis'}
            </div>

            {/* Antes de acumular más: ¿ya le alcanza para algo? Staff decide con el cliente */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              background: affordableCount > 0 ? 'rgba(94,201,122,.08)' : 'rgba(15,68,139,.03)',
              border: `1px solid ${affordableCount > 0 ? 'rgba(94,201,122,.28)' : 'rgba(15,68,139,.06)'}`,
              borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 12, color: affordableCount > 0 ? '#5EC97A' : 'rgba(15,68,139,.65)', margin: 0, fontWeight: 700 }}>
                {puedeLlevar > 0
                  ? `🎁 Le alcanza para ${puedeLlevar} producto${puedeLlevar === 1 ? '' : 's'} (${availPinosLabel} Pinos · elige entre ${affordableCount})`
                  : `Tiene ${availPinosLabel} Pinos — aún no le alcanza para nada`}
              </p>
              {affordableCount > 0 && (
                <button type="button" onClick={() => { setScreen('redeem'); setError(''); setCatFilter('all'); }}
                  style={{ flexShrink: 0, background: 'none', border: 'none', color: '#5EC97A', fontSize: 11, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                  Canjear en vez de acumular →
                </button>
              )}
            </div>

            {/* Dos formas de cobrar. Por producto es la predeterminada: el
                precio sale de la base y el barista no puede inventarlo. El
                monto exacto queda para ventas que no cuadran con el catálogo,
                con tope y marcado en el historial. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'producto', label: '🧾 Por producto' },
                { id: 'monto',    label: '💵 Monto exacto' },
              ].map(t => (
                <button key={t.id} type="button"
                  onClick={() => { setModoCobro(t.id); setError(''); }}
                  style={{
                    flex: 1, padding: '11px 8px', borderRadius: 11, cursor: 'pointer',
                    fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, fontWeight: 800,
                    background: modoCobro === t.id ? '#0F448B' : 'rgba(15,68,139,.05)',
                    color: modoCobro === t.id ? '#FFFFFF' : 'rgba(15,68,139,.55)',
                    border: `1px solid ${modoCobro === t.id ? '#0F448B' : 'rgba(15,68,139,.15)'}`,
                    transition: 'background .15s, color .15s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {modoCobro === 'monto' ? (
              <form onSubmit={handleAddPoints}>
                <label style={S.lbl}>Monto de la compra (MXN)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'rgba(15,68,139,.55)', fontSize: 24, pointerEvents: 'none' }}>$</span>
                  <input
                    type="number" required min="1" step="0.01" autoFocus
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ ...S.inp, paddingLeft: 46, fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, height: 72 }}
                    onFocus={e => e.target.style.borderColor = '#0F448B'}
                    onBlur={e => e.target.style.borderColor = 'rgba(15,68,139,.15)'}
                  />
                </div>
                {pinesPreview > 0 && (
                  <div style={{ background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.2)', borderRadius: 12, padding: '14px 18px', textAlign: 'center', marginTop: 12 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: '#5EC97A', lineHeight: 1 }}>
                      +{fmtPinos(pinesPreview * (customer.doublePointsActive ? 2 : 1) * 10)} 🌲
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(94,201,122,.7)', fontWeight: 700 }}>
                      {customer.doublePointsActive ? 'Pinos dobles' : 'Pinos'} para {customer.firstName}
                    </div>
                    {pines && (
                      <div style={{ fontSize: 11, color: 'rgba(15,68,139,.45)', marginTop: 6 }}>
                        Saldo: {pines.availLabel} → {fmtPinos((customer.availablePoints || 0) + pinesPreview * (customer.doublePointsActive ? 2 : 1) * 10)} Pinos
                      </div>
                    )}
                  </div>
                )}
                {error && <div style={S.err}>{error}</div>}
                <button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0}
                  style={{ ...S.goldBtn, marginTop: 20, fontSize: 15, height: 56, opacity: (loading || !amount) ? .6 : 1 }}>
                  {loading ? 'Procesando…' : 'Confirmar compra'}
                </button>
              </form>
            ) : (
            <>
            <label style={S.lbl}>¿Qué llevó el cliente?</label>
            <input
              type="text" autoFocus value={ventaBusca}
              onChange={e => setVentaBusca(e.target.value)}
              placeholder="Busca un producto…"
              style={{ ...S.inp, marginBottom: 10 }}
              onFocus={e => e.target.style.borderColor = '#0F448B'}
              onBlur={e => e.target.style.borderColor = 'rgba(15,68,139,.15)'}
            />

            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {products
                .filter(p => !ventaBusca.trim() || p.name.toLowerCase().includes(ventaBusca.trim().toLowerCase()))
                .slice(0, 40)
                .map(p => (
                  <button key={p.id} type="button" onClick={() => agregarAlCarrito(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    background: '#FFFFFF', border: '1px solid rgba(15,68,139,.12)',
                    borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#0F448B' }}>{p.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(15,68,139,.6)' }}>${p.price}</span>
                  </button>
                ))}
              {products.length === 0 && (
                <p style={{ fontSize: 12, color: 'rgba(15,68,139,.45)', textAlign: 'center', padding: 12 }}>Cargando menú…</p>
              )}
            </div>

            {carrito.length > 0 && (
              <div style={{ background: 'rgba(15,68,139,.04)', border: '1px solid rgba(15,68,139,.12)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                {carrito.map(it => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#0F448B', fontWeight: 700 }}>{it.name}</span>
                    <button type="button" onClick={() => cambiarCantidad(it.id, -1)} style={S.qtyBtn}>−</button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, color: '#0F448B' }}>{it.qty}</span>
                    <button type="button" onClick={() => cambiarCantidad(it.id, +1)} style={S.qtyBtn}>+</button>
                    <span style={{ minWidth: 56, textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'rgba(15,68,139,.7)' }}>
                      ${it.price * it.qty}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(15,68,139,.12)', marginTop: 6, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F448B' }}>Total</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#0F448B' }}>${totalVenta} MXN</span>
                </div>
              </div>
            )}

            {totalVenta > 0 && (
              <div style={{ background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.2)', borderRadius: 12, padding: '14px 18px', textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: '#5EC97A', lineHeight: 1 }}>
                  +{fmtPinos(pinosVenta * 10)} 🌲
                </div>
                <div style={{ fontSize: 12, color: 'rgba(94,201,122,.7)', fontWeight: 700 }}>
                  {customer.doublePointsActive ? 'Pinos dobles' : 'Pinos'} para {customer.firstName}
                </div>
                {pines && (
                  <div style={{ fontSize: 11, color: 'rgba(15,68,139,.45)', marginTop: 6 }}>
                    Saldo: {pines.availLabel} → {fmtPinos((customer.availablePoints || 0) + pinosVenta * 10)} Pinos
                  </div>
                )}
              </div>
            )}

            {error && <div style={S.err}>{error}</div>}
            <button type="button" onClick={handleAddProducts} disabled={loading || carrito.length === 0}
              style={{ ...S.goldBtn, marginTop: 12, fontSize: 15, height: 56, opacity: (loading || !carrito.length) ? .6 : 1 }}>
              {loading ? 'Procesando…' : `Confirmar venta${totalVenta > 0 ? ` — $${totalVenta}` : ''}`}
            </button>
            </>
            )}
          </div>
        )}

        {/* ── CONFIRM DRINK REDEMPTION ── */}
        {screen === 'confirmDrink' && customer && pines && (
          <div>
            <button onClick={() => setScreen('customer')} style={S.back}>← Volver</button>
            <h2 className="mc-heading" style={{ fontSize: 36, marginBottom: 4 }}>
              Canjear <span>bebida</span>
            </h2>
            <p style={{ color: 'rgba(15,68,139,.6)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              Para: <strong style={{ color: '#0F448B' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            <div style={{ background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.3)', borderRadius: 20, padding: '24px', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>🌲</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: '#5EC97A', letterSpacing: 2, lineHeight: 1, marginBottom: 8 }}>
                {pines.meta} PINOS
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F448B', marginBottom: 6 }}>Canje genérico</div>
              <div style={{ fontSize: 12, color: 'rgba(15,68,139,.6)', lineHeight: 1.5 }}>
                Descuenta {pines.meta} Pinos sin registrar qué producto se entregó.<br/>
                <strong>Usa mejor "Canjear premio"</strong>, que cobra el precio correcto
                por categoría (100 · 110 · 120) y deja constancia del producto.
              </div>
            </div>

            <div style={{ background: 'rgba(15,68,139,.04)', border: '1px solid rgba(15,68,139,.06)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'rgba(15,68,139,.65)' }}>Saldo actual</span>
                <span style={{ fontWeight: 800, color: '#5EC97A' }}>{pines.availLabel} Pinos 🌲</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'rgba(15,68,139,.65)' }}>Después del canje</span>
                {/* Antes repetía el mismo número que arriba: el cajero creía
                    que el canje no descontaba nada. */}
                <span style={{ fontWeight: 800, color: 'rgba(15,68,139,.75)' }}>
                  {fmtPinos((customer.availablePoints || 0) - pines.meta * 10)} Pinos
                </span>
              </div>
            </div>

            {error && <div style={{ ...S.err, marginBottom: 14 }}>{error}</div>}

            <button onClick={handleRedeemDrink} disabled={loading}
              style={{ ...S.goldBtn, background: '#5EC97A', marginBottom: 10, fontSize: 15, height: 56, opacity: loading ? .6 : 1 }}>
              {loading ? 'Procesando…' : '🌲 Confirmar canje'}
            </button>
            <button onClick={() => { setScreen('customer'); setError(''); }} style={S.ghostBtn}>
              Cancelar
            </button>
          </div>
        )}

        {/* ── CANJEAR PREMIO — catálogo con costos en Pinos ── */}
        {screen === 'redeem' && customer && (
          <div>
            <button onClick={() => { setScreen('customer'); setError(''); }} style={S.back}>← Volver al cliente</button>
            <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 4 }}>
              Canjear <span>premio</span>
            </h2>
            <p style={{ color: 'rgba(15,68,139,.6)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
              Para: <strong style={{ color: '#0F448B' }}>{customer.firstName} {customer.lastName}</strong>
            </p>

            {/* Saldo disponible */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(15,68,139,.08), rgba(15,68,139,.04))',
              border: '1px solid rgba(15,68,139,.25)', borderRadius: 16,
              padding: '16px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <p style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(15,68,139,.6)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>
                  Le alcanza para
                </p>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#0F448B', margin: '4px 0 0' }}>
                  {puedeLlevar > 0
                    ? `${puedeLlevar} producto${puedeLlevar === 1 ? '' : 's'} gratis`
                    : 'Aún nada — sigue acumulando'}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#0F448B', margin: 0, lineHeight: 1 }}>{availPinosLabel}</p>
                <p style={{ fontSize: 9, color: 'rgba(15,68,139,.55)', margin: 0, letterSpacing: 1 }}>PINOS</p>
              </div>
            </div>

            {error && <div style={{ ...S.err, marginBottom: 12 }}>{error}</div>}

            {/* Filtro de categorías */}
            {categories.length > 1 && (
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
                {['all', ...categories].map(c => (
                  <button key={c} onClick={() => setCatFilter(c)} style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                    fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                    background: catFilter === c ? '#0F448B' : 'rgba(15,68,139,.04)',
                    color: catFilter === c ? '#FFFFFF' : 'rgba(15,68,139,.7)',
                    border: `1px solid ${catFilter === c ? '#0F448B' : 'rgba(15,68,139,.15)'}`,
                  }}>
                    {c === 'all' ? 'Todo el menú' : catLabel(c)}
                  </button>
                ))}
              </div>
            )}

            {products.length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(15,68,139,.45)', fontSize: 13, padding: '30px 0' }}>
                Cargando menú…
              </p>
            )}

            {/* Lista de productos con costo en Pinos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shownProducts.map(p => {
                const cost = pinosDe(p.pointsValue);
                const canAfford = cost <= availPinos;
                const faltan = cost - availPinos;
                return (
                  <button
                    key={p.id}
                    disabled={!canAfford}
                    onClick={() => { setPickedProduct(p); setScreen('confirmProduct'); setError(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      padding: '14px 16px', borderRadius: 14, width: '100%',
                      background: canAfford ? 'rgba(94,201,122,.09)' : 'rgba(15,68,139,.03)',
                      border: `1px solid ${canAfford ? 'rgba(94,201,122,.32)' : 'rgba(15,68,139,.05)'}`,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      opacity: canAfford ? 1 : .5,
                      fontFamily: "'Montserrat', sans-serif",
                    }}>
                    <div style={{ flexShrink: 0 }}>
                      {canAfford
                        ? <CheckIcon size={22} color="#5EC97A" />
                        : <CoffeeIcon size={22} color="rgba(15,68,139,.4)" animated={false} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: '#0F448B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(15,68,139,.55)', margin: '2px 0 0' }}>
                        ${p.price} MXN · {catLabel(p.category)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{
                        fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1, margin: 0,
                        color: canAfford ? '#5EC97A' : 'rgba(15,68,139,.6)',
                      }}>
                        {cost}
                      </p>
                      <p style={{ fontSize: 9, color: canAfford ? 'rgba(94,201,122,.75)' : 'rgba(15,68,139,.4)', margin: 0, letterSpacing: .5, fontWeight: 700 }}>
                        {canAfford ? 'PINOS ✓' : `faltan ${faltan}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONFIRMAR CANJE DE PRODUCTO ── */}
        {screen === 'confirmProduct' && customer && pickedProduct && (() => {
          const cost = pinosDe(pickedProduct.pointsValue);
          const after = availPinos - cost;
          return (
            <div>
              <button onClick={() => { setScreen('redeem'); setError(''); }} style={S.back}>← Volver al menú</button>
              <h2 className="mc-heading" style={{ fontSize: 34, marginBottom: 4 }}>
                Confirmar <span>canje</span>
              </h2>
              <p style={{ color: 'rgba(15,68,139,.6)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                Para: <strong style={{ color: '#0F448B' }}>{customer.firstName} {customer.lastName}</strong>
              </p>

              <div style={{
                background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.3)',
                borderRadius: 20, padding: '26px 22px', textAlign: 'center', marginBottom: 18,
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <GiftIcon size={52} color="#5EC97A" animated />
                </div>
                <div style={{ fontSize: 19, fontWeight: 900, color: '#0F448B', marginBottom: 6 }}>
                  {pickedProduct.name}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(15,68,139,.65)', marginBottom: 14 }}>
                  Valor ${pickedProduct.price} MXN · <strong style={{ color: '#5EC97A' }}>GRATIS</strong>
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: '#5EC97A', letterSpacing: 2, lineHeight: 1 }}>
                  −{cost} PINOS
                </div>
              </div>

              <div style={{ background: 'rgba(15,68,139,.04)', border: '1px solid rgba(15,68,139,.06)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: 'rgba(15,68,139,.65)' }}>Pinos antes</span>
                  <span style={{ fontWeight: 800, color: '#0F448B' }}>{availPinosLabel} 🌲</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'rgba(15,68,139,.65)' }}>Pinos después</span>
                  <span style={{ fontWeight: 800, color: 'rgba(15,68,139,.85)' }}>{after} 🌲</span>
                </div>
              </div>

              {error && <div style={{ ...S.err, marginBottom: 14 }}>{error}</div>}

              <button onClick={() => handleRedeemProduct(pickedProduct)} disabled={loading}
                style={{ ...S.goldBtn, background: '#5EC97A', marginBottom: 10, fontSize: 15, height: 56, opacity: loading ? .6 : 1 }}>
                {loading ? 'Procesando…' : `Entregar ${pickedProduct.name} gratis`}
              </button>
              <button onClick={() => { setScreen('redeem'); setError(''); }} style={S.ghostBtn}>
                Cancelar
              </button>
            </div>
          );
        })()}

        {/* ── SUCCESS ── */}
        {screen === 'success' && result && (
          <SuccessScreen result={result} customer={customer} onViewProfile={() => { setScreen('customer'); setResult(null); }} onReset={reset} />
        )}

      </div>
    </div>
  );
}

/* ─── Success Screen ─── */
function SuccessScreen({ result, customer, onViewProfile, onReset }) {
  const newPines = calcPines(result.newBalance || result.newAvailablePoints || 0, 0, result.reward);
  const isProduct = result.type === 'redeemProduct';

  return (
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <div style={{ marginBottom: 12, display:'flex', justifyContent:'center' }}>
        {result.type === 'earn'
          ? <StarIcon size={72} color="#0F448B" animated />
          : isProduct
            ? <GiftIcon size={72} color="#5EC97A" animated />
            : <span style={{ fontSize: 72 }}>🌲</span>}
      </div>

      {isProduct && (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: 2, lineHeight: 1.05, color: '#5EC97A', marginBottom: 8 }}>
            ¡{result.productName} gratis!
          </div>
          <p style={{ color: 'rgba(15,68,139,.7)', fontSize: 14, marginBottom: 16 }}>
            {result.pinosCost} Pinos canjeados por <strong style={{ color: '#0F448B' }}>{result.customerName || customer?.firstName}</strong>
          </p>
          <div style={{ background: 'rgba(94,201,122,.08)', border: '1px solid rgba(94,201,122,.25)', borderRadius: 14, padding: '12px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#5EC97A', margin: 0 }}>
              ✓ Entrégale el producto al cliente
            </p>
          </div>
        </>
      )}

      {result.type === 'earn' && (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 2, lineHeight: 1, color: '#5EC97A', marginBottom: 4 }}>
            +{result.pinosAddedLabel ?? fmtPinos(result.pointsAdded || 0)} Pinos 🌲
          </div>
          <p style={{ color: 'rgba(15,68,139,.7)', fontSize: 14, marginBottom: 16 }}>
            acumulados para <strong style={{ color: '#0F448B' }}>{result.customerName || customer?.firstName}</strong>
          </p>
        </>
      )}

      {result.type === 'redeemDrink' && (
        <>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, lineHeight: 1, color: '#5EC97A', marginBottom: 8 }}>
            ¡Bebida gratis!
          </div>
          <p style={{ color: 'rgba(15,68,139,.7)', fontSize: 14, marginBottom: 16 }}>
            {result.pinesRedeemed ?? '—'} Pinos canjeados para <strong style={{ color: '#0F448B' }}>{result.customerName || customer?.firstName}</strong>
          </p>
        </>
      )}

      <div style={{ background: 'rgba(15,68,139,.04)', border: '1px solid rgba(15,68,139,.06)', borderRadius: 18, padding: '16px 24px', marginBottom: 16 }}>
        {isProduct ? (
          <>
            <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(15,68,139,.4)', textTransform: 'uppercase', marginBottom: 6 }}>Pinos restantes</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: '#0F448B', lineHeight: 1 }}>
              {result.newAvailPinos ?? newPines.availPines}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(15,68,139,.4)', marginTop: 6 }}>
              {(result.reward?.redeemableCount ?? 0) > 0
                ? `Aún le alcanza para ${result.reward.redeemableCount} producto${result.reward.redeemableCount === 1 ? '' : 's'} más`
                : `Le faltan ${result.reward?.pinosToNextGoal ?? 0} Pinos para el siguiente premio`}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(15,68,139,.4)', textTransform: 'uppercase', marginBottom: 6 }}>Saldo del cliente</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: result.reward?.hasReward ? '#5EC97A' : '#0F448B', lineHeight: 1 }}>
              {result.newAvailablePinosLabel ?? newPines.availLabel} <span style={{ fontSize: 20 }}>Pinos</span>
            </div>
            {result.justUnlocked ? (
              <div style={{ fontSize: 13.5, color: '#5EC97A', fontWeight: 900, marginTop: 8, lineHeight: 1.4 }}>
                🎉 ¡Con esta compra llegó a la meta!<br />
                <span style={{ fontWeight: 700 }}>
                  Avísale que ya puede canjear {result.reward.redeemableCount} producto{result.reward.redeemableCount === 1 ? '' : 's'} gratis
                </span>
              </div>
            ) : result.reward?.hasReward ? (
              <div style={{ fontSize: 13, color: '#5EC97A', fontWeight: 800, marginTop: 8 }}>
                🎁 Le alcanza para {result.reward.redeemableCount} producto{result.reward.redeemableCount === 1 ? '' : 's'} gratis
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(15,68,139,.4)', marginTop: 6 }}>
                Le faltan {result.reward?.pinosToNextGoal ?? newPines.pinesLeft} Pinos para su primer premio
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        <button onClick={onViewProfile} style={S.ghostBtn}>Ver perfil del cliente</button>
        <button onClick={onReset} style={S.goldBtn}>Nueva transacción</button>
      </div>
    </div>
  );
}

/* ─── Shared styles ─── */
const S = {
  qtyBtn: {
    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
    border: '1px solid rgba(15,68,139,.2)', background: '#FFFFFF',
    color: '#0F448B', fontWeight: 900, fontSize: 15, cursor: 'pointer',
    fontFamily: 'inherit', lineHeight: 1,
  },
  lbl: {
    display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 2,
    textTransform: 'uppercase', color: 'rgba(15,68,139,.55)', marginBottom: 8,
    fontFamily: "'Montserrat', sans-serif",
  },
  inp: {
    width: '100%', background: 'rgba(15,68,139,.04)', color: '#0F448B',
    border: '1px solid rgba(15,68,139,.15)', borderRadius: 12,
    padding: '14px 16px', outline: 'none',
    fontFamily: "'Montserrat', sans-serif", fontSize: 15,
    transition: 'border-color .2s', boxSizing: 'border-box',
    WebkitAppearance: 'none',
  },
  goldBtn: {
    width: '100%', padding: '16px', background: '#0F448B', color: '#FFFFFF',
    border: 'none', borderRadius: 14, fontFamily: "'Montserrat', sans-serif",
    fontWeight: 900, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ghostBtn: {
    width: '100%', padding: '15px', background: 'rgba(15,68,139,.05)',
    color: '#0F448B', border: '1px solid rgba(15,68,139,.15)',
    borderRadius: 14, fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  back: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(15,68,139,.55)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1, padding: 0, marginBottom: 20,
    fontFamily: "'Montserrat', sans-serif", display: 'block',
  },
  err: {
    background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.25)',
    color: '#E05C5C', fontSize: 13, padding: '12px 16px',
    borderRadius: 12, marginTop: 12,
  },
  bigBtn: (bg, color, border = 'none') => ({
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '18px 20px', borderRadius: 16,
    background: bg, color, border,
    cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
    transition: 'opacity .15s', width: '100%', textAlign: 'left',
  }),
};
