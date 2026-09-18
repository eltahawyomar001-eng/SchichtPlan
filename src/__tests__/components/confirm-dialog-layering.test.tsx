/**
 * A confirmation is always secondary to whatever opened it, so it has to sit
 * above it — and own the Escape key while it is open.
 *
 * Both bugs had the same shape. ConfirmDialog and Modal both used z-[60], so
 * whichever rendered last in the DOM won: on the shift planner the detail modal
 * was listed after the confirmation, so "Unassign" opened a dialog *underneath*
 * the modal that opened it, and the user had to close the modal to reach it.
 * Both also attached Escape handlers to window, so one Escape dismissed the
 * confirmation and the modal beneath it at once.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

afterEach(cleanup);

function overlayOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector(".fixed.inset-0");
  if (!el) throw new Error("confirm dialog overlay not found");
  return el as HTMLElement;
}

/** Numeric value out of a Tailwind arbitrary z-index class, e.g. "z-[80]". */
function zIndexOf(el: HTMLElement): number {
  const cls = [...el.classList].find((c) => /^z-\[\d+\]$/.test(c));
  if (!cls) throw new Error(`no arbitrary z-index class on: ${el.className}`);
  return Number(cls.slice(3, -1));
}

/** The base overlay layer shared by Modal, BottomSheet, CommandPalette, … */
const BASE_OVERLAY_Z = 60;

describe("ConfirmDialog layering", () => {
  it("renders above the base overlay layer", () => {
    const { container } = render(
      <ConfirmDialog
        open
        title="Zuweisung aufheben"
        message="Sicher?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(zIndexOf(overlayOf(container))).toBeGreaterThan(BASE_OVERLAY_Z);
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="t"
        message="m"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.querySelector(".fixed.inset-0")).toBeNull();
  });
});

describe("ConfirmDialog consumes Escape", () => {
  it("does not let an underlying modal's Escape handler also fire", () => {
    // Stand-in for Modal: a window keydown listener registered BEFORE the
    // dialog mounts, exactly as a modal that opened it would have.
    const underlyingModalClose = vi.fn();
    const modalHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") underlyingModalClose();
    };
    window.addEventListener("keydown", modalHandler);

    const onCancel = vi.fn();
    try {
      render(
        <ConfirmDialog
          open
          title="Zuweisung aufheben"
          message="Sicher?"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );

      expect(onCancel).toHaveBeenCalledOnce();
      expect(underlyingModalClose).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", modalHandler);
    }
  });

  it("leaves other keys alone", () => {
    const other = vi.fn();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "a") other();
    };
    window.addEventListener("keydown", handler);
    try {
      render(
        <ConfirmDialog
          open
          title="t"
          message="m"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      );
      expect(other).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("keydown", handler);
    }
  });

  it("still renders its title and message", () => {
    render(
      <ConfirmDialog
        open
        title="Zuweisung aufheben"
        message="Sicher?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Zuweisung aufheben")).toBeTruthy();
    expect(screen.getByText("Sicher?")).toBeTruthy();
  });
});
