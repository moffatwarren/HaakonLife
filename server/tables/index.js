// The kinds of table the server keeps, by the key a browser names them with (see tables.js).
import * as poker from './poker.js';
import * as hockey from './hockey.js';
import * as race from './race.js';

export default { poker, hockey1: hockey.one, hockey2: hockey.two, hockey3: hockey.three, race };
