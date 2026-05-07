package com.tracker.kosdaq.controller;

import com.tracker.kosdaq.dto.ChartDataDto;
import com.tracker.kosdaq.dto.StockDto;
import com.tracker.kosdaq.service.ChartService;
import com.tracker.kosdaq.service.StockService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiController {

    @Autowired
    private StockService stockService;

    @Autowired
    private ChartService chartService;

    /**
     * 코스닥 종목 목록
     */
    @GetMapping("/stocks")
    public List<StockDto> getStocks() {
        return stockService.getKosdaqStockList();
    }

    /**
     * 개별 종목 시세
     */
    @GetMapping("/stock/{stockCode}")
    public StockDto getStock(@PathVariable String stockCode) {
        return stockService.getStockPrice(stockCode);
    }

    /**
     * 일간 차트 데이터
     */
    @GetMapping("/chart/{stockCode}/daily")
    public List<ChartDataDto> getDailyChart(@PathVariable String stockCode, 
                                              @RequestParam(defaultValue = "90") int days) {
        return chartService.getDailyChart(stockCode, days);
    }

    /**
     * 주간 차트 데이터
     */
    @GetMapping("/chart/{stockCode}/weekly")
    public List<ChartDataDto> getWeeklyChart(@PathVariable String stockCode, 
                                               @RequestParam(defaultValue = "52") int weeks) {
        return chartService.getWeeklyChart(stockCode, weeks);
    }

    /**
     * 월간 차트 데이터
     */
    @GetMapping("/chart/{stockCode}/monthly")
    public List<ChartDataDto> getMonthlyChart(@PathVariable String stockCode, 
                                                @RequestParam(defaultValue = "24") int months) {
        return chartService.getMonthlyChart(stockCode, months);
    }

    /**
     * 예측 데이터
     */
    @GetMapping("/chart/{stockCode}/prediction")
    public List<ChartDataDto> getPrediction(@PathVariable String stockCode, 
                                             @RequestParam(defaultValue = "week") String period) {
        return chartService.getPrediction(stockCode, period);
    }

    /**
     * 검색
     */
    @GetMapping("/search")
    public List<StockDto> search(@RequestParam String keyword) {
        return stockService.searchStocks(keyword);
    }
}