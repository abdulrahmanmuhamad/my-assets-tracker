"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type DisplaySettings = {
  theme: "light" | "dark" | "system";
  financialValuesHiddenByDefault: boolean;
};

type PrivacyContextValue = DisplaySettings & {
  valuesHidden: boolean;
  setValuesHidden: (hidden: boolean) => void;
  toggleValuesHidden: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

function normalizeSettings(value: Partial<DisplaySettings>): DisplaySettings {
  return {
    theme: value.theme === "light" || value.theme === "dark" ? value.theme : "system",
    financialValuesHiddenByDefault: value.financialValuesHiddenByDefault !== false,
  };
}

export function GlobalPrivacyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>({
    theme: "system",
    financialValuesHiddenByDefault: true,
  });
  const [valuesHidden, setValuesHidden] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const next = normalizeSettings(data);
        setSettings(next);
        setValuesHidden(next.financialValuesHiddenByDefault);
      })
      .catch(() => undefined);

    function settingsUpdated(event: Event) {
      const data = (event as CustomEvent<Partial<DisplaySettings>>).detail;
      const next = normalizeSettings(data || {});
      setSettings(next);
      setValuesHidden(next.financialValuesHiddenByDefault);
    }
    window.addEventListener("portfolio:settings-updated", settingsUpdated);
    return () => {
      active = false;
      window.removeEventListener("portfolio:settings-updated", settingsUpdated);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  const value = useMemo<PrivacyContextValue>(
    () => ({
      ...settings,
      valuesHidden,
      setValuesHidden,
      toggleValuesHidden: () => setValuesHidden((current) => !current),
    }),
    [settings, valuesHidden],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) throw new Error("usePrivacy must be used inside GlobalPrivacyProvider");
  return context;
}
