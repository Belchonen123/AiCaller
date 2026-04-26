"use client";

import { motion } from "framer-motion";
import { useActualizerMotion } from "@/lib/motion";

export function MotionList({
  as = "div",
  className,
  children,
}: {
  as?: "div" | "section" | "tbody";
  className?: string;
  children: React.ReactNode;
}) {
  const motionVariants = useActualizerMotion();
  const Component = motion[as];

  return (
    <Component
      variants={motionVariants.listStagger}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </Component>
  );
}

export function MotionItem({
  as = "div",
  className,
  children,
}: {
  as?: "div" | "tr";
  className?: string;
  children: React.ReactNode;
}) {
  const motionVariants = useActualizerMotion();
  const Component = motion[as];

  return (
    <Component variants={motionVariants.fadeUp} className={className}>
      {children}
    </Component>
  );
}
