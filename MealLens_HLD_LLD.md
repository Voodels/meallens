# Meal Lens — HLD + LLD
### "Hinge x Journal — for food"
> A personal food diary. Places you ate, when, with what context, a note, on a map.

---

## Before any diagram — the questions a senior asks first

These questions determine the architecture. Answer them wrong and you
build the wrong system. Answer them right and every design decision
that follows is obvious.

| Question | Answer for Meal Lens | Why it matters |
|---|---|---|
| Who uses this? | 1 person primarily, share link for friends (read-only) | No multi-tenant complexity needed |
| How many records? | ~500 places over years | No pagination hell, no sharding needed |
| Read vs write ratio? | 80% read, 20% write | Cache reads aggressively |
| Real-time needed? | No. 2 second stale data is fine | No websockets, no event streaming |
| Consistency? | Eventual is fine | A place showing up 1 second late is acceptable |
| What if it goes down? | Fine. Personal app. | No HA cluster needed right now |
| What grows later? | Photos, friends adding to shared list | Design the door, don't build the room |

These answers mean: **monolith is correct**. Microservices here would be
engineering for the sake of complexity, not for the sake of the problem.

---

# Part 1 — High Level Design (HLD)

## What HLD answers
> What are the big boxes and how do they talk to each other?
No class names. No method signatures. Just components and data flow.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│   React (desktop)  +  Responsive Web (mobile browser)  │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    NGINX (reverse proxy)                 │
│  - SSL termination                                       │
│  - Serve React static files                             │
│  - Proxy /api/* → Spring Boot                           │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP (internal)
                          ▼
┌─────────────────────────────────────────────────────────┐
│               SPRING BOOT APPLICATION                    │
│                                                          │
│  Filter Chain → DispatcherServlet → Controllers          │
│  → Services → Repositories                              │
│                                                          │
│  Cross-cutting: Auth (JWT), Rate Limiting (AOP),         │
│  Caching (@Cacheable), Metrics (Micrometer)             │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│     POSTGRESQL       │  │           REDIS               │
│                      │  │                               │
│  - users             │  │  - Cached place lists         │
│  - places            │  │  - JWT blacklist (logout)     │
│  - share_links       │  │  - Rate limit counters        │
└──────────────────────┘  └──────────────────────────────┘
```

---

## Why each box exists

### Nginx
You do not expose Spring Boot directly to the internet.
- Nginx handles SSL. Spring Boot handles business logic. Separation of concerns.
- Nginx serves your React build as static files. Spring Boot never touches HTML/CSS/JS.
- If Spring Boot restarts, Nginx keeps serving the frontend. Users see the app, not a dead screen.

**Tradeoff acknowledged:** For a local dev personal app, you could skip Nginx.
Add it when you deploy. Design for it now so deployment is not a rewrite.

### Spring Boot (single instance)
One app. One process. Everything inside it.

**Why not microservices?**
Microservices solve: team autonomy, independent scaling, independent deployments.
You have: one developer, one service, ~500 records.
Microservices here = distributed monolith with all the pain and none of the benefit.

Monolith is not a dirty word. It is the right tool for this scale.

**What lives inside Spring Boot:**
- HTTP request handling (Spring MVC)
- Business logic (Services)
- Database access (JPA + Repositories)
- Authentication (Spring Security + JWT filter)
- Caching abstraction (@Cacheable → Redis)
- Rate limiting (AOP + Redis Lua script)
- Metrics (Micrometer → Actuator)

### PostgreSQL
Relational data with clear relationships.
A Place belongs to a User. A ShareLink belongs to a User.
These relationships are foreign keys. Postgres enforces them.

**Why not MongoDB?**
MongoDB is flexible schema. Your schema is well-defined and stable.
Flexible schema solves a problem you don't have.
Postgres gives you: joins, transactions, ACID guarantees, full-text search.
MongoDB gives you: flexibility you don't need and consistency you'd have to implement yourself.

### Redis
Two jobs. Both are about speed and distributed state.

**Job 1 — Cache:** Your place list doesn't change every second.
Hitting Postgres on every page load for 500 rows is wasteful.
Cache it in Redis with a TTL. On write, invalidate the cache.

**Job 2 — Rate limiter counters:** The public share link is unauthenticated.
Anyone with the URL can hit it. Rate limit it.
The counter must survive across app restarts → Redis, not in-memory.

---

## Request flow — two paths

### Path 1 — Authenticated request (your own use)
```
Browser → Nginx → Spring Boot Filter Chain
  → JwtFilter validates token
  → DispatcherServlet routes to Controller
  → Controller calls Service
  → Service checks Redis cache
  → Cache hit → return immediately
  → Cache miss → Service calls Repository → Postgres → populate cache → return
  → Controller returns 200 + JSON
  → Nginx → Browser
```

### Path 2 — Public share link (friend's use)
```
Browser → Nginx → Spring Boot Filter Chain
  → JwtFilter skips (no token on public endpoint)
  → RateLimitAspect intercepts (AOP)
  → Redis Lua script: check + decrement counter atomically
  → Over limit → 429 Too Many Requests + Retry-After header
  → Under limit → Controller → ShareService validates token → return places
```

---

## Data flow diagram

```
User Action          API Call              DB Operation
-----------          --------              ------------

Log a place    →  POST /api/places   →  INSERT into places
                                     →  Invalidate Redis cache

View my list   →  GET /api/places    →  Check Redis first
                                     →  Cache hit: return
                                     →  Cache miss: SELECT + cache

Filter by type →  GET /api/places    →  SELECT WHERE meal_type = ?
               →  ?mealType=DINNER   →  Cache keyed by filter params

Share my list  →  POST /api/share    →  INSERT into share_links
                                     →  Return token

Friend views   →  GET /api/share/:t  →  Rate limit check (Redis)
                                     →  SELECT share_links WHERE token
                                     →  SELECT places WHERE user_id

Delete place   →  DELETE /api/places →  DELETE from places
               →  /{id}              →  Invalidate Redis cache
```

---

# Part 2 — Low Level Design (LLD)

## What LLD answers
> What are the exact classes, interfaces, data models, and their relationships?

---

## Database Schema (design this before writing a single Java class)

```sql
-- Users table
-- Why UUID not LONG/BIGINT?
-- UUIDs don't leak information. If user id is 4, I know there are ~3 other users.
-- UUID is also safe to expose in URLs. BIGINT is guessable.
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,       -- BCrypt hashed, never plaintext
    name        VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Places table — the core of the app
CREATE TABLE places (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Basic info
    name            VARCHAR(255) NOT NULL,
    area            VARCHAR(255),                  -- neighbourhood/area name

    -- Map fields
    latitude        DECIMAL(9,6),                 -- 6 decimal places = ~10cm accuracy
    longitude       DECIMAL(9,6),                 -- sufficient for a restaurant pin
    google_place_id VARCHAR(255),                 -- for future Google Places API enrichment

    -- Classification (two separate dimensions)
    meal_type       VARCHAR(20) NOT NULL,          -- BREAKFAST/BRUNCH/LUNCH/SNACK/DINNER/LATE_NIGHT/CAFE
    context         VARCHAR(20),                   -- SOLO/WORK/DATE/FRIENDS/FAMILY

    -- Journal fields
    visited_on      DATE NOT NULL,                -- DATE not TIMESTAMP. You care about the day.
    note            TEXT,                          -- freeform. no length limit.
    rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Index: you will query by user_id + visited_on constantly
-- Without this index, Postgres scans every row to find your places
CREATE INDEX idx_places_user_id ON places(user_id);
CREATE INDEX idx_places_user_visited ON places(user_id, visited_on DESC);
CREATE INDEX idx_places_user_meal_type ON places(user_id, meal_type);

-- Share links table
CREATE TABLE share_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(64) UNIQUE NOT NULL,      -- cryptographically random token
    expires_at  TIMESTAMP,                        -- NULL = never expires
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_share_links_token ON share_links(token);
```

### Schema design decisions and tradeoffs

**Why DECIMAL(9,6) for coordinates?**
6 decimal places gives ~11cm precision. A restaurant doesn't move 11cm.
Using FLOAT would give floating point rounding errors. DECIMAL is exact.

**Why two ENUMs (meal_type + context) not one?**
They answer different questions.
meal_type = WHEN did you eat? (Dinner, Lunch, Brunch)
context = WHY / WITH WHOM? (Work, Date, Friends)
Combined in one ENUM you'd need WORK_LUNCH, DATE_DINNER, FRIENDS_BRUNCH — combinatorial explosion.
Separate ENUMs let you filter independently.

**Why store google_place_id if you're not using it now?**
Adding a column later requires a migration. Migrations on production tables with data
are risky (locks, downtime). Storing it now costs nothing. Costs a lot to add later.

**Why ON DELETE CASCADE on user_id foreign keys?**
If a user deletes their account, their places and share links should disappear too.
Without CASCADE you'd get a foreign key violation or have to manually delete in the right order.

---

## Java Package Structure (feature-based, not layer-based)

```
com.meallens/
│
├── MealLensApplication.java           ← entry point. nothing else here.
│
├── common/
│   ├── ApiResponse.java               ← standard response wrapper { data, error, timestamp }
│   ├── GlobalExceptionHandler.java    ← @ControllerAdvice. all exceptions land here.
│   ├── SecurityConfig.java            ← Spring Security configuration
│   └── RedisConfig.java               ← Redis template + cache config
│
├── auth/
│   ├── AuthController.java            ← /api/auth/register, /login, /logout
│   ├── AuthService.java               ← register, login, logout logic
│   ├── JwtFilter.java                 ← OncePerRequestFilter. validates JWT every request.
│   ├── JwtUtil.java                   ← generate token, validate token, extract claims
│   ├── RegisterRequest.java           ← DTO: { email, password, name }
│   └── LoginRequest.java              ← DTO: { email, password }
│
├── user/
│   ├── User.java                      ← @Entity. mirrors the users table.
│   └── UserRepository.java            ← findByEmail(). that's mostly it.
│
├── place/
│   ├── Place.java                     ← @Entity. mirrors the places table.
│   ├── MealType.java                  ← enum: BREAKFAST, BRUNCH, LUNCH, SNACK, DINNER, LATE_NIGHT, CAFE
│   ├── PlaceContext.java              ← enum: SOLO, WORK, DATE, FRIENDS, FAMILY
│   ├── PlaceController.java           ← HTTP layer only. calls service. no logic.
│   ├── PlaceService.java              ← all business rules. cache logic. validation.
│   ├── PlaceRepository.java           ← JPA queries. nothing else.
│   ├── PlaceRequest.java              ← what client sends to create/update
│   ├── PlaceResponse.java             ← what you send back (never expose entity directly)
│   └── PlaceFilter.java              ← filter params: mealType, context, dateFrom, dateTo
│
├── map/
│   ├── MapController.java             ← GET /api/map/places → lightweight pins only
│   └── MapPinResponse.java            ← { id, name, lat, lng, mealType } only. not full place.
│
├── share/
│   ├── ShareLink.java                 ← @Entity. mirrors share_links table.
│   ├── ShareController.java           ← /api/share endpoints
│   ├── ShareService.java              ← generate token, validate, get places for token
│   └── ShareRepository.java           ← findByToken(). deleteByUserId().
│
└── ratelimit/                         ← Month 4. folder exists now. don't touch yet.
    └── .gitkeep
```

### Why PlaceResponse exists separately from Place (the entity)

The `Place` entity is your internal representation. It maps 1:1 with the database.
`PlaceResponse` is your contract with the client.

If you expose the entity directly:
- You expose database column names as API fields. If you rename a column, the API breaks.
- You might expose fields you don't want to send (internal flags, audit fields).
- Adding a computed field ("visitedDaysAgo") requires changing the entity.

Response DTOs decouple your API contract from your database schema.
Change the DB → change the entity → the API doesn't change.
Change what you send to client → change the Response → the DB doesn't care.

---

## Class Designs

### Place.java (Entity)

```java
@Entity
@Table(name = "places")
@Data                          // Lombok: getters, setters, equals, hashCode
@NoArgsConstructor
@AllArgsConstructor
@Builder                       // PlaceBuilder pattern for clean object creation
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)   // LAZY: don't load User unless asked
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    private String area;

    // Map fields
    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;

    private String googlePlaceId;

    // Two separate enums — not one combined
    @Enumerated(EnumType.STRING)          // Store "DINNER" not "4" in DB
    @Column(nullable = false)             // STRING is safer — adding enum values doesn't break
    private MealType mealType;

    @Enumerated(EnumType.STRING)
    private PlaceContext context;

    @Column(nullable = false)
    private LocalDate visitedOn;          // DATE only, not timestamp

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(columnDefinition = "SMALLINT")
    @Min(1) @Max(5)
    private Integer rating;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

**Why `@Enumerated(EnumType.STRING)` not `EnumType.ORDINAL`?**
ORDINAL stores 0, 1, 2... If you ever reorder the enum values, every record is corrupted.
STRING stores "DINNER". You can reorder, add values, rename freely.
Always use STRING. ORDINAL is a trap.

**Why `FetchType.LAZY` on User?**
When you load a Place, you almost never need the full User object.
EAGER would JOIN users on every place query even when you don't use user data.
LAZY loads user only when you call `place.getUser()`.
Default in Spring is LAZY for @ManyToOne in most setups, but be explicit.

---

### PlaceRepository.java

```java
@Repository
public interface PlaceRepository extends JpaRepository<Place, UUID> {

    // All places for a user, newest first
    List<Place> findByUserIdOrderByVisitedOnDesc(UUID userId);

    // Filter by meal type
    List<Place> findByUserIdAndMealTypeOrderByVisitedOnDesc(UUID userId, MealType mealType);

    // Filter by context
    List<Place> findByUserIdAndContextOrderByVisitedOnDesc(UUID userId, PlaceContext context);

    // Filter by both
    List<Place> findByUserIdAndMealTypeAndContextOrderByVisitedOnDesc(
        UUID userId, MealType mealType, PlaceContext context);

    // For map view — only need coordinates, not full entity
    // Custom JPQL to fetch only what we need
    @Query("SELECT new com.meallens.map.MapPinResponse(p.id, p.name, p.latitude, p.longitude, p.mealType) " +
           "FROM Place p WHERE p.user.id = :userId AND p.latitude IS NOT NULL")
    List<MapPinResponse> findMapPinsByUserId(@Param("userId") UUID userId);

    // Existence check — does this place belong to this user?
    boolean existsByIdAndUserId(UUID id, UUID userId);
}
```

**Why the existsByIdAndUserId check?**
Security. Without this, user A could delete user B's place by knowing the UUID.
Always verify ownership before any mutation.

---

### PlaceService.java

```java
@Service
@RequiredArgsConstructor  // Lombok: constructor injection for all final fields
public class PlaceService {

    private final PlaceRepository placeRepository;
    private final UserRepository userRepository;

    // @Cacheable: on first call, hits DB and caches result
    // On subsequent calls with same userId, returns from Redis
    // Key includes userId so different users don't share cache
    @Cacheable(value = "places", key = "#userId")
    public List<PlaceResponse> getPlaces(UUID userId, PlaceFilter filter) {
        List<Place> places;

        if (filter.getMealType() != null && filter.getContext() != null) {
            places = placeRepository.findByUserIdAndMealTypeAndContextOrderByVisitedOnDesc(
                userId, filter.getMealType(), filter.getContext());
        } else if (filter.getMealType() != null) {
            places = placeRepository.findByUserIdAndMealTypeOrderByVisitedOnDesc(
                userId, filter.getMealType());
        } else if (filter.getContext() != null) {
            places = placeRepository.findByUserIdAndContextOrderByVisitedOnDesc(
                userId, filter.getContext());
        } else {
            places = placeRepository.findByUserIdOrderByVisitedOnDesc(userId);
        }

        return places.stream()
            .map(PlaceResponse::from)   // convert entity → response DTO
            .collect(Collectors.toList());
    }

    // @CacheEvict: when a place is added, the cached list is stale
    // Evict it so next GET fetches fresh data from DB
    @CacheEvict(value = "places", key = "#userId")
    @Transactional
    public PlaceResponse addPlace(UUID userId, PlaceRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

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

        Place saved = placeRepository.save(place);
        return PlaceResponse.from(saved);
    }

    @CacheEvict(value = "places", key = "#userId")
    @Transactional
    public void deletePlace(UUID userId, UUID placeId) {
        // Ownership check first. Never skip this.
        if (!placeRepository.existsByIdAndUserId(placeId, userId)) {
            throw new ResourceNotFoundException("Place not found");  // 404, not 403
            // Why 404 not 403? Don't confirm the resource exists to unauthorized callers.
        }
        placeRepository.deleteById(placeId);
    }
}
```

**Why return 404 instead of 403 on ownership failure?**
If user A tries to delete user B's place and you return 403 (Forbidden),
you've confirmed that place exists. An attacker now knows valid place IDs.
Return 404. The place "doesn't exist" for that user. Information hiding.

---

### JwtFilter.java

```java
@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {
    // OncePerRequestFilter: guaranteed to run exactly once per request
    // regardless of async dispatches, forwards, etc.

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain chain)
                                     throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        // No token? Just continue. Security config decides if endpoint needs auth.
        // This filter's job is only: if there's a token, validate it.
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);

        try {
            String email = jwtUtil.extractEmail(token);
            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                if (jwtUtil.isValid(token, userDetails)) {
                    // Set authentication in Spring Security context
                    UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        } catch (JwtException e) {
            // Invalid token. Don't throw. Just don't set authentication.
            // Downstream security config will reject the request if auth is required.
        }

        chain.doFilter(request, response);
    }
}
```

**Why catch JwtException silently?**
If the token is malformed, expired, or tampered — just don't authenticate.
Don't return 401 here. Let the filter chain continue.
Spring Security will see no authentication and return 401 if the endpoint requires it.
This keeps the filter single-responsibility: only validates tokens, doesn't enforce access.

---

### SecurityConfig.java

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())           // REST API — no CSRF needed
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))  // no sessions, JWT only
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()       // login/register — no token needed
                .requestMatchers("/api/share/**").permitAll()      // public share links — no token needed
                .requestMatchers("/actuator/health").permitAll()   // health check — no token needed
                .anyRequest().authenticated()                      // everything else needs JWT
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);   // cost factor 12. ~250ms per hash. brute force resistant.
        // Why 12 and not default 10? Slightly slower = much harder to brute force.
        // Why not 14? Above 12, login latency becomes noticeable for users.
    }
}
```

---

### GlobalExceptionHandler.java

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Every exception lands here. Controllers stay clean.

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404)
            .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors()
            .stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(400).body(ApiResponse.error(message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        // Log the full stack trace internally. Never expose it to the client.
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(500)
            .body(ApiResponse.error("Something went wrong"));
    }
}
```

---

### ApiResponse.java (standard response wrapper)

```java
@Data
@Builder
public class ApiResponse<T> {
    private T data;
    private String error;
    private LocalDateTime timestamp;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
            .data(data)
            .timestamp(LocalDateTime.now())
            .build();
    }

    public static ApiResponse<Void> error(String message) {
        return ApiResponse.<Void>builder()
            .error(message)
            .timestamp(LocalDateTime.now())
            .build();
    }
}
```

Every API response looks like:
```json
// Success
{ "data": { ... }, "timestamp": "2025-03-14T10:30:00" }

// Error
{ "error": "Place not found", "timestamp": "2025-03-14T10:30:00" }
```

Consistent structure means the frontend always knows what to expect.

---

## API Contract

```
AUTH
----
POST /api/auth/register
  Body:    { email, password, name }
  Returns: 201 { data: { token, user: { id, email, name } } }
  Errors:  400 if validation fails, 409 if email already exists

POST /api/auth/login
  Body:    { email, password }
  Returns: 200 { data: { token, user: { id, email, name } } }
  Errors:  401 if credentials wrong (never say which field was wrong)

POST /api/auth/logout
  Header:  Authorization: Bearer <token>
  Action:  Add token to Redis blacklist until its expiry
  Returns: 204 No Content


PLACES (all require JWT)
------------------------
POST /api/places
  Body:    { name, area, latitude, longitude, googlePlaceId?,
             mealType, context?, visitedOn, note?, rating? }
  Returns: 201 { data: PlaceResponse }
  Errors:  400 if name/mealType/visitedOn missing

GET /api/places
  Query:   ?mealType=DINNER&context=DATE&from=2025-01-01&to=2025-03-31
  Returns: 200 { data: [PlaceResponse] }
  Note:    All params optional. No params = return everything.

GET /api/places/{id}
  Returns: 200 { data: PlaceResponse }
  Errors:  404 if not found or doesn't belong to you

PATCH /api/places/{id}
  Body:    any subset of place fields (partial update)
  Returns: 200 { data: PlaceResponse }
  Errors:  404 if not found

DELETE /api/places/{id}
  Returns: 204 No Content
  Errors:  404 if not found


MAP
---
GET /api/map/places
  Header:  Authorization: Bearer <token>
  Returns: 200 { data: [{ id, name, lat, lng, mealType }] }
  Note:    Lightweight. Only places with coordinates. For map pins.


SHARE
-----
POST /api/share
  Header:  Authorization: Bearer <token>
  Returns: 201 { data: { token, shareUrl, expiresAt } }

GET /api/share/{token}
  No auth required (public endpoint)
  Rate limited: 30 requests/minute per IP
  Returns: 200 { data: { ownerName, places: [PlaceResponse] } }
  Errors:  404 if token invalid or expired
           429 if rate limit exceeded (+ Retry-After header)

DELETE /api/share/{token}
  Header:  Authorization: Bearer <token>
  Returns: 204 No Content
```

---

## Redis usage map

```
Key pattern                    Value              TTL       Purpose
-----------                    -----              ---       -------
places:{userId}                JSON array         5 min     Cached place list
places:{userId}:{filter}       JSON array         5 min     Cached filtered list
blacklist:token:{jti}          "1"                = JWT TTL  Logged-out tokens
ratelimit:share:{ip}           counter (int)      60 sec    Rate limit counter
```

**Why 5 minute TTL on places cache?**
If you add a place from one device, the other device sees it within 5 minutes max.
For a personal app, 5 minutes stale is completely fine.
On write (add/delete/update), the cache is explicitly evicted — so your own device is always fresh.

---

## Spring Bean lifecycle — what starts up when

Understanding this is understanding Spring Boot.

```
Application starts
       ↓
Spring scans all @Component, @Service, @Repository, @Controller classes
       ↓
Creates beans in dependency order
  → UserRepository (no dependencies)
  → PlaceRepository (no dependencies)
  → JwtUtil (no dependencies)
  → UserDetailsServiceImpl (depends on UserRepository)
  → JwtFilter (depends on JwtUtil + UserDetailsService)
  → AuthService (depends on UserRepository + JwtUtil + PasswordEncoder)
  → PlaceService (depends on PlaceRepository + UserRepository)
  → SecurityConfig (depends on JwtFilter)
       ↓
Registers JwtFilter in Security filter chain
       ↓
Starts Tomcat on port 8080
       ↓
Application ready — starts accepting requests
```

If a bean's dependency is missing → startup fails with NoSuchBeanDefinitionException.
This is Spring's way of failing fast. Better to crash on startup than to crash mid-request.

---

## Filter chain — the full picture for Meal Lens

```
Request arrives at Tomcat
         ↓
CorsFilter              ← allows frontend (localhost:3000) to call API
         ↓
JwtFilter               ← our code. validates token. sets SecurityContext.
         ↓
UsernamePasswordAuthenticationFilter  ← Spring Security default (effectively skipped)
         ↓
FilterSecurityInterceptor ← Spring Security: is this endpoint permitted?
                            If no auth and endpoint needs auth → 401
         ↓
DispatcherServlet
         ↓
HandlerMapping          ← finds which controller method matches the URL
         ↓
RateLimitAspect         ← AOP: checks @RateLimit annotation (Month 4)
         ↓
ArgumentResolver        ← populates @RequestBody, @PathVariable, @AuthenticationPrincipal
         ↓
Your Controller method
```

**The most important insight in this diagram:**
JwtFilter runs before Spring Security's access decision.
It doesn't decide if you're allowed in. It just says "I know who you are."
Spring Security then decides if who you are is allowed to be here.
Two separate responsibilities. Two separate steps.

---

## What you are NOT building and why

| Skipped | Why skipped | When you'd add it |
|---|---|---|
| Elasticsearch for search | You have ~500 records. SQL LIKE with an index is fast enough. Elasticsearch is for millions of records. | 100k+ records, need fuzzy search |
| Message queue (Kafka) | No async workflows needed. Adding a place is synchronous. No events to publish. | If you add email notifications, webhooks |
| Microservices | One developer. One deployment. Monolith is correct. | Multiple teams, need independent scaling |
| Kubernetes | One instance. Docker Compose is sufficient. | If you need auto-scaling, zero-downtime deploys |
| GraphQL | Your API shape is stable. REST is simpler, better tooling, better caching. | If frontend needs highly flexible queries |
| Photo upload (right now) | S3 integration is a separate concern. Design the field (photo_url) now, implement later. | When you actually want photos |

Knowing what you're not building, and why, is the senior answer.

---

## Build sequence — exact order

Do not skip steps. Each step builds on the last.

```
Step 1 — Project skeleton
  Create Spring Boot project (already done via CLI)
  Set up application.yml (DB, Redis, JWT config)
  Write docker-compose.yml (Postgres + Redis)
  Verify app starts and connects to DB

Step 2 — User entity + auth (no JWT yet)
  Create User entity + UserRepository
  Create AuthController + AuthService
  POST /api/auth/register → save user with BCrypt password
  POST /api/auth/login → validate password → return "ok" (no token yet)
  Test with curl. Verify password is hashed in DB.

Step 3 — JWT
  Write JwtUtil (generate + validate tokens)
  Write JwtFilter (OncePerRequestFilter)
  Wire into SecurityConfig
  Update /login to return real JWT token
  Test: hit protected endpoint without token → 401
  Test: hit protected endpoint with token → 200

Step 4 — Place CRUD
  Create Place entity + PlaceRepository
  Create PlaceController + PlaceService
  POST /api/places → save a place
  GET /api/places → get all your places
  DELETE /api/places/{id} → delete with ownership check
  Test all endpoints with JWT in Postman

Step 5 — Filtering
  Add PlaceFilter DTO
  Add filtered query methods to repository
  Wire filters to GET /api/places query params
  Test: filter by mealType, by context, by both

Step 6 — Map endpoint
  Create MapController
  Add custom JPQL query for map pins
  GET /api/map/places → lightweight pins
  Test: only returns places with coordinates

Step 7 — Redis caching
  Add Redis dependency + RedisConfig
  Add @Cacheable to getPlaces
  Add @CacheEvict to addPlace, deletePlace, updatePlace
  Test: add a place, verify cache is evicted, verify fresh data returns

Step 8 — Share links
  Create ShareLink entity + repository
  Create ShareService + ShareController
  POST /api/share → generate token
  GET /api/share/{token} → return places (public)
  Test: get share link, open in incognito, verify it works

Step 9 — Rate limiting (Month 4)
  Add @RateLimit annotation
  Add RateLimitAspect
  Write Redis Lua script
  Apply to GET /api/share/{token}
  Test: hammer the endpoint, verify 429 after limit

Step 10 — Polish
  Proper 429 response with Retry-After header
  Micrometer metrics
  Structured logging with correlation IDs
  Docker + docker-compose for full stack
  Write README with architecture explanation
```

---

## The Spring context mental model

When you're confused about why something isn't working in Spring,
run through this checklist in your head:

```
Is my class annotated?
  → @Component / @Service / @Repository / @Controller
  → Without annotation, Spring doesn't know the class exists

Is it in the component scan path?
  → Must be in com.meallens package or a sub-package
  → Classes outside the scan path are invisible

Is the dependency injected correctly?
  → Constructor injection (preferred), not new MyService()
  → If you use new, Spring doesn't manage it. No @Cacheable, no @Transactional.

Is @Transactional on the right method?
  → Must be on a Spring-managed bean (not new'd up manually)
  → Calling a @Transactional method from the same class bypasses the proxy

Is @Cacheable working?
  → Same rule — must be called from outside the class through Spring's proxy
  → Calling getPlaces() from inside PlaceService → cache is skipped

Is the filter running?
  → Check SecurityConfig. Is the filter registered?
  → Check filter order. Does it run before or after Spring Security?
```

---

## Final honest note

This design is:
- Right-sized for a personal app
- Extensible for the features you said you want later (photos, streaks, friends)
- A genuine learning vehicle for every Spring Boot concept in the plan
- Defensible line-by-line in any interview

It is not:
- Overengineered with patterns you don't need
- Under-engineered in ways that will bite you when you add features
- A tutorial app that teaches nothing real

Start with Step 1. Write docker-compose.yml and application.yml.
Get Postgres and Redis running locally.
Come back when the app connects to the DB.
