package com.meallens.share;

import com.meallens.place.*;
import com.meallens.user.User;
import com.meallens.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShareService {

    private final ShareLinkRepository shareLinkRepository;
    private final UserRepository userRepository;
    private final PlaceRepository placeRepository;

    public String createShareLink(String userEmail,
                                  MealType mealType,
                                  PlaceContext placeContext,
                                  String keyword) {

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ShareLink shareLink = ShareLink.builder()
                .user(user)
                .mealType(mealType)
                .context(placeContext)
                .keyword(keyword)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();

        ShareLink savedLink = shareLinkRepository.save(shareLink);

        return savedLink.getId().toString();
    }

    public List<PlaceResponse> getSharedPlaces(UUID shareId) {

        ShareLink link = shareLinkRepository.findById(shareId)
                .orElseThrow(() -> new RuntimeException("Share link not found"));

        if (!link.isValid()) {
            throw new RuntimeException("Share link expired or invalid");
        }

        Specification<Place> spec = Specification
                .where(PlaceSpecification.belongsToUser(link.getUser().getId()))
                .and(PlaceSpecification.hasMealType(link.getMealType()))
                .and(PlaceSpecification.hasContext(link.getContext()))
                .and(PlaceSpecification.searchKeyword(link.getKeyword()));

        Sort sort = Sort.by(Sort.Direction.DESC, "visitedOn");

        return placeRepository.findAll(spec, sort)
                .stream()
                .map(PlaceResponse::from)
                .collect(Collectors.toList());
    }
}