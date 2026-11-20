import { DepartmentName, OperationRecord, QuarterLabel, RegionName } from '../types/operations';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getQuarter(month: number): QuarterLabel {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

interface DeptConfig {
  department: DepartmentName;
  region: RegionName;
  baseDemand2025: number;
  baseCapacity2025: number;
  yoyDemandGrowth: number;
  yoyCapacityGrowth: number;
  baseFte2025: number;
  fteGrowth2026: number;
  slaTarget: number;
  baseCostPerUnit: number;
  seasonalProfile: number[]; // 12 multipliers
}

const DEPT_CONFIGS: DeptConfig[] = [
  {
    department: 'Fulfillment & Logistics',
    region: 'North America',
    baseDemand2025: 14800,
    baseCapacity2025: 16200,
    yoyDemandGrowth: 0.145, // Strong order surge in 2026
    yoyCapacityGrowth: 0.055, // Capacity lagged behind demand -> Q3/Q4 bottleneck
    baseFte2025: 92,
    fteGrowth2026: 4,
    slaTarget: 95.0,
    baseCostPerUnit: 14.2,
    seasonalProfile: [0.89, 0.87, 0.94, 0.97, 1.01, 1.04, 1.02, 1.07, 1.13, 1.21, 1.31, 1.36],
  },
  {
    department: 'Order Processing',
    region: 'North America',
    baseDemand2025: 11200,
    baseCapacity2025: 12900,
    yoyDemandGrowth: 0.095,
    yoyCapacityGrowth: 0.085,
    baseFte2025: 54,
    fteGrowth2026: 4,
    slaTarget: 96.0,
    baseCostPerUnit: 8.6,
    seasonalProfile: [0.91, 0.89, 0.96, 0.99, 1.02, 1.03, 1.0, 1.04, 1.09, 1.14, 1.21, 1.24],
  },
  {
    department: 'Technical Support',
    region: 'EMEA',
    baseDemand2025: 6900,
    baseCapacity2025: 7450,
    yoyDemandGrowth: 0.16, // Product launch ticket spike
    yoyCapacityGrowth: 0.045, // Specialist hiring bottleneck
    baseFte2025: 46,
    fteGrowth2026: 2,
    slaTarget: 94.0,
    baseCostPerUnit: 24.5,
    seasonalProfile: [0.93, 0.91, 0.95, 0.98, 1.0, 1.03, 1.06, 1.09, 1.14, 1.18, 1.22, 1.19],
  },
  {
    department: 'Customer Operations',
    region: 'EMEA',
    baseDemand2025: 9400,
    baseCapacity2025: 11100,
    yoyDemandGrowth: 0.075,
    yoyCapacityGrowth: 0.08,
    baseFte2025: 60,
    fteGrowth2026: 4,
    slaTarget: 95.0,
    baseCostPerUnit: 11.4,
    seasonalProfile: [0.92, 0.9, 0.95, 0.97, 0.99, 1.01, 0.98, 1.02, 1.07, 1.12, 1.18, 1.2],
  },
  {
    department: 'Field Engineering',
    region: 'APAC',
    baseDemand2025: 4600,
    baseCapacity2025: 5350,
    yoyDemandGrowth: 0.11,
    yoyCapacityGrowth: 0.07,
    baseFte2025: 38,
    fteGrowth2026: 2,
    slaTarget: 93.0,
    baseCostPerUnit: 36.8,
    seasonalProfile: [0.88, 0.85, 0.94, 1.01, 1.04, 1.06, 1.05, 1.08, 1.12, 1.14, 1.15, 1.1],
  },
];

// Deterministic pseudo-random variance so numbers feel natural & realistic without flickering
function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1 to 1
}

export function generateDefaultOperationsDataset(): OperationRecord[] {
  const records: OperationRecord[] = [];
  const years = [2025, 2026];

  DEPT_CONFIGS.forEach((cfg, deptIdx) => {
    let runningBacklog = Math.round(cfg.baseDemand2025 * 0.045);

    years.forEach((year) => {
      const is2026 = year === 2026;
      const demandScale = is2026 ? 1 + cfg.yoyDemandGrowth : 1;
      const capScale = is2026 ? 1 + cfg.yoyCapacityGrowth : 1;

      for (let m = 1; m <= 12; m++) {
        const seasonal = cfg.seasonalProfile[m - 1];
        const noise = deterministicNoise((deptIdx + 1) * 100 + year * 13 + m);

        // Capacity scales more modestly in peak months (temp staffing / shift extensions)
        const capSeasonal = 1 + (seasonal - 1) * 0.42;
        const demandUnits = Math.round(cfg.baseDemand2025 * demandScale * seasonal * (1 + noise * 0.025));
        const availableCapacityUnits = Math.round(
          cfg.baseCapacity2025 * capScale * capSeasonal * (1 + noise * 0.012)
        );

        const beginningBacklog = runningBacklog;
        const totalWorkload = demandUnits + beginningBacklog;

        // Throughput cannot exceed available capacity + minor overtime burst (max +4% when under backlog pressure)
        const utilizationRatio = totalWorkload / availableCapacityUnits;
        const overtimeBurst = utilizationRatio > 0.92 ? Math.min(0.055, (utilizationRatio - 0.92) * 0.45) : 0;
        const maxPossibleOutput = Math.round(availableCapacityUnits * (1 + overtimeBurst));
        const throughputUnits = Math.min(totalWorkload, maxPossibleOutput);

        const endingBacklog = Math.max(0, totalWorkload - throughputUnits);
        runningBacklog = endingBacklog;

        // Effective utilization on capacity
        const utilPct = (demandUnits / availableCapacityUnits) * 100;

        // Queuing theory relationship: SLA degrades sharply once utilization exceeds 92% and backlog builds
        let slaActual = cfg.slaTarget + 1.6 - Math.max(0, utilPct - 82) * 0.24;
        if (endingBacklog > demandUnits * 0.08) {
          slaActual -= ((endingBacklog / demandUnits) - 0.08) * 18;
        }
        slaActual += noise * 0.45;
        slaActual = Number(Math.min(99.4, Math.max(76.5, slaActual)).toFixed(1));

        const activeFte = Math.round(
          (cfg.baseFte2025 + (is2026 ? cfg.fteGrowth2026 : 0)) * (1 + Math.max(0, seasonal - 1) * 0.28)
        );
        const operatingHoursPerFte = 160;
        const overtimeHours =
          utilPct > 88
            ? Math.round(activeFte * Math.min(28, (utilPct - 88) * 1.45))
            : Math.round(activeFte * 1.5);

        // Overtime pushes unit cost slightly higher during bottleneck months
        const costPerUnitUsd = Number(
          (cfg.baseCostPerUnit * (1 + (overtimeHours / (activeFte * operatingHoursPerFte)) * 0.35)).toFixed(2)
        );

        const period = `${year}-${String(m).padStart(2, '0')}`;

        records.push({
          id: `${period}-${cfg.department}`,
          period,
          year,
          month: m,
          monthName: MONTH_NAMES[m - 1],
          quarter: getQuarter(m),
          department: cfg.department,
          region: cfg.region,
          demandUnits,
          availableCapacityUnits,
          throughputUnits,
          beginningBacklog,
          endingBacklog,
          slaTargetPct: cfg.slaTarget,
          slaActualPct: slaActual,
          activeFte,
          operatingHoursPerFte,
          overtimeHours,
          costPerUnitUsd,
        });
      }
    });
  });

  return records.sort((a, b) => a.period.localeCompare(b.period) || a.department.localeCompare(b.department));
}

export const DEFAULT_WORKBOOK_NAME = 'Enterprise_Operations_FY2025_FY2026.xlsx';
