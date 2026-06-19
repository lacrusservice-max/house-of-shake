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
const { authenticateAdmin, authenticateCustomer } = require('../middleware/auth');
const { verifyShopifyWebhook } = require('../middleware/webhook');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
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
router.post('/auth/register', customerAuthController.register);
router.post('/auth/login', customerAuthController.login);
router.get('/me', authenticateCustomer, customerAuthController.getMe);
router.get('/me/transactions', authenticateCustomer, customerAuthController.getMyTransactions);

// === CUSTOMERS (legacy / POS) ===
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

// === PRODUCTS (público — landing page) ===
router.get('/products', productsController.listProducts);

// === POS (staff — protegido con JWT) ===
router.get('/pos/customer/:code', authenticateAdmin, posController.lookupCustomer);
router.post('/pos/customer/:customerId/add-points', authenticateAdmin, posController.addPointsForPurchase);
router.post('/pos/customer/:customerId/redeem', authenticateAdmin, posController.redeemPoints);
router.post('/pos/quick-register', authenticateAdmin, customerController.quickRegisterFromPOS);

// === ADMIN (protegido con JWT) ===
router.post('/admin/login', adminController.login);
router.get('/admin/stats', authenticateAdmin, adminController.getDashboardStats);
router.get('/admin/customers', authenticateAdmin, adminController.listCustomers);
router.get('/admin/transactions', authenticateAdmin, adminController.listTransactions);
router.get('/admin/config', authenticateAdmin, adminController.getConfig);
router.put('/admin/config', authenticateAdmin, adminController.updateConfig);
router.post('/admin/customers/:customerId/push', authenticateAdmin, adminController.forceUpdateWalletPass);
router.post('/admin/customers/:customerId/adjust-points', authenticateAdmin, adminController.adjustPoints);
router.get('/admin/export/customers', authenticateAdmin, adminController.exportCustomersCSV);
router.post('/admin/setup-shopify', authenticateAdmin, adminController.setupShopify);

// Products admin CRUD
router.post('/admin/products', authenticateAdmin, productsController.createProduct);
router.put('/admin/products/:id', authenticateAdmin, productsController.updateProduct);
router.delete('/admin/products/:id', authenticateAdmin, productsController.deleteProduct);

// === ADMIN WALLET SETUP ===
router.get('/admin/wallet/status', authenticateAdmin, adminController.getWalletStatus);
router.post('/admin/wallet/download-wwdr', authenticateAdmin, adminController.downloadWwdr);
router.get('/admin/wallet/test-pass', authenticateAdmin, adminController.testWalletPass);

module.exports = router;
