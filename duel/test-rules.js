// Run with: node test-rules.js  -- targeted rule scenarios (military, science, wonders, tokens, guilds, scoring)
const path=require('path').join(__dirname,'/');
['swd-constants','swd-cards','swd-wonders','swd-board','swd-player','swd-game'].forEach(f=>require(path+f+'.js'));
const S=globalThis.SWD;
let bad=0; const t=(n,c,x)=>{ if(!c){bad++;console.log('FAIL',n,x||'');} else console.log('ok  ',n); };
const mk=(opts)=>new S.Game(Object.assign({seed:7,first:0,beginnerWonders:true},opts||{}));
const card=(g,name)=>{ const d=S.createDecks(); return [].concat(d[1],d[2],d[3],d.guild).find(c=>c.name===name); };
// put a specific card on an accessible slot
function putCard(g,c){ const s=g.structure.available()[0]; s.card=c; return s; }

// 1. military: Age I Guard Tower x3 pushes; token at +3 makes P1 lose 2 coins
{ const g=mk(); const me=g.me; const opp=g.opp; opp.coins=7;
  let s=putCard(g,card(g,'Guard Tower')); g.doBuild(s.id);       // P0 +1 (turn passes to P1)
  g.current=0; s=putCard(g,card(g,'Guard Tower')); g.doBuild(s.id);
  g.current=0; s=putCard(g,card(g,'Guard Tower')); g.doBuild(s.id);
  t('pawn at +3',g.military.pos===3); t('P1 lost 2 coins',g.players[1].coins===5, g.players[1].coins);
  g.current=0; g.military.pos=5; s=putCard(g,card(g,'Walls')); g.players[0].coins=20; g.players[0].buildings.push(card(g,'Quarry'),card(g,'Quarry'));
  // Walls: 2 shields -> pos 7, crosses +6 token (5 coins)
  g.doBuild(s.id); t('pawn at +7',g.military.pos===7); t('P1 lost 5 more',g.players[1].coins===0, g.players[1].coins);
  // 2 more shields => capital
  g.current=0; s=putCard(g,card(g,'Parade Ground')); g.players[0].coins=30; g.players[0].buildings.push(card(g,'Brickyard'),card(g,'Glass-blower'));
  g.doBuild(s.id); t('military win',g.over&&g.winner===0&&g.endReason==='military'); }

// 2. science: pair -> choose progress; Law symbol; 6 symbols wins
{ const g=mk(); g.players[0].coins=30; g.current=0;
  let s=putCard(g,card(g,'Scriptorium')); g.doBuild(s.id);
  t('after Scriptorium turn passes',g.current===1);
  g.current=0; s=putCard(g,card(g,'Library')); g.doBuild(s.id);   // chain free, pair of quill
  t('pair asks for progress token',g.pending&&g.pending.kind==='progress');
  const id=g.pending.options[0].id; g.decide(id);
  t('token taken',g.players[0].progress.length===1&&g.progressBoard.length===4);
  t('turn passed after decision',g.current===1);
}
{ const g=mk(); const p=g.players[0]; g.current=0; p.coins=50;
  ['wheel','quill','mortar','pendulum','globe'].forEach(s=>p.science[s]=1);
  g.progressBoard=S.createProgressTokens().filter(x=>x.id==='law').concat(S.createProgressTokens().filter(x=>x.id==='agriculture'));
  // build 'Academy' (square) -> 6 different
  const s=putCard(g,card(g,'Study')); p.buildings.push(card(g,'Quarry'));
  p.buildings.push(card(g,'Lumber Yard'),card(g,'Glassworks'),card(g,'Press'));
  g.doBuild(s.id); t('science win',g.over&&g.winner===0&&g.endReason==='science'); }
// law counts as 6th
{ const g=mk(); const p=g.players[0]; g.current=0;
  ['wheel','quill','mortar','pendulum','globe'].forEach(s=>p.science[s]=1); p.science.square=0; p.science.mortar=1;
  p.science.wheel=1; // pair on wheel -> choose Law
  const law=g.progressBoard.find(x=>x.id==='law')|| (g.progressBoard[0]=S.createProgressTokens().find(x=>x.id==='law'), g.progressBoard[0]);
  p.coins=20; const s=putCard(g,card(g,'Workshop')); g.doBuild(s.id);
  t('pair pending',g.pending&&g.pending.kind==='progress'); g.decide('law');
  t('law gives 6th symbol => win',g.over&&g.endReason==='science', p.distinctScience()); }

// 3. wonders: Temple of Artemis (12 coins + replay), Appian way, 7-wonder removal, replay lost at age end
{ const g=mk(); const p=g.players[0]; g.current=0; p.buildings.push(card(g,'Quarry'),card(g,'Quarry'));
  p.coins=20;
  // give the player everything for temple: stone wood glass papyrus
  p.buildings.push(card(g,'Lumber Yard'),card(g,'Glassworks'),card(g,'Press'));
  const s=putCard(g,card(g,'Clay Pit'));
  const r=g.doWonder(s.id,'temple-of-artemis'); t('temple ok',r.ok,r.error);
  t('+12 coins',p.coins===32, p.coins); t('same player again',g.current===0);
  t('wonder used card not in discard',g.discardPile.length===0);
}
{ const g=mk(); const p=g.players[0]; g.current=0;
  // Age end with replay: leave one card
  g.structure.slots.forEach((s,i)=>{ if(i>0) s.taken=true; });
  g.structure.revealFree();
  p.coins=20; p.buildings.push(card(g,'Quarry'),card(g,'Quarry'),card(g,'Lumber Yard'),card(g,'Glassworks'),card(g,'Press'));
  const s=g.structure.available()[0]; t('one slot left',g.structure.remaining()===1);
  g.doWonder(s.id,'temple-of-artemis');
  t('Age II started',g.age===2);
  t('replay lost / start decision pending',g.pending&&g.pending.kind==='startingPlayer');
  t('chooser is last active (pawn centre) = player 0', g.pending.player===0);
  g.decide('1'); t('player 1 starts Age 2',g.current===1&&!g.pending);
}
// weaker military chooses
{ const g=mk(); g.military.pos=4; g.structure.slots.forEach((s,i)=>{ if(i>0) s.taken=true; }); g.structure.revealFree();
  g.current=0; g.me.coins=5; const s=g.structure.available()[0]; g.doDiscard(s.id);
  t('weaker (P1) chooses start',g.pending&&g.pending.player===1); }

// 4. 7 wonders limit
{ const g=mk(); g.wondersBuilt=6; const p=g.players[0]; g.current=0; p.coins=30;
  p.buildings.push(card(g,'Quarry'),card(g,'Quarry'),card(g,'Quarry'),card(g,'Press'),card(g,'Glassworks'));
  const s=putCard(g,card(g,'Clay Pit')); g.doWonder(s.id,'pyramids');
  t('7th wonder built, others removed', g.wondersBuilt===7 && g.players.every(pl=>pl.wonders.every(w=>w.built||w.removed)));
  const a=g.actionsFor(g.structure.available()[0].id); t('no more wonders allowed',a.wonders.length===0||a.wonders.every(w=>!w.allowed)); }

// 5. Circus Maximus + Zeus discard opponent card
{ const g=mk(); const p=g.players[1]; g.current=1; p.coins=30;
  g.players[0].buildings.push(card(g,'Glassworks'),card(g,'Press'));
  p.buildings.push(card(g,'Quarry'),card(g,'Quarry'),card(g,'Lumber Yard'),card(g,'Glassworks'));
  const s=putCard(g,card(g,'Clay Pit')); const r=g.doWonder(s.id,'circus-maximus'); t('circus built',r.ok,r.error);
  t('choose grey to discard',g.pending&&g.pending.kind==='discardOpponent'&&g.pending.options.length===2);
  g.decide(g.pending.options[0].id); t('opp lost a grey card',g.players[0].buildings.length===1&&g.discardPile.length===1);
  t('shield moved pawn toward P0',g.military.pos===-1); }

// 6. Mausoleum + Great Library
{ const g=mk({beginnerWonders:false,seed:3}); // draft pick mausoleum & great library
  const p=g.players[0]; 
  // force wonders
  const ws=S.createWonders(); const maus=ws.find(w=>w.id==='mausoleum'), lib=ws.find(w=>w.id==='great-library');
  p.wonders=[maus,lib]; maus.owner=0; lib.owner=0; g.phase='play'; g.draft=null; g._startAge(1); g.current=0; p.coins=60;
  p.buildings.push(card(g,'Clay Pit'),card(g,'Glassworks'),card(g,'Glassworks'),card(g,'Press'),card(g,'Lumber Yard'));
  g.discardPile.push(card(g,'Baths'));
  let s=putCard(g,card(g,'Clay Pool')); let r=g.doWonder(s.id,'mausoleum'); t('mausoleum built',r.ok,r.error);
  t('mausoleum asks',g.pending&&g.pending.kind==='mausoleum'); g.decide('a1-baths');
  t('Baths built free',p.buildings.some(c=>c.name==='Baths')&&g.discardPile.length===0);
  g.current=0; p.buildings.push(card(g,'Lumber Yard'),card(g,'Lumber Yard'));
  s=putCard(g,card(g,'Clay Pool')); r=g.doWonder(s.id,'great-library'); t('library built',r.ok,r.error);
  t('library offers 3',g.pending&&g.pending.kind==='greatLibrary'&&g.pending.options.length===3);
  const id=g.pending.options[0].id; g.decide(id); t('library token gained',p.progress.length===1&&g.progressBox.length===5-3); }

// 7. Urbanism / Economy / Strategy / Theology / Agriculture
{ const g=mk(); const p=g.players[0]; g.current=0; const T=(id)=>S.createProgressTokens().find(x=>x.id===id);
  g._grantProgress(p,T('urbanism')); t('urbanism +6',p.coins===13);
  p.buildings.push(card(g,'Baths')); let s=putCard(g,card(g,'Aqueduct')); const c0=p.coins; g.doBuild(s.id);
  t('chain build gives +4',p.coins===c0+4); }
{ const g=mk(); const a=g.players[0], b=g.players[1]; g.current=0; b.progress.push(S.createProgressTokens().find(x=>x.id==='economy'));
  a.coins=20; const s=putCard(g,card(g,'Aqueduct')); const inf=a.buildInfo(s.card,b); g.doBuild(s.id);
  t('economy pays opponent trade money',b.coins===7+inf.tradeTotal&&inf.tradeTotal===6, b.coins); }
{ const g=mk(); const a=g.players[0]; g.current=0; a.progress.push(S.createProgressTokens().find(x=>x.id==='strategy'));
  const s=putCard(g,card(g,'Guard Tower')); g.doBuild(s.id); t('strategy +1 shield',g.military.pos===2); }
{ const g=mk(); const a=g.players[0]; g.current=0; a.progress.push(S.createProgressTokens().find(x=>x.id==='theology'));
  a.coins=20; a.buildings.push(card(g,'Quarry'),card(g,'Quarry'),card(g,'Quarry'),card(g,'Press'));
  const s=putCard(g,card(g,'Clay Pit')); const r=g.doWonder(s.id,'pyramids'); t('theology replay',r.ok&&g.current===0,r.error); }
{ const g=mk(); const a=g.players[0]; g._grantProgress(a,S.createProgressTokens().find(x=>x.id==='agriculture')); t('agriculture +6',a.coins===13); }

// 8. guilds
{ const g=mk(); const a=g.players[0], b=g.players[1];
  b.buildings.push(card(g,'Theater'),card(g,'Altar'),card(g,'Baths')); a.buildings.push(card(g,'Courthouse'));
  const gl=card(g,'Magistrates Guild'); a.buildings.push(gl);
  t('magistrates coins = 3 (opp has more)',gl.immediateCoins(a,b)===3);
  t('magistrates VP = 3',gl.endVP(a,b)===3);
  a.coins=10; b.coins=31; t('moneylenders = 10',card(g,'Moneylenders Guild').endVP(a,b)===10);
  a.wonders.push(Object.assign(S.createWonders()[0],{built:true})); t('builders = 2',card(g,'Builders Guild').endVP(a,b)===2); }

// 9. scoring + tie-break
{ const g=mk(); const a=g.players[0], b=g.players[1]; a.coins=7;b.coins=7;
  g.military.pos=4; const sc=g.computeScores(); t('military 5 VP for P0',sc[0].military===5&&sc[1].military===0);
  t('coins 7 => 2 VP',sc[0].coins===2);
  g.military.pos=-7; t('military 10',g.computeScores()[1].military===10); }
console.log(bad? bad+' FAILED':'SCENARIOS OK');
