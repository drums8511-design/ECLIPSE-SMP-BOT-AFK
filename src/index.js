/**
 * index.js — Process entry point & crash guard
 */
const config = require('./config');
const logger = require('./logger');
const { createBot } = require('./bot');

logger.info('═══════════════════════════════════════════════');
logger.info(' Minecraft Bot — starting up');
logger.info(`  Server  : ${config.mc.host}:${config.mc.port}`);
logger.info(`  Username: ${config.mc.username}`);
logger.info(`  Version : ${config.mc.version}`);
logger.info(`  Auth    : ${config.mc.auth}`);
logger.info('═══════════════════════════════════════════════');

process.on('uncaughtException', err => {
  logger.error(`[Process] Uncaught exception: ${err.message}\n${err.stack}`);
  _scheduleRestart();
});
process.on('unhandledRejection', reason => {
  logger.error(`[Process] Unhandled rejection: ${reason instanceof Error ? reason.message : reason}`);
});
process.on('SIGTERM', () => { logger.info('[Process] SIGTERM — shutting down.'); process.exit(0); });
process.on('SIGINT',  () => { logger.info('[Process] SIGINT — shutting down.');  process.exit(0); });

let _restartTimer = null;
function _scheduleRestart() {
  if (_restartTimer) return;
  logger.warn(`[Process] Scheduling restart in ${config.reconnect.delayMs} ms…`);
  _restartTimer = setTimeout(() => {
    _restartTimer = null;
    try { createBot(); }
    catch (err) { logger.error(`[Process] createBot threw: ${err.message}`); _scheduleRestart(); }
  }, config.reconnect.delayMs);
}

try { createBot(); }
catch (err) { logger.error(`[Process] Initial start failed: ${err.message}`); _scheduleRestart(); }
