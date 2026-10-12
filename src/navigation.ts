import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
  };
}

export function usePage(initialPath = '/') {
  const snapshot = () =>
    typeof window === 'undefined'
      ? initialPath
      : window.location.pathname + window.location.search + window.location.hash;
  return useSyncExternalStore(subscribe, snapshot, () => initialPath);
}

/** Switch views without replacing the document or the active Relay session. */
export function navigate(href: string) {
  if (window.location.pathname + window.location.search + window.location.hash === href) return;
  window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
