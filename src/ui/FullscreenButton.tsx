import { useEffect, useState, type RefObject } from 'react';
import { GameIcon } from './GameIcon';

export function FullscreenButton({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setAvailable(Boolean(document.fullscreenEnabled));
    const update = () => setActive(document.fullscreenElement === target.current);
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [target]);

  if (!available) return null;
  return (
    <span className="fullscreen-control">
      <button
        aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={active ? 'Exit fullscreen' : 'Hide browser controls'}
        aria-pressed={active}
        onClick={async () => {
          setError(false);
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await target.current?.requestFullscreen();
          } catch {
            setError(true);
          }
        }}
      >
        <GameIcon name={active ? 'collapse' : 'fullscreen'} />
        <span className="control-label">{active ? 'Windowed' : 'Fullscreen'}</span>
      </button>
      {error && (
        <span className="fullscreen-error" role="status">
          Fullscreen is unavailable. You can keep playing here.
        </span>
      )}
    </span>
  );
}
