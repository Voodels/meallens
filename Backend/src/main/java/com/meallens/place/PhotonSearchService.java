package com.meallens.place;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PhotonSearchService {

    private final RestTemplate restTemplate = new RestTemplate();

    public List<PlaceSearchResult> search(String query) {
        if (query == null || query.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String url = UriComponentsBuilder
                .fromHttpUrl("https://photon.komoot.io/api/")
                .queryParam("q", query)
                .queryParam("limit", 10)
                .queryParam("lang", "en")
                .build()
                .toUriString();

        PhotonApiResponse response = restTemplate.getForObject(url, PhotonApiResponse.class);
        if (response == null || response.getFeatures() == null) {
            return Collections.emptyList();
        }

        return response.getFeatures().stream()
                .map(this::toResult)
                .filter(result -> result.getLatitude() != null && result.getLongitude() != null)
                .collect(Collectors.toList());
    }

    private PlaceSearchResult toResult(PhotonApiResponse.Feature feature) {
        PhotonApiResponse.Geometry geometry = feature.getGeometry();
        PhotonApiResponse.Properties props = feature.getProperties();
        Double latitude = null;
        Double longitude = null;

        if (geometry != null && geometry.getCoordinates() != null && geometry.getCoordinates().size() >= 2) {
            longitude = geometry.getCoordinates().get(0);
            latitude = geometry.getCoordinates().get(1);
        }

        String name = props != null && props.getName() != null ? props.getName() : "Unknown Place";
        String address = buildAddress(props);

        return new PlaceSearchResult(name, address, latitude, longitude);
    }

    private String buildAddress(PhotonApiResponse.Properties props) {
        if (props == null) {
            return "";
        }
        String street = joinParts(props.getStreet(), props.getHousenumber());
        String locality = joinParts(props.getDistrict(), props.getCity());
        String region = joinParts(props.getState(), props.getCountry());
        String postal = props.getPostcode();

        return joinParts(street, locality, postal, region);
    }

    private String joinParts(String... parts) {
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.trim().isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(", ");
            }
            builder.append(part.trim());
        }
        return builder.toString();
    }
}
