const paths = {
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  restart: 'M4 4v6h6M4 10a8 8 0 1 1 0 5',
  history: 'M4 5h16v16H4zM8 3v4m8-4v4M8 11h8m-8 5h5',
  latest: 'M5 4v16M10 5l9 7-9 7z',
  refresh: 'M20 4v6h-6M4 20v-6h6M4 9a8 8 0 0 1 14-4l2 5M4 14l2 5a8 8 0 0 0 14-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  fullscreen: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  collapse: 'M3 9h6V3m6 0v6h6M9 21v-6H3m18 0h-6v6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  arrow: 'M12 20V4m-7 7 7-7 7 7',
};

/** Shared geometry avoids font-dependent sizes for game controls. */
export function GameIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
