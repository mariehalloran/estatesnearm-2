const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const isLocal = process.env.NODE_ENV !== 'production';

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // In local dev you can point to DynamoDB Local (docker) or just use real AWS with IAM keys
  ...(isLocal && process.env.DYNAMODB_ENDPOINT
    ? { endpoint: process.env.DYNAMODB_ENDPOINT }
    : {}),
});

const dynamo = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// Table name helpers — env vars override for staging/prod isolation
const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'enm-users',
  SALES: process.env.DYNAMODB_SALES_TABLE || 'enm-sales',
};

module.exports = { dynamo, TABLES };
