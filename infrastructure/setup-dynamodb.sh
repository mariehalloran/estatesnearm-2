#!/bin/bash
# ============================================================
# EstatesNearMe - Create DynamoDB tables for local development
#
# Prerequisites:
#   - AWS CLI configured (any region, any credentials)
#   - Either:
#     a) Real AWS account (tables created in us-east-1), OR
#     b) DynamoDB Local running: docker run -p 8000:8000 amazon/dynamodb-local
#
# Usage:
#   ./setup-dynamodb.sh              # Real AWS
#   DYNAMODB_LOCAL=true ./setup-dynamodb.sh  # DynamoDB Local
# ============================================================

set -euo pipefail

if [[ "${DYNAMODB_LOCAL:-false}" == "true" ]]; then
  ENDPOINT="--endpoint-url http://localhost:8000"
  REGION="us-east-1"
  echo "Using DynamoDB Local at http://localhost:8000"
else
  ENDPOINT=""
  REGION="${AWS_REGION:-us-east-1}"
  echo "Using real AWS DynamoDB in region $REGION"
fi

ENV="${NODE_ENV:-development}"
USERS_TABLE="enm-users-${ENV}"
SALES_TABLE="enm-sales-${ENV}"

echo ""
echo "Creating table: $USERS_TABLE"
aws dynamodb create-table $ENDPOINT \
  --region "$REGION" \
  --table-name "$USERS_TABLE" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=email,AttributeType=S \
    AttributeName=cognitoSub,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "email-index",
        "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"}
      },
      {
        "IndexName": "cognitoSub-index",
        "KeySchema": [{"AttributeName": "cognitoSub", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"}
      }
    ]' \
  2>/dev/null && echo "  ✓ $USERS_TABLE created" || echo "  ℹ  $USERS_TABLE already exists"

echo ""
echo "Creating table: $SALES_TABLE"
aws dynamodb create-table $ENDPOINT \
  --region "$REGION" \
  --table-name "$SALES_TABLE" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=saleId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=endDate,AttributeType=S \
  --key-schema \
    AttributeName=saleId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "userId-index",
        "KeySchema": [
          {"AttributeName": "userId", "KeyType": "HASH"},
          {"AttributeName": "createdAt", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      },
      {
        "IndexName": "status-endDate-index",
        "KeySchema": [
          {"AttributeName": "status", "KeyType": "HASH"},
          {"AttributeName": "endDate", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    ]' \
  2>/dev/null && echo "  ✓ $SALES_TABLE created" || echo "  ℹ  $SALES_TABLE already exists"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  DynamoDB tables ready!"
echo ""
echo "  Users table: $USERS_TABLE"
echo "  Sales table: $SALES_TABLE"
echo ""
echo "  Add to backend/.env:"
echo "  DYNAMODB_USERS_TABLE=$USERS_TABLE"
echo "  DYNAMODB_SALES_TABLE=$SALES_TABLE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
