/**
 * modules/movement.js
 *
 * Anti-AFK: simple key-press steps (NOT pathfinder — no false stuck triggers)
 * Stuck detection: ONLY during explicit follow/goTo tasks
 * Water guard: surfaces the bot when underwater or low on oxygen
 */
const { goals, Movements } = require('mineflayer-pathfinder');
const { GoalNear, GoalFollow, GoalBlock } = goals;
const config = require('../config');
const logger  = require('../logger');

const STUCK_CHECK_MS  = 8_000;
const STUCK_DIST      = 0.4;
const STUCK_STRIKES   = 3;
const WANDER_INTERVAL = 20_000;
const WANDER_STEP_MS  = 1_200;
const WATER_CHECK_MS  = 2_000;
const ESCAPE_COOLDOWN = 12_000;

class MovementModule {
  constructor(bot) {
    this.bot = bot;
    this._wanderTimer = null;
    this._stuckTimer  = null;
    this._waterTimer  = null;
    this.following     = null;
    this._taskActive   = false;
    this._lastPos      = null;
    this._stuckStrikes = 0;
    this._lastEscape   = 0;
    this._stepping     = false;
  }

  start() {
    this._configureMovements();
    this._startWander();
    this._startStuckDetection();
    this._startWaterGuard();
    logger.info('[Movement] Module started.');
  }

  stop() {
    clearInterval(this._wanderTimer);
    clearInterval(this._stuckTimer);
    clearInterval(this._waterTimer);
    this._wanderTimer = this._stuckTimer = this._waterTimer = null;
    this.following = null;
    this._taskActive = false;
    this._stuckStrikes = 0;
    this._stepping = false;
    for (const s of ['forward','back','left','right','jump','sneak','sprint'])
      try { this.bot.setControlState(s, false); } catch (_) {}
    try { this.bot.pathfinder.stop(); } catch (_) {}
  }

  followPlayer(playerName) {
    if (!playerName) {
      this.following = null; this._taskActive = false;
      try { this.bot.pathfinder.stop(); } catch (_) {}
      logger.info('[Movement] Stopped following.');
      return;
    }
    this.following = playerName; this._taskActive = true; this._stuckStrikes = 0;
    logger.info(`[Movement] Following ${playerName}.`);
    this._followLoop();
  }

  async goTo(pos) {
    this._taskActive = true; this._stuckStrikes = 0;
    try { await this.bot.pathfinder.goto(new GoalBlock(pos.x, pos.y, pos.z)); }
    catch (err) { logger.warn(`[Movement] goTo failed: ${err.message}`); }
    finally { this._taskActive = false; }
  }

  _configureMovements() {
    const mcData    = require('minecraft-data')(this.bot.version);
    const movements = new Movements(this.bot, mcData);
    for (const name of config.behaviour.dangerBlocks) {
      const b = mcData.blocksByName[name];
      if (b) movements.blocksCantBreak.add(b.id);
    }
    movements.maxDropDown = config.behaviour.cliffDropThreshold;
    movements.allowSprinting = true; movements.canDig = true;
    this.bot.pathfinder.setMovements(movements);
  }

  _startWander() {
    this._wanderTimer = setInterval(() => this._afkStep(), WANDER_INTERVAL);
  }

  async _afkStep() {
    if (this._taskActive || this._stepping) return;
    if (this.bot.food < 6) return;
    this._stepping = true;
    const dirs = ['forward','back','left','right'];
    const chosen = dirs[Math.floor(Math.random() * dirs.length)];
    const yaw = this.bot.entity.yaw + (Math.PI / 2) * (Math.random() * 2 - 1);
    try { await this.bot.look(yaw, 0, false); } catch (_) {}
    try {
      this.bot.setControlState(chosen, true);
      if (Math.random() < 0.25) {
        await _sleep(300);
        this.bot.setControlState('jump', true);
        await _sleep(300);
        this.bot.setControlState('jump', false);
        await _sleep(WANDER_STEP_MS - 600);
      } else {
        await _sleep(WANDER_STEP_MS);
      }
    } catch (_) {}
    finally { this.bot.setControlState(chosen, false); this._stepping = false; }
  }

  _startStuckDetection() {
    this._lastPos   = this.bot.entity?.position?.clone() ?? null;
    this._stuckTimer = setInterval(() => this._checkStuck(), STUCK_CHECK_MS);
  }

  async _checkStuck() {
    if (!this._taskActive) { this._stuckStrikes = 0; return; }
    const pos = this.bot.entity?.position;
    if (!pos || !this._lastPos) { this._lastPos = pos?.clone() ?? null; return; }
    const moved = pos.distanceTo(this._lastPos);
    this._lastPos = pos.clone();
    if (moved < STUCK_DIST) {
      if (++this._stuckStrikes >= STUCK_STRIKES) { this._stuckStrikes = 0; await this._escape(); }
    } else {
      this._stuckStrikes = 0;
    }
  }

  async _escape() {
    const now = Date.now();
    if (now - this._lastEscape < ESCAPE_COOLDOWN) return;
    this._lastEscape = now;
    logger.warn('[Movement] Stuck — escaping.');
    try {
      try { this.bot.pathfinder.stop(); } catch (_) {}
      this.bot.setControlState('jump', true);
      await _sleep(500);
      this.bot.setControlState('jump', false);
      await this.bot.look((Math.floor(Math.random() * 4) * Math.PI) / 2, 0, false);
      this.bot.setControlState('forward', true);
      await _sleep(800);
      this.bot.setControlState('forward', false);
    } catch (err) { logger.debug(`[Movement] Escape error: ${err.message}`); }
    if (this.following) this._followLoop();
  }

  async _followLoop() {
    while (this.following && this._taskActive) {
      const target = this.bot.players[this.following]?.entity;
      if (!target) { this.following = null; this._taskActive = false; break; }
      try { await this.bot.pathfinder.goto(new GoalFollow(target, 2)); } catch (_) {}
      await _sleep(250);
    }
  }

  _startWaterGuard() {
    this._waterTimer = setInterval(() => { try { this._checkWater(); } catch (_) {} }, WATER_CHECK_MS);
  }

  _checkWater() {
    const block = this.bot.blockAt(this.bot.entity?.position);
    if (!block) return;
    const inWater = block.name === 'water' || block.name === 'flowing_water';
    if (!inWater) return;
    this.bot.setControlState('jump', true);
    setTimeout(() => { try { this.bot.setControlState('jump', false); } catch (_) {} }, 350);
    if (this.bot.oxygenLevel !== undefined && this.bot.oxygenLevel <= 2) {
      logger.warn('[Movement] Low oxygen — surfacing!');
      this.bot.setControlState('jump', true);
      setTimeout(() => { try { this.bot.setControlState('jump', false); } catch (_) {} }, 1200);
    }
  }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
module.exports = MovementModule;
