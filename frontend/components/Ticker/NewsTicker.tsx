"use client";

const NEWS_ITEMS = [
  "코스피 2,580.42 ▲12.34 (+0.48%)",
  "코스닥 763.18 ▼3.21 (-0.42%)",
  "삼성전자 76,200 ▲800 (+1.06%)",
  "SK하이닉스 178,500 ▲2,500 (+1.42%)",
  "원/달러 1,354.30 ▼2.40",
  "나스닥 17,488.37 ▲134.21 (+0.77%)",
  "S&P 500 5,201.34 ▲28.90 (+0.56%)",
  "WTI 원유 78.42 ▲0.83",
  "금 2,310.50 ▲12.40",
  "10년물 국채 수익률 4.48% ▼0.03",
  "외국인 코스피 순매수 +1,240억",
  "기관 코스닥 순매수 +380억",
  "현대차 240,500 ▲1,500 (+0.63%)",
  "LG에너지솔루션 389,000 ▼3,000 (-0.77%)",
  "에코프로비엠 183,500 ▲1,500 (+0.82%)",
  "NAVER 186,000 ▲2,000 (+1.09%)",
  "카카오 47,350 ▼650 (-1.35%)",
  "한화에어로스페이스 218,000 ▲2,000 (+0.93%)",
];

function TickerItem({ text }: { text: string }) {
  const isUp = text.includes("▲");
  const isDown = text.includes("▼");
  const color = isUp ? "#FF6B6B" : isDown ? "#74B0FF" : "#E0D8C8";

  return (
    <span
      className="inline-flex items-center gap-1 px-4"
      style={{ color, fontFamily: "var(--mono)", fontSize: "0.82rem", fontWeight: 500 }}
    >
      {text}
      <span style={{ color: "#3A4A6E", opacity: 0.6, padding: "0 4px" }}>|</span>
    </span>
  );
}

export default function NewsTicker() {
  const doubled = [...NEWS_ITEMS, ...NEWS_ITEMS];

  return (
    <div
      style={{
        background: "#0A1628",
        borderBottom: "1px solid #1F3552",
        overflow: "hidden",
        height: "36px",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* 왼쪽 레이블 */}
      <div
        style={{
          background: "#1A6FD4",
          color: "#fff",
          fontFamily: "var(--mono)",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          padding: "0 12px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        LIVE
      </div>

      {/* 스크롤 영역 */}
      <div style={{ overflow: "hidden", flex: 1, position: "relative" }}>
        <div className="ticker-track">
          {doubled.map((text, i) => (
            <TickerItem key={i} text={text} />
          ))}
        </div>
      </div>
    </div>
  );
}
