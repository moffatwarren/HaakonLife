// Chess between two players, on the lunch room table (ChessGame in js/game.js draws it). The rules
// are js/chess.js, the same ones the browser plays against a coworker. See table.js for how it's run.
import { tableGame } from './table.js';

export const { hz, load, create, input, tick, view } = tableGame('chess.js', 'CHESS');
