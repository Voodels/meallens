package com.meallens.auth;

import com.meallens.user.User;
import com.meallens.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;


@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;


    public String register(RegisterRequest registerRequest) {
        // Rule 1 no duplicate Emails
        if (userRepository.findByEmail(registerRequest.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        // Rule 2 Hash Password before it ever touches the entity
        User user = User.builder()
                .email(registerRequest.getEmail())
                .name(registerRequest.getName())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .build();

        userRepository.save(user);
        return "User registered successfully";
    }

    public String login(LoginRequest loginRequest){
         
        
        //
            Optional<User> user = userRepository.findByEmail(
                    loginRequest.getEmail());

            if(user.isEmpty() || !passwordEncoder.matches(loginRequest.getPassword(), user.get().getPassword())) {
                throw new RuntimeException("Incorrect credentials");
            }
        //
            return jwtUtil.generateToken(user.get().getEmail());
    }
}
