"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BotIcon,
  HeartPulseIcon,
  MegaphoneIcon,
  PhoneIcon,
  PhoneIncomingIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  keywords?: string[];
};

const navigateItems: CommandItem[] = [
  { id: "nav-leads", label: "Leads", href: "/dashboard/leads", icon: HeartPulseIcon },
  { id: "nav-calls", label: "Calls", href: "/dashboard/calls", icon: PhoneIncomingIcon },
  { id: "nav-caregivers", label: "Caregivers", href: "/dashboard/caregivers", icon: UsersIcon },
  { id: "nav-campaigns", label: "Campaigns", href: "/dashboard/campaigns", icon: MegaphoneIcon },
  { id: "nav-test-call", label: "Test call", href: "/dashboard/test-call", icon: PhoneIcon },
  { id: "nav-agents", label: "Agents", href: "/dashboard/agents", icon: BotIcon },
  { id: "nav-settings", label: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
];

const quickActions: CommandItem[] = [
  {
    id: "action-new-lead",
    label: "New manual lead",
    description: "Open the manual lead workflow",
    href: "/dashboard/leads",
    icon: PlusIcon,
    keywords: ["create", "intake"],
  },
  {
    id: "action-test-call",
    label: "Place test call",
    href: "/dashboard/test-call",
    icon: PhoneIcon,
    keywords: ["retell", "ai"],
  },
  {
    id: "action-new-campaign",
    label: "New campaign",
    href: "/dashboard/campaigns",
    icon: MegaphoneIcon,
    keywords: ["outbound"],
  },
  {
    id: "action-import-agent",
    label: "Import agent template",
    href: "/dashboard/agents",
    icon: BotIcon,
    keywords: ["retell", "template"],
  },
];

function getRecentLeads(): CommandItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem("actualizer-recent-leads") ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.slice(0, 5).flatMap((item, index) => {
      if (!item || typeof item !== "object" || typeof item.href !== "string") {
        return [];
      }

      return [
        {
          id: `recent-lead-${index}`,
          label: typeof item.label === "string" ? item.label : "Recent lead",
          description: "Recently viewed lead",
          href: item.href,
          icon: HeartPulseIcon,
        },
      ];
    });
  } catch {
    return [];
  }
}

function CommandRow({ item, onSelect }: { item: CommandItem; onSelect: (item: CommandItem) => void }) {
  const Icon = item.icon;

  return (
    <Command.Item
      value={[item.label, item.description, ...(item.keywords ?? [])].filter(Boolean).join(" ")}
      onSelect={() => onSelect(item)}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg-primary outline-none aria-selected:bg-bg-muted aria-selected:shadow-focus"
    >
      {Icon ? <Icon className="size-4 text-fg-tertiary" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        {item.description ? (
          <span className="block truncate text-xs text-fg-tertiary">{item.description}</span>
        ) : null}
      </span>
    </Command.Item>
  );
}

export function CommandPalette({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recentLeads, setRecentLeads] = useState<CommandItem[]>([]);

  useEffect(() => {
    setRecentLeads(getRecentLeads());
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groups = useMemo(
    () => [
      { heading: "Navigate", items: navigateItems },
      { heading: "Quick actions", items: quickActions },
      { heading: "Recent leads", items: recentLeads },
    ],
    [recentLeads]
  );

  function selectItem(item: CommandItem) {
    if (item.href) {
      setOpen(false);
      router.push(item.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden h-9 w-[380px] items-center gap-2 rounded-md border border-border-default bg-bg-surface px-3 text-left text-sm text-fg-tertiary shadow-xs transition-colors duration-fast hover:border-border-strong hover:bg-bg-muted focus-visible:shadow-focus lg:flex",
          className
        )}
      >
        <SearchIcon className="size-4" />
        <span className="flex-1">Search leads, calls, caregivers...</span>
        <kbd className="rounded-sm border border-border-subtle bg-bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command className="bg-bg-surface-raised text-fg-primary">
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
              <SearchIcon className="size-4 text-fg-tertiary" />
              <Command.Input
                autoFocus
                placeholder="Search leads, calls, caregivers..."
                className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-tertiary"
              />
            </div>
            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-fg-tertiary">
                No results found.
              </Command.Empty>
              {groups.map((group) =>
                group.items.length ? (
                  <Command.Group
                    key={group.heading}
                    heading={group.heading}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-fg-tertiary [&_[cmdk-group-heading]]:uppercase"
                  >
                    {group.items.map((item) => (
                      <CommandRow key={item.id} item={item} onSelect={selectItem} />
                    ))}
                  </Command.Group>
                ) : null
              )}
            </Command.List>
            <div className="border-t border-border-subtle px-4 py-2 font-mono text-xs text-fg-tertiary">
              ↑↓ navigate · enter select · esc close
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
