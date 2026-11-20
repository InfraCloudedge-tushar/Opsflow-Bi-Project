import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BottleneckInsight,
  DepartmentMetric,
  ExecutiveKpis,
  MonthlyTrendPoint,
  ScenarioResult,
} from '../types/operations';

async function svgToPngDataUrl(svgElement: SVGSVGElement, targetWidth = 1100, targetHeight = 420): Promise<string | null> {
  try {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const viewBox = clone.getAttribute('viewBox');
    if (!viewBox) {
      const rect = svgElement.getBoundingClientRect();
      clone.setAttribute('viewBox', `0 0 ${rect.width || targetWidth} ${rect.height || targetHeight}`);
    }
    clone.setAttribute('width', String(targetWidth));
    clone.setAttribute('height', String(targetHeight));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png', 0.95));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

export async function exportExecutiveReportPdf(params: {
  kpis: ExecutiveKpis;
  monthlyTrends: MonthlyTrendPoint[];
  deptMetrics: DepartmentMetric[];
  bottlenecks: BottleneckInsight[];
  scenarioResult: ScenarioResult;
  scopeLabel: string;
  workbookName: string;
  demandChartSvg?: SVGSVGElement | null;
  yoyChartSvg?: SVGSVGElement | null;
}) {
  const {
    kpis,
    monthlyTrends,
    deptMetrics,
    bottlenecks,
    scenarioResult,
    scopeLabel,
    workbookName,
    demandChartSvg,
    yoyChartSvg,
  } = params;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Page 1 Header Band
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 64, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OpsFlow BI — Operations KPI & Capacity Management Brief', margin, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Scope: ${scopeLabel}  |  Source: ${workbookName}  |  Generated: ${generatedDate}`, margin, 46);

  // Executive KPI Scorecard Table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('1. Executive KPI Scorecard & Year-over-Year Variance', margin, 88);

  const fmtPct = (v: number | null, suffix = '%') =>
    v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}${suffix}`;

  autoTable(doc, {
    startY: 96,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [15, 76, 129], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 5 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'left' },
    },
    head: [['Operations KPI', 'Current Period', 'YoY Change', 'Status', 'Executive Interpretation']],
    body: [
      [
        'Total Demand Volume',
        `${kpis.totalDemand.toLocaleString()} units`,
        fmtPct(kpis.demandYoYPct),
        'Tracked',
        kpis.demandMoMPct !== null ? `Latest MoM velocity: ${fmtPct(kpis.demandMoMPct)}` : 'Active demand intake',
      ],
      [
        'Available Effective Capacity',
        `${kpis.totalCapacity.toLocaleString()} units`,
        fmtPct(kpis.capacityYoYPct),
        kpis.capacityStatus,
        `Net Capacity Gap: ${kpis.capacityGap >= 0 ? '+' : ''}${kpis.capacityGap.toLocaleString()} units (${kpis.capacityGapPct.toFixed(1)}%)`,
      ],
      [
        'Capacity Utilization Rate',
        `${kpis.utilizationPct.toFixed(1)}%`,
        fmtPct(kpis.utilizationYoYPp, ' pp'),
        kpis.utilizationStatus,
        'Target band: 75%–88% | Bottleneck ceiling: 95%',
      ],
      [
        'Throughput & Fulfillment',
        `${kpis.totalThroughput.toLocaleString()} units`,
        fmtPct(kpis.throughputYoYPct),
        kpis.fulfillmentRatePct >= 97 ? 'Optimal' : 'Watch',
        `Fulfillment: ${kpis.fulfillmentRatePct.toFixed(1)}% | ${Math.round(kpis.outputPerFte)} units / FTE / mo`,
      ],
      [
        'Ending Carry-Over Backlog',
        `${kpis.endingBacklog.toLocaleString()} units`,
        fmtPct(kpis.backlogYoYPct),
        kpis.backlogDays > 7 ? 'Critical' : kpis.backlogDays > 4 ? 'Watch' : 'Optimal',
        `Queue coverage: ${kpis.backlogDays.toFixed(1)} working days (${kpis.backlogDelta >= 0 ? '+' : ''}${kpis.backlogDelta.toLocaleString()} net)`,
      ],
      [
        'SLA Attainment vs Target',
        `${kpis.slaActualPct.toFixed(1)}%`,
        fmtPct(kpis.slaYoYPp, ' pp'),
        kpis.slaStatus,
        `Target: ${kpis.slaTargetPct.toFixed(1)}% | Variance: ${kpis.slaVariancePp >= 0 ? '+' : ''}${kpis.slaVariancePp.toFixed(1)} pp`,
      ],
    ],
  });

  let cursorY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 260;
  cursorY += 16;

  // Embedded Visual Charts (if present on active screen)
  const chart1Png = demandChartSvg ? await svgToPngDataUrl(demandChartSvg, 1000, 380) : null;
  const chart2Png = yoyChartSvg ? await svgToPngDataUrl(yoyChartSvg, 1000, 380) : null;

  if (chart1Png || chart2Png) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Capacity vs. Demand & Year-over-Year Trend Visualization', margin, cursorY);
    cursorY += 8;

    const chartW = chart1Png && chart2Png ? (contentWidth - 14) / 2 : contentWidth * 0.72;
    const chartH = chartW * 0.38;

    if (chart1Png) {
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, cursorY, chartW, chartH);
      doc.addImage(chart1Png, 'PNG', margin + 2, cursorY + 2, chartW - 4, chartH - 4);
    }
    if (chart2Png) {
      const x2 = chart1Png ? margin + chartW + 14 : margin;
      doc.setDrawColor(226, 232, 240);
      doc.rect(x2, cursorY, chartW, chartH);
      doc.addImage(chart2Png, 'PNG', x2 + 2, cursorY + 2, chartW - 4, chartH - 4);
    }
    cursorY += chartH + 16;
  }

  // Bottleneck Diagnostic Summary on Page 1 (or Page 2 if tight)
  if (cursorY > 440) {
    doc.addPage();
    cursorY = 36;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Automated Bottleneck Diagnostics & Stakeholder Action Plan', margin, cursorY);

  autoTable(doc, {
    startY: cursorY + 8,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 4.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 115 },
      1: { halign: 'center', cellWidth: 55, fontStyle: 'bold' },
      2: { halign: 'right', cellWidth: 55 },
      3: { halign: 'right', cellWidth: 62 },
    },
    head: [['Department', 'Severity', 'Util %', 'Rec. FTE', 'Root Cause & Resource Recommendation']],
    body: bottlenecks.slice(0, 5).map((b) => [
      b.department,
      b.severity,
      `${b.utilizationPct.toFixed(1)}%`,
      b.recommendedFteAdd > 0 ? `+${b.recommendedFteAdd} FTE` : '0 FTE',
      `${b.rootCause} Action: ${b.actionPlan}`,
    ]),
  });

  // Page 2 / Next Page: Full YoY Monthly Matrix & Department Capacity Breakdown
  doc.addPage();
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Monthly Year-over-Year (YoY) Seasonal Matrix & Department Capacity Plan', margin, 25);

  autoTable(doc, {
    startY: 54,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [15, 76, 129], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8, textColor: [30, 41, 59], cellPadding: 3.8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
    head: [
      [
        'Month',
        'CY Demand',
        'PY Demand',
        'YoY %',
        'CY Capacity',
        'Cap. Gap',
        'CY Util %',
        'Backlog',
        'CY SLA %',
        'Seasonal Idx',
      ],
    ],
    body: monthlyTrends.map((m) => [
      m.monthName,
      m.cyDemand.toLocaleString(),
      m.pyDemand > 0 ? m.pyDemand.toLocaleString() : '—',
      m.demandYoYPct !== null ? `${m.demandYoYPct >= 0 ? '+' : ''}${m.demandYoYPct.toFixed(1)}%` : '—',
      m.cyCapacity.toLocaleString(),
      `${m.capacityGap >= 0 ? '+' : ''}${m.capacityGap.toLocaleString()}`,
      `${m.cyUtilizationPct.toFixed(1)}%`,
      m.cyEndingBacklog.toLocaleString(),
      `${m.cySlaPct.toFixed(1)}%`,
      `${m.seasonalIndex.toFixed(2)}x`,
    ]),
  });

  const afterMonthlyY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Department Resource Allocation & Capacity Planner Summary', margin, afterMonthlyY + 20);

  autoTable(doc, {
    startY: afterMonthlyY + 28,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8, textColor: [30, 41, 59], cellPadding: 4 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
    head: [
      [
        'Department',
        'Status',
        'Demand',
        'Capacity',
        'Gap',
        'Util %',
        'SLA %',
        'Active FTE',
        'Rec. FTE Delta',
        'Unit Cost',
      ],
    ],
    body: deptMetrics.map((d) => [
      d.department,
      d.status,
      d.demandUnits.toLocaleString(),
      d.capacityUnits.toLocaleString(),
      `${d.capacityGap >= 0 ? '+' : ''}${d.capacityGap.toLocaleString()}`,
      `${d.utilizationPct.toFixed(1)}%`,
      `${d.slaActualPct.toFixed(1)}%`,
      String(d.avgFte),
      d.recommendedFteDelta > 0 ? `+${d.recommendedFteDelta}` : String(d.recommendedFteDelta),
      `$${d.avgCostPerUnitUsd.toFixed(2)}`,
    ]),
  });

  const afterDeptY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 480;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Active Capacity Simulator Projection: Projected Demand ${scenarioResult.projectedDemand.toLocaleString()} units | Projected Capacity ${scenarioResult.projectedCapacity.toLocaleString()} units | Projected Utilization ${scenarioResult.projectedUtilizationPct.toFixed(1)}% | Projected SLA ${scenarioResult.projectedSlaPct.toFixed(1)}% | Monthly Labor Cost Impact: ${scenarioResult.monthlyLaborCostDeltaUsd >= 0 ? '+' : ''}$${scenarioResult.monthlyLaborCostDeltaUsd.toLocaleString()}`,
    margin,
    Math.min(afterDeptY + 18, doc.internal.pageSize.getHeight() - 18)
  );

  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`OpsFlow_Executive_Operations_Brief_${safeDate}.pdf`);
}
