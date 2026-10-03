import { Receiver } from '@upstash/qstash'
import type { NextApiRequest, NextApiResponse } from 'next'

type AlertPayload = {
  deviceId?: unknown
  cpuTemp?: unknown
  alertType?: unknown
}

function isValidPayload(payload: AlertPayload): payload is Required<Pick<AlertPayload, 'deviceId' | 'cpuTemp' | 'alertType'>> {
  return (
    typeof payload.deviceId === 'string' &&
    payload.deviceId.length > 0 &&
    typeof payload.cpuTemp === 'number' &&
    Number.isFinite(payload.cpuTemp) &&
    typeof payload.alertType === 'string' &&
    payload.alertType.length > 0
  )
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) {
    console.error('Alert worker is missing QStash signing keys')
    return response.status(503).json({ error: 'Alert worker is not configured' })
  }

  const signature = request.headers['upstash-signature']
  const signatureValue = Array.isArray(signature) ? signature[0] : signature
  if (!signatureValue) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const receiver = new Receiver({ currentSigningKey, nextSigningKey })
    const isValid = await receiver.verify({ body, signature: signatureValue })

    if (!isValid) {
      return response.status(401).json({ error: 'Unauthorized' })
    }

    const payload = JSON.parse(body) as AlertPayload
    if (!isValidPayload(payload)) {
      return response.status(400).json({ error: 'Invalid alert payload' })
    }

    console.error(
      `[CRITICAL_OVERHEAT] ${payload.alertType}: ${payload.deviceId} CPU temperature is at ${payload.cpuTemp}°C`,
    )

    return response.status(200).json({ success: true, processed: true })
  } catch (error) {
    console.error('Alert worker error:', error)
    return response.status(400).json({ error: 'Invalid alert request' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
