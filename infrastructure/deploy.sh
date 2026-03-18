#!/bin/bash
# ============================================================
# EstatesNearMe v3 — Deployment Script
#
# What this does:
#   1. Deploys/updates CloudFormation (DynamoDB, Cognito, API GW,
#      WAF, Amplify app, ACM cert, Route 53 DNS, Lambda, S3)
#   2. Triggers an Amplify build for the frontend
#   3. Prints all relevant URLs
#
# Required env vars:
#   JWT_SECRET                   min 32 chars
#   ADMIN_EMAIL                  for CloudWatch alarms
#   LAMBDA_CODE_S3_BUCKET        bucket for backend Lambda zip artifact
#   ROUTE53_HOSTED_ZONE_ID       from Route 53 console (e.g. Z1D633PJN98FT9)
#   GITHUB_REPO_URL              https://github.com/org/repo
#   AMPLIFY_GITHUB_TOKEN         GitHub PAT with repo scope
#
# Optional:
#   REACT_APP_GOOGLE_MAPS_API_KEY
#   GITHUB_BRANCH                (default: main)
#   LAMBDA_CODE_S3_KEY           (default: backend/lambda-<env>.zip)
# ============================================================

set -euo pipefail

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
STACK_NAME="estatesnearm-${ENVIRONMENT}"
ROOT_DOMAIN="findingestates.com"

# ── Validation ────────────────────────────────────────────────────────────────
log()  { echo ""; echo "▶  $1"; }
ok()   { echo "   ✓  $1"; }
err()  { echo "   ✗  $1" >&2; exit 1; }

[[ -z "${JWT_SECRET:-}"               ]] && err "JWT_SECRET env var required (min 32 chars)"
[[ -z "${ADMIN_EMAIL:-}"              ]] && err "ADMIN_EMAIL env var required"
[[ -z "${LAMBDA_CODE_S3_BUCKET:-}"    ]] && err "LAMBDA_CODE_S3_BUCKET env var required"
[[ -z "${ROUTE53_HOSTED_ZONE_ID:-}"   ]] && err "ROUTE53_HOSTED_ZONE_ID env var required"
[[ -z "${GITHUB_REPO_URL:-}"          ]] && err "GITHUB_REPO_URL env var required"
[[ -z "${AMPLIFY_GITHUB_TOKEN:-}"     ]] && err "AMPLIFY_GITHUB_TOKEN env var required"
[[ ${#JWT_SECRET} -lt 32              ]] && err "JWT_SECRET must be at least 32 characters"

BRANCH="${GITHUB_BRANCH:-main}"
LAMBDA_CODE_S3_KEY="${LAMBDA_CODE_S3_KEY:-backend/lambda-${ENVIRONMENT}.zip}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EstatesNearMe v3 — Deployment"
echo "  Environment  : $ENVIRONMENT"
echo "  Region       : $REGION"
echo "  Stack        : $STACK_NAME"
echo "  Domain       : $ROOT_DOMAIN"
echo "  Branch       : $BRANCH"
echo "  Lambda ZIP   : s3://${LAMBDA_CODE_S3_BUCKET}/${LAMBDA_CODE_S3_KEY}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 0. Build + upload backend Lambda artifact ───────────────────────────────
log "Packaging backend for Lambda..."

TMP_ZIP=$(mktemp /tmp/enm-lambda-XXXXXX.zip)
pushd backend >/dev/null
npm ci --omit=dev
zip -qr "$TMP_ZIP" .
popd >/dev/null

aws s3 cp "$TMP_ZIP" "s3://${LAMBDA_CODE_S3_BUCKET}/${LAMBDA_CODE_S3_KEY}" --region "$REGION"
rm -f "$TMP_ZIP"

ok "Lambda artifact uploaded."

# ── 1. Deploy CloudFormation ──────────────────────────────────────────────────
log "Deploying CloudFormation stack..."
log "  NOTE: ACM certificate validation via DNS is automatic (Route 53 integration)."
log "  This step can take 10–15 minutes on first run while the cert is issued."

aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    LambdaCodeS3Bucket="$LAMBDA_CODE_S3_BUCKET" \
    LambdaCodeS3Key="$LAMBDA_CODE_S3_KEY" \
    JwtSecret="$JWT_SECRET" \
    GoogleMapsApiKey="${REACT_APP_GOOGLE_MAPS_API_KEY:-}" \
    AdminEmail="$ADMIN_EMAIL" \
    RootDomain="$ROOT_DOMAIN" \
    Route53HostedZoneId="$ROUTE53_HOSTED_ZONE_ID" \
    GitHubRepoUrl="$GITHUB_REPO_URL" \
    GitHubBranch="$BRANCH" \
    AmplifyGitHubToken="$AMPLIFY_GITHUB_TOKEN" \
  --no-fail-on-empty-changeset

ok "CloudFormation deployed."

# ── 2. Read stack outputs ─────────────────────────────────────────────────────
log "Reading stack outputs..."

get_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text 2>/dev/null || echo ""
}

AMPLIFY_APP_ID=$(get_output AmplifyAppId)
AMPLIFY_DEFAULT_DOMAIN=$(get_output AmplifyDefaultDomain)
FRONTEND_URL=$(get_output FrontendURL)
API_URL=$(get_output APIURL)
COGNITO_POOL=$(get_output CognitoUserPoolId)
COGNITO_CLIENT=$(get_output CognitoClientId)
LAMBDA_NAME=$(get_output BackendLambdaName)
UPLOADS_BUCKET=$(get_output UploadsBucketName)
CERT_ARN=$(get_output CertificateArn)

ok "Amplify App ID:    $AMPLIFY_APP_ID"
ok "Frontend URL:      $FRONTEND_URL"
ok "API URL:           $API_URL"
ok "Cognito Pool:      $COGNITO_POOL"
ok "Lambda Function:   $LAMBDA_NAME"

# ── 3. Trigger Amplify build ──────────────────────────────────────────────────
log "Triggering Amplify build for branch: $BRANCH ..."

if [[ -n "$AMPLIFY_APP_ID" ]]; then
  JOB_ID=$(aws amplify start-job \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$BRANCH" \
    --job-type RELEASE \
    --region "$REGION" \
    --query 'jobSummary.jobId' \
    --output text)
  ok "Amplify build started — Job ID: $JOB_ID"
  ok "Monitor at: https://${REGION}.console.aws.amazon.com/amplify/home#/${AMPLIFY_APP_ID}/${BRANCH}/${JOB_ID}"
else
  echo "   ⚠  Could not determine Amplify App ID — trigger build manually in the console."
fi

# ── 4. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  Deployment triggered!"
echo ""
echo "  🌐  Frontend (Amplify):   $FRONTEND_URL"
echo "  🔌  API Gateway:          $API_URL"
echo "  🧠  Cognito Pool:         $COGNITO_POOL"
echo "  λ   Backend Lambda:       $LAMBDA_NAME"
echo "  📦  Uploads Bucket:       $UPLOADS_BUCKET"
echo "  📜  ACM Certificate:      $CERT_ARN"
echo ""
echo "  ⏳  DNS propagation for findingestates.com may take"
echo "      up to 60 minutes after Amplify build completes."
echo ""
echo "  📋  Next steps:"
echo "  1. Watch the Amplify build in the AWS Console"
echo "  2. Verify Lambda logs in CloudWatch:"
echo "       /aws/lambda/$LAMBDA_NAME"
echo "  3. Re-run this script after backend changes to publish a new Lambda zip"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
