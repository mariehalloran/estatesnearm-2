# EstatesNearMe v2

A full-stack community platform for discovering and posting local estate sales. Built with **React**, **Express**, **AWS DynamoDB**, **AWS Cognito**, **AWS Lambda**, **API Gateway**, and **WAF**.

---

## 🏗 Architecture

```
Browser
  │
   ├── findingestates.com      → Amplify Hosting (React SPA, CDN, SSL)
   └── api.findingestates.com  → API Gateway HTTP API
                                                    │
                                                    ├── JWT Authorizer (Cognito) — validates protected routes
                                                    ├── WAF (OWASP Core, SQLi, Bad Inputs, IP rate limit)
                                                    └── Lambda (Express via `serverless-http`)
                                                               │
                                                               ├── DynamoDB  (Users + Sales tables)
                                                               ├── S3        (Image uploads)
                                                               └── Cognito   (User Pool — auth source of truth)
```

### Security Layers

| Layer | Control |
|-------|---------|
| **API Gateway WAF** | OWASP Core, SQLi, Bad Inputs, IP rate limiting (1000 req/5 min) |
| **API Gateway JWT Authorizer** | Validates Cognito tokens on all write/protected routes |
| **API Gateway stage throttling** | Burst limit 200, steady rate 100 req/sec at the gateway |
| **Express helmet** | CSP, HSTS, X-Frame-Options, XSS protection headers |
| **Express rate limiter** | Per-IP: 100 req/15 min (API), 10 req/15 min (auth), 10/hr (upload) |
| **Lambda IAM role** | Least privilege access to specific DynamoDB tables, S3 upload bucket, Cognito, and SSM |
| **DynamoDB** | Encryption at rest (AWS managed key), Point-in-Time Recovery enabled |
| **Amplify Hosting** | Managed HTTPS hosting, branch deploys, and domain mapping for the SPA |
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
│   ├── lambda.js                 # Lambda entrypoint wrapping Express with serverless-http
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
   ├── deploy.js                 # npm-driven deployment entrypoint
   ├── deploy.sh                 # Backward-compatible wrapper around npm deploy
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
- Route 53 hosted zone for `findingestates.com`
- GitHub PAT classic (`ghp_*`) with `repo` and `admin:repo_hook` scopes for Amplify
- `AdminEmail` for CloudWatch alarm notifications

### Deployment environment files

Deployment config now lives in root-level environment files:

- `.env.production` → used by `npm run deploy:production`
- `.env.development` → used by `npm run deploy:development`

`.env.development` defaults to `DEPLOY_ENVIRONMENT=staging`, so the development deploy command updates the staging stack unless you change that value.

Example variables in those files:

```env
DEPLOY_ENVIRONMENT=production
AWS_REGION=us-east-1
ROOT_DOMAIN=findingestates.com
JWT_SECRET=replace_with_a_32_character_minimum_secret
ADMIN_EMAIL=you@example.com
LAMBDA_CODE_S3_BUCKET=your-artifacts-bucket
LAMBDA_CODE_S3_KEY=backend/lambda-production.zip
ROUTE53_HOSTED_ZONE_ID=Z1D633PJN98FT9
GITHUB_REPO_URL=https://github.com/YOUR_ORG/estatesnearm
GITHUB_BRANCH=main
AMPLIFY_GITHUB_TOKEN=ghp_replace_me
REACT_APP_GOOGLE_MAPS_API_KEY=your_maps_key
```

Optional (reuse existing Amplify app and skip creating Amplify resources):

```env
USE_EXISTING_AMPLIFY_APP=true
EXISTING_AMPLIFY_APP_ID=d123example
EXISTING_AMPLIFY_DEFAULT_DOMAIN=main.d123example.amplifyapp.com
```

When `USE_EXISTING_AMPLIFY_APP=true`, deployment skips creating/updating Amplify app/branch/domain and Route 53 apex/www records managed by Amplify in this stack.

Optional (keep creating Amplify resources, but skip Route 53 apex/www records if they already exist):

```env
MANAGE_AMPLIFY_ROUTE53_RECORDS=false
```

Use this when you get Route 53 errors like "record already exists" for `www` or apex.
The deploy script also auto-detects existing apex/www records and disables Amplify DNS record creation for that run.

Note: apex ALIAS creation to an Amplify default domain is disabled by default in CloudFormation to avoid alias target zone validation errors. Keep apex DNS managed manually (or by existing records) unless you explicitly enable template parameter `CreateApexAmplifyAlias=true`.

If `LAMBDA_CODE_S3_BUCKET` is blank or left as `your-artifacts-bucket`, the deploy command auto-creates a private artifact bucket in your AWS account and uses that instead.

### Deploy

```bash
npm run deploy:production

# or deploy the staging stack using values from .env.development
npm run deploy:development
```

**What the deploy command does:**
1. Loads deployment variables from `.env.production` or `.env.development`
2. Runs `npm install --omit=dev` in `backend/` and packages the Express API as a Lambda zip
3. Uploads that zip to `s3://$LAMBDA_CODE_S3_BUCKET/$LAMBDA_CODE_S3_KEY`
4. Deploys/updates the CloudFormation stack (Lambda, API Gateway, WAF, Cognito, DynamoDB, Amplify, Route 53)
5. Reads stack outputs (frontend URL, API URL, Cognito IDs, Lambda name, uploads bucket)
6. Triggers an Amplify build for the configured branch

### Redeploy after backend changes

```bash
# Re-run the npm deploy command. It will rebuild the Lambda zip,
# upload it to S3, and update the Lambda-backed API stack.
npm run deploy:production
```

### Optional: override the Lambda artifact key

```bash
LAMBDA_CODE_S3_KEY=backend/lambda-hotfix.zip npm run deploy:production
```

The default key is `backend/lambda-<environment>.zip`.

### Optional: override the AWS region

```bash
npm run deploy -- production us-east-1
```

### Post-deploy checks

```bash
# Stack outputs
aws cloudformation describe-stacks \
   --stack-name estatesnearm-production \
   --region us-east-1

# Lambda logs
aws logs tail /aws/lambda/enm-api-production --follow --region us-east-1
```

---

## 📡 API Reference

All endpoints are accessed via `https://api.findingestates.com/api/...`

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
| Image Storage | AWS S3 with IAM Lambda role |
| API Security | AWS API Gateway HTTP API + JWT Authorizer + WAF |
| Frontend Hosting | AWS Amplify Hosting |
| Infra | CloudFormation (Lambda, API Gateway, Amplify, DynamoDB, Cognito, WAF, Route 53, SNS) |

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
| **API Gateway Custom Domain** | `api.findingestates.com` → API Gateway → Lambda (Express) |
| **Route 53 A record** | `findingestates.com` → Amplify (ALIAS) |
| **Route 53 CNAME** | `www.findingestates.com` → Amplify |
| **Route 53 A record** | `api.findingestates.com` → API Gateway regional endpoint (ALIAS) |

### Architecture after v3

```
findingestates.com       → Amplify Hosting (React SPA, CDN, SSL)
www.findingestates.com   → Amplify Hosting (redirects to apex)
api.findingestates.com   → API Gateway → WAF → Lambda (Express + DynamoDB)
```

### Deploy prerequisites

Before running `npm run deploy:production` you need:

1. **Route 53 Hosted Zone ID** for `findingestates.com`
   - Open [Route 53 console](https://console.aws.amazon.com/route53/v2/hostedzones)
   - Click on `findingestates.com` — the Zone ID is in the top-right panel (e.g. `Z1D633PJN98FT9`)

2. **GitHub PAT classic** (`ghp_*`) with `repo` and `admin:repo_hook` scopes
   - Create at https://github.com/settings/tokens
   - Fine-grained tokens (`github_pat_*`) may fail with webhook 403 errors during Amplify app setup
   - If your repo is in an org with SSO, authorize the token for that org
   - Amplify uses it to pull your source code and manage repository webhooks

### Deploy

```bash
npm run deploy:production
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
- **CloudFormation first run** can take **10–15 minutes** because certificate issuance and domain mapping happen in the same workflow
- **Amplify first build** takes ~3 minutes
- **DNS propagation** for `findingestates.com` takes **up to 60 minutes** globally after Amplify confirms the domain

### What the npm deploy command does for the API

- **Packages** `backend/` into a Lambda zip from the repo root
- **Creates** the Lambda artifact bucket automatically if you leave the default placeholder or omit the bucket name
- **Uploads** the artifact to your S3 deployment bucket
- **Updates** the Lambda function code through CloudFormation
- **Prints** the Lambda function name, API URL, Cognito IDs, and uploads bucket after deploy
