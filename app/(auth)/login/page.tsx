"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Неверный email или пароль. Возможно, доступ отозван.");
      return;
    }

    // Получаем сессию и редиректим по роли
    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();
    const role = session?.user?.role;

    if (role === "admin") router.push("/admin/projects");
    else if (role === "responsible") router.push("/responsible/projects");
    else if (role === "executor") router.push("/me");
    else router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-1 text-center">
          <div className="text-3xl font-bold text-neutral-800 mb-1">КПД</div>
          <CardTitle className="text-xl font-semibold">Вход в систему</CardTitle>
          <p className="text-sm text-neutral-500">Система управления проектами</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Button>
          </form>
          <div className="mt-6 text-xs text-neutral-400 space-y-1">
            <p className="font-medium text-neutral-500">Тестовый аккаунт (Phase 0):</p>
            <p>admin@kpd.local / Password123!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
