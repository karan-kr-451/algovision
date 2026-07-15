"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { BrandMark } from "./ui";

export default function NavBar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="border-b border-hairline px-6 h-12 flex items-center gap-6 shrink-0 bg-canvas/80 backdrop-blur">
      <Link href="/">
        <BrandMark />
      </Link>
      <Link href="/problems" className="text-sm text-ink-muted hover:text-ink transition-colors">
        Problems
      </Link>
      <div className="ml-auto text-sm">
        {loading ? null : user ? (
          <div className="flex items-center gap-4">
            {user.streak > 0 && (
              <span className="text-xs text-warn" title={`${user.streak}-day streak`}>
                ⚡ {user.streak}
              </span>
            )}
            <span className="text-ink-muted">{user.name}</span>
            <button onClick={logout} className="text-ink-subtle hover:text-ink transition-colors">
              Log out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm bg-accent-strong text-white px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
