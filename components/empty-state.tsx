"use client";

import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { useActualizerMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  secondaryLink?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryLink,
  className,
}: EmptyStateProps) {
  const motionVariants = useActualizerMotion();

  return (
    <motion.div
      variants={motionVariants.listStagger}
      initial="hidden"
      animate="show"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-surface px-6 py-16 text-center",
        className
      )}
    >
      <motion.div variants={motionVariants.fadeUp}>
        <Icon className="mb-4 size-12 text-fg-tertiary" />
      </motion.div>
      <motion.h2 variants={motionVariants.fadeUp} className="font-heading text-lg font-semibold tracking-snug text-fg-primary">
        {title}
      </motion.h2>
      <motion.p variants={motionVariants.fadeUp} className="mx-auto mt-2 max-w-md text-sm leading-normal text-fg-secondary">
        {description}
      </motion.p>
      {action || secondaryLink ? (
        <motion.div variants={motionVariants.fadeUp} className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryLink}
        </motion.div>
      ) : null}
    </motion.div>
  );
}
