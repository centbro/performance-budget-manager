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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  TrendingUp,
  Users,
  Wallet,
  ClipboardList,
  FolderOpen,
  ShieldCheck,
  CalendarDays,
  CalendarRange,
  FileText,
  Library,
  Wand2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "../App";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 400;

const currentYear = new Date().getFullYear();

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  // AuthContext에서 이미 캐시된 user를 가져옴 (추가 네트워크 요청 없음)
  const { user: localUser } = useAuthContext();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent
        setSidebarWidth={setSidebarWidth}
        localUser={localUser ?? null}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  localUser,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
  localUser: { id: number; name: string | null; email: string | null; role: string; status: string } | null;
}) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  // 큰 사업 목록 (parentId = NULL)
  const { data: parentProjects = [] } = trpc.projects.listParents.useQuery({ year: currentYear });

  // 관리자: 미승인 요청 수 (30초마다 자동 갱신)
  const { data: pendingData } = trpc.localAuth.adminPendingCount.useQuery(undefined, {
    enabled: localUser?.role === "admin",
    refetchInterval: 30_000,
  });
  const pendingCount = pendingData?.count ?? 0;

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

  const isActive = (path: string) => location === path;

  const handleLogout = async () => {
    await utils.client.localAuth.logout.mutate();
    await utils.localAuth.me.invalidate();
    setLocation("/login");
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <img src="/logo-icon.png" alt="" className="w-7 h-7 object-contain shrink-0" />
                  <span className="font-semibold text-sm tracking-tight text-sidebar-foreground truncate">
                    복지실무톡
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2 overflow-y-auto">
            {/* 메인 메뉴 */}
            <SidebarGroup>
              <SidebarMenu className="px-2 gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/")}
                    onClick={() => setLocation("/")}
                    tooltip="대시보드"
                    className="h-9"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>대시보드</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/projects")}
                    onClick={() => setLocation("/projects")}
                    tooltip="사업 관리"
                    className="h-9"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>사업 관리</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/global-schedule")}
                    onClick={() => setLocation("/global-schedule")}
                    tooltip="스케줄 관리"
                    className="h-9"
                  >
                    <CalendarRange className="h-4 w-4" />
                    <span>스케줄 관리</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/business-plans")}
                    onClick={() => setLocation("/business-plans")}
                    tooltip="사업계획서"
                    className="h-9"
                  >
                    <FileText className="h-4 w-4" />
                    <span>사업계획서</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/cases")}
                    onClick={() => setLocation("/cases")}
                    tooltip="배분사례집 검색"
                    className="h-9"
                  >
                    <Library className="h-4 w-4" />
                    <span>배분사례집 검색</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/tools")}
                    onClick={() => setLocation("/tools")}
                    tooltip="업무 도우미"
                    className="h-9"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>업무 도우미</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* 관리자 메뉴 */}
                {localUser?.role === "admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isActive("/admin")}
                      onClick={() => setLocation("/admin")}
                      tooltip="사용자 관리"
                      className="h-9"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>사용자 관리</span>
                      {pendingCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white leading-none">
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroup>

            {/* 큰 사업별 메뉴 */}
            {!isCollapsed && parentProjects.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-4 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                  사업별 관리
                </SidebarGroupLabel>
                <SidebarMenu className="px-2 gap-0">
                  {parentProjects.map((parent) => (
                    <ParentProjectMenu
                      key={parent.id}
                      parentId={parent.id}
                      parentName={parent.projectName}
                      location={location}
                      setLocation={setLocation}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-sidebar-primary/20 text-sidebar-primary">
                      {localUser?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-sidebar-foreground">
                        {localUser?.name ?? "-"}
                        {localUser?.role === "admin" && (
                          <span className="ml-1 text-[10px] text-primary font-semibold">(관리자)</span>
                        )}
                      </p>
                      <p className="text-xs text-sidebar-foreground/50 truncate">{localUser?.email ?? "-"}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {localUser?.role === "admin" && (
                  <>
                    <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      <span>사용자 관리</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
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
        {isMobile && (
          <div className="flex border-b h-14 items-center bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <SidebarTrigger className="h-9 w-9 rounded-lg" />
            <span className="ml-3 flex items-center gap-2 font-medium text-sm"><img src="/logo-icon.png" alt="" className="h-6 w-6 object-contain" />복지실무톡</span>
          </div>
        )}
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </>
  );
}

/** 큰 사업 메뉴 컴포넌트 - 세부 사업 목록을 동적으로 로드 */
function ParentProjectMenu({
  parentId,
  parentName,
  location,
  setLocation,
}: {
  parentId: number;
  parentName: string;
  location: string;
  setLocation: (path: string) => void;
}) {
  const { data: subProjects = [] } = trpc.projects.listSubs.useQuery({ parentId });

  return (
    <Collapsible defaultOpen={false}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className="h-9 justify-between group/collapsible"
            tooltip={parentName}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen className="h-3.5 w-3.5 text-sidebar-primary/70 shrink-0" />
              <span className="truncate text-sm font-medium">{parentName}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-sidebar-foreground/40 transition-transform group-data-[state=open]/collapsible:rotate-180 shrink-0" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-2 pl-3 border-l border-sidebar-border/50 mt-0.5 mb-1 space-y-0.5">
            {/* 대상자 관리 - 큰 사업에 귀속 */}
            <button
              onClick={() => setLocation(`/participants/${parentId}`)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                location === `/participants/${parentId}`
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Users className="h-3 w-3" />
              대상자 관리
            </button>
            {/* 예산 관리 - 큰 사업에 귀속 */}
            <button
              onClick={() => setLocation(`/budget/${parentId}`)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                location === `/budget/${parentId}`
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Wallet className="h-3 w-3" />
              예산 관리
            </button>
            {/* 일정표 - 큰 사업에 귀속 */}
            <button
              onClick={() => setLocation(`/schedule/${parentId}`)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                location === `/schedule/${parentId}`
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              일정표
            </button>
            {/* AI 평가서 - 큰 사업에 귀속 */}
            <button
              onClick={() => setLocation(`/evaluation/${parentId}`)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                location === `/evaluation/${parentId}`
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <ClipboardList className="h-3 w-3" />
              AI 평가서
            </button>

            {/* 세부 사업 목록 */}
            {subProjects.length > 0 && (
              <div className="pt-1">
                <p className="px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                  세부 사업
                </p>
                {subProjects.map((sub) => (
                  <SubProjectMenu
                    key={sub.id}
                    subId={sub.id}
                    subName={sub.projectName}
                    location={location}
                    setLocation={setLocation}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** 세부 사업 메뉴 컴포넌트 */
function SubProjectMenu({
  subId,
  subName,
  location,
  setLocation,
}: {
  subId: number;
  subName: string;
  location: string;
  setLocation: (path: string) => void;
}) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger asChild>
        <button
          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors group/sub ${
            location.startsWith(`/performance/${subId}`) || location.startsWith(`/performance-stats/${subId}`)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-1 h-1 rounded-full bg-sidebar-primary/50 shrink-0" />
            <span className="truncate">{subName}</span>
          </div>
          <ChevronDown className="h-2.5 w-2.5 text-sidebar-foreground/30 transition-transform group-data-[state=open]/sub:rotate-180 shrink-0" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 pl-2 border-l border-sidebar-border/30 mt-0.5 mb-0.5 space-y-0.5">
          <button
            onClick={() => setLocation(`/performance/${subId}`)}
            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-colors ${
              location === `/performance/${subId}`
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
            }`}
          >
            <TrendingUp className="h-2.5 w-2.5" />
            실적 입력
          </button>
          <button
            onClick={() => setLocation(`/performance-stats/${subId}`)}
            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-colors ${
              location === `/performance-stats/${subId}`
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
            }`}
          >
            <BarChart3 className="h-2.5 w-2.5" />
            실적 현황
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
