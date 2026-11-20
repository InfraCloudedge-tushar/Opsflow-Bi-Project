import React from 'react';
import { AlertTriangle, CheckCircle2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { ExecutiveKpis, HealthStatus } from '../types/operations';

interface KpiStripProps {
  kpis: ExecutiveKpis;
}

function StatusLabel({ status, customText }: { status: HealthStatus; customText?: string }) {
  if (status === 'Critical') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {customText ?? 'Critical'}
      </span>
    );
  }
  if (status === 'Watch') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {customText ?? 'Watch'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      {customText ?? 'Optimal'}
    </span>
  );
}

function DeltaIndicator({
  value,
  suffix = '%',
  invertGood = false,
  label,
}: {
  value: number | null;
  suffix?: string;
  invertGood?: boolean;
  label: string;
}) {
  if (value === null) {
    return <span className="text-xs text-slate-400 tabular-nums">{label}: N/A</span>;
  }
  const isPositive = value > 0.05;
  const isNegative = value < -0.05;
  const isGood = invertGood ? isNegative : isPositive;
  const isBad = invertGood ? isPositive : isNegative;

  const colorClass = isGood
    ? 'text-emerald-700'
    : isBad
    ? 'text-red-700'
    : 'text-slate-600';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${colorClass}`}>
      {isPositive ? (
        <TrendingUp className="w-3 h-3 shrink-0" />
      ) : isNegative ? (
        <TrendingDown className="w-3 h-3 shrink-0" />
      ) : (
        <Minus className="w-3 h-3 shrink-0" />
      )}
      {value >= 0 ? '+' : ''}
      {value.toFixed(1)}
      {suffix} {label}
    </span>
  );
}

export const KpiStrip: React.FC<KpiStripProps> = ({ kpis }) => {
  const backlogStatus: HealthStatus =
    kpis.backlogDays > 7 ? 'Critical' : kpis.backlogDays > 4 ? 'Watch' : 'Optimal';

  const fulfillmentStatus: HealthStatus =
    kpis.fulfillmentRatePct < 94 ? 'Critical' : kpis.fulfillmentRatePct < 97 ? 'Watch' : 'Optimal';

  return (
    <section aria-label="Executive KPI Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* 1. Total Demand */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Total Demand</span>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {kpis.latestPeriodLabel}
          </span>
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {kpis.totalDemand.toLocaleString()}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
          <DeltaIndicator
            value={kpis.demandYoYPct}
            label={`YoY vs ${kpis.pyYearLabel}`}
            invertGood={false}
          />
          <span className="text-xs text-slate-500 tabular-nums">
            MoM:{' '}
            {kpis.demandMoMPct !== null
              ? `${kpis.demandMoMPct >= 0 ? '+' : ''}${kpis.demandMoMPct.toFixed(1)}%`
              : 'N/A'}
          </span>
        </div>
      </div>

      {/* 2. Available Capacity & Gap */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Available Capacity</span>
          <StatusLabel status={kpis.capacityStatus} />
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {kpis.totalCapacity.toLocaleString()}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
          <span
            className={`text-xs font-medium tabular-nums ${
              kpis.capacityGap < 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            Gap: {kpis.capacityGap >= 0 ? '+' : ''}
            {kpis.capacityGap.toLocaleString()} units
          </span>
          <DeltaIndicator
            value={kpis.capacityYoYPct}
            label="YoY Cap"
          />
        </div>
      </div>

      {/* 3. Capacity Utilization */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Utilization Rate</span>
          <StatusLabel status={kpis.utilizationStatus} />
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {kpis.utilizationPct.toFixed(1)}%
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
          <DeltaIndicator
            value={kpis.utilizationYoYPp}
            suffix=" pp"
            invertGood={true}
            label="YoY"
          />
          <span className="text-xs text-slate-500 tabular-nums">Target band: 75%–88%</span>
        </div>
      </div>

      {/* 4. Throughput & FTE Productivity */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Total Throughput</span>
          <StatusLabel
            status={fulfillmentStatus}
            customText={`${kpis.fulfillmentRatePct.toFixed(1)}%`}
          />
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {kpis.totalThroughput.toLocaleString()}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
          <span className="text-xs text-slate-700 font-medium tabular-nums">
            {Math.round(kpis.outputPerFte).toLocaleString()} units / FTE / mo
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            {Math.round(kpis.avgActiveFte)} avg FTE · ${kpis.avgCostPerUnitUsd.toFixed(2)}/unit
          </span>
        </div>
      </div>

      {/* 5. Ending Backlog & Queue Days */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Ending Backlog</span>
          <StatusLabel status={backlogStatus} />
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {kpis.endingBacklog.toLocaleString()}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
          <span className="text-xs font-medium text-slate-700 tabular-nums">
            Queue: {kpis.backlogDays.toFixed(1)} workdays
          </span>
          <DeltaIndicator
            value={kpis.backlogYoYPct}
            invertGood={true}
            label="YoY Backlog"
          />
        </div>
      </div>

      {/* 6. SLA Performance */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">SLA Attainment</span>
          <StatusLabel status={kpis.slaStatus} />
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {kpis.slaActualPct.toFixed(1)}%
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
          <span
            className={`text-xs font-medium tabular-nums ${
              kpis.slaVariancePp < 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            vs {kpis.slaTargetPct.toFixed(1)}% Target ({kpis.slaVariancePp >= 0 ? '+' : ''}
            {kpis.slaVariancePp.toFixed(1)} pp)
          </span>
          <DeltaIndicator
            value={kpis.slaYoYPp}
            suffix=" pp"
            invertGood={false}
            label="YoY SLA"
          />
        </div>
      </div>
    </section>
  );
};
