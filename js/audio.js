/*
 * Procedural audio for a quiet Jiangnan garden.
 * No AudioContext is created until unlock()/resume() is explicitly requested.
 */

const MASTER_CEILING = 0.32;
const MAX_VOICES = 40;
const MAX_VOICE_SOURCES = 96;
const SCHEDULER_INTERVAL = 250;
const SCHEDULER_AHEAD = 0.8;

const WEATHER_LEVELS = {
  sunny: { water: 0.85, wind: 0.075, rain: 0 },
  rain: { water: 0.72, wind: 0.105, rain: 0.07 },
  snow: { water: 0.58, wind: 0.14, rain: 0 },
};

const EFFECT_INTERVALS = {
  click: 0.025,
  feed: 0.08,
  splash: 0.08,
  chime: 0.16,
  bell: 0.2,
  bird: 0.12,
  step: 0.055,
  photo: 0.12,
  lotus: 0.16,
  rain: 0.3,
};

// D major pentatonic: D, E, F#, A, B across two octaves.
const MELODY_SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];
const CHIME_NOTES = [1174.66, 1318.51, 1479.98, 1760, 1975.53];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomBetween = (min, max) => min + Math.random() * (max - min);
const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function disconnectSafely(node) {
  if (!node) return;
  try {
    node.disconnect();
  } catch (_) {
    // A node may already have been disconnected during partial setup.
  }
}

function stopSafely(source) {
  if (!source) return;
  try {
    source.stop();
  } catch (_) {
    // stop() is intentionally idempotent at this cleanup boundary.
  }
}

/**
 * Procedural, asset-free garden audio.
 *
 * Call `await audio.unlock()` from a pointer/key user gesture before play().
 * All public methods fail quietly when Web Audio is unavailable.
 */
export class GardenAudio {
  constructor() {
    this._ctx = null;
    this._destroyed = false;
    this._desiredRunning = false;
    this._revision = 0;

    this._volume = 0.72;
    this._muted = false;
    this._weather = 'sunny';

    this._master = null;
    this._compressor = null;
    this._ambientBus = null;
    this._musicBus = null;
    this._sfxBus = null;
    this._reverbInput = null;
    this._reverb = null;
    this._reverbReturn = null;

    this._waterGain = null;
    this._windGain = null;
    this._rainGain = null;

    this._ambienceStarted = false;
    this._persistentSources = [];
    this._persistentNodes = [];
    this._voices = new Set();
    this._activeVoiceSources = 0;

    this._noiseBuffers = new Map();
    this._pluckBuffers = new Map();
    this._lastPlayed = new Map();

    this._schedulerId = null;
    this._nextPluckAt = 0;
    this._nextBirdAt = 0;
    this._nextDropAt = 0;
    this._melodyIndex = 3;
    this._phraseRemaining = 0;

    this._hidden = typeof document !== 'undefined' ? Boolean(document.hidden) : false;
    this._onVisibilityChange = () => this._handleVisibilityChange();
    this._onSchedulerTick = () => this._schedulerTick();

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this._onVisibilityChange, { passive: true });
    }
  }

  /** Create/resume Web Audio and start the ambient soundscape. */
  async unlock() {
    return this._activate(true);
  }

  /** Resume after suspend(); may also perform the initial unlock. */
  async resume() {
    return this._activate(true);
  }

  /** Suspend audio without discarding the generated soundscape. */
  async suspend() {
    this._desiredRunning = false;
    this._revision += 1;
    this._clearScheduler();

    const ctx = this._ctx;
    if (!ctx || ctx.state === 'closed') return true;

    try {
      if (ctx.state === 'running') await ctx.suspend();
      return ctx.state !== 'running';
    } catch (_) {
      return false;
    }
  }

  /** Set linear user volume. The actual master gain never exceeds 0.32. */
  setVolume(value) {
    if (!Number.isFinite(value)) return this._volume;
    this._volume = clamp(value, 0, 1);
    this._applyMasterGain();
    return this._volume;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    this._applyMasterGain();
    return this._muted;
  }

  toggleMuted() {
    return this.setMuted(!this._muted);
  }

  /** Select sunny, rain, or snow ambience; invalid values leave it unchanged. */
  setWeather(weather) {
    if (!Object.prototype.hasOwnProperty.call(WEATHER_LEVELS, weather)) {
      return this._weather;
    }

    const changed = this._weather !== weather;
    this._weather = weather;
    this._applyWeather();

    if (changed && this._ctx) {
      const now = this._ctx.currentTime;
      this._nextDropAt = now + 0.25;
      this._nextBirdAt = now + (weather === 'sunny'
        ? randomBetween(2, 5)
        : randomBetween(8, 14));
    }

    return this._weather;
  }

  /**
   * Play a one-shot effect. Returns false if locked, hidden, suspended, unknown,
   * throttled, or temporarily over the polyphony safety limit.
   *
   * Common options: volume (0..1), pitch (0.5..2), pan (-1..1), delay (0..2 s).
   * bell also accepts { variant: 'wood' }; chime accepts count (2..5);
   * rain accepts duration (0.35..6 s); splash/feed accept intensity (0.3..1.25).
   */
  play(name, options = {}) {
    const ctx = this._ctx;
    if (
      this._destroyed ||
      !ctx ||
      ctx.state !== 'running' ||
      !this._desiredRunning ||
      this._isPageHidden() ||
      typeof name !== 'string'
    ) {
      return false;
    }

    if (!options || typeof options !== 'object') options = {};
    const effect = name.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(EFFECT_INTERVALS, effect)) return false;

    const now = ctx.currentTime;
    const previous = this._lastPlayed.get(effect);
    if (previous !== undefined && now - previous < EFFECT_INTERVALS[effect]) return false;

    const volume = Number.isFinite(options.volume) ? clamp(options.volume, 0, 1) : 1;
    if (volume === 0) return true;

    const pitch = Number.isFinite(options.pitch) ? clamp(options.pitch, 0.5, 2) : 1;
    const pan = Number.isFinite(options.pan) ? clamp(options.pan, -1, 1) : 0;
    const delay = Number.isFinite(options.delay) ? clamp(options.delay, 0, 2) : 0;
    const intensity = Number.isFinite(options.intensity)
      ? clamp(options.intensity, 0.3, 1.25)
      : 1;
    const when = now + 0.008 + delay;

    let played = false;
    try {
      switch (effect) {
        case 'click':
          played = this._playClick(when, volume, pitch, pan);
          break;
        case 'feed':
          played = this._playFeed(when, volume, pitch, pan, intensity);
          break;
        case 'splash':
          played = this._playSplash(when, volume * intensity, pitch, pan);
          break;
        case 'chime':
          played = this._playChime(when, volume, pitch, pan, options.count);
          break;
        case 'bell':
          played = options.variant === 'wood' || options.wood === true
            ? this._playWood(when, volume, pitch, pan)
            : this._playBell(when, volume, pitch, pan);
          break;
        case 'bird':
          played = this._playBird(when, volume, pitch, pan);
          break;
        case 'step':
          played = this._playStep(when, volume, pitch, pan);
          break;
        case 'photo':
          played = this._playPhoto(when, volume, pitch, pan);
          break;
        case 'lotus':
          played = this._playLotus(when, volume, pitch, pan);
          break;
        case 'rain':
          played = this._playRain(when, volume, pitch, pan, options.duration);
          break;
        default:
          break;
      }
    } catch (_) {
      // Audio should never break the render loop or an input handler.
      played = false;
    }

    if (played) this._lastPlayed.set(effect, now);
    return played;
  }

  /** Stop every source, remove listeners/timers, disconnect nodes, and close. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._desiredRunning = false;
    this._revision += 1;

    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }

    this._cleanupGraph(true);
    this._lastPlayed.clear();
  }

  async _activate(allowCreate) {
    if (this._destroyed) return false;

    if (this._ctx && this._ctx.state === 'closed') this._cleanupGraph(false);
    if (!this._ctx && !allowCreate) return false;

    this._desiredRunning = true;
    const revision = ++this._revision;

    if (!this._ctx && !this._createContext()) {
      this._desiredRunning = false;
      return false;
    }

    const ctx = this._ctx;
    try {
      this._startAmbience();

      if (this._isPageHidden()) {
        if (ctx.state === 'running') await ctx.suspend();
        return true;
      }

      if (ctx.state !== 'running') await ctx.resume();

      if (revision !== this._revision || this._destroyed || !this._desiredRunning) {
        if (
          (this._destroyed || !this._desiredRunning || this._isPageHidden()) &&
          ctx.state === 'running'
        ) {
          try {
            const pending = ctx.suspend();
            if (pending && pending.catch) pending.catch(() => {});
          } catch (_) {
            // Another lifecycle operation may already have suspended it.
          }
        }
        return false;
      }

      if (this._isPageHidden()) {
        if (ctx.state === 'running') await ctx.suspend();
        return true;
      }

      this._applyMasterGain();
      this._applyWeather();
      this._startScheduler();
      return ctx.state === 'running';
    } catch (_) {
      if (revision === this._revision) {
        this._desiredRunning = false;
        this._clearScheduler();
      }
      return false;
    }
  }

  _createContext() {
    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    const AudioContextClass = root && (root.AudioContext || root.webkitAudioContext);
    if (!AudioContextClass) return false;

    try {
      this._ctx = new AudioContextClass();
      this._buildGraph();
      return true;
    } catch (_) {
      this._cleanupGraph(true);
      return false;
    }
  }

  _buildGraph() {
    const ctx = this._ctx;

    this._master = ctx.createGain();
    this._master.gain.value = 0;

    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -18;
    this._compressor.knee.value = 18;
    this._compressor.ratio.value = 6;
    this._compressor.attack.value = 0.004;
    this._compressor.release.value = 0.28;

    this._compressor.connect(this._master);
    this._master.connect(ctx.destination);

    this._ambientBus = ctx.createGain();
    this._musicBus = ctx.createGain();
    this._sfxBus = ctx.createGain();
    this._ambientBus.gain.value = 0.8;
    this._musicBus.gain.value = 0.7;
    this._sfxBus.gain.value = 0.8;
    this._ambientBus.connect(this._compressor);
    this._musicBus.connect(this._compressor);
    this._sfxBus.connect(this._compressor);

    // A synthesized impulse response supplies a subtle open-courtyard tail.
    this._reverbInput = ctx.createGain();
    this._reverb = ctx.createConvolver();
    this._reverbReturn = ctx.createGain();
    this._reverb.buffer = this._createImpulseResponse(1.9);
    this._reverbReturn.gain.value = 0.16;
    this._reverbInput.connect(this._reverb);
    this._reverb.connect(this._reverbReturn);
    this._reverbReturn.connect(this._compressor);
  }

  _startAmbience() {
    if (this._ambienceStarted) return;
    const ctx = this._ctx;
    const madeSources = [];
    const madeNodes = [];

    try {
      const waterGain = ctx.createGain();
      const waterBand = ctx.createBiquadFilter();
      const waterHigh = ctx.createBiquadFilter();
      const waterLow = ctx.createBiquadFilter();
      const waterA = this._createNoiseSource('white');
      const waterB = this._createNoiseSource('white');

      waterGain.gain.value = 0;
      waterBand.type = 'bandpass';
      waterBand.frequency.value = 780;
      waterBand.Q.value = 0.55;
      waterHigh.type = 'highpass';
      waterHigh.frequency.value = 1900;
      waterLow.type = 'lowpass';
      waterLow.frequency.value = 6200;

      // Two independently offset noise streams make the water less repetitive.
      const waterATrim = ctx.createGain();
      const waterBTrim = ctx.createGain();
      waterATrim.gain.value = 0.085;
      waterBTrim.gain.value = 0.025;
      waterA.connect(waterBand);
      waterBand.connect(waterATrim);
      waterATrim.connect(waterGain);
      waterB.connect(waterHigh);
      waterHigh.connect(waterLow);
      waterLow.connect(waterBTrim);
      waterBTrim.connect(waterGain);
      waterGain.connect(this._ambientBus);

      const windGain = ctx.createGain();
      const windFilter = ctx.createBiquadFilter();
      const windSource = this._createNoiseSource('pink');
      windGain.gain.value = 0;
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 720;
      windFilter.Q.value = 0.35;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this._ambientBus);

      const rainGain = ctx.createGain();
      const rainHigh = ctx.createBiquadFilter();
      const rainLow = ctx.createBiquadFilter();
      const rainSource = this._createNoiseSource('white');
      rainGain.gain.value = 0;
      rainHigh.type = 'highpass';
      rainHigh.frequency.value = 850;
      rainLow.type = 'lowpass';
      rainLow.frequency.value = 7200;
      rainSource.connect(rainHigh);
      rainHigh.connect(rainLow);
      rainLow.connect(rainGain);
      rainGain.connect(this._ambientBus);

      // Slow modulation avoids static noise without JavaScript timers.
      const waterLfo = ctx.createOscillator();
      const waterDepth = ctx.createGain();
      waterLfo.type = 'sine';
      waterLfo.frequency.value = 0.19;
      waterDepth.gain.value = 0.035;
      waterLfo.connect(waterDepth);
      waterDepth.connect(waterGain.gain);

      const windLfo = ctx.createOscillator();
      const windDepth = ctx.createGain();
      windLfo.type = 'sine';
      windLfo.frequency.value = 0.067;
      windDepth.gain.value = 0.025;
      windLfo.connect(windDepth);
      windDepth.connect(windGain.gain);

      this._waterGain = waterGain;
      this._windGain = windGain;
      this._rainGain = rainGain;

      madeSources.push(waterA, waterB, windSource, rainSource, waterLfo, windLfo);
      madeNodes.push(
        waterA, waterB, waterBand, waterHigh, waterLow, waterATrim, waterBTrim,
        waterGain, windSource, windFilter, windGain, rainSource, rainHigh, rainLow,
        rainGain, waterLfo, waterDepth, windLfo, windDepth,
      );

      this._applyWeather(true);
      const now = ctx.currentTime;
      for (const source of madeSources) {
        if (source.buffer) source.start(now, Math.random() * source.buffer.duration);
        else source.start(now);
      }

      this._persistentSources.push(...madeSources);
      this._persistentNodes.push(...madeNodes);
      this._ambienceStarted = true;
    } catch (error) {
      for (const source of madeSources) stopSafely(source);
      for (const node of madeNodes) disconnectSafely(node);
      this._waterGain = null;
      this._windGain = null;
      this._rainGain = null;
      throw error;
    }
  }

  _applyMasterGain() {
    if (!this._ctx || !this._master) return;
    const target = this._muted ? 0 : this._volume * MASTER_CEILING;
    this._moveParam(this._master.gain, target, false, 0.045);
  }

  _applyWeather(immediate = false) {
    if (!this._ctx || !this._waterGain) return;
    const levels = WEATHER_LEVELS[this._weather];
    const duration = immediate ? 0 : 1.4;
    this._moveParam(this._waterGain.gain, levels.water, immediate, duration);
    this._moveParam(this._windGain.gain, levels.wind, immediate, duration);
    this._moveParam(this._rainGain.gain, levels.rain, immediate, duration);
  }

  _moveParam(param, target, immediate, duration) {
    const now = this._ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      if (immediate || duration === 0) {
        param.setValueAtTime(target, now);
      } else {
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(target, now + duration);
      }
    } catch (_) {
      param.value = target;
    }
  }

  _handleVisibilityChange() {
    this._hidden = typeof document !== 'undefined' ? Boolean(document.hidden) : false;
    this._revision += 1;

    if (this._hidden) {
      this._clearScheduler();
      const ctx = this._ctx;
      if (ctx && ctx.state === 'running') {
        try {
          const pending = ctx.suspend();
          if (pending && pending.catch) pending.catch(() => {});
        } catch (_) {
          // Some browsers suspend automatically before this event fires.
        }
      }
      return;
    }

    if (this._desiredRunning && !this._destroyed && this._ctx) {
      // _activate contains its own rejection handling.
      this._activate(false);
    }
  }

  _isPageHidden() {
    return typeof document !== 'undefined' ? Boolean(document.hidden) : this._hidden;
  }

  _startScheduler() {
    if (
      this._schedulerId !== null ||
      this._destroyed ||
      !this._desiredRunning ||
      !this._ctx ||
      this._ctx.state !== 'running' ||
      this._isPageHidden()
    ) {
      return;
    }

    const now = this._ctx.currentTime;
    if (!this._nextPluckAt || this._nextPluckAt < now - 0.2) {
      this._nextPluckAt = now + 0.3;
    }
    if (!this._nextBirdAt || this._nextBirdAt < now - 0.2) {
      this._nextBirdAt = now + randomBetween(4, 8);
    }
    if (!this._nextDropAt || this._nextDropAt < now - 0.2) {
      this._nextDropAt = now + 0.4;
    }

    this._schedulerTick();
  }

  _clearScheduler() {
    if (this._schedulerId !== null) {
      clearTimeout(this._schedulerId);
      this._schedulerId = null;
    }
  }

  _schedulerTick() {
    this._schedulerId = null;
    const ctx = this._ctx;
    if (
      this._destroyed ||
      !this._desiredRunning ||
      !ctx ||
      ctx.state !== 'running' ||
      this._isPageHidden()
    ) {
      return;
    }

    try {
      const now = ctx.currentTime;
      const horizon = now + SCHEDULER_AHEAD;

      if (this._nextPluckAt < now - 0.2) this._nextPluckAt = now + 0.1;
      let guard = 0;
      while (this._nextPluckAt <= horizon && guard < 6) {
        const when = Math.max(now + 0.015, this._nextPluckAt);
        const spacing = this._scheduleMelodyNote(when);
        this._nextPluckAt = when + spacing;
        guard += 1;
      }

      if (this._weather === 'snow') {
        this._nextBirdAt = now + 10;
      } else {
        if (this._nextBirdAt < now - 0.2) this._nextBirdAt = now + 0.1;
        guard = 0;
        while (this._nextBirdAt <= horizon && guard < 2) {
          const when = Math.max(now + 0.015, this._nextBirdAt);
          const rainy = this._weather === 'rain';
          this._playBird(when, rainy ? 0.28 : 0.58, 1, randomBetween(-0.7, 0.7));
          this._nextBirdAt = when + (rainy
            ? randomBetween(20, 38)
            : randomBetween(8, 17));
          guard += 1;
        }
      }

      if (this._weather === 'rain') {
        if (this._nextDropAt < now - 0.2) this._nextDropAt = now + 0.1;
        guard = 0;
        while (this._nextDropAt <= horizon && guard < 4) {
          const when = Math.max(now + 0.015, this._nextDropAt);
          this._playDroplet(
            when,
            randomBetween(0.14, 0.24),
            randomBetween(0.9, 1.7),
            randomBetween(-0.85, 0.85),
          );
          this._nextDropAt = when + randomBetween(0.45, 1.5);
          guard += 1;
        }
      } else {
        this._nextDropAt = now + 0.8;
      }
    } catch (_) {
      // Skip a transient scheduling failure; the next tick remains bounded.
    } finally {
      if (
        !this._destroyed &&
        this._desiredRunning &&
        ctx.state === 'running' &&
        !this._isPageHidden()
      ) {
        this._schedulerId = setTimeout(this._onSchedulerTick, SCHEDULER_INTERVAL);
      }
    }
  }

  _scheduleMelodyNote(when) {
    let phraseStart = false;
    if (this._phraseRemaining <= 0) {
      this._phraseRemaining = 4 + Math.floor(Math.random() * 5);
      phraseStart = true;
    }

    const steps = [-2, -1, -1, 0, 1, 1, 2];
    let step = steps[Math.floor(Math.random() * steps.length)];
    if (this._melodyIndex <= 0) step = Math.abs(step) || 1;
    if (this._melodyIndex >= MELODY_SCALE.length - 1) step = -Math.abs(step) || -1;
    this._melodyIndex = clamp(
      this._melodyIndex + step,
      0,
      MELODY_SCALE.length - 1,
    );

    const midi = MELODY_SCALE[this._melodyIndex];
    const pan = randomBetween(-0.42, 0.42);
    this._playPluck(
      midiToFrequency(midi),
      when,
      randomBetween(0.62, 0.86),
      pan,
      this._musicBus,
      0.36,
    );

    if (phraseStart && Math.random() < 0.7) {
      this._playPluck(
        midiToFrequency(50),
        when,
        0.32,
        -pan * 0.5,
        this._musicBus,
        0.42,
      );
    } else if (Math.random() < 0.2) {
      const harmony = MELODY_SCALE[Math.min(MELODY_SCALE.length - 1, this._melodyIndex + 2)];
      this._playPluck(
        midiToFrequency(harmony),
        when + 0.12,
        0.28,
        -pan,
        this._musicBus,
        0.4,
      );
    }

    this._phraseRemaining -= 1;
    let spacing = randomBetween(0.62, 1.14);
    if (Math.random() < 0.15) spacing += 0.45;

    if (this._phraseRemaining === 0) {
      spacing += randomBetween(2.8, 6.2);
      if (this._weather === 'rain') spacing += 1.2;
      if (this._weather === 'snow') spacing += 2.2;
    }
    return spacing;
  }

  _playPluck(frequency, when, velocity, pan, bus, reverbAmount = 0.35) {
    if (!this._canCreateVoice(1) || !bus) return false;
    const ctx = this._ctx;
    const buffer = this._getPluckBuffer(frequency);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const nodes = [source, filter, gain];

    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(7200, Math.max(1400, frequency * 7));
    filter.Q.value = 0.35;

    const end = when + buffer.duration;
    const peak = Math.max(0.0001, 0.17 * velocity);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.035);

    source.connect(filter);
    filter.connect(gain);
    this._connectOutput(gain, bus, pan, reverbAmount, nodes);

    const voice = this._trackVoice([source], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      source.start(when);
      source.stop(end + 0.02);
    });
  }

  _getPluckBuffer(frequency) {
    // Quantize to semitones so arbitrary effect pitch cannot grow the cache endlessly.
    const safeFrequency = clamp(frequency, 65, 1800);
    const midi = clamp(Math.round(69 + 12 * Math.log2(safeFrequency / 440)), 30, 92);
    if (this._pluckBuffers.has(midi)) return this._pluckBuffers.get(midi);

    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const pitch = midiToFrequency(midi);
    const duration = clamp(4 - pitch / 620, 2.1, 3.8);
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(sampleRate / pitch));
    const damping = Math.exp(-4.1 / (pitch * duration));

    // Karplus-Strong: a short smoothed noise excitation recirculating through
    // a fractional-looking two-sample averaging delay, with no worklet needed.
    let smoothed = 0;
    for (let i = 0; i < period && i < length; i += 1) {
      smoothed = smoothed * 0.28 + (Math.random() * 2 - 1) * 0.72;
      data[i] = smoothed * 0.62;
    }
    for (let i = period; i < length; i += 1) {
      data[i] = (data[i - period] + data[i - period + 1]) * 0.5 * damping;
    }

    const fadeLength = Math.min(Math.floor(sampleRate * 0.14), length);
    for (let i = 0; i < fadeLength; i += 1) {
      data[length - 1 - i] *= i / fadeLength;
    }

    if (this._pluckBuffers.size >= 24) {
      const oldest = this._pluckBuffers.keys().next().value;
      this._pluckBuffers.delete(oldest);
    }
    this._pluckBuffers.set(midi, buffer);
    return buffer;
  }

  _playClick(when, volume, pitch, pan) {
    if (!this._canCreateVoice(1)) return false;
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const nodes = [osc, gain];
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760 * pitch, when);
    osc.frequency.exponentialRampToValueAtTime(460 * pitch, when + 0.05);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.065 * volume, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(gain);
    this._connectOutput(gain, this._sfxBus, pan, 0.025, nodes);

    const voice = this._trackVoice([osc], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      osc.start(when);
      osc.stop(when + 0.065);
    });
  }

  _playFeed(when, volume, pitch, pan, intensity) {
    let played = false;
    for (let i = 0; i < 3; i += 1) {
      played = this._playDroplet(
        when + i * randomBetween(0.045, 0.075),
        volume * randomBetween(0.34, 0.52),
        pitch * randomBetween(0.85, 1.3),
        clamp(pan + randomBetween(-0.18, 0.18), -1, 1),
      ) || played;
    }
    played = this._playSplash(
      when + randomBetween(0.16, 0.24),
      volume * 0.52 * intensity,
      pitch * 0.9,
      pan,
    ) || played;
    return played;
  }

  _playDroplet(when, volume, pitch, pan) {
    if (!this._canCreateVoice(1)) return false;
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const nodes = [osc, gain];
    const duration = randomBetween(0.09, 0.15);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(randomBetween(780, 1050) * pitch, when);
    osc.frequency.exponentialRampToValueAtTime(280 * pitch, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, 0.04 * volume), when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    this._connectOutput(gain, this._sfxBus, pan, 0.08, nodes);

    const voice = this._trackVoice([osc], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      osc.start(when);
      osc.stop(when + duration + 0.01);
    });
  }

  _playSplash(when, volume, pitch, pan) {
    if (!this._canCreateVoice(2)) return false;
    const ctx = this._ctx;
    const duration = randomBetween(0.3, 0.44);
    const noise = this._createNoiseSource('white');
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const mix = ctx.createGain();
    const nodes = [noise, filter, noiseGain, osc, oscGain, mix];

    filter.type = 'bandpass';
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(1650 * pitch, when);
    filter.frequency.exponentialRampToValueAtTime(620 * pitch, when + duration);
    noiseGain.gain.setValueAtTime(0.0001, when);
    noiseGain.gain.linearRampToValueAtTime(Math.max(0.0001, 0.13 * volume), when + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(270 * pitch, when);
    osc.frequency.exponentialRampToValueAtTime(78 * pitch, when + 0.18);
    oscGain.gain.setValueAtTime(0.0001, when);
    oscGain.gain.linearRampToValueAtTime(Math.max(0.0001, 0.055 * volume), when + 0.006);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    mix.gain.value = 0.85;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(mix);
    osc.connect(oscGain);
    oscGain.connect(mix);
    this._connectOutput(mix, this._sfxBus, pan, 0.09, nodes);

    const voice = this._trackVoice([noise, osc], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      noise.start(when, Math.random() * noise.buffer.duration);
      osc.start(when);
      noise.stop(when + duration + 0.02);
      osc.stop(when + 0.22);
    });
  }

  _playBird(when, volume, pitch, pan) {
    const count = 2 + Math.floor(Math.random() * 3);
    if (!this._canCreateVoice(count)) return false;
    const ctx = this._ctx;
    const mix = ctx.createGain();
    const sources = [];
    const nodes = [mix];
    const schedule = [];
    mix.gain.value = 0.8;
    let cursor = when;

    for (let i = 0; i < count; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const duration = randomBetween(0.085, 0.16);
      const base = randomBetween(1750, 2450) * pitch;
      const peakFrequency = base * randomBetween(1.2, 1.52);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, cursor);
      osc.frequency.exponentialRampToValueAtTime(peakFrequency, cursor + duration * 0.45);
      osc.frequency.exponentialRampToValueAtTime(base * 0.94, cursor + duration);
      gain.gain.setValueAtTime(0.0001, cursor);
      gain.gain.linearRampToValueAtTime(
        Math.max(0.0001, randomBetween(0.021, 0.032) * volume),
        cursor + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
      osc.connect(gain);
      gain.connect(mix);
      sources.push(osc);
      nodes.push(osc, gain);
      schedule.push({ source: osc, start: cursor, stop: cursor + duration + 0.01 });
      cursor += duration + randomBetween(0.045, 0.11);
    }

    this._connectOutput(mix, this._sfxBus, pan, 0.18, nodes);
    const voice = this._trackVoice(sources, nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      for (const item of schedule) {
        item.source.start(item.start);
        item.source.stop(item.stop);
      }
    });
  }

  _playChime(when, volume, pitch, pan, requestedCount) {
    const count = Number.isFinite(requestedCount)
      ? clamp(Math.round(requestedCount), 2, 5)
      : 3 + Math.floor(Math.random() * 3);
    if (!this._canCreateVoice(count * 3)) return false;

    const ctx = this._ctx;
    const mix = ctx.createGain();
    const sources = [];
    const nodes = [mix];
    const schedule = [];
    const ratios = [1, 2.76, 5.4];
    const levels = [0.024, 0.009, 0.0032];
    mix.gain.value = 0.7;

    let note = Math.floor(Math.random() * CHIME_NOTES.length);
    for (let i = 0; i < count; i += 1) {
      note = clamp(note + (Math.random() < 0.5 ? -1 : 1), 0, CHIME_NOTES.length - 1);
      const start = when + i * randomBetween(0.055, 0.13);
      const base = CHIME_NOTES[note] * pitch;
      const decay = randomBetween(1.6, 2.8);

      for (let p = 0; p < ratios.length; p += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = Math.min(ctx.sampleRate * 0.45, base * ratios[p]);
        const partialDecay = decay / (1 + p * 0.42);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(
          Math.max(0.0001, levels[p] * volume),
          start + 0.004,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, start + partialDecay);
        osc.connect(gain);
        gain.connect(mix);
        sources.push(osc);
        nodes.push(osc, gain);
        schedule.push({ source: osc, start, stop: start + partialDecay + 0.02 });
      }
    }

    this._connectOutput(mix, this._sfxBus, pan, 0.5, nodes);
    const voice = this._trackVoice(sources, nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      for (const item of schedule) {
        item.source.start(item.start);
        item.source.stop(item.stop);
      }
    });
  }

  _playBell(when, volume, pitch, pan) {
    if (!this._canCreateVoice(4)) return false;
    const ctx = this._ctx;
    const mix = ctx.createGain();
    const base = 146.83 * pitch;
    const ratios = [1, 2.02, 2.74, 4.1];
    const levels = [0.07, 0.027, 0.013, 0.006];
    const decays = [4.4, 3.2, 2.25, 1.45];
    const sources = [];
    const nodes = [mix];
    mix.gain.value = 0.8;

    for (let i = 0; i < ratios.length; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratios[i];
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(
        Math.max(0.0001, levels[i] * volume),
        when + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, when + decays[i]);
      osc.connect(gain);
      gain.connect(mix);
      sources.push(osc);
      nodes.push(osc, gain);
    }

    this._connectOutput(mix, this._sfxBus, pan, 0.62, nodes);
    const voice = this._trackVoice(sources, nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      for (let i = 0; i < sources.length; i += 1) {
        sources[i].start(when);
        sources[i].stop(when + decays[i] + 0.03);
      }
    });
  }

  _playWood(when, volume, pitch, pan) {
    if (!this._canCreateVoice(2)) return false;
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const noise = this._createNoiseSource('white');
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const mix = ctx.createGain();
    const nodes = [osc, oscGain, noise, filter, noiseGain, mix];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(235 * pitch, when);
    osc.frequency.exponentialRampToValueAtTime(112 * pitch, when + 0.1);
    oscGain.gain.setValueAtTime(0.0001, when);
    oscGain.gain.linearRampToValueAtTime(0.09 * volume, when + 0.003);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);

    filter.type = 'bandpass';
    filter.frequency.value = 980 * pitch;
    filter.Q.value = 1.7;
    noiseGain.gain.setValueAtTime(0.0001, when);
    noiseGain.gain.linearRampToValueAtTime(0.045 * volume, when + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    mix.gain.value = 0.8;

    osc.connect(oscGain);
    oscGain.connect(mix);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(mix);
    this._connectOutput(mix, this._sfxBus, pan, 0.16, nodes);

    const voice = this._trackVoice([osc, noise], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      osc.start(when);
      noise.start(when, Math.random() * noise.buffer.duration);
      osc.stop(when + 0.15);
      noise.stop(when + 0.06);
    });
  }

  _playStep(when, volume, pitch, pan) {
    if (!this._canCreateVoice(2)) return false;
    const ctx = this._ctx;
    const noise = this._createNoiseSource('white');
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const mix = ctx.createGain();
    const nodes = [noise, filter, noiseGain, osc, oscGain, mix];
    const variedPitch = pitch * randomBetween(0.94, 1.06);

    filter.type = 'bandpass';
    filter.frequency.value = 430 * variedPitch;
    filter.Q.value = 0.65;
    noiseGain.gain.setValueAtTime(0.0001, when);
    noiseGain.gain.linearRampToValueAtTime(0.05 * volume, when + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.105);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(102 * variedPitch, when);
    osc.frequency.exponentialRampToValueAtTime(62 * variedPitch, when + 0.09);
    oscGain.gain.setValueAtTime(0.0001, when);
    oscGain.gain.linearRampToValueAtTime(0.032 * volume, when + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    mix.gain.value = 0.85;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(mix);
    osc.connect(oscGain);
    oscGain.connect(mix);
    this._connectOutput(
      mix,
      this._sfxBus,
      clamp(pan + randomBetween(-0.09, 0.09), -1, 1),
      0.045,
      nodes,
    );

    const voice = this._trackVoice([noise, osc], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      noise.start(when, Math.random() * noise.buffer.duration);
      osc.start(when);
      noise.stop(when + 0.12);
      osc.stop(when + 0.11);
    });
  }

  _playPhoto(when, volume, pitch, pan) {
    if (!this._canCreateVoice(2)) return false;
    const ctx = this._ctx;
    const noise = this._createNoiseSource('white');
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const mix = ctx.createGain();
    const nodes = [noise, filter, noiseGain, osc, oscGain, mix];

    filter.type = 'highpass';
    filter.frequency.value = 2100 * pitch;
    noiseGain.gain.setValueAtTime(0.0001, when);
    noiseGain.gain.linearRampToValueAtTime(0.032 * volume, when + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.017);
    noiseGain.gain.setValueAtTime(0.0001, when + 0.05);
    noiseGain.gain.linearRampToValueAtTime(0.026 * volume, when + 0.055);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.074);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(690 * pitch, when);
    osc.frequency.exponentialRampToValueAtTime(330 * pitch, when + 0.02);
    osc.frequency.setValueAtTime(620 * pitch, when + 0.05);
    osc.frequency.exponentialRampToValueAtTime(300 * pitch, when + 0.074);
    oscGain.gain.setValueAtTime(0.0001, when);
    oscGain.gain.linearRampToValueAtTime(0.023 * volume, when + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.018);
    oscGain.gain.setValueAtTime(0.0001, when + 0.05);
    oscGain.gain.linearRampToValueAtTime(0.019 * volume, when + 0.055);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.075);
    mix.gain.value = 0.8;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(mix);
    osc.connect(oscGain);
    oscGain.connect(mix);
    this._connectOutput(mix, this._sfxBus, pan, 0.025, nodes);

    const voice = this._trackVoice([noise, osc], nodes);
    if (!voice) return false;
    return this._commitVoice(voice, () => {
      noise.start(when, Math.random() * noise.buffer.duration);
      osc.start(when);
      noise.stop(when + 0.085);
      osc.stop(when + 0.085);
    });
  }

  _playLotus(when, volume, pitch, pan) {
    const notes = [587.33, 880, 1318.51];
    const velocities = [0.72, 0.48, 0.28];
    let played = false;
    for (let i = 0; i < notes.length; i += 1) {
      played = this._playPluck(
        notes[i] * pitch,
        when + i * 0.16,
        velocities[i] * volume,
        clamp(pan + (i - 1) * 0.12, -1, 1),
        this._sfxBus,
        0.48,
      ) || played;
    }
    return played;
  }

  _playRain(when, volume, pitch, pan, requestedDuration) {
    const duration = Number.isFinite(requestedDuration)
      ? clamp(requestedDuration, 0.35, 6)
      : 2.4;
    let played = false;

    if (this._canCreateVoice(1)) {
      const ctx = this._ctx;
      const noise = this._createNoiseSource('white');
      const high = ctx.createBiquadFilter();
      const low = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const nodes = [noise, high, low, gain];
      high.type = 'highpass';
      high.frequency.value = 1000 * pitch;
      low.type = 'lowpass';
      low.frequency.value = Math.min(10000, 7000 * pitch);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(0.026 * volume, when + 0.08);
      gain.gain.setValueAtTime(0.026 * volume, when + Math.max(0.09, duration - 0.16));
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      noise.connect(high);
      high.connect(low);
      low.connect(gain);
      this._connectOutput(gain, this._sfxBus, pan, 0.08, nodes);

      const voice = this._trackVoice([noise], nodes);
      if (voice) {
        played = this._commitVoice(voice, () => {
          noise.start(when, Math.random() * noise.buffer.duration);
          noise.stop(when + duration + 0.02);
        });
      }
    }

    const drops = Math.min(14, Math.max(3, Math.ceil(duration * 3)));
    for (let i = 0; i < drops; i += 1) {
      played = this._playDroplet(
        when + Math.random() * duration,
        volume * randomBetween(0.12, 0.24),
        pitch * randomBetween(1, 1.8),
        clamp(pan + randomBetween(-0.75, 0.75), -1, 1),
      ) || played;
    }
    return played;
  }

  _connectOutput(input, bus, pan, reverbAmount, nodes) {
    const ctx = this._ctx;
    let output = input;

    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      input.connect(panner);
      output = panner;
      nodes.push(panner);
    }

    output.connect(bus);
    if (reverbAmount > 0 && this._reverbInput) {
      const send = ctx.createGain();
      send.gain.value = reverbAmount;
      output.connect(send);
      send.connect(this._reverbInput);
      nodes.push(send);
    }
  }

  _canCreateVoice(sourceCount) {
    return Boolean(
      this._ctx &&
      !this._destroyed &&
      this._voices.size < MAX_VOICES &&
      this._activeVoiceSources + sourceCount <= MAX_VOICE_SOURCES
    );
  }

  _trackVoice(sources, nodes) {
    if (!this._canCreateVoice(sources.length)) {
      for (const node of nodes) disconnectSafely(node);
      return null;
    }

    const voice = {
      sources,
      nodes,
      remaining: sources.length,
      released: false,
    };
    this._voices.add(voice);
    this._activeVoiceSources += sources.length;

    for (const source of sources) {
      source.onended = () => {
        if (voice.released) return;
        voice.remaining -= 1;
        if (voice.remaining <= 0) this._releaseVoice(voice, false);
      };
    }
    return voice;
  }

  _commitVoice(voice, schedule) {
    try {
      schedule();
      return true;
    } catch (_) {
      this._releaseVoice(voice, true);
      return false;
    }
  }

  _releaseVoice(voice, stopSources) {
    if (!voice || voice.released) return;
    voice.released = true;

    for (const source of voice.sources) {
      source.onended = null;
      if (stopSources) stopSafely(source);
    }
    for (const node of voice.nodes) disconnectSafely(node);

    this._voices.delete(voice);
    this._activeVoiceSources = Math.max(0, this._activeVoiceSources - voice.sources.length);
  }

  _createNoiseSource(color) {
    const source = this._ctx.createBufferSource();
    source.buffer = this._getNoiseBuffer(color);
    source.loop = true;
    return source;
  }

  _getNoiseBuffer(color) {
    if (this._noiseBuffers.has(color)) return this._noiseBuffers.get(color);
    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * 4);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (color === 'pink') {
        // Paul Kellet's economical pink-noise approximation.
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white;
      }
    }

    this._noiseBuffers.set(color, buffer);
    return buffer;
  }

  _createImpulseResponse(seconds) {
    const ctx = this._ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const progress = i / length;
        const attack = Math.min(1, i / Math.max(1, ctx.sampleRate * 0.008));
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 3.1) * attack * 0.42;
      }
    }
    return impulse;
  }

  _cleanupGraph(closeContext) {
    this._clearScheduler();

    for (const voice of Array.from(this._voices)) this._releaseVoice(voice, true);
    this._voices.clear();
    this._activeVoiceSources = 0;

    for (const source of this._persistentSources) stopSafely(source);
    for (const node of this._persistentNodes) disconnectSafely(node);
    this._persistentSources = [];
    this._persistentNodes = [];
    this._ambienceStarted = false;

    const sharedNodes = [
      this._ambientBus,
      this._musicBus,
      this._sfxBus,
      this._reverbInput,
      this._reverb,
      this._reverbReturn,
      this._compressor,
      this._master,
    ];
    for (const node of sharedNodes) disconnectSafely(node);

    const ctx = this._ctx;
    this._ctx = null;
    this._master = null;
    this._compressor = null;
    this._ambientBus = null;
    this._musicBus = null;
    this._sfxBus = null;
    this._reverbInput = null;
    this._reverb = null;
    this._reverbReturn = null;
    this._waterGain = null;
    this._windGain = null;
    this._rainGain = null;

    this._noiseBuffers.clear();
    this._pluckBuffers.clear();
    this._lastPlayed.clear();
    this._nextPluckAt = 0;
    this._nextBirdAt = 0;
    this._nextDropAt = 0;
    this._phraseRemaining = 0;

    if (closeContext && ctx && ctx.state !== 'closed') {
      try {
        const pending = ctx.close();
        if (pending && pending.catch) pending.catch(() => {});
      } catch (_) {
        // Closing is best-effort on older mobile browsers.
      }
    }
  }
}

export default GardenAudio;
