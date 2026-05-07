"use client";

export default function MrStockBuddy({ size = 200 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        viewBox="0 0 220 220"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Mr. Stock Buddy"
      >
        <defs>
          <clipPath id="msb-clip">
            <circle cx="110" cy="110" r="89" />
          </clipPath>
          <path id="msb-ring" d="M 110 6 A 104 104 0 1 1 109.97 6" />
        </defs>

        {/* ── 외부 링 ── */}
        <circle cx="110" cy="110" r="110" fill="#D4A030" />
        <circle cx="110" cy="110" r="110" fill="none" stroke="#3A1208" strokeWidth="2" />
        <circle cx="110" cy="110" r="106" fill="none" stroke="#5A1810" strokeWidth="2" />
        <circle cx="110" cy="110" r="103" fill="none" stroke="#3A1208" strokeWidth="0.6" />
        <circle cx="110" cy="110" r="98"  fill="none" stroke="#3A1208" strokeWidth="0.5" strokeDasharray="1.2,2.5" />

        {/* ── 8방향 장식 점 ── */}
        <g fill="#3A1208" opacity="0.85">
          <circle cx="110" cy="14"  r="2.4" />
          <circle cx="178" cy="42"  r="2.4" />
          <circle cx="206" cy="110" r="2.4" />
          <circle cx="178" cy="178" r="2.4" />
          <circle cx="110" cy="206" r="2.4" />
          <circle cx="42"  cy="178" r="2.4" />
          <circle cx="14"  cy="110" r="2.4" />
          <circle cx="42"  cy="42"  r="2.4" />
        </g>

        {/* ── 회전하는 링 텍스트 ── */}
        <g style={{ animation: "bh-ring-spin 55s linear infinite", transformOrigin: "110px 110px" }}>
          <text
            fontSize="13.5"
            fontFamily="'MaruBuri','Noto Serif KR',Georgia,serif"
            fontWeight="700"
            fill="#3A1208"
            letterSpacing="5"
          >
            <textPath href="#msb-ring" startOffset="2%">MR. STOCK BUDDY</textPath>
          </text>
          <text
            fontSize="11"
            fontFamily="'MaruBuri','Noto Serif KR',Georgia,serif"
            fontWeight="700"
            fill="#5A1810"
            letterSpacing="4"
          >
            <textPath href="#msb-ring" startOffset="58%">&#10047; EST. 1978 &#10047;</textPath>
          </text>
        </g>

        {/* ── 내부 원 테두리 ── */}
        <circle cx="110" cy="110" r="91" fill="none" stroke="#5A1810" strokeWidth="3" />
        <circle cx="110" cy="110" r="89" fill="none" stroke="#3A1208" strokeWidth="0.8" />
        <circle cx="110" cy="110" r="88" fill="#E8B838" />
        <circle cx="110" cy="110" r="85" fill="none" stroke="#5A1810" strokeWidth="0.5" strokeDasharray="2,3" opacity="0.55" />

        {/* ── 내부 십자 점 ── */}
        <g fill="#5A1810" opacity="0.7">
          <circle cx="110" cy="28"  r="1.5" />
          <circle cx="110" cy="192" r="1.5" />
          <circle cx="28"  cy="110" r="1.5" />
          <circle cx="192" cy="110" r="1.5" />
        </g>

        {/* ── 클립 내부 — 신사 캐릭터 ── */}
        <g clipPath="url(#msb-clip)">
          {/* 몸통 */}
          <path d="M 52,205 Q 52,162 82,148 L 110,136 L 138,148 Q 168,162 168,205 Z" fill="#0C1D38" />
          {/* 라펠 */}
          <polygon points="110,136 87,153 69,136 82,118" fill="#FFF5DC" />
          <polygon points="110,136 133,153 151,136 138,118" fill="#FFF5DC" />
          {/* 셔츠 */}
          <polygon points="110,136 100,150 106,158 110,143" fill="white" />
          <polygon points="110,136 120,150 114,158 110,143" fill="white" />
          {/* 넥타이 */}
          <polygon points="110,140 106,159 110,168 114,159" fill="#5A1810" />
          <polygon points="107,155 110,140 113,155 110,149" fill="#3A1208" />
          {/* 손수건 */}
          <path d="M138,165 L148,160 L150,168 L140,171Z" fill="rgba(242,232,204,0.85)" />
          {/* 옷 단추 */}
          <circle cx="110" cy="178" r="3.5" fill="#152C50" />
          {/* 왼팔 */}
          <path d="M65,172 Q46,183 38,198" stroke="#0C1D38" strokeWidth="19" fill="none" strokeLinecap="round" />
          <ellipse cx="35" cy="201" rx="13" ry="12" fill="#E8D8A0" />
          <path d="M28,200 Q24,193 32,196" fill="none" stroke="#D4BE80" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M33,204 Q27,198 33,192" fill="none" stroke="#D4BE80" strokeWidth="3" strokeLinecap="round" />
          {/* 오른팔 + 차트 */}
          <path d="M155,172 Q173,182 180,196" stroke="#0C1D38" strokeWidth="19" fill="none" strokeLinecap="round" />
          <rect x="168" y="174" width="36" height="29" rx="4" fill="#FFF5DC" />
          <rect x="168" y="174" width="36" height="29" rx="4" fill="none" stroke="#0C1D38" strokeWidth="2.2" />
          <line x1="175" y1="181" x2="175" y2="199" stroke="#0C1D38" strokeWidth="1.4" />
          <rect x="173" y="185" width="4" height="8" fill="#0C1D38" />
          <line x1="182" y1="177" x2="182" y2="196" stroke="#0C1D38" strokeWidth="1.4" />
          <rect x="180" y="180" width="4" height="10" fill="#0C1D38" />
          <line x1="189" y1="175" x2="189" y2="192" stroke="#0C1D38" strokeWidth="1.4" />
          <rect x="187" y="177" width="4" height="9" fill="#0C1D38" />
          <polyline points="175,190 182,184 189,179" stroke="#0C1D38" strokeWidth="1.8" fill="none" />
          <polygon points="189,179 183,180 188,186" fill="#0C1D38" />
          {/* 모자 */}
          <rect x="83" y="63" width="54" height="43" rx="3" fill="#0C1D38" />
          <ellipse cx="110" cy="107" rx="8" ry="9.5" fill="#0C1D38" />
          <ellipse cx="110" cy="106" rx="36" ry="7.5" fill="#0C1D38" />
          <rect x="83" y="97" width="54" height="9" fill="#162C54" />
          <rect x="83" y="63" width="9" height="43" rx="2" fill="rgba(255,255,255,0.07)" />
          {/* 귀 */}
          <ellipse cx="78"  cy="121" rx="8" ry="10" fill="#E8D8A0" />
          <ellipse cx="78"  cy="121" rx="4.5" ry="6" fill="#D4BE80" />
          <ellipse cx="142" cy="121" rx="8" ry="10" fill="#E8D8A0" />
          <ellipse cx="142" cy="121" rx="4.5" ry="6" fill="#D4BE80" />
          {/* 얼굴 */}
          <ellipse cx="110" cy="120" rx="31" ry="35" fill="#E8D8A0" />
          <ellipse cx="110" cy="102" rx="24" ry="8" fill="rgba(12,29,56,0.2)" />
          {/* 눈썹 */}
          <path d="M87,106 Q95,99 102,103"  fill="none" stroke="#180C02" strokeWidth="4" strokeLinecap="round" />
          <path d="M118,103 Q125,99 133,106" fill="none" stroke="#180C02" strokeWidth="4" strokeLinecap="round" />
          {/* 왼눈 — 깜빡임 */}
          <g style={{ animation: "bh-blink 4s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" }}>
            <path d="M87,114 Q96,107 103,114" fill="none" stroke="#180C02" strokeWidth="3.8" strokeLinecap="round" />
          </g>
          {/* 모노클 + 오른눈 — 천천히 들리는 모션 */}
          <g style={{ animation: "bh-monocle-lift 6s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" }}>
            <path d="M132,115 Q138,126 134,134" fill="none" stroke="#A08030" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="122" cy="112" r="14" fill="none" stroke="#A08030" strokeWidth="4" />
            <circle cx="122" cy="112" r="12" fill="rgba(160,128,48,0.06)" />
            <path d="M112,112 Q122,105 131,112" fill="none" stroke="#180C02" strokeWidth="3.8" strokeLinecap="round" />
          </g>
          {/* 콧구멍 */}
          <ellipse cx="110" cy="130" rx="4.5" ry="3.5" fill="rgba(12,29,56,0.12)" />
          {/* 입 */}
          <path d="M96,141 Q82,133 80,122 Q88,132 97,138 Q103,134 110,137 Q117,134 123,138 Q132,132 140,122 Q138,133 124,141 Q117,146 110,142 Q103,146 96,141Z" fill="#180C02" />
          <path d="M103,148 Q110,155 117,148" fill="none" stroke="#B09060" strokeWidth="2.2" strokeLinecap="round" />
          {/* 턱 */}
          <rect x="103" y="131" width="14" height="10" rx="3" fill="#E8D8A0" />
        </g>
      </svg>

      {/* ── 하단 텍스트 ── */}
      <div className="text-center leading-tight">
        <div
          style={{
            fontFamily: "var(--maru)",
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "#E8B838",
            textShadow: "1px 2px 0 #3A1208",
            letterSpacing: "0.04em",
          }}
        >
          STOCK TRACKER
        </div>
        <div
          style={{
            fontFamily: "var(--font)",
            fontSize: "0.72rem",
            color: "#D4BE80",
            letterSpacing: "0.15em",
            marginTop: "2px",
          }}
        >
          KOSPI &nbsp;&middot;&nbsp; KOSDAQ
        </div>
      </div>
    </div>
  );
}
