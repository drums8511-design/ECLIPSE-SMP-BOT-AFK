/**
 * config.js — All settings from environment variables
 */
require('dotenv').config();

module.exports = {
  mc: {
    host:     process.env.MC_HOST     || 'eclipsesmp-v8RC.aternos.me',
    port:     parseInt(process.env.MC_PORT || '28387', 10),
    username: process.env.MC_USERNAME || 'EclipseBot',
    password: process.env.MC_PASSWORD || undefined,
    auth:     process.env.MC_AUTH     || 'offline',
    version:  process.env.MC_VERSION  || '1.21.1',
    checkTimeoutInterval: 30_000,
  },
  reconnect: {
    delayMs: parseInt(process.env.RECONNECT_DELAY_MS || '2000', 10),
  },
  discord: {
    token:     process.env.DISCORD_TOKEN      || '',
    channelId: process.env.DISCORD_CHANNEL_ID || '',
    prefix:    process.env.DISCORD_PREFIX     || '!',
    enabled:   !!(process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL_ID),
  },
  admins: (process.env.ADMIN_PLAYERS || '').split(',').map(s => s.trim()).filter(Boolean),
  behaviour: {
    hungerThreshold:    parseInt(process.env.HUNGER_THRESHOLD || '14', 10),
    idleCheckIntervalMs: 20_000,
    cliffDropThreshold:  4,
    dangerBlocks: new Set([
      'lava','flowing_lava','fire','soul_fire','magma_block','campfire','soul_campfire',
    ]),
  },
  logging: {
    level:  process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR   || './logs',
  },
};
