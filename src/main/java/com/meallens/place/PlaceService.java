package com.meallens.place;

import com.meallens.user.User;
import com.meallens.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlaceService {

    private final PlaceRepository placeRepository;
    private final UserRepository userRepository;

    @Transactional
    public PlaceResponse addPlace(String userEmail, PlaceRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Place place = Place.builder()
                .user(user)
                .name(request.getName())
                .area(request.getArea())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .googlePlaceId(request.getGooglePlaceId())
                .mealType(request.getMealType())
                .context(request.getContext())
                .visitedOn(request.getVisitedOn())
                .note(request.getNote())
                .rating(request.getRating())
                .build();

        Place savedPlace = placeRepository.save(place);
        return PlaceResponse.from(savedPlace);
    }

    public List<PlaceResponse> getMyPlaces(String userEmail,MealType mealType,PlaceContext placeContext,String keyword) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Specification<Place> spec = Specification
                .where(PlaceSpecification.belongsToUser(user.getId()))
                .and(PlaceSpecification.hasMealType(mealType))
                .and(PlaceSpecification.hasContext(placeContext))
                .and(PlaceSpecification.searchKeyword(keyword));

        Sort sort = Sort.by(Sort.Direction.DESC,"visitedOn");
        return placeRepository.findAll(spec,sort)
                .stream().map(PlaceResponse::from).collect(Collectors.toList());
    }

    @Transactional
    public void deletePlace(String userEmail, UUID placeId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!placeRepository.existsByIdAndUserId(placeId, user.getId())) {
            throw new RuntimeException("Place not found");
        }

        placeRepository.deleteById(placeId);
    }
}