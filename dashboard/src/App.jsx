import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import Landing from './pages/Landing';
import CustomerLogin from './pages/CustomerLogin';
import Register from './pages/Register';
import MiCuenta from './pages/MiCuenta';
import Staff from './pages/Staff';

import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Transactions from './pages/Transactions';
import Config from './pages/Config';
import Products from './pages/Products';
import WalletSetup from './pages/WalletSetup';
import Finanzas from './pages/Finanzas';
import Personal from './pages/Personal';

function CustomerRoute({ children }) {
  const token = localStorage.getItem('hos_customer_token');
  return token ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('hos_admin_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/registro" element={<Register />} />

        {/* Customer protected */}
        <Route path="/mi-cuenta" element={<CustomerRoute><MiCuenta /></CustomerRoute>} />

        {/* Staff POS */}
        <Route path="/staff" element={<Staff />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={
          <AdminRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/products" element={<Products />} />
                <Route path="/finanzas" element={<Finanzas />} />
                <Route path="/personal" element={<Personal />} />
                <Route path="/wallet" element={<WalletSetup />} />
                <Route path="/config" element={<Config />} />
              </Routes>
            </Layout>
          </AdminRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
