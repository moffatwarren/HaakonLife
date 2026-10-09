// People who work in the office. Each person paces around their own office or
// cubicle. Edit freely:
//   body:  'male' or 'female' sprite
//   hair / skin / top / accent (tie or necklace) / pants:  colours
//   lines: what they say when you talk to them (one is picked at random).
//          Leave it empty to use the generic greetings.
// Body types are a best guess from each name; colours are random placeholders.
// Office 182 is the visitor office: someone different from out of town every
// time the game is launched. 'name' is who they show up as in the game.
//   name: { body (best guess from the name), lines (optional: what they say;
//           leave it out to use the "visiting from out of town" line) }
const VISITORS = {
  Jill: { body: 'female' },
  Alex: { body: 'male', lines: ["Have you seen Kingston's new coil storage. The nesting is top teir."] },
  Garrett: { body: 'male', lines: ["We have finally recovered from all of that flooding. Do you want to move to Asheville?"] },
  Ali: { body: 'female', lines: ["You look like a C to me with shading of D."] },
  Courtney: { body: 'female' },
};
function visitor() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const name = pick(Object.keys(VISITORS));
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
}
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
  "Tho": { body: 'male', hair: '#5a3420', skin: '#f0c098', top: '#808898', accent: '#b83028', pants: '#484858', lines: [] },
  "Mike H.": { body: 'male', hair: '#5a3420', skin: '#d8a070', top: '#58a848', accent: '#f8e070', pants: '#3a3050', lines: [] },
  "Jhonna": { body: 'female', hair: '#8a5a3a', skin: '#d8a070', top: '#3868c8', accent: '#2c6a34', pants: '#383848', lines: ["Make sure you have your dependant forms filled out for Manulife!"] },
  "Max": { body: 'male', hair: '#181010', skin: '#f8d0a8', top: '#40a0a0', accent: '#f8e070', pants: '#b09870', lines: [] },
  "Jack": { body: 'male', hair: '#6a3c20', skin: '#8a5838', top: '#58a848', accent: '#d03868', pants: '#484858', lines: [] },
  "Maya W": { body: 'female', hair: '#181010', skin: '#d8a070', top: '#78a8e8', accent: '#f8f8f8', pants: '#303040', lines: [] },
  // ---- Second floor ----
  "Linda": { body: 'ghost', lines: ["Boooooo...", "Ooooo... has anyone seen my stapler?", "This Haunted Office is MY office now. Boo."] },
  "Davisson": { body: 'male', hair: '#d06030', skin: '#f8d0a8', top: '#f8f8f8', accent: '#f8f8f8', pants: '#3a3050', lines: [] },
  "Michael Tam": { body: 'male', hair: '#181010', skin: '#f8d8b8', top: '#40a0a0', accent: '#3050a8', pants: '#484858', lines: [] },
  "Lauren": { body: 'female', hair: '#181010', skin: '#8a5838', top: '#f0b030', accent: '#f8f8f8', pants: '#303040', lines: [] },
  "Gigi": { body: 'female', hair: '#8a5a3a', skin: '#8a5838', top: '#40a0a0', accent: '#283878', pants: '#383848', lines: [] },
  "Joe": { body: 'male', hair: '#8a5a3a', skin: '#8a5838', top: '#b83028', accent: '#3050a8', pants: '#b09870', lines: ["Have you seen my Lego shelf? That spaceship took me all weekend."] },
  "Mauro": { body: 'male', hair: '#d06030', skin: '#8a5838', top: '#40a0a0', accent: '#2c6a34', pants: '#3a3050', lines: ["I'm young and Italian!"] },
  "Alyssa": { body: 'female', hair: '#a8a8b0', skin: '#f8d0a8', top: '#78a8e8', accent: '#283878', pants: '#b09870', lines: ["Why do I feel so old? Did Mauro steal my youth?"] },
  "JP": { body: 'male', hair: '#d06030', skin: '#c08860', top: '#78a8e8', accent: '#2c6a34', pants: '#3a3050', lines: [] },
  "James": { body: 'male', hair: '#d06030', skin: '#f8d0a8', top: '#58a848', accent: '#283878', pants: '#686878', lines: [] },
  "Reagan": { body: 'male', hair: '#d06030', skin: '#f0c098', top: '#9868c8', accent: '#f8e070', pants: '#383848', lines: ["I was up all night waiting in line to get Pokemon cards. These lights are keeping me awake!"] },
  "Patrick": { body: 'male', hair: '#201818', skin: '#f8d0a8', top: '#e07898', accent: '#283878', pants: '#484858', lines: ["Did you get your Hyrox tickets? Let's get a workout in!"] },
  "Rob": { body: 'male', hair: '#a8a8b0', skin: '#f8d0a8', top: '#9868c8', accent: '#3050a8', pants: '#686878', lines: [] },
  "Warren": { body: 'male', hair: '#d06030', skin: '#c08860', top: '#f8f8f8', accent: '#d03868', pants: '#303040', lines: ["The dumbbell rack is my legacy."] },
  "Bob": { body: 'male', hair: '#8a5a3a', skin: '#8a5838', top: '#3868c8', accent: '#f0b030', pants: '#484858', lines: [] },
  "Walker": { body: 'male', hair: '#d06030', skin: '#c08860', top: '#40a0a0', accent: '#d03868', pants: '#686878', lines: [] },
  "Hudson": { body: 'male', hair: '#181010', skin: '#d8a070', top: '#808898', accent: '#f0b030', pants: '#686878', lines: [] },
  "Jenn": { body: 'female', hair: '#6a3c20', skin: '#f8d0a8', top: '#b83028', accent: '#2c6a34', pants: '#484858', lines: ["Sure Nik and Dmitriy can cook, but baking is where its really at."] },
  "Zin": { body: 'male', hair: '#a8a8b0', skin: '#d8a070', top: '#78a8e8', accent: '#f8f8f8', pants: '#484858', lines: ["I'm on a 5 spring roll winning streak. I've never felt so alive!"] },
  "Jules": { body: 'male', hair: '#181010', skin: '#8a5838', top: '#3868c8', accent: '#f8e070', pants: '#484858', lines: [] },
  "Daphne": { body: 'female', hair: '#a8a8b0', skin: '#8a5838', top: '#58a848', accent: '#2c6a34', pants: '#383848', lines: [] },
  "Nik": { body: 'male', hair: '#6a3c20', skin: '#f8d8b8', top: '#808898', accent: '#f8e070', pants: '#383848', lines: ["Have you met Dmitriy? He's my younger brother. I taught him all he knows about being a chef."] },
  "Leon": { body: 'male', hair: '#181010', skin: '#8a5838', top: '#808898', accent: '#2c6a34', pants: '#b09870', lines: [] },
  "Mike Friesen": { body: 'male', hair: '#a8a8b0', skin: '#f0c098', top: '#40a0a0', accent: '#d03868', pants: '#383848', lines: ["Yes"] },
  "STEPHEN": { body: 'male', hair: '#5a3420', skin: '#d8a070', top: '#40a0a0', accent: '#f8e070', pants: '#484858', lines: ["EMAILS ARE MUCH EASIER TO READ IF EVERYTHING IS ALL CAPS"] },
  "Dave": { body: 'male', hair: '#a8a8b0', skin: '#f0c098', top: '#e07898', accent: '#f8e070', pants: '#383848', lines: ["If you see my mug, its the one with the tweety bird on it."] },
  "Desirae": { body: 'female', hair: '#181010', skin: '#f8d0a8', top: '#f8f8f8', accent: '#f0b030', pants: '#303040', lines: ["Everyone else signed up for the Gran Fondo already. Everyone. You don't want to be the only one left out, do you?"] },
  "Wade": { body: 'male', hair: '#181010', skin: '#f0c098', top: '#78a8e8', accent: '#283878', pants: '#303040', lines: [] },
  "Visitor": visitor(),
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
  "Cody": { body: 'male', hair: '#6a3c20', skin: '#f0c098', top: '#f8f8f8', accent: '#f0b030', pants: '#b09870', lines: ["I'm down this week on spring rolls. I guess I just won't eat this weekend :("] },
  "Leo": { body: 'male', hair: '#d06030', skin: '#d8a070', top: '#808898', accent: '#f0b030', pants: '#303040', lines: ["Make sure to check the sender's email address and don't click on any links."] },
  "John": { body: 'male', hair: '#8a5a3a', skin: '#d8a070', top: '#808898', accent: '#d03868', pants: '#303040', lines: [] },
  "Dmitriy": { body: 'male', hair: '#201818', skin: '#f8d8b8', top: '#58a848', accent: '#f8f8f8', pants: '#686878', lines: ["Nik says he taught me to cook? I ran the line, not him."] },
};

// Office dogs. Each one wanders around its owner's office (in and out of it);
// talk to one to play catch with it.
//   breed: shown with their name
//   owner: whose dog it is (a name from PEOPLE above)
//   coat / ears / chest / collar: colours
//   sound: what they say when you walk up to them (small: true for a higher bark)
//   speed: how fast they run after a frisbee (1 is average)
window.DOGS = {
  "Cashew": { breed: 'Golden Retriever', owner: 'Walker', coat: '#e0a050', ears: '#b87830', chest: '#f0c880', collar: '#b83028', sound: 'Woof! Woof!', speed: 1.05 },
  "Bella": { breed: 'Border Collie/Australian Shepherd', owner: 'Desirae', coat: '#30303a', ears: '#181820', chest: '#f8f8f8', collar: '#3868c8', sound: 'Arf! Arf arf!', speed: 1.25 },
  "Birdie": { breed: 'Beagle', owner: 'Diane', coat: '#c07838', ears: '#6a3c20', chest: '#f8f8f8', collar: '#58a848', sound: 'Aroooooo!', speed: 0.95 },
  "Bandit": { breed: 'Shih Tzu/Bichon', owner: 'Jenn', coat: '#f0ece0', ears: '#c8b090', chest: '#f8f8f8', collar: '#e07898', sound: 'Yip! Yip yip!', small: true, speed: 0.8 },
  "Louie": { breed: 'Doodle', owner: 'Rob', coat: '#d8b078', ears: '#b08850', chest: '#ecd0a0', collar: '#f0b030', sound: 'Ruff! Ruff!', speed: 1.1 },
  "Mocha": { breed: 'Havanese/Shih Tzu/Poodle', owner: 'Sidney', coat: '#8a5a3a', ears: '#5a3420', chest: '#c09068', collar: '#9868c8', sound: 'Yap yap!', small: true, speed: 0.85 },
  "Nala": { breed: 'Rhodesian Ridgeback Terrier Mix', owner: 'Jhonna', coat: '#c8783a', ears: '#8a4a20', chest: '#d89858', collar: '#40a0a0', sound: 'Woof!', speed: 1.2 },
};
