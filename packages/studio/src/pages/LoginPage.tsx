import { useState, type FormEvent } from "react";
import type { AuthState } from "../hooks/use-auth";
import { DEFAULT_ANDROID_API_BASE_URL, setApiBaseUrl } from "../lib/api-base";

interface LoginPageProps {
  readonly auth: AuthState;
}

type LoginLang = "zh" | "en";

const loginCopy = {
  zh: {
    subtitleLogin: "登录到你的写作工作区",
    subtitleRegister: "创建新账号",
    username: "用户名",
    password: "密码",
    invite: "邀请码（首位用户可留空）",
    required: "用户名和密码不能为空",
    submitting: "处理中...",
    login: "登录",
    register: "注册",
    toRegister: "没有账号？去注册",
    toLogin: "已有账号？去登录",
  },
  en: {
    subtitleLogin: "Sign in to your writing workspace",
    subtitleRegister: "Create a new account",
    username: "Username",
    password: "Password",
    invite: "Invite code (optional for the first user)",
    required: "Username and password are required",
    submitting: "Working...",
    login: "Sign in",
    register: "Register",
    toRegister: "No account? Register",
    toLogin: "Already have an account? Sign in",
  },
} as const;

function defaultLoginLang(): LoginLang {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("en")) {
    return "en";
  }
  return "zh";
}

export function LoginPage({ auth }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [lang, setLang] = useState<LoginLang>(defaultLoginLang);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const copy = loginCopy[lang];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!username.trim() || !password) {
      setLocalError(copy.required);
      return;
    }

    setApiBaseUrl(DEFAULT_ANDROID_API_BASE_URL);

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
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
              <button
                type="button"
                onClick={() => setLang("zh")}
                className={`rounded px-2 py-1 text-xs ${lang === "zh" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded px-2 py-1 text-xs ${lang === "en" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                EN
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">InkOS Studio</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? copy.subtitleLogin : copy.subtitleRegister}
            </p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="username">
              {copy.username}
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
              {copy.password}
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
                {copy.invite}
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
            {submitting ? copy.submitting : mode === "login" ? copy.login : copy.register}
          </button>
        </form>
        <div className="text-center text-xs text-muted-foreground">
          {mode === "login" ? (
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setMode("register")}
            >
              {copy.toRegister}
            </button>
          ) : (
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setMode("login")}
            >
              {copy.toLogin}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
