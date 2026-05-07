import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Scissors } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/");
    },
  });

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (values: LoginValues) => {
    loginMutation.mutate(values);
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        background: "linear-gradient(135deg, oklch(0.14 0.01 60) 0%, oklch(0.22 0.015 30) 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-8 p-10 max-w-sm w-full mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/kblos-logo.jpeg"
            alt="Marta Kblo's"
            className="w-24 h-24 rounded-full object-cover"
            style={{ border: "2px solid oklch(0.68 0.085 25 / 0.5)" }}
          />
          <div className="text-center">
            <h1 className="text-3xl font-serif text-white tracking-wide">Marta Kblo's</h1>
            <p
              className="text-xs tracking-[0.25em] uppercase mt-1"
              style={{ color: "oklch(0.68 0.085 25)" }}
            >
              Gestão de Salão
            </p>
          </div>
        </div>

        <div className="w-full h-px" style={{ background: "oklch(0.68 0.085 25 / 0.2)" }} />

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 text-sm">Usuário</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Digite seu usuário"
                      autoComplete="username"
                      className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[oklch(0.68_0.085_25)] focus:ring-[oklch(0.68_0.085_25)]"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 text-sm">Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        autoComplete="current-password"
                        className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[oklch(0.68_0.085_25)] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            {loginMutation.error && (
              <p className="text-red-400 text-sm text-center">
                {loginMutation.error.message}
              </p>
            )}

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-11 text-sm font-medium tracking-wide mt-2"
              style={{
                background: "oklch(0.68 0.085 25)",
                color: "oklch(0.14 0.01 60)",
              }}
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
