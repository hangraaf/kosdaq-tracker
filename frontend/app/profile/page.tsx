"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiMe, apiUpdateProfile, type UserProfile } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function formatDate(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function planLabel(plan: string): string {
  if (plan === "admin") return "ADMIN";
  if (plan === "premium") return "PREMIUM";
  return "FREE";
}

export default function ProfilePage() {
  const router = useRouter();
  const { token, setAuth } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [display, setDisplay] = useState("");
  const [marketing, setMarketing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    apiMe()
      .then(p => {
        setProfile(p);
        setDisplay(p.display || "");
        setMarketing(p.marketing_opt_in);
      })
      .catch(err => setErrorMsg((err as Error).message))
      .finally(() => setLoading(false));
  }, [token, router]);

  const dirty = profile
    ? display.trim() !== (profile.display || "").trim() || marketing !== profile.marketing_opt_in
    : false;

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!profile || !dirty) return;
    if (!display.trim()) {
      setErrorMsg("닉네임을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const patch: { display?: string; marketing_opt_in?: boolean } = {};
      if (display.trim() !== (profile.display || "").trim()) patch.display = display.trim();
      if (marketing !== profile.marketing_opt_in) patch.marketing_opt_in = marketing;
      const updated = await apiUpdateProfile(patch);
      setProfile(updated);
      setDisplay(updated.display || "");
      setMarketing(updated.marketing_opt_in);
      setSavedAt(Date.now());
      if (token) setAuth(token, updated.username, updated.display, updated.plan);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!token) return null;

  if (loading) {
    return (
      <div className="prism-doc">
        <div className="prism-doc-eyebrow">PURPLE STOCK SLIME · Profile</div>
        <h1>계정 설정</h1>
        <p style={{ color: "var(--muted)" }}>불러오는 중…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="prism-doc">
        <div className="prism-doc-eyebrow">PURPLE STOCK SLIME · Profile</div>
        <h1>계정 설정</h1>
        <div className="prism-form-status prism-form-status--err">
          프로필을 불러오지 못했습니다. {errorMsg}
        </div>
      </div>
    );
  }

  const isOAuth = !!profile.provider;

  return (
    <div className="prism-doc prism-form">
      <div className="prism-doc-eyebrow">PURPLE STOCK SLIME · Profile</div>
      <h1>계정 설정</h1>
      <div className="prism-doc-meta">
        가입일 {formatDate(profile.created_at)} · {planLabel(profile.plan)} 플랜
        {isOAuth && <> · {profile.provider.toUpperCase()} 연동 계정</>}
      </div>

      <form onSubmit={handleSave}>
        <section className="prism-form-section">
          <div className="prism-form-section-title">기본 정보</div>
          <div className="prism-form-section-desc">
            이메일은 로그인 ID로 사용됩니다. 변경이 필요하면 운영팀(hangraaf@gmail.com)으로 문의해 주세요.
          </div>

          <div className="prism-form-field">
            <label className="prism-form-label">이메일</label>
            <div className="prism-form-readonly">
              <span>{profile.email || profile.username}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {planLabel(profile.plan)}
              </span>
            </div>
          </div>

          <div className="prism-form-field">
            <label className="prism-form-label" htmlFor="profile-display">닉네임</label>
            <div className="prism-form-input-wrap">
              <input
                id="profile-display"
                type="text"
                className="prism-form-input"
                value={display}
                maxLength={40}
                onChange={e => setDisplay(e.target.value)}
                placeholder="화면에 표시될 이름"
              />
            </div>
            <div className="prism-form-helper">사이드바와 댓글·기록 등 서비스 곳곳에 표시됩니다. 40자 이내.</div>
          </div>
        </section>

        <section className="prism-form-section">
          <div className="prism-form-section-title">알림 동의</div>
          <div className="prism-form-section-desc">
            서비스 운영 안내(결제·구독 만료·중요 변경)는 동의 여부와 무관하게 발송될 수 있습니다.
          </div>

          <label className="prism-form-checkbox">
            <input
              type="checkbox"
              checked={marketing}
              onChange={e => setMarketing(e.target.checked)}
            />
            <span>
              <strong style={{ color: "var(--green-deep)" }}>마케팅·이벤트 정보 수신에 동의합니다.</strong>
              <br />
              <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                신규 기능, 프로모션, 리포트 등을 이메일로 받습니다. 언제든 이 화면에서 철회할 수 있습니다.
              </span>
            </span>
          </label>
        </section>

        <div className="prism-form-actions">
          <button type="submit" className="prism-form-submit" disabled={!dirty || saving}>
            {saving ? "저장 중..." : "변경사항 저장"}
          </button>
          {dirty && !saving && (
            <button
              type="button"
              className="prism-form-ghost"
              onClick={() => {
                setDisplay(profile.display || "");
                setMarketing(profile.marketing_opt_in);
                setErrorMsg("");
              }}
            >
              되돌리기
            </button>
          )}
        </div>

        {errorMsg && <div className="prism-form-status prism-form-status--err">{errorMsg}</div>}
        {savedAt > 0 && !dirty && !errorMsg && (
          <div className="prism-form-status prism-form-status--ok">변경사항이 저장되었습니다.</div>
        )}
      </form>

      <section className="prism-form-section" style={{ marginTop: 32 }}>
        <div className="prism-form-section-title">보안</div>
        <div className="prism-form-section-desc">
          {isOAuth
            ? "소셜 로그인으로 가입한 계정은 비밀번호 변경이 필요하지 않습니다."
            : "주기적으로 비밀번호를 갱신하면 계정 안전에 도움이 됩니다."}
        </div>
        {!isOAuth && (
          <Link href="/profile/password" className="prism-form-ghost" style={{ textDecoration: "none", display: "inline-block" }}>
            비밀번호 변경
          </Link>
        )}
      </section>

      <section className="prism-form-section prism-form-section--danger" style={{ marginTop: 24 }}>
        <div className="prism-form-section-title">계정 삭제</div>
        <div className="prism-form-section-desc">
          계정을 삭제하면 관심종목·포트폴리오 등 모든 데이터가 영구 삭제되며 복구할 수 없습니다.
          삭제 기능은 준비 중이며, 즉시 삭제가 필요하면 hangraaf@gmail.com으로 요청해 주세요.
        </div>
        <button type="button" className="prism-form-danger" disabled title="준비 중">
          계정 삭제 (준비 중)
        </button>
      </section>
    </div>
  );
}
