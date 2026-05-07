package com.tracker.kosdaq.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class ChartDataDto {
    private LocalDate date;       // 날짜
    private String openPrice;     // 시가
    private String highPrice;     // 고가
    private String lowPrice;      // 저가
    private String closePrice;    // 종가
    private String volume;        // 거래량
    private String changeAmount;  // 전일대비
    private String changeRate;    // 등락률
    
    // 기술지표
    private String ma5;   // 5일 이동평균
    private String ma20;  // 20일 이동평균
    private String ma60;  // 60일 이동평균
    private String rsi;   // RSI
    private String macd;  // MACD
    private String signal; // 시그널
}