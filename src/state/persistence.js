'use strict';

(function (root) {
  const SCHEMA_VERSION = 1;
  const PROJECT_APP = 'bighart-beat-v4';
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];
  const STEP_COUNT = 16;
  const BANK_COUNT = 4;
  const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

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
    if (typeof data.bpm !== 'number' || !Number.isFinite(data.bpm)) errors.push('bpm must be a finite number');
    if (data.patt !== undefined && (!Number.isInteger(data.patt) || data.patt < 0 || data.patt >= BANK_COUNT)) {
      errors.push('patt must be an integer from 0 to 3');
    }
    if (typeof data.mstVol !== 'number' || !Number.isFinite(data.mstVol)) errors.push('mstVol must be a finite number');

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
    tracks.forEach((track, index) => {
      if (!track || typeof track !== 'object' || Array.isArray(track)) {
        errors.push('tracks[' + index + '] must be an object');
        return;
      }
      if (!TRACK_IDS.includes(track.id)) errors.push('track id must be known: ' + track.id);
      if (track.vol !== undefined && (typeof track.vol !== 'number' || !Number.isFinite(track.vol))) {
        errors.push('tracks[' + index + '].vol must be a finite number');
      }
      if (track.p !== undefined && (!track.p || typeof track.p !== 'object' || Array.isArray(track.p))) {
        errors.push('tracks[' + index + '].p must be an object');
      }
    });
  }

  function validateFx(fx, errors) {
    if (fx === undefined) return;
    if (!fx || typeof fx !== 'object' || Array.isArray(fx)) {
      errors.push('fx must be an object');
      return;
    }
    ['dly', 'rev'].forEach(key => {
      if (fx[key] !== undefined && (!fx[key] || typeof fx[key] !== 'object' || Array.isArray(fx[key]))) {
        errors.push('fx.' + key + ' must be an object');
      }
    });
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
