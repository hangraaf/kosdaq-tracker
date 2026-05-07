package com.tracker.kosdaq.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class StockDto {
    private String stockCode;      // 종목코드
    private String stockName;      // 종목명
    private String currentPrice;   // 현재가
    private String changeRate;     // 등락률
    private String tradingVolume;  // 거래량
    private String marketCap;      // 시가총액
    private LocalDateTime updatedAt; // 업데이트 시간
}