// Procedural WebAudio sound: no assets, everything synthesized. The mix is
// bright and toy-like: blasters are snappy noise bursts, hurt cues are
// cartoon squeaks, and the ambience is a cheerful bouncing chiptune loop.

import type { WeaponId } from '@/game/weapons'

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private crackleSource: AudioBufferSourceNode | null = null
  private bassTimer: number | null = null
  private noise: AudioBuffer | null = null
  private muted = false

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null
    }
    if (!this.ctx) {
      const Ctor = window.AudioContext
      if (!Ctor) {
        return null
      }
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      // Respect a mute set before the first sound ever played.
      this.master.gain.value = this.muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.5
    }
  }

  // One shared noise buffer for every burst; the envelope shapes the sound
  // and stop() bounds it, so no per-shot buffer fills.
  private noiseBuffer(): AudioBuffer | null {
    const ctx = this.ensure()
    if (!ctx) {
      return null
    }
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1
      }
    }
    return this.noise
  }

  private burst(duration: number, filterHz: number, gain: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ensure()
    if (!ctx || !this.master) {
      return
    }
    const buffer = this.noiseBuffer()
    if (!buffer) {
      return
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = filterHz
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, ctx.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    source.connect(filter).connect(env).connect(this.master)
    source.start()
    source.stop(ctx.currentTime + duration)
  }

  private sweep(fromHz: number, toHz: number, duration: number, gain: number, type: OscillatorType = 'square') {
    const ctx = this.ensure()
    if (!ctx || !this.master) {
      return
    }
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(fromHz, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), ctx.currentTime + duration)
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, ctx.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(env).connect(this.master)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  }

  fire(weapon: WeaponId) {
    switch (weapon) {
      case 'claws':
        this.burst(0.08, 500, 0.25)
        break
      case 'studgun':
        this.burst(0.14, 1800, 0.5)
        break
      case 'scatter':
        this.burst(0.3, 900, 0.7)
        break
      case 'gatling':
        this.burst(0.07, 2200, 0.35)
        break
      case 'dynamite':
        this.burst(0.12, 600, 0.4)
        this.sweep(300, 80, 0.3, 0.1, 'triangle')
        break
      case 'raygun':
        this.sweep(1400, 300, 0.16, 0.2, 'sawtooth')
        break
      case 'megabrick':
        this.sweep(90, 700, 0.5, 0.3, 'sawtooth')
        this.burst(0.5, 400, 0.4)
        break
    }
  }

  explosion() {
    this.burst(0.7, 300, 0.9)
    this.sweep(160, 30, 0.6, 0.4, 'triangle')
  }

  enemyPain() {
    this.sweep(900, 1400, 0.12, 0.15)
  }

  enemyDie() {
    // Slide-whistle down: pure cartoon.
    this.sweep(1200, 180, 0.5, 0.2, 'triangle')
  }

  playerHurt() {
    this.sweep(500, 200, 0.25, 0.3, 'square')
  }

  pickup() {
    this.sweep(700, 1300, 0.1, 0.18, 'triangle')
  }

  coin() {
    this.sweep(1500, 2200, 0.09, 0.14, 'sine')
  }

  doorOpen() {
    this.sweep(80, 200, 0.6, 0.15, 'sawtooth')
  }

  doorLocked() {
    this.burst(0.08, 400, 0.3)
    this.sweep(220, 160, 0.18, 0.2, 'square')
  }

  keyPickup() {
    this.sweep(900, 1800, 0.3, 0.2, 'triangle')
  }

  // Ambient layer: a soft pad plus a bouncy major-key bass line that skips
  // along like a toy on parade.
  startAmbience() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.crackleSource) {
      return
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.006
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.4
    source.connect(gain).connect(this.master)
    source.start()
    this.crackleSource = source

    // A cheerful C-major skip: root, third, fifth, octave and back.
    const bassNotes = [130.8, 164.8, 196, 261.6, 196, 164.8, 146.8, 174.6]
    let step = 0
    const playStep = () => {
      const bounce = step % 2 === 0 ? 0.34 : 0.24
      this.sweep(bassNotes[step % bassNotes.length], bassNotes[step % bassNotes.length] * 1.005, 0.26, 0.05, 'triangle')
      step++
      this.bassTimer = window.setTimeout(playStep, bounce * 1000)
    }
    playStep()
  }

  stopAmbience() {
    if (this.crackleSource) {
      this.crackleSource.stop()
      this.crackleSource = null
    }
    if (this.bassTimer !== null) {
      window.clearTimeout(this.bassTimer)
      this.bassTimer = null
    }
  }
}
