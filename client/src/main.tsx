import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5분간 캐시 유지 - 포커스 복귀/탭 전환 시 불필요한 재요청 방지
      staleTime: 5 * 60 * 1000,
      // 포커스 복귀 시 자동 재요청 비활성화 (깜빡임 방지)
      refetchOnWindowFocus: false,
      // 마운트 시 자동 재요청 비활성화 (이미 캐시된 경우)
      refetchOnMount: false,
      // 네트워크 재연결 시 자동 재요청 비활성화
      refetchOnReconnect: false,
      // 실패 시 재시도 1회만
      retry: 1,
    },
  },
});

const PLAN_BLOCK_PREFIX = "[이용제한] ";
/** 요금제·기간·월 한도로 AI가 막혔을 때 안내 토스트(같은 안내는 하나만) */
const notifyPlanBlock = (error: unknown) => {
  if (error instanceof TRPCClientError && error.message.startsWith(PLAN_BLOCK_PREFIX)) {
    toast.error(error.message.slice(PLAN_BLOCK_PREFIX.length), { id: "plan-block", duration: 8000 });
  }
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // 자체 인증 기반 - /login 페이지로 이동 (OAuth 대신)
  if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
    window.location.href = "/login";
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    notifyPlanBlock(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
