# Haakon Life

A top-down, Game Boy–style walkabout of the Richmond office (both floors from
`Richmond Floor Map.pdf`).

## Playing

Open `index.html` in any browser. It works straight from the folder (no server
needed), or you can copy the whole folder to any web host. Keep `index.html`
and the `js/` folder together.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrows / WASD | D-pad |
| A: interact, confirm | E / Space | A |
| B: back, cancel | Esc / X / Shift | B |
| Start menu (map, sound, music) | Enter (or Esc while walking) | START |
| Map | M | (Start → Map) |

- Walk onto a staircase to change floors, or face the elevator doors and press A.
- After the title screen, pick a male or female character (four looks each).
  The game remembers your last pick.
- Character colours live in `LOOKS` at the top of `js/art.js` if you want to
  add or tweak outfits.

## Mini-games

Walk up to these and press A:

- **Office computers**: SDG, lay out an air handling unit
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

Talk to **Damir** (office 108, with the lights off) if you dare: he cuts the
power, and you have to find three fuses with only a flashlight while shadows
creep closer whenever they're out of the beam.

Best scores are saved in the browser. For testing, `index.html#play&game=punch`
(or `run`, `pong`, `toss`, `stack`, `simon`, `lunch`, `candy`, `squat`, `golf`, `dark`, `coffee`) opens a game straight away.

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
