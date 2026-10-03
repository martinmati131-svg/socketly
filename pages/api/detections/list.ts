import { MongoClient } from 'mongodb'
import type { NextApiRequest, NextApiResponse } from 'next'

type DetectionRecord = {
  _id: string
  imageUrl: string
  detectedObjects: string[]
  confidenceMax: number
  deviceId: string
  timestamp: Date
}

type MongoGlobal = typeof globalThis & {
  detectionListMongoClient?: MongoClient
  detectionListMongoPromise?: Promise<MongoClient>
}

const mongoUri = process.env.MONGODB_URI
const globalMongo = globalThis as MongoGlobal

if (!mongoUri) {
  throw new Error('MONGODB_URI is not configured')
}

const client = globalMongo.detectionListMongoClient ?? new MongoClient(mongoUri)
const clientPromise = globalMongo.detectionListMongoPromise ?? client.connect()
globalMongo.detectionListMongoClient = client
if (process.env.NODE_ENV !== 'production') globalMongo.detectionListMongoPromise = clientPromise

async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const database = await clientPromise
    const records = await database
      .db('aura_db')
      .collection<DetectionRecord>('detections')
      .find({}, { projection: { imageUrl: 1, detectedObjects: 1, confidenceMax: 1, deviceId: 1, timestamp: 1 } })
      .sort({ timestamp: -1 })
      .limit(24)
      .toArray()

    return response.status(200).json({ records })
  } catch (error) {
    console.error('Detection listing error:', error)
    return response.status(500).json({ error: 'Detections could not be loaded' })
  }
}

export const config = {
  api: {
    responseLimit: '2mb',
  },
}

export const runtime = 'nodejs'

export default handler
