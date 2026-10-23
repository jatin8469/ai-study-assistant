import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, MessageSquareText, Library, NotebookPen, ListChecks, History, Settings, GraduationCap, Bell, LogOut, LogIn, UserPlus,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/firebase-client";
import { toast } from "sonner";

export const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "AI Tutor", url: "/tutor", icon: MessageSquareText },
  { title: "My Library", url: "/library", icon: Library },
  { title: "AI Notes", url: "/notes", icon: NotebookPen },
  { title: "Practice Quiz", url: "/quiz", icon: ListChecks },
  { title: "Study History", url: "/history", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1 py-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground">
        <GraduationCap className="h-4.5 w-4.5" />
      </span>
      <span className="truncate font-display text-[15px] font-bold group-data-[collapsible=icon]:hidden">
        StudyMate <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { displayName, email, initials, isAnonymous, studentMeta, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      await navigate({ to: "/signin" });
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border py-3">
        <Brand />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title} className="h-9 font-medium">
                    <Link to={item.url} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary-soft text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {isAnonymous ? "Guest Study Session" : studentMeta.branch}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />Settings
              </Link>
            </DropdownMenuItem>
            {isAnonymous ? (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/signin">
                    <LogIn className="mr-2 h-4 w-4" />Sign in with email
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/signup">
                    <UserPlus className="mr-2 h-4 w-4" />Create account
                  </Link>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => void handleSignOut()}>
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
            <SidebarTrigger aria-label="Toggle navigation" />
            <h1 className="truncate text-base font-semibold">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
              {actions}
              <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function SectionCard({ title, description, action, children, className = "" }: {
  title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card p-5 shadow-card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status, progress }: { status: "ready" | "processing" | "failed"; progress?: number | undefined }) {
  const map = {
    ready: "bg-success-soft text-success",
    processing: "bg-warning-soft text-warning",
    failed: "bg-destructive/10 text-destructive",
  } as const;
  const label = status === "ready" ? "Ready" : status === "processing" ? `Processing${progress ? ` ${progress}%` : ""}` : "Failed";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>{label}</span>;
}

export function DemoNote() {
  return (
    <p className="mt-8 text-center text-xs text-muted-foreground">
      Powered by Firebase Auth, Cloud Firestore &amp; Google Gemini 2.5 Flash — all documents, notes, chats, and quizzes sync securely to your account.
    </p>
  );
}
