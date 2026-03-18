# EstatesNearMe v2

A full-stack community platform for discovering and posting local estate sales. Built with **React**, **Express**, **AWS DynamoDB**, **AWS Cognito**, protected by **API Gateway** and **WAF**.

---

## 🏗 Architecture

```
Browser
  │
  ▼
CloudFront (HTTPS, WAF OWASP rules, security headers)
  ├── /          → S3  (React SPA, private via OAC)
  └── /api/*     → API Gateway HTTP API
                       │
                       ├── JWT Authorizer (Cognito) — validates tokens on protected routes
                       ├── WAF (OWASP Core, SQLi, Bad Inputs, IP rate limit)
                       └── ALB → EC2 (Express + Node.js)
                                      │
                                      ├── DynamoDB  (Users + Sales tables)
                                      ├── S3        (Image uploads)
                                      └── Cognito   (User Pool — auth source of truth)
```

### Security Layers

| Layer | Control |
|-------|---------|
| **CloudFront WAF** | OWASP Core Rule Set, IP rate limiting (2000 req/5 min) |
| **API Gateway WAF** | OWASP Core, SQLi, Bad Inputs, IP rate limiting (1000 req/5 min) |
| **API Gateway JWT Authorizer** | Validates Cognito tokens on all write/protected routes |
| **Express helmet** | CSP, HSTS, X-Frame-Options, XSS protection headers |
| **Express rate limiter** | Per-IP: 100 req/15 min (API), 10 req/15 min (auth), 10/hr (upload) |
| **EC2 Security Group** | Inbound 5000 only from ALB security group — never direct internet |
| **DynamoDB** | Encryption at rest (AWS managed key), Point-in-Time Recovery enabled |
| **S3 Frontend** | Private bucket — only accessible via CloudFront OAC |
| **IAM EC2 Role** | Least privilege: only specific DynamoDB actions on specific tables |
| **Cognito** | Email verification, MFA support (TOTP), token revocation on logout |

---

## 🗂 Project Structure

```
estatesnearm/
├── frontend/                     # React 18 SPA
│   └── src/
│       ├── components/           # Header, Footer, MapView, SaleCard
│       ├── context/AuthContext.js # Cognito token management + refresh
│       ├── pages/                # All route pages
│       └── utils/api.js          # Axios + JWT injection
│
├── backend/                      # Express API
│   ├── lib/dynamodb.js           # DynamoDB Document Client
│   ├── models/
│   │   ├── User.js               # DynamoDB user CRUD + bcrypt (dev)
│   │   └── EstateSale.js         # DynamoDB sales CRUD + geo distance
│   ├── middleware/
│   │   ├── auth.js               # Cognito JWKS verifier (prod) / local JWT (dev)
│   │   └── rateLimiter.js        # express-rate-limit presets
│   ├── routes/
│   │   ├── auth.js               # Cognito SignUp/SignIn/Refresh/Logout + /me
│   │   ├── sales.js              # Estate sale CRUD (DynamoDB)
│   │   └── upload.js             # S3 image upload
│   └── server.js                 # Helmet, CORS, rate limiter, routes
│
└── infrastructure/
    ├── cloudformation.yml        # Full AWS stack
    ├── deploy.sh                 # CI/CD deployment script
    └── setup-dynamodb.sh         # Create DynamoDB tables locally or in AWS
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- AWS CLI configured (`aws configure`)
- Google Maps API key (Maps JS + Geocoding + Places APIs enabled)

### 1. Install dependencies

```bash
cd frontend && npm install && cd ..
cd backend  && npm install && cd ..
```

### 2. Create DynamoDB tables

**Option A — Real AWS (simplest):**
```bash
./infrastructure/setup-dynamodb.sh
```

**Option B — DynamoDB Local (fully offline):**
```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
DYNAMODB_LOCAL=true ./infrastructure/setup-dynamodb.sh
```

### 3. Configure environment variables

**`backend/.env`** (copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
AWS_REGION=us-east-1
DYNAMODB_USERS_TABLE=enm-users-development
DYNAMODB_SALES_TABLE=enm-sales-development

# Dev auth (no Cognito required)
COGNITO_DISABLED=true
JWT_SECRET=change_me_to_a_32_char_random_secret

# S3 uploads (or leave blank to skip image upload in dev)
S3_BUCKET_NAME=your-dev-bucket-name

# DynamoDB Local only:
# DYNAMODB_ENDPOINT=http://localhost:8000
```

**`frontend/.env`**:
```env
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```

---

## 🔐 Auth Flow

### Development (`COGNITO_DISABLED=true`)
```
Register → bcrypt hash stored in DynamoDB → local HS256 JWT returned
Login    → bcrypt verify → local HS256 JWT returned
```

### Production (Cognito)
```
Register → Cognito SignUp → Email verification code sent
Confirm  → Cognito ConfirmSignUp → DynamoDB profile created
Login    → Cognito USER_PASSWORD_AUTH → Cognito IdToken + RefreshToken returned
API call → Bearer IdToken → API Gateway JWT Authorizer validates against Cognito JWKS
         → Express verifies same token via jwks-rsa
Logout   → Cognito GlobalSignOut (revokes all tokens for that user)
Refresh  → Cognito REFRESH_TOKEN_AUTH → New IdToken issued
```

---

## ☁️ AWS Deployment

### Prerequisites
- AWS CLI configured with admin permissions
- EC2 Key Pair created in the target region
- `AdminEmail` for CloudWatch alarm notifications

### Deploy

```bash
export JWT_SECRET="your_32_char_secret_for_dev_staging"
export KEY_PAIR_NAME="your-ec2-keypair"
export ADMIN_EMAIL="you@example.com"
export REACT_APP_GOOGLE_MAPS_API_KEY="your_maps_key"

chmod +x infrastructure/deploy.sh
./infrastructure/deploy.sh production us-east-1
```

**What `deploy.sh` does:**
1. Deploys/updates the CloudFormation stack (all AWS resources)
2. Reads outputs (bucket names, Cognito IDs, etc.)
3. Builds the React app with the correct Cognito config injected
4. Syncs the build to S3 with proper cache headers
5. Invalidates CloudFront

### After stack creation — deploy your backend code to EC2

```bash
# SSH in (or use SSM Session Manager — no SSH key needed)
aws ssm start-session --target <instance-id> --region us-east-1

# On the EC2 instance:
cd /var/app/estatesnearm
git clone https://github.com/YOUR_ORG/estatesnearm.git .
cd backend
npm install --production
pm2 start server.js --name enm-backend --env production
pm2 startup systemd -u ec2-user && pm2 save
```

---

## 📡 API Reference

All endpoints are accessed via `https://your-cloudfront-url/api/...`

### Auth (public)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Sign up (Cognito or local dev) |
| POST | `/api/auth/confirm` | Verify Cognito email code |
| POST | `/api/auth/login` | Sign in → returns JWT |
| POST | `/api/auth/refresh` | Refresh Cognito token |
| POST | `/api/auth/logout` | Global sign out |
| GET | `/api/auth/me` | 🔒 Get current user profile |

### Estate Sales
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sales` | Public | List active sales (`?lat&lng&radius&limit`) |
| GET | `/api/sales/:id` | Public | Get single sale |
| GET | `/api/sales/user/my-sales` | 🔒 JWT | Current user's sales |
| POST | `/api/sales` | 🔒 JWT | Create sale |
| PUT | `/api/sales/:id` | 🔒 JWT | Update sale (owner only) |
| DELETE | `/api/sales/:id` | 🔒 JWT | Delete sale (owner only) |

### Upload
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/upload/image` | 🔒 JWT | Upload sale image → returns S3 URL |

---

## 🗄 DynamoDB Schema

### `enm-users` table
| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String | PK |
| `email` | String | GSI: email-index |
| `cognitoSub` | String | GSI: cognitoSub-index |
| `name` | String | — |
| `passwordHash` | String | Dev only |
| `createdAt` | ISO8601 | — |

### `enm-sales` table
| Attribute | Type | Key |
|-----------|------|-----|
| `saleId` | String | PK |
| `userId` | String | GSI: userId-index (HASH) |
| `createdAt` | ISO8601 | GSI: userId-index (RANGE) |
| `status` | String | GSI: status-endDate-index (HASH) |
| `endDate` | ISO8601 | GSI: status-endDate-index (RANGE) |
| `title`, `description` | String | — |
| `lat`, `lng`, `geohash` | Number/String | Geo filtering |
| `address` | Map | `{street, city, state, zip, full}` |
| `imageUrl`, `tags`, etc. | Various | — |

> **Geo queries:** DynamoDB doesn't support native geo queries. The app uses a scan + Haversine distance filter in JavaScript. For large scale, replace with Amazon OpenSearch Service with a geo_distance query.

---

## 🎨 Design System

| Token | Color | Usage |
|-------|-------|-------|
| `--forest` | `#636B2F` | CTAs, links, active states |
| `--sage` | `#BAC095` | Secondary UI, borders |
| `--lime` | `#D4DE95` | Accents, dark-bg text |
| `--dark` | `#3D4127` | Dark backgrounds, headings |
| `--cream` | `#F5F3EC` | Page backgrounds |

**Fonts:** Playfair Display (headings) + DM Sans (body)

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, @react-google-maps/api |
| Backend | Node.js 20, Express 4, helmet, morgan |
| Database | AWS DynamoDB (on-demand, PITR, encrypted at rest) |
| Auth | AWS Cognito User Pool (prod) / bcrypt+JWT (dev) |
| Image Storage | AWS S3 with IAM instance role |
| API Security | AWS API Gateway HTTP API + JWT Authorizer + WAF |
| CDN | AWS CloudFront + OAC + WAF + Security Headers Policy |
| Infra | CloudFormation (VPC, EC2, ALB, DynamoDB, Cognito, WAF, SNS) |

---

## 📄 License
MIT © EstatesNearMe

---

## 🌐 Custom Domain — findingestates.com (v3)

The CloudFormation template automatically provisions everything needed to serve the app at `findingestates.com`:

### What gets created

| Resource | Role |
|----------|------|
| **ACM Certificate** | Covers `findingestates.com`, `www.findingestates.com`, `api.findingestates.com` — DNS-validated automatically via Route 53 |
| **Amplify Hosting** | Serves the React SPA at `findingestates.com` and `www.findingestates.com`. Auto-deploys on every push to `main` |
| **API Gateway Custom Domain** | `api.findingestates.com` → API Gateway → ALB → EC2 (Express) |
| **Route 53 A record** | `findingestates.com` → Amplify (ALIAS) |
| **Route 53 CNAME** | `www.findingestates.com` → Amplify |
| **Route 53 A record** | `api.findingestates.com` → API Gateway regional endpoint (ALIAS) |

### Architecture after v3

```
findingestates.com       → Amplify Hosting (React SPA, CDN, SSL)
www.findingestates.com   → Amplify Hosting (redirects to apex)
api.findingestates.com   → API Gateway → WAF → ALB → EC2 (Express + DynamoDB)
```

### Deploy prerequisites

Before running `deploy.sh` you need:

1. **Route 53 Hosted Zone ID** for `findingestates.com`
   - Open [Route 53 console](https://console.aws.amazon.com/route53/v2/hostedzones)
   - Click on `findingestates.com` — the Zone ID is in the top-right panel (e.g. `Z1D633PJN98FT9`)

2. **GitHub Personal Access Token** with `repo` scope
   - Create at https://github.com/settings/tokens
   - Amplify uses it to pull your source code on each build

### Deploy

```bash
export JWT_SECRET="your_32_char_minimum_secret_here"
export ADMIN_EMAIL="you@example.com"
export KEY_PAIR_NAME="your-ec2-keypair"
export ROUTE53_HOSTED_ZONE_ID="Z1D633PJN98FT9"    # your actual zone ID
export GITHUB_REPO_URL="https://github.com/YOUR_ORG/estatesnearm"
export AMPLIFY_GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
export REACT_APP_GOOGLE_MAPS_API_KEY="your_maps_key"

./infrastructure/deploy.sh production us-east-1
```

### What Amplify does automatically

- **Builds** the React app using `amplify.yml` in the repo root
- **Injects** environment variables (API URL, Cognito IDs, Maps key) at build time
- **Deploys** to its global CDN with SSL
- **Auto-deploys** on every `git push` to `main`
- **Preview deploys** on every pull request (at a unique Amplify URL)
- **Redirects** `www` → apex and handles SPA client-side routing

### Timing notes

- **ACM certificate** validation is automatic via Route 53 DNS but takes **5–10 minutes** on first stack creation
- **Amplify first build** takes ~3 minutes
- **DNS propagation** for `findingestates.com` takes **up to 60 minutes** globally after Amplify confirms the domain
