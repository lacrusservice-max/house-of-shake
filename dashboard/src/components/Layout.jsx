import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/mi-cuenta.css';

const NAVY = '#071E3D';
const NAVY_2 = '#0A2850';
const GOLD = '#F5C842';
const CREAM = '#FBF7F0';

const nav = [
  { path: '/admin/',            label: 'Dashboard',    short: 'Home',    icon: '📊' },
  { path: '/admin/pos',         label: 'POS · Cobrar', short: 'Cobrar',  icon: '📷' },
  { path: '/admin/customers',   label: 'Clientes',     short: 'Clientes',icon: '👥' },
  { path: '/admin/transactions',label: 'Transacciones',short: 'Movs',    icon: '💳' },
  { path: '/admin/finanzas',    label: 'Finanzas',     short: 'Finanzas',icon: '💰' },
  { path: '/admin/personal',    label: 'Personal',     short: 'Staff',   icon: '👤' },
  { path: '/admin/products',    label: 'Productos',    short: 'Menú',    icon: '🍵' },
  { path: '/admin/wallet',      label: 'Apple Wallet', short: 'Wallet',  icon: '🍎' },
  { path: '/admin/config',      label: 'Configuración',short: 'Config',  icon: '⚙️' },
];

function isActive(item, pathname) {
  if (item.path === '/admin/') return pathname === '/admin/' || pathname === '/admin';
  return pathname.startsWith(item.path);
}

const LOGO_BADGE = (size = 38) => (
  <img src="/logo-white.png" alt="House of Shake" width={size} height={size}
    style={{ objectFit: 'contain', flexShrink: 0 }} />
);

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
    <div style={{ minHeight: '100vh', background: '#F4F1EA', display: 'flex', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── DESKTOP SIDEBAR (lg+) ── */}
      <aside style={{
        width: 240, background: NAVY,
        borderRight: `1px solid rgba(245,200,66,.14)`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 50, flexShrink: 0,
      }} className="desktop-sidebar">

        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(245,200,66,.14)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {LOGO_BADGE(36)}
            <div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 1.5, color: CREAM, lineHeight: 1.15 }}>HOUSE OF SHAKE</p>
              <p style={{ fontSize: 10, color: 'rgba(245,200,66,.75)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Panel Admin</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          {nav.map(item => {
            const active = isActive(item, location.pathname);
            return (
              <Link key={item.path} to={item.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: active ? 'rgba(245,200,66,.12)' : 'transparent',
                  color: active ? GOLD : 'rgba(251,247,240,.65)',
                  borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
                  paddingLeft: active ? 9 : 12,
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(245,200,66,.14)' }}>
          <div style={{ padding: '0 12px', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</p>
            <p style={{ fontSize: 11, color: 'rgba(245,200,66,.7)', textTransform: 'capitalize' }}>{admin.role}</p>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            background: 'transparent', border: '1px solid rgba(251,247,240,.12)', cursor: 'pointer',
            fontSize: 12, color: 'rgba(251,247,240,.6)', textAlign: 'left',
            fontFamily: 'inherit', fontWeight: 600,
            transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,92,92,.12)'; e.currentTarget.style.color = '#E05C5C'; e.currentTarget.style.borderColor = 'rgba(224,92,92,.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(251,247,240,.6)'; e.currentTarget.style.borderColor = 'rgba(251,247,240,.12)'; }}
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MOBILE / TABLET HEADER ── */}
      <header style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0,
        height: 60, background: NAVY, borderBottom: '1px solid rgba(245,200,66,.14)',
        zIndex: 40, alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {LOGO_BADGE(30)}
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: CREAM }}>HOUSE OF SHAKE</span>
        </div>
        <button onClick={() => setDrawerOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, borderRadius: 8, color: GOLD,
        }}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="19" y2="6"/>
            <line x1="3" y1="11" x2="19" y2="11"/>
            <line x1="3" y1="16" x2="19" y2="16"/>
          </svg>
        </button>
      </header>

      {/* ── MOBILE / TABLET DRAWER ── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex' }}>
          {/* Overlay */}
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} />
          {/* Drawer */}
          <aside style={{
            position: 'relative', width: 280, background: NAVY,
            height: '100%', display: 'flex', flexDirection: 'column',
            boxShadow: '4px 0 32px rgba(0,0,0,.35)',
          }}>
            <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(245,200,66,.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {LOGO_BADGE(34)}
                <div>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: CREAM }}>HOUSE OF SHAKE</p>
                  <p style={{ fontSize: 10, color: 'rgba(245,200,66,.75)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Panel Admin</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(251,247,240,.5)', fontSize: 18 }}>✕</button>
            </div>
            <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
              {nav.map(item => {
                const active = isActive(item, location.pathname);
                return (
                  <Link key={item.path} to={item.path} onClick={() => setDrawerOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 14px', borderRadius: 10, marginBottom: 3,
                      fontSize: 14, fontWeight: 600, textDecoration: 'none',
                      background: active ? 'rgba(245,200,66,.12)' : 'transparent',
                      color: active ? GOLD : 'rgba(251,247,240,.75)',
                      borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(245,200,66,.14)' }}>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: CREAM }}>{admin.email}</p>
                <p style={{ fontSize: 11, color: 'rgba(245,200,66,.7)', textTransform: 'capitalize' }}>{admin.role}</p>
              </div>
              <button onClick={handleLogout} style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                background: 'rgba(224,92,92,.12)', border: '1px solid rgba(224,92,92,.25)', cursor: 'pointer',
                fontSize: 13, color: '#E05C5C', fontWeight: 700,
                fontFamily: 'inherit', textAlign: 'left',
              }}>
                🚪 Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── MOBILE / TABLET BOTTOM NAV ── */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: NAVY, borderTop: '1px solid rgba(245,200,66,.14)',
        zIndex: 40, padding: '6px 0 env(safe-area-inset-bottom)',
      }} className="mobile-bottom-nav">
        {nav.map(item => {
          const active = isActive(item, location.pathname);
          return (
            <Link key={item.path} to={item.path}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2, padding: '6px 4px',
                textDecoration: 'none', color: active ? GOLD : 'rgba(251,247,240,.45)',
                transition: 'color .15s', minWidth: 0,
              }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: .3,
                textTransform: 'uppercase', lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {item.short}
              </span>
              {active && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: GOLD, marginTop: 1 }} />
              )}
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
      }} className="layout-main">
        {children}
      </main>

      {/* ── RESPONSIVE STYLES ── */}
      <style>{`
        @media (max-width: 1023px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .layout-main {
            margin-left: 0 !important;
            padding: 76px 18px 84px !important;
          }
        }
        @media (min-width: 1024px) {
          .mobile-header { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
        }
        /* iPad landscape (1024-1180) — sidebar fits, but content padding can breathe less */
        @media (min-width: 1024px) and (max-width: 1180px) {
          .layout-main { padding: 28px 22px !important; }
        }
      `}</style>
    </div>
  );
}
