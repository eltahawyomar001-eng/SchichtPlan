"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon, TrashIcon } from "@/components/icons";

/* ── Types ── */
export interface Task {
  id: string;
  title: string;
  done: boolean;
}

interface MyTasksCardProps {
  title: string;
  newLabel: string;
  emptyLabel: string;
  emptyDesc: string;
}

const STORAGE_KEY = "shiftfy-my-tasks";

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export function MyTasksCard({
  title,
  newLabel,
  emptyLabel,
  emptyDesc,
}: MyTasksCardProps) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [showInput, setShowInput] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* Persist on change (skip initial hydrated render) */
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    saveTasks(tasks);
  }, [tasks]);

  /* Focus input when revealed */
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const addTask = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const task: Task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
      done: false,
    };
    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    setShowInput(false);
  }, [newTitle]);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {totalCount > 0 && (
              <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">
                {doneCount}/{totalCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowInput((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {newLabel}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* New task input */}
        {showInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
            className="flex items-center gap-2 mb-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={title + "…"}
              maxLength={120}
              className="flex-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-white transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </form>
        )}

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <EmptyIllustration />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {emptyLabel}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                {emptyDesc}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className={`h-[18px] w-[18px] rounded-md border-2 flex-shrink-0 transition-all flex items-center justify-center ${
                    task.done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-gray-300 dark:border-zinc-600 hover:border-emerald-400"
                  }`}
                  aria-label={task.done ? "Mark undone" : "Mark done"}
                >
                  {task.done && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      className="text-white"
                    >
                      <path
                        d="M2 5.5L4 7.5L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Label */}
                <span
                  className={`flex-1 text-sm transition-colors ${
                    task.done
                      ? "text-gray-400 dark:text-zinc-500 line-through"
                      : "text-gray-900 dark:text-zinc-100"
                  }`}
                >
                  {task.title}
                </span>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-all"
                  aria-label="Delete task"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── SVG empty-state illustration (character) ── */
function EmptyIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-80"
      aria-hidden
    >
      {/* Body circle */}
      <circle
        cx="60"
        cy="68"
        r="32"
        className="fill-gray-100 dark:fill-zinc-800"
      />
      {/* Head */}
      <circle
        cx="60"
        cy="36"
        r="18"
        className="fill-gray-200 dark:fill-zinc-700"
      />
      {/* Face — simple smile */}
      <circle
        cx="54"
        cy="34"
        r="2"
        className="fill-gray-400 dark:fill-zinc-500"
      />
      <circle
        cx="66"
        cy="34"
        r="2"
        className="fill-gray-400 dark:fill-zinc-500"
      />
      <path
        d="M54 41 Q60 46 66 41"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        className="stroke-gray-400 dark:stroke-zinc-500"
      />
      {/* Arm — waving */}
      <path
        d="M88 58 Q94 48 98 38"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        className="stroke-emerald-400 dark:stroke-emerald-500"
      />
      {/* Hand circle */}
      <circle
        cx="99"
        cy="36"
        r="4"
        className="fill-emerald-400 dark:fill-emerald-500"
      />
      {/* Clipboard in other hand */}
      <rect
        x="26"
        y="56"
        width="14"
        height="18"
        rx="2"
        className="fill-gray-200 dark:fill-zinc-700"
      />
      <rect
        x="29"
        y="60"
        width="8"
        height="2"
        rx="1"
        className="fill-gray-300 dark:fill-zinc-600"
      />
      <rect
        x="29"
        y="64"
        width="6"
        height="2"
        rx="1"
        className="fill-gray-300 dark:fill-zinc-600"
      />
      <rect
        x="29"
        y="68"
        width="8"
        height="2"
        rx="1"
        className="fill-gray-300 dark:fill-zinc-600"
      />
      {/* Checkmark on clipboard */}
      <path
        d="M30 63 L32 65 L36 60"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="stroke-emerald-500 dark:stroke-emerald-400"
      />
      {/* Shadow */}
      <ellipse
        cx="60"
        cy="106"
        rx="28"
        ry="6"
        className="fill-gray-100 dark:fill-zinc-800/50"
      />
    </svg>
  );
}
