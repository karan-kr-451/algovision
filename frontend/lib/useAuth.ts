"use client";

import { useEffect, useState } from "react";
import { fetchMe, type AuthUser } from "./api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("av_token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe(token)
      .then(setUser)
      .catch(() => localStorage.removeItem("av_token"))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem("av_token");
    setUser(null);
  }

  return { user, loading, logout };
}
