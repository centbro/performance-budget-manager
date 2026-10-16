import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>();

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: () => {
      setDone(true);
    },
    onError: (err) => {
      toast.error(err.message || "가입 요청에 실패했습니다.");
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate({
      name: data.name,
      email: data.email,
      password: data.password,
    });
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-lg border-border/50 text-center">
            <CardContent className="pt-10 pb-8 px-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">사용 요청 완료</h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                가입 요청이 접수되었습니다.<br />
                관리자 승인 후 로그인하실 수 있습니다.<br />
                승인까지 잠시 기다려 주세요.
              </p>
              <Button onClick={() => setLocation("/login")} className="w-full">
                로그인 페이지로 이동
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-icon.png" alt="복지실무톡" className="h-20 w-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">사용 요청</h1>
          <p className="text-sm text-muted-foreground mt-1">관리자 승인 후 서비스를 이용할 수 있습니다</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">계정 등록 요청</CardTitle>
            <CardDescription>아이디(이메일)와 비밀번호를 설정해 주세요</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  placeholder="홍길동"
                  autoComplete="name"
                  {...register("name", { required: "이름을 입력해주세요." })}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">이메일 (아이디)</Label>
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
                    placeholder="4자 이상 입력"
                    autoComplete="new-password"
                    className="pr-10"
                    {...register("password", {
                      required: "비밀번호를 입력해주세요.",
                      minLength: { value: 4, message: "비밀번호는 4자 이상이어야 합니다." },
                    })}
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

              <div className="space-y-1.5">
                <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
                <Input
                  id="passwordConfirm"
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호 재입력"
                  autoComplete="new-password"
                  {...register("passwordConfirm", {
                    required: "비밀번호 확인을 입력해주세요.",
                    validate: (v) => v === watch("password") || "비밀번호가 일치하지 않습니다.",
                  })}
                />
                {errors.passwordConfirm && (
                  <p className="text-xs text-destructive">{errors.passwordConfirm.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full" disabled={isSubmitting || registerMutation.isPending}>
                {(isSubmitting || registerMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                사용 요청하기
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                이미 계정이 있으신가요?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-primary hover:underline font-medium"
                >
                  로그인
                </button>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
