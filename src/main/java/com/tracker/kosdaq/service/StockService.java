package com.tracker.kosdaq.service;

import com.tracker.kosdaq.config.ApiConfig;
import com.tracker.kosdaq.dto.StockDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class StockService {

    @Autowired
    private ApiConfig apiConfig;

    @Autowired
    private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();

    /**
     * 코스닥 종목 목록 조회
     */
    public List<StockDto> getKosdaqStockList() {
        // API 키가 없으면 데모 데이터 반환
        if (apiConfig.getAppKey() == null || apiConfig.getAppKey().isEmpty()) {
            return getDemoStockList();
        }
        
        try {
            // 실제 API 호출 로직 (추후 구현)
            return getDemoStockList();
        } catch (Exception e) {
            return getDemoStockList();
        }
    }

    /**
     * 개별 종목 시세 조회
     */
    public StockDto getStockPrice(String stockCode) {
        if (apiConfig.getAppKey() == null || apiConfig.getAppKey().isEmpty()) {
            return getDemoStockPrice(stockCode);
        }
        
        try {
            return getDemoStockPrice(stockCode);
        } catch (Exception e) {
            return getDemoStockPrice(stockCode);
        }
    }

    /**
     * 종목 검색
     */
    public List<StockDto> searchStocks(String keyword) {
        List<StockDto> allStocks = getKosdaqStockList();
        List<StockDto> result = new ArrayList<>();
        
        for (StockDto stock : allStocks) {
            if (stock.getStockName().contains(keyword) || 
                stock.getStockCode().contains(keyword)) {
                result.add(stock);
            }
        }
        
        return result;
    }

    /**
     * 데모용 코스닥 종목 목록
     */
    private List<StockDto> getDemoStockList() {
        List<StockDto> stocks = new ArrayList<>();
        
        String[][] demoStocks = {
            {"095570", "AJ네트웍스", "8,450"},
            {"006840", "AK홀딩스", "12,300"},
            {"001020", "APS홀딩스", "15,600"},
            {"003560", "BGF", "4,320"},
            {"001070", "KBS미디어", "3,280"},
            {"036810", "이스트소프트", "9,750"},
            {"053800", "아이마켓", "6,420"},
            {"068270", "셀트리온", "28,900"},
            {"086450", "오상기", "5,180"},
            {"032680", "네이퍼", "7,340"},
            {"122450", "KMH", "12,100"},
            {"052420", "TDB대상", "8,920"},
            {"036830", "슈프리마", "11,500"},
            {"099430", "압타", "4,560"},
            {"066900", "디에이피", "13,200"}
        };

        for (String[] data : demoStocks) {
            StockDto dto = new StockDto();
            dto.setStockCode(data[0]);
            dto.setStockName(data[1]);
            dto.setCurrentPrice(data[2]);
            dto.setChangeRate(String.format("%.2f", (random.nextDouble() - 0.5) * 10));
            dto.setTradingVolume(String.valueOf(random.nextInt(1000000) + 100000));
            dto.setMarketCap(String.valueOf(random.nextInt(1000000000000L)));
            dto.setUpdatedAt(LocalDateTime.now());
            stocks.add(dto);
        }

        return stocks;
    }

    /**
     * 데모용 개별 종목 시세
     */
    private StockDto getDemoStockPrice(String stockCode) {
        StockDto dto = new StockDto();
        dto.setStockCode(stockCode);
        dto.setStockName("종목명");
        dto.setCurrentPrice(String.valueOf(random.nextInt(50000) + 1000));
        dto.setChangeRate(String.format("%.2f", (random.nextDouble() - 0.5) * 10));
        dto.setTradingVolume(String.valueOf(random.nextInt(1000000)));
        dto.setMarketCap(String.valueOf(random.nextInt(1000000000000L)));
        dto.setUpdatedAt(LocalDateTime.now());
        return dto;
    }
}