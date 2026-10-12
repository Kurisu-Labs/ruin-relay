import { useEffect, useRef, type ReactNode } from 'react';

type Page = 'history' | 'about';

export function GameDialog({
  page,
  onClose,
  onPage,
  children,
}: {
  page?: Page;
  onClose: () => void;
  onPage: (page: Page) => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = page !== undefined;

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      className="game-dialog"
      ref={dialog}
      aria-labelledby="game-menu-title"
      onCancel={onClose}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const targets = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, summary, [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            !element.closest('[hidden], [inert]') &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== 'hidden',
        );
        const first = targets[0],
          last = targets.at(-1);
        // Keep focus in the game menu instead of cycling through browser chrome.
        if (
          first &&
          last &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id="game-menu-title">Around the relay</h2>
        <button onClick={onClose} autoFocus>
          Back to game <span aria-hidden="true">×</span>
        </button>
      </div>
      <nav className="dialog-tabs" aria-label="Game information">
        <button aria-pressed={page === 'about'} onClick={() => onPage('about')}>
          How it works
        </button>
        <button aria-pressed={page === 'history'} onClick={() => onPage('history')}>
          History
        </button>
      </nav>
      {children}
    </dialog>
  );
}
