/* ==========================================================================
 * 7 Wonders Duel - Cards
 *
 *  - class Card          : one building (Age I / II / III or Guild)
 *  - SWD.Guilds          : the end-game / on-build rules of the 7 guilds
 *  - SWD.createDecks()   : builds fresh Card objects for every deck
 *
 * NOTE ON DATA: your guide book only lists card *names* and effect texts.
 * Costs, VP values, shields, chain links and science symbols below were
 * reconstructed from the rules text + public sources. Anything you want to
 * correct is a one-line edit in the AGE1 / AGE2 / AGE3 / GUILDS tables.
 *
 * Card fields (the ones you asked for):
 *   cost        { coins, resources:{wood,clay,stone,glass,papyrus} }  what is needed to build
 *   vp          final victory points printed on the card
 *   science     scientific symbol granted (green cards)
 *   chainGives  chain symbol granted (lets a later card be built free)
 *   chainFrom   chain symbol in the cost area (card is free if you own it)
 *   age / deck  1, 2, 3  or  'guild' (guilds are shuffled into the Age III deck)
 *   guildType   which guild (purple cards only)
 *   image       address of the card picture (relative to index.html); the file need not exist yet
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  class Card {
    constructor(def) {
      this.id = def.id;
      this.name = def.name;
      this.image = def.image || null;              // picture address, e.g. 'images/age1/quarry.jpg'
      this.age = def.age;                          // 1, 2 or 3
      this.deck = def.deck || def.age;             // 1 | 2 | 3 | 'guild'
      this.type = def.type;                        // S.CardType value
      this.cost = { coins: 0, resources: {} };
      if (def.cost) {
        this.cost.coins = def.cost.coins || 0;
        S.ALL_RESOURCES.forEach((r) => { if (def.cost[r]) this.cost.resources[r] = def.cost[r]; });
      }
      this.chainFrom = def.chainFrom || null;      // free if you own a building that grants this
      this.chainGives = def.chainGives || null;    // symbol this building grants
      this.chainFromName = null;                   // filled by createDecks() (for display only)
      this.vp = def.vp || 0;                       // fixed victory points
      this.shields = def.shields || 0;             // military strength
      this.science = def.science || null;          // scientific symbol
      this.production = def.production || null;    // { fixed:{res:n} }  or  { choice:[res,...] }
      this.tradeDiscount = def.tradeDiscount || []; // resources that cost only 1 coin to buy
      this.coins = def.coins || 0;                 // coins gained when built
      this.coinsPer = def.coinsPer || null;        // { of:'grey'|'brown'|'red'|'yellow'|'wonder', each:n }
      this.guildType = def.guildType || null;      // S.GuildType value (purple cards)
    }

    isGuild() { return this.type === S.CardType.PURPLE; }

    /** Coins the owner receives at the moment this card is constructed.
     *  (The card is already in owner.buildings when this is called.) */
    immediateCoins(owner, other) {
      let c = this.coins;
      if (this.coinsPer) {
        const n = this.coinsPer.of === 'wonder' ? owner.builtWonderCount() : owner.countType(this.coinsPer.of);
        c += n * this.coinsPer.each;
      }
      if (this.guildType) c += S.Guilds[this.guildType].coins(owner, other);
      return c;
    }

    /** Victory points at the end of the game. */
    endVP(owner, other) {
      let v = this.vp;
      if (this.guildType) v += S.Guilds[this.guildType].vp(owner, other);
      return v;
    }

    /** Human readable effect text. */
    describe() {
      const p = [];
      if (this.production && this.production.fixed) p.push('Produces ' + S.fmtResMap(this.production.fixed));
      if (this.production && this.production.choice) {
        p.push('Each turn: 1 of ' + this.production.choice.map(S.cap).join(' / '));
      }
      if (this.tradeDiscount.length) p.push('Buy ' + this.tradeDiscount.map(S.cap).join(' & ') + ' for 1 coin each');
      if (this.coins) p.push('+' + this.coins + ' coins');
      if (this.coinsPer) {
        const of = this.coinsPer.of === 'wonder' ? 'Wonder' : this.coinsPer.of + ' card';
        p.push('+' + this.coinsPer.each + ' coins per ' + of + ' in your city');
      }
      if (this.shields) p.push(this.shields + ' shield' + (this.shields > 1 ? 's' : ''));
      if (this.science) p.push('Science: ' + S.cap(this.science));
      if (this.guildType) p.push(S.Guilds[this.guildType].text);
      if (this.vp) p.push(this.vp + ' VP');
      if (this.chainGives) p.push('Gives chain: ' + this.chainGives);
      if (this.chainFrom) p.push('Free with chain: ' + this.chainFrom + (this.chainFromName ? ' (' + this.chainFromName + ')' : ''));
      return p.join(' | ');
    }
  }

  // ------------------------------------------------------------------------
  // Guild rules.  "city with the most X" => the owner always takes the better
  // of the two cities (the rule book lets the owner choose).
  // ------------------------------------------------------------------------
  const best = (a, b, f) => Math.max(f(a), f(b));

  function colourGuild(label, types) {
    const count = (pl) => types.reduce((n, t) => n + pl.countType(t), 0);
    return {
      name: label,
      text: 'Coins now AND VP at end: 1 per ' + types.join('/') + ' card in the city that has the most',
      coins: (me, other) => best(me, other, count),
      vp: (me, other) => best(me, other, count)
    };
  }

  S.Guilds = {
    builders: {
      name: 'Builders Guild',
      text: 'End: 2 VP per Wonder in the city with the most Wonders',
      coins: () => 0,
      vp: (me, other) => 2 * best(me, other, (p) => p.builtWonderCount())
    },
    moneylenders: {
      name: 'Moneylenders Guild',
      text: 'End: 1 VP per 3 coins in the richest city',
      coins: () => 0,
      vp: (me, other) => Math.floor(best(me, other, (p) => p.coins) / 3)
    },
    scientists: colourGuild('Scientists Guild', ['green']),
    shipowners: colourGuild('Shipowners Guild', ['brown', 'grey']),
    merchants: colourGuild('Merchants (Traders) Guild', ['yellow']),
    magistrates: colourGuild('Magistrates Guild', ['blue']),
    tacticians: colourGuild('Tacticians Guild', ['red'])
  };

  // ========================================================================
  //  CARD DATA
  //  cost: { coins:n, wood:n, clay:n, stone:n, glass:n, papyrus:n }
  // ========================================================================

  // ---- AGE I : 23 cards (20 used per game) -------------------------------
  const AGE1 = [
    // Raw materials (brown)
    { name: 'Lumber Yard', image: 'images/age1/lumber-yard.jpg',   type: 'brown', cost: {},            production: { fixed: { wood: 1 } } },
    { name: 'Logging Camp', image: 'images/age1/logging-camp.jpg',  type: 'brown', cost: { coins: 1 },  production: { fixed: { wood: 1 } } },
    { name: 'Clay Pool', image: 'images/age1/clay-pool.jpg',     type: 'brown', cost: {},            production: { fixed: { clay: 1 } } },
    { name: 'Clay Pit', image: 'images/age1/clay-pit.jpg',      type: 'brown', cost: { coins: 1 },  production: { fixed: { clay: 1 } } },
    { name: 'Quarry', image: 'images/age1/quarry.jpg',        type: 'brown', cost: {},            production: { fixed: { stone: 1 } } },
    { name: 'Stone Pit', image: 'images/age1/stone-pit.jpg',     type: 'brown', cost: { coins: 1 },  production: { fixed: { stone: 1 } } },
    // Manufactured goods (grey)
    { name: 'Glassworks', image: 'images/age1/glassworks.jpg',    type: 'grey',  cost: { coins: 1 },  production: { fixed: { glass: 1 } } },
    { name: 'Press', image: 'images/age1/press.jpg',         type: 'grey',  cost: { coins: 1 },  production: { fixed: { papyrus: 1 } } },
    // Civilian (blue)
    { name: 'Theater', image: 'images/age1/theater.jpg',       type: 'blue',  cost: {},            vp: 3, chainGives: 'mask' },
    { name: 'Altar', image: 'images/age1/altar.jpg',         type: 'blue',  cost: {},            vp: 3, chainGives: 'moon' },
    { name: 'Baths', image: 'images/age1/baths.jpg',         type: 'blue',  cost: { stone: 1 },  vp: 3, chainGives: 'droplet' },
    // Commercial (yellow)
    { name: 'Tavern', image: 'images/age1/tavern.jpg',        type: 'yellow', cost: {},           coins: 4, chainGives: 'jar' },
    { name: 'Stone Reserve', image: 'images/age1/stone-reserve.jpg', type: 'yellow', cost: { coins: 3 }, tradeDiscount: ['stone'] },
    { name: 'Clay Reserve', image: 'images/age1/clay-reserve.jpg',  type: 'yellow', cost: { coins: 3 }, tradeDiscount: ['clay'] },
    { name: 'Wood Reserve', image: 'images/age1/wood-reserve.jpg',  type: 'yellow', cost: { coins: 3 }, tradeDiscount: ['wood'] },
    // Military (red)
    { name: 'Guard Tower', image: 'images/age1/guard-tower.jpg',   type: 'red',   cost: {},            shields: 1 },
    { name: 'Stable', image: 'images/age1/stable.jpg',        type: 'red',   cost: { wood: 1 },   shields: 1, chainGives: 'horseshoe' },
    { name: 'Garrison', image: 'images/age1/garrison.jpg',      type: 'red',   cost: { clay: 1 },   shields: 1, chainGives: 'sword' },
    { name: 'Palisade', image: 'images/age1/palisade.jpg',      type: 'red',   cost: { coins: 2 },  shields: 1, chainGives: 'tower' },
    // Scientific (green)
    { name: 'Apothecary', image: 'images/age1/apothecary.jpg',    type: 'green', cost: { glass: 1 },   vp: 1, science: 'pendulum' },
    { name: 'Workshop', image: 'images/age1/workshop.jpg',      type: 'green', cost: { papyrus: 1 }, vp: 1, science: 'wheel' },
    { name: 'Scriptorium', image: 'images/age1/scriptorium.jpg',   type: 'green', cost: { coins: 2 },   science: 'quill',  chainGives: 'book' },
    { name: 'Pharmacist', image: 'images/age1/pharmacist.jpg',    type: 'green', cost: { coins: 2 },   science: 'mortar', chainGives: 'flask' }
  ];

  // ---- AGE II : 23 cards (20 used per game) ------------------------------
  const AGE2 = [
    // Raw materials (brown) - produce 2 units
    { name: 'Sawmill', image: 'images/age2/sawmill.jpg',       type: 'brown', cost: { coins: 2 }, production: { fixed: { wood: 2 } } },
    { name: 'Brickyard', image: 'images/age2/brickyard.jpg',     type: 'brown', cost: { coins: 2 }, production: { fixed: { clay: 2 } } },
    { name: 'Shelf Quarry', image: 'images/age2/shelf-quarry.jpg',  type: 'brown', cost: { coins: 2 }, production: { fixed: { stone: 2 } } },
    // Manufactured goods (grey)
    { name: 'Glass-blower', image: 'images/age2/glass-blower.jpg',  type: 'grey',  cost: {},           production: { fixed: { glass: 1 } } },
    { name: 'Drying Room', image: 'images/age2/drying-room.jpg',   type: 'grey',  cost: {},           production: { fixed: { papyrus: 1 } } },
    // Civilian (blue)
    { name: 'Courthouse', image: 'images/age2/courthouse.jpg',    type: 'blue',  cost: { wood: 2, glass: 1 },    vp: 5 },
    { name: 'Temple', image: 'images/age2/temple.jpg',        type: 'blue',  cost: { wood: 1, papyrus: 1 },  vp: 4, chainFrom: 'moon',    chainGives: 'sun' },
    { name: 'Statue', image: 'images/age2/statue.jpg',        type: 'blue',  cost: { clay: 2 },              vp: 4, chainFrom: 'mask',    chainGives: 'lion' },
    { name: 'Aqueduct', image: 'images/age2/aqueduct.jpg',      type: 'blue',  cost: { stone: 3 },             vp: 5, chainFrom: 'droplet' },
    { name: 'Rostrum', image: 'images/age2/rostrum.jpg',       type: 'blue',  cost: { stone: 1, wood: 1 },    vp: 4, chainGives: 'column' },
    // Commercial (yellow)
    { name: 'Customs House', image: 'images/age2/customs-house.jpg', type: 'yellow', cost: { coins: 4 },            tradeDiscount: ['glass', 'papyrus'] },
    { name: 'Forum', image: 'images/age2/forum.jpg',         type: 'yellow', cost: { clay: 3 },             production: { choice: ['glass', 'papyrus'] } },
    { name: 'Caravansery', image: 'images/age2/caravansery.jpg',   type: 'yellow', cost: { coins: 2, glass: 1, papyrus: 1 }, production: { choice: ['wood', 'clay', 'stone'] } },
    { name: 'Brewery', image: 'images/age2/brewery.jpg',       type: 'yellow', cost: {},                      coins: 6, chainGives: 'barrel' },
    // Military (red)
    { name: 'Horse Breeders', image: 'images/age2/horse-breeders.jpg', type: 'red',  cost: { clay: 1, wood: 1 },     shields: 1, chainFrom: 'horseshoe' },
    { name: 'Barracks', image: 'images/age2/barracks.jpg',      type: 'red',   cost: { coins: 3 },             shields: 1, chainFrom: 'sword' },
    { name: 'Archery Range', image: 'images/age2/archery-range.jpg', type: 'red',   cost: { wood: 1, stone: 1, papyrus: 1 }, shields: 2, chainGives: 'target' },
    { name: 'Parade Ground', image: 'images/age2/parade-ground.jpg', type: 'red',   cost: { clay: 2, glass: 1 },    shields: 2, chainGives: 'helmet' },
    { name: 'Walls', image: 'images/age2/walls.jpg',         type: 'red',   cost: { stone: 2 },             shields: 2 },
    // Scientific (green)
    { name: 'Library', image: 'images/age2/library.jpg',       type: 'green', cost: { stone: 1, wood: 1, glass: 1 }, vp: 2, science: 'quill',    chainFrom: 'book' },
    { name: 'School', image: 'images/age2/school.jpg',        type: 'green', cost: { wood: 1, papyrus: 2 },  vp: 1, science: 'pendulum',    chainGives: 'harp' },
    { name: 'Laboratory', image: 'images/age2/laboratory.jpg',    type: 'green', cost: { wood: 1, glass: 2 },    vp: 1, science: 'wheel', chainGives: 'lamp' },
    { name: 'Dispensary', image: 'images/age2/dispensary.jpg',    type: 'green', cost: { clay: 2, stone: 1 },    vp: 2, science: 'mortar',   chainFrom: 'flask' }
  ];

  // ---- AGE III : 20 cards (17 used + 3 random guilds) --------------------
  const AGE3 = [
    // Civilian (blue)
    { name: 'Palace', image: 'images/age3/palace.jpg',        type: 'blue',  cost: { clay: 1, stone: 1, wood: 1, glass: 2 }, vp: 7 },
    { name: 'Town Hall', image: 'images/age3/town-hall.jpg',     type: 'blue',  cost: { stone: 3, wood: 1, glass: 1 },          vp: 7 },
    { name: 'Obelisk', image: 'images/age3/obelisk.jpg',       type: 'blue',  cost: { stone: 2, glass: 1 },                   vp: 5 },
    { name: 'Gardens', image: 'images/age3/gardens.jpg',       type: 'blue',  cost: { clay: 2, wood: 2 },                     vp: 6, chainFrom: 'lion' },
    { name: 'Pantheon', image: 'images/age3/pantheon.jpg',      type: 'blue',  cost: { clay: 1, wood: 1, papyrus: 2 },         vp: 6, chainFrom: 'sun' },
    { name: 'Senate', image: 'images/age3/senate.jpg',        type: 'blue',  cost: { clay: 2, stone: 2, papyrus: 1 },        vp: 5, chainFrom: 'column' },
    // Commercial (yellow) - coins when built + 3 VP each
    { name: 'Chamber of Commerce', image: 'images/age3/chamber-of-commerce.jpg', type: 'yellow', cost: { papyrus: 2 },                    vp: 3, coinsPer: { of: 'grey', each: 3 } },
    { name: 'Port', image: 'images/age3/port.jpg',          type: 'yellow', cost: { wood: 1, glass: 1, papyrus: 1 },        vp: 3, coinsPer: { of: 'brown', each: 2 } },
    { name: 'Armory', image: 'images/age3/armory.jpg',        type: 'yellow', cost: { stone: 2, glass: 1 },                   vp: 3, coinsPer: { of: 'red', each: 1 } },
    { name: 'Lighthouse', image: 'images/age3/lighthouse.jpg',    type: 'yellow', cost: { clay: 2, glass: 2 },                    vp: 3, coinsPer: { of: 'yellow', each: 1 }, chainFrom: 'jar' },
    { name: 'Arena', image: 'images/age3/arena.jpg',         type: 'yellow', cost: { clay: 1, stone: 1, wood: 1 },           vp: 3, coinsPer: { of: 'wonder', each: 2 }, chainFrom: 'barrel' },
    // Military (red)
    { name: 'Arsenal', image: 'images/age3/arsenal.jpg',       type: 'red',   cost: { clay: 2, wood: 3 },                      shields: 3 },
    { name: 'Pretorium', image: 'images/age3/pretorium.jpg',     type: 'red',   cost: { coins: 8 },                              shields: 3 },
    { name: 'Fortifications', image: 'images/age3/fortifications.jpg', type: 'red',  cost: { stone: 2, clay: 1, papyrus: 1 },         shields: 2, chainFrom: 'tower' },
    { name: 'Siege Workshop', image: 'images/age3/siege-workshop.jpg', type: 'red',  cost: { wood: 3, glass: 1 },                     shields: 2, chainFrom: 'target' },
    { name: 'Circus', image: 'images/age3/circus.jpg',        type: 'red',   cost: { clay: 2, stone: 2 },                     shields: 2, chainFrom: 'helmet' },
    // Scientific (green)
    { name: 'Academy', image: 'images/age3/academy.jpg',       type: 'green', cost: { stone: 1, wood: 1, glass: 2 },           vp: 3, science: 'square' },
    { name: 'Study', image: 'images/age3/study.jpg',         type: 'green', cost: { wood: 1, papyrus: 1, glass: 1 },         vp: 3, science: 'square' },
    { name: 'University', image: 'images/age3/university.jpg',    type: 'green', cost: { clay: 1, glass: 1, papyrus: 1 },         vp: 2, science: 'globe', chainFrom: 'harp' },
    { name: 'Observatory', image: 'images/age3/observatory.jpg',   type: 'green', cost: { stone: 1, papyrus: 2 },                  vp: 2, science: 'globe', chainFrom: 'lamp' }
  ];

  // ---- GUILDS : 7 cards (3 random ones are added to the Age III deck) ----
  const GUILDS = [
    { name: 'Merchants Guild', image: 'images/guilds/merchants-guild.jpg',   type: 'purple', cost: { clay: 1, wood: 1, glass: 1, papyrus: 1 }, guildType: 'merchants' },
    { name: 'Shipowners Guild', image: 'images/guilds/shipowners-guild.jpg',  type: 'purple', cost: { clay: 1, stone: 1, glass: 1, papyrus: 1 }, guildType: 'shipowners' },
    { name: 'Builders Guild', image: 'images/guilds/builders-guild.jpg',    type: 'purple', cost: { stone: 2, clay: 1, wood: 1, glass: 1 },   guildType: 'builders' },
    { name: 'Magistrates Guild', image: 'images/guilds/magistrates-guild.jpg', type: 'purple', cost: { wood: 2, clay: 1, papyrus: 1 },           guildType: 'magistrates' },
    { name: 'Scientists Guild', image: 'images/guilds/scientists-guild.jpg',  type: 'purple', cost: { clay: 2, wood: 2 },                       guildType: 'scientists' },
    { name: 'Moneylenders Guild', image: 'images/guilds/moneylenders-guild.jpg', type: 'purple', cost: { stone: 2, wood: 2 },                     guildType: 'moneylenders' },
    { name: 'Tacticians Guild', image: 'images/guilds/tacticians-guild.jpg',  type: 'purple', cost: { stone: 2, wood: 1, papyrus: 1 },          guildType: 'tacticians' }
  ];

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /** Fresh Card objects for every deck. Returns { 1:[..23], 2:[..23], 3:[..20], guild:[..7] } */
  S.createDecks = function () {
    const make = (list, age, deck) => list.map((d) => new Card(Object.assign({}, d, {
      id: (deck === 'guild' ? 'g' : 'a' + age) + '-' + slug(d.name), age: age, deck: deck
    })));
    const decks = {
      1: make(AGE1, 1, 1),
      2: make(AGE2, 2, 2),
      3: make(AGE3, 3, 3),
      guild: make(GUILDS, 3, 'guild')
    };
    // For display: which building gives the chain symbol this card needs
    const giver = {};
    [1, 2, 3, 'guild'].forEach((k) => decks[k].forEach((c) => { if (c.chainGives) giver[c.chainGives] = c.name; }));
    [1, 2, 3, 'guild'].forEach((k) => decks[k].forEach((c) => { if (c.chainFrom) c.chainFromName = giver[c.chainFrom] || null; }));
    return decks;
  };

  S.Card = Card;
})(globalThis.SWD);
