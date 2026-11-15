/* ==========================================================================
 * 7 Wonders Duel - minimal text UI (hot-seat: both players use the same page)
 * Only talks to SWD.Game through its public API; replace freely.
 * ========================================================================== */
globalThis.SWD = globalThis.SWD || {};
(function (S) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // <img> that silently disappears when the picture file does not exist (yet)
  const img = (src, cls) => src ? '<img class="' + (cls || 'cimg') + '" src="' + esc(src) + '" alt="" onerror="this.remove()">' : '';

  // Small icon for a resource / coin / shield: uses the picture from SWD.ICON_IMAGES when the
  // file exists, otherwise falls back to the emoji.
  const GLYPH = (key) => key === 'coin' ? S.COIN_GLYPH : key === 'shield' ? S.SHIELD_GLYPH : S.RES_GLYPH[key];
  const ico = (key) => {
    const src = S.ICON_IMAGES && S.ICON_IMAGES[key];
    return src ? '<img class="icon" src="' + esc(src) + '" alt="' + GLYPH(key) + '" title="' + key +
      '" onerror="this.replaceWith(document.createTextNode(this.alt))">' : GLYPH(key);
  };

  // Scientific symbol: picture (SWD.SCIENCE_IMAGES) or emoji, optionally followed by its name
  const sci = (sym, withName) => {
    const src = S.SCIENCE_IMAGES && S.SCIENCE_IMAGES[sym], g = S.SCIENCE_GLYPH[sym], name = S.SCIENCE_NAME[sym];
    const pic = src ? '<img class="icon" src="' + esc(src) + '" alt="' + g + '" onerror="this.replaceWith(document.createTextNode(this.alt))">' : g;
    return '<span class="sym" title="Science symbol: ' + esc(name) + '">' + pic + (withName ? ' ' + esc(name) : '') + '</span>';
  };
  // "3 [icon] Stone, 1 [icon] Papyrus"
  const costHtml = (map) => S.ALL_RESOURCES.filter((r) => map[r]).map((r) => map[r] + ' ' + ico(r) + ' ' + S.cap(r)).join(', ');

  class UI {
    constructor(root) {
      this.root = root;
      this.game = null;
      this.sel = null;            // selected structure slot id
      this.msg = '';              // last error / hint
      this.showDiscard = false;
      this.symbolCards = {};      // science symbol -> [{name, age}]  (for the legend panel)
      const decks = S.createDecks();
      [1, 2, 3].forEach((a) => decks[a].forEach((c) => {
        if (c.science) (this.symbolCards[c.science] = this.symbolCards[c.science] || []).push({ name: c.name, age: a });
      }));
      this.setup = { n0: 'Player 1', n1: 'Player 2', first: 'random', wonders: 'draft', seed: '' };
      root.addEventListener('click', (e) => this.onClick(e));
      root.addEventListener('input', (e) => this.onInput(e));
      this.render();
    }

    // ------------------------------------------------------------------ events
    onInput(e) {
      const f = e.target.getAttribute('data-field');
      if (f) this.setup[f] = e.target.value;
    }

    onClick(e) {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.getAttribute('data-act');
      const id = el.getAttribute('data-id');
      const g = this.game;
      let res = null;
      switch (act) {
        case 'start': {
          const seed = this.setup.seed.trim() === '' ? null : Number(this.setup.seed);
          this.game = new S.Game({
            names: [this.setup.n0.trim() || 'Player 1', this.setup.n1.trim() || 'Player 2'],
            first: this.setup.first === 'random' ? 'random' : Number(this.setup.first),
            beginnerWonders: this.setup.wonders === 'beginner',
            seed: Number.isFinite(seed) ? seed : null
          });
          this.sel = null; this.msg = '';
          break;
        }
        case 'newgame': this.game = null; this.sel = null; this.msg = ''; break;
        case 'pick-wonder': res = g.pickWonder(id); break;
        case 'select': this.sel = Number(id); this.msg = ''; break;
        case 'unselect': this.sel = null; break;
        case 'build': res = g.doBuild(this.sel); break;
        case 'discard': res = g.doDiscard(this.sel); break;
        case 'wonder': res = g.doWonder(this.sel, id); break;
        case 'decide': res = g.decide(id); break;
        case 'toggle-discard': this.showDiscard = !this.showDiscard; break;
      }
      if (res) { this.msg = res.ok ? '' : res.error; if (res.ok) this.sel = null; }
      this.render();
    }

    // ------------------------------------------------------------------ render
    render() { this.root.innerHTML = this.game ? this.htmlGame() : this.htmlSetup(); }

    htmlSetup() {
      const s = this.setup;
      const sel = (v, cur) => (v === cur ? ' selected' : '');
      return '<h1>7 Wonders Duel</h1>' +
        '<div class="panel"><h3>New game</h3>' +
        '<p>Player 1 name <input data-field="n0" value="' + esc(s.n0) + '"> ' +
        'Player 2 name <input data-field="n1" value="' + esc(s.n1) + '"></p>' +
        '<p>First player <select data-field="first">' +
        '<option value="random"' + sel('random', s.first) + '>Random</option>' +
        '<option value="0"' + sel('0', s.first) + '>Player 1</option>' +
        '<option value="1"' + sel('1', s.first) + '>Player 2</option></select> ' +
        'Wonders <select data-field="wonders">' +
        '<option value="draft"' + sel('draft', s.wonders) + '>Draft (normal rules)</option>' +
        '<option value="beginner"' + sel('beginner', s.wonders) + '>Fixed set for a first game</option></select> ' +
        'Seed (optional) <input data-field="seed" size="8" value="' + esc(s.seed) + '"></p>' +
        '<button data-act="start">Start game</button></div>';
    }

    htmlGame() {
      const g = this.game;
      let h = '<h1>7 Wonders Duel</h1>';
      h += '<div class="bar">' + this.htmlStatus() + ' <button data-act="newgame">New game</button></div>';
      if (this.msg) h += '<div class="err">' + esc(this.msg) + '</div>';
      if (g.over) h += this.htmlResult();
      h += this.htmlMilitary();
      h += this.htmlProgressBoard();
      if (g.phase === 'draft') h += this.htmlDraft();
      else {
        if (g.pending) h += this.htmlDecision();
        h += this.htmlStructure();
        if (this.sel !== null && g.canAct()) h += this.htmlActions();
      }
      h += '<div class="cols">' + this.htmlPlayer(0) + this.htmlPlayer(1) + '</div>';
      h += this.htmlDiscard();
      h += '<div class="panel"><h3>Log</h3><div class="log">' +
        g.logLines.slice().reverse().slice(0, 80).map((l) => '<div>' + esc(l) + '</div>').join('') + '</div></div>';
      h += '<div class="small">seed ' + g.seed + '</div>';
      return h;
    }

    htmlStatus() {
      const g = this.game;
      if (g.over) return '<b>Game over</b>';
      if (g.phase === 'draft') {
        const pi = g.draft.order[0];
        return '<b>Wonder draft, round ' + g.draft.round + ':</b> ' + esc(g.players[pi].name) + ' chooses a wonder';
      }
      if (g.pending) return '<b>Age ' + g.age + '</b> - waiting for ' + esc(g.players[g.pending.player].name);
      return '<b>Age ' + g.age + '</b> - turn of <b>' + esc(g.me.name) + '</b> (' + g.structure.remaining() + ' cards left)';
    }

    // ---- military track
    htmlMilitary() {
      const g = this.game, m = g.military;
      let cells = '';
      for (let pos = -9; pos <= 9; pos++) {
        let label = '';
        const tok = m.tokens.find((t) => !t.used && t.pos === pos);
        if (Math.abs(pos) === 9) label = 'CAPITAL';
        else if (tok) label = ico('coin') + '-' + tok.coins;
        else if (pos !== 0) label = S.RULES.MILITARY_VP[Math.abs(pos)] + ' VP';
        cells += '<div class="mcell' + (pos === m.pos ? ' pawn' : '') + '">' + label + '<br>' + (pos === m.pos ? '⚔️' : '&nbsp;') + '</div>';
      }
      const lead = m.leader();
      const txt = lead === null ? 'Pawn in the centre.'
        : esc(g.players[lead].name) + ' is ahead by ' + Math.abs(m.pos) + ' space' + (Math.abs(m.pos) > 1 ? 's' : '') + '.';
      return '<div class="panel"><h3>Military</h3><div class="track">' + cells + '</div>' +
        '<div class="small">&larr; capital of ' + esc(g.players[0].name) + ' | capital of ' + esc(g.players[1].name) + ' &rarr; &nbsp; ' + txt +
        ' (' + ico('coin') + '-N = the owner of that side loses N coins when the pawn enters; VP = military points at the end)</div></div>';
    }

    // ---- progress tokens on the board
    htmlProgressBoard() {
      const g = this.game;
      const items = g.progressBoard.map((t) => '<span class="tok" title="' + esc(t.text) + '">' + img(t.image, 'cimg') + '<b>' + esc(t.name) + '</b>: ' + esc(t.text) + '</span>').join('');
      return '<div class="panel"><h3>Progress tokens on the board</h3>' + (items || '<i>none left</i>') +
        '<div class="small">' + g.progressBox.length + ' tokens set aside for the Great Library.</div></div>' + this.htmlScienceLegend();
    }

    // ---- which cards carry which scientific symbol, and what each player owns
    htmlScienceLegend() {
      // const g = this.game;
      // let h = '<div class="panel"><h3>Scientific symbols</h3><div class="small">Two identical symbols = take a Progress token. ' +
      //   '6 different symbols (of 7; Law comes from the Law token) = you win at once. Each green card shows its symbol in the top-right corner.</div>' +
      //   '<table class="symtab"><tr><th>Symbol</th><th>Cards</th>' + g.players.map((p) => '<th>' + esc(p.name) + '</th>').join('') + '</tr>';
      // S.SCIENCE_SYMBOLS.forEach((s) => {
      //   const cards = s === 'law' ? 'Law progress token' :
      //     (this.symbolCards[s] || []).map((c) => esc(c.name) + ' (' + 'I'.repeat(c.age) + ')').join(', ');
      //   h += '<tr><td>' + sci(s, true) + '</td><td>' + cards + '</td>' +
      //     g.players.map((p) => { const n = p.science[s] || 0; return '<td class="' + (n >= 2 ? 'pair' : n ? 'one' : '') + '">' + (n ? 'x' + n + (n >= 2 ? ' pair' : '') : '-') + '</td>'; }).join('') + '</tr>';
      // });
      return '<div></div>';
    }

    // ---- wonder draft
    htmlDraft() {
      const g = this.game;
      const d = g.draft;
      let h = '<div class="panel"><h3>Choose a wonder</h3>';
      d.pool.forEach((w) => {
        h += '<div class="wcard">' + img(w.image, 'cimg big') + '<button data-act="pick-wonder" data-id="' + w.id + '">Take ' + esc(w.name) + '</button> ' +
          '<span class="wcost">Cost: ' + costHtml(w.cost) + '</span> <span class="weffect">' + esc(w.describe()) + '</span></div>';
      });
      return h + '</div>';
    }

    // ---- pending decision
    htmlDecision() {
      const d = this.game.pending;
      return '<div class="panel decision"><h3>' + esc(d.title) + '</h3>' +
        d.options.map((o) => '<div><button data-act="decide" data-id="' + esc(o.id) + '">' + esc(o.label) + '</button> ' +
          (o.text ? '<span class="small">' + esc(o.text) + '</span>' : '') + '</div>').join('') + '</div>';
    }

    // ---- card structure
    slotHtml(slot) {
      const g = this.game, st = g.structure;
      const style = 'grid-column:' + (slot.col - st.minCol + 1) + ' / span 2;grid-row:' + (slot.row + 1);
      if (!slot.faceUp) return '<div class="card down" style="' + style + '">' + img(S.CARD_BACK_IMAGES[g.age], 'cimg') + 'Age ' + 'I'.repeat(g.age) + '<br>?</div>';
      const c = slot.card;
      const avail = st.isAvailable(slot);
      const cls = 'card t-' + c.type + (avail ? ' avail' : ' covered') + (this.sel === slot.id ? ' sel' : '');
      const act = avail && g.canAct() ? ' data-act="select" data-id="' + slot.id + '"' : '';
      return '<div class="' + cls + '" style="' + style + '"' + act + ' title="' + esc(c.name + ': ' + c.describe()) + '">' +
        (c.science ? '<span class="symbadge">' + sci(c.science, false) + '</span>' : '') +
        img(c.image, 'cimg') + '<b>' + esc(c.name) + '</b><br><span class="small">' + esc(S.fmtCost(c.cost)) + '</span><br>' +
        '<span class="small">' + this.shortEffect(c) + '</span></div>';
    }

    shortEffect(c, forChip) {      // returns HTML
      const p = [];
      if (c.production && c.production.fixed) p.push('+' + Object.keys(c.production.fixed).map((r) => c.production.fixed[r] + ico(r)).join(''));
      if (c.production && c.production.choice) p.push(c.production.choice.map((r) => ico(r)).join('/'));
      if (c.tradeDiscount.length) p.push('1' + ico('coin') + ' ' + c.tradeDiscount.map((r) => ico(r)).join(''));
      if (c.coins) p.push('+' + c.coins + ico('coin'));
      if (c.coinsPer) p.push('+' + c.coinsPer.each + ico('coin') + '/' + esc(c.coinsPer.of));
      if (c.shields) p.push(c.shields + ico('shield'));
      if (c.science) p.push(sci(c.science, true));
      if (c.vp) p.push(c.vp + 'VP');
      if (c.guildType && !forChip) p.push('guild');
      if (c.chainGives) p.push('gives:' + esc(c.chainGives));
      if (c.chainFrom && !forChip) p.push('free:' + esc(c.chainFrom));
      return p.join(' ');
    }

    /** Coloured label of a building (colour = card colour) with its main effect icons */
    chipHtml(c) {
      const fx = this.shortEffect(c, true);
      return '<span class="chip t-' + c.type + '" title="' + esc(c.name + ': ' + c.describe()) + '">' + esc(c.name) +
        (fx ? ' <span class="cfx">' + fx + '</span>' : '') + '</span>';
    }

    htmlStructure() {
      const g = this.game, st = g.structure;
      const cols = (st.maxCol - st.minCol) + 2;
      return '<div class="panel"><h3>Age ' + g.age + ' &mdash; click an accessible (outlined) card</h3>' +
        '<div class="grid" style="grid-template-columns:repeat(' + cols + ',58px)">' +
        st.slots.filter((s) => !s.taken).map((s) => this.slotHtml(s)).join('') + '</div></div>';
    }

    costText(info) {
      if (info.viaChain) return 'FREE (chain)';
      const parts = [];
      if (info.printedCoins) parts.push(info.printedCoins + ' printed');
      Object.keys(info.trade).forEach((r) => parts.push(info.trade[r].units + ' ' + r + ' x' + info.trade[r].price));
      return info.total + ' coins' + (parts.length ? ' (' + parts.join(' + ') + ')' : '');
    }

    htmlActions() {
      const g = this.game;
      const a = g.actionsFor(this.sel);
      if (!a) return '';
      const c = a.card;
      let h = '<div class="panel actions"><h3>' + esc(g.me.name) + ' &mdash; ' + esc(c.name) + '</h3>' +
        img(c.image, 'cimg big') + '<div class="small">' + esc(S.TYPE_NAME[c.type]) + ' | ' + esc(c.describe()) + '</div>' +
        (c.science ? '<div>Scientific symbol: ' + sci(c.science, true) + '</div>' : '');
      h += '<p><button data-act="build"' + (a.build.affordable ? '' : ' disabled') + '>Build: ' + esc(this.costText(a.build)) + '</button> ' +
        (a.build.affordable ? '' : '<span class="small">(you have ' + g.me.coins + ')</span>') + '</p>';
      h += '<p><button data-act="discard">Discard for +' + a.discardGain + ' coins</button></p>';
      h += '<div>Use as a Wonder (' + a.wondersLeft + ' wonder' + (a.wondersLeft === 1 ? '' : 's') + ' can still be built in total):</div>';
      if (!a.wonders.length) h += '<div class="small">You have no unbuilt wonders.</div>';
      a.wonders.forEach((w) => {
        h += '<div class="wcard">' + img(w.wonder.image, 'cimg') + '<button data-act="wonder" data-id="' + w.wonder.id + '"' + (w.allowed ? '' : ' disabled') + '>' +
          esc(w.wonder.name) + ': ' + esc(this.costText(w.info)) + '</button> <span class="wcost">base: ' + costHtml(w.wonder.cost) +
          '</span> <span class="weffect">' + esc(w.wonder.describe()) + '</span></div>';
      });
      h += '<p><button data-act="unselect">Cancel</button></p></div>';
      return h;
    }

    // ---- players
    htmlPlayer(i) {
      const g = this.game, p = g.players[i], o = g.players[1 - i];
      const turn = !g.over && g.phase === 'play' && g.current === i;
      const sc = p.scoreBreakdown(o, g.military.vpFor(i));
      let h = '<div class="pl' + (turn ? ' turn' : '') + '"><h3>' + esc(p.name) + (turn ? ' &#9654;' : '') + '</h3>';
      h += '<div>' + ico('coin') + ' <b>' + p.coins + '</b> coins &nbsp; Score now: <b>' + sc.total + '</b> VP ' +
        '<span class="small">(mil ' + sc.military + ', blue ' + sc.blue + ', green ' + sc.green + ', yellow ' + sc.yellow +
        ', purple ' + sc.purple + ', wonders ' + sc.wonders + ', progress ' + sc.progress + ', coins ' + sc.coins + ')</span></div>';

      const fx = p.fixedProduction();
      const fixedTxt = S.ALL_RESOURCES.filter((r) => fx[r]).map((r) => fx[r] + ico(r)).join(' ') || '-';
      const flex = p.productionChoices().map((l) => '(' + l.map((r) => ico(r)).join('/') + ')').join(' ');
      h += '<div>Production: ' + fixedTxt + (flex ? ' + flexible ' + flex : '') + '</div>';
      const disc = Array.from(p.discountedResources()).map((r) => ico(r)).join('');
      if (disc) h += '<div>1-coin trading: ' + disc + '</div>';
      const sciList = S.SCIENCE_SYMBOLS.filter((s) => p.science[s]).map((s) => sci(s, true) + (p.science[s] > 1 ? ' x' + p.science[s] + ' (pair)' : '')).join(', ');
      h += '<div>Science (' + p.distinctScience() + '/6 different): ' + (sciList || '-') + '</div>';
      h += '<div>Progress: ' + (p.progress.map((t) => '<span class="chip" title="' + esc(t.text) + '">' + esc(t.name) + '</span>').join(' ') || '-') + '</div>';

      h += '<div class="sub">Wonders</div>';
      p.wonders.forEach((w) => {
        const state = w.built ? 'BUILT' : w.removed ? 'removed' : 'unbuilt';
        h += '<div class="wcard st-' + state + '">' + img(w.image, 'cimg') + '<b>' + esc(w.name) + '</b> <span class="wstate">' + state + '</span>' +
          '<div><span class="wcost">Cost: ' + costHtml(w.cost) + '</span> <span class="weffect">' + esc(w.describe()) + '</span></div></div>';
      });
      if (!p.wonders.length) h += '<div class="small">none yet</div>';

      h += '<div class="sub">Buildings (' + p.buildings.length + ')</div>';
      ['brown', 'grey', 'blue', 'green', 'yellow', 'red', 'purple'].forEach((t) => {
        const list = p.buildings.filter((c) => c.type === t);
        if (!list.length) return;
        h += '<div>' + list.map((c) => this.chipHtml(c)).join(' ') + '</div>';
      });
      return h + '</div>';
    }

    htmlDiscard() {
      const g = this.game;
      let h = '<div class="panel"><h3>Discard pile (' + g.discardPile.length + ') <button data-act="toggle-discard">' + (this.showDiscard ? 'hide' : 'show') + '</button></h3>';
      if (this.showDiscard) {
        h += g.discardPile.map((c) => this.chipHtml(c)).join(' ') || '<i>empty</i>';
      }
      return h + '</div>';
    }

    htmlResult() {
      const g = this.game;
      const reasons = { military: 'Military supremacy', science: 'Scientific supremacy', civilian: 'Civilian victory (points)' };
      let h = '<div class="panel result"><h2>' + (g.winner === null ? 'Tie - shared victory' : esc(g.players[g.winner].name) + ' wins!') +
        '</h2><div>' + reasons[g.endReason] + '</div><table><tr><th></th><th>' + esc(g.players[0].name) + '</th><th>' + esc(g.players[1].name) + '</th></tr>';
      [['military', 'Military'], ['blue', 'Civilian (blue)'], ['green', 'Science (green)'], ['yellow', 'Commercial (yellow)'],
       ['purple', 'Guilds (purple)'], ['wonders', 'Wonders'], ['progress', 'Progress tokens'], ['coins', 'Treasury (3 coins = 1 VP)'], ['total', 'TOTAL']]
        .forEach((r) => { h += '<tr><td>' + r[1] + '</td><td>' + g.scores[0][r[0]] + '</td><td>' + g.scores[1][r[0]] + '</td></tr>'; });
      return h + '</table></div>';
    }
  }

  S.UI = UI;
})(globalThis.SWD);
