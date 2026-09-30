"use client";

import { useState } from "react";

type Step = "credentials" | "community-otp";

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [ecommerceOk, setEcommerceOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    window.opener?.postMessage({ type: "ADMIN_AUTH_SUCCESS" }, window.location.origin);
    window.close();
  };

  const fail = (data: { error?: string; kind?: string }) =>
    setError(data.kind === "unavailable" ? "Không kết nối được Backend. Thử lại sau." : (data.error ?? "Đăng nhập thất bại"));

  const login = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/admin-auth/login", { email, password });
      if (!ok) return fail(data);
      setEcommerceOk(true);
      setPassword("");
      finish();
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/admin-auth/community-otp", { email, password });
      if (!ok) return fail(data);
      setPassword("");
      setStep("community-otp");
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const communityLogin = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/admin-auth/community-login", { email, password });
      if (!ok) return fail(data);
      setPassword("");
      finish();
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/admin-auth/community-verify", { code });
      if (!ok) return fail(data);
      finish();
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <h1>Kết nối Admin</h1>
      {step === "credentials" ? (
        <form onSubmit={communityLogin}>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button className="btn" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập (Community)"}</button>
          <button type="button" className="btn btn-secondary" disabled={busy || !email || !password} onClick={requestOtp}>
            Đăng nhập bằng OTP (CMS)
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || !email || !password} onClick={login}>
            Đăng nhập Ecommerce
          </button>
          <p className="hint">Staging: đăng nhập Community không cần OTP. Nút OTP dành cho tài khoản CMS bắt buộc mã SMS. Mật khẩu chỉ được gửi tới server, không lưu lại.</p>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <p>Đã gửi OTP tới số điện thoại của tài khoản Admin.</p>
          <label>Mã OTP<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required /></label>
          <button className="btn" disabled={busy}>{busy ? "Đang xác thực…" : "Xác nhận OTP"}</button>
        </form>
      )}
      {ecommerceOk && <p>Đã kết nối.</p>}
      {error && <div className="error-box" role="alert">{error}</div>}
    </main>
  );
}
