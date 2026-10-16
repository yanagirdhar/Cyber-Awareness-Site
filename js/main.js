// ===== Settings (edit here) =====
const STORAGE_KEY = 'safetyChecklist';   // session memory key
const ZOOM_MS = 350;                     // keep in sync with .film.zoom in style.css
const VERDICTS = [                       // highest score first; first match wins
  { min: 9, text: 'Secure' },
  { min: 7, text: 'Mostly secure' },
  { min: 4, text: 'At risk' },
  { min: 0, text: 'Not secure' }
];

// ===== Elements =====
const $ = (s) => document.querySelector(s);
const stages = document.querySelectorAll('.stage');
const boxes = [...document.querySelectorAll('#items input')];
const video = $('#video'), film = $('#film'), flash = $('#flash'), scroll = $('#scroll'), hint = $('#sound-hint');

// ===== Session memory (cleared when the tab closes) =====
let state;
try { state = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch (e) { state = null; }
state = state || { stage: 'intro', checked: [] };
const save = () => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} };

// ===== Timers (cleared whenever the page changes, so skipping mid-zoom is safe) =====
let timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

// ===== Page switching =====
function show(name) {
  clearTimers();
  stages.forEach((s) => s.classList.toggle('active', s.id === name));
  document.body.classList.toggle('intro-active', name === 'intro');
  document.querySelectorAll('[data-stage]').forEach((a) => {
    a.toggleAttribute('aria-current', a.dataset.stage === name);
  });
  state.stage = name; save();
  window.scrollTo(0, 0);
  if (name !== 'intro') { video.pause(); flash.classList.remove('on'); }
  if (name === 'checklist') openScroll();
  if (name === 'results') renderResults();
}

function openScroll() {
  scroll.classList.remove('open');
  later(() => scroll.classList.add('open'), 400);
}

// ===== 1. Intro: starts straight away, always with sound =====
function startIntro() {
  show('intro');
  film.classList.remove('zoom');
  hint.hidden = true;
  video.currentTime = 0;
  video.muted = false;                    // sound is always on
  video.play().catch(() => {
    // Browser blocked autoplay with sound: wait (paused) for the first click/key, never play silently
    video.pause();
    hint.hidden = false;
  });
}

function zoomIntoLock() {
  film.classList.add('zoom');
  later(() => flash.classList.add('on'), ZOOM_MS - 200);
  later(() => show('checklist'), ZOOM_MS);
}

function playWithSound() {
  if (state.stage === 'intro' && video.paused && !video.ended) {
    video.muted = false;
    video.play().then(() => { hint.hidden = true; }).catch(() => {});
  }
}
['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, playWithSound));

video.addEventListener('ended', () => { if (state.stage === 'intro') zoomIntoLock(); });
video.addEventListener('error', () => { if (state.stage === 'intro') show('checklist'); });
$('#skip').addEventListener('click', () => show('checklist'));
$('#replay').addEventListener('click', startIntro);

// ===== 2. Checklist =====
boxes.forEach((box, i) => { box.checked = state.checked.includes(i); });
boxes.forEach((box) => box.addEventListener('change', () => {
  state.checked = boxes.map((b, i) => (b.checked ? i : -1)).filter((i) => i >= 0);
  save();
}));
$('#show-results').addEventListener('click', () => show('results'));

// ===== 3. Results =====
function renderResults() {
  const score = state.checked.length;
  $('#score').textContent = score;
  $('#verdict').textContent = VERDICTS.find((v) => score >= v.min).text;

  const list = $('#review');
  list.innerHTML = '';
  boxes.forEach((box, i) => {
    const done = state.checked.includes(i);
    const li = document.createElement('li');
    li.className = done ? 'yes' : 'no';
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = done ? '✓' : '✕';
    li.append(mark, box.nextElementSibling.textContent);
    list.append(li);
  });
}

// ===== Footer links that stay on this page (Home, Checklist) =====
document.querySelectorAll('[data-stage]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    a.dataset.stage === 'intro' ? startIntro() : show(a.dataset.stage);
  });
});

// ===== Start: use the #hash from the footer links, else the saved page, else the intro =====
const wanted = location.hash.slice(1);
const first = ['intro', 'checklist', 'results'].includes(wanted) ? wanted : state.stage;
first === 'intro' ? startIntro() : show(first);
