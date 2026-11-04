// Every card in the card game, one to a line. Change anything you like here, except an id: saves
// point at those, so never rename or remove one, or use it again for something else. The words on a
// card are written from what's here (CARDS.text in js/cards.js), so they can't disagree with it.
//
//   id        lower case letters and numbers, 14 at most
//   name      16 letters at most
//   rarity    S starter, C common, U uncommon, R rare, L legendary, T only ever brought in by
//             another card (never in a deck)
//   dept      plant (big and tough), sales (fast), office (clever) or lunch (together). Leave it out
//             for something that goes in any deck. It's a way of playing, not anybody's job.
//   kind      'task' if it happens once and then it's gone. Otherwise it's a worker.
//   cost      coffee to play it
//   power, patience   a worker's two numbers
//   words     gate (Gatekeeper), keen (Keen), skin (Thick Skin)
//   does      what it does. Each one is:
//     when    play (the usual), morning (the start of each of your turns) or last (as it goes home)
//     team    only if you already have a worker from this department on the table (Team-up)
//     do      hit, heal, draw, coffee, boost (with p for Power and h for Patience, which can be
//             minus), summon (with id, the card to bring in), home, back, freeze or give (with word)
//     n       how much
//     who     Pick one when it's played:  worker (anyone's), enemy, ally (another of yours), any
//             (a worker or a player). A card can only ask for one of these, and a last word or
//             morning can't ask at all.
//             Or it just happens to:  self, enemies, others (your other workers), allies (all
//             yours), all (everyone on the table), them (the other player), you, random (a random
//             enemy worker). others and allies can have dept, to mean just that department's.
//   said      something they say. Only ever something they already say in the game, unless it's been
//             checked with the person.
window.CARD_LIST = [
  // ---------- brought in by other cards ----------
  { id: 'doubleshot', name: 'Double Shot', rarity: 'T', kind: 'task', cost: 0, does: [{ do: 'coffee', n: 1 }] },
  { id: 'legobrick', name: 'Lego Brick', rarity: 'T', cost: 1, power: 1, patience: 1, words: ['gate'] },
  { id: 'leftovers', name: 'Leftovers', plural: 'Leftovers', rarity: 'T', cost: 1, power: 2, patience: 1 },

  // ---------- the starter deck: everybody has these from the start ----------
  { id: 'student', name: 'Summer Student', rarity: 'S', cost: 1, power: 1, patience: 2, said: 'Just happy to be here.' },
  { id: 'coop', name: 'Co-op Student', rarity: 'S', cost: 1, power: 2, patience: 1 },
  { id: 'temp', name: 'Temp', rarity: 'S', cost: 1, power: 1, patience: 1, words: ['keen'] },
  { id: 'newhire', name: 'New Hire', rarity: 'S', cost: 2, power: 2, patience: 3 },
  { id: 'receptionist', name: 'Receptionist', rarity: 'S', cost: 2, power: 1, patience: 3, words: ['gate'] },
  { id: 'courier', name: 'Courier', rarity: 'S', cost: 2, power: 2, patience: 1, words: ['keen'] },
  { id: 'apprentice', name: 'Apprentice', rarity: 'S', cost: 2, power: 2, patience: 2, does: [{ when: 'last', do: 'heal', n: 2, who: 'you' }] },
  { id: 'assembler', name: 'Assembler', rarity: 'S', cost: 3, power: 3, patience: 3 },
  { id: 'bookkeeper', name: 'Bookkeeper', rarity: 'S', cost: 3, power: 2, patience: 2, does: [{ do: 'draw', n: 1 }] },
  { id: 'safety', name: 'Safety Officer', rarity: 'S', cost: 3, power: 2, patience: 4, words: ['gate'] },
  { id: 'salesrep', name: 'Sales Rep', rarity: 'S', cost: 3, power: 3, patience: 2, does: [{ do: 'hit', n: 1, who: 'them' }] },
  { id: 'foreman', name: 'Foreman', rarity: 'S', cost: 4, power: 4, patience: 4 },
  { id: 'estimator', name: 'Estimator', rarity: 'S', cost: 4, power: 3, patience: 3, does: [{ do: 'hit', n: 1, who: 'any' }] },
  { id: 'maintenance', name: 'Maintenance', rarity: 'S', cost: 4, power: 2, patience: 5, does: [{ do: 'heal', n: 3, who: 'ally' }] },
  { id: 'nightshift', name: 'Night Shift', rarity: 'S', cost: 5, power: 5, patience: 5 },
  { id: 'driver', name: 'Delivery Driver', rarity: 'S', cost: 5, power: 4, patience: 3, words: ['keen'] },
  { id: 'closer', name: 'Closer', rarity: 'S', cost: 6, power: 6, patience: 6 },
  { id: 'coffeerun', name: 'Coffee Run', rarity: 'S', kind: 'task', cost: 1, does: [{ do: 'coffee', n: 2 }] },
  { id: 'angryemail', name: 'Angry Email', rarity: 'S', kind: 'task', cost: 2, does: [{ do: 'hit', n: 3, who: 'worker' }] },
  { id: 'longlunch', name: 'Long Lunch', rarity: 'S', kind: 'task', cost: 2, does: [{ do: 'heal', n: 4, who: 'you' }] },

  // ---------- Plant: big and tough ----------
  { id: 'markv', name: 'Mark V.', dept: 'plant', rarity: 'C', cost: 2, power: 3, patience: 2, said: 'My hands are rivet guns now.' },
  { id: 'steve', name: 'Steve', dept: 'plant', rarity: 'C', cost: 3, power: 1, patience: 5, words: ['gate'], said: 'Safety glasses on!' },
  { id: 'justin', name: 'Justin', dept: 'plant', rarity: 'C', cost: 3, power: 3, patience: 4, said: 'I just can\'t find it.' },
  { id: 'graham', name: 'Graham', dept: 'plant', rarity: 'U', cost: 4, power: 3, patience: 5, does: [{ team: 'plant', do: 'boost', p: 2, who: 'self' }], said: 'Try to keep up.' },
  { id: 'brian', name: 'Brian', dept: 'plant', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ when: 'morning', do: 'heal', n: 1, who: 'allies' }] },
  { id: 'jillian', name: 'Jillian', dept: 'plant', rarity: 'C', cost: 5, power: 5, patience: 6, said: 'The coil disagrees.' },
  { id: 'kylebullock', name: 'Kyle B.', dept: 'plant', rarity: 'U', cost: 5, power: 2, patience: 8, words: ['gate'], said: 'My walls don\'t sag.' },
  { id: 'miked', name: 'Mike D.', dept: 'plant', rarity: 'C', cost: 6, power: 6, patience: 7, said: 'Normal Tuesday.' },
  { id: 'bigcoil', name: 'The Big Coil', dept: 'plant', rarity: 'R', cost: 5, power: 1, patience: 9, words: ['gate'] },
  { id: 'crane', name: 'Overhead Crane', dept: 'plant', rarity: 'R', cost: 7, power: 5, patience: 7, does: [{ do: 'hit', n: 3, who: 'enemy' }] },
  { id: 'forklift', name: 'Forklift', dept: 'plant', rarity: 'L', cost: 7, power: 6, patience: 6, words: ['keen'], does: [{ do: 'back', who: 'enemy' }] },

  // ---------- Sales: fast, and straight at the other player ----------
  { id: 'mauro', name: 'Mauro', dept: 'sales', rarity: 'C', cost: 1, power: 2, patience: 1, said: 'I\'m young and Italian!' },
  { id: 'patrick', name: 'Patrick', dept: 'sales', rarity: 'C', cost: 2, power: 3, patience: 1, words: ['keen'], said: 'Let\'s get a workout in!' },
  { id: 'tho', name: 'Tho', dept: 'sales', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ team: 'sales', do: 'hit', n: 2, who: 'them' }], said: 'Go Leafs Go!!!' },
  { id: 'wade', name: 'Wade', dept: 'sales', rarity: 'C', cost: 3, power: 2, patience: 2, does: [{ do: 'hit', n: 2, who: 'them' }] },
  { id: 'ali', name: 'Ali', dept: 'sales', rarity: 'U', cost: 3, power: 3, patience: 2, words: ['keen'], said: 'You look like a C to me.' },
  { id: 'ryan', name: 'Ryan', dept: 'sales', rarity: 'U', cost: 4, power: 3, patience: 2, words: ['keen'], does: [{ do: 'hit', n: 1, who: 'them' }] },
  { id: 'garrett', name: 'Garrett', dept: 'sales', rarity: 'C', cost: 4, power: 3, patience: 3, words: ['keen'], said: 'Do you want to move to Asheville?' },
  { id: 'desirae', name: 'Desirae', dept: 'sales', rarity: 'U', cost: 5, power: 5, patience: 3, words: ['keen'] },
  { id: 'roadtrip', name: 'Road Trip', dept: 'sales', rarity: 'R', kind: 'task', cost: 3, does: [{ do: 'hit', n: 3, who: 'them' }] },
  { id: 'truck', name: 'Company Truck', dept: 'sales', rarity: 'L', cost: 6, power: 4, patience: 5, words: ['keen'], does: [{ do: 'hit', n: 3, who: 'them' }] },

  // ---------- Office: clever ----------
  { id: 'davisson', name: 'Davisson', dept: 'office', rarity: 'C', cost: 2, power: 1, patience: 1, does: [{ do: 'draw', n: 1 }], said: 'Everything perfectly organised.' },
  { id: 'leo', name: 'Leo', dept: 'office', rarity: 'C', cost: 2, power: 2, patience: 2, words: ['skin'], said: 'Don\'t click on any links.' },
  { id: 'jhonna', name: 'Jhonna', dept: 'office', rarity: 'C', cost: 3, power: 2, patience: 4, words: ['gate'] },
  { id: 'stephen', name: 'Stephen', dept: 'office', rarity: 'U', cost: 3, power: 3, patience: 3, does: [{ do: 'freeze', who: 'enemy' }], said: 'EMAILS ARE MUCH EASIER TO READ' },
  { id: 'tainah', name: 'Tainah', dept: 'office', rarity: 'C', cost: 3, power: 3, patience: 3, does: [{ team: 'office', do: 'draw', n: 1 }] },
  { id: 'richard', name: 'Richard', dept: 'office', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'draw', n: 1 }], said: 'Test your air handling knowledge?' },
  { id: 'nathan', name: 'Nathan', dept: 'office', rarity: 'U', cost: 5, power: 5, patience: 5, words: ['skin'], said: 'Have you seen all of my trophies?' },
  { id: 'paperjam', name: 'Paper Jam', dept: 'office', rarity: 'U', kind: 'task', cost: 2, does: [{ do: 'back', who: 'enemy' }] },
  { id: 'budget', name: 'Budget Meeting', dept: 'office', rarity: 'R', kind: 'task', cost: 3, does: [{ do: 'freeze', who: 'enemies' }] },
  { id: 'reorg', name: 'Reorg', dept: 'office', rarity: 'R', kind: 'task', cost: 4, does: [{ do: 'home', who: 'enemy' }] },
  { id: 'printer', name: 'The Printer', dept: 'office', rarity: 'L', cost: 4, power: 2, patience: 6, does: [{ when: 'morning', do: 'freeze', who: 'random' }] },

  // ---------- Lunch Room: together ----------
  { id: 'matthew', name: 'Matthew', dept: 'lunch', rarity: 'C', cost: 1, power: 1, patience: 1, does: [{ do: 'coffee', n: 1 }], said: 'This is my third coffee.' },
  { id: 'kiki', name: 'Kiki', dept: 'lunch', rarity: 'C', cost: 2, power: 2, patience: 3, does: [{ do: 'heal', n: 2, who: 'ally' }], said: 'Help yourself to some candy.' },
  { id: 'dmitriy', name: 'Dmitriy', dept: 'lunch', rarity: 'C', cost: 3, power: 3, patience: 2, does: [{ do: 'hit', n: 2, who: 'worker' }], said: 'I ran the line, not him.' },
  { id: 'jenn', name: 'Jenn', dept: 'lunch', rarity: 'C', cost: 3, power: 3, patience: 3, does: [{ do: 'heal', n: 3, who: 'you' }], said: 'Baking is where it\'s really at.' },
  { id: 'joe', name: 'Joe', dept: 'lunch', rarity: 'U', cost: 3, power: 2, patience: 3, does: [{ do: 'summon', id: 'legobrick', n: 1 }], said: 'Have you seen my Lego shelf?' },
  { id: 'chris', name: 'Chris', dept: 'lunch', rarity: 'C', cost: 4, power: 4, patience: 4, does: [{ team: 'lunch', do: 'boost', h: 1, who: 'others' }] },
  { id: 'lam', name: 'Lam', dept: 'lunch', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'boost', p: 1, who: 'others' }] },
  { id: 'nik', name: 'Nik', dept: 'lunch', rarity: 'U', cost: 4, power: 3, patience: 5, does: [{ when: 'morning', do: 'heal', n: 1, who: 'you' }], said: 'I taught him all he knows.' },
  { id: 'potluck', name: 'Potluck', dept: 'lunch', rarity: 'U', kind: 'task', cost: 3, does: [{ do: 'summon', id: 'leftovers', n: 2 }] },
  { id: 'pizza', name: 'Pizza Friday', dept: 'lunch', rarity: 'R', kind: 'task', cost: 4, does: [{ do: 'heal', n: 2, who: 'allies' }, { do: 'boost', p: 1, who: 'allies' }] },
  { id: 'felix', name: 'Felix', dept: 'lunch', rarity: 'R', cost: 3, power: 0, patience: 7, words: ['gate'], said: 'Meow... yawn... zzzz' },
  { id: 'officedog', name: 'Office Dog', dept: 'lunch', rarity: 'L', cost: 5, power: 3, patience: 6, words: ['skin'], does: [{ when: 'morning', do: 'draw', n: 1 }] },

  // ---------- for any deck ----------
  { id: 'coffeemachine', name: 'Coffee Machine', rarity: 'R', cost: 2, power: 0, patience: 4, does: [{ when: 'morning', do: 'coffee', n: 1 }] },
  { id: 'firedrill', name: 'Fire Drill', rarity: 'R', kind: 'task', cost: 5, does: [{ do: 'home', who: 'all' }], said: 'Leave your coffee.' },
  { id: 'humbug', name: 'Humbug', rarity: 'L', cost: 6, power: 4, patience: 4, does: [{ do: 'boost', p: -2, who: 'enemies' }] },
  { id: 'linda', name: 'Linda', rarity: 'L', cost: 5, power: 4, patience: 5, words: ['skin'], does: [{ when: 'last', do: 'back', who: 'self' }], said: 'Boooooo...' },
];
