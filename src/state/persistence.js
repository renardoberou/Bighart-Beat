'use strict';

(function (root) {
  const SCHEMA_VERSION = 1;
  const PROJECT_APP = 'bighart-beat-v4';
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];
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
  };
  const FX_RANGES = {
    dly: { mult:[0.25,1.5], fb:[0,1], tone:[0,1], wet:[0,1] },
    rev: { size:[0,1], damp:[0,1], gate:[40,600], wet:[0,1] },
  };

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
    return { dly: {}, rev: {} };
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

  function serializeTracks(tracks) {
    return tracks.map(t => ({
      id: t.id,
      mute: !!t.mute,
      vol: t.vol,
      dlyS: !!t.dlyS,
      revS: !!t.revS,
      p: cloneValue(t.p || {}),
    }));
  }

  function serializeProject(input) {
    const appState = input.appState || input.state || {};
    const meta = { app: PROJECT_APP };
    const timestamp = input.timestamp !== undefined ? input.timestamp : input.meta && input.meta.ts;
    if (timestamp !== undefined) meta.ts = timestamp;
    return {
      schemaVersion: SCHEMA_VERSION,
      bpm: appState.bpm,
      patt: appState.patt,
      mstVol: appState.mstVol,
      patterns: clonePatterns(input.patterns),
      tracks: serializeTracks(input.tracks),
      fx: cloneValue(input.fx),
      meta,
    };
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
    if (data.patt !== undefined && (!Number.isInteger(data.patt) || data.patt < 0 || data.patt >= BANK_COUNT)) {
      errors.push('patt must be an integer from 0 to 3');
    }
    validateNumberInRange(data.mstVol, 0, 1, errors, 'mstVol');

    validatePatterns(data.patterns, errors);
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

  function validateTracks(tracks, errors) {
    if (!Array.isArray(tracks)) {
      errors.push('tracks must be an array');
      return;
    }
    if (tracks.length !== TRACK_IDS.length) {
      errors.push('tracks must contain exactly 6 canonical tracks');
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
      ['mute', 'dlyS', 'revS'].forEach(field => {
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

  function validateFx(fx, errors) {
    if (!fx || typeof fx !== 'object' || Array.isArray(fx)) {
      errors.push('fx must be an object');
      return;
    }
    const schema = getDefaultFxState();
    Object.keys(fx).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(schema, key)) errors.push('fx.' + key + ' is unknown');
    });
    ['dly', 'rev'].forEach(key => {
      if (fx[key] === undefined) {
        errors.push('fx.' + key + ' must be an object');
        return;
      }
      if (!fx[key] || typeof fx[key] !== 'object' || Array.isArray(fx[key])) {
        errors.push('fx.' + key + ' must be an object');
        return;
      }
      validateFxSection(key, fx[key], schema[key] || {}, errors);
    });
  }

  function validateFxSection(sectionName, section, schemaSection, errors) {
    Object.keys(section).forEach(field => {
      if (!Object.prototype.hasOwnProperty.call(schemaSection, field)) {
        errors.push('fx.' + sectionName + '.' + field + ' is unknown');
        return;
      }
      const value = section[field];
      if (field === 'on') {
        if (typeof value !== 'boolean') errors.push('fx.' + sectionName + '.on must be a boolean');
      } else {
        const range = FX_RANGES[sectionName] && FX_RANGES[sectionName][field];
        validateNumberInRange(value, range && range[0], range && range[1], errors, 'fx.' + sectionName + '.' + field);
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

    const validation = validateProjectData(data);
    if (!validation.ok) return validation;
    return { ok: true, value: cloneValue(data), errors: [] };
  }

  const api = {
    SCHEMA_VERSION,
    PROJECT_APP,
    serializeProject,
    parseProjectImport,
    validateProjectData,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
