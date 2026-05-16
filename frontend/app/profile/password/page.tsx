"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiChangePassword, apiMe } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type FieldErrors = Partial<{
  current: string;
  next: string;
  confirm: string;
}>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { token } = useAuthStore();

  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    apiMe()
      .then(p => setProvider(p.provider || ""))
      .catch(err => setSubmitErr((err as Error).message))
      .finally(() => setLoading(false));
  }, [token, router]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!current) e.current = "현재 비밀번호를 입력해 주세요.";
    if (next.length < 6) e.next = "새 비밀번호는 6자 이상이어야 합니다.";
    if (next && current && next === current) e.next = "새 비밀번호는 기존과 달라야 합니다.";
    if (confirm !== next) e.confirm = "새 비밀번호 확인이 일치하지 않습니다.";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitErr("");
    setDone(false);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      await apiChangePassword({ current_password: current, new_password: next });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
    } catch (err) {
      setSubmitErr((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  if (loading) {
    return (
      <div className="prism-doc">
        <div className="prism-doc-eyebrow">PRISM · Security</div>
        <h1>비밀번호 변경</h1>
        <p style={{ color: "var(--muted)" }}>불러오는 중…</p>
      </div>
    );
  }

  if (provider) {
    return (
      <div className="prism-doc">
        <div className="prism-doc-eyebrow">PRISM · Security</div>
        <h1>비밀번호 변경</h1>
        <div className="prism-doc-meta">
          <Link href="/profile" style={{ color: "var(--green)" }}>← 계정 설정으로 돌아가기</Link>
        </div>
        <div className="prism-form-status prism-form-status--err" style={{ marginTop: 16 }}>
          이 계정은 <strong>{provider.toUpperCase()} 소셜 로그인</strong>으로 가입되어 있어 비밀번호가 설정되어 있지 않습니다.
          비밀번호 변경은 {provider.toUpperCase()} 계정 설정에서 진행해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="prism-doc prism-form">
      <div className="prism-doc-eyebrow">PRISM · Security</div>
      <h1>비밀번호 변경</h1>
      <div className="prism-doc-meta">
        <Link href="/profile" style={{ color: "var(--green)" }}>← 계정 설정으로 돌아가기</Link>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <section className="prism-form-section">
          <div className="prism-form-section-title">새 비밀번호 설정</div>
          <div className="prism-form-section-desc">
            본인 확인을 위해 현재 비밀번호를 함께 입력해 주세요. 새 비밀번호는 6자 이상이어야 합니다.
          </div>

          <div className="prism-form-field">
            <label className="prism-form-label" htmlFor="pw-current">현재 비밀번호</label>
            <div className="prism-form-input-wrap">
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                className={`prism-form-input ${errors.current ? "prism-form-input--invalid" : ""}`}
                value={current}
                onChange={e => setCurrent(e.target.value)}
              />
            </div>
            {errors.current && <div className="prism-form-helper prism-form-helper--error">{errors.current}</div>}
          </div>

          <div className="prism-form-field">
            <label className="prism-form-label" htmlFor="pw-next">새 비밀번호</label>
            <div className="prism-form-input-wrap">
              <input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                placeholder="6자 이상"
                className={`prism-form-input ${errors.next ? "prism-form-input--invalid" : ""}`}
                value={next}
                onChange={e => setNext(e.target.value)}
              />
            </div>
            {errors.next && <div className="prism-form-helper prism-form-helper--error">{errors.next}</div>}
          </div>

          <div className="prism-form-field">
            <label className="prism-form-label" htmlFor="pw-confirm">새 비밀번호 확인</label>
            <div className="prism-form-input-wrap">
              <input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="동일하게 입력"
                className={`prism-form-input ${errors.confirm ? "prism-form-input--invalid" : ""}`}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>
            {errors.confirm && <div className="prism-form-helper prism-form-helper--error">{errors.confirm}</div>}
          </div>
        </section>

        <div className="prism-form-actions">
          <button type="submit" className="prism-form-submit" disabled={submitting}>
            {submitting ? "변경 중..." : "비밀번호 변경"}
          </button>
          <Link href="/profile" className="prism-form-ghost" style={{ textDecoration: "none", display: "inline-block" }}>
            취소
          </Link>
        </div>

        {submitErr && <div className="prism-form-status prism-form-status--err">{submitErr}</div>}
        {done && (
          <div className="prism-form-status prism-form-status--ok">
            비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.
          </div>
        )}
      </form>
    </div>
  );
}
