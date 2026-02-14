"use client";

import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { BellIcon } from "@/components/icons";

interface TopbarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, description, actions }: TopbarProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <BellIcon className="h-5 w-5" />
        </button>
        {session?.user?.name && <Avatar name={session.user.name} size="sm" />}
      </div>
    </header>
  );
}
