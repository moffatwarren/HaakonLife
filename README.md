# Haakon Life

A top-down, Game Boy–style walkabout of the Richmond office (both floors).

## Playing

Open `index.html` in any browser. It works straight from the folder (no server
needed), or you can copy the whole folder to any web host. Keep `index.html`
and the `js/` folder together.

When it's served from a website (like GitHub Pages), the page asks the server for
the newest copy of each file in `js/` every time it loads, so phones pick up an
update straight away. The title screen shows when the version you're running was
published ("Updated ...").

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrows / WASD | D-pad |
| A: interact, confirm | E / Space | A |
| B: back, cancel | Esc / X / Shift | B |
| Start menu (map, sound, music) | Enter (or Esc while walking) | START |
| Map | M | (Start → Map) |

- Walk onto a staircase to change floors, or face the elevator doors and press A.
- After the title screen, pick a male or female character (four looks each),
  then type your name. The game remembers your last pick and name. Don't try
  calling yourself Bob, though: there is only one of those.
- Character colours live in `LOOKS` at the top of `js/art.js` if you want to
  add or tweak outfits.

## Mini-games

Walk up to these and press A:

- **Office computers**: SDG, lay out an air handling unit
- **Zin's computer** (office 126): Spring Roll Hold'em, no-limit Texas Hold'em against Cody and Dmitriy, played for spring rolls
- **Cody's computer** (cubicle 142): Spring Roll Blackjack against the house, for the same spring rolls (break the bank at 1000)
- **Coffee machine** (lunch room): catch the coffee in your cup. It pours 150 drops, and the nozzle gets quicker and twitchier as it goes; you're scored on how many you catch
- **Recycling bin** (lunch room): toss crumpled paper into the bin; watch the wind
- **Fridge**: keep your eye on your lunch while the containers shuffle
- **Candy table**: hold A to reach for candy, and freeze when your coworker turns around
- **Photocopier**: drop each copy onto the pile; anything hanging over gets cut off
- **Electrical panels** (Instrument Room 168 and both electrical rooms): repeat the light sequence with the arrow keys
- **Punching bag** (fitness room): 5 punches; the closer to dead centre, the more points
- **Squat rack** (fitness room): mash A to stand up with the bar before time runs out; it gets heavier every lift
- **Treadmill** (fitness room): jump over the gym clutter (hold A to jump higher) and duck under hanging stuff with Down
- **Big TVs**: play Pong against the TV, first to 5
- **Wade's putting green** (2nd floor, office 137): 5 holes of top-down mini golf with sand and water
- **Air handling fan** (Boardroom 114): hold the wheel inside the target CFM band without tripping the motor
- **Cooling coil** (Boardroom 114): hold the superheat in the green while the load wanders; frost it or flood it and you lose
- **Dampers** (Boardroom 114): three branches share one fan, so balancing them is a puzzle, not three dials
- **Supply cupboard**: match filter sizes before the pressure-drop alarm tops out
- **The other TVs** (the left-hand sets): Snake, so they aren't all Pong
- **Parts on the floor** (2nd floor): sort them into bins as they come past on the belt
- **Server racks**: patch every port to its matching colour
- **First aid dummy** (170 First Aid Station): compressions at 110 bpm, scored on timing
- **Engraver** (2nd floor, room 193): trace the nameplate without straying off the line
- **Lat pulldown** (fitness room): pull, then release, as the marker sweeps through the sweet spot; 20 sweeps, scored out of 20
- **Exercise ball** (fitness room): shift your weight and stay on it
- **Front desk** (Reception): send each visitor to the right office; you have to know the building
- **Printer**: ease five jammed sheets out without tearing them: watch for snags on the rollers, keep each sheet straight, and read whatever somebody printed
- **Washer and dryer** (fitness room): catch the load the machine is asking for, let the rest drop
- **Joe's Lego shelf** (2nd floor, office 146): the same falling bricks as Joe's brick battle, but on your own. Rows of grey bricks push up from the bottom, slowly at first and then faster and faster, so see how many lines you can clear before they reach the top
- **Elevator**: every ride, a coworker gets in and makes conversation
- **Forklift** (Kingston plant, in the warehouse): Forklift Rush. The truck at the dock
  calls for one kind of pallet at a time (fan, coil, damper or motor); drive the forks
  into it to pick it up, and into the trailer to load it (or into an empty rack bay to
  put a wrong one back). 90 seconds, as many pallets as you can. Left and right turn the
  wheels a notch at a time and they stay turned (Space straightens them); it steers from
  the back, so it only turns while it's moving. Bringing the wrong pallet costs 3
  seconds, and running into Steve on the crosswalk costs 5
- **Grey unit in the paint booth** (Kingston plant, in the corner of sub-assembly): Even Coat.
  Hold A to spray the job's colour and steer the gun with the arrows. One pass leaves a
  stripe; passes that overlap by about half leave an even coat. Stay in one spot and the
  paint runs. Nobody masked the portholes, latches or nameplate, so let go of the trigger
  over them. Dust drifts down from the booth fans: catch it with the spray before it
  lands. 45 seconds and one can of paint; press Enter (START) to call QC over early. QC
  starts from the coverage (out of 100) and takes off 3 for each run (30 at most), 4 for
  each part with paint on it and 2 for each bit of dust (10 at most), and shows you the
  sheet. Paint that's on too thick goes darker (cream, for white) before it runs.
  Afterwards the unit in the booth stays in the colour you painted it

## Eugene's phone and the Kingston plant

The phone on Eugene's desk (office 163) never stops ringing: you can hear it from
his office (and faintly from the hallway outside), and the handset rattles on the
cradle. The music stops while you're in his office, so all you hear is the phone.
Answer it and someone from the plant reads you a list of everything going
wrong, until it all gets too much and you black out.

You wake up in the **Kingston plant**. The plant floor takes up the north half,
with sheet metal, wall panels, bases and fans, sub-assembly, the assembly line,
electrical, the test bay, finishing, the warehouse, and shipping along the east
wall at the loading dock, where five finished air handling units of different designs
wait for the truck (one shrink-wrapped on a skid, one stacked, one rooftop unit and so on),
and the paint booth, walled off in the corner of sub-assembly, with a grey unit waiting
to be painted. The front offices run along the south either side of a
corridor (the plant manager, HR, purchasing, the production office, engineering,
IT, health and safety, and the training room), with two halls up onto the floor
and reception in the south-east corner by the entrance. Everyone who works there is
in their own area to talk to. The fans, coils, dampers, filters, test bench
controls and parts on the floor are the same mini-games as in the office.

To go back, open the Start menu (Esc or START) and pick **Leave plant**. You pass
out, and wake up beside Eugene's phone with the office just as you left it. The
phone is ringing again, so you can go back any time.

What the caller says is `CALL` (and the shouting at the end is `PANIC`) in
`js/game.js`. The people at the plant, their looks and their lines are `PLANT_CREW` in
`js/people.js`; which area each one works in, and the plant's layout, are in the
Kingston plant section at the end of `tools/build_maps.py`. Alex and Courtney also
take turns in the Richmond visitor office, looking the same as they do at the plant.

## Leaderboards

When you finish a game that has a score, you see the top ten of everyone who has
played it on the website, under the name they typed at the start, with your own row
picked out (and added underneath if you didn't make the top ten). Each name has one
row per game, holding its best score, so the same name on a phone and a computer is
one person. Pong, Richard's duel, Wade's match and Kiki's jar are win-or-lose, so
they have no board.

Only the name and the score are sent. If the leaderboard can't be reached the game
says so and carries on, and best scores are still kept in the browser as before.

Scores are only sent from the hosted copy (an address ending in `github.io`). Opening
`index.html` straight from the folder still shows the boards, but your score isn't
added, so testing locally never posts anything.

The scores live in a free Firebase Realtime Database. To set one up:

1. Go to console.firebase.google.com, sign in with a Google account and create a
   project (any name; Analytics can stay off).
2. Build → Realtime Database → Create Database, pick a location, start in locked mode.
3. On the Rules tab, replace what's there with the rules below and press Publish.
4. Copy the database's web address from the top of the Data tab (it looks like
   `https://something-default-rtdb.firebaseio.com`) into `BOARD_URL` near the top of
   `js/game.js`. While that is empty there are no leaderboards.

```json
{
  "rules": {
    "scores": {
      "$game": {
        ".read": true,
        ".indexOn": ["score"],
        "$player": {
          ".write": "newData.exists() && (!data.exists() || newData.child('score').val() > data.child('score').val())",
          ".validate": "$game.length <= 24 && $player.length <= 12 && newData.hasChildren(['name','score','t']) && newData.child('name').isString() && newData.child('name').val().length >= 1 && newData.child('name').val().length <= 12 && newData.child('score').isNumber() && newData.child('score').val() >= -100000 && newData.child('score').val() <= 1000000 && newData.child('t').val() == now",
          "name": { ".validate": true },
          "score": { ".validate": true },
          "t": { ".validate": true },
          "$other": { ".validate": false }
        }
      }
    }
  }
}
```

With these rules anyone can read the boards and add or improve a row, but nobody can
lower or delete one. The game runs in the browser, so a determined person could still
send a made-up score or use somebody else's name. To remove a row (or wipe a whole
board), delete it on the Data tab in the Firebase console: rows are under
`scores`, then the game, then the name. The games where lowest wins (golf, Damir's
lights, mummy wrap) are stored as negative numbers.

Which games have a board, and their titles, is the `BOARDS` list in `js/game.js`.

## Coworker games

Some coworkers have a game for you. Walk up to them and press A:

- **Damir** (office 108, with the lights off): if you dare, he cuts the power,
  and you have to find three fuses with only a flashlight while shadows creep
  closer whenever they're out of the beam.
- **Richard** (office 122): say yes to test your air handling knowledge in a
  turn-based duel where you and Richard each pick a move and the winner knocks
  1 off the other's 3 HP. Fan Gust beats Coil Freeze, Coil Freeze beats Damper
  Block, and Damper Block beats Fan Gust.
- **Patrick** (office 171, the one with the disco floor): a dance-off. Arrows
  rise up four lanes in time with the office's rave tune, and you hit each one
  as it reaches the top. Beat Patrick's score and he calls the whole office in
  for a few seconds of dance party.
- **Nathan** (office 115): grab the trophy he names off his crowded shelf
  before the sweeping hand runs away with you.
- **Wade** (2nd floor, office 137): a three-hole putting grudge match.
- **Kiki** (Reception): guess how many sweets are in the candy jar, closer than
  she does, over 3 rounds. A round where you're both equally close goes to
  nobody, and if no one wins 2 rounds it's a draw and you play again. The first time you talk to her she hands you her Employee of the
  Month list instead (see below); after that she offers the bet.
- **Jhonna** (office 118): fill in her Manulife dependant forms, at last.
- **Nik** (2nd floor, office 106): he taught his younger brother Dmitriy
  everything about being a chef, and shows you at the wok. Toss the stir-fry
  with Space and slide the wok to catch it. Food cooks in the wok (faster over
  the flame) but scorches if you don't keep it moving. Serve more than Nik's 4
  dishes in a minute.
- **Dmitriy** (2nd floor, cubicle 173): says he ran the line, not Nik, and
  tests your knife skills. Five carrots slide under the knife, each faster with
  more lines; chop on the dotted lines. Beat his 75% evenness.
- **Joe** (2nd floor, office 146, with the Lego shelf): a Lego brick battle.
  Falling bricks on two baseplates, you against Joe, with the same bricks in
  the same order. Clear 2 or more rows at once to push grey bricks up under
  Joe (2 rows send 1, 3 send 2, 4 send 4); his clears do the same to you. Your
  bricks reaching the top loses. Left/right move, Space turns, Down drops
  faster, Up drops straight down.

## Linda's list

One of the lockers in the **fitness room** is open a crack. Inside is a list
left by Linda, the ghost in the rack room: 7 things she never got round to,
picked at random from about 20 each time you take it (beat the TV at Pong, win
100 spring rolls off Cody, fix Damir's lights, and so on). Read it any time
from the Start menu; each task crosses itself off when you do it. Linda has
new things to say once her list is done. The list isn't saved: every visit
starts fresh.

Linda also lost her **red stapler**. It turns up on a different desk, counter,
shelf or table every visit, and Linda drops hints about which room. Finding it
or finishing the list makes the air feel a little lighter; do both and go and
see her, and she's finally free: she rises up a beam of light and floats away.

## Employee of the Month

Talk to Kiki at reception and she hands you a list of the coworkers who could
use a hand (anyone you've already beaten comes pre-ticked). Like Linda's list,
you can read it from the Start menu and each one ticks itself off as you win.
Beat them all and Kiki names you **Employee of the Month**, with your picture on
an easel by the front entrance and the name you entered at the start. Like
Linda's list, it isn't saved.

- **Nathan** (office 115): grab the trophy he names off a crowded shelf, before the sweeping hand runs away with you (get 8)
- **Wade** (2nd floor, office 137): a three-hole putting grudge match (win it)
- **Kiki** (Reception): guess how many sweets are in the jar, closer than she does (win it)
- **Jhonna** (office 118): her Manulife dependant forms, at last (tick 15 fields)
- **Richard** (office 122): his air handling duel (win it)
- **Damir** (office 108): fix the lights in his dark office
- **Patrick** (office 171): out-dance him in his dance-off
- **Nik** (2nd floor, office 106): out-cook him at the wok
- **Dmitriy** (2nd floor, cubicle 173): pass his knife skills test
- **Joe** (2nd floor, office 146): win his Lego brick battle

## Halloween

All through October (by your device's date) the office does Halloween:

- After your name you pick a **costume**: Clown, Vampire, Skeleton, Witch, Pumpkin,
  Mummy, Haakon Fan or SDG Sign. You wear it all game, and the game remembers it.
- A note at the entrance sends you to the downstairs boardroom (114), which is
  decorated. Press A on any **boardroom chair** to start the party.
- The lights dim, the doors shut, and Lam, Linda and eight coworkers picked at random
  turn up in costume. Talk to them to hear about their outfits.
- While the party is on there are five **party games** around the room (and the
  boardroom's usual games, the fan, coil, dampers, fridge and TVs, are switched off):
  - **Tub of water** (bottom-left corner): bobbing for apples. Slide along the tub and
    dunk when an apple is under you. Golden apples are worth 3; a rubber duck costs 2 seconds.
  - **Toilet rolls** (top-left corner): mummy wrap. Alternate left and right to wrap a
    coworker faster than the other team, but mash too fast and the paper tears.
  - **Pumpkin on the counter**: pumpkin carving. Remember the face, then carve it one
    feature at a time. One wrong cut and the knife slips.
  - **Candy bowl** (on the table, door side): trick-or-treat catch. Sweets in the bag;
    spiders, toothbrushes and dropped sweets are strikes. Three and you're out.
  - **Bookshelves** (by the doors): ghost in the cupboard. Press the arrow for the
    cupboard a ghost pops out of, before it floats off. Leave Linda alone.
- Talk to **Lam** when you're ready for the **costume contest**: three coworkers walk
  the catwalk, then you strike ten poses, the ring closing faster each time. Press the arrow
  shown as the ring closes onto the mark; three judges score you out of 10 each.
- Then it's "Happy Haakon Halloween", and you're back by your chair with the office
  as it was. Sit down again to run the party again.

The costumes are drawn in `COSTUMES` in `js/art.js`. What people say about their
costume is `COSTUME_LINES` at the bottom of `js/people.js`, and anyone in `PEOPLE` can
have a `halloween:` line of their own.

## Shortcuts

Add these to the end of the address (after `index.html`) and press Enter.

**Halloween outside October**

- `index.html#halloween=1`: the whole game with Halloween switched on, from the title
  screen: character, name, costume picker, then the party waiting in the boardroom.
- `index.html#play&halloween=1&party=1`: skip straight to the boardroom party.
- `index.html#play&halloween=1&game=contest`: skip straight to the costume contest.
- Add `&costume=witch` (or `clown`, `vampire`, `skeleton`, `pumpkin`, `mummy`, `fan`,
  `sdg`) to a `#play` link to pick what you're wearing.
- `#halloween=0` switches it off during October.

**Straight into a mini-game**

`index.html#play&game=NAME` skips the title screen and opens that game, for example
`index.html#play&game=punch`. The names:

| | |
| --- | --- |
| Office and lunch room | `coffee`, `toss`, `lunch`, `candy`, `stack`, `jam`, `desk`, `filter`, `simon` |
| Fitness room | `punch`, `squat`, `run`, `pulldown`, `ball`, `laundry` |
| TVs and computers | `pong`, `snake`, `poker`, `blackjack` |
| Boardroom and 2nd floor | `fan`, `coil`, `damper`, `parts`, `cable`, `cpr`, `engrave`, `golf`, `build` (Joe's Lego shelf) |
| Coworkers | `dark` (Damir), `battle` (Richard), `dance` (Patrick), `nathan`, `wade`, `jar` (Kiki), `forms` (Jhonna), `wok` (Nik), `carrot` (Dmitriy), `lego` (Joe) |
| Dogs | `catch`, `dogs` (the dogs' leaderboard) |
| Kingston plant | `forklift`, `paint` (Even Coat) |
| Leaderboards | `board` with `&key=snake` (or any name from `BOARDS` in `js/game.js`) |
| Halloween | `contest`, `bob`, `mummy`, `carve`, `treat`, `ghosts`, `hsplash` (the closing screen) |

Plain `index.html#play` skips the title screen and drops you at the entrance.

**Eugene's phone and the plant**

- `index.html#play&phone=1`: stand at Eugene's phone (`&call=1` answers it too).
- `index.html#play&plant=1`: wake up in the Kingston plant.

## Testing

Best scores are saved in the browser, and sent to the online leaderboards when
`BOARD_URL` is set. For testing, `index.html#play&game=punch`
(or `run`, `pong`, `toss`, `stack`, `simon`, `lunch`, `candy`, `squat`, `golf`,
`dark`, `coffee`, `battle`, `fan`, `coil`, `damper`, `filter`, `snake`, `parts`,
`cable`, `cpr`, `engrave`, `pulldown`, `ball`, `desk`, `jam`, `laundry`,
`forms`, `nathan`, `wade`, `lego`, `wok`, `carrot`, `jar`, `dance`, `party`, `poker`, `blackjack`, `build`, `forklift`, `paint`) opens a game straight away.
`&dog=Bella` puts that dog right in front of you; `game=catch` plays catch with it
and `game=dogs` shows the frisbee leaderboard.
For Linda's list, `&quest=1` hands you the list (`&quest=4` with 3 tasks done,
`&quest=done` finished), `&name=Sam` sets your name, and `game=locker`, `list`
or `eotm` opens those screens. `&stapler=found` gives Linda her stapler back,
and `&stapler=near` puts it right in front of you. `&helped=5` counts the
first 5 coworkers as helped, and `&eotm=1` hands you the award, `&kikilist=1` gives you Kiki's list, and
`game=kiki` opens it.
`&halloween=1` turns Halloween on outside October (`&halloween=0` turns it off),
`&costume=witch` (or `clown`, `vampire`, `skeleton`, `pumpkin`, `mummy`, `fan`, `sdg`)
wears that costume, `&costumes` opens the costume picker, `&party=1` starts the
boardroom party (add `&f=0&x=43&y=13` to stand somewhere particular), and `game=contest`,
`bob`, `mummy`, `carve`, `treat`, `ghosts` or `hsplash` opens the contest, a party game
or the closing splash screen.
`&phone=1` stands you at Eugene's phone, `&call=1` answers it, and `&plant=1` starts
you in the Kingston plant.
`&visitor=Alex` puts that visitor in the visitor office, and `&visit=120` has
whoever is there leave through the portal in 120 ticks (2 seconds).

`game=board&key=snake` opens that game's leaderboard without sending anything.

`tools/shot.sh out.png "play&game=snake&ticks=60"` screenshots a game headlessly
(it uses `tools/test.html`, which stubs the audio and can pin `Math.random` with
`&rand=0.4` so a run is repeatable). In `tools/test.html` the leaderboards show
made-up rows and send nothing (`&score=40` adds you to the made-up rows as if you had
just played). `&board=live` shows the real boards instead, still without sending.

## People

Everyone with an office or cubicle wanders around it. Walk up to someone and
press A (E / Space) to talk. Their appearance and what they say live in
`js/people.js`: set `body` to `'male'` or `'female'`, change the colours, and
add your own `lines`. The starting appearances are random placeholders.

Office 182 on the 2nd floor is the visitor office. The visitors from out of town
take turns in it: about every 30 seconds the one who's there walks into the
portal in the corner and the next one steps out, so you can meet all of them in
one sitting. They come in a different order every time the game is launched, and
nobody leaves while you're talking to them. Their names and lines live in
`VISITORS` at the top of `js/people.js`; add a name there and they join the
rotation.

## Dogs

Seven office dogs wander in and around their owners' offices: Cashew (Walker),
Bella (Desirae), Birdie (Diane), Bandit (Jenn), Louie (Rob), Mocha (Sidney) and
Nala (Jhonna). Kim's cat Felix just sleeps in the middle of her office, and
you can try to play catch with him too. Walk
up to one and press A: it barks, and you can play catch. The dog runs out while
the power meter swings; throw so the frisbee comes down near the dog, then steer
it with the arrows and press A to jump. After 10 frisbees you see the leaderboard
of every dog's best game. Names, owners, breeds, colours, barks and running speed live in
`DOGS` at the bottom of `js/people.js`.

## Editing the map

`js/maps.js` is generated. To change it, edit the coordinates in
`tools/build_maps.py` (the legend is at the top of that file), then run:

```
python3 tools/build_maps.py   # regenerate js/maps.js
python3 tools/check_maps.py   # make sure every room is still reachable
```

The Kingston plant is a third map in the same file. It isn't linked to the office
floors, so the checker also starts from where you wake up in the plant.

1 tile is about 0.1" on the printed plan (roughly half a metre).
