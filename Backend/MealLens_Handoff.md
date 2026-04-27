# Meal Lens — Project Handoff Document
### Everything another AI needs to know to continue guiding this project

---

## Who is building this

A fullstack developer (Java + React) learning Spring Boot in depth.
Not a beginner. Not a senior. Somewhere in between.
The goal is to deeply understand Spring Boot internals — not just make things work.
Every decision should be explained, not just handed over.

---

## What is Meal Lens

**One line:** A personal food diary — places I ate, when, with what context, a note, on a map.

**The product framing:** Hinge x Journal — for food.

**The real problem it solves:**
I move around a lot (PGs, new areas, no fixed spot). I discover good places to eat
but forget them. When someone asks "where should we go?" I blank out.
Meal Lens is a personal log of every place I've eaten at — with context, notes, and a map view.

**What it is NOT:**
- Not a social app (no feed, no followers)
- Not a review app (no public listings)
- Not Zomato/Yelp
- A personal tool, with one optional share link feature

---

## Core features

1. **Log a place** — name, area, coordinates, meal type, context, date, note, rating
2. **View my list** — cards UI (like Hinge), filterable by meal type + context
3. **Map view** — all saved places as pins, click pin to see the card
4. **Auth** — JWT login, it's my personal data
5. **Share link** — generate a read-only public URL to share my list with a friend
6. **Rate limit the share link** — public endpoint, must be protected

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.2, Java 21, Maven |
| Database | PostgreSQL 16 (Docker) |
| Cache / Rate limit state | Redis 7 (Docker) |
| Auth | JWT (Spring Security) |
| Frontend | React (responsive web, to be built later) |
| Map | Leaflet.js + OpenStreetMap (free, no API key) |
| Metrics | Micrometer + Spring Actuator |

---

## Current status

- Spring Boot project generated via CLI (start.spring.io)
- `docker-compose.yml` running Postgres on port 5433, Redis on port 6379
- `.env` file created with DB credentials
- `application.properties` configured
- App starts and connects to DB + Redis
- `curl http://localhost:8081/actuator/health` returns status UP with DB and Redis UP
- **No code written yet. Stack is running. Ready to write first file.**

---

## Project structure (planned)

```
com.meallens/
├── MealLensApplication.java
├── common/
│   ├── ApiResponse.java               ← standard { data, error, timestamp } wrapper
│   ├── GlobalExceptionHandler.java    ← @ControllerAdvice
│   ├── SecurityConfig.java
│   └── RedisConfig.java
├── auth/
│   ├── AuthController.java
│   ├── AuthService.java
│   ├── JwtFilter.java                 ← OncePerRequestFilter
│   ├── JwtUtil.java
│   ├── RegisterRequest.java
│   └── LoginRequest.java
├── user/
│   ├── User.java                      ← @Entity
│   └── UserRepository.java
├── place/
│   ├── Place.java                     ← @Entity
│   ├── MealType.java                  ← enum
│   ├── PlaceContext.java              ← enum
│   ├── PlaceController.java
│   ├── PlaceService.java
│   ├── PlaceRepository.java
│   ├── PlaceRequest.java
│   ├── PlaceResponse.java
│   └── PlaceFilter.java
├── map/
│   ├── MapController.java
│   └── MapPinResponse.java
├── share/
│   ├── ShareLink.java                 ← @Entity
│   ├── ShareController.java
│   ├── ShareService.java
│   └── ShareRepository.java
└── ratelimit/                         ← implement last
    └── .gitkeep
```

---

## Database schema

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE places (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    area            VARCHAR(255),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    google_place_id VARCHAR(255),
    meal_type       VARCHAR(20) NOT NULL,   -- BREAKFAST/BRUNCH/LUNCH/SNACK/DINNER/LATE_NIGHT/CAFE
    context         VARCHAR(20),            -- SOLO/WORK/DATE/FRIENDS/FAMILY
    visited_on      DATE NOT NULL,
    note            TEXT,
    rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE share_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(64) UNIQUE NOT NULL,
    expires_at  TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## API contract

```
POST   /api/auth/register          → 201 { token, user }
POST   /api/auth/login             → 200 { token, user }
POST   /api/auth/logout            → 204 (blacklist token in Redis)

GET    /api/places                 → 200 [ PlaceResponse ]  (JWT required)
GET    /api/places?mealType=DINNER&context=DATE  → filtered
POST   /api/places                 → 201 PlaceResponse      (JWT required)
PATCH  /api/places/{id}            → 200 PlaceResponse      (JWT required)
DELETE /api/places/{id}            → 204                    (JWT required)

GET    /api/map/places             → 200 [ { id, name, lat, lng, mealType } ]

POST   /api/share                  → 201 { token, shareUrl }  (JWT required)
GET    /api/share/{token}          → 200 { ownerName, places } (public, rate limited)
DELETE /api/share/{token}          → 204                       (JWT required)
```

---

## Build sequence — step by step

Work through these in exact order. Do not skip ahead.

```
DONE  ✅ Step 0 — Stack running (Postgres + Redis + Spring Boot)

NEXT  👉 Step 1 — User entity + register/login (no JWT yet)
         - User.java (@Entity)
         - UserRepository.java
         - AuthController + AuthService
         - POST /api/auth/register → save user, BCrypt password
         - POST /api/auth/login → validate password, return "ok" string
         - Test with curl. Verify password is hashed in DB.

      Step 2 — Add JWT
         - JwtUtil (generate + validate tokens)
         - JwtFilter (OncePerRequestFilter)
         - SecurityConfig
         - /login now returns real token
         - Test: hit any endpoint without token → 401
         - Test: hit with token → 200

      Step 3 — Place CRUD
         - Place.java entity (with coordinates + both enums)
         - PlaceRepository
         - PlaceController + PlaceService
         - POST /api/places, GET /api/places, DELETE /api/places/{id}
         - Ownership check on delete (404 if not yours)

      Step 4 — Filtering
         - PlaceFilter DTO
         - Filtered queries in repository
         - Wire to GET /api/places query params

      Step 5 — Map endpoint
         - MapController
         - Custom JPQL: only return id, name, lat, lng, mealType
         - GET /api/map/places

      Step 6 — Redis caching
         - RedisConfig
         - @Cacheable on getPlaces
         - @CacheEvict on add/delete/update

      Step 7 — Share links
         - ShareLink entity
         - ShareService + ShareController
         - POST /api/share, GET /api/share/{token}

      Step 8 — Rate limiting
         - @RateLimit annotation
         - RateLimitAspect (AOP)
         - Redis Lua script (atomic counter)
         - Apply to GET /api/share/{token}
         - 429 response with Retry-After header

      Step 9 — Polish
         - Micrometer metrics
         - Structured logging with correlation IDs
         - Proper 429/404/409 error responses
         - README with architecture explanation
```

---

## Key design decisions (with reasons)

**Monolith not microservices**
One developer, one service, ~500 records. Microservices solve team
and scaling problems that don't exist here.

**Feature-based packages not layer-based**
Everything related to Place lives in `place/`. Not split across
`controllers/`, `services/`, `repositories/`. Easier to navigate.

**Two ENUMs not one**
`meal_type` (WHEN: Dinner, Lunch) and `context` (WHO: Date, Work) are
different dimensions. Separate ENUMs allow independent filtering.

**PlaceResponse DTO separate from Place entity**
Decouples API contract from DB schema. Rename a DB column, API doesn't change.

**Return 404 not 403 on ownership failure**
Don't confirm a resource exists to someone who shouldn't access it.

**@Enumerated(EnumType.STRING) always**
Never ORDINAL. Reordering enum values with ORDINAL corrupts all DB records.

**UUID not Long for IDs**
UUIDs don't leak record counts. Safe to expose in URLs.

**Redis Lua script for rate limiting**
GET-check-SET is a race condition. Two simultaneous requests both pass.
Lua runs atomically on Redis server. No race condition.

---

## How the Spring request pipeline works (for context)

The developer is learning this. Always explain where things happen.

```
Request → Tomcat
        → Filter Chain (JwtFilter lives here)
        → DispatcherServlet
        → HandlerMapping (finds the right controller method)
        → Interceptors / AOP (RateLimitAspect lives here)
        → ArgumentResolvers (@RequestBody, @PathVariable populated)
        → Controller method runs
```

**Key insight:** Filters run before Spring Security decides access.
JwtFilter says "I know who you are." Spring Security says "you're allowed here."
Two separate steps.

---

## What the developer wants from an AI assistant

- **Explain why, not just what.** Every code decision should have a reason.
- **One step at a time.** Don't dump 10 files at once.
- **Be frank.** If something is wrong or over-engineered, say so.
- **Teach Spring internals.** This is a learning project. The goal is
  understanding, not just a working app.
- **Don't skip to the next step.** Wait for confirmation that the current
  step works before moving forward.

---

## application.properties (current)

```properties
spring.application.name=meallens
server.port=8081

spring.datasource.url=jdbc:postgresql://localhost:5433/${POSTGRES_DB:meallens}
spring.datasource.username=${POSTGRES_USER:meallens}
spring.datasource.password=${POSTGRES_PASSWORD:meallens}
spring.datasource.driver-class-name=org.postgresql.Driver

spring.jpa.hibernate.ddl-auto=update
spring.jpa.open-in-view=false

management.endpoints.web.exposure.include=health
management.endpoint.health.show-details=always
```

---

## Next immediate action

Write `User.java` — the first entity.
Then `UserRepository.java`.
Then `AuthController` and `AuthService` with register + login (no JWT yet).
Get a user saved to Postgres and verify the password is BCrypt hashed in the DB.
That is Step 1. Nothing else until that works.
