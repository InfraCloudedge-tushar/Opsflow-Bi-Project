export type DepartmentName =
  | 'Fulfillment & Logistics'
  | 'Order Processing'
  | 'Technical Support'
  | 'Customer Operations'
  | 'Field Engineering';

export type RegionName = 'North America' | 'EMEA' | 'APAC';

export type QuarterLabel = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type ReportTab =
  | 'executive'
  | 'yoy'
  | 'bottlenecks'
  | 'planner'
  | 'datagrid';

export type HealthStatus = 'Optimal' | 'Watch' | 'Critical';

export interface OperationRecord {
  id: string;
  period: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  monthName: string; // Jan..Dec
  quarter: QuarterLabel;
  department: DepartmentName | string;
  region: RegionName | string;
  demandUnits: number;
  availableCapacityUnits: number;
  throughputUnits: number;
  beginningBacklog: number;
  endingBacklog: number;
  slaTargetPct: number;
  slaActualPct: number;
  activeFte: number;
  operatingHoursPerFte: number;
  overtimeHours: number;
  costPerUnitUsd: number;
}

export interface FilterState {
  year: number | 'ALL';
  quarter: QuarterLabel | 'ALL';
  month: number | 'ALL';
  department: string | 'ALL';
  region: string | 'ALL';
}

export interface ExecutiveKpis {
  totalDemand: number;
  totalCapacity: number;
  capacityGap: number; // Capacity - Demand
  capacityGapPct: number;
  utilizationPct: number; // Demand / Capacity * 100
  effectiveThroughputRatePct: number; // Throughput / Capacity * 100
  totalThroughput: number;
  fulfillmentRatePct: number; // Throughput / Demand * 100
  endingBacklog: number;
  backlogDelta: number; // Ending - Beginning across period
  backlogDays: number;
  slaActualPct: number; // Demand-weighted SLA %
  slaTargetPct: number;
  slaVariancePp: number; // Actual - Target in percentage points
  avgActiveFte: number;
  outputPerFte: number;
  totalOvertimeHours: number;
  avgCostPerUnitUsd: number;

  // Year-over-Year deltas (against year - 1 in same filtered slice)
  hasPyComparison: boolean;
  pyYearLabel: string;
  demandYoYPct: number | null;
  capacityYoYPct: number | null;
  throughputYoYPct: number | null;
  backlogYoYPct: number | null;
  utilizationYoYPp: number | null;
  slaYoYPp: number | null;

  // Month-over-Month (latest active month in scope vs preceding month)
  latestPeriodLabel: string;
  demandMoMPct: number | null;
  utilizationMoMPp: number | null;

  // Overall status indicators
  utilizationStatus: HealthStatus;
  slaStatus: HealthStatus;
  capacityStatus: HealthStatus;
}

export interface MonthlyTrendPoint {
  month: number;
  monthName: string;
  periodLabel: string;
  cyDemand: number;
  pyDemand: number;
  demandYoYPct: number | null;
  cyCapacity: number;
  pyCapacity: number;
  cyThroughput: number;
  pyThroughput: number;
  capacityGap: number; // cyCapacity - cyDemand
  cyUtilizationPct: number;
  pyUtilizationPct: number;
  cyEndingBacklog: number;
  pyEndingBacklog: number;
  cySlaPct: number;
  pySlaPct: number;
  slaTargetPct: number;
  seasonalIndex: number;
  activeFte: number;
}

export interface DepartmentMetric {
  department: string;
  region: string;
  demandUnits: number;
  capacityUnits: number;
  capacityGap: number;
  throughputUnits: number;
  utilizationPct: number;
  endingBacklog: number;
  backlogDays: number;
  slaActualPct: number;
  slaTargetPct: number;
  slaVariancePp: number;
  avgFte: number;
  outputPerFtePerMonth: number;
  recommendedFteDelta: number;
  overtimeHours: number;
  avgCostPerUnitUsd: number;
  demandYoYPct: number | null;
  status: HealthStatus;
  bottleneckScore: number; // 0-100 risk index for ranking
}

export interface RegionMetric {
  region: string;
  demandUnits: number;
  capacityUnits: number;
  capacityGap: number;
  utilizationPct: number;
  endingBacklog: number;
  slaActualPct: number;
  avgFte: number;
  status: HealthStatus;
}

export interface BottleneckInsight {
  id: string;
  department: string;
  severity: HealthStatus;
  utilizationPct: number;
  capacityDeficitUnits: number;
  endingBacklog: number;
  slaVariancePp: number;
  recommendedFteAdd: number;
  headline: string;
  rootCause: string;
  actionPlan: string;
}

export interface ScenarioParams {
  demandGrowthPct: number; // -20 to +40
  fteDelta: number; // -15 to +60
  efficiencyGainPct: number; // 0 to +25
  overtimeBufferPct: number; // 0 to +20
  targetUtilizationPct: number; // default 85
}

export interface ScenarioResult {
  baselineDemand: number;
  projectedDemand: number;
  baselineCapacity: number;
  projectedCapacity: number;
  projectedGap: number;
  projectedUtilizationPct: number;
  projectedThroughput: number;
  projectedBacklogAfterQuarter: number;
  monthsToClearBacklog: number | null;
  projectedSlaPct: number;
  monthlyLaborCostDeltaUsd: number;
  projectedCostPerUnitUsd: number;
  status: HealthStatus;
  burnDownSeries: Array<{
    monthIndex: number;
    label: string;
    baselineBacklog: number;
    projectedBacklog: number;
    projectedUtilization: number;
  }>;
}
