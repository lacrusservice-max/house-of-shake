const prisma = require('../config/prisma');
const logger = require('../config/logger');

async function listProducts(req, res) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json(products);
}

async function createProduct(req, res) {
  const { name, description, price, pointsValue, category, imageUrl, sortOrder } = req.body;
  if (!name || !price || pointsValue === undefined) {
    return res.status(400).json({ error: 'name, price y pointsValue son requeridos' });
  }
  const product = await prisma.product.create({
    data: { name, description, price: parseFloat(price), pointsValue: parseInt(pointsValue), category: category || 'bebida', imageUrl, sortOrder: sortOrder || 0 },
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
  if (data.price) data.price = parseFloat(data.price);
  if (data.pointsValue) data.pointsValue = parseInt(data.pointsValue);
  try {
    const product = await prisma.product.update({ where: { id }, data });
    res.json(product);
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' });
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

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
