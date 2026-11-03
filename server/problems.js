// Browsers send word here when something has gone wrong in the game, so it reaches somebody:
// a POST to /problem with JSON { m: the error's message, s: where in the code it happened,
// at: what they were doing, v: which version of the game they have } (see reportProblem in
// index.html). Each one goes in the server's log on a line of its own starting "browser
// problem", with the kind of device it came from, and the health check's line says how many
// have come in since the server started. No names: it's about the bug, not who hit it.
const MAX_BODY = 8 * 1024;
const PER_MIN = 60; // how many go in the log a minute, so nobody can flood it

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

// origins: the pages allowed to send these, as for connecting (none listed allows any page)
export function problemDesk(origins = [], now = Date.now) {
  let minute = 0, heard = 0;
  const desk = {
    count: 0,
    take(req, res) {
      const answer = (code) => { res.writeHead(code); res.end(); };
      if (origins.length && !origins.includes(req.headers.origin)) { req.resume(); answer(403); return; }
      const chunks = [];
      let size = 0, over = false;
      req.on('error', () => {}); // (they hung up halfway: nothing to do)
      req.on('data', (c) => {
        if (over) return;
        size += c.length;
        if (size > MAX_BODY) { over = true; chunks.length = 0; answer(413); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (over) return;
        let d;
        try { d = JSON.parse(Buffer.concat(chunks)); } catch { answer(400); return; }
        if (!d || typeof d !== 'object' || !clip(d.m, 1)) { answer(400); return; }
        const m = Math.floor(now() / 60000);
        if (m !== minute) { minute = m; heard = 0; }
        if (++heard > PER_MIN) { answer(429); return; }
        desk.count++;
        // (JSON keeps it to one line, whatever somebody puts in it)
        console.error('browser problem ' + JSON.stringify({
          m: clip(d.m, 300), at: clip(d.at, 100), v: +d.v || 0,
          ua: clip(req.headers['user-agent'], 200), s: clip(d.s, 1500),
        }));
        answer(204);
      });
    },
  };
  return desk;
}
