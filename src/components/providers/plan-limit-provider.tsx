"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  UpgradeModal,
  parsePlanLimitError,
  type PlanLimitError,
} from "@/components/ui/upgrade-modal";

interface PlanLimitContextValue {
  /**
   * Call after any fetch() — if the response is a 403 PLAN_LIMIT,
   * it opens the upgrade modal and returns `true`.
   * Otherwise returns `false` so the caller can continue normal error handling.
   */
  handlePlanLimit: (res: Response) => Promise<boolean>;

  /**
   * Directly show the upgrade modal with a given error body.
   */
  showUpgradeModal: (error: PlanLimitError) => void;
}

const PlanLimitContext = createContext<PlanLimitContextValue | null>(null);

/**
 * Hook to access plan-limit interception in dashboard pages.
 */
export function usePlanLimit() {
  const ctx = useContext(PlanLimitContext);
  if (!ctx) {
    throw new Error("usePlanLimit must be used within <PlanLimitProvider>");
  }
  return ctx;
}

/**
 * Wraps the dashboard layout and provides global PLAN_LIMIT interception.
 */
export function PlanLimitProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<PlanLimitError | null>(null);
  const [open, setOpen] = useState(false);

  const handlePlanLimit = useCallback(
    async (res: Response): Promise<boolean> => {
      const planError = await parsePlanLimitError(res);
      if (planError) {
        setError(planError);
        setOpen(true);
        return true;
      }
      return false;
    },
    [],
  );

  const showUpgradeModal = useCallback((planError: PlanLimitError) => {
    setError(planError);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  return (
    <PlanLimitContext.Provider value={{ handlePlanLimit, showUpgradeModal }}>
      {children}
      <UpgradeModal open={open} planLimitError={error} onClose={handleClose} />
    </PlanLimitContext.Provider>
  );
}
