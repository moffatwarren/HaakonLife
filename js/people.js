// People who work in the office. Each person paces around their own office or
// cubicle. Edit freely:
//   body:  'male' or 'female' sprite
//   hair / skin / top / accent (tie or necklace) / pants:  colours
//   lines: what they say when you talk to them (one is picked at random).
//          Leave it empty to use the generic greetings.
//   halloween: (optional) something extra they might say at the Halloween party
//   christmas: (optional) something extra they might say if they're out in the parking
//          lot at Christmas
//   style: (optional) how they look out in the parking lot at Christmas, which is drawn
//          in a cartoon style. Anything left out is picked from their name:
//            hair:   'short', 'spiky', 'swept', 'curly', 'mullet', 'shaggy' or 'bald' (male),
//                    'long', 'ponytail', 'bob', 'bun', 'braids' or 'messy' (female)
//            hat:    'toque', 'stripes', 'leaf' (a maple leaf toque), 'trapper' or 'none'
//            beard:  'huge', 'full', 'chops', 'stache', 'goatee' or 'stubble' (or false)
//            outfit: 'flannel', 'denim', 'jersey', 'parka' or 'vest'
//          (everyone out there is the same size)
// Body types are a best guess from each name; colours are random placeholders.
// Office 182 is the visitor office: people from out of town take turns in it,
// coming and going through the portal in the corner (in a new order every time
// the game is launched). 'name' is who they show up as in the game.
//   name: { body (best guess from the name), lines (optional: what they say;
//           leave it out to use the "visiting from out of town" line) }
const VISITORS = {
  Jill: { body: 'female' },
  Alex: { body: 'male', lines: ["Have you seen Kingston's new coil storage. The nesting is top teir."] },
  Garrett: { body: 'male', lines: ["We have finally recovered from all of that flooding. Do you want to move to Asheville?"] },
  Ali: { body: 'female', lines: ["You look like a C to me with shading of D."] },
  Courtney: { body: 'female' },
  Ryan: { body: 'male', lines: ["Have you tried naming yourself Bob?"] },
};
// Everyone in VISITORS with a random look, shuffled: the first one starts in the office.
window.VISITORS = (function () {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const list = Object.keys(VISITORS).map((name) => {
    const v = VISITORS[name];
    return {
      name,
      body: v.body,
      hair: pick(['#181010', '#201818', '#5a3420', '#6a3c20', '#8a5a3a', '#d06030', '#e8c050', '#a8a8b0']),
      skin: pick(['#f8d8b8', '#f8d0a8', '#f0c098', '#d8a070', '#c08860', '#8a5838']),
      top: pick(['#e07898', '#b83028', '#40a0a0', '#58a848', '#3868c8', '#f8f8f8', '#78a8e8', '#f0b030', '#9868c8', '#808898']),
      accent: pick(['#f8e070', '#d03868', '#2c6a34', '#f0b030', '#f8f8f8', '#b83028', '#3050a8', '#283878']),
      pants: pick(['#303040', '#383848', '#484858', '#686878', '#b09870', '#3a3050']),
      lines: v.lines || ["I am visiting from out of town. I'll be here all week!"],
    };
  });
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
})();
window.PEOPLE = {
  // ---- Ground floor ----
  "Kiki": { body: 'female', hair: '#201818', skin: '#d8a070', top: '#e07898', accent: '#f8e070', pants: '#303040', lines: ["Welcome to Richmond! Help yourself to some candy."] },
  "Jonathan": { body: 'male', hair: '#181010', skin: '#8a5838', top: '#e07898', accent: '#d03868', pants: '#383848', lines: [] },
  "Sharon": { body: 'female', hair: '#5a3420', skin: '#f8d8b8', top: '#e07898', accent: '#f8e070', pants: '#303040', lines: [] },
  "Lam": { body: 'male', hair: '#8a5a3a', skin: '#8a5838', top: '#b83028', accent: '#2c6a34', pants: '#b09870', lines: ["You're in for a good time when I MC the Christmas party."] },
  "Lia": { body: 'female', hair: '#d06030', skin: '#f8d8b8', top: '#40a0a0', accent: '#f8e070', pants: '#484858', lines: [] },
  "Charles": { body: 'male', hair: '#181010', skin: '#8a5838', top: '#58a848', accent: '#f0b030', pants: '#484858', lines: [] },
  "Yeunie": { body: 'female', hair: '#5a3420', skin: '#f0c098', top: '#3868c8', accent: '#f8f8f8', pants: '#303040', lines: [] },
  "Eric": { body: 'male', hair: '#201818', skin: '#f0c098', top: '#40a0a0', accent: '#f8f8f8', pants: '#686878', lines: [] },
  "Carlos": { body: 'male', hair: '#201818', skin: '#8a5838', top: '#58a848', accent: '#f8f8f8', pants: '#383848', lines: [] },
  "Romano": { body: 'male', hair: '#6a3c20', skin: '#f8d8b8', top: '#f8f8f8', accent: '#b83028', pants: '#303040', lines: ["Did Mauro say he's more Italian than me? Mama Mia!"] },
  "Nicholas": { body: 'male', hair: '#d06030', skin: '#f8d0a8', top: '#78a8e8', accent: '#f8e070', pants: '#303040', lines: [] },
  "Marcus": { body: 'male', hair: '#8a5a3a', skin: '#d8a070', top: '#f0b030', accent: '#2c6a34', pants: '#686878', lines: [] },
  "Howard": { body: 'male', hair: '#201818', skin: '#f0c098', top: '#9868c8', accent: '#3050a8', pants: '#383848', lines: [] },
  "Nathan": { body: 'male', hair: '#8a5a3a', skin: '#f0c098', top: '#e07898', accent: '#f0b030', pants: '#3a3050', lines: ["Have you seen all of my trophies?"] },
  "Sidney": { body: 'male', hair: '#a8a8b0', skin: '#f0c098', top: '#9868c8', accent: '#2c6a34', pants: '#686878', lines: [] },
  "Troy": { body: 'male', hair: '#201818', skin: '#f8d0a8', top: '#58a848', accent: '#283878', pants: '#b09870', lines: [] },
  "Eugene": { body: 'male', hair: '#e8c050', skin: '#f8d0a8', top: '#808898', accent: '#f8f8f8', pants: '#686878', lines: [] },
  "Damir": { body: 'male', hair: '#181010', skin: '#f8d0a8', top: '#f0b030', accent: '#3050a8', pants: '#b09870', lines: [] },
  "Derek": { body: 'male', hair: '#8a5a3a', skin: '#f8d0a8', top: '#58a848', accent: '#f0b030', pants: '#3a3050', lines: [] },
  "Tho": { body: 'male', hair: '#5a3420', skin: '#f0c098', top: '#808898', accent: '#b83028', pants: '#484858', lines: ["Go Leafs Go!!!"], halloween: "Scariest thing I've seen all year? The Leafs in the playoffs." },
  "Mike H.": { body: 'male', hair: '#5a3420', skin: '#d8a070', top: '#58a848', accent: '#f8e070', pants: '#3a3050', lines: [] },
  "Jhonna": { body: 'female', hair: '#8a5a3a', skin: '#d8a070', top: '#3868c8', accent: '#2c6a34', pants: '#383848', lines: ["Make sure you have your dependant forms filled out for Manulife!"] },
  "Max": { body: 'male', hair: '#181010', skin: '#f8d0a8', top: '#40a0a0', accent: '#f8e070', pants: '#b09870', lines: [] },
  "Jack": { body: 'male', hair: '#6a3c20', skin: '#8a5838', top: '#58a848', accent: '#d03868', pants: '#484858', lines: [] },
  "Maya W": { body: 'female', hair: '#181010', skin: '#d8a070', top: '#78a8e8', accent: '#f8f8f8', pants: '#303040', lines: [] },
  // ---- Second floor ----
  "Linda": { body: 'ghost', lines: ["Boooooo...", "Ooooo... has anyone seen my stapler?", "This Haunted Office is MY office now. Boo."] },
  "Davisson": { body: 'male', hair: '#d06030', skin: '#f8d0a8', top: '#f8f8f8', accent: '#f8f8f8', pants: '#3a3050', lines: ["Everything perfectly organised."] },
  "Michael Tam": { body: 'male', hair: '#181010', skin: '#f8d8b8', top: '#40a0a0', accent: '#3050a8', pants: '#484858', lines: [] },
  "Lauren": { body: 'female', hair: '#181010', skin: '#8a5838', top: '#f0b030', accent: '#f8f8f8', pants: '#303040', lines: [] },
  "Gigi": { body: 'female', hair: '#8a5a3a', skin: '#8a5838', top: '#40a0a0', accent: '#283878', pants: '#383848', lines: ["Do you know the lyrics to 'Bohemian Rhapsody'?"] },
  "Joe": { body: 'male', hair: '#8a5a3a', skin: '#8a5838', top: '#b83028', accent: '#3050a8', pants: '#b09870', lines: ["Have you seen my Lego shelf? That spaceship took me all weekend."] },
  "Mauro": { body: 'male', hair: '#d06030', skin: '#8a5838', top: '#40a0a0', accent: '#2c6a34', pants: '#3a3050', lines: ["I'm young and Italian!"], halloween: "This costume makes me look even younger. And even more Italian." },
  "Alyssa": { body: 'female', hair: '#a8a8b0', skin: '#f8d0a8', top: '#78a8e8', accent: '#283878', pants: '#b09870', lines: ["Why do I feel so old? Did Mauro steal my youth?"] },
  "JP": { body: 'male', hair: '#d06030', skin: '#c08860', top: '#78a8e8', accent: '#2c6a34', pants: '#3a3050', lines: [] },
  "James": { body: 'male', hair: '#d06030', skin: '#f8d0a8', top: '#58a848', accent: '#283878', pants: '#686878', lines: [] },
  "Reagan": { body: 'male', hair: '#d06030', skin: '#f0c098', top: '#9868c8', accent: '#f8e070', pants: '#383848', lines: ["I was up all night waiting in line to get Pokemon cards. These lights are keeping me awake!"] },
  "Patrick": { body: 'male', hair: '#201818', skin: '#f8d0a8', top: '#e07898', accent: '#283878', pants: '#484858', lines: ["Did you get your Hyrox tickets? Let's get a workout in!"] },
  "Rob": { body: 'male', hair: '#a8a8b0', skin: '#f8d0a8', top: '#9868c8', accent: '#3050a8', pants: '#686878', lines: [] },
  "Warren": { body: 'male', hair: '#d06030', skin: '#c08860', top: '#f8f8f8', accent: '#d03868', pants: '#303040', lines: ["The dumbbell rack is my legacy."] },
  "Bob": { body: 'male', hair: '#8a5a3a', skin: '#8a5838', top: '#3868c8', accent: '#f0b030', pants: '#484858', lines: ["Have you read the Globe & Mail today?"], halloween: "There is only ONE true Bob under this costume." },
  "Walker": { body: 'male', hair: '#d06030', skin: '#c08860', top: '#40a0a0', accent: '#d03868', pants: '#686878', lines: [] },
  "Hudson": { body: 'male', hair: '#181010', skin: '#d8a070', top: '#808898', accent: '#f0b030', pants: '#686878', lines: [] },
  "Jenn": { body: 'female', hair: '#6a3c20', skin: '#f8d0a8', top: '#b83028', accent: '#2c6a34', pants: '#484858', lines: ["Sure Nik and Dmitriy can cook, but baking is where its really at."] },
  "Zin": { body: 'male', hair: '#a8a8b0', skin: '#d8a070', top: '#78a8e8', accent: '#f8f8f8', pants: '#484858', lines: ["I'm on a 5 spring roll winning streak. I've never felt so alive!"] },
  "Jules": { body: 'male', hair: '#181010', skin: '#8a5838', top: '#3868c8', accent: '#f8e070', pants: '#484858', lines: [] },
  "Daphne": { body: 'female', hair: '#a8a8b0', skin: '#8a5838', top: '#58a848', accent: '#2c6a34', pants: '#383848', lines: [] },
  "Nik": { body: 'male', hair: '#6a3c20', skin: '#f8d8b8', top: '#808898', accent: '#f8e070', pants: '#383848', lines: ["Have you met Dmitriy? He's my younger brother. I taught him all he knows about being a chef."] },
  "Leon": { body: 'male', hair: '#181010', skin: '#8a5838', top: '#808898', accent: '#2c6a34', pants: '#b09870', lines: [] },
  "Mike Friesen": { body: 'male', hair: '#a8a8b0', skin: '#f0c098', top: '#40a0a0', accent: '#d03868', pants: '#383848', lines: ["Yes"] },
  "STEPHEN": { body: 'male', hair: '#5a3420', skin: '#d8a070', top: '#40a0a0', accent: '#f8e070', pants: '#484858', lines: ["EMAILS ARE MUCH EASIER TO READ IF EVERYTHING IS ALL CAPS"], halloween: "BOO. SORRY, WAS THAT TOO LOUD?" },
  "Dave": { body: 'male', hair: '#a8a8b0', skin: '#f0c098', top: '#e07898', accent: '#f8e070', pants: '#383848', lines: ["If you see my mug, its the one with the tweety bird on it."] },
  "Desirae": { body: 'female', hair: '#181010', skin: '#f8d0a8', top: '#f8f8f8', accent: '#f0b030', pants: '#303040', lines: ["Everyone else signed up for the Gran Fondo already. Everyone. You don't want to be the only one left out, do you?"] },
  "Wade": { body: 'male', hair: '#181010', skin: '#f0c098', top: '#78a8e8', accent: '#283878', pants: '#303040', lines: [] },
  "Visitor": window.VISITORS[0],
  "Chris": { body: 'male', hair: '#5a3420', skin: '#f0c098', top: '#808898', accent: '#f0b030', pants: '#484858', lines: ["I may work in the shop but the kitchen is my territory."] },
  "Kim": { body: 'female', hair: '#201818', skin: '#8a5838', top: '#3868c8', accent: '#283878', pants: '#b09870', lines: ["What do you mean John ate all of the peanut butter cups?"] },
  "Matthew": { body: 'male', hair: '#5a3420', skin: '#f0c098', top: '#f0b030', accent: '#d03868', pants: '#b09870', lines: ["Don't tell anyone, but this is my third coffee."] },
  "Richard": { body: 'male', hair: '#201818', skin: '#c08860', top: '#b83028', accent: '#f8f8f8', pants: '#303040', lines: [] },
  "Jordan": { body: 'male', hair: '#181010', skin: '#c08860', top: '#b83028', accent: '#f0b030', pants: '#b09870', lines: [] },
  "Jimmy": { body: 'male', hair: '#181010', skin: '#d8a070', top: '#9868c8', accent: '#f8e070', pants: '#383848', lines: [] },
  "Kyle": { body: 'male', hair: '#d06030', skin: '#8a5838', top: '#3868c8', accent: '#3050a8', pants: '#3a3050', lines: [] },
  "Maya J": { body: 'female', hair: '#d06030', skin: '#f8d0a8', top: '#b83028', accent: '#f0b030', pants: '#b09870', lines: [] },
  "Tainah": { body: 'female', hair: '#d06030', skin: '#f8d8b8', top: '#f0b030', accent: '#f0b030', pants: '#b09870', lines: ["Nameplates are my favorite thing to do! Go check out the engraver!"] },
  "Diane": { body: 'female', hair: '#6a3c20', skin: '#d8a070', top: '#9868c8', accent: '#b83028', pants: '#484858', lines: [] },
  "Raymond": { body: 'male', hair: '#5a3420', skin: '#f8d0a8', top: '#b83028', accent: '#f8e070', pants: '#686878', lines: [] },
  "Dalia": { body: 'female', hair: '#5a3420', skin: '#d8a070', top: '#e07898', accent: '#f8f8f8', pants: '#303040', lines: [] },
  "Avery": { body: 'male', hair: '#d06030', skin: '#8a5838', top: '#78a8e8', accent: '#d03868', pants: '#686878', lines: [] },
  "Muhammad": { body: 'male', hair: '#5a3420', skin: '#f8d0a8', top: '#b83028', accent: '#2c6a34', pants: '#686878', lines: [] },
  "Cody": { body: 'male', hair: '#6a3c20', skin: '#f0c098', top: '#f8f8f8', accent: '#f0b030', pants: '#b09870', lines: ["I'm down this week on spring rolls. I guess I just won't eat this weekend :("], halloween: "I bet my costume on a hand of blackjack. I nearly came as nothing at all." },
  "Leo": { body: 'male', hair: '#d06030', skin: '#d8a070', top: '#808898', accent: '#f0b030', pants: '#303040', lines: ["Make sure to check the sender's email address and don't click on any links."], halloween: "You want scary? An email from the CEO asking for gift cards." },
  "John": { body: 'male', hair: '#8a5a3a', skin: '#d8a070', top: '#808898', accent: '#d03868', pants: '#303040', lines: ["Am I getting fired? I'll sneak some cokes on the way out."] },
  "Dmitriy": { body: 'male', hair: '#201818', skin: '#f8d8b8', top: '#58a848', accent: '#f8f8f8', pants: '#686878', lines: ["Nik says he taught me to cook? I ran the line, not him."] },
};

// The people at the Kingston plant (answer Eugene's phone to get there), keyed by
// full name. 'name' is what the game calls them. Where each one works is set by
// the 'people' on the plant's rooms in tools/build_maps.py. Same fields as PEOPLE,
// and the colours are placeholders too. visits: true for someone who also turns up
// in the Richmond visitor office (they look the same in both places).
window.PLANT_CREW = {
  // front offices
  "Alex Bobyk": { name: 'Alex', visits: true, body: 'male', hair: '#5a3420', skin: '#f8d0a8', top: '#f8f8f8', accent: '#3050a8', pants: '#484858', lines: ["Oh good, you're awake. Six units ship Friday and the drawings are still on revision C.", "Have you seen our new coil storage? The nesting is top tier."] },
  "Courtney den Otter": { name: 'Courtney', visits: true, body: 'female', hair: '#d06030', skin: '#f8d8b8', top: '#9868c8', accent: '#f8f8f8', pants: '#303040', lines: ["If anyone asks, you fainted from the heat. Not from the phone call.", "HR is here to help. Mostly with forms."] },
  "Amelia Bailey": { name: 'Amelia', body: 'female', hair: '#6a3c20', skin: '#f0c098', top: '#40a0a0', accent: '#f8e070', pants: '#383848', lines: ["Welcome to Kingston! I just need you to fill in a few forms. And a few more after those.", "Your safety orientation is booked for Tuesday. Please don't touch anything until then."] },
  "Fleur Storms": { name: 'Fleur', body: 'female', hair: '#e8c050', skin: '#f8d0a8', top: '#58a848', accent: '#f8f8f8', pants: '#303040', lines: ["Somebody changed the BOM again. Now I need 400 more rivets by Thursday.", "If it isn't on the BOM, it doesn't exist."] },
  "Ashley Naylor": { name: 'Ashley', body: 'female', hair: '#201818', skin: '#d8a070', top: '#e07898', accent: '#f8f8f8', pants: '#484858', lines: ["Lead time on that motor is fourteen weeks. And I asked nicely.", "Every PO needs a number. Every number needs a PO."] },
  "Samantha Fox": { name: 'Samantha', body: 'female', hair: '#8a5a3a', skin: '#f8d8b8', top: '#3868c8', accent: '#f8e070', pants: '#303040', lines: ["Welcome to the Kingston plant! Please sign in. Safety glasses are on the left.", "Somebody keeps calling Eugene's phone from out on the floor. No idea who."] },
  "Mike Delaney": { name: 'Mike D.', body: 'male', hair: '#a8a8b0', skin: '#f0c098', top: '#78a8e8', accent: '#283878', pants: '#484858', lines: ["We're behind, we're over, and the coffee machine is broken. Normal Tuesday.", "Who called Richmond? Was it you? It was you, wasn't it."] },
  "Jillian Henderson": { name: 'Jillian', body: 'female', hair: '#5a3420', skin: '#f8d0a8', top: '#f8f8f8', accent: '#58a848', pants: '#383848', lines: ["The drawing says this coil fits. The coil disagrees.", "Three ECNs open and it isn't even lunch."] },
  "William Phippen": { name: 'William', body: 'male', hair: '#6a3c20', skin: '#f8d8b8', top: '#808898', accent: '#b83028', pants: '#303040', lines: ["I'm updating the drawings to revision D. Don't tell anyone about revision C.", "Production engineering: where every problem is my problem."] },
  "Cedric Aloor": { name: 'Cedric', body: 'male', hair: '#181010', skin: '#8a5838', top: '#58a848', accent: '#f8f8f8', pants: '#3a3050', lines: ["Have you tried turning the plant off and on again?", "The ERP is down. No, I can't tell you when it'll be back up."] },
  "Steve Goddard": { name: 'Steve', body: 'male', hair: '#8a5a3a', skin: '#f0c098', top: '#f0b030', accent: '#f8f070', pants: '#484858', lines: ["Safety glasses on! Yes, even in the hallway.", "It has been zero days since someone passed out on the plant floor. Thanks for that."] },
  "Stephanie Weiler": { name: 'Stephanie', body: 'female', hair: '#d06030', skin: '#f8d0a8', top: '#f0b030', accent: '#b83028', pants: '#303040', lines: ["Today's training: how to answer the phone without blacking out.", "There's a course for everything. Even a course on finding courses."] },
  // plant floor
  "Graham Code": { name: 'Graham', body: 'male', hair: '#5a3420', skin: '#f8d0a8', top: '#f08020', accent: '#f8f070', pants: '#303040', lines: ["The FMS punches out a panel every few seconds. Try to keep up.", "These panels came off the brake two degrees out. Again."] },
  "Josh Cadieux": { name: 'Josh', body: 'male', hair: '#201818', skin: '#f0c098', top: '#f0b030', accent: '#f8f070', pants: '#383848', lines: ["A problem with the fan design? Not my department. Probably.", "Sheet metal is just origami with more cuts."] },
  "Kyle Bullock": { name: 'Kyle', body: 'male', hair: '#e8c050', skin: '#f8d8b8', top: '#f0b030', accent: '#f8f070', pants: '#484858', lines: ["It sagged a quarter inch on the deflection test? My walls don't sag. Must be the floor.", "Double wall, foam injected. You could stand on these panels. Please don't."] },
  "John Kay": { name: 'John K.', body: 'male', hair: '#6a3c20', skin: '#d8a070', top: '#f0b030', accent: '#f8f070', pants: '#303040', lines: ["Grab one of those fans and balance it, would you? Mind your fingers.", "Every unit starts on one of my bases. No pressure."] },
  "Mark Lake": { name: 'Mark L.', body: 'male', hair: '#181010', skin: '#c08860', top: '#f0b030', accent: '#f8f070', pants: '#686878', lines: ["Coils, dampers, drain pans. If it goes in a unit, it comes through here first.", "The dampers aren't backwards. They're facing the future."] },
  "Mike Burnett": { name: 'Mike B.', body: 'male', hair: '#5a3420', skin: '#f8d0a8', top: '#f0b030', accent: '#f8f070', pants: '#383848', lines: ["Who put the access doors on the wrong side? Don't look at me.", "Keep it moving! Every minute this line stands still is a unit we don't ship."] },
  "Mark Van Oudenaren": { name: 'Mark V.', body: 'male', hair: '#8a5a3a', skin: '#f8d8b8', top: '#f08020', accent: '#f8f070', pants: '#303040', lines: ["I've popped four hundred rivets today. My hands are rivet guns now.", "Is that a 3 or an 8 on the drawing? I went with 8."] },
  "Scott Woodman": { name: 'Scott', body: 'male', hair: '#201818', skin: '#f0c098', top: '#f0b030', accent: '#f8f070', pants: '#484858', lines: ["The motor nameplate says 575 volts. The drawings say 208. Guess who gets to sort it out.", "Don't touch the panel with the red lights. Or the green ones."] },
  "Brian Kelly": { name: 'Brian', body: 'male', hair: '#d06030', skin: '#f8d8b8', top: '#f08020', accent: '#f8f070', pants: '#3a3050', lines: ["If it leaks, sparks or squeaks, it ends up on my list.", "The compressor is making that noise again. I'm sure it's fine."] },
  "Caleb Werner": { name: 'Caleb', body: 'male', hair: '#e8c050', skin: '#f8d0a8', top: '#f8f8f8', accent: '#3050a8', pants: '#383848', lines: ["I pre-check every unit before it goes on test. This one has its drain pan on upside down.", "No sticker, no ship. Those are the rules."] },
  "Nick Stevens": { name: 'Nick', body: 'male', hair: '#181010', skin: '#d8a070', top: '#f08020', accent: '#f8f070', pants: '#686878', lines: ["The truck is here and this unit isn't even painted yet. No pressure.", "Finishing touches. Emphasis on the finishing."] },
  "Justin Brennan": { name: 'Justin', body: 'male', hair: '#5a3420', skin: '#f0c098', top: '#f0b030', accent: '#f8f070', pants: '#303040', lines: ["Everything in this warehouse has a place. I just can't find it.", "We counted the filters. Then we counted them again. Different number."] },
  "Jay Sorensen": { name: 'Jay', body: 'male', hair: '#6a3c20', skin: '#f8d8b8', top: '#f08020', accent: '#f8f070', pants: '#484858', lines: ["The truck's been here since seven. The driver has eaten all of our snacks.", "If it isn't on the truck by three, it ships Monday."] },
};
// Anyone at the plant who also visits Richmond looks the same in the visitor office.
for (const v of window.VISITORS) {
  const crew = Object.values(window.PLANT_CREW).find((c) => c.visits && c.name === v.name);
  if (crew) for (const k of ['body', 'hair', 'skin', 'top', 'accent', 'pants']) v[k] = crew[k];
}

// Office dogs. Each one wanders around its owner's office (in and out of it);
// talk to one to play catch with it.
//   breed: shown with their name
//   owner: whose dog it is (a name from PEOPLE above)
//   coat / ears / chest / collar: colours
//   sound: what they say when you walk up to them (small: true for a higher bark)
//   speed: how fast they run after a frisbee (1 is average)
//   cat: true for a cat, who sits in the middle of their owner's office and never moves
window.DOGS = {
  "Cashew": { breed: 'Golden Retriever', owner: 'Walker', coat: '#e0a050', ears: '#b87830', chest: '#f0c880', collar: '#b83028', sound: 'Woof! Woof!', speed: 1.05 },
  "Bella": { breed: 'Border Collie/Australian Shepherd', owner: 'Desirae', coat: '#30303a', ears: '#181820', chest: '#f8f8f8', collar: '#3868c8', sound: 'Arf! Arf arf!', speed: 1.25 },
  "Birdie": { breed: 'Beagle', owner: 'Diane', coat: '#c07838', ears: '#6a3c20', chest: '#f8f8f8', collar: '#58a848', sound: 'Aroooooo!', speed: 0.95 },
  "Bandit": { breed: 'Shih Tzu/Bichon', owner: 'Jenn', coat: '#f0ece0', ears: '#c8b090', chest: '#f8f8f8', collar: '#e07898', sound: 'Yip! Yip yip!', small: true, speed: 0.8 },
  "Louie": { breed: 'Doodle', owner: 'Rob', coat: '#d8b078', ears: '#b08850', chest: '#ecd0a0', collar: '#f0b030', sound: 'Ruff! Ruff!', speed: 1.1 },
  "Mocha": { breed: 'Havanese/Shih Tzu/Poodle', owner: 'Sidney', coat: '#8a5a3a', ears: '#5a3420', chest: '#c09068', collar: '#9868c8', sound: 'Yap yap!', small: true, speed: 0.85 },
  "Nala": { breed: 'Rhodesian Ridgeback Terrier Mix', owner: 'Jhonna', coat: '#c8783a', ears: '#8a4a20', chest: '#d89858', collar: '#40a0a0', sound: 'Woof!', speed: 1.2 },
  "Frankie": { breed: 'Coton de Tulear', owner: 'Avery', coat: '#fafaf6', ears: '#e2ded4', chest: '#ffffff', collar: '#283a88', sound: 'Arf! Who needs a Roomba? I\'m a dog mop - I dust the floors for free!', small: true, speed: 0.9 },
  "Felix": { breed: 'Siberian', owner: 'Kim', cat: true, coat: '#e88a30', ears: '#b85a18', chest: '#f8d8a8', collar: '#e88a30', sound: 'Meow... *yawn*... zzzz', speed: 0 },
};

// Halloween party: what somebody says about the costume they turned up in (one is
// picked at random). 'ghost' is the bedsheet only coworkers wear.
window.COSTUME_LINES = {
  clown: ["I'm not saying the budget meeting is a circus, but I did come dressed for it.", "These shoes are a size 22. Same as our lead time in weeks.", "Honk honk. That's clown for 'per my last email'."],
  vampire: ["I vant to suck... the air through a properly sized return duct.", "I can't see myself in the mirror. Or on the org chart.", "I only come out at night. And for free lunch."],
  skeleton: ["I've got no body to go with. Story of my month-end.", "This is what I look like after quoting season.", "I'm chilled to the bone. Who set the supply air to 12 degrees?"],
  witch: ["My broom has better airflow than half our competitors' units.", "Double, double, toil and trouble. That's just the submittal process.", "I put a hex on the printer. Turns out it was already cursed."],
  pumpkin: ["I carved this myself. Engineering signed off on the structure.", "I am officially pumpkin spice certified.", "Don't leave me out on the porch. I go soft by November."],
  mummy: ["I'm all wrapped up in this project. Have been for years.", "This is three rolls of duct tape. Don't tell the shop.", "Mmmph mmph mmmph. (I can't find the mouth hole.)"],
  fan: ["I'm a plenum fan. Ask me about my static pressure. Please. Nobody has.", "I'm a big fan of this party.", "Careful, I'm running at full speed. I've had two coffees."],
  sdg: ["I'm SDG. Double-click me and wait ninety seconds.", "I came as the scariest thing in the office: SDG on a Monday morning.", "Please don't close me without saving."],
  ghost: ["Two eye holes and a bedsheet. Lean manufacturing.", "Boo! Sorry, was that on schedule?", "Linda says I'm doing it all wrong."],
};

// Christmas: what coworkers out in the parking lot talk about (one is picked at random,
// along with their own christmas: line if they have one), by where they are.
window.CHRISTMAS_LINES = {
  fire: ["Best seat in the lot. Warm on the front, freezing on the back.", "I've been rotating like a rotisserie chicken for an hour.",
    "Smells like woodsmoke and marshmallows. Don't tell anyone I brought marshmallows.", "This fire puts out more BTUs than half our heating coils."],
  cocoa: ["They have the little marshmallows. Not the big ones. The little ones.", "I'm on my third. Don't judge me.",
    "Whipped cream AND marshmallows? It's the holidays."],
  watch: ["I'm just here to watch people fall over. Purely supportive.", "Someone needs to bring a puck. We could get a game going.",
    "I'd skate, but these are my good shoes.", "Somebody flooded this on their lunch break. Respect."],
  car: ["Found my car. I think. They all look the same under a foot of snow.", "I'm warming it up. Twenty more minutes and it might start.",
    "I left my scraper inside. I've been using my loyalty card."],
  snowman: ["Somebody gave him a lanyard. He has better building access than I do.", "I did the head. I'm very proud of the head."],
  tree: ["Whoever strung all these lights deserves a raise.", "I tried counting the bulbs. I lost count at forty."],
};
