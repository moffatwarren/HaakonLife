// The status page at /status: how many connections are open, who's behind them, and how many
// problems browsers have reported. It has people's names on it, so it asks for a password,
// with the browser's own password box. With no password set on the server it stays locked.
import { createHash, timingSafeEqual } from 'node:crypto';

// wrong passwords a minute before the page stops checking, so nobody can sit there guessing
const WRONG_PER_MIN = 10;

const sha = (s) => createHash('sha256').update(s).digest();

export function statusDesk(password, worlds, problems, now = Date.now) {
  let minute = 0, wrong = 0;
  // Comparing hashes keeps both sides the same length, as timingSafeEqual needs. The browser
  // sends "name:password" and any name will do.
  const right = (sent) => {
    const said = Buffer.from(sent, 'base64').toString();
    return timingSafeEqual(sha(said.slice(said.indexOf(':') + 1)), sha(password));
  };
  const page = () => {
    const lines = ['ok ' + Object.entries(worlds).map(([n, w]) => n + ':' + w.online()).join(' ') + ' problems:' + problems.count];
    for (const [n, w] of Object.entries(worlds)) {
      const { active, inactive } = w.connections();
      lines.push('', n + ' active:' + active.length, ...active.map((s) => '  ' + s), n + ' inactive:' + inactive.length, ...inactive.map((s) => '  ' + s));
    }
    return lines.join('\n');
  };
  return {
    take(req, res) {
      const answer = (code, text, headers = {}) => {
        res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...headers });
        res.end(text + '\n');
      };
      if (!password) { answer(403, 'The status page is locked until the server has a STATUS_PASSWORD.'); return; }
      const m = Math.floor(now() / 60000);
      if (m !== minute) { minute = m; wrong = 0; }
      if (wrong >= WRONG_PER_MIN) { answer(429, 'Too many wrong passwords. Try again in a minute.'); return; }
      const sent = /^Basic (.+)$/i.exec(req.headers.authorization || '');
      if (sent && right(sent[1])) { answer(200, page()); return; }
      if (sent) wrong++; // (asking with no password at all is just the browser's first try)
      answer(401, 'This page needs the password.', { 'www-authenticate': 'Basic realm="Haakon Life status", charset="UTF-8"' });
    },
  };
}
