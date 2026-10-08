import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const NAVY = '#071E3D';
const BLUE = '#0F448B';
const BLUE_LIGHT = 'rgba(15,68,139,.12)';
const BLUE_MID   = 'rgba(15,68,139,.25)';
const CREAM = '#FBF7F0';

/* ── SVG icons for sidebar nav ── */
function NavIcon({ d, viewBox = '0 0 24 24', size = 18, color = 'currentColor', fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {d}
    </svg>
  );
}
const IconDashboard   = ({ c }) => <NavIcon color={c} d={<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>} />;
const IconPOS         = ({ c }) => <NavIcon color={c} d={<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h3"/><path d="M14 15h3"/></>} />;
const IconClientes    = ({ c }) => <NavIcon color={c} d={<><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/><circle cx="19" cy="8" r="2.5"/><path d="M22 21v-1.5a2.5 2.5 0 00-2.5-2.5"/></>} />;
const IconTransacc    = ({ c }) => <NavIcon color={c} d={<><path d="M7 16V4m0 0L4 7m3-3l3 3"/><path d="M17 8v12m0 0l3-3m-3 3l-3-3"/></>} />;
const IconPersonal    = ({ c }) => <NavIcon color={c} d={<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>} />;
const IconProductos   = ({ c }) => <NavIcon color={c} d={<><path d="M3 5h18M3 12h18M3 19h18"/></>} />;
const IconWallet      = ({ c }) => <NavIcon color={c} d={<><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="17" cy="12" r="1.5" fill={c} stroke="none"/><path d="M2 9h20"/></>} />;
const IconConfig      = ({ c }) => <NavIcon color={c} d={<><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>} />;
const IconLogout      = ({ c }) => <NavIcon color={c} d={<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />;

const nav = [
  { path: '/admin/',            label: 'Dashboard',    short: 'Home',    Icon: IconDashboard },
  { path: '/admin/pos',         label: 'POS · Cobrar', short: 'Cobrar',  Icon: IconPOS },
  { path: '/admin/customers',   label: 'Clientes',     short: 'Clientes',Icon: IconClientes },
  { path: '/admin/transactions',label: 'Transacciones',short: 'Movs',    Icon: IconTransacc },
  { path: '/admin/personal',    label: 'Personal',     short: 'Staff',   Icon: IconPersonal },
  { path: '/admin/products',    label: 'Productos',    short: 'Menú',    Icon: IconProductos },
  { path: '/admin/wallet',      label: 'Apple Wallet', short: 'Wallet',  Icon: IconWallet },
  { path: '/admin/config',      label: 'Configuración',short: 'Config',  Icon: IconConfig },
];

function isActive(item, pathname) {
  if (item.path === '/admin/') return pathname === '/admin/' || pathname === '/admin';
  return pathname.startsWith(item.path);
}

const LOGO_BADGE = (size = 38) => (
  <img src="/logo-encabezado.png" alt="House of Shake" height={size}
    style={{ objectFit: 'contain', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
);

function SidebarNav({ pathname, onItemClick }) {
  return (
    <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
      {nav.map(item => {
        const active = isActive(item, pathname);
        const iconColor = active ? '#FFFFFF' : 'rgba(255,255,255,.55)';
        return (
          <Link key={item.path} to={item.path} onClick={onItemClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 2,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              background: active ? BLUE_LIGHT : 'transparent',
              color: active ? '#FFFFFF' : 'rgba(255,255,255,.6)',
              borderLeft: active ? `3px solid ${BLUE}` : '3px solid transparent',
              paddingLeft: active ? 9 : 12,
              transition: 'all .15s',
            }}
          >
            <item.Icon c={iconColor} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const admin = JSON.parse(localStorage.getItem('hos_admin') || '{}');

  function handleLogout() {
    localStorage.removeItem('hos_admin_token');
    localStorage.removeItem('hos_admin');
    navigate('/admin/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside style={{
        width: 240, background: NAVY,
        borderRight: `1px solid rgba(255,255,255,.06)`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 50, flexShrink: 0,
      }} className="desktop-sidebar">

        {/* Logo */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'center' }}>
          {LOGO_BADGE(44)}
        </div>

        <SidebarNav pathname={location.pathname} />

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ padding: '0 12px', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', textTransform: 'capitalize' }}>{admin.role}</p>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            background: BLUE, border: 'none', cursor: 'pointer',
            fontSize: 12, color: '#FFFFFF', textAlign: 'left',
            fontFamily: 'inherit', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'opacity .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <IconLogout c="#FFFFFF" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0,
        height: 60, background: NAVY, borderBottom: '1px solid rgba(255,255,255,.08)',
        zIndex: 40, alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {LOGO_BADGE(34)}
        </div>
        <button onClick={() => setDrawerOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, borderRadius: 8, color: '#FFFFFF',
        }}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="19" y2="6"/>
            <line x1="3" y1="11" x2="19" y2="11"/>
            <line x1="3" y1="16" x2="19" y2="16"/>
          </svg>
        </button>
      </header>

      {/* ── MOBILE DRAWER ── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex' }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} />
          <aside style={{
            position: 'relative', width: 280, background: NAVY,
            height: '100%', display: 'flex', flexDirection: 'column',
            boxShadow: '4px 0 32px rgba(0,0,0,.35)',
          }}>
            <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {LOGO_BADGE(38)}
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,.5)', fontSize: 18 }}>✕</button>
            </div>
            <SidebarNav pathname={location.pathname} onItemClick={() => setDrawerOpen(false)} />
            <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: CREAM }}>{admin.email}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', textTransform: 'capitalize' }}>{admin.role}</p>
              </div>
              <button onClick={handleLogout} style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                background: BLUE, border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#FFFFFF', fontWeight: 700,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <IconLogout c="#FFFFFF" />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: NAVY, borderTop: '1px solid rgba(255,255,255,.08)',
        zIndex: 40, padding: '6px 0 env(safe-area-inset-bottom)',
      }} className="mobile-bottom-nav">
        {nav.map(item => {
          const active = isActive(item, location.pathname);
          const iconColor = active ? '#FFFFFF' : 'rgba(255,255,255,.4)';
          return (
            <Link key={item.path} to={item.path}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: '6px 4px',
                textDecoration: 'none', color: active ? '#FFFFFF' : 'rgba(255,255,255,.4)',
                transition: 'color .15s', minWidth: 0,
              }}
            >
              <item.Icon c={iconColor} />
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: .3,
                textTransform: 'uppercase', lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {item.short}
              </span>
              {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#FFFFFF', marginTop: 1 }} />}
            </Link>
          );
        })}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex: 1,
        marginLeft: 240,
        minWidth: 0,
        padding: '32px 28px',
        background: '#FFFFFF',
      }} className="layout-main">
        {children}
      </main>

      <style>{`
        @media (max-width: 1023px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .layout-main { margin-left: 0 !important; padding: 76px 18px 84px !important; }
        }
        @media (min-width: 1024px) {
          .mobile-header { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
        }
        @media (min-width: 1024px) and (max-width: 1180px) {
          .layout-main { padding: 28px 22px !important; }
        }
      `}</style>
    </div>
  );
}
