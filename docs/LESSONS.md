# 운영 교훈 모음 (Lessons Learned)

실제 장애에서 얻은 회고. 같은 함정을 다시 밟지 않기 위해 적어둔다.

---

## 2026-05-15 — 로보어드바이저 분석값 미표시 (Vercel)

### 증상
- 로컬(`localhost:3000`)에서는 PRISM™ 로보어드바이저 분석이 정상.
- 프로덕션(`mr-stock-buddy-app.vercel.app`)에서는 설문 제출 후 결과(성향 카드 / 추천 포트폴리오 / 백테스팅 차트)가 빈 화면.
- 프론트 콘솔: `[backtest] {ok: false, error: "items 비어있음", series: [], days: 0}`

### 진단 경로 (1시간 단축의 핵심)
1. **백엔드 health/survey 헬스체크** — 200 OK, 0.3s. 백엔드는 정상.
2. **빌드 산출물 확인** — `curl`로 Vercel `_next/static/chunks/*.js`를 받아서 `kosdaq-tracker.onrender.com` 박혀있는지 확인. API URL은 정상.
3. **콘솔의 `error` 필드 한 줄** — 프론트가 `console.log("[backtest]", res.backtest)`로 백엔드 진단 정보를 그대로 노출해둔 덕에 즉시 "items 비어있음"을 발견.
4. **Render 로그** — `[STARTUP] 종목: 코스피 0 + 코스닥 0 = 0개`. 종목 마스터 데이터가 백엔드에 없었음.

### 진짜 원인 — 3중 ignore
`stocks_fallback.json` 한 파일이 다음 세 단계에서 모두 차단되어 있었다:

1. **`.gitignore`** — `backend/data/` 통째 제외 → git 레포에 없음
2. **`backend/.dockerignore`** — `data/` 통째 제외 → Docker 이미지에 없음
3. **`backend/stock_data._load_stocks`** — 캐시 파일이 존재하면 stocks=[]여도 그대로 return → fallback으로 떨어지지 않음

세 레이어를 모두 통과시켜야 데이터가 실제 런타임까지 도달한다.

### 추가로 드러난 문제
- **Render Root Directory가 `backend`로 설정**되어 있어, `backend/` 밖의 변경(`frontend/*`, `.gitignore`)만 있는 커밋은 auto-deploy가 트리거되지 않았다. 첫 푸시 3건이 배포되지 않은 채 "왜 안 되지" 시간을 까먹음.
- `next.config.ts`와 `lib/api.ts` 양쪽에 **이중 폴백**(`?? "https://kosdaq-tracker.onrender.com"`)이 있어, 잘못된 환경변수를 가렸을 수도 있었음 (이번 케이스는 다른 원인이었지만 가드를 강화).
- 프론트 에러 박스가 한 줄짜리라 사용자가 인지 못 하는 경우가 있음.

### 적용한 항구적 조치
- **`frontend/.env.production`** 커밋 + `.gitignore` 예외 → Vercel dashboard 의존 제거
- **`next.config.ts`** — `NEXT_PUBLIC_API_URL` 미설정 또는 production+localhost 검출 시 빌드 abort
- **`lib/api.ts`** — 이중 폴백 제거, 브라우저에서 localhost 호출 시 console.error
- **`RoboPage.tsx`** — 빨간 보더 에러 박스 + 현재 API base URL 노출 + console.error 진단 로그
- **`backend/stock_data.py`** — 캐시가 비어있으면 다음 소스(fallback)로 fallthrough, 각 단계 `[STOCKS]` 로그
- **`backend/main.py`** — lifespan에서 fallback이 있으면 동기 refresh 생략(콜드스타트 단축), refresh 성공 시 module 변수 명시적 재할당
- **`backend/.dockerignore`** — `data/*` + `!data/stocks_fallback.json` 패턴으로 fallback만 살림

### 다음에 같은 함정을 피하는 체크리스트
- [ ] 새 데이터 파일을 레포에 포함시키려면 **`.gitignore` + `.dockerignore` 양쪽 모두** negation(`!`) 추가했는지 확인
- [ ] 디렉터리 단위 ignore(`data/`)는 negation이 안 먹는다. **`data/*` 패턴 + `!data/specific.json`** 으로 써야 함
- [ ] Render에서 **Root Directory 설정이 있는 모노레포**라면, 배포할 변경은 반드시 그 디렉터리 안의 파일을 함께 건드릴 것 (또는 Settings에서 Root Directory를 비우거나 monorepo-aware로 변경)
- [ ] 환경변수에 **무성한 폴백을 두지 말 것** — 빌드 시 throw가 운영 사고를 더 빨리 잡는다
- [ ] 백엔드 startup 로그에서 **0 카운트는 즉시 빨간불** (`코스피 0 + 코스닥 0`, `cache size: 0` 등)
- [ ] 프론트 에러 표시는 **눈에 띄게** (두꺼운 보더 + 현재 호출 중인 API URL 포함)
- [ ] 진단 정보를 응답 본문(`error: "items 비어있음"`)에 실어두면 운영 환경 디버깅이 콘솔 한 줄로 끝난다

---

## 일반 원칙 (Cross-cutting)

### 다단 차단(multi-stage gates)을 의심하라
한 데이터/설정 값이 사용자에게 도달하기까지 거치는 모든 레이어를 머릿속에 그릴 것:
`git → CI → Docker context → Docker image → runtime loader → API response → frontend bundle → render path`
어느 한 단계에서라도 막히면 끝까지 안 보이고, 흔히 **2개 이상 동시 차단**으로 한 단계 풀어도 증상이 그대로다.

### 폴백은 친절한 거짓말이다
`?? defaultValue`, `try/except: pass`, `if not data: data = []` 같은 폴백은 운영 사고를 **늦게 발견**하게 만든다.
- 사용자 입장에서 "그냥 안 보임"이 되는 폴백은 항상 의심
- 빌드 시점에 throw하는 가드 + 런타임 명시적 경고(`console.error`)가 훨씬 빨리 잡는다

### "어디서 호출되고 있나"를 가시화
프론트 에러에 **현재 API base URL을 노출**시켜두면, 환경변수 오설정 / Vercel 캐시 / 잘못된 도메인 같은 부류는 1초 만에 식별 가능.

### Render 무료 플랜의 함정
- 15분 idle 후 spin-down → 첫 요청 50초 지연 (사용자에게 "로딩이 안 됨"으로 보임)
- ephemeral 디스크 → 런타임 캐시가 재시작마다 날아감. **시드 데이터는 반드시 이미지 빌드 시점에 포함**시켜야 함
- Root Directory 설정은 모노레포에 유용하지만 **밖의 변경은 통째로 무시**됨

---

*이 파일은 회고를 모아두는 곳이다. 새 장애를 겪으면 같은 형식으로 위에 한 섹션 추가할 것.*
