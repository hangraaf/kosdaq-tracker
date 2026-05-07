package com.tracker.kosdaq.service;

import com.tracker.kosdaq.dto.ChartDataDto;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class ChartService {

    private final Random random = new Random();

    /**
     * 일간 차트 데이터 조회
     */
    public List<ChartDataDto> getDailyChart(String stockCode, int days) {
        List<ChartDataDto> chartData = new ArrayList<>();
        LocalDate currentDate = LocalDate.now();
        
        double basePrice = 10000 + random.nextDouble() * 20000;
        
        for (int i = days; i >= 0; i--) {
            LocalDate date = currentDate.minusDays(i);
            
            // 랜덤 변동 생성
            double change = (random.nextDouble() - 0.5) * 1000;
            double open = basePrice + change;
            double close = open + (random.nextDouble() - 0.5) * 500;
            double high = Math.max(open, close) + random.nextDouble() * 200;
            double low = Math.min(open, close) - random.nextDouble() * 200;
            
            ChartDataDto dto = new ChartDataDto();
            dto.setDate(date);
            dto.setOpenPrice(String.format("%.0f", open));
            dto.setHighPrice(String.format("%.0f", high));
            dto.setLowPrice(String.format("%.0f", low));
            dto.setClosePrice(String.format("%.0f", close));
            dto.setVolume(String.valueOf(random.nextInt(500000) + 50000));
            dto.setChangeAmount(String.format("%.0f", close - open));
            dto.setChangeRate(String.format("%.2f", ((close - open) / open) * 100));
            
            chartData.add(dto);
            basePrice = close;
        }
        
        // 이동평균선 계산
        calculateMovingAverages(chartData);
        
        return chartData;
    }

    /**
     * 주간 차트 데이터 조회
     */
    public List<ChartDataDto> getWeeklyChart(String stockCode, int weeks) {
        return getDailyChart(stockCode, weeks * 7);
    }

    /**
     * 월간 차트 데이터 조회
     */
    public List<ChartDataDto> getMonthlyChart(String stockCode, int months) {
        return getDailyChart(stockCode, months * 30);
    }

    /**
     * 이동평균선 계산
     */
    private void calculateMovingAverages(List<ChartDataDto> chartData) {
        for (int i = 0; i < chartData.size(); i++) {
            ChartDataDto current = chartData.get(i);
            
            // 5일 이동평균
            if (i >= 4) {
                double sum = 0;
                for (int j = i - 4; j <= i; j++) {
                    sum += Double.parseDouble(chartData.get(j).getClosePrice());
                }
                current.setMa5(String.format("%.0f", sum / 5));
            }
            
            // 20일 이동평균
            if (i >= 19) {
                double sum = 0;
                for (int j = i - 19; j <= i; j++) {
                    sum += Double.parseDouble(chartData.get(j).getClosePrice());
                }
                current.setMa20(String.format("%.0f", sum / 20));
            }
            
            // 60일 이동평균
            if (i >= 59) {
                double sum = 0;
                for (int j = i - 59; j <= i; j++) {
                    sum += Double.parseDouble(chartData.get(j).getClosePrice());
                }
                current.setMa60(String.format("%.0f", sum / 60));
            }
        }
        
        // RSI 계산
        calculateRSI(chartData);
        
        // MACD 계산
        calculateMACD(chartData);
    }

    /**
     * RSI (Relative Strength Index) 계산
     */
    private void calculateRSI(List<ChartDataDto> chartData) {
        int period = 14;
        
        for (int i = period; i < chartData.size(); i++) {
            double gain = 0;
            double loss = 0;
            
            for (int j = i - period + 1; j <= i; j++) {
                double change = Double.parseDouble(chartData.get(j).getChangeAmount());
                if (change > 0) {
                    gain += change;
                } else {
                    loss += Math.abs(change);
                }
            }
            
            double avgGain = gain / period;
            double avgLoss = loss / period;
            
            double rs = avgLoss == 0 ? 100 : avgGain / avgLoss;
            double rsi = 100 - (100 / (1 + rs));
            
            chartData.get(i).setRsi(String.format("%.2f", rsi));
        }
    }

    /**
     * MACD (Moving Average Convergence Divergence) 계산
     */
    private void calculateMACD(List<ChartDataDto> chartData) {
        // 12일 EMA
        double ema12 = calculateEMA(chartData, 12);
        // 26일 EMA
        double ema26 = calculateEMA(chartData, 26);
        
        for (int i = 25; i < chartData.size(); i++) {
            double macdLine = ema12 - ema26;
            chartData.get(i).setMacd(String.format("%.2f", macdLine));
            chartData.get(i).setSignal(String.format("%.2f", macdLine * 0.9)); // 단순화된 시그널
        }
    }

    /**
     * EMA (Exponential Moving Average) 계산
     */
    private double calculateEMA(List<ChartDataDto> chartData, int period) {
        if (chartData.size() < period) {
            return 0;
        }
        
        double sum = 0;
        for (int i = 0; i < period; i++) {
            sum += Double.parseDouble(chartData.get(chartData.size() - period + i).getClosePrice());
        }
        
        return sum / period;
    }

    /**
     * 예측 데이터 생성 (1주일/1개월)
     */
    public List<ChartDataDto> getPrediction(String stockCode, String period) {
        int days = period.equals("week") ? 7 : 30;
        return getDailyChart(stockCode + "_pred", days);
    }
}