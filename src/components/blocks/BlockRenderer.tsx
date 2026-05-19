'use client'

import type { Block } from './types'

import HeadingBlock from './HeadingBlock'
import TextBlock from './TextBlock'
import KpiBlock from './KpiBlock'
import KpiGridBlock from './KpiGridBlock'
import ProgressBlock from './ProgressBlock'
import RiskListBlock from './RiskListBlock'
import StepListBlock from './StepListBlock'
import TableBlock from './TableBlock'
import StrengthsWeaknessesBlock from './StrengthsWeaknessesBlock'
import CashflowChartBlock from './CashflowChartBlock'
import CalloutBlock from './CalloutBlock'
import YoyComparisonBlock from './YoyComparisonBlock'

/**
 * Block grid renderuje pole `Block[]` do 12-sloupcoveho gridu.
 * Kazdy block muze mit `span` (1..12), default = 12 (full row).
 *
 * Pouziti:
 *   <BlockRenderer blocks={report.data.blocks} />
 */

function spanToColClass(span: number | undefined): string {
  switch (span) {
    case 1:  return 'col-span-12 sm:col-span-1'
    case 2:  return 'col-span-12 sm:col-span-6 lg:col-span-2'
    case 3:  return 'col-span-12 sm:col-span-6 lg:col-span-3'
    case 4:  return 'col-span-12 sm:col-span-6 lg:col-span-4'
    case 6:  return 'col-span-12 lg:col-span-6'
    case 8:  return 'col-span-12 lg:col-span-8'
    case 12: return 'col-span-12'
    default: return 'col-span-12'
  }
}

function renderBlock(block: Block, index: number) {
  const key = block.id || `${block.type}-${index}`
  switch (block.type) {
    case 'heading':              return <HeadingBlock {...block} key={key} />
    case 'text':                 return <TextBlock {...block} key={key} />
    case 'kpi':                  return <KpiBlock {...block} key={key} />
    case 'kpi-grid':             return <KpiGridBlock {...block} key={key} />
    case 'progress':             return <ProgressBlock {...block} key={key} />
    case 'risk-list':            return <RiskListBlock {...block} key={key} />
    case 'step-list':            return <StepListBlock {...block} key={key} />
    case 'table':                return <TableBlock {...block} key={key} />
    case 'strengths-weaknesses': return <StrengthsWeaknessesBlock {...block} key={key} />
    case 'cashflow-chart':       return <CashflowChartBlock {...block} key={key} />
    case 'callout':              return <CalloutBlock {...block} key={key} />
    case 'yoy-comparison':       return <YoyComparisonBlock {...block} key={key} />
    default: {
      // Exhaustiveness check: pokud pridas novy typ do union ale neimplementujes
      // ho zde, TS sem prirakne chybu, ze block ma typ never.
      const _exhaustive: never = block
      return (
        <div key={`unknown-${index}`} className="col-span-12 rounded-[14px] border border-dashed border-rose-pale bg-rose-blush/20 p-4 text-sm text-rose-deep">
          Neznámý block: <code>{JSON.stringify(_exhaustive)}</code>
        </div>
      )
    }
  }
}

export default function BlockRenderer({ blocks }: { blocks: Block[] }) {
  if (!blocks || blocks.length === 0) {
    return null
  }
  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      {blocks.map((block, i) => (
        <div key={block.id || `${block.type}-${i}`} className={spanToColClass(block.span)}>
          {renderBlock(block, i)}
        </div>
      ))}
    </div>
  )
}
