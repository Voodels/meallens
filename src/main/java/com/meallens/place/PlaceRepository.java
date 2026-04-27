package com.meallens.place;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PlaceRepository extends JpaRepository<Place, UUID>, JpaSpecificationExecutor<Place> {

    // We only want a specific user's places, sorted with the newest meals first.
    List<Place> findByUserIdOrderByVisitedOnDesc(UUID userId);



    // A security check: does this exact place belong to this exact user?
    boolean existsByIdAndUserId(UUID id, UUID userId);
}