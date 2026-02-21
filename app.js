const state = {
  project: defaultProject(),
  selectedSceneId: null,
  folderHandle: null,
  availableAudio: [],
  availableImages: [],
  runtime: {
    currentSceneId: null,
    currentDialogue: null,
    ambientAudio: null,
  },
};

const el = {
  newProjectBtn: document.getElementById('newProjectBtn'),
  openFolderBtn: document.getElementById('openFolderBtn'),
  saveProjectBtn: document.getElementById('saveProjectBtn'),
  loadProjectBtn: document.getElementById('loadProjectBtn'),
  sceneNameInput: document.getElementById('sceneNameInput'),
  addSceneBtn: document.getElementById('addSceneBtn'),
  sceneList: document.getElementById('sceneList'),
  editorPanel: document.getElementById('editorPanel'),
  runtimeRoot: document.getElementById('runtimeRoot'),
  addHotspotBtn: document.getElementById('addHotspotBtn'),
  addDialogueBtn: document.getElementById('addDialogueBtn'),
  addAmbientTrackBtn: document.getElementById('addAmbientTrackBtn'),
  previewBtn: document.getElementById('previewBtn'),
  folderStatus: document.getElementById('folderStatus'),
};

wireEvents();
renderAll();

function defaultProject() {
  return {
    metadata: {
      name: 'Nuevo proyecto Myst-like',
      version: 1,
      createdAt: new Date().toISOString(),
    },
    settings: {
      startSceneId: null,
      allowKeyboardNav: true,
    },
    scenes: [],
  };
}

function wireEvents() {
  el.newProjectBtn.addEventListener('click', () => {
    state.project = defaultProject();
    state.selectedSceneId = null;
    stopAmbientAudio();
    renderAll();
  });

  el.addSceneBtn.addEventListener('click', () => {
    const name = el.sceneNameInput.value.trim();
    if (!name) return;
    const id = createId('scene');
    state.project.scenes.push({
      id,
      name,
      description: '',
      background: '',
      hotspots: [],
      dialogues: [],
      ambientTracks: [],
    });
    if (!state.project.settings.startSceneId) {
      state.project.settings.startSceneId = id;
    }
    state.selectedSceneId = id;
    el.sceneNameInput.value = '';
    renderAll();
  });

  el.openFolderBtn.addEventListener('click', connectWorkspaceFolder);
  el.saveProjectBtn.addEventListener('click', saveProject);
  el.loadProjectBtn.addEventListener('click', loadProject);
  el.addHotspotBtn.addEventListener('click', addHotspotToSelected);
  el.addDialogueBtn.addEventListener('click', addDialogueToSelected);
  el.addAmbientTrackBtn.addEventListener('click', addAmbientTrackToSelected);
  el.previewBtn.addEventListener('click', () => {
    const start = state.project.settings.startSceneId || state.selectedSceneId;
    if (start) {
      startRuntime(start);
    }
  });
}

async function connectWorkspaceFolder() {
  if (!window.showDirectoryPicker) {
    notify('Tu navegador no soporta File System Access API. Usa Chrome/Edge recientes.');
    return;
  }
  try {
    state.folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await scanWorkspaceAssets();
    el.folderStatus.textContent = `Carpeta conectada: ${state.folderHandle.name}`;
  } catch (error) {
    notify(`No se pudo conectar carpeta: ${error.message}`);
  }
}

async function scanWorkspaceAssets() {
  state.availableAudio = [];
  state.availableImages = [];
  if (!state.folderHandle) return;

  for await (const entry of state.folderHandle.values()) {
    if (entry.kind !== 'file') continue;
    if (/\.(mp3|ogg|wav|m4a)$/i.test(entry.name)) state.availableAudio.push(entry.name);
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(entry.name)) state.availableImages.push(entry.name);
  }
}

async function saveProject() {
  const payload = JSON.stringify(state.project, null, 2);

  if (state.folderHandle) {
    const fileHandle = await state.folderHandle.getFileHandle('mysty.project.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(payload);
    await writable.close();
    notify('Proyecto guardado en carpeta conectada: mysty.project.json');
    return;
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mysty.project.json';
  a.click();
  URL.revokeObjectURL(url);
  notify('Proyecto descargado localmente.');
}

async function loadProject() {
  try {
    if (state.folderHandle) {
      const fileHandle = await state.folderHandle.getFileHandle('mysty.project.json');
      const file = await fileHandle.getFile();
      state.project = JSON.parse(await file.text());
      state.selectedSceneId = state.project.scenes[0]?.id ?? null;
      renderAll();
      notify('Proyecto cargado desde carpeta conectada.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      state.project = JSON.parse(await file.text());
      state.selectedSceneId = state.project.scenes[0]?.id ?? null;
      renderAll();
      notify('Proyecto cargado desde archivo local.');
    };
    input.click();
  } catch (error) {
    notify(`Error al cargar proyecto: ${error.message}`);
  }
}

function addHotspotToSelected() {
  const scene = selectedScene();
  if (!scene) return;

  scene.hotspots.push({
    id: createId('hotspot'),
    label: 'Objeto interactivo',
    x: 30,
    y: 35,
    width: 18,
    height: 12,
    action: {
      type: 'gotoScene',
      targetSceneId: state.project.scenes.find((s) => s.id !== scene.id)?.id || scene.id,
      dialogueId: '',
    },
  });
  renderAll();
}

function addDialogueToSelected() {
  const scene = selectedScene();
  if (!scene) return;
  scene.dialogues.push({
    id: createId('dialogue'),
    speaker: 'Narrador',
    text: 'Describe aquí el evento o pista de la escena.',
  });
  renderAll();
}

function addAmbientTrackToSelected() {
  const scene = selectedScene();
  if (!scene) return;
  scene.ambientTracks.push({
    id: createId('track'),
    file: state.availableAudio[0] || '',
    volume: 0.4,
    loop: true,
  });
  renderAll();
}

function selectedScene() {
  return state.project.scenes.find((scene) => scene.id === state.selectedSceneId) || null;
}

function renderAll() {
  renderSceneList();
  renderEditor();
  renderRuntimePanelIntro();
}

function renderSceneList() {
  el.sceneList.innerHTML = '';

  for (const scene of state.project.scenes) {
    const li = document.createElement('li');
    li.className = `scene-item ${scene.id === state.selectedSceneId ? 'active' : ''}`;

    const openBtn = document.createElement('button');
    openBtn.textContent = scene.name;
    openBtn.onclick = () => {
      state.selectedSceneId = scene.id;
      renderAll();
    };

    const controls = document.createElement('div');
    controls.className = 'actions';

    const startBtn = document.createElement('button');
    startBtn.textContent = state.project.settings.startSceneId === scene.id ? 'Inicio ✓' : 'Set inicio';
    startBtn.onclick = () => {
      state.project.settings.startSceneId = scene.id;
      renderAll();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'X';
    deleteBtn.onclick = () => {
      state.project.scenes = state.project.scenes.filter((s) => s.id !== scene.id);
      if (state.selectedSceneId === scene.id) {
        state.selectedSceneId = state.project.scenes[0]?.id || null;
      }
      if (state.project.settings.startSceneId === scene.id) {
        state.project.settings.startSceneId = state.project.scenes[0]?.id || null;
      }
      renderAll();
    };

    controls.append(startBtn, deleteBtn);
    li.append(openBtn, controls);
    el.sceneList.append(li);
  }
}

function renderEditor() {
  const scene = selectedScene();
  if (!scene) {
    el.editorPanel.innerHTML = '<h2>Editor</h2><p>No hay escena seleccionada.</p>';
    return;
  }

  const template = document.getElementById('sceneEditorTemplate');
  const node = template.content.firstElementChild.cloneNode(true);

  const nameInput = node.querySelector('[data-field="name"]');
  const descInput = node.querySelector('[data-field="description"]');
  const backgroundInput = node.querySelector('[data-field="background"]');
  const hotspotContainer = node.querySelector('[data-hotspots]');
  const dialogueContainer = node.querySelector('[data-dialogues]');
  const ambientContainer = node.querySelector('[data-ambient]');

  nameInput.value = scene.name;
  descInput.value = scene.description;
  backgroundInput.value = scene.background;

  nameInput.oninput = () => {
    scene.name = nameInput.value;
    renderSceneList();
  };

  descInput.oninput = () => {
    scene.description = descInput.value;
  };

  backgroundInput.oninput = () => {
    scene.background = backgroundInput.value;
  };

  scene.hotspots.forEach((hotspot) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${hotspot.id}</h4>
      <div class="field-group"><label>Etiqueta</label><input data-k="label" value="${escapeAttr(hotspot.label)}" /></div>
      <div class="split">
        <div class="field-group"><label>X %</label><input type="number" min="0" max="100" data-k="x" value="${hotspot.x}" /></div>
        <div class="field-group"><label>Y %</label><input type="number" min="0" max="100" data-k="y" value="${hotspot.y}" /></div>
      </div>
      <div class="split">
        <div class="field-group"><label>Ancho %</label><input type="number" min="1" max="100" data-k="width" value="${hotspot.width}" /></div>
        <div class="field-group"><label>Alto %</label><input type="number" min="1" max="100" data-k="height" value="${hotspot.height}" /></div>
      </div>
      <div class="field-group"><label>Acción</label>
        <select data-k="type">
          <option value="gotoScene" ${hotspot.action.type === 'gotoScene' ? 'selected' : ''}>Ir a escena</option>
          <option value="showDialogue" ${hotspot.action.type === 'showDialogue' ? 'selected' : ''}>Mostrar diálogo</option>
        </select>
      </div>
      <div class="field-group"><label>Escena destino</label>${sceneSelectMarkup(hotspot.action.targetSceneId)}</div>
      <div class="field-group"><label>Diálogo destino</label>${dialogueSelectMarkup(scene, hotspot.action.dialogueId)}</div>
      <button class="danger" data-remove>Eliminar hotspot</button>
    `;

    card.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.k;
        if (['x', 'y', 'width', 'height'].includes(key)) {
          hotspot[key] = Number(input.value);
        } else if (key === 'type') {
          hotspot.action.type = input.value;
        } else {
          hotspot[key] = input.value;
        }
      });
    });

    const sceneSelect = card.querySelector('[data-target-scene]');
    sceneSelect.oninput = () => {
      hotspot.action.targetSceneId = sceneSelect.value;
    };

    const dialogueSelect = card.querySelector('[data-target-dialogue]');
    dialogueSelect.oninput = () => {
      hotspot.action.dialogueId = dialogueSelect.value;
    };

    card.querySelector('[data-remove]').onclick = () => {
      scene.hotspots = scene.hotspots.filter((h) => h.id !== hotspot.id);
      renderEditor();
    };

    hotspotContainer.append(card);
  });

  scene.dialogues.forEach((dialogue) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${dialogue.id}</h4>
      <div class="field-group"><label>Personaje</label><input data-k="speaker" value="${escapeAttr(dialogue.speaker)}" /></div>
      <div class="field-group"><label>Texto</label><textarea data-k="text">${dialogue.text}</textarea></div>
      <button class="danger" data-remove>Eliminar diálogo</button>
    `;

    card.querySelectorAll('input, textarea').forEach((input) => {
      input.oninput = () => {
        dialogue[input.dataset.k] = input.value;
      };
    });

    card.querySelector('[data-remove]').onclick = () => {
      scene.dialogues = scene.dialogues.filter((d) => d.id !== dialogue.id);
      renderEditor();
    };

    dialogueContainer.append(card);
  });

  scene.ambientTracks.forEach((track) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${track.id}</h4>
      <div class="field-group"><label>Archivo de audio</label>${audioSelectMarkup(track.file)}</div>
      <div class="field-group"><label>Volumen (0-1)</label><input type="number" min="0" max="1" step="0.05" data-k="volume" value="${track.volume}" /></div>
      <div class="field-group"><label>Loop</label>
        <select data-k="loop">
          <option value="true" ${track.loop ? 'selected' : ''}>Sí</option>
          <option value="false" ${!track.loop ? 'selected' : ''}>No</option>
        </select>
      </div>
      <button class="danger" data-remove>Eliminar pista</button>
    `;

    card.querySelector('[data-track-file]').oninput = (e) => {
      track.file = e.target.value;
    };
    card.querySelector('[data-k="volume"]').oninput = (e) => {
      track.volume = Number(e.target.value);
    };
    card.querySelector('[data-k="loop"]').oninput = (e) => {
      track.loop = e.target.value === 'true';
    };
    card.querySelector('[data-remove]').onclick = () => {
      scene.ambientTracks = scene.ambientTracks.filter((t) => t.id !== track.id);
      renderEditor();
    };

    ambientContainer.append(card);
  });

  el.editorPanel.innerHTML = '<h2>Editor de escena</h2>';
  el.editorPanel.append(node);
}

function renderRuntimePanelIntro() {
  if (state.runtime.currentSceneId) return;
  el.runtimeRoot.innerHTML = `
    <div class="runtime-ui" style="position:relative; min-height:500px; justify-content:center; align-items:center;">
      <div class="dialogue-box">
        <strong>Runtime listo</strong>
        <p>Haz clic en "Probar aventura" para ejecutar el juego desde la escena inicial.</p>
      </div>
    </div>
  `;
}

function startRuntime(sceneId) {
  state.runtime.currentSceneId = sceneId;
  state.runtime.currentDialogue = null;
  renderRuntime();
}

function renderRuntime() {
  const scene = state.project.scenes.find((s) => s.id === state.runtime.currentSceneId);
  if (!scene) {
    state.runtime.currentSceneId = null;
    renderRuntimePanelIntro();
    return;
  }

  const asset = scene.background ? `url('${scene.background}')` : 'linear-gradient(120deg, #111a2b, #243656)';
  el.runtimeRoot.innerHTML = `
    <div class="runtime-scene" style="background-image: ${asset};"></div>
    <div class="runtime-overlay"></div>
    <div class="runtime-ui">
      <div>
        <h3 style="margin:0">${scene.name}</h3>
        <p class="status">${scene.description || 'Sin descripción de escena.'}</p>
      </div>
      <div class="runtime-hotspots" data-runtime-hotspots></div>
      <div class="dialogue-box" data-dialogue-box>
        <strong>Narrativa</strong>
        <p>${state.runtime.currentDialogue ? state.runtime.currentDialogue.text : 'Interactúa con un objeto para ejecutar acciones.'}</p>
      </div>
    </div>
  `;

  const hotspotLayer = el.runtimeRoot.querySelector('[data-runtime-hotspots]');
  const dialogueBox = el.runtimeRoot.querySelector('[data-dialogue-box] p');

  for (const hotspot of scene.hotspots) {
    const btn = document.createElement('button');
    btn.className = 'hotspot-btn';
    btn.textContent = hotspot.label;
    btn.style.left = `${hotspot.x}%`;
    btn.style.top = `${hotspot.y}%`;
    btn.style.width = `${hotspot.width}%`;
    btn.style.height = `${hotspot.height}%`;

    btn.onclick = () => {
      if (hotspot.action.type === 'gotoScene') {
        const target = hotspot.action.targetSceneId;
        if (target) {
          state.runtime.currentSceneId = target;
          state.runtime.currentDialogue = null;
          renderRuntime();
        }
      } else if (hotspot.action.type === 'showDialogue') {
        const dialogue = scene.dialogues.find((d) => d.id === hotspot.action.dialogueId) || scene.dialogues[0];
        if (dialogue) {
          state.runtime.currentDialogue = dialogue;
          dialogueBox.textContent = `[${dialogue.speaker}] ${dialogue.text}`;
        }
      }
    };

    hotspotLayer.append(btn);
  }

  playAmbientTracks(scene);
}

async function playAmbientTracks(scene) {
  stopAmbientAudio();
  const track = scene.ambientTracks[0];
  if (!track?.file) return;

  const audio = new Audio();
  audio.volume = Math.max(0, Math.min(1, Number(track.volume) || 0.4));
  audio.loop = Boolean(track.loop);

  if (state.folderHandle) {
    try {
      const fileHandle = await state.folderHandle.getFileHandle(track.file);
      const file = await fileHandle.getFile();
      audio.src = URL.createObjectURL(file);
    } catch {
      audio.src = track.file;
    }
  } else {
    audio.src = track.file;
  }

  audio.play().catch(() => {
    notify('El navegador bloqueó autoplay. Haz clic en el runtime para activar audio.');
  });

  state.runtime.ambientAudio = audio;
}

function stopAmbientAudio() {
  if (!state.runtime.ambientAudio) return;
  state.runtime.ambientAudio.pause();
  if (state.runtime.ambientAudio.src.startsWith('blob:')) {
    URL.revokeObjectURL(state.runtime.ambientAudio.src);
  }
  state.runtime.ambientAudio = null;
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function notify(message) {
  el.folderStatus.textContent = message;
}

function sceneSelectMarkup(selected) {
  const options = state.project.scenes
    .map((scene) => `<option value="${scene.id}" ${scene.id === selected ? 'selected' : ''}>${scene.name}</option>`)
    .join('');
  return `<select data-target-scene>${options}</select>`;
}

function dialogueSelectMarkup(scene, selected) {
  const options = scene.dialogues
    .map((dialogue) => `<option value="${dialogue.id}" ${dialogue.id === selected ? 'selected' : ''}>${dialogue.speaker}: ${dialogue.id}</option>`)
    .join('');
  return `<select data-target-dialogue>${options}</select>`;
}

function audioSelectMarkup(selected) {
  const defaults = state.availableAudio.length
    ? state.availableAudio
    : ['(escribe ruta manual en el JSON o conecta carpeta con audios)'];

  const options = defaults
    .map((name) => `<option value="${name}" ${name === selected ? 'selected' : ''}>${name}</option>`)
    .join('');
  return `<select data-track-file>${options}</select>`;
}

function escapeAttr(text = '') {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
