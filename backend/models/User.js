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
  UpdateCommand,
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
      ConditionExpression: 'attribute_not_exists(userId)',
    }));
    return item;
  },

  async update(userId, attributes) {
    const updates = [];
    const names = {};
    const values = {};

    if (attributes.name !== undefined) {
      updates.push('#name = :name');
      names['#name'] = 'name';
      values[':name'] = attributes.name.trim();
    }

    if (attributes.email !== undefined) {
      updates.push('email = :email');
      values[':email'] = attributes.email.toLowerCase().trim();
    }

    if (attributes.cognitoSub !== undefined) {
      updates.push('cognitoSub = :cognitoSub');
      values[':cognitoSub'] = attributes.cognitoSub;
    }

    if (updates.length === 0) {
      return this.getById(userId);
    }

    const result = await dynamo.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));

    return result.Attributes || null;
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

  async upsertCognitoProfile({ name, email, cognitoSub }) {
    const existingBySub = await this.getByCognitoSub(cognitoSub);
    if (existingBySub) {
      return this.update(existingBySub.userId, { name, email, cognitoSub });
    }

    const existingByEmail = await this.getByEmail(email);
    if (existingByEmail) {
      return this.update(existingByEmail.userId, { name, email, cognitoSub });
    }

    return this.create({ name, email, cognitoSub });
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
