import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/mi-cuenta.css';
import { CoffeeIcon, IceIcon, LeafIcon, BerryIcon, ChaiIcon, ShakeIcon, PastryIcon, SparkleIcon, SearchIcon, DeliveryIcon } from '../components/Icons';

const RAPPI_URL = 'https://www.rappi.com.mx/restaurantes/1930210777-house-of-shake';
const UBER_URL  = 'https://www.ubereats.com/mx/store/house-of-shake-puebla/x1IW6WRuX1mMKK2aNKKVEQ';
const RAPPI_LOGO_WHITE = '/images/rappi-logo-white.svg';
const UBER_LOGO_WHITE  = '/images/uber-eats-logo-white.svg';
const I = (name) => `/images/products/${name}.png`;

const CAT_ICONS = {
  'cold-coffees': CoffeeIcon,
  'cold-brew':    IceIcon,
  'matcha':       LeafIcon,
  'fitfresh':     BerryIcon,
  'chai':         ChaiIcon,
  'milkshakes':   ShakeIcon,
  'alimentos':    BerryIcon,
  'reposteria':   PastryIcon,
};

const MENU = [
  {
    id: 'cold-coffees',
    name: 'Cold Coffees',
    color: '#0F448B',
    gradient: 'linear-gradient(135deg,#0F448B,#1A5BB5)',
    items: [
      { name: 'Caramel Macchiato',                  desc: 'Caramel Macchiato con café, leche y caramelo, servido frío.',                                                                                              price: 88,  img: I('caramel-macchiato') },
      { name: 'Coconut Latte & Coconut Cold Foam', desc: 'Latte helado con leche de coco y espuma fría de coco.',                                                                                               price: 95,  img: I('coconut-iced-latte') },
      { name: 'Brown Sugar Oatmilk Shaken Espresso', desc: 'Espresso con azúcar morena, leche de avena y hielo, agitado.',                                                                                     price: 96,  img: I('iced-brown-sugar-oatmilk') },
      { name: 'Coffee',                         desc: 'Café frío con hielo.',                                                                                                                                    price: 65,  img: I('iced-coffee') },
      { name: 'Latte',                          desc: 'Café espresso mezclado con leche y hielos (16oz).',                                                                                                       price: 70,  img: I('iced-latte') },
      { name: 'Latte & Lavander Cold Foam',     desc: 'Latte con doble espresso, leche vaporizada y un toque de polvo de lavanda, coronado con una delicada cold foam.',                                        price: 95,  img: I('iced-latte-lavander-cold-foam') },
      { name: 'Tiramisu Latte',                 desc: 'Doble espresso frío, leche cremosa y un toque de vainilla y cacao, inspirado en el clásico tiramisú.',                                                   price: 95,  img: I('iced-tiramisu-latte') },
      { name: 'Vanilla Latte',                  desc: 'Café espresso mezclado con jarabe sabor vainilla, leche y hielos (16oz).',                                                                               price: 88,  img: I('iced-vanilla-latte') },
      { name: 'Mocha',                               desc: 'Café espresso mezclado con mocha y leche con hielos (16oz).',                                                                                             price: 90,  img: I('mocha') },
      { name: 'Pistachio Latte & Pistachio Cold Foam', desc: 'Latte con doble espresso, polvo de pistacho y hielo, coronado con una suave cold foam de pistacho.',                                             price: 95,  img: I('pistachio-iced-latte') },
      { name: 'Teddy Bear Latte',                    desc: 'Latte frío con doble espresso y sabor a galleta de osito: mezcla de miel, vainilla y canela con leche.',                                                 price: 95,  img: I('teddy-bear-latte') },
      { name: 'Vienna Latte',                   desc: 'Bebida fría que combina espresso fuerte con leche fría, cubierta con dos capas de cold foam.',                                                            price: 96,  img: I('vienna-iced-latte') },
      { name: 'White Mocha',                         desc: 'Café espresso mezclado con mocha blanco y leche con hielos (16oz).',                                                                                      price: 88,  img: I('white-mocha') },
    ],
  },
  {
    id: 'cold-brew',
    name: 'Cold Brew',
    color: '#0F448B',
    gradient: 'linear-gradient(135deg,#071E3D,#0F448B)',
    items: [
      { name: 'Cold Brew',                           desc: 'Café infusionado en frío por 20 horas para un sabor suave y concentrado.',                                                                                price: 98,  img: I('cold-brew') },
      { name: 'Vanilla Sweet Cream Cold Brew',       desc: 'Cold brew con crema dulce de vainilla.',                                                                                                                  price: 105, img: I('vanilla-sweet-cream-cold-brew') },
    ],
  },
  {
    id: 'matcha',
    name: 'Matcha',
    color: '#2d6a4f',
    gradient: 'linear-gradient(135deg,#2d6a4f,#52b788)',
    items: [
      { name: 'Matcha',                         desc: 'Bebida refrescante de té verde matcha, batido con hielo y leche, ofreciendo un sabor suave y herbáceo.',                                                  price: 89,  img: I('iced-matcha') },
      { name: 'Matcha & Lavander Cold Foam',    desc: 'Matcha frío mezclado con leche y hielo, coronado con una suave cold foam de lavanda. Refrescante y floral.',                                              price: 94,  img: I('iced-matcha-lavander-cold-foam') },
      { name: 'Matcha & Mint Cold Foam',        desc: 'Bebida fría de té verde matcha con hielo, coronada con una suave espuma fría de menta.',                                                                  price: 94,  img: I('iced-matcha-mint-cold-foam') },
      { name: 'Matcha Lemonade',                desc: 'Bebida fría que mezcla té verde matcha con limonada, una combinación refrescante y equilibrada.',                                                         price: 88,  img: I('iced-matcha-lemonade') },
      { name: 'Salted Caramel Pretzel Matcha',  desc: 'Matcha frío con un toque de caramelo salado y pretzel, dulce y salado al mismo tiempo.',                                                                  price: 94,  img: I('iced-salted-caramel-pretzel-matcha') },
      { name: 'Tiramisu Matcha',                desc: 'Matcha frío con el sabor cremoso del tiramisú, suavemente endulzado con un toque de café y cacao.',                                                      price: 94,  img: I('iced-tiramisu-matcha') },
    ],
  },
  {
    id: 'fitfresh',
    name: 'Fitfresh',
    color: '#e63946',
    gradient: 'linear-gradient(135deg,#e63946,#f4a261)',
    items: [
      { name: 'Ginger Mint Lemonade',                desc: 'Limonada con un toque de té de jengibre y menta, una mezcla vibrante y refrescante (16oz).',                                                             price: 89,  img: I('ginger-mint-lemonade') },
      { name: 'Pink Coconut Drink',                  desc: 'Refrescante mezcla de bebida de coco y fresa, con trozos de fresa y hielo, un sabor afrutado y tropical.',                                               price: 89,  img: I('pink-coconut-drink') },
      { name: 'Strawberry Acai Lemonade',            desc: 'Extracto de café verde combinado con concentrado de frutas, enriquecido con acai y fresa.',                                                              price: 89,  img: I('strawberry-acai-lemonade') },
      { name: 'Dragon Fruit Drink',                  desc: 'Refrescante bebida de pitahaya con trozos de fruta, vibrante y tropical.',                                                                                   price: 89,  img: I('dragon-fruit') },
    ],
  },
  {
    id: 'chai',
    name: 'Chai',
    color: '#7b4f2e',
    gradient: 'linear-gradient(135deg,#7b4f2e,#c8961e)',
    items: [
      { name: 'Chai',                                desc: 'Chai frío con hielo, servido en vaso transparente.',                                                                                                      price: 88,  img: I('chai') },
      { name: 'Dirty Chai',                          desc: 'Bebida fría con mezcla de chai y café, servida con hielo. Lo mejor de dos mundos.',                                                                       price: 93,  img: I('dirty-chai') },
    ],
  },
  {
    id: 'milkshakes',
    name: 'Milkshakes',
    color: '#9d4edd',
    gradient: 'linear-gradient(135deg,#9d4edd,#c77dff)',
    items: [
      { name: 'Vanilla Milkshake',                   desc: 'Bebida cremosa hecha con helado de vainilla, leche y un toque de extracto de vainilla (16oz).',                                                          price: 99,  img: I('vanilla-milkshake') },
      { name: 'Caramel Pretzel Milkshake',           desc: 'Bebida cremosa de helado de vainilla, leche, caramelo y trozos de pretzel salado, batidos juntos.',                                                      price: 110, img: I('caramel-pretzel-milkshake') },
      { name: 'Chocolate Milkshake',                 desc: 'Bebida cremosa de helado de chocolate, leche y jarabe de chocolate, batidos para una textura perfecta.',                                                  price: 110, img: I('chocolate-milkshake') },
      { name: 'Pistachio Milkshake',                 desc: 'Batido cremoso de color verde claro, con un delicado sabor a pistacho suavemente dulce.',                                                                price: 110, img: I('pistachio-milkshake') },
      { name: "S'more Milkshake",                    desc: "Bebida cremosa de helado de vainilla, leche, trozos de malvavisco y galletas graham, con un toque de chocolate.",                                        price: 110, img: I('smore-milkshake') },
      { name: 'Mint Brownie Milkshake',              desc: 'Milkshake de menta con trozos de brownie de chocolate, cremoso y refrescante.',                                                                               price: 110, img: I('mint-brownie-milkshake') },
    ],
  },
  {
    id: 'alimentos',
    name: 'Alimentos',
    color: '#5c4033',
    gradient: 'linear-gradient(135deg,#5c4033,#a0522d)',
    items: [
      { name: 'Philly Cheesesteak',                  desc: 'Sándwich de carne de res rebanada con queso derretido, servido en pan suave.',                                                                               price: 125, img: I('philly-cheesesteak') },
      { name: 'Montana Melt',                        desc: 'Sándwich artesanal en pan ciabatta, cremoso y satisfecho.',                                                                                                   price: 115, img: I('montana-melt') },
    ],
  },
  {
    id: 'reposteria',
    name: 'Repostería',
    color: '#c85032',
    gradient: 'linear-gradient(135deg,#c85032,#e8a020)',
    items: [
      { name: 'Chocolatine',                         desc: 'Chocolatine de hojaldre con relleno de chocolate.',                                                                                                       price: 74,  img: I('chocolatine') },
      { name: 'Croissant',                           desc: 'Clásico croissant de hojaldre, ideal para acompañar con café o té.',                                                                                     price: 74,  img: I('croissant') },
      { name: 'Croissant Roll',                      desc: 'Roll de croissant hojaldrado con cobertura de chocolate y nueces.',                                                                                           price: 79,  img: I('croissant-roll') },
      { name: 'Roll de Canela',                      desc: 'Suave roll espiralado con canela, dorado y aromático.',                                                                                                       price: 69,  img: I('roll-de-canela') },
      { name: 'Strudel de Manzana',                  desc: 'Strudel hojaldrado relleno de manzana, crujiente y caramelizado.',                                                                                           price: 74,  img: I('strudel-de-manzana') },
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
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── NAV ── */}
      <nav className="menu-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(15,68,139,.12)',
        boxShadow: '0 2px 16px rgba(15,68,139,.08)',
        padding: '0 32px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        height: 90,
        gap: 16,
      }}>
        {/* Izquierda: Inicio */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" className="menu-nav-back" style={{
            fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 11,
            letterSpacing: 2, textTransform: 'uppercase', color: '#0F448B',
            textDecoration: 'none', padding: '8px 0',
            borderBottom: '2px solid transparent',
            transition: 'border-color .2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = '#0F448B'}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
          >
            ← Inicio
          </Link>
        </div>
        {/* Centro: logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          <img src="/logo-encabezado.png" alt="House of Shake" className="menu-nav-logo" style={{ height: 80, width: 'auto', objectFit: 'contain' }} />
        </Link>
        {/* Derecha: delivery CTAs */}
        <div className="menu-nav-orders" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          <OrderBtn href={RAPPI_URL} color="#FF441F" logo={RAPPI_LOGO_WHITE} alt="Rappi" />
          <OrderBtn href={UBER_URL}  color="#06C167" logo={UBER_LOGO_WHITE}  alt="Uber Eats" />
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        background: '#0F448B',
        padding: '64px 24px 48px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, color: 'rgba(255,255,255,.8)', textTransform: 'uppercase', marginBottom: 14 }}>
            Av. Teziutlán Nte. 42, La Paz, Puebla
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(48px,8vw,84px)', color: '#FFFFFF', margin: '0 0 16px', lineHeight: 1, letterSpacing: 2 }}>
            Nuestro Menú
          </h1>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 15, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Specialty coffee, cold shakes y más — hecho con amor en Puebla
          </p>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 400, margin: '0 auto' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: .6, display: 'flex' }}>
              <SearchIcon size={16} color="#FFFFFF" />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Busca tu bebida favorita..."
              style={{
                width: '100%', padding: '14px 16px 14px 44px', borderRadius: 50,
                border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.15)', color: '#FFFFFF',
                fontSize: 14, outline: 'none', backdropFilter: 'blur(8px)',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── ORDER BANNER ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(15,68,139,.1)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#0F448B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <DeliveryIcon size={16} color="#0F448B" /> Pide a domicilio ahora:
        </span>
        <OrderBtn href={RAPPI_URL} color="#FF441F" logo={RAPPI_LOGO_WHITE} alt="Rappi" prefix="Ordenar en" large />
        <OrderBtn href={UBER_URL}  color="#06C167" logo={UBER_LOGO_WHITE}  alt="Uber Eats" prefix="Ordenar en" large />
      </div>

      {/* ── CATEGORY TABS ── */}
      <div ref={navRef} style={{
        position: 'sticky', top: 90, zIndex: 90,
        background: '#FFFFFF', borderBottom: '2px solid rgba(15,68,139,.1)',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        <div style={{ display: 'flex', gap: 0, padding: '0 16px', minWidth: 'max-content' }}>
          <TabBtn
            active={activeCategory === 'all'}
            onClick={() => { setActiveCategory('all'); setSearch(''); }}
            label="Todo el Menú"
            icon={<SparkleIcon size={14} color="#0F448B" />}
            color="#0F448B"
          />
          {MENU.map(cat => {
            const CatIcon = CAT_ICONS[cat.id] || CoffeeIcon;
            return (
              <TabBtn
                key={cat.id}
                active={activeCategory === cat.name}
                onClick={() => { setActiveCategory(cat.name); setSearch(''); }}
                label={cat.name}
                icon={<CatIcon size={14} color={cat.color} />}
                color={cat.color}
              />
            );
          })}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Category header */}
        {activeCategory !== 'all' && currentCat && (
          <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: currentCat.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px ${currentCat.color}40`, flexShrink: 0,
            }}>
              {(() => { const CatIcon = CAT_ICONS[currentCat.id] || CoffeeIcon; return <CatIcon size={28} color="#fff" />; })()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(26px,7vw,38px)', color: '#0F448B', margin: 0, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                {currentCat.name}
              </h2>
              <p style={{ color: 'rgba(15,68,139,.5)', fontSize: 13, margin: 0 }}>{filtered.length} productos</p>
            </div>
          </div>
        )}

        {/* Search result header */}
        {search && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 14, color: '#0F448B' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para <strong>"{search}"</strong>
            </p>
          </div>
        )}

        {/* Grid by category (when "all" selected) */}
        {activeCategory === 'all' && !search ? (
          MENU.map(cat => (
            <div key={cat.id} style={{ marginBottom: 60 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap', rowGap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: cat.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${cat.color}30`, flexShrink: 0,
                }}>
                  {(() => { const CatIcon = CAT_ICONS[cat.id] || CoffeeIcon; return <CatIcon size={20} color="#fff" />; })()}
                </div>
                <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(20px,5vw,30px)', color: '#0F448B', margin: 0, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                  {cat.name}
                </h2>
                <div style={{ flex: '1 1 20px', height: 1, background: 'rgba(15,68,139,.1)', marginLeft: 8 }} />
                <button
                  onClick={() => setActiveCategory(cat.name)}
                  style={{
                    background: 'none', border: '1px solid rgba(15,68,139,.3)', color: '#0F448B',
                    padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', letterSpacing: 1, fontFamily: 'inherit',
                    textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
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
            catColor={currentCat?.color || '#0F448B'}
            catGradient={currentCat?.gradient || 'linear-gradient(135deg,#0F448B,#1A5BB5)'}
            onSelect={setSelectedItem}
            showCategory={activeCategory === 'all'}
          />
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(15,68,139,.4)' }}>
            <div style={{ marginBottom: 16 }}><CoffeeIcon size={48} color="#0F448B" opacity={0.3} /></div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>No encontramos "{search}"</p>
            <p style={{ fontSize: 13 }}>Prueba con otro término</p>
          </div>
        )}
      </div>

      {/* ── FOOTER ORDER CTA ── */}
      <div style={{
        background: '#0F448B',
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: '#FFFFFF', marginBottom: 8, letterSpacing: 2 }}>
          ¿Listo para ordenar?
        </h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 32 }}>
          Delivery a tu puerta en ~35 minutos
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <OrderBtn href={RAPPI_URL} color="#FF441F" logo={RAPPI_LOGO_WHITE} alt="Rappi" prefix="Pedir en" large />
          <OrderBtn href={UBER_URL}  color="#06C167" logo={UBER_LOGO_WHITE}  alt="Uber Eats" prefix="Pedir en" large />
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
        background: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: hovered ? '0 16px 48px rgba(15,68,139,.14)' : '0 2px 12px rgba(15,68,139,.07)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
        border: '1px solid rgba(15,68,139,.1)',
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
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(() => { const cat = MENU.find(c => c.name === item.category); const CatIcon = (cat && CAT_ICONS[cat.id]) || CoffeeIcon; return <CatIcon size={52} color="#fff" opacity={0.7} />; })()}
          </div>
        )}
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
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F448B', margin: '0 0 6px', lineHeight: 1.3 }}>
          {item.name}
        </h3>
        <p style={{ fontSize: 12, color: 'rgba(15,68,139,.6)', margin: '0 0 16px', lineHeight: 1.5, WebkitLineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
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
            <img src={RAPPI_LOGO_WHITE} alt="Rappi" style={{ height: 12, width: 'auto' }} />
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
            <img src={UBER_LOGO_WHITE} alt="Uber Eats" style={{ height: 12, width: 'auto' }} />
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
          background: '#FFFFFF', borderRadius: 24, overflow: 'hidden',
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
              width: '100%', height: '100%', background: cat?.gradient || 'linear-gradient(135deg,#0F448B,#1A5BB5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(() => { const CatIcon = (cat && CAT_ICONS[cat.id]) || CoffeeIcon; return <CatIcon size={80} color="#fff" opacity={0.7} />; })()}
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
        </div>
        {/* Details */}
        <div style={{ padding: '24px 28px 28px' }}>
          {item.category && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: cat?.color || '#0F448B', textTransform: 'uppercase', marginBottom: 6 }}>
              {item.category}
            </div>
          )}
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0F448B', margin: '0 0 12px', lineHeight: 1.2 }}>
            {item.name}
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(15,68,139,.65)', lineHeight: 1.7, margin: '0 0 24px' }}>
            {item.desc}
          </p>
          <div className="modal-order-row" style={{ display: 'flex', gap: 12 }}>
            <a href={RAPPI_URL} target="_blank" rel="noopener noreferrer" className="modal-order-btn" style={{
              flex: 1, background: '#FF441F', color: '#fff', textDecoration: 'none',
              padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 800,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>Pedir en</span>
              <img src={RAPPI_LOGO_WHITE} alt="Rappi" style={{ height: 15, width: 'auto', flexShrink: 0 }} />
            </a>
            <a href={UBER_URL} target="_blank" rel="noopener noreferrer" className="modal-order-btn" style={{
              flex: 1, background: '#06C167', color: '#fff', textDecoration: 'none',
              padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 800,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>Pedir en</span>
              <img src={UBER_LOGO_WHITE} alt="Uber Eats" style={{ height: 15, width: 'auto', flexShrink: 0 }} />
            </a>
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }`}</style>
    </div>
  );
}

/* ─── Tab Button ─── */
function TabBtn({ active, onClick, label, icon, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 800 : 600, fontFamily: 'inherit',
        color: active ? color : 'rgba(15,68,139,.5)',
        borderBottom: `3px solid ${active ? color : 'transparent'}`,
        transition: 'all .15s', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {icon} {label}
    </button>
  );
}

/* ─── Order Button ─── */
function OrderBtn({ href, color, logo, alt, prefix, large }) {
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
        fontWeight: 800, display: 'flex', alignItems: 'center', gap: large ? 8 : 6,
        fontFamily: "'Montserrat',sans-serif",
        boxShadow: `0 4px 16px ${color}40`,
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {prefix && <span>{prefix}</span>}
      <img src={logo} alt={alt} style={{ height: large ? 15 : 12, width: 'auto', display: 'block' }} />
    </a>
  );
}
