"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiLogin, apiMe, oauthLoginUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { playLoginChime } from "@/lib/chime";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitErr("");
    if (!email.trim() || !password) {
      setSubmitErr("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiLogin(email.trim().toLowerCase(), password);
      setAuth(res.access_token, res.username, res.display, res.plan);
      const me = await apiMe().catch(() => null);
      if (me) setAuth(res.access_token, me.username, me.display, me.plan);
      playLoginChime();
      router.push("/");
    } catch (err) {
      setSubmitErr((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const startKakao = () => {
    window.location.href = oauthLoginUrl("kakao", "/");
  };

  return (
    <div className="prism-auth-shell">
      <div className="prism-auth-card">
        <div className="prism-auth-eyebrow">PRISM · Sign In</div>
        <h1 className="prism-auth-title">다시 오신 걸 환영합니다</h1>
        <p className="prism-auth-subtitle">
          이메일과 비밀번호로 로그인하세요. 카카오로 가입했다면 아래 카카오 버튼을 사용하세요.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="prism-auth-field">
            <label className="prism-auth-label" htmlFor="login-email">이메일</label>
            <div className="prism-auth-input-wrap">
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="prism-auth-input"
              />
            </div>
          </div>

          <div className="prism-auth-field">
            <label className="prism-auth-label" htmlFor="login-password">비밀번호</label>
            <div className="prism-auth-input-wrap">
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="prism-auth-input"
              />
            </div>
          </div>

          {submitErr && <div className="prism-auth-form-error">{submitErr}</div>}

          <button type="submit" className="prism-auth-submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="prism-auth-divider">또는</div>
        <button type="button" className="prism-auth-oauth" onClick={startKakao}>
          카카오로 계속하기
        </button>

        <div className="prism-auth-foot">
          아직 계정이 없나요?<Link href="/auth/signup">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
