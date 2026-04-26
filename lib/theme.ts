"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const themeCookie = "actualizer-theme";
const cookieMaxAge = 60 * 60 * 24 * 365;

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getCookieTheme(): ThemePreference {
  if (typeof document === "undefined") {
    return "system";
  }

  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${themeCookie}=`))
    ?.split("=")[1];

  const decoded = value ? decodeURIComponent(value) : undefined;
  return isThemePreference(decoded) ? decoded : "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function writeThemeCookie(preference: ThemePreference) {
  document.cookie = `${themeCookie}=${encodeURIComponent(
    preference
  )}; path=/; max-age=${cookieMaxAge}; samesite=lax`;
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  writeThemeCookie(preference);

  return resolved;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const initialTheme = getCookieTheme();
    setThemeState(initialTheme);
    setResolvedTheme(applyTheme(initialTheme));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      setResolvedTheme(applyTheme(getCookieTheme()));
    }

    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
