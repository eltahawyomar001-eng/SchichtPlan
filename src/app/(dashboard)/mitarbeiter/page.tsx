"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  PlusIcon,
  SearchIcon,
  XIcon,
  MailIcon,
  PhoneIcon,
  BriefcaseIcon,
  UsersIcon,
} from "@/components/icons";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  hourlyRate: number | null;
  weeklyHours: number | null;
  color: string | null;
  isActive: boolean;
}

export default function MitarbeiterPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    hourlyRate: "",
    weeklyHours: "",
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          position: "",
          hourlyRate: "",
          weeklyHours: "",
        });
        fetchEmployees();
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Mitarbeiter wirklich löschen?")) return;
    try {
      await fetch(`/api/employees/${id}`, { method: "DELETE" });
      fetchEmployees();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName} ${emp.position || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div>
      <Topbar
        title="Mitarbeiter"
        description="Verwalten Sie Ihre Mitarbeiter"
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Neuer Mitarbeiter</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-full sm:max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Mitarbeiter suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Add Employee Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-lg mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Neuer Mitarbeiter</CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1 hover:bg-gray-100"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Vorname *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            firstName: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nachname *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            lastName: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          position: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">Stundenlohn (€)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        value={formData.hourlyRate}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            hourlyRate: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weeklyHours">Wochenstunden</Label>
                      <Input
                        id="weeklyHours"
                        type="number"
                        step="0.5"
                        value={formData.weeklyHours}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            weeklyHours: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Abbrechen
                    </Button>
                    <Button type="submit">Speichern</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employee List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Laden...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <UsersIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900">
                {search
                  ? "Keine Mitarbeiter gefunden"
                  : "Noch keine Mitarbeiter"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {search
                  ? "Versuchen Sie eine andere Suche."
                  : "Fügen Sie Ihren ersten Mitarbeiter hinzu."}
              </p>
              {!search && (
                <Button className="mt-4" onClick={() => setShowForm(true)}>
                  <PlusIcon className="h-4 w-4" />
                  Mitarbeiter hinzufügen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${employee.firstName} ${employee.lastName}`}
                        color={employee.color || "#3B82F6"}
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        {employee.position && (
                          <p className="text-sm text-gray-500">
                            {employee.position}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={employee.isActive ? "success" : "outline"}>
                      {employee.isActive ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2">
                    {employee.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                        <MailIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    )}
                    {employee.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                        <PhoneIcon className="h-4 w-4 flex-shrink-0" />
                        {employee.phone}
                      </div>
                    )}
                    {employee.hourlyRate && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BriefcaseIcon className="h-4 w-4" />
                        {employee.hourlyRate.toFixed(2)} €/h
                        {employee.weeklyHours &&
                          ` · ${employee.weeklyHours}h/Woche`}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(employee.id)}
                    >
                      Löschen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
