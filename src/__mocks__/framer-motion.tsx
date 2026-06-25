// Mock de framer-motion para testes — elimina animações e RAF loops.
import React from "react";
import type { HTMLMotionProps, AnimatePresenceProps } from "framer-motion";

type MotionDivProps = HTMLMotionProps<"div"> & { children?: React.ReactNode };

const motion = {
  div: React.forwardRef<HTMLDivElement, MotionDivProps>(
    ({ children, ...rest }, ref) => {
      // Remove props específicas do framer-motion antes de passar ao DOM
      const {
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        variants: _v,
        whileHover: _wh,
        whileTap: _wt,
        whileFocus: _wf,
        whileInView: _wiv,
        viewport: _vp,
        layout: _l,
        layoutId: _lid,
        ...domProps
      } = rest as Record<string, unknown>;
      return (
        <div ref={ref} {...(domProps as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      );
    }
  ),
};

function AnimatePresence({ children }: AnimatePresenceProps) {
  return <>{children}</>;
}

function useReducedMotion(): boolean {
  return false;
}

export { motion, AnimatePresence, useReducedMotion };
