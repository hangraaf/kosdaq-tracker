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

function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const isYearly = plan.id.includes("yearly");
  return (
    <div
      onClick={onSelect}
      style={{
        border: `2px solid ${selected ? "#D4A030" : "var(--border)"}`,
        background: selected ? "rgba(212,160,48,0.06)" : "var(--surf)",
        padding: "20px",
        cursor: "pointer",
        position: "relative",
        transition: "all 0.2s",
        flex: 1,
        minWidth: "200px",
      }}
    >
      {isYearly && (
        <div style={{
          position: "absolute", top: "-10px", right: "12px",
          background: "#B5453F", color: "#fff",
          fontSize: "0.68rem", fontWeight: 700, padding: "2px 10px",
          letterSpacing: "0.05em",
        }}>
          2개월 무료
        </div>
      )}
      <div style={{ fontFamily: "var(--maru)", fontSize: "1rem", fontWeight: 700, marginBottom: "6px" }}>
        {plan.name}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: "1.5rem", fontWeight: 700, color: "#D4A030" }}>
        {plan.amount.toLocaleString()}원
        <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 400 }}>
          /{isYearly ? "년" : "월"}
        </span>
      </div>
      {isYearly && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>
          월 {Math.round(plan.amount / 12).toLocaleString()}원 (16% 할인)
        </div>
      )}
      <div style={{
        marginTop: "10px",
        width: "20px", height: "20px",
        border: `2px solid ${selected ? "#D4A030" : "var(--border)"}`,
        borderRadius: "50%",
        background: selected ? "#D4A030" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <span style={{ color: "#fff", fontSize: "0.7rem" }}>✓</span>}
      </div>
    </div>
  );
}

function FeatureList() {
  const features = [
    ["🤖", "PRISM 로보어드바이저 — 모멘텀 스코어 기반 맞춤 포트폴리오"],
    ["📊", "실시간 KIS API 차트 데이터"],
    ["⚡", "5차원 기술적 분석 스코어링"],
    ["★",  "관심종목 무제한 등록"],
    ["◈",  "포트폴리오 손익 실시간 추적"],
    ["🔔", "목표가 · 손절가 알림 (예정)"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
      {features.map(([icon, text]) => (
        <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.9rem" }}>
          <span style={{ fontSize: "1rem", width: "24px", textAlign: "center" }}>{icon}</span>
          <span style={{ color: "var(--fg)" }}>{text}</span>
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

  useEffect(() => {
    apiGetPlans().then(setPlans);
    // 토스페이먼츠 SDK 동적 로드
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment";
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handlePayment = async () => {
    if (!token) { setMsg("로그인이 필요합니다."); return; }
    setLoading(true);
    setMsg("");
    try {
      const order: OrderInfo = await apiCreateOrder(selectedPlan);
      const plan_obj = plans.find(p => p.id === selectedPlan)!;

      if (window.TossPayments) {
        // 실제 토스페이먼츠 결제창
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
          setMsg("🎉 " + res.message);
        }
      } else {
        // 테스트 환경: SDK 없이 바로 confirm (개발용)
        const res = await apiConfirmPayment({
          payment_key: `test_pk_${Date.now()}`,
          order_id:    order.order_id,
          amount:      order.amount,
          plan_id:     selectedPlan,
        });
        if (res.ok) {
          setAuth(token, username ?? "", display ?? "", res.plan);
          setMsg("🎉 " + res.message);
        }
      }
    } catch (e: unknown) {
      setMsg("오류: " + (e as Error).message);
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
        setMsg("구독이 해지되었습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔐</div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1rem" }}>로그인 후 이용 가능합니다.</div>
      </div>
    );
  }

  if (isPremium()) {
    return (
      <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center", paddingTop: "40px" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>★</div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.3rem", fontWeight: 700, color: "#D4A030", marginBottom: "8px" }}>
          PREMIUM 구독 중
        </div>
        <div style={{ color: "var(--muted)", marginBottom: "24px", fontSize: "0.9rem" }}>
          PRISM 로보어드바이저를 포함한 모든 기능을 이용 중입니다.
        </div>
        {msg && <div style={{ color: "var(--muted)", marginBottom: "16px", fontSize: "0.85rem" }}>{msg}</div>}
        <button
          onClick={handleCancel}
          disabled={loading}
          style={{
            background: "none", border: "1px solid var(--border)",
            color: "var(--muted)", padding: "8px 20px",
            cursor: "pointer", fontSize: "0.82rem",
          }}
        >
          {loading ? "처리 중..." : "구독 해지"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #D4A030, #E8B838)",
          color: "#3A1208",
          fontFamily: "var(--maru)",
          fontWeight: 700,
          fontSize: "0.75rem",
          padding: "3px 14px",
          letterSpacing: "0.1em",
          marginBottom: "10px",
        }}>
          ★ PREMIUM
        </div>
        <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", marginBottom: "8px" }}>
          Mr. Stock Buddy 프리미엄
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          PRISM 모멘텀 스코어로 나만의 포트폴리오를 구성하세요.
        </p>
      </div>

      {/* 기능 목록 */}
      <div className="bh-card" style={{ marginBottom: "20px" }}>
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
          background: msg.startsWith("🎉") ? "rgba(67,107,149,0.08)" : "rgba(181,69,63,0.08)",
          border: `1px solid ${msg.startsWith("🎉") ? "var(--blue)" : "var(--red)"}`,
          color: msg.startsWith("🎉") ? "var(--blue-deep)" : "var(--red)",
          fontSize: "0.9rem",
          fontFamily: "var(--maru)",
        }}>
          {msg}
        </div>
      )}
      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          width: "100%",
          padding: "14px",
          background: loading ? "var(--surf2)" : "linear-gradient(90deg, var(--morinaga-gold), var(--morinaga-inner))",
          color: loading ? "var(--muted)" : "#3A1208",
          border: "none",
          fontFamily: "var(--maru)",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: "0.05em",
          transition: "all 0.2s",
        }}
      >
        {loading
          ? "처리 중..."
          : `${plans.find(p => p.id === selectedPlan)?.amount.toLocaleString() ?? ""}원 결제하기`}
      </button>

      <div style={{ marginTop: "12px", fontSize: "0.72rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
        결제는 토스페이먼츠를 통해 안전하게 처리됩니다.<br />
        구독은 언제든지 해지 가능하며, 잔여 기간은 환불되지 않습니다.
      </div>
    </div>
  );
}
