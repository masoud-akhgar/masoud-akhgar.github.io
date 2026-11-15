/* ==========================================================================
 * 7 Wonders Duel - Wonders (12 cards, 4 per player are drafted, max 7 built)
 *
 * Effect fields (all optional):
 *   vp              victory points at the end
 *   shields         military strength (Strategy token does NOT add to wonders)
 *   coins           coins taken from the bank when built
 *   opponentLoses   coins the opponent loses (returned to the bank)
 *   playAgain       immediately play a second turn
 *   produces        [res,...]  1 unit of one of these resources each turn
 *   special         'discardGrey' | 'discardBrown' | 'mausoleum' | 'greatLibrary'
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  class Wonder {
    constructor(def) {
      this.id = def.id;
      this.name = def.name;
      this.image = def.image || null;        // picture address
      this.cost = def.cost;                  // {resource: n}  (no coin cost on wonders)
      this.vp = def.vp || 0;
      this.shields = def.shields || 0;
      this.coins = def.coins || 0;
      this.opponentLoses = def.opponentLoses || 0;
      this.playAgain = !!def.playAgain;
      this.produces = def.produces || null;
      this.special = def.special || null;
      // runtime state
      this.owner = null;                     // player index once drafted
      this.built = false;
      this.removed = false;                  // returned to the box when the 7th wonder is built
      this.cardUsed = null;                  // the Age card that was placed under it
    }

    describe() {
      const p = [];
      if (this.coins) p.push('+' + this.coins + ' coins');
      if (this.opponentLoses) p.push('Opponent loses ' + this.opponentLoses + ' coins');
      if (this.shields) p.push(this.shields + ' shield' + (this.shields > 1 ? 's' : ''));
      if (this.produces) p.push('Each turn: 1 of ' + this.produces.map(S.cap).join(' / '));
      if (this.special === 'discardGrey') p.push('Discard 1 grey card of your opponent');
      if (this.special === 'discardBrown') p.push('Discard 1 brown card of your opponent');
      if (this.special === 'mausoleum') p.push('Build a card from the discard pile for free');
      if (this.special === 'greatLibrary') p.push('Draw 3 set-aside Progress tokens, keep 1');
      if (this.playAgain) p.push('Play again');
      if (this.vp) p.push(this.vp + ' VP');
      return p.join(' | ');
    }
  }

  const WONDERS = [
    { id: 'appian-way', image: 'images/wonders/appian-way.jpg',      name: 'The Appian Way',        cost: { clay: 2, stone: 1, papyrus: 1 },
      coins: 3, opponentLoses: 3, playAgain: true, vp: 3 },
    { id: 'circus-maximus', image: 'images/wonders/circus-maximus.jpg',  name: 'Circus Maximus',        cost: { stone: 2, wood: 1, glass: 1 },
      special: 'discardGrey', shields: 1, vp: 3 },
    { id: 'colossus', image: 'images/wonders/colossus.jpg',        name: 'The Colossus',          cost: { clay: 3, glass: 1 },
      shields: 2, vp: 3 },
    { id: 'great-library', image: 'images/wonders/great-library.jpg',   name: 'The Great Library',     cost: { wood: 3, glass: 1, papyrus: 1 },
      special: 'greatLibrary', vp: 4 },
    { id: 'great-lighthouse', image: 'images/wonders/great-lighthouse.jpg', name: 'The Great Lighthouse', cost: { stone: 1, wood: 1, papyrus: 2 },
      produces: ['stone', 'clay', 'wood'], vp: 4 },
    { id: 'hanging-gardens', image: 'images/wonders/hanging-gardens.jpg', name: 'The Hanging Gardens',   cost: { wood: 2, glass: 1, papyrus: 1 },
      coins: 6, playAgain: true, vp: 3 },
    { id: 'mausoleum', image: 'images/wonders/mausoleum.jpg',       name: 'The Mausoleum',         cost: { clay: 1, glass: 2, papyrus: 1 },
      special: 'mausoleum', vp: 2 },
    { id: 'piraeus', image: 'images/wonders/piraeus.jpg',         name: 'Piraeus',               cost: { wood: 2, clay: 1, stone: 1 },
      produces: ['glass', 'papyrus'], playAgain: true, vp: 2 },
    { id: 'pyramids', image: 'images/wonders/pyramids.jpg',        name: 'The Pyramids',          cost: { stone: 3, papyrus: 1 },
      vp: 9 },
    { id: 'sphinx', image: 'images/wonders/sphinx.jpg',          name: 'The Sphinx',            cost: { stone: 1, clay: 1, glass: 2 },
      playAgain: true, vp: 6 },
    { id: 'statue-of-zeus', image: 'images/wonders/statue-of-zeus.jpg',  name: 'The Statue of Zeus',    cost: { clay: 1, wood: 1, stone: 1, papyrus: 2 },
      special: 'discardBrown', shields: 1, vp: 3 },
    { id: 'temple-of-artemis', image: 'images/wonders/temple-of-artemis.jpg', name: 'The Temple of Artemis', cost: { stone: 1, wood: 1, glass: 1, papyrus: 1 },
      coins: 12, playAgain: true }
  ];

  // Suggested wonders for a first game (rule book, "Preparation")
  S.BEGINNER_WONDERS = [
    ['pyramids', 'great-lighthouse', 'temple-of-artemis', 'statue-of-zeus'],   // Player 1
    ['circus-maximus', 'piraeus', 'appian-way', 'colossus']                    // Player 2
  ];

  S.createWonders = function () { return WONDERS.map((d) => new Wonder(d)); };
  S.Wonder = Wonder;
})(globalThis.SWD);
