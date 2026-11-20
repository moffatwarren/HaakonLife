// Chess between two players, on the lunch room table (ChessGame in js/game.js draws it). The rules
// are js/chess.js, the same ones the browser plays against a coworker. See table.js for how it's run.
import { tableGame } from './table.js';

// js/chess.js's VERSION: tools/check_games.mjs stops the site deploying until this matches, so a
// change to the rules always changes this folder too, which is what makes Render deploy the
// server again (otherwise live games would carry on with the old rules)
export const VERSION = 'jvzbrc';

export const { hz, load, create, input, tick, view } = tableGame('chess.js', 'CHESS');
