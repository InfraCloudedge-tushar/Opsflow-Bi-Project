import {
  BottleneckInsight,
  DepartmentMetric,
  ExecutiveKpis,
  FilterState,
  HealthStatus,
  MonthlyTrendPoint,
  OperationRecord,
  RegionMetric,
  ScenarioParams,
  ScenarioResult,
} from '../types/operations';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getDistinctYears(records: OperationRecord[]): number[] {
  return Array.from(new Set(records.map((r) => r.year))).sort((a, b) => b - a);
}

export function getDistinctDepartments(records: OperationRecord[]): string[] {
  return Array.from(new Set(records.map((r) => r.department))).sort();
}

export function getDistinctRegions(records: OperationRecord[]): string[] {
  return Array.from(new Set(records.map((r) => r.region))).sort();
}

export function filterRecords(records: OperationRecord[], filters: FilterState): OperationRecord[] {
  return records.filter((r) => {
    if (filters.year !== 'ALL' && r.year !== filters.year) return false;
    if (filters.quarter !== 'ALL' && r.quarter !== filters.quarter) return false;
    if (filters.month !== 'ALL' && r.month !== filters.month) return false;
    if (filters.department !== 'ALL' && r.department !== filters.department) return false;
    if (filters.region !== 'ALL' && r.region !== filters.region) return false;
    return true;
  });
}

export function getUtilizationStatus(utilizationPct: number): HealthStatus {
  if (utilizationPct >= 95) return 'Critical';
  if (utilizationPct >= 88) return 'Watch';
  return 'Optimal';
}

export function getSlaStatus(variancePp: number): HealthStatus {
  if (variancePp <= -2.0) return 'Critical';
  if (variancePp < 0) return 'Watch';
  return 'Optimal';
}

export function getCapacityStatus(capacityGap: number, totalCapacity: number): HealthStatus {
  if (capacityGap < 0) return 'Critical';
  const bufferPct = totalCapacity > 0 ? (capacityGap / totalCapacity) * 100 : 0;
  if (bufferPct < 8) return 'Watch';
  return 'Optimal';
}

function aggregateSlice(slice: OperationRecord[]) {
  if (slice.length === 0) {
    return {
      demand: 0,
      capacity: 0,
      throughput: 0,
      endingBacklog: 0,
      beginningBacklog: 0,
      utilizationPct: 0,
      slaActualPct: 0,
      slaTargetPct: 95,
      avgFte: 0,
      overtimeHours: 0,
      avgCostPerUnit: 0,
    };
  }

  let demand = 0;
  let capacity = 0;
  let throughput = 0;
  let weightedSlaActual = 0;
  let weightedSlaTarget = 0;
  let weightedCost = 0;
  let overtimeHours = 0;

  // Group by period to compute monthly average FTE & latest ending backlog accurately
  const byPeriod = new Map<string, OperationRecord[]>();
  for (const r of slice) {
    demand += r.demandUnits;
    capacity += r.availableCapacityUnits;
    throughput += r.throughputUnits;
    weightedSlaActual += r.slaActualPct * r.demandUnits;
    weightedSlaTarget += r.slaTargetPct * r.demandUnits;
    weightedCost += r.costPerUnitUsd * Math.max(1, r.throughputUnits);
    overtimeHours += r.overtimeHours;

    const arr = byPeriod.get(r.period);
    if (arr) arr.push(r);
    else byPeriod.set(r.period, [r]);
  }

  const sortedPeriods = Array.from(byPeriod.keys()).sort();
  const firstPeriodRows = byPeriod.get(sortedPeriods[0]) ?? [];
  const lastPeriodRows = byPeriod.get(sortedPeriods[sortedPeriods.length - 1]) ?? [];

  const beginningBacklog = firstPeriodRows.reduce((acc, r) => acc + r.beginningBacklog, 0);
  const endingBacklog = lastPeriodRows.reduce((acc, r) => acc + r.endingBacklog, 0);

  let totalPeriodFte = 0;
  for (const rows of byPeriod.values()) {
    totalPeriodFte += rows.reduce((acc, r) => acc + r.activeFte, 0);
  }
  const avgFte = byPeriod.size > 0 ? totalPeriodFte / byPeriod.size : 0;

  const utilizationPct = capacity > 0 ? (demand / capacity) * 100 : 0;
  const slaActualPct = demand > 0 ? weightedSlaActual / demand : 0;
  const slaTargetPct = demand > 0 ? weightedSlaTarget / demand : 95;
  const totalThroughputWeight = slice.reduce((acc, r) => acc + Math.max(1, r.throughputUnits), 0);
  const avgCostPerUnit = totalThroughputWeight > 0 ? weightedCost / totalThroughputWeight : 0;

  return {
    demand,
    capacity,
    throughput,
    endingBacklog,
    beginningBacklog,
    utilizationPct,
    slaActualPct,
    slaTargetPct,
    avgFte,
    overtimeHours,
    avgCostPerUnit,
  };
}

export function computeExecutiveKpis(
  allRecords: OperationRecord[],
  filters: FilterState
): ExecutiveKpis {
  const years = getDistinctYears(allRecords);
  const latestYear = years[0] ?? 2026;
  const activeYear = filters.year === 'ALL' ? latestYear : filters.year;

  const currentSlice = filterRecords(allRecords, filters);
  const curr = aggregateSlice(currentSlice);

  // Determine Prior Year slice for YoY comparison
  const priorYear = activeYear - 1;
  const hasPriorYearData = allRecords.some((r) => r.year === priorYear);
  const pyFilters: FilterState = {
    ...filters,
    year: priorYear,
  };
  const pySlice = hasPriorYearData && filters.year !== 'ALL' ? filterRecords(allRecords, pyFilters) : [];
  const hasPyComparison = pySlice.length > 0;
  const py = aggregateSlice(pySlice);

  const pctChange = (c: number, p: number): number | null => {
    if (!hasPyComparison || p === 0) return null;
    return ((c - p) / p) * 100;
  };

  // Month-over-month using the latest 2 periods in currentSlice
  const periodsInSlice = Array.from(new Set(currentSlice.map((r) => r.period))).sort();
  let latestPeriodLabel = periodsInSlice[periodsInSlice.length - 1] ?? 'N/A';
  let demandMoMPct: number | null = null;
  let utilizationMoMPp: number | null = null;

  if (periodsInSlice.length >= 2) {
    const pLast = periodsInSlice[periodsInSlice.length - 1];
    const pPrev = periodsInSlice[periodsInSlice.length - 2];
    const lastAgg = aggregateSlice(currentSlice.filter((r) => r.period === pLast));
    const prevAgg = aggregateSlice(currentSlice.filter((r) => r.period === pPrev));
    if (prevAgg.demand > 0) {
      demandMoMPct = ((lastAgg.demand - prevAgg.demand) / prevAgg.demand) * 100;
    }
    utilizationMoMPp = lastAgg.utilizationPct - prevAgg.utilizationPct;
    const [yr, mo] = pLast.split('-');
    const mIdx = parseInt(mo, 10) - 1;
    latestPeriodLabel = `${MONTH_NAMES[mIdx] ?? mo} ${yr}`;
  } else if (periodsInSlice.length === 1) {
    const [yr, mo] = periodsInSlice[0].split('-');
    const mIdx = parseInt(mo, 10) - 1;
    latestPeriodLabel = `${MONTH_NAMES[mIdx] ?? mo} ${yr}`;
  }

  const capacityGap = curr.capacity - curr.demand;
  const capacityGapPct = curr.capacity > 0 ? (capacityGap / curr.capacity) * 100 : 0;
  const effectiveThroughputRatePct = curr.capacity > 0 ? (curr.throughput / curr.capacity) * 100 : 0;
  const fulfillmentRatePct = curr.demand > 0 ? (curr.throughput / curr.demand) * 100 : 0;
  const slaVariancePp = curr.slaActualPct - curr.slaTargetPct;

  const numMonths = Math.max(1, periodsInSlice.length);
  const avgDailyThroughput = curr.throughput / (numMonths * 22);
  const backlogDays = avgDailyThroughput > 0 ? curr.endingBacklog / avgDailyThroughput : 0;
  const outputPerFte = curr.avgFte > 0 ? curr.throughput / (curr.avgFte * numMonths) : 0;

  return {
    totalDemand: curr.demand,
    totalCapacity: curr.capacity,
    capacityGap,
    capacityGapPct,
    utilizationPct: curr.utilizationPct,
    effectiveThroughputRatePct,
    totalThroughput: curr.throughput,
    fulfillmentRatePct,
    endingBacklog: curr.endingBacklog,
    backlogDelta: curr.endingBacklog - curr.beginningBacklog,
    backlogDays,
    slaActualPct: curr.slaActualPct,
    slaTargetPct: curr.slaTargetPct,
    slaVariancePp,
    avgActiveFte: curr.avgFte,
    outputPerFte,
    totalOvertimeHours: curr.overtimeHours,
    avgCostPerUnitUsd: curr.avgCostPerUnit,

    hasPyComparison,
    pyYearLabel: String(priorYear),
    demandYoYPct: pctChange(curr.demand, py.demand),
    capacityYoYPct: pctChange(curr.capacity, py.capacity),
    throughputYoYPct: pctChange(curr.throughput, py.throughput),
    backlogYoYPct: pctChange(curr.endingBacklog, py.endingBacklog),
    utilizationYoYPp: hasPyComparison ? curr.utilizationPct - py.utilizationPct : null,
    slaYoYPp: hasPyComparison ? curr.slaActualPct - py.slaActualPct : null,

    latestPeriodLabel,
    demandMoMPct,
    utilizationMoMPp,

    utilizationStatus: getUtilizationStatus(curr.utilizationPct),
    slaStatus: getSlaStatus(slaVariancePp),
    capacityStatus: getCapacityStatus(capacityGap, curr.capacity),
  };
}

export function computeMonthlyTrends(
  allRecords: OperationRecord[],
  filters: FilterState
): MonthlyTrendPoint[] {
  const years = getDistinctYears(allRecords);
  const targetYear = filters.year === 'ALL' ? (years[0] ?? 2026) : filters.year;
  const priorYear = targetYear - 1;

  // Apply non-year, non-month filters so monthly chart shows all months in quarter/dept/region
  const baseFilter = (r: OperationRecord, yr: number) => {
    if (r.year !== yr) return false;
    if (filters.quarter !== 'ALL' && r.quarter !== filters.quarter) return false;
    if (filters.department !== 'ALL' && r.department !== filters.department) return false;
    if (filters.region !== 'ALL' && r.region !== filters.region) return false;
    return true;
  };

  const cyRows = allRecords.filter((r) => baseFilter(r, targetYear));
  const pyRows = allRecords.filter((r) => baseFilter(r, priorYear));

  const monthsToShow = Array.from(new Set(cyRows.map((r) => r.month))).sort((a, b) => a - b);
  const monthList = monthsToShow.length > 0 ? monthsToShow : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const totalCyDemand = cyRows.reduce((s, r) => s + r.demandUnits, 0);
  const avgMonthlyDemand = monthList.length > 0 ? totalCyDemand / monthList.length : 1;

  return monthList.map((m) => {
    const cyM = aggregateSlice(cyRows.filter((r) => r.month === m));
    const pyM = aggregateSlice(pyRows.filter((r) => r.month === m));
    const demandYoYPct = pyM.demand > 0 ? ((cyM.demand - pyM.demand) / pyM.demand) * 100 : null;
    const seasonalIndex = avgMonthlyDemand > 0 ? cyM.demand / avgMonthlyDemand : 1;

    return {
      month: m,
      monthName: MONTH_NAMES[m - 1] ?? String(m),
      periodLabel: `${MONTH_NAMES[m - 1]} ${targetYear}`,
      cyDemand: cyM.demand,
      pyDemand: pyM.demand,
      demandYoYPct,
      cyCapacity: cyM.capacity,
      pyCapacity: pyM.capacity,
      cyThroughput: cyM.throughput,
      pyThroughput: pyM.throughput,
      capacityGap: cyM.capacity - cyM.demand,
      cyUtilizationPct: cyM.utilizationPct,
      pyUtilizationPct: pyM.utilizationPct,
      cyEndingBacklog: cyM.endingBacklog,
      pyEndingBacklog: pyM.endingBacklog,
      cySlaPct: cyM.slaActualPct,
      pySlaPct: pyM.slaActualPct,
      slaTargetPct: cyM.slaTargetPct,
      seasonalIndex,
      activeFte: Math.round(cyM.avgFte),
    };
  });
}

export function computeDepartmentMetrics(
  allRecords: OperationRecord[],
  filters: FilterState
): DepartmentMetric[] {
  const years = getDistinctYears(allRecords);
  const activeYear = filters.year === 'ALL' ? (years[0] ?? 2026) : filters.year;
  const priorYear = activeYear - 1;

  // Filter without department cross-filter so all departments remain comparable, or respect region/quarter/month
  const scopeRows = allRecords.filter((r) => {
    if (filters.year !== 'ALL' && r.year !== filters.year) return false;
    if (filters.quarter !== 'ALL' && r.quarter !== filters.quarter) return false;
    if (filters.month !== 'ALL' && r.month !== filters.month) return false;
    if (filters.region !== 'ALL' && r.region !== filters.region) return false;
    return true;
  });

  const depts = getDistinctDepartments(scopeRows.length > 0 ? scopeRows : allRecords);

  return depts
    .map((dept) => {
      const deptRows = scopeRows.filter((r) => r.department === dept);
      const agg = aggregateSlice(deptRows);
      const numMonths = Math.max(1, new Set(deptRows.map((r) => r.period)).size);
      const region = deptRows[0]?.region ?? 'Global';

      // YoY comparison for this department
      const pyRows = allRecords.filter(
        (r) =>
          r.department === dept &&
          r.year === priorYear &&
          (filters.quarter === 'ALL' || r.quarter === filters.quarter) &&
          (filters.month === 'ALL' || r.month === filters.month) &&
          (filters.region === 'ALL' || r.region === filters.region)
      );
      const pyAgg = aggregateSlice(pyRows);
      const demandYoYPct =
        filters.year !== 'ALL' && pyAgg.demand > 0
          ? ((agg.demand - pyAgg.demand) / pyAgg.demand) * 100
          : null;

      const capacityGap = agg.capacity - agg.demand;
      const slaVariancePp = agg.slaActualPct - agg.slaTargetPct;
      const avgDailyThroughput = agg.throughput / (numMonths * 22);
      const backlogDays = avgDailyThroughput > 0 ? agg.endingBacklog / avgDailyThroughput : 0;
      const outputPerFtePerMonth = agg.avgFte > 0 ? agg.throughput / (agg.avgFte * numMonths) : 0;

      // Recommended FTE delta to hold target 85% utilization ceiling
      const targetCapNeeded = agg.demand / 0.85;
      const capPerFteTotal = agg.avgFte > 0 ? agg.capacity / agg.avgFte : 0;
      const requiredFte = capPerFteTotal > 0 ? targetCapNeeded / capPerFteTotal : agg.avgFte;
      const recommendedFteDelta = Math.round(requiredFte - agg.avgFte);

      const status: HealthStatus =
        agg.utilizationPct >= 95 || slaVariancePp <= -2.0
          ? 'Critical'
          : agg.utilizationPct >= 88 || slaVariancePp < 0
          ? 'Watch'
          : 'Optimal';

      // Bottleneck severity score (0-100)
      const utilComponent = Math.min(55, Math.max(0, (agg.utilizationPct - 70) * 1.8));
      const slaComponent = Math.min(25, Math.max(0, -slaVariancePp * 5));
      const backlogComponent = Math.min(20, backlogDays * 1.8);
      const bottleneckScore = Math.round(Math.min(100, utilComponent + slaComponent + backlogComponent));

      return {
        department: dept,
        region,
        demandUnits: agg.demand,
        capacityUnits: agg.capacity,
        capacityGap,
        throughputUnits: agg.throughput,
        utilizationPct: agg.utilizationPct,
        endingBacklog: agg.endingBacklog,
        backlogDays,
        slaActualPct: agg.slaActualPct,
        slaTargetPct: agg.slaTargetPct,
        slaVariancePp,
        avgFte: Math.round(agg.avgFte),
        outputPerFtePerMonth,
        recommendedFteDelta,
        overtimeHours: agg.overtimeHours,
        avgCostPerUnitUsd: agg.avgCostPerUnit,
        demandYoYPct,
        status,
        bottleneckScore,
      };
    })
    .sort((a, b) => b.bottleneckScore - a.bottleneckScore);
}

export function computeRegionMetrics(
  allRecords: OperationRecord[],
  filters: FilterState
): RegionMetric[] {
  const scopeRows = allRecords.filter((r) => {
    if (filters.year !== 'ALL' && r.year !== filters.year) return false;
    if (filters.quarter !== 'ALL' && r.quarter !== filters.quarter) return false;
    if (filters.month !== 'ALL' && r.month !== filters.month) return false;
    if (filters.department !== 'ALL' && r.department !== filters.department) return false;
    return true;
  });

  const regions = getDistinctRegions(scopeRows.length > 0 ? scopeRows : allRecords);

  return regions.map((region) => {
    const rows = scopeRows.filter((r) => r.region === region);
    const agg = aggregateSlice(rows);
    const capacityGap = agg.capacity - agg.demand;
    const slaVariancePp = agg.slaActualPct - agg.slaTargetPct;
    const status: HealthStatus =
      agg.utilizationPct >= 95 || slaVariancePp <= -2
        ? 'Critical'
        : agg.utilizationPct >= 88 || slaVariancePp < 0
        ? 'Watch'
        : 'Optimal';

    return {
      region,
      demandUnits: agg.demand,
      capacityUnits: agg.capacity,
      capacityGap,
      utilizationPct: agg.utilizationPct,
      endingBacklog: agg.endingBacklog,
      slaActualPct: agg.slaActualPct,
      avgFte: Math.round(agg.avgFte),
      status,
    };
  });
}

export function detectBottlenecks(
  deptMetrics: DepartmentMetric[],
  monthlyTrends: MonthlyTrendPoint[]
): BottleneckInsight[] {
  const peakMonth = [...monthlyTrends].sort((a, b) => b.cyUtilizationPct - a.cyUtilizationPct)[0];

  return deptMetrics.map((d) => {
    const deficit = Math.max(0, d.demandUnits - d.capacityUnits);
    const fteAdd = Math.max(0, d.recommendedFteDelta);

    if (d.status === 'Critical') {
      return {
        id: `bn-${d.department}`,
        department: d.department,
        severity: 'Critical',
        utilizationPct: d.utilizationPct,
        capacityDeficitUnits: deficit,
        endingBacklog: d.endingBacklog,
        slaVariancePp: d.slaVariancePp,
        recommendedFteAdd: fteAdd,
        headline: `${d.department} operating above queuing threshold (${d.utilizationPct.toFixed(1)}% util)`,
        rootCause:
          deficit > 0
            ? `Demand exceeded effective capacity by ${deficit.toLocaleString()} units${
                d.demandYoYPct !== null ? ` (+${d.demandYoYPct.toFixed(1)}% YoY surge)` : ''
              }, driving ${d.endingBacklog.toLocaleString()} units into carry-over backlog.`
            : `Peak-period saturation${
                peakMonth ? ` (peaking in ${peakMonth.monthName} at ${peakMonth.cyUtilizationPct.toFixed(1)}%)` : ''
              } pushed SLA ${Math.abs(d.slaVariancePp).toFixed(1)} pp below target.`,
        actionPlan:
          fteAdd > 0
            ? `Add +${fteAdd} FTE (or cross-train from surplus units) to restore 85% target utilization ceiling and burn down ${d.backlogDays.toFixed(1)} days of queue.`
            : `Rebalance peak shift scheduling and authorize temporary cross-skilling to protect SLA.`,
      };
    }

    if (d.status === 'Watch') {
      return {
        id: `bn-${d.department}`,
        department: d.department,
        severity: 'Watch',
        utilizationPct: d.utilizationPct,
        capacityDeficitUnits: deficit,
        endingBacklog: d.endingBacklog,
        slaVariancePp: d.slaVariancePp,
        recommendedFteAdd: fteAdd,
        headline: `${d.department} approaching saturation buffer (${d.utilizationPct.toFixed(1)}% util)`,
        rootCause: `Operating inside the 88–95% high-sensitivity zone with ${d.overtimeHours.toLocaleString()} overtime hours logged to absorb variance.`,
        actionPlan:
          fteAdd > 0
            ? `Pre-stage +${fteAdd} seasonal FTE ahead of peak quarters to keep SLA above ${d.slaTargetPct.toFixed(1)}%.`
            : `Monitor daily intake velocity and cap overtime dependency before Q4 seasonal ramp.`,
      };
    }

    return {
      id: `bn-${d.department}`,
      department: d.department,
      severity: 'Optimal',
      utilizationPct: d.utilizationPct,
      capacityDeficitUnits: 0,
      endingBacklog: d.endingBacklog,
      slaVariancePp: d.slaVariancePp,
      recommendedFteAdd: 0,
      headline: `${d.department} maintaining healthy capacity headroom (${d.utilizationPct.toFixed(1)}% util)`,
      rootCause: `Surplus buffer of +${d.capacityGap.toLocaleString()} units keeps queue times minimal (${d.backlogDays.toFixed(1)} days) and SLA at ${d.slaActualPct.toFixed(1)}%.`,
      actionPlan: `Candidate unit for temporary cross-training / float allocation to relieve constrained teams during peak periods.`,
    };
  });
}

export function runCapacityScenario(
  kpis: ExecutiveKpis,
  _deptMetrics: DepartmentMetric[],
  params: ScenarioParams
): ScenarioResult {
  const baselineDemand = Math.max(1, kpis.totalDemand);
  const baselineCapacity = Math.max(1, kpis.totalCapacity);

  const projectedDemand = Math.round(baselineDemand * (1 + params.demandGrowthPct / 100));

  const capPerFte = kpis.avgActiveFte > 0 ? baselineCapacity / kpis.avgActiveFte : 250;
  const fteCapacityAdd = params.fteDelta * capPerFte;
  const capacityAfterFte = Math.max(100, baselineCapacity + fteCapacityAdd);
  const projectedCapacity = Math.round(
    capacityAfterFte * (1 + params.efficiencyGainPct / 100) * (1 + params.overtimeBufferPct / 100)
  );

  const projectedGap = projectedCapacity - projectedDemand;
  const projectedUtilizationPct = (projectedDemand / projectedCapacity) * 100;
  const projectedThroughput = Math.min(projectedDemand + kpis.endingBacklog, projectedCapacity);

  // Estimate monthly run-rate (assuming current scope represents N months — approximate via outputPerFte)
  const impliedMonths =
    kpis.avgActiveFte > 0 && kpis.outputPerFte > 0
      ? Math.max(1, Math.round(kpis.totalThroughput / (kpis.avgActiveFte * kpis.outputPerFte)))
      : 12;

  const monthlyProjDemand = projectedDemand / impliedMonths;
  const monthlyProjCapacity = projectedCapacity / impliedMonths;
  const monthlyNetClearance = monthlyProjCapacity - monthlyProjDemand;

  // Baseline monthly net clearance
  const monthlyBaseClearance = (baselineCapacity - baselineDemand) / impliedMonths;

  let runningProjBacklog = kpis.endingBacklog;
  let runningBaseBacklog = kpis.endingBacklog;
  let monthsToClearBacklog: number | null = runningProjBacklog <= 0 ? 0 : null;

  const burnDownSeries = Array.from({ length: 6 }, (_, idx) => {
    const mNum = idx + 1;
    runningBaseBacklog = Math.max(0, Math.round(runningBaseBacklog - monthlyBaseClearance));
    runningProjBacklog = Math.max(0, Math.round(runningProjBacklog - monthlyNetClearance));
    if (monthsToClearBacklog === null && runningProjBacklog === 0) {
      monthsToClearBacklog = mNum;
    }
    return {
      monthIndex: mNum,
      label: `M+${mNum}`,
      baselineBacklog: runningBaseBacklog,
      projectedBacklog: runningProjBacklog,
      projectedUtilization: Number(projectedUtilizationPct.toFixed(1)),
    };
  });

  if (monthsToClearBacklog === null && monthlyNetClearance > 0) {
    monthsToClearBacklog = Math.ceil(kpis.endingBacklog / monthlyNetClearance);
  }

  const projectedBacklogAfterQuarter = burnDownSeries[2]?.projectedBacklog ?? runningProjBacklog;

  // SLA recovery model based on queuing utilization curve
  const utilDiff = kpis.utilizationPct - projectedUtilizationPct;
  const projectedSlaPct = Number(
    Math.min(99.5, Math.max(72.0, kpis.slaActualPct + utilDiff * 0.42)).toFixed(1)
  );

  // Financial impact ($6,400 fully-loaded monthly FTE cost + 1.5x overtime premium)
  const monthlyFteCost = params.fteDelta * 6400;
  const monthlyOvertimeCost =
    (kpis.avgActiveFte + params.fteDelta) * 160 * (params.overtimeBufferPct / 100) * 58;
  const monthlyLaborCostDeltaUsd = Math.round(monthlyFteCost + monthlyOvertimeCost);

  const projectedCostPerUnitUsd = Number(
    (
      kpis.avgCostPerUnitUsd *
      (1 - params.efficiencyGainPct * 0.0045 + (params.overtimeBufferPct * 0.003))
    ).toFixed(2)
  );

  const status = getUtilizationStatus(projectedUtilizationPct);

  return {
    baselineDemand,
    projectedDemand,
    baselineCapacity,
    projectedCapacity,
    projectedGap,
    projectedUtilizationPct,
    projectedThroughput,
    projectedBacklogAfterQuarter,
    monthsToClearBacklog,
    projectedSlaPct,
    monthlyLaborCostDeltaUsd,
    projectedCostPerUnitUsd,
    status,
    burnDownSeries,
  };
}
