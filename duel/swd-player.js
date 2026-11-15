/* ==========================================================================
 * 7 Wonders Duel - Player (a "city")
 *
 * Holds coins, buildings, wonders, progress tokens, science symbols and
 * knows how to price a building / wonder for this player (production,
 * trading, discounts, chain links, Masonry / Architecture rebates).
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  // all ways to waive exactly k units out of the needed resources
  function waiveCombos(need, k) {
    const types = Object.keys(need);
    const out = [];
    (function rec(i, left, cur) {
      if (left === 0) { out.push(Object.assign({}, cur)); return; }
      if (i >= types.length) return;
      const t = types[i];
      for (let n = Math.min(left, need[t]); n >= 0; n--) {
        if (n) cur[t] = n; else delete cur[t];
        rec(i + 1, left - n, cur);
      }
      delete cur[t];
    })(0, k, {});
    return out;
  }

  function cartesian(lists) {
    let acc = [[]];
    lists.forEach((l) => {
      const next = [];
      acc.forEach((a) => l.forEach((x) => next.push(a.concat([x]))));
      acc = next;
    });
    return acc;
  }

  class Player {
    constructor(index, name) {
      this.index = index;
      this.name = name;
      this.coins = S.RULES.START_COINS;
      this.buildings = [];     // Card[]
      this.wonders = [];       // Wonder[] (drafted; built or not)
      this.progress = [];      // ProgressToken[]
      this.science = {};       // symbol -> count
    }

    // ---- simple queries ---------------------------------------------------
    countType(type) { return this.buildings.filter((c) => c.type === type).length; }
    builtWonders() { return this.wonders.filter((w) => w.built); }
    builtWonderCount() { return this.builtWonders().length; }
    hasProgress(id) { return this.progress.some((t) => t.id === id); }
    hasChain(symbol) { return this.buildings.some((c) => c.chainGives === symbol); }
    distinctScience() { return Object.keys(this.science).filter((k) => this.science[k] > 0).length; }

    // ---- production -------------------------------------------------------
    /** Fixed production of brown, grey (and any other card with fixed output) */
    fixedProduction() {
      const out = {};
      this.buildings.forEach((c) => {
        if (c.production && c.production.fixed) {
          Object.keys(c.production.fixed).forEach((r) => { out[r] = (out[r] || 0) + c.production.fixed[r]; });
        }
      });
      return out;
    }

    /** Production that counts for the opponent's trading price: BROWN and GREY cards only. */
    tradeProduction() {
      const out = {};
      this.buildings.forEach((c) => {
        if ((c.type === 'brown' || c.type === 'grey') && c.production && c.production.fixed) {
          Object.keys(c.production.fixed).forEach((r) => { out[r] = (out[r] || 0) + c.production.fixed[r]; });
        }
      });
      return out;
    }

    /** "1 unit of one of ..." producers: yellow cards and built wonders. */
    productionChoices() {
      const lists = [];
      this.buildings.forEach((c) => { if (c.production && c.production.choice) lists.push(c.production.choice); });
      this.builtWonders().forEach((w) => { if (w.produces) lists.push(w.produces); });
      return lists;
    }

    discountedResources() {
      const set = new Set();
      this.buildings.forEach((c) => c.tradeDiscount.forEach((r) => set.add(r)));
      return set;
    }

    /** Price of buying ONE unit of a resource from the bank. */
    priceOf(res, opponent) {
      if (this.discountedResources().has(res)) return 1;
      return S.RULES.BASE_TRADE_PRICE + (opponent.tradeProduction()[res] || 0);
    }

    // ---- costs ------------------------------------------------------------
    /** Cheapest way to cover a resource requirement using production + bank trading.
     *  rebate = number of resources that are free (Masonry / Architecture). */
    computeResourceCost(req, opponent, rebate) {
      const need0 = {};
      let totalUnits = 0;
      S.ALL_RESOURCES.forEach((r) => { if (req[r]) { need0[r] = req[r]; totalUnits += req[r]; } });
      const prices = {};
      S.ALL_RESOURCES.forEach((r) => { prices[r] = this.priceOf(r, opponent); });
      const fixed = this.fixedProduction();
      const assignments = cartesian(this.productionChoices());
      const waives = waiveCombos(need0, Math.min(rebate || 0, totalUnits));

      let best = null;
      waives.forEach((waive) => {
        assignments.forEach((pick) => {
          const supply = Object.assign({}, fixed);
          pick.forEach((r) => { supply[r] = (supply[r] || 0) + 1; });
          let cost = 0;
          const trade = {};
          Object.keys(need0).forEach((r) => {
            const need = need0[r] - (waive[r] || 0);
            const miss = Math.max(0, need - (supply[r] || 0));
            if (miss > 0) { trade[r] = { units: miss, price: prices[r] }; cost += miss * prices[r]; }
          });
          if (!best || cost < best.tradeTotal) best = { tradeTotal: cost, trade: trade, waived: waive };
        });
      });
      return best;
    }

    _costInfo(cost, opponent, rebate) {
      const c = this.computeResourceCost(cost.resources, opponent, rebate);
      const total = cost.coins + c.tradeTotal;
      return {
        viaChain: false, printedCoins: cost.coins, trade: c.trade, tradeTotal: c.tradeTotal,
        waived: c.waived, total: total, affordable: this.coins >= total
      };
    }

    /** What would it cost this player to construct `card`? */
    buildInfo(card, opponent) {
      if (card.chainFrom && this.hasChain(card.chainFrom)) {
        return { viaChain: true, printedCoins: 0, trade: {}, tradeTotal: 0, waived: {}, total: 0, affordable: true };
      }
      const rebate = (card.type === 'blue' && this.hasProgress('masonry')) ? 2 : 0;
      return this._costInfo(card.cost, opponent, rebate);
    }

    /** What would it cost to construct `wonder`? */
    wonderInfo(wonder, opponent) {
      const rebate = this.hasProgress('architecture') ? 2 : 0;
      return this._costInfo({ coins: 0, resources: wonder.cost }, opponent, rebate);
    }

    // ---- scoring ----------------------------------------------------------
    scoreBreakdown(opponent, militaryVP) {
      const b = { military: militaryVP, blue: 0, green: 0, yellow: 0, purple: 0, other: 0,
                  wonders: 0, progress: 0, coins: 0, total: 0 };
      this.buildings.forEach((c) => {
        const v = c.endVP(this, opponent);
        if (b[c.type] !== undefined && c.type !== 'brown' && c.type !== 'grey' && c.type !== 'red') b[c.type] += v;
        else b.other += v;
      });
      this.builtWonders().forEach((w) => { b.wonders += w.vp; });
      this.progress.forEach((t) => { b.progress += t.vp; });
      if (this.hasProgress('mathematics')) b.progress += 3 * this.progress.length;
      b.coins = Math.floor(this.coins / 3);
      b.total = b.military + b.blue + b.green + b.yellow + b.purple + b.other + b.wonders + b.progress + b.coins;
      return b;
    }
  }

  S.Player = Player;
})(globalThis.SWD);
