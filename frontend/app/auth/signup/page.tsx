"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRegister, apiMe, oauthLoginUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { playLoginChime } from "@/lib/chime";

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

type FieldErrors = Partial<{
  email: string;
  password: string;
  display: string;
  terms: string;
}>;

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [display, setDisplay] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitErr, setSubmitErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) e.email = "올바른 이메일 형식을 입력해 주세요.";
    if (password.length < 6) e.password = "비밀번호는 6자 이상이어야 합니다.";
    if (!display.trim()) e.display = "닉네임을 입력해 주세요.";
    if (!terms) e.terms = "이용약관과 개인정보 처리방침에 동의해 주세요.";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitErr("");
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const username = email.trim().toLowerCase();
      const res = await apiRegister({
        username,
        password,
        display: display.trim(),
        email: username,
        marketing_opt_in: marketing,
      });
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
        <div className="prism-auth-eyebrow">PRISM · Sign Up</div>
        <h1 className="prism-auth-title">새 계정 만들기</h1>
        <p className="prism-auth-subtitle">
          이메일 한 줄이면 충분합니다. 인증 메일은 보내지 않으니 부담 없이 시작하세요.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="prism-auth-field">
            <label className="prism-auth-label" htmlFor="signup-email">이메일</label>
            <div className="prism-auth-input-wrap">
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`prism-auth-input ${errors.email ? "prism-auth-input--invalid" : ""}`}
              />
            </div>
            {errors.email
              ? <div className="prism-auth-helper prism-auth-helper--error">{errors.email}</div>
              : <div className="prism-auth-helper">로그인 ID로 사용됩니다. 결제·구독 알림 채널.</div>}
          </div>

          <div className="prism-auth-field">
            <label className="prism-auth-label" htmlFor="signup-password">비밀번호</label>
            <div className="prism-auth-input-wrap">
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="6자 이상"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`prism-auth-input ${errors.password ? "prism-auth-input--invalid" : ""}`}
              />
            </div>
            {errors.password && <div className="prism-auth-helper prism-auth-helper--error">{errors.password}</div>}
          </div>

          <div className="prism-auth-field">
            <label className="prism-auth-label" htmlFor="signup-display">닉네임</label>
            <div className="prism-auth-input-wrap">
              <input
                id="signup-display"
                type="text"
                autoComplete="nickname"
                placeholder="화면에 표시될 이름"
                value={display}
                onChange={e => setDisplay(e.target.value)}
                maxLength={40}
                className={`prism-auth-input ${errors.display ? "prism-auth-input--invalid" : ""}`}
              />
            </div>
            {errors.display && <div className="prism-auth-helper prism-auth-helper--error">{errors.display}</div>}
          </div>

          <label className="prism-auth-checkbox-row">
            <input
              type="checkbox"
              checked={terms}
              onChange={e => setTerms(e.target.checked)}
            />
            <span>
              <strong style={{ color: "rgba(171,225,183,0.92)" }}>(필수)</strong>{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>
              {" 및 "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a>
              에 동의합니다.
            </span>
          </label>
          {errors.terms && (
            <div className="prism-auth-helper prism-auth-helper--error" style={{ marginTop: 4 }}>
              {errors.terms}
            </div>
          )}

          <label className="prism-auth-checkbox-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={marketing}
              onChange={e => setMarketing(e.target.checked)}
            />
            <span>
              <strong style={{ color: "rgba(220,232,222,0.55)" }}>(선택)</strong>{" "}
              업데이트·이벤트 등 마케팅 정보를 받겠습니다. 언제든 철회할 수 있습니다.
            </span>
          </label>

          {submitErr && <div className="prism-auth-form-error">{submitErr}</div>}

          <button type="submit" className="prism-auth-submit" disabled={submitting}>
            {submitting ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <div className="prism-auth-divider">또는</div>
        <button type="button" className="prism-auth-oauth" onClick={startKakao}>
          카카오로 계속하기
        </button>

        <div className="prism-auth-foot">
          이미 계정이 있나요?<Link href="/auth/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
