export type GameEvent =
  | { type: 'dungeon-start' }
  | { type: 'room-clear' }
  | { type: 'player-defeated' }
  | { type: 'dungeon-clear' }
  | { type: 'skill-used'; skill: string }

export type GameEventListener = (event: GameEvent) => void

export function createEventBus() {
  const listeners = new Set<GameEventListener>()
  return {
    emit(event: GameEvent) { for (const listener of listeners) listener(event) },
    subscribe(listener: GameEventListener) { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}

export const gameEvents = createEventBus()

export interface AudioAdapter { setEnabled(enabled: boolean): void; dispose(): void }

export function createAudioAdapter(bus = gameEvents): AudioAdapter {
  let enabled = false
  let context: AudioContext | null = null
  const frequencies: Record<GameEvent['type'], number> = { 'dungeon-start': 330, 'room-clear': 523, 'player-defeated': 165, 'dungeon-clear': 659, 'skill-used': 440 }
  const unsubscribe = bus.subscribe(event => {
    if (!enabled || typeof window === 'undefined' || !window.AudioContext) return
    try {
      context ??= new window.AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = frequencies[event.type]
      gain.gain.setValueAtTime(0.025, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.12)
    } catch { /* Audio is optional; gameplay must never depend on it. */ }
  })
  return { setEnabled(value) { enabled = value }, dispose() { unsubscribe(); void context?.close(); context = null } }
}
