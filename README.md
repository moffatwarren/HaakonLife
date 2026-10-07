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
  then type your name. The game remembers your last pick and name.
- Character colours live in `LOOKS` at the top of `js/art.js` if you want to
  add or tweak outfits.

## Mini-games

Walk up to these and press A:

- **Office computers**: SDG, lay out an air handling unit
- **Zin's computer** (office 126): Spring Roll Hold'em, no-limit Texas Hold'em against Cody and Dmitriy, played for spring rolls
- **Cody's computer** (cubicle 142): Spring Roll Blackjack against the house, for the same spring rolls (break the bank at 1000)
- **Coffee machine** (lunch room): catch the coffee in your cup
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
- **Elevator**: every ride, a coworker gets in and makes conversation

Talk to **Damir** (office 108, with the lights off) if you dare: he cuts the
power, and you have to find three fuses with only a flashlight while shadows
creep closer whenever they're out of the beam.

Talk to **Richard** (office 122) and say yes to test your air handling
knowledge: a turn-based duel where you and Richard each pick a move and the
winner knocks 1 off the other's 3 HP. Fan Gust beats Coil Freeze, Coil Freeze
beats Damper Block, and Damper Block beats Fan Gust.

Talk to **Patrick** (office 171, the one with the disco floor) for a
dance-off: arrows rise up four lanes in time with the office's rave tune, and
you hit each one as it reaches the top. Beat Patrick's score and he calls the
whole office in for a few seconds of dance party.

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

Best scores are saved in the browser. For testing, `index.html#play&game=punch`
(or `run`, `pong`, `toss`, `stack`, `simon`, `lunch`, `candy`, `squat`, `golf`,
`dark`, `coffee`, `battle`, `fan`, `coil`, `damper`, `filter`, `snake`, `parts`,
`cable`, `cpr`, `engrave`, `pulldown`, `ball`, `desk`, `jam`, `laundry`,
`forms`, `nathan`, `wade`, `jar`, `dance`, `party`, `poker`, `blackjack`) opens a game straight away.
For Linda's list, `&quest=1` hands you the list (`&quest=4` with 3 tasks done,
`&quest=done` finished), `&name=Sam` sets your name, and `game=locker`, `list`
or `eotm` opens those screens. `&stapler=found` gives Linda her stapler back,
and `&stapler=near` puts it right in front of you. `&helped=5` counts the
first 5 coworkers as helped, and `&eotm=1` hands you the award, `&kikilist=1` gives you Kiki's list, and
`game=kiki` opens it.

`tools/shot.sh out.png "play&game=snake&ticks=60"` screenshots a game headlessly
(it uses `tools/test.html`, which stubs the audio and can pin `Math.random` with
`&rand=0.4` so a run is repeatable).

## People

Everyone with an office or cubicle wanders around it. Walk up to someone and
press A (E / Space) to talk. Their appearance and what they say live in
`js/people.js`: set `body` to `'male'` or `'female'`, change the colours, and
add your own `lines`. The starting appearances are random placeholders.

## Editing the map

`js/maps.js` is generated. To change it, edit the coordinates in
`tools/build_maps.py` (the legend is at the top of that file), then run:

```
python3 tools/build_maps.py   # regenerate js/maps.js
python3 tools/check_maps.py   # make sure every room is still reachable
```

1 tile is about 0.1" on the printed plan (roughly half a metre).
