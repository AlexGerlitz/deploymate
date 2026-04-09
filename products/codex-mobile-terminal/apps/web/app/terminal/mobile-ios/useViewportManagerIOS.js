"use client";

import { useEffect, useState } from "react";

function readViewport() {
  if (typeof window === "undefined") {
    return {
      height: 0,
      keyboardInset: 0
    };
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    return {
      height: window.innerHeight,
      keyboardInset: 0
    };
  }

  const height = Math.round(viewport.height);
  const keyboardInset = Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
  );

  return {
    height,
    keyboardInset
  };
}

export function useViewportManagerIOS() {
  const [viewportState, setViewportState] = useState(() => readViewport());

  useEffect(() => {
    const sync = () => {
      setViewportState(readViewport());
    };

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  return viewportState;
}
