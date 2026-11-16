import {
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
  sendThresholdMs,
  updateTapAverages,
  timelineFor,
  vibratePattern,
  pickChar,
  choiceSet,
  wordsForUnlocked,
  accuracy,
  kochReady,
  randomItem,
  prettyCode,
  formatCompare,
  levelOf,
  xpToNextLevel,
  minUnlockForWords,
  pickGreeting,
  weakestChar,
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
const WORDS_MIN = 3;
const BLITZ_MIN_CHARS = 6;
const VIBE_MIN_CHARS = 4;

const DEFAULTS = {
  unlocked: 2,
  xp: 0,
  streak: 0,
  lastPlayDate: null,
  dailyCorrect: 0,
  dailyDate: null,
  bestBlitz: 0,
  introSeen: false,
  introduced: [],
  tapStats: { ditMs: 0, dahMs: 0, ditN: 0, dahN: 0 },
  settings: {
    wpm: 15,
    sendWpm: 10,
    farnsworth: true,
    charWpm: 18,
    pitch: 600,
    volume: 0.7,
    vibration: true,
    sfx: true,
    easySend: false,
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
let playGen = 0;
let pendingAdvance = null;
const noticeQueue = [];
let overlayBusy = false;
let lessonOnDone = null;
let modalOnDismiss = null;

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

function hasDeviceVibrate() {
  return typeof navigator.vibrate === "function";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isAppleTouch() {
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    const merged = {
      ...structuredClone(DEFAULTS),
      ...data,
      settings: { ...structuredClone(DEFAULTS.settings), ...(data.settings || {}) },
      history: Array.isArray(data.history) ? data.history : [],
      letterStats: data.letterStats || {},
      tapStats: { ...structuredClone(DEFAULTS.tapStats), ...(data.tapStats || {}) },
    };
    // Existing progress from before this update: treat already-unlocked
    // characters as introduced, skip the first-start lesson.
    if (data.introSeen == null && data.introduced == null) {
      const returning = (data.xp || 0) > 0 || (data.unlocked || 0) > 2 ||
        (Array.isArray(data.history) && data.history.length > 0) || !!data.lastPlayDate;
      if (returning) {
        merged.introSeen = true;
        merged.introduced = KOCH_ORDER.slice(0, Math.max(2, merged.unlocked));
      } else {
        merged.introSeen = false;
        merged.introduced = [];
      }
    }
    return merged;
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

function currentSendThreshold() {
  return sendThresholdMs(state.settings.sendWpm || 10, state.tapStats);
}

function canVibrate() {
  return !!(state.settings.vibration && hasDeviceVibrate());
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
    enqueueNotice({
      type: "level",
      title: "Level " + after + "!",
      body: "Neuer Rang: " + rankOf(after) + ".",
    });
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
      enqueueNotice({ type: "daily" });
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
  enqueueNotice({ type: "new-char", ch });
}

function accText() {
  const { n, ok, pct } = accuracy(state.history, HISTORY_WINDOW);
  if (!n) return "Noch keine Runde";
  return ok + "/" + n + " richtig (" + Math.round(pct * 100) + " %)";
}

function overlayOpen() {
  return overlayBusy || !$("modal").classList.contains("hidden") || !$("lesson").classList.contains("hidden");
}

function haltMedia() {
  playGen += 1;
  stopPlayback();
  stopSidetone();
  $$(".lamp").forEach((el) => el.classList.remove("on"));
}

function scheduleAdvance(fn, delay) {
  clearTimeout(autoTimer);
  pendingAdvance = fn;
  if (overlayOpen() || noticeQueue.length) return;
  autoTimer = setTimeout(() => {
    if (overlayOpen()) return;
    pendingAdvance = null;
    fn();
  }, delay);
}

function clearAdvance() {
  clearTimeout(autoTimer);
  autoTimer = null;
  pendingAdvance = null;
}

function flushAdvance() {
  if (overlayOpen() || noticeQueue.length) return;
  const fn = pendingAdvance;
  if (!fn) return;
  pendingAdvance = null;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (overlayOpen()) return;
    fn();
  }, 280);
}

const NOTICE_PRIORITY = { "new-char": 0, level: 1, daily: 2 };

function enqueueNotice(notice) {
  noticeQueue.push(notice);
  noticeQueue.sort((a, b) => (NOTICE_PRIORITY[a.type] ?? 9) - (NOTICE_PRIORITY[b.type] ?? 9));
  queueMicrotask(pumpNotices);
}

function pumpNotices() {
  if (overlayBusy) return;
  noticeQueue.sort((a, b) => (NOTICE_PRIORITY[a.type] ?? 9) - (NOTICE_PRIORITY[b.type] ?? 9));
  const next = noticeQueue.shift();
  if (!next) {
    flushAdvance();
    return;
  }
  if (next.type === "new-char") {
    openLesson({
      chars: [next.ch],
      title: "Neues Zeichen: " + next.ch,
      lead: "Tippe auf die Karte, um den Ton zu hören. Ab jetzt ist es mit im Mix.",
      button: "Weiter",
    });
    return;
  }
  if (next.type === "daily") {
    showDailyReward();
    return;
  }
  showModal({ title: next.title, body: next.body });
}

function closeOverlays() {
  $("modal").classList.add("hidden");
  $("modal-body").innerHTML = "";
  modalOnDismiss = null;
  if (!$("lesson").classList.contains("hidden")) {
    $("lesson").classList.add("hidden");
    const done = lessonOnDone;
    lessonOnDone = null;
    if (state.introduced) saveState();
    overlayBusy = false;
    if (done) done();
    pumpNotices();
    return;
  }
  overlayBusy = false;
  pumpNotices();
}

function showModal({ title, body, html, onDismiss } = {}) {
  overlayBusy = true;
  clearTimeout(autoTimer);
  haltMedia();
  $("modal-title").textContent = title || "";
  const box = $("modal-body");
  box.innerHTML = "";
  if (html) box.appendChild(html);
  else {
    const p = document.createElement("p");
    p.textContent = body || "";
    box.appendChild(p);
  }
  modalOnDismiss = onDismiss || null;
  $("modal").classList.remove("hidden");
}

function showDailyReward() {
  const g = pickGreeting(unlockedChars());
  const wrap = document.createElement("div");
  const intro = document.createElement("p");
  intro.textContent = "Tagesziel geschafft! +50 XP. Hier ist ein Morse-Gruß für dich:";
  const code = document.createElement("p");
  code.className = "reward-code";
  code.textContent = prettyCode(encodeWord(g.text));
  const reveal = document.createElement("p");
  reveal.hidden = true;
  reveal.innerHTML = "<strong>" + escapeHtml(g.text) + "</strong> — " + escapeHtml(g.hint);
  const actions = document.createElement("div");
  actions.className = "reward-actions";
  const play = document.createElement("button");
  play.type = "button";
  play.className = "btn btn-play";
  play.textContent = "Abspielen";
  play.addEventListener("click", () => playChar(g.text));
  const solve = document.createElement("button");
  solve.type = "button";
  solve.className = "btn btn-ghost";
  solve.textContent = "Auflösen";
  solve.addEventListener("click", () => { reveal.hidden = false; solve.disabled = true; });
  actions.append(play, solve);
  wrap.append(intro, code, actions, reveal);
  showModal({ title: "Tagesziel", html: wrap });
}

function encodeWord(text) {
  return [...String(text).toUpperCase()].map((ch) => codeFor(ch) || "").filter(Boolean).join(" ");
}

function openLesson({ chars, title, lead, button, onDone } = {}) {
  overlayBusy = true;
  clearTimeout(autoTimer);
  haltMedia();
  lessonOnDone = onDone || null;
  $("lesson-title").textContent = title || "Neues Zeichen";
  $("lesson-lead").textContent = lead || "Tippe auf eine Karte, um den Ton zu hören.";
  $("lesson-go").textContent = button || "Weiter";
  const box = $("lesson-cards");
  box.innerHTML = "";
  box.classList.toggle("pair", (chars || []).length > 1);
  for (const ch of chars || []) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "lesson-char";
    card.setAttribute("aria-label", ch + " abspielen");
    const glyph = document.createElement("span");
    glyph.className = "lesson-glyph";
    glyph.textContent = ch;
    const code = document.createElement("span");
    code.className = "lesson-code";
    code.textContent = prettyCode(codeFor(ch));
    const mn = mnemonicFor(ch);
    const word = document.createElement("span");
    word.className = "lesson-mn";
    word.textContent = mn ? "Merkwort: " + mn : "";
    const hint = document.createElement("span");
    hint.className = "lesson-play";
    hint.textContent = "Tippen zum Anhören";
    card.append(glyph, code, word, hint);
    card.addEventListener("click", () => playChar(ch));
    box.appendChild(card);
  }
  $("lesson").classList.remove("hidden");
}

function finishLesson() {
  const chars = $$(".lesson-char .lesson-glyph").map((el) => el.textContent);
  const seen = new Set(state.introduced || []);
  for (const ch of chars) seen.add(ch);
  state.introduced = KOCH_ORDER.filter((ch) => seen.has(ch));
  state.introSeen = true;
  saveState();
  closeOverlays();
}

/* ---------- views ---------- */
function showView(name) {
  view = name;
  clearAdvance();
  haltMedia();
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
  const rank = rankOf(level);
  const remain = xpToNextLevel(state.xp);
  const nextRank = level < RANKS.length ? RANKS[level] : null;
  const xpLine = $("xp-line");
  xpLine.innerHTML = "<span><strong>" + state.xp + " XP</strong> · " + escapeHtml(rank) + "</span>" +
    (nextRank ? '<span class="xp-next">noch ' + remain + " XP bis " + escapeHtml(nextRank) + "</span>" : "");

  $("stat-streak").textContent = String(state.streak);
  $("stat-unlocked").textContent = String(unlockedChars().length);
  $("daily-text").textContent = state.dailyCorrect + " / " + DAILY_GOAL;
  $("daily-fill").style.width = Math.min(100, (state.dailyCorrect / DAILY_GOAL) * 100) + "%";
  $("daily-box").classList.toggle("done", state.dailyCorrect >= DAILY_GOAL);

  const hint = $("next-hint");
  const label = $("unlock-label");
  const text = $("unlock-text");
  const fill = $("unlock-fill");
  if (state.unlocked >= KOCH_ORDER.length) {
    hint.classList.remove("hidden");
    label.textContent = "Alle Zeichen offen";
    text.textContent = "Weiter festigen!";
    fill.style.width = "100%";
  } else {
    const { n, pct } = accuracy(state.history, HISTORY_WINDOW);
    const next = KOCH_ORDER[state.unlocked];
    hint.classList.remove("hidden");
    label.textContent = "Nächstes Zeichen: " + next;
    let ratio;
    if (n < MIN_KOCH) {
      ratio = n / MIN_KOCH;
      text.textContent = n + " / " + MIN_KOCH + " Antworten";
    } else {
      ratio = Math.min(1, pct / 0.9);
      text.textContent = Math.round(pct * 100) + " % · ab 90 % kommt " + next;
    }
    fill.style.width = Math.round(ratio * 100) + "%";
  }

  const openCount = unlockedChars().length;
  const usable = wordsForUnlocked(unlockedChars());
  const needWords = minUnlockForWords(WORDS_MIN);

  setModeLock($("mode-words"), usable.length < WORDS_MIN,
    usable.length >= WORDS_MIN ? usable.length + " Wörter mit deinen Zeichen" : "ab " + needWords + " Zeichen",
    $("words-sub"));

  setModeLock($("mode-blitz"), openCount < BLITZ_MIN_CHARS,
    openCount < BLITZ_MIN_CHARS ? "ab " + BLITZ_MIN_CHARS + " Zeichen" : "60 Sekunden, so viele wie möglich",
    $("blitz-sub"));

  const vibeBtn = $("mode-vibe");
  if (!hasDeviceVibrate()) {
    setModeLock(vibeBtn, true, "auf diesem Gerät nicht verfügbar", $("vibe-sub"));
  } else {
    setModeLock(vibeBtn, openCount < VIBE_MIN_CHARS,
      openCount < VIBE_MIN_CHARS ? "ab " + VIBE_MIN_CHARS + " Zeichen" : "Vibration → raten",
      $("vibe-sub"));
  }

  const install = $("install-hint");
  if (isStandalone()) {
    install.classList.add("hidden");
  } else {
    install.classList.remove("hidden");
    install.innerHTML = isAppleTouch()
      ? "Tipp: <strong>Teilen → Zum Home-Bildschirm</strong> — dann geht’s auch offline."
      : "Tipp: Im Chrome-Menü <strong>Zum Startbildschirm hinzufügen</strong> wählen – dann geht’s auch offline.";
  }
}

function setModeLock(btn, locked, subtitle, subEl) {
  btn.disabled = !!locked;
  if (subEl) subEl.textContent = subtitle;
}

/* ---------- audio / haptic playback ---------- */
function playChar(ch, { lamp, onEnd } = {}) {
  const tl = timelineFor(ch, settingsAudio());
  const gen = playGen;
  if (lamp) {
    const start = performance.now();
    const tick = () => {
      if (gen !== playGen) {
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
  playTimeline(tl, {
    ...settingsAudio(),
    onEnd: () => {
      if (gen !== playGen) return;
      if (onEnd) onEnd();
    },
  });
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
  $("btn-quiz-next").classList.add("hidden");
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
  $("quiz-compare").hidden = true;
  $("quiz-compare").textContent = "";
  $("quiz-feedback").textContent = "";
  $("quiz-feedback").className = "feedback";
  $("btn-quiz-next").classList.add("hidden");
  $("quiz-acc").textContent = accText();
  updateComboUI("combo", "combo-n");
  renderChoices($("choice-grid"), choiceSet(ch, unlocked, unlocked.length <= 8 ? unlocked.length : 8), onQuizChoice);
  if (autoPlay && quiz.mode !== "vibe") scheduleAdvance(() => triggerQuizPlay(), 180);
}

function triggerQuizPlay() {
  if (!quiz || quiz.locked) return;
  if (overlayOpen()) return;
  if (quiz.mode === "vibe") {
    if (!hasDeviceVibrate()) {
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
  $("quiz-pattern").hidden = true;
  if (ok) {
    $("quiz-compare").hidden = true;
    $("quiz-feedback").textContent = "Richtig!";
    $("quiz-feedback").className = "feedback ok";
    $("btn-quiz-next").classList.add("hidden");
  } else {
    $("quiz-compare").hidden = false;
    $("quiz-compare").textContent = formatCompare(ch, quiz.current);
    $("quiz-feedback").textContent = "Nochmal hören, dann Weiter.";
    $("quiz-feedback").className = "feedback fail";
    $("btn-quiz-next").classList.remove("hidden");
  }
  cue(ok ? "ok" : "fail");
  recordAnswer(quiz.current, ok);
  $("quiz-acc").textContent = accText();
  if (ok) {
    scheduleAdvance(() => nextQuiz(true), 750);
  } else if (quiz.mode === "vibe") {
    vibeChar(quiz.current);
  } else {
    playChar(quiz.current, { lamp: $("lamp") });
  }
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
  send = { current: null, marks: [], durations: [], holding: false, start: 0, idle: null, locked: false };
  bindKey();
  syncEasySend();
  nextSend();
}

function syncEasySend() {
  const easy = !!state.settings.easySend;
  $("set-easy-send").checked = easy;
  $("send-simple").classList.toggle("hidden", !easy);
  $("btn-send-ok").classList.toggle("hidden", !easy);
  $("send-basic").style.gridTemplateColumns = easy ? "1fr 1fr" : "1fr";
}

function nextSend() {
  stopSidetone();
  const unlocked = unlockedChars();
  send.current = pickChar(unlocked, state.letterStats);
  send.marks = [];
  send.durations = [];
  send.holding = false;
  send.locked = false;
  $("send-letter").textContent = send.current;
  $("send-pattern").textContent = "";
  $("send-feedback").textContent = "";
  $("send-feedback").className = "feedback";
  $("send-acc").textContent = accText();
  $("key-hint").textContent = "kurz = Dit, lang = Dah";
  $("key-cap").textContent = "•  /  –";
  updateComboUI("send-combo", "send-combo-n");
}

function appendMark(mark, duration) {
  if (!send || !mark || send.locked) return;
  send.marks.push(mark);
  send.durations.push(Number(duration) || 0);
  $("send-pattern").textContent = prettyCode(send.marks.join(""));
  scheduleIdleCheck();
}

function scheduleIdleCheck() {
  clearTimeout(send.idle);
  const wait = Math.max(800, currentSendThreshold() * 2.4);
  send.idle = setTimeout(() => {
    if (send && send.marks.length && !send.holding && !send.locked) submitSend();
  }, wait);
}

function submitSend() {
  if (!send || !send.marks.length || send.locked) return;
  clearTimeout(send.idle);
  send.locked = true;
  const got = send.marks.join("");
  const expect = codeFor(send.current);
  const ok = codesMatch(got, expect);
  $("send-feedback").textContent = ok
    ? "Sauber gegeben!"
    : formatCompareMarks(got, expect);
  $("send-feedback").className = "feedback " + (ok ? "ok" : "fail");
  cue(ok ? "ok" : "fail");
  if (ok) {
    state.tapStats = updateTapAverages(state.tapStats, send.durations, send.marks);
  }
  recordAnswer(send.current, ok, { xp: 12 });
  const current = send.current;
  send.marks = [];
  send.durations = [];
  scheduleAdvance(() => {
    if (!ok) playChar(current);
    nextSend();
  }, ok ? 800 : 1400);
}

function formatCompareMarks(got, expect) {
  return prettyCode(got) + "  ≠  " + prettyCode(expect);
}

function keyDown(ev) {
  if (!send || send.holding || send.locked) return;
  if (ev && ev.cancelable) ev.preventDefault();
  clearTimeout(send.idle);
  send.holding = true;
  send.start = performance.now();
  $("morse-key").classList.add("down");
  $("key-cap").textContent = "·";
  startSidetone(state.settings.pitch, state.settings.volume);
  const thr = currentSendThreshold();
  send.holdWatch = requestAnimationFrame(function watch() {
    if (!send || !send.holding) return;
    const d = performance.now() - send.start;
    const dah = classifyPress(d, state.settings.sendWpm, thr) === "-";
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
  if (send.locked) return;
  const d = performance.now() - send.start;
  const mark = classifyPress(d, state.settings.sendWpm, currentSendThreshold());
  if (mark) appendMark(mark, d);
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
  if (autoPlay) scheduleAdvance(() => playChar(pick.word, { lamp: null }), 200);
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
    scheduleAdvance(() => nextWord(true), 900);
  }
}

/* ---------- blitz ---------- */
function startBlitzIntro() {
  blitz = { running: false, score: 0, time: 60, current: null, locked: false, timer: null, combo: 0, fails: {} };
  $("blitz-play").classList.add("hidden");
  $("blitz-end").classList.add("hidden");
  $("blitz-intro").classList.remove("hidden");
  $("blitz-best").textContent = String(state.bestBlitz);
  $("blitz-time").textContent = "60";
  $("blitz-score").textContent = "0";
}

function runBlitz() {
  haltMedia();
  if (blitz && blitz.timer) clearInterval(blitz.timer);
  blitz = { running: true, score: 0, time: 60, current: null, locked: false, timer: null, combo: 0, fails: {} };
  combo = 0;
  $("blitz-intro").classList.add("hidden");
  $("blitz-end").classList.add("hidden");
  $("blitz-play").classList.remove("hidden");
  $("blitz-score").textContent = "0";
  $("blitz-time").textContent = "60";
  cue("blitz");
  nextBlitz(true);
  blitz.timer = setInterval(() => {
    if (!blitz || !blitz.running) return;
    if (overlayOpen()) return;
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
  $("blitz-compare").hidden = true;
  $("blitz-compare").textContent = "";
  updateComboUI("blitz-combo", "blitz-combo-n");
  renderChoices($("blitz-grid"), choiceSet(blitz.current, unlocked, Math.min(8, unlocked.length)), onBlitzChoice);
  if (autoPlay) scheduleAdvance(() => {
    if (blitz && blitz.running && !overlayOpen()) playChar(blitz.current, { lamp: $("blitz-lamp") });
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
    $("blitz-compare").hidden = true;
    $("blitz-feedback").textContent = "+" + gain;
    $("blitz-feedback").className = "feedback ok";
    cue("ok");
    recordAnswer(blitz.current, true, { xp: 4, skipUnlock: true });
  } else {
    blitz.combo = 0;
    combo = 0;
    blitz.fails[blitz.current] = (blitz.fails[blitz.current] || 0) + 1;
    $("blitz-compare").hidden = false;
    $("blitz-compare").textContent = formatCompare(ch, blitz.current);
    $("blitz-feedback").textContent = "War " + blitz.current;
    $("blitz-feedback").className = "feedback fail";
    cue("fail");
    recordAnswer(blitz.current, false, { xp: 0, skipUnlock: true });
  }
  $("blitz-score").textContent = String(blitz.score);
  scheduleAdvance(() => nextBlitz(true), ok ? 280 : 700);
}

function endBlitz() {
  if (!blitz) return;
  blitz.running = false;
  clearInterval(blitz.timer);
  blitz.timer = null;
  haltMedia();
  $("blitz-play").classList.add("hidden");
  $("blitz-end").classList.remove("hidden");
  $("blitz-final").textContent = String(blitz.score);
  const prevBest = state.bestBlitz;
  let msg = "Zeit um!";
  if (blitz.score > prevBest) {
    state.bestBlitz = blitz.score;
    saveState();
    msg = "Neue Bestleistung!";
    confettiBurst(90);
    cue("level");
    addXp(30);
  } else {
    addXp(Math.floor(blitz.score / 4));
  }
  $("blitz-end-msg").textContent = msg;
  const delta = $("blitz-delta");
  if (blitz.score > prevBest) {
    const gain = blitz.score - prevBest;
    delta.textContent = prevBest ? "Bestleistung +" + gain : "Erste Bestleistung";
    delta.hidden = false;
  } else if (prevBest) {
    const behind = prevBest - blitz.score;
    delta.textContent = behind ? behind + " unter der Bestleistung (" + prevBest + ")" : "Gleichauf mit der Bestleistung";
    delta.hidden = false;
  } else {
    delta.textContent = "";
    delta.hidden = true;
  }
  const weakEl = $("blitz-weak");
  const sessionFails = Object.keys(blitz.fails || {});
  let weak = null;
  if (sessionFails.length) {
    weak = sessionFails.sort((a, b) => (blitz.fails[b] - blitz.fails[a]) || a.localeCompare(b))[0];
  } else {
    weak = weakestChar(state.letterStats, unlockedChars());
  }
  if (weak && sessionFails.length) weakEl.textContent = "Übe noch: " + weak;
  else if (weak) weakEl.textContent = "Zum Festigen: " + weak;
  else weakEl.textContent = "Kein schwaches Zeichen diesmal.";
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
    const unlocked = open.has(ch);
    const row = document.createElement("div");
    row.className = "morse-row " + (unlocked ? "open" : "locked");
    if (!unlocked) {
      row.innerHTML =
        '<div class="morse-glyph">?</div>' +
        '<div class="morse-meta"><div class="morse-mn">Noch gesperrt</div></div>';
      box.appendChild(row);
      continue;
    }
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
  $("set-send-wpm").value = String(s.sendWpm);
  $("val-send-wpm").textContent = String(s.sendWpm);
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
  $("set-send-wpm").addEventListener("input", (e) => {
    state.settings.sendWpm = Number(e.target.value);
    $("val-send-wpm").textContent = String(state.settings.sendWpm);
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
    showView("home");
    openFirstLesson();
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
function openFirstLesson() {
  openLesson({
    chars: ["E", "T"],
    title: "Deine ersten Zeichen",
    lead: "Tippe auf eine Karte, um den Ton zu hören. Das sind Dit und Dah – die Bausteine von allem.",
    button: "Jetzt hören",
    onDone: () => showView("listen"),
  });
}

async function enter() {
  try {
    await Promise.race([
      unlockAudio(),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
  } catch {
    /* Audio may still start on later taps */
  }
  if (canVibrate()) {
    try { navigator.vibrate(20); } catch { /* ignore */ }
  }
  $("gate").classList.add("hidden");
  $("app").classList.remove("hidden");
  if (!state.introSeen) {
    renderHome();
    openFirstLesson();
  } else {
    showView("home");
  }
}

function bindUI() {
  $("btn-enter").addEventListener("click", enter);
  $("btn-continue").addEventListener("click", () => showView("listen"));
  $$(".mode-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      showView(btn.dataset.mode);
    });
  });
  $$("[data-go]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.go)));
  $("btn-settings").addEventListener("click", () => showView("settings"));
  $("btn-play").addEventListener("click", triggerQuizPlay);
  $("btn-quiz-next").addEventListener("click", () => nextQuiz(true));
  $("btn-dit").addEventListener("click", () => appendMark(".", 0));
  $("btn-dah").addEventListener("click", () => appendMark("-", 0));
  $("btn-clear").addEventListener("click", () => {
    if (!send || send.locked) return;
    clearTimeout(send.idle);
    send.marks = [];
    send.durations = [];
    $("send-pattern").textContent = "";
    $("send-feedback").textContent = "";
  });
  $("btn-send-ok").addEventListener("click", submitSend);
  $("set-easy-send").addEventListener("change", (e) => {
    state.settings.easySend = e.target.checked;
    saveState();
    syncEasySend();
  });
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
  $("modal-ok").addEventListener("click", () => {
    $("modal").classList.add("hidden");
    const done = modalOnDismiss;
    modalOnDismiss = null;
    overlayBusy = false;
    if (done) done();
    pumpNotices();
  });
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") $("modal-ok").click();
  });
  $("lesson-go").addEventListener("click", finishLesson);
  bindSettings();
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  if (new URLSearchParams(location.search).has("e2e")) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline first later */ });
  });
}

bindUI();
registerSW();
rollDaily();

if (new URLSearchParams(location.search).has("e2e")) {
  window.__morse = {
    getState: () => state,
    enqueueNotice,
    overlayOpen,
    haltMedia,
    playGen: () => playGen,
    pendingAdvance: () => pendingAdvance,
    quizCurrent: () => quiz && quiz.current,
    showView,
    enter,
  };
}
