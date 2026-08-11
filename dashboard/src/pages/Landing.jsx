import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/landing.css';
import { TentIcon, CoffeeIcon } from '../components/Icons';
import Rewards from '../components/Rewards';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LOGO_IMG = <img src="/logo-white.png" alt="House of Shake" width="42" height="42" style={{ objectFit: "contain" }} />;

const I = (name) => `/images/products/${name}.png`;
const FEATURED_ITEMS = [
  { name: 'Teddy Bear Latte',      desc: 'Latte frío con sabor a galleta de osito: miel, vainilla y canela.',          price: 95,  img: I('teddy-bear-latte'),               tag: 'Favorito' },
  { name: 'Coconut Latte',    desc: 'Latte helado con leche de coco y espuma fría de coco.',                       price: 95,  img: I('coconut-iced-latte'),             tag: '#1 Más Pedido' },
  { name: 'Tiramisu Latte',   desc: 'Doble espresso frío con vainilla y cacao, inspirado en el tiramisú.',         price: 95,  img: I('iced-tiramisu-latte'),            tag: '#2 Favorito' },
  { name: 'Pistachio Milkshake',   desc: 'Batido cremoso verde claro con delicado sabor a pistacho.',                   price: 110, img: I('pistachio-milkshake'),            tag: 'Milkshake' },
  { name: 'Chocolate Milkshake',   desc: 'Helado de chocolate, leche y jarabe de chocolate. Perfección cremosa.',       price: 110, img: I('chocolate-milkshake'),            tag: 'Milkshake' },
  { name: 'Matcha Lavander',  desc: 'Matcha frío con cold foam de lavanda. Refrescante y floral.',                 price: 94,  img: I('iced-matcha-lavander-cold-foam'), tag: 'Matcha' },
  { name: 'Dirty Chai',            desc: 'Mezcla fría de chai y café con hielo. Lo mejor de dos mundos.',              price: 93,  img: I('dirty-chai'),                     tag: 'Chai' },
  { name: 'Pink Coconut Drink',    desc: 'Mezcla de bebida de coco y fresa con hielo. Tropical y refrescante.',        price: 89,  img: I('pink-coconut-drink'),             tag: 'Fitfresh' },
];

const SCHEDULE = [
  { day: 'Lunes – Viernes', hours: '8:00 AM – 9:00 PM' },
  { day: 'Sábado', hours: '9:00 AM – 10:00 PM' },
  { day: 'Domingo', hours: '10:00 AM – 8:00 PM' },
];

export default function Landing() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [openSched, setOpenSched] = useState(null);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('hos_customer_token');
  const heroVideoRef = useRef(null);

  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
    document.addEventListener('click', tryPlay, { once: true });
    return () => {
      document.removeEventListener('touchstart', tryPlay);
      document.removeEventListener('click', tryPlay);
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/products`).then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    const cur = document.getElementById('hs-cur');

    const onScroll = () => {
      setNavScrolled(window.scrollY > 60);
      document.querySelectorAll('.hs-rev').forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.88) el.classList.add('on');
      });
    };

    const onMouseMove = (e) => {
      if (cur) { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }
    };
    const onMouseEnter = () => cur?.classList.add('h');
    const onMouseLeave = () => cur?.classList.remove('h');

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove);
    document.querySelectorAll('a,button').forEach(el => {
      el.addEventListener('mouseenter', onMouseEnter);
      el.addEventListener('mouseleave', onMouseLeave);
    });

    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: '#FFFFFF', fontFamily: "'Montserrat', sans-serif", cursor: 'none' }}>
      {/* Cursor */}
      <div id="hs-cur" />

      {/* ── NAVBAR ── */}
      <nav id="hs-nav" className={navScrolled ? 'sc' : ''}>
        {/* Izquierda: links */}
        <ul className="hs-nav-links">
          <li><Link to="/menu">Menú</Link></li>
          <li><a onClick={() => scrollTo('hs-rewards')}>Rewards</a></li>
          <li><a onClick={() => scrollTo('hs-location')}>Encuéntranos</a></li>
        </ul>
        {/* Centro: logo */}
        <a className="hs-nav-logo-center" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/logo-encabezado.png" alt="House of Shake" className="hs-nav-logo-img" />
        </a>
        {/* Derecha: CTAs */}
        <div className="hs-nav-ctas">
          {isLoggedIn ? (
            <Link to="/mi-cuenta" className="hs-btn hs-btn-gold" style={{ padding: '10px 20px', fontSize: '10px' }}>
              MI CUENTA
            </Link>
          ) : (
            <>
              <Link to="/login" className="hs-btn hs-btn-ghost" style={{ padding: '10px 20px', fontSize: '10px' }}>
                INICIAR SESIÓN
              </Link>
              <Link to="/registro" className="hs-btn hs-btn-gold" style={{ padding: '10px 20px', fontSize: '10px' }}>
                ÚNETE
              </Link>
            </>
          )}
        </div>
        <button
          className={`hs-burger${mobileMenuOpen ? ' open' : ''}`}
          onClick={() => setMobileMenuOpen(v => !v)}
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileMenuOpen}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── MOBILE MENU ── */}
      <div className={`hs-mnav${mobileMenuOpen ? ' open' : ''}`}>
        <ul className="hs-mnav-links">
          <li><Link to="/menu" onClick={() => setMobileMenuOpen(false)}>Menú</Link></li>
          <li><a onClick={() => scrollTo('hs-rewards')}>Rewards</a></li>
          <li><a onClick={() => scrollTo('hs-location')}>Encuéntranos</a></li>
        </ul>
        <div className="hs-mnav-ctas">
          {isLoggedIn ? (
            <Link to="/mi-cuenta" className="hs-btn hs-btn-gold" onClick={() => setMobileMenuOpen(false)}>
              MI CUENTA
            </Link>
          ) : (
            <>
              <Link to="/login" className="hs-btn hs-btn-ghost" onClick={() => setMobileMenuOpen(false)}>
                INICIAR SESIÓN
              </Link>
              <Link to="/registro" className="hs-btn hs-btn-gold" onClick={() => setMobileMenuOpen(false)}>
                ÚNETE
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── HERO ── */}
      <section id="hs-hero">
        <video
          ref={heroVideoRef}
          className="hs-hero-img"
          poster="/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          disablePictureInPicture
          style={{ objectFit:'cover', width:'100%', height:'100%' }}
        >
          <source src="/hero-mobile.mp4" media="(max-width: 768px)" type="video/mp4" />
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="hs-hero-ov1" />
        <div className="hs-hero-ov2" />
        {[{l:'7%',t:'22%',d:'5s',dl:'0s',sz:'5px'},{l:'16%',t:'68%',d:'4s',dl:'.5s',sz:'4px'},
          {l:'28%',t:'38%',d:'6s',dl:'1s',sz:'6px'},{l:'83%',t:'28%',d:'5s',dl:'.3s',sz:'4px'},
          {l:'91%',t:'62%',d:'4.5s',dl:'1.2s',sz:'5px'},{l:'72%',t:'18%',d:'6s',dl:'.8s',sz:'3px'}
        ].map((s,i) => (
          <div key={i} className="hs-sp" style={{ left:s.l,top:s.t,'--d':s.d,'--dl':s.dl,'--sz':s.sz }} />
        ))}
        <div className="hs-hero-body">
          <div className="hs-camp-badge"><TentIcon size={14} color="#0F448B" animated /> Summer Camp Edition 2026</div>
          <h1 className="hs-hero-title">HOUSE<br /><span className="acc">OF</span><br />SHAKE</h1>
          <div className="hs-hero-ctas">
            <Link to="/registro" className="hs-btn hs-btn-gold">ÚNETE AL PROGRAMA</Link>
            <Link to="/menu" className="hs-btn hs-btn-ghost">VER MENÚ COMPLETO</Link>
          </div>
        </div>
      </section>

      {/* ── MENU ── */}
      <section id="hs-menu">
        <div className="hs-menu-hdr hs-rev">
          <p className="hs-eyebrow" style={{ justifyContent:'center' }}>Specialty Drinks</p>
          <h2 className="hs-h-dark">NUESTRO MENÚ</h2>
          <p className="hs-sub-dark">Cada bebida, diseñada para que vuelvas.</p>
        </div>
        <div className="hs-mgrid">
          {FEATURED_ITEMS.map((p, i) => (
            <Link key={i} to="/menu" className="hs-mcard hs-rev" style={{ textDecoration:'none', display:'block' }}>
              <div className="hs-cimg" style={{ position:'relative', overflow:'hidden' }}>
                {p.img ? (
                  <img src={p.img} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} onError={e => { e.target.style.display='none'; }} />
                ) : null}
                <div style={{ position:'absolute', bottom:12, right:12, zIndex:3, display:'flex', filter:'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }}><CoffeeIcon size={28} color="#0F448B" animated /></div>
                <span className="hs-cbadge" style={{ zIndex:2 }}>{p.tag}</span>
              </div>
              <div className="hs-cbody">
                <p className="hs-cname">{p.name}</p>
                <p className="hs-cdesc">{p.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ textAlign:'center', marginTop:48, display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/menu" className="hs-btn hs-btn-gold">VER MENÚ COMPLETO — 39 PRODUCTOS</Link>
          <Link to="/registro" className="hs-btn hs-btn-blue">ÚNETE Y GANA PUNTOS</Link>
        </div>
      </section>

      {/* ── REWARDS ── */}
      <Rewards isLoggedIn={isLoggedIn} />

      {/* ── LOCATION ── */}
      <section id="hs-location">
        <div className="hs-rev">
          <p className="hs-eyebrow">Visítanos</p>
          <h2 className="hs-h-dark">ESTAMOS AQUÍ.</h2>
          <p className="hs-sub-dark">Ven cuando quieras. Abrimos cuando el día lo necesita.</p>
        </div>
        <div className="hs-loc-grid">
          <div className="hs-map-box hs-rev">
            <iframe
              src="https://maps.google.com/maps?q=Av.+Teziutl%C3%A1n+Nte.+42+La+Paz+Puebla&output=embed"
              width="100%" height="450" style={{ border:0, display:'block' }}
              allowFullScreen loading="lazy" title="Mapa House of Shake"
            />
          </div>
          <div className="hs-rev">
            <p className="hs-sched-lbl">Horarios de atención</p>
            {SCHEDULE.map((s, i) => (
              <div key={i} className="hs-di">
                <button className={`hs-dbtn${openSched === i ? ' open' : ''}`}
                  onClick={() => setOpenSched(openSched === i ? null : i)}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span className="hs-dinit">{['L','S','D'][i]}</span>
                    {s.day}
                  </div>
                  <span style={{ color: openSched === i ? '#0F448B' : undefined }}>
                    {openSched === i ? '−' : '+'}
                  </span>
                </button>
                {openSched === i && <div className="hs-dcontent">{s.hours}</div>}
              </div>
            ))}
            <div className="hs-addr">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:2 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0F448B"/>
              </svg>
              <div>
                <h4>Av. Teziutlán Nte. 42</h4>
                <p>Col. La Paz, CP 72160<br />Puebla, Pue. México</p>
              </div>
            </div>
            <a href="https://maps.google.com/?q=Av.+Teziutl%C3%A1n+Nte.+42+La+Paz+Puebla"
              target="_blank" rel="noreferrer" className="hs-btn hs-btn-blue" style={{ marginBottom:14, display:'inline-flex' }}>
              CÓMO LLEGAR
            </a>
            <div className="hs-del-btns">
              <a href="https://www.uber.com" target="_blank" rel="noreferrer" className="hs-dchip">
                <img src="/images/uber-eats-logo.svg" alt="Uber Eats" style={{ height: 13, width: 'auto' }} />
              </a>
              <a href="https://www.rappi.com.mx" target="_blank" rel="noreferrer" className="hs-dchip">
                <img src="/images/rappi-logo.svg" alt="Rappi" style={{ height: 13, width: 'auto' }} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="hs-footer">
        <div className="hs-ftgrid">
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              {LOGO_IMG}
              <p className="hs-ft-logo-txt">HOUSE OF SHAKE</p>
            </div>
            <p className="hs-ft-p">Specialty coffee & cold shakes.<br />Av. Teziutlán Nte. 42, La Paz,<br />Puebla, Pue. México.</p>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hs-dchip" style={{ padding:'7px 12px' }}>IG</a>
              <a href="https://www.uber.com" target="_blank" rel="noreferrer" className="hs-dchip" style={{ padding:'7px 12px' }}>
                <img src="/images/uber-eats-logo.svg" alt="Uber Eats" style={{ height: 11, width: 'auto' }} />
              </a>
              <a href="https://www.rappi.com.mx" target="_blank" rel="noreferrer" className="hs-dchip" style={{ padding:'7px 12px' }}>
                <img src="/images/rappi-logo.svg" alt="Rappi" style={{ height: 11, width: 'auto' }} />
              </a>
            </div>
          </div>
          <div>
            <p className="hs-ft-h">Menú</p>
            <ul className="hs-ft-links">
              <li><a onClick={() => scrollTo('hs-menu')}>Cafés Calientes</a></li>
              <li><a onClick={() => scrollTo('hs-menu')}>Bebidas Frías</a></li>
              <li><a onClick={() => scrollTo('hs-menu')}>Cold Brew</a></li>
              <li><a onClick={() => scrollTo('hs-menu')}>Alimentos</a></li>
            </ul>
          </div>
          <div>
            <p className="hs-ft-h">Fidelización</p>
            <ul className="hs-ft-links">
              <li><Link to="/registro">Crear cuenta</Link></li>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/mi-cuenta">Mi tarjeta</Link></li>
            </ul>
          </div>
          <div>
            <p className="hs-ft-h">Visítanos</p>
            <ul className="hs-ft-links">
              <li><a onClick={() => scrollTo('hs-location')}>Encuéntranos</a></li>
              <li><a onClick={() => scrollTo('hs-location')}>Horarios</a></li>
              <li><Link to="/admin/login">Admin</Link></li>
              <li><Link to="/staff">Staff</Link></li>
            </ul>
          </div>
        </div>
        <div className="hs-ft-bottom">
          <p className="hs-ft-copy">© 2026 House of Shake. Todos los derechos reservados.</p>
          <p className="hs-ft-copy">La Paz, Puebla, México</p>
        </div>
      </footer>
    </div>
  );
}
