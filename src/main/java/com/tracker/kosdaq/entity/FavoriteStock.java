package com.tracker.kosdaq.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "favorite_stocks")
@Data
public class FavoriteStock {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "stock_code", nullable = false)
    private String stockCode;
    
    @Column(name = "stock_name", nullable = false)
    private String stockName;
    
    @Column(name = "alert_up_price")
    private String alertUpPrice;
    
    @Column(name = "alert_down_price")
    private String alertDownPrice;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}