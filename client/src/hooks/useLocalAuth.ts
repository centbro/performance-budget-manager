import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export function useLocalAuth() {
  const { data: user, isLoading, refetch } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const loginMutation = trpc.localAuth.login.useMutation();
  const logoutMutation = trpc.localAuth.logout.useMutation();
  const [, setLocation] = useLocation();

  const login = async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync({ email, password });
    await refetch();
    return result;
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    await refetch();
    setLocation("/login");
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isPending: user?.status === "pending",
    isApproved: user?.status === "approved",
    login,
    logout,
    refetch,
  };
}
