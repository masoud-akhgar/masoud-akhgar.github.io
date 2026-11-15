/* ==========================================================================
 * 7 Wonders Duel - Game engine (no DOM, runs in the browser and in Node)
 *
 * Public API used by the UI
 *   new SWD.Game({names:[a,b], first:'random'|0|1, beginnerWonders:bool, seed:n})
 *   game.phase                'draft' | 'play' | 'over'
 *   game.pickWonder(id)       wonder draft
 *   game.actionsFor(slotId)   what the current player may do with a free card
 *   game.doBuild(slotId) / game.doDiscard(slotId) / game.doWonder(slotId, wonderId)
 *   game.pending              a decision the game waits for  (see _ask)
 *   game.decide(optionId)     answer the pending decision
 * Every action returns { ok:true } or { ok:false, error:'...' }.
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  const ok = () => ({ ok: true });
  const fail = (msg) => ({ ok: false, error: msg });

  class Game {
    constructor(opts) {
      this.opts = Object.assign({ names: ['Player 1', 'Player 2'], first: 'random',
                                  beginnerWonders: false, seed: null }, opts || {});
      this.seed = this.opts.seed != null ? this.opts.seed : Math.floor(Math.random() * 2147483647);
      this.rng = S.makeRng(this.seed);
      this.players = [new S.Player(0, this.opts.names[0] || 'Player 1'),
                      new S.Player(1, this.opts.names[1] || 'Player 2')];
      this.logLines = [];
      this.phase = 'draft';
      this.over = false;
      this.winner = null;            // 0 | 1 | null (null + over = tie)
      this.endReason = null;         // 'military' | 'science' | 'civilian'
      this.scores = null;
      this.pending = null;           // decision the UI must answer
      this.queue = [];               // decisions waiting behind `pending`
      this.replay = false;           // current player plays again
      this.current = 0;
      this.lastActive = 0;
      this.age = 0;
      this.structure = null;
      this.discardPile = [];
      this.wondersBuilt = 0;
      this._setup();
    }

    get me() { return this.players[this.current]; }
    get opp() { return this.players[1 - this.current]; }
    other(p) { return this.players[1 - p.index]; }

    log(msg) { this.logLines.push(msg); }

    // =====================================================================
    //  SETUP
    // =====================================================================
    _setup() {
      const rng = this.rng;
      this.first = this.opts.first === 'random' ? (rng() < 0.5 ? 0 : 1) : Number(this.opts.first);
      this.second = 1 - this.first;
      this.military = new S.MilitaryBoard();

      // Progress tokens: 5 on the board, 5 set aside (used by the Great Library)
      const tokens = S.shuffle(S.createProgressTokens(), rng);
      this.progressBoard = tokens.slice(0, 5);
      this.progressBox = tokens.slice(5);

      // Decks: remove 3 random cards of each Age; add 3 random guilds to Age III
      const d = S.createDecks();
      this.decks = {
        1: S.shuffle(d[1], rng).slice(3),
        2: S.shuffle(d[2], rng).slice(3),
        3: S.shuffle(d[3], rng).slice(3).concat(S.shuffle(d.guild, rng).slice(0, 3))
      };

      // Wonders
      const wonders = S.createWonders();
      if (this.opts.beginnerWonders) {
        S.BEGINNER_WONDERS.forEach((ids, pi) => {
          ids.forEach((id) => {
            const w = wonders.find((x) => x.id === id);
            w.owner = pi; this.players[pi].wonders.push(w);
          });
        });
        this.log('Beginner wonders assigned.');
        this._beginPlay();
      } else {
        this.wonderDeck = S.shuffle(wonders, rng);
        this.draft = { round: 1, pool: this.wonderDeck.splice(0, 4),
                       order: [this.first, this.second, this.second] };
        this.log(this.players[this.first].name + ' is the first player. Wonder draft, round 1.');
      }
    }

    _beginPlay() {
      this.phase = 'play';
      this._startAge(1);
    }

    // =====================================================================
    //  WONDER DRAFT  (first picks 1, second picks 2, first gets the last;
    //                 then second picks 1, first picks 2, second gets the last)
    // =====================================================================
    pickWonder(wonderId) {
      if (this.phase !== 'draft') return fail('The wonder draft is over.');
      const d = this.draft;
      const w = d.pool.find((x) => x.id === wonderId);
      if (!w) return fail('That wonder is not available.');
      const pi = d.order.shift();
      this._giveWonder(w, pi);
      d.pool = d.pool.filter((x) => x !== w);
      if (d.pool.length === 1) {                       // the last card goes automatically
        const lastOwner = d.round === 1 ? this.first : this.second;
        this._giveWonder(d.pool[0], lastOwner);
        d.pool = [];
      }
      if (d.pool.length === 0) {
        if (d.round === 1) {
          d.round = 2;
          d.pool = this.wonderDeck.splice(0, 4);
          d.order = [this.second, this.first, this.first];
          this.log('Wonder draft, round 2.');
        } else {
          this.draft = null;
          this._beginPlay();
        }
      }
      return ok();
    }

    _giveWonder(w, pi) {
      w.owner = pi;
      this.players[pi].wonders.push(w);
      this.log(this.players[pi].name + ' takes ' + w.name + '.');
    }

    // =====================================================================
    //  AGES
    // =====================================================================
    _startAge(n) {
      this.age = n;
      const deck = S.shuffle(this.decks[n], this.rng);
      this.structure = new S.CardStructure(n, deck);
      this.log('--- Age ' + n + ' begins (' + deck.length + ' cards) ---');
      if (n === 1) {
        this.current = this.first;
        this.log(this.me.name + ' starts Age I.');
        return;
      }
      // weaker military (pawn on their side) chooses who starts; centre => last active player
      const weaker = this.military.weaker();
      const chooser = weaker !== null ? weaker : this.lastActive;
      this.current = chooser;       // so the UI highlights who decides
      this._ask({
        kind: 'startingPlayer', player: chooser, inTurn: false,
        title: this.players[chooser].name + ': who begins Age ' + n + '?',
        options: this.players.map((p) => ({ id: String(p.index), label: p.name })),
        resolve: (id) => { this.current = Number(id); this.log(this.me.name + ' starts Age ' + n + '.'); }
      });
    }

    _endAge() {
      this.log('Age ' + this.age + ' ends.');
      if (this.age === 3) { this._finishByPoints(); return; }
      this._startAge(this.age + 1);
    }

    // =====================================================================
    //  QUERIES FOR THE UI
    // =====================================================================
    canAct() { return this.phase === 'play' && !this.over && !this.pending; }

    /** Options for the current player for the card in `slotId`. */
    actionsFor(slotId) {
      const slot = this.structure.getSlot(slotId);
      if (!slot || !this.structure.isAvailable(slot)) return null;
      const me = this.me, opp = this.opp;
      const wondersLeft = S.RULES.MAX_WONDERS_BUILT - this.wondersBuilt;
      return {
        slot: slot, card: slot.card,
        build: me.buildInfo(slot.card, opp),
        discardGain: S.RULES.DISCARD_BASE_COINS + me.countType('yellow'),
        wondersLeft: wondersLeft,
        wonders: me.wonders.filter((w) => !w.built && !w.removed).map((w) => {
          const info = me.wonderInfo(w, opp);
          return { wonder: w, info: info, allowed: wondersLeft > 0 && info.affordable };
        })
      };
    }

    // =====================================================================
    //  ACTIONS
    // =====================================================================
    _checkSlot(slotId) {
      if (!this.canAct()) return { err: fail(this.pending ? 'Answer the pending decision first.' : 'The game is not accepting moves.') };
      const slot = this.structure.getSlot(slotId);
      if (!slot || !this.structure.isAvailable(slot)) return { err: fail('That card is not accessible.') };
      return { slot: slot };
    }

    /** 1) Construct the building */
    doBuild(slotId) {
      const r = this._checkSlot(slotId); if (r.err) return r.err;
      const me = this.me, opp = this.opp, card = r.slot.card;
      const info = me.buildInfo(card, opp);
      if (!info.affordable) return fail('Not enough coins (needs ' + info.total + ', you have ' + me.coins + ').');
      this._pay(me, opp, info);
      this._take(r.slot);
      this.log(me.name + ' builds ' + card.name + (info.viaChain ? ' (free through chain)' : '') +
               this._payText(info) + '.');
      this._construct(me, card, { viaChain: info.viaChain });
      this._settle();
      return ok();
    }

    /** 2) Discard the card for coins */
    doDiscard(slotId) {
      const r = this._checkSlot(slotId); if (r.err) return r.err;
      const me = this.me, card = r.slot.card;
      const gain = S.RULES.DISCARD_BASE_COINS + me.countType('yellow');
      me.coins += gain;
      this._take(r.slot);
      this.discardPile.push(card);
      this.log(me.name + ' discards ' + card.name + ' for ' + gain + ' coins.');
      this._settle();
      return ok();
    }

    /** 3) Use the card to construct one of your wonders */
    doWonder(slotId, wonderId) {
      const r = this._checkSlot(slotId); if (r.err) return r.err;
      const me = this.me, opp = this.opp;
      const w = me.wonders.find((x) => x.id === wonderId);
      if (!w || w.built || w.removed) return fail('That wonder cannot be built.');
      if (this.wondersBuilt >= S.RULES.MAX_WONDERS_BUILT) return fail('Only 7 wonders can be built.');
      const info = me.wonderInfo(w, opp);
      if (!info.affordable) return fail('Not enough coins (needs ' + info.total + ', you have ' + me.coins + ').');
      this._pay(me, opp, info);
      const card = this._take(r.slot);
      w.built = true;
      w.cardUsed = card;
      this.wondersBuilt++;
      this.log(me.name + ' builds the wonder ' + w.name + this._payText(info) + '.');
      this._applyWonder(me, w);
      if (this.wondersBuilt >= S.RULES.MAX_WONDERS_BUILT) {
        this.players.forEach((p) => p.wonders.forEach((x) => {
          if (!x.built && !x.removed) { x.removed = true; this.log(x.name + ' is returned to the box (7 wonders built).'); }
        }));
      }
      this._settle();
      return ok();
    }

    // ---- helpers for actions ----------------------------------------------
    _take(slot) {
      this.lastActive = this.current;
      return this.structure.take(slot);
    }

    _pay(me, opp, info) {
      me.coins -= info.total;
      if (info.tradeTotal > 0 && opp.hasProgress('economy')) {
        opp.coins += info.tradeTotal;
        this.log(opp.name + ' gains ' + info.tradeTotal + ' coins (Economy).');
      }
    }

    _payText(info) {
      if (info.total <= 0) return '';
      const parts = [];
      if (info.printedCoins) parts.push(info.printedCoins + ' coins');
      Object.keys(info.trade).forEach((r) => parts.push(info.trade[r].units + ' ' + r + ' bought'));
      if (info.tradeTotal) parts.push('trading ' + info.tradeTotal + ' coins');
      return ' (paid ' + info.total + ': ' + parts.join(', ') + ')';
    }

    // =====================================================================
    //  EFFECTS
    // =====================================================================
    /** Put a building into a city and apply everything it does immediately. */
    _construct(p, card, opts) {
      opts = opts || {};
      const o = this.other(p);
      p.buildings.push(card);
      const gain = card.immediateCoins(p, o);
      if (gain) { p.coins += gain; this.log(p.name + ' gains ' + gain + ' coins.'); }
      if (opts.viaChain && p.hasProgress('urbanism')) {
        p.coins += 4; this.log(p.name + ' gains 4 coins (Urbanism).');
      }
      let shields = card.shields;
      if (shields && card.type === 'red' && p.hasProgress('strategy')) shields += 1;
      if (shields) this._moveMilitary(p, shields);
      if (this.over) return;
      if (card.science) this._gainScience(p, card.science);
    }

    _moveMilitary(p, shields) {
      const events = this.military.move(p.index, shields);
      this.log(p.name + ' pushes the conflict pawn ' + shields + ' space' + (shields > 1 ? 's' : '') + '.');
      events.forEach((ev) => {
        if (ev.type === 'token') {
          const v = this.players[ev.victim];
          const lost = Math.min(v.coins, ev.coins);
          v.coins -= lost;
          this.log('Military token: ' + v.name + ' loses ' + lost + ' coins.');
        } else if (ev.type === 'win') {
          this._win(p, 'military');
        }
      });
    }

    _gainScience(p, symbol) {
      p.science[symbol] = (p.science[symbol] || 0) + 1;
      if (p.distinctScience() >= S.SCIENCE_SYMBOLS_NEEDED_TO_WIN) { this._win(p, 'science'); return; }
      if (symbol !== 'law' && p.science[symbol] % 2 === 0) {
        if (this.progressBoard.length === 0) { this.log('No Progress tokens left on the board.'); return; }
        this._ask({
          kind: 'progress', player: p.index,
          title: p.name + ': a pair of ' + symbol + ' symbols! Choose a Progress token.',
          options: this.progressBoard.map((t) => ({ id: t.id, label: t.name, text: t.text })),
          resolve: (id) => {
            const t = this.progressBoard.find((x) => x.id === id);
            this.progressBoard = this.progressBoard.filter((x) => x !== t);
            this._grantProgress(p, t);
          }
        });
      }
    }

    _grantProgress(p, t) {
      p.progress.push(t);
      this.log(p.name + ' takes the Progress token ' + t.name + '.');
      if (t.coins) { p.coins += t.coins; this.log(p.name + ' gains ' + t.coins + ' coins.'); }
      if (t.symbol) this._gainScience(p, t.symbol);
    }

    _applyWonder(p, w) {
      const o = this.other(p);
      if (w.coins) { p.coins += w.coins; this.log(p.name + ' gains ' + w.coins + ' coins.'); }
      if (w.opponentLoses) {
        const lost = Math.min(o.coins, w.opponentLoses);
        o.coins -= lost;
        this.log(o.name + ' loses ' + lost + ' coins.');
      }
      if (w.shields) this._moveMilitary(p, w.shields);      // Strategy does not apply to wonders
      if (this.over) return;
      if (w.playAgain || p.hasProgress('theology')) this.replay = true;

      if (w.special === 'discardGrey' || w.special === 'discardBrown') {
        const type = w.special === 'discardGrey' ? 'grey' : 'brown';
        const opts = o.buildings.filter((c) => c.type === type);
        this._ask({
          kind: 'discardOpponent', player: p.index,
          title: p.name + ': discard one of ' + o.name + "'s " + type + ' cards.',
          options: opts.map((c) => ({ id: c.id, label: c.name, text: c.describe() })),
          resolve: (id) => {
            const c = o.buildings.find((x) => x.id === id);
            o.buildings = o.buildings.filter((x) => x !== c);
            this.discardPile.push(c);
            this.log(c.name + ' of ' + o.name + ' is discarded.');
          }
        });
      }
      if (w.special === 'mausoleum') {
        this._ask({
          kind: 'mausoleum', player: p.index,
          title: p.name + ': build a card from the discard pile for free.',
          options: this.discardPile.map((c) => ({ id: c.id, label: c.name, text: c.describe() })),
          resolve: (id) => {
            const c = this.discardPile.find((x) => x.id === id);
            this.discardPile = this.discardPile.filter((x) => x !== c);
            this.log(p.name + ' builds ' + c.name + ' from the discard pile for free.');
            this._construct(p, c, { viaChain: false });
          }
        });
      }
      if (w.special === 'greatLibrary') {
        const drawn = S.shuffle(this.progressBox, this.rng).slice(0, 3);
        this._ask({
          kind: 'greatLibrary', player: p.index,
          title: p.name + ': Great Library - choose 1 of 3 set-aside Progress tokens.',
          options: drawn.map((t) => ({ id: t.id, label: t.name, text: t.text })),
          resolve: (id) => {
            const t = drawn.find((x) => x.id === id);
            this.progressBox = this.progressBox.filter((x) => !drawn.includes(x));   // others go back to the box
            this._grantProgress(p, t);
          }
        });
      }
    }

    // =====================================================================
    //  DECISIONS
    // =====================================================================
    _ask(decision) {
      decision.inTurn = decision.inTurn !== false;
      if (decision.inTurn) {
        // decisions created while resolving a decision are handled first
        this.queue.unshift(decision);
      } else {
        this.pending = decision.options.length ? decision : null;
        if (!this.pending) decision.resolve(null);
      }
    }

    /** Answer the pending decision. */
    decide(optionId) {
      const d = this.pending;
      if (!d) return fail('Nothing to decide.');
      if (!d.options.some((o) => o.id === optionId)) return fail('Invalid choice.');
      this.pending = null;
      d.resolve(optionId);
      if (d.inTurn) this._settle();
      return ok();
    }

    /** Run queued decisions, otherwise finish the turn. */
    _settle() {
      while (!this.over && !this.pending) {
        if (this.queue.length) {
          const d = this.queue.shift();
          if (d.options.length === 0) { this.log('(' + d.title + ' - nothing to choose.)'); continue; }
          this.pending = d;
          return;
        }
        this._endTurn();
        return;
      }
    }

    _endTurn() {
      if (this.over) return;
      if (this.structure.remaining() === 0) {
        this.replay = false;               // a replay at the end of an Age is lost
        this._endAge();
        return;
      }
      if (this.replay) {
        this.replay = false;
        this.log(this.me.name + ' plays again.');
      } else {
        this.current = 1 - this.current;
      }
    }

    // =====================================================================
    //  END OF GAME
    // =====================================================================
    _win(p, reason) {
      this.over = true;
      this.phase = 'over';
      this.winner = p.index;
      this.endReason = reason;
      this.pending = null;
      this.queue = [];
      this.scores = this.computeScores();
      this.log(p.name + ' wins by ' + (reason === 'military' ? 'MILITARY SUPREMACY!' : 'SCIENTIFIC SUPREMACY!'));
    }

    computeScores() {
      return this.players.map((p) => p.scoreBreakdown(this.other(p), this.military.vpFor(p.index)));
    }

    _finishByPoints() {
      this.over = true;
      this.phase = 'over';
      this.endReason = 'civilian';
      this.pending = null;
      this.queue = [];
      this.scores = this.computeScores();
      const a = this.scores[0], b = this.scores[1];
      if (a.total !== b.total) this.winner = a.total > b.total ? 0 : 1;
      else if (a.blue !== b.blue) this.winner = a.blue > b.blue ? 0 : 1;   // tie-break: blue card points
      else this.winner = null;                                              // shared victory
      this.log(this.winner === null ? 'The game ends in a tie (shared victory).'
                                    : this.players[this.winner].name + ' wins on points (' + a.total + ' - ' + b.total + ').');
    }
  }

  S.Game = Game;
})(globalThis.SWD);
