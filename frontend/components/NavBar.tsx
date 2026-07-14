"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function NavBar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-6 shrink-0">
      <Link href="/" className="font-semibold tracking-tight">
        AlgoVision
      </Link>
      <Link href="/problems" className="text-sm text-zinc-400 hover:text-zinc-100">
        Problems
      </Link>
      <div className="ml-auto text-sm">
        {loading ? null : user ? (
          <div className="flex items-center gap-3 text-zinc-400">
            <span>{user.name}</span>
            <button onClick={logout} className="hover:text-zinc-100">
              Log out
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-zinc-400 hover:text-zinc-100">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
