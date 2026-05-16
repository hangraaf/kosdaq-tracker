"use client";

import { useEffect, useState } from "react";
import { apiLogin, apiRegister, apiMe, oauthLoginUrl } from "@/lib/api";
import { useAuthStore, useAuthModalStore } from "@/lib/store";
import { playLoginChime } from "@/lib/chime";

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

type SignupFieldErrors = Partial<{
  email: string;
  password: string;
  display: string;
  terms: string;
}>;

export default function AuthModal() {
  const { open, mode, setMode, close } = useAuthModalStore();
  const { setAuth } = useAuthStore();

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // signup state
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [display, setDisplay] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errs, setErrs] = useState<SignupFieldErrors>({});
  const [signupErr, setSignupErr] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  if (!open) return null;

  const handleLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setLoginErr("");
    if (!loginEmail.trim() || !loginPw) {
      setLoginErr("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setLoginBusy(true);
    try {
      const res = await apiLogin(loginEmail.trim().toLowerCase(), loginPw);
      setAuth(res.access_token, res.username, res.display, res.plan);
      const me = await apiMe().catch(() => null);
      if (me) setAuth(res.access_token, me.username, me.display, me.plan);
      playLoginChime();
      close();
    } catch (err) {
      setLoginErr((err as Error).message);
    } finally {
      setLoginBusy(false);
    }
  };

  const validateSignup = (): SignupFieldErrors => {
    const e: SignupFieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) e.email = "올바른 이메일 형식을 입력해 주세요.";
    if (pw.length < 6) e.password = "비밀번호는 6자 이상이어야 합니다.";
    if (!display.trim()) e.display = "닉네임을 입력해 주세요.";
    if (!terms) e.terms = "이용약관과 개인정보 처리방침에 동의해 주세요.";
    return e;
  };

  const handleSignup = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSignupErr("");
    const v = validateSignup();
    setErrs(v);
    if (Object.keys(v).length > 0) return;
    setSignupBusy(true);
    try {
      const username = email.trim().toLowerCase();
      const res = await apiRegister({
        username,
        password: pw,
        display: display.trim(),
        email: username,
        marketing_opt_in: marketing,
      });
      setAuth(res.access_token, res.username, res.display, res.plan);
      const me = await apiMe().catch(() => null);
      if (me) setAuth(res.access_token, me.username, me.display, me.plan);
      playLoginChime();
      close();
    } catch (err) {
      setSignupErr((err as Error).message);
    } finally {
      setSignupBusy(false);
    }
  };

  const startKakao = () => {
    window.location.href = oauthLoginUrl("kakao", "/");
  };

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <div
      className="psl-authmodal-backdrop"
      onMouseDown={onBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "로그인" : "회원가입"}
    >
      <div className="psl-authmodal-card">
        <button
          type="button"
          className="psl-authmodal-close"
          aria-label="닫기"
          onClick={close}
        >
          ×
        </button>

        <div className="psl-authmodal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`psl-authmodal-tab${mode === "login" ? " is-active" : ""}`}
            onClick={() => setMode("login")}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`psl-authmodal-tab${mode === "signup" ? " is-active" : ""}`}
            onClick={() => setMode("signup")}
          >
            회원가입
          </button>
        </div>

        {mode === "login" ? (
          <>
            <h2 className="psl-authmodal-title">다시 오신 걸 환영합니다</h2>
            <p className="psl-authmodal-sub">
              이메일과 비밀번호로 로그인하세요. 카카오 가입자는 아래 버튼을 사용하세요.
            </p>

            <form onSubmit={handleLogin} noValidate>
              <div className="psl-authmodal-field">
                <label className="psl-authmodal-label" htmlFor="psl-login-email">이메일</label>
                <input
                  id="psl-login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="psl-authmodal-input"
                />
              </div>

              <div className="psl-authmodal-field">
                <label className="psl-authmodal-label" htmlFor="psl-login-pw">비밀번호</label>
                <input
                  id="psl-login-pw"
                  type="password"
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  className="psl-authmodal-input"
                />
              </div>

              {loginErr && <div className="psl-authmodal-error">{loginErr}</div>}

              <button type="submit" className="psl-authmodal-submit" disabled={loginBusy}>
                {loginBusy ? "로그인 중..." : "로그인"}
              </button>
            </form>

            <div className="psl-authmodal-divider"><span>또는</span></div>
            <button type="button" className="psl-authmodal-oauth" onClick={startKakao}>
              카카오로 계속하기
            </button>

            <div className="psl-authmodal-foot">
              아직 계정이 없나요?
              <button type="button" className="psl-authmodal-link" onClick={() => setMode("signup")}>
                회원가입
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="psl-authmodal-title">새 계정 만들기</h2>
            <p className="psl-authmodal-sub">
              이메일 한 줄이면 충분합니다. 인증 메일은 보내지 않으니 부담 없이 시작하세요.
            </p>

            <form onSubmit={handleSignup} noValidate>
              <div className="psl-authmodal-field">
                <label className="psl-authmodal-label" htmlFor="psl-su-email">이메일</label>
                <input
                  id="psl-su-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`psl-authmodal-input${errs.email ? " is-invalid" : ""}`}
                />
                {errs.email
                  ? <div className="psl-authmodal-helper is-error">{errs.email}</div>
                  : <div className="psl-authmodal-helper">로그인 ID로 사용됩니다. 결제·구독 알림 채널.</div>}
              </div>

              <div className="psl-authmodal-field">
                <label className="psl-authmodal-label" htmlFor="psl-su-pw">비밀번호</label>
                <input
                  id="psl-su-pw"
                  type="password"
                  autoComplete="new-password"
                  placeholder="6자 이상"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className={`psl-authmodal-input${errs.password ? " is-invalid" : ""}`}
                />
                {errs.password && <div className="psl-authmodal-helper is-error">{errs.password}</div>}
              </div>

              <div className="psl-authmodal-field">
                <label className="psl-authmodal-label" htmlFor="psl-su-display">닉네임</label>
                <input
                  id="psl-su-display"
                  type="text"
                  autoComplete="nickname"
                  placeholder="화면에 표시될 이름"
                  value={display}
                  onChange={(e) => setDisplay(e.target.value)}
                  maxLength={40}
                  className={`psl-authmodal-input${errs.display ? " is-invalid" : ""}`}
                />
                {errs.display && <div className="psl-authmodal-helper is-error">{errs.display}</div>}
              </div>

              <label className="psl-authmodal-check">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span>
                  <strong className="psl-authmodal-req">(필수)</strong>{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>
                  {" 및 "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a>
                  에 동의합니다.
                </span>
              </label>
              {errs.terms && <div className="psl-authmodal-helper is-error">{errs.terms}</div>}

              <label className="psl-authmodal-check">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                />
                <span>
                  <strong className="psl-authmodal-opt">(선택)</strong>{" "}
                  업데이트·이벤트 등 마케팅 정보를 받겠습니다. 언제든 철회할 수 있습니다.
                </span>
              </label>

              {signupErr && <div className="psl-authmodal-error">{signupErr}</div>}

              <button type="submit" className="psl-authmodal-submit" disabled={signupBusy}>
                {signupBusy ? "가입 중..." : "가입하기"}
              </button>
            </form>

            <div className="psl-authmodal-divider"><span>또는</span></div>
            <button type="button" className="psl-authmodal-oauth" onClick={startKakao}>
              카카오로 계속하기
            </button>

            <div className="psl-authmodal-foot">
              이미 계정이 있나요?
              <button type="button" className="psl-authmodal-link" onClick={() => setMode("login")}>
                로그인
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
