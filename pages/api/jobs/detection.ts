import { Receiver } from '@upstash/qstash'
import type { NextApiRequest, NextApiResponse } from 'next'

type DetectionJobPayload = {
  id?: string
  [key: string]: unknown
}

function readRawBody(request: NextApiRequest) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) {
    return response.status(503).json({ error: 'Background job verification is not configured' })
  }

  const signature = request.headers['upstash-signature']
  const signatureValue = Array.isArray(signature) ? signature[0] : signature
  if (!signatureValue) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = await readRawBody(request)
    const receiver = new Receiver({ currentSigningKey, nextSigningKey })
    const isValid = await receiver.verify({ body, signature: signatureValue })

    if (!isValid) {
      return response.status(401).json({ error: 'Unauthorized' })
    }

    const payload = JSON.parse(body) as DetectionJobPayload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return response.status(400).json({ error: 'Invalid job payload' })
    }

    console.log('Processing background job for detection:', payload.id ?? 'unknown')
    return response.status(200).json({ success: true })
  } catch (error) {
    console.error('Detection background job error:', error)
    return response.status(400).json({ error: 'Invalid signed job payload' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
