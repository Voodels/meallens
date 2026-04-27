package com.meallens.place;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PlaceSearchResult {
    private String name;
    private String address;
    private Double latitude;
    private Double longitude;
}
