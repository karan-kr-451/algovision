"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await register(name, email, password);
      }
      const { token } = await login(email, password);
      localStorage.setItem("av_token", token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-semibold">
          {mode === "login" ? "Log in" : "Create account"}
        </h1>

        {mode === "register" && (
          <input
            className="rounded-md border border-hairline bg-surface-1 px-3 py-2 focus:border-accent focus:outline-none transition-colors"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className="rounded-md border border-hairline bg-surface-1 px-3 py-2 focus:border-accent focus:outline-none transition-colors"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded-md border border-hairline bg-surface-1 px-3 py-2 focus:border-accent focus:outline-none transition-colors"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-err text-sm">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent-strong text-white py-2 font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {mode === "login" ? "Log in" : "Register"}
        </button>

        <button
          type="button"
          className="text-sm text-ink-subtle hover:text-ink transition-colors"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
