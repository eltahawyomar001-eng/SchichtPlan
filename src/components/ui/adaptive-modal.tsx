"use client";

import { useIsMobile } from "@/lib/hooks/use-mobile";
import { Modal } from "@/components/ui/modal";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface AdaptiveModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width class for desktop Modal — defaults to "lg" */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  /** Optional title */
  title?: string;
  /** Optional description below the title */
  description?: string;
  /** Optional sticky footer */
  footer?: React.ReactNode;
  className?: string;
  /**
   * BottomSheet height on mobile — "auto" sizes to content, "full" takes ~92vh.
   * Desktop Modal always uses size + max-h constraints.
   * Default: "auto"
   */
  mobileHeight?: "auto" | "full";
  /**
   * Called before closing via backdrop click, Escape, X button, or swipe.
   * Return `true` to prevent the close (e.g. to show a confirm dialog).
   */
  preventClose?: () => boolean;
}

/**
 * Platform-adaptive modal.
 *
 * - **≤ 768px (mobile):** Renders `<BottomSheet>` — iOS-style bottom sheet
 *   with swipe-to-dismiss, drag handle, env(safe-area-inset-bottom).
 * - **> 768px (desktop):** Renders `<Modal>` — centered dialog with
 *   rounded corners, backdrop blur, escape key.
 *
 * Drop-in replacement for `<Modal>` — same props interface.
 *
 * ```tsx
 * <AdaptiveModal open={open} onClose={close} title="Edit Shift" footer={<Footer />}>
 *   <Form />
 * </AdaptiveModal>
 * ```
 */
export function AdaptiveModal({
  open,
  onClose,
  children,
  size = "lg",
  title,
  description,
  footer,
  className,
  mobileHeight = "auto",
  preventClose,
}: AdaptiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        description={description}
        footer={footer}
        className={className}
        height={mobileHeight}
        preventClose={preventClose}
      >
        {children}
      </BottomSheet>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={size}
      title={title}
      description={description}
      footer={footer}
      className={className}
      preventClose={preventClose}
    >
      {children}
    </Modal>
  );
}

// Re-export ModalFooter for convenience
export { ModalFooter } from "@/components/ui/modal";
