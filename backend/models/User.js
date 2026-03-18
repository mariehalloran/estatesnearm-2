/**
 * User data layer — DynamoDB
 *
 * Table: enm-users
 *   PK: userId       (String)  — UUID or Cognito sub
 *   GSI: email-index on email  — for login lookup
 *   GSI: cognitoSub-index      — for Cognito token validation
 *
 * In production: Cognito manages auth; this table stores profile metadata.
 * In dev (COGNITO_DISABLED=true): bcrypt passwords stored here for convenience.
 */

const { dynamo, TABLES } = require('../lib/dynamodb');
const {
  PutCommand,
  GetCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const TABLE = TABLES.USERS;

const UserModel = {
  async create({ name, email, passwordHash, cognitoSub }) {
    const userId = cognitoSub || uuidv4();
    const now = new Date().toISOString();
    const item = {
      userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      ...(passwordHash ? { passwordHash } : {}),
      ...(cognitoSub ? { cognitoSub } : {}),
      createdAt: now,
    };
    await dynamo.send(new PutCommand({
      TableName: TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(email)',
    }));
    return item;
  },

  async getById(userId) {
    const res = await dynamo.send(new GetCommand({
      TableName: TABLE,
      Key: { userId },
    }));
    return res.Item || null;
  },

  async getByEmail(email) {
    const res = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email.toLowerCase().trim() },
      Limit: 1,
    }));
    return res.Items?.[0] || null;
  },

  async getByCognitoSub(cognitoSub) {
    const res = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'cognitoSub-index',
      KeyConditionExpression: 'cognitoSub = :sub',
      ExpressionAttributeValues: { ':sub': cognitoSub },
      Limit: 1,
    }));
    return res.Items?.[0] || null;
  },

  async hashPassword(plain) {
    return bcrypt.hash(plain, 12);
  },

  async verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },

  sanitize(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  },
};

module.exports = UserModel;
