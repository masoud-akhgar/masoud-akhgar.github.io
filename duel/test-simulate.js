// Run with:  node test-simulate.js        (needs Node.js, nothing else)
// 1) checks the trading examples printed in the rule book
// 2) plays many random games to make sure the engine never gets stuck or throws
const path = require('path');
['swd-constants', 'swd-cards', 'swd-wonders', 'swd-board', 'swd-player', 'swd-game']
  .forEach((f) => require(path.join(__dirname, f + '.js')));
const S = globalThis.SWD;

let failures = 0;
function check(name, cond, extra) {
  if (!cond) { failures++; console.log('FAIL  ' + name + (extra ? '  ' + extra : '')); }
  else console.log('ok    ' + name);
}
const byName = (decks, name) => [].concat(decks[1], decks[2], decks[3], decks.guild).find((c) => c.name === name);

// ---------------------------------------------------------------- data checks
(function dataChecks() {
  const d = S.createDecks();
  check('Age I has 23 cards', d[1].length === 23);
  check('Age II has 23 cards', d[2].length === 23);
  check('Age III has 20 cards', d[3].length === 20);
  check('7 guilds', d.guild.length === 7);
  check('12 wonders', S.createWonders().length === 12);
  check('10 progress tokens', S.createProgressTokens().length === 10);
  const all = [].concat(d[1], d[2], d[3], d.guild);
  const imgs = all.map((c) => c.image).concat(S.createWonders().map((w) => w.image), S.createProgressTokens().map((p) => p.image));
  check('every card, wonder and token has a unique image address', imgs.every((x) => typeof x === 'string' && x) && new Set(imgs).size === imgs.length);
  check('card ids are unique', new Set(all.map((c) => c.id)).size === all.length);
  // every chainFrom symbol has exactly one giver
  const givers = {};
  all.forEach((c) => { if (c.chainGives) givers[c.chainGives] = (givers[c.chainGives] || 0) + 1; });
  check('every chainFrom has one giver', all.every((c) => !c.chainFrom || givers[c.chainFrom] === 1));
  // every green symbol appears exactly twice
  const sym = {};
  all.forEach((c) => { if (c.science) sym[c.science] = (sym[c.science] || 0) + 1; });
  check('6 science symbols x2 cards', Object.keys(sym).length === 6 && Object.values(sym).every((n) => n === 2), JSON.stringify(sym));
  // symbol pairs given by the book owner: both cards of a pair share one symbol, all 6 pairs differ
  const pairs = [['Academy', 'Study'], ['Workshop', 'Laboratory'], ['Apothecary', 'School'],
                 ['Scriptorium', 'Library'], ['Pharmacist', 'Dispensary'], ['University', 'Observatory']];
  const symOf = (n) => all.find((c) => c.name === n).science;
  check('science symbol pairs match the guide book', pairs.every((p) => symOf(p[0]) && symOf(p[0]) === symOf(p[1])) &&
    new Set(pairs.map((p) => symOf(p[0]))).size === 6);
  // structure sizes
  [1, 2, 3].forEach((a) => {
    const st = new S.CardStructure(a, d[a]);
    check('Age ' + a + ' structure has 20 slots', st.slots.length === 20);
    check('Age ' + a + ' starts with only face-up free cards', st.available().every((s) => s.faceUp));
    console.log('      Age ' + a + ' accessible at start: ' + st.available().length);
  });
})();

// ---------------------------------------------------------------- rule-book trading examples
(function tradingChecks() {
  const decks = S.createDecks();
  const mk = () => ({ A: new S.Player(0, 'Antoine'), B: new S.Player(1, 'Bruno') });

  // Bruno: 2 Stone (Shelf Quarry). Antoine buys stone at 4 each, Bruno buys at 2.
  let { A, B } = mk();
  B.buildings.push(byName(decks, 'Shelf Quarry'));
  check('stone costs Antoine 4', A.priceOf('stone', B) === 4);
  check('stone costs Bruno 2', B.priceOf('stone', A) === 2);

  // Antoine builds Aqueduct (3 stone) with no stone: 3 x 4 = 12
  A.coins = 20;
  check('Aqueduct costs 12', A.buildInfo(byName(decks, 'Aqueduct'), B).total === 12);

  // Bruno: Fortifications (2 stone, 1 clay, 1 papyrus), has 2 stone; Antoine has 1 clay, no papyrus -> 3 + 2 = 5
  ({ A, B } = mk());
  B.buildings.push(byName(decks, 'Shelf Quarry'));
  A.buildings.push(byName(decks, 'Clay Pool'));
  B.coins = 10;
  check('Fortifications costs Bruno 5', B.buildInfo(byName(decks, 'Fortifications'), A).total === 5);

  // Bruno: Caravansery (2 coins, 1 glass, 1 papyrus), Antoine produces 1 glass -> 2 + 3 + 2 = 7
  ({ A, B } = mk());
  A.buildings.push(byName(decks, 'Glassworks'));
  B.coins = 10;
  check('Caravansery costs Bruno 7', B.buildInfo(byName(decks, 'Caravansery'), A).total === 7);

  // Chain: Baths -> Aqueduct free
  ({ A, B } = mk());
  A.buildings.push(byName(decks, 'Baths'));
  const inf = A.buildInfo(byName(decks, 'Aqueduct'), B);
  check('Aqueduct is free through Baths', inf.viaChain && inf.total === 0);

  // Reserve: stone at 1
  ({ A, B } = mk());
  B.buildings.push(byName(decks, 'Shelf Quarry'));
  A.buildings.push(byName(decks, 'Stone Reserve'));
  check('Stone Reserve fixes price at 1', A.priceOf('stone', B) === 1);

  // Masonry rebate on blue card: Aqueduct 3 stone, rebate 2, no stone: 1 stone x 2 = 2
  ({ A, B } = mk());
  A.progress.push(S.createProgressTokens().find((t) => t.id === 'masonry'));
  check('Masonry makes Aqueduct cost 2', A.buildInfo(byName(decks, 'Aqueduct'), B).total === 2);

  // Flexible production (Caravansery) covers one needed stone
  ({ A, B } = mk());
  A.buildings.push(byName(decks, 'Caravansery'));
  check('Caravansery covers 1 of 3 stone for Aqueduct', A.buildInfo(byName(decks, 'Aqueduct'), B).total === 4);
})();

// ---------------------------------------------------------------- random games
function randomGame(seed) {
  const g = new S.Game({ seed: seed, first: 'random', beginnerWonders: seed % 2 === 0 });
  let steps = 0;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  while (!g.over) {
    if (++steps > 3000) throw new Error('game did not finish (seed ' + seed + ')');
    if (g.phase === 'draft') {
      const r = g.pickWonder(pick(g.draft.pool).id);
      if (!r.ok) throw new Error(r.error);
      continue;
    }
    if (g.pending) {
      const r = g.decide(pick(g.pending.options).id);
      if (!r.ok) throw new Error('decide: ' + r.error);
      continue;
    }
    const slots = g.structure.available();
    if (!slots.length) throw new Error('no accessible card but structure not empty (seed ' + seed + ')');
    const slot = pick(slots);
    const a = g.actionsFor(slot.id);
    const moves = [{ t: 'discard' }];
    if (a.build.affordable) moves.push({ t: 'build' }, { t: 'build' });
    a.wonders.filter((w) => w.allowed).forEach((w) => moves.push({ t: 'wonder', id: w.wonder.id }, { t: 'wonder', id: w.wonder.id }));
    const m = pick(moves);
    const r = m.t === 'build' ? g.doBuild(slot.id) : m.t === 'discard' ? g.doDiscard(slot.id) : g.doWonder(slot.id, m.id);
    if (!r.ok) throw new Error(m.t + ': ' + r.error);
    g.players.forEach((p) => { if (p.coins < 0 || !Number.isInteger(p.coins)) throw new Error('bad coins ' + p.coins); });
    if (g.wondersBuilt > 7) throw new Error('more than 7 wonders');
  }
  return g;
}

const N = 3000;
const stats = { military: 0, science: 0, civilian: 0, tie: 0, p0: 0, p1: 0 };
let maxLog = 0;
for (let i = 1; i <= N; i++) {
  const g = randomGame(i);
  stats[g.endReason]++;
  if (g.winner === null) stats.tie++; else stats['p' + g.winner]++;
  maxLog = Math.max(maxLog, g.logLines.length);
}
check(N + ' random games finished without errors', true);
console.log('      end reasons / winners:', JSON.stringify(stats), ' longest log:', maxLog);

// deterministic replay by seed
(function () {
  const run = (seed) => {
    const g = new S.Game({ seed: seed, first: 0, beginnerWonders: true });
    return g.structure.slots.map((s) => s.card.id).join(',');
  };
  check('same seed => same deal', run(42) === run(42) && run(42) !== run(43));
})();

console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
