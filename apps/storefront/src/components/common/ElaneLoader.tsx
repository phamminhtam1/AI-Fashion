import { useEffect, useRef, useState, useCallback } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIsFetching } from "@tanstack/react-query";

type ElaneLoaderProps = {
  logoSrc?: string;
  duration?: number;
};

/**
 * Checks if the visible above-the-fold images in the main area have finished loading.
 * Ignores offscreen lazy-loaded images to avoid blocking the loader indefinitely.
 */
function areTopImagesLoaded(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return true;

  const main = document.querySelector("main") || document.body;
  const imgs = Array.from(main.querySelectorAll("img"));
  if (imgs.length === 0) return true;

  // Only check first 6 images that are near the top viewport
  const topImgs = imgs.slice(0, 6).filter((img) => {
    if (img.loading === "lazy") {
      const rect = img.getBoundingClientRect();
      // If lazy image is far down the page (> 1.2 screen heights), don't wait for it
      if (rect.top > window.innerHeight * 1.2) return false;
    }
    return Boolean(img.src && !img.src.startsWith("data:"));
  });

  if (topImgs.length === 0) return true;
  return topImgs.every((img) => img.complete);
}

/**
 * Waits for top images to finish loading, with a strict safety timeout.
 */
function waitForTopImages(timeout = 2500): Promise<void> {
  if (areTopImagesLoaded()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const safetyTimer = setTimeout(finish, timeout);
    const main = document.querySelector("main") || document.body;
    const imgs = Array.from(main.querySelectorAll("img")).slice(0, 6);
    const pending = imgs.filter((img) => !img.complete && img.src && !img.src.startsWith("data:"));

    if (pending.length === 0) {
      clearTimeout(safetyTimer);
      finish();
      return;
    }

    let remaining = pending.length;
    pending.forEach((img) => {
      const onDone = () => {
        remaining -= 1;
        if (remaining <= 0) {
          clearTimeout(safetyTimer);
          finish();
        }
      };

      if (img.complete) {
        onDone();
      } else {
        img.addEventListener("load", onDone, { once: true });
        img.addEventListener("error", onDone, { once: true });
      }
    });
  });
}

export default function ElaneLoader({
  logoSrc = "/images/elane-logo.png",
  duration = 1800,
}: ElaneLoaderProps) {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const [imgError, setImgError] = useState(false);

  // Router navigation state (to detect when initial route is no longer pending)
  const routerState = useRouterState({
    select: (s) => ({
      status: s.status,
      isLoading: s.isLoading,
    }),
  });

  // Active React Query fetches
  const isFetching = useIsFetching();

  // Keep mutable refs
  const isFetchingRef = useRef(isFetching);
  isFetchingRef.current = isFetching;

  const routerStateRef = useRef(routerState);
  routerStateRef.current = routerState;

  const isDismissingRef = useRef(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to trigger smooth exit transition
  const dismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    setLeaving(true);

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
      isDismissingRef.current = false;
    }, 750);
  }, []);

  // INITIAL LOAD ONLY: Run animation once on page mount and dismiss as soon as content is ready.
  // It does NOT re-trigger on internal SPA link clicks.
  useEffect(() => {
    let cancelled = false;
    let minTimePassed = false;

    // Minimum display time (1.1s) so the luxury logo reveal animation can play smoothly
    const minVisualTime = Math.min(duration, 1100);

    const minTimer = setTimeout(() => {
      minTimePassed = true;
      tryDismiss();
    }, minVisualTime);

    // Target visual duration: if reached, dismiss smoothly
    const targetTimer = setTimeout(() => {
      if (!cancelled && !isDismissingRef.current) {
        dismiss();
      }
    }, duration);

    // Strict safety timer (2.5s): guarantees loader NEVER gets stuck under any network condition
    const maxSafetyTimer = setTimeout(() => {
      if (!cancelled && !isDismissingRef.current) {
        dismiss();
      }
    }, Math.max(duration + 600, 2500));

    const tryDismiss = () => {
      if (cancelled || isDismissingRef.current) return;

      const isReady =
        isFetchingRef.current === 0 &&
        routerStateRef.current.status !== "pending" &&
        !routerStateRef.current.isLoading &&
        areTopImagesLoaded();

      if (minTimePassed && isReady) {
        dismiss();
      }
    };

    // Monitor image & API loading continuously
    const pollInterval = setInterval(() => {
      if (cancelled || isDismissingRef.current) {
        clearInterval(pollInterval);
        return;
      }
      tryDismiss();
    }, 60);

    // Also wait on top images explicitly
    void waitForTopImages(duration).then(() => {
      if (!cancelled) {
        tryDismiss();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(minTimer);
      clearTimeout(targetTimer);
      clearTimeout(maxSafetyTimer);
      clearInterval(pollInterval);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [duration, dismiss]);

  if (!visible) return null;

  return (
    <section
      id="loader"
      className={`loader ${leaving ? "leave" : ""}`}
      aria-label="Loading"
    >
      <div className="loader-inner">
        <div className="logo-wrap">
          {!imgError ? (
            <img
              className="logo"
              src={logoSrc}
              alt="ÉLANE"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="logo text-center font-serif text-3xl sm:text-4xl tracking-[0.3em] font-normal text-[#1a1a1a]">
              ÉLANE
            </div>
          )}
          <span className="shimmer" aria-hidden="true" />
        </div>
        <div className="line" />
        <div className="tagline">Modern Femininity</div>
        <div className="progress" />
      </div>
    </section>
  );
}
