"""Korea stock chart tracker with optional Korea Investment API integration."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from kis_client import KISClient, KISConfig, KISError, config_from_env


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
FAVORITES_FILE = DATA_DIR / "favorites.json"
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"
TOKEN_FILE = DATA_DIR / "kis_token.json"
EXTERNAL_SIGNALS_FILE = DATA_DIR / "external_signals.json"


@dataclass(frozen=True)
class Stock:
    code: str
    name: str
    market: str
    sector: str
    base_price: int


KOSPI_STOCKS: list[Stock] = [
    # 반도체·전자
    Stock("005930", "삼성전자", "KOSPI", "반도체", 76000),
    Stock("000660", "SK하이닉스", "KOSPI", "반도체", 176000),
    Stock("009150", "삼성전기", "KOSPI", "반도체", 140000),
    Stock("011070", "LG이노텍", "KOSPI", "전자부품", 170000),
    Stock("018260", "삼성SDS", "KOSPI", "IT서비스", 155000),
    Stock("066570", "LG전자", "KOSPI", "전자", 95000),
    # 통신
    Stock("017670", "SK텔레콤", "KOSPI", "통신", 52000),
    Stock("030200", "KT", "KOSPI", "통신", 40000),
    Stock("032640", "LG유플러스", "KOSPI", "통신", 11000),
    # 인터넷·플랫폼
    Stock("035420", "NAVER", "KOSPI", "인터넷", 184000),
    Stock("035720", "카카오", "KOSPI", "인터넷", 48500),
    Stock("323410", "카카오뱅크", "KOSPI", "금융", 27000),
    Stock("377300", "카카오페이", "KOSPI", "금융", 27000),
    # 게임
    Stock("259960", "크래프톤", "KOSPI", "게임", 260000),
    Stock("036570", "엔씨소프트", "KOSPI", "게임", 200000),
    Stock("251270", "넷마블", "KOSPI", "게임", 55000),
    # 엔터
    Stock("352820", "하이브", "KOSPI", "엔터", 195000),
    Stock("035760", "CJ ENM", "KOSPI", "미디어", 55000),
    # 바이오·제약
    Stock("207940", "삼성바이오로직스", "KOSPI", "바이오", 825000),
    Stock("068270", "셀트리온", "KOSPI", "바이오", 184000),
    Stock("128940", "한미약품", "KOSPI", "제약", 320000),
    Stock("000100", "유한양행", "KOSPI", "제약", 95000),
    Stock("185750", "종근당", "KOSPI", "제약", 110000),
    Stock("006280", "녹십자", "KOSPI", "제약", 110000),
    Stock("170900", "동아에스티", "KOSPI", "제약", 78000),
    Stock("326030", "SK바이오팜", "KOSPI", "바이오", 82000),
    # 2차전지
    Stock("373220", "LG에너지솔루션", "KOSPI", "2차전지", 392000),
    Stock("006400", "삼성SDI", "KOSPI", "2차전지", 356000),
    # 화학
    Stock("051910", "LG화학", "KOSPI", "화학", 382000),
    Stock("009830", "한화솔루션", "KOSPI", "화학", 28000),
    Stock("011170", "롯데케미칼", "KOSPI", "화학", 98000),
    Stock("011780", "금호석유", "KOSPI", "화학", 80000),
    Stock("285130", "SK케미칼", "KOSPI", "화학", 55000),
    Stock("010060", "OCI홀딩스", "KOSPI", "화학", 80000),
    # 자동차
    Stock("005380", "현대차", "KOSPI", "자동차", 243000),
    Stock("000270", "기아", "KOSPI", "자동차", 108000),
    Stock("012330", "현대모비스", "KOSPI", "자동차부품", 231000),
    Stock("018880", "한온시스템", "KOSPI", "자동차부품", 7000),
    Stock("161390", "한국타이어앤테크놀로지", "KOSPI", "타이어", 47000),
    Stock("002350", "넥센타이어", "KOSPI", "타이어", 8000),
    Stock("073240", "금호타이어", "KOSPI", "타이어", 7000),
    Stock("086280", "현대글로비스", "KOSPI", "물류", 130000),
    # 조선·중공업
    Stock("009540", "HD한국조선해양", "KOSPI", "조선", 190000),
    Stock("010140", "삼성중공업", "KOSPI", "조선", 12000),
    Stock("010620", "현대미포조선", "KOSPI", "조선", 80000),
    Stock("042660", "한화오션", "KOSPI", "조선", 27000),
    Stock("267250", "HD현대", "KOSPI", "지주", 78000),
    Stock("267260", "HD현대일렉트릭", "KOSPI", "전기기기", 220000),
    # 두산 그룹
    Stock("034020", "두산에너빌리티", "KOSPI", "중공업", 25000),
    Stock("241560", "두산밥캣", "KOSPI", "기계", 42000),
    Stock("336260", "두산퓨얼셀", "KOSPI", "에너지", 18000),
    Stock("000150", "두산", "KOSPI", "지주", 130000),
    Stock("454910", "두산로보틱스", "KOSPI", "로보틱스", 45000),
    # 건설
    Stock("000720", "현대건설", "KOSPI", "건설", 30000),
    Stock("028050", "삼성엔지니어링", "KOSPI", "건설", 30000),
    Stock("006360", "GS건설", "KOSPI", "건설", 17000),
    Stock("047040", "대우건설", "KOSPI", "건설", 5000),
    Stock("000210", "DL이앤씨", "KOSPI", "건설", 40000),
    Stock("028260", "삼성물산", "KOSPI", "건설·지주", 150000),
    # 철강·소재
    Stock("005490", "POSCO홀딩스", "KOSPI", "철강", 412000),
    Stock("004020", "현대제철", "KOSPI", "철강", 28000),
    Stock("010130", "고려아연", "KOSPI", "비철금속", 620000),
    Stock("001120", "LX홀딩스", "KOSPI", "지주", 13000),
    # 금융
    Stock("055550", "신한지주", "KOSPI", "금융", 47600),
    Stock("105560", "KB금융", "KOSPI", "금융", 74500),
    Stock("086790", "하나금융지주", "KOSPI", "금융", 65000),
    Stock("316140", "우리금융지주", "KOSPI", "금융", 15000),
    Stock("138040", "메리츠금융지주", "KOSPI", "금융", 100000),
    Stock("016360", "삼성증권", "KOSPI", "증권", 44000),
    Stock("006800", "미래에셋증권", "KOSPI", "증권", 10000),
    Stock("005940", "NH투자증권", "KOSPI", "증권", 14000),
    # 보험
    Stock("032830", "삼성생명", "KOSPI", "보험", 85000),
    Stock("000810", "삼성화재", "KOSPI", "보험", 310000),
    Stock("005830", "DB손해보험", "KOSPI", "보험", 98000),
    Stock("001450", "현대해상", "KOSPI", "보험", 37000),
    Stock("088350", "한화생명", "KOSPI", "보험", 4000),
    # 에너지·정유
    Stock("015760", "한국전력", "KOSPI", "에너지", 22000),
    Stock("036460", "한국가스공사", "KOSPI", "에너지", 45000),
    Stock("010950", "S-Oil", "KOSPI", "정유", 72000),
    Stock("096770", "SK이노베이션", "KOSPI", "정유", 110000),
    # 지주
    Stock("034730", "SK", "KOSPI", "지주", 180000),
    Stock("003550", "LG", "KOSPI", "지주", 82000),
    Stock("078930", "GS", "KOSPI", "지주", 47000),
    Stock("000880", "한화", "KOSPI", "지주", 35000),
    Stock("004990", "롯데지주", "KOSPI", "지주", 25000),
    Stock("006260", "LS", "KOSPI", "지주", 130000),
    Stock("004800", "효성", "KOSPI", "지주", 65000),
    Stock("001040", "CJ", "KOSPI", "지주", 90000),
    # 유통·소비
    Stock("023530", "롯데쇼핑", "KOSPI", "유통", 70000),
    Stock("004170", "신세계", "KOSPI", "유통", 170000),
    Stock("139480", "이마트", "KOSPI", "유통", 70000),
    Stock("069960", "현대백화점", "KOSPI", "유통", 55000),
    Stock("007070", "GS리테일", "KOSPI", "유통", 24000),
    Stock("282330", "BGF리테일", "KOSPI", "유통", 150000),
    # 식품·음료
    Stock("097950", "CJ제일제당", "KOSPI", "식품", 280000),
    Stock("005300", "롯데칠성음료", "KOSPI", "음료", 140000),
    Stock("000080", "하이트진로", "KOSPI", "음료", 23000),
    Stock("271560", "오리온", "KOSPI", "식품", 105000),
    Stock("004370", "농심", "KOSPI", "식품", 365000),
    Stock("005180", "빙그레", "KOSPI", "식품", 58000),
    Stock("033780", "KT&G", "KOSPI", "담배", 98000),
    # 화장품
    Stock("090430", "아모레퍼시픽", "KOSPI", "화장품", 120000),
    Stock("051900", "LG생활건강", "KOSPI", "화장품", 380000),
    Stock("161890", "한국콜마", "KOSPI", "화장품", 62000),
    Stock("120110", "코스맥스", "KOSPI", "화장품", 85000),
    # 항공·물류
    Stock("003490", "대한항공", "KOSPI", "항공", 22000),
    Stock("020560", "아시아나항공", "KOSPI", "항공", 13000),
    Stock("000120", "CJ대한통운", "KOSPI", "물류", 130000),
    Stock("011200", "HMM", "KOSPI", "해운", 18000),
    Stock("180640", "한진칼", "KOSPI", "지주", 80000),
    # 방산
    Stock("012450", "한화에어로스페이스", "KOSPI", "방산", 220000),
    Stock("047810", "한국항공우주", "KOSPI", "방산", 62000),
    Stock("064350", "현대로템", "KOSPI", "방산", 45000),
    # 레저
    Stock("035250", "강원랜드", "KOSPI", "레저", 14000),
    Stock("034230", "파라다이스", "KOSPI", "레저", 14000),
    # POSCO 계열
    Stock("022100", "포스코DX", "KOSPI", "IT서비스", 20000),
    Stock("003670", "포스코퓨처엠", "KOSPI", "2차전지소재", 130000),
    Stock("047050", "포스코인터내셔널", "KOSPI", "상사", 63000),
    # HD현대 계열 추가
    Stock("329180", "HD현대중공업", "KOSPI", "조선", 230000),
    Stock("042670", "HD현대인프라코어", "KOSPI", "기계", 14000),
    Stock("267270", "현대건설기계", "KOSPI", "기계", 55000),
    # LS·효성 계열
    Stock("010120", "LS ELECTRIC", "KOSPI", "전기기기", 130000),
    Stock("298040", "효성중공업", "KOSPI", "전기기기", 315000),
    Stock("017800", "현대엘리베이터", "KOSPI", "기계", 85000),
    # 자동차부품 추가
    Stock("011210", "현대위아", "KOSPI", "자동차부품", 60000),
    Stock("204320", "에이치엘만도", "KOSPI", "자동차부품", 45000),
    # 2차전지소재 추가
    Stock("361610", "SK아이이테크놀로지", "KOSPI", "2차전지소재", 80000),
    Stock("450080", "에코프로머티리얼즈", "KOSPI", "2차전지소재", 55000),
    # 에너지 추가
    Stock("051600", "한전KPS", "KOSPI", "에너지서비스", 45000),
    Stock("052690", "한전기술", "KOSPI", "에너지서비스", 55000),
    Stock("279570", "케이뱅크", "KOSPI", "금융", 9000),
    # 바이오·제약 추가
    Stock("302440", "SK바이오사이언스", "KOSPI", "바이오", 75000),
    Stock("069620", "대웅제약", "KOSPI", "제약", 140000),
    Stock("003850", "보령", "KOSPI", "제약", 14000),
    Stock("001060", "JW중외제약", "KOSPI", "제약", 22000),
    Stock("009290", "광동제약", "KOSPI", "제약", 8000),
    Stock("085710", "차바이오텍", "KOSPI", "바이오", 18000),
    # 식품 추가
    Stock("007310", "오뚜기", "KOSPI", "식품", 450000),
    Stock("003230", "삼양식품", "KOSPI", "식품", 850000),
    Stock("001680", "대상", "KOSPI", "식품", 23000),
    Stock("280360", "롯데웰푸드", "KOSPI", "식품", 115000),
    Stock("267980", "매일유업", "KOSPI", "식품", 75000),
    # 화학·소재 추가
    Stock("002380", "KCC", "KOSPI", "화학·건자재", 280000),
    Stock("014680", "한솔케미칼", "KOSPI", "화학", 280000),
    Stock("004000", "롯데정밀화학", "KOSPI", "화학", 48000),
    Stock("103140", "풍산", "KOSPI", "비철금속", 55000),
    Stock("001230", "동국제강", "KOSPI", "철강", 15000),
    Stock("001430", "세아베스틸지주", "KOSPI", "철강", 12000),
    # 광고·서비스
    Stock("030000", "제일기획", "KOSPI", "광고", 20000),
    Stock("214320", "이노션", "KOSPI", "광고", 65000),
    Stock("012750", "에스원", "KOSPI", "보안서비스", 73000),
    # 화장품 추가
    Stock("002790", "아모레G", "KOSPI", "화장품", 42000),
    Stock("018250", "애경산업", "KOSPI", "화장품", 30000),
    # 가구·인테리어
    Stock("009240", "한샘", "KOSPI", "가구", 55000),
    Stock("079430", "현대리바트", "KOSPI", "가구", 12000),
    # 렌터카·서비스
    Stock("089860", "롯데렌탈", "KOSPI", "서비스", 28000),
    # 증권 추가
    Stock("003530", "한화투자증권", "KOSPI", "증권", 4000),
    Stock("001500", "현대차증권", "KOSPI", "증권", 8000),
    Stock("003460", "유화증권", "KOSPI", "증권", 5000),
    # 제지·섬유
    Stock("009180", "한솔홀딩스", "KOSPI", "지주", 12000),
    Stock("001460", "BYC", "KOSPI", "섬유", 300000),
    # 기타 대형주
    Stock("402340", "SK스퀘어", "KOSPI", "IT지주", 65000),
]

KOSDAQ_STOCKS: list[Stock] = [
    # 2차전지·소재
    Stock("247540", "에코프로비엠", "KOSDAQ", "2차전지", 184000),
    Stock("086520", "에코프로", "KOSDAQ", "지주/소재", 672000),
    Stock("066970", "엘앤에프", "KOSDAQ", "2차전지소재", 145000),
    Stock("294630", "에코앤드림", "KOSDAQ", "2차전지소재", 24000),
    Stock("025560", "미래나노텍", "KOSDAQ", "2차전지소재", 12000),
    # 바이오·제약
    Stock("091990", "셀트리온헬스케어", "KOSDAQ", "바이오", 76200),
    Stock("028300", "HLB", "KOSDAQ", "바이오", 60400),
    Stock("068760", "셀트리온제약", "KOSDAQ", "바이오", 104300),
    Stock("196170", "알테오젠", "KOSDAQ", "바이오", 212500),
    Stock("145020", "휴젤", "KOSDAQ", "바이오", 186400),
    Stock("064550", "바이오니아", "KOSDAQ", "바이오", 31400),
    Stock("237690", "에스티팜", "KOSDAQ", "바이오", 80000),
    Stock("086900", "메디톡스", "KOSDAQ", "바이오", 170000),
    Stock("141080", "레고켐바이오", "KOSDAQ", "바이오", 52000),
    Stock("039200", "오스코텍", "KOSDAQ", "바이오", 44000),
    Stock("321550", "티움바이오", "KOSDAQ", "바이오", 9000),
    Stock("206650", "유바이오로직스", "KOSDAQ", "바이오", 8000),
    Stock("950130", "엑시노젠", "KOSDAQ", "바이오", 14000),
    Stock("310210", "보로노이", "KOSDAQ", "바이오", 38000),
    Stock("347700", "스카이바이오텍", "KOSDAQ", "바이오", 9000),
    # 의료기기
    Stock("214150", "클래시스", "KOSDAQ", "의료기기", 45200),
    Stock("322510", "제이시스메디칼", "KOSDAQ", "의료기기", 19000),
    Stock("335890", "비올", "KOSDAQ", "의료기기", 18000),
    Stock("214450", "파마리서치", "KOSDAQ", "의료기기", 120000),
    Stock("216080", "제테마", "KOSDAQ", "의료기기", 22000),
    Stock("328130", "루닛", "KOSDAQ", "AI·의료", 52000),
    Stock("338220", "뷰노", "KOSDAQ", "AI·의료", 22000),
    # 반도체·장비·소재
    Stock("067310", "하나마이크론", "KOSDAQ", "반도체", 24300),
    Stock("058470", "리노공업", "KOSDAQ", "반도체", 198500),
    Stock("039030", "이오테크닉스", "KOSDAQ", "반도체", 167800),
    Stock("357780", "솔브레인", "KOSDAQ", "반도체소재", 289000),
    Stock("403870", "HPSP", "KOSDAQ", "반도체장비", 38600),
    Stock("036830", "솔브레인홀딩스", "KOSDAQ", "반도체소재", 32000),
    Stock("137400", "피엔티", "KOSDAQ", "반도체장비", 78000),
    Stock("238490", "피에스케이", "KOSDAQ", "반도체장비", 36000),
    Stock("056190", "에스에프에이", "KOSDAQ", "반도체장비", 35000),
    Stock("240810", "원익IPS", "KOSDAQ", "반도체장비", 34000),
    Stock("089030", "테크윙", "KOSDAQ", "반도체장비", 28000),
    Stock("095340", "ISC", "KOSDAQ", "반도체소재", 32000),
    Stock("033640", "네패스", "KOSDAQ", "반도체", 14000),
    Stock("036810", "에프에스티", "KOSDAQ", "반도체장비", 22000),
    Stock("102940", "코오롱인더스트리", "KOSDAQ", "반도체소재", 46000),
    # 게임
    Stock("263750", "펄어비스", "KOSDAQ", "게임", 38600),
    Stock("293490", "카카오게임즈", "KOSDAQ", "게임", 22100),
    Stock("112040", "위메이드", "KOSDAQ", "게임", 51200),
    Stock("101730", "위메이드맥스", "KOSDAQ", "게임", 13600),
    Stock("225570", "넥슨게임즈", "KOSDAQ", "게임", 14000),
    Stock("078340", "컴투스", "KOSDAQ", "게임", 46000),
    Stock("095660", "네오위즈", "KOSDAQ", "게임", 19000),
    Stock("069080", "웹젠", "KOSDAQ", "게임", 17000),
    Stock("192080", "더블유게임즈", "KOSDAQ", "게임", 35000),
    Stock("194480", "데브시스터즈", "KOSDAQ", "게임", 40000),
    # 엔터
    Stock("035900", "JYP Ent.", "KOSDAQ", "엔터", 72400),
    Stock("041510", "에스엠", "KOSDAQ", "엔터", 92700),
    Stock("122870", "와이지엔터테인먼트", "KOSDAQ", "엔터", 42000),
    Stock("253450", "스튜디오드래곤", "KOSDAQ", "엔터", 60000),
    Stock("173940", "FNC엔터테인먼트", "KOSDAQ", "엔터", 5000),
    Stock("182360", "큐브엔터테인먼트", "KOSDAQ", "엔터", 12000),
    # IT·소프트웨어
    Stock("053800", "안랩", "KOSDAQ", "소프트웨어", 78000),
    Stock("041020", "폴라리스오피스", "KOSDAQ", "소프트웨어", 6000),
    Stock("236340", "더존비즈온", "KOSDAQ", "소프트웨어", 52000),
    Stock("079940", "가비아", "KOSDAQ", "IT서비스", 15000),
    Stock("048410", "현대오토에버", "KOSDAQ", "IT서비스", 195000),
    # 화장품·뷰티
    Stock("257720", "실리콘투", "KOSDAQ", "화장품", 26000),
    Stock("278470", "에이피알", "KOSDAQ", "화장품", 75000),
    Stock("234080", "JM솔루션", "KOSDAQ", "화장품", 5000),
    # 증권·금융
    Stock("039490", "키움증권", "KOSDAQ", "증권", 130000),
    # 여행·유통·패션
    Stock("039130", "하나투어", "KOSDAQ", "여행", 62000),
    Stock("080160", "모두투어", "KOSDAQ", "여행", 14000),
    Stock("031430", "신세계인터내셔날", "KOSDAQ", "패션", 18000),
    # 기타 제조·소재
    Stock("036560", "더존비즈온홀딩스", "KOSDAQ", "소프트웨어", 18000),
    Stock("065060", "지씨셀", "KOSDAQ", "바이오", 23000),
    Stock("200130", "콜마비앤에이치", "KOSDAQ", "화장품", 26000),
    # 반도체 장비·소재 추가
    Stock("042700", "한미반도체", "KOSDAQ", "반도체장비", 170000),
    Stock("222800", "심텍", "KOSDAQ", "반도체기판", 28000),
    Stock("166090", "하나머티리얼즈", "KOSDAQ", "반도체소재", 62000),
    Stock("131290", "두산테스나", "KOSDAQ", "반도체테스트", 55000),
    Stock("399720", "가온칩스", "KOSDAQ", "반도체설계", 82000),
    Stock("322820", "오로스테크놀로지", "KOSDAQ", "반도체장비", 19000),
    Stock("019490", "현대힘스", "KOSDAQ", "반도체장비", 22000),
    Stock("007660", "이수페타시스", "KOSDAQ", "PCB", 28000),
    Stock("030530", "원익홀딩스", "KOSDAQ", "반도체지주", 8000),
    # 바이오 추가
    Stock("067630", "HLB생명과학", "KOSDAQ", "바이오", 11000),
    Stock("115450", "HLB테라퓨틱스", "KOSDAQ", "바이오", 8000),
    Stock("096530", "씨젠", "KOSDAQ", "바이오·진단", 25000),
    Stock("038290", "마크로젠", "KOSDAQ", "바이오", 35000),
    Stock("298060", "에스씨엠생명과학", "KOSDAQ", "바이오", 6000),
    Stock("298380", "에이비엘바이오", "KOSDAQ", "바이오", 20000),
    Stock("049630", "동국제약", "KOSDAQ", "제약", 18000),
    # 의료기기 추가
    Stock("145720", "덴티움", "KOSDAQ", "의료기기", 90000),
    Stock("043150", "바텍", "KOSDAQ", "의료기기", 45000),
    Stock("041830", "인바디", "KOSDAQ", "의료기기", 35000),
    Stock("048260", "오스템임플란트", "KOSDAQ", "의료기기", 190000),
    # 화장품 추가
    Stock("237880", "클리오", "KOSDAQ", "화장품", 20000),
    Stock("226320", "잇츠한불", "KOSDAQ", "화장품", 8000),
    Stock("230360", "에코마케팅", "KOSDAQ", "디지털마케팅", 16000),
    # IT·소프트웨어 추가
    Stock("053580", "웹케시", "KOSDAQ", "소프트웨어", 18000),
    Stock("263800", "서진시스템", "KOSDAQ", "IT서비스", 25000),
    Stock("095470", "제이씨현시스템", "KOSDAQ", "IT서비스", 4000),
    # 게임 추가
    Stock("041190", "우리기술투자", "KOSDAQ", "게임", 5000),
    Stock("140910", "에스엠씨지", "KOSDAQ", "게임", 7000),
    # 소재·화학
    Stock("336570", "원텍", "KOSDAQ", "의료기기", 10000),
    Stock("048870", "에스피지", "KOSDAQ", "기계", 22000),
    Stock("950210", "프레스티지바이오파마", "KOSDAQ", "바이오", 9000),
    # 로봇·자동화
    Stock("277810", "레인보우로보틱스", "KOSDAQ", "로보틱스", 85000),
    Stock("108490", "로보티즈", "KOSDAQ", "로보틱스", 38000),
    Stock("090360", "로보스타", "KOSDAQ", "산업로봇", 32000),
    Stock("056080", "유진로봇", "KOSDAQ", "로보틱스", 8000),
    Stock("348340", "뉴로메카", "KOSDAQ", "로보틱스", 22000),
    Stock("215100", "오토닉스", "KOSDAQ", "산업자동화", 55000),
    Stock("083310", "에스티아이", "KOSDAQ", "산업자동화", 15000),
]

MARKET_STOCKS = {
    "코스피": KOSPI_STOCKS,
    "코스닥": KOSDAQ_STOCKS,
    "전체": KOSPI_STOCKS + KOSDAQ_STOCKS,
}

PERIODS = {"1개월": 22, "3개월": 65, "6개월": 130, "1년": 252, "2년": 504}


BH_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&family=Nanum+Gothic+Coding:wght@400;700&family=Nanum+Myeongjo:wght@400;700;800&display=swap');

/* ── 오프화이트 라이트 테마 — 나눔고딕 ──────────
   따뜻한 오프화이트 배경 · 나눔고딕 본문 · 나눔명조 제목
   깔끔한 그리드 · 최소 장식
   ─────────────────────────────────────────────── */
:root {
  /* 배경 — 따뜻한 오프화이트 */
  --bg:       #F5F1EB;
  --surf:     #EDE9E2;
  --surf2:    #E5E0D8;
  --surf-warm:#DDD8D0;
  --grid:     #D4CFC6;
  --border:   #C2BCB4;
  --border2:  #ABA5A0;

  /* 색상 — 라이트 배경용 진한 어스톤 */
  --red:      #C03828;      /* 테라코타 (상승) */
  --blue:     #2858A0;      /* 딥 인디고 (하락) */
  --yellow:   #9C7030;      /* 웜 앰버 (메인 강조) */
  --cyan:     #3A6858;      /* 딥 세이지 (보조) */
  --magenta:  #685878;      /* 덤 라벤더 (예비) */

  /* 텍스트 — 어두운 웜 계열 */
  --white:    #1C1916;      /* 기본 텍스트 (거의 검정) */
  --fg:       #3D3830;      /* 보조 텍스트 */
  --muted:    #7A726A;      /* 흐린 텍스트 */
  --muted2:   #A8A09A;      /* 더 흐린 텍스트 */

  /* 글로우 없음 */
  --glow-y:   none;
  --glow-r:   none;
  --glow-b:   none;
  --glow-c:   none;

  /* 타이포 — 나눔명조(제목) + 나눔고딕(본문) + 나눔고딕코딩(숫자) */
  --serif:    'Nanum Myeongjo', serif;
  --font:     'Nanum Gothic', sans-serif;
  --mono:     'Nanum Gothic Coding', 'Nanum Gothic', monospace;
  color-scheme: light;
}

/* ── Base ────────────────────────────────────── */
body, .stApp {
  background: var(--bg) !important;
  color: var(--white) !important;
  font-family: var(--font) !important;
  font-weight: 400 !important;
  line-height: 1.7 !important;
}

/* ── Sidebar ─────────────────────────────────── */
[data-testid="stSidebar"] {
  background: var(--surf) !important;
  border-right: 1px solid var(--border) !important;
}
[data-testid="stSidebar"] label {
  font-family: var(--font) !important;
  font-weight: 700 !important;
  font-size: 0.9rem !important;
  color: var(--fg) !important;
}

/* ── Typography ──────────────────────────────── */
h1 {
  font-family: var(--serif) !important;
  font-size: 1.5rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.01em !important;
  border-left: 3px solid var(--yellow) !important;
  padding-left: 16px !important;
  margin-bottom: 8px !important;
  color: var(--white) !important;
}
h2 {
  font-family: var(--serif) !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.01em !important;
  color: var(--fg) !important;
  margin-top: 28px !important;
  margin-bottom: 10px !important;
}
h3 {
  font-family: var(--font) !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  color: var(--fg) !important;
  letter-spacing: 0.01em !important;
}

/* ── Metric blocks ───────────────────────────── */
div[data-testid="stMetric"] {
  background: var(--surf2) !important;
  border: 1px solid var(--border) !important;
  border-top: 2px solid var(--yellow) !important;
  border-radius: 0 !important;
  padding: 14px 16px !important;
  overflow: visible !important;
}
div[data-testid="stMetric"] label {
  font-family: var(--font) !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  color: var(--muted) !important;
  font-weight: 700 !important;
  white-space: normal !important;
}
div[data-testid="stMetric"] [data-testid="stMetricValue"] {
  font-family: var(--mono) !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em !important;
  color: var(--white) !important;
  overflow: visible !important;
  white-space: nowrap !important;
}
div[data-testid="stMetric"] [data-testid="stMetricValue"] > div {
  overflow: visible !important;
  white-space: nowrap !important;
}
div[data-testid="stMetricValue"] {
  overflow: visible !important;
  white-space: nowrap !important;
}
div[data-testid="stMetric"] [data-testid="stMetricDelta"] {
  font-family: var(--mono) !important;
  font-size: 0.82rem !important;
  white-space: nowrap !important;
}

/* ── Buttons ─────────────────────────────────── */
.stButton > button {
  border-radius: 2px !important;
  font-family: var(--font) !important;
  font-weight: 700 !important;
  font-size: 0.85rem !important;
  letter-spacing: 0.04em !important;
  text-transform: none !important;
  transition: all 0.2s !important;
}
.stButton > button[kind="primary"] {
  background: var(--yellow) !important;
  color: #FFFFFF !important;
  border: 1px solid var(--yellow) !important;
}
.stButton > button[kind="primary"]:hover {
  background: transparent !important;
  color: var(--yellow) !important;
  border-color: var(--yellow) !important;
}
.stButton > button[kind="secondary"] {
  background: var(--surf2) !important;
  color: var(--fg) !important;
  border: 1px solid var(--border2) !important;
}
.stButton > button[kind="secondary"]:hover {
  border-color: var(--yellow) !important;
  color: var(--yellow) !important;
}

/* ── Inputs ──────────────────────────────────── */
.stTextInput input, .stNumberInput input {
  background: #FFFFFF !important;
  border: 1px solid var(--border2) !important;
  border-radius: 2px !important;
  color: var(--white) !important;
  font-family: var(--font) !important;
  font-size: 0.9rem !important;
  font-weight: 400 !important;
}
.stTextInput input:focus, .stNumberInput input:focus {
  border-color: var(--yellow) !important;
  box-shadow: 0 0 0 2px rgba(156,112,48,0.15) !important;
  outline: none !important;
}
[data-baseweb="select"] > div {
  background: #FFFFFF !important;
  border: 1px solid var(--border2) !important;
  border-radius: 2px !important;
  font-family: var(--font) !important;
  color: var(--white) !important;
}

/* ── Tabs ────────────────────────────────────── */
[data-testid="stTabs"] [data-baseweb="tab-list"] {
  background: transparent !important;
  border-bottom: 1px solid var(--border2) !important;
  gap: 0 !important;
}
[data-testid="stTabs"] [data-baseweb="tab"] {
  background: transparent !important;
  font-family: var(--font) !important;
  font-weight: 700 !important;
  font-size: 0.88rem !important;
  letter-spacing: 0.02em !important;
  text-transform: none !important;
  padding: 10px 22px !important;
  border-radius: 0 !important;
  color: var(--muted) !important;
}
[data-testid="stTabs"] [aria-selected="true"] {
  color: var(--white) !important;
  border-bottom: 2px solid var(--yellow) !important;
  font-weight: 800 !important;
}

/* ── Expanders ───────────────────────────────── */
[data-testid="stExpander"] {
  border: 1px solid var(--border) !important;
  border-left: 2px solid var(--border2) !important;
  border-radius: 2px !important;
  background: var(--surf) !important;
}
[data-testid="stExpander"] summary {
  font-family: var(--font) !important;
  font-weight: 700 !important;
  font-size: 0.92rem !important;
  letter-spacing: 0.01em !important;
  color: var(--fg) !important;
}

/* ── Dataframe ───────────────────────────────── */
[data-testid="stDataFrame"] {
  border: 1px solid var(--border) !important;
  border-radius: 0 !important;
}
[data-testid="stDataFrame"] th {
  font-family: var(--font) !important;
  font-size: 0.72rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  background: var(--grid) !important;
  color: var(--muted) !important;
}

/* ── Alerts ──────────────────────────────────── */
[data-testid="stAlert"] {
  border-radius: 2px !important;
  border-width: 1px !important;
  border-left-width: 3px !important;
}

/* ── Blockquotes ─────────────────────────────── */
blockquote {
  border-left: 2px solid var(--yellow) !important;
  background: var(--surf2) !important;
  padding: 14px 20px !important;
  margin: 16px 0 !important;
  color: var(--fg) !important;
  font-family: var(--serif) !important;
  font-size: 0.9rem !important;
  font-weight: 400 !important;
  font-style: italic !important;
}

/* ── Caption ─────────────────────────────────── */
[data-testid="stCaptionContainer"] {
  font-family: var(--font) !important;
  color: var(--muted) !important;
  font-size: 0.76rem !important;
  letter-spacing: 0.02em !important;
  padding: 2px 0 !important;
  background: transparent !important;
}

/* ── Divider ─────────────────────────────────── */
hr {
  border-color: var(--border) !important;
  margin: 32px 0 !important;
  opacity: 0.8 !important;
}

/* ── Sidebar 검색 결과 버튼 ──────────────────── */
[data-testid="stSidebar"] .stButton > button {
  text-align: left !important;
  justify-content: flex-start !important;
  font-size: 0.88rem !important;
  font-weight: 400 !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid var(--border) !important;
  color: var(--fg) !important;
  padding: 8px 4px !important;
  height: auto !important;
  min-height: 0 !important;
  border-radius: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
[data-testid="stSidebar"] .stButton > button:hover {
  background: var(--surf2) !important;
  color: var(--yellow) !important;
  border-bottom-color: var(--yellow) !important;
  padding-left: 8px !important;
}

/* ── Toggle ──────────────────────────────────── */
[data-testid="stToggle"] span[data-checked="true"] {
  background: var(--yellow) !important;
}

/* ── Radio ───────────────────────────────────── */
[data-testid="stRadio"] label {
  font-family: var(--font) !important;
  font-weight: 400 !important;
  font-size: 0.9rem !important;
  color: var(--fg) !important;
}

/* ── Grid 컨테이너 통일 ──────────────────────── */
[data-testid="stHorizontalBlock"] {
  gap: 16px !important;
  align-items: stretch !important;
}
[data-testid="column"] {
  padding: 0 !important;
}
.block-container {
  padding-top: 2rem !important;
  padding-bottom: 2rem !important;
  max-width: 1200px !important;
}

/* ── Stock cards ─────────────────────────────── */
.bh-card {
  background: #FFFFFF;
  border: 1px solid var(--border);
  border-left: 3px solid var(--border2);
  padding: 18px 16px 14px;
  min-height: 155px;
  margin-bottom: 4px;
  border-radius: 2px;
}
.bh-card.up   { border-left-color: var(--red); }
.bh-card.down { border-left-color: var(--blue); }

.bh-tag {
  font-family: var(--font);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
}
.bh-name {
  font-family: var(--font);
  font-size: 1.0rem;
  font-weight: 800;
  margin: 0 0 10px;
  color: var(--white);
  letter-spacing: 0;
}
.bh-price {
  font-family: var(--mono);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--fg);
}
.bh-delta { font-family: var(--mono); font-size: 0.82rem; margin-top: 4px; font-weight: 700; }
.bh-delta.up   { color: var(--red); }
.bh-delta.down { color: var(--blue); }
.bh-delta.flat { color: var(--muted); }

/* ── Sidebar 로고 — 80s Bauhaus ─────────────── */
.bh-logo {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
  padding-bottom: 22px;
  border-bottom: 3px solid var(--yellow);
}
.bh-logo-mark {
  width: 54px; height: 54px;
  background: var(--white);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  gap: 0;
}
/* 왼쪽 황금 수직 바 — 바우하우스 그리드 강조 */
.bh-logo-mark::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 6px;
  background: var(--yellow);
}
/* 하단 얇은 황금 줄 */
.bh-logo-mark::after {
  content: '';
  position: absolute;
  bottom: 0; left: 6px; right: 0;
  height: 3px;
  background: var(--yellow);
  opacity: 0.6;
}
.bh-logo-tri {
  font-size: 1.6rem;
  color: var(--yellow);
  line-height: 1;
  margin-left: 4px;
}
.bh-logo-krx {
  font-family: var(--font);
  font-size: 0.46rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: rgba(255,255,255,0.55);
  margin-top: 1px;
  margin-left: 4px;
  text-transform: uppercase;
}
.bh-logo-text { line-height: 1; }
.bh-logo-title {
  font-family: var(--font);
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--white);
  text-transform: uppercase;
  line-height: 1.05;
  display: block;
}
.bh-logo-tracker {
  font-family: var(--font);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: var(--yellow);
  text-transform: uppercase;
  display: block;
  margin-top: 2px;
  line-height: 1.3;
}
.bh-logo-sub {
  font-family: var(--font);
  font-size: 0.58rem;
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid var(--border);
  display: block;
}

/* ── Section label ───────────────────────────── */
.bh-section-label {
  font-family: var(--font);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  margin: 24px 0 12px;
  display: block;
  background: transparent;
}

/* ── Status pill ─────────────────────────────── */
.bh-pill {
  display: inline-block;
  font-family: var(--font);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border: 1px solid var(--border2);
  color: var(--muted);
  border-radius: 2px;
}
.bh-pill.live {
  border-color: var(--yellow);
  color: var(--yellow);
}

/* ── Sidebar nav title ───────────────────────── */
.bh-sidebar-title {
  font-family: var(--font);
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--fg);
  border-bottom: 2px solid var(--yellow);
  padding-bottom: 5px;
  margin: 28px 0 10px;
  display: block;
  background: transparent;
}

/* ── AI 검색 칩 ──────────────────────────────── */
.bh-ai-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 8px 0 10px;
}
.bh-ai-chip {
  font-family: var(--font);
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--yellow);
  border: 1px solid var(--yellow);
  background: transparent;
  padding: 3px 8px;
  cursor: pointer;
  border-radius: 2px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: all 0.15s;
}
.bh-ai-chip:hover {
  background: var(--yellow);
  color: #FFFFFF;
}
.bh-ai-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--surf);
  font-size: 0.82rem;
}

/* ── Page subtitle ───────────────────────────── */
.bh-subtitle {
  font-family: var(--font);
  font-size: 0.82rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--muted);
  margin-bottom: 24px;
  padding: 0;
  display: block;
  background: transparent;
  border: none;
}
</style>
"""


def setup_page() -> None:
    st.set_page_config(
        page_title="Korea Stock Tracker",
        page_icon="▲",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    st.markdown(BH_CSS, unsafe_allow_html=True)


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(exist_ok=True)


def read_json(path: Path, default):
    ensure_data_dir()
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def write_json(path: Path, payload) -> None:
    ensure_data_dir()
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def seed_for(code: str, salt: str = "") -> int:
    digest = hashlib.sha256(f"{code}:{salt}".encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def all_stocks() -> list[Stock]:
    return MARKET_STOCKS["전체"]


def find_stock(code: str) -> Stock | None:
    return next((stock for stock in all_stocks() if stock.code == code), None)


def money(value: float | int) -> str:
    """1주당 가격 등 정확한 원 단위 표시."""
    return f"{value:,.0f}원"


def money_per_share(value: float | int) -> str:
    """주당 가격임을 명시."""
    return f"{value:,.0f}원/주"


def money_compact(value: float | int) -> str:
    """큰 금액을 조·억·만 단위로 읽기 쉽게 표시."""
    v = abs(float(value))
    sign = "-" if value < 0 else ("+" if value > 0 else "")
    if v >= 1_000_000_000_000:
        return f"{sign}{v / 1_000_000_000_000:,.2f}조원"
    if v >= 100_000_000:
        return f"{sign}{v / 100_000_000:,.0f}억원"
    if v >= 10_000:
        return f"{sign}{v / 10_000:,.0f}만원"
    return f"{sign}{v:,.0f}원"


def money_signed(value: float | int) -> str:
    """등락 금액: +/-와 함께 읽기 쉬운 단위로 표시."""
    if value == 0:
        return "0원"
    v = abs(float(value))
    sign = "+" if value > 0 else "-"
    if v >= 100_000_000:
        return f"{sign}{v / 100_000_000:,.1f}억원"
    if v >= 10_000:
        return f"{sign}{v / 10_000:,.0f}만원"
    return f"{sign}{v:,.0f}원"


def volume_fmt(value: float | int) -> str:
    """거래량을 주·만주·백만주 단위로 표시."""
    v = int(value)
    if v >= 100_000_000:
        return f"{v / 100_000_000:,.1f}억주"
    if v >= 10_000_000:
        return f"{v / 10_000_000:,.1f}천만주"
    if v >= 1_000_000:
        return f"{v / 1_000_000:,.1f}백만주"
    if v >= 10_000:
        return f"{v / 10_000:,.0f}만주"
    return f"{v:,}주"


def mktcap_fmt(value: float | int) -> str:
    """시가총액: 조·억 단위."""
    v = abs(float(value))
    if v >= 1_000_000_000_000:
        return f"{v / 1_000_000_000_000:,.1f}조원"
    return f"{v / 100_000_000:,.0f}억원"


def signed_pct(value: float) -> str:
    return f"{value:+.2f}%"


def get_secret(name: str, default: str = "") -> str:
    try:
        kis_secrets = st.secrets.get("kis", {})
        value = kis_secrets.get(name.lower()) or kis_secrets.get(name.upper())
        if value:
            return str(value)
    except Exception:
        pass
    return os.getenv(f"KIS_{name.upper()}", default)


def get_kis_config() -> KISConfig | None:
    env_config = config_from_env()
    if env_config:
        return env_config

    app_key = get_secret("app_key").strip()
    app_secret = get_secret("app_secret").strip()
    env = get_secret("env", "prod").strip() or "prod"
    if not app_key or not app_secret:
        return None
    return KISConfig(app_key=app_key, app_secret=app_secret, env=env)


def get_kis_client() -> KISClient | None:
    config = get_kis_config()
    if not config:
        return None
    return KISClient(config, TOKEN_FILE)


def auto_refresh(seconds: int) -> None:
    if seconds <= 0:
        return
    st.markdown(
        f"""
        <script>
        setTimeout(function() {{
            window.parent.location.reload();
        }}, {seconds * 1000});
        </script>
        """,
        unsafe_allow_html=True,
    )


@st.cache_data(show_spinner=False)
def generate_demo_ohlcv(code: str, base_price: int, days: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed_for(code, str(days)))
    dates = pd.bdate_range(end=date.today(), periods=days)
    drift = rng.normal(0.00035, 0.0002)
    volatility = rng.uniform(0.018, 0.035)
    returns = rng.normal(drift, volatility, len(dates))
    close = base_price * np.exp(np.cumsum(returns))
    open_ = close * (1 + rng.normal(0, 0.007, len(dates)))
    high = np.maximum(open_, close) * (1 + rng.uniform(0.002, 0.022, len(dates)))
    low = np.minimum(open_, close) * (1 - rng.uniform(0.002, 0.022, len(dates)))
    volume = rng.integers(80_000, 2_800_000, len(dates))

    return pd.DataFrame(
        {
            "date": dates,
            "open": open_.round().astype(int),
            "high": high.round().astype(int),
            "low": low.round().astype(int),
            "close": close.round().astype(int),
            "volume": volume,
        }
    )


@st.cache_data(ttl=3, show_spinner=False)
def fetch_live_snapshot(code: str) -> dict:
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    return client.inquire_price(code)


@st.cache_data(ttl=60, show_spinner=False)
def fetch_live_chart(code: str, days: int) -> pd.DataFrame:
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    return client.daily_chart(code, days)


def get_chart_data(stock: Stock, days: int, use_live: bool) -> tuple[pd.DataFrame, str]:
    if use_live:
        try:
            return fetch_live_chart(stock.code, days), "KIS"
        except KISError:
            pass  # 조용히 데모로 fallback — 차트 페이지 caption에서 출처 표시
    return generate_demo_ohlcv(stock.code, stock.base_price, days), "DEMO"


def stock_snapshot(stock: Stock, use_live: bool) -> dict:
    if use_live:
        try:
            live = fetch_live_snapshot(stock.code)
            return {"code": stock.code, "name": stock.name, "market": stock.market, "sector": stock.sector, **live}
        except KISError:
            pass  # 조용히 데모 시세로 fallback

    chart = generate_demo_ohlcv(stock.code, stock.base_price, 90)
    last = chart.iloc[-1]
    previous = chart.iloc[-2]
    change = int(last["close"] - previous["close"])
    change_rate = change / previous["close"] * 100
    market_cap = int(last["close"] * (seed_for(stock.code, "shares") % 80_000_000 + 20_000_000))
    return {
        "code": stock.code,
        "name": stock.name,
        "market": stock.market,
        "sector": stock.sector,
        "price": int(last["close"]),
        "change": change,
        "change_rate": change_rate,
        "volume": int(last["volume"]),
        "market_cap": market_cap,
    }


def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    enriched = df.copy()
    enriched["ma5"] = enriched["close"].rolling(5).mean()
    enriched["ma20"] = enriched["close"].rolling(20).mean()
    enriched["ma60"] = enriched["close"].rolling(60).mean()

    # 볼린저밴드 (20일, ±2σ)
    bb_mid = enriched["close"].rolling(20).mean()
    bb_std = enriched["close"].rolling(20).std()
    enriched["bb_upper"] = bb_mid + bb_std * 2
    enriched["bb_lower"] = bb_mid - bb_std * 2
    enriched["bb_mid"] = bb_mid

    delta = enriched["close"].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    enriched["rsi"] = 100 - (100 / (1 + rs))

    ema12 = enriched["close"].ewm(span=12, adjust=False).mean()
    ema26 = enriched["close"].ewm(span=26, adjust=False).mean()
    enriched["macd"] = ema12 - ema26
    enriched["signal"] = enriched["macd"].ewm(span=9, adjust=False).mean()
    enriched["histogram"] = enriched["macd"] - enriched["signal"]
    return enriched


def forecast_prices(df: pd.DataFrame, forecast_days: int) -> pd.DataFrame:
    clean = df[["date", "close"]].copy()
    clean["close"] = pd.to_numeric(clean["close"], errors="coerce")
    clean = clean.dropna(subset=["date", "close"])
    clean = clean[clean["close"] > 0].tail(30)
    if clean.empty:
        raise ValueError("예측에 사용할 유효한 종가 데이터가 없습니다.")

    last_close = float(clean.iloc[-1]["close"])
    if len(clean) >= 2:
        slope = float(np.polyfit(np.arange(len(clean)), clean["close"], 1)[0])
    else:
        slope = 0.0

    volatility = clean["close"].pct_change().replace([np.inf, -np.inf], np.nan).dropna().std()
    if pd.isna(volatility) or volatility == 0:
        volatility = 0.01

    rng = np.random.default_rng(seed_for(str(last_close), str(forecast_days)))
    dates = pd.bdate_range(start=clean.iloc[-1]["date"] + timedelta(days=1), periods=forecast_days)
    noise = rng.normal(0, volatility * last_close, forecast_days)
    prices = [max(100, last_close + slope * (idx + 1) + noise[idx]) for idx in range(forecast_days)]
    return pd.DataFrame({"date": dates, "forecast": np.round(prices).astype(int)})


def clamp(value: float, lower: float = -1.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, float(value)))


def clean_price_frame(df: pd.DataFrame, lookback: int = 60) -> pd.DataFrame:
    clean = df[["date", "close"]].copy()
    clean["close"] = pd.to_numeric(clean["close"], errors="coerce")
    clean["volume"] = pd.to_numeric(df["volume"], errors="coerce") if "volume" in df.columns else np.nan
    clean = clean.dropna(subset=["date", "close"])
    clean = clean[clean["close"] > 0].tail(lookback)
    if clean.empty:
        raise ValueError("예측에 사용할 유효한 종가 데이터가 없습니다.")
    return clean


def load_external_signals(stock: Stock) -> dict[str, float]:
    raw = read_json(EXTERNAL_SIGNALS_FILE, {})
    default = raw.get("default", {}) if isinstance(raw, dict) else {}
    specific = raw.get(stock.code, {}) if isinstance(raw, dict) else {}
    merged = {**default, **specific}
    return {
        "news_sentiment": clamp(float(merged.get("news_sentiment", 0.0))),
        "earnings_surprise": clamp(float(merged.get("earnings_surprise", 0.0))),
        "money_flow": clamp(float(merged.get("money_flow", 0.0))),
        "disclosure_risk": clamp(float(merged.get("disclosure_risk", 0.0)), 0.0, 1.0),
        "index_flow": clamp(float(merged.get("index_flow", 0.0))),
        "sector_flow": clamp(float(merged.get("sector_flow", 0.0))),
    }


def benchmark_return(stocks: list[Stock], days: int) -> float:
    returns = []
    for stock in stocks:
        frame = generate_demo_ohlcv(stock.code, stock.base_price, max(days, 30))
        close = pd.to_numeric(frame["close"], errors="coerce").dropna()
        if len(close) >= 2 and close.iloc[0] > 0:
            returns.append(float(close.iloc[-1] / close.iloc[0] - 1))
    return float(np.mean(returns)) if returns else 0.0


def forecast_context(df: pd.DataFrame, stock: Stock) -> tuple[dict[str, float], pd.DataFrame]:
    clean = clean_price_frame(df, 60)
    close = clean["close"]
    returns = close.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    last_close = float(close.iloc[-1])

    ma20 = close.rolling(20).mean().iloc[-1] if len(close) >= 20 else close.mean()
    ma60 = close.rolling(60).mean().iloc[-1] if len(close) >= 60 else close.mean()
    ma_score = clamp(((last_close / ma20) - 1) * 4) if ma20 else 0.0
    trend_score = clamp(((ma20 / ma60) - 1) * 5) if ma60 else 0.0
    momentum_score = clamp(float(returns.tail(10).mean() * 60)) if not returns.empty else 0.0

    avg_volume = clean["volume"].tail(20).mean()
    last_volume = clean["volume"].iloc[-1]
    if pd.isna(avg_volume) or avg_volume <= 0 or pd.isna(last_volume):
        volume_score = 0.0
    else:
        volume_score = clamp((float(last_volume / avg_volume) - 1) / 1.5)

    volatility = float(returns.tail(30).std()) if not returns.empty else 0.01
    if pd.isna(volatility) or volatility <= 0:
        volatility = 0.01
    volatility_score = -clamp((volatility - 0.025) / 0.04, 0.0, 1.0)

    stock_return = float(close.iloc[-1] / close.iloc[0] - 1) if len(close) >= 2 else 0.0
    market_peers = MARKET_STOCKS.get("코스피" if stock.market == "KOSPI" else "코스닥", [])[:30]
    sector_peers = [s for s in all_stocks() if s.sector == stock.sector][:15]
    market_return = benchmark_return(market_peers, len(clean))
    sector_return = benchmark_return(sector_peers, len(clean))
    external = load_external_signals(stock)

    factors = {
        "ma_trend": clamp((ma_score + trend_score) / 2),
        "momentum": momentum_score,
        "volume": volume_score,
        "volatility": volatility_score,
        "market_relative_strength": clamp((stock_return - market_return) * 4),
        "sector_relative_strength": clamp((stock_return - sector_return) * 4),
        "news_sentiment": external["news_sentiment"],
        "earnings_surprise": external["earnings_surprise"],
        "money_flow": external["money_flow"],
        "disclosure_risk": -external["disclosure_risk"],
        "index_flow": external["index_flow"],
        "sector_flow_external": external["sector_flow"],
        "daily_volatility": volatility,
    }
    return factors, clean


def composite_factor_score(factors: dict[str, float]) -> float:
    weights = {
        "ma_trend": 0.16,
        "momentum": 0.12,
        "volume": 0.08,
        "volatility": 0.10,
        "market_relative_strength": 0.12,
        "sector_relative_strength": 0.10,
        "news_sentiment": 0.09,
        "earnings_surprise": 0.08,
        "money_flow": 0.08,
        "disclosure_risk": 0.04,
        "index_flow": 0.02,
        "sector_flow_external": 0.01,
    }
    return clamp(sum(factors.get(name, 0.0) * weight for name, weight in weights.items()))


def advanced_forecast_prices(df: pd.DataFrame, stock: Stock, forecast_days: int) -> tuple[pd.DataFrame, dict[str, float]]:
    factors, clean = forecast_context(df, stock)
    last_close = float(clean.iloc[-1]["close"])
    if len(clean) >= 2:
        slope_return = float(np.polyfit(np.arange(len(clean)), clean["close"], 1)[0] / last_close)
    else:
        slope_return = 0.0

    returns = clean["close"].pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    recent_return = float(returns.tail(10).mean()) if not returns.empty else 0.0
    factor_score = composite_factor_score(factors)
    expected_daily_return = clamp((recent_return * 0.45) + (slope_return * 0.35) + (factor_score * 0.003), -0.08, 0.08)
    volatility = factors["daily_volatility"]

    dates = pd.bdate_range(start=clean.iloc[-1]["date"] + timedelta(days=1), periods=forecast_days)
    forecasts = []
    lower = []
    upper = []
    for idx in range(1, forecast_days + 1):
        center = last_close * ((1 + expected_daily_return) ** idx)
        interval = 1.64 * volatility * np.sqrt(idx) * center
        forecasts.append(max(100, center))
        lower.append(max(100, center - interval))
        upper.append(max(100, center + interval))

    diagnostics = {
        **factors,
        "factor_score": factor_score,
        "expected_daily_return": expected_daily_return,
        "confidence_level": 0.90,
    }
    forecast = pd.DataFrame(
        {
            "date": dates,
            "forecast": np.round(forecasts).astype(int),
            "lower": np.round(lower).astype(int),
            "upper": np.round(upper).astype(int),
        }
    )
    return forecast, diagnostics


def current_market_stocks(market_label: str) -> list[Stock]:
    return MARKET_STOCKS[market_label]


@st.cache_data(ttl=300)
def _compute_chart_metrics(codes: tuple[str, ...], days: int) -> dict[str, dict]:
    """종목 코드 목록에 대해 실제 차트 데이터로 스크리닝 지표를 계산 (캐시)."""
    out: dict[str, dict] = {}
    for code in codes:
        stk = find_stock(code)
        if not stk:
            continue
        try:
            raw, _ = get_chart_data(stk, days, False)
            if raw is None or len(raw) < 10:
                continue
            df = raw.copy()
            df["close"] = pd.to_numeric(df["close"], errors="coerce")
            df["low"]   = pd.to_numeric(df["low"],   errors="coerce")
            df["high"]  = pd.to_numeric(df["high"],  errors="coerce")
            df["volume"]= pd.to_numeric(df["volume"], errors="coerce")
            df = df.dropna(subset=["close", "low", "high", "volume"])
            if len(df) < 5:
                continue

            close    = float(df["close"].iloc[-1])
            low_min  = float(df["low"].min())
            high_max = float(df["high"].max())
            vol_mean = float(df["volume"].mean())
            vol_last = float(df["volume"].iloc[-1])

            # RSI 14일
            delta = df["close"].diff()
            gain  = delta.clip(lower=0).rolling(14, min_periods=1).mean()
            loss  = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
            rs    = gain / loss.replace(0, np.nan)
            rsi   = float((100 - 100 / (1 + rs)).iloc[-1])
            if np.isnan(rsi):
                rsi = 50.0

            # 당일 등락률 (마지막 2개 종가)
            cr = float((df["close"].iloc[-1] / df["close"].iloc[-2] - 1) * 100) if len(df) >= 2 else 0.0

            out[code] = {
                "low_gap":   (close - low_min)  / low_min  if low_min  > 0 else 1.0,
                "high_gap":  (high_max - close) / high_max if high_max > 0 else 1.0,
                "vol_ratio": vol_last / vol_mean if vol_mean > 0 else 1.0,
                "rsi":       rsi,
                "change_rate": cr,
                "low_min":   low_min,
                "high_max":  high_max,
            }
        except Exception:
            continue
    return out


def _ai_screen_stocks(query: str, market: str) -> list[dict]:
    """자연어 쿼리로 종목 스크리닝. 실제 차트 데이터 기반."""
    import re
    q = query.lower()

    cnt_m = re.search(r"(\d+)\s*개", query)
    n = min(int(cnt_m.group(1)), 15) if cnt_m else 5

    # 기간 파싱
    days = 90
    for label, d in [("1개월", 30), ("3개월", 90), ("6개월", 180), ("1년", 365), ("52주", 365)]:
        if label in q:
            days = d

    pool  = all_stocks() if market == "전체" else current_market_stocks(market)
    codes = tuple(s.code for s in pool)
    metrics = _compute_chart_metrics(codes, days)

    SECTOR_KW = {
        "반도체": "반도체", "바이오": "바이오", "게임": "게임",
        "금융": "금융", "자동차": "자동차", "2차전지": "2차전지",
        "제약": "제약", "통신": "통신", "화학": "화학",
        "건설": "건설", "조선": "조선", "엔터": "엔터", "로봇": "로보틱스",
    }

    results: list[dict] = []
    for stock in pool:
        m = metrics.get(stock.code)
        if not m:
            continue
        cr    = m["change_rate"]
        score = 0.0
        reason = ""

        # ── 최저가 근접 ──────────────────────────
        if any(k in q for k in ["최저가", "저점", "바닥", "저가"]):
            gap    = m["low_gap"]
            score  = max(0.0, 1.0 - gap)
            reason = f"{days//30}개월 저점 대비 +{gap*100:.1f}%"

        # ── 최고가 / 신고가 근접 ─────────────────
        elif any(k in q for k in ["최고가", "신고가", "고점", "고가"]):
            gap    = m["high_gap"]
            score  = max(0.0, 1.0 - gap)
            reason = f"신고가 -{gap*100:.1f}%"

        # ── 거래량 급증 ──────────────────────────
        elif any(k in q for k in ["거래량", "급등", "폭발"]):
            vol_x  = m["vol_ratio"]
            score  = min(vol_x / 5.0, 1.0)
            reason = f"거래량 평균 {vol_x:.1f}배"

        # ── RSI 과매도 ───────────────────────────
        elif any(k in q for k in ["과매도"]):
            rsi = m["rsi"]
            if rsi >= 40:
                continue
            score  = (40 - rsi) / 40.0
            reason = f"RSI {rsi:.0f} — 과매도"

        # ── RSI 과매수 ───────────────────────────
        elif any(k in q for k in ["과매수"]):
            rsi = m["rsi"]
            if rsi <= 60:
                continue
            score  = (rsi - 60) / 40.0
            reason = f"RSI {rsi:.0f} — 과매수"

        # ── 상승 추세 ────────────────────────────
        elif any(k in q for k in ["상승", "오르는", "강세", "오름"]):
            score  = max(0.0, cr / 10.0)
            reason = f"당일 {cr:+.2f}%"

        # ── 하락 추세 ────────────────────────────
        elif any(k in q for k in ["하락", "내리는", "약세", "내림"]):
            score  = max(0.0, -cr / 10.0)
            reason = f"당일 {cr:+.2f}%"

        # ── 배당주 ───────────────────────────────
        elif any(k in q for k in ["배당"]):
            div   = round((seed_for(stock.code, "div2") % 50 + 10) / 10, 1)
            score = div / 6.0
            reason = f"배당수익률 {div:.1f}%"

        # ── 업종 키워드 ──────────────────────────
        else:
            hit = next((sec for kw, sec in SECTOR_KW.items() if kw in q), None)
            if hit and hit not in stock.sector:
                continue
            score  = max(0.0, cr / 10.0)
            reason = f"{stock.sector}  당일 {cr:+.2f}%"

        results.append({"stock": stock, "score": score, "reason": reason, "change_rate": cr})

    results.sort(key=lambda x: -x["score"])
    return results[:n]


def render_sidebar() -> tuple[str, str, str, list[str], bool, int]:
    st.sidebar.markdown(
        """
        <div class="bh-logo">
          <div class="bh-logo-mark">
            <span class="bh-logo-tri">▲</span>
            <span class="bh-logo-krx">KRX</span>
          </div>
          <div class="bh-logo-text">
            <span class="bh-logo-title">STOCK</span>
            <span class="bh-logo-tracker">TRACKER</span>
            <span class="bh-logo-sub">KOSPI &nbsp;·&nbsp; KOSDAQ</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.sidebar.markdown('<div class="bh-sidebar-title">화면</div>', unsafe_allow_html=True)
    menu_icons = {"종목": "▦ 종목", "차트": "▲ 차트", "관심종목": "★ 관심종목", "포트폴리오": "◈ 포트폴리오"}
    menu_key = st.sidebar.radio(
        "화면",
        list(menu_icons.values()),
        index=0,
        label_visibility="collapsed",
    )
    menu = next(k for k, v in menu_icons.items() if v == menu_key)

    st.sidebar.markdown('<div class="bh-sidebar-title">시장</div>', unsafe_allow_html=True)
    market = st.sidebar.radio("시장", ["코스피", "코스닥", "전체"], horizontal=True, label_visibility="collapsed")

    # ── AI 검색 ────────────────────────────────────
    st.sidebar.markdown('<div class="bh-sidebar-title">AI 검색</div>', unsafe_allow_html=True)

    ai_query = st.sidebar.text_input(
        "AI 검색",
        placeholder="예) 3개월 최저가 근접 5개",
        label_visibility="collapsed",
        key="ai_query",
    )

    run_query = ai_query.strip()

    if run_query:
        with st.sidebar:
            with st.spinner("분석 중…"):
                ai_results = _ai_screen_stocks(run_query, market)
        if not ai_results:
            st.sidebar.markdown(
                '<div style="font-size:0.78rem;color:var(--muted);padding:6px 2px;">'
                '조건에 맞는 종목이 없습니다.</div>',
                unsafe_allow_html=True,
            )
        else:
            st.sidebar.markdown(
                f'<div style="font-size:0.64rem;letter-spacing:0.08em;color:var(--muted);'
                f'padding:4px 2px 2px;">▸ "{run_query}" — {len(ai_results)}개 결과</div>',
                unsafe_allow_html=True,
            )
            for r in ai_results:
                stk = r["stock"]
                cr  = r["change_rate"]
                cr_str = f"{cr:+.2f}%"
                mkt_icon = "🔴" if stk.market == "KOSPI" else "🔵"
                btn_label = f"{mkt_icon} {stk.name}  {cr_str}"
                if st.sidebar.button(btn_label, key=f"ai-r-{stk.code}", use_container_width=True):
                    st.session_state["selected_code"] = stk.code
                    st.session_state["menu_override"] = "차트"
                    st.rerun()
                st.sidebar.markdown(
                    f'<div style="font-size:0.68rem;color:var(--muted);'
                    f'padding:0 4px 4px;margin-top:-6px;">{r["reason"]}</div>',
                    unsafe_allow_html=True,
                )

    # ── 종목 검색 ───────────────────────────────────
    st.sidebar.markdown('<div class="bh-sidebar-title">종목</div>', unsafe_allow_html=True)
    keyword = st.sidebar.text_input("검색", placeholder="종목명 · 코드  예) 삼성전자, 005930", label_visibility="collapsed")

    # ── 자동완성 검색 결과 ──────────────────────────
    kw = keyword.strip()
    if kw:
        matches = filtered_stocks("전체", kw, [])[:10]
        if not matches:
            st.sidebar.markdown(
                '<div style="font-size:0.78rem;color:var(--muted);padding:6px 2px;">'
                '검색 결과가 없습니다.</div>',
                unsafe_allow_html=True,
            )
        else:
            st.sidebar.markdown(
                f'<div style="font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;'
                f'color:var(--muted);padding:4px 2px 2px;">'
                f'검색 결과 {len(matches)}개</div>',
                unsafe_allow_html=True,
            )
            for stk in matches:
                mkt_icon = "🔴" if stk.market == "KOSPI" else "🔵"
                label = f"{mkt_icon} {stk.name}   {stk.code}  ·  {stk.sector}"
                if st.sidebar.button(label, key=f"qs-{stk.code}", use_container_width=True):
                    st.session_state["selected_code"] = stk.code
                    st.session_state["menu_override"] = "차트"
                    st.rerun()

    st.sidebar.markdown('<div class="bh-sidebar-title">업종</div>', unsafe_allow_html=True)
    market_stocks = current_market_stocks(market)
    sectors = sorted({stock.sector for stock in market_stocks})
    selected_sectors = st.sidebar.multiselect(
        "업종", sectors, default=[],
        placeholder="전체 업종 (클릭해서 필터)",
        label_visibility="collapsed",
    )

    st.sidebar.divider()

    config = get_kis_config()
    has_config = config is not None
    use_live = st.sidebar.toggle(
        "실시간 시세 (KIS API)",
        value=has_config,
        help="한국투자증권 KIS API 키가 설정된 경우 실시간 시세를 조회합니다.",
    )
    refresh_seconds = st.sidebar.selectbox(
        "자동 새로고침",
        [0, 5, 10, 30, 60],
        index=2,
        format_func=lambda secs: "끄기" if secs == 0 else f"{secs}초 마다",
    )

    if use_live and not has_config:
        st.sidebar.warning(
            "KIS API 키가 설정되지 않았습니다.  \n"
            "Streamlit Cloud → App settings → Secrets에  \n"
            "`[kis]` 섹션으로 app_key / app_secret을 추가하세요.  \n"
            "현재는 데모 데이터로 표시됩니다."
        )

    data_mode = "KIS REST" if (use_live and has_config) else "DEMO"
    pill_cls = "live" if data_mode == "KIS REST" else ""
    st.sidebar.markdown(
        f'<span class="bh-pill {pill_cls}">{data_mode}</span>&nbsp;&nbsp;'
        f'<span style="font-size:0.68rem;color:var(--muted);">'
        f'{datetime.now().strftime("%H:%M:%S")} 기준</span>',
        unsafe_allow_html=True,
    )

    return menu, market, keyword.strip(), selected_sectors, use_live, int(refresh_seconds)


def filtered_stocks(market: str, keyword: str, sectors: list[str]) -> list[Stock]:
    kw = keyword.strip()
    kw_lower = kw.lower()

    # 키워드가 있으면 전체 종목에서 검색, 없으면 선택 시장으로 제한
    pool = all_stocks() if kw else current_market_stocks(market)

    result = []
    for stock in pool:
        if kw:
            matches_keyword = (
                kw_lower in stock.name.lower()
                or kw in stock.code
                or kw_lower in stock.sector.lower()
                or kw_lower in stock.market.lower()
            )
        else:
            matches_keyword = True

        # 키워드 검색 중에는 업종 필터 무시 (검색 결과 우선)
        matches_sector = bool(kw) or (not sectors or stock.sector in sectors)

        if matches_keyword and matches_sector:
            result.append(stock)
    return result


def render_market_overview(stocks: list[Stock], use_live: bool) -> None:
    snapshots = [stock_snapshot(stock, use_live) for stock in stocks]
    if not snapshots:
        st.info("조건에 맞는 종목이 없습니다.")
        return

    frame = pd.DataFrame(snapshots)
    total      = len(frame)
    up_count   = int((frame["change_rate"] > 0).sum())
    down_count = int((frame["change_rate"] < 0).sum())
    flat_count = total - up_count - down_count
    avg_change = float(frame["change_rate"].mean())
    leader = frame.sort_values("change_rate", ascending=False).iloc[0]
    lagger = frame.sort_values("change_rate", ascending=True).iloc[0]

    up_pct   = up_count   / total * 100
    flat_pct = flat_count / total * 100
    down_pct = down_count / total * 100

    st.markdown(
        f"""
        <div style="margin-bottom:18px;">
          <div style="font-size:0.68rem;font-weight:700;letter-spacing:0.13em;
                      text-transform:uppercase;color:var(--muted);margin-bottom:8px;">
            시장 현황 — {total}개 종목 추적 중
          </div>
          <div style="display:flex;height:10px;overflow:hidden;gap:2px;margin-bottom:8px;">
            <div style="width:{up_pct:.1f}%;background:var(--red);"></div>
            <div style="width:{flat_pct:.1f}%;background:var(--border2);"></div>
            <div style="width:{down_pct:.1f}%;background:var(--blue);"></div>
          </div>
          <div style="display:flex;gap:20px;font-size:0.82rem;font-weight:700;">
            <span style="color:var(--red);">▲ 상승 {up_count}개 ({up_pct:.0f}%)</span>
            <span style="color:var(--muted);">— 보합 {flat_count}개</span>
            <span style="color:var(--blue);">▼ 하락 {down_count}개 ({down_pct:.0f}%)</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    col1, col2, col3, col4 = st.columns(4)
    col1.metric(
        "평균 등락률",
        signed_pct(avg_change),
        help="추적 종목 전체의 오늘 평균 가격 변화율입니다.",
    )
    col2.metric(
        "상승/하락",
        f"{up_count} / {down_count}",
        help="오늘 가격이 오른 종목 수 / 내린 종목 수입니다.",
    )
    col3.metric(
        "오늘의 강세 ▲",
        leader["name"],
        signed_pct(float(leader["change_rate"])),
        help="추적 종목 중 오늘 가장 많이 오른 종목입니다.",
    )
    col4.metric(
        "오늘의 약세 ▼",
        lagger["name"],
        signed_pct(float(lagger["change_rate"])),
        help="추적 종목 중 오늘 가장 많이 내린 종목입니다.",
    )


def render_stock_table(stocks: list[Stock], use_live: bool) -> None:
    snapshots = [stock_snapshot(stock, use_live) for stock in stocks]
    if not snapshots:
        return

    frame = pd.DataFrame(snapshots)
    frame["현재가"] = frame["price"].map(money)
    frame["등락률"] = frame["change_rate"].map(signed_pct)
    frame["거래량"] = frame["volume"].map(volume_fmt)
    frame["시가총액"] = frame["market_cap"].map(lambda x: "-" if not x else mktcap_fmt(x))
    table = frame[["market", "code", "name", "sector", "현재가", "등락률", "거래량", "시가총액"]].rename(
        columns={"market": "시장", "code": "코드", "name": "종목명", "sector": "업종"}
    )
    st.dataframe(table, use_container_width=True, hide_index=True)


def render_stock_cards(stocks: list[Stock], use_live: bool) -> None:
    favorites = read_json(FAVORITES_FILE, [])
    favorite_codes = {item["code"] for item in favorites}

    snapshots = {stock.code: stock_snapshot(stock, use_live) for stock in stocks}

    sort_options = {
        "상승률 높은순 ▲": lambda s: -snapshots[s.code]["change_rate"],
        "하락률 높은순 ▼": lambda s:  snapshots[s.code]["change_rate"],
        "현재가 높은순":   lambda s: -snapshots[s.code]["price"],
        "현재가 낮은순":   lambda s:  snapshots[s.code]["price"],
        "거래량 많은순":   lambda s: -snapshots[s.code]["volume"],
        "종목명 가나다순": lambda s:  s.name,
    }
    sort_col, _ = st.columns([1, 3])
    with sort_col:
        sort_key_label = st.selectbox(
            "정렬 기준",
            list(sort_options.keys()),
            index=0,
        )
    sorted_stocks = sorted(stocks, key=sort_options[sort_key_label])

    columns = st.columns(4)
    for idx, stock in enumerate(sorted_stocks):
        snap = snapshots[stock.code]
        cr   = snap["change_rate"]
        direction = "up" if cr > 0 else ("down" if cr < 0 else "")
        arrow     = "▲" if cr > 0 else ("▼" if cr < 0 else "—")
        fav_label = "★ 해제" if stock.code in favorite_codes else "☆ 관심"

        with columns[idx % 4]:
            st.markdown(
                f"""
                <div class="bh-card {direction}">
                  <div class="bh-tag">{stock.market} · {stock.sector}</div>
                  <div class="bh-name">{stock.name}</div>
                  <div style="font-size:0.68rem;color:var(--muted);margin-bottom:10px;
                              letter-spacing:0.06em;">{stock.code}</div>
                  <div class="bh-price">{money_per_share(snap["price"])}</div>
                  <div class="bh-delta {direction}">{arrow} {signed_pct(cr)}
                    <span style="font-weight:400;font-size:0.8rem;">
                      &nbsp;{money_signed(snap["change"])}
                    </span>
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
            btn1, btn2 = st.columns(2)
            if btn1.button("차트 보기", key=f"chart-{stock.code}", use_container_width=True):
                st.session_state["selected_code"] = stock.code
                st.session_state["menu_override"] = "차트"
                st.rerun()
            if btn2.button(fav_label, key=f"fav-{stock.code}", use_container_width=True):
                toggle_favorite(stock)
                st.rerun()


def toggle_favorite(stock: Stock) -> None:
    favorites = read_json(FAVORITES_FILE, [])
    if any(item["code"] == stock.code for item in favorites):
        favorites = [item for item in favorites if item["code"] != stock.code]
    else:
        favorites.append({"code": stock.code, "name": stock.name, "market": stock.market, "sector": stock.sector})
    write_json(FAVORITES_FILE, favorites)


_NEWS_POOL = [
    ("📊", "거시경제", "Fed, 연내 금리 인하 가능성 시사… 달러 약세 전환", "긍정"),
    ("📊", "거시경제", "한은 기준금리 동결… 내수 부진 우려 지속", "중립"),
    ("📊", "거시경제", "원/달러 환율 1,380원대 유지… 수출주 마진 개선 기대", "긍정"),
    ("📊", "거시경제", "미 소비자물가 예상치 하회… 인플레 둔화 신호", "긍정"),
    ("💹", "수급", "외국인 3거래일 연속 순매수… 반도체·방산 집중", "긍정"),
    ("💹", "수급", "기관, 2차전지·바이오 대규모 매집 포착", "긍정"),
    ("💹", "수급", "개인 투자자 코스닥 대규모 순매도… 수급 공백 우려", "부정"),
    ("💹", "수급", "공매도 잔고 급감… 숏커버링 매수세 기대감 고조", "긍정"),
    ("⚡", "테마", "AI 반도체 수요 폭증… 국내 HBM·패키징 장비주 강세", "긍정"),
    ("⚡", "테마", "글로벌 EV 판매 둔화… 2차전지 섹터 단기 조정", "부정"),
    ("⚡", "테마", "K-방산 수출 신기록… 유럽·중동 계약 잇따라", "긍정"),
    ("⚡", "테마", "협동로봇 도입 가속화… 레인보우로보틱스 등 로봇주 주목", "긍정"),
    ("⚡", "테마", "K-뷰티 미국 시장 점유율 확대… 화장품 수출주 랠리", "긍정"),
    ("⚡", "테마", "중국 소비 회복 기대… K-소비재·화장품 반등 시도", "긍정"),
    ("📋", "실적", "삼성전자 반도체 영업이익 서프라이즈… 메모리 회복 확인", "긍정"),
    ("📋", "실적", "국내 바이오 대형사, 글로벌 기술 수출 계약 체결", "긍정"),
    ("📋", "실적", "조선 빅3 수주잔고 사상 최대… 실적 가시성 높아져", "긍정"),
    ("📋", "실적", "주요 자동차 그룹 글로벌 점유율 사상 최고치 경신", "긍정"),
    ("🏛", "정책", "정부 기업 밸류업 프로그램 2기 발표… 저PBR주 재주목", "긍정"),
    ("🏛", "정책", "공매도 전면 재개 일정 조율 중… 시장 영향 예의주시", "중립"),
    ("🌐", "글로벌", "미·중 무역협상 재개… 소부장·디스플레이 수혜 기대", "긍정"),
    ("🌐", "글로벌", "중동 지정학 리스크 재부각… 유가 상승·방산주 강세", "중립"),
    ("🌐", "글로벌", "일본 엔화 강세 전환… 원화 동반 강세 가능성 주목", "중립"),
]


def render_date_news_panel(stock: "Stock", date_str: str, df: pd.DataFrame) -> None:
    """차트 날짜 클릭 → 실제 차트 데이터 기반 기술적 분석 + 실제 뉴스 링크."""
    # ── 날짜 파싱 ──────────────────────────────────
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        day_map = {"Mon":"월","Tue":"화","Wed":"수","Thu":"목","Fri":"금","Sat":"토","Sun":"일"}
        date_label = dt.strftime("%Y년 %m월 %d일") + f" ({day_map.get(dt.strftime('%a'), '')})"
        ds = dt.strftime("%Y.%m.%d")   # 네이버 검색용 날짜
    except Exception:
        date_label = date_str[:10]
        ds = date_str[:10].replace("-", ".")

    # ── 해당 날짜 행 추출 ──────────────────────────
    row_mask = df["date"].astype(str).str.startswith(date_str[:10])
    row_df = df[row_mask]
    if row_df.empty:
        st.info(f"{date_str[:10]} 데이터가 없습니다.")
        return
    idx = row_df.index[0]
    r = row_df.iloc[0]
    o, h, l, c = float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"])
    vol = int(r["volume"])

    chg = c - o
    chg_pct = chg / o * 100 if o else 0
    price_color = "var(--red)" if chg >= 0 else "var(--blue)"
    arrow = "▲" if chg >= 0 else "▼"

    # ── 헤더 카드 ──────────────────────────────────
    st.markdown(
        f'<div style="background:var(--surf2);border:2px solid var(--border2);'
        f'border-left:5px solid var(--yellow);padding:14px 20px;margin-bottom:12px;">'
        f'<div style="font-family:var(--mono);font-size:0.6rem;letter-spacing:0.14em;'
        f'text-transform:uppercase;color:var(--yellow);margin-bottom:4px;">📅 날짜별 기술적 분석</div>'
        f'<div style="font-weight:800;font-size:1rem;color:var(--white);margin-bottom:8px;">'
        f'{stock.name} ({stock.code}) · {date_label}</div>'
        f'<div style="display:flex;gap:20px;font-family:var(--mono);font-size:0.82rem;flex-wrap:wrap;">'
        f'<span>시가 <b>{o:,.0f}</b></span>'
        f'<span>고가 <b style="color:var(--red)">{h:,.0f}</b></span>'
        f'<span>저가 <b style="color:var(--blue)">{l:,.0f}</b></span>'
        f'<span>종가 <b style="color:{price_color}">{c:,.0f}</b></span>'
        f'<span style="color:{price_color};font-weight:700;">{arrow} {chg_pct:+.2f}%&nbsp;({chg:+,.0f}원)</span>'
        f'<span style="color:var(--muted)">거래량 {vol:,}주</span>'
        f'</div></div>',
        unsafe_allow_html=True,
    )

    # ── 기술적 분석 카드 생성 ──────────────────────
    signals: list[tuple[str, str, str, str]] = []   # (icon, tag, msg, level)

    # 1) 캔들 모양 분석
    body  = abs(c - o)
    rng_  = h - l if h != l else 1
    upper = h - max(o, c)
    lower = min(o, c) - l
    if body / rng_ >= 0.7:
        signals.append(("🕯️", "캔들 패턴",
            f"{'장대양봉' if chg >= 0 else '장대음봉'} — 몸통이 전체 범위의 {body/rng_*100:.0f}%. "
            f"{'강한 매수세로 마감. 추세 지속 가능성 주목.' if chg >= 0 else '강한 매도세. 추가 하락 경계.'}",
            "pos" if chg >= 0 else "neg"))
    elif body / rng_ <= 0.1:
        signals.append(("🕯️", "캔들 패턴",
            "도지(Doji) — 시가와 종가가 거의 같음. 매수·매도 세력 균형. 추세 전환 가능성 확인 필요.",
            "neu"))
    elif lower >= body * 2 and upper <= body * 0.5:
        signals.append(("🕯️", "캔들 패턴",
            f"{'망치형(Hammer)' if chg < 0 else '교수형(Hanging Man)'} — 아래꼬리 길고 몸통 작음. "
            f"{'하락 추세에서 나타나면 반등 신호.' if chg < 0 else '상승 추세에서 나타나면 반전 경계.'}",
            "pos" if chg < 0 else "neg"))
    elif upper >= body * 2 and lower <= body * 0.5:
        signals.append(("🕯️", "캔들 패턴",
            f"{'유성형(Shooting Star)' if chg >= 0 else '역망치형(Inverted Hammer)'} — 위꼬리 길고 몸통 작음. "
            f"{'상승 후 매도세 유입 경고.' if chg >= 0 else '하락 후 매수 시도. 다음 봉 확인 필요.'}",
            "neg" if chg >= 0 else "pos"))
    else:
        signals.append(("🕯️", "캔들 모양",
            f"당일 변동폭 {rng_:,.0f}원 ({rng_/o*100:.1f}%), 몸통 비중 {body/rng_*100:.0f}%. "
            "특별한 반전 신호 없음.",
            "neu"))

    # 2) 거래량
    vol_avg = float(df["volume"].rolling(20).mean().iloc[idx]) if idx >= 19 else float(df["volume"].mean())
    vol_ratio = vol / vol_avg if vol_avg else 1
    if vol_ratio >= 2.5:
        signals.append(("📊", "거래량",
            f"거래량 폭증 — 평균(20일) 대비 {vol_ratio:.1f}배. "
            f"{'매수세 급격 유입. 모멘텀 확인.' if chg >= 0 else '대량 매도. 투매 또는 세력 이탈 가능성.'}",
            "pos" if chg >= 0 else "neg"))
    elif vol_ratio >= 1.5:
        signals.append(("📊", "거래량",
            f"거래량 증가 — 평균 대비 {vol_ratio:.1f}배. 시장 관심 증가.",
            "neu"))
    elif vol_ratio < 0.5:
        signals.append(("📊", "거래량",
            f"거래량 급감 — 평균 대비 {vol_ratio:.1f}배. 관망세 짙음. 신뢰도 낮은 움직임.",
            "neu"))
    else:
        signals.append(("📊", "거래량",
            f"거래량 평이 — 평균 대비 {vol_ratio:.1f}배. 특이 수급 없음.",
            "neu"))

    # 3) 이동평균 대비 위치
    ma5_val  = df["ma5"].iloc[idx]  if not pd.isna(df["ma5"].iloc[idx])  else None
    ma20_val = df["ma20"].iloc[idx] if not pd.isna(df["ma20"].iloc[idx]) else None
    ma60_val = df["ma60"].iloc[idx] if not pd.isna(df["ma60"].iloc[idx]) else None
    ma_parts = []
    if ma5_val:
        diff = (c - ma5_val) / ma5_val * 100
        ma_parts.append(f"MA5 {diff:+.1f}%")
    if ma20_val:
        diff = (c - ma20_val) / ma20_val * 100
        ma_parts.append(f"MA20 {diff:+.1f}%")
    if ma60_val:
        diff = (c - ma60_val) / ma60_val * 100
        ma_parts.append(f"MA60 {diff:+.1f}%")
    if ma_parts:
        all_above = all(c > v for v in [ma5_val, ma20_val, ma60_val] if v)
        all_below = all(c < v for v in [ma5_val, ma20_val, ma60_val] if v)
        if all_above:
            signals.append(("📈", "이동평균",
                f"종가가 MA5·MA20·MA60 전부 위 — {', '.join(ma_parts)}. 강한 상승 배열. 추세 추종 매수 구간.",
                "pos"))
        elif all_below:
            signals.append(("📉", "이동평균",
                f"종가가 MA5·MA20·MA60 전부 아래 — {', '.join(ma_parts)}. 하락 배열. 반등 확인 전 매수 자제.",
                "neg"))
        else:
            signals.append(("〰️", "이동평균",
                f"이동평균 혼재 — {', '.join(ma_parts)}. 방향성 불분명. 다음 봉 추세 확인 필요.",
                "neu"))

    # 4) RSI
    rsi_val = df["rsi"].iloc[idx] if not pd.isna(df["rsi"].iloc[idx]) else None
    if rsi_val is not None:
        if rsi_val >= 70:
            signals.append(("⚡", "RSI",
                f"RSI {rsi_val:.1f} — 과매수 구간(70↑). 단기 조정 가능성. 신규 매수 주의.",
                "neg"))
        elif rsi_val <= 30:
            signals.append(("⚡", "RSI",
                f"RSI {rsi_val:.1f} — 과매도 구간(30↓). 기술적 반등 기대. 단, 추세 하락 중엔 추가 하락 가능.",
                "pos"))
        else:
            signals.append(("⚡", "RSI",
                f"RSI {rsi_val:.1f} — 중립 구간(30~70). 과열·침체 없음. 방향성은 다른 지표로 판단.",
                "neu"))

    # 5) MACD
    macd_val = df["macd"].iloc[idx]      if not pd.isna(df["macd"].iloc[idx])      else None
    hist_val = df["histogram"].iloc[idx] if not pd.isna(df["histogram"].iloc[idx]) else None
    if macd_val is not None and hist_val is not None:
        # 전일 히스토그램 방향
        prev_hist = df["histogram"].iloc[idx - 1] if idx > 0 and not pd.isna(df["histogram"].iloc[idx - 1]) else None
        if hist_val > 0 and macd_val > 0:
            msg = f"MACD {macd_val:.2f}, 히스토그램 {hist_val:+.2f} — 매수 모멘텀 우세."
            if prev_hist is not None and prev_hist < 0:
                msg += " 히스토그램이 음→양 전환. 상승 전환 신호!"
            signals.append(("📉", "MACD", msg, "pos"))
        elif hist_val < 0 and macd_val < 0:
            msg = f"MACD {macd_val:.2f}, 히스토그램 {hist_val:+.2f} — 매도 모멘텀 우세."
            if prev_hist is not None and prev_hist > 0:
                msg += " 히스토그램이 양→음 전환. 하락 전환 신호!"
            signals.append(("📉", "MACD", msg, "neg"))
        else:
            signals.append(("📉", "MACD",
                f"MACD {macd_val:.2f}, 히스토그램 {hist_val:+.2f} — 방향 전환 구간. 다음 봉 확인 필요.",
                "neu"))

    # 6) 볼린저밴드
    bb_u = df["bb_upper"].iloc[idx] if not pd.isna(df["bb_upper"].iloc[idx]) else None
    bb_l = df["bb_lower"].iloc[idx] if not pd.isna(df["bb_lower"].iloc[idx]) else None
    bb_m = df["bb_mid"].iloc[idx]   if not pd.isna(df["bb_mid"].iloc[idx])   else None
    if bb_u and bb_l and bb_m:
        if c > bb_u:
            signals.append(("🎯", "볼린저밴드",
                f"종가({c:,.0f})가 밴드 상단({bb_u:,.0f}) 돌파. 강한 상승세지만 단기 과열 주의.",
                "neg"))
        elif c < bb_l:
            signals.append(("🎯", "볼린저밴드",
                f"종가({c:,.0f})가 밴드 하단({bb_l:,.0f}) 이탈. 강한 하락세. 반등 타이밍 모니터링.",
                "pos"))
        else:
            bw = (bb_u - bb_l) / bb_m * 100
            pos = (c - bb_l) / (bb_u - bb_l) * 100
            signals.append(("🎯", "볼린저밴드",
                f"밴드 내({pos:.0f}% 위치). 밴드폭 {bw:.1f}%. "
                f"{'밴드 상단 근접 — 저항 가능성.' if pos > 75 else '밴드 하단 근접 — 지지 가능성.' if pos < 25 else '밴드 중앙 — 방향성 대기.'}",
                "neu"))

    # ── 분석 카드 렌더링 ───────────────────────────
    level_color = {"pos": "var(--red)", "neg": "var(--blue)", "neu": "var(--yellow)"}
    cols = st.columns(2)
    for i, (icon, tag, msg, level) in enumerate(signals):
        lc = level_color.get(level, "var(--muted)")
        with cols[i % 2]:
            st.markdown(
                f'<div style="background:var(--surf);border:1px solid var(--border2);'
                f'border-left:4px solid {lc};padding:10px 14px;margin-bottom:8px;">'
                f'<div style="font-family:var(--mono);font-size:0.58rem;letter-spacing:0.1em;'
                f'text-transform:uppercase;color:var(--cyan);margin-bottom:4px;">'
                f'{icon} {tag}</div>'
                f'<div style="font-size:0.82rem;color:var(--fg);line-height:1.5;">{msg}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    # ── 실제 뉴스 링크 ────────────────────────────
    st.markdown('<div class="bh-section-label">실제 뉴스 · 공시 바로가기</div>', unsafe_allow_html=True)
    name_enc = stock.name.replace(" ", "+")
    links = [
        ("📰", "네이버 뉴스 검색",
         f"https://search.naver.com/search.naver?where=news&query={name_enc}+주가&sm=tab_opt&sort=1&pd=3&ds={ds}&de={ds}",
         f"{stock.name} 관련 {ds} 뉴스를 네이버에서 검색합니다."),
        ("💹", "네이버 금융 종목 페이지",
         f"https://finance.naver.com/item/main.naver?code={stock.code}",
         "재무정보·공시·주주현황·배당 등 종합 정보 확인."),
        ("📋", "DART 전자공시 검색",
         f"https://dart.fss.or.kr/dsab001/search.ax?textCrpNm={name_enc}",
         "금융감독원 전자공시 — 사업보고서·주요사항보고 등 공식 공시 조회."),
        ("🏦", "KRX 종목 정보",
         f"https://www.krx.co.kr/main/main.jsp",
         "한국거래소 공식 시세·거래 통계 조회."),
    ]
    link_cols = st.columns(4)
    for col, (icon, label, url, desc) in zip(link_cols, links):
        with col:
            st.markdown(
                f'<a href="{url}" target="_blank" style="text-decoration:none;">'
                f'<div style="background:var(--surf2);border:1px solid var(--border2);'
                f'border-top:3px solid var(--yellow);padding:10px 12px;text-align:center;'
                f'cursor:pointer;transition:border-color 0.15s;">'
                f'<div style="font-size:1.3rem;margin-bottom:4px;">{icon}</div>'
                f'<div style="font-size:0.75rem;font-weight:700;color:var(--yellow);">{label}</div>'
                f'<div style="font-size:0.68rem;color:var(--muted);margin-top:4px;line-height:1.35;">{desc}</div>'
                f'</div></a>',
                unsafe_allow_html=True,
            )


def _today_news(n: int = 4) -> list[dict]:
    d = date.today()
    seed = int(hashlib.sha256(f"{d.year}{d.month}{d.day}news".encode()).hexdigest()[:10], 16)
    rng = np.random.default_rng(seed % (2**32))
    idx = rng.choice(len(_NEWS_POOL), size=min(n, len(_NEWS_POOL)), replace=False)
    return [
        {"icon": _NEWS_POOL[i][0], "tag": _NEWS_POOL[i][1],
         "title": _NEWS_POOL[i][2], "sentiment": _NEWS_POOL[i][3]}
        for i in idx
    ]


@st.cache_data(ttl=300)
def _sector_leaderboard(top_n: int = 5) -> list[dict]:
    """섹터별 대표 종목 최대 4개만 샘플링해 평균 등락률 계산 (5분 캐시)."""
    sector_stocks: dict[str, list] = {}
    for stock in all_stocks():
        sector_stocks.setdefault(stock.sector, []).append(stock)

    sector_rates: dict[str, list[float]] = {}
    for sector, stocks in sector_stocks.items():
        for stock in stocks[:4]:  # 섹터당 최대 4개만
            snap = stock_snapshot(stock, False)  # 항상 데모(속도 우선)
            sector_rates.setdefault(sector, []).append(snap["change_rate"])

    results = [
        {"sector": s, "avg_rate": sum(v) / len(v), "count": len(sector_stocks[s])}
        for s, v in sector_rates.items()
    ]
    return sorted(results, key=lambda x: -x["avg_rate"])[:top_n]


def _portfolio_mini_summary(use_live: bool) -> dict | None:
    portfolio = read_json(PORTFOLIO_FILE, [])
    if not portfolio:
        return None
    rows = []
    for item in portfolio:
        stock = find_stock(item["code"])
        if stock is None:
            continue
        current = stock_snapshot(stock, use_live)["price"]
        qty = int(item["quantity"])
        buy = int(item["buy_price"])
        invested = qty * buy
        evaluated = qty * current
        profit = evaluated - invested
        profit_rate = profit / invested * 100 if invested else 0.0
        rows.append({**item, "current": current, "invested": invested,
                     "evaluated": evaluated, "profit": profit, "profit_rate": profit_rate})
    if not rows:
        return None
    total_inv  = sum(r["invested"]  for r in rows)
    total_eval = sum(r["evaluated"] for r in rows)
    total_pft  = total_eval - total_inv
    total_rate = total_pft / total_inv * 100 if total_inv else 0.0
    best  = max(rows, key=lambda r: r["profit_rate"])
    worst = min(rows, key=lambda r: r["profit_rate"])
    return {
        "rows": rows, "total_inv": total_inv, "total_eval": total_eval,
        "total_pft": total_pft, "total_rate": total_rate,
        "best": best, "worst": worst,
    }


def render_stocks_page(stocks: list[Stock], use_live: bool, keyword: str = "") -> None:
    today_str = date.today().strftime("%Y년 %m월 %d일")
    st.title("오늘의 종목")
    st.markdown(
        f'<div class="bh-subtitle">{today_str} · 데모 시뮬레이션 기반 — '
        '실시간 반영은 KIS API 연동 시 활성화됩니다.</div>',
        unsafe_allow_html=True,
    )

    # ── 오늘의 이슈 & 뉴스 ───────────────────────
    st.markdown('<div class="bh-section-label">오늘의 이슈 &amp; 뉴스</div>', unsafe_allow_html=True)
    news_items = _today_news(4)
    sent_color = {"긍정": "var(--red)", "부정": "var(--blue)", "중립": "var(--yellow)"}
    sent_label = {"긍정": "▲ 긍정", "부정": "▼ 부정", "중립": "— 중립"}
    nc1, nc2 = st.columns(2)
    for i, news in enumerate(news_items):
        col = nc1 if i % 2 == 0 else nc2
        sc = sent_color.get(news["sentiment"], "var(--muted)")
        sl = sent_label.get(news["sentiment"], "—")
        with col:
            st.markdown(
                f'<div style="background:var(--surf2);border:2px solid var(--border2);'
                f'border-left:4px solid {sc};padding:12px 14px;margin-bottom:10px;">'
                f'<div style="font-family:var(--font);font-size:0.6rem;letter-spacing:0.14em;'
                f'text-transform:uppercase;color:var(--cyan);margin-bottom:5px;">'
                f'{news["icon"]} {news["tag"]}'
                f'<span style="float:right;color:{sc};">{sl}</span></div>'
                f'<div style="font-size:0.88rem;font-weight:600;color:var(--white);line-height:1.4;">'
                f'{news["title"]}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.divider()

    # ── 떠오르는 섹터 TOP 5 ──────────────────────
    st.markdown('<div class="bh-section-label">떠오르는 섹터 TOP 5</div>', unsafe_allow_html=True)
    sectors = _sector_leaderboard(top_n=5)
    sec_cols = st.columns(5)
    for col, sec in zip(sec_cols, sectors):
        rate = sec["avg_rate"]
        color = "var(--red)" if rate > 0 else ("var(--blue)" if rate < 0 else "var(--muted)")
        arrow = "▲" if rate > 0 else ("▼" if rate < 0 else "—")
        with col:
            st.markdown(
                f'<div style="background:var(--surf2);border:2px solid var(--border2);'
                f'border-top:4px solid {color};padding:14px 12px;text-align:center;">'
                f'<div style="font-family:var(--font);font-size:0.6rem;letter-spacing:0.12em;'
                f'text-transform:uppercase;color:var(--muted);margin-bottom:6px;">'
                f'{sec["count"]}개 종목</div>'
                f'<div style="font-weight:700;font-size:0.95rem;color:var(--white);margin-bottom:6px;">'
                f'{sec["sector"]}</div>'
                f'<div style="font-family:var(--font);font-size:1.05rem;color:{color};">'
                f'{arrow} {rate:+.2f}%</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.divider()

    # ── 내 포트폴리오 현황 ────────────────────────
    st.markdown('<div class="bh-section-label">내 포트폴리오 현황</div>', unsafe_allow_html=True)
    summary = _portfolio_mini_summary(use_live)
    if summary is None:
        st.markdown(
            '<div style="background:var(--surf2);border:2px solid var(--border2);'
            'border-left:4px solid var(--yellow);padding:16px 18px;'
            'font-family:var(--font);font-size:0.85rem;color:var(--muted);">'
            '포트폴리오가 비어 있습니다. ◈ 포트폴리오 메뉴에서 종목을 추가하세요.</div>',
            unsafe_allow_html=True,
        )
    else:
        pm1, pm2, pm3, pm4 = st.columns(4)
        pm1.metric("투자원금", money_compact(summary["total_inv"]),
                   help="내가 주식을 살 때 쓴 총 금액")
        pm2.metric("평가금액", money_compact(summary["total_eval"]),
                   money_signed(summary["total_pft"]),
                   help="현재 주가로 환산한 총 가치")
        pm3.metric("총 수익률", signed_pct(summary["total_rate"]),
                   help="투자원금 대비 현재 손익")
        pm4.metric("보유 종목수", f"{len(summary['rows'])}개",
                   help="포트폴리오에 담긴 종목 수")

        b = summary["best"]
        w = summary["worst"]
        bc1, bc2 = st.columns(2)
        bc1.markdown(
            f'<div style="background:var(--surf2);border:2px solid var(--border2);'
            f'border-left:4px solid var(--red);padding:10px 14px;margin-top:6px;">'
            f'<div style="font-family:var(--font);font-size:0.6rem;letter-spacing:0.12em;'
            f'text-transform:uppercase;color:var(--cyan);">최고 수익 종목</div>'
            f'<div style="font-weight:700;font-size:0.95rem;color:var(--white);margin:4px 0;">'
            f'{b["name"]}</div>'
            f'<div style="font-family:var(--font);color:var(--red);">'
            f'▲ {b["profit_rate"]:+.2f}% &nbsp; {money_signed(b["profit"])}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
        bc2.markdown(
            f'<div style="background:var(--surf2);border:2px solid var(--border2);'
            f'border-left:4px solid var(--blue);padding:10px 14px;margin-top:6px;">'
            f'<div style="font-family:var(--font);font-size:0.6rem;letter-spacing:0.12em;'
            f'text-transform:uppercase;color:var(--cyan);">최저 수익 종목</div>'
            f'<div style="font-weight:700;font-size:0.95rem;color:var(--white);margin:4px 0;">'
            f'{w["name"]}</div>'
            f'<div style="font-family:var(--font);color:var(--blue);">'
            f'▼ {w["profit_rate"]:+.2f}% &nbsp; {money_signed(w["profit"])}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    # ── 키워드 검색 결과 (검색 중일 때만 표시) ─────
    searching = bool(keyword.strip())
    if searching:
        st.divider()
        st.markdown(
            f'<div class="bh-section-label">검색 결과 — "{keyword.strip()}" ({len(stocks)}개)</div>',
            unsafe_allow_html=True,
        )
        if not stocks:
            st.info("검색된 종목이 없습니다.")
        else:
            tab_cards, tab_table = st.tabs(["카드 보기", "표 보기"])
            with tab_cards:
                render_stock_cards(stocks, use_live)
            with tab_table:
                render_stock_table(stocks, use_live)


def select_stock_widget(
    market: str,
    keyword: str = "",
    sectors: list[str] | None = None,
    label: str = "종목 선택",
) -> Stock:
    stocks = filtered_stocks(market, keyword, sectors or [])
    if not stocks:
        stocks = all_stocks()

    # selected_code 가 현재 목록에 없으면 해당 종목을 맨 앞에 삽입
    selected_code = st.session_state.get("selected_code")
    if selected_code and not any(s.code == selected_code for s in stocks):
        target = find_stock(selected_code)
        if target:
            stocks = [target] + stocks

    options = {f"{s.market} · {s.name} ({s.code})": s for s in stocks}
    labels = list(options.keys())
    default_index = 0
    if selected_code:
        for idx, lbl in enumerate(labels):
            if selected_code in lbl:
                default_index = idx
                break
    choice = st.selectbox(label, labels, index=default_index)
    stock = options[choice]
    st.session_state["selected_code"] = stock.code
    return stock


def render_chart(stock: Stock, period_label: str, use_live: bool) -> tuple[pd.DataFrame, str]:
    raw, source = get_chart_data(stock, PERIODS[period_label], use_live)
    df = calculate_indicators(raw)

    fig = make_subplots(
        rows=4,
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.04,
        row_heights=[0.52, 0.16, 0.16, 0.16],
        subplot_titles=(
            f"📈 {stock.name} 가격 차트  (🔴양봉=상승 / 🔵음봉=하락)",
            "📊 거래량  (봉 클수록 매매 활발)",
            "📉 MACD  (막대 0선 위=매수세 강함 / 아래=매도세 강함)",
            "⚡ RSI  (70↑ 과매수 주의  ·  30↓ 과매도→반등 기대)",
        ),
    )

    # ── 볼린저밴드 ───────────────────────────────────
    fig.add_trace(
        go.Scatter(
            x=pd.concat([df["date"], df["date"].iloc[::-1]]),
            y=pd.concat([df["bb_upper"], df["bb_lower"].iloc[::-1]]),
            fill="toself", fillcolor="rgba(88,166,255,0.07)",
            line=dict(color="rgba(0,0,0,0)"),
            hoverinfo="skip", name="볼린저밴드 (가격 범위)",
        ),
        row=1, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["bb_upper"], name="BB상단",
            line=dict(color="#5888A8", width=0.8, dash="dot"), opacity=0.6,
            hovertemplate="<b>볼린저밴드 상단</b><br>%{x}<br>%{y:,.0f}원<br><i>주가가 이 선 근처면 과매수 구간</i><extra></extra>",
        ),
        row=1, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["bb_lower"], name="BB하단",
            line=dict(color="#5888A8", width=0.8, dash="dot"), opacity=0.6,
            hovertemplate="<b>볼린저밴드 하단</b><br>%{x}<br>%{y:,.0f}원<br><i>주가가 이 선 근처면 과매도 구간</i><extra></extra>",
        ),
        row=1, col=1,
    )

    # ── 캔들스틱 ────────────────────────────────────
    fig.add_trace(
        go.Candlestick(
            x=df["date"],
            open=df["open"], high=df["high"], low=df["low"], close=df["close"],
            name="캔들 (일봉)",
            increasing_line_color="#C84848", increasing_fillcolor="#C84848",
            decreasing_line_color="#3E9050", decreasing_fillcolor="#3E9050",
        ),
        row=1, col=1,
    )

    # ── 이동평균선 ───────────────────────────────────
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["ma5"], name="MA5 (단기·5일)",
            line=dict(color="#B87830", width=1.5),
            hovertemplate="<b>MA5 단기 이동평균</b><br>%{x}<br>%{y:,.0f}원<br><i>최근 5일 종가 평균. 단기 추세 파악용</i><extra></extra>",
        ),
        row=1, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["ma20"], name="MA20 (중기·20일)",
            line=dict(color="#5888A8", width=1.5),
            hovertemplate="<b>MA20 중기 이동평균</b><br>%{x}<br>%{y:,.0f}원<br><i>최근 20일 평균. 골든/데드크로스 기준선</i><extra></extra>",
        ),
        row=1, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["ma60"], name="MA60 (장기·60일)",
            line=dict(color="#7060A8", width=1.5),
            hovertemplate="<b>MA60 장기 이동평균</b><br>%{x}<br>%{y:,.0f}원<br><i>최근 60일(약 3개월) 평균. 큰 추세 판단용</i><extra></extra>",
        ),
        row=1, col=1,
    )

    # ── 골든/데드크로스 마커 + 차트 위 텍스트 ───────
    valid = df.dropna(subset=["ma5", "ma20"])
    if len(valid) >= 2:
        prev_diff = (valid["ma5"] - valid["ma20"]).shift(1)
        curr_diff = valid["ma5"] - valid["ma20"]
        golden = valid[(prev_diff < 0) & (curr_diff >= 0)]
        dead   = valid[(prev_diff > 0) & (curr_diff <= 0)]
        if not golden.empty:
            fig.add_trace(
                go.Scatter(
                    x=golden["date"], y=golden["ma5"],
                    mode="markers+text",
                    marker=dict(symbol="triangle-up", size=14, color="#C89020",
                                line=dict(color="#F5F1EB", width=1)),
                    text=["골든크로스"] * len(golden),
                    textposition="bottom center",
                    textfont=dict(size=9, color="#C89020"),
                    hovertemplate="<b>🟡 골든크로스 (매수 신호)</b><br>%{x}<br>MA5가 MA20을 위로 돌파<br><i>단기 평균이 중기 평균을 넘어서는 순간.<br>상승 추세 시작 신호로 봅니다.</i><extra></extra>",
                    name="골든크로스 (매수신호)",
                ),
                row=1, col=1,
            )
        if not dead.empty:
            fig.add_trace(
                go.Scatter(
                    x=dead["date"], y=dead["ma5"],
                    mode="markers+text",
                    marker=dict(symbol="triangle-down", size=14, color="#4878A8",
                                line=dict(color="#F5F1EB", width=1)),
                    text=["데드크로스"] * len(dead),
                    textposition="top center",
                    textfont=dict(size=9, color="#4878A8"),
                    hovertemplate="<b>🔵 데드크로스 (매도 신호)</b><br>%{x}<br>MA5가 MA20을 아래로 돌파<br><i>단기 평균이 중기 평균 아래로 꺾이는 순간.<br>하락 추세 시작 신호로 봅니다.</i><extra></extra>",
                    name="데드크로스 (매도신호)",
                ),
                row=1, col=1,
            )

    # ── 현재가 수평선 ────────────────────────────────
    last_close = float(df["close"].iloc[-1])
    fig.add_hline(
        y=last_close,
        line_dash="dash", line_color="#B87830", line_width=1.2,
        annotation_text=f"현재가 {last_close:,.0f}원",
        annotation_position="top right",
        annotation_font_size=11, annotation_font_color="#B87830",
        row=1, col=1,
    )

    # ── 거래량 (양봉일=빨강, 음봉일=초록) ───────────
    vol_colors = [
        "#C84848" if float(c) >= float(o) else "#3E9050"
        for c, o in zip(df["close"], df["open"])
    ]
    fig.add_trace(
        go.Bar(
            x=df["date"], y=df["volume"], name="거래량",
            marker_color=vol_colors, opacity=0.85,
            hovertemplate="<b>거래량</b><br>%{x}<br>%{y:,.0f}주<br><i>이날 사고팔린 주식 수.<br>봉이 클수록 시장의 관심이 높은 날.</i><extra></extra>",
        ),
        row=2, col=1,
    )

    # ── MACD ────────────────────────────────────────
    hist_colors = [
        "#C84848" if float(v) >= 0 else "#3E9050"
        for v in df["histogram"].fillna(0)
    ]
    fig.add_trace(
        go.Bar(
            x=df["date"], y=df["histogram"], name="MACD 막대",
            marker_color=hist_colors, opacity=0.8,
            hovertemplate="<b>MACD 막대</b><br>%{x}<br>%{y:.2f}<br><i>빨강=매수세 우세 / 초록=매도세 우세.<br>막대가 커질수록 추세가 강해지는 중.</i><extra></extra>",
        ),
        row=3, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["macd"], name="MACD선",
            line=dict(color="#5888A8", width=1.5),
            hovertemplate="<b>MACD선</b><br>%{x}<br>%{y:.2f}<br><i>12일 평균 - 26일 평균.<br>시그널선과 교차 시 매수/매도 신호.</i><extra></extra>",
        ),
        row=3, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["signal"], name="시그널선",
            line=dict(color="#C84848", width=1.5),
            hovertemplate="<b>시그널선</b><br>%{x}<br>%{y:.2f}<br><i>MACD의 9일 평균.<br>MACD가 이 선을 위로 넘으면 매수 신호.</i><extra></extra>",
        ),
        row=3, col=1,
    )
    fig.add_hline(y=0, line_dash="solid", line_color="rgba(255,255,255,0.2)", line_width=1, row=3, col=1)

    # ── RSI ─────────────────────────────────────────
    fig.add_hrect(y0=70, y1=100, row=4, col=1, fillcolor="rgba(248,81,73,0.12)", line_width=0)
    fig.add_hrect(y0=0,  y1=30,  row=4, col=1, fillcolor="rgba(63,185,80,0.12)",  line_width=0)
    fig.add_trace(
        go.Scatter(
            x=df["date"], y=df["rsi"], name="RSI(14)",
            line=dict(color="#A89030", width=1.8),
            hovertemplate=(
                "<b>RSI</b>  %{y:.1f}<br>%{x}<br>"
                "<i>0~100 사이 값. 14일 기준 과매수·과매도 지표.<br>"
                "70 이상 → 너무 올랐을 수 있음 (매도 고려)<br>"
                "30 이하 → 너무 떨어졌을 수 있음 (매수 고려)</i>"
                "<extra></extra>"
            ),
        ),
        row=4, col=1,
    )
    fig.add_hline(y=70, line_dash="dot", line_color="#C84848", line_width=1,
                  annotation_text="과매수(70)", annotation_font_size=10,
                  annotation_font_color="#C84848", annotation_position="right",
                  row=4, col=1)
    fig.add_hline(y=30, line_dash="dot", line_color="#3E9050", line_width=1,
                  annotation_text="과매도(30)", annotation_font_size=10,
                  annotation_font_color="#3E9050", annotation_position="right",
                  row=4, col=1)

    # ── 레이아웃 ─────────────────────────────────────
    fig.update_layout(
        template="plotly_white",
        height=860,
        margin=dict(l=10, r=60, t=50, b=10),
        xaxis_rangeslider_visible=False,
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="left", x=0, font=dict(size=11, color="#3D3830"),
            bgcolor="rgba(245,241,235,0.9)",
        ),
        paper_bgcolor="rgba(245,241,235,1)",
        plot_bgcolor="rgba(237,233,226,1)",
        font=dict(color="#3D3830", family="Nanum Gothic"),
        hoverlabel=dict(bgcolor="#FFFFFF", font_size=12, namelength=-1, font_color="#1C1916"),
    )
    fig.update_yaxes(tickformat=",", row=1, col=1, gridcolor="#D4CFC6", zerolinecolor="#C2BCB4")
    fig.update_yaxes(title_text="RSI", range=[0, 100], row=4, col=1, gridcolor="#D4CFC6")
    fig.update_xaxes(gridcolor="#D4CFC6", showgrid=False)
    fig.update_layout(clickmode="event+select")

    event = st.plotly_chart(
        fig,
        use_container_width=True,
        on_select="rerun",
        key=f"chart-{stock.code}-{period_label}",
    )
    return df, source, event


def render_forecast(df: pd.DataFrame, stock: Stock) -> None:
    forecast_days = st.radio("예측 기간", ["5영업일", "20영업일"], index=0, horizontal=True, key=f"forecast-days-{stock.code}")
    days = 5 if forecast_days == "5영업일" else 20
    try:
        forecast, diagnostics = advanced_forecast_prices(df, stock, days)
    except ValueError as exc:
        st.warning(str(exc))
        return

    history = df[["date", "close"]].copy()
    history["close"] = pd.to_numeric(history["close"], errors="coerce")
    history = history.dropna(subset=["date", "close"]).tail(45)

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=history["date"], y=history["close"], name="최근 종가", line=dict(color="#5888A8")))
    fig.add_trace(
        go.Scatter(
            x=pd.concat([forecast["date"], forecast["date"].iloc[::-1]]),
            y=pd.concat([forecast["upper"], forecast["lower"].iloc[::-1]]),
            fill="toself",
            fillcolor="rgba(242, 204, 96, 0.18)",
            line=dict(color="rgba(255,255,255,0)"),
            hoverinfo="skip",
            name="90% 신뢰구간",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=forecast["date"],
            y=forecast["forecast"],
            name="요인 반영 예측",
            line=dict(color="#B87830", dash="dash"),
            mode="lines+markers",
        )
    )
    fig.update_layout(
        template="plotly_white",
        height=340,
        title=f"{stock.name} 다요인 예측",
        margin=dict(l=10, r=10, t=48, b=10),
        paper_bgcolor="rgba(245,241,235,1)",
        plot_bgcolor="rgba(237,233,226,1)",
        font=dict(color="#3D3830", family="Nanum Gothic"),
    )
    st.plotly_chart(fig, use_container_width=True)

    col1, col2, col3 = st.columns(3)
    col1.metric("종합 요인 점수", f"{diagnostics['factor_score']:+.2f}")
    col2.metric("예상 일간 수익률", f"{diagnostics['expected_daily_return'] * 100:+.2f}%")
    col3.metric("일간 변동성", f"{diagnostics['daily_volatility'] * 100:.2f}%")

    factor_labels = {
        "ma_trend": "이동평균 추세",
        "momentum": "가격 모멘텀",
        "volume": "거래량",
        "volatility": "변동성 패널티",
        "market_relative_strength": "지수 상대강도",
        "sector_relative_strength": "업종 상대강도",
        "news_sentiment": "뉴스 심리",
        "earnings_surprise": "실적 서프라이즈",
        "money_flow": "수급",
        "disclosure_risk": "공시 리스크",
        "index_flow": "지수 흐름",
        "sector_flow_external": "외부 업종 흐름",
    }
    factor_rows = [{"요인": label, "점수": round(float(diagnostics[key]), 3)} for key, label in factor_labels.items()]
    st.dataframe(pd.DataFrame(factor_rows), use_container_width=True, hide_index=True)
    st.caption("뉴스/실적/수급/공시/지수/업종 외부 요인은 data/external_signals.json 점수를 반영합니다. 신뢰구간은 최근 종가 변동성 기반의 통계적 범위입니다.")


# ─── 캔들 패턴 분석 ─────────────────────────────────────────────────────────

def _cp_body(r: pd.Series) -> float:
    return abs(float(r["close"]) - float(r["open"]))

def _cp_upper(r: pd.Series) -> float:
    return float(r["high"]) - max(float(r["open"]), float(r["close"]))

def _cp_lower(r: pd.Series) -> float:
    return min(float(r["open"]), float(r["close"])) - float(r["low"])

def _cp_range(r: pd.Series) -> float:
    return float(r["high"]) - float(r["low"])

def _cp_mid(r: pd.Series) -> float:
    return (float(r["open"]) + float(r["close"])) / 2

def _bull(r: pd.Series) -> bool:
    return float(r["close"]) > float(r["open"])

def _bear(r: pd.Series) -> bool:
    return float(r["close"]) < float(r["open"])

def _doji(r: pd.Series) -> bool:
    rng = _cp_range(r)
    return rng > 0 and _cp_body(r) <= rng * 0.1


def analyze_candle_patterns(df: pd.DataFrame) -> list[dict]:
    """최근 캔들에서 주요 1·2·3봉 패턴을 감지."""
    if len(df) < 3:
        return []

    c1, c2, c3 = df.iloc[-3], df.iloc[-2], df.iloc[-1]
    patterns: list[dict] = []

    # ── 1봉 패턴 (최신 캔들 기준) ────────────────────────
    rng = _cp_range(c3)
    if rng > 0:
        body = _cp_body(c3)
        upper = _cp_upper(c3)
        lower = _cp_lower(c3)

        if _doji(c3):
            patterns.append({
                "name": "도지", "english": "Doji", "signal": "중립", "candles": 1, "strength": "중",
                "desc": "시가와 종가가 거의 같습니다. 매수·매도 세력이 팽팽한 균형 상태로 추세 전환 가능성이 있습니다.",
            })
        elif _bull(c3) and body >= rng * 0.7:
            patterns.append({
                "name": "장대양봉", "english": "Long White Candle", "signal": "매수", "candles": 1, "strength": "강",
                "desc": "강한 매수세로 종가가 고가 근처에서 마감됐습니다. 상승 모멘텀이 강하게 살아있는 신호입니다.",
            })
        elif _bear(c3) and body >= rng * 0.7:
            patterns.append({
                "name": "장대음봉", "english": "Long Black Candle", "signal": "매도", "candles": 1, "strength": "강",
                "desc": "강한 매도세로 종가가 저가 근처에서 마감됐습니다. 하락 압력이 거센 신호입니다.",
            })
        elif body > 0 and lower >= body * 2 and upper <= body * 0.5:
            recent = df.iloc[-6:-1] if len(df) >= 6 else df.iloc[:-1]
            trend_down = float(recent["close"].iloc[-1]) < float(recent["close"].iloc[0])
            if trend_down:
                patterns.append({
                    "name": "망치형", "english": "Hammer", "signal": "매수", "candles": 1, "strength": "중",
                    "desc": "하락 추세 마지막에 나타난 망치형! 아래꼬리가 길어 저가에서 강한 매수가 들어왔음을 의미합니다. 반등 가능성에 주목하세요.",
                })
            else:
                patterns.append({
                    "name": "교수형", "english": "Hanging Man", "signal": "매도", "candles": 1, "strength": "중",
                    "desc": "상승 추세 후 망치 모양의 봉이 나타났습니다. 매도세 유입 경고 신호입니다.",
                })
        elif body > 0 and upper >= body * 2 and lower <= body * 0.5:
            recent = df.iloc[-6:-1] if len(df) >= 6 else df.iloc[:-1]
            trend_down = float(recent["close"].iloc[-1]) < float(recent["close"].iloc[0])
            if trend_down:
                patterns.append({
                    "name": "역망치형", "english": "Inverted Hammer", "signal": "매수", "candles": 1, "strength": "약",
                    "desc": "하락 추세 말에 위꼬리가 긴 봉이 나타났습니다. 매수 시도 신호로 다음 봉에서 양봉 확인이 필요합니다.",
                })
            else:
                patterns.append({
                    "name": "유성형", "english": "Shooting Star", "signal": "매도", "candles": 1, "strength": "강",
                    "desc": "상승 추세에서 나타난 유성형! 위꼬리가 길어 고점에서 매도세가 강함을 의미합니다. 하락 반전 경고입니다.",
                })

    # ── 2봉 패턴 ─────────────────────────────────────────
    p1, p2 = c2, c3

    if abs(float(p1["low"]) - float(p2["low"])) <= float(p1["low"]) * 0.002 and _bear(p1) and _bull(p2):
        patterns.append({
            "name": "집게바닥", "english": "Tweezer Bottom", "signal": "매수", "candles": 2, "strength": "중",
            "desc": "두 캔들의 저가가 같은 지점에서 지지됐습니다. 강한 지지선 형성 신호로 추가 하락이 막힌 것을 의미합니다.",
        })

    if abs(float(p1["high"]) - float(p2["high"])) <= float(p1["high"]) * 0.002 and _bull(p1) and _bear(p2):
        patterns.append({
            "name": "집게천장", "english": "Tweezer Top", "signal": "매도", "candles": 2, "strength": "중",
            "desc": "두 캔들의 고가가 같은 지점에서 저항을 받았습니다. 강한 저항선 형성 신호로 추가 상승이 막힌 것을 의미합니다.",
        })

    if (_bear(p1) and _bull(p2)
            and float(p2["open"]) <= float(p1["close"])
            and float(p2["close"]) >= float(p1["open"])):
        patterns.append({
            "name": "상승장악형", "english": "Bullish Engulfing", "signal": "매수", "candles": 2, "strength": "강",
            "desc": "오늘 양봉이 어제 음봉을 완전히 감쌌습니다! 강력한 매수 반전 신호입니다. 초보자가 반드시 알아야 할 핵심 패턴입니다.",
        })

    if (_bull(p1) and _bear(p2)
            and float(p2["open"]) >= float(p1["close"])
            and float(p2["close"]) <= float(p1["open"])):
        patterns.append({
            "name": "하락장악형", "english": "Bearish Engulfing", "signal": "매도", "candles": 2, "strength": "강",
            "desc": "오늘 음봉이 어제 양봉을 완전히 감쌌습니다. 강력한 매도 반전 신호입니다. 하락 전환에 주의하세요!",
        })

    p1b = _cp_body(p1)
    p2b = _cp_body(p2)
    if (p1b > 0 and _bear(p1) and _bull(p2) and p2b <= p1b * 0.5
            and float(p2["open"]) >= min(float(p1["open"]), float(p1["close"]))
            and float(p2["close"]) <= max(float(p1["open"]), float(p1["close"]))):
        patterns.append({
            "name": "상승하라미", "english": "Bullish Harami", "signal": "매수", "candles": 2, "strength": "중",
            "desc": "큰 음봉 안에 작은 양봉이 품겨 있습니다(하라미=임신). 하락 추세 약화 신호로 추세 전환을 살펴보세요.",
        })

    if (p1b > 0 and _bull(p1) and _bear(p2) and p2b <= p1b * 0.5
            and float(p2["open"]) <= max(float(p1["open"]), float(p1["close"]))
            and float(p2["close"]) >= min(float(p1["open"]), float(p1["close"]))):
        patterns.append({
            "name": "하락하라미", "english": "Bearish Harami", "signal": "매도", "candles": 2, "strength": "중",
            "desc": "큰 양봉 안에 작은 음봉이 품겨 있습니다. 상승 추세 약화 신호입니다.",
        })

    if (_bear(p1) and _bull(p2)
            and float(p2["open"]) < float(p1["low"])
            and float(p2["close"]) > _cp_mid(p1)
            and float(p2["close"]) < float(p1["open"])):
        patterns.append({
            "name": "관통형", "english": "Piercing Line", "signal": "매수", "candles": 2, "strength": "중",
            "desc": "음봉 아래에서 시작한 양봉이 절반 이상 올라왔습니다. 상승 반전 가능성 신호입니다.",
        })

    if (_bull(p1) and _bear(p2)
            and float(p2["open"]) > float(p1["high"])
            and float(p2["close"]) < _cp_mid(p1)
            and float(p2["close"]) > float(p1["open"])):
        patterns.append({
            "name": "먹구름덮개", "english": "Dark Cloud Cover", "signal": "매도", "candles": 2, "strength": "중",
            "desc": "양봉 위에서 시작한 음봉이 절반 아래까지 내려왔습니다. 하락 반전 경고 신호입니다.",
        })

    # ── 3봉 패턴 ─────────────────────────────────────────
    c1_bear = _bear(c1) and _cp_body(c1) >= _cp_range(c1) * 0.5
    c1_bull = _bull(c1) and _cp_body(c1) >= _cp_range(c1) * 0.5
    c2_small = (_cp_body(c2) <= _cp_range(c2) * 0.35) if _cp_range(c2) > 0 else True
    c3_bull_mid = _bull(c3) and float(c3["close"]) >= _cp_mid(c1)
    c3_bear_mid = _bear(c3) and float(c3["close"]) <= _cp_mid(c1)

    if c1_bear and c2_small and c3_bull_mid:
        name = "샛별 도지" if _doji(c2) else "모닝스타"
        english = "Morning Doji Star" if _doji(c2) else "Morning Star"
        desc = (
            "모닝스타 변형 — 가운데 봉이 도지(시가≈종가)입니다. 더 강한 반전 신호로 간주됩니다."
            if _doji(c2) else
            "하락 추세의 바닥에서 나타나는 반전 3봉 패턴! ① 큰 음봉 ② 작은 몸통 ③ 큰 양봉. 새벽별처럼 반등을 예고합니다."
        )
        patterns.append({"name": name, "english": english, "signal": "매수", "candles": 3, "strength": "강", "desc": desc})

    if c1_bull and c2_small and c3_bear_mid:
        patterns.append({
            "name": "이브닝스타", "english": "Evening Star", "signal": "매도", "candles": 3, "strength": "강",
            "desc": "상승 추세 고점에서 나타나는 반전 패턴. ① 큰 양봉 ② 작은 몸통 ③ 큰 음봉. 저녁별처럼 하락을 예고합니다.",
        })

    if (_bull(c1) and _bull(c2) and _bull(c3)
            and float(c2["close"]) > float(c1["close"])
            and float(c3["close"]) > float(c2["close"])
            and float(c2["open"]) >= float(c1["open"])
            and float(c3["open"]) >= float(c2["open"])):
        patterns.append({
            "name": "적삼병", "english": "Three White Soldiers", "signal": "매수", "candles": 3, "strength": "강",
            "desc": "3개의 양봉이 연속으로 더 높게 마감! 강한 상승 추세 형성 신호입니다. 붉은 병사 셋이 행진하듯 주가가 오릅니다.",
        })

    if (_bear(c1) and _bear(c2) and _bear(c3)
            and float(c2["close"]) < float(c1["close"])
            and float(c3["close"]) < float(c2["close"])
            and float(c2["open"]) <= float(c1["open"])
            and float(c3["open"]) <= float(c2["open"])):
        patterns.append({
            "name": "흑삼병", "english": "Three Black Crows", "signal": "매도", "candles": 3, "strength": "강",
            "desc": "3개의 음봉이 연속으로 더 낮게 마감! 강한 하락 추세 신호입니다. 검은 까마귀 셋이 하락을 예고합니다.",
        })

    return patterns


def render_candle_pattern_section(df: pd.DataFrame) -> None:
    """차트 아래 캔들 패턴 분석 알림창."""
    st.markdown('<div class="bh-section-label">캔들 패턴 분석</div>', unsafe_allow_html=True)

    opt1, opt2, opt3 = st.columns(3)
    show_1 = opt1.checkbox("1봉 패턴 (단일봉)", value=True, key="cp_show1")
    show_2 = opt2.checkbox("2봉 패턴", value=True, key="cp_show2")
    show_3 = opt3.checkbox("3봉 패턴", value=True, key="cp_show3")

    patterns = analyze_candle_patterns(df)
    shown = [p for p in patterns if
             (p["candles"] == 1 and show_1) or
             (p["candles"] == 2 and show_2) or
             (p["candles"] == 3 and show_3)]

    if not shown:
        st.markdown(
            '<div style="background:var(--surf2);border:2px solid var(--border2);'
            'border-left:4px solid var(--muted);padding:14px 18px;'
            'font-size:0.85rem;color:var(--muted);">'
            '선택한 봉 수 범위에서 특징적인 패턴이 감지되지 않았습니다.</div>',
            unsafe_allow_html=True,
        )
    else:
        _sig_color = {"매수": "var(--red)", "매도": "var(--blue)", "중립": "var(--yellow)"}
        _sig_badge = {"매수": "▲ 매수 신호", "매도": "▼ 매도 신호", "중립": "— 중립"}
        _str_label = {"강": "🔴 강한 신호", "중": "🟡 보통 신호", "약": "⚪ 약한 신호"}
        for p in shown:
            sc = _sig_color[p["signal"]]
            sb = _sig_badge[p["signal"]]
            sl = _str_label[p["strength"]]
            st.markdown(
                f'<div style="background:var(--surf2);border:2px solid var(--border2);'
                f'border-left:5px solid {sc};padding:14px 18px;margin-bottom:10px;">'
                f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">'
                f'<div><span style="font-weight:800;font-size:1rem;color:var(--white);">{p["name"]}</span>'
                f'&nbsp;<span style="font-family:var(--mono);font-size:0.66rem;color:var(--muted);">'
                f'{p["english"]} · {p["candles"]}봉</span></div>'
                f'<div style="display:flex;gap:8px;align-items:center;">'
                f'<span style="font-family:var(--mono);font-size:0.72rem;color:{sc};'
                f'border:1px solid {sc};padding:2px 8px;">{sb}</span>'
                f'<span style="font-size:0.7rem;color:var(--muted);">{sl}</span>'
                f'</div></div>'
                f'<div style="font-size:0.86rem;color:var(--fg);line-height:1.55;">{p["desc"]}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    with st.expander("📖 캔들봉 종류 가이드 (초보자 필독)", expanded=False):
        st.markdown("""
**캔들봉(봉차트)이란?**
각 캔들은 하루의 주가를 나타냅니다.

| 구성요소 | 의미 |
|---------|------|
| **몸통** | 시가(시작가)와 종가(마감가) 사이 |
| **윗꼬리** | 몸통 위로 올라간 선 → 장중 최고가 |
| **아랫꼬리** | 몸통 아래로 내려간 선 → 장중 최저가 |
| **🔴 양봉** | 종가 > 시가 (주가 오른 날) |
| **🔵 음봉** | 종가 < 시가 (주가 내린 날) |

---

**초보자 필수 패턴 14가지**

| 패턴 | 봉 수 | 신호 | 핵심 특징 |
|------|:-----:|:----:|---------|
| 장대양봉 | 1 | 매수 | 꼬리 없이 긴 양봉, 강한 상승 |
| 장대음봉 | 1 | 매도 | 꼬리 없이 긴 음봉, 강한 하락 |
| 도지 | 1 | 중립 | 시가≈종가, 추세 전환 가능성 |
| 망치형 | 1 | 매수 | 하락 말기 아래꼬리 긴 봉 → 반등 기대 |
| 역망치형 | 1 | 매수 | 하락 말기 위꼬리 긴 봉 → 다음 봉 확인 필요 |
| 교수형 | 1 | 매도 | 상승 말기 망치 모양 → 경계 신호 |
| 유성형 | 1 | 매도 | 상승 말기 위꼬리 긴 봉 → 강한 하락 경고 |
| 집게바닥 | 2 | 매수 | 두 봉의 저가가 동일한 지지선 |
| 집게천장 | 2 | 매도 | 두 봉의 고가가 동일한 저항선 |
| 상승장악형 | 2 | 매수 | 양봉이 음봉을 완전히 감쌈 → 강한 반전 |
| 하락장악형 | 2 | 매도 | 음봉이 양봉을 완전히 감쌈 → 강한 반전 |
| 모닝스타 | 3 | 매수 | 음봉+소봉+양봉, 바닥 반전의 새벽별 |
| 이브닝스타 | 3 | 매도 | 양봉+소봉+음봉, 천장 반전의 저녁별 |
| 적삼병 | 3 | 매수 | 연속 3양봉 → 강한 상승 추세 |
| 흑삼병 | 3 | 매도 | 연속 3음봉 → 강한 하락 추세 |

> ⚠️ **주의**: 패턴은 확률적 신호입니다. 단독으로 매매 결정하지 말고, **거래량·이동평균선·뉴스**와 함께 종합 판단하세요.
        """)


def render_chart_page(market: str, use_live: bool, keyword: str = "", sectors: list[str] | None = None) -> None:
    st.title("종목별 차트")

    # ── 상단 행: 종목 선택 | 기간 선택 | 포트폴리오 버튼 ──
    sel_col, period_col, btn_col = st.columns([3, 1, 1])
    with sel_col:
        stock = select_stock_widget(market, keyword, sectors)
    with period_col:
        period = st.selectbox("차트 기간", list(PERIODS.keys()), index=1)

    # 컬럼 컨텍스트 밖에서 데이터 조회
    snapshot = stock_snapshot(stock, use_live)
    df_period, _ = get_chart_data(stock, PERIODS[period], use_live)
    period_high = int(df_period["high"].max())
    period_low  = int(df_period["low"].min())

    with btn_col:
        st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
        if st.button("＋ 포트폴리오 추가", use_container_width=True, type="primary"):
            st.session_state["portfolio_add_code"] = stock.code
            st.session_state["portfolio_add_price"] = snapshot["price"]

    # ── 메트릭 행: 6열 (버튼 분리로 여유 확보) ──
    col1, col2, col3, col4, col5, col6 = st.columns(6)
    col1.metric(
        "현재가 (1주)",
        money(snapshot["price"]),
        money_signed(snapshot["change"]),
        help="주식 1주를 사고팔 때의 가격입니다.",
    )
    col2.metric(
        "등락률",
        signed_pct(snapshot["change_rate"]),
        help="전 거래일 종가 대비 오늘 가격이 오르거나 내린 비율입니다.",
    )
    col3.metric(
        "거래량",
        volume_fmt(snapshot["volume"]),
        help="오늘 하루 동안 사고팔린 주식 수입니다. 많을수록 관심이 높습니다.",
    )
    col4.metric(
        "시장",
        stock.market,
        help="KOSPI=대형주 중심 / KOSDAQ=중소·성장주 중심",
    )
    col5.metric(
        f"최고가 ({period})",
        money(period_high),
        help=f"선택한 기간({period}) 중 가장 높았던 1주당 가격입니다.",
    )
    col6.metric(
        f"최저가 ({period})",
        money(period_low),
        help=f"선택한 기간({period}) 중 가장 낮았던 1주당 가격입니다.",
    )

    if st.session_state.get("portfolio_add_code") == stock.code:
        with st.form("chart-portfolio-form", clear_on_submit=True):
            st.markdown(f"**{stock.name}** ({stock.code}) 포트폴리오 추가")
            fc1, fc2, fc3 = st.columns(3)
            quantity = fc1.number_input("수량", min_value=1, value=10, step=1)
            buy_price = fc2.number_input(
                "평균단가",
                min_value=1,
                value=st.session_state["portfolio_add_price"],
                step=100,
            )
            memo = fc3.text_input("메모", placeholder="선택 입력")
            fs1, fs2 = st.columns(2)
            if fs1.form_submit_button("추가 확정", use_container_width=True, type="primary"):
                portfolio = read_json(PORTFOLIO_FILE, [])
                portfolio.append(
                    {
                        "code": stock.code,
                        "name": stock.name,
                        "market": stock.market,
                        "quantity": int(quantity),
                        "buy_price": int(buy_price),
                        "memo": memo,
                        "created_at": datetime.now().isoformat(timespec="seconds"),
                    }
                )
                write_json(PORTFOLIO_FILE, portfolio)
                st.session_state.pop("portfolio_add_code", None)
                st.session_state.pop("portfolio_add_price", None)
                st.success(f"{stock.name} 을(를) 포트폴리오에 추가했습니다.")
                st.rerun()
            if fs2.form_submit_button("취소", use_container_width=True):
                st.session_state.pop("portfolio_add_code", None)
                st.session_state.pop("portfolio_add_price", None)
                st.rerun()

    st.divider()
    try:
        df, source, chart_event = render_chart(stock, period, use_live)
    except Exception as exc:
        st.error(f"차트 렌더링 오류: {exc}")
        return
    st.caption(
        f"차트 데이터 출처: {source} · {datetime.now().strftime('%H:%M:%S')} 기준  "
        f"  ·  **봉을 클릭하면 해당 날짜 이슈 뉴스가 표시됩니다.**"
    )

    # ── 날짜 클릭 → 당일 이슈 뉴스 ─────────────────
    clicked_date: str | None = None
    try:
        if chart_event and chart_event.selection and chart_event.selection.points:
            raw_x = chart_event.selection.points[0].get("x", "")
            clicked_date = str(raw_x)[:10] if raw_x else None
    except Exception:
        pass

    if clicked_date:
        st.divider()
        try:
            render_date_news_panel(stock, clicked_date, df)
        except Exception as exc:
            st.warning(f"뉴스 생성 오류: {exc}")

    st.divider()
    try:
        render_candle_pattern_section(df)
    except Exception as exc:
        st.warning(f"패턴 분석 오류: {exc}")
    st.divider()
    try:
        render_forecast(df, stock)
    except Exception as exc:
        st.warning(f"예측 계산 실패 (차트는 정상): {exc}")
    st.divider()
    render_stock_advisor_panel(stock)


def render_favorites_page(use_live: bool) -> None:
    st.title("관심종목")
    favorites = read_json(FAVORITES_FILE, [])
    if not favorites:
        st.info("아직 등록된 관심종목이 없습니다. 종목 화면에서 관심 버튼을 눌러 추가하세요.")
        return
    stocks = [find_stock(item["code"]) for item in favorites]
    render_stock_cards([stock for stock in stocks if stock is not None], use_live)


def _dalio_stock_analysis(stock: Stock, row: dict) -> dict:
    debt_proxy = (seed_for(stock.code, "debt") % 200) + 50
    div_yield = round((seed_for(stock.code, "div") % 40) / 10, 1)
    profit_rate = row["profit_rate"]

    score = 0.0
    reasons: list[str] = []

    if debt_proxy < 100:
        score += 0.3
        reasons.append(f"부채비율 추정 {debt_proxy}% — 낮은 레버리지, 리스크 패리티 적합")
    elif debt_proxy < 150:
        score += 0.1
        reasons.append(f"부채비율 추정 {debt_proxy}% — 보통 수준, 분기별 모니터링 권장")
    else:
        score -= 0.3
        reasons.append(f"부채비율 추정 {debt_proxy}% — 고레버리지, 부채 사이클 후기에 위험")

    if div_yield > 2.0:
        score += 0.2
        reasons.append(f"배당수익률 추정 {div_yield}% — 인플레이션 헤지 역할 가능")
    elif div_yield > 1.0:
        score += 0.1
        reasons.append(f"배당수익률 {div_yield}% — 보통. 올웨더 관점에서 방어성 다소 부족")
    else:
        score -= 0.1
        reasons.append("배당수익률 낮음 — 방어 자산 역할 어려움, 채권·금 병행 권장")

    if profit_rate < -15:
        score -= 0.2
        reasons.append(f"현재 {profit_rate:.1f}% 손실 — 포지션 규모 점검, 상관자산 리밸런싱 검토")
    elif profit_rate > 10:
        score += 0.1
        reasons.append(f"현재 +{profit_rate:.1f}% 수익 — 비중이 과대해졌는지 점검하고 리밸런싱")

    defensive = {"금융", "자동차부품", "철강"}
    volatile = {"바이오", "게임", "엔터"}
    if stock.sector in defensive:
        score += 0.1
        reasons.append(f"{stock.sector} 섹터 — 경기방어성 보유, 포트폴리오 안정 기여")
    elif stock.sector in volatile:
        score -= 0.15
        reasons.append(f"{stock.sector} 섹터 — 변동성 높음, 포트폴리오 비중 5% 이하 권장")

    if score > 0.3:
        verdict, badge = "매수", "🟢"
    elif score > 0:
        verdict, badge = "관망", "🟡"
    else:
        verdict, badge = "매도", "🔴"

    return {"verdict": verdict, "badge": badge, "score": score, "reasons": reasons}


def _buffett_stock_analysis(stock: Stock, row: dict) -> dict:
    pbr = round((seed_for(stock.code, "pbr") % 30) / 10 + 0.5, 1)
    roe = (seed_for(stock.code, "roe") % 25) + 5
    has_dividend = seed_for(stock.code, "div_hist") % 3 != 0
    profit_rate = row["profit_rate"]

    score = 0.0
    reasons: list[str] = []

    if pbr < 1.0:
        score += 0.4
        reasons.append(f"PBR {pbr} — 청산가치 이하, 강한 안전마진 확보")
    elif pbr < 1.5:
        score += 0.2
        reasons.append(f"PBR {pbr} — 합리적 가치권, 해자 강도에 따라 매력도 결정")
    elif pbr < 2.5:
        reasons.append(f"PBR {pbr} — 적정~약간 고평가. 강한 해자 있어야 정당화 가능")
    else:
        score -= 0.3
        reasons.append(f"PBR {pbr} — 고평가. 버핏 기준 '좋은 기업을 공정한 가격에'에 미달")

    if roe >= 15:
        score += 0.4
        reasons.append(f"ROE {roe}% — 탁월한 자본효율성, 장기 복리 성장 기대")
    elif roe >= 10:
        score += 0.2
        reasons.append(f"ROE {roe}% — 양호한 수준. 10년 지속 여부가 핵심")
    else:
        score -= 0.2
        reasons.append(f"ROE {roe}% — 낮은 자본효율성. 경제적 해자 불명확")

    if has_dividend:
        score += 0.1
        reasons.append("배당 이력 있음 — 주주환원 친화적 경영 신호")
    else:
        reasons.append("배당 이력 없음 — 성장 재투자 근거 확인 필요")

    moat_sectors = {"반도체", "금융", "자동차"}
    hard_sectors = {"게임", "엔터", "바이오"}
    if stock.sector in moat_sectors:
        score += 0.15
        reasons.append(f"{stock.sector} — 기술·규모 해자 존재 가능성")
    elif stock.sector in hard_sectors:
        score -= 0.1
        reasons.append(f"{stock.sector} — 사업 예측 어려움, 버핏 '능력 범위' 외 가능성")

    if profit_rate < -20:
        score += 0.05
        reasons.append(f"현재 {profit_rate:.1f}% 손실 — 펀더멘털 이상 없으면 추가 매수 기회")
    elif profit_rate > 30:
        reasons.append(f"현재 +{profit_rate:.1f}% 수익 — 내재가치 재평가 후 보유 여부 재검토")

    if score > 0.5:
        verdict, badge = "매수", "🟢"
    elif score > 0.2:
        verdict, badge = "관망", "🟡"
    else:
        verdict, badge = "매도", "🔴"

    return {"verdict": verdict, "badge": badge, "score": score, "reasons": reasons}


def _kotegawa_stock_analysis(stock: Stock, row: dict) -> dict:
    vol_spike = round((seed_for(stock.code, "vol_spike") % 30) / 10 + 0.5, 1)
    profit_rate = row["profit_rate"]

    score = 0.0
    reasons: list[str] = []

    if profit_rate > 15:
        score += 0.35
        reasons.append(f"매수가 대비 +{profit_rate:.1f}% — 강한 추세, 트레일링 스톱 설정 권장")
    elif profit_rate > 5:
        score += 0.2
        reasons.append(f"매수가 대비 +{profit_rate:.1f}% — 추세 유지, 모멘텀 지속 여부 확인")
    elif profit_rate > -5:
        reasons.append(f"매수가 대비 {profit_rate:.1f}% — 횡보. 방향성 확인 후 재판단")
    elif profit_rate > -10:
        score -= 0.3
        reasons.append(f"매수가 대비 {profit_rate:.1f}% — BNF 손절 기준(-5%) 초과. 즉시 포지션 점검")
    else:
        score -= 0.55
        reasons.append(f"매수가 대비 {profit_rate:.1f}% — 심각한 손실. BNF 원칙상 이미 청산 구간")

    if vol_spike >= 2.0:
        score += 0.2
        reasons.append(f"거래량 급증도 {vol_spike}x — 강한 수급 신호, 추세 신뢰도 높음")
    elif vol_spike >= 1.5:
        score += 0.1
        reasons.append(f"거래량 {vol_spike}x — 보통 수준, 추가 수급 확인 필요")
    else:
        score -= 0.1
        reasons.append(f"거래량 {vol_spike}x — 수급 약함. 주가 움직임 신뢰도 낮음")

    if stock.market == "KOSDAQ":
        score += 0.1
        reasons.append("KOSDAQ — 모멘텀 효과 강한 시장, BNF 방식에 적합")

    hot_sectors = {"반도체", "2차전지", "바이오", "게임"}
    if stock.sector in hot_sectors:
        score += 0.1
        reasons.append(f"{stock.sector} — 테마 사이클 활성 섹터. 모멘텀 포착 기회")

    if score > 0.35:
        verdict, badge = "매수", "🟢"
    elif score > 0:
        verdict, badge = "관망", "🟡"
    else:
        verdict, badge = "매도", "🔴"

    return {"verdict": verdict, "badge": badge, "score": score, "reasons": reasons}


def _katayama_stock_analysis(stock: Stock, row: dict) -> dict:
    """카타야마 아키라(片山晃·五月天) — 소형 성장주 발굴·집중 투자."""
    growth_proxy = (seed_for(stock.code, "growth") % 40) + 5      # 5–44% 매출성장률 추정
    margin_proxy = (seed_for(stock.code, "margin") % 25) + 5      # 5–29% 영업이익률 추정
    mktcap_rank  = seed_for(stock.code, "mktcap_rank") % 5        # 0=소형 ~ 4=대형
    mgmt_score   = (seed_for(stock.code, "mgmt") % 10) + 1        # 1–10 경영진 신뢰도
    profit_rate  = row["profit_rate"]

    score = 0.0
    reasons: list[str] = []

    # 성장률
    if growth_proxy >= 30:
        score += 0.4
        reasons.append(f"매출 성장률 추정 {growth_proxy}% — 고성장 기업, 카타야마 핵심 조건 충족")
    elif growth_proxy >= 20:
        score += 0.25
        reasons.append(f"매출 성장률 추정 {growth_proxy}% — 양호한 성장. 지속성 확인 필요")
    elif growth_proxy >= 10:
        score += 0.1
        reasons.append(f"매출 성장률 추정 {growth_proxy}% — 완만한 성장. 가속 계기가 있어야 관심 대상")
    else:
        score -= 0.2
        reasons.append(f"매출 성장률 추정 {growth_proxy}% — 성장 정체. 카타야마 관점에서 매력 낮음")

    # 이익률
    if margin_proxy >= 20:
        score += 0.25
        reasons.append(f"영업이익률 추정 {margin_proxy}% — 높은 마진, 해자와 가격결정력 반영")
    elif margin_proxy >= 12:
        score += 0.1
        reasons.append(f"영업이익률 추정 {margin_proxy}% — 양호. 성장과 함께 추가 확장 여부 모니터")
    else:
        score -= 0.1
        reasons.append(f"영업이익률 추정 {margin_proxy}% — 낮은 마진. 수익성 개선 로드맵이 필수")

    # 시가총액·시장 (소형 KOSDAQ 선호)
    if stock.market == "KOSDAQ":
        if mktcap_rank <= 1:
            score += 0.2
            reasons.append("소형 KOSDAQ — 기관 미발굴 가능성 높음. 카타야마 최선호 구간")
        elif mktcap_rank <= 3:
            score += 0.1
            reasons.append("중소형 KOSDAQ — 성장 잠재력과 유동성의 균형점")
        else:
            reasons.append("대형 KOSDAQ — 이미 기관 커버. 추가 발굴 여지 제한적")
    else:
        if mktcap_rank <= 2:
            score += 0.05
            reasons.append("KOSPI 중형주 — 성장 스토리 강하면 검토 가능")
        else:
            score -= 0.1
            reasons.append("KOSPI 대형주 — 기관 커버리지 포화, 초과수익 기회 제한적")

    # 경영진 신뢰도
    if mgmt_score >= 8:
        score += 0.15
        reasons.append(f"경영진 신뢰도 추정 {mgmt_score}/10 — 실행력·주주소통 우수. 카타야마 핵심 기준")
    elif mgmt_score >= 5:
        score += 0.05
        reasons.append(f"경영진 신뢰도 추정 {mgmt_score}/10 — 보통. IR 발언과 실적 일치 여부 추적 필요")
    else:
        score -= 0.15
        reasons.append(f"경영진 신뢰도 추정 {mgmt_score}/10 — 낮음. 카타야마는 경영진 실망 시 즉시 매도 원칙")

    # 섹터 선호
    growth_sectors = {"바이오", "반도체", "소프트웨어", "의료기기", "2차전지소재", "반도체장비", "반도체소재"}
    niche_sectors  = {"방산", "화장품", "엔터"}
    if stock.sector in growth_sectors:
        score += 0.1
        reasons.append(f"{stock.sector} — 카타야마 선호 고성장 섹터. 실적 가시성 확인 필수")
    elif stock.sector in niche_sectors:
        score += 0.07
        reasons.append(f"{stock.sector} — 틈새 시장 지배력 보유 가능성. 점유율 추이 모니터")

    # 포트폴리오 P&L
    if profit_rate > 30:
        reasons.append(f"현재 +{profit_rate:.1f}% — 성장 스토리 유효하면 카타야마는 계속 보유. 목표가 재산정 권장")
    elif profit_rate < -20:
        score -= 0.1
        reasons.append(f"현재 {profit_rate:.1f}% 손실 — 성장 스토리 훼손 여부 즉시 재점검 필요")

    if score > 0.45:
        verdict, badge = "매수", "🟢"
    elif score > 0.15:
        verdict, badge = "관망", "🟡"
    else:
        verdict, badge = "매도", "🔴"

    return {"verdict": verdict, "badge": badge, "score": score, "reasons": reasons}


def _lynch_stock_analysis(stock: Stock, row: dict) -> dict:
    """피터 린치 — 10루타·생활 밀착형 성장주 발굴."""
    growth_proxy = (seed_for(stock.code, "lynch_growth") % 45) + 5   # 5–49% 성장률
    pe_proxy     = (seed_for(stock.code, "lynch_pe")     % 40) + 8   # 8–47 PER
    debt_proxy   = (seed_for(stock.code, "lynch_debt")   % 200) + 30 # 30–229% 부채비율
    familiar     = seed_for(stock.code, "lynch_fam") % 10            # 0–9 소비자 친숙도
    profit_rate  = row["profit_rate"]

    score = 0.0
    reasons: list[str] = []

    # PEG (P/E ÷ 성장률) — 1 이하면 저평가
    peg = round(pe_proxy / max(growth_proxy, 1), 2)
    if peg < 0.75:
        score += 0.4
        reasons.append(f"PEG {peg:.2f} — 성장 대비 극히 저평가! 린치 최선호 구간 (PEG < 1이 목표)")
    elif peg < 1.0:
        score += 0.25
        reasons.append(f"PEG {peg:.2f} — 성장 대비 적정 가격. 린치 기준 '공정가치' 수준")
    elif peg < 1.5:
        score += 0.05
        reasons.append(f"PEG {peg:.2f} — 다소 높음. 성장 가속 신호 없으면 관망")
    else:
        score -= 0.2
        reasons.append(f"PEG {peg:.2f} — 성장 대비 고평가. 린치는 비싼 성장주를 경계함")

    # 성장률 절대 수준
    if growth_proxy >= 25:
        score += 0.2
        reasons.append(f"성장률 추정 {growth_proxy}% — '패스트 그로어' 범주. 10루타 후보")
    elif growth_proxy >= 15:
        score += 0.1
        reasons.append(f"성장률 추정 {growth_proxy}% — '스토크 그로어' 수준. 꾸준한 성장주")
    elif growth_proxy >= 8:
        reasons.append(f"성장률 추정 {growth_proxy}% — '슬로우 그로어'. 배당이 없으면 매력 낮음")
    else:
        score -= 0.15
        reasons.append(f"성장률 추정 {growth_proxy}% — 성장 정체. 린치는 '스탈워트'로도 분류 어려움")

    # 부채비율
    if debt_proxy < 60:
        score += 0.15
        reasons.append(f"부채비율 추정 {debt_proxy}% — 우량한 재무. 불황에도 생존 가능")
    elif debt_proxy < 120:
        score += 0.05
        reasons.append(f"부채비율 추정 {debt_proxy}% — 양호. 이자 커버리지 확인 권장")
    else:
        score -= 0.2
        reasons.append(f"부채비율 추정 {debt_proxy}% — 과도한 부채. 린치는 '빌린 돈으로 성장하는 기업'을 경계")

    # 소비자 친숙도 (린치: '내가 아는 기업에 투자하라')
    familiar_sectors = {"인터넷", "게임", "엔터", "통신", "미디어", "화장품", "식품"}
    if stock.sector in familiar_sectors or familiar >= 7:
        score += 0.1
        reasons.append(f"{stock.sector} — 소비자가 직접 경험 가능한 섹터. 린치 '아는 것에 투자' 원칙 부합")
    elif familiar >= 4:
        reasons.append("일반 투자자에게 다소 생소한 사업 모델. 이해 후 투자 원칙 지킬 것")
    else:
        score -= 0.05
        reasons.append("전문가 영역 비즈니스. 린치는 이해하지 못한 기업에 투자 금지를 강조")

    # P&L
    if profit_rate > 50:
        reasons.append(f"현재 +{profit_rate:.1f}% — 텐배거 진행 중? 스토리 유효하면 린치는 '계속 보유'")
    elif profit_rate < -15:
        score -= 0.1
        reasons.append(f"현재 {profit_rate:.1f}% 손실 — 스토리 훼손인지 일시적 하락인지 재점검 필요")

    if score > 0.45:
        verdict, badge = "매수", "🟢"
    elif score > 0.15:
        verdict, badge = "관망", "🟡"
    else:
        verdict, badge = "매도", "🔴"

    return {"verdict": verdict, "badge": badge, "score": score, "reasons": reasons}


def _graham_stock_analysis(stock: Stock, row: dict) -> dict:
    """벤저민 그레이엄 — 안전마진·방어적 가치투자."""
    pe_proxy   = (seed_for(stock.code, "graham_pe")   % 35) + 6    # 6–40 PER
    pb_proxy   = round((seed_for(stock.code, "graham_pb") % 30 + 5) / 10, 1)  # 0.5–3.5 PBR
    cr_proxy   = round((seed_for(stock.code, "graham_cr") % 25 + 10) / 10, 1) # 1.0–3.5 유동비율
    div_yield  = round((seed_for(stock.code, "graham_div") % 50) / 10, 1)     # 0.0–4.9% 배당
    years_prof = (seed_for(stock.code, "graham_yrs") % 10) + 1    # 1–10년 연속 흑자
    profit_rate = row["profit_rate"]

    score = 0.0
    reasons: list[str] = []

    # PER — 15배 이하 선호
    if pe_proxy <= 10:
        score += 0.35
        reasons.append(f"PER 추정 {pe_proxy}배 — 극히 저평가. 그레이엄 '바겐 종목' 기준 충족")
    elif pe_proxy <= 15:
        score += 0.2
        reasons.append(f"PER 추정 {pe_proxy}배 — 합리적 가격. 그레이엄 방어적 투자 기준 내")
    elif pe_proxy <= 25:
        score -= 0.05
        reasons.append(f"PER 추정 {pe_proxy}배 — 다소 비쌈. 안전마진 확보 어려운 구간")
    else:
        score -= 0.3
        reasons.append(f"PER 추정 {pe_proxy}배 — 고평가. 그레이엄은 높은 PER 종목을 투기로 간주")

    # PBR — 1.5배 이하 선호 (PER×PBR ≤ 22.5 규칙)
    if pb_proxy <= 1.0:
        score += 0.3
        reasons.append(f"PBR 추정 {pb_proxy}배 — 장부가 이하 거래! 그레이엄 안전마진 극대 구간")
    elif pb_proxy <= 1.5:
        score += 0.15
        reasons.append(f"PBR 추정 {pb_proxy}배 — 적정. PER×PBR={pe_proxy*pb_proxy:.0f} (≤22.5 규칙 확인)")
    elif pb_proxy <= 2.5:
        score -= 0.1
        reasons.append(f"PBR 추정 {pb_proxy}배 — 프리미엄 구간. 자산 대비 안전마진 부족")
    else:
        score -= 0.25
        reasons.append(f"PBR 추정 {pb_proxy}배 — 고평가. 그레이엄은 청산가치 이상 투자를 경계")

    # 유동비율 (재무 안전성)
    if cr_proxy >= 2.0:
        score += 0.15
        reasons.append(f"유동비율 추정 {cr_proxy}배 — 단기 채무 여유 충분. 재정적 안전마진 확보")
    elif cr_proxy >= 1.5:
        score += 0.05
        reasons.append(f"유동비율 추정 {cr_proxy}배 — 적정 수준. 갑작스런 경기 침체 시 점검 필요")
    else:
        score -= 0.2
        reasons.append(f"유동비율 추정 {cr_proxy}배 — 단기 유동성 부족 우려. 그레이엄은 1.5배 미만 경계")

    # 배당 — 방어적 투자자 기준 배당 지속성
    if div_yield >= 3.0:
        score += 0.15
        reasons.append(f"배당수익률 추정 {div_yield}% — 안정적 현금흐름. 방어적 투자자 조건 충족")
    elif div_yield >= 1.5:
        score += 0.05
        reasons.append(f"배당수익률 추정 {div_yield}% — 배당 있음. 지속 가능성과 성장성 함께 확인")
    else:
        score -= 0.1
        reasons.append(f"배당수익률 {div_yield}% — 배당 미흡. 그레이엄 방어적 기준에서 감점 요인")

    # 연속 흑자
    if years_prof >= 7:
        score += 0.1
        reasons.append(f"연속 흑자 추정 {years_prof}년 — 안정적 이익 창출력. 그레이엄 10년 흑자 기준 근접")
    elif years_prof >= 5:
        score += 0.05
        reasons.append(f"연속 흑자 추정 {years_prof}년 — 중간 수준. 불황 시 적자 전환 이력 확인 필요")
    else:
        score -= 0.15
        reasons.append(f"연속 흑자 추정 {years_prof}년 — 이익 안정성 부족. 그레이엄 방어적 기준 미달")

    # 섹터 방어성
    defensive = {"금융", "통신", "철강", "화학", "자동차부품"}
    speculative = {"바이오", "게임", "엔터"}
    if stock.sector in defensive:
        score += 0.05
        reasons.append(f"{stock.sector} — 방어적 섹터. 그레이엄 안정 포트폴리오에 적합")
    elif stock.sector in speculative:
        score -= 0.1
        reasons.append(f"{stock.sector} — 투기성 섹터. 그레이엄은 '수익 예측 불가능 기업' 경계")

    # P&L
    if profit_rate < -20:
        score -= 0.1
        reasons.append(f"현재 {profit_rate:.1f}% 손실 — 안전마진 계산 재검토. 저점 매수 기회인지 확인")
    elif profit_rate > 30:
        reasons.append(f"현재 +{profit_rate:.1f}% — 안전마진 소진됐을 수 있음. 차익 실현 여부 검토")

    if score > 0.5:
        verdict, badge = "매수", "🟢"
    elif score > 0.2:
        verdict, badge = "관망", "🟡"
    else:
        verdict, badge = "매도", "🔴"

    return {"verdict": verdict, "badge": badge, "score": score, "reasons": reasons}


def render_portfolio_advisor_summary(rows: list[dict]) -> None:
    st.subheader("투자 대가별 종목 분석")
    st.caption(
        "보유 종목 각각을 레이 달리오(리스크 패리티), 워렌 버핏(가치투자), "
        "코테가와 다카시(모멘텀), 카타야마 아키라(소형 성장주), "
        "피터 린치(10루타·PEG), 벤저민 그레이엄(안전마진)의 철학으로 분석합니다. "
        "재무 수치는 데모 시뮬레이션이므로 실제 투자 전 공시 데이터를 확인하십시오."
    )

    for row in rows:
        stock = find_stock(row["code"])
        if stock is None:
            continue

        dalio    = _dalio_stock_analysis(stock, row)
        buffett  = _buffett_stock_analysis(stock, row)
        kotegawa = _kotegawa_stock_analysis(stock, row)
        katayama = _katayama_stock_analysis(stock, row)
        lynch    = _lynch_stock_analysis(stock, row)
        graham   = _graham_stock_analysis(stock, row)

        profit_label = f"+{row['profit_rate']:.1f}%" if row["profit_rate"] >= 0 else f"{row['profit_rate']:.1f}%"
        profit_money = money_signed(row["profit"])

        with st.expander(
            f"{row['name']} ({row['code']}) · {profit_label} · {profit_money} "
            f"| 🇺🇸달리오 {dalio['badge']} 🇺🇸버핏 {buffett['badge']} "
            f"🇯🇵코테가와 {kotegawa['badge']} 🇯🇵카타야마 {katayama['badge']} "
            f"🇺🇸린치 {lynch['badge']} 🇺🇸그레이엄 {graham['badge']}",
            expanded=False,
        ):
            analyses = [
                ("🇺🇸 레이 달리오",    "리스크 패리티 · 부채 사이클",   dalio),
                ("🇺🇸 워렌 버핏",      "가치투자 · 경제적 해자",        buffett),
                ("🇯🇵 코테가와 다카시", "모멘텀 · 수급 추세",            kotegawa),
                ("🇯🇵 카타야마 아키라", "소형 성장주 · 집중 투자",       katayama),
                ("🇺🇸 피터 린치",      "10루타 · PEG · 생활 밀착형",    lynch),
                ("🇺🇸 벤저민 그레이엄", "안전마진 · 방어적 가치투자",    graham),
            ]
            vcolor = {"매수": "var(--red)", "관망": "var(--yellow)", "매도": "var(--blue)"}
            # 3열 2행으로 배치
            for i in range(0, len(analyses), 3):
                cols = st.columns(3)
                for col, (name, subtitle, result) in zip(cols, analyses[i:i+3]):
                    with col:
                        vc = vcolor.get(result["verdict"], "#888")
                        st.markdown(
                            f"<div style='background:var(--surf2);border:1px solid var(--border2);"
                            f"border-top:3px solid {vc};padding:12px 14px;margin-bottom:8px;'>"
                            f"<div style='font-weight:800;font-size:0.88rem;color:var(--white);'>{name}</div>"
                            f"<div style='font-family:var(--mono);font-size:0.6rem;color:var(--muted);"
                            f"letter-spacing:0.08em;margin-bottom:8px;'>{subtitle}</div>"
                            f"<div style='font-size:1.4rem;font-weight:900;color:{vc};"
                            f"text-shadow:0 0 8px {vc};margin-bottom:2px;'>"
                            f"{result['badge']} {result['verdict']}</div>"
                            f"<div style='font-family:var(--mono);font-size:0.7rem;color:var(--muted);'>"
                            f"점수 {result['score']:+.2f}</div>"
                            f"</div>",
                            unsafe_allow_html=True,
                        )
                        for reason in result["reasons"]:
                            st.markdown(f"<div style='font-size:0.8rem;color:var(--fg);padding:2px 0;'>• {reason}</div>",
                                        unsafe_allow_html=True)

    # Portfolio-level cross-advisor summary
    st.divider()
    st.markdown("**포트폴리오 종합 의견**")
    valid_stocks = [find_stock(r["code"]) for r in rows if find_stock(r["code"])]
    valid_rows   = [r for r in rows if find_stock(r["code"])]
    dalio_all    = [_dalio_stock_analysis(s, r)    for s, r in zip(valid_stocks, valid_rows)]
    buffett_all  = [_buffett_stock_analysis(s, r)  for s, r in zip(valid_stocks, valid_rows)]
    kotegawa_all = [_kotegawa_stock_analysis(s, r) for s, r in zip(valid_stocks, valid_rows)]
    katayama_all = [_katayama_stock_analysis(s, r) for s, r in zip(valid_stocks, valid_rows)]
    lynch_all    = [_lynch_stock_analysis(s, r)    for s, r in zip(valid_stocks, valid_rows)]
    graham_all   = [_graham_stock_analysis(s, r)   for s, r in zip(valid_stocks, valid_rows)]

    def avg_score(analyses: list[dict]) -> float:
        return sum(a["score"] for a in analyses) / len(analyses) if analyses else 0.0

    col1, col2, col3 = st.columns(3)
    col1.metric("🇺🇸 달리오 점수",   f"{avg_score(dalio_all):+.2f}",    help="리스크 패리티 관점 평균")
    col2.metric("🇺🇸 버핏 점수",     f"{avg_score(buffett_all):+.2f}",  help="가치투자 관점 평균")
    col3.metric("🇯🇵 코테가와 점수", f"{avg_score(kotegawa_all):+.2f}", help="모멘텀 관점 평균")
    col4, col5, col6 = st.columns(3)
    col4.metric("🇯🇵 카타야마 점수", f"{avg_score(katayama_all):+.2f}", help="소형 성장주 관점 평균")
    col5.metric("🇺🇸 린치 점수",     f"{avg_score(lynch_all):+.2f}",    help="PEG·10루타 관점 평균")
    col6.metric("🇺🇸 그레이엄 점수", f"{avg_score(graham_all):+.2f}",   help="안전마진·방어 관점 평균")

    sectors_in_portfolio = [find_stock(r["code"]).sector for r in rows if find_stock(r["code"])]
    unique_sectors = set(sectors_in_portfolio)
    if len(unique_sectors) < 3:
        st.warning(
            f"달리오 경고: 포트폴리오 섹터가 {', '.join(unique_sectors)}에 집중되어 있습니다. "
            "3개 이상 섹터로 분산을 권장합니다."
        )
    else:
        st.success(f"달리오 관점: {len(unique_sectors)}개 섹터에 분산 — 기본 분산 조건 충족")


def render_portfolio_page(market: str, use_live: bool) -> None:
    st.title("포트폴리오")
    portfolio = read_json(PORTFOLIO_FILE, [])

    with st.form("portfolio-form", clear_on_submit=True):
        stock = select_stock_widget(market, "추가할 종목")
        cols = st.columns(3)
        quantity = cols[0].number_input("수량", min_value=1, value=10, step=1)
        buy_price = cols[1].number_input("평균단가", min_value=1, value=stock_snapshot(stock, use_live)["price"], step=100)
        memo = cols[2].text_input("메모", placeholder="선택 입력")
        submitted = st.form_submit_button("포트폴리오에 추가", use_container_width=True)
        if submitted:
            portfolio.append(
                {
                    "code": stock.code,
                    "name": stock.name,
                    "market": stock.market,
                    "quantity": int(quantity),
                    "buy_price": int(buy_price),
                    "memo": memo,
                    "created_at": datetime.now().isoformat(timespec="seconds"),
                }
            )
            write_json(PORTFOLIO_FILE, portfolio)
            st.rerun()

    if not portfolio:
        st.info("보유 종목을 추가하면 평가금액과 손익률을 추적할 수 있습니다.")
        return

    rows = []
    for item in portfolio:
        stock = find_stock(item["code"])
        if stock is None:
            continue
        current = stock_snapshot(stock, use_live)["price"]
        quantity = int(item["quantity"])
        buy_price = int(item["buy_price"])
        invested = quantity * buy_price
        evaluated = quantity * current
        profit = evaluated - invested
        profit_rate = profit / invested * 100 if invested else 0
        rows.append({**item, "market": stock.market, "current": current, "invested": invested, "evaluated": evaluated, "profit": profit, "profit_rate": profit_rate})

    total_invested = sum(row["invested"] for row in rows)
    total_evaluated = sum(row["evaluated"] for row in rows)
    total_profit = total_evaluated - total_invested
    total_rate = total_profit / total_invested * 100 if total_invested else 0

    col1, col2, col3 = st.columns(3)
    col1.metric(
        "투자원금",
        money_compact(total_invested),
        help="내가 주식을 살 때 쓴 총 금액입니다.",
    )
    col2.metric(
        "평가금액",
        money_compact(total_evaluated),
        money_signed(total_profit),
        help="현재 주가로 환산한 보유 주식의 총 가치입니다.",
    )
    col3.metric(
        "수익률",
        signed_pct(total_rate),
        help="투자원금 대비 현재 얼마나 벌었거나 잃었는지입니다.",
    )

    st.divider()
    display = pd.DataFrame(rows)
    display["수량"] = display["quantity"].map("{:,}주".format)
    display["평균단가 (1주)"] = display["buy_price"].map(money_per_share)
    display["현재가 (1주)"] = display["current"].map(money_per_share)
    display["평가금액"] = display["evaluated"].map(money_compact)
    display["손익"] = display["profit"].map(money_signed)
    display["수익률"] = display["profit_rate"].map(signed_pct)
    st.dataframe(
        display[["market", "code", "name", "수량", "평균단가 (1주)", "현재가 (1주)", "평가금액", "손익", "수익률", "memo"]].rename(
            columns={"market": "시장", "code": "코드", "name": "종목명", "memo": "메모"}
        ),
        use_container_width=True,
        hide_index=True,
    )

    delete_options = {f"{row['market']} · {row['name']} · {row['quantity']}주 · {row['created_at']}": row["created_at"] for row in rows}
    selected = st.selectbox("삭제할 항목", list(delete_options.keys()))
    if st.button("선택 항목 삭제", type="secondary"):
        portfolio = [item for item in portfolio if item.get("created_at") != delete_options[selected]]
        write_json(PORTFOLIO_FILE, portfolio)
        st.rerun()

    st.divider()
    render_portfolio_advisor_summary(rows)


def render_stock_advisor_panel(stock: Stock) -> None:
    """6인 투자 대가의 관점으로 선택 종목을 분석하는 패널."""
    st.subheader("투자 대가별 종목 분석")
    dummy_row = {"profit_rate": 0.0, "profit": 0}

    dalio    = _dalio_stock_analysis(stock, dummy_row)
    buffett  = _buffett_stock_analysis(stock, dummy_row)
    kotegawa = _kotegawa_stock_analysis(stock, dummy_row)
    katayama = _katayama_stock_analysis(stock, dummy_row)
    lynch    = _lynch_stock_analysis(stock, dummy_row)
    graham   = _graham_stock_analysis(stock, dummy_row)

    tab_d, tab_b, tab_k, tab_ka, tab_l, tab_g = st.tabs([
        f"🇺🇸 달리오 {dalio['badge']}",
        f"🇺🇸 버핏 {buffett['badge']}",
        f"🇯🇵 코테가와 {kotegawa['badge']}",
        f"🇯🇵 카타야마 {katayama['badge']}",
        f"🇺🇸 린치 {lynch['badge']}",
        f"🇺🇸 그레이엄 {graham['badge']}",
    ])

    def _render_tab(flag: str, name: str, subtitle: str, result: dict, quote: str, quotee: str) -> None:
        vcolor = {"매수": "var(--red)", "관망": "var(--yellow)", "매도": "var(--blue)"}
        vc = vcolor.get(result["verdict"], "var(--muted)")

        # ── 판정 카드 ──────────────────────────────────────
        st.markdown(
            f'<div style="background:var(--surf2);border:1px solid var(--border);'
            f'border-left:4px solid {vc};padding:20px 24px;margin:12px 0 20px;border-radius:2px;">'
            f'<div style="display:flex;align-items:center;gap:14px;">'
            f'<span style="font-size:2.4rem;line-height:1;flex-shrink:0;">{result["badge"]}</span>'
            f'<div style="flex:1;min-width:0;">'
            f'<div style="font-size:1.5rem;font-weight:800;color:{vc};line-height:1.15;">{result["verdict"]}</div>'
            f'<div style="font-size:0.75rem;color:var(--muted);margin-top:3px;letter-spacing:0.02em;">{subtitle}</div>'
            f'</div>'
            f'<div style="text-align:right;border-left:1px solid var(--border);padding-left:18px;flex-shrink:0;">'
            f'<div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:4px;">종합 점수</div>'
            f'<div style="font-size:1.5rem;font-weight:800;color:{vc};line-height:1;">{result["score"]:+.2f}</div>'
            f'</div>'
            f'</div>'
            f'<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);'
            f'display:flex;align-items:center;gap:8px;">'
            f'<span style="font-size:1.1rem;">{flag}</span>'
            f'<span style="font-size:0.78rem;font-weight:700;color:var(--fg);">{name}</span>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        # ── 근거 리스트 ────────────────────────────────────
        items_html = "".join(
            f'<div style="display:flex;gap:10px;align-items:flex-start;'
            f'padding:9px 12px;border-bottom:1px solid var(--border);background:var(--surf);">'
            f'<span style="color:{vc};font-size:0.7rem;margin-top:3px;flex-shrink:0;">◆</span>'
            f'<span style="font-size:0.88rem;color:var(--fg);line-height:1.6;">{r}</span>'
            f'</div>'
            for r in result["reasons"]
        )
        st.markdown(
            f'<div style="border:1px solid var(--border);border-radius:2px;'
            f'margin-bottom:20px;overflow:hidden;">{items_html}</div>',
            unsafe_allow_html=True,
        )

        # ── 인용구 ─────────────────────────────────────────
        st.markdown(f'> *"{quote}"*  \n> — {quotee}')

    with tab_d:
        _render_tab("🇺🇸", "레이 달리오 · Ray Dalio",
                    "리스크 패리티 · 부채 사이클 · 분산투자", dalio,
                    "분산투자는 성배다. 상관관계가 낮은 수익원 15–20개를 찾아라.", "레이 달리오")
    with tab_b:
        _render_tab("🇺🇸", "워렌 버핏 · Warren Buffett",
                    "가치투자 · 경제적 해자 · 장기 보유", buffett,
                    "훌륭한 기업을 공정한 가격에 사는 것이, 그저 그런 기업을 싼 가격에 사는 것보다 낫다.", "워렌 버핏")
    with tab_k:
        _render_tab("🇯🇵", "코테가와 다카시 · 是川高志(BNF)",
                    "모멘텀 · 수급 추세 · 손절 원칙", kotegawa,
                    "작게 잃고 크게 이겨라. 틀렸을 때 즉시 인정하고 나와라.", "코테가와 다카시(BNF)")
    with tab_ka:
        _render_tab("🇯🇵", "카타야마 아키라 · 片山晃(五月天)",
                    "소형 성장주 발굴 · 집중 투자 · 경영진 중시", katayama,
                    "남들이 모르는 성장 기업을 먼저 찾아라. 기관이 주목하기 전에 사고, 성장 스토리가 끝날 때 팔아라.", "카타야마 아키라")
    with tab_l:
        _render_tab("🇺🇸", "피터 린치 · Peter Lynch",
                    "10루타 · PEG 지표 · 생활 밀착형 성장주", lynch,
                    "내가 아는 것에 투자하라. 월가보다 당신이 먼저 알 수 있다.", "피터 린치")
    with tab_g:
        _render_tab("🇺🇸", "벤저민 그레이엄 · Benjamin Graham",
                    "안전마진 · PBR·PER 이중 기준 · 방어적 투자", graham,
                    "투자란 철저한 분석 후 원금을 안전하게 지키면서 적절한 수익을 추구하는 것이다. 그 외는 모두 투기다.", "벤저민 그레이엄")

    st.caption("재무 수치는 데모 시뮬레이션 값입니다. 실제 투자 전 공시 재무제표를 반드시 확인하십시오.")


def render_dalio_advice(stocks: list[Stock], use_live: bool) -> None:
    st.title("🇺🇸 레이 달리오의 조언")
    st.caption("브리지워터 어소시에이츠 창업자 · 올웨더 포트폴리오 · 경제 사이클 이론")

    st.info(
        "**레이 달리오**는 거시경제 사이클과 부채 사이클을 분석해 자산을 배분하는 '리스크 패리티(Risk Parity)' 전략으로 유명합니다. "
        "그는 '분산투자'를 성배(Holy Grail)라 부르며, 서로 상관관계가 낮은 자산을 조합해 변동성을 낮추면서도 수익을 추구합니다."
    )

    tab1, tab2, tab3 = st.tabs(["핵심 원칙", "한국 시장 적용", "종목 스크리닝"])

    with tab1:
        st.subheader("투자 철학 핵심 원칙")

        principles = [
            (
                "1. 경제 기계(Economic Machine)를 이해하라",
                "경제는 생산성 성장 + 단기 부채 사이클(5~8년) + 장기 부채 사이클(75~100년)의 조합으로 움직입니다. "
                "현재 한국은 고금리 이후 완화 사이클 진입 초기로, 부채 디레버리징 압력이 낮아지는 구간입니다. "
                "이 시기에는 장기채 비중 확대와 실물자산(원자재, 금) 병행이 유리합니다.",
            ),
            (
                "2. 리스크 패리티 — 리스크를 균등하게 분산하라",
                "달리오의 올웨더 포트폴리오 배분: 주식 30%, 장기채 40%, 중기채 15%, 금 7.5%, 원자재 7.5%. "
                "한국 개인투자자 관점에서는 KOSPI/KOSDAQ 주식(30%) + KTB 장기채 ETF(35%) + 금 ETF(10%) + 리츠(10%) + 해외 분산(15%)으로 응용할 수 있습니다. "
                "핵심은 '어떤 경제 환경에서도 어느 한 자산만 크게 손실 나지 않도록 설계'하는 것입니다.",
            ),
            (
                "3. 상관관계가 낮은 15~20개 자산에 분산하라",
                "달리오는 '상관관계 0에 가까운 좋은 수익원 15~20개를 조합하면 리스크를 80% 줄이면서 수익을 거의 희생하지 않는다'고 말합니다. "
                "단일 섹터(예: 2차전지 집중)나 단일 국가 집중은 이 원칙에 위배됩니다. "
                "KOSDAQ 반도체 + KOSPI 금융 + 해외 원자재 ETF처럼 사이클이 다른 자산을 섞어야 합니다.",
            ),
            (
                "4. 디플레이션/인플레이션 시나리오를 모두 대비하라",
                "성장↑인플레↑: 주식·원자재 강세. 성장↑인플레↓: 주식·채권 강세. "
                "성장↓인플레↑(스태그플레이션): 금·물가채 강세. 성장↓인플레↓: 장기채·금 강세. "
                "한국 투자자는 금리 환경과 원/달러 환율 방향성을 매 분기 점검해 비중을 재조정해야 합니다.",
            ),
            (
                "5. 부채 사이클이 피크일 때 반드시 레버리지를 줄여라",
                "달리오는 과도한 부채가 쌓인 섹터(예: 부동산 PF 익스포저가 큰 중소형 건설사, 고레버리지 스타트업)를 "
                "사이클 후기에 집중 보유하는 것을 경고합니다. KOSDAQ 고성장주의 부채비율, 이자보상배율을 반드시 체크하십시오.",
            ),
        ]

        for title, body in principles:
            with st.expander(title):
                st.write(body)

    with tab2:
        st.subheader("한국 시장 분석 관점")

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**달리오 관점의 현재 한국 시장 진단**")
            st.markdown("""
- **부채 사이클 위치**: 단기 사이클 중반. 고금리 압력 완화 시작 → 주식·채권 동반 회복 환경
- **통화 정책**: 한은 인하 사이클 진입 → 성장주 재평가 여지 존재
- **환율 리스크**: 원/달러 고환율 구간은 수출주(반도체, 자동차) 이익 확대, 수입원가 부담 업종(항공, 음식료) 압박
- **지정학 리스크**: 한반도 리스크 디스카운트 → 한국 시장 PER이 글로벌 대비 낮은 구조적 원인. 달리오는 이를 '국가 리스크 프리미엄'으로 인식하고 적정 할인율을 높게 봄
- **권고 비중**: 한국 주식 단독 집중 지양. 한국 주식 25% + 채권·대안자산 75% 병행 권장
            """)
        with col2:
            st.markdown("**섹터별 달리오 관점 평가**")
            sector_views = {
                "반도체": ("▲ 긍정", "AI 사이클 + 글로벌 수요 회복. 단, 고점 재고 위험 모니터 필요"),
                "2차전지": ("◆ 중립", "EV 성장 둔화 우려 vs 장기 에너지전환 수혜. 변동성 높아 비중 조절 필요"),
                "금융": ("▲ 긍정", "고금리 수혜 마무리, 인하기 전환. NIM 압박 오나 자본력 안정"),
                "바이오": ("▽ 주의", "개별 임상 리스크 높음. 달리오 방식으론 비중 최소화"),
                "자동차": ("▲ 긍정", "고환율 수혜, 글로벌 점유율 확대. 전기차 전환 비용은 리스크"),
                "엔터": ("◆ 중립", "한류 프리미엄 있으나 수익 변동성 큼. 포트폴리오 5% 이하"),
            }
            for sector, (view, reason) in sector_views.items():
                st.markdown(f"**{sector}** {view}  \n{reason}")

    with tab3:
        st.subheader("달리오 관점 종목 체크리스트")
        st.caption("리스크 패리티 원칙 기반 — 부채 건전성과 경기 방어성을 우선 확인합니다.")

        snapshots = [stock_snapshot(s, use_live) for s in stocks]
        frame = pd.DataFrame(snapshots)

        frame["부채비율 proxy"] = frame["code"].apply(lambda c: (seed_for(c, "debt") % 200) + 50)
        frame["배당수익률 proxy (%)"] = frame["code"].apply(lambda c: round((seed_for(c, "div") % 40) / 10, 1))
        frame["달리오 적합도"] = frame.apply(
            lambda row: "★★★" if row["부채비율 proxy"] < 100 and row["배당수익률 proxy (%)"] > 1.5
            else ("★★" if row["부채비율 proxy"] < 150 else "★"),
            axis=1,
        )

        display = frame[["market", "code", "name", "sector", "부채비율 proxy", "배당수익률 proxy (%)", "달리오 적합도"]].rename(
            columns={"market": "시장", "code": "코드", "name": "종목명", "sector": "업종"}
        )
        st.dataframe(display, use_container_width=True, hide_index=True)
        st.caption("부채비율·배당수익률은 데모 시뮬레이션 값입니다. 실제 투자 전 공시 재무제표를 반드시 확인하십시오.")

        st.divider()
        st.markdown("**달리오의 최종 메시지**")
        st.markdown(
            '> *“분산투자는 성배다. 상관관계가 낮은 좋은 수익원을 15–20개 찾아라. '
            '그것이 리스크를 줄이면서 수익을 지키는 유일한 방법이다.”*  \n'
            '> — 레이 달리오, 《원칙(Principles)》'
        )


def render_buffett_advice(stocks: list[Stock], use_live: bool) -> None:
    st.title("🇺🇸 워렌 버핏의 조언")
    st.caption("버크셔 해서웨이 CEO · 가치투자의 대가 · 장기 보유 전략")

    st.info(
        "**워렌 버핏**은 벤저민 그레이엄의 가치투자를 기반으로, "
        "찰리 멍거의 영향을 받아 '좋은 기업을 공정한 가격에 사는 것이 그저 그런 기업을 싼 가격에 사는 것보다 낫다'는 철학을 정립했습니다. "
        "장기적 경쟁 우위(해자), 우수한 경영진, 지속적 자본수익률을 핵심 기준으로 봅니다."
    )

    tab1, tab2, tab3 = st.tabs(["핵심 원칙", "한국 시장 적용", "종목 스크리닝"])

    with tab1:
        st.subheader("투자 철학 핵심 원칙")

        principles = [
            (
                "1. 경제적 해자(Economic Moat)를 보유한 기업만 매수하라",
                "해자의 4가지 유형: ①브랜드 파워(소비자가 더 비싼 가격을 지불하게 만드는 힘) "
                "②전환비용(고객이 경쟁사로 쉽게 옮기지 못하는 구조) "
                "③네트워크 효과(사용자 증가가 서비스 가치를 높이는 구조) "
                "④비용 우위(규모의 경제나 독점 자원으로 경쟁사보다 싸게 만드는 능력). "
                "한국 시장에서는 삼성전자의 메모리 기술 독점, 카카오의 국내 플랫폼 잠금 효과, "
                "현대차그룹의 수직 계열화 비용 우위 등이 해당됩니다.",
            ),
            (
                "2. 안전마진(Margin of Safety)을 확보하고 매수하라",
                "버핏은 기업의 내재가치를 추정한 뒤, 현재 주가가 내재가치보다 충분히 낮을 때만 매수합니다. "
                "일반적으로 20~30% 이상의 할인율을 요구합니다. "
                "한국 시장은 코리아 디스카운트로 인해 글로벌 동종 대비 PBR, PER이 낮아 "
                "해자가 명확한 기업의 경우 안전마진을 확보하기 비교적 유리한 환경입니다.",
            ),
            (
                "3. 자기자본이익률(ROE)이 15% 이상 지속되는 기업을 선택하라",
                "버핏은 '10년 이상 ROE 15% 이상을 유지한 기업이 진짜 복리 기계'라고 말합니다. "
                "단순한 레버리지(부채)로 만든 ROE가 아닌, 순이익/자기자본 기준의 진짜 사업 수익성이어야 합니다. "
                "한국 KOSPI 대형주 중 이 기준을 충족하는 기업은 많지 않으며, 반도체 다운사이클 시 ROE가 급락하는 "
                "삼성전자·SK하이닉스의 주기적 변동성에 주의가 필요합니다.",
            ),
            (
                "4. 이해할 수 있는 사업에만 투자하라 (능력 범위, Circle of Competence)",
                "버핏이 한국 바이오·게임주를 직접 매수하지 않는 이유는 사업 모델의 복잡성과 예측 불가능성 때문입니다. "
                "개인 투자자도 자신이 사업 구조, 수익 메커니즘, 경쟁 환경을 명확히 설명할 수 없는 종목은 '이해 범위 밖'으로 분류해 보유하지 않아야 합니다.",
            ),
            (
                "5. '10년 보유할 주식이 아니면 10분도 보유하지 마라'",
                "단기 주가 변동에 집착하지 말고 사업 자체의 펀더멘털 변화를 추적하십시오. "
                "분기 실적 발표 때 사업이 여전히 해자를 유지하는지, 자본 배분이 주주 친화적으로 이뤄지는지를 확인하십시오. "
                "한국 증시 특성상 외국인·기관의 수급 변동이 크므로, 버핏식 장기 보유자에게 단기 급락은 오히려 추가 매수 기회입니다.",
            ),
            (
                "6. 경영진의 자본 배분 능력과 정직성을 평가하라",
                "버핏은 '훌륭한 경영진이 나쁜 사업을 구할 수는 없지만, 나쁜 경영진이 좋은 사업을 망칠 수 있다'고 강조합니다. "
                "한국 시장에서는 대주주의 일감 몰아주기, 순환출자, 과도한 유상증자가 소액주주 가치를 훼손하는 주요 패턴입니다. "
                "주주환원(배당+자사주 소각) 정책과 공시 투명성을 반드시 확인하십시오.",
            ),
        ]

        for title, body in principles:
            with st.expander(title):
                st.write(body)

    with tab2:
        st.subheader("한국 시장 분석 관점")

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**버핏이 주목할 한국 기업 유형**")
            st.markdown("""
- **독점적 기술 기업**: 메모리 반도체 상위 2개사(삼성·하이닉스)는 글로벌 점유율 70%+. 단, 사이클 변동성 있음
- **소비자 브랜드**: 아모레퍼시픽·LG생활건강 등 K-뷰티 브랜드. 중국 시장 의존도 리스크 주의
- **금융 지주**: 신한·KB 등 — 낮은 PBR, 안정 배당, 경기방어성. 버핏식 저평가 대표 업종
- **보험**: 한국 보험사는 부채를 플로트(float)로 활용 가능한 버핏 선호 구조. 삼성생명·DB손보 등
- **피하는 유형**: 고레버리지 스타트업, 적자 바이오, 메타버스·NFT 테마주 — 예측 불가능한 사업 모델
            """)
        with col2:
            st.markdown("**코리아 디스카운트와 버핏의 기회 인식**")
            st.markdown("""
버핏은 2023년 일본 5대 상사를 저PBR·고배당을 이유로 대규모 매수했습니다.
한국도 유사한 '아시아 저평가 우량주' 프레임이 가능합니다.

**투자 체크리스트**
- PBR 1 미만이면서 ROE 10% 이상?
- 10년 배당 성장 이력 존재?
- 부채비율 100% 미만 또는 금융업 특성 고려?
- 최근 3년 영업이익률 꾸준히 성장?
- 지배주주 일감 몰아주기·순환출자 없음?

모두 'Yes'면 버핏 포트폴리오 후보군입니다.
            """)

    with tab3:
        st.subheader("버핏 관점 종목 체크리스트")
        st.caption("가치투자 핵심 지표 — 내재가치 대비 안전마진과 해자의 지속성을 우선 확인합니다.")

        snapshots = [stock_snapshot(s, use_live) for s in stocks]
        frame = pd.DataFrame(snapshots)

        frame["PBR proxy"] = frame["code"].apply(lambda c: round((seed_for(c, "pbr") % 30) / 10 + 0.5, 1))
        frame["ROE proxy (%)"] = frame["code"].apply(lambda c: (seed_for(c, "roe") % 25) + 5)
        frame["배당 이력"] = frame["code"].apply(lambda c: "있음" if seed_for(c, "div_hist") % 3 != 0 else "없음/불규칙")
        frame["버핏 적합도"] = frame.apply(
            lambda row: "★★★" if row["PBR proxy"] < 1.5 and row["ROE proxy (%)"] >= 15 and row["배당 이력"] == "있음"
            else ("★★" if row["PBR proxy"] < 2.0 and row["ROE proxy (%)"] >= 10 else "★"),
            axis=1,
        )

        display = frame[["market", "code", "name", "sector", "PBR proxy", "ROE proxy (%)", "배당 이력", "버핏 적합도"]].rename(
            columns={"market": "시장", "code": "코드", "name": "종목명", "sector": "업종"}
        )
        st.dataframe(display, use_container_width=True, hide_index=True)
        st.caption("PBR·ROE는 데모 시뮬레이션 값입니다. 실제 투자 전 공시 재무제표를 반드시 확인하십시오.")

        st.divider()
        st.markdown("**버핏의 최종 메시지**")
        st.markdown(
            '> *"훌륭한 기업을 공정한 가격에 사는 것이, 그저 그런 기업을 싼 가격에 사는 것보다 훨씬 낫다."*  \n'
            '> — 워렌 버핏, 1989년 버크셔 해서웨이 주주 서한\n\n'
            '> *"주식 시장은 조급한 사람에게서 인내심 있는 사람에게로 돈이 이전되는 장치다."*  \n'
            '> — 워렌 버핏'
        )


def render_kotegawa_advice(stocks: list[Stock], use_live: bool) -> None:
    st.title("🇯🇵 코테가와 다카시의 조언")
    st.caption("是川高志(BNF) · 일본 개인투자자 전설 · 1,600만 원 → 160억 원 수익 달성")

    st.info(
        "**코테가와 다카시(BNF)**는 2000년대 일본 증시에서 약 1,600만 엔으로 시작해 "
        "160억 엔 이상의 자산을 만든 전설적인 일본 개인 투자자입니다. "
        "그는 패턴 인식 기반 단기 모멘텀 거래와 철저한 리스크 관리, 그리고 시장 심리 분석으로 유명합니다. "
        "화려한 기술 대신 '실제 작동하는 단순한 원칙'을 반복하는 것이 그의 핵심 철학입니다."
    )

    tab1, tab2, tab3 = st.tabs(["핵심 원칙", "한국 시장 적용", "종목 스크리닝"])

    with tab1:
        st.subheader("투자 철학 핵심 원칙")

        principles = [
            (
                "1. 패턴을 반복해서 인식하고, 검증된 패턴에만 베팅하라",
                "BNF는 수천 개 종목의 주가 움직임을 매일 관찰하며 '이 패턴이 나타나면 다음에 이렇게 된다'는 법칙을 직접 발견했습니다. "
                "KOSDAQ에서도 급등 직전 '거래량 급증 + 외국인·기관 동시 매집 + 52주 신고가 돌파'의 패턴은 통계적으로 유의미합니다. "
                "개인 투자자는 자신만의 백테스트를 통해 검증된 진입 조건만 반복해야 합니다.",
            ),
            (
                "2. 손절매는 절대 늦추지 마라 — 손실은 빠르게, 수익은 길게",
                "BNF는 '작게 잃고 크게 이기는 것'을 생존의 원칙으로 삼습니다. "
                "매수 후 예상과 다른 방향으로 움직이면 즉시 -3~5%에서 손절하고, "
                "예상대로 움직이면 수익을 극대화합니다. "
                "한국 개인투자자의 가장 흔한 실수는 '버티면 오를 것'이라는 희망으로 손절을 미루다 "
                "대형 손실로 이어지는 것입니다.",
            ),
            (
                "3. 시장 전체 방향성(수급 흐름)을 먼저 파악하라",
                "BNF는 개별 종목보다 시장 전체의 자금 흐름을 먼저 읽습니다. "
                "외국인 순매수가 지속되면 대형주 중심으로, 기관 순매수가 강하면 중형주 성장주 중심으로 자금이 유입됩니다. "
                "KOSDAQ은 개인 비중이 높아 수급 쏠림이 빠르고 방향 전환도 급격합니다. "
                "코스닥 150 선물의 외국인 포지션 변화는 선행 지표로 유용합니다.",
            ),
            (
                "4. 과열 종목은 절대 추격 매수하지 마라",
                "BNF는 주가가 이미 단기 급등한 종목의 '고점 추격 매수'를 절대 하지 않습니다. "
                "KOSDAQ에서 주가가 5일 내 30% 이상 급등하면 조정 리스크가 크게 높아집니다. "
                "그는 '급등 후 1차 조정 시 재진입하거나, 다음 저점을 기다리는 것'을 원칙으로 합니다. "
                "뉴스·테마가 터진 당일 매수는 최악의 타이밍인 경우가 많습니다.",
            ),
            (
                "5. 집중 투자하되, 분산은 최소한으로",
                "BNF는 한 번에 소수의 종목에 집중 투자하며, 확신도에 따라 포지션 크기를 조절합니다. "
                "30개 종목을 조금씩 사는 것은 시간 낭비이자 수익 희석입니다. "
                "단, KOSDAQ 중소형주는 유동성 리스크가 있어 시가총액 500억 원 미만은 진입 규모를 제한해야 합니다.",
            ),
            (
                "6. 하루 거래보다 며칠~몇 주의 '스윙 트레이드'가 개인에게 더 현실적",
                "BNF는 초기엔 초단기 거래를 했지만, 자산 규모가 커지면서 스윙 트레이드 위주로 전환했습니다. "
                "한국 개인투자자 대부분은 증권사 수수료·세금·슬리피지를 고려할 때 "
                "초단타보다 며칠~몇 주 단위의 추세 추종이 실효 수익에서 유리합니다. "
                "KOSDAQ 모멘텀 종목에서 진입 타이밍은 거래량 급증과 이동평균선 배열을 함께 확인하십시오.",
            ),
        ]

        for title, body in principles:
            with st.expander(title):
                st.write(body)

    with tab2:
        st.subheader("한국 시장 적용 분석")

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**BNF 방식의 KOSDAQ 접근법**")
            st.markdown("""
**진입 신호 체크리스트**
- 최근 5영업일 거래량이 20일 평균의 2배 이상?
- 외국인 또는 기관 중 하나가 3일 연속 순매수?
- 주가가 20일 이동평균 위에 위치?
- 52주 신고가에 근접(5% 이내)?
- 섹터 전체적 자금 유입 확인?

**손절 기준**
- 매수 평균단가 대비 -5% 이탈 시 무조건 손절
- 거래량 없이 주가만 오른 종목은 리스크 2배
- 상한가 다음날 하한가 갭하락 패턴 주의
            """)
        with col2:
            st.markdown("**BNF가 주목하는 한국 시장 특성**")
            st.markdown("""
**유리한 환경**
- 테마주 사이클이 빠르게 돌아감 (AI·로봇·방산·K-뷰티 등)
- 기관 수급 쏠림이 명확해 추세 추종 유효
- 배터리·반도체 글로벌 이슈가 국내 수급에 즉각 반영

**불리한 환경**
- 작전 세력·불공정 거래 리스크 존재
- 유동성 낮은 소형주에서 갑작스러운 매물 출회
- 코스닥 급등락 폭이 커서 리스크 관리 더욱 중요

**BNF의 경고**
시장이 전체적으로 하락 추세일 때는 개별 종목 롱 포지션보다
현금 비중을 높이는 것이 최선입니다. '기다림'도 전략입니다.
            """)

    with tab3:
        st.subheader("BNF 관점 모멘텀 스크리닝")
        st.caption("거래량 급증 + 추세 강도 기반 — 단기 모멘텀이 높은 종목을 우선 확인합니다.")

        snapshots = [stock_snapshot(s, use_live) for s in stocks]
        frame = pd.DataFrame(snapshots)

        frame["거래량 급증도"] = frame.apply(
            lambda row: round((seed_for(row["code"], "vol_spike") % 30) / 10 + 0.5, 1), axis=1
        )
        frame["모멘텀 점수"] = frame.apply(
            lambda row: round(abs(row["change_rate"]) * (seed_for(row["code"], "mom") % 3 + 1), 1), axis=1
        )
        frame["추세 방향"] = frame["change_rate"].apply(lambda x: "↑ 상승" if x > 0.5 else ("↓ 하락" if x < -0.5 else "→ 횡보"))
        frame["BNF 관심도"] = frame.apply(
            lambda row: "★★★" if row["거래량 급증도"] >= 2.0 and row["change_rate"] > 1.0
            else ("★★" if row["거래량 급증도"] >= 1.5 else "★"),
            axis=1,
        )

        display = frame[["market", "code", "name", "sector", "거래량 급증도", "모멘텀 점수", "추세 방향", "BNF 관심도"]].rename(
            columns={"market": "시장", "code": "코드", "name": "종목명", "sector": "업종"}
        )
        st.dataframe(display, use_container_width=True, hide_index=True)
        st.caption("거래량 급증도·모멘텀 점수는 데모 시뮬레이션 값입니다. 실제 투자 전 증권사 HTS/MTS 수급 데이터를 반드시 확인하십시오.")

        st.divider()
        st.markdown("**코테가와의 최종 메시지**")
        st.markdown(
            '> *"승리의 비결은 단순하다. 작게 잃고, 크게 이겨라. '
            '당신이 옳을 때 최대한 버텨라. 그리고 틀렸을 때 즉시 인정하고 나와라."*  \n'
            '> — 코테가와 다카시(BNF)\n\n'
            '> *"시장은 당신의 의견을 신경 쓰지 않는다. 주가가 틀렸다고 주장하기 전에, '
            '자신이 틀린 것은 아닌지 먼저 의심하라."*  \n'
            '> — 코테가와 다카시(BNF)'
        )


def main() -> None:
    setup_page()
    menu, market, keyword, sectors, use_live, refresh_seconds = render_sidebar()
    auto_refresh(refresh_seconds if use_live else 0)
    if st.session_state.pop("menu_override", None) == "차트":
        menu = "차트"

    stocks = filtered_stocks(market, keyword, sectors)
    if menu == "종목":
        render_stocks_page(stocks, use_live, keyword)
    elif menu == "차트":
        render_chart_page(market, use_live, keyword, sectors)
    elif menu == "관심종목":
        render_favorites_page(use_live)
    else:
        render_portfolio_page(market, use_live)


if __name__ == "__main__":
    main()
