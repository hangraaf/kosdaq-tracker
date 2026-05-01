# KOSDAQ Tracker - Python Streamlit App

## 프로젝트 개요
- **프로젝트명**: KOSDAQ Tracker
- **프로젝트유형**: Streamlit 웹 애플리케이션
- **핵심기능**: 코스닥 종목 실시간 시세 확인, 차트 분석, 예측 기능
- **대상사용자**: 국내 개인 투자자

## 기술 스택
- **프론트엔드**: Streamlit + Plotly
- **백엔드**: Python 3.9+
- **데이터소스**: Korea Investment API (공식 무료 API)
- **빌드도구**: pip/conda

## 기능 목록

### 3.1 핵심 기능
- [x] 코스닥 종목 목록 조회
- [x] 실시간 시세 확인 (현재가, 등락률, 거래량)
- [x] 일간/주간/월간 차트 표시
- [x] 캔들스틱 차트
- [x] 이동평균선 (5일, 20일, 60일)
- [x] RSI, MACD 기술지표
- [x] 1주일/1개월 예측 차트 (단순 이동평균 기반)

### 3.2 추가 기능
- [x] 종목 검색 기능
- [x] 즐겨찾기 등록/관리
- [x] 가격 알림 설정 (상승/하락 임계값)
- [x] 포트폴리오 추적 (보유종목, 수익률)

## UI/UX 요구사항
- **레이아웃**: 사이드바 + 메인 컨텐츠
- **색상테마**: 다크 모드 (금융 앱 느낌)
- **반응형**: 데스크톱 우선
- **차트**: 인터랙티브 (마우스 호버 시 상세정보)

## API 연동
- Korea Investment API (https://apiportal.koreainvestment.com/)
- 인증: OAuth 2.0 (APP Key + Secret Key)

## 실행 방법
```bash
pip install -r requirements.txt
streamlit run app.py
```

## 6. 프로젝트 구조

```
kosdaq-tracker/
├── src/main/java/com/tracker/kosdaq/
│   ├── KosdaqTrackerApplication.java
│   ├── config/
│   │   └── ApiConfig.java
│   ├── controller/
│   │   ├── MainController.java
│   │   └── StockController.java
│   ├── service/
│   │   ├── StockService.java
│   │   └── ChartService.java
│   ├── dto/
│   │   └── StockDto.java
│   └── repository/
│       └── FavoriteRepository.java
├── src/main/resources/
│   ├── templates/
│   │   ├── index.html
│   │   ├── chart.html
│   │   └── portfolio.html
│   └── static/
│       ├── css/
│       └── js/
└── build.gradle
```