# Mr. Stock Buddy — KOSPI · KOSDAQ Tracker v2

PRISM™ 기반 한국 주식 트래커. **FastAPI + Next.js** 풀스택 아키텍처.

---

## 로컬 개발 실행

### 백엔드 (FastAPI — port 8000)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드 (Next.js — port 3000)
```bash
cd frontend
npm install
npm run dev
```

KIS API 키 없이도 **DEMO 모드**로 전체 기능이 동작합니다.

---

## 환경 변수

### backend/.env
```env
SECRET_KEY=your-jwt-secret
KIS_APP_KEY=your_kis_app_key
KIS_APP_SECRET=your_kis_app_secret
KIS_ENV=prod
TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
CORS_ORIGINS_EXTRA=https://your-app.vercel.app
```

### frontend/.env.local
```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

---

## 배포

### 프론트엔드 — Vercel
1. [vercel.com](https://vercel.com) → New Project → `frontend/` 폴더 선택
2. Environment Variables에 `NEXT_PUBLIC_API_URL` 설정
3. 자동 배포 완료

### 백엔드 — Railway
1. [railway.app](https://railway.app) → New Project → GitHub 연결
2. Root Directory를 `backend/`로 설정
3. Environment Variables에 위의 백엔드 환경변수 입력
4. `railway.toml`이 자동으로 Docker 빌드를 처리

---

## API 문서
백엔드 실행 후 → http://localhost:8000/docs

---

## 기술 스택

| | 기술 |
|---|---|
| 프론트엔드 | Next.js 14 · TypeScript · Tailwind CSS |
| 차트 | TradingView Lightweight Charts |
| 상태관리 | Zustand |
| 백엔드 | FastAPI · Uvicorn |
| 인증 | JWT (python-jose) |
| 결제 | 토스페이먼츠 |
| 데이터 | 한국투자증권 KIS Open API |
| 배포 | Vercel (FE) · Railway (BE) |

---

> PRISM™(Predictive Resonance Index for Stock Momentum)은 자체 개발 기술적 스코어링 엔진입니다.
