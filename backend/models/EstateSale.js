/**
 * EstateSale data layer — DynamoDB
 *
 * Table: enm-sales
 *   PK:  saleId       (String) — UUID
 *   GSI: userId-index on userId+createdAt  — "my sales"
 *   GSI: status-index on status+endDate    — active sale queries
 *
 * Geo queries: DynamoDB doesn't support native geo queries.
 * We store lat/lng and do bounding-box pre-filter via a GSI on
 * geohash prefix (4-char = ~40km cell), then distance-filter in app.
 * For production scale, consider ElasticSearch/OpenSearch.
 */

const { dynamo, TABLES } = require('../lib/dynamodb');
const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE = TABLES.SALES;

// Simple geohash encoder (base32, 4 chars ≈ ±20km)
function encodeGeohash(lat, lng, precision = 4) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '', bits = 0, bitsTotal = 0, hashValue = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { hashValue = (hashValue << 1) + 1; minLng = mid; }
      else { hashValue = hashValue << 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { hashValue = (hashValue << 1) + 1; minLat = mid; }
      else { hashValue = hashValue << 1; maxLat = mid; }
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[hashValue];
      bits = 0; hashValue = 0;
    }
  }
  return hash;
}

// Haversine distance in miles
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SaleModel = {
  encodeGeohash,

  async create(data) {
    const saleId = uuidv4();
    const now = new Date().toISOString();
    const { lat, lng } = data;
    const geohash = encodeGeohash(lat, lng, 4);
    const item = {
      saleId,
      userId: data.userId,
      postedByName: data.postedByName,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl || null,
      address: data.address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      geohash,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime,
      endTime: data.endTime,
      tags: data.tags || [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
    return item;
  },

  async getById(saleId) {
    const res = await dynamo.send(new GetCommand({
      TableName: TABLE,
      Key: { saleId },
    }));
    return res.Item || null;
  },

  async update(saleId, fields) {
    const now = new Date().toISOString();
    const allowed = ['title', 'description', 'imageUrl', 'address', 'lat', 'lng',
      'startDate', 'endDate', 'startTime', 'endTime', 'tags'];
    const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!updates.length) return null;

    const expr = 'SET ' + updates.map(([k]) => `#${k} = :${k}`).join(', ') + ', updatedAt = :now';
    const names = Object.fromEntries(updates.map(([k]) => [`#${k}`, k]));
    const values = Object.fromEntries(updates.map(([k, v]) => [`:${k}`, v]));
    values[':now'] = now;

    const res = await dynamo.send(new UpdateCommand({
      TableName: TABLE,
      Key: { saleId },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return res.Attributes;
  },

  async delete(saleId) {
    await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { saleId } }));
  },

  // Get all sales by a user via GSI
  async getByUserId(userId) {
    const res = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false,
    }));
    return res.Items || [];
  },

  /**
   * Get active sales near a location.
   * Strategy: Scan with endDate filter, then distance-filter in JS.
   * For production scale, replace with OpenSearch geo query.
   */
  async getActiveSalesNear({ lat, lng, radiusMiles = 50, limit = 20, lastKey = null }) {
    const now = new Date().toISOString();
    const params = {
      TableName: TABLE,
      FilterExpression: 'endDate >= :now AND #st = :active',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':now': now, ':active': 'active' },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    };

    let allItems = [];
    let lastEvaluatedKey = null;

    // Paginate scan until we have enough results or table is exhausted
    do {
      if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;
      const res = await dynamo.send(new ScanCommand(params));
      const items = (res.Items || []).filter((item) => {
        if (lat == null || lng == null) return true;
        return distanceMiles(lat, lng, item.lat, item.lng) <= radiusMiles;
      });
      allItems = allItems.concat(items);
      lastEvaluatedKey = res.LastEvaluatedKey;
    } while (lastEvaluatedKey && allItems.length < limit * 3);

    // Sort by startDate ascending
    allItems.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    return {
      sales: allItems.slice(0, limit),
      total: allItems.length,
      lastKey: lastEvaluatedKey || null,
    };
  },

  distanceMiles,
};

module.exports = SaleModel;
