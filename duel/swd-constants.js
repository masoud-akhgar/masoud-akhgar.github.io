/* ==========================================================================
 * 7 Wonders Duel - shared constants and helpers
 * All game files attach to one global namespace:  SWD
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  // ---- Resources ---------------------------------------------------------
  S.RAW_RESOURCES = ['wood', 'clay', 'stone'];            // produced by brown cards
  S.MANUFACTURED_RESOURCES = ['glass', 'papyrus'];        // produced by grey cards
  S.ALL_RESOURCES = S.RAW_RESOURCES.concat(S.MANUFACTURED_RESOURCES);

  // ---- Card colours / types ---------------------------------------------
  S.CardType = {
    BROWN: 'brown',    // raw materials
    GREY: 'grey',      // manufactured goods
    BLUE: 'blue',      // civilian buildings
    GREEN: 'green',    // scientific buildings
    YELLOW: 'yellow',  // commercial buildings
    RED: 'red',        // military buildings
    PURPLE: 'purple'   // guilds
  };
  S.TYPE_NAME = {
    brown: 'Raw material', grey: 'Manufactured good', blue: 'Civilian',
    green: 'Scientific', yellow: 'Commercial', red: 'Military', purple: 'Guild'
  };

  // ---- Science -----------------------------------------------------------
  // 6 symbols on green cards + LAW (only on the Law progress token)
  S.SCIENCE_SYMBOLS = ['wheel', 'quill', 'mortar', 'pendulum', 'globe', 'square', 'law'];
  S.SCIENCE_SYMBOLS_NEEDED_TO_WIN = 6;
  S.SCIENCE_NAME = { wheel: 'Wheel', quill: 'Quill', mortar: 'Mortar', pendulum: 'Pendulum',
                     globe: 'Globe', square: 'Set square', law: 'Law' };
  // Pictures of the symbols (shown instead of the emoji below when the file exists)
  S.SCIENCE_IMAGES = {
    wheel:    'images/science/wheel.png',
    quill:    'images/science/quill.png',
    mortar:   'images/science/mortar.png',
    pendulum: 'images/science/pendulum.png',
    globe:    'images/science/globe.png',
    square:   'images/science/square.png',
    law:      'images/science/law.png'
  };

  // ---- Guild types -------------------------------------------------------
  S.GuildType = {
    BUILDERS: 'builders', MONEYLENDERS: 'moneylenders', SCIENTISTS: 'scientists',
    SHIPOWNERS: 'shipowners', MERCHANTS: 'merchants', MAGISTRATES: 'magistrates',
    TACTICIANS: 'tacticians'
  };

  // ---- Rules numbers -----------------------------------------------------
  S.RULES = {
    START_COINS: 7,
    BASE_TRADE_PRICE: 2,
    DISCARD_BASE_COINS: 2,
    MAX_WONDERS_BUILT: 7,
    PAWN_TO_WIN: 9,                // pawn on the opponent's capital space
    MILITARY_VP: [0, 2, 2, 5, 5, 5, 10, 10, 10]   // index = distance from centre (0..8)
  };

  // ---- Picture of the back of the cards (face-down cards in the pyramid)
  S.CARD_BACK_IMAGES = { 1: 'images/back-age1.jpg', 2: 'images/back-age2.jpg', 3: 'images/back-age3.jpg' };

  // ---- Icon pictures for resources, coin and shield (used instead of the emoji below).
  //      Put the files here (any size, square works best) or change the addresses.
  //      If a file does not exist the emoji is shown instead.
  S.ICON_IMAGES = {
    wood:    'images/resources/wood.png',
    clay:    'images/resources/clay.png',
    stone:   'images/resources/stone.png',
    glass:   'images/resources/glass.png',
    papyrus: 'images/resources/papyrus.png',
    coin:    'images/resources/coin.png',
    shield:  'images/resources/shield.png'
  };

  // ---- Glyphs for the text UI -------------------------------------------
  S.RES_GLYPH = { wood: '🌲', clay: '🧱', stone: '⛰️', glass: '🔮', papyrus: '📜' };
  S.SCIENCE_GLYPH = { wheel: '⚙️', quill: '🪶', mortar: '⚗️', pendulum: '🕰️', globe: '🌐', square: '📐', law: '⚖️' };
  S.COIN_GLYPH = '🪙';
  S.SHIELD_GLYPH = '🛡️';

  // ---- Helpers -----------------------------------------------------------
  S.cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  // Seedable RNG (mulberry32) so a game can be replayed from its seed.
  S.makeRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  S.shuffle = function (arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };

  // cost = { coins:n, resources:{wood:1,...} }  ->  "2 coins, 1 Stone"
  S.fmtCost = function (cost) {
    const parts = [];
    if (cost.coins) parts.push(cost.coins + (cost.coins === 1 ? ' coin' : ' coins'));
    const res = cost.resources || {};
    S.ALL_RESOURCES.forEach(function (r) { if (res[r]) parts.push(res[r] + ' ' + S.cap(r)); });
    return parts.length ? parts.join(', ') : 'Free';
  };

  S.fmtResMap = function (map) {
    const parts = [];
    S.ALL_RESOURCES.forEach(function (r) { if (map[r]) parts.push(map[r] + ' ' + S.cap(r)); });
    return parts.join(', ');
  };
})(globalThis.SWD);
