import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { AuthUser } from "../hooks/use-auth";

interface InviteRecord {
  readonly code: string;
  readonly createdBy: string;
  readonly role: "admin" | "user";
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly usedBy?: string;
  readonly usedAt?: string;
}

interface OwnerSummary {
  readonly userId: string;
  readonly username: string;
  readonly books: ReadonlyArray<string>;
}

interface AdminPanelProps {
  readonly currentUser: AuthUser;
}

export function AdminPanel({ currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<ReadonlyArray<AuthUser>>([]);
  const [invites, setInvites] = useState<ReadonlyArray<InviteRecord>>([]);
  const [owners, setOwners] = useState<ReadonlyArray<OwnerSummary>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [u, i, b] = await Promise.all([
        fetchJson<{ users: ReadonlyArray<AuthUser> }>("/admin/users"),
        fetchJson<{ invites: ReadonlyArray<InviteRecord> }>("/admin/invites"),
        fetchJson<{ owners: ReadonlyArray<OwnerSummary> }>("/admin/books"),
      ]);
      setUsers(u.users);
      setInvites(i.invites);
      setOwners(b.owners);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guarded = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">用户管理</h1>
        <p className="text-sm text-muted-foreground">
          管理员: {currentUser.username}
        </p>
      </header>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <UsersSection
        users={users}
        currentUserId={currentUser.id}
        busy={busy}
        guarded={guarded}
      />

      <InvitesSection invites={invites} busy={busy} guarded={guarded} />

      <BooksSection owners={owners} users={users} busy={busy} guarded={guarded} />
    </div>
  );
}

function UsersSection({
  users,
  currentUserId,
  busy,
  guarded,
}: {
  readonly users: ReadonlyArray<AuthUser>;
  readonly currentUserId: string;
  readonly busy: boolean;
  readonly guarded: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">用户</h2>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">用户名</th>
              <th className="px-3 py-2 text-left">角色</th>
              <th className="px-3 py-2 text-left">创建于</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={u.role}
                    disabled={busy || u.id === currentUserId}
                    onChange={(e) =>
                      guarded(() =>
                        fetchJson(`/admin/users/${u.id}/role`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ role: e.target.value }),
                        }),
                      )
                    }
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    className="text-xs underline disabled:opacity-50"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt(`为 ${u.username} 设置新密码 (至少 6 位)`);
                      if (!next) return;
                      void guarded(() =>
                        fetchJson(`/admin/users/${u.id}/password`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ password: next }),
                        }),
                      );
                    }}
                  >
                    改密
                  </button>
                  <button
                    className="text-xs text-destructive underline disabled:opacity-50"
                    disabled={busy || u.id === currentUserId}
                    onClick={() => {
                      if (!window.confirm(`删除用户 ${u.username}?其数据会被归档。`)) return;
                      void guarded(() =>
                        fetchJson(`/admin/users/${u.id}`, { method: "DELETE" }),
                      );
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <h3 className="text-sm font-semibold">直接创建用户</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="用户名"
            className="rounded border bg-background px-2 py-1 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="密码"
            className="rounded border bg-background px-2 py-1 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            disabled={busy || !username || !password}
            onClick={() => {
              void guarded(async () => {
                await fetchJson("/admin/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username, password, role }),
                });
                setUsername("");
                setPassword("");
                setRole("user");
              });
            }}
          >
            创建
          </button>
        </div>
      </div>
    </section>
  );
}

function InvitesSection({
  invites,
  busy,
  guarded,
}: {
  readonly invites: ReadonlyArray<InviteRecord>;
  readonly busy: boolean;
  readonly guarded: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [role, setRole] = useState<"admin" | "user">("user");
  const [ttlHours, setTtlHours] = useState(168);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">邀请码</h2>
      <div className="rounded-md border p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <input
            type="number"
            className="rounded border bg-background px-2 py-1 text-sm"
            value={ttlHours}
            onChange={(e) => setTtlHours(parseInt(e.target.value, 10) || 1)}
            placeholder="有效期(小时)"
          />
          <button
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              void guarded(() =>
                fetchJson("/admin/invites", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ role, ttlHours }),
                }),
              );
            }}
          >
            生成邀请码
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">邀请码</th>
              <th className="px-3 py-2 text-left">角色</th>
              <th className="px-3 py-2 text-left">过期</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.code} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{inv.code}</td>
                <td className="px-3 py-2">{inv.role}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(inv.expiresAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">
                  {inv.usedBy ? `已被 ${inv.usedBy} 使用` : "未使用"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="text-xs text-destructive underline disabled:opacity-50"
                    disabled={busy}
                    onClick={() =>
                      guarded(() =>
                        fetchJson(`/admin/invites/${encodeURIComponent(inv.code)}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    撤销
                  </button>
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-xs text-muted-foreground" colSpan={5}>
                  暂无邀请码
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BooksSection({
  owners,
  users,
  busy,
  guarded,
}: {
  readonly owners: ReadonlyArray<OwnerSummary>;
  readonly users: ReadonlyArray<AuthUser>;
  readonly busy: boolean;
  readonly guarded: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">小说归属与转移</h2>
      <div className="space-y-3">
        {owners.map((owner) => (
          <div key={owner.userId} className="rounded-md border p-4 space-y-2">
            <div className="text-sm font-semibold">
              {owner.username}{" "}
              <span className="text-xs text-muted-foreground">({owner.books.length} 本)</span>
            </div>
            {owner.books.length === 0 ? (
              <div className="text-xs text-muted-foreground">无</div>
            ) : (
              <ul className="space-y-1">
                {owner.books.map((bookId) => (
                  <li key={bookId} className="flex items-center gap-2">
                    <span className="font-mono text-xs">{bookId}</span>
                    <select
                      className="rounded border bg-background px-2 py-1 text-xs"
                      defaultValue=""
                      disabled={busy}
                      onChange={(e) => {
                        const target = e.target.value;
                        e.target.value = "";
                        if (!target) return;
                        if (
                          !window.confirm(
                            `把 ${bookId} 从 ${owner.username} 转给 ${target}?`,
                          )
                        )
                          return;
                        void guarded(() =>
                          fetchJson(
                            `/admin/books/${owner.userId}/${encodeURIComponent(bookId)}/transfer`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ targetUserId: target }),
                            },
                          ),
                        );
                      }}
                    >
                      <option value="">转给...</option>
                      {users
                        .filter((u) => u.id !== owner.userId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
