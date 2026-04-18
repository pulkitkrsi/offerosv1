# OfferOS — AI Campaign Builder for ChargeZone

## Setup

### 1. MongoDB Atlas
1. Log into [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a project called "OfferOS" (or use existing)
3. Create a free M0 cluster
4. **Database Access** → Add user with read/write role
5. **Network Access** → Add `0.0.0.0/0` (allows Vercel's dynamic IPs)
6. **Connect** → Drivers → Copy connection string

### 2. Environment Variables
Set these in your Vercel project (Settings → Environment Variables):

```
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/offeros
JWT_SECRET=<random 64-char string>
BCRYPT_ROUNDS=12
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Seed Admin User
Run once after first deploy (or locally):
```bash
MONGODB_URI="your-connection-string" JWT_SECRET="your-secret" node scripts/seed-admin.js
```

This creates:
- Username: `admin`
- Password: `OfferOS@2024`
- **Change this password after first login!**

### 4. Deploy to Vercel
```bash
npm install
vercel --prod
```

Or connect your GitHub repo for auto-deploy on push.

## Project Structure
```
offeros-deploy/
├── api/
│   ├── auth/          Login, logout, register, session check
│   ├── campaigns/     Campaign CRUD
│   ├── offers/        Offer CRUD
│   ├── simulations/   Simulation persistence
│   ├── users/         User management (admin)
│   └── lib/           DB connection, JWT, bcrypt helpers
├── scripts/
│   └── seed-admin.js  First-time admin setup
├── src/
│   ├── App.jsx        Frontend application
│   └── main.jsx       React entry point
├── vercel.json        API route config
└── package.json
```

## MongoDB Collections
- **users** — Authenticated users (admin/editor roles)
- **campaigns** — Campaign containers with margin config
- **offers** — Full offer configurations (shared workspace)
- **simulations** — Saved simulation runs per offer

## Features
- JWT auth with httpOnly cookies (7-day expiry)
- Admin-only user creation
- Shared workspace — all users see all campaigns
- Debounced auto-save (2s after last change)
- Dark/light theme toggle (persisted in localStorage)
- 8-step offer wizard with simulation engine
- AI-powered campaign intelligence panel
