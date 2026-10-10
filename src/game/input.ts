import type { Direction } from '../lib/rules';

export function keyIntent(
  event: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>,
): Direction | 'restart' | undefined {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.key.toLowerCase() === 'r') return 'restart';
  return (
    {
      ArrowUp: 'U',
      w: 'U',
      ArrowRight: 'R',
      d: 'R',
      ArrowDown: 'D',
      s: 'D',
      ArrowLeft: 'L',
      a: 'L',
    } as Record<string, Direction>
  )[event.key.startsWith('Arrow') ? event.key : event.key.toLowerCase()];
}
