"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { isSeedRole } from "@/lib/admin-auth/domains";

const LABEL = { buyer: "người mua", seller: "seller" } as const;

export default function SeedLoginPage() {
  const params = useParams<{ role: string }>();
  const role = isSeedRole(params?.role) ? params.role : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!role) {
    return (
      <main className="login">
        <h1>Vai trò không hợp lệ</h1>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/seed-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.kind === "unavailable" ? "Không kết nối được Backend. Thử lại sau." : (data.error ?? "Đăng nhập thất bại"));
        return;
      }
      setPassword("");
      window.opener?.postMessage({ type: "SEED_AUTH_SUCCESS", role }, window.location.origin);
      window.close();
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <h1>Đăng nhập tài khoản {LABEL[role]}</h1>
      <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="btn" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        <p className="hint">Tài khoản thử để tạo đơn trên dev. Mật khẩu chỉ gửi tới server để đăng nhập, không lưu lại và không gửi cho bot.</p>
      </form>
      {error && <div className="error-box" role="alert">{error}</div>}
    </main>
  );
}
