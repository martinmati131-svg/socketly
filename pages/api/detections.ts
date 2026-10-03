import { put } from '@vercel/blob'
import { MongoClient } from 'mongodb'
import type { NextApiRequest, NextApiResponse } from 'next'

type DetectionMetadata = {
  objects?: unknown[]
  maxConfidence?: number
  deviceId?: string
}

type DetectionRecord = {
  imageUrl: string
  detectedObjects: unknown[]
  confidenceMax: number
  deviceId: string
  timestamp: Date
}

type MongoGlobal = typeof globalThis & {
  detectionMongoClient?: MongoClient
  detectionMongoPromise?: Promise<MongoClient>
}

const mongoUri = process.env.MONGODB_URI
const globalMongo = globalThis as MongoGlobal

if (!mongoUri) {
  throw new Error('MONGODB_URI is not configured')
}

const client = globalMongo.detectionMongoClient ?? new MongoClient(mongoUri)
const clientPromise = globalMongo.detectionMongoPromise ?? client.connect()
globalMongo.detectionMongoClient = client
if (process.env.NODE_ENV !== 'production') globalMongo.detectionMongoPromise = clientPromise

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.type.startsWith('image/')
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const formData = await request.formData()
    const imageFile = formData.get('file')
    const metadataValue = formData.get('metadata')

    if (!isImageFile(imageFile)) {
      return response.status(400).json({ error: 'An image file is required' })
    }

    let metadata: DetectionMetadata = {}
    if (typeof metadataValue === 'string' && metadataValue.trim()) {
      const parsed = JSON.parse(metadataValue) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return response.status(400).json({ error: 'Metadata must be a JSON object' })
      }
      metadata = parsed as DetectionMetadata
    }

    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const blob = await put(`detections/${Date.now()}-${safeName}`, imageFile, {
      access: 'public',
      addRandomSuffix: true,
    })

    const record: DetectionRecord = {
      imageUrl: blob.url,
      detectedObjects: Array.isArray(metadata.objects) ? metadata.objects : [],
      confidenceMax: typeof metadata.maxConfidence === 'number' && Number.isFinite(metadata.maxConfidence) ? metadata.maxConfidence : 0,
      deviceId: typeof metadata.deviceId === 'string' && metadata.deviceId.trim() ? metadata.deviceId.trim().slice(0, 100) : 'rpi_5_edge',
      timestamp: new Date(),
    }

    const database = await clientPromise
    const result = await database.db('aura_db').collection<DetectionRecord>('detections').insertOne(record)

    return response.status(201).json({ success: true, url: blob.url, id: result.insertedId })
  } catch (error) {
    console.error('Detection pipeline error:', error)
    return response.status(500).json({ error: 'Detection could not be stored' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
