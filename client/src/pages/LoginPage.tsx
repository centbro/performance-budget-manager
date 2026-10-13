import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [showPw, setShowPw] = useState(false);
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      await utils.localAuth.me.invalidate();
      setLocation("/");
    },
    onError: (err) => {
      toast.error(err.message || "로그인에 실패했습니다.");
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 shadow-sm">
            <ClipboardList className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">실적·예산 관리 시스템</h1>
          <p className="text-sm text-muted-foreground mt-1">업무 실적과 예산을 효율적으로 관리하세요</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">로그인</CardTitle>
            <CardDescription>등록된 계정으로 로그인하세요</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  autoComplete="email"
                  {...register("email", {
                    required: "이메일을 입력해주세요.",
                    pattern: { value: /\S+@\S+\.\S+/, message: "올바른 이메일 형식이 아닙니다." },
                  })}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">비밀번호</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="비밀번호 입력"
                    autoComplete="current-password"
                    className="pr-10"
                    {...register("password", { required: "비밀번호를 입력해주세요." })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full" disabled={isSubmitting || loginMutation.isPending}>
                {(isSubmitting || loginMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                로그인
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                계정이 없으신가요?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/register")}
                  className="text-primary hover:underline font-medium"
                >
                  사용 요청하기
                </button>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
