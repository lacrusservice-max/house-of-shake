const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

/**
 * Registro de la aplicación.
 *
 * Sin servidor el disco es de solo lectura (salvo /tmp) y no hay proceso que
 * sobreviva entre peticiones, así que escribir archivos rotativos no sirve de
 * nada y además revienta. En ese entorno se escribe a la consola, que es de
 * donde Vercel recoge los registros.
 *
 * Con proceso propio se conserva el comportamiento anterior: archivos diarios
 * con 30 días de retención.
 */
const esServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const logDir = process.env.LOG_DIR || './logs';

const transports = [];

if (esServerless) {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }));
} else {
  try {
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
      }),
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
      })
    );
  } catch (e) {
    console.warn('Registro a disco no disponible:', e.message);
  }
  if (process.env.NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }));
  }
}

// Sin un solo transporte winston avisa en cada llamada; la consola es el piso.
if (!transports.length) transports.push(new winston.transports.Console());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});

module.exports = logger;
