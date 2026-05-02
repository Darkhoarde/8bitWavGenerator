const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let state = {
  tempo: 120,
  beatsPerMeasure: 4,
  totalSteps: 32,
  notes: {},
  isPlaying: false,
  playInterval: null,
  isDragging: false,
  dragValue: null,
  copiedNotes: null,
  selectionStart: null,
  selectionEnd: null
};

function noteToFrequency(note, octave) {
  const noteIndex = NOTE_NAMES.indexOf(note);
  const semitone = noteIndex + (octave + 1) * 12;
  return 440 * Math.pow(2, (semitone - 69) / 12);
}

function getNoteId(note, octave, step) {
  return `${note}${octave}_${step}`;
}

function initGrid() {
  const grid = document.getElementById('grid');
  const noteLabels = document.getElementById('note-labels');
  grid.innerHTML = '';
  noteLabels.innerHTML = '';
  state.isDragging = false;
  state.dragValue = null;

  const totalSteps = state.totalSteps;
  const notes = [];

  for (let oct = 6; oct >= 2; oct--) {
    for (let i = NOTE_NAMES.length - 1; i >= 0; i--) {
      notes.push({ note: NOTE_NAMES[i], octave: oct });
    }
  }

  notes.forEach(({ note, octave }) => {
    const label = document.createElement('div');
    label.className = `note-label ${note.includes('#') ? 'black' : 'white'}`;
    label.textContent = `${note}${octave}`;
    noteLabels.appendChild(label);

    const row = document.createElement('div');
    row.className = 'grid-row';
    row.dataset.note = note;
    row.dataset.octave = octave;

    for (let step = 0; step < totalSteps; step++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.step = step;

      const noteId = getNoteId(note, octave, step);

      if (state.notes[noteId]) {
        cell.classList.add('active');
      }

      cell.addEventListener('mousedown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          state.selectionStart = { note, octave, step };
          state.selectionEnd = { note, octave, step };
          updateSelectionRect();
          return;
        }
        e.preventDefault();
        state.isDragging = true;
        if (state.notes[noteId]) {
          state.dragValue = false;
          delete state.notes[noteId];
          cell.classList.remove('active');
        } else {
          state.dragValue = true;
          state.notes[noteId] = { note, octave, step };
          cell.classList.add('active');
          playNote(note, octave, 0.1);
        }
      });

      cell.addEventListener('mouseenter', () => {
        if (state.selectionStart) {
          state.selectionEnd = { note, octave, step };
          updateSelectionRect();
          return;
        }
        if (!state.isDragging) return;
        cell.classList.add('dragging');
        if (state.dragValue === true && !state.notes[noteId]) {
          state.notes[noteId] = { note, octave, step };
          cell.classList.add('active');
        } else if (state.dragValue === false && state.notes[noteId]) {
          delete state.notes[noteId];
          cell.classList.remove('active');
        }
      });

      cell.addEventListener('mouseup', (e) => {
        if (state.selectionStart) {
          state.selectionEnd = { note, octave, step };
          copySelection();
          state.selectionStart = null;
          state.selectionEnd = null;
          document.getElementById('selection-rect').style.display = 'none';
          return;
        }
        state.isDragging = false;
        document.querySelectorAll('.grid-cell.dragging').forEach(c => c.classList.remove('dragging'));
      });

      cell.addEventListener('mouseleave', () => {
        cell.classList.remove('dragging');
      });

      cell.addEventListener('click', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && state.copiedNotes && !state.isDragging) {
          pasteNotes(note, octave, step);
        }
      });

      row.appendChild(cell);
    }
    grid.appendChild(row);
  });

  document.addEventListener('mouseup', () => {
    state.isDragging = false;
    document.querySelectorAll('.grid-cell.dragging').forEach(c => c.classList.remove('dragging'));
  });
}

function updateSelectionRect() {
  if (!state.selectionStart || !state.selectionEnd) return;
  const rect = document.getElementById('selection-rect');
  const startStep = Math.min(state.selectionStart.step, state.selectionEnd.step);
  const endStep = Math.max(state.selectionStart.step, state.selectionEnd.step);
  const startNote = NOTE_NAMES.indexOf(state.selectionStart.note) + state.selectionStart.octave * 12;
  const endNote = NOTE_NAMES.indexOf(state.selectionEnd.note) + state.selectionEnd.octave * 12;
  const minNote = Math.min(startNote, endNote);
  const maxNote = Math.max(startNote, endNote);

  const totalRows = 60;
  const rowHeight = 20;
  const startRow = totalRows - 1 - (maxNote - 2 * 12);
  const endRow = totalRows - 1 - (minNote - 2 * 12);

  rect.style.left = (startStep * 20) + 'px';
  rect.style.width = ((endStep - startStep + 1) * 20) + 'px';
  rect.style.top = (startRow * rowHeight) + 'px';
  rect.style.height = ((endRow - startRow + 1) * rowHeight) + 'px';
  rect.style.display = 'block';
}

function copySelection() {
  if (!state.selectionStart || !state.selectionEnd) return;
  const startStep = Math.min(state.selectionStart.step, state.selectionEnd.step);
  const endStep = Math.max(state.selectionStart.step, state.selectionEnd.step);
  const startNote = NOTE_NAMES.indexOf(state.selectionStart.note) + state.selectionStart.octave * 12;
  const endNote = NOTE_NAMES.indexOf(state.selectionEnd.note) + state.selectionEnd.octave * 12;
  const minNote = Math.min(startNote, endNote);
  const maxNote = Math.max(startNote, endNote);

  state.copiedNotes = [];
  for (let step = startStep; step <= endStep; step++) {
    for (let n = minNote; n <= maxNote; n++) {
      const noteIdx = n % 12;
      const octave = Math.floor(n / 12);
      const noteId = getNoteId(NOTE_NAMES[noteIdx], octave, step);
      if (state.notes[noteId]) {
        state.copiedNotes.push({
          note: NOTE_NAMES[noteIdx],
          octave: octave,
          step: step,
          relStep: step - startStep
        });
      }
    }
  }
}

function pasteNotes(note, octave, step) {
  if (!state.copiedNotes) return;
  state.copiedNotes.forEach(copied => {
    const copiedNoteIdx = NOTE_NAMES.indexOf(copied.note) + copied.octave * 12;
    const newStep = step + copied.relStep;
    if (newStep >= state.totalSteps) return;
    const noteIdx = copiedNoteIdx % 12;
    const newOctave = Math.floor(copiedNoteIdx / 12);
    if (newOctave < 2 || newOctave > 6) return;
    const noteId = getNoteId(NOTE_NAMES[noteIdx], newOctave, newStep);
    state.notes[noteId] = { note: NOTE_NAMES[noteIdx], octave: newOctave, step: newStep };
  });
  initGrid();
}

function playNote(note, octave, duration) {
  const freq = noteToFrequency(note, octave);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime + duration - 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function getMergedNotes() {
  const totalSteps = state.totalSteps;
  const rows = document.querySelectorAll('.grid-row');
  const noteLabels = document.querySelectorAll('.note-label');
  const mergedNotes = [];

  rows.forEach((row, rowIndex) => {
    const noteText = noteLabels[rowIndex].textContent;
    const match = noteText.match(/^([A-G]#?)(\d)$/);
    if (!match) return;

    const note = match[1];
    const octave = parseInt(match[2]);
    let startStep = -1;

    for (let step = 0; step <= totalSteps; step++) {
      const isActive = step < totalSteps && row.children[step].classList.contains('active');

      if (isActive && startStep === -1) {
        startStep = step;
      } else if (!isActive && startStep !== -1) {
        mergedNotes.push({
          note,
          octave,
          startStep,
          endStep: step - 1,
          duration: (step - startStep) * (60 / state.tempo / 2)
        });
        startStep = -1;
      }
    }
  });

  return mergedNotes;
}

function playSequence() {
  if (state.isPlaying) return;

  state.isPlaying = true;
  document.getElementById('play-btn').textContent = 'Pause';

  const totalSteps = state.totalSteps;
  const stepDuration = 60 / state.tempo / 2;
  const mergedNotes = getMergedNotes();

  const playhead = document.getElementById('playhead');
  playhead.style.display = 'block';

  let currentStep = 0;
  let activeNotes = [];

  function scheduleStep() {
    if (!state.isPlaying || currentStep >= totalSteps) {
      stopPlayback();
      return;
    }

    activeNotes = activeNotes.filter(noteInfo => {
      if (currentStep >= noteInfo.endStep) {
        return false;
      }
      return true;
    });

    mergedNotes.forEach(noteInfo => {
      if (noteInfo.startStep === currentStep) {
        const duration = noteInfo.duration;
        const freq = noteToFrequency(noteInfo.note, noteInfo.octave);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + duration - 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      }
    });

    playhead.style.left = (currentStep * 20) + 'px';

    currentStep++;
    state.playInterval = setTimeout(scheduleStep, stepDuration * 1000);
  }

  scheduleStep();
}

function stopPlayback() {
  state.isPlaying = false;
  clearTimeout(state.playInterval);
  document.getElementById('play-btn').textContent = 'Play';
  document.getElementById('playhead').style.display = 'none';
}

function clearGrid() {
  state.notes = {};
  initGrid();
}

async function exportWAV() {
  const totalSteps = state.totalSteps;
  const stepDuration = 60 / state.tempo / 2;
  const totalDuration = totalSteps * stepDuration;

  const sampleRate = 48000;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration + sampleRate, sampleRate);

  const mergedNotes = getMergedNotes();

  mergedNotes.forEach(noteInfo => {
    const freq = noteToFrequency(noteInfo.note, noteInfo.octave);
    const startTime = noteInfo.startStep * stepDuration;
    const duration = noteInfo.duration;
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.setValueAtTime(0.3, startTime + duration - 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  });

  const renderedBuffer = await offlineCtx.startRendering();
  const wav = audioBufferToWav(renderedBuffer);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'music-export.wav';
  a.click();
  URL.revokeObjectURL(url);
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.length;
  const bufferLength = samples * numChannels * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + bufferLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, bufferLength, true);

  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

document.getElementById('play-btn').addEventListener('click', () => {
  if (state.isPlaying) {
    stopPlayback();
  } else {
    playSequence();
  }
});

document.getElementById('stop-btn').addEventListener('click', stopPlayback);

document.getElementById('clear-btn').addEventListener('click', clearGrid);

document.getElementById('export-btn').addEventListener('click', exportWAV);

document.getElementById('tempo').addEventListener('input', (e) => {
  state.tempo = parseInt(e.target.value);
  document.getElementById('tempo-slider').value = state.tempo;
});

document.getElementById('tempo-slider').addEventListener('input', (e) => {
  state.tempo = parseInt(e.target.value);
  document.getElementById('tempo').value = state.tempo;
});

document.getElementById('beats').addEventListener('input', (e) => {
  state.beatsPerMeasure = parseInt(e.target.value);
});

document.getElementById('total-steps').addEventListener('input', (e) => {
  state.totalSteps = parseInt(e.target.value);
  initGrid();
});

document.getElementById('length-sec').addEventListener('input', (e) => {
  const lengthSec = parseFloat(e.target.value);
  if (lengthSec > 0 && state.tempo > 0) {
    const stepDuration = 60 / state.tempo / 2;
    state.totalSteps = Math.ceil(lengthSec / stepDuration);
    document.getElementById('total-steps').value = state.totalSteps;
    initGrid();
  }
});

const gridContainer = document.getElementById('grid-container');
gridContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    gridContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });

initGrid();
