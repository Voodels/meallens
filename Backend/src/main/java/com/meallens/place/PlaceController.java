package com.meallens.place;


import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.awt.geom.QuadCurve2D;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor // gives ->
public class PlaceController {
    private final PlaceService placeService;
    private final com.meallens.share.ShareService shareService;
    @PostMapping
    public ResponseEntity<PlaceResponse> addPlace(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody PlaceRequest request
            ){
        PlaceResponse res = placeService.addPlace(userDetails.getUsername(),request);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }
    @GetMapping
    public ResponseEntity<List<PlaceResponse>> getMyPlaces(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) MealType mealType,
            @RequestParam(required = false) PlaceContext context,
            @RequestParam(required = false) String search
    ) {
        List<PlaceResponse> responses = placeService.getMyPlaces(
                userDetails.getUsername(), mealType, context, search
        );
        return ResponseEntity.ok(responses);
    }
    @PostMapping("/share")
    public ResponseEntity<String> generateSharedLink(
                                                      @AuthenticationPrincipal UserDetails userDetails,
                                                      @RequestParam(required = false) MealType mealType,
                                                      @RequestParam(required = false) PlaceContext context,
                                                      @RequestParam(required = false) String search
    ){
        String shareId = shareService.createShareLink(
                userDetails.getUsername(),mealType,context,search
        );

        return ResponseEntity.ok(shareId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<PlaceResponse> deletePlace(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id
    ){
        placeService.deletePlace(userDetails.getUsername(),id);
        return ResponseEntity.noContent().build();
    }
}
