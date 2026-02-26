import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface FetchOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

// ─── Fetch helper ───────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function buildUrl(base: string, opts?: FetchOptions): string {
  const params = new URLSearchParams();
  if (opts) {
    for (const [key, value] of Object.entries(opts)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Query Keys ─────────────────────────────────────────────

export const queryKeys = {
  employees: (opts?: FetchOptions) => ["employees", opts] as const,
  employee: (id: string) => ["employee", id] as const,
  shifts: (opts?: FetchOptions) => ["shifts", opts] as const,
  timeEntries: (opts?: FetchOptions) => ["timeEntries", opts] as const,
  absences: (opts?: FetchOptions) => ["absences", opts] as const,
  locations: (opts?: FetchOptions) => ["locations", opts] as const,
  departments: (opts?: FetchOptions) => ["departments", opts] as const,
  notifications: (opts?: FetchOptions) => ["notifications", opts] as const,
  projects: (opts?: FetchOptions) => ["projects", opts] as const,
  clients: (opts?: FetchOptions) => ["clients", opts] as const,
  skills: (opts?: FetchOptions) => ["skills", opts] as const,
  shiftTemplates: (opts?: FetchOptions) => ["shiftTemplates", opts] as const,
  shiftSwaps: (opts?: FetchOptions) => ["shiftSwaps", opts] as const,
  availability: (opts?: FetchOptions) => ["availability", opts] as const,
  webhooks: (opts?: FetchOptions) => ["webhooks", opts] as const,
  automationRules: (opts?: FetchOptions) => ["automationRules", opts] as const,
} as const;

// ─── Generic paginated list hook ────────────────────────────

function usePaginatedList<T>(
  key: readonly unknown[],
  url: string,
  opts?: FetchOptions,
) {
  return useQuery<PaginatedResponse<T>>({
    queryKey: key,
    queryFn: () => apiFetch<PaginatedResponse<T>>(buildUrl(url, opts)),
  });
}

// ─── Employees ──────────────────────────────────────────────

export function useEmployees(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.employees(opts), "/api/employees", opts);
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: queryKeys.employee(id),
    queryFn: () => apiFetch(`/api/employees/${id}`),
    enabled: !!id,
  });
}

// ─── Shifts ─────────────────────────────────────────────────

export function useShifts(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.shifts(opts), "/api/shifts", opts);
}

// ─── Time Entries ───────────────────────────────────────────

export function useTimeEntries(opts?: FetchOptions) {
  return usePaginatedList(
    queryKeys.timeEntries(opts),
    "/api/time-entries",
    opts,
  );
}

// ─── Absences ───────────────────────────────────────────────

export function useAbsences(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.absences(opts), "/api/absences", opts);
}

// ─── Locations ──────────────────────────────────────────────

export function useLocations(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.locations(opts), "/api/locations", opts);
}

// ─── Departments ────────────────────────────────────────────

export function useDepartments(opts?: FetchOptions) {
  return usePaginatedList(
    queryKeys.departments(opts),
    "/api/departments",
    opts,
  );
}

// ─── Notifications ──────────────────────────────────────────

export function useNotifications(opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.notifications(opts),
    queryFn: () =>
      apiFetch<PaginatedResponse<unknown> & { unreadCount: number }>(
        buildUrl("/api/notifications", opts),
      ),
  });
}

// ─── Projects ───────────────────────────────────────────────

export function useProjects(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.projects(opts), "/api/projects", opts);
}

// ─── Clients ────────────────────────────────────────────────

export function useClients(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.clients(opts), "/api/clients", opts);
}

// ─── Skills ─────────────────────────────────────────────────

export function useSkills(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.skills(opts), "/api/skills", opts);
}

// ─── Shift Templates ────────────────────────────────────────

export function useShiftTemplates(opts?: FetchOptions) {
  return usePaginatedList(
    queryKeys.shiftTemplates(opts),
    "/api/shift-templates",
    opts,
  );
}

// ─── Shift Swaps ────────────────────────────────────────────

export function useShiftSwaps(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.shiftSwaps(opts), "/api/shift-swaps", opts);
}

// ─── Availability ───────────────────────────────────────────

export function useAvailability(opts?: FetchOptions) {
  return usePaginatedList(
    queryKeys.availability(opts),
    "/api/availability",
    opts,
  );
}

// ─── Webhooks ───────────────────────────────────────────────

export function useWebhooks(opts?: FetchOptions) {
  return usePaginatedList(queryKeys.webhooks(opts), "/api/webhooks", opts);
}

// ─── Automation Rules ───────────────────────────────────────

export function useAutomationRules(opts?: FetchOptions) {
  return usePaginatedList(
    queryKeys.automationRules(opts),
    "/api/automation-rules",
    opts,
  );
}

// ─── Generic Mutation Hook ──────────────────────────────────

export function useApiMutation<TData = unknown, TVariables = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
  invalidateKeys?: readonly unknown[][],
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) =>
      apiFetch<TData>(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      }),
    onSuccess: () => {
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });
}
