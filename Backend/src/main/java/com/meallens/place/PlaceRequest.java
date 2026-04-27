package com.meallens.place;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PlaceRequest {
    private String name;
    private String area;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String googlePlaceId;
    private MealType mealType;
    private PlaceContext context;
    private LocalDate visitedOn;
    private String note;
    private Integer rating;
}