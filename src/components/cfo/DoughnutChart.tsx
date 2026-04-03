'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend)

interface DoughnutChartProps {
  items: Array<{ label: string; amount: number }>
  title?: string
}

const COLORS = ['#c97b84', '#1f1a18', '#4a7c59', '#d4914a', '#e8c5c9', '#7d6b5d', '#a3b18a']

export default function DoughnutChart({ items, title = 'Revenue mix' }: DoughnutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJS | null>(null)

  useEffect(() => {
    if (!canvasRef.current || items.length === 0) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    chartRef.current = new ChartJS(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          data: items.map(i => i.amount),
          backgroundColor: COLORS.slice(0, items.length),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11, family: 'Outfit' }, usePointStyle: true, pointStyleWidth: 8, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${Number(ctx.raw).toLocaleString('cs-CZ')} Kč`,
            },
          },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [items])

  return (
    <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
      <h3 className="font-serif text-base text-ink mb-4">{title}</h3>
      <div className="h-52">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
