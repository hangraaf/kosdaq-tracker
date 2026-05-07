package com.tracker.kosdaq.controller;

import com.tracker.kosdaq.dto.StockDto;
import com.tracker.kosdaq.entity.FavoriteStock;
import com.tracker.kosdaq.entity.Portfolio;
import com.tracker.kosdaq.repository.FavoriteStockRepository;
import com.tracker.kosdaq.repository.PortfolioRepository;
import com.tracker.kosdaq.service.StockService;
import com.tracker.kosdaq.service.ChartService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
public class MainController {

    @Autowired
    private StockService stockService;

    @Autowired
    private ChartService chartService;

    @Autowired
    private FavoriteStockRepository favoriteStockRepository;

    @Autowired
    private PortfolioRepository portfolioRepository;

    /**
     * 메인 페이지
     */
    @GetMapping("/")
    public String index(Model model) {
        List<StockDto> stocks = stockService.getKosdaqStockList();
        model.addAttribute("stocks", stocks);
        return "index";
    }

    /**
     * 차트 페이지
     */
    @GetMapping("/chart/{stockCode}")
    public String chart(@PathVariable String stockCode, Model model) {
        StockDto stock = stockService.getStockPrice(stockCode);
        model.addAttribute("stock", stock);
        return "chart";
    }

    /**
     * 포트폴리오 페이지
     */
    @GetMapping("/portfolio")
    public String portfolio(Model model) {
        List<Portfolio> portfolios = portfolioRepository.findAll();
        model.addAttribute("portfolios", portfolios);
        return "portfolio";
    }

    /**
     * 즐겨찾기 추가
     */
    @PostMapping("/favorite/add")
    public String addFavorite(@RequestParam String stockCode, @RequestParam String stockName) {
        FavoriteStock favorite = new FavoriteStock();
        favorite.setStockCode(stockCode);
        favorite.setStockName(stockName);
        favoriteStockRepository.save(favorite);
        return "redirect:/";
    }

    /**
     * 즐겨찾기 삭제
     */
    @GetMapping("/favorite/remove/{stockCode}")
    public String removeFavorite(@PathVariable String stockCode) {
        favoriteStockRepository.deleteByStockCode(stockCode);
        return "redirect:/";
    }

    /**
     * 포트폴리오에 종목 추가
     */
    @PostMapping("/portfolio/add")
    public String addPortfolio(@RequestParam String stockCode, 
                                @RequestParam String stockName,
                                @RequestParam Integer quantity,
                                @RequestParam String avgPrice) {
        Portfolio portfolio = new Portfolio();
        portfolio.setStockCode(stockCode);
        portfolio.setStockName(stockName);
        portfolio.setQuantity(quantity);
        portfolio.setAvgPrice(avgPrice);
        portfolio.setCurrentPrice(avgPrice);
        portfolioRepository.save(portfolio);
        return "redirect:/portfolio";
    }

    /**
     * 포트폴리오에서 종목 삭제
     */
    @GetMapping("/portfolio/remove/{stockCode}")
    public String removePortfolio(@PathVariable String stockCode) {
        portfolioRepository.deleteByStockCode(stockCode);
        return "redirect:/portfolio";
    }

    /**
     * 검색 결과
     */
    @GetMapping("/search")
    public String search(@RequestParam String keyword, Model model) {
        List<StockDto> results = stockService.searchStocks(keyword);
        model.addAttribute("results", results);
        model.addAttribute("keyword", keyword);
        return "search";
    }
}