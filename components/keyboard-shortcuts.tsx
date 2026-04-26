"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommandIcon, KeyboardIcon, NavigationIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const routes: Record<string, string> = {
  l: "/dashboard/leads",
  c: "/dashboard/calls",
  a: "/dashboard/agents",
  s: "/dashboard/settings",
  t: "/dashboard/test-call",
};

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-border-default bg-bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-fg-secondary shadow-xs">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsLayer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const gPressedAt = useRef<number | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem("actualizer-shortcut-toast") === "shown") return;
    window.sessionStorage.setItem("actualizer-shortcut-toast", "shown");
    const id = window.setTimeout(() => toast.info("Press cmd-K to search anything"), 900);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    function openHelp() {
      setOpen(true);
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (!isTyping && event.key === "?") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      const now = Date.now();
      if (event.key.toLowerCase() === "g") {
        gPressedAt.current = now;
        return;
      }

      if (gPressedAt.current && now - gPressedAt.current < 900) {
        const route = routes[event.key.toLowerCase()];
        gPressedAt.current = null;
        if (route) {
          event.preventDefault();
          router.push(route);
        }
      }
    }

    window.addEventListener("actualizer:open-shortcuts", openHelp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("actualizer:open-shortcuts", openHelp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyboardIcon className="size-5 text-accent-primary" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Navigate Actualizer without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <ShortcutGroup
            icon={<CommandIcon className="size-5 text-accent-primary" />}
            title="Search and help"
            rows={[
              [["cmd", "K"], "Open command palette"],
              [["cmd", "/"], "Open this shortcut guide"],
              [["?"], "Toggle shortcut guide"],
              [["esc"], "Close active modal, sheet, or menu"],
            ]}
          />
          <ShortcutGroup
            icon={<NavigationIcon className="size-5 text-accent-primary" />}
            title="Go to"
            rows={[
              [["g", "l"], "Leads"],
              [["g", "c"], "Calls"],
              [["g", "a"], "Agents"],
              [["g", "s"], "Settings"],
              [["g", "t"], "Test call"],
            ]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutGroup({
  icon,
  title,
  rows,
}: {
  icon: ReactNode;
  title: string;
  rows: Array<[string[], string]>;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="grid gap-2">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-surface-sunken px-3 py-2">
            <span className="text-sm text-fg-secondary">{label}</span>
            <span className="flex items-center gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
