const logger = require('./logger');

let redis;

function getRedis() {
  if (!redis) {
    // Usar mock en desarrollo si no hay Redis real configurado
    if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
      const RedisMock = require('ioredis-mock');
      redis = new RedisMock();
      logger.info('Redis: usando mock en memoria (desarrollo)');
    } else {
      const Redis = require('ioredis');
      redis = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
      redis.on('connect', () => logger.info('Redis conectado'));
      redis.on('error', (err) => logger.error('Redis error:', err));
    }
  }
  return redis;
}

module.exports = { getRedis };
