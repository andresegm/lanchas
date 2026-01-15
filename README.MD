## Project Summary — Day Boat Marketplace (Lechería)

### What this app is
- A lightweight marketplace that connects people who own boats in Lechería with locals and tourists looking for same-day or scheduled day trips to nearby islands.
- Think:
  - Uber’s supply-side flexibility
  - Airbnb’s marketplace model
  - Applied to day boat trips, not traditional charters
- The platform does not operate boats. It enables independent captains/boat owners to list availability, set prices, and accept bookings.

### What this app accomplishes
- Turns idle boats into income
- Removes WhatsApp chaos and trust issues
- Standardizes booking, pricing, and payments
- Makes boating accessible to tourists and locals
- Scales supply without owning assets

### Core product principles
- **Marketplace, not operator**
- **Boat owners set prices**
- **Platform only earns when trips happen**
- **Minimal friction**
- **Trust > features**

### Users & Roles
- **User**: Any person using the platform
  - Can be: Guest (passenger), Captain (boat owner / skipper), Both
- **Captain**: Independent operator
  - Owns or operates one or more boats
  - Responsible for: Licensing, Insurance, Safety, Vessel condition

### Required Features (V1 – must have)
- **Authentication**
  - Email + password
  - JWT-based auth
  - No social login initially
- **Captain / Boat onboarding**
  - Create captain profile
  - Add boat(s)
  - Set: Max passengers, Pricing model, Minimum hours
  - Upload license & insurance (file reference only)
- **Pricing**
  - Each boat supports:
    - Private pricing (flat per hour)
    - Per-person pricing
    - Minimum trip duration
  - Captain-controlled prices
  - Platform does not dynamically price
- **Trips (Bookings)**
  - Users can: Request a trip, Join an existing per-person trip
  - Captains can: Accept / reject requests
  - Trip lifecycle: requested → accepted → active → completed / canceled
- **Payments**
  - Guests pay through platform
  - Platform: Holds payment, Takes commission (15–20%), Pays captain manually (early stage)
- **Reviews**
  - Guests review captains
  - Captains review guests
  - Ratings affect visibility (later)
- **Incidents / Issues**
  - Report mechanical issues, weather cancellations, emergencies
  - Used for: Refund logic, Trust & reliability scoring

### What is intentionally NOT included (V1)
- Live GPS tracking
- In-app chat (use WhatsApp)
- Calendar availability
- Promotions / coupons
- Advanced analytics
- Platform insurance

### ORM / Domain Model (high level)
- **Core entities**
  - User
  - Captain (1–1 with User)
  - Boat
  - BoatPricing
  - Trip
  - TripParticipant
  - Payment
  - Review
  - Incident
- **Design goals**
  - Postgres-first
  - Clear ownership
  - Immutable pricing snapshots
  - No recalculation of historical data

### Tech Stack (lightweight by design)
- **Backend**
  - Node.js + TypeScript
  - Fastify (minimal HTTP framework)
  - Prisma (ORM + migrations)
  - PostgreSQL
  - Why: Small surface area, Type safety, Fast iteration, Easy scaling
- **Frontend**
  - Next.js (App Router)
  - Server-first rendering
  - Minimal client state
  - Forms + fetch
  - No Redux
  - No heavy UI libraries
- **Styling**
  - CSS Modules
  - No Tailwind
  - No component frameworks
- **Auth**
  - Custom email/password
  - JWT (access + refresh)
  - Stored refresh tokens
- **Payments**
  - Stripe
  - Platform as merchant of record (initially)
- **Hosting**
  - Railway or Fly.io
  - Managed Postgres
  - Single service deployment (monolith)

### Non-goals (important)
- This is not a charter company
- This is not a logistics platform
- This is not a super-app
- It is: A thin, trusted layer between people with boats and people who want to use them.

### Architecture philosophy
- Monolith
- One database
- Clear boundaries
- No premature abstractions
- Add complexity only after revenue

### Success criteria (early)
- 5–10 active captains
- 50–100 completed trips
- Zero catastrophic trust failures
- Captains say: “This is worth it”

### Cursor coding guidance
- Prefer clarity over cleverness
- Avoid unnecessary libraries
- No decorators, no magic
- Keep files small
- Strong typing everywhere
- Fail loudly, not silently