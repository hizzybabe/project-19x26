import { expect, it } from 'vitest'
import { createAudioAdapter, createEventBus } from './events'

it('delivers typed events in order and unsubscribes cleanly', () => {
  const bus = createEventBus()
  const received: string[] = []
  const unsubscribe = bus.subscribe(event => received.push(event.type))
  bus.emit({ type: 'dungeon-start' })
  bus.emit({ type: 'skill-used', skill: 'heavy' })
  unsubscribe()
  bus.emit({ type: 'dungeon-clear' })
  expect(received).toEqual(['dungeon-start','skill-used'])
  const audio = createAudioAdapter(bus)
  audio.setEnabled(true)
  expect(() => bus.emit({ type: 'room-clear' })).not.toThrow()
  audio.dispose()
})
