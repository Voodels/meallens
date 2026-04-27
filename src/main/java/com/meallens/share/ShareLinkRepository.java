package com.meallens.share;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;
@Repository
public interface ShareLinkRepository extends JpaRepository<ShareLink, UUID> {

}
