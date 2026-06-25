import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("theme", theme);

    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme: () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
      },
      setTheme,
    }),
    [theme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme ThemeProvider içinde kullanılmalı.");
  }

  return context;
}