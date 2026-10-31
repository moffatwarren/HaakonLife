// The games the server runs itself, by the key a challenge names them with: the same key
// as their entry in VERSUS in js/game.js, which also needs `server: true` there. See
// rooms.js for what a game module exports.
import * as pong from './pong.js';
import * as forklift from './forklift.js';
import * as snowball from './snowball.js';

export default { pong, forklift, snowball };
