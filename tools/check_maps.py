#!/usr/bin/env python3
"""Flood-fills js/maps.js from the start point (following stairs + elevator)
and reports any walkable tiles or named rooms that can't be reached."""
import json, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'js', 'maps.js')).read()
d = json.loads(src[src.index('{'):src.rindex('}') + 1])
WALK = '.,:_DSj'


def warp(f, x, y):
    for ends in d['links'].values():
        if any(e['floor'] == f and e['x1'] <= x <= e['x2'] and e['y1'] <= y <= e['y2'] for e in ends):
            return [(o['floor'], o['arrive'][0], o['arrive'][1]) for o in ends if o['floor'] != f]
    return []


st = d['start']
seen, q = set(), [(st['floor'], st['x'], st['y'])]
while q:
    f, x, y = q.pop()
    if (f, x, y) in seen:
        continue
    seen.add((f, x, y))
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
