package com.tracker.kosdaq.repository;

import com.tracker.kosdaq.entity.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {
    List<Portfolio> findAll();
    Optional<Portfolio> findByStockCode(String stockCode);
    void deleteByStockCode(String stockCode);
}