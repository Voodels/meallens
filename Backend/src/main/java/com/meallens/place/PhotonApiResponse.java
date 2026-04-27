package com.meallens.place;

import lombok.Data;

import java.util.List;

@Data
public class PhotonApiResponse {
    private List<Feature> features;

    @Data
    public static class Feature {
        private Geometry geometry;
        private Properties properties;
    }

    @Data
    public static class Geometry {
        private List<Double> coordinates;
    }

    @Data
    public static class Properties {
        private String name;
        private String street;
        private String housenumber;
        private String city;
        private String state;
        private String country;
        private String postcode;
        private String district;
    }
}
