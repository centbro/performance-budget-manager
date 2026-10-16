import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ProjectsPage from "./pages/ProjectsPage";
import ParticipantsPage from "./pages/ParticipantsPage";
import PerformancePage from "./pages/PerformancePage";
import PerformanceStatsPage from "./pages/PerformanceStatsPage";
import BudgetPage from "./pages/BudgetPage";
import EvaluationPage from "./pages/EvaluationPage";
import BusinessPlanPage from "./pages/BusinessPlanPage";
import CaseSearchPage from "./pages/CaseSearchPage";
import BusinessPlanDetailPage from "./pages/BusinessPlanDetailPage";
import SchedulePage from "./pages/SchedulePage";
import GlobalSchedulePage from "./pages/GlobalSchedulePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPage from "./pages/AdminPage";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { createContext, useContext, useEffect } from "react";

// ─── 전역 인증 Context ───────────────────────────────────────────────────────
type LocalUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
};

type AuthContextType = {
  user: LocalUser | null | undefined;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: undefined, isLoading: true });

export function useAuthContext() {
  return useContext(AuthContext);
}

/** 앱 전체에서 인증 쿼리를 한 번만 실행하는 Provider */
function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    // staleTime은 QueryClient 기본값(5분) 사용
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── 인증 가드 ────────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  // 초기 로딩 중 - 전체 화면 스피너 (한 번만 표시)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  // 승인 대기 중
  if (user.status === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">승인 대기 중</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            <strong>{user.name}</strong>님의 가입 요청이 접수되었습니다.<br />
            관리자 승인 후 서비스를 이용하실 수 있습니다.<br />
            잠시 기다려 주세요.
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  // 거부된 계정
  if (user.status === "rejected") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-red-500">✕</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">가입이 거부되었습니다</h2>
          <p className="text-sm text-muted-foreground mb-6">
            관리자에게 문의하세요.
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function LogoutButton() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const logoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: async () => {
      await utils.localAuth.me.invalidate();
      setLocation("/login");
    },
  });
  return (
    <button
      onClick={() => logoutMutation.mutate()}
      className="text-sm text-muted-foreground hover:text-foreground underline"
    >
      로그아웃
    </button>
  );
}

// ─── 라우터 ───────────────────────────────────────────────────────────────────
function AppRouter() {
  const { user, isLoading } = useAuthContext();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // 이미 로그인된 상태에서 로그인/회원가입 페이지 접근 시 홈으로 리다이렉트
    if (!isLoading && user && user.status === "approved") {
      if (location === "/login" || location === "/register") {
        setLocation("/");
      }
    }
  }, [isLoading, user, location, setLocation]);

  return (
    <Switch>
      {/* 공개 라우트 */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* 인증 필요 라우트 - AuthGuard는 Context에서 이미 캐시된 user를 읽으므로 깜빡임 없음 */}
      <Route path="/admin">
        <AuthGuard>
          <DashboardLayout>
            <AdminPage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/">
        <AuthGuard>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/projects">
        <AuthGuard>
          <DashboardLayout>
            <ProjectsPage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/participants/:projectId">
        <AuthGuard>
          <DashboardLayout>
            <ParticipantsPage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/performance/:projectId">
        <AuthGuard>
          <DashboardLayout>
            <PerformancePage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/performance-stats/:projectId">
        <AuthGuard>
          <DashboardLayout>
            <PerformanceStatsPage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/budget/:projectId">
        <AuthGuard>
          <DashboardLayout>
            <BudgetPage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/business-plans">
        <AuthGuard>
          <BusinessPlanPage />
        </AuthGuard>
      </Route>
      <Route path="/cases">
        <AuthGuard>
          <CaseSearchPage />
        </AuthGuard>
      </Route>
      <Route path="/business-plans/:id">
        <AuthGuard>
          <BusinessPlanDetailPage />
        </AuthGuard>
      </Route>
      <Route path="/evaluation/:projectId">
        <AuthGuard>
          <DashboardLayout>
            <EvaluationPage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/schedule/:projectId">
        <AuthGuard>
          <DashboardLayout>
            <SchedulePage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/global-schedule">
        <AuthGuard>
          <DashboardLayout>
            <GlobalSchedulePage />
          </DashboardLayout>
        </AuthGuard>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// ─── 앱 루트 ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
