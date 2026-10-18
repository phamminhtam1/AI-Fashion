import { useCallback, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  /** Nút xác nhận màu cảnh báo (xóa / nguy hiểm) */
  destructive?: boolean;
  variant?: "default" | "destructive";
};

type Pending = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

/**
 * Promise-based confirm dùng Radix AlertDialog (đã có trong admin).
 * Thay window.confirm — giữ API await confirm(...).
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const close = useCallback((ok: boolean) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    p?.resolve(ok);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const next: Pending = { ...opts, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const isDestructive = Boolean(pending?.destructive || pending?.variant === "destructive");
  const confirmText = pending?.confirmLabel || pending?.confirmText || "Đồng ý";
  const cancelText = pending?.cancelLabel || pending?.cancelText || "Huỷ";

  const dialog = (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <p className="section-label text-primary">{isDestructive ? "Cảnh báo" : "Xác nhận"}</p>
          <AlertDialogTitle className="font-sans admin-section-title">{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-sm leading-relaxed">
            {pending?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={(e) => {
              e.preventDefault();
              close(true);
            }}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog, ConfirmDialogElement: dialog };
}
