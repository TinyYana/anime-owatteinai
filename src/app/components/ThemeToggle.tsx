import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { toggleTheme, getTheme } from "../lib/theme";

gsap.registerPlugin(useGSAP);

export function ThemeToggle() {
  const svgRef = useRef<SVGSVGElement>(null);
  const sunCoreRef = useRef<SVGCircleElement>(null);
  const sunRaysRef = useRef<SVGGElement>(null);
  const moonRef = useRef<SVGPathElement>(null);

  const [isDark, setIsDark] = useState(() => getTheme() === "dark");

  const { contextSafe } = useGSAP(
    () => {
      const dark = getTheme() === "dark";
      gsap.set(sunRaysRef.current, {
        opacity: dark ? 0 : 1,
        rotation: dark ? 45 : 0,
        transformOrigin: "50% 50%",
      });
      gsap.set(sunCoreRef.current, {
        scale: dark ? 0.6 : 1,
        transformOrigin: "50% 50%",
      });
      gsap.set(moonRef.current, {
        opacity: dark ? 1 : 0,
        rotation: dark ? 0 : -45,
        transformOrigin: "50% 50%",
      });
    },
    { scope: svgRef },
  );

  const handleClick = contextSafe(() => {
    const next = toggleTheme();
    const toLight = next === "light";
    const tl = gsap.timeline();

    if (toLight) {
      // Moon → Sun
      tl.to(moonRef.current, {
        opacity: 0, rotation: 45, duration: 0.18, ease: "power2.in", transformOrigin: "50% 50%",
      })
        .to(sunCoreRef.current, {
          scale: 1, duration: 0.25, ease: "back.out(1.7)", transformOrigin: "50% 50%",
        }, 0.1)
        .to(sunRaysRef.current, {
          opacity: 1, rotation: 0, duration: 0.28, ease: "back.out(1.5)", transformOrigin: "50% 50%",
        }, 0.16);
    } else {
      // Sun → Moon
      tl.to(sunRaysRef.current, {
        opacity: 0, rotation: -45, duration: 0.18, ease: "power2.in", transformOrigin: "50% 50%",
      })
        .to(sunCoreRef.current, {
          scale: 0.6, duration: 0.18, ease: "power2.in", transformOrigin: "50% 50%",
        }, 0)
        .to(moonRef.current, {
          opacity: 1, rotation: 0, duration: 0.28, ease: "power2.out", transformOrigin: "50% 50%",
        }, 0.16);
    }

    setIsDark(!toLight);
  });

  return (
    <button
      onClick={handleClick}
      aria-label={isDark ? "切換亮色模式" : "切換深色模式"}
      className="rounded-md p-1.5 text-muted hover:text-text transition-colors"
    >
      <svg
        ref={svgRef}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Sun — visible in light mode */}
        <circle ref={sunCoreRef} cx="12" cy="12" r="4" />
        <g ref={sunRaysRef}>
          <line x1="12" y1="2"    x2="12" y2="4.5"  />
          <line x1="12" y1="19.5" x2="12" y2="22"   />
          <line x1="4.22"  y1="4.22"  x2="5.99"  y2="5.99"  />
          <line x1="18.01" y1="18.01" x2="19.78" y2="19.78" />
          <line x1="2"    y1="12" x2="4.5"  y2="12" />
          <line x1="19.5" y1="12" x2="22"   y2="12" />
          <line x1="4.22"  y1="19.78" x2="5.99"  y2="18.01" />
          <line x1="18.01" y1="5.99"  x2="19.78" y2="4.22"  />
        </g>
        {/* Moon — visible in dark mode */}
        <path ref={moonRef} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
