'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip, Legend)

interface MonthData {
  month: string
  expected_income: number
  actual_income: number
  expected_expense: number
  actual_expense: number
}

interface ActualVsPlanChartProps {
  months: MonthData[]
  title?: string
}

export default function ActualVsPlanChart({ months, title = 'Plán vs Skutečnost' }: ActualVsPlanChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJS | null>(null)

  useEffect(() => {
    if (!canvasRef.current || months.length === 0) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    chartRef.current = new ChartJS(canvasRef.current, {
      type: 'bar',
      data: {
        labels: months.map(m => m.month),
        datasets: [
          {
            label: 'Plánované příjmy',
            data: months.map(m => m.expected_income),
            backgroundColor: 'rgba(74, 124, 89, 0.3)',
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.5,
          },
          {
            label: 'Skutečné příjmy',
            data: months.map(m => m.actual_income),
            backgroundColor: '#4a7c59',
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.5,
          },
          {
            label: 'Plánované výdaje',
            data: months.map(m => -m.expected_expense),
            backgroundColor: 'rgba(201, 123, 132, 0.3)',
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.5,
          },
          {
            label: 'Skutečné výdaje',
            data: months.map(m => -m.actual_expense),
            backgroundColor: '#c97b84',
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.5,
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
            labels: { font: { size: 10, family: 'Outfit' }, usePointStyle: true, pointStyleWidth: 8, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${Math.abs(Number(ctx.raw)).toLocaleString('cs-CZ')} Kč`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Outfit' } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { size: 10, family: 'Outfit' },
              callback: (v) => Math.abs(Number(v)).toLocaleString('cs-CZ'),
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
