'use client'

import { Check, Sparkles } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    eyebrow: 'Start exploring',
    price: '$0',
    description: 'Everything you need to connect your first edge device.',
    features: ['Community support', '1GB vector storage', '1 edge node', 'Standard inference queue'],
    cta: 'Get started free',
    featured: false,
  },
  {
    name: 'Pro Developer',
    eyebrow: 'For power developers',
    price: '$29',
    description: 'Advanced tooling for fine-tuning models and automating workflows.',
    features: ['Up to 10 edge nodes', 'Custom LoRA adapter fine-tuning', 'Autonomous agent execution loops', 'Priority inference queue', '10GB vector storage'],
    cta: 'Start pro trial',
    featured: true,
  },
]

export default function Page() {
  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="sticky top-4 z-50 mx-auto flex max-w-sm items-center justify-between border-b border-white/10 px-4 pb-6 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10 ring-1 ring-cyan-300/20">
              <span className="size-3 rounded-full bg-cyan-300 shadow-[0_0_18px_4px_rgba(103,232,249,0.45)]" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">AURA EDGE</p>
              <p className="text-xs text-slate-500">Edge intelligence, made simple</p>
            </div>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">Simple plans for every edge workflow</span>
        </header>

        <section className="flex flex-1 flex-col items-center py-16 sm:py-20">
          <div className="max-w-2xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-200">
              <Sparkles aria-hidden="true" data-icon="inline-start" />
              Choose your edge
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">Build without limits.</h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Connect devices, run intelligent workloads, and scale your edge operations with a plan that fits your workflow.</p>
          </div>

          <div className="mt-12 grid w-full max-w-4xl gap-5 lg:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.name} className={`relative flex flex-col rounded-3xl p-7 sm:p-9 ${plan.featured ? 'border-2 border-cyan-300/60 bg-cyan-300/[0.08] shadow-2xl shadow-cyan-950/30' : 'border border-white/10 bg-white/[0.035]'}`}>
                {plan.featured && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan-300 px-4 py-1 text-xs font-semibold text-slate-950">Most popular</div>}
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">{plan.eyebrow}</p>
                <h2 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h2>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">{plan.description}</p>
                <div className="mt-7 flex items-baseline gap-2 border-b border-white/10 pb-7">
                  <span className="text-5xl font-semibold tracking-tight text-white">{plan.price}</span>
                  <span className="text-sm text-slate-500">{plan.price === '$0' ? 'forever' : '/ month'}</span>
                </div>
                <ul className="mt-7 flex flex-col gap-4 text-sm text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check aria-hidden="true" data-icon="inline-start" className="mt-0.5 shrink-0 text-cyan-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" className={`mt-9 w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition ${plan.featured ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200' : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]'}`}>
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-slate-600">No credit card required for the free plan. Upgrade or cancel whenever you need.</p>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Secure infrastructure for intelligent edge workloads.</span>
          <span className="font-mono text-slate-600">AURA / SECURE CHANNEL</span>
        </footer>
      </div>
    </main>
  )
}
