const $ = (id) => document.getElementById(id);
const audio = $('audio');
let objectURL = null;
let loadVersion = 0;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
function message(text, isError = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', isError);
}
function syncPlayback() {
  if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
    $('state').textContent = audio.ended ? 'FINISHED' : audio.paused ? 'PAUSED' : 'NOW PLAYING';
  }
}
async function play() {
  const version = loadVersion;
  try { await audio.play(); if (version === loadVersion) message('Playback authorized. For now.'); }
  catch (error) {
    if (version === loadVersion && error.name !== 'AbortError') message('Playback could not start. Try Play again or select another audio file.', true);
  }
}
function loadTrack(source, name, note) {
  loadVersion++;
  audio.pause();
  if ($('confirmation').open) $('confirmation').close();
  if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
  audio.loop = false;
  $('loop-state').dataset.state = 'off';
  $('loop-command').value = '';
  for (const kind of ['setting', 'loop']) feedback(kind, '');
  for (const id of ['play', 'pause', 'setting', 'setting-submit', 'loop-command', 'loop-submit']) $(id).disabled = true;
  $('setting').value = '';
  $('edit-mode').value = 'volume';
  $('edit-settings').open = false;
  $('status-panel').open = false;
  $('services').open = false;
  $('current').textContent = $('duration').textContent = '00:00';
  $('track-name').textContent = name;
  $('track-note').textContent = note;
  $('state').textContent = 'LOADING';
  message('Reading audio…');
  $('source-status').textContent = `Loading ${name}…`;
  if (source instanceof Blob) { objectURL = URL.createObjectURL(source); audio.src = objectURL; }
  else audio.src = source;
  audio.load();
}
$('file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) loadTrack(file, file.name, 'Audio file');
  event.target.value = '';
});
audio.volume = .5;
audio.addEventListener('loadedmetadata', () => {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) { message('This file has no usable audio duration. Please choose another.', true); return; }
  $('duration').textContent = formatTime(audio.duration);
  for (const id of ['play', 'pause', 'setting', 'setting-submit', 'loop-command', 'loop-submit']) $(id).disabled = false;
  syncPlayback();
  message('Track loaded. Press Play to begin.');
  $('source-status').textContent = 'File loaded.';
});
audio.addEventListener('error', () => {
  $('state').textContent = 'FILE ERROR';
  for (const id of ['play', 'pause', 'setting', 'setting-submit', 'loop-command', 'loop-submit']) $(id).disabled = true;
  message('We could not read this audio. Choose a valid MP3, WAV, or another browser-supported file.', true);
  $('source-status').textContent = 'This audio could not be read. Choose another audio file.';
});
for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, syncPlayback);
audio.addEventListener('timeupdate', () => {
  $('current').textContent = formatTime(audio.currentTime);
});
const playButton = $('play');
const pauseButton = $('pause');
function closeServices() { $('services').open = false; $('services').querySelector('summary').focus(); }
playButton.addEventListener('click', () => {
  closeServices();
  audio.pause();
  if (!$('confirmation').open) $('confirmation').showModal();
});
pauseButton.addEventListener('click', () => { audio.pause(); });
function feedback(kind, text, error = false) {
  const field = $(kind === 'loop' ? 'loop-command' : kind);
  field.setAttribute('aria-invalid', String(error));
  // Perception: feedback is intentionally separated from the edited field.
  $(kind + '-feedback').textContent = error ? `${kind === 'loop' ? 'Loop command' : 'Value'}: ${text}` : ''; 
  $(kind + '-feedback').classList.toggle('error', error);
}
// Memory: one numeric input changes meaning in a mode hidden by a closed menu.
$('setting-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if ($('setting').disabled) return;
  const raw = $('setting').value;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    feedback('setting', 'Enter a non-negative whole number without spaces or units.', true); return;
  }
  const value = Number(raw);
  if ($('edit-mode').value === 'volume') {
    if (value > 100) { feedback('setting', 'Volume reduction must be between 0 and 100.', true); return; }
    audio.volume = (100 - value) / 100;
    $('volume-value').textContent = `${100 - value}%`;
    feedback('setting', '');
  } else {
    if (!Number.isFinite(audio.duration) || value > audio.duration) {
      feedback('setting', `Position must not exceed ${Math.floor(audio.duration)} seconds.`, true); return;
    }
    audio.currentTime = value;
    $('current').textContent = formatTime(value);
    feedback('setting', '');
    audio.pause();
    message('Position applied. Playback is paused.');
  }
});
// UE4.2 p.16: a typed command instead of a recognizable toggle.
$('loop-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if ($('loop-command').disabled) return;
  const command = $('loop-command').value;
  if (command !== 'cycle-track' && command !== 'single-pass') { feedback('loop', 'Unknown command. Check the command reference; spelling and case must match.', true); return; }
  audio.loop = command === 'cycle-track';
  $('loop-state').dataset.state = audio.loop ? 'on' : 'off';
  $('loop-command').value = '';
  feedback('loop', 'Command executed.');
});
$('continue').addEventListener('click', (event) => { event.preventDefault(); $('confirmation').close(); play(); });
$('stop').addEventListener('click', () => { audio.pause(); message('Playback discontinued. You can resume using Play.'); });
$('confirmation').addEventListener('cancel', () => { message('Review dismissed. Playback remains paused.'); });

// Memory: instructions replace the controls; form and audio state are preserved.
function showInstructions(show) {
  $('player-view').hidden = show;
  $('instructions-view').hidden = !show;
  $('instructions-toggle').setAttribute('aria-expanded', String(show));
  $('instructions-toggle').textContent = show ? 'Return to player' : 'Instructions';
  if (show) {
    $('status-panel').open = false;
    $('services').open = false;
    $('instructions-view').focus();
  } else $('instructions-toggle').focus();
}
$('instructions-toggle').addEventListener('click', () => showInstructions($('instructions-view').hidden));
$('instructions-return').addEventListener('click', () => showInstructions(false));
