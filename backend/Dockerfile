FROM python:3.12-slim

WORKDIR /app

# 의존성 캐시 레이어
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY . .

# data 디렉터리 (Render 무료: 재시작 시 초기화됨 — 캐시 용도이므로 무방)
RUN mkdir -p data

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
