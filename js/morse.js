/* ITU International Morse (letters, digits, common punctuation). */
export const MORSE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
  Ä: ".-.-",
  Ö: "---.",
  Ü: "..--",
};

/** Well-known German Merkwörter (O-vowel / rhythm method). No invented aids. */
export const MNEMONICS = {
  A: "Alarm",
  B: "Bonaparte",
  C: "Coca-Cola",
  D: "Donnerstag",
  E: "Ei",
  F: "Fensterbogen",
  G: "Großonkel",
  H: "Herrenzimmer",
  I: "Ida",
  J: "Jawohl, Odol",
  K: "Kommando",
  L: "Limonade",
  M: "Motor",
  N: "Nora",
  O: "Oh Otto",
  P: "Peloponnes",
  Q: "Quolsdorf bei Forst",
  R: "Revolver",
  S: "Sabine",
  T: "Ton",
  U: "Uniform",
  V: "Ventilator",
  W: "Windmotor",
  X: "Xerxeshof",
  Y: "Yoshimoto",
  Z: "Zollvorsteher",
};

export const CHAR_LABELS = {
  ".": "Punkt",
  ",": "Komma",
  "?": "Fragezeichen",
  "'": "Apostroph",
  "!": "Ausrufezeichen",
  "/": "Schrägstrich",
  "(": "Klammer auf",
  ")": "Klammer zu",
  "&": "Und-Zeichen",
  ":": "Doppelpunkt",
  ";": "Semikolon",
  "=": "Gleich",
  "+": "Plus",
  "-": "Bindestrich",
  _: "Unterstrich",
  '"': "Anführungszeichen",
  $: "Dollar",
  "@": "At-Zeichen",
  Ä: "Ä",
  Ö: "Ö",
  Ü: "Ü",
};

/** Koch-inspired order: start with E/T (Dit und Dah), then build up. */
export const KOCH_ORDER = [
  "E", "T", "A", "I", "N", "M", "S", "O", "R", "U",
  "D", "K", "G", "W", "H", "L", "B", "F", "C", "P",
  "V", "J", "X", "Q", "Y", "Z",
  "5", "0", "9", "1", "8", "2", "7", "3", "6", "4",
  ".", ",", "?", "/",
];

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const DIGITS = "0123456789".split("");
export const PUNCTUATION = [".", ",", "?", "/", "!", "'", "(", ")", ":", "=", "+", "-", "@"];
export const UMLAUTS = ["Ä", "Ö", "Ü"];

export const WORDS = [
  { word: "SOS", hint: "Notruf" },
  { word: "HI", hint: "Funk-Gruß" },
  { word: "JA", hint: "Zustimmung" },
  { word: "NEIN", hint: "Ablehnung" },
  { word: "OK", hint: "Alles klar" },
  { word: "HALLO", hint: "Begrüßung" },
  { word: "OMA", hint: "Großmutter" },
  { word: "OPA", hint: "Großvater" },
  { word: "MAMA", hint: "Mutter" },
  { word: "PAPA", hint: "Vater" },
  { word: "SEE", hint: "Gewässer" },
  { word: "TEE", hint: "Getränk" },
  { word: "EIS", hint: "Gefroren" },
  { word: "GUT", hint: "Positiv" },
  { word: "LOS", hint: "Auf geht’s" },
  { word: "HILFE", hint: "Notruf-Wort" },
  { word: "DANK", hint: "Dankeschön" },
  { word: "FEUER", hint: "Brand" },
  { word: "WASSER", hint: "Löschen" },
  { word: "WIND", hint: "Wetter" },
  { word: "WALD", hint: "Forst" },
  { word: "NACHT", hint: "Dunkel" },
  { word: "FUNK", hint: "Sprechfunk" },
  { word: "RADIO", hint: "Empfänger" },
  { word: "MORSE", hint: "Dieser Code" },
  { word: "TEST", hint: "Prüfung" },
  { word: "START", hint: "Beginn" },
  { word: "STOP", hint: "Halt" },
  { word: "ENDE", hint: "Schluss" },
  { word: "NOT", hint: "Notfall" },
  { word: "RAUCH", hint: "Brandzeichen" },
  { word: "BRAND", hint: "Feuer" },
  { word: "GLUT", hint: "Nachlöschrest" },
  { word: "RETTEN", hint: "Bergen" },
  { word: "NAME", hint: "Bezeichnung" },
  { word: "MEIN", hint: "Possessiv" },
  { word: "STEIN", hint: "Fels" },
  { word: "NEST", hint: "Vogelheim" },
  { word: "AST", hint: "Zweig" },
  { word: "EINE", hint: "Artikel" },
  { word: "IST", hint: "Verb" },
  { word: "SIE", hint: "Pronomen" },
  { word: "UND", hint: "Bindewort" },
  { word: "DAS", hint: "Artikel" },
  { word: "DER", hint: "Artikel" },
  { word: "DIE", hint: "Artikel" },
  { word: "TOR", hint: "Eingang" },
  { word: "ROT", hint: "Farbe" },
  { word: "GOLD", hint: "Metall" },
  { word: "HELD", hint: "Mutig" },
  { word: "KIND", hint: "Jugend" },
  { word: "LAND", hint: "Gebiet" },
  { word: "HAND", hint: "Körper" },
  { word: "SAND", hint: "Boden" },
  { word: "WORT", hint: "Sprache" },
  { word: "ORT", hint: "Stelle" },
  { word: "POST", hint: "Nachricht" },
  { word: "CODE", hint: "Schlüssel" },
  { word: "CQ", hint: "Allgemeiner Anruf" },
  { word: "DE", hint: "Hier ist …" },
  { word: "K", hint: "Bitte kommen" },
  { word: "EILE", hint: "Schnell" },
  { word: "RUHE", hint: "Stille" },
  { word: "SONNE", hint: "Gestirn" },
  { word: "MOND", hint: "Nachtgestirn" },
  { word: "STERN", hint: "Himmel" },
  { word: "BERG", hint: "Höhe" },
  { word: "TAL", hint: "Senke" },
  { word: "FLUSS", hint: "Gewässer" },
  { word: "MEER", hint: "Ozean" },
  { word: "BOOT", hint: "Wasserfahrzeug" },
  { word: "AUTO", hint: "Fahrzeug" },
  { word: "HAUS", hint: "Gebäude" },
  { word: "TURM", hint: "Hohes Bauwerk" },
  { word: "ZEIT", hint: "Uhr" },
  { word: "TAG", hint: "Tageslicht" },
  { word: "JAHR", hint: "Kalender" },
  { word: "WELT", hint: "Erde" },
  { word: "LICHT", hint: "Helligkeit" },
  { word: "ALARM", hint: "Warnung" },
];

export const WORDS_CLEAN = WORDS.filter((w) => !w.skip);

const REVERSE = new Map(
  Object.entries(MORSE).map(([ch, code]) => [code, ch])
);

/** Unit duration in ms. PARIS standard: 50 units per word → 1200 / WPM. */
export function unitMs(wpm) {
  const w = Number(wpm);
  if (!Number.isFinite(w) || w <= 0) throw new Error("WPM must be positive");
  return 1200 / w;
}

export function normalizeChar(ch) {
  if (ch == null) return "";
  const s = String(ch);
  if (s.length === 0) return "";
  return s.length === 1 ? s.toUpperCase() : s.toUpperCase();
}

export function codeFor(ch) {
  const key = normalizeChar(ch);
  return Object.prototype.hasOwnProperty.call(MORSE, key) ? MORSE[key] : null;
}

export function charForCode(code) {
  if (!code) return null;
  return REVERSE.get(code) || null;
}

export function encode(text, { wordGap = " / " } = {}) {
  const out = [];
  const up = String(text).toUpperCase();
  for (const raw of up.split(/(\s+)/)) {
    if (/^\s+$/.test(raw)) {
      out.push(wordGap.trim());
      continue;
    }
    const letters = [];
    for (const ch of raw) {
      const code = codeFor(ch);
      if (code) letters.push(code);
    }
    if (letters.length) out.push(letters.join(" "));
  }
  return out.join("   ");
}

export function decodeCodeString(codeStr) {
  return charForCode(String(codeStr).replace(/\s+/g, ""));
}

/**
 * Midpoint between dit (1 unit) and dah (3 units) is 2 units.
 * Mobile fingers are often slower than a strict unit, so the threshold
 * never falls below 180 ms.
 */
export function ditDahThresholdMs(wpm) {
  return Math.max(180, 2 * unitMs(wpm));
}

export function classifyPress(durationMs, wpm) {
  const d = Number(durationMs);
  if (!Number.isFinite(d) || d <= 0) return null;
  return d < ditDahThresholdMs(wpm) ? "." : "-";
}

/** Convert an array of hold durations (ms) into a Morse string. */
export function decodePresses(durationsMs, wpm) {
  const marks = [];
  for (const d of durationsMs) {
    const mark = classifyPress(d, wpm);
    if (mark) marks.push(mark);
  }
  return marks.join("");
}

export function codesMatch(a, b) {
  return String(a || "").replace(/\s+/g, "") === String(b || "").replace(/\s+/g, "");
}

export function displayName(ch) {
  const key = normalizeChar(ch);
  return CHAR_LABELS[key] || key;
}

export function mnemonicFor(ch) {
  const key = normalizeChar(ch);
  return MNEMONICS[key] || "";
}

/**
 * Timing timeline for a Morse string (one or more characters).
 * Farnsworth: marks & intra-character gaps use charWpm; inter-character
 * and word gaps are stretched so the overall rate approaches textWpm.
 */
export function timelineFor(source, { wpm = 15, farnsworth = false, charWpm = 18 } = {}) {
  const textWpm = Math.max(5, Number(wpm) || 15);
  const markWpm = farnsworth ? Math.max(textWpm, Number(charWpm) || 18) : textWpm;
  const dit = unitMs(markWpm);
  const interChar = 3 * unitMs(farnsworth ? textWpm : markWpm);
  const wordGap = 7 * unitMs(farnsworth ? textWpm : markWpm);

  const events = [];
  let t = 0;

  const pushMark = (kind) => {
    const dur = kind === "-" ? dit * 3 : dit;
    events.push({ type: "tone", start: t, duration: dur, mark: kind });
    t += dur;
  };

  const text = String(source);
  // Accept either a raw Morse string (".- / ...") or plain text ("SOS").
  const looksLikeMorse = /^[.\-\s/]+$/.test(text) && /[.\-]/.test(text);

  const words = looksLikeMorse
    ? text.trim().split(/\s*\/\s*|\s{3,}/)
    : text.toUpperCase().split(/\s+/);

  words.forEach((word, wi) => {
    if (wi > 0) t += wordGap;
    const chars = looksLikeMorse
      ? word.trim().split(/\s+/).filter(Boolean)
      : [...word].map((ch) => codeFor(ch)).filter(Boolean);
    chars.forEach((code, ci) => {
      if (ci > 0) t += interChar;
      const marks = [...code].filter((c) => c === "." || c === "-");
      marks.forEach((m, mi) => {
        if (mi > 0) t += dit; // intra-character gap = 1 unit at mark speed
        pushMark(m);
      });
    });
  });

  return { events, duration: t, dit, interChar, wordGap, markWpm, textWpm };
}

/** navigator.vibrate pattern: [on, off, on, off, ...]. */
export function vibratePattern(source, { wpm = 15, farnsworth = false, charWpm = 18 } = {}) {
  const { events, dit } = timelineFor(source, { wpm, farnsworth, charWpm });
  const pattern = [];
  let lastEnd = 0;
  for (const ev of events) {
    const off = ev.start - lastEnd;
    if (pattern.length === 0) {
      if (off > 0) pattern.push(0, Math.max(1, Math.round(off)));
    } else {
      pattern.push(Math.max(1, Math.round(off || 1)));
    }
    pattern.push(Math.max(1, Math.round(ev.duration)));
    lastEnd = ev.start + ev.duration;
  }
  return pattern.length ? pattern : [Math.round(dit)];
}

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a character from the unlocked set, with a boost for the newest one
 * and a mild boost for weak letters.
 */
export function pickChar(unlocked, letterStats = {}, { boostNewest = true } = {}) {
  if (!unlocked.length) return "E";
  const newest = unlocked[unlocked.length - 1];
  const weights = unlocked.map((ch) => {
    let w = 1;
    if (boostNewest && ch === newest && unlocked.length > 2) w += 1.2;
    const st = letterStats[ch];
    if (st) {
      const total = (st.ok || 0) + (st.fail || 0);
      if (total >= 3) {
        const acc = (st.ok || 0) / total;
        if (acc < 0.75) w += 0.8;
      }
    }
    return w;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < unlocked.length; i++) {
    r -= weights[i];
    if (r <= 0) return unlocked[i];
  }
  return unlocked[unlocked.length - 1];
}

/** Distractors: prefer codes of similar length or one-element difference. */
export function choiceSet(answer, unlocked, max = 8) {
  const pool = unlocked.filter((c) => c !== answer);
  const ac = codeFor(answer) || "";
  const scored = pool.map((c) => {
    const bc = codeFor(c) || "";
    let score = 0;
    if (bc.length === ac.length) score += 3;
    if (Math.abs(bc.length - ac.length) === 1) score += 1;
    const minL = Math.min(ac.length, bc.length);
    let same = 0;
    for (let i = 0; i < minL; i++) if (ac[i] === bc[i]) same++;
    score += same;
    score += Math.random() * 0.4;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const take = Math.min(Math.max(1, max - 1), scored.length);
  const picks = scored.slice(0, take).map((s) => s.c);
  const set = [answer, ...picks];
  for (let i = set.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [set[i], set[j]] = [set[j], set[i]];
  }
  return set;
}

export function wordsForUnlocked(unlocked) {
  const set = new Set(unlocked);
  return WORDS_CLEAN.filter((w) => [...w.word].every((ch) => set.has(ch)));
}

export function accuracy(history, windowSize = 20) {
  const slice = history.slice(-windowSize);
  if (!slice.length) return { n: 0, ok: 0, pct: 0 };
  const ok = slice.filter(Boolean).length;
  return { n: slice.length, ok, pct: ok / slice.length };
}

export function kochReady(history, { windowSize = 20, minN = 15, threshold = 0.9 } = {}) {
  const { n, pct } = accuracy(history, windowSize);
  return n >= minN && pct >= threshold;
}
