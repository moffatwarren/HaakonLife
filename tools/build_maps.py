#!/usr/bin/env python3
"""Builds js/maps.js from coordinates hand-traced off the office floor plan.

1 tile ~= 0.1 inch on the printed plan (roughly half a metre).
Run:  python3 tools/build_maps.py

Map glyphs
  walkable:  . carpet   , hallway   : tile   _ wood   D doorway   S stairs
  solid:     # wall  (space) outside  X exit door  E elevator door
             d desk  m computer desk  c chair  p plant  b bookshelf
             k counter  M appliance  n sink  w toilet  f fridge  v recycling bin
             x photocopier  T table  q gym machine  h shower  r reception
             = cubicle partition  o exercise ball  B cardboard box
             H shelf of computer parts  J pile of computer junk
             U supply cupboard  Y printer
             V TV on a right-hand wall  Q TV on a left-hand wall
             F fan unit  L cooling coil  a damper  K electrical control panel
             R reception desk with PC  Z table with candy
             W washer  O dryer  A squat rack  G punching bag  N locker
             $ Employee of the Month easel (plain floor until Linda's list is done)
             I lat pulldown machine  e dumbbell rack  g shelf of snacks  l railing
             z server rack  y rack of computers  u stretcher  t trophy shelf
             i putting green  s engraving machine
             & Joe's Lego shelf (on a left-hand wall)  % desk with Lego on it
             P coffee machine (two tiles tall)  C curtain (opened from the game; closes when you leave the room)
  walkable:  j computer parts scattered on the floor

Room options: 'dark': True draws the room with the lights off,
'rave': True fills the room with strobing party lights and dance music,
'say': '...' shows a line of dialogue every time you walk in, and
'computer': 'poker' / 'blackjack' runs that program on the room's computers instead of SDG, and
'gender': 'male'/'female' keeps the other gender out (bathrooms), and
'curtain': True marks the room behind a curtain, and
'people': [names] adds extra NPCs (repeats allowed),
'person': name (+ optional 'area': [x1, y1, x2, y2]) puts someone in a room
that isn't named after them, and
'parent' marks a cubicle inside an open office (no banner when stepping
back out into the parent area).
"""
import json, os

W, H = 108, 40


class Floor:
    def __init__(self, name):
        self.name = name
        self.g = [[' '] * W for _ in range(H)]
        self.fl = [[' '] * W for _ in range(H)]  # floor layer under objects
        self.rooms = []

    # --- primitives (all coordinates inclusive) ---
    def fill(self, x1, y1, x2, y2, ch):
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                self.g[y][x] = ch
                if ch in '.,:_':
                    self.fl[y][x] = ch

    def hline(self, x1, x2, y, ch='#'):
        self.fill(x1, y, x2, y, ch)

    def vline(self, x, y1, y2, ch='#'):
        self.fill(x, y1, x, y2, ch)

    def put(self, x, y, ch):
        self.g[y][x] = ch

    def door(self, *cells):
        for x, y in cells:
            self.g[y][x] = 'D'

    def exit(self, *cells):
        for x, y in cells:
            self.g[y][x] = 'X'

    def room(self, name, x1, y1, x2, y2, floor='.'):
        self.fill(x1, y1, x2, y2, floor)
        self.rooms.append({'name': name, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2})

    def office(self, name, x1, y1, x2, y2, door, floor='.', plant=True):
        """Room with a desk + chair placed on the side away from the door."""
        self.room(name, x1, y1, x2, y2, floor)
        cx = (x1 + x2 + 1) // 2
        if door == 'N':
            dy, cy = y2, y2 - 1
        else:
            dy, cy = y1, y1 + 1
        if door == 'W':
            cx = max(x1 + 2, x2 - 1)
        elif door == 'E':
            cx = min(x2 - 1, x1 + 2)
        self.put(cx - 1, dy, 'm')
        self.put(cx, dy, 'd')
        self.put(cx - 1, cy, 'c')
        if plant and x2 - x1 >= 3:
            corner_x = x1 if door != 'W' else x2
            if door in ('W', 'E'):
                corner_x = x2 if door == 'W' else x1
                self.put(corner_x, y2, 'p')
            else:
                far_x = x2 if cx - 1 <= (x1 + x2) // 2 else x1
                self.put(far_x, dy, 'p')

    def cubicle(self, name, x1, y1, x2, y2, desk_side, parent='Open Office'):
        """Named cubicle with a desk against a partition; desk_side is 'W' or 'E'."""
        self.rooms.append({'name': name, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'parent': parent})
        dx = x1 if desk_side == 'W' else x2
        my = (y1 + y2) // 2
        self.put(dx, my - 1, 'm')
        self.put(dx, my, 'd')
        cx = dx + 1 if desk_side == 'W' else dx - 1
        self.put(cx, my - 1, 'c')

    def l_desk(self, cells, mon, chair):
        """Desk made of the given tiles, a computer at `mon` and a chair."""
        for x, y in cells:
            self.put(x, y, 'd')
        self.put(*mon, 'm')
        self.put(*chair, 'c')

    def clear(self, *cells, floor='.'):
        for x, y in cells:
            self.put(x, y, floor)

    def out(self):
        return {
            'name': self.name,
            'tiles': [''.join(r) for r in self.g],
            'floor': [''.join(r) for r in self.fl],
            'rooms': self.rooms,
        }


# =====================================================================
# GROUND FLOOR
# =====================================================================
f1 = Floor('Ground Floor')
f1.fill(3, 4, 106, 37, ',')
f1.hline(2, 107, 3); f1.hline(2, 107, 38); f1.vline(2, 3, 38); f1.vline(107, 3, 38)

# --- north-west: fitness, instrument, showers, washrooms ---
f1.room('Fitness Room', 3, 4, 13, 15)
f1.vline(14, 3, 16); f1.hline(2, 14, 16); f1.door((14, 14), (14, 15))
f1.put(13, 4, 'p')
f1.put(4, 4, 'W'); f1.put(5, 4, 'O')            # washer / dryer
f1.fill(8, 4, 10, 4, 'A')                       # squat rack
f1.put(12, 6, 'G')                              # punching bag
for x in (3, 4, 5):
    f1.put(x, 8, 'q')                           # one treadmill, drawn side-on across 3 tiles
f1.fill(13, 8, 13, 13, 'N')                     # lockers on the right wall
f1.put(4, 14, 'I')                              # lat pulldown machine
f1.fill(8, 15, 12, 15, 'e')                     # dumbbell rack

f1.room('Instrument Room 168', 15, 4, 26, 10)
f1.vline(27, 3, 16); f1.hline(14, 27, 11); f1.door((17, 11), (18, 11))
f1.fill(15, 4, 26, 4, 'b'); f1.fill(17, 4, 18, 4, '.')  # keep the exit clear
f1.fill(19, 7, 24, 7, 'k'); f1.put(21, 7, 'M'); f1.put(23, 7, 'M')
for x in (20, 22, 24):
    f1.put(x, 4, 'K')                           # electrical panels between the shelves

f1.vline(19, 11, 16)
f1.room('Shower Room', 20, 12, 26, 15, ':')
f1.hline(19, 27, 16); f1.door((20, 16), (21, 16))
f1.put(26, 12, 'h'); f1.put(26, 15, 'h'); f1.put(25, 12, 'h'); f1.put(25, 15, 'h')
# partition between the two pairs of showers, with a stall front on the left
f1.hline(23, 26, 13, '='); f1.vline(22, 13, 14, '=')

# Boys' (bottom left) and girls' (bottom right) open onto the hallway below.
# Above them is a washroom with two stalls, reached through the change room
# on its right, which opens onto the side corridor.
f1.vline(32, 3, 16); f1.vline(37, 3, 16); f1.hline(27, 37, 11); f1.hline(27, 37, 16)
f1.room("Boys' Bathroom", 28, 12, 31, 15, ':'); f1.rooms[-1]['gender'] = 'male'
f1.door((30, 16), (31, 16)); f1.put(28, 12, 'w'); f1.put(30, 12, 'n')
f1.room("Girls' Bathroom", 33, 12, 36, 15, ':'); f1.rooms[-1]['gender'] = 'female'
f1.door((33, 16), (34, 16)); f1.put(33, 12, 'n'); f1.put(36, 12, 'w')
f1.room('Washroom', 28, 4, 31, 10, ':')
f1.door((32, 5), (32, 6))
f1.put(28, 10, 'w'); f1.put(30, 10, 'w'); f1.vline(29, 9, 10, '='); f1.vline(31, 9, 10, '=')
f1.put(28, 4, 'n')
f1.room('Change Room', 33, 4, 36, 10, ':')
f1.door((37, 4), (37, 5))
f1.put(36, 7, 'h'); f1.put(36, 8, 'h'); f1.fill(33, 8, 33, 10, 'b')

f1.exit((17, 3), (18, 3), (38, 3), (39, 3), (2, 5), (2, 6))

# --- boardroom ---
f1.room('Boardroom 114', 41, 4, 60, 15, '_')
f1.vline(40, 3, 16); f1.vline(61, 3, 22); f1.hline(40, 61, 16); f1.door((47, 16), (48, 16))
f1.fill(45, 8, 56, 11, 'T')
for x in range(46, 56, 2):
    f1.put(x, 7, 'c'); f1.put(x, 12, 'c')
f1.put(44, 9, 'c'); f1.put(57, 10, 'c')
f1.fill(42, 15, 45, 15, 'k'); f1.put(45, 15, 'f'); f1.fill(50, 15, 53, 15, 'b')
f1.put(41, 4, 'p'); f1.put(60, 4, 'p')
# air handling gear along the top and bottom walls, TV on the right wall
for x in range(42, 60):
    f1.put(x, 4, 'FLLaLLFLaFLFLLaLFF'[x - 42])
for x in range(54, 61):
    f1.put(x, 15, 'LFLaFLF'[x - 54])
f1.fill(60, 6, 60, 13, 'V')

# --- offices east of boardroom ---
f1.vline(67, 3, 8); f1.vline(73, 3, 26)
f1.office('175 Jonathan', 62, 4, 66, 8, 'S')
f1.office('189 Sharon', 68, 4, 72, 8, 'S')
f1.hline(61, 65, 10); f1.hline(68, 73, 10)
f1.vline(65, 10, 22); f1.vline(68, 10, 22)
f1.office('169 Lam', 62, 11, 64, 15, 'E'); f1.door((65, 13), (65, 14))
f1.hline(61, 65, 16)
f1.office('153 Lia', 62, 17, 64, 21, 'E'); f1.door((65, 19), (65, 20))
f1.hline(61, 65, 22)
f1.office('150 Charles', 69, 11, 72, 15, 'W'); f1.door((68, 13), (68, 14))
f1.hline(68, 73, 16)
f1.office('192 Yeunie', 69, 17, 72, 21, 'W'); f1.door((68, 19), (68, 20))
f1.hline(68, 73, 22)

f1.vline(51, 16, 22); f1.vline(56, 16, 22); f1.hline(51, 61, 22)
f1.office('172 Eric', 52, 17, 55, 21, 'S'); f1.door((53, 22), (54, 22))
f1.office('134 Carlos', 57, 17, 60, 21, 'S'); f1.door((58, 22), (59, 22))

# --- kitchen + lunch room ---
f1.room('Lunch Room 183', 74, 4, 106, 10, ':')
f1.hline(73, 107, 11); f1.door((86, 11), (87, 11))
# counter, fridges and recycling all against the top wall
f1.fill(75, 4, 79, 4, 'k'); f1.put(76, 4, 'n')
for x in (80, 81, 82, 83):
    f1.put(x, 4, 'f')
f1.put(84, 4, 'v'); f1.put(85, 4, 'v')
f1.fill(74, 4, 74, 10, 'k'); f1.put(74, 6, 'n'); f1.put(74, 7, 'n')
f1.put(74, 8, 'P'); f1.put(74, 9, 'P')  # big coffee machine (mini-game)
f1.fill(75, 10, 85, 10, 'k')
for x in (78, 79, 81, 82):
    f1.put(x, 10, 'M')
for ty in (4, 8):
    for tx in (91, 96, 101):
        f1.fill(tx, ty, tx + 1, ty + 1, 'T')
        for cy in (ty, ty + 1):
            f1.put(tx - 1, cy, 'c'); f1.put(tx + 2, cy, 'c')
f1.fill(106, 6, 106, 9, 'V')  # TV on the right wall
f1.put(106, 4, 'p'); f1.put(89, 4, 'p')
f1.exit((86, 3), (87, 3))

f1.room('Washroom', 74, 12, 77, 15, ':')
f1.vline(78, 11, 20); f1.hline(73, 78, 20); f1.door((78, 13), (78, 14))
f1.put(74, 12, 'w'); f1.put(74, 14, 'n')
# empty room below the washroom
f1.hline(73, 78, 16)
f1.room('Empty Room', 74, 17, 77, 19); f1.door((78, 18))

# elevator
f1.fill(74, 21, 77, 26, '#'); f1.put(77, 23, 'E'); f1.put(77, 24, 'E')

# offices from Eric across to Charles / Yeunie use cubicle-style partitions
# (the boardroom walls and the thick kitchen wall stay solid)
for y in range(4, 23):
    for x in range(51, 73):
        if (x == 61 and y <= 16) or (y == 16 and x < 61):
            continue
        if f1.g[y][x] == '#':
            f1.g[y][x] = '='
        elif f1.g[y][x] == 'D':
            f1.g[y][x] = ','

# --- centre cluster ---
for x in (81, 87, 92, 98):
    f1.vline(x, 15, 26)
f1.hline(81, 98, 15); f1.hline(81, 98, 20); f1.hline(81, 98, 26)
f1.office('170 First Aid Station', 82, 16, 86, 19, 'N', plant=False)
f1.office('186 Ansys Station', 88, 16, 91, 19, 'N')
f1.room('D&P Closet', 93, 16, 97, 19)
f1.fill(93, 19, 97, 19, 'b')
f1.door((83, 15), (84, 15), (89, 15), (90, 15), (94, 15), (95, 15))
f1.office('135 Maya W', 82, 21, 86, 25, 'S')
f1.office('185 Nicholas', 88, 21, 91, 25, 'S')
f1.office('190 Raymond', 93, 21, 97, 25, 'S')
f1.door((84, 26), (85, 26), (89, 26), (90, 26), (94, 26), (95, 26))

# --- east washrooms + stairs ---
f1.vline(101, 14, 37)
f1.hline(101, 107, 14); f1.hline(101, 107, 19); f1.hline(101, 107, 23)
f1.room("Boys' Bathroom", 102, 15, 106, 18, ':'); f1.rooms[-1]['gender'] = 'male'
f1.door((101, 16), (101, 17)); f1.put(106, 17, 'w'); f1.put(103, 15, 'n')
f1.room("Girls' Bathroom", 102, 20, 106, 22, ':'); f1.rooms[-1]['gender'] = 'female'
f1.door((101, 20), (101, 21)); f1.put(106, 21, 'w'); f1.put(103, 20, 'n')
f1.room('East Stairwell', 102, 24, 106, 37, ',')
f1.door((101, 25), (101, 26), (101, 27))
f1.fill(104, 30, 106, 33, 'S')
f1.exit((102, 38), (103, 38))

# --- south offices ---
f1.vline(32, 19, 27); f1.vline(32, 29, 37)
f1.hline(32, 55, 29); f1.hline(60, 101, 30)
for x in (40, 48):
    f1.vline(x, 29, 37)
f1.vline(55, 25, 37); f1.vline(60, 25, 37); f1.hline(55, 60, 25)
for x in (66, 73, 80, 88, 95):
    f1.vline(x, 30, 37)
f1.office('120 Howard', 33, 30, 39, 37, 'N'); f1.door((38, 29), (39, 29))
f1.office('115 Nathan', 41, 30, 47, 37, 'N'); f1.door((41, 29), (42, 29))
f1.put(43, 36, 'o')  # Nathan sits on an exercise ball
f1.office('157 Sidney', 49, 30, 54, 37, 'N'); f1.door((49, 29), (50, 29))
f1.room('Electrical Room', 56, 26, 59, 37); f1.door((60, 26), (60, 27))
# storage space above Sidney's office, opening on its left side
f1.hline(51, 55, 25); f1.vline(51, 25, 28)
f1.room('Storage', 52, 26, 54, 28); f1.door((51, 27))
f1.fill(52, 26, 54, 26, 'g'); f1.fill(54, 27, 54, 28, 'g')  # snack shelves
f1.fill(56, 37, 59, 37, 'M'); f1.fill(56, 26, 57, 26, 'b')
for y in (29, 31, 33, 35):
    f1.put(56, y, 'K')                          # electrical panels down the left wall
f1.office('149 Troy', 61, 31, 65, 37, 'N'); f1.door((61, 30), (62, 30))
f1.office('163 Eugene', 67, 31, 72, 37, 'N'); f1.door((67, 30), (68, 30))
f1.office('108 Damir', 74, 31, 79, 37, 'N'); f1.door((74, 30), (75, 30))
f1.rooms[-1].update(dark=True, say='"The lights are off. Perfect!"')
f1.office('107 Derek', 81, 31, 87, 37, 'N'); f1.door((81, 30), (82, 30))
f1.office('160 Tho', 89, 31, 94, 37, 'N'); f1.door((90, 30), (91, 30))
f1.office('121 Mike H.', 96, 31, 100, 37, 'N'); f1.door((96, 30), (97, 30))

# --- Jhonna ---
f1.vline(38, 20, 26); f1.vline(46, 20, 26); f1.hline(38, 46, 20); f1.hline(38, 46, 26)
f1.office('118 Jhonna', 39, 21, 45, 25, 'S'); f1.door((44, 26), (45, 26))

# copy room between the west stairwell and Jhonna: supply cupboards on the
# left, printers and copiers on the right, open at the top and bottom
f1.hline(33, 34, 19)
f1.room('Copy Room', 33, 20, 37, 25, ',')
f1.hline(33, 35, 26)  # bottom wall lines up with Jhonna's office
f1.put(37, 20, '#'); f1.put(37, 26, '#')
f1.fill(33, 20, 33, 25, 'U')
for y, ch in zip(range(21, 26), 'xYxYx'):
    f1.put(37, y, ch)

# --- meeting room + west stairwell ---
f1.vline(20, 19, 26); f1.vline(26, 19, 27); f1.hline(20, 26, 19); f1.hline(20, 26, 26)
f1.room('166 Meeting Room', 21, 20, 25, 25, '_'); f1.door((20, 21), (20, 22))  # opening on the left wall
f1.fill(22, 22, 24, 23, 'T')
f1.put(23, 21, 'c'); f1.put(23, 24, 'c'); f1.put(25, 20, 'p')
f1.hline(26, 32, 19); f1.hline(26, 32, 27)
f1.room('West Stairwell', 27, 20, 31, 26, ',')
f1.fill(27, 21, 28, 25, 'S'); f1.door((30, 27), (31, 27))

# --- reception / lobby ---
f1.rooms.append({'name': '101 Reception', 'x1': 19, 'y1': 28, 'x2': 31, 'y2': 37,
                 'person': 'Kiki', 'area': [20, 28, 25, 31]})  # Kiki paces behind the desk
f1.fill(21, 32, 26, 32, 'r'); f1.fill(26, 28, 26, 31, 'r'); f1.put(26, 28, 'R')  # desk runs up to the wall, PC on top
f1.fill(31, 33, 31, 35, 'Z')  # candy table on the right wall
f1.put(23, 31, 'c')
f1.put(25, 37, 'p'); f1.put(30, 37, 'p'); f1.put(19, 37, 'p')
f1.exit((26, 38), (27, 38), (28, 38), (29, 38))
f1.put(23, 37, '$')  # Employee of the Month easel (appears once Linda's list is done)

# --- west offices ---
f1.vline(9, 16, 37); f1.hline(2, 9, 26)
f1.office('152 Max', 3, 17, 8, 25, 'E'); f1.door((9, 24), (9, 25))
f1.office('104 Jack', 3, 27, 8, 37, 'E'); f1.door((9, 28), (9, 29))
f1.hline(9, 18, 29); f1.vline(18, 29, 37)
f1.room('154 / 105', 10, 30, 17, 37)
f1.door((10, 29), (11, 29))
f1.put(12, 36, 'm'); f1.put(13, 36, 'd'); f1.put(12, 35, 'c')
f1.put(15, 36, 'm'); f1.put(16, 36, 'd'); f1.put(15, 35, 'c'); f1.put(17, 30, 'p')

# open office pod (103 / 151 / 155 / 184)
f1.rooms.append({'name': 'Open Office', 'x1': 10, 'y1': 17, 'x2': 19, 'y2': 28})
f1.fill(12, 20, 15, 23, '.')
f1.fill(13, 20, 14, 23, '=')
f1.put(12, 20, 'm'); f1.put(12, 22, 'd'); f1.put(15, 20, 'm'); f1.put(15, 22, 'd')
f1.put(11, 20, 'c'); f1.put(11, 22, 'c'); f1.put(16, 20, 'c'); f1.put(16, 22, 'c')
# the plan only gives numbers for these four desks
for name, x1, y1, x2, y2 in (('Cubicle 103', 10, 19, 11, 20), ('Cubicle 155', 10, 22, 11, 23),
                             ('Cubicle 151', 16, 19, 17, 20), ('Cubicle 184', 16, 22, 17, 23)):
    f1.rooms.append({'name': name, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'parent': 'Open Office'})
f1.put(10, 17, 'p')

# =====================================================================
# SECOND FLOOR
# =====================================================================
f2 = Floor('Second Floor')
f2.fill(1, 4, 105, 35, ',')
f2.hline(0, 106, 3); f2.hline(0, 106, 36); f2.vline(0, 3, 36); f2.vline(106, 3, 36)

# --- north-west ---
f2.vline(7, 3, 10); f2.hline(0, 7, 10)
f2.office('130 Davisson', 1, 4, 6, 9, 'E'); f2.door((7, 9))
# Davisson's room is a mess of computer parts and boxes
for row, line in enumerate(('HddmHB',   # L-shaped desk: along the top, then down
                            'BjcdJB',
                            'Hj.d.j',
                            'BJjd.B',
                            'Hj.dj.',
                            'BBj.j.')):
    for col, ch in enumerate(line):
        f2.put(1 + col, 4 + row, ch)
f2.room('Server Room', 8, 4, 18, 7)
f2.hline(7, 19, 8); f2.vline(19, 3, 8); f2.door((15, 8), (16, 8))
for x in range(9, 18):
    f2.put(x, 4, 'zzyzzyzzy'[x - 9])   # server racks and computer racks
for x in range(9, 14):
    f2.put(x, 6, 'yzzyz'[x - 9])
f2.vline(23, 3, 8)
f2.rooms.append({'name': 'Exit Stairs', 'x1': 20, 'y1': 4, 'x2': 22, 'y2': 7})
f2.exit((21, 3), (22, 3))
f2.room('Photocopier', 24, 4, 30, 7)
f2.hline(23, 31, 8); f2.vline(31, 3, 9); f2.door((24, 8), (25, 8))
f2.put(27, 4, 'x'); f2.put(28, 4, 'x'); f2.put(30, 4, 'b'); f2.put(24, 4, 'b')
f2.room('193 Engraver', 32, 4, 35, 8)
f2.hline(31, 36, 9); f2.vline(36, 3, 9); f2.door((31, 5))
f2.put(33, 4, 's'); f2.put(34, 4, 'M'); f2.put(35, 8, 'b')
f2.office('Haunted Office', 37, 4, 44, 8, 'S')
f2.rooms[-1]['people'] = ['Linda']  # Linda's ghost haunts the Haunted Office
f2.clear((40, 5)); f2.fill(37, 4, 44, 4, 'y')  # racks of computers along the top
f2.hline(36, 45, 9); f2.vline(45, 3, 10); f2.door((43, 9), (44, 9))

# --- north offices ---
f2.hline(45, 72, 10)
for x in (51, 57, 63):
    f2.vline(x, 3, 10)
f2.vline(72, 3, 11)
f2.office('162 Michael Tam', 46, 4, 50, 9, 'S'); f2.door((46, 10), (47, 10))
f2.office('161 Lauren', 52, 4, 56, 9, 'S'); f2.door((52, 10), (53, 10))
f2.office('159 Gigi', 58, 4, 62, 9, 'S'); f2.door((61, 10), (62, 10))
f2.office('146 Joe', 64, 4, 71, 9, 'S'); f2.door((64, 10), (65, 10))
f2.hline(72, 106, 11)
for x in (80, 89, 97):
    f2.vline(x, 3, 11)
f2.office('191 Mauro / Alyssa', 73, 4, 79, 10, 'S'); f2.door((78, 11), (79, 11))
f2.put(77, 4, 'm'); f2.put(78, 4, 'd'); f2.put(77, 5, 'c')  # second desk
f2.office('116 JP', 81, 4, 88, 10, 'S'); f2.door((81, 11), (82, 11))
f2.office('117 James', 90, 4, 96, 10, 'S'); f2.door((90, 11), (91, 11))
f2.office('171 Reagan / Patrick', 98, 4, 105, 10, 'S'); f2.door((98, 11), (99, 11))
f2.rooms[-1].update(rave=True)
f2.put(103, 4, 'd'); f2.put(102, 4, 'm'); f2.put(102, 5, 'c')

# --- west ---
f2.vline(7, 10, 19); f2.hline(0, 7, 19)
f2.office('129 Rob', 1, 11, 6, 18, 'E'); f2.door((7, 11), (7, 12))
f2.clear((2, 11), (3, 11), (2, 12))
f2.l_desk([(x, 13) for x in range(1, 5)] + [(1, y) for y in range(14, 18)], (2, 13), (2, 14))
f2.vline(7, 19, 27); f2.hline(0, 10, 27)
f2.office('110 Warren', 1, 20, 6, 26, 'E'); f2.door((7, 25), (7, 26))
f2.clear((2, 20), (3, 20), (2, 21))
f2.l_desk([(6, y) for y in range(21, 25)] + [(x, 24) for x in range(3, 6)], (5, 24), (5, 23))
f2.vline(10, 27, 35)
f2.office('125 Bob', 1, 28, 9, 35, 'E'); f2.door((10, 28), (10, 29))
f2.fill(4, 28, 6, 28, 'd'); f2.fill(6, 29, 6, 33, 'd')  # Bob's L-shaped desk

# open pod (Jordan / Jimmy / Kyle / Maya J / Tainah / Diane)
f2.rooms.append({'name': 'Open Office', 'x1': 8, 'y1': 9, 'x2': 24, 'y2': 26})
f2.fill(11, 11, 19, 24, '.')
f2.vline(15, 12, 24, '=')
for y in (15, 19, 24):
    f2.hline(11, 19, y, '=')
for (y1, y2), left, right in (((12, 14), '111 Jordan', '138 Jimmy'),
                               ((16, 18), '180 Kyle', '127 Maya J'),
                               ((20, 23), '124 Tainah', '158 Diane')):
    for name, x1, x2 in ((left, 11, 14), (right, 16, 19)):
        f2.rooms.append({'name': name, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'parent': 'Open Office'})
# L-shaped desks running along the centre partition
f2.l_desk([(x, 12) for x in range(11, 15)] + [(14, 13), (14, 14)], (14, 12), (13, 13))  # Jordan
f2.l_desk([(16, 12), (16, 13)] + [(x, 14) for x in range(16, 20)], (16, 14), (17, 13))  # Jimmy
f2.l_desk([(x, 16) for x in range(11, 15)] + [(14, 17), (14, 18)], (14, 16), (13, 17))  # Kyle
f2.l_desk([(x, 16) for x in range(16, 20)] + [(16, 17), (16, 18)], (16, 16), (17, 17))  # Maya J
f2.l_desk([(14, y) for y in range(20, 23)] + [(x, 23) for x in range(11, 15)], (14, 23), (13, 22))  # Tainah
f2.l_desk([(16, y) for y in range(20, 23)] + [(x, 23) for x in range(16, 20)], (16, 23), (17, 22))  # Diane
f2.vline(22, 12, 16, '=')

# washroom / Walker / Hudson
f2.room("Boys' Bathroom", 27, 9, 29, 11, ':'); f2.rooms[-1]['gender'] = 'male'
f2.room("Girls' Bathroom", 27, 13, 29, 15, ':'); f2.rooms[-1]['gender'] = 'female'
f2.vline(26, 8, 16); f2.hline(26, 30, 12); f2.hline(26, 36, 16)
f2.door((26, 10), (26, 11), (26, 14), (26, 15))
f2.put(29, 9, 'w'); f2.put(29, 11, 'n')
f2.put(29, 13, 'n'); f2.put(29, 15, 'w')
f2.vline(30, 9, 16)
f2.office('154 Walker', 31, 10, 35, 15, 'S'); f2.door((34, 16), (35, 16))
f2.clear((32, 10), (33, 10), (32, 11))
f2.l_desk([(x, 14) for x in range(31, 35)], (32, 14), (32, 13))
f2.vline(36, 9, 16); f2.vline(42, 9, 16); f2.hline(36, 42, 16)
f2.office('178 Hudson', 37, 10, 41, 15, 'E'); f2.door((42, 14), (42, 15))
f2.fill(39, 11, 39, 13, 'd')  # desk turns down the room

# Jenn + west stairwell + electrical / Zin / Jules
f2.hline(19, 25, 26)
f2.rooms.append({'name': '140 Jenn', 'x1': 20, 'y1': 20, 'x2': 24, 'y2': 25})
f2.fill(20, 20, 24, 25, '.')
f2.put(22, 25, 'm'); f2.put(23, 25, 'd'); f2.put(22, 24, 'c'); f2.put(24, 20, 'p')
f2.hline(25, 30, 19); f2.vline(25, 19, 26); f2.vline(30, 19, 26)
f2.room('West Stairwell', 26, 20, 29, 25, ',')
f2.fill(26, 20, 28, 22, 'S')
f2.fill(26, 26, 27, 26, 'l')  # railing across part of the stairwell opening
f2.hline(30, 42, 19); f2.hline(30, 42, 26)
for x in (33, 37, 42):
    f2.vline(x, 19, 26)
f2.room('Electrical', 31, 20, 32, 25); f2.door((32, 19)); f2.fill(31, 25, 32, 25, 'M')
f2.fill(31, 21, 31, 23, 'K')  # electrical panels
f2.office('126 Zin', 34, 20, 36, 25, 'N'); f2.door((35, 19))
f2.fill(36, 22, 36, 25, 'd')  # L-shaped desk up the right wall
f2.put(34, 25, 'd'); f2.put(35, 25, 'm')  # computer in the middle of the desk, clear of the chair
f2.rooms[-1]['computer'] = 'poker'
f2.office('133 Jules', 38, 20, 41, 25, 'N'); f2.door((39, 19), (40, 19))
f2.fill(38, 22, 38, 25, 'd'); f2.put(39, 25, 'd'); f2.put(38, 25, 'm')  # L-shaped desk up the left wall

# centre pod (Dalia / Avery / Marcus / Muhammad)
f2.rooms.append({'name': 'Open Office', 'x1': 43, 'y1': 14, 'x2': 63, 'y2': 26})
f2.fill(47, 14, 58, 25, '.')
f2.vline(53, 14, 25, '=')
for y in (14, 20, 25):
    f2.hline(47, 58, y, '=')
f2.vline(47, 14, 25, '='); f2.vline(58, 14, 25, '=')
for gx in (49, 50, 55, 56):  # openings on the top and bottom
    f2.put(gx, 14, '.'); f2.put(gx, 25, '.')
for (y1, y2), left, right in (((15, 19), '187 Dalia', '139 Avery'),
                               ((21, 24), '166 Marcus', '141 Muhammad')):
    f2.cubicle(left, 48, y1, 52, y2, 'E')
    f2.cubicle(right, 54, y1, 57, y2, 'W')

# Daphne / Nik
f2.hline(64, 72, 14); f2.hline(64, 72, 20); f2.hline(64, 72, 26)
f2.vline(64, 14, 26); f2.vline(72, 14, 26)
f2.office('113 Daphne', 65, 15, 71, 19, 'W'); f2.door((64, 17), (64, 18))
f2.office('106 Nik', 65, 21, 71, 25, 'W'); f2.door((64, 21), (64, 22))

# washroom + elevator
f2.room('Washroom', 73, 15, 76, 20, ':')
f2.hline(72, 77, 14); f2.vline(77, 14, 21); f2.hline(72, 77, 21); f2.door((74, 14), (75, 14))
f2.put(76, 15, 'w'); f2.put(73, 19, 'n')
f2.fill(73, 22, 77, 26, '#'); f2.put(77, 23, 'E'); f2.put(77, 24, 'E')

# east pod (Cody / John / Dmitriy / Leo / Leon / Romano)
f2.rooms.append({'name': 'Open Office', 'x1': 78, 'y1': 12, 'x2': 100, 'y2': 28})
f2.fill(81, 15, 97, 25, '.')
f2.vline(80, 15, 25, '=')
for y in (15, 20, 25):
    f2.hline(81, 97, y, '=')
for x in (86, 91, 97):
    f2.vline(x, 15, 25, '=')
for gx in (83, 89, 94):
    f2.put(gx, 15, '.'); f2.put(gx, 25, '.')
for (x1, x2), top, bottom in (((81, 85), '142 Cody', '167 Leo'),
                               ((87, 90), '174 John', '177 Leon'),
                               ((92, 96), '173 Dmitriy', '129 Romano')):
    f2.put(x1, 16, 'm'); f2.put(x1 + 1, 16, 'd'); f2.put(x1, 17, 'c')
    f2.put(x1, 24, 'm'); f2.put(x1 + 1, 24, 'd'); f2.put(x1, 23, 'c')
    f2.rooms.append({'name': top, 'x1': x1, 'y1': 16, 'x2': x2, 'y2': 19, 'parent': 'Open Office'})
    f2.rooms.append({'name': bottom, 'x1': x1, 'y1': 21, 'x2': x2, 'y2': 24, 'parent': 'Open Office'})
next(r for r in f2.rooms if r['name'] == '142 Cody')['computer'] = 'blackjack'

# east washrooms + stairs
f2.vline(101, 13, 29)
f2.hline(101, 106, 13); f2.hline(101, 106, 18); f2.hline(101, 106, 22)
f2.room("Boys' Bathroom", 102, 14, 105, 17, ':'); f2.rooms[-1]['gender'] = 'male'
f2.door((101, 15), (101, 16)); f2.put(105, 14, 'w'); f2.put(102, 14, 'n')
f2.room("Girls' Bathroom", 102, 19, 105, 21, ':'); f2.rooms[-1]['gender'] = 'female'
f2.door((101, 19), (101, 20)); f2.put(105, 20, 'w'); f2.put(102, 19, 'n')
f2.room('East Stairwell', 102, 23, 105, 28, ',')
f2.door((101, 25), (101, 26))
f2.fill(104, 24, 105, 27, 'S')

# south offices
f2.hline(18, 105, 29)
for x in (18, 27, 36, 45, 55, 64, 72, 79, 88, 96):
    f2.vline(x, 29, 36)
f2.rooms.append({'name': 'Open Office', 'x1': 11, 'y1': 28, 'x2': 17, 'y2': 35})
f2.fill(12, 33, 15, 35, '.')
# a desk runs along the meeting room wall, with two computers
f2.fill(17, 30, 17, 35, 'd'); f2.put(17, 31, 'm'); f2.put(17, 34, 'm')
f2.put(16, 32, 'c'); f2.put(11, 35, 'p')
f2.room('179 Meeting Room', 19, 30, 26, 35, '_'); f2.door((25, 29), (26, 29))
f2.fill(21, 32, 24, 33, 'T')
for x in (21, 23):
    f2.put(x, 31, 'c'); f2.put(x + 1, 34, 'c')
f2.put(19, 35, 'p'); f2.fill(19, 31, 19, 34, 'Q')  # TV on the left wall
f2.office('148 Mike Friesen', 28, 30, 35, 35, 'N'); f2.door((34, 29), (35, 29))
f2.office('147 STEPHEN', 37, 30, 44, 35, 'N'); f2.door((43, 29), (44, 29))
f2.office('145 Dave', 46, 30, 54, 35, 'N'); f2.door((46, 29), (47, 29))
f2.office('144 Desirae', 56, 30, 63, 35, 'N'); f2.door((56, 29), (57, 29))
f2.office('137 Wade', 65, 30, 71, 35, 'N'); f2.door((65, 29), (66, 29))
f2.fill(65, 31, 66, 35, 'i')  # Wade's putting green
f2.office('182 Visitor', 73, 30, 78, 35, 'N'); f2.door((73, 29), (74, 29))
f2.office('119 Kim', 80, 30, 87, 35, 'N'); f2.door((80, 29), (81, 29))
f2.office('143 Matthew', 89, 30, 95, 35, 'N'); f2.door((89, 29), (90, 29))
f2.office('122 Richard', 97, 30, 105, 35, 'N'); f2.door((97, 29), (98, 29))



# ---------------------------------------------------------------------
# Second-floor desk layouts (traced from the reference sketches)
# ---------------------------------------------------------------------
def col(x, y1, y2):
    return [(x, y) for y in range(y1, y2 + 1)]

def row(y, x1, x2):
    return [(x, y) for x in range(x1, x2 + 1)]

# south offices: desks run along the bottom wall and turn up the room
f2.l_desk(col(28, 31, 35) + row(35, 28, 33), (31, 35), (31, 34))        # Mike Friesen
f2.l_desk(col(37, 31, 35) + row(35, 37, 42), (40, 35), (40, 34))        # Stephen
f2.l_desk(col(49, 31, 35) + row(35, 49, 53), (49, 35), (50, 34))        # Dave
f2.l_desk(col(58, 31, 35) + row(35, 58, 62), (59, 35), (59, 34))        # Desirae
f2.l_desk(col(67, 31, 35) + row(35, 67, 70), (67, 35), (68, 34))        # Wade
f2.l_desk(col(78, 31, 35) + row(35, 75, 78), (75, 35), (75, 34))        # Visitor
f2.l_desk(col(82, 31, 35) + row(35, 82, 86), (83, 35), (83, 34))        # Kim
f2.l_desk(col(95, 31, 35) + row(35, 91, 95), (91, 35), (91, 34))        # Matthew
f2.clear((100, 35), (101, 35), (100, 34))
f2.l_desk(row(32, 99, 105), (101, 32), (101, 33))                        # Richard

# north offices
f2.clear((47, 4), (48, 4), (47, 5))
f2.l_desk(col(50, 5, 8) + row(8, 48, 49), (50, 8), (49, 7))             # Michael Tam
f2.clear((53, 4), (54, 4), (53, 5))
f2.l_desk(col(56, 5, 8) + row(8, 54, 55), (56, 8), (55, 7))             # Lauren
f2.clear((59, 4), (60, 4), (59, 5))
f2.l_desk(col(58, 6, 9) + row(9, 59, 60), (58, 9), (59, 8))             # Gigi
f2.clear((67, 4), (68, 4), (67, 5))
f2.fill(66, 7, 71, 8, 'd'); f2.put(68, 7, 'm'); f2.put(68, 6, 'c')      # Joe
f2.put(66, 7, '%'); f2.put(71, 7, '%'); f2.put(69, 8, '%')            # ...with his Lego on it
f2.fill(64, 4, 64, 6, '&')                                              # Joe's Lego shelf
f2.clear((77, 5))
f2.l_desk(row(4, 73, 78) + col(77, 5, 9), (75, 4), (75, 5))             # Mauro / Alyssa
f2.put(77, 7, 'm'); f2.put(76, 7, 'c')
f2.clear((84, 4), (85, 4), (84, 5))
f2.l_desk(col(83, 6, 9) + row(9, 84, 88), (83, 9), (84, 8))             # JP
f2.clear((92, 4), (93, 4), (92, 5))
f2.l_desk(col(92, 6, 10) + row(10, 93, 96), (92, 10), (93, 9))          # James
f2.l_desk(row(4, 101, 105) + col(105, 5, 9), (101, 4), (101, 5))       # Reagan / Patrick
f2.put(102, 4, 'm')
f2.l_desk(col(98, 5, 9), (98, 7), (99, 7))

# Daphne / Nik
f2.l_desk(row(15, 66, 70), (69, 15), (69, 16))                           # Daphne
f2.clear((69, 21), (70, 21), (69, 22))
f2.l_desk(col(67, 23, 25), (67, 24), (68, 24))                           # Nik

# centre pod
f2.l_desk(col(52, 16, 19) + row(19, 48, 51), (52, 16), (51, 16))        # Dalia
f2.l_desk(col(54, 16, 19) + row(19, 55, 57), (54, 16), (55, 16))        # Avery
f2.l_desk(row(21, 48, 52) + col(52, 22, 24), (52, 21), (51, 22))        # Marcus
f2.l_desk(col(54, 21, 24) + row(21, 55, 57), (54, 21), (55, 22))        # Muhammad

# east pod
f2.clear((82, 16), (88, 16), (92, 16), (93, 16), (92, 17),
         (82, 24), (87, 24), (88, 24), (87, 23), (92, 24), (93, 24), (92, 23))
f2.l_desk(col(81, 16, 19) + row(19, 82, 85), (81, 16), (82, 17))        # Cody
f2.l_desk(col(87, 16, 19) + row(19, 88, 90), (87, 16), (88, 17))        # John
f2.l_desk(col(96, 16, 19) + row(19, 92, 95), (96, 19), (95, 18))        # Dmitriy
f2.l_desk(row(21, 81, 85) + col(81, 22, 24), (81, 24), (82, 23))        # Leo
f2.l_desk(row(21, 87, 90) + col(90, 22, 24), (90, 21), (89, 22))        # Leon
f2.l_desk(row(21, 92, 96) + col(96, 22, 24), (96, 21), (95, 22))        # Romano


# ---------------------------------------------------------------------
# Ground-floor desk layouts (traced from the reference sketches)
# ---------------------------------------------------------------------
# south offices
f1.clear((35, 37), (36, 37), (35, 36))
f1.l_desk(row(30, 34, 37) + col(37, 31, 33), (37, 30), (36, 31))       # Howard
f1.clear((43, 37), (44, 37), (43, 36))
f1.l_desk(row(31, 43, 47) + col(47, 32, 35), (47, 31), (46, 32))       # Nathan
f1.put(46, 32, 'o')                                                     # ...on his exercise ball
f1.fill(44, 30, 47, 30, 't')                                            # Nathan's trophy shelves
f1.l_desk(col(49, 32, 37) + row(37, 50, 53), (51, 37), (51, 36))       # Sidney
f1.clear((62, 37), (63, 37), (62, 36), (65, 37))
f1.l_desk(col(65, 33, 37), (65, 35), (64, 35))                          # Troy
f1.l_desk(col(67, 33, 37) + row(37, 68, 70), (69, 37), (69, 36))       # Eugene
f1.clear((76, 37), (77, 37), (76, 36))
f1.l_desk(row(33, 74, 77) + col(74, 34, 37), (74, 33), (75, 34))       # Damir
f1.clear((83, 36))
f1.l_desk(col(83, 32, 36) + row(37, 83, 87), (83, 37), (84, 36))       # Derek
f1.l_desk(col(94, 33, 37) + row(37, 92, 93), (91, 37), (91, 36))       # Tho
f1.put(92, 37, 'd')
f1.clear((97, 37), (98, 37), (97, 36))
f1.l_desk(col(100, 32, 37), (100, 34), (99, 34))                        # Mike H.

# Jhonna
f1.l_desk(row(21, 40, 43) + col(43, 22, 24), (41, 21), (41, 22))

# cubicle-walled offices
f1.l_desk(row(17, 52, 55) + col(55, 18, 21), (53, 17), (53, 18))       # Eric
f1.l_desk(row(17, 57, 60) + col(60, 18, 21), (58, 17), (58, 18))       # Carlos
f1.clear((62, 12))
f1.l_desk(col(62, 11, 15) + row(15, 63, 64), (62, 11), (63, 12))       # Lam
f1.put(63, 11, 'd')
f1.clear((62, 18))
f1.l_desk(col(62, 17, 21) + row(21, 63, 64), (62, 17), (63, 18))       # Lia
f1.put(63, 17, 'd')
f1.l_desk(col(72, 11, 15) + row(15, 69, 71), (70, 11), (70, 12))       # Charles
f1.l_desk(col(72, 17, 21) + row(21, 69, 71), (70, 17), (70, 18))       # Yeunie
f1.clear((63, 4), (64, 4), (63, 5))
f1.l_desk(col(62, 6, 9) + row(9, 63, 65), (62, 9), (63, 8))            # Jonathan
f1.l_desk(row(4, 69, 72) + col(72, 5, 8), (69, 4), (69, 5))            # Sharon

# first aid station: curtain across the doorway, stretcher instead of a desk
f1.put(83, 15, 'C'); f1.put(84, 15, 'C')
f1.clear((83, 19), (84, 19), (83, 18))
f1.fill(83, 19, 85, 19, 'u')
next(r for r in f1.rooms if r['name'] == '170 First Aid Station')['curtain'] = True

# the centre cluster (first aid, Ansys, D&P closet, Maya W, Nicholas, Raymond)
# uses cubicle-style partitions instead of solid walls
for y in range(15, 27):
    for x in range(81, 99):
        if f1.g[y][x] == '#':
            f1.g[y][x] = '='
        elif f1.g[y][x] == 'D':
            f1.g[y][x] = ','

# centre cluster, bottom row
f1.l_desk(row(21, 82, 85) + col(82, 22, 25), (83, 21), (83, 22))       # Maya W
f1.l_desk(row(21, 88, 91) + col(91, 22, 25), (89, 21), (89, 22))       # Nicholas
f1.l_desk(row(21, 94, 97) + col(97, 22, 25), (94, 21), (94, 22))       # Raymond

# =====================================================================
# Links between floors: stepping on an S tile (or using an E tile) in a
# group warps to the other floor's arrival spot for the same group.
# =====================================================================
links = {
    'west': [
        {'floor': 0, 'x1': 27, 'y1': 21, 'x2': 28, 'y2': 25, 'arrive': [29, 23, 'right']},
        {'floor': 1, 'x1': 26, 'y1': 20, 'x2': 28, 'y2': 22, 'arrive': [27, 23, 'down']},
    ],
    'east': [
        {'floor': 0, 'x1': 104, 'y1': 30, 'x2': 106, 'y2': 33, 'arrive': [103, 31, 'left']},
        {'floor': 1, 'x1': 104, 'y1': 24, 'x2': 105, 'y2': 27, 'arrive': [103, 25, 'left']},
    ],
    'elevator': [
        {'floor': 0, 'x1': 77, 'y1': 23, 'x2': 77, 'y2': 24, 'arrive': [78, 24, 'right']},
        {'floor': 1, 'x1': 77, 'y1': 23, 'x2': 77, 'y2': 24, 'arrive': [78, 24, 'right']},
    ],
}

# Make sure floor layer exists under every object / door tile.
for f in (f1, f2):
    for y in range(H):
        for x in range(W):
            if f.fl[y][x] == ' ' and f.g[y][x] not in '# X':
                f.fl[y][x] = ','

data = {'floors': [f1.out(), f2.out()], 'links': links, 'start': {'floor': 0, 'x': 27, 'y': 36, 'dir': 'up'}}

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'js', 'maps.js')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as fh:
    fh.write('// Generated by tools/build_maps.py -- edit that file, not this one.\n')
    fh.write('window.OFFICE_MAPS = ' + json.dumps(data, indent=1) + ';\n')

if __name__ == '__main__':
    for f in (f1, f2):
        print(f.name)
        for i, r in enumerate(f.g):
            print(f'{i:2d} ' + ''.join(r))
