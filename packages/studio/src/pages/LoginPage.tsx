import { useState, type FormEvent } from "react";
import type { AuthState } from "../hooks/use-auth";

interface LoginPageProps {
  readonly auth: AuthState;
}

export function LoginPage({ auth }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!username.trim() || !password) {
      setLocalError("用户名和密码不能为空");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await auth.login(username.trim(), password);
      } else {
        await auth.register(username.trim(), password, invite.trim() || undefined);
      }
    } catch {
      // error already surfaced via auth.error
    } finally {
      setSubmitting(false);
    }
  }

  const errorMessage = localError ?? auth.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">InkOS Studio</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "登录到你的工作区" : "创建新账号"}
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="username">
              用户名
            </label>
            <input
              id="username"
              autoComplete="username"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="invite">
                邀请码 (首位用户可留空)
              </label>
              <input
                id="invite"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}
          {errorMessage && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>
        <div className="text-center text-xs text-muted-foreground">
          {mode === "login" ? (
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setMode("register")}
            >
              没有账号?去注册
            </button>
          ) : (
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setMode("login")}
            >
              已有账号?去登录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
