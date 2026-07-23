import { Link } from 'react-router-dom';
import {
  RegisterIcon, CoffeeIcon, GiftIcon, CardIcon, CakeIcon,
  LightningIcon, ChartIcon, SparkleIcon,
} from './Icons';

// ── Sistema de Pinos: 1 Pino = $10 MXN · 120 Pinos = bebida gratis ──

const STEPS = [
  {
    n: '01', Icon: RegisterIcon, title: 'ÚNETE GRATIS',
    body: <>Crea tu cuenta en menos de un minuto y recibe <b>+10 Pinos</b> de bienvenida. Tu tarjeta vive en Apple Wallet.</>,
  },
  {
    n: '02', Icon: CoffeeIcon, title: 'COMPRA Y SUMA',
    body: <>Muestra tu QR al staff en cada visita. Ganas <b>1 Pino por cada $10 MXN</b> que gastas. Sin apps extra.</>,
  },
  {
    n: '03', Icon: GiftIcon, title: 'CANJEA GRATIS',
    body: <>Al llegar a <b>120 Pinos</b> obtienes una bebida gratis de hasta $90 MXN. Y el ciclo vuelve a empezar.</>,
  },
];

const LADDER = [
  { pinos: '0',   label: 'Empiezas aquí' },
  { pinos: '30',  label: 'Vas arrancando' },
  { pinos: '60',  label: 'A mitad de camino' },
  { pinos: '90',  label: 'Ya casi lo tienes' },
  { pinos: null,  label: '¡Bebida gratis!', final: true },
];

const BENEFITS = [
  { Icon: GiftIcon,      title: '+10 Pinos de bienvenida', body: 'Solo por crear tu cuenta. Empiezas con ventaja desde el primer día.' },
  { Icon: CakeIcon,      title: '+20 Pinos en tu cumpleaños', body: 'Te celebramos con Pinos extra para que canjees tu bebida favorita.' },
  { Icon: LightningIcon, title: 'Pinos dobles', body: 'En temporadas y campañas especiales, cada Pino cuenta el doble.' },
  { Icon: CoffeeIcon,    title: 'Bebida gratis cada 120 Pinos', body: 'Hasta $90 MXN. Si tu bebida cuesta más, solo pagas la diferencia.' },
  { Icon: ChartIcon,     title: 'Consulta tus Pinos cuando quieras', body: 'Entra a tu cuenta online y revisa tu progreso hacia la próxima bebida gratis.' },
  { Icon: CardIcon,      title: 'Tarjeta en Apple Wallet', body: 'Tus Pinos siempre contigo. Sin apps, sin plásticos, sin complicaciones.' },
];

export default function Rewards({ isLoggedIn = false }) {
  return (
    <section id="hs-rewards">
      <div className="hs-rw-halo" />
      <div className="hs-rw-inner">

        {/* ── Header ── */}
        <div className="hs-rw-hdr hs-rev">
          <div className="hs-rw-coin"><SparkleIcon size={34} color="#1B2F56" animated /></div>
          <p className="hs-eyebrow" style={{ justifyContent: 'center' }}>House of Shake Rewards</p>
          <h2 className="hs-h-dark">GANA PINOS.<br />CANJEA BEBIDAS.</h2>
          <p className="hs-sub-dark" style={{ maxWidth: 560, margin: '10px auto 0' }}>
            Nuestro programa de recompensas. Cada café te acerca a tu próxima bebida gratis — así de simple.
          </p>
        </div>

        {/* ── Cómo funciona ── */}
        <div className="hs-rw-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="hs-rw-step hs-rev">
              <span className="hs-rw-step-n">{s.n}</span>
              <div className="hs-rw-ic"><s.Icon size={36} color="#F5C842" animated /></div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>

        {/* ── Ladder de Pinos ── */}
        <div className="hs-ladder-box hs-rev">
          <h3>TU CAMINO A LA BEBIDA GRATIS</h3>
          <p className="hs-ladder-sub">120 Pinos = 1 bebida gratis. Mira lo cerca que puedes estar.</p>
          <div className="hs-ladder">
            <div className="hs-ladder-track"><div className="hs-ladder-fill" /></div>
            {LADDER.map((n, i) => (
              <div key={i} className={`hs-node${n.final ? ' final' : ''}`}>
                <div className="hs-node-dot">
                  {n.final ? <GiftIcon size={30} color="#1B2F56" animated /> : n.pinos}
                </div>
                <div className="hs-node-text">
                  <span className="hs-node-pinos">{n.final ? '120 Pinos' : `${n.pinos} Pinos`}</span>
                  <span className="hs-node-lbl">{n.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Beneficios ── */}
        <div className="hs-tiers-title hs-rev">
          <p className="hs-eyebrow" style={{ justifyContent: 'center' }}>Beneficios de miembro</p>
          <h2 className="hs-h-dark" style={{ fontSize: 'clamp(2rem,4vw,3.2rem)' }}>TODO LO QUE GANAS AL UNIRTE</h2>
        </div>
        <div className="hs-benefits">
          {BENEFITS.map((b, i) => (
            <div key={i} className="hs-benefit hs-rev">
              <div className="hs-benefit-ic"><b.Icon size={26} color="#F5C842" animated /></div>
              <div>
                <h5>{b.title}</h5>
                <p>{b.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Apple Wallet CTA ── */}
        <div className="hs-rw-wallet hs-rev">
          <div>
            <p className="hs-eyebrow">Tu tarjeta, siempre contigo</p>
            <h3>LLEVA TUS <span>PINOS</span> EN EL CELULAR</h3>
            <p>
              Guarda tu tarjeta House of Shake en Apple Wallet. Tus Pinos se actualizan solos
              después de cada compra — sin apps que descargar ni tarjetas que perder.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {isLoggedIn ? (
                <Link to="/mi-cuenta" className="hs-btn hs-btn-gold">VER MIS PINOS</Link>
              ) : (
                <Link to="/registro" className="hs-btn hs-btn-gold">CREAR MI CUENTA GRATIS</Link>
              )}
              <Link to="/menu" className="hs-btn hs-btn-ghost">VER EL MENÚ</Link>
            </div>
          </div>
          <div className="hs-rw-wallet-img">
            <img src="/images/apple-wallet-banner.jpg" alt="Tarjeta House of Shake en Apple Wallet"
              onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
          </div>
        </div>

      </div>
    </section>
  );
}
