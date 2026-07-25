/**
 * modules/mining.js — Mine, collect, place, break blocks
 */
const { goals } = require('mineflayer-pathfinder');
const logger    = require('../logger');

class MiningModule {
  constructor(bot) { this.bot = bot; this._mining = false; }

  async mine(blockName, count = 1, maxDistance = 32) {
    if (this._mining) { logger.warn('[Mining] Already mining.'); return; }
    const mcData    = require('minecraft-data')(this.bot.version);
    const blockType = mcData.blocksByName[blockName];
    if (!blockType) { logger.warn(`[Mining] Unknown block: ${blockName}`); return; }

    this._mining = true;
    logger.info(`[Mining] Mining ${count}× ${blockName}.`);
    let mined = 0;
    try {
      while (mined < count) {
        const block = this.bot.findBlock({ matching: blockType.id, maxDistance });
        if (!block) { logger.info(`[Mining] No more ${blockName} nearby.`); break; }
        await this._equipBestTool(blockName);
        await this.bot.pathfinder.goto(new goals.GoalLookAtBlock(block.position, this.bot.world));
        await this.bot.dig(block);
        mined++;
      }
    } catch (err) { logger.warn(`[Mining] Error: ${err.message}`); }
    finally { this._mining = false; }
    logger.info(`[Mining] Done — mined ${mined}× ${blockName}.`);
  }

  async collectNearby(range = 6) {
    const items = Object.values(this.bot.entities).filter(e =>
      e.name === 'item' && e.position.distanceTo(this.bot.entity.position) <= range);
    for (const item of items)
      try { await this.bot.pathfinder.goto(new goals.GoalNear(item.position.x, item.position.y, item.position.z, 1)); } catch (_) {}
  }

  async placeBlock(pos) {
    try {
      const ref = this.bot.blockAt(pos.offset(0, -1, 0));
      if (!ref) return;
      await this.bot.placeBlock(ref, new (require('vec3'))(0, 1, 0));
    } catch (err) { logger.warn(`[Mining] Place failed: ${err.message}`); }
  }

  async breakBlock(pos) {
    try {
      const block = this.bot.blockAt(pos);
      if (!block || block.name === 'air') return;
      await this.bot.dig(block);
    } catch (err) { logger.warn(`[Mining] Break failed: ${err.message}`); }
  }

  async _equipBestTool(blockName) {
    const axe    = ['log','wood','plank','fence','door','slab','stair'];
    const shovel = ['dirt','grass','sand','gravel','soul_sand','snow','clay'];
    let suffix   = 'pickaxe';
    if (axe.some(k => blockName.includes(k)))    suffix = 'axe';
    if (shovel.some(k => blockName.includes(k))) suffix = 'shovel';
    for (const mat of ['netherite','diamond','iron','stone','wooden']) {
      const item = this.bot.inventory.items().find(i => i.name === `${mat}_${suffix}`);
      if (item) { try { await this.bot.equip(item, 'hand'); return; } catch (_) {} }
    }
  }
}

module.exports = MiningModule;
