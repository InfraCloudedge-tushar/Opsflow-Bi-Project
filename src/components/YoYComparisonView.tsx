import React from 'react';
import { MonthlyTrendPoint } from '../types/operations';
import { YoYSeasonalComparisonChart } from './ExecutiveCharts';

interface YoYComparisonViewProps {
  monthlyTrends: MonthlyTrendPoint[];
  activeYearLabel: string;
  priorYearLabel: string;
}

export const YoYComparisonView: React.FC<YoYComparisonViewProps> = ({
  monthlyTrends,
  activeYearLabel,
  priorYearLabel,
}) => {
  // Quarter-over-quarter summary derived from monthlyTrends
  const quarters = [
    { label: 'Q1 (Jan–Mar)', months: [1, 2, 3] },
    { label: 'Q2 (Apr–Jun)', months: [4, 5, 6] },
    { label: 'Q3 (Jul–Sep)', months: [7, 8, 9] },
    { label: 'Q4 (Oct–Dec)', months: [10, 11, 12] },
  ].map((q) => {
    const rows = monthlyTrends.filter((m) => q.months.includes(m.month));
    const cyDemand = rows.reduce((s, r) => s + r.cyDemand, 0);
    const pyDemand = rows.reduce((s, r) => s + r.pyDemand, 0);
    const cyCapacity = rows.reduce((s, r) => s + r.cyCapacity, 0);
    const pyCapacity = rows.reduce((s, r) => s + r.pyCapacity, 0);
    const cyUtil = cyCapacity > 0 ? (cyDemand / cyCapacity) * 100 : 0;
    const pyUtil = pyCapacity > 0 ? (pyDemand / pyCapacity) * 100 : 0;
    const cySla =
      cyDemand > 0 ? rows.reduce((s, r) => s + r.cySlaPct * r.cyDemand, 0) / cyDemand : 0;
    const yoyPct = pyDemand > 0 ? ((cyDemand - pyDemand) / pyDemand) * 100 : null;
    return {
      ...q,
      cyDemand,
      pyDemand,
      cyCapacity,
      capacityGap: cyCapacity - cyDemand,
      cyUtil,
      pyUtil,
      cySla,
      yoyPct,
    };
  });

  const peakMonth = [...monthlyTrends].sort((a, b) => b.seasonalIndex - a.seasonalIndex)[0];
  const troughMonth = [...monthlyTrends].sort((a, b) => a.seasonalIndex - b.seasonalIndex)[0];

  return (
    <div className="space-y-5">
      {/* Quarterly YoY Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {quarters.map((q) => (
          <div key={q.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">{q.label}</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  q.yoyPct !== null && q.yoyPct >= 0 ? 'text-[#0F4C81]' : 'text-slate-600'
                }`}
              >
                {q.yoyPct !== null ? `${q.yoyPct >= 0 ? '+' : ''}${q.yoyPct.toFixed(1)}% YoY` : 'Single Yr'}
              </span>
            </div>
            <div className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {q.cyDemand.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-500">units</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[11px] font-sans text-slate-400">PY {priorYearLabel}</div>
                <div className="text-slate-700">{q.pyDemand > 0 ? q.pyDemand.toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-sans text-slate-400">Util %</div>
                <div className={q.cyUtil >= 95 ? 'text-red-700 font-semibold' : 'text-slate-700'}>
                  {q.cyUtil.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[11px] font-sans text-slate-400">SLA %</div>
                <div className="text-slate-700">{q.cySla.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main YoY Chart + Seasonal Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <YoYSeasonalComparisonChart data={monthlyTrends} />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Seasonal Pattern &amp; Growth Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeYearLabel} vs. {priorYearLabel} index normalized to 1.00x annual monthly mean
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="text-slate-500">Peak Seasonality Month</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900 text-sm">
                    {peakMonth?.periodLabel ?? 'N/A'}
                  </span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {peakMonth ? `${peakMonth.seasonalIndex.toFixed(2)}x baseline` : '—'}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">
                  Demand reaches {peakMonth?.cyDemand.toLocaleString() ?? 0} units (
                  {peakMonth?.cyUtilizationPct.toFixed(1) ?? 0}% utilization).
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="text-slate-500">Seasonal Trough (Maintenance / Training Window)</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900 text-sm">
                    {troughMonth?.periodLabel ?? 'N/A'}
                  </span>
                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                    {troughMonth ? `${troughMonth.seasonalIndex.toFixed(2)}x baseline` : '—'}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">
                  Ideal window for cross-skilling, backlog burn-down, and process automation rollouts.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Peak-to-Trough Amplitude:{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {peakMonth && troughMonth && troughMonth.seasonalIndex > 0
                ? `${((peakMonth.seasonalIndex / troughMonth.seasonalIndex - 1) * 100).toFixed(1)}% swing`
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Full Month-by-Month YoY Variance Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Monthly Year-over-Year Performance Matrix ({activeYearLabel} vs. {priorYearLabel})
            </h3>
            <p className="text-xs text-slate-500">
              Complete monthly progression of Demand, Capacity, Utilization, Backlog, SLA, and Seasonal Index
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Month</th>
                <th className="py-2.5 px-3 text-right">CY Demand</th>
                <th className="py-2.5 px-3 text-right">PY Demand</th>
                <th className="py-2.5 px-3 text-right">YoY %</th>
                <th className="py-2.5 px-3 text-right">CY Capacity</th>
                <th className="py-2.5 px-3 text-right">Cap. Gap</th>
                <th className="py-2.5 px-3 text-right">CY Util %</th>
                <th className="py-2.5 px-3 text-right">PY Util %</th>
                <th className="py-2.5 px-3 text-right">Backlog</th>
                <th className="py-2.5 px-3 text-right">CY SLA %</th>
                <th className="py-2.5 px-3 text-right">PY SLA %</th>
                <th className="py-2.5 px-4 text-right">Seasonal Idx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {monthlyTrends.map((m) => {
                const isPeak = m.seasonalIndex >= 1.15;
                return (
                  <tr key={m.month} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">{m.periodLabel}</td>
                    <td className="py-2.5 px-3 text-right text-slate-900">{m.cyDemand.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {m.pyDemand > 0 ? m.pyDemand.toLocaleString() : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold ${
                        m.demandYoYPct !== null && m.demandYoYPct > 0 ? 'text-[#0F4C81]' : 'text-slate-600'
                      }`}
                    >
                      {m.demandYoYPct !== null
                        ? `${m.demandYoYPct >= 0 ? '+' : ''}${m.demandYoYPct.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{m.cyCapacity.toLocaleString()}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold ${
                        m.capacityGap < 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {m.capacityGap >= 0 ? '+' : ''}
                      {m.capacityGap.toLocaleString()}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold ${
                        m.cyUtilizationPct >= 95
                          ? 'text-red-700'
                          : m.cyUtilizationPct >= 88
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {m.cyUtilizationPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {m.pyUtilizationPct > 0 ? `${m.pyUtilizationPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{m.cyEndingBacklog.toLocaleString()}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold ${
                        m.cySlaPct < m.slaTargetPct ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {m.cySlaPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {m.pySlaPct > 0 ? `${m.pySlaPct.toFixed(1)}%` : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-semibold ${
                        isPeak ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {m.seasonalIndex.toFixed(2)}x
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
