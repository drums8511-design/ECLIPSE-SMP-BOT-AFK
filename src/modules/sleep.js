/**
 * modules/sleep.js — Auto-sleep in a bed at night
 */
const { goals } = require('mineflayer-pathfinder');
const logger    = require('../logger');

const NIGHT_START = 12542, NIGHT_END = 23459, CHECK_INTERVAL = 20_000;
const BED_NAMES = new Set([
  'white_bed','orange_bed','magenta_bed','light_blue_bed','yellow_bed','lime_bed',
  'pink_bed','gray_bed','light_gray_bed','cyan_bed','purple_bed','blue_bed',
  'brown_bed','green_bed','red_bed','black_bed',
]);

class SleepModule {
  constructor(bot) { this.bot = bot; this._sleeping = false; this._timer = null; }

  start() {
    this.bot.on('wake', () => { this._sleeping = false; logger.info('[Sleep] Woke up.'); });
    this._timer = setInterval(() => this._checkNight(), CHECK_INTERVAL);
    logger.info('[Sleep] Module started.');
  }

  stop() { clearInterval(this._timer); this._timer = null; }

  async _checkNight() {
    if (this._sleeping) return;
    const t = this.bot.time?.timeOfDay;
    if (t === undefined || t < NIGHT_START || t > NIGHT_END) return;
    const bed = this.bot.findBlock({ matching: b => BED_NAMES.has(b.name), maxDistance: 32 });
    if (!bed) return;
    this._sleeping = true;
    try {
      await this.bot.pathfinder.goto(new goals.GoalNear(bed.position.x, bed.position.y, bed.position.z, 2));
      await this.bot.sleep(bed);
      logger.info('[Sleep] Sleeping.');
    } catch (err) { logger.warn(`[Sleep] Could not sleep: ${err.message}`); this._sleeping = false; }
  }
}

module.exports = SleepModule;
