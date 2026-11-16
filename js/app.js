import {
  MORSE,
  KOCH_ORDER,
  LETTERS,
  DIGITS,
  PUNCTUATION,
  UMLAUTS,
  codeFor,
  mnemonicFor,
  displayName,
  codesMatch,
  classifyPress,
  ditDahThresholdMs,
  timelineFor,
  vibratePattern,
  pickChar,
  choiceSet,
  wordsForUnlocked,
  accuracy,
  kochReady,
  randomItem,
} from "./morse.js";
import {
  unlockAudio,
  playTimeline,
  stopPlayback,
  startSidetone,
  stopSidetone,
  playCue,
  playPitchPreview,
} from "./audio.js";

const STORE_KEY = "morse-trainer-v1";
const RANKS = [
  "Horcher",
  "Funkspruch",
  "Dit-Dah",
  "Lehrling",
  "Tastenfuchs",
  "Nachtfunker",
  "Stationswacht",
  "Funkmeister",
  "Morsemeister",
];
const DAILY_GOAL = 20;
const HISTORY_WINDOW = 20;
const MIN_KOCH = 15;

const DEFAULTS = {
  unlocked: 2,
  xp: 0,
  streak: 0,
  lastPlayDate: null,
  dailyCorrect: 0,
  dailyDate: null,
  bestBlitz: 0,
  settings: {
    wpm: 15,
    farnsworth: true,
    charWpm: 18,
    pitch: 600,
    volume: 0.7,
    vibration: true,
    sfx: true,
  },
  history: [],
  letterStats: {},
};

let state = loadState();
let view = "home";
let combo = 0;
let quiz = null;
let send = null;
let words = null;
let blitz = null;
let autoTimer = null;

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function yesterdayISO() {
  const parts = todayISO().split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...data,
      settings: { ...structuredClone(DEFAULTS.settings), ...(data.settings || {}) },
      history: Array.isArray(data.history) ? data.history : [],
      letterStats: data.letterStats || {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function unlockedChars() {
  return KOCH_ORDER.slice(0, Math.max(2, Math.min(state.unlocked, KOCH_ORDER.length)));
}

function levelOf(xp) {
  return Math.floor(xp / 120) + 1;
}

function rankOf(level) {
  return RANKS[Math.min(RANKS.length - 1, level - 1)];
}

function settingsAudio() {
  const s = state.settings;
  return {
    wpm: s.wpm,
    farnsworth: s.farnsworth,
    charWpm: s.charWpm,
    pitch: s.pitch,
    volume: s.volume,
  };
}

function canVibrate() {
  return !!(state.settings.vibration && navigator.vibrate);
}

function buzz(pattern) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(0);
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

function cue(kind) {
  if (state.settings.sfx) playCue(kind, { volume: state.settings.volume });
  if (kind === "ok") buzz(30);
  if (kind === "fail") buzz([40, 40, 40]);
}

function rollDaily() {
  const today = todayISO();
  if (state.dailyDate !== today) {
    if (state.lastPlayDate && state.lastPlayDate !== today && state.lastPlayDate !== yesterdayISO()) {
      state.streak = 0;
    }
    state.dailyDate = today;
    state.dailyCorrect = 0;
    saveState();
  }
}

function noteActivity() {
  const today = todayISO();
  if (state.lastPlayDate !== today) {
    if (state.lastPlayDate === yesterdayISO()) state.streak += 1;
    else state.streak = 1;
    state.lastPlayDate = today;
  }
}

function addXp(amount) {
  const before = levelOf(state.xp);
  state.xp += Math.max(0, amount);
  const after = levelOf(state.xp);
  if (after > before) {
    cue("level");
    confettiBurst(80);
    showModal("Level " + after + "!", "Neuer Rang: " + rankOf(after) + ".");
  }
}

function recordAnswer(ch, ok, { xp = 10, skipUnlock = false } = {}) {
  state.history.push(ok);
  if (state.history.length > 80) state.history = state.history.slice(-80);
  const st = state.letterStats[ch] || { ok: 0, fail: 0 };
  if (ok) st.ok += 1;
  else st.fail += 1;
  state.letterStats[ch] = st;

  if (ok) {
    combo += 1;
    noteActivity();
    rollDaily();
    const wasDaily = state.dailyCorrect;
    state.dailyCorrect += 1;
    let gained = xp + Math.min(15, Math.max(0, combo - 1) * 2);
    if (wasDaily < DAILY_GOAL && state.dailyCorrect >= DAILY_GOAL) {
      gained += 50;
      cue("level");
      confettiBurst(70);
      toast("Tagesziel geschafft! +50 XP");
    }
    addXp(gained);
    if (!skipUnlock) maybeUnlock();
  } else {
    combo = 0;
  }
  saveState();
  return ok;
}

function maybeUnlock() {
  if (state.unlocked >= KOCH_ORDER.length) return;
  if (!kochReady(state.history, { windowSize: HISTORY_WINDOW, minN: MIN_KOCH, threshold: 0.9 })) return;
  state.unlocked += 1;
  state.history = [];
  const ch = KOCH_ORDER[state.unlocked - 1];
  saveState();
  cue("level");
  confettiBurst(90);
  const title = "Neues Zeichen: " + ch;
  const code = prettyCode(codeFor(ch));
  const hint = mnemonicFor(ch);
  showModal(title, "Morse: " + code + (hint ? " · Merkwort: " + hint : "") + ". Ab jetzt ist es mit im Mix.");
}

function prettyCode(code) {
  return [...(code || "")].map((c) => (c === "." ? "·" : "–")).join(" ");
}

function accText() {
  const { n, ok, pct } = accuracy(state.history, HISTORY_WINDOW);
  if (!n) return "Noch keine Runde";
  return ok + "/" + n + " richtig (" + Math.round(pct * 100) + " %)";
}

/* ---------- views ---------- */
function showView(name) {
  view = name;
  stopPlayback();
  stopSidetone();
  clearTimeout(autoTimer);
  if (blitz && blitz.timer) {
    clearInterval(blitz.timer);
    blitz.timer = null;
  }
  $$(".view").forEach((el) => el.classList.add("hidden"));
  const map = {
    home: "view-home",
    listen: "view-quiz",
    vibe: "view-quiz",
    send: "view-send",
    words: "view-words",
    blitz: "view-blitz",
    cards: "view-cards",
    settings: "view-settings",
  };
  const id = map[name] || "view-home";
  $(id).classList.remove("hidden");
  if (name === "home") renderHome();
  if (name === "listen" || name === "vibe") startQuiz(name);
  if (name === "send") startSend();
  if (name === "words") startWords();
  if (name === "blitz") startBlitzIntro();
  if (name === "cards") renderCards();
  if (name === "settings") renderSettings();
  window.scrollTo(0, 0);
}

function renderHome() {
  rollDaily();
  const level = levelOf(state.xp);
  $("stat-level").textContent = String(level);
  $("stat-rank").textContent = rankOf(level);
  $("stat-xp").textContent = String(state.xp);
  $("stat-streak").textContent = String(state.streak);
  $("stat-unlocked").textContent = String(unlockedChars().length);
  $("daily-text").textContent = state.dailyCorrect + " / " + DAILY_GOAL;
  $("daily-fill").style.width = Math.min(100, (state.dailyCorrect / DAILY_GOAL) * 100) + "%";
  $("daily-box").classList.toggle("done", state.dailyCorrect >= DAILY_GOAL);

  const hint = $("next-hint");
  if (state.unlocked >= KOCH_ORDER.length) {
    hint.classList.remove("hidden");
    hint.textContent = "Alle Koch-Zeichen sind offen. Weiter festigen!";
  } else {
    const { n, pct } = accuracy(state.history, HISTORY_WINDOW);
    const next = KOCH_ORDER[state.unlocked];
    hint.classList.remove("hidden");
    if (n < MIN_KOCH) {
      hint.textContent = "Noch " + (MIN_KOCH - n) + " Antworten, dann Prüfung auf das nächste Zeichen (" + next + ").";
    } else {
      hint.textContent = Math.round(pct * 100) + " % der letzten " + n + ". Ab 90 % kommt " + next + " dazu.";
    }
  }

  const usable = wordsForUnlocked(unlockedChars());
  const wordsBtn = $("mode-words");
  if (usable.length < 3) {
    wordsBtn.disabled = true;
    $("words-sub").textContent = "Bald, sobald mehr Zeichen offen sind";
  } else {
    wordsBtn.disabled = false;
    $("words-sub").textContent = usable.length + " Wörter mit deinen Zeichen";
  }
}

/* ---------- audio / haptic playback ---------- */
function playChar(ch, { lamp, onEnd } = {}) {
  const tl = timelineFor(ch, settingsAudio());
  if (lamp) {
    const start = performance.now();
    const tick = () => {
      if (view !== "listen" && view !== "vibe" && view !== "blitz" && view !== "words" && view !== "cards") {
        lamp.classList.remove("on");
        return;
      }
      const t = performance.now() - start;
      const on = tl.events.some((e) => t >= e.start && t < e.start + e.duration);
      lamp.classList.toggle("on", on);
      if (t < tl.duration + 30) requestAnimationFrame(tick);
      else lamp.classList.remove("on");
    };
    requestAnimationFrame(tick);
  }
  playTimeline(tl, { ...settingsAudio(), onEnd });
  return tl.duration;
}

function vibeChar(ch) {
  const pattern = vibratePattern(ch, settingsAudio());
  buzz(pattern);
  return pattern.reduce((a, b) => a + b, 0);
}

/* ---------- quiz: listen / vibe ---------- */
function startQuiz(mode) {
  quiz = { mode, current: null, locked: false };
  $("quiz-title").textContent = mode === "vibe" ? "Fühlen" : "Hören";
  $("btn-play").textContent = mode === "vibe" ? "Fühlen" : "Abspielen";
  updateComboUI("combo", "combo-n");
  nextQuiz(true);
}

function updateComboUI(wrapId, numId) {
  const el = $(wrapId);
  if (combo >= 2) {
    el.hidden = false;
    $(numId).textContent = String(combo);
  } else {
    el.hidden = true;
  }
}

function nextQuiz(autoPlay) {
  const unlocked = unlockedChars();
  const ch = pickChar(unlocked, state.letterStats);
  quiz.current = ch;
  quiz.locked = false;
  $("quiz-pattern").hidden = true;
  $("quiz-pattern").textContent = "";
  $("quiz-feedback").textContent = "";
  $("quiz-feedback").className = "feedback";
  $("quiz-acc").textContent = accText();
  updateComboUI("combo", "combo-n");
  renderChoices($("choice-grid"), choiceSet(ch, unlocked, unlocked.length <= 8 ? unlocked.length : 8), onQuizChoice);
  if (autoPlay && quiz.mode !== "vibe") setTimeout(() => triggerQuizPlay(), 180);
}

function triggerQuizPlay() {
  if (!quiz || quiz.locked) return;
  if (quiz.mode === "vibe") {
    if (!navigator.vibrate) {
      $("quiz-feedback").textContent = "Dieses Gerät gibt keine Vibration frei. Versuch’s unter Hören.";
      $("quiz-feedback").className = "feedback fail";
      return;
    }
    if (!state.settings.vibration) {
      $("quiz-feedback").textContent = "Vibration ist in den Einstellungen aus.";
      $("quiz-feedback").className = "feedback fail";
      return;
    }
    vibeChar(quiz.current);
  } else {
    playChar(quiz.current, { lamp: $("lamp") });
  }
}

function onQuizChoice(ch, btn) {
  if (!quiz || quiz.locked) return;
  quiz.locked = true;
  const ok = ch === quiz.current;
  $$(".choice", $("choice-grid")).forEach((b) => {
    b.disabled = true;
    if (b.dataset.ch === quiz.current) b.classList.add("correct");
  });
  if (!ok) btn.classList.add("wrong");
  $("quiz-pattern").hidden = false;
  $("quiz-pattern").textContent = prettyCode(codeFor(quiz.current));
  $("quiz-feedback").textContent = ok ? "Richtig!" : "Das war " + quiz.current;
  $("quiz-feedback").className = "feedback " + (ok ? "ok" : "fail");
  cue(ok ? "ok" : "fail");
  recordAnswer(quiz.current, ok);
  autoTimer = setTimeout(() => nextQuiz(true), ok ? 750 : 1300);
}

function renderChoices(grid, items, handler) {
  grid.innerHTML = "";
  for (const ch of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.dataset.ch = ch;
    b.textContent = ch;
    b.addEventListener("click", () => handler(ch, b));
    grid.appendChild(b);
  }
}

/* ---------- send ---------- */
function startSend() {
  send = { current: null, marks: [], holding: false, start: 0, idle: null };
  bindKey();
  nextSend();
}

function nextSend() {
  stopSidetone();
  const unlocked = unlockedChars();
  send.current = pickChar(unlocked, state.letterStats);
  send.marks = [];
  send.holding = false;
  $("send-letter").textContent = send.current;
  $("send-pattern").textContent = "";
  $("send-feedback").textContent = "";
  $("send-feedback").className = "feedback";
  $("send-acc").textContent = accText();
  $("key-hint").textContent = "kurz = Dit, lang = Dah";
  $("key-cap").textContent = "•  /  –";
  updateComboUI("send-combo", "send-combo-n");
}

function appendMark(mark) {
  if (!send || !mark) return;
  send.marks.push(mark);
  $("send-pattern").textContent = prettyCode(send.marks.join(""));
  scheduleIdleCheck();
}

function scheduleIdleCheck() {
  clearTimeout(send.idle);
  const wait = Math.max(650, ditDahThresholdMs(state.settings.wpm) * 2.2);
  send.idle = setTimeout(() => {
    if (send && send.marks.length && !send.holding) maybeAutoSubmit();
  }, wait);
}

function maybeAutoSubmit() {
  if (!send || !send.marks.length) return;
  const got = send.marks.join("");
  const expect = codeFor(send.current);
  if (codesMatch(got, expect)) submitSend();
}

function submitSend() {
  if (!send || !send.marks.length) return;
  clearTimeout(send.idle);
  const got = send.marks.join("");
  const expect = codeFor(send.current);
  const ok = codesMatch(got, expect);
  $("send-feedback").textContent = ok
    ? "Sauber gegeben!"
    : "Ziel: " + prettyCode(expect) + "  ·  du: " + prettyCode(got);
  $("send-feedback").className = "feedback " + (ok ? "ok" : "fail");
  cue(ok ? "ok" : "fail");
  recordAnswer(send.current, ok, { xp: 12 });
  const current = send.current;
  send.marks = [];
  autoTimer = setTimeout(() => {
    if (!ok) playChar(current);
    nextSend();
  }, ok ? 800 : 1400);
}

function keyDown(ev) {
  if (!send || send.holding) return;
  if (ev && ev.cancelable) ev.preventDefault();
  send.holding = true;
  send.start = performance.now();
  $("morse-key").classList.add("down");
  $("key-cap").textContent = "·";
  startSidetone(state.settings.pitch, state.settings.volume);
  send.holdWatch = requestAnimationFrame(function watch() {
    if (!send || !send.holding) return;
    const d = performance.now() - send.start;
    const dah = classifyPress(d, state.settings.wpm) === "-";
    $("morse-key").classList.toggle("dah-hold", dah);
    $("key-cap").textContent = dah ? "–" : "·";
    send.holdWatch = requestAnimationFrame(watch);
  });
}

function keyUp(ev) {
  if (!send || !send.holding) return;
  if (ev && ev.cancelable) ev.preventDefault();
  send.holding = false;
  cancelAnimationFrame(send.holdWatch);
  $("morse-key").classList.remove("down", "dah-hold");
  stopSidetone();
  const d = performance.now() - send.start;
  const mark = classifyPress(d, state.settings.wpm);
  if (mark) appendMark(mark);
}

let keyBound = false;
function bindKey() {
  if (keyBound) return;
  keyBound = true;
  const key = $("morse-key");
  key.addEventListener("pointerdown", (e) => {
    try { key.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    keyDown(e);
  });
  key.addEventListener("pointerup", keyUp);
  key.addEventListener("pointercancel", keyUp);
  key.addEventListener("lostpointercapture", keyUp);
  key.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* ---------- words ---------- */
function startWords() {
  const unlocked = unlockedChars();
  const pool = wordsForUnlocked(unlocked);
  if (pool.length < 1) {
    toast("Noch zu wenige Zeichen für Wörter.");
    showView("home");
    return;
  }
  words = { pool, current: null, typed: "" };
  updateComboUI("words-combo", "words-combo-n");
  nextWord(true);
}

function nextWord(autoPlay) {
  const pick = randomItem(words.pool);
  words.current = pick;
  words.typed = "";
  $("word-hint").textContent = pick.hint || "";
  $("word-feedback").textContent = "";
  $("word-feedback").className = "feedback";
  $("words-acc").textContent = accText();
  updateComboUI("words-combo", "words-combo-n");
  renderWordSlots();
  renderChoices($("word-grid"), unlockedChars(), onWordChoice);
  if (autoPlay) setTimeout(() => playChar(pick.word, { lamp: null }), 200);
}

function renderWordSlots() {
  const w = words.current.word;
  const box = $("word-slots");
  box.innerHTML = "";
  for (let i = 0; i < w.length; i++) {
    const s = document.createElement("span");
    s.className = "slot" + (words.typed[i] ? " filled" : "");
    s.textContent = words.typed[i] || "";
    box.appendChild(s);
  }
}

function onWordChoice(ch) {
  if (!words || !words.current) return;
  const target = words.current.word;
  if (words.typed.length >= target.length) return;
  const next = target[words.typed.length];
  if (ch !== next) {
    $("word-feedback").textContent = "Nicht " + ch + " – hör nochmal hin.";
    $("word-feedback").className = "feedback fail";
    cue("fail");
    recordAnswer(next, false, { xp: 8 });
    return;
  }
  words.typed += ch;
  renderWordSlots();
  if (words.typed === target) {
    $("word-feedback").textContent = "Treffer: " + target;
    $("word-feedback").className = "feedback ok";
    cue("ok");
    recordAnswer(target[target.length - 1], true, { xp: 16 });
    autoTimer = setTimeout(() => nextWord(true), 900);
  }
}

/* ---------- blitz ---------- */
function startBlitzIntro() {
  blitz = { running: false, score: 0, time: 60, current: null, locked: false, timer: null, combo: 0 };
  $("blitz-play").classList.add("hidden");
  $("blitz-end").classList.add("hidden");
  $("blitz-intro").classList.remove("hidden");
  $("blitz-best").textContent = String(state.bestBlitz);
  $("blitz-time").textContent = "60";
  $("blitz-score").textContent = "0";
}

function runBlitz() {
  stopPlayback();
  if (blitz.timer) clearInterval(blitz.timer);
  blitz = { running: true, score: 0, time: 60, current: null, locked: false, timer: null, combo: 0 };
  combo = 0;
  $("blitz-intro").classList.add("hidden");
  $("blitz-end").classList.add("hidden");
  $("blitz-play").classList.remove("hidden");
  $("blitz-score").textContent = "0";
  $("blitz-time").textContent = "60";
  cue("blitz");
  nextBlitz(true);
  blitz.timer = setInterval(() => {
    blitz.time -= 1;
    $("blitz-time").textContent = String(blitz.time);
    if (blitz.time <= 0) endBlitz();
  }, 1000);
}

function nextBlitz(autoPlay) {
  if (!blitz || !blitz.running) return;
  const unlocked = unlockedChars();
  blitz.current = pickChar(unlocked, state.letterStats, { boostNewest: false });
  blitz.locked = false;
  $("blitz-feedback").textContent = "";
  $("blitz-feedback").className = "feedback";
  updateComboUI("blitz-combo", "blitz-combo-n");
  renderChoices($("blitz-grid"), choiceSet(blitz.current, unlocked, Math.min(8, unlocked.length)), onBlitzChoice);
  if (autoPlay) setTimeout(() => {
    if (blitz && blitz.running) playChar(blitz.current, { lamp: $("blitz-lamp") });
  }, 120);
}

function onBlitzChoice(ch, btn) {
  if (!blitz || !blitz.running || blitz.locked) return;
  blitz.locked = true;
  const ok = ch === blitz.current;
  if (ok) {
    blitz.combo += 1;
    combo = blitz.combo;
    const gain = 10 + Math.min(20, (blitz.combo - 1) * 2);
    blitz.score += gain;
    $("blitz-feedback").textContent = "+" + gain;
    $("blitz-feedback").className = "feedback ok";
    cue("ok");
    recordAnswer(blitz.current, true, { xp: 4, skipUnlock: true });
  } else {
    blitz.combo = 0;
    combo = 0;
    $("blitz-feedback").textContent = "War " + blitz.current;
    $("blitz-feedback").className = "feedback fail";
    cue("fail");
    recordAnswer(blitz.current, false, { xp: 0, skipUnlock: true });
  }
  $("blitz-score").textContent = String(blitz.score);
  autoTimer = setTimeout(() => nextBlitz(true), ok ? 280 : 600);
}

function endBlitz() {
  if (!blitz) return;
  blitz.running = false;
  clearInterval(blitz.timer);
  blitz.timer = null;
  stopPlayback();
  $("blitz-play").classList.add("hidden");
  $("blitz-end").classList.remove("hidden");
  $("blitz-final").textContent = String(blitz.score);
  let msg = "Zeit um!";
  if (blitz.score > state.bestBlitz) {
    state.bestBlitz = blitz.score;
    saveState();
    msg = "Neue Bestleistung!";
    confettiBurst(90);
    cue("level");
    addXp(30);
  } else {
    addXp(Math.floor(blitz.score / 4));
  }
  $("blitz-end-msg").textContent = msg + (state.bestBlitz ? "  Bestleistung: " + state.bestBlitz : "");
  maybeUnlock();
}

/* ---------- cards ---------- */
let cardFilter = "letters";

function renderCards() {
  $$(".filters .chip").forEach((c) => c.classList.toggle("on", c.dataset.filter === cardFilter));
  let list;
  if (cardFilter === "letters") list = LETTERS;
  else if (cardFilter === "digits") list = DIGITS;
  else if (cardFilter === "punct") list = PUNCTUATION;
  else if (cardFilter === "umlauts") list = UMLAUTS;
  else list = [...LETTERS, ...DIGITS, ...PUNCTUATION, ...UMLAUTS];

  const open = new Set(unlockedChars());
  const box = $("card-list");
  box.innerHTML = "";
  for (const ch of list) {
    const code = codeFor(ch);
    if (!code) continue;
    const row = document.createElement("div");
    row.className = "morse-row" + (open.has(ch) ? "" : " locked");
    const mn = mnemonicFor(ch);
    const label = displayName(ch);
    row.innerHTML =
      '<div class="morse-glyph">' + escapeHtml(ch) + "</div>" +
      '<div class="morse-meta"><div class="morse-code">' + prettyCode(code) + "</div>" +
      (mn ? '<div class="morse-mn">' + escapeHtml(mn) + "</div>" : (label !== ch ? '<div class="morse-mn">' + escapeHtml(label) + "</div>" : "")) +
      "</div>";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "play-mini";
    play.setAttribute("aria-label", ch + " abspielen");
    play.textContent = "▶";
    play.addEventListener("click", () => playChar(ch));
    row.appendChild(play);
    box.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- settings ---------- */
function renderSettings() {
  const s = state.settings;
  $("set-wpm").value = String(s.wpm);
  $("val-wpm").textContent = String(s.wpm);
  $("set-farnsworth").checked = !!s.farnsworth;
  $("set-pitch").value = String(s.pitch);
  $("val-pitch").textContent = String(s.pitch);
  $("set-volume").value = String(Math.round(s.volume * 100));
  $("val-volume").textContent = String(Math.round(s.volume * 100));
  $("set-vibration").checked = !!s.vibration;
  $("set-sfx").checked = !!s.sfx;
}

function bindSettings() {
  $("set-wpm").addEventListener("input", (e) => {
    state.settings.wpm = Number(e.target.value);
    $("val-wpm").textContent = String(state.settings.wpm);
    saveState();
  });
  $("set-farnsworth").addEventListener("change", (e) => {
    state.settings.farnsworth = e.target.checked;
    saveState();
  });
  $("set-pitch").addEventListener("input", (e) => {
    state.settings.pitch = Number(e.target.value);
    $("val-pitch").textContent = String(state.settings.pitch);
    saveState();
  });
  $("set-pitch").addEventListener("change", () => {
    playPitchPreview(state.settings.pitch, state.settings.volume);
  });
  $("set-volume").addEventListener("input", (e) => {
    state.settings.volume = Number(e.target.value) / 100;
    $("val-volume").textContent = String(e.target.value);
    saveState();
  });
  $("set-vibration").addEventListener("change", (e) => {
    state.settings.vibration = e.target.checked;
    saveState();
    if (e.target.checked) buzz(40);
  });
  $("set-sfx").addEventListener("change", (e) => {
    state.settings.sfx = e.target.checked;
    saveState();
  });
  $("btn-preview").addEventListener("click", () => playChar("K"));
  $("btn-reset").addEventListener("click", () => {
    if (!confirm("Wirklich allen Fortschritt löschen? Zeichen, XP und Serie fallen auf den Anfang zurück.")) return;
    const settings = { ...state.settings };
    state = structuredClone(DEFAULTS);
    state.settings = settings;
    combo = 0;
    saveState();
    toast("Fortschritt zurückgesetzt.");
    renderSettings();
  });
}

/* ---------- modal / toast / confetti ---------- */
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}

function showModal(title, body) {
  $("modal-title").textContent = title;
  $("modal-body").textContent = body;
  $("modal").classList.remove("hidden");
}

function hideModal() {
  $("modal").classList.add("hidden");
}

function confettiBurst(n = 60) {
  const canvas = $("confetti");
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const W = canvas.width;
  const H = canvas.height;
  const colors = ["#ffb020", "#3ee0c4", "#ff6b7a", "#eef2fb", "#3ddc8e", "#ffcf6b"];
  const bits = Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: -Math.random() * H * 0.2,
    vx: (Math.random() - 0.5) * 6 * dpr,
    vy: (2 + Math.random() * 5) * dpr,
    w: (4 + Math.random() * 6) * dpr,
    h: (6 + Math.random() * 8) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const tick = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.08 * dpr;
      b.rot += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (t < 1600) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(tick);
}

/* ---------- init ---------- */
async function enter() {
  try {
    await unlockAudio();
  } catch {
    /* Audio may still start on later taps */
  }
  if (canVibrate()) {
    try { navigator.vibrate(20); } catch { /* ignore */ }
  }
  $("gate").classList.add("hidden");
  $("app").classList.remove("hidden");
  showView("home");
}

function bindUI() {
  $("btn-enter").addEventListener("click", enter);
  $$(".mode-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      showView(btn.dataset.mode);
    });
  });
  $$("[data-go]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.go)));
  $("btn-settings").addEventListener("click", () => showView("settings"));
  $("btn-play").addEventListener("click", triggerQuizPlay);
  $("btn-dit").addEventListener("click", () => appendMark("."));
  $("btn-dah").addEventListener("click", () => appendMark("-"));
  $("btn-clear").addEventListener("click", () => {
    if (!send) return;
    send.marks = [];
    $("send-pattern").textContent = "";
    $("send-feedback").textContent = "";
  });
  $("btn-send-ok").addEventListener("click", submitSend);
  $("btn-play-word").addEventListener("click", () => {
    if (words && words.current) playChar(words.current.word);
  });
  $("btn-word-clear").addEventListener("click", () => {
    if (!words) return;
    words.typed = "";
    renderWordSlots();
  });
  $("btn-word-skip").addEventListener("click", () => nextWord(true));
  $("btn-blitz-start").addEventListener("click", runBlitz);
  $("btn-blitz-again").addEventListener("click", runBlitz);
  $("btn-play-blitz").addEventListener("click", () => {
    if (blitz && blitz.current) playChar(blitz.current, { lamp: $("blitz-lamp") });
  });
  $$(".filters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      cardFilter = chip.dataset.filter;
      renderCards();
    });
  });
  $("modal-ok").addEventListener("click", hideModal);
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") hideModal();
  });
  bindSettings();
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline first later */ });
  });
}

bindUI();
registerSW();
rollDaily();
