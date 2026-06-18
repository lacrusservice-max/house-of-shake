import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/landing.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const LOGO_SVG = (
  <svg width="42" height="42" viewBox="0 0 44 44" fill="none">
    <circle cx="22" cy="22" r="22" fill="#1A4DB3"/>
    <path d="M16.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" fill="white"/>
    <path d="M27.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" fill="white"/>
    <path d="M22 11c-6.075 0-11 4.925-11 11v3c0 2.2 1.8 4 4 4h2v4c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-4h2c2.2 0 4-1.8 4-4v-3c0-6.075-4.925-11-11-11z" fill="white"/>
    <circle cx="19" cy="22" r="1.5" fill="#1A4DB3"/>
    <circle cx="25" cy="22" r="1.5" fill="#1A4DB3"/>
    <path d="M20 26q2 2 4 0" stroke="#1A4DB3" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

const REVIEWS = [
  [
    { txt: '"Me encanta como preparan el foam. Nunca había probado algo así en Puebla."', name: 'Fernanda L.', src: 'Uber Eats · Verificada', stars: 5 },
    { txt: '"Excelente bebida y me llegó rápido. El Coconut Iced Latte es para repetir sin dudarlo."', name: 'Regina C.', src: 'Uber Eats · Verificada', stars: 5 },
    { txt: '"Muy buena atención y la bebida llegó perfecta. El matcha fue una experiencia."', name: 'Sofía R.', src: 'Rappi · Verificada', stars: 5 },
  ],
  [
    { txt: '"El Tiramisu Latte es una locura. Nunca pensé que iba a querer un latte de postre."', name: 'Mariana G.', src: 'Rappi · Verificada', stars: 5 },
    { txt: '"Pedí el Pistachio Milkshake y tardó menos de 30 minutos. Frío, cremoso, perfecto."', name: 'Andrés V.', src: 'Uber Eats · Verificado', stars: 5 },
    { txt: '"El matcha con lavender cold foam es distinto a todo lo que he probado."', name: 'Paula S.', src: 'Rappi · Verificada', stars: 5 },
  ],
  [
    { txt: '"La cookie de chocolate llegó caliente. ¿Cómo hicieron eso?"', name: 'Pablo M.', src: 'Rappi · Verificado', stars: 5 },
    { txt: '"El packaging está increíble. Ya quisiera que todos los pedidos llegaran así de bien."', name: 'Camila T.', src: 'Uber Eats · Verificada', stars: 5 },
    { txt: '"La Strawberry Acai Lemonade es mi nueva obsesión de verano."', name: 'Laura B.', src: 'Uber Eats · Verificada', stars: 5 },
  ],
];

const ACCORDION_ITEMS = [
  { num: '01', title: 'SPECIALTY COFFEE', desc: 'Granos seleccionados, preparación precisa y un foam que no encontrarás en otro lugar de Puebla.', img: '/images/img_8.png' },
  { num: '02', title: 'COLD SHAKES', desc: 'Recetas únicas que combinan sabores inesperados. Cada shake, una experiencia distinta.', img: '/images/img_9.png' },
  { num: '03', title: 'CAMP VIBES', desc: 'Un espacio diseñado para que te quedes. Buena música, buena luz y mejor café.', img: '/images/img_10.png' },
  { num: '04', title: 'DELIVERY EXPRESS', desc: 'Pedimos que tu orden llegue exactamente como la preparamos. En tiempo, temperatura y detalle.', img: '/images/img_11.png' },
  { num: '05', title: 'PROGRAMA PUNTOS', desc: 'Cada visita suma. Acumula puntos y canjéalos por bebidas gratis. Así de simple.', img: '/images/img_12.png' },
];

const CATEGORY_EMOJIS = { café: '☕', frío: '🧊', especiales: '✨', alimentos: '🥐', bebida: '🥤' };

const SCHEDULE = [
  { day: 'Lunes – Viernes', hours: '8:00 AM – 9:00 PM' },
  { day: 'Sábado', hours: '9:00 AM – 10:00 PM' },
  { day: 'Domingo', hours: '10:00 AM – 8:00 PM' },
];

export default function Landing() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeAcc, setActiveAcc] = useState(0);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [reviewSlide, setReviewSlide] = useState(0);
  const [openSched, setOpenSched] = useState(null);
  const [counts, setCounts] = useState({ ratings: 0, stars: 0, ig: 0, months: 0 });
  const statsRef = useRef(null);
  const statsAnimated = useRef(false);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('hos_customer_token');

  // Load products
  useEffect(() => {
    fetch(`${API}/products`).then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  // Navbar scroll + progress bar + reveal
  useEffect(() => {
    const prog = document.getElementById('hs-prog');
    const cur = document.getElementById('hs-cur');

    const onScroll = () => {
      setNavScrolled(window.scrollY > 60);
      if (prog) {
        const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        prog.style.width = pct + '%';
      }
      // Reveal
      document.querySelectorAll('.hs-rev').forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.88) el.classList.add('on');
      });
      // Stats counter
      if (statsRef.current && !statsAnimated.current) {
        const r = statsRef.current.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9) {
          statsAnimated.current = true;
          animateCounters();
        }
      }
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

  function animateCounters() {
    const targets = { ratings: 86, stars: 4.0, ig: 2487, months: 30 };
    const dur = 1800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = p < .5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setCounts({
        ratings: Math.round(targets.ratings * ease),
        stars: parseFloat((targets.stars * ease).toFixed(1)),
        ig: Math.round(targets.ig * ease),
        months: Math.round(targets.months * ease),
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const grouped = products.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});
  const categories = Object.keys(grouped);
  const filteredProducts = activeTab === 'all' ? products : (grouped[activeTab] || []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: '#0B1509', fontFamily: "'Montserrat', sans-serif", cursor: 'none' }}>
      {/* Cursor + Progress */}
      <div id="hs-cur" />
      <div id="hs-prog" />

      {/* ── NAVBAR ── */}
      <nav id="hs-nav" className={navScrolled ? 'sc' : ''}>
        <a className="hs-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          {LOGO_SVG}
          <span className="hs-nav-logo-txt">HOUSE OF SHAKE</span>
        </a>
        <ul className="hs-nav-links">
          <li><a onClick={() => scrollTo('hs-about')}>Nosotros</a></li>
          <li><a onClick={() => scrollTo('hs-menu')}>Menú</a></li>
          <li><a onClick={() => scrollTo('hs-reviews')}>Reseñas</a></li>
          <li><a onClick={() => scrollTo('hs-location')}>Encuéntranos</a></li>
        </ul>
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
      </nav>

      {/* ── HERO ── */}
      <section id="hs-hero">
        <div className="hs-hero-img" style={{ backgroundImage: "url('/images/img_1.png')" }} />
        <div className="hs-hero-ov1" />
        <div className="hs-hero-ov2" />
        {/* sparks */}
        {[{l:'7%',t:'22%',d:'5s',dl:'0s',sz:'5px'},{l:'16%',t:'68%',d:'4s',dl:'.5s',sz:'4px'},
          {l:'28%',t:'38%',d:'6s',dl:'1s',sz:'6px'},{l:'83%',t:'28%',d:'5s',dl:'.3s',sz:'4px'},
          {l:'91%',t:'62%',d:'4.5s',dl:'1.2s',sz:'5px'},{l:'72%',t:'18%',d:'6s',dl:'.8s',sz:'3px'}
        ].map((s,i) => (
          <div key={i} className="hs-sp" style={{ left:s.l,top:s.t,'--d':s.d,'--dl':s.dl,'--sz':s.sz }} />
        ))}
        <div className="hs-hero-body">
          <div className="hs-camp-badge">⛺ Summer Camp Edition 2026</div>
          <h1 className="hs-hero-title">HOUSE<br /><span className="acc">OF</span><br />SHAKE</h1>
          <p className="hs-hero-sub">COFFEE THAT KNOWS NO BOUNDARIES</p>
          <p className="hs-hero-desc">Specialty coffee, cold shakes y un espacio diseñado para los que saben lo que quieren. La Paz, Puebla.</p>
          <div className="hs-hero-ctas">
            <Link to="/registro" className="hs-btn hs-btn-gold">ÚNETE AL PROGRAMA</Link>
            <a href="https://www.uber.com" target="_blank" rel="noreferrer" className="hs-btn hs-btn-ghost">PEDIR A DOMICILIO</a>
          </div>
        </div>
        <div className="hs-scroll-ind">
          <div className="hs-scroll-line" />
          <span>scroll</span>
        </div>
        <div className="hs-hero-badges">
          <div className="hs-hbadge"><strong>86</strong> Reseñas</div>
          <div className="hs-hbadge"><strong>4.0★</strong> Rating</div>
          <div className="hs-hbadge"><strong>2K+</strong> Seguidores IG</div>
          <div className="hs-hbadge"><strong>La Paz</strong> Puebla</div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="hs-about">
        <div className="hs-about-grid">
          <div className="hs-about-img">
            <img src="/images/img_2.png" alt="House of Shake interior" />
            <div className="hs-about-imgov" />
          </div>
          <div className="hs-about-txt">
            <p className="hs-eyebrow hs-rev">Nuestra historia</p>
            <h2 className="hs-about-q hs-rev">EL CAFÉ QUE <span className="hl">CAMBIA</span> TODO LO QUE CONOCÍAS.</h2>
            <p className="hs-about-p hs-rev">House of Shake nació con una idea simple: que cada bebida sea una razón para volver. Nos obsesionamos con los detalles — el foam, la temperatura, el balance — porque creemos que el café merece más que lo de siempre.</p>
            <p className="hs-about-p hs-rev">Desde Av. Teziutlán Nte. en La Paz, Puebla, llevamos nuestro café hasta tu puerta o te esperamos aquí.</p>
            <div className="hs-about-chips hs-rev" style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
              {['Specialty Coffee', 'Cold Brew', 'Cold Shakes', 'Pastelería', 'Delivery'].map(c => (
                <span key={c} className="hs-chip">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section id="hs-gallery">
        <div className="hs-gcell span2">
          <img src="/images/img_3.png" alt="House of Shake" />
          <div className="hs-gcell-ov" /><div className="hs-gcell-lbl">CAMP HOUSE</div>
          <span style={{ position:'absolute',top:16,left:16,zIndex:2,background:'rgba(11,21,9,.85)',backdropFilter:'blur(8px)',border:'1px solid rgba(245,200,66,.28)',borderRadius:6,padding:'8px 12px',fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'#F5C842',fontWeight:700,fontFamily:'Montserrat' }}>LA PAZ · PUEBLA</span>
        </div>
        <div className="hs-gcell"><img src="/images/img_4.png" alt="" /><div className="hs-gcell-ov" /><div className="hs-gcell-lbl">COLD SHAKES</div></div>
        <div className="hs-gcell"><img src="/images/img_5.png" alt="" /><div className="hs-gcell-ov" /><div className="hs-gcell-lbl">SPECIALTY</div></div>
        <div className="hs-gcell"><img src="/images/img_6.png" alt="" /><div className="hs-gcell-ov" /><div className="hs-gcell-lbl">COLD BREW</div></div>
        <div className="hs-gcell"><img src="/images/img_7.png" alt="" /><div className="hs-gcell-ov" /><div className="hs-gcell-lbl">CAMP VIBES</div></div>
      </section>

      {/* ── ACCORDION — POR QUÉ SOMOS DISTINTOS ── */}
      <section id="hs-accordion">
        <div className="hs-rev" style={{ textAlign:'center', marginBottom:52 }}>
          <p className="hs-eyebrow" style={{ justifyContent:'center' }}>House of Shake</p>
          <h2 className="hs-h-light">POR QUÉ SOMOS<br />DISTINTOS</h2>
          <p className="hs-sub-light">Desde el primer sorbo, lo notas.</p>
        </div>
        <div className="hs-acc-wrap hs-rev">
          {ACCORDION_ITEMS.map((item, i) => (
            <div key={i} className={`hs-ap${activeAcc === i ? ' apon' : ''}`}
              onClick={() => setActiveAcc(i)}>
              <div className="hs-ap-img" style={{ backgroundImage: `url('${item.img}')` }} />
              <div className="hs-ap-tint" />
              <span className="hs-ap-lbl">{item.title}</span>
              <div className="hs-ap-txt">
                <p className="hs-ap-num">{item.num} / 05</p>
                <h3 className="hs-ap-title">{item.title}</h3>
                <p className="hs-ap-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MENU ── */}
      <section id="hs-menu">
        <div className="hs-menu-hdr hs-rev">
          <p className="hs-eyebrow" style={{ justifyContent:'center' }}>Specialty Drinks</p>
          <h2 className="hs-h-dark">NUESTRO MENÚ</h2>
          <p className="hs-sub-dark">Cada bebida, diseñada para que vuelvas.</p>
          <div style={{ position:'relative' }}>
            <div className="hs-tabs">
              <button className={`hs-tab${activeTab === 'all' ? ' on' : ''}`} onClick={() => setActiveTab('all')}>Todo</button>
              {categories.map(cat => (
                <button key={cat} className={`hs-tab${activeTab === cat ? ' on' : ''}`} onClick={() => setActiveTab(cat)}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="hs-mgrid">
          {filteredProducts.map((p, i) => (
            <div key={p.id} className="hs-mcard hs-rev">
              <div className="hs-cimg">
                <div className="hs-cimg-ph">{CATEGORY_EMOJIS[p.category] || '☕'}</div>
                <span className="hs-cbadge">+{p.pointsValue} pts</span>
              </div>
              <div className="hs-cbody">
                <p className="hs-cname">{p.name}</p>
                <p className="hs-cdesc">{p.description || 'Specialty drink House of Shake'}</p>
                <div className="hs-cfoot">
                  <span className="hs-cprice">${p.price}</span>
                  <span className="hs-ctag">MXN</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {products.length === 0 && (
          <p style={{ textAlign:'center', color:'rgba(251,247,240,.3)', padding:'60px 0' }}>Cargando menú...</p>
        )}
        <div style={{ textAlign:'center', marginTop:48 }}>
          <Link to="/registro" className="hs-btn hs-btn-blue">ÚNETE Y GANA PUNTOS</Link>
        </div>
      </section>

      {/* ── LOYALTY CTA ── */}
      <section id="hs-loyalty">
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <p className="hs-eyebrow hs-rev" style={{ justifyContent:'center' }}>Programa de Fidelización</p>
          <h2 className="hs-h-dark hs-rev" style={{ fontSize:'clamp(2.5rem,6vw,5.5rem)' }}>
            CADA CAFÉ<br /><span style={{ color:'#F5C842' }}>TE RECOMPENSA</span>
          </h2>
          <p className="hs-sub-dark hs-rev">Acumula 1 punto por cada $1 MXN gastado. 100 puntos = $5 MXN de descuento. Sin complicaciones.</p>
          <div className="hs-rev" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:48, maxWidth:700, margin:'0 auto 48px' }}>
            {[
              { icon:'📝', title:'Regístrate gratis', desc:'En menos de un minuto desde esta página.' },
              { icon:'☕', title:'Compra y acumula', desc:'Muestra tu QR al staff en cada visita.' },
              { icon:'🎁', title:'Canjea beneficios', desc:'100 puntos = $5 MXN. Niveles Bronze, Silver y Gold.' },
            ].map(s => (
              <div key={s.title} style={{ background:'rgba(251,247,240,.04)', border:'1px solid rgba(245,200,66,.1)', borderRadius:10, padding:28 }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>{s.icon}</div>
                <p style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.2rem', letterSpacing:2, color:'#FBF7F0', marginBottom:6 }}>{s.title}</p>
                <p style={{ fontSize:12, color:'rgba(251,247,240,.45)', lineHeight:1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="hs-rev" style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/registro" className="hs-btn hs-btn-gold">CREAR MI CUENTA GRATIS</Link>
            {isLoggedIn && <Link to="/mi-cuenta" className="hs-btn hs-btn-ghost">VER MIS PUNTOS</Link>}
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="hs-marquee-wrap">
        <div className="hs-marquee">
          {[...Array(2)].map((_, rep) => (
            <span key={rep} style={{ display:'contents' }}>
              <span>HOUSE OF SHAKE</span><span className="dot">⛺</span>
              <span>CAMP HOUSE</span><span className="dot">🌲</span>
              <span>COLD SHAKES</span><span className="dot">🐻</span>
              <span>GOOD VIBES</span><span className="dot">☕</span>
              <span>SPECIALTY COFFEE</span><span className="dot">⛺</span>
              <span>LA PAZ PUEBLA</span><span className="dot">🌿</span>
              <span>SUMMER CAMP</span><span className="dot">🧊</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="hs-stats" ref={statsRef}>
        <div className="hs-si hs-rev">
          <div className="hs-snum"><span>{counts.ratings}</span></div>
          <div className="hs-slbl">Calificaciones</div>
        </div>
        <div className="hs-si hs-rev">
          <div className="hs-snum"><span>{counts.stars.toFixed(1)}</span><span className="hs-su">★</span></div>
          <div className="hs-slbl">Rating Promedio</div>
        </div>
        <div className="hs-si hs-rev">
          <div className="hs-snum"><span>{counts.ig.toLocaleString()}</span></div>
          <div className="hs-slbl">Seguidores IG</div>
        </div>
        <div className="hs-si hs-rev">
          <div className="hs-snum"><span>{counts.months}</span><span className="hs-su">+</span></div>
          <div className="hs-slbl">Meses en La Paz</div>
        </div>
      </div>

      {/* ── REVIEWS ── */}
      <section id="hs-reviews">
        <div className="hs-rev-hdr hs-rev">
          <p className="hs-eyebrow" style={{ justifyContent:'center' }}>Social Proof</p>
          <h2 className="hs-h-light">LO QUE DICEN<br />LOS QUE YA SABEN</h2>
          <div className="hs-rating-num">4.0</div>
          <div className="hs-stars">
            <span className="hs-s">★★★★</span>
            <span style={{ color:'#ccc', fontSize:22 }}>★</span>
          </div>
          <p className="hs-rev-sub">86 calificaciones · Uber Eats &amp; Rappi</p>
        </div>
        <div className="hs-carousel hs-rev">
          <div className="hs-ctrack" style={{ transform: `translateX(-${reviewSlide * 100}%)` }}>
            {REVIEWS.map((slide, si) => (
              <div key={si} className="hs-cslide">
                {slide.map((r, ri) => (
                  <div key={ri} className={`hs-rcard${ri === 1 ? ' mid' : ''}`}>
                    <div className="hs-r-stars">
                      {Array(r.stars).fill('★').map((s, i) => <span key={i}>{s}</span>)}
                    </div>
                    <p className="hs-r-txt">{r.txt}</p>
                    <p className="hs-r-name">{r.name}</p>
                    <p className="hs-r-src">{r.src}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="hs-cdots">
            {REVIEWS.map((_, i) => (
              <div key={i} className={`hs-dot${reviewSlide === i ? ' on' : ''}`} onClick={() => setReviewSlide(i)} />
            ))}
          </div>
        </div>

        {/* IG WALL */}
        <div style={{ textAlign:'center', marginTop:56, marginBottom:16 }}>
          <p className="hs-ig-handle">@houseofshake</p>
          <p className="hs-ig-fol">2,487 seguidores · Instagram</p>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hs-btn hs-btn-wood">
            SÍGUENOS EN IG
          </a>
        </div>
        <div className="hs-ig-wall">
          {[16,17,18,19,20,21].map(n => (
            <div key={n} className="hs-ig-cell">
              <img src={`/images/img_${n}.png`} alt="Instagram" />
            </div>
          ))}
        </div>
      </section>

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
                  <span style={{ color: openSched === i ? '#F5C842' : undefined }}>
                    {openSched === i ? '−' : '+'}
                  </span>
                </button>
                {openSched === i && <div className="hs-dcontent">{s.hours}</div>}
              </div>
            ))}
            <div className="hs-addr">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:2 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#F5C842"/>
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#1A4DB3"/><path d="M6 12h12M12 6v12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                Uber Eats
              </a>
              <a href="https://www.rappi.com.mx" target="_blank" rel="noreferrer" className="hs-dchip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#FF441F"/><path d="M8 8l4 4-4 4M12 8l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Rappi
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
              {LOGO_SVG}
              <p className="hs-ft-logo-txt">HOUSE OF SHAKE</p>
            </div>
            <p className="hs-ft-p">Specialty coffee & cold shakes.<br />Av. Teziutlán Nte. 42, La Paz,<br />Puebla, Pue. México.</p>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hs-dchip" style={{ padding:'7px 12px' }}>IG</a>
              <a href="https://www.uber.com" target="_blank" rel="noreferrer" className="hs-dchip" style={{ padding:'7px 12px' }}>Uber</a>
              <a href="https://www.rappi.com.mx" target="_blank" rel="noreferrer" className="hs-dchip" style={{ padding:'7px 12px' }}>Rappi</a>
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
