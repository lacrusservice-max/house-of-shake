import { Link, useLocation, useNavigate } from 'react-router-dom';

const nav = [
  { path: '/admin/', label: 'Dashboard', icon: '📊' },
  { path: '/admin/customers', label: 'Clientes', icon: '👥' },
  { path: '/admin/transactions', label: 'Transacciones', icon: '💳' },
  { path: '/admin/products', label: 'Menú / Productos', icon: '🍵' },
  { path: '/admin/config', label: 'Configuración', icon: '⚙️' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem('hos_admin') || '{}');

  function handleLogout() {
    localStorage.removeItem('hos_admin_token');
    localStorage.removeItem('hos_admin');
    navigate('/admin/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">HoS</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">House of Shake</p>
              <p className="text-xs text-gray-400">Fidelización</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === item.path || (item.path !== '/admin/' && location.pathname.startsWith(item.path))
                  ? 'bg-red-50 text-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="mb-3 px-2">
            <p className="text-xs font-medium text-gray-700 truncate">{admin.email}</p>
            <p className="text-xs text-gray-400">{admin.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl text-left transition-colors"
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
