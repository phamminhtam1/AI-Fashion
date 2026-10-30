import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ParsedValue = {
  number: number;
  prefix: string;
  suffix: string;
  fractionDigits: number;
  decimalSeparator: string | null;
  groupingSeparator: string | null;
  forcePlus: boolean;
};

function parseValue(value: string): ParsedValue | null {
  if (/[/:]/.test(value)) return null;
  const match = value.match(/^(.*?)([+-]?\d[\d.,]*)([^\d]*)$/);
  if (!match) return null;

  const prefix = match[1] ?? "";
  const token = match[2] ?? "";
  const suffix = match[3] ?? "";
  const forcePlus = token.startsWith("+");
  const negative = token.startsWith("-");
  const unsigned = token.replace(/^[+-]/, "");
  const separators = [...unsigned.matchAll(/[.,]/g)];
  let decimalSeparator: string | null = null;
  let groupingSeparator: string | null = null;
  let fractionDigits = 0;

  if (separators.length) {
    const lastSeparator = separators[separators.length - 1]!;
    const trailingDigits = unsigned.length - lastSeparator.index! - 1;
    if (trailingDigits > 0 && trailingDigits < 3) {
      decimalSeparator = lastSeparator[0]!;
      fractionDigits = trailingDigits;
    }
  }
  groupingSeparator = decimalSeparator
    ? separators.find((separator) => separator[0] !== decimalSeparator)?.[0] ?? null
    : separators[0]?.[0] ?? null;

  let normalized: string;
  if (decimalSeparator) {
    const lastIndex = unsigned.lastIndexOf(decimalSeparator);
    normalized = `${unsigned.slice(0, lastIndex).replace(/[.,]/g, "")}.${unsigned.slice(lastIndex + 1)}`;
  } else {
    normalized = unsigned.replace(/[.,]/g, "");
  }

  const parsed = Number(normalized) * (negative ? -1 : 1);
  if (!Number.isFinite(parsed)) return null;
  return { number: parsed, prefix, suffix, fractionDigits, decimalSeparator, groupingSeparator, forcePlus };
}

function formatValue(value: number, parsed: ParsedValue) {
  const locale = parsed.groupingSeparator === "," || parsed.decimalSeparator === "." ? "en-US" : "vi-VN";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: parsed.fractionDigits,
    maximumFractionDigits: parsed.fractionDigits,
  }).format(Math.abs(value));
  const sign = value < 0 ? "-" : parsed.forcePlus ? "+" : "";
  return `${parsed.prefix}${sign}${formatted}${parsed.suffix}`;
}

export function AnimatedValue({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const text = String(value);
  const [display, setDisplay] = useState(text);
  const previousValue = useRef<number | null>(null);

  useLayoutEffect(() => {
    const next = parseValue(text);
    if (!next) {
      previousValue.current = null;
      setDisplay(text);
      return;
    }

    const from = previousValue.current ?? 0;
    const to = next.number;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) {
      previousValue.current = to;
      setDisplay(text);
      return;
    }

    setDisplay(formatValue(from, next));
    let frame = 0;
    let start = 0;
    const duration = 520;
    const tick = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const current = from + (to - from) * eased;
      previousValue.current = progress === 1 ? to : current;
      setDisplay(progress === 1 ? text : formatValue(current, next));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  return (
    <span className={cn("tabular-nums", className)} aria-label={text}>
      {display}
    </span>
  );
}
