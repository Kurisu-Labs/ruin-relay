export function Brand() {
  return (
    <span className="brand">
      <img
        className="brand-mark"
        src="/assets/brand/shared-path.svg"
        alt="Ruin Relay"
        width={36}
        height={36}
      />
      <span className="brand-name" aria-hidden="true">
        Ruin Relay
      </span>
    </span>
  );
}
