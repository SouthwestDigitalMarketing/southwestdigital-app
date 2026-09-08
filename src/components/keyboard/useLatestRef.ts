"use client";

import { useEffect, useRef } from "react";

/**
 * Mirror a render-time value into a ref for use inside long-lived callbacks.
 *
 * Written in an effect rather than during render, which is what React requires:
 * a ref write during render is not safe under concurrent rendering. Every reader
 * here runs from an event handler or a listener registered once at mount, so the
 * ref is always current by the time it is read.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
