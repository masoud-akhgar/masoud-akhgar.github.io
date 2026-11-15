7 WONDERS DUEL - hot-seat version (2 players on one page)
=========================================================

HOW TO RUN
  Keep all files in ONE folder and double-click index.html.
  (or:  python3 -m http.server 8000   then open http://localhost:8000 )

FILES (load order = order in index.html)
  swd-constants.js  enums, glyphs, seedable RNG, helpers
  swd-cards.js      class Card + all Age I/II/III + Guild data (EDIT CARDS HERE)
  swd-wonders.js    class Wonder + the 12 wonders (EDIT WONDERS HERE)
  swd-board.js      ProgressToken (10), MilitaryBoard, CardStructure (Age layouts)
  swd-player.js     class Player: city, production, trading prices, rebates, scoring
  swd-game.js       class Game: draft, ages, turns, actions, effects, end of game
  swd-ui.js         plain text UI (replaceable; the engine has no DOM code)
  test-simulate.js  node test-simulate.js  -> rule-book examples + 3000 random games
  test-rules.js     node test-rules.js     -> targeted rule scenarios

CARD CLASS (swd-cards.js)
  name, age/deck (1|2|3|'guild'), type (colour), cost{coins,resources},
  vp, shields, science, production{fixed|choice}, tradeDiscount[],
  coins / coinsPer (coins when built), chainFrom / chainGives, guildType

CARD PICTURES
  Every card, wonder and progress token has an  image  field with the address of
  its picture (relative to index.html), e.g.
     { name: 'Quarry', image: 'images/age1/quarry.jpg', ... }      (swd-cards.js)
     { id: 'pyramids', image: 'images/wonders/pyramids.jpg', ... } (swd-wonders.js)
     { id: 'law', image: 'images/progress/law.jpg', ... }          (swd-board.js)
  Card backs: SWD.CARD_BACK_IMAGES in swd-constants.js (images/back-age1.jpg ...).
  Put your files in those folders (or change the addresses / extension).
  The UI shows a picture when the file exists and silently falls back to text
  when it does not, so you can add images one by one.

SCIENTIFIC SYMBOLS
  Defined by the  science:  field of each green card in swd-cards.js.
  Cards that share a symbol (from your guide book):
     Academy + Study | Workshop + Laboratory | Apothecary + School |
     Scriptorium + Library | Pharmacist + Dispensary | University + Observatory
  In the page: every green card shows its symbol in the top-right corner, the
  "Scientific symbols" table lists which cards carry which symbol and how many
  each player owns (a pair is highlighted), and each player's panel lists theirs.
  Symbol pictures: SWD.SCIENCE_IMAGES in swd-constants.js (images/science/wheel.png ...),
  emoji are used until the files exist.

RESOURCE / COIN / SHIELD ICONS
  SWD.ICON_IMAGES in swd-constants.js lists one picture per wood, clay, stone,
  glass, papyrus, coin and shield (images/resources/wood.png, ...). They replace
  the emoji everywhere in the UI; a missing file falls back to the emoji.

DATA THAT WAS RECONSTRUCTED (your book text has names + effects, not numbers)
  Please compare with the card list in your book and fix any value:
   - all building costs, VP values, shields (swd-cards.js)
   - which chain symbol links which cards (chainGives / chainFrom)
   - which scientific symbol each green card has (6 symbols, 2 cards each; the
     rule book only needs "pairs", so which card has which symbol matters for play)
   - Guard Tower (free?), Forum / Caravansery / Town Hall / Courthouse costs,
     Age III yellow VP (3 each), guild costs
   - wonder costs and VP (swd-wonders.js)
   - Age III layout: the book only gives row sizes 2,3,4,2,4,3,2. Which rows lie
     on top of which is in AGE_LAYOUTS (swd-board.js, list "z"). Ages I and II
     follow the book.
  Things taken straight from your book text: card/wonder effects, trading
  formula, 7-coin start, military zones/tokens, progress tokens, guild rules,
  scoring, tie-break, setup (remove 3 cards per Age, 3 random guilds in Age III).

RULES IMPLEMENTED
  Wonder draft (or fixed beginner set), 3 Ages with face-up/face-down pyramids,
  build / discard for coins / build wonder, production + flexible resources,
  trading price 2 + opponent's brown/grey production, 1-coin discounts, chains,
  Masonry & Architecture rebates (cheapest choice is picked automatically),
  Economy, Urbanism, Strategy, Theology, Law, Agriculture, Philosophy, Mathematics,
  military pawn, looting tokens, military/science supremacy, 7-wonder limit,
  play-again (lost at the end of an Age), who starts the next Age, guilds,
  final scoring (+ blue-card tie-break), Great Library, Mausoleum,
  Circus Maximus, Statue of Zeus, Appian Way, Temple of Artemis, ...
