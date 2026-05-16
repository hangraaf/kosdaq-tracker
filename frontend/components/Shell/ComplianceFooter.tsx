export default function ComplianceFooter() {
  return (
    <div
      style={{
        marginTop: "20px",
        border: "1px solid var(--line)",
        borderTop: "2px solid var(--purple)",
        background: "var(--surface-2)",
        padding: "16px 18px",
        fontSize: "0.74rem",
        color: "var(--ink-muted)",
        lineHeight: 1.75,
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--maru)",
          fontWeight: 800,
          fontSize: "0.82rem",
          marginBottom: "8px",
          color: "var(--purple-deep)",
          letterSpacing: "-0.2px",
        }}
      >
        투자 위험 고지 · 법적 면책 (필독)
      </div>
      <ol style={{ paddingLeft: "18px", margin: 0 }}>
        <li>
          본 콘텐츠는 <b style={{ color: "var(--ink)" }}>PURPLE STOCK SLIME</b>이 제공하는 자체 기술적 분석(PRISM 모멘텀 스코어) 기반의
          <b style={{ color: "var(--ink)" }}> 정보 제공 서비스</b>로, 「자본시장과 금융투자업에 관한 법률」상 투자자문업·투자일임업에
          해당하지 않으며 <b style={{ color: "var(--ink)" }}>투자 권유를 목적으로 하지 않습니다</b>.
        </li>
        <li>
          PRISM 점수, 추천 종목, 백테스트 수익률은 모두 <b style={{ color: "var(--ink)" }}>과거 데이터에 기반한 모의 결과</b>이며,
          <b style={{ color: "var(--ink)" }}> 과거의 수익률은 미래의 수익을 보장하지 않습니다</b>.
        </li>
        <li>
          백테스트는 실제 매매가 아닌 <b style={{ color: "var(--ink)" }}>시뮬레이션</b>입니다. 매매 수수료·세금·슬리피지·유동성 제약을
          단순화한 가정이며, <b style={{ color: "var(--ink)" }}>실제 투자 결과와 일치하지 않을 수 있습니다</b>.
        </li>
        <li>
          KIS 모드는 한국투자증권 Open API의 실시간 시세를, DEMO 모드는 검증용 합성 시세를 사용합니다.
          DEMO 결과는 <b style={{ color: "var(--ink)" }}>실제 종목의 손익과 무관</b>합니다.
        </li>
        <li>
          모든 투자 판단과 그에 따른 <b style={{ color: "var(--ink)" }}>이익·손실의 책임은 전적으로 투자자 본인</b>에게 있으며,
          PURPLE STOCK SLIME은 본 서비스 이용으로 발생한 손실에 대해 책임지지 않습니다.
        </li>
      </ol>
      <div
        style={{
          marginTop: "10px",
          fontSize: "0.7rem",
          color: "var(--ink-soft)",
          borderTop: "1px dashed var(--line)",
          paddingTop: "8px",
        }}
      >
        © PURPLE STOCK SLIME · PRISM은 자체 기술적 스코어링 지표입니다. 문의: hangraaf@gmail.com
      </div>
    </div>
  );
}
