import { BRAND } from "./theme/tokens";

/** The ScreenForge mark: a gradient tile with a capture corner and a dot, from the mockup. */
export default function Logo({ size = 20 }: { size?: number }) {
  const u = size / 20;
  return (
    <span
      aria-hidden
      className="relative inline-block flex-none"
      style={{ width: size, height: size, borderRadius: 6 * u, background: BRAND.gradient }}
    >
      <span
        className="absolute"
        style={{
          right: 4 * u,
          bottom: 4 * u,
          width: 8 * u,
          height: 8 * u,
          borderRight: `${2 * u}px solid ${BRAND.mark}`,
          borderBottom: `${2 * u}px solid ${BRAND.mark}`,
          borderRadius: `0 0 ${2 * u}px 0`,
        }}
      />
      <span
        className="absolute"
        style={{ left: 4 * u, top: 4 * u, width: 5 * u, height: 5 * u, borderRadius: u, background: BRAND.mark }}
      />
    </span>
  );
}
