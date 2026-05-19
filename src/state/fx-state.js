'use strict';

(function (root) {
  const BANK_COUNT = 4;
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];

  function createDefaultFxState() {
    return {
      dly: { on:false, mult:0.75, fb:.32, tone:.55, wet:.26 }, // mult = of a beat (16th = 0.25)
      rev: { on:false, size:.60, damp:.55, gate:180, wet:.28 },
      comp: {
        on:false,
        threshold:-24,
        ratio:4,
        attack:8,
        release:280,
        detector:'rms',
        gateOn:false,
        gateThreshold:-60,
        gateRate:120,
        gateAnalog:.35,
      },
      wreck: { on:false, bits:12, rate:.75, curve:'pixel', threshold:-24, tone:.65, mix:.35, out:.85, order:'comp-wreck' },
    };
  }

  function cloneSceneValue(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneSceneValue);
    const out = {};
    Object.keys(value).forEach(k => { out[k] = cloneSceneValue(value[k]); });
    return out;
  }

  function createPatternFxScenes() {
    return Array(BANK_COUNT).fill(null);
  }

  function capturePatternFxScene(input) {
    const appState = input.appState || input.state || {};
    return {
      fx: cloneSceneValue(input.fx || createDefaultFxState()),
      mix: (input.tracks || []).map(t => ({
        id: t.id,
        mute: !!t.mute,
        vol: typeof t.vol === 'number' ? t.vol : 0,
        dlyS: !!t.dlyS,
        revS: !!t.revS,
        wreckS: !!t.wreckS,
      })),
      engine: appState.engine,
      mstVol: appState.mstVol,
    };
  }

  function clonePatternFxScene(scene) {
    if (scene == null) return null;
    return capturePatternFxScene({
      fx: scene.fx || createDefaultFxState(),
      tracks: Array.isArray(scene.mix) ? scene.mix : [],
      appState: { engine: scene.engine, mstVol: scene.mstVol },
    });
  }

  function clonePatternFxScenes(scenes) {
    const out = createPatternFxScenes();
    if (!Array.isArray(scenes)) return out;
    for (let i = 0; i < Math.min(BANK_COUNT, scenes.length); i++) out[i] = clonePatternFxScene(scenes[i]);
    return out;
  }

  function applyPatternFxScene(scene, target) {
    const safeScene = clonePatternFxScene(scene);
    if (!safeScene) return false;
    if (safeScene.fx && target.fx) {
      Object.keys(safeScene.fx).forEach(section => {
        if (target.fx[section] && safeScene.fx[section]) Object.assign(target.fx[section], safeScene.fx[section]);
      });
    }
    if (Array.isArray(safeScene.mix) && Array.isArray(target.tracks)) {
      safeScene.mix.forEach(savedTrack => {
        const track = target.tracks.find(t => t.id === savedTrack.id);
        if (!track) return;
        track.mute = !!savedTrack.mute;
        if (typeof savedTrack.vol === 'number') track.vol = savedTrack.vol;
        track.dlyS = !!savedTrack.dlyS;
        track.revS = !!savedTrack.revS;
        track.wreckS = !!savedTrack.wreckS;
      });
    }
    const appState = target.appState || target.state;
    if (appState) {
      if (typeof safeScene.engine === 'string') appState.engine = safeScene.engine;
      if (typeof safeScene.mstVol === 'number') appState.mstVol = safeScene.mstVol;
    }
    return true;
  }

  const api = {
    createDefaultFxState,
    createPatternFxScenes,
    capturePatternFxScene,
    clonePatternFxScene,
    clonePatternFxScenes,
    applyPatternFxScene,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
