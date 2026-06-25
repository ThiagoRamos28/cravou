// Mock de framer-motion para testes — elimina animações e RAF loops.
import React from "react";
import type { HTMLMotionProps, AnimatePresenceProps } from "framer-motion";

type MotionDivProps = HTMLMotionProps<"div"> & { children?: React.ReactNode };
type MotionSpanProps = HTMLMotionProps<"span"> & { children?: React.ReactNode };

function stripMotionProps(rest: Record<string, unknown>) {
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
  } = rest;
  return domProps;
}

const motion = {
  div: React.forwardRef<HTMLDivElement, MotionDivProps>(
    ({ children, ...rest }, ref) => {
      const domProps = stripMotionProps(rest as Record<string, unknown>);
      return (
        <div ref={ref} {...(domProps as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      );
    }
  ),
  span: React.forwardRef<HTMLSpanElement, MotionSpanProps>(
    ({ children, ...rest }, ref) => {
      const domProps = stripMotionProps(rest as Record<string, unknown>);
      return (
        <span ref={ref} {...(domProps as React.HTMLAttributes<HTMLSpanElement>)}>
          {children}
        </span>
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
