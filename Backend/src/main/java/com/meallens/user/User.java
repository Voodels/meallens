package com.meallens.user;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.*;
import jakarta.persistence.Entity;
import org.hibernate.annotations.CreationTimestamp;

import jakarta.annotation.Generated;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@jakarta.persistence.Entity
@jakarta.persistence.Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder 
public class User {
	@Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false,unique = true)
    private String email;

    @Column(nullable =  false)
    private  String password;

    private String name;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
