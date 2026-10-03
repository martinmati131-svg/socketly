import { put } from '@vercel/blob'
import { MongoClient } from 'mongodb'
import Statsig from 'statsig-node'
import formidable, { type Fields, type Files, type File as FormidableFile } from 'formidable'
import { readFile } from 'node:fs/promises'
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

let statsigInitialization: Promise<unknown> | undefined

async function uploadGateEnabled(userId: string) {
  const secret = process.env.STATSIG_SERVER_SECRET
  if (!secret) return true

  statsigInitialization ??= Statsig.initialize(secret)
  await statsigInitialization

  return Statsig.checkGate({ userID: userId }, 'protect_uploads')
}

if (!mongoUri) {
  throw new Error('MONGODB_URI is not configured')
}

const client = globalMongo.detectionMongoClient ?? new MongoClient(mongoUri)
const clientPromise = globalMongo.detectionMongoPromise ?? client.connect()
globalMongo.detectionMongoClient = client
if (process.env.NODE_ENV !== 'production') globalMongo.detectionMongoPromise = clientPromise

function firstField(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function firstFile(value: FormidableFile | FormidableFile[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseMultipart(request: NextApiRequest) {
  const form = formidable({
    maxFileSize: 10 * 1024 * 1024,
    multiples: false,
  })

  return new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
    form.parse(request, (error, fields, files) => {
      if (error) reject(error)
      else resolve({ fields, files })
    })
  })
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { fields, files } = await parseMultipart(request)
    const imageFile = firstFile(files.file)
    const metadataValue = firstField(fields.metadata)

    if (!imageFile || imageFile.size <= 0 || !imageFile.mimetype?.startsWith('image/')) {
      return response.status(400).json({ error: 'An image file is required' })
    }

    let metadata: DetectionMetadata = {}
    if (metadataValue?.trim()) {
      const parsed = JSON.parse(metadataValue) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return response.status(400).json({ error: 'Metadata must be a JSON object' })
      }
      metadata = parsed as DetectionMetadata
    }

    const deviceId = typeof metadata.deviceId === 'string' && metadata.deviceId.trim()
      ? metadata.deviceId.trim().slice(0, 100)
      : 'rpi_5_edge'

    if (!(await uploadGateEnabled(deviceId))) {
      return response.status(403).json({ error: 'Uploads are currently disabled' })
    }

    const safeName = imageFile.originalFilename?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'detection.jpg'
    const image = new File([await readFile(imageFile.filepath)], safeName, {
      type: imageFile.mimetype || 'image/jpeg',
    })
    const blob = await put(`detections/${Date.now()}-${safeName}`, image, {
      access: 'public',
      addRandomSuffix: true,
    })

    const record: DetectionRecord = {
      imageUrl: blob.url,
      detectedObjects: Array.isArray(metadata.objects) ? metadata.objects : [],
      confidenceMax: typeof metadata.maxConfidence === 'number' && Number.isFinite(metadata.maxConfidence) ? metadata.maxConfidence : 0,
      deviceId,
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
