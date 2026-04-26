"use client";

import type { ComponentType } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ThemePreference, useTheme } from "@/lib/theme";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const CurrentIcon = resolvedTheme === "dark" ? MoonIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Theme: ${theme}`}
          />
        }
      >
        <CurrentIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themeOptions.map((option) => {
          const Icon = option.icon;

          return (
            <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
              <Icon className="size-4" />
              <span>{option.label}</span>
              {theme === option.value ? <span className="ml-auto text-xs">On</span> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
