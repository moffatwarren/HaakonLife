#!/bin/bash
# Screenshot the game headlessly, for checking a mini-game without a desktop.
#
#   tools/shot.sh out.png "play&game=battle&ticks=60"
#
# The hash query is the usual #play testing shortcut (see README), plus `rand=0.4`
# to pin Math.random so a game's choices are repeatable. The first paint is racy
# under headless Firefox, so this retries until the canvas actually has pixels.
set -u
out=${1:?usage: shot.sh out.png "play&game=..."}
q=${2:-play}
here=$(cd "$(dirname "$0")" && pwd)
for i in 1 2 3 4 5 6; do
  timeout 90 firefox --headless --window-size=960,720 --screenshot "$out" \
    "file://$here/test.html#$q" >/dev/null 2>&1
  if python3 - "$out" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
canvas = im.crop((161, 105, 799, 581))   # the 320x240 screen, scaled up in the shell
sys.exit(0 if len(canvas.getcolors(maxcolors=100000) or []) > 1 else 1)
PY
  then echo "painted (attempt $i)"; exit 0; fi
done
echo "never painted after 6 attempts" >&2; exit 1
