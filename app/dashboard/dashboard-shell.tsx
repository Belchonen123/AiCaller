"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BellIcon,
  BotIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  HeartPulseIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PhoneIcon,
  PhoneIncomingIcon,
  SettingsIcon,
  SparklesIcon,
  UploadCloudIcon,
  UsersIcon,
} from "lucide-react";
import { logoutAction } from "@/app/dashboard/actions";
import { ActualizerLogo } from "@/components/actualizer-logo";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcutsLayer } from "@/components/keyboard-shortcuts";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  tenantName: string;
  userName: string;
  userEmail: string;
  setupIncomplete: boolean;
};

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    href: "/dashboard/setup",
    label: "Setup",
    icon: SparklesIcon,
    showsSetupDot: true,
  },
  {
    href: "/dashboard/leads",
    label: "Leads",
    icon: HeartPulseIcon,
  },
  {
    href: "/dashboard/calls",
    label: "Calls",
    icon: PhoneIncomingIcon,
  },
  {
    href: "/dashboard/caregivers",
    label: "Caregivers",
    icon: UsersIcon,
  },
  {
    href: "/dashboard/campaigns",
    label: "Campaigns",
    icon: MegaphoneIcon,
  },
  {
    href: "/dashboard/campaigns/import",
    label: "Import calling list",
    icon: UploadCloudIcon,
  },
  {
    href: "/dashboard/test-call",
    label: "Test call",
    icon: PhoneIcon,
  },
  {
    href: "/dashboard/agents",
    label: "Agents",
    icon: BotIcon,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: SettingsIcon,
  },
] as const;

const operationsNav = navItems.slice(0, 7);
const configurationNav = navItems.slice(8);
const testNav = navItems.slice(7, 8);

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase() || "U";
}

function ActualizerMark({ collapsed = false }: { collapsed?: boolean }) {
  return <ActualizerLogo showText={!collapsed} markClassName="size-8" />;
}

function NavSectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 h-px bg-border-subtle" />;
  }

  return (
    <p className="px-3 py-2 text-xs font-medium tracking-wide text-fg-tertiary uppercase">
      {children}
    </p>
  );
}

function NavLink({
  item,
  collapsed,
  onNavigate,
  setupIncomplete,
}: {
  item: (typeof navItems)[number];
  collapsed: boolean;
  onNavigate?: () => void;
  setupIncomplete: boolean;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href === "/dashboard/campaigns" &&
      pathname.startsWith("/dashboard/campaigns/") &&
      !pathname.startsWith("/dashboard/campaigns/import")) ||
    (!["/dashboard/leads", "/dashboard/campaigns"].includes(item.href) &&
      pathname.startsWith(`${item.href}/`));
  const content = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-fg-secondary transition-colors duration-fast hover:bg-bg-muted hover:text-fg-primary focus-visible:shadow-focus",
        collapsed && "justify-center px-2",
        isActive &&
          "bg-bg-emphasis text-fg-on-emphasis before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-secondary"
      )}
    >
      <span className="relative">
        <Icon className="size-[18px]" />
        {item.href === "/dashboard/test-call" ? (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-accent-secondary" />
        ) : null}
        {"showsSetupDot" in item && item.showsSetupDot && setupIncomplete ? (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-danger-fg ring-2 ring-bg-page" />
        ) : null}
      </span>
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );

  if (!collapsed) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{content}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarNav({
  collapsed,
  onNavigate,
  setupIncomplete,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  setupIncomplete: boolean;
}) {
  return (
    <nav className="grid gap-3">
      <section className="grid gap-1">
        <NavSectionLabel collapsed={collapsed}>Operations</NavSectionLabel>
        {operationsNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            setupIncomplete={setupIncomplete}
          />
        ))}
      </section>
      <section className="grid gap-1">
        <NavSectionLabel collapsed={collapsed}>Configuration</NavSectionLabel>
        {configurationNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            setupIncomplete={setupIncomplete}
          />
        ))}
      </section>
      <section className="mt-auto grid gap-1 border-t border-border-subtle pt-3">
        {testNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            setupIncomplete={setupIncomplete}
          />
        ))}
      </section>
    </nav>
  );
}

function UserMenu({
  userName,
  userEmail,
  initials,
  compact = false,
}: {
  userName: string;
  userEmail: string;
  initials: string;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex rounded-lg outline-none focus-visible:shadow-focus",
          compact ? "size-9 items-center justify-center" : "w-full items-center gap-3 p-2 hover:bg-bg-muted"
        )}
        aria-label="Open user menu"
      >
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {!compact ? (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium text-fg-primary">
              {userName || "User"}
            </span>
            <span className="block truncate text-xs text-fg-tertiary">Admin</span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm text-fg-primary">{userName || "User"}</span>
          <span className="block truncate text-xs font-normal text-fg-tertiary">{userEmail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/dashboard/settings" className="w-full">
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <span className="flex w-full items-center justify-between gap-2">
            Theme
            <ThemeToggle />
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <Button type="submit" variant="tertiary" className="w-full justify-start">
            Sign out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean).slice(1);
    if (!parts.length) {
      return ["Dashboard"];
    }

    return parts.map((part) =>
      part
        .replaceAll("-", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    );
  }, [pathname]);

  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link href="/dashboard" className="text-fg-secondary hover:text-fg-primary">
        Dashboard
      </Link>
      {crumbs.map((crumb, index) => (
        <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1">
          <ChevronRightIcon className="size-4 shrink-0 text-fg-tertiary" />
          <span className={cn("truncate", index === crumbs.length - 1 ? "text-fg-primary" : "text-fg-secondary")}>
            {crumb}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function DashboardShell({
  children,
  tenantName,
  userName,
  userEmail,
  setupIncomplete,
}: DashboardShellProps) {
  const initials = getInitials(userName, userEmail);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("actualizer-sidebar-collapsed") === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("actualizer-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-bg-page">
        <a
          href="#dashboard-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-bg-surface-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-fg-primary focus:shadow-focus"
        >
          Skip to main content
        </a>
        <aside
          data-collapsed={collapsed}
          className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-border-subtle bg-bg-surface-sunken transition-[width] duration-base motion-reduce:transition-none data-[collapsed=true]:w-[72px] md:flex"
        >
          <div className="flex h-14 items-center justify-between border-b border-border-subtle px-3">
            <ActualizerMark collapsed={collapsed} />
            {!collapsed ? (
              <Button variant="tertiary" size="icon-sm" onClick={toggleCollapsed} aria-label="Collapse sidebar">
                <PanelLeftCloseIcon />
              </Button>
            ) : (
              <Button variant="tertiary" size="icon-sm" onClick={toggleCollapsed} aria-label="Expand sidebar">
                <PanelLeftOpenIcon />
              </Button>
            )}
          </div>
          {!collapsed ? (
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="truncate text-sm font-semibold text-fg-primary">Actualizer</p>
              <p className="truncate text-xs text-fg-secondary">{tenantName}</p>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <SidebarNav collapsed={collapsed} setupIncomplete={setupIncomplete} />
          </div>
          <div className="border-t border-border-subtle p-3">
            <UserMenu userName={userName} userEmail={userEmail} initials={initials} compact={collapsed} />
          </div>
        </aside>

        <div className={cn("transition-[padding] duration-base motion-reduce:transition-none md:pl-[240px]", collapsed && "md:pl-[72px]")}>
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-bg-surface/80 px-4 backdrop-blur-md md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      className="md:hidden"
                      aria-label="Open navigation"
                    />
                  }
                >
                  <MenuIcon />
                </SheetTrigger>
                <SheetContent side="left" className="max-w-full p-0">
                  <SheetHeader className="h-14 border-b border-border-subtle px-4 py-3">
                    <SheetTitle>
                      <ActualizerMark />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="p-3">
              <SidebarNav
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
                setupIncomplete={setupIncomplete}
              />
                  </div>
                </SheetContent>
              </Sheet>
              <Breadcrumbs />
            </div>

            <div className="hidden flex-1 justify-center px-6 lg:flex">
              <CommandPalette />
            </div>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger render={<Button type="button" variant="tertiary" size="icon-sm" aria-label="Notifications" />}>
                  <BellIcon />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <p className="font-medium text-fg-primary">Notifications</p>
                  <p className="text-sm text-fg-tertiary">No new notifications.</p>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="tertiary" size="icon-sm" aria-label="Help" />}
                >
                  <CircleHelpIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>Help docs</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new Event("actualizer:open-shortcuts"))}
                  >
                    Keyboard shortcuts
                  </DropdownMenuItem>
                  <DropdownMenuItem>Contact support</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle />
              <UserMenu userName={userName} userEmail={userEmail} initials={initials} compact />
            </div>
          </header>

          <main id="dashboard-main" tabIndex={-1} className="p-4 md:p-6">
            {children}
          </main>
          <footer className="border-t border-border-subtle px-4 py-3 text-center text-xs text-fg-tertiary md:ml-0">
            Encrypted in transit and at rest · BAA signed with all subprocessors · HIPAA-compliant infrastructure
          </footer>
          <KeyboardShortcutsLayer />
        </div>
      </div>
    </TooltipProvider>
  );
}
