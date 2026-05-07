package com.tracker.kosdaq.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "portfolio")
@Data
public class Portfolio {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "stock_code", nullable = false)
    private String stockCode;
    
    @Column(name = "stock_name", nullable = false)
    private String stockName;
    
    @Column(name = "quantity")
    private Integer quantity;
    
    @Column(name = "avg_price")
    private String avgPrice;
    
    @Column(name = "current_price")
    private String currentPrice;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}