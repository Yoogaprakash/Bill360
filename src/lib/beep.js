// Short synthesized beeps for scan feedback — generated via Web Audio API so
// no audio asset needs to be bundled/hosted.
let ctx

function getCtx() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function tone(start, { freq, type = 'square', duration = 0.11, peak = 0.9 }) {
  const audio = getCtx()
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.connect(gain)
  gain.connect(audio.destination)

  oscillator.type = type
  oscillator.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.start(start)
  oscillator.stop(start + duration + 0.01)
}

// Two quick high pulses — peak gain close to 1.0 (Web Audio clips/limits
// above that, so this is effectively as loud as this synthesis can go).
export function playBeep() {
  try {
    const now = getCtx().currentTime
    tone(now, { freq: 1500 })
    tone(now + 0.14, { freq: 1500 })
  } catch {
    // Audio isn't critical to scanning — silently skip if unsupported/blocked.
  }
}

// Single low blip — distinguishable by ear from the success beep, used when
// a scan is recognized but ignored (e.g. the same product scanned again
// while still in view).
export function playDuplicateBeep() {
  try {
    const now = getCtx().currentTime
    tone(now, { freq: 320, duration: 0.16, peak: 0.6 })
  } catch {
    // Audio isn't critical to scanning — silently skip if unsupported/blocked.
  }
}
