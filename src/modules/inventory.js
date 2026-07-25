/**
 * modules/inventory.js — Armour auto-equip + chest storage when full
 */
const { goals } = require('mineflayer-pathfinder');
const logger    = require('../logger');

const KEEP_ITEMS = new Set([
  'wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe','netherite_pickaxe',
  'wooden_axe','stone_axe','iron_axe','diamond_axe','netherite_axe',
  'wooden_shovel','stone_shovel','iron_shovel','diamond_shovel','netherite_shovel',
  'wooden_sword','stone_sword','iron_sword','diamond_sword','netherite_sword',
  'leather_helmet','chainmail_helmet','iron_helmet','diamond_helmet','netherite_helmet',
  'leather_chestplate','chainmail_chestplate','iron_chestplate','diamond_chestplate','netherite_chestplate',
  'leather_leggings','chainmail_leggings','iron_leggings','diamond_leggings','netherite_leggings',
  'leather_boots','chainmail_boots','iron_boots','diamond_boots','netherite_boots',
  'cooked_beef','cooked_porkchop','bread','golden_carrot','torch','crafting_table','chest',
]);

class InventoryModule {
  constructor(bot) { this.bot = bot; this._storing = false; this._timer = null; }

  start() {
    if (this.bot.armorManager) logger.info('[Inventory] Armour manager active (auto-equip on).');
    this._timer = setInterval(() => this._checkFull(), 30_000);
    logger.info('[Inventory] Module started.');
  }

  stop() { clearInterval(this._timer); this._timer = null; }
