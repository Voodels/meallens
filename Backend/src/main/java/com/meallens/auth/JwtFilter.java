package com.meallens.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Extract the Authorization header
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        // 2. If there is no token, or it doesn't start with "Bearer ", let it pass.
        // Spring Security will block it later if the endpoint requires auth.
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Extract the token (skipping the 7 characters of "Bearer ")
        jwt = authHeader.substring(7);
        userEmail = jwtUtil.extractEmail(jwt);

        // 4. If we found an email, and this user isn't already authenticated in this request
        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {

            // Hand the email to our "Travel Adapter" to get the UserDetails
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

            // 5. Check if the token's signature and expiration are still valid
            if (jwtUtil.isTokenValid(jwt, userDetails.getUsername())) {

                // 6. Create the official Spring Security "Passport"
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );

                // Attach details about the web request (like their IP address)
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // 7. Store the passport in Spring Security's memory for this request
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // 8. Move to the next filter in the chain
        filterChain.doFilter(request, response);
    }
}