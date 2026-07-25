/**
 * modules/eating.js — Auto-eat using mineflayer-auto-eat v5
 */
const config = require('../config');
const logger  = require('../logger');

const FOOD_PRIORITY = [
  'golden_carrot','cooked_porkchop','cooked_beef','cooked_mutton','cooked_chicken',
  'cooked_salmon','cooked_cod','bread','baked_potato','carrot','apple','melon_slice',
];

class EatingModule {
  constructor(bot) { this.bot = bot; this._eating = false; this._timer = null; }

  start() {
    if (this.bot.autoEat) {
      this.bot.autoEat.setOpts({
        priority: 'foodPoints',
        minHunger: config.behaviour.hungerThreshold,
        bannedFood: ['rotten_flesh','pufferfish','poisonous_potato','spider_eye'],
      });
      this.bot.autoEat.enableAuto();
      logger.info('[Eating] mineflayer-auto-eat v5 enabled.');
    } else {
      this._timer = setInterval(() => this._poll(), 3000);
      logger.info('[Eating] Manual auto-eat started.');
    }
  }

  stop() { clearInterval(this._timer); this._timer = null; try { this.bot.autoEat?.disableAuto(); } catch (_) {} }

  async _poll() {
    if (this._eating || this.bot.food > config.behaviour.hungerThreshold) return;
    this._eating = true;
    const item = this.bot.inventory.items().reduce((best, i) => {
      const idx = FOOD_PRIORITY.indexOf(i.name);
      return idx !== -1 && (best === null || idx < FOOD_PRIORITY.indexOf(best.name)) ? i : best;
    }, null);
    if (!item) { logger.warn('[Eating] Hungry but no food!'); this._eating = false; return; }
    try { await this.bot.equip(item, 'hand'); await this.bot.consume(); }
    catch (err) { logger.warn(`[Eating] Failed: ${err.message}`); }
    finally { this._eating = false; }
  }
}

module.exports = EatingModule;
