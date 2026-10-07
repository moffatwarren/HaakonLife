// Chiptune songs for the music player in game.js.
//
// Each song has a tempo (bpm) and a few voices. A voice is a string of steps,
// one per eighth note: a note like C4 / F#3 / Bb2, '-' to hold the previous
// note, '.' for a rest. '|' is just a bar line for readability.
// Drum voices use k (kick), s (snare), h (hi-hat) and '.'.
// Voices loop on their own, so a short drum pattern repeats under a long tune.
window.MUSIC = {
  // wandering around the office
  office: {
    bpm: 112,
    voices: [
      { type: 'square', vol: 0.035, notes:
        'E4 - G4 - C5 - B4 A4 | G4 - E4 - - - . . | F4 - A4 - C5 - D5 C5 | B4 - G4 - - - . . |' +
        'E4 - G4 - C5 - E5 D5 | C5 - A4 - - - G4 A4 | F4 - A4 - G4 - E4 D4 | C4 - - - - - . . |' +
        'A4 - - G4 A4 - C5 - | B4 - G4 - E4 - . . | F4 - - E4 F4 - A4 - | G4 - - - - - . . |' +
        'A4 - - G4 A4 - C5 - | D5 - C5 - B4 - A4 - | G4 - F4 - E4 - D4 - | C4 - - - - - . .' },
      { type: 'triangle', vol: 0.09, notes:
        'C3 . G2 . C3 . G2 . | A2 . E2 . A2 . E2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . |' +
        'C3 . G2 . C3 . G2 . | A2 . E2 . A2 . E2 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . . |' +
        'F2 . C3 . F2 . C3 . | E2 . B2 . E2 . B2 . | D2 . A2 . D2 . A2 . | G2 . D3 . G2 . B2 . |' +
        'F2 . C3 . F2 . C3 . | E2 . B2 . A2 . E2 . | D2 . A2 . G2 . D3 . | C3 . G2 . C3 . . .' },
      { type: 'drums', vol: 0.5, notes: 'k . h . s . h . | k . h k s . h h' },
    ],
  },

  // the Ghosts room: slow, minor and empty
  spooky: {
    bpm: 72,
    voices: [
      { type: 'triangle', vol: 0.06, notes:
        'A4 . . C5 . . B4 . | . . G#4 - - - . . | F4 . . A4 . . G#4 . | E4 - - - - - . . |' +
        'A4 . . C5 . . E5 . | . . D#5 - - - . . | D5 . . C5 . . B4 . | G#4 - - - - - . .' },
      { type: 'sine', vol: 0.03, notes:
        '. . . . E6 . . . | . . . . . . D#6 . | . . . . C6 . . . | . . . . . . B5 . |' +
        '. . . . E6 . . . | . . . . . . F6 . | . . . . E6 . . . | . . . . . . . .' },
      { type: 'triangle', vol: 0.08, notes:
        'A2 - - - - - - - | F2 - - - - - - - | D2 - - - - - - - | E2 - - - - - - - |' +
        'A2 - - - - - - - | F#2 - - - - - - - | F2 - - - - - - - | E2 - - - - - - -' },
      { type: 'drums', vol: 0.25, notes: 'k . . . . . . . | . . . . . . h . | k . . . . . . . | . . . . . . . .' },
    ],
  },

  // Linda, finally free: bright, major and soaring
  free: {
    bpm: 128,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'E5 - G5 - C6 - B5 - | A5 - - - G5 - E5 - | F5 - A5 - C6 - D6 - | E6 - - - D6 - C6 - |' +
        'C6 - B5 - A5 - G5 - | F5 - A5 - G5 - E5 - | D5 - F5 - B5 - D6 - | C6 - - - - - . .' },
      { type: 'sine', vol: 0.03, notes:
        'C5 E5 G5 C6 G5 E5 C5 E5 | A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | C5 E5 G5 C6 G5 E5 C5 E5 |' +
        'A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | G4 B4 D5 G5 D5 B4 G4 B4 | C5 E5 G5 C6 E6 - - -' },
      { type: 'triangle', vol: 0.09, notes:
        'C3 - - - G2 - - - | A2 - - - E2 - - - | F2 - - - C3 - - - | C3 - - - G2 - - - |' +
        'A2 - - - E2 - - - | F2 - - - C3 - - - | G2 - - - D3 - - - | C3 - - - - - - -' },
      { type: 'drums', vol: 0.35, notes: 'k . h . s . h . | k . h k s . h h' },
    ],
  },

  // Reagan and Patrick's office: four-on-the-floor rave
  rave: {
    bpm: 140,
    voices: [
      { type: 'square', vol: 0.025, notes:
        'A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | C5 E5 G5 C6 G5 E5 C5 E5 | G4 B4 D5 G5 D5 B4 G4 B4 |' +
        'A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | C5 E5 G5 C6 G5 E5 C5 E5 | G4 B4 D5 G5 B5 G5 D5 B4' },
      { type: 'square', vol: 0.02, notes:
        '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . |' +
        'E6 - - - D6 - C6 - | C6 - - - A5 - - - | G5 - - - C6 - E6 - | D6 - - - B5 - - - |' +
        'E6 - E6 - D6 - C6 - | A5 - C6 - - - A5 - | G5 - C6 - E6 - G6 - | F#6 - D6 - B5 - G5 - |' +
        'A6 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . .' },
      { type: 'sawtooth', vol: 0.035, notes:
        '. A2 . A2 . A2 . A2 | . F2 . F2 . F2 . F2 | . C3 . C3 . C3 . C3 | . G2 . G2 . G2 . G2' },
      { type: 'drums', vol: 0.6, notes: 'k . k . k . k .' },
      { type: 'drums', vol: 0.5, notes: '. h s h . h s h | . h s h . h s s' },
    ],
  },

  // Zin's poker program: a lazy card-room lounge tune
  poker: {
    bpm: 104,
    voices: [
      { type: 'square', vol: 0.022, notes:
        'A4 - C5 - . E5 D5 C5 | A4 - - - G4 - . . | F4 - A4 - . C5 Bb4 A4 | G4 - - - . . . . |' +
        'A4 - C5 - . E5 F5 E5 | D5 - - - C5 - A4 - | Bb4 - A4 - G4 - E4 - | F4 - - - . . . .' },
      { type: 'triangle', vol: 0.08, notes:
        'F2 . A2 . C3 . A2 . | D2 . F2 . A2 . F2 . | Bb2 . D3 . F3 . D3 . | C3 . E3 . G3 . E3 . |' +
        'F2 . A2 . C3 . A2 . | D2 . F2 . A2 . F2 . | G2 . Bb2 . C3 . E3 . | F2 . C3 . F2 . . .' },
      { type: 'drums', vol: 0.3, notes: 'k . h h s . h h' },
    ],
  },

  coffee: {
    bpm: 132,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'C5 A4 F4 A4 C5 - D5 C5 | Bb4 - D5 - F5 - D5 Bb4 | G4 A4 Bb4 C5 E5 - D5 C5 | F5 - C5 - A4 - . . |' +
        'A4 C5 F5 C5 A4 - G4 F4 | D4 F4 Bb4 - A4 - G4 - | E4 G4 C5 - Bb4 - G4 E4 | F4 - - - . . . .' },
      { type: 'triangle', vol: 0.09, notes:
        'F2 . A2 C3 F2 . A2 C3 | Bb2 . D3 F3 Bb2 . D3 F3 | C3 . E3 G3 C3 . E3 G3 | F2 . C3 . F2 . . . |' +
        'F2 . A2 C3 F2 . A2 C3 | Bb2 . D3 F3 Bb2 . D3 F3 | C3 . E3 G3 C3 . E3 G3 | F2 . C3 . F2 . . .' },
      { type: 'drums', vol: 0.45, notes: 'k . h s . h k h | k . h s . h s h' },
    ],
  },

  punch: {
    bpm: 150,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'E4 - G4 - A4 - B4 - | B4 - A4 G4 A4 - - - | C5 - B4 A4 G4 - A4 - | B4 - - - - - . . |' +
        'E5 - D5 B4 D5 - E5 - | G5 - F#5 E5 D5 - B4 - | C5 - B4 A4 G4 - F#4 - | E4 - - - - - . .' },
      { type: 'sawtooth', vol: 0.03, notes:
        'E2 E2 E3 E2 E2 E2 D3 E2 | E2 E2 E3 E2 E2 E2 D3 E2 | C2 C2 C3 C2 D2 D2 D3 D2 | E2 E2 E3 E2 E2 E2 B2 E2' },
      { type: 'drums', vol: 0.55, notes: 'k h s h k k s h | k h s h k k s s' },
    ],
  },

  run: {
    bpm: 168,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'B4 - D5 - G5 - F#5 E5 | D5 - B4 - G4 - A4 B4 | C5 - E5 - G5 - E5 C5 | D5 - - - A4 - F#4 - |' +
        'B4 - D5 - G5 - A5 B5 | A5 - G5 - E5 - D5 - | C5 - E5 - D5 - C5 A4 | G4 - - - - - . .' },
      { type: 'triangle', vol: 0.09, notes:
        'G2 G3 G2 G3 G2 G3 G2 G3 | E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 D3 F#2 D3' },
      { type: 'drums', vol: 0.5, notes: 'k h s h k h s h | k h s h k h s s' },
    ],
  },

  pong: {
    bpm: 140,
    voices: [
      { type: 'square', vol: 0.025, notes:
        'A4 C5 E5 C5 A4 C5 E5 C5 | F4 A4 C5 A4 F4 A4 C5 A4 | G4 B4 D5 B4 G4 B4 D5 B4 | E4 G#4 B4 G#4 E4 G#4 B4 E5' },
      { type: 'square', vol: 0.02, notes:
        'E5 - - - . . A5 - | C6 - - - . . A5 - | B5 - - - . . G5 - | G#5 - - - E5 - - - |' +
        '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . .' },
      { type: 'triangle', vol: 0.09, notes: 'A2 - - - A2 - . . | F2 - - - F2 - . . | G2 - - - G2 - . . | E2 - - - E2 - E2 .' },
      { type: 'drums', vol: 0.45, notes: 'k . h . s . h h' },
    ],
  },

  toss: {
    bpm: 120,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'F#4 - A4 - D5 - . A4 | B4 - G4 - D4 - . . | C#5 - E5 - A4 - G4 E4 | D4 - - - . . . . |' +
        'A4 - F#4 - A4 - D5 - | E5 - D5 - B4 - G4 - | A4 - B4 - C#5 - E5 - | D5 - - - . . . .' },
      { type: 'triangle', vol: 0.09, notes:
        'D3 . A2 . D3 . A2 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | D3 . A2 . D3 . . .' },
      { type: 'drums', vol: 0.45, notes: 'k . h k s . h .' },
    ],
  },

  stack: {
    bpm: 126,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'D5 - A4 Bb4 C5 - Bb4 A4 | G4 - G4 Bb4 D5 - C5 Bb4 | A4 - - Bb4 C5 - D5 - | Bb4 - G4 - G4 - . . |' +
        '. C5 - Eb5 G5 - F5 Eb5 | D5 - - Bb4 D5 - C5 Bb4 | A4 - A4 Bb4 C5 - D5 - | Bb4 - G4 - G4 - . .' },
      { type: 'triangle', vol: 0.09, notes:
        'D3 A2 D3 A2 D3 A2 D3 A2 | G2 D3 G2 D3 G2 D3 G2 D3 | F2 C3 F2 C3 A2 E3 A2 E3 | G2 D3 G2 D3 A2 E3 A2 . |' +
        'C3 G2 C3 G2 C3 G2 C3 G2 | Bb2 F3 Bb2 F3 Bb2 F3 Bb2 F3 | F2 C3 F2 C3 A2 E3 A2 E3 | G2 D3 G2 D3 A2 E3 A2 .' },
      { type: 'drums', vol: 0.45, notes: 'k h s h k h s h' },
    ],
  },

  simon: {
    bpm: 100,
    voices: [
      { type: 'square', vol: 0.025, notes: 'G4 . . . Eb5 . . . | D5 . . . F4 . . . | C5 . . . Eb5 . . . | D5 - - - B4 - - -' },
      { type: 'sine', vol: 0.03, notes: 'C6 G5 Eb5 G5 C6 G5 Eb5 G5' },
      { type: 'triangle', vol: 0.09, notes: 'C3 C3 . C3 . C3 Eb3 . | Bb2 Bb2 . Bb2 . Bb2 F3 . | Ab2 Ab2 . Ab2 . Ab2 Eb3 . | G2 G2 . G2 . G2 B2 .' },
      { type: 'drums', vol: 0.4, notes: 'k . . h s . . h' },
    ],
  },

  lunch: {
    bpm: 116,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'E4 . G4 . A4 . G4 . | E4 . D4 . E4 - - . | E4 . G4 . A4 . C5 . | B4 . A4 . G4 - - . |' +
        'A4 . C5 . D5 . C5 . | A4 . G4 . A4 - - . | C5 . B4 . A4 . G4 . | E4 . D#4 . E4 - - .' },
      { type: 'triangle', vol: 0.09, notes: 'A2 . . . E3 . . . | A2 . . . E3 . . . | F2 . . . C3 . . . | E2 . . . B2 . . .' },
      { type: 'drums', vol: 0.4, notes: 'h . k . h . s .' },
    ],
  },

  candy: {
    bpm: 96,
    voices: [
      { type: 'square', vol: 0.028, notes:
        '. . . B4 C5 . . . | . . B4 C5 . . E5 . | D#5 - - - . . . . | . . . . . . . . |' +
        '. . . B4 C5 . . . | . . B4 C5 . . G5 . | F#5 - - - E5 . . . | . . . . . . . .' },
      { type: 'triangle', vol: 0.09, notes: 'E2 . G2 . G#2 . B2 . | C3 . B2 . Bb2 . A2 . | E2 . G2 . G#2 . B2 . | E3 . D3 . B2 . G2 .' },
      { type: 'drums', vol: 0.3, notes: 'h . . h s . h .' },
    ],
  },

  squat: {
    bpm: 140,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'A4 - - - D5 - - - | F5 - - - D5 - - - | E5 - - - C5 - G4 - | A4 - - - - - . . |' +
        'A4 - D5 - F5 - A5 - | G5 - - - F5 - E5 - | F5 - E5 - D5 - C5 - | D5 - - - - - . .' },
      { type: 'sawtooth', vol: 0.025, notes:
        'D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 A1 A2 A1 A2' },
      { type: 'drums', vol: 0.55, notes: 'k . s . k k s . | k . s . k k s s' },
    ],
  },

  golf: {
    bpm: 104,
    voices: [
      { type: 'square', vol: 0.025, notes:
        'E5 - - D5 C5 - A4 - | G4 - - - - - . . | F5 - - E5 D5 - A4 - | B4 - - - G4 - . . |' +
        'E5 - - D5 C5 - E5 - | A5 - - G5 E5 - C5 - | D5 - - C5 B4 - G4 - | C5 - - - - - . .' },
      { type: 'triangle', vol: 0.09, notes:
        'C3 . E3 . G3 . E3 . | A2 . C3 . E3 . C3 . | D3 . F3 . A3 . F3 . | G2 . B2 . D3 . F3 . |' +
        'C3 . E3 . G3 . E3 . | A2 . C3 . E3 . C3 . | D3 . F3 . G2 . B2 . | C3 . G2 . C3 . . .' },
      { type: 'drums', vol: 0.35, notes: 'h . h h s . h .' },
    ],
  },

  // Damir's game: a slow heartbeat under thin, high notes
  dark: {
    bpm: 84,
    voices: [
      { type: 'sine', vol: 0.035, notes:
        'A5 - - - - - - - | . . . . . . . . | Bb5 - - - - - - - | . . . . . . . . |' +
        'A5 - - - - - - - | . . . . G#5 - - - | . . . . . . . . | . . . . . . . .' },
      { type: 'triangle', vol: 0.1, notes: 'D2 . D2 . . . . . | D2 . D2 . . . . . | D2 . D2 . . . . . | Eb2 . Eb2 . . . . .' },
      { type: 'drums', vol: 0.5, notes: 'k . k . . . . . | . . . . . . . h' },
    ],
  },
  // Richard's air handling duel: fast, driving and a little heroic
  battle: {
    bpm: 148,
    voices: [
      { type: 'square', vol: 0.032, notes:
        'A4 - E5 - A5 - G5 E5 | F5 - E5 - D5 - C5 B4 | A4 - C5 - E5 - D5 C5 | B4 - G#4 - A4 - . . |' +
        'A4 - E5 - A5 - B5 C6 | B5 - A5 - G5 - E5 D5 | C5 - E5 - A5 - G5 E5 | A5 - - - - - . .' },
      { type: 'triangle', vol: 0.09, notes:
        'A2 . A2 E3 A2 . A2 E3 | F2 . F2 C3 F2 . F2 C3 | A2 . A2 E3 A2 . A2 E3 | E2 . E2 B2 E2 . E2 B2 |' +
        'A2 . A2 E3 A2 . A2 E3 | F2 . F2 C3 G2 . G2 D3 | C3 . C3 G3 C3 . C3 G3 | E2 . B2 . A2 . . .' },
      { type: 'drums', vol: 0.5, notes: 'k h s h k h s h | k h s h k k s h' },
    ],
  },
  // the air handling gear: a slow machine hum you work over the top of
  plant: {
    bpm: 96,
    voices: [
      { type: 'square', vol: 0.026, notes:
        'D4 - . . A4 - . . | F4 - . . D4 - . . | C4 - . . G4 - . . | E4 - . . C4 - . . |' +
        'D4 - . . F4 - . . | A4 - . . D5 - . . | C5 - . . A4 - . . | D4 - - - - - . .' },
      { type: 'triangle', vol: 0.095, notes:
        'D2 - - - - - - - | D2 - - - - - - - | C2 - - - - - - - | C2 - - - - - - - |' +
        'Bb2 - - - - - - - | Bb2 - - - - - - - | A2 - - - - - - - | A2 - - - - - - -' },
      { type: 'drums', vol: 0.4, notes: 'k . h . k . h . | k . h . k . h h' },
    ],
  },

  // compressions: locked to 110 bpm, because that is the whole point
  cpr: {
    bpm: 110,
    voices: [
      { type: 'square', vol: 0.03, notes:
        'A4 . A4 . C5 . A4 . | G4 . G4 . E4 . G4 . | F4 . F4 . A4 . F4 . | E4 . E4 . G4 . E4 . |' +
        'A4 . A4 . C5 . E5 . | D5 . D5 . B4 . D5 . | C5 . C5 . A4 . C5 . | A4 . . . . . . .' },
      { type: 'triangle', vol: 0.085, notes:
        'A2 . . . E3 . . . | G2 . . . D3 . . . | F2 . . . C3 . . . | E2 . . . B2 . . . |' +
        'A2 . . . E3 . . . | G2 . . . D3 . . . | F2 . . . C3 . . . | E2 . . . E2 . . .' },
      { type: 'drums', vol: 0.55, notes: 'k . s . k . s . | k . s . k . s .' },
    ],
  },
};
