const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const webhookController = require('../controllers/webhook.controller');
const customerController = require('../controllers/customer.controller');
const customerAuthController = require('../controllers/customer.auth.controller');
const adminController = require('../controllers/admin.controller');
const walletController = require('../controllers/wallet.controller');
const posController = require('../controllers/pos.controller');
const productsController = require('../controllers/products.controller');
const { authenticateAdmin, authenticateStaff, authenticateCustomer } = require('../middleware/auth');
const { verifyShopifyWebhook } = require('../middleware/webhook');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints — 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POS operations — 60 per minute per IP (a busy shift: ~1/sec max)
const posLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas operaciones POS. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(limiter);

// Health check
router.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0',
}));

// === SHOPIFY WEBHOOKS ===
router.post('/webhooks/shopify/orders-create', verifyShopifyWebhook, webhookController.handleOrderCreate);
router.post('/webhooks/shopify/orders-paid', verifyShopifyWebhook, webhookController.handleOrderPaid);
router.post('/webhooks/shopify/orders-cancelled', verifyShopifyWebhook, webhookController.handleOrderCancelled);
router.post('/webhooks/shopify/customers-create', verifyShopifyWebhook, webhookController.handleCustomerCreate);

// === CUSTOMER AUTH ===
router.post('/auth/register', authLimiter, customerAuthController.register);
router.post('/auth/login', authLimiter, customerAuthController.login);
router.get('/me', authenticateCustomer, customerAuthController.getMe);
router.get('/me/transactions', authenticateCustomer, customerAuthController.getMyTransactions);
router.put('/me/profile', authenticateCustomer, customerAuthController.updateProfile);
router.post('/me/birthday-reward', authenticateCustomer, customerAuthController.claimBirthdayReward);

// === CUSTOMERS ===
router.post('/customers', customerController.getOrCreateCustomer);
router.get('/customers/email/:email', customerController.getCustomerByEmail);
router.get('/customers/:id', customerController.getCustomerById);
router.get('/customers/:id/public', customerController.getPublicProfile);
router.get('/customers/:id/transactions', customerController.getCustomerTransactions);
router.post('/customers/:id/redeem', customerController.redeemPoints);
router.get('/customers/:id/wallet-pass', customerController.downloadWalletPass);

// === APPLE WALLET WEB SERVICE ===
const walletBase = '/wallet/v1';
router.post(`${walletBase}/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`, walletController.registerDevice);
router.delete(`${walletBase}/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`, walletController.unregisterDevice);
router.get(`${walletBase}/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier`, walletController.getPassesForDevice);
router.get(`${walletBase}/passes/:passTypeIdentifier/:serialNumber`, walletController.getLatestPass);
router.post(`${walletBase}/log`, walletController.logError);

// === PRODUCTS (público) ===
router.get('/products', productsController.listProducts);

// === WALLET DEMO (público — para preview del pass) ===
router.get('/wallet/demo-pass', async (req, res) => {
  try {
    const walletService = require('../services/wallet.service');
    const status = walletService.getWalletStatus();
    if (!status.ready) return res.status(503).json({ error: 'Wallet no configurado', checks: status.checks });
    const { buffer } = await walletService.generatePassBuffer({
      id: '00000000-0000-0000-0000-000000000001',
      firstName: 'House of',
      lastName: 'Shake',
      availablePoints: 150,
      lifetimePoints: 250,
      level: 'SILVER',
      walletPassSerial: `DEMO-${Date.now()}`,
      walletPassToken: `demotoken${Date.now()}`,
    });
    res.set({ 'Content-Type': 'application/vnd.apple.pkpass', 'Content-Disposition': 'attachment; filename="houseofshake.pkpass"' });
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === POS (staff Y admin pueden usar el POS) ===
router.get('/pos/search', authenticateStaff, posController.searchCustomers);
router.get('/pos/customer/:code', authenticateStaff, posController.lookupCustomer);
router.post('/pos/customer/:customerId/add-points', authenticateStaff, posLimiter, posController.addPointsForPurchase);
router.post('/pos/customer/:customerId/redeem', authenticateStaff, posLimiter, posController.redeemPoints);
router.post('/pos/customer/:customerId/redeem-drink', authenticateStaff, posLimiter, posController.redeemFreeDrink);
router.post('/pos/quick-register', authenticateStaff, customerController.quickRegisterFromPOS);

// === ADMIN (solo role: admin) ===
router.post('/admin/login', authLimiter, adminController.login);
router.post('/admin/refresh-token', authenticateAdmin, adminController.refreshToken);
router.get('/admin/stats', authenticateAdmin, adminController.getDashboardStats);
router.get('/admin/customers', authenticateAdmin, adminController.listCustomers);
router.get('/admin/transactions', authenticateAdmin, adminController.listTransactions);
router.get('/admin/config', authenticateAdmin, adminController.getConfig);
router.put('/admin/config', authenticateAdmin, adminController.updateConfig);
router.post('/admin/customers/:customerId/push', authenticateAdmin, adminController.forceUpdateWalletPass);
router.post('/admin/customers/:customerId/adjust-points', authenticateAdmin, adminController.adjustPoints);
router.get('/admin/export/customers', authenticateAdmin, adminController.exportCustomersCSV);
router.post('/admin/setup-shopify', authenticateAdmin, adminController.setupShopify);

// Admin: gestión de personal + stats
router.get('/admin/staff', authenticateAdmin, adminController.listStaff);
router.post('/admin/staff', authenticateAdmin, adminController.createStaff);
router.put('/admin/staff/:id', authenticateAdmin, adminController.updateStaff);
router.get('/admin/staff/stats', authenticateAdmin, adminController.getStaffStats);

// Admin: finanzas + exports
router.get('/admin/financials', authenticateAdmin, adminController.getFinancialStats);
router.get('/admin/export/transactions', authenticateAdmin, adminController.exportTransactionsCSV);

// Public stats (no auth — solo totales, sin datos personales)
router.get('/stats/public', adminController.getPublicStats);

// Admin: productos
router.post('/admin/products', authenticateAdmin, productsController.createProduct);
router.put('/admin/products/:id', authenticateAdmin, productsController.updateProduct);
router.delete('/admin/products/:id', authenticateAdmin, productsController.deleteProduct);

// Admin: cumpleaños y puntos dobles
router.get('/admin/birthday-customers', authenticateAdmin, adminController.getBirthdayCustomers);
router.post('/admin/double-points', authenticateAdmin, adminController.toggleDoublePoints);
router.get('/admin/double-points/status', authenticateAdmin, adminController.getDoublePointsStatus);

// Admin: Apple Wallet
router.get('/admin/wallet/status',        authenticateAdmin, adminController.getWalletStatus);
router.post('/admin/wallet/download-wwdr', authenticateAdmin, adminController.downloadWwdr);
router.get('/admin/wallet/test-pass',     authenticateAdmin, adminController.testWalletPass);
router.get('/admin/wallet/test-generate', authenticateAdmin, adminController.testGeneratePass);

module.exports = router;
