import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://clc-house-of-shake.com/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hos_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hos_admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/admin/login', { email, password }),
};

export const statsApi = {
  getDashboard: () => api.get('/admin/stats'),
};

export const customersApi = {
  list: (params) => api.get('/admin/customers', { params }),
  adjustPoints: (id, points, description) =>
    api.post(`/admin/customers/${id}/adjust-points`, { points, description }),
  forceWalletUpdate: (id) => api.post(`/admin/customers/${id}/push`),
  exportCSV: () => api.get('/admin/export/customers', { responseType: 'blob' }),
};

export const transactionsApi = {
  list: (params) => api.get('/admin/transactions', { params }),
};

export const configApi = {
  get: () => api.get('/admin/config'),
  update: (data) => api.put('/admin/config', data),
};

export const setupApi = {
  shopify: () => api.post('/admin/setup-shopify'),
};

export default api;
