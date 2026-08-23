const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { puntosCostForCategory, pinosCostForCategory } = require('../services/pinos');

// El costo de canje NO depende del precio, sino de la categoría:
//   Alimentos y repostería ....... 100 Pinos
//   Cafés y bebidas .............. 110 Pinos
//   Milkshakes y especiales ...... 120 Pinos
// (Antes era precio × 10, así que un café de $65 pedía 65 Pinos: el cliente
//  canjeaba mucho antes de completar su ciclo.)
function pointsFromCategory(category) {
  return puntosCostForCategory(category);
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
  // Si no envían pointsValue explícito, se deriva de la categoría.
  const pts = (pointsValue === undefined || pointsValue === null || pointsValue === '')
    ? pointsFromCategory(category || 'bebida')
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
  // Si cambian la categoría pero NO mandan un pointsValue explícito, re-derivar
  // el costo en Pinos. El precio ya no influye en el costo de canje.
  if (data.category !== undefined && req.body.pointsValue === undefined) {
    data.pointsValue = pointsFromCategory(data.category);
  }
  try {
    const product = await prisma.product.update({ where: { id }, data });
    res.json(product);
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' });
  }
}

// Admin: recalcula el costo en Pinos de TODOS los productos desde su categoría.
async function recomputeAllPoints(req, res) {
  try {
    const products = await prisma.product.findMany();
    let updated = 0;
    for (const p of products) {
      const target = pointsFromCategory(p.category);
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

module.exports = { listProducts, createProduct, updateProduct, deleteProduct, recomputeAllPoints, pointsFromCategory };
