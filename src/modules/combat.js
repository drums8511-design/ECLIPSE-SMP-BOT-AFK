/**
 * modules/combat.js — Self-defence against hostile mobs using mineflayer-pvp
 */
const logger = require('../logger');

const HOSTILE_MOBS = new Set([
  'zombie','skeleton','creeper','spider','cave_spider','enderman','blaze','witch',
  'pillager','vindicator','ravager','phantom','drowned','husk','stray','warden',
  'zoglin','hoglin','piglin_brute','guardian','elder_guardian',
]);

const AGGRO_RANGE = 6, RETREAT_RANGE = 2, SCAN_INTERVAL = 1500;

class CombatModule {
  constructor(bot) { this.bot = bot; this._timer = null; this._defending = false; }

  start() {
    this.bot.on('entityHurt', e => { if (e === this.bot.entity) this._onHurt(); });
    this._timer = setInterval(() => this._scan(), SCAN_INTERVAL);
    logger.info('[Combat] Module started.');
  }

  stop() { clearInterval(this._timer); this._timer = null; try { this.bot.pvp.stop(); } catch (_) {} this._defending = false; }

  _onHurt() { const t = this._findThreat(AGGRO_RANGE); if (t) this._attack(t); }
  _scan()   { if (this._defending) return; const t = this._findThreat(AGGRO_RANGE); if (t) this._attack(t); }

  _findThreat(range) {
    let closest = null, closestDist = Infinity;
    for (const e of Object.values(this.bot.entities)) {
      if (!HOSTILE_MOBS.has(e.name)) continue;
      const d = e.position.distanceTo(this.bot.entity.position);
      if (d < range && d < closestDist) { closest = e; closestDist = d; }
    }
    return closest;
  }

  async _attack(entity) {
    if (this._defending) return;
    this._defending = true;
    logger.info(`[Combat] Engaging ${entity.name}.`);
    try {
      await this._equipBestWeapon();
      if (entity.position.distanceTo(this.bot.entity.position) < RETREAT_RANGE) {
        this.bot.setControlState('back', true);
        await new Promise(r => setTimeout(r, 600));
        this.bot.setControlState('back', false);
      }
      this.bot.pvp.attack(entity);
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (!entity.isValid || entity.position.distanceTo(this.bot.entity.position) > AGGRO_RANGE + 4)
            { clearInterval(check); resolve(); }
        }, 500);
      });
    } catch (err) { logger.warn(`[Combat] Attack error: ${err.message}`); }
    finally { try { this.bot.pvp.stop(); } catch (_) {} this._defending = false; }
  }

  async _equipBestWeapon() {
    for (const name of ['netherite_sword','diamond_sword','iron_sword','stone_sword','wooden_sword','netherite_axe','diamond_axe','iron_axe']) {
      const item = this.bot.inventory.items().find(i => i.name === name);
      if (item) { try { await this.bot.equip(item, 'hand'); return; } catch (_) {} }
    }
  }
}

module.exports = CombatModule;
