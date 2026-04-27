package com.meallens.share;


import com.meallens.place.PlaceResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {
    private final ShareService shareService;
    @GetMapping("/shares/{shareId}")
    public ResponseEntity<List<PlaceResponse>> getSharedPlaces(@PathVariable UUID shareId){
        List<PlaceResponse> responses = shareService.getSharedPlaces(shareId);
        return ResponseEntity.ok(responses);
    }
}
