/* ==========================================================================
 * 7 Wonders Duel - Progress tokens, Military board, Card structure
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  // ========================================================================
  //  PROGRESS TOKENS (10 exist, 5 are on the board, 5 are set aside)
  // ========================================================================
  class ProgressToken {
    constructor(def) {
      this.id = def.id;
      this.name = def.name;
      this.image = def.image || null;        // picture address
      this.vp = def.vp || 0;                 // fixed VP at the end
      this.coins = def.coins || 0;           // coins when taken
      this.symbol = def.symbol || null;      // scientific symbol (Law)
      this.text = def.text;
    }
  }

  const TOKENS = [
    { id: 'agriculture', image: 'images/progress/agriculture.jpg',  name: 'Agriculture',  coins: 6, vp: 4, text: 'Take 6 coins now. Worth 4 VP.' },
    { id: 'architecture', image: 'images/progress/architecture.jpg', name: 'Architecture', text: 'Your future Wonders cost 2 fewer resources (your choice which).' },
    { id: 'economy', image: 'images/progress/economy.jpg',      name: 'Economy',      text: 'You gain the coins your opponent spends buying resources (not coins printed in building costs).' },
    { id: 'law', image: 'images/progress/law.jpg',          name: 'Law',          symbol: 'law', text: 'Counts as a scientific symbol.' },
    { id: 'masonry', image: 'images/progress/masonry.jpg',      name: 'Masonry',      text: 'Your future blue (civilian) cards cost 2 fewer resources (your choice which).' },
    { id: 'mathematics', image: 'images/progress/mathematics.jpg',  name: 'Mathematics',  text: 'End of game: 3 VP per Progress token you own (including this one).' },
    { id: 'philosophy', image: 'images/progress/philosophy.jpg',   name: 'Philosophy',   vp: 7, text: 'Worth 7 VP.' },
    { id: 'strategy', image: 'images/progress/strategy.jpg',     name: 'Strategy',     text: 'Your future military buildings (red cards) get +1 shield. Wonders are not affected.' },
    { id: 'theology', image: 'images/progress/theology.jpg',     name: 'Theology',     text: 'All your future Wonders get the "play again" effect.' },
    { id: 'urbanism', image: 'images/progress/urbanism.jpg',     name: 'Urbanism',     coins: 6, text: 'Take 6 coins now. Each building you build free through a chain gives you 4 coins.' }
  ];

  S.createProgressTokens = function () { return TOKENS.map((d) => new ProgressToken(d)); };
  S.ProgressToken = ProgressToken;

  // ========================================================================
  //  MILITARY BOARD
  //  pos runs -9 .. +9.  Player 0 pushing  => pos increases (toward player 1's capital at +9)
  //                      Player 1 pushing  => pos decreases (toward player 0's capital at -9)
  //  Looting tokens: 2 coins when the pawn enters the zone at +/-3, 5 coins at +/-6.
  //  The victim is the player whose side of the board the pawn has entered.
  // ========================================================================
  class MilitaryBoard {
    constructor() {
      this.pos = 0;
      this.tokens = [
        { pos: 3,  coins: 2, victim: 1, used: false },
        { pos: 6,  coins: 5, victim: 1, used: false },
        { pos: -3, coins: 2, victim: 0, used: false },
        { pos: -6, coins: 5, victim: 0, used: false }
      ];
    }

    /** Move the pawn n steps in favour of player pi. Returns a list of events:
     *   {type:'token', victim, coins}   {type:'win', winner}                      */
    move(pi, n) {
      const dir = pi === 0 ? 1 : -1;
      const events = [];
      for (let i = 0; i < n; i++) {
        this.pos += dir;
        if (Math.abs(this.pos) >= S.RULES.PAWN_TO_WIN) {
          this.pos = Math.sign(this.pos) * S.RULES.PAWN_TO_WIN;
          events.push({ type: 'win', winner: pi });
          break;
        }
        const t = this.tokens.find((k) => !k.used && k.pos === this.pos);
        if (t) { t.used = true; events.push({ type: 'token', victim: t.victim, coins: t.coins }); }
      }
      return events;
    }

    /** Index of the player who is ahead, or null when the pawn is in the centre. */
    leader() { return this.pos > 0 ? 0 : this.pos < 0 ? 1 : null; }

    /** Index of the player with the weaker military (pawn on their side), or null. */
    weaker() { return this.pos > 0 ? 1 : this.pos < 0 ? 0 : null; }

    /** End-of-game military victory points for player pi. */
    vpFor(pi) {
      if (this.leader() !== pi) return 0;
      return S.RULES.MILITARY_VP[Math.min(Math.abs(this.pos), 8)] || 0;
    }
  }
  S.MilitaryBoard = MilitaryBoard;

  // ========================================================================
  //  CARD STRUCTURE (the pyramid of 20 cards for each Age)
  //
  //  Each row lists the horizontal position ("col", in half-card units) of its
  //  cards. Two cards in neighbouring rows overlap when their cols differ by 1.
  //  "z" says which row lies on top: a card is COVERED (not accessible) while a
  //  not-yet-taken overlapping card of a higher z exists.
  //  "up" = row starts face up (face-down cards flip as soon as they are free).
  //
  //  Row counts follow the guide book:  Age I 2,3,4,5,6 | Age II 6,5,4,3,2 |
  //  Age III 2,3,4,2,4,3,2.  Age III's exact overlap pattern is not described in
  //  the text, so z for Age III is an assumption: rows lie on top the further
  //  they are from the centre row (change the z list below to try other shapes).
  // ========================================================================
  S.AGE_LAYOUTS = {
    1: {
      rows: [
        { cols: [2, 4],                   up: true },
        { cols: [1, 3, 5],                up: false },
        { cols: [0, 2, 4, 6],             up: true },
        { cols: [-1, 1, 3, 5, 7],         up: false },
        { cols: [-2, 0, 2, 4, 6, 8],      up: true }
      ],
      z: [1, 2, 3, 4, 5]
    },
    2: {
      rows: [
        { cols: [-2, 0, 2, 4, 6, 8],      up: true },
        { cols: [-1, 1, 3, 5, 7],         up: false },
        { cols: [0, 2, 4, 6],             up: true },
        { cols: [1, 3, 5],                up: false },
        { cols: [2, 4],                   up: true }
      ],
      z: [5, 4, 3, 2, 1]
    },
    3: {
      rows: [
        { cols: [2, 4],                   up: true },
        { cols: [1, 3, 5],                up: false },
        { cols: [0, 2, 4, 6],             up: true },
        { cols: [1, 5],                   up: false },
        { cols: [0, 2, 4, 6],             up: true },
        { cols: [1, 3, 5],                up: false },
        { cols: [2, 4],                   up: true }
      ],
      z: [4, 3, 2, 1, 2, 3, 4]
    }
  };

  class CardStructure {
    /** @param age 1|2|3   @param cards array of 20 Card objects (already shuffled) */
    constructor(age, cards) {
      const L = S.AGE_LAYOUTS[age];
      this.age = age;
      this.slots = [];
      let k = 0;
      L.rows.forEach((row, r) => {
        row.cols.forEach((col) => {
          this.slots.push({
            id: this.slots.length, row: r, col: col, z: L.z[r],
            faceUp: row.up, card: cards[k++], taken: false
          });
        });
      });
      this.minCol = Math.min.apply(null, this.slots.map((s) => s.col));
      this.maxCol = Math.max.apply(null, this.slots.map((s) => s.col));
      this.rowCount = L.rows.length;
      this.revealFree();
    }

    getSlot(id) { return this.slots[id] || null; }

    isCovered(s) {
      return this.slots.some((t) => !t.taken && t.z > s.z &&
        Math.abs(t.row - s.row) === 1 && Math.abs(t.col - s.col) === 1);
    }

    isAvailable(s) { return !s.taken && !this.isCovered(s); }

    available() { return this.slots.filter((s) => this.isAvailable(s)); }

    remaining() { return this.slots.filter((s) => !s.taken).length; }

    /** Turn every free face-down card face up. */
    revealFree() {
      this.slots.forEach((s) => { if (!s.taken && !this.isCovered(s)) s.faceUp = true; });
    }

    /** Remove a slot's card from the structure (then flip newly freed cards). */
    take(s) {
      s.taken = true;
      this.revealFree();
      return s.card;
    }
  }
  S.CardStructure = CardStructure;
})(globalThis.SWD);
