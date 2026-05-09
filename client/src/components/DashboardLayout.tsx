import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
// OAuth removido — login próprio em /login
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  LogOut,
  PanelLeft,
  Scissors,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const adminMenuItems = [
  { icon: CalendarDays, label: "Agenda", path: "/" },
  { icon: BarChart3, label: "Dashboard Financeiro", path: "/dashboard" },
  { icon: Users, label: "Profissionais", path: "/professionals" },
  { icon: Scissors, label: "Serviços", path: "/services" },
  { icon: Sparkles, label: "Comissões", path: "/commissions" },
  { icon: Bell, label: "Lembretes", path: "/reminders" },
];

const professionalMenuItems = [
  { icon: CalendarDays, label: "Agenda", path: "/" },
];

const SIDEBAR_WIDTH_KEY = "salon-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  // Todos os hooks devem vir antes de qualquer return condicional
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Redirecionar para /login se não autenticado
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [loading, user]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const menuItems = isAdmin ? adminMenuItems : professionalMenuItems;
  const activeMenuItem = menuItems.find((item) => item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-2">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors focus:outline-none shrink-0"
                style={{ color: "oklch(0.68 0.085 25)" }}
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src="/kblos-logo.jpeg"
                    alt="Marta Kblo's"
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-serif text-sidebar-foreground text-base leading-tight">
                      Marta Kblo's
                    </span>
                    <span className="text-[10px] tracking-[0.2em] uppercase"
                      style={{ color: "oklch(0.68 0.085 25)" }}>
                      Gestão
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 py-4">
            {!isCollapsed && (
              <p className="text-[10px] uppercase tracking-[0.2em] px-4 mb-2"
                style={{ color: "oklch(0.68 0.085 25 / 0.7)" }}>
                Menu
              </p>
            )}
            <SidebarMenu className="px-2">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal rounded-lg"
                      style={isActive ? {
                        background: "oklch(0.68 0.085 25 / 0.15)",
                        color: "oklch(0.68 0.085 25)",
                      } : {}}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="font-light tracking-wide">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0" style={{ border: "1px solid oklch(0.68 0.085 25 / 0.4)" }}>
                    <AvatarFallback className="text-xs font-medium"
                      style={{ background: "oklch(0.68 0.085 25 / 0.15)", color: "oklch(0.68 0.085 25)" }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                        {user?.name || "Usuário"}
                      </p>
                      <p className="text-xs truncate mt-1" style={{ color: "oklch(0.68 0.085 25)" }}>
                        {isAdmin ? "Administrador" : "Profissional"}
                      </p>
                    </div>
                  )}
                  {!isCollapsed && <ChevronDown className="h-3 w-3 text-sidebar-foreground/40 shrink-0" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Mobile header */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-serif text-lg">{activeMenuItem?.label ?? "Marta Kblo's"}</span>
            </div>
            {isAdmin && (
              <Badge variant="outline" className="text-[10px] tracking-wide" style={{ color: "oklch(0.58 0.09 25)", borderColor: "oklch(0.58 0.09 25 / 0.3)" }}>
                Admin
              </Badge>
            )}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
