// Short synthesized beep for scan feedback — generated via Web Audio API so
// no audio asset needs to be bundled/hosted.
let ctx

export function playBeep() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime

    // Two quick pulses (louder + more noticeable than a single soft tone),
    // peak gain close to 1.0 — Web Audio clips/limits above that, so this is
    // effectively as loud as this synthesis approach can go.
    const beepAt = (start) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.type = 'square'
      oscillator.frequency.value = 1500
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.9, start + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11)

      oscillator.start(start)
      oscillator.stop(start + 0.12)
    }

    beepAt(now)
    beepAt(now + 0.14)
  } catch {
    // Audio isn't critical to scanning — silently skip if unsupported/blocked.
  }
}
