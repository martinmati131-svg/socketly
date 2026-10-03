import { MongoClient, type InsertManyResult } from 'mongodb'
import type { NextApiRequest, NextApiResponse } from 'next'

type OfflineDetection = {
  imageUrl?: unknown
  detectedObjects?: unknown
  confidenceMax?: unknown
  deviceId?: unknown
  timestamp?: unknown
  [key: string]: unknown
}

type SyncResponse =
  | { success: true; insertedCount: number }
  | { error: string }

type MongoGlobal = typeof globalThis & {
  offlineSyncMongoClient?: MongoClient
  offlineSyncMongoPromise?: Promise<MongoClient>
}

const mongoUri = process.env.MONGODB_URI
if (!mongoUri) {
  throw new Error('MONGODB_URI is not configured')
}

const globalMongo = globalThis as MongoGlobal
const client = globalMongo.offlineSyncMongoClient ?? new MongoClient(mongoUri)
const clientPromise = globalMongo.offlineSyncMongoPromise ?? client.connect()
globalMongo.offlineSyncMongoClient = client
if (process.env.NODE_ENV !== 'production') {
  globalMongo.offlineSyncMongoPromise = clientPromise
}

function isRecord(value: unknown): value is OfflineDetection {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeRecord(item: OfflineDetection) {
  const record = { ...item }

  if (typeof record.deviceId !== 'string' || !record.deviceId.trim()) {
    record.deviceId = 'rpi_5_edge'
  } else {
    record.deviceId = record.deviceId.trim().slice(0, 100)
  }

  if (typeof record.imageUrl !== 'string' || !record.imageUrl.trim()) {
    return null
  }

  if (!Array.isArray(record.detectedObjects)) {
    record.detectedObjects = []
  }

  if (typeof record.confidenceMax !== 'number' || !Number.isFinite(record.confidenceMax)) {
    record.confidenceMax = 0
  }

  const timestamp = record.timestamp ? new Date(String(record.timestamp)) : new Date()
  record.timestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
  record.syncedAt = new Date()
  record.offlineCreated = true

  return record
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SyncResponse>,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const { logs } = request.body as { logs?: unknown }
  if (!Array.isArray(logs) || logs.length === 0) {
    return response.status(400).json({ error: 'A non-empty logs array is required' })
  }

  if (logs.length > 100) {
    return response.status(413).json({ error: 'A maximum of 100 logs can be synced at once' })
  }

  const records = logs
    .filter(isRecord)
    .map(normalizeRecord)
    .filter((record): record is NonNullable<ReturnType<typeof normalizeRecord>> => record !== null)

  if (records.length !== logs.length) {
    return response.status(400).json({ error: 'Each log must include a valid imageUrl' })
  }

  try {
    const database = await clientPromise
    const result: InsertManyResult<OfflineDetection> = await database
      .db('aura_db')
      .collection<OfflineDetection>('detections')
      .insertMany(records)

    return response.status(200).json({ success: true, insertedCount: result.insertedCount })
  } catch (error) {
    console.error('Offline detection sync error:', error)
    return response.status(500).json({ error: 'Offline detections could not be synced' })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
