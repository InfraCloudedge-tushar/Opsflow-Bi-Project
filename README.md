## Key Capabilities Implemented

1. **Full Project Process & MBA Operations Workflow**
   Step 1: **Excel Data Input & Schema (Operations_Data)**
    - Click Excel Template in the toolbar to download ApexOps_Operations_Data_Template.xlsx.
    - **Operations_Data:** Pre-filled with 24 months (FY 2025 – FY 2026) across 5 departments (Fulfillment & Logistics, Order Processing, Technical Support, Customer Operations, Field Engineering)  and 3 regions (North America, EMEA, APAC).
    - **Data_Dictionary:** Explains all 18 columns (Period, Year, Month, Quarter, Department, Region, Demand_Units, Available_Capacity_Units, Throughput_Units, Beginning_Backlog, Ending_Backlog, SLA_Target_Pct, SLA_Actual_Pct, Active_FTE, Operating_Hours_Per_FTE, Overtime_Hours, Cost_Per_Unit_USD).
   Step 2: **Automated Operations Analytics Engine**
   Once Excel data is loaded, the dashboard calculates MBA-level operations metrics instantaneously:
    - **Capacity Gap & Utilization:**
      - Capacity Gap = Available Capacity - Demand (positive = surplus buffer, negative = deficit driving backlog).
      - Utilization % = Demand / Available Capacity, benchmarked against queuing-theory thresholds: Optimal (<88%), Watch (88%–95%), and Critical Bottleneck (≥95%).
    - **Throughput, Backlog & Queue Coverage:**
      - Tracks Fulfillment Rate % (Throughput / Demand), monthly Output per FTE, and Ending Backlog = max(0, Beginning_Backlog + Demand - Throughput).
      - Converts raw backlog into Queue Days (Ending Backlog / Avg Daily Throughput over 22 working days/month).
    - **SLA Attainment:**
      - Demand-weighted SLA % compared against each department's SLA target (SLA Variance in percentage points), showing how utilization spikes above 92% erode SLA compliance.
    - **Year-over-Year (YoY) & Seasonal Indexing:**
      - Automatically pairs every active slice (FY 2026) against the exact matching prior-year slice (FY 2025) to surface YoY % demand growth, capacity growth, utilization shift, and SLA change.
      - Computes a Seasonal Index (Monthly Demand / Average Monthly Demand) to isolate Q4 peak surges (1.20x+) vs. Q1 troughs.
    - **Automated Bottleneck Diagnostics:**
      - Ranks departments by a composite Bottleneck Risk Score (0–100) combining utilization saturation, SLA shortfall, and backlog days, then calculates the Recommended FTE Delta required to restore an 85% target utilization ceiling.
   Step 3: **Interactive Power BI Exploration & "What-If" Planning**
    - **Executive Summary:**
      - 6-card KPI strip, clickable Demand vs. Capacity & Utilization % chart (click any month bar to cross-filter), YoY Demand & Seasonal Pattern chart, clickable Department Utilization bars, Net Capacity Gap diverging chart, and Automated Bottleneck Diagnostics.
    - **YoY & Seasonality:**
      - Quarterly YoY summary cards, peak-to-trough amplitude analysis, and a 12-month YoY variance matrix.
    - **Bottleneck & SLA:**
      - Department × Quarter Utilization Heatmap (Q1–Q4) plus unit cost and overtime intensity breakdown.
    - **Capacity Planner:**
      - Interactive sliders and presets (Q4 Peak, Lean Automation, Backlog Recovery) to model demand shifts, FTE additions, automation gains, and overtime buffers—projecting a 6-Month Backlog Burn-Down curve, SLA recovery, and monthly labor cost impact.
   Step 4: **Automated Stakeholder Reporting (Excel & PDF)**
    - **Export Excel Report:** 
      - Downloads a 5-sheet executive workbook (Executive_KPI_Summary, YoY_Monthly_Trends, Bottlenecks_and_FTE_Plan, Capacity_Scenario_Plan, Filtered_Operations_Data).
    - **Export PDF Brief:**
      - Generates a multi-page landscape PDF executive brief embedding the KPI scorecard, rendered chart visuals, bottleneck action plan, monthly YoY matrix, and department FTE allocation table.
    




