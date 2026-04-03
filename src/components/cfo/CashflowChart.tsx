'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, BarController, LineController, Tooltip, Legend, Filler)

interface CashflowMonth {
  label: string
  revenue: number
  costs: number
  ebitda: number
  cumulative: number
}

interface CashflowChartProps {
  months: CashflowMonth[]
  title?: string
}

export default function CashflowChart({ months, title = 'Cashflow — projekce' }: CashflowChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJS | null>(null)

  useEffect(() => {
    if (!canvasRef.current || months.length === 0) return

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    chartRef.current = new ChartJS(canvasRef.current, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          {
            type: 'bar',
            label: 'EBITDA',
            data: months.map(m => m.ebitda),
            backgroundColor: months.map(m => m.ebitda >= 0 ? '#c97b84' : '#e8c5c9'),
            borderRadius: 4,
            barPercentage: 0.6,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Kumulativní CF',
            data: months.map(m => m.cumulative),
            borderColor: '#1f1a18',
            backgroundColor: 'rgba(31,26,24,0.05)',
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#1f1a18',
            tension: 0.3,
            fill: true,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, family: 'Outfit' }, usePointStyle: true, pointStyleWidth: 8, padding: 16 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('cs-CZ')} Kč`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Outfit' } } },
          y: {
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { size: 10, family: 'Outfit' },
              callback: (v) => Number(v).toLocaleString('cs-CZ'),
            },
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: {
              font: { size: 10, family: 'Outfit' },
              callback: (v) => Number(v).toLocaleString('cs-CZ'),
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
  }, [months])

  return (
    <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
      <h3 className="font-serif text-base text-ink mb-4">{title}</h3>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
