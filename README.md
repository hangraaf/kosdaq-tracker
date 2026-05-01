# Korea Stock Tracker

KOSPI · KOSDAQ 종목 추적, 차트, 포트폴리오, 투자 대가 조언 제공 Streamlit 웹앱.

## 로컬 실행

```bash
pip install -r requirements.txt
streamlit run app.py
```

KIS API 없이도 **데모 모드**로 동작합니다.

## KIS API 연동 (선택)

`.streamlit/secrets.toml.example`을 `.streamlit/secrets.toml`로 복사 후 키 입력:

```toml
[kis]
app_key    = "..."
app_secret = "..."
env        = "prod"
```

KIS Developers: https://apiportal.koreainvestment.com
