"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, TrashIcon } from "@/components/icons";

export function WorkspaceLogoCard() {
  const t = useTranslations("workspaceLogo");
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((d) => setLogo(d.logo ?? null))
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError(t("tooLarge"));
      return;
    }
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("logo", file);
    try {
      const res = await fetch("/api/workspace/logo", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t("uploadError"));
      } else {
        const d = await res.json();
        setLogo(d.logo);
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setUploading(true);
    setError(null);
    try {
      await fetch("/api/workspace/logo", { method: "DELETE" });
      setLogo(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-emerald-600" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {t("description")}
            </p>
            <div className="flex items-center gap-4">
              {logo ? (
                <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  <Image
                    src={logo}
                    alt="Logo"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                  <ImageIcon className="h-7 w-7 text-gray-300 dark:text-zinc-600" />
                </div>
              )}
              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading
                    ? t("uploading")
                    : logo
                      ? t("change")
                      : t("upload")}
                </Button>
                {logo && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={uploading}
                    onClick={removeLogo}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    {t("remove")}
                  </Button>
                )}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              {t("hint")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
