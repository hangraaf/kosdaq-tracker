"use client";

import { useEffect, useState } from "react";
import {
  apiGetPlans, apiCreateOrder, apiConfirmPayment, apiCancelSubscription,
  type Plan, type OrderInfo,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: string, options: Record<string, unknown>) => Promise<{ paymentKey: string; orderId: string; amount: number }>;
    };
  }
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  boxShadow: "rgba(0,0,0,0.03) 0px 4px 24px",
};

function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const isYearly = plan.id.includes("yearly");
  return (
    <div
      onClick={onSelect}
      style={{
        border: `2px solid ${selected ? "var(--purple)" : "var(--line)"}`,
        background: selected ? "var(--purple-subtle)" : "var(--surface)",
        padding: "20px",
        cursor: "pointer",
        position: "relative",
        transition: "all 160ms ease",
        flex: 1,
        minWidth: "200px",
        borderRadius: "16px",
      }}
    >
      {isYearly && (
        <div style={{
          position: "absolute", top: "-10px", right: "14px",
          background: "var(--purple-deep)", color: "#fff",
          fontSize: "0.68rem", fontWeight: 600, padding: "3px 10px",
          letterSpacing: "0.04em",
          borderRadius: "8px",
        }}>
          2개월 무료
        </div>
      )}
      <div style={{ fontFamily: "var(--maru)", fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
        {plan.name}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: "1.6rem", fontWeight: 700, color: "var(--purple)", letterSpacing: "-0.5px" }}>
        {plan.amount.toLocaleString()}원
        <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)", fontWeight: 400, marginLeft: "4px" }}>
          /{isYearly ? "년" : "월"}
        </span>
      </div>
      {isYearly && (
        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: "4px" }}>
          월 {Math.round(plan.amount / 12).toLocaleString()}원 (16% 할인)
        </div>
      )}
      <div style={{
        marginTop: "12px",
        width: "20px", height: "20px",
        border: `2px solid ${selected ? "var(--purple)" : "var(--line)"}`,
        borderRadius: "50%",
        background: selected ? "var(--purple)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700 }}>✓</span>}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureList() {
  const features = [
    "PRISM 로보어드바이저 — 모멘텀 스코어 기반 맞춤 포트폴리오",
    "실시간 KIS API 차트 데이터",
    "5차원 기술적 분석 스코어링",
    "관심종목 무제한 등록",
    "포트폴리오 손익 실시간 추적",
    "목표가 · 손절가 알림 (예정)",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
      {features.map(text => (
        <div key={text} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.9rem", color: "var(--ink)" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "22px", height: "22px", borderRadius: "50%",
            background: "var(--purple-subtle)", color: "var(--purple)", flexShrink: 0,
          }}>
            <CheckIcon />
          </span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

export default function PremiumPage() {
  const { token, display, plan, isPremium, setAuth, username } = useAuthStore();
  const [plans, setPlans]             = useState<Plan[]>([]);
  const [selectedPlan, setSelected]   = useState<string>("premium_monthly");
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState("");
  const [msgKind, setMsgKind]         = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    apiGetPlans().then(setPlans);
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment";
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handlePayment = async () => {
    if (!token) { setMsgKind("error"); setMsg("로그인이 필요합니다."); return; }
    setLoading(true);
    setMsg("");
    try {
      const order: OrderInfo = await apiCreateOrder(selectedPlan);

      if (window.TossPayments) {
        const toss = window.TossPayments(order.client_key);
        const result = await toss.requestPayment("카드", {
          amount:       order.amount,
          orderId:      order.order_id,
          orderName:    order.order_name,
          customerName: order.customer_name,
          successUrl:   `${window.location.origin}/premium/success`,
          failUrl:      `${window.location.origin}/premium/fail`,
        });
        const res = await apiConfirmPayment({
          payment_key: result.paymentKey,
          order_id:    result.orderId,
          amount:      result.amount,
          plan_id:     selectedPlan,
        });
        if (res.ok) {
          setAuth(token, username ?? "", display ?? "", res.plan);
          setMsgKind("success"); setMsg(res.message);
        }
      } else {
        const res = await apiConfirmPayment({
          payment_key: `test_pk_${Date.now()}`,
          order_id:    order.order_id,
          amount:      order.amount,
          plan_id:     selectedPlan,
        });
        if (res.ok) {
          setAuth(token, username ?? "", display ?? "", res.plan);
          setMsgKind("success"); setMsg(res.message);
        }
      }
    } catch (e: unknown) {
      setMsgKind("error"); setMsg("오류: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("프리미엄을 해지하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await apiCancelSubscription();
      if (res.ok) {
        setAuth(token!, username ?? "", display ?? "", "free");
        setMsgKind("info"); setMsg("구독이 해지되었습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ ...cardStyle, padding: "72px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.05rem", color: "var(--ink)", fontWeight: 600, marginBottom: "8px" }}>
          로그인이 필요합니다
        </div>
        <div style={{ fontSize: "0.86rem", color: "var(--ink-soft)" }}>
          로그인 후 프리미엄 구독을 이용할 수 있습니다.
        </div>
      </div>
    );
  }

  if (isPremium()) {
    return (
      <div style={{ ...cardStyle, maxWidth: "500px", margin: "0 auto", textAlign: "center", padding: "48px 24px" }}>
        <div style={{
          display: "inline-block",
          background: "var(--purple)",
          color: "#fff",
          fontFamily: "var(--maru)",
          fontWeight: 700,
          fontSize: "0.7rem",
          padding: "4px 14px",
          letterSpacing: "0.12em",
          marginBottom: "14px",
          borderRadius: "9999px",
        }}>
          PREMIUM
        </div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.4px", marginBottom: "8px" }}>
          구독 중입니다
        </div>
        <div style={{ color: "var(--ink-soft)", marginBottom: "24px", fontSize: "0.9rem" }}>
          PRISM 로보어드바이저를 포함한 모든 기능을 이용 중입니다.
        </div>
        {msg && <div style={{ color: "var(--ink-muted)", marginBottom: "16px", fontSize: "0.85rem" }}>{msg}</div>}
        <button
          onClick={handleCancel}
          disabled={loading}
          style={{
            background: "var(--surface)", border: "1px solid var(--line)",
            color: "var(--ink-muted)", padding: "10px 22px",
            cursor: "pointer", fontSize: "0.82rem", fontWeight: 500,
            borderRadius: "12px",
          }}
        >
          {loading ? "처리 중..." : "구독 해지"}
        </button>
      </div>
    );
  }

  const msgStyle: Record<typeof msgKind, React.CSSProperties> = {
    info:    { background: "var(--purple-pale)",        border: "1px solid var(--line-soft)",        color: "var(--ink-muted)" },
    success: { background: "var(--purple-subtle)",      border: "1px solid var(--purple)",            color: "var(--purple-deep)" },
    error:   { background: "rgba(181,69,63,0.08)",      border: "1px solid var(--red)",               color: "var(--red)" },
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{
          display: "inline-block",
          background: "var(--purple)",
          color: "#fff",
          fontFamily: "var(--maru)",
          fontWeight: 700,
          fontSize: "0.7rem",
          padding: "4px 14px",
          letterSpacing: "0.12em",
          marginBottom: "12px",
          borderRadius: "9999px",
        }}>
          PREMIUM
        </div>
        <h1 style={{
          fontFamily: "var(--maru)", color: "var(--ink)",
          fontSize: "1.85rem", fontWeight: 700, letterSpacing: "-0.6px",
          margin: "0 0 8px",
        }}>
          PURPLE STOCK SLIME 프리미엄
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.92rem", margin: 0 }}>
          PRISM 모멘텀 스코어로 나만의 포트폴리오를 구성하세요.
        </p>
      </div>

      {/* 기능 목록 */}
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <FeatureList />
      </div>

      {/* 플랜 선택 */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {plans.map(p => (
          <PlanCard
            key={p.id}
            plan={p}
            selected={selectedPlan === p.id}
            onSelect={() => setSelected(p.id)}
          />
        ))}
      </div>

      {/* 결제 버튼 */}
      {msg && (
        <div style={{
          padding: "12px 16px",
          marginBottom: "12px",
          fontSize: "0.88rem",
          fontFamily: "var(--maru)",
          borderRadius: "12px",
          ...msgStyle[msgKind],
        }}>
          {msg}
        </div>
      )}
      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          width: "100%",
          padding: "14px 16px",
          background: loading ? "var(--surface-2)" : "var(--purple)",
          color: loading ? "var(--ink-muted)" : "#fff",
          border: "none",
          fontFamily: "var(--maru)",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: "0.02em",
          transition: "background 160ms ease",
          borderRadius: "12px",
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--purple-deep)"; }}
        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "var(--purple)"; }}
      >
        {loading
          ? "처리 중..."
          : `${plans.find(p => p.id === selectedPlan)?.amount.toLocaleString() ?? ""}원 결제하기`}
      </button>

      <div style={{ marginTop: "14px", fontSize: "0.72rem", color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.6 }}>
        결제는 토스페이먼츠를 통해 안전하게 처리됩니다.<br />
        구독은 언제든지 해지 가능하며, 잔여 기간은 환불되지 않습니다.
      </div>
    </div>
  );
}
