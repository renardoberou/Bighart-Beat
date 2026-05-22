'use strict';

(function (root) {
  function createDefaultTracks() {
    return [
      { id:'kick',  n:'KCK', col:'r', mute:false, vol:.78, dlyS:false, revS:false, wreckS:false,
        p:{ pitch:150, end:42, decay:.45, click:.42, drive:.32 } },
      { id:'snare', n:'SNR', col:'o', mute:false, vol:.68, dlyS:false, revS:true, wreckS:false,
        p:{ tone:210, snap:.70, decay:.18, body:.55 } },
      { id:'hihat', n:'HHT', col:'a', mute:false, vol:.46, dlyS:false, revS:false, wreckS:false,
        p:{ freq:8200, decay:.055, open:.0, metal:.30 } },
      { id:'clap',  n:'CLP', col:'b', mute:false, vol:.58, dlyS:true,  revS:true, wreckS:false,
        p:{ spread:10, decay:.14, tone:1700 } },
      { id:'input', n:'INP', col:'g', mute:false, vol:.70, dlyS:false, revS:false, wreckS:false,
        p:{ pitch:1.0, decay:1.0 }, smp:null, smpN:null },
      { id:'ether', n:'ETH', col:'e', mute:false, vol:.62, dlyS:true,  revS:true, wreckS:false,
        p:{ mode:'ether', freq:55, harmonics:.5, texture:.5, decay:.28, grit:.4 } },
      { id:'synth', n:'SYN', col:'p', mute:false, vol:.52, dlyS:true,  revS:true, wreckS:false,
        p:{ pitch:125, decay:.35, tone:.50, shape:.50 } },
    ];
  }

  const api = { createDefaultTracks };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
