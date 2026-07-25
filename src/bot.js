/**
 * bot.js — Connection lifecycle, plugin loading, module wiring
 *
 * Shutdown detection: if kick/end reason contains a shutdown phrase
 * the bot stops cleanly and does NOT reconnect. Everything else reconnects.
 */
const mineflayer   = require('mineflayer');
const { pathfinder }        = require('mineflayer-pathfinder');
const { plugin: pvp }       = require('mineflayer-pvp');
const { loader: autoEat }   = require('mineflayer-auto-eat');
const armorManager          = require('mineflayer-armor-manager');

const config  = require('./config');
const logger  = require('./logger');

const MovementModule  = require('./modules/movement');
const CombatModule    = require('./modules/combat');
const MiningModule    = require('./modules/mining');
const BuildingModule  = require('./modules/building');
const EatingModule    = require('./modules/eating');
const SleepModule     = require('./modules/sleep');
const InventoryModule = require('./modules/inventory');
const CommandsModule  = require('./modules/commands');
const DiscordModule   = require('./modules/discord');

const SHUTDOWN_PHRASES = [
  'server closed','server is closing','server stopped','shutting down',
  'server is shutting','restarting','server is restarting','server restart',
  'maintenance','stopping server','going offline','server going down',
];
const SILENT_ERRORS = ['ECONNRESET','ETIMEDOUT','ECONNREFUSED','EPIPE','ENOTFOUND'];

function isServerShutdown(reason) {
  if (!reason) return false;
  const text = (typeof reason === 'object' ? JSON.stringify(reason) : String(reason)).toLowerCase();
  return SHUTDOWN_PHRASES.some(p => text.includes(p));
}

let bot = null, reconnectTimer = null, discord = null, _shutdownFlag = false;

function createBot() {
  if (bot) { try { bot.quit(); } catch (_) {} bot = null; }
  _shutdownFlag = false;

  logger.info(`[Bot] Connecting to ${config.mc.host}:${config.mc.port} as ${config.mc.username}…`);

  bot = mineflayer.createBot({
    host: config.mc.host, port: config.mc.port,
    username: config.mc.username, password: config.mc.password,
    auth: config.mc.auth, version: config.mc.version,
    checkTimeoutInterval: config.mc.checkTimeoutInterval,
    hideErrors: true, skipValidation: true,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(autoEat);
  bot.loadPlugin(armorManager);

  const movement  = new MovementModule(bot);
  const combat    = new CombatModule(bot);
  const mining    = new MiningModule(bot);
  const building  = new BuildingModule(bot);
  const eating    = new EatingModule(bot);
  const sleep     = new SleepModule(bot);
  const inventory = new InventoryModule(bot);
  const commands  = new CommandsModule(bot, { movement, mining, building, sleep, inventory });

  if (!discord) {
    discord = new DiscordModule(bot, { commands });
    discord.start().catch(err => logger.error(`[Discord] Start error: ${err.message}`));
  } else {
    discord.bot = bot;
    discord.mods.commands = commands;
  }

  bot.once('spawn', () => {
    logger.info(`[Bot] Spawned in ${bot.game?.dimension ?? 'unknown'} at ${_pos()}.`);
    discord?.send(`✅ Spawned at ${_pos()}.`);
    movement.start(); combat.start(); eating.start();
    sleep.start(); inventory.start(); commands.start();
  });

  bot.on('death',   () => { logger.warn('[Bot] Died.');     discord?.send('💀 Died — respawning.'); });
  bot.on('respawn', () => { logger.info('[Bot] Respawned.'); discord?.send('🔄 Respawned.'); });
  bot.on('health',  () => {
    if (bot.health <= 4) { logger.warn(`[Bot] Low health: ${bot.health}/20`); discord?.send(`⚠️ Low health: ${bot.health}/20`); }
  });

  bot.on('kicked', reason => {
    const str = typeof reason === 'object' ? JSON.stringify(reason) : String(reason);
    if (isServerShutdown(reason)) {
      _shutdownFlag = true;
      logger.info(`[Bot] Server shut down (${str}). Not reconnecting.`);
      discord?.send('🔴 Server shut down. Bot standing by.');
    } else {
      logger.warn(`[Bot] Kicked: ${str}`);
      discord?.send(`⚠️ Kicked: ${str}. Reconnecting…`);
    }
  });

  bot.on('end', reason => {
    _cleanup(movement, combat, eating, sleep, inventory);
    if (_shutdownFlag) { logger.info('[Bot] Closed after shutdown. Waiting.'); return; }
    if (isServerShutdown(reason)) { logger.info('[Bot] Shutdown via end reason.'); discord?.send('🔴 Server shut down.'); return; }
    logger.info(`[Bot] Disconnected (${reason}). Reconnecting in ${config.reconnect.delayMs / 1000}s…`);
    discord?.send(`🔌 Disconnected. Reconnecting in ${config.reconnect.delayMs / 1000}s…`);
    _scheduleReconnect();
  });

  bot.on('error', err => {
    if (SILENT_ERRORS.some(c => err.code === c || err.message?.includes(c)))
      logger.debug(`[Bot] Socket error (${err.code ?? err.message}) — server offline.`);
    else
      logger.warn(`[Bot] Error: ${err.message}`);
  });

  bot.on('messagestr', msg => logger.debug(`[Chat] ${msg}`));
  return bot;
}

function _scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; createBot(); }, config.reconnect.delayMs);
}
function _cleanup(...modules) { for (const m of modules) { try { m.stop(); } catch (_) {} } }
function _pos() {
  const p = bot?.entity?.position;
  return p ? `${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}` : '(unknown)';
}

module.exports = { createBot };
