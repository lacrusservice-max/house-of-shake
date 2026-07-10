import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const RAPPI_URL = 'https://www.rappi.com.mx/restaurantes/1930210777-house-of-shake';
const UBER_URL  = 'https://www.ubereats.com/mx/store/house-of-shake-puebla/x1IW6WRuX1mMKK2aNKKVEQ';
const IMG = (hash) => `https://tb-static.uber.com/prod/image-proc/processed_images/${hash}/c67fc65e9b4e16a553eb7574fba090f1.jpeg`;

const MENU = [
  {
    id: 'cold-coffees',
    name: 'Cold Coffees',
    emoji: '☕',
    color: '#1B2F56',
    gradient: 'linear-gradient(135deg,#1B2F56,#2a4a8a)',
    items: [
      { name: 'Caramel Macchiato',                  desc: 'Caramel Macchiato con café, leche y caramelo, servido frío.',                                                                                              price: 88,  img: IMG('825a1dca2b3d0cfd4b723d3f29a9743d') },
      { name: 'Coconut Iced Latte & Coconut Cold Foam', desc: 'Latte helado con leche de coco y espuma fría de coco.',                                                                                               price: 95,  img: IMG('d320b187d4e1640bd8a8fbd2cf0ce473') },
      { name: 'Iced Brown Sugar Oatmilk Shaken Espresso', desc: 'Espresso con azúcar morena, leche de avena y hielo, agitado.',                                                                                     price: 96,  img: IMG('9b99e4a121a4569881622de378b72d3b') },
      { name: 'Iced Coffee',                         desc: 'Café frío con hielo.',                                                                                                                                    price: 65,  img: null },
      { name: 'Iced Latte',                          desc: 'Café espresso mezclado con leche y hielos (16oz).',                                                                                                       price: 70,  img: null },
      { name: 'Iced Latte & Lavander Cold Foam',     desc: 'Latte con doble espresso, leche vaporizada y un toque de polvo de lavanda, coronado con una delicada cold foam.',                                        price: 95,  img: null },
      { name: 'Iced Tiramisu Latte',                 desc: 'Doble espresso frío, leche cremosa y un toque de vainilla y cacao, inspirado en el clásico tiramisú.',                                                   price: 95,  img: IMG('8479da6854d3123d46f1975583f70ead') },
      { name: 'Iced Vanilla Latte',                  desc: 'Café espresso mezclado con jarabe sabor vainilla, leche y hielos (16oz).',                                                                               price: 88,  img: null },
      { name: 'Mocha',                               desc: 'Café espresso mezclado con mocha y leche con hielos (16oz).',                                                                                             price: 90,  img: IMG('7724d0b2d8a0bd2db76bb98dbe192222') },
      { name: 'Pistachio Iced Latte & Pistachio Cold Foam', desc: 'Latte con doble espresso, polvo de pistacho y hielo, coronado con una suave cold foam de pistacho.',                                             price: 95,  img: IMG('0a610e8395702c17fae6c6874aa98816') },
      { name: 'Sunset Tonic',                        desc: 'Refrescante mezcla de tónica con jugo cítrico y tu elección de cold brew o doble espresso. Equilibrado y único.',                                        price: 111, img: null },
      { name: 'Teddy Bear Latte',                    desc: 'Latte frío con doble espresso y sabor a galleta de osito: mezcla de miel, vainilla y canela con leche.',                                                 price: 95,  img: IMG('5ae6d3a270612c4d22f6616087056ec5') },
      { name: 'Vienna Iced Latte',                   desc: 'Bebida fría que combina espresso fuerte con leche fría, cubierta con dos capas de cold foam.',                                                            price: 96,  img: null },
      { name: 'White Mocha',                         desc: 'Café espresso mezclado con mocha blanco y leche con hielos (16oz).',                                                                                      price: 88,  img: null },
    ],
  },
  {
    id: 'cold-brew',
    name: 'Cold Brew',
    emoji: '🧊',
    color: '#0a1628',
    gradient: 'linear-gradient(135deg,#0a1628,#1B2F56)',
    items: [
      { name: 'Cold Brew',                           desc: 'Café infusionado en frío por 20 horas para un sabor suave y concentrado.',                                                                                price: 98,  img: null },
      { name: 'Vanilla Sweet Cream Cold Brew',       desc: 'Cold brew con crema dulce de vainilla.',                                                                                                                  price: 105, img: null },
    ],
  },
  {
    id: 'matcha',
    name: 'Matcha',
    emoji: '🍵',
    color: '#2d6a4f',
    gradient: 'linear-gradient(135deg,#2d6a4f,#52b788)',
    items: [
      { name: 'Iced Matcha',                         desc: 'Bebida refrescante de té verde matcha, batido con hielo y leche, ofreciendo un sabor suave y herbáceo.',                                                  price: 89,  img: null },
      { name: 'Iced Matcha & Lavander Cold Foam',    desc: 'Matcha frío mezclado con leche y hielo, coronado con una suave cold foam de lavanda. Refrescante y floral.',                                              price: 94,  img: IMG('0492f4430c143e890ad15e99e0dd1a39') },
      { name: 'Iced Matcha & Mint Cold Foam',        desc: 'Bebida fría de té verde matcha con hielo, coronada con una suave espuma fría de menta.',                                                                  price: 94,  img: null },
      { name: 'Iced Matcha Lemonade',                desc: 'Bebida fría que mezcla té verde matcha con limonada, una combinación refrescante y equilibrada.',                                                         price: 88,  img: null },
      { name: 'Iced Salted Caramel Pretzel Matcha',  desc: 'Matcha frío con un toque de caramelo salado y pretzel, dulce y salado al mismo tiempo.',                                                                  price: 94,  img: null },
      { name: 'Iced Tiramisu Matcha',                desc: 'Matcha frío con el sabor cremoso del tiramisú, suavemente endulzado con un toque de café y cacao.',                                                      price: 94,  img: IMG('916fbffa753ba888848b0c73c830db7f') },
      { name: 'Passion Fruit Matcha',                desc: 'Matcha vibrante combinado con maracuyá y limonada fresca. Refrescante, cítrico y exótico.',                                                              price: 96,  img: null },
    ],
  },
  {
    id: 'fitfresh',
    name: 'Fitfresh',
    emoji: '🍓',
    color: '#e63946',
    gradient: 'linear-gradient(135deg,#e63946,#f4a261)',
    items: [
      { name: 'Ginger Mint Lemonade',                desc: 'Limonada con un toque de té de jengibre y menta, una mezcla vibrante y refrescante (16oz).',                                                             price: 89,  img: null },
      { name: 'Pink Coconut Drink',                  desc: 'Refrescante mezcla de bebida de coco y fresa, con trozos de fresa y hielo, un sabor afrutado y tropical.',                                               price: 89,  img: IMG('bedc022baa6e511569c29fdda53dc15d') },
      { name: 'Strawberry Acai Lemonade',            desc: 'Extracto de café verde combinado con concentrado de frutas, enriquecido con acai y fresa.',                                                              price: 89,  img: null },
    ],
  },
  {
    id: 'chai',
    name: 'Chai',
    emoji: '🫖',
    color: '#7b4f2e',
    gradient: 'linear-gradient(135deg,#7b4f2e,#c8961e)',
    items: [
      { name: 'Chai',                                desc: 'Chai frío con hielo, servido en vaso transparente.',                                                                                                      price: 88,  img: null },
      { name: 'Dirty Chai',                          desc: 'Bebida fría con mezcla de chai y café, servida con hielo. Lo mejor de dos mundos.',                                                                       price: 93,  img: IMG('699626effe115aecb33a4ce8f60db8ba') },
    ],
  },
  {
    id: 'milkshakes',
    name: 'Milkshakes',
    emoji: '🥤',
    color: '#9d4edd',
    gradient: 'linear-gradient(135deg,#9d4edd,#c77dff)',
    items: [
      { name: 'Vanilla Milkshake',                   desc: 'Bebida cremosa hecha con helado de vainilla, leche y un toque de extracto de vainilla (16oz).',                                                          price: 99,  img: IMG('536515151b661349f3fd13f928ea84b0') },
      { name: 'Caramel Pretzel Milkshake',           desc: 'Bebida cremosa de helado de vainilla, leche, caramelo y trozos de pretzel salado, batidos juntos.',                                                      price: 110, img: IMG('7960db02db533b1c96b15d29c6b14017') },
      { name: 'Chocolate Milkshake',                 desc: 'Bebida cremosa de helado de chocolate, leche y jarabe de chocolate, batidos para una textura perfecta.',                                                  price: 110, img: IMG('09893e14c0dbb41abf502db806eafe48') },
      { name: 'Pistachio Milkshake',                 desc: 'Batido cremoso de color verde claro, con un delicado sabor a pistacho suavemente dulce.',                                                                price: 110, img: IMG('7965058b76761f50fefd6b7dd49d6771') },
      { name: "S'more Milkshake",                    desc: "Bebida cremosa de helado de vainilla, leche, trozos de malvavisco y galletas graham, con un toque de chocolate.",                                        price: 110, img: IMG('6c77cfbac64604906088f187608aaad7') },
    ],
  },
  {
    id: 'reposteria',
    name: 'Repostería',
    emoji: '🥐',
    color: '#c85032',
    gradient: 'linear-gradient(135deg,#c85032,#e8a020)',
    items: [
      { name: 'Chocolate Cookie',                    desc: 'Galleta de chocolate ideal para satisfacer un antojo dulce.',                                                                                             price: 69,  img: IMG('5944542b41493626ac9b0ad8cebdfc10') },
      { name: 'Chocolatine',                         desc: 'Chocolatine de hojaldre con relleno de chocolate.',                                                                                                       price: 74,  img: IMG('5944542b41493626ac9b0ad8cebdfc10') },
      { name: 'Croissant',                           desc: 'Clásico croissant de hojaldre, ideal para acompañar con café o té.',                                                                                     price: 74,  img: IMG('5944542b41493626ac9b0ad8cebdfc10') },
      { name: 'Lotus Cookie',                        desc: 'Galleta Lotus, conocida por su sabor a caramelo y especias. Ideal para acompañar bebidas calientes.',                                                    price: 69,  img: IMG('5944542b41493626ac9b0ad8cebdfc10') },
      { name: 'Pumpkin Muffin',                      desc: 'Muffin esponjoso con sabor a calabaza, perfecto para una tarde de otoño.',                                                                               price: 79,  img: IMG('5944542b41493626ac9b0ad8cebdfc10') },
    ],
  },
];

const ALL_ITEMS = MENU.flatMap(cat => cat.items.map(i => ({ ...i, category: cat.name, catColor: cat.color })));

export default function Menu() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const navRef = useRef(null);

  const filtered = ALL_ITEMS.filter(item => {
    const matchCat = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const currentCat = MENU.find(c => c.name === activeCategory);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#1B2F56', borderBottom: '1px solid rgba(200,150,30,.2)',
        padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="House of Shake" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 8 }} />
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#c8961e', letterSpacing: 2 }}>HOUSE OF SHAKE</span>
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <OrderBtn href={RAPPI_URL} color="#FF441F" label="Rappi" icon="🛵" />
          <OrderBtn href={UBER_URL}  color="#06C167" label="Uber Eats" icon="🚴" />
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(160deg,#1B2F56 0%,#0a1628 60%,#c8961e 200%)',
        padding: '64px 24px 48px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(200,150,30,.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, color: '#c8961e', textTransform: 'uppercase', marginBottom: 14 }}>
            Av. Teziutlán Nte. 42, La Paz, Puebla
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(48px,8vw,84px)', color: '#fbf7f0', margin: '0 0 16px', lineHeight: 1, letterSpacing: 2 }}>
            Nuestro Menú
          </h1>
          <p style={{ color: 'rgba(251,247,240,.6)', fontSize: 15, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Specialty coffee, cold shakes y más — hecho con amor en Puebla
          </p>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 400, margin: '0 auto' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: .5 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Busca tu bebida favorita..."
              style={{
                width: '100%', padding: '14px 16px 14px 44px', borderRadius: 50,
                border: 'none', background: 'rgba(251,247,240,.1)', color: '#fbf7f0',
                fontSize: 14, outline: 'none', backdropFilter: 'blur(8px)',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── ORDER BANNER ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0ede6', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>📦 Pide a domicilio ahora:</span>
        <OrderBtn href={RAPPI_URL} color="#FF441F" label="Ordenar en Rappi" icon="🛵" large />
        <OrderBtn href={UBER_URL}  color="#06C167" label="Ordenar en Uber Eats" icon="🚴" large />
      </div>

      {/* ── CATEGORY TABS ── */}
      <div ref={navRef} style={{
        position: 'sticky', top: 64, zIndex: 90,
        background: '#fff', borderBottom: '2px solid #f0ede6',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        <div style={{ display: 'flex', gap: 0, padding: '0 16px', minWidth: 'max-content' }}>
          <TabBtn
            active={activeCategory === 'all'}
            onClick={() => { setActiveCategory('all'); setSearch(''); }}
            label="Todo el Menú"
            emoji="✨"
            color="#1B2F56"
          />
          {MENU.map(cat => (
            <TabBtn
              key={cat.id}
              active={activeCategory === cat.name}
              onClick={() => { setActiveCategory(cat.name); setSearch(''); }}
              label={cat.name}
              emoji={cat.emoji}
              color={cat.color}
            />
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Category header */}
        {activeCategory !== 'all' && currentCat && (
          <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: currentCat.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              boxShadow: `0 8px 24px ${currentCat.color}40`,
            }}>
              {currentCat.emoji}
            </div>
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, color: '#111', margin: 0, letterSpacing: 1 }}>
                {currentCat.name}
              </h2>
              <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{filtered.length} productos</p>
            </div>
          </div>
        )}

        {/* Search result header */}
        {search && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 14, color: '#666' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para <strong>"{search}"</strong>
            </p>
          </div>
        )}

        {/* Grid by category (when "all" selected) */}
        {activeCategory === 'all' && !search ? (
          MENU.map(cat => (
            <div key={cat.id} style={{ marginBottom: 60 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: cat.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  boxShadow: `0 4px 12px ${cat.color}30`,
                }}>
                  {cat.emoji}
                </div>
                <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, color: '#111', margin: 0, letterSpacing: 1 }}>
                  {cat.name}
                </h2>
                <div style={{ flex: 1, height: 1, background: '#f0ede6', marginLeft: 8 }} />
                <button
                  onClick={() => setActiveCategory(cat.name)}
                  style={{
                    background: 'none', border: `1px solid ${cat.color}40`, color: cat.color,
                    padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', letterSpacing: 1, fontFamily: 'inherit',
                    textTransform: 'uppercase',
                  }}
                >
                  Ver todos →
                </button>
              </div>
              <ProductGrid items={cat.items} catColor={cat.color} catGradient={cat.gradient} onSelect={setSelectedItem} />
            </div>
          ))
        ) : (
          <ProductGrid
            items={filtered}
            catColor={currentCat?.color || '#1B2F56'}
            catGradient={currentCat?.gradient || 'linear-gradient(135deg,#1B2F56,#2a4a8a)'}
            onSelect={setSelectedItem}
            showCategory={activeCategory === 'all'}
          />
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#bbb' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>No encontramos "{search}"</p>
            <p style={{ fontSize: 13 }}>Prueba con otro término</p>
          </div>
        )}
      </div>

      {/* ── FOOTER ORDER CTA ── */}
      <div style={{
        background: '#1B2F56',
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: '#fbf7f0', marginBottom: 8, letterSpacing: 2 }}>
          ¿Listo para ordenar?
        </h2>
        <p style={{ color: 'rgba(251,247,240,.5)', fontSize: 14, marginBottom: 32 }}>
          Delivery a tu puerta en ~35 minutos
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <OrderBtn href={RAPPI_URL} color="#FF441F" label="Pedir en Rappi" icon="🛵" large />
          <OrderBtn href={UBER_URL}  color="#06C167" label="Pedir en Uber Eats" icon="🚴" large />
        </div>
      </div>

      {/* ── MODAL ── */}
      {selectedItem && (
        <ProductModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

/* ─── Product Grid ─── */
function ProductGrid({ items, catColor, catGradient, onSelect, showCategory }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 20,
    }}>
      {items.map((item, i) => (
        <ProductCard key={i} item={item} color={catColor} gradient={catGradient} onSelect={onSelect} showCategory={showCategory} />
      ))}
    </div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ item, color, gradient, onSelect, showCategory }) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: hovered ? '0 16px 48px rgba(0,0,0,.12)' : '0 2px 12px rgba(0,0,0,.06)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
        border: '1px solid #f5f2ec',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        {item.img && !imgError ? (
          <img
            src={item.img}
            alt={item.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s ease', transform: hovered ? 'scale(1.06)' : 'scale(1)' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', background: gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52,
          }}>
            {getCategoryEmoji(item.category)}
          </div>
        )}
        {/* Price badge */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
          color: '#fff', fontWeight: 900, fontSize: 15,
          padding: '4px 12px', borderRadius: 20,
        }}>
          ${item.price}
        </div>
        {showCategory && item.category && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: color, color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
          }}>
            {item.category}
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '16px 18px 18px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 6px', lineHeight: 1.3 }}>
          {item.name}
        </h3>
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.5, WebkitLineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
          {item.desc}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={RAPPI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: '#FF441F', color: '#fff', textDecoration: 'none',
              padding: '8px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              transition: 'opacity .15s',
            }}
          >
            🛵 Rappi
          </a>
          <a
            href={UBER_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: '#06C167', color: '#fff', textDecoration: 'none',
              padding: '8px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              transition: 'opacity .15s',
            }}
          >
            🚴 Uber Eats
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Product Modal ─── */
function ProductModal({ item, onClose }) {
  const [imgError, setImgError] = useState(false);
  const cat = MENU.find(c => c.name === item.category);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(10,20,40,.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 24, overflow: 'hidden',
          width: '100%', maxWidth: 520,
          boxShadow: '0 32px 80px rgba(0,0,0,.3)',
          animation: 'modalIn .3s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', height: 280 }}>
          {item.img && !imgError ? (
            <img src={item.img} alt={item.name} onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%', background: cat?.gradient || 'linear-gradient(135deg,#1B2F56,#c8961e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80,
            }}>
              {getCategoryEmoji(item.category)}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff',
              width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)',
            color: '#fff', fontWeight: 900, fontSize: 22,
            padding: '6px 16px', borderRadius: 20,
          }}>
            ${item.price} MXN
          </div>
        </div>
        {/* Details */}
        <div style={{ padding: '24px 28px 28px' }}>
          {item.category && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: cat?.color || '#c8961e', textTransform: 'uppercase', marginBottom: 6 }}>
              {cat?.emoji} {item.category}
            </div>
          )}
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: '0 0 12px', lineHeight: 1.2 }}>
            {item.name}
          </h2>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, margin: '0 0 24px' }}>
            {item.desc}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href={RAPPI_URL} target="_blank" rel="noopener noreferrer" style={{
              flex: 1, background: '#FF441F', color: '#fff', textDecoration: 'none',
              padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 800,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              🛵 Pedir en Rappi
            </a>
            <a href={UBER_URL} target="_blank" rel="noopener noreferrer" style={{
              flex: 1, background: '#06C167', color: '#fff', textDecoration: 'none',
              padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 800,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              🚴 Pedir en Uber Eats
            </a>
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }`}</style>
    </div>
  );
}

/* ─── Tab Button ─── */
function TabBtn({ active, onClick, label, emoji, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 800 : 600, fontFamily: 'inherit',
        color: active ? color : '#888',
        borderBottom: `3px solid ${active ? color : 'transparent'}`,
        transition: 'all .15s', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      <span>{emoji}</span> {label}
    </button>
  );
}

/* ─── Order Button ─── */
function OrderBtn({ href, color, label, icon, large }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: color, color: '#fff', textDecoration: 'none',
        padding: large ? '12px 24px' : '8px 16px',
        borderRadius: 50,
        fontSize: large ? 14 : 12,
        fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: "'Montserrat',sans-serif",
        boxShadow: `0 4px 16px ${color}40`,
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {icon} {label}
    </a>
  );
}

function getCategoryEmoji(catName) {
  const cat = MENU.find(c => c.name === catName);
  return cat?.emoji || '☕';
}
