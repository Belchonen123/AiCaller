"use client";

import { useMemo } from "react";
import { useReducedMotion, type Variants } from "framer-motion";

type MotionSet = {
  fadeUp: Variants;
  fadeIn: Variants;
  scaleIn: Variants;
  slideRight: Variants;
  slideLeft: Variants;
  listStagger: Variants;
};

const easeOut = [0.16, 1, 0.3, 1] as const;

export function createMotionVariants(reduce = false): MotionSet {
  const fast = reduce ? 0 : 0.12;
  const base = reduce ? 0 : 0.2;

  return {
    fadeUp: {
      hidden: { opacity: 0, y: reduce ? 0 : 8 },
      show: { opacity: 1, y: 0, transition: { duration: base, ease: easeOut } },
    },
    fadeIn: {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: fast, ease: easeOut } },
    },
    scaleIn: {
      hidden: { opacity: 0, scale: reduce ? 1 : 0.96 },
      show: { opacity: 1, scale: 1, transition: { duration: base, ease: easeOut } },
    },
    slideRight: {
      hidden: { opacity: 0, x: reduce ? 0 : -16 },
      show: { opacity: 1, x: 0, transition: { duration: base, ease: easeOut } },
    },
    slideLeft: {
      hidden: { opacity: 0, x: reduce ? 0 : 16 },
      show: { opacity: 1, x: 0, transition: { duration: base, ease: easeOut } },
    },
    listStagger: {
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduce ? 0 : 0.05,
        },
      },
    },
  };
}

export function useActualizerMotion() {
  const reduce = useReducedMotion();
  return useMemo(() => createMotionVariants(Boolean(reduce)), [reduce]);
}
