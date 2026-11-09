// Every card in the card game, one to a line. Change anything you like here, except an id: saves
// point at those, so never rename or remove one, or use it again for something else. The words on a
// card are written from what's here (CARDS.text in js/cards.js), so they can't disagree with it.
//
//   id        lower case letters and numbers, 14 at most
//   name      16 letters at most
//   rarity    S starter, C common, U uncommon, R rare, L legendary, T only ever brought in by
//             another card (never in a deck)
//   dept      where they really work, which is also how the card tends to play: plant (everybody at a
//             plant, whatever their job: big and tough), sales (fast), office (clever) or engineering
//             (designers, programmers and R&D: keeps everything running). Leave it out for something
//             that goes in any deck.
//   own, style  this is one version of your own legendary (see below), and what it says on its ribbon
//   heldBy    who you win it from, if it isn't their own card: the coworker plays it against you, and
//             beating them once they've given up their own card (if they have one) makes it yours.
//             Without this, a card is won by beating the coworker with the same name.
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
  { id: 'springroll', name: 'Spring Roll', plural: 'Spring Rolls', rarity: 'T', cost: 1, power: 1, patience: 1, words: ['keen'] },

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

  // ---------- Plant: everybody at a plant. Big and tough ----------
  { id: 'markl', name: 'Mark L.', dept: 'plant', rarity: 'C', cost: 1, power: 2, patience: 2, said: 'Coils, dampers, drain pans.' },
  { id: 'markv', name: 'Mark V.', dept: 'plant', rarity: 'C', cost: 2, power: 3, patience: 2, said: 'My hands are rivet guns now.' },
  { id: 'samantha', name: 'Samantha', dept: 'plant', rarity: 'C', cost: 2, power: 2, patience: 4, words: ['gate'], said: 'Please sign in.' },
  { id: 'ashley', name: 'Ashley', dept: 'plant', rarity: 'C', cost: 2, power: 2, patience: 3, does: [{ when: 'last', do: 'draw', n: 1 }], said: 'And I asked nicely.' },
  { id: 'amelia', name: 'Amelia', dept: 'plant', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ do: 'freeze', who: 'enemy' }], said: 'And a few more after those.' },
  { id: 'steve', name: 'Steve', dept: 'plant', rarity: 'C', cost: 3, power: 1, patience: 5, words: ['gate'], said: 'Safety glasses on!' },
  { id: 'justin', name: 'Justin', dept: 'plant', rarity: 'C', cost: 3, power: 3, patience: 4, said: 'I just can\'t find it.' },
  { id: 'johnk', name: 'John K.', dept: 'plant', rarity: 'C', cost: 3, power: 2, patience: 5, said: 'Every unit starts on one of my bases.' },
  { id: 'jay', name: 'Jay', dept: 'plant', rarity: 'C', cost: 3, power: 2, patience: 2, words: ['keen'], said: 'If it isn\'t on the truck by three, it ships Monday.' },
  { id: 'fleur', name: 'Fleur', dept: 'plant', rarity: 'C', cost: 3, power: 3, patience: 3, does: [{ team: 'plant', do: 'draw', n: 1 }], said: 'If it isn\'t on the BOM, it doesn\'t exist.' },
  { id: 'courtney', name: 'Courtney', dept: 'plant', rarity: 'C', cost: 3, power: 2, patience: 4, does: [{ do: 'heal', n: 3, who: 'ally' }], said: 'HR is here to help.' },
  { id: 'stephanie', name: 'Stephanie', dept: 'plant', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'boost', p: 1, h: 1, who: 'ally' }] },
  { id: 'nick', name: 'Nick', dept: 'plant', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'boost', p: 2, who: 'ally' }], said: 'Emphasis on the finishing.' },
  { id: 'ali', name: 'Ali', dept: 'plant', rarity: 'U', cost: 3, power: 3, patience: 3, does: [{ do: 'boost', p: -1, who: 'enemy' }], said: 'You look like a C to me.' },
  { id: 'graham', name: 'Graham', dept: 'plant', rarity: 'U', cost: 4, power: 3, patience: 5, does: [{ team: 'plant', do: 'boost', p: 2, who: 'self' }], said: 'Try to keep up.' },
  { id: 'brian', name: 'Brian', dept: 'plant', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ when: 'morning', do: 'heal', n: 1, who: 'allies' }] },
  { id: 'josh', name: 'Josh', dept: 'plant', rarity: 'C', cost: 4, power: 4, patience: 5, said: 'Sheet metal is just origami with more cuts.' },
  { id: 'ryan', name: 'Ryan', dept: 'plant', rarity: 'C', cost: 4, power: 4, patience: 4, does: [{ team: 'plant', do: 'boost', p: 1, h: 1, who: 'self' }] },
  { id: 'caleb', name: 'Caleb', dept: 'plant', rarity: 'C', cost: 4, power: 2, patience: 6, words: ['gate'], said: 'No sticker, no ship.' },
  { id: 'scott', name: 'Scott', dept: 'plant', rarity: 'C', cost: 4, power: 3, patience: 4, does: [{ do: 'hit', n: 2, who: 'enemy' }], said: 'Or the green ones.' },
  { id: 'garrett', name: 'Garrett', dept: 'plant', rarity: 'C', cost: 4, power: 3, patience: 5, does: [{ do: 'boost', h: 1, who: 'others' }], said: 'Do you want to move to Asheville?' },
  { id: 'mikeb', name: 'Mike B.', dept: 'plant', rarity: 'U', cost: 4, power: 4, patience: 3, words: ['keen'], said: 'Keep it moving!' },
  { id: 'william', name: 'William', dept: 'plant', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'give', word: 'skin', who: 'ally' }], said: 'Don\'t tell anyone about revision C.' },
  { id: 'cedric', name: 'Cedric', dept: 'plant', rarity: 'U', cost: 4, power: 2, patience: 3, does: [{ do: 'back', who: 'enemy' }], said: 'Off and on again?' },
  { id: 'jillian', name: 'Jillian', dept: 'plant', rarity: 'C', cost: 5, power: 5, patience: 6, said: 'The coil disagrees.' },
  { id: 'kylebullock', name: 'Kyle B.', dept: 'plant', rarity: 'U', cost: 5, power: 2, patience: 8, words: ['gate'], said: 'My walls don\'t sag.' },
  { id: 'alex', name: 'Alex', dept: 'plant', rarity: 'U', cost: 5, power: 4, patience: 6, does: [{ team: 'plant', do: 'draw', n: 1 }], said: 'Six units ship Friday.' },
  { id: 'desirae', name: 'Desirae', dept: 'plant', rarity: 'U', cost: 5, power: 4, patience: 5, does: [{ do: 'boost', p: 1, who: 'others', dept: 'plant' }] },
  { id: 'miked', name: 'Mike D.', dept: 'plant', rarity: 'C', cost: 6, power: 6, patience: 7, said: 'Normal Tuesday.' },
  { id: 'bigcoil', name: 'The Big Coil', dept: 'plant', rarity: 'R', heldBy: 'Jillian', cost: 5, power: 1, patience: 9, words: ['gate'] },
  { id: 'crane', name: 'Overhead Crane', dept: 'plant', rarity: 'R', heldBy: 'Graham', cost: 7, power: 5, patience: 7, does: [{ do: 'hit', n: 3, who: 'enemy' }] },
  { id: 'forklift', name: 'Forklift', dept: 'plant', rarity: 'L', heldBy: 'Mike D.', cost: 7, power: 7, patience: 7, words: ['keen'], does: [{ do: 'back', who: 'enemy' }] },

  // ---------- Sales: fast, and straight at the other player ----------
  { id: 'mikeh', name: 'Mike H.', dept: 'sales', rarity: 'C', cost: 1, power: 2, patience: 1 },
  { id: 'howard', name: 'Howard', dept: 'sales', rarity: 'C', cost: 2, power: 3, patience: 1, words: ['keen'] },
  { id: 'tho', name: 'Tho', dept: 'sales', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ team: 'sales', do: 'hit', n: 2, who: 'them' }], said: 'Go Leafs Go!!!' },
  { id: 'wade', name: 'Wade', dept: 'sales', rarity: 'C', cost: 3, power: 2, patience: 2, does: [{ do: 'hit', n: 2, who: 'them' }] },
  { id: 'jp', name: 'JP', dept: 'sales', rarity: 'C', cost: 3, power: 3, patience: 2, words: ['keen'] },
  { id: 'stephen', name: 'STEPHEN', dept: 'sales', rarity: 'U', cost: 3, power: 3, patience: 3, does: [{ do: 'freeze', who: 'enemy' }], said: 'EMAILS ARE MUCH EASIER TO READ' },
  { id: 'mikefriesen', name: 'Mike Friesen', dept: 'sales', rarity: 'U', cost: 4, power: 3, patience: 3, words: ['keen'], does: [{ do: 'boost', p: 1, who: 'others', dept: 'sales' }], said: 'Yes' },
  { id: 'coldcall', name: 'Cold Call', dept: 'sales', rarity: 'U', heldBy: 'Mike H.', kind: 'task', cost: 2, does: [{ do: 'hit', n: 1, who: 'them' }, { do: 'draw', n: 1 }] },
  { id: 'clientlunch', name: 'Client Lunch', dept: 'sales', rarity: 'U', heldBy: 'Tho', kind: 'task', cost: 3, does: [{ do: 'hit', n: 2, who: 'them' }, { do: 'heal', n: 2, who: 'you' }] },
  { id: 'tradeshow', name: 'Trade Show', dept: 'sales', rarity: 'U', heldBy: 'JP', kind: 'task', cost: 4, does: [{ do: 'hit', n: 1, who: 'them' }, { do: 'draw', n: 2 }] },
  { id: 'roadtrip', name: 'Road Trip', dept: 'sales', rarity: 'R', heldBy: 'Wade', kind: 'task', cost: 3, does: [{ do: 'hit', n: 3, who: 'them' }] },
  { id: 'bigorder', name: 'The Big Order', dept: 'sales', rarity: 'R', heldBy: 'Howard', kind: 'task', cost: 6, does: [{ do: 'hit', n: 5, who: 'them' }] },
  { id: 'demounit', name: 'Demo Unit', dept: 'sales', rarity: 'R', heldBy: 'Mike Friesen', cost: 3, power: 0, patience: 5, does: [{ when: 'morning', do: 'hit', n: 1, who: 'them' }] },
  { id: 'truck', name: 'Company Truck', dept: 'sales', rarity: 'L', heldBy: 'Mauro', cost: 5, power: 4, patience: 5, words: ['keen'], does: [{ do: 'hit', n: 3, who: 'them' }] },

  // ---------- Office: clever ----------
  { id: 'davisson', name: 'Davisson', dept: 'office', rarity: 'C', cost: 2, power: 1, patience: 1, does: [{ do: 'draw', n: 1 }], said: 'Everything perfectly organised.' },
  { id: 'kiki', name: 'Kiki', dept: 'office', rarity: 'C', cost: 2, power: 2, patience: 3, does: [{ do: 'heal', n: 2, who: 'ally' }], said: 'Help yourself to some candy.' },
  { id: 'alyssa', name: 'Alyssa', dept: 'office', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ do: 'boost', p: -1, who: 'enemy' }], said: 'Did Mauro steal my youth?' },
  { id: 'john', name: 'John', dept: 'office', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ when: 'last', do: 'draw', n: 1 }], said: 'I\'ll sneak some cokes on the way out.' },
  { id: 'diane', name: 'Diane', dept: 'office', rarity: 'C', cost: 2, power: 1, patience: 4, words: ['gate'] },
  { id: 'leon', name: 'Leon', dept: 'office', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ team: 'office', do: 'boost', p: 1, h: 1, who: 'self' }] },
  { id: 'jhonna', name: 'Jhonna', dept: 'office', rarity: 'C', cost: 3, power: 2, patience: 4, words: ['gate'] },
  { id: 'tainah', name: 'Tainah', dept: 'office', rarity: 'C', cost: 3, power: 3, patience: 3, does: [{ team: 'office', do: 'draw', n: 1 }] },
  { id: 'jenn', name: 'Jenn', dept: 'office', rarity: 'C', cost: 3, power: 3, patience: 3, does: [{ do: 'heal', n: 3, who: 'you' }], said: 'Baking is where it\'s really at.' },
  { id: 'mayaj', name: 'Maya J', dept: 'office', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'draw', n: 1 }] },
  { id: 'kim', name: 'Kim', dept: 'office', rarity: 'U', cost: 3, power: 2, patience: 3, does: [{ when: 'last', do: 'back', who: 'random' }] },
  { id: 'rob', name: 'Rob', dept: 'office', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'freeze', who: 'enemy' }] },
  { id: 'warren', name: 'Warren', dept: 'office', rarity: 'U', cost: 4, power: 4, patience: 3, words: ['skin'], said: 'The dumbbell rack is my legacy.' },
  { id: 'bob', name: 'Bob', dept: 'office', rarity: 'U', cost: 5, power: 3, patience: 4, does: [{ do: 'draw', n: 2 }], said: 'Have you read the Globe & Mail today?' },
  { id: 'expense', name: 'Expense Report', dept: 'office', rarity: 'U', heldBy: 'Diane', kind: 'task', cost: 2, does: [{ do: 'freeze', who: 'enemy' }] },
  { id: 'paperjam', name: 'Paper Jam', dept: 'office', rarity: 'U', heldBy: 'Tainah', kind: 'task', cost: 3, does: [{ do: 'back', who: 'enemy' }] },
  { id: 'allhands', name: 'All Hands', dept: 'office', rarity: 'U', heldBy: 'Maya J', kind: 'task', cost: 5, does: [{ do: 'draw', n: 3 }] },
  { id: 'budget', name: 'Budget Meeting', dept: 'office', rarity: 'R', heldBy: 'Rob', kind: 'task', cost: 3, does: [{ do: 'freeze', who: 'enemies' }] },
  { id: 'reorg', name: 'Reorg', dept: 'office', rarity: 'R', heldBy: 'STEPHEN', kind: 'task', cost: 4, does: [{ do: 'home', who: 'enemy' }] },
  { id: 'felix', name: 'Felix', dept: 'office', rarity: 'R', heldBy: 'Kim', cost: 4, power: 0, patience: 7, words: ['gate'], said: 'Meow... yawn... zzzz' },
  { id: 'printer', name: 'The Printer', dept: 'office', rarity: 'L', heldBy: 'Leo', cost: 3, power: 2, patience: 6, words: ['gate'], does: [{ when: 'morning', do: 'freeze', who: 'random' }] },
  { id: 'officedog', name: 'Office Dog', dept: 'office', rarity: 'L', heldBy: 'Jhonna', cost: 4, power: 3, patience: 5, words: ['skin', 'keen'], does: [{ when: 'morning', do: 'draw', n: 1 }] },

  // ---------- Engineering: designers, programmers and R&D. Keeps everything running ----------
  { id: 'matthew', name: 'Matthew', dept: 'engineering', rarity: 'C', cost: 1, power: 1, patience: 1, does: [{ do: 'coffee', n: 1 }], said: 'This is my third coffee.' },
  { id: 'mauro', name: 'Mauro', dept: 'engineering', rarity: 'C', cost: 1, power: 2, patience: 1, said: 'I\'m young and Italian!' },
  { id: 'yeunie', name: 'Yeunie', dept: 'engineering', rarity: 'C', cost: 1, power: 1, patience: 2, does: [{ team: 'engineering', do: 'boost', p: 1, who: 'self' }] },
  { id: 'patrick', name: 'Patrick', dept: 'engineering', rarity: 'C', cost: 2, power: 3, patience: 1, words: ['keen'], said: 'Let\'s get a workout in!' },
  { id: 'leo', name: 'Leo', dept: 'engineering', rarity: 'C', cost: 2, power: 2, patience: 2, words: ['skin'], said: 'Don\'t click on any links.' },
  { id: 'romano', name: 'Romano', dept: 'engineering', rarity: 'C', cost: 2, power: 3, patience: 2, said: 'Mama Mia!' },
  { id: 'cody', name: 'Cody', dept: 'engineering', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ when: 'last', do: 'summon', id: 'springroll', n: 1 }], said: 'I\'m down this week on spring rolls.' },
  { id: 'jules', name: 'Jules', dept: 'engineering', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ team: 'engineering', do: 'draw', n: 1 }] },
  { id: 'eric', name: 'Eric', dept: 'engineering', rarity: 'C', cost: 2, power: 1, patience: 4, words: ['gate'] },
  { id: 'lia', name: 'Lia', dept: 'engineering', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ do: 'heal', n: 2, who: 'ally' }] },
  { id: 'jonathan', name: 'Jonathan', dept: 'engineering', rarity: 'C', cost: 2, power: 2, patience: 2, does: [{ team: 'engineering', do: 'boost', p: 1, h: 1, who: 'self' }] },
  { id: 'dmitriy', name: 'Dmitriy', dept: 'engineering', rarity: 'C', cost: 3, power: 3, patience: 2, does: [{ do: 'hit', n: 2, who: 'worker' }], said: 'I ran the line, not him.' },
  { id: 'joe', name: 'Joe', dept: 'engineering', rarity: 'U', cost: 3, power: 2, patience: 3, does: [{ do: 'summon', id: 'legobrick', n: 1 }], said: 'Have you seen my Lego shelf?' },
  { id: 'zin', name: 'Zin', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'summon', id: 'springroll', n: 1 }], said: 'I\'ve never felt so alive!' },
  { id: 'reagan', name: 'Reagan', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'draw', n: 1 }], said: 'These lights are keeping me awake!' },
  { id: 'eugene', name: 'Eugene', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'freeze', who: 'enemy' }] },
  { id: 'hudson', name: 'Hudson', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'heal', n: 3, who: 'ally' }] },
  { id: 'carlos', name: 'Carlos', dept: 'engineering', rarity: 'C', cost: 3, power: 3, patience: 4 },
  { id: 'marcus', name: 'Marcus', dept: 'engineering', rarity: 'U', cost: 3, power: 3, patience: 3, does: [{ team: 'engineering', do: 'boost', p: 1, who: 'others', dept: 'engineering' }] },
  { id: 'charles', name: 'Charles', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 4, words: ['gate'] },
  { id: 'gigi', name: 'Gigi', dept: 'engineering', rarity: 'C', cost: 3, power: 3, patience: 3, does: [{ when: 'last', do: 'heal', n: 3, who: 'you' }] },
  { id: 'james', name: 'James', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'boost', h: 2, who: 'ally' }] },
  { id: 'walker', name: 'Walker', dept: 'engineering', rarity: 'C', cost: 3, power: 3, patience: 2, words: ['skin'] },
  { id: 'avery', name: 'Avery', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'heal', n: 1, who: 'allies' }] },
  { id: 'damir', name: 'Damir', dept: 'engineering', rarity: 'C', cost: 3, power: 3, patience: 2, does: [{ team: 'engineering', do: 'boost', h: 2, who: 'self' }] },
  { id: 'mayaw', name: 'Maya W', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 4, does: [{ team: 'engineering', do: 'boost', p: 1, who: 'self' }] },
  { id: 'dalia', name: 'Dalia', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'boost', p: 1, h: 1, who: 'ally' }] },
  { id: 'raymond', name: 'Raymond', dept: 'engineering', rarity: 'C', cost: 3, power: 4, patience: 2 },
  { id: 'muhammad', name: 'Muhammad', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'hit', n: 1, who: 'any' }] },
  { id: 'jimmy', name: 'Jimmy', dept: 'engineering', rarity: 'C', cost: 3, power: 2, patience: 3, does: [{ do: 'coffee', n: 1 }] },
  { id: 'chris', name: 'Chris', dept: 'engineering', rarity: 'C', cost: 4, power: 4, patience: 4, does: [{ team: 'engineering', do: 'boost', h: 1, who: 'others' }] },
  { id: 'lam', name: 'Lam', dept: 'engineering', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'boost', p: 1, who: 'others' }] },
  { id: 'nik', name: 'Nik', dept: 'engineering', rarity: 'U', cost: 4, power: 3, patience: 5, does: [{ when: 'morning', do: 'heal', n: 1, who: 'you' }], said: 'I taught him all he knows.' },
  { id: 'richard', name: 'Richard', dept: 'engineering', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'draw', n: 1 }], said: 'Test your air handling knowledge?' },
  { id: 'troy', name: 'Troy', dept: 'engineering', rarity: 'U', cost: 4, power: 3, patience: 3, does: [{ do: 'hit', n: 1, who: 'enemies' }] },
  { id: 'dave', name: 'Dave', dept: 'engineering', rarity: 'U', cost: 4, power: 2, patience: 4, does: [{ when: 'morning', do: 'boost', p: 1, who: 'self' }] },
  { id: 'sidney', name: 'Sidney', dept: 'engineering', rarity: 'U', cost: 4, power: 2, patience: 5, does: [{ do: 'boost', h: 1, who: 'others' }] },
  { id: 'lauren', name: 'Lauren', dept: 'engineering', rarity: 'U', cost: 4, power: 3, patience: 4, does: [{ do: 'heal', n: 2, who: 'allies' }] },
  { id: 'jordan', name: 'Jordan', dept: 'engineering', rarity: 'C', cost: 4, power: 4, patience: 5 },
  { id: 'daphne', name: 'Daphne', dept: 'engineering', rarity: 'C', cost: 4, power: 3, patience: 5, words: ['gate'] },
  { id: 'nicholas', name: 'Nicholas', dept: 'engineering', rarity: 'U', cost: 4, power: 4, patience: 3, does: [{ team: 'engineering', do: 'hit', n: 2, who: 'random' }] },
  { id: 'kyle', name: 'Kyle', dept: 'engineering', rarity: 'C', cost: 4, power: 3, patience: 4, does: [{ when: 'last', do: 'boost', p: 1, who: 'allies' }] },
  { id: 'sharon', name: 'Sharon', dept: 'engineering', rarity: 'C', cost: 4, power: 3, patience: 4, does: [{ do: 'heal', n: 3, who: 'you' }] },
  { id: 'nathan', name: 'Nathan', dept: 'engineering', rarity: 'U', cost: 5, power: 5, patience: 5, words: ['skin'], said: 'Have you seen all of my trophies?' },
  { id: 'michaeltam', name: 'Michael Tam', dept: 'engineering', rarity: 'U', cost: 5, power: 4, patience: 5, does: [{ do: 'draw', n: 1 }] },
  { id: 'derek', name: 'Derek', dept: 'engineering', rarity: 'C', cost: 5, power: 3, patience: 7, words: ['gate'] },
  { id: 'firstaid', name: 'First Aid Kit', dept: 'engineering', rarity: 'U', heldBy: 'Hudson', kind: 'task', cost: 1, does: [{ do: 'heal', n: 4, who: 'ally' }] },
  { id: 'roofcurb', name: 'Roof Curb', dept: 'engineering', rarity: 'U', heldBy: 'Charles', cost: 2, power: 0, patience: 6, words: ['gate'] },
  { id: 'revisiond', name: 'Revision D', dept: 'engineering', rarity: 'U', heldBy: 'William', kind: 'task', cost: 2, does: [{ do: 'boost', p: 2, h: 2, who: 'ally' }] },
  { id: 'heatwheel', name: 'Heat Wheel', dept: 'engineering', rarity: 'R', heldBy: 'Troy', cost: 3, power: 1, patience: 5, does: [{ when: 'morning', do: 'hit', n: 1, who: 'random' }] },
  { id: 'airhandler', name: 'The Air Handler', dept: 'engineering', rarity: 'L', heldBy: 'Dmitriy', cost: 5, power: 3, patience: 6, does: [{ do: 'boost', p: 2, h: 1, who: 'others' }] },

  // ---------- for any deck ----------
  { id: 'sneakycoke', name: 'Sneaky Coke', rarity: 'U', heldBy: 'John', kind: 'task', cost: 0, does: [{ do: 'coffee', n: 1 }] },
  { id: 'morningpaper', name: 'Morning Paper', rarity: 'U', heldBy: 'Bob', kind: 'task', cost: 1, does: [{ do: 'draw', n: 1 }] },
  { id: 'dumbbells', name: 'Dumbbells', rarity: 'U', heldBy: 'Warren', kind: 'task', cost: 1, does: [{ do: 'boost', p: 2, who: 'ally' }] },
  { id: 'candyjar', name: 'Candy Jar', rarity: 'U', heldBy: 'Kiki', kind: 'task', cost: 2, does: [{ do: 'heal', n: 2, who: 'allies' }] },
  { id: 'potluck', name: 'Potluck', rarity: 'U', heldBy: 'Jenn', kind: 'task', cost: 3, does: [{ do: 'summon', id: 'leftovers', n: 2 }] },
  { id: 'coffeemachine', name: 'Coffee Machine', rarity: 'R', heldBy: 'Matthew', cost: 2, power: 0, patience: 4, does: [{ when: 'morning', do: 'coffee', n: 1 }] },
  { id: 'granfondo', name: 'Gran Fondo', rarity: 'R', heldBy: 'Desirae', kind: 'task', cost: 3, does: [{ do: 'give', word: 'keen', who: 'allies' }], said: 'Everyone else signed up.' },
  { id: 'pizza', name: 'Pizza Friday', rarity: 'R', heldBy: 'Chris', kind: 'task', cost: 4, does: [{ do: 'heal', n: 2, who: 'allies' }, { do: 'boost', p: 1, who: 'allies' }] },
  { id: 'firedrill', name: 'Fire Drill', rarity: 'R', heldBy: 'Steve', kind: 'task', cost: 5, does: [{ do: 'home', who: 'all' }], said: 'Leave your coffee.' },
  { id: 'xmasparty', name: 'Christmas Party', rarity: 'R', heldBy: 'Lam', kind: 'task', cost: 5, does: [{ do: 'boost', p: 1, h: 1, who: 'allies' }, { do: 'heal', n: 3, who: 'you' }] },
  { id: 'humbug', name: 'Humbug', rarity: 'L', heldBy: 'Brian', cost: 6, power: 4, patience: 4, does: [{ do: 'boost', p: -2, who: 'enemies' }] },
  { id: 'linda', name: 'Linda', rarity: 'L', heldBy: 'Davisson', cost: 5, power: 4, patience: 5, words: ['skin', 'keen'], does: [{ when: 'last', do: 'back', who: 'self' }], said: 'Boooooo...' },
  // Your own legendary, for winning every other card. Nobody holds these: they show your character and
  // your name, and you pick which one you play in MY CARDS. Only the game ever uses "Legend" as a name.
  { id: 'youbruiser', name: 'Legend', style: 'BRUISER', own: true, rarity: 'L', cost: 5, power: 5, patience: 4, words: ['keen'], does: [{ do: 'hit', n: 2, who: 'them' }] },
  { id: 'youwall', name: 'Legend', style: 'WALL', own: true, rarity: 'L', cost: 5, power: 3, patience: 7, words: ['gate', 'skin'] },
  { id: 'youboss', name: 'Legend', style: 'BOSS', own: true, rarity: 'L', cost: 5, power: 4, patience: 5, does: [{ do: 'home', who: 'enemy' }] },
  { id: 'youlead', name: 'Legend', style: 'TEAM LEAD', own: true, rarity: 'L', cost: 3, power: 3, patience: 5, does: [{ do: 'give', word: 'skin', who: 'others' }] },
  { id: 'youmorale', name: 'Legend', style: 'MORALE OFFICER', own: true, rarity: 'L', cost: 4, power: 3, patience: 6, does: [{ do: 'boost', p: 1, who: 'others' }, { when: 'morning', do: 'heal', n: 2, who: 'you' }] },
  { id: 'youplanner', name: 'Legend', style: 'PLANNER', own: true, rarity: 'L', cost: 2, power: 2, patience: 4, does: [{ do: 'draw', n: 2 }] },
];
