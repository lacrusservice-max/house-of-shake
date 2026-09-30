// Entrada para Vercel: una única función sin servidor que atiende todas las
// rutas de la API.
//
// No se llama a listen(): Vercel invoca la app como manejador de cada
// petición. Las migraciones corren una sola vez por instancia, en la primera
// petición que llega.
const app = require('../src/app');
const { ensureSetup } = require('../src/setup-db');

module.exports = async (req, res) => {
  await ensureSetup();
  return app(req, res);
};
