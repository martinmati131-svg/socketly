import { Client } from '@upstash/qstash'
import Statsig from 'statsig-node'
import type { NextApiRequest, NextApiResponse } from 'next'

type ThermalPayload = {
  deviceId?: unknown
  cpuTemp?: unknown
}

let statsigInitialization: Promise<unknown> | undefined

async function thermalAlertsEnabled(deviceId: string) {
  const secret = process.env.STATSIG_SERVER_SECRET
  if (!secret) return true

  statsigInitialization ??= Statsig.initialize(secret)
  await statsigInitialization

  return Statsig.checkGate({ userID: deviceId }, 'enable_thermal_alerts')
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = request.body as ThermalPayload
    const deviceId = typeof payload?.deviceId === 'string' && payload.deviceId.trim()
      ? payload.deviceId.trim().slice(0, 100)
      : 'rpi_5_edge'
    const cpuTemp = typeof payload?.cpuTemp === 'number' ? payload.cpuTemp : Number(payload?.cpuTemp)

    if (!Number.isFinite(cpuTemp)) {
      return response.status(400).json({ error: 'cpuTemp must be a number' })
    }

    if (cpuTemp <= 75 || !(await thermalAlertsEnabled(deviceId))) {
      return response.status(200).json({ status: 'OK', alertDispatched: false })
    }

    const token = process.env.QSTASH_TOKEN
    const destinationUrl = process.env.QSTASH_ALERT_DESTINATION_URL
      || `${process.env.NEXT_PUBLIC_APP_URL || 'https://powerdreams.top'}/api/jobs/send-alert`

    if (!token) {
      console.error('Thermal alert could not be queued: QSTASH_TOKEN is not configured')
      return response.status(503).json({ error: 'Alert queue is not configured' })
    }

    const qstash = new Client({ token })
    await qstash.publishJSON({
      url: destinationUrl,
      body: {
        deviceId,
        cpuTemp,
        alertType: 'CRITICAL_OVERHEAT',
        timestamp: new Date().toISOString(),
      },
    })

    console.warn(`[ALERT DISPATCHED] High temperature (${cpuTemp}°C) on ${deviceId}`)
    return response.status(200).json({ status: 'OK', alertDispatched: true })
  } catch (error) {
    console.error('Thermal alert pipeline error:', error)
    return response.status(500).json({ error: 'Thermal alert could not be processed' })
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
