const prisma = require('../config/prisma');
const logger = require('../config/logger');

// Sistema de canje: 1 Pino = $1 MXN de valor. 1 Pino = 10 puntos internos.
// Costo de canje de un producto (en puntos) = precio × 10.
// Ej: bebida $90 → 900 puntos = 90 Pinos.
function pointsFromPrice(price) {
  return Math.round(parseFloat(price)) * 10;
}

async function listProducts(req, res) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json(products);
}

async function createProduct(req, res) {
  const { name, description, price, pointsValue, category, imageUrl, sortOrder } = req.body;
  if (!name || price === undefined || price === null || price === '') {
    return res.status(400).json({ error: 'name y price son requeridos' });
  }
  // Si no envían pointsValue explícito, se deriva del precio (1 Pino = $1).
  const pts = (pointsValue === undefined || pointsValue === null || pointsValue === '')
    ? pointsFromPrice(price)
    : parseInt(pointsValue);
  const product = await prisma.product.create({
    data: { name, description, price: parseFloat(price), pointsValue: pts, category: category || 'bebida', imageUrl, sortOrder: sortOrder || 0 },
  });
  res.status(201).json(product);
}

async function updateProduct(req, res) {
  const { id } = req.params;
  const data = {};
  const fields = ['name', 'description', 'price', 'pointsValue', 'category', 'imageUrl', 'active', 'sortOrder'];
  for (const f of fields) {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  }
  if (data.price !== undefined) data.price = parseFloat(data.price);
  if (data.pointsValue !== undefined) data.pointsValue = parseInt(data.pointsValue);
  // Si cambian el precio pero NO mandan un pointsValue explícito, re-derivar el costo en Pinos.
  if (data.price !== undefined && req.body.pointsValue === undefined) {
    data.pointsValue = pointsFromPrice(data.price);
  }
  try {
    const product = await prisma.product.update({ where: { id }, data });
    res.json(product);
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' });
  }
}

// Admin: recalcula el costo en Pinos de TODOS los productos desde su precio (1 Pino = $1).
async function recomputeAllPoints(req, res) {
  try {
    const products = await prisma.product.findMany();
    let updated = 0;
    for (const p of products) {
      const target = pointsFromPrice(p.price);
      if (p.pointsValue !== target) {
        await prisma.product.update({ where: { id: p.id }, data: { pointsValue: target } });
        updated++;
      }
    }
    logger.info(`Recompute Pinos: ${updated}/${products.length} productos actualizados`);
    res.json({ success: true, updated, total: products.length });
  } catch (err) {
    logger.error('recomputeAllPoints error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function deleteProduct(req, res) {
  const { id } = req.params;
  try {
    await prisma.product.update({ where: { id }, data: { active: false } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' });
  }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct, recomputeAllPoints, pointsFromPrice };
