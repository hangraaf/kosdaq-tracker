FROM python:3.12-slim

WORKDIR /app

# 의존성 캐시 레이어
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY . .

# data 디렉터리 (볼륨 마운트 없을 때 로컬 fallback)
RUN mkdir -p data

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
