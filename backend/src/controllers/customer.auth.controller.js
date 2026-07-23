const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const emailService = require('../services/email.service');
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
  const { firstName, lastName, email, phone, password, birthday } = req.body;
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

    if (birthday) {
      const bd = new Date(birthday);
      if (!isNaN(bd.getTime())) {
        await prisma.$executeRawUnsafe(
          `UPDATE customers SET birthday = $1 WHERE id = $2`,
          bd.toISOString().split('T')[0], customer.id
        ).catch(() => {});
      }
    }

    const token = signToken(customer);
    logger.info(`Nuevo cliente registrado: ${email}`);

    setImmediate(() => {
      emailService.sendWelcome({
        to: customer.email,
        firstName: customer.firstName,
        availablePoints: customer.availablePoints || 0,
      }).catch(e => logger.warn('Email welcome error:', e.message));
    });

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
      logger.warn(`🔒 Login cliente fallido (sin cuenta o sin contraseña): ${email}`);
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) {
      logger.warn(`🔒 Login cliente fallido (contraseña incorrecta): ${email}`);
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    logger.info(`🔓 Login cliente exitoso: ${email}`);
    const token = signToken(customer);
    res.json({ token, customer: safeCustomer(customer) });
  } catch (err) {
    logger.error('Customer login error:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

// Cuentas creadas por sincronización con Shopify o registro rápido en el POS
// nunca reciben contraseña (Shopify no comparte contraseñas con terceros), así
// que "olvidé mi contraseña" también es como ESAS cuentas consiguen una por
// primera vez, no solo un reseteo.
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Respuesta genérica siempre — no revelar si el email existe o no.
    const genericMsg = 'Si existe una cuenta con ese email, enviamos un enlace para restablecer tu contraseña.';

    if (customer) {
      const resetToken = jwt.sign(
        { id: customer.id, purpose: 'password_reset' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
      const resetLink = `https://house-of-shake.vercel.app/reset-password?token=${resetToken}`;
      setImmediate(() => {
        emailService.sendPasswordReset({ to: customer.email, firstName: customer.firstName, resetLink })
          .catch(e => logger.warn('Email password-reset error:', e.message));
      });
      logger.info(`🔑 Reset de contraseña solicitado: ${customer.email}`);
    }

    res.json({ success: true, message: genericMsg });
  } catch (err) {
    logger.error('forgotPassword error:', err.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'El enlace expiró o no es válido. Solicita uno nuevo.' });
    }
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Enlace inválido' });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const customer = await prisma.customer.update({
      where: { id: decoded.id },
      data: { password: hashed },
    }).catch(() => null);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    logger.info(`🔑 Contraseña restablecida (self-service): ${customer.email}`);

    // Log in inmediato — evita que el cliente tenga que iniciar sesión dos veces
    const authToken = signToken(customer);
    res.json({ success: true, token: authToken, customer: safeCustomer(customer) });
  } catch (err) {
    logger.error('resetPassword error:', err.message);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
}

async function getMe(req, res) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const extras = await prisma.$queryRawUnsafe(
      `SELECT birthday, visit_count, last_visit_at, birthday_reward_year FROM customers WHERE id = $1`,
      customer.id
    ).catch(() => [{}]);
    const ext = extras[0] || {};

    const today = new Date();
    const bd = ext.birthday ? new Date(ext.birthday) : null;
    const isBirthday = bd && bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
    const birthdayRewardAvailable = isBirthday && ext.birthday_reward_year !== today.getFullYear();

    const doublePoints = await pointsService.isDoublePointsActive().catch(() => false);

    res.json({ customer: {
      ...safeCustomer(customer),
      birthday: ext.birthday || null,
      visitCount: Number(ext.visit_count) || 0,
      lastVisitAt: ext.last_visit_at || null,
      isBirthday: !!isBirthday,
      birthdayRewardAvailable: !!birthdayRewardAvailable,
      doublePointsActive: doublePoints,
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const { birthday, firstName, lastName, phone } = req.body;
    const updates = {};
    if (firstName) updates.firstName = firstName.trim();
    if (lastName !== undefined) updates.lastName = lastName.trim();
    if (phone !== undefined) updates.phone = phone || null;

    if (Object.keys(updates).length > 0) {
      await prisma.customer.update({ where: { id: req.customer.id }, data: updates });
    }

    if (birthday) {
      const b = new Date(birthday);
      if (!isNaN(b.getTime())) {
        await prisma.$executeRawUnsafe(
          `UPDATE customers SET birthday = $1 WHERE id = $2`,
          b.toISOString().split('T')[0], req.customer.id
        );
      }
    }

    const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } });
    const extras = await prisma.$queryRawUnsafe(
      `SELECT birthday, visit_count FROM customers WHERE id = $1`, req.customer.id
    ).catch(() => [{}]);
    const ext = extras[0] || {};

    res.json({ customer: { ...safeCustomer(customer), birthday: ext.birthday || null, visitCount: Number(ext.visit_count) || 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function claimBirthdayReward(req, res) {
  try {
    const extras = await prisma.$queryRawUnsafe(
      `SELECT birthday, birthday_reward_year FROM customers WHERE id = $1`,
      req.customer.id
    ).catch(() => [{}]);
    const ext = extras[0] || {};

    if (!ext.birthday) return res.status(400).json({ error: 'No tienes fecha de cumpleaños registrada. Agrégala en tu perfil.' });

    const today = new Date();
    const bd = new Date(ext.birthday);
    if (bd.getMonth() !== today.getMonth() || bd.getDate() !== today.getDate()) {
      return res.status(400).json({ error: 'Hoy no es tu cumpleaños 😊' });
    }

    const thisYear = today.getFullYear();
    if (Number(ext.birthday_reward_year) === thisYear) {
      return res.status(400).json({ error: 'Ya reclamaste tu regalo de cumpleaños este año 🎉' });
    }

    const result = await pointsService.addBirthdayBonus(req.customer.id, 200);

    await prisma.$executeRawUnsafe(
      `UPDATE customers SET birthday_reward_year = $1 WHERE id = $2`,
      thisYear, req.customer.id
    );

    res.json({ success: true, pointsAdded: result.pointsAdded, newBalance: result.newBalance, message: '¡Feliz cumpleaños! 🎂 +200 puntos de regalo' });
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

module.exports = { register, login, forgotPassword, resetPassword, getMe, getMyTransactions, updateProfile, claimBirthdayReward };
