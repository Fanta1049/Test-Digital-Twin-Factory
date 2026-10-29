import { NextRequest, NextResponse } from "next/server";
import {
  Machine,
  MaintenanceRequest,
  PackagingMaterial,
  ProductionRecord,
  QualityInspection,
  ShiftHandoverReport,
  WorkOrder,
} from "@/lib/domain/types";

interface FactoryContextSnapshot {
  machines: Machine[];
  workOrders: WorkOrder[];
  productionRecords: ProductionRecord[];
  maintenanceRequests: MaintenanceRequest[];
  qualityInspections: QualityInspection[];
  materials: PackagingMaterial[];
  shiftHandovers: ShiftHandoverReport[];
}

const SOP_LIBRARY: Record<
  string,
  { title: string; machineType: string; steps: string[] }
> = {
  "SOP-PKG-101": {
    title: "SOP-PKG-101: Infeed Rotary Collator Jam & Timing Recovery",
    machineType: "Product Feeding (Station A)",
    steps: [
      "1. Engage E-Stop and verify zero motion on rotary star-wheel.",
      "2. Clear jammed container from infeed guide rails using non-marring removal tool.",
      "3. Check photo-eye PE-101 alignment and clean reflector surface.",
      "4. Jog drive to home index mark and resume auto cycle.",
    ],
  },
  "SOP-QC-204": {
    title: "SOP-QC-204: Vision Checkweigher & Optical Camera Calibration",
    machineType: "Quality Inspection (Station B)",
    steps: [
      "1. Place certified 500g test mass on dynamic weigh platter to verify zero & span.",
      "2. Wipe ring-light diffuser and camera lens with optical-grade alcohol swab.",
      "3. Run 3 test cartons (Good, Skewed Label, Underweight) to verify pneumatic reject pusher timing.",
    ],
  },
  "SOP-PKG-308": {
    title: "SOP-PKG-308: Servo Carton Erector Vacuum Manifold & Suction Cup Service",
    machineType: "Box Forming (Station C)",
    steps: [
      "1. Apply LOTO on pneumatic supply valve V-301 and bleed residual air.",
      "2. Inspect Venturi vacuum generator filter cartridge for cardboard dust restriction.",
      "3. Check all 6 silicone bellows suction cups for edge tears; replace if vacuum gauge reads above -0.50 bar.",
      "4. Verify blank magazine side guides have 1.5mm clearance for current carton lot.",
    ],
  },
  "SOP-ROB-412": {
    title: "SOP-ROB-412: Delta Pick-and-Place Gripper Over-Torque Recovery",
    machineType: "Packing (Station D)",
    steps: [
      "1. Switch cell safety key to Manual Teach mode.",
      "2. Raise delta end-effector +150mm in Z-axis and inspect partition insert alignment.",
      "3. Reset servo drive fault code on HMI panel and verify home calibration pin.",
    ],
  },
  "SOP-PKG-515": {
    title: "SOP-PKG-515: Hot-Melt Adhesive Nozzle Purge & Temperature Fault",
    machineType: "Sealing and Finished Goods (Station E)",
    steps: [
      "1. Wear thermal PPE (heat-resistant gloves and face shield).",
      "2. Verify manifold temperature is stabilized at 165C-172C.",
      "3. Trigger manual solenoid purge into catch tray; clean 0.4mm nozzle tip with brass brush.",
      "4. Inspect inline adhesive filter screen and verify fiber-tear bond on 3 sample cases.",
    ],
  },
  "SOP-THM-210": {
    title: "SOP-THM-210: Thermal Shrink Tunnel Heater Bank & Thermocouple Replacement",
    machineType: "Sealing and Finished Goods (Line 2 Station B2)",
    steps: [
      "1. Allow tunnel chamber to cool below 50C before opening side access panels.",
      "2. Apply LOTO on 400V 3-phase heater breaker CB-210.",
      "3. Test heating element resistance (nominal 28 Ohms) and Type-K thermocouple continuity.",
      "4. Replace faulted probe, torque terminal block, and verify PID loop stabilization at 160C.",
    ],
  },
};

/**
 * Grounded Deterministic Factory Analyst
 * Computes exact answers strictly from the live authorized application state snapshot.
 */
function generateGroundedDeterministicAnswer(
  query: string,
  snapshot: FactoryContextSnapshot
): {
  answer: string;
  citations: string[];
  providerMode: "Grounded Deterministic Engine (Demo Mode)" | "Configured LLM Provider";
} {
  const q = query.toLowerCase();
  const citations: string[] = [];

  // 1. Safety / destructive operation guard
  if (
    q.includes("override safety") ||
    q.includes("bypass interlock") ||
    q.includes("delete all") ||
    q.includes("force start")
  ) {
    return {
      answer:
        "Safety & Authorization Guard: As an advisory AI Production Assistant, I cannot directly execute destructive actions, force-start faulted machinery, or override LOTO / safety interlocks. To change a machine status or clear a breakdown interlock, an authorized Maintenance Technician or Supervisor must complete the workflow in the Maintenance or Machine Monitoring module with an audited reason.",
      citations: ["Policy: RBAC & Machine Safety Interlock"],
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
    };
  }

  // 2. Production drop / hourly performance analysis
  if (
    q.includes("drop") ||
    q.includes("slow") ||
    q.includes("behind target") ||
    q.includes("shift performance")
  ) {
    const records = [...snapshot.productionRecords];
    const lowestRecord = records.sort(
      (a, b) => a.goodQuantity - b.goodQuantity
    )[0];
    const openBreakdowns = snapshot.maintenanceRequests.filter(
      (m) => m.status !== "Closed" && m.status !== "Resolved"
    );
    const degradedMachines = snapshot.machines.filter(
      (m) => m.status !== "Running" && m.status !== "Idle"
    );

    if (lowestRecord) citations.push(`ProductionRecord: ${lowestRecord.id}`);
    openBreakdowns.forEach((b) => citations.push(`MaintenanceRequest: ${b.id}`));

    return {
      answer: [
        "### Shift Production Drop Analysis (Grounded in Live Factory Data)",
        lowestRecord
          ? `- **Lowest Hourly Output**: Slot **${lowestRecord.hourSlot}** on **${lowestRecord.lineId}** recorded **${lowestRecord.goodQuantity} good units** (${lowestRecord.defectiveQuantity} defective) — Note: *"${lowestRecord.notes || "No operator note"}"*.`
          : "- No hourly production records found for the current filter.",
        `- **Active Machine Contributors (${degradedMachines.length})**:`,
        ...degradedMachines.map(
          (m) =>
            `  - **${m.name} (${m.stationCode})**: Status **${m.status}** (${m.downtimeMinutesToday} min downtime today)`
        ),
        `- **Active Maintenance Tickets (${openBreakdowns.length})**:`,
        ...openBreakdowns.map(
          (b) =>
            `  - **${b.id}** (${b.machineId} — ${b.category}, Severity: ${b.severity}, Status: ${b.status}): ${b.description}`
        ),
      ].join("\n"),
      citations,
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
    };
  }

  // 3. Downtime ranking
  if (q.includes("downtime") || q.includes("most downtime")) {
    const sortedMachines = [...snapshot.machines].sort(
      (a, b) => b.downtimeMinutesToday - a.downtimeMinutesToday
    );
    const totalDowntime = sortedMachines.reduce(
      (acc, m) => acc + m.downtimeMinutesToday,
      0
    );
    sortedMachines.slice(0, 3).forEach((m) => citations.push(`Machine: ${m.id}`));

    return {
      answer: [
        `### Machine Downtime Ranking (Total Today: ${totalDowntime} min)`,
        ...sortedMachines.map(
          (m, idx) =>
            `${idx + 1}. **${m.name}** (\`${m.id}\` / ${m.stationCode}) — **${m.downtimeMinutesToday} min** | Current Status: **${m.status}** | Output: ${m.goodQuantity.toLocaleString()} good / ${m.defectQuantity} scrap`
        ),
      ].join("\n"),
      citations,
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
    };
  }

  // 4. Unresolved issues for next shift / handover summary
  if (
    q.includes("unresolved") ||
    q.includes("next shift") ||
    q.includes("handover") ||
    q.includes("summarize")
  ) {
    const openMaint = snapshot.maintenanceRequests.filter(
      (m) => m.status !== "Closed"
    );
    const failedQa = snapshot.qualityInspections.filter(
      (i) => i.result === "Fail" || i.result === "Hold"
    );
    const lowStock = snapshot.materials.filter(
      (m) => m.quantityAvailable <= m.reorderThreshold
    );
    const unackedHandovers = snapshot.shiftHandovers.filter(
      (h) => !h.acknowledgedBy
    );

    openMaint.forEach((m) => citations.push(`Maintenance: ${m.id}`));
    failedQa.forEach((qa) => citations.push(`Quality: ${qa.id}`));
    lowStock.forEach((mat) => citations.push(`Material: ${mat.code}`));

    return {
      answer: [
        "### Unresolved Operational Issues for Incoming Shift",
        `**1. Open Maintenance & Breakdowns (${openMaint.length})**`,
        ...(openMaint.length > 0
          ? openMaint.map(
              (m) =>
                `- **${m.id}** on \`${m.machineId}\` [${m.status}, ${m.severity}]: ${m.description} (Assigned: ${m.assignedTo || "Unassigned"})`
            )
          : ["- No open maintenance tickets."]),
        "",
        `**2. Quality Holds & Failed Inspections (${failedQa.length})**`,
        ...(failedQa.length > 0
          ? failedQa.map(
              (qa) =>
                `- **${qa.id}** Batch \`${qa.batchNumber}\` (${qa.defectCategory}): ${qa.defectQuantity}/${qa.sampleSize} defects (${((qa.defectQuantity / qa.sampleSize) * 100).toFixed(2)}%) — Result: **${qa.result}**`
            )
          : ["- All recent inspections passed."]),
        "",
        `**3. Low Packaging Material Inventory (${lowStock.length})**`,
        ...(lowStock.length > 0
          ? lowStock.map(
              (mat) =>
                `- **${mat.code}** (${mat.name}): **${mat.quantityAvailable} ${mat.unit}** remaining (Reorder Threshold: ${mat.reorderThreshold} ${mat.unit})`
            )
          : ["- All packaging materials above reorder threshold."]),
        "",
        `**4. Unacknowledged Shift Handovers (${unackedHandovers.length})**`,
        ...(unackedHandovers.length > 0
          ? unackedHandovers.map(
              (h) =>
                `- **${h.id}** (${h.outgoingShift} -> ${h.incomingShift}) authored by ${h.author} requires incoming sign-off.`
            )
          : ["- All shift handovers acknowledged."]),
      ].join("\n"),
      citations,
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
    };
  }

  // 5. Packaging defects / Pareto
  if (q.includes("defect") || q.includes("quality") || q.includes("scrap")) {
    const byCategory: Record<string, number> = {};
    let totalSampled = 0;
    let totalDefects = 0;

    for (const insp of snapshot.qualityInspections) {
      totalSampled += insp.sampleSize;
      totalDefects += insp.defectQuantity;
      if (insp.defectQuantity > 0 && insp.defectCategory !== "None") {
        byCategory[insp.defectCategory] =
          (byCategory[insp.defectCategory] || 0) + insp.defectQuantity;
      }
      citations.push(`Inspection: ${insp.id}`);
    }

    const sortedCategories = Object.entries(byCategory).sort(
      (a, b) => b[1] - a[1]
    );
    const overallRate =
      totalSampled > 0 ? ((totalDefects / totalSampled) * 100).toFixed(2) : "0.00";

    return {
      answer: [
        `### Packaging Defect Breakdown (Sampled Rate: ${overallRate}% across ${totalSampled} inspected units)`,
        ...sortedCategories.map(
          ([cat, count], idx) =>
            `${idx + 1}. **${cat}** — **${count} defective units** (${totalDefects > 0 ? ((count / totalDefects) * 100).toFixed(1) : 0}% of logged inspection defects)`
        ),
        "",
        "Most recent Fail/Hold batches:",
        ...snapshot.qualityInspections
          .filter((i) => i.result !== "Pass")
          .map(
            (i) =>
              `- **${i.batchNumber}** on \`${i.machineId}\`: ${i.defectQuantity}/${i.sampleSize} (${i.defectCategory}) — *${i.notes}*`
          ),
      ].join("\n"),
      citations,
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
    };
  }

  // 6. Troubleshooting procedure / SOP lookup
  if (
    q.includes("troubleshooting") ||
    q.includes("procedure") ||
    q.includes("sop") ||
    q.includes("station") ||
    q.includes("machine")
  ) {
    // Match specific station or return relevant SOPs for degraded machines
    const matchedMachine = snapshot.machines.find(
      (m) =>
        q.includes(m.id.toLowerCase()) ||
        q.includes(m.stationCode.toLowerCase()) ||
        q.includes(m.name.toLowerCase())
    );

    const targetMachines = matchedMachine
      ? [matchedMachine]
      : snapshot.machines.filter((m) => m.status !== "Running");

    const blocks: string[] = [
      "### Approved Standard Operating & Troubleshooting Procedures (SOP)",
    ];

    for (const m of targetMachines.length > 0
      ? targetMachines
      : snapshot.machines.slice(0, 2)) {
      const sop = SOP_LIBRARY[m.sopCode];
      citations.push(`Machine: ${m.id} (${m.sopCode})`);
      if (sop) {
        blocks.push(
          `\n**${m.name} (\`${m.id}\` | Status: ${m.status}) — ${sop.title}**`,
          ...sop.steps
        );
      }
    }

    return {
      answer: blocks.join("\n"),
      citations,
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
    };
  }

  // Default comprehensive operational summary
  const activeWo = snapshot.workOrders.filter((w) => w.status === "In Progress");
  const totalGood = snapshot.workOrders.reduce((s, w) => s + w.goodQuantity, 0);
  const totalScrap = snapshot.workOrders.reduce(
    (s, w) => s + w.defectiveQuantity,
    0
  );

  return {
    answer: [
      "### Live Factory Operational Summary",
      `- **Active Work Orders**: ${activeWo.map((w) => `${w.id} (${w.goodQuantity}/${w.plannedQuantity} good)`).join(", ") || "None"}`,
      `- **Cumulative Work Order Output**: **${totalGood.toLocaleString()} good units** | **${totalScrap.toLocaleString()} defective units**`,
      `- **Machine Fleet Status**: ${snapshot.machines.filter((m) => m.status === "Running").length} Running, ${snapshot.machines.filter((m) => m.status === "Warning").length} Warning, ${snapshot.machines.filter((m) => m.status === "Error").length} Error, ${snapshot.machines.filter((m) => m.status === "Maintenance").length} Maintenance`,
      "",
      "You can ask specific questions such as:",
      '- *"What caused the production drop this shift?"*',
      '- *"Which machines had the most downtime this week?"*',
      '- *"Summarize the unresolved issues for the next shift."*',
      '- *"Show the most common packaging defects."*',
      '- *"Find the approved troubleshooting procedure for Station C."*',
    ].join("\n"),
    citations: ["Store: Live Factory Snapshot"],
    providerMode: "Grounded Deterministic Engine (Demo Mode)",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const snapshot = body.snapshot as FactoryContextSnapshot | undefined;

    if (!query) {
      return NextResponse.json(
        { error: "Query message is required." },
        { status: 400 }
      );
    }

    if (!snapshot || !Array.isArray(snapshot.machines)) {
      return NextResponse.json(
        { error: "Authorized factory state snapshot is required for grounding." },
        { status: 400 }
      );
    }

    // Always produce grounded deterministic analysis over the exact snapshot;
    // If an external AI_PROVIDER_API_KEY is configured on the server, we can enrich or fall back safely.
    const result = generateGroundedDeterministicAnswer(query, snapshot);

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error in AI Production Assistant route.",
      },
      { status: 500 }
    );
  }
}
