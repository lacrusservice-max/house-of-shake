import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const nav = [
  { path: '/admin/',            label: 'Dashboard',    short: 'Home',   icon: '📊' },
  { path: '/admin/pos',         label: 'POS · Cobrar', short: 'Cobrar', icon: '📷' },
  { path: '/admin/customers',   label: 'Clientes',     short: 'Clientes',icon: '👥' },
  { path: '/admin/transactions',label: 'Transacciones',short: 'Movs',   icon: '💳' },
  { path: '/admin/products',    label: 'Productos',    short: 'Menú',   icon: '🍵' },
  { path: '/admin/config',      label: 'Configuración',short: 'Config', icon: '⚙️' },
];

function isActive(item, pathname) {
  if (item.path === '/admin/') return pathname === '/admin/' || pathname === '/admin';
  return pathname.startsWith(item.path);
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex' }}>

      {/* ── DESKTOP SIDEBAR (lg+) ── */}
      <aside style={{
        width: 240, background: '#fff',
        borderRight: '1px solid #f0f0f0',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 50, flexShrink: 0,
      }} className="desktop-sidebar">

        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, background: 'linear-gradient(135deg,#c85032,#e8401a)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 900, fontFamily: 'system-ui' }}>HoS</span>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 13, color: '#111', lineHeight: 1.2 }}>House of Shake</p>
              <p style={{ fontSize: 11, color: '#999' }}>Fidelización</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {nav.map(item => {
            const active = isActive(item, location.pathname);
            return (
              <Link key={item.path} to={item.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: active ? '#fff4f2' : 'transparent',
                  color: active ? '#c85032' : '#555',
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
        <div style={{ padding: '12px 10px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ padding: '0 12px', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</p>
            <p style={{ fontSize: 11, color: '#aaa' }}>{admin.role}</p>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 12, color: '#777', textAlign: 'left',
            fontFamily: 'inherit', fontWeight: 600,
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.target.style.background = '#f5f5f5'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0,
        height: 56, background: '#fff', borderBottom: '1px solid #f0f0f0',
        zIndex: 40, alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#c85032,#e8401a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>HoS</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>House of Shake</span>
        </div>
        <button onClick={() => setDrawerOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, borderRadius: 8, color: '#333',
        }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="17" y2="6"/>
            <line x1="3" y1="11" x2="17" y2="11"/>
            <line x1="3" y1="16" x2="17" y2="16"/>
          </svg>
        </button>
      </header>

      {/* ── MOBILE DRAWER ── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex' }}>
          {/* Overlay */}
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(2px)' }} />
          {/* Drawer */}
          <aside style={{
            position: 'relative', width: 260, background: '#fff',
            height: '100%', display: 'flex', flexDirection: 'column',
            boxShadow: '4px 0 32px rgba(0,0,0,.15)',
          }}>
            <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#c85032,#e8401a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>HoS</span>
                </div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>House of Shake</p>
                  <p style={{ fontSize: 11, color: '#aaa' }}>Fidelización</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999' }}>✕</button>
            </div>
            <nav style={{ flex: 1, padding: '12px 10px' }}>
              {nav.map(item => {
                const active = isActive(item, location.pathname);
                return (
                  <Link key={item.path} to={item.path} onClick={() => setDrawerOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, marginBottom: 3,
                      fontSize: 14, fontWeight: 600, textDecoration: 'none',
                      background: active ? '#fff4f2' : 'transparent',
                      color: active ? '#c85032' : '#444',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div style={{ padding: '12px 10px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{admin.email}</p>
                <p style={{ fontSize: 11, color: '#aaa' }}>{admin.role}</p>
              </div>
              <button onClick={handleLogout} style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: '#fff0ee', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#c85032', fontWeight: 700,
                fontFamily: 'inherit', textAlign: 'left',
              }}>
                🚪 Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #f0f0f0',
        zIndex: 40, padding: '6px 0 env(safe-area-inset-bottom)',
      }} className="mobile-bottom-nav">
        {nav.map(item => {
          const active = isActive(item, location.pathname);
          return (
            <Link key={item.path} to={item.path}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2, padding: '6px 4px',
                textDecoration: 'none', color: active ? '#c85032' : '#aaa',
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
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c85032', marginTop: 1 }} />
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
            padding: 72px 16px 80px !important;
          }
        }
        @media (min-width: 1024px) {
          .mobile-header { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
