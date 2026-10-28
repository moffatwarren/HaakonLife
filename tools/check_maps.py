#!/usr/bin/env python3
"""Flood-fills js/maps.js from the start point (following stairs + elevator) and
from where you wake up in the Kingston plant (walking into Cody's cubicle takes you
into his casino), and reports any walkable tiles or named rooms that can't be reached."""
import json, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'js', 'maps.js')).read()
d = json.loads(src[src.index('{'):src.rindex('}') + 1])
WALK = '.,:_;DSjC-'  # curtains can be opened


def warp(f, x, y):
    for ends in d['links'].values():
        if any(e['floor'] == f and e['x1'] <= x <= e['x2'] and e['y1'] <= y <= e['y2'] for e in ends):
            return [(o['floor'], o['arrive'][0], o['arrive'][1]) for o in ends if o['floor'] != f]
    return []


def room_at(f, x, y):
    """The smallest room at (x, y), as the game picks it (a cubicle inside its open office)."""
    rooms = [r for r in d['floors'][f]['rooms'] if r['x1'] <= x <= r['x2'] and r['y1'] <= y <= r['y2']]
    return min(rooms, key=lambda r: (r['x2'] - r['x1'] + 1) * (r['y2'] - r['y1'] + 1))['name'] if rooms else None


# the casino's map lines up with the floor it opens off, so you keep your x and y
casino = next(((i, f['casino']) for i, f in enumerate(d['floors']) if 'casino' in f), None)


def swap(f, x, y):
    if not casino:
        return []
    ci, c = casino
    if f == c['floor'] and room_at(f, x, y) == c['room']:
        return [(ci, x, y)]
    if f == ci and not room_at(f, x, y):
        return [(c['floor'], x, y)]
    return []


seen, q = set(), [(p['floor'], p['x'], p['y']) for p in (d['start'], d['plant'])]
while q:
    f, x, y = q.pop()
    if (f, x, y) in seen:
        continue
    seen.add((f, x, y))
    q += swap(f, x, y)
    t = d['floors'][f]['tiles']
    if t[y][x] == 'S':
        q += warp(f, x, y)
        continue
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c = t[y + dy][x + dx]
        if c in WALK:
            q.append((f, x + dx, y + dy))
        elif c == 'E':
            q += warp(f, x + dx, y + dy)

ok = True
for fi, fl in enumerate(d['floors']):
    t = fl['tiles']
    # stair tiles past the first step are expected to be unreachable
    bad = [(x, y) for y, r in enumerate(t) for x, c in enumerate(r)
           if c in WALK and c != 'S' and (fi, x, y) not in seen]
    print(f"{fl['name']}: {len(bad)} unreachable tiles {bad[:20]}")
    for r in fl['rooms']:
        cells = [(x, y) for y in range(r['y1'], r['y2'] + 1) for x in range(r['x1'], r['x2'] + 1)]
        if not any((fi, x, y) in seen for x, y in cells):
            print('  unreachable room:', r['name'])
            ok = False
    ok = ok and not bad
print('OK' if ok else 'PROBLEMS FOUND')
