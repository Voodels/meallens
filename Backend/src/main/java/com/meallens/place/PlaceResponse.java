package com.meallens.place;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class PlaceResponse {
    private UUID id;
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
    private LocalDateTime createdAt;

    // A static factory method to easily translate the Entity into this DTO
    public static PlaceResponse from(Place place) {
        return PlaceResponse.builder()
                .id(place.getId())
                .name(place.getName())
                .area(place.getArea())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .googlePlaceId(place.getGooglePlaceId())
                .mealType(place.getMealType())
                .context(place.getContext())
                .visitedOn(place.getVisitedOn())
                .note(place.getNote())
                .rating(place.getRating())
                .createdAt(place.getCreatedAt())
                .build();
    }
}
