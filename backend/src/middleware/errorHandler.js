const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  logger.error({
    message,
    status,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.url}` });
}

module.exports = { errorHandler, notFound };
