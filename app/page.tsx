'use client'

import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'

type Telemetry = {
  device_id: string
  status: string
  cpu_temp: number
  uptime?: string
  signal?: number
  last_seen?: string
}

type Detection = {
  _id: string
  imageUrl: string
  detectedObjects: string[]
  confidenceMax: number
  deviceId: string
  timestamp: string
}

const initialTelemetry: Telemetry = {
  device_id: 'AURA-EDGE-01',
  status: 'Operational',
  cpu_temp: 42.8,
  uptime: '14d 06h 21m',
  signal: 98,
  last_seen: 'Live stream connected',
}

export default function Page() {
  const [telemetry, setTelemetry] = useState<Telemetry>(initialTelemetry)
  const [connected, setConnected] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])

  useEffect(() => {
    fetch('/api/detections/list')
      .then((response) => (response.ok ? response.json() : { records: [] }))
      .then((data: { records?: Detection[] }) => setDetections(data.records ?? []))
      .catch(() => setDetections([]))
  }, [])

  useEffect(() => {
    const socket = io({ path: '/api/socket' })

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('telemetry_stream', (data: Telemetry) => {
      setTelemetry((current) => ({ ...current, ...data }))
    })

    return () => socket.disconnect()
  }, [])

  const health = useMemo(() => {
    if (telemetry.cpu_temp < 60) return 'Healthy'
    if (telemetry.cpu_temp < 75) return 'Watch'
    return 'Critical'
  }, [telemetry.cpu_temp])

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10 ring-1 ring-cyan-300/20">
              <span className="size-3 rounded-full bg-cyan-300 shadow-[0_0_18px_4px_rgba(103,232,249,0.45)]" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">AURA EDGE</p>
              <p className="text-xs text-slate-500">System telemetry</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className={`size-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {connected ? 'Live stream' : 'Connecting'}
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-cyan-300">Edge operations / 01</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Telemetry overview</h1>
            <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">Monitor the health and connectivity of your edge device in real time.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-6 shadow-2xl shadow-cyan-950/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Device status</p>
                  <h2 className="mt-4 text-2xl font-medium text-white">{telemetry.device_id}</h2>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-300">{telemetry.status}</span>
              </div>
              <div className="mt-12 flex items-end justify-between">
                <div>
                  <p className="text-5xl font-semibold tracking-tight text-white">{health}</p>
                  <p className="mt-2 text-sm text-slate-400">All systems within normal range</p>
                </div>
                <div className="flex items-end gap-1" aria-label="Health indicator">
                  {[35, 50, 65, 80, 95].map((height, index) => <span key={height} className="w-1.5 rounded-full bg-cyan-300/70" style={{ height }} />)}
                </div>
              </div>
            </article>

            <Metric label="CPU temperature" value={`${telemetry.cpu_temp.toFixed(1)}°`} detail="Celsius" tone="text-amber-300" />
            <Metric label="Signal strength" value={`${telemetry.signal ?? 98}%`} detail="Connection quality" tone="text-emerald-300" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoRow label="Uptime" value={telemetry.uptime ?? '—'} />
            <InfoRow label="Stream status" value={telemetry.last_seen ?? 'Awaiting signal'} />
          </div>

          <section className="mt-12" aria-labelledby="detections-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-cyan-300">Computer vision / archive</p>
                <h2 id="detections-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white">Recent detections</h2>
              </div>
              <span className="text-xs text-slate-500">{detections.length} records</span>
            </div>

            {detections.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {detections.map((detection) => (
                  <article key={detection._id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                    <img src={detection.imageUrl} alt={`Detection from ${detection.deviceId}`} className="aspect-[4/3] w-full object-cover" />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-white">{detection.detectedObjects.join(', ') || 'No objects labeled'}</p>
                        <span className="shrink-0 text-xs text-cyan-300">{(detection.confidenceMax * 100).toFixed(1)}%</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{detection.deviceId}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-slate-500">No detections have been recorded yet.</div>
            )}
          </section>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Telemetry updates automatically from the edge stream.</span>
          <span className="font-mono text-slate-600">AURA / SECURE CHANNEL</span>
        </footer>
      </div>
    </main>
  )
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"><p className="text-xs uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-6 text-4xl font-semibold tracking-tight ${tone}`}>{value}</p><p className="mt-2 text-sm text-slate-500">{detail}</p></article>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-5 py-4"><span className="text-sm text-slate-500">{label}</span><span className="text-sm font-medium text-slate-200">{value}</span></div>
}
