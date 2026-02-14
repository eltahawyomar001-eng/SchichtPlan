"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SchichtPlanMark } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    workspaceName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          workspaceName: formData.workspaceName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registrierung fehlgeschlagen.");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 px-4">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center">
            <SchichtPlanMark className="h-12 w-12" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Konto erstellen
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Starten Sie mit SchichtPlan
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Vollständiger Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Max Mustermann"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="max@beispiel.de"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspaceName">Firmenname</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              placeholder="Meine Firma GmbH"
              value={formData.workspaceName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Mindestens 8 Zeichen"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Passwort wiederholen"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird erstellt..." : "Konto erstellen"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Bereits ein Konto?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
