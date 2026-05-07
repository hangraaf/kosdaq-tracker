package com.tracker.kosdaq.repository;

import com.tracker.kosdaq.entity.FavoriteStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteStockRepository extends JpaRepository<FavoriteStock, Long> {
    List<FavoriteStock> findAll();
    Optional<FavoriteStock> findByStockCode(String stockCode);
    void deleteByStockCode(String stockCode);
}