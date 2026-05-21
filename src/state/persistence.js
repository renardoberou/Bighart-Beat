'use strict';

(function (root) {
  const SCHEMA_VERSION = 1;
  const PROJECT_APP = 'bighart-beat-v4';
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether', 'synth'];
  const LEGACY_TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];
  const ENGINES = ['808', '909', 'reznor', 'aphex'];
  const ETHER_MODES = ['hum', 'clock', 'wifi', 'ether'];
  const STEP_COUNT = 16;
  const BANK_COUNT = 4;
  const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
  const TRACK_PARAM_RANGES = {
    kick:  { pitch:[60,240], end:[20,80], decay:[0.10,1.20], click:[0,1], drive:[0,1] },
    snare: { tone:[80,600], body:[0,1], snap:[0,1], decay:[0.04,0.50] },
    hihat: { freq:[4000,14000], decay:[0.002,0.080], open:[0,1], metal:[0,1] },
    clap:  { spread:[2,30], decay:[0.04,0.40], tone:[900,3000] },
    input: { pitch:[0.25,3], decay:[0.10,1] },
    ether: { freq:[20,400], harmonics:[0,1], texture:[0,1], grit:[0,1], decay:[0.05,0.80] },
    synth: { pitch:[40,3000], decay:[0.05,2], tone:[0,1], shape:[0,1] },
  };
  const FX_RANGES = {
    dly: { mult:[0.25,1.5], fb:[0,0.8], tone:[0,1], wet:[0,1] },
    rev: { size:[0,1], damp:[0,1], gate:[40,600], wet:[0,1] },
    comp: { threshold:[-80,0], ratio:[1,20], attack:[1,200], release:[20,2000], gateThreshold:[-80,0], gateRate:[10,2000], gateAnalog:[0,1] },
    wreck: { bits:[4,16], rate:[0,1], threshold:[-80,0], tone:[0,1], mix:[0,1], out:[0,1] },
  };
  const WRECK_CURVES = ['pixel', 'glass', 'shard'];
  const WRECK_ORDERS = ['comp-wreck', 'wreck-comp'];
  const LEGACY_WRECK_CURVE_MAP = { clip: 'pixel', fold: 'glass', crush: 'shard' };

  function getDefaultTracks() {
    if (root && root.BighartBeatState && typeof root.BighartBeatState.createDefaultTracks === 'function') {
      return root.BighartBeatState.createDefaultTracks();
    }
    if (typeof require === 'function') {
      return require('./tracks.js').createDefaultTracks();
    }
    return [];
  }

  function getDefaultFxState() {
    if (root && root.BighartBeatState && typeof root.BighartBeatState.createDefaultFxState === 'function') {
      return root.BighartBeatState.createDefaultFxState();
    }
    if (typeof require === 'function') {
      return require('./fx-state.js').createDefaultFxState();
    }
    return { dly: {}, rev: {}, comp: {} };
  }

  function getPatternChainApi() {
    if (root && root.BighartBeatState && typeof root.BighartBeatState.createDefaultPatternChain === 'function') {
      return root.BighartBeatState;
    }
    if (typeof require === 'function') return require('./pattern-chain.js');
    return null;
  }

  function getSynthNotesApi() {
    if (root && root.BighartBeatState && typeof root.BighartBeatState.createSynthNotesBanks === 'function') return root.BighartBeatState;
    if (typeof require === 'function') return require('./synth-notes.js');
    return null;
  }

  function createSynthNotesBanks() {
    const api = getSynthNotesApi();
    return api && typeof api.createSynthNotesBanks === 'function'
      ? api.createSynthNotesBanks()
      : Array.from({ length: BANK_COUNT }, () => Array(STEP_COUNT).fill(1));
  }

  function cloneSynthNotesBanks(synthNotes) {
    const api = getSynthNotesApi();
    if (api && typeof api.cloneSynthNotesBanks === 'function') return api.cloneSynthNotesBanks(synthNotes);
    return createSynthNotesBanks();
  }

  function createDefaultPatternChain() {
    const api = getPatternChainApi();
    if (api && typeof api.createDefaultPatternChain === 'function') return api.createDefaultPatternChain();
    return { enabled: false, position: 0, barCount: 0, items: [{ pattern: 0, bars: 1 }] };
  }

  function normalizePatternChain(chain) {
    const api = getPatternChainApi();
    if (api && typeof api.normalizePatternChain === 'function') return api.normalizePatternChain(chain);
    return cloneValue(chain);
  }

  function isDangerousKey(key) {
    return DANGEROUS_KEYS.includes(key);
  }

  function cloneValue(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneValue);
    const out = {};
    Object.keys(value).forEach(k => {
      if (isDangerousKey(k)) throw new TypeError('Dangerous key cannot be cloned: ' + k);
      out[k] = cloneValue(value[k]);
    });
    return out;
  }

  function clonePatterns(patterns) {
    return patterns.map(bank => {
      const out = {};
      TRACK_IDS.forEach(id => { out[id] = bank[id].slice(); });
      return out;
    });
  }

  function createDefaultRatchetGrid() {
    const grid = {};
    TRACK_IDS.forEach(id => { grid[id] = Array(STEP_COUNT).fill(1); });
    return grid;
  }

  function createRatchetBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultRatchetGrid);
  }

  function cloneRatchets(ratchets) {
    return ratchets.map(bank => {
      const out = {};
      TRACK_IDS.forEach(id => { out[id] = bank[id].slice(); });
      return out;
    });
  }

  function createDefaultHihatOpennessGrid() {
    return Array(STEP_COUNT).fill(0);
  }

  function createHihatOpennessBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultHihatOpennessGrid);
  }

  function cloneHihatOpennessBanks(hihatOpenness) {
    return hihatOpenness.map(bank => bank.slice());
  }

  function createDefaultHihatAccentGrid() {
    return Array(STEP_COUNT).fill(0);
  }

  function createHihatAccentBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultHihatAccentGrid);
  }

  function normalizeHihatAccentGrid(grid) {
    const out = createDefaultHihatAccentGrid();
    if (!Array.isArray(grid)) return out;
    for (let i = 0; i < Math.min(STEP_COUNT, grid.length); i++) {
      const value = grid[i];
      out[i] = value === 1 || value === true || value === '1' || value === 'ACC' || value === 'acc' ? 1 : 0;
    }
    return out;
  }

  function cloneHihatAccentBanks(hihatAccent) {
    return Array.from({ length: BANK_COUNT }, (_, i) => normalizeHihatAccentGrid(Array.isArray(hihatAccent) ? hihatAccent[i] : undefined));
  }

  function clonePatternFxScenes(patternFxScenes) {
    const scenes = Array(BANK_COUNT).fill(null);
    if (!Array.isArray(patternFxScenes)) return scenes;
    for (let i = 0; i < Math.min(BANK_COUNT, patternFxScenes.length); i++) {
      scenes[i] = patternFxScenes[i] == null ? null : cloneValue(patternFxScenes[i]);
    }
    return scenes;
  }

  function serializeTracks(tracks) {
    return tracks.map(t => ({
      id: t.id,
      mute: !!t.mute,
      vol: t.vol,
      dlyS: !!t.dlyS,
      revS: !!t.revS,
      wreckS: !!t.wreckS,
      p: cloneValue(t.p || {}),
    }));
  }

  function serializeProject(input) {
    const appState = input.appState || input.state || {};
    const meta = { app: PROJECT_APP };
    const timestamp = input.timestamp !== undefined ? input.timestamp : input.meta && input.meta.ts;
    if (timestamp !== undefined) meta.ts = timestamp;
    const project = {
      schemaVersion: SCHEMA_VERSION,
      bpm: appState.bpm,
      swing: appState.swing || 0,
      patt: appState.patt,
      engine: ENGINES.includes(appState.engine) ? appState.engine : 'aphex',
      mstVol: appState.mstVol,
      patterns: clonePatterns(input.patterns),
      tracks: serializeTracks(input.tracks),
      fx: cloneValue(input.fx),
      meta,
    };
    if (input.ratchets !== undefined) project.ratchets = cloneRatchets(input.ratchets);
    if (input.hihatOpenness !== undefined) project.hihatOpenness = cloneHihatOpennessBanks(input.hihatOpenness);
    if (input.hihatAccent !== undefined) project.hihatAccent = cloneHihatAccentBanks(input.hihatAccent);
    if (input.synthNotes !== undefined) project.synthNotes = cloneSynthNotesBanks(input.synthNotes);
    if (input.patternFxScenes !== undefined) project.patternFxScenes = clonePatternFxScenes(input.patternFxScenes);
    project.patternChain = normalizePatternChain(input.patternChain || appState.patternChain || createDefaultPatternChain());
    return project;
  }

  function validateProjectData(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['Project data must be an object'] };
    }

    validateNoDangerousKeys(data, errors, 'project');

    if (data.schemaVersion !== undefined && data.schemaVersion !== SCHEMA_VERSION) {
      errors.push('Unsupported schemaVersion: ' + data.schemaVersion);
    }
    if (data.meta !== undefined) validateMeta(data.meta, errors);
    validateNumberInRange(data.bpm, 40, 240, errors, 'bpm');
    if (data.swing !== undefined) validateNumberInRange(data.swing, 0, 1, errors, 'swing');
    if (data.patt !== undefined && (!Number.isInteger(data.patt) || data.patt < 0 || data.patt >= BANK_COUNT)) {
      errors.push('patt must be an integer from 0 to 3');
    }
    if (data.engine !== undefined && !ENGINES.includes(data.engine)) {
      errors.push('engine must be one of: ' + ENGINES.join(', '));
    }
    validateNumberInRange(data.mstVol, 0, 1, errors, 'mstVol');

    validatePatterns(data.patterns, errors);
    validateRatchets(data.ratchets, errors);
    validateHihatOpenness(data.hihatOpenness, errors);
    validateHihatAccent(data.hihatAccent, errors);
    validateSynthNotes(data.synthNotes, errors);
    validatePatternFxScenes(data.patternFxScenes, errors);
    validatePatternChain(data.patternChain, errors);
    validateTracks(data.tracks, errors);
    validateFx(data.fx, errors);

    return { ok: errors.length === 0, errors };
  }

  function validateNoDangerousKeys(value, errors, path) {
    if (value == null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => validateNoDangerousKeys(item, errors, path + '[' + index + ']'));
      return;
    }

    Object.keys(value).forEach(key => {
      if (isDangerousKey(key)) {
        errors.push('Dangerous key at ' + path + ': ' + key);
        return;
      }
      validateNoDangerousKeys(value[key], errors, path + '.' + key);
    });
  }

  function validatePatterns(patterns, errors) {
    if (!Array.isArray(patterns) || patterns.length !== BANK_COUNT) {
      errors.push('patterns must contain exactly 4 banks');
      return;
    }
    patterns.forEach((bank, bankIndex) => {
      if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
        errors.push('patterns[' + bankIndex + '] must be an object');
        return;
      }
      Object.keys(bank).forEach(trackId => {
        if (!TRACK_IDS.includes(trackId)) errors.push('patterns[' + bankIndex + '] has unknown track key: ' + trackId);
      });
      TRACK_IDS.forEach(trackId => {
        const steps = bank[trackId];
        if (!Array.isArray(steps) || steps.length !== STEP_COUNT) {
          errors.push('patterns[' + bankIndex + '].' + trackId + ' must contain 16 steps');
          return;
        }
        steps.forEach((step, stepIndex) => {
          if (step !== 0 && step !== 1) {
            errors.push('patterns[' + bankIndex + '].' + trackId + '[' + stepIndex + '] must be 0/1');
          }
        });
      });
    });
  }

  function validateRatchets(ratchets, errors) {
    if (ratchets === undefined) return;
    if (!Array.isArray(ratchets) || ratchets.length !== BANK_COUNT) {
      errors.push('ratchets must contain exactly 4 banks');
      return;
    }
    ratchets.forEach((bank, bankIndex) => {
      if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
        errors.push('ratchets[' + bankIndex + '] must be an object');
        return;
      }
      Object.keys(bank).forEach(trackId => {
        if (!TRACK_IDS.includes(trackId)) errors.push('ratchets[' + bankIndex + '] has unknown track key: ' + trackId);
      });
      TRACK_IDS.forEach(trackId => {
        const steps = bank[trackId];
        if (!Array.isArray(steps) || steps.length !== STEP_COUNT) {
          errors.push('ratchets[' + bankIndex + '].' + trackId + ' must contain 16 counts');
          return;
        }
        steps.forEach((count, stepIndex) => {
          if (count !== 1 && count !== 2 && count !== 3) {
            errors.push('ratchets[' + bankIndex + '].' + trackId + '[' + stepIndex + '] must be integer 1/2/3');
          }
        });
      });
    });
  }

  function validateHihatOpenness(hihatOpenness, errors) {
    if (hihatOpenness === undefined) return;
    if (!Array.isArray(hihatOpenness) || hihatOpenness.length !== BANK_COUNT) {
      errors.push('hihatOpenness must contain exactly 4 banks');
      return;
    }
    hihatOpenness.forEach((bank, bankIndex) => {
      if (!Array.isArray(bank) || bank.length !== STEP_COUNT) {
        errors.push('hihatOpenness[' + bankIndex + '] must contain 16 openness values');
        return;
      }
      bank.forEach((value, stepIndex) => {
        if (value !== 0 && value !== 0.45 && value !== 1) {
          errors.push('hihatOpenness[' + bankIndex + '][' + stepIndex + '] must be 0, 0.45, or 1');
        }
      });
    });
  }

  function validateHihatAccent(hihatAccent, errors) {
    if (hihatAccent === undefined) return;
    if (!Array.isArray(hihatAccent) || hihatAccent.length !== BANK_COUNT) {
      errors.push('hihatAccent must contain exactly 4 banks');
      return;
    }
    hihatAccent.forEach((bank, bankIndex) => {
      if (!Array.isArray(bank)) errors.push('hihatAccent[' + bankIndex + '] must be an array');
    });
  }

  function validateSynthNotes(synthNotes, errors) {
    if (synthNotes === undefined) return;
    if (!Array.isArray(synthNotes) || synthNotes.length !== BANK_COUNT) {
      errors.push('synthNotes must contain exactly 4 banks');
      return;
    }
    synthNotes.forEach((bank, bankIndex) => {
      if (!Array.isArray(bank) || bank.length !== STEP_COUNT) {
        errors.push('synthNotes[' + bankIndex + '] must contain 16 harmonic ratios');
        return;
      }
      bank.forEach((value, stepIndex) => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.25 || value > 16) {
          errors.push('synthNotes[' + bankIndex + '][' + stepIndex + '] must be a finite ratio from 0.25 to 16');
        }
      });
    });
  }

  function validatePatternFxScenes(patternFxScenes, errors) {
    if (patternFxScenes === undefined) return;
    if (!Array.isArray(patternFxScenes) || patternFxScenes.length !== BANK_COUNT) {
      errors.push('patternFxScenes must contain exactly 4 banks');
      return;
    }
    patternFxScenes.forEach((scene, sceneIndex) => {
      if (scene == null) return;
      if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
        errors.push('patternFxScenes[' + sceneIndex + '] must be an object or null');
        return;
      }
      Object.keys(scene).forEach(key => {
        if (!['fx', 'mix', 'engine', 'mstVol'].includes(key)) errors.push('patternFxScenes[' + sceneIndex + '].' + key + ' is unknown');
      });
      if (scene.engine !== undefined && !ENGINES.includes(scene.engine)) {
        errors.push('patternFxScenes[' + sceneIndex + '].engine must be one of: ' + ENGINES.join(', '));
      }
      if (scene.mstVol !== undefined) validateNumberInRange(scene.mstVol, 0, 1, errors, 'patternFxScenes[' + sceneIndex + '].mstVol');
      if (scene.fx !== undefined) validateFx(scene.fx, errors, 'patternFxScenes[' + sceneIndex + '].fx');
      if (scene.mix !== undefined) validatePatternFxSceneMix(scene.mix, sceneIndex, errors);
    });
  }

  function validatePatternFxSceneMix(mix, sceneIndex, errors) {
    if (!Array.isArray(mix)) {
      errors.push('patternFxScenes[' + sceneIndex + '].mix must be an array');
      return;
    }
    const seen = {};
    mix.forEach((track, trackIndex) => {
      const path = 'patternFxScenes[' + sceneIndex + '].mix[' + trackIndex + ']';
      if (!track || typeof track !== 'object' || Array.isArray(track)) {
        errors.push(path + ' must be an object');
        return;
      }
      if (!TRACK_IDS.includes(track.id)) {
        errors.push(path + '.id must be a known canonical track id');
      } else if (seen[track.id]) {
        errors.push(path + '.id is duplicated: ' + track.id);
      } else {
        seen[track.id] = true;
      }
      ['mute', 'dlyS', 'revS', 'wreckS'].forEach(field => {
        if (typeof track[field] !== 'boolean') errors.push(path + '.' + field + ' must be a boolean');
      });
      if (track.vol !== undefined) validateNumberInRange(track.vol, 0, 1, errors, path + '.vol');
    });
  }

  function validatePatternChain(chain, errors) {
    if (chain === undefined) return;
    try {
      normalizePatternChain(chain);
    } catch (err) {
      errors.push(err && err.message ? err.message : 'patternChain is invalid');
    }
  }

  function validateTracks(tracks, errors) {
    if (!Array.isArray(tracks)) {
      errors.push('tracks must be an array');
      return;
    }
    if (tracks.length !== TRACK_IDS.length) {
      errors.push('tracks must contain exactly 7 canonical tracks (or 6 legacy tracks for import hydration)');
    }
    const seen = {};
    tracks.forEach((track, index) => {
      if (!track || typeof track !== 'object' || Array.isArray(track)) {
        errors.push('tracks[' + index + '] must be an object');
        return;
      }
      if (!TRACK_IDS.includes(track.id)) {
        errors.push('track id must be known canonical id: ' + track.id);
      } else if (seen[track.id]) {
        errors.push('track id must appear exactly once; duplicate: ' + track.id);
      } else {
        seen[track.id] = true;
      }
      ['mute', 'dlyS', 'revS', 'wreckS'].forEach(field => {
        if (typeof track[field] !== 'boolean') errors.push('tracks[' + index + '].' + field + ' must be a boolean');
      });
      if (track.vol !== undefined) validateNumberInRange(track.vol, 0, 1, errors, 'tracks[' + index + '].vol');
      if (track.p !== undefined && (!track.p || typeof track.p !== 'object' || Array.isArray(track.p))) {
        errors.push('tracks[' + index + '].p must be an object');
      } else if (track.p !== undefined && TRACK_IDS.includes(track.id)) {
        validateTrackParams(track.id, track.p, errors, 'tracks[' + index + '].p');
      }
    });
    TRACK_IDS.forEach(trackId => {
      if (!seen[trackId]) errors.push('track id must appear exactly once; missing: ' + trackId);
    });
  }

  function validateTrackParams(trackId, params, errors, path) {
    const schemaTrack = getDefaultTracks().find(t => t.id === trackId);
    const schemaParams = schemaTrack && schemaTrack.p ? schemaTrack.p : {};
    Object.keys(params).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(schemaParams, key)) {
        errors.push(path + '.' + key + ' is unknown');
        return;
      }
      const expected = schemaParams[key];
      const value = params[key];
      if (trackId === 'ether' && key === 'mode') {
        if (!ETHER_MODES.includes(value)) errors.push(path + '.mode must be one of: ' + ETHER_MODES.join(', '));
      } else if (typeof expected === 'number') {
        const range = TRACK_PARAM_RANGES[trackId] && TRACK_PARAM_RANGES[trackId][key];
        validateNumberInRange(value, range && range[0], range && range[1], errors, path + '.' + key);
      } else if (typeof value !== typeof expected) {
        errors.push(path + '.' + key + ' must be a ' + typeof expected);
      }
    });
  }

  function validateMeta(meta, errors) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      errors.push('meta must be an object');
      return;
    }
    if (meta.app !== undefined && meta.app !== PROJECT_APP) {
      errors.push('meta.app must be ' + PROJECT_APP);
    }
  }

  function validateFx(fx, errors, pathPrefix) {
    const path = pathPrefix || 'fx';
    if (!fx || typeof fx !== 'object' || Array.isArray(fx)) {
      errors.push(path + ' must be an object');
      return;
    }
    const schema = getDefaultFxState();
    Object.keys(fx).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(schema, key)) errors.push(path + '.' + key + ' is unknown');
    });
    ['dly', 'rev', 'comp'].forEach(key => {
      if (fx[key] === undefined) {
        errors.push(path + '.' + key + ' must be an object');
        return;
      }
      if (!fx[key] || typeof fx[key] !== 'object' || Array.isArray(fx[key])) {
        errors.push(path + '.' + key + ' must be an object');
        return;
      }
      validateFxSection(key, fx[key], schema[key] || {}, errors, path);
    });
    if (fx.wreck !== undefined) {
      if (!fx.wreck || typeof fx.wreck !== 'object' || Array.isArray(fx.wreck)) {
        errors.push(path + '.wreck must be an object');
      } else {
        validateFxSection('wreck', fx.wreck, schema.wreck || {}, errors, path);
      }
    }
  }

  function validateFxSection(sectionName, section, schemaSection, errors, pathPrefix) {
    const path = pathPrefix || 'fx';
    Object.keys(section).forEach(field => {
      if (!Object.prototype.hasOwnProperty.call(schemaSection, field)) {
        errors.push(path + '.' + sectionName + '.' + field + ' is unknown');
        return;
      }
      const value = section[field];
      if (field === 'on' || field === 'gateOn') {
        if (typeof value !== 'boolean') errors.push(path + '.' + sectionName + '.on must be a boolean');
      } else if (field === 'detector') {
        if (value !== 'peak' && value !== 'rms') errors.push(path + '.' + sectionName + '.detector must be peak or rms');
      } else if (field === 'curve') {
        if (!WRECK_CURVES.includes(value) && !Object.prototype.hasOwnProperty.call(LEGACY_WRECK_CURVE_MAP, value)) {
          errors.push(path + '.' + sectionName + '.curve must be one of: ' + WRECK_CURVES.join(', '));
        }
      } else if (field === 'order') {
        if (!WRECK_ORDERS.includes(value)) errors.push(path + '.' + sectionName + '.order must be one of: ' + WRECK_ORDERS.join(', '));
      } else {
        const range = FX_RANGES[sectionName] && FX_RANGES[sectionName][field];
        validateNumberInRange(value, range && range[0], range && range[1], errors, path + '.' + sectionName + '.' + field);
      }
    });
  }

  function validateNumberInRange(value, min, max, errors, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(path + ' must be a finite number');
      return;
    }
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      errors.push(path + ' must be between ' + min + ' and ' + max);
    }
  }

  function parseProjectImport(input) {
    let data = input;
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch (err) {
        return { ok: false, errors: ['Invalid JSON: ' + err.message] };
      }
    }

    const dangerousKeyErrors = [];
    validateNoDangerousKeys(data, dangerousKeyErrors, 'project');
    if (dangerousKeyErrors.length) return { ok: false, errors: dangerousKeyErrors };

    data = hydrateLegacySixTrackProject(data);
    data = hydrateMissingWreckS(data);
    data = normalizeLegacySynthPitchMax(data);
    const validation = validateProjectData(data);
    if (!validation.ok) return validation;
    const value = cloneValue(data);
    if (value.engine === undefined) value.engine = 'aphex';
    if (value.swing === undefined) value.swing = 0;
    if (value.ratchets === undefined) value.ratchets = createRatchetBanks();
    if (value.hihatOpenness === undefined) value.hihatOpenness = createHihatOpennessBanks();
    value.hihatAccent = value.hihatAccent === undefined ? createHihatAccentBanks() : cloneHihatAccentBanks(value.hihatAccent);
    if (value.synthNotes === undefined) value.synthNotes = createSynthNotesBanks();
    if (value.patternFxScenes === undefined) value.patternFxScenes = Array(BANK_COUNT).fill(null);
    value.patternChain = value.patternChain === undefined ? createDefaultPatternChain() : normalizePatternChain(value.patternChain);
    normalizeLegacyFx(value.fx);
    return { ok: true, value, errors: [] };
  }

  function hydrateLegacySixTrackProject(data) {
    if (!isLegacySixTrackProject(data)) return data;
    const hydrated = { ...data };
    hydrated.tracks = data.tracks.map(track => cloneValue(track));
    hydrated.tracks.forEach(track => { if (track.wreckS === undefined) track.wreckS = false; });
    hydrated.tracks.push(serializeTracks([getDefaultSynthTrack()])[0]);
    if (Array.isArray(data.patterns)) hydrated.patterns = hydrateLegacyBanks(data.patterns, 0);
    if (Array.isArray(data.ratchets)) hydrated.ratchets = hydrateLegacyBanks(data.ratchets, 1);
    return hydrated;
  }

  function hydrateMissingWreckS(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tracks)) return data;
    if (data.tracks.every(track => track && Object.prototype.hasOwnProperty.call(track, 'wreckS'))) return data;
    const hydrated = { ...data, tracks: data.tracks.map(track => cloneValue(track)) };
    hydrated.tracks.forEach(track => { if (track && track.wreckS === undefined) track.wreckS = false; });
    return hydrated;
  }

  function normalizeLegacySynthPitchMax(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tracks)) return data;
    const synthIndex = data.tracks.findIndex(track => track && track.id === 'synth');
    if (synthIndex < 0) return data;
    const synth = data.tracks[synthIndex];
    if (!synth || !synth.p || typeof synth.p !== 'object' || Array.isArray(synth.p)) return data;
    if (typeof synth.p.pitch !== 'number' || !Number.isFinite(synth.p.pitch) || synth.p.pitch <= 3000) return data;
    const normalized = { ...data, tracks: data.tracks.map(track => cloneValue(track)) };
    normalized.tracks[synthIndex].p.pitch = 3000;
    return normalized;
  }

  function isLegacySixTrackProject(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tracks)) return false;
    if (data.tracks.length !== LEGACY_TRACK_IDS.length) return false;
    const ids = data.tracks.map(track => track && track.id);
    return LEGACY_TRACK_IDS.every(id => ids.includes(id)) && !ids.includes('synth');
  }

  function getDefaultSynthTrack() {
    const synth = getDefaultTracks().find(track => track.id === 'synth');
    if (!synth) {
      return { id:'synth', mute:false, vol:.52, dlyS:true, revS:true, wreckS:false, p:{ pitch:220, decay:.35, tone:.50, shape:.50 } };
    }
    return synth;
  }

  function hydrateLegacyBanks(banks, fillValue) {
    return banks.map(bank => {
      if (!bank || typeof bank !== 'object' || Array.isArray(bank) || bank.synth !== undefined) return bank;
      const hydrated = { ...bank };
      hydrated.synth = Array(STEP_COUNT).fill(fillValue);
      return hydrated;
    });
  }

  function normalizeLegacyFx(fx) {
    if (!fx || !fx.wreck) return;
    if (Object.prototype.hasOwnProperty.call(LEGACY_WRECK_CURVE_MAP, fx.wreck.curve)) {
      fx.wreck.curve = LEGACY_WRECK_CURVE_MAP[fx.wreck.curve];
    }
    if (fx.wreck.threshold === undefined) fx.wreck.threshold = -24;
    if (fx.wreck.order === undefined) fx.wreck.order = 'comp-wreck';
  }

  const api = {
    SCHEMA_VERSION,
    PROJECT_APP,
    ENGINES,
    serializeProject,
    parseProjectImport,
    validateProjectData,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
