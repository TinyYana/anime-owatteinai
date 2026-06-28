import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Brand motion identity — calm/premium base, light playful feedback.
export const EASE = "power3.out";
export const DUR = { quick: 0.18, base: 0.32, slow: 0.6 } as const;

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Reveal direct content blocks on mount: fade + 10px rise, gentle stagger.
 * Tag the elements to animate with `data-reveal`. Returns the scope ref to
 * spread onto the wrapping element. Re-runs when `deps` change.
 * ponytail: one helper instead of per-page useGSAP boilerplate.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  deps: unknown[] = [],
): RefObject<T> {
  const scope = useRef<T>(null);
  useGSAP(
    () => {
      if (reduced()) return;
      const targets = scope.current?.querySelectorAll("[data-reveal]");
      if (!targets?.length) return;
      gsap.from(targets, {
        opacity: 0,
        y: 10,
        duration: DUR.base,
        ease: EASE,
        stagger: 0.06,
        clearProps: "opacity,transform",
      });
    },
    { scope, dependencies: deps },
  );
  return scope;
}
