// ===== Configuration =====
const API_URL = 'http://127.0.0.1:8000'; // your FastAPI base URL
const SCORE_MAX = 10;                    // upper bound of your score scale; only used to draw the ring/bar

const $ = (s) => document.querySelector(s);
const form = $('#predict'), result = $('#result'), loader = $('#loader'), errBox = $('#error');
const CIRC = 2 * Math.PI * 88;
$('#max').textContent = SCORE_MAX;

// Sliders: live value + filled track
document.querySelectorAll('input[type=range]').forEach((r) => {
  const out = r.parentElement.querySelector('output');
  const sync = () => { r.style.setProperty('--p', (r.value / r.max) * 100 + '%'); out.textContent = r.value + 'h'; };
  r.addEventListener('input', sync); sync();
});

const radio = (n) => form.querySelector(`input[name=${n}]:checked`).value;

function validate() {
  const e = {};
  const age = Number($('#age').value), unlocks = Number($('#daily_unlocks').value);
  if ($('#age').value === '' || !Number.isInteger(age) || age < 10 || age > 100) e.age = 'Enter a whole number from 10 to 100.';
  if (!$('#country').value.trim()) e.country = 'Enter your country.';
  if ($('#daily_unlocks').value === '' || !Number.isInteger(unlocks) || unlocks < 0) e.daily_unlocks = 'Enter a whole number, 0 or more.';
  document.querySelectorAll('.err').forEach((el) => {
    el.textContent = e[el.dataset.for] || '';
    document.getElementById(el.dataset.for).classList.toggle('bad', !!e[el.dataset.for]);
  });
  return Object.keys(e).length === 0;
}

// Keys match the FastAPI StudentData model exactly
function payload() {
  return {
    age: parseInt($('#age').value, 10),
    gender: radio('gender'),
    country: $('#country').value.trim(),
    academic_level: radio('academic_level'),
    most_used_platform: $('#most_used_platform').value,
    purpose_of_use: $('#purpose_of_use').value,
    avg_daily_usage_hours: parseFloat($('#avg_daily_usage_hours').value),
    daily_unlocks: parseInt($('#daily_unlocks').value, 10),
    study_hours: parseFloat($('#study_hours').value),
    physical_activity_hours: parseFloat($('#physical_activity_hours').value),
    sleep_hours_per_night: parseFloat($('#sleep_hours_per_night').value),
    stress_level: radio('stress_level'),
  };
}

async function predict(body) {
  let res;
  try {
    res = await fetch(API_URL + '/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error(`Can't reach the prediction server at ${API_URL}. Start FastAPI with "uvicorn main:app --reload" and try again.`);
  }
  if (!res.ok) {
    let d = '';
    try { const j = await res.json(); d = Array.isArray(j.detail) ? j.detail.map((x) => `${x.loc.slice(-1)}: ${x.msg}`).join('; ') : j.detail; } catch {}
    throw new Error(d || `Server returned ${res.status}.`);
  }
  const data = await res.json();
  if (typeof data.predicted_mental_health_score !== 'number') throw new Error('Unexpected response from server.');
  return data.predicted_mental_health_score;
}

function animate(score) {
  const target = Math.min(Math.max(score / SCORE_MAX, 0), 1), t0 = performance.now(), dur = 1600;
  const arc = $('#arc'), bar = $('#bar'), num = $('#score');
  arc.style.strokeDasharray = CIRC;
  const tick = (t) => {
    const k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
    arc.style.strokeDashoffset = CIRC * (1 - target * e);
    bar.style.width = target * e * 100 + '%';
    num.textContent = (score * e).toFixed(2);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  errBox.hidden = true;
  if (!validate()) return;
  loader.hidden = false;
  try {
    const score = await predict(payload());
    form.hidden = true; result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth' });
    animate(score);
  } catch (e) {
    errBox.textContent = e.message; errBox.hidden = false;
  } finally {
    loader.hidden = true;
  }
});

function resetForm() {
  form.reset();
  document.querySelectorAll('input[type=range]').forEach((r) => r.dispatchEvent(new Event('input')));
  document.querySelectorAll('.err').forEach((el) => (el.textContent = ''));
  document.querySelectorAll('.bad').forEach((el) => el.classList.remove('bad'));
  errBox.hidden = true;
}
$('#reset').addEventListener('click', resetForm);
$('#again').addEventListener('click', () => {
  resetForm(); result.hidden = true; form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
});
