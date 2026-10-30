import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimatedPanelProps = HTMLAttributes<HTMLDivElement> & {
  animationMode?: "content" | "page";
  children: ReactNode;
  transitionKey: string | number;
};

export function AnimatedPanel({
  children,
  className,
  animationMode = "content",
  transitionKey,
  ...props
}: AnimatedPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(transitionKey);
  const heightRef = useRef<number | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const staggerAnimationsRef = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const content = contentRef.current;
    if (!panel || !content) return;

    const currentHeight = panel.getBoundingClientRect().height;
    if (heightRef.current === null) {
      heightRef.current = currentHeight || content.getBoundingClientRect().height;
    }

    if (Object.is(keyRef.current, transitionKey)) {
      const playState = animationRef.current?.playState;
      if (!playState || (playState !== "running" && playState !== "pending")) {
        animationRef.current?.cancel();
        animationRef.current = null;
        panel.style.removeProperty("height");
        panel.style.removeProperty("overflow");
        delete panel.dataset["transitioning"];
        content.classList.remove("admin-transition-enter");
        heightRef.current = panel.getBoundingClientRect().height || content.getBoundingClientRect().height;
      }
      return;
    }

    keyRef.current = transitionKey;
    const wasAnimating = animationRef.current !== null;
    animationRef.current?.cancel();
    animationRef.current = null;
    staggerAnimationsRef.current.forEach((animation) => animation.cancel());
    staggerAnimationsRef.current = [];

    const animateInOrder = (): Animation | null => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
      const screen = content.firstElementChild as HTMLElement | null;
      if (!screen) return null;
      const nested = screen.children.length < 2 ? screen.firstElementChild as HTMLElement | null : null;
      const target = nested && nested.children.length > 1 ? nested : screen;
      const elements = Array.from(target.children)
        .filter((element): element is HTMLElement =>
          element instanceof HTMLElement &&
          !element.hidden &&
          window.getComputedStyle(element).display !== "none" &&
          window.getComputedStyle(element).visibility !== "hidden",
        )
        .filter((element) => {
          if (window.getComputedStyle(element).position === "fixed") return false;
          return !Array.from(element.querySelectorAll<HTMLElement>("*")).some(
            (child) => window.getComputedStyle(child).position === "fixed",
          );
        })
        .slice(0, 7);

      if (elements.length === 0) return null;
      staggerAnimationsRef.current = elements.map((element, index) =>
        element.animate(
          [
            { opacity: 0, filter: "blur(3px)", transform: "translate3d(0, 7px, 0)" },
            { opacity: 1, filter: "blur(0)", transform: "translate3d(0, 0, 0)" },
          ],
          { duration: 220, delay: index * 12, easing: "ease-in-out", fill: "both" },
        ),
      );
      return staggerAnimationsRef.current.at(-1) ?? null;
    };

    if (animationMode === "page") {
      panel.style.removeProperty("height");
      panel.style.removeProperty("overflow");
      delete panel.dataset["transitioning"];
      content.classList.remove("admin-transition-enter");

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        heightRef.current = panel.getBoundingClientRect().height;
        return;
      }

      const animation = animateInOrder();
      if (!animation) {
        heightRef.current = panel.getBoundingClientRect().height;
        return;
      }
      animationRef.current = animation;
      animation.onfinish = () => {
        if (animationRef.current === animation) {
          heightRef.current = panel.getBoundingClientRect().height;
          animationRef.current = null;
          staggerAnimationsRef.current.forEach((item) => item.cancel());
          staggerAnimationsRef.current = [];
        }
      };
      return;
    }

    const fromHeight = wasAnimating ? currentHeight : heightRef.current || currentHeight;
    panel.style.height = `${fromHeight}px`;
    panel.style.overflow = "hidden";
    panel.dataset["transitioning"] = "true";
    animateInOrder();

    const finish = () => {
      panel.style.removeProperty("height");
      panel.style.removeProperty("overflow");
      delete panel.dataset["transitioning"];
      heightRef.current = panel.getBoundingClientRect().height;
      animationRef.current = null;
      staggerAnimationsRef.current.forEach((item) => item.cancel());
      staggerAnimationsRef.current = [];
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    const animation = panel.animate(
      [{ height: `${fromHeight}px` }, { height: `${content.getBoundingClientRect().height}px` }],
      { duration: 300, easing: "ease-in-out" },
    );
    animationRef.current = animation;
    animation.onfinish = () => {
      if (animationRef.current === animation) finish();
    };
  }, [animationMode, transitionKey]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const content = contentRef.current;
    if (!panel || !content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!animationRef.current) heightRef.current = panel.getBoundingClientRect().height;
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
      animationRef.current?.cancel();
      animationRef.current = null;
      staggerAnimationsRef.current.forEach((animation) => animation.cancel());
      staggerAnimationsRef.current = [];
      panel.style.removeProperty("height");
      panel.style.removeProperty("overflow");
      delete panel.dataset["transitioning"];
      content.classList.remove("admin-transition-enter");
    };
  }, []);

  return (
    <div {...props} ref={panelRef} className={cn("admin-transition-panel min-w-0", className)}>
      <div ref={contentRef} className="admin-transition-content min-w-0">
        {children}
      </div>
    </div>
  );
}
