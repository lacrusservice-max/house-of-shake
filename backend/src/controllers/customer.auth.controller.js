const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const logger = require('../config/logger');

const SALT_ROUNDS = 10;

function signToken(customer) {
  return jwt.sign(
    { id: customer.id, email: customer.email, type: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function safeCustomer(c) {
  const { password, walletPassToken, ...safe } = c;
  return safe;
}

async function register(req, res) {
  const { firstName, lastName, email, phone, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'Nombre, apellido, email y contraseña son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    let customer = await prisma.customer.create({
      data: { firstName, lastName, email, phone: phone || null, password: hashed },
    });

    await pointsService.addWelcomeBonus(customer.id);
    customer = await prisma.customer.findUnique({ where: { id: customer.id } });

    const token = signToken(customer);
    logger.info(`Nuevo cliente registrado: ${email}`);
    res.status(201).json({ token, customer: safeCustomer(customer) });
  } catch (err) {
    logger.error('Register error:', err.message);
    res.status(500).json({ error: 'Error al registrar' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer || !customer.password) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const token = signToken(customer);
    res.json({ token, customer: safeCustomer(customer) });
  } catch (err) {
    logger.error('Customer login error:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function getMe(req, res) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ customer: safeCustomer(customer) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyTransactions(req, res) {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const transactions = await prisma.transaction.findMany({
      where: { customerId: req.customer.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });
    const total = await prisma.transaction.count({ where: { customerId: req.customer.id } });
    res.json({ transactions, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, getMe, getMyTransactions };
