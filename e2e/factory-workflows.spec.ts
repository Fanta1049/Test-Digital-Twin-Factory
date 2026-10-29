import { expect, test } from "@playwright/test";

test.describe("FantaFac Smart Production Assistant — Critical End-to-End Workflows", () => {
  test("executes all 7 core factory workflows and verifies dashboard & persistence updates", async ({
    page,
  }) => {
    // 0. Open Dashboard and capture initial baseline total produced
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Shop-Floor Operations Dashboard" })
    ).toBeVisible();

    const kpiProducedCard = page.getByTestId("kpi-total-produced");
    await expect(kpiProducedCard).toContainText("3,858");

    // 1. Create a production work order
    await page.goto("/work-orders");
    await page.getByTestId("open-create-wo-btn").click();
    await page.getByTestId("wo-quantity-input").fill("1600");
    await page.getByTestId("wo-priority-select").selectOption("Critical");
    await page
      .getByTestId("wo-notes-input")
      .fill("E2E automated test packaging order");
    await page.getByTestId("submit-create-wo-btn").click();

    await expect(page.getByTestId("wo-row-WO-2026-105")).toBeVisible();
    await expect(page.getByTestId("wo-row-WO-2026-105")).toContainText("1,600");

    // 2. Record production output against the new work order
    await page.goto("/production");
    await page.getByTestId("prod-wo-select").selectOption("WO-2026-105");
    await page.getByTestId("prod-good-input").fill("400");
    await page.getByTestId("prod-defect-input").fill("10");
    await page.getByTestId("prod-notes-input").fill("E2E shift output entry");
    await page.getByTestId("submit-prod-output-btn").click();

    await expect(page.getByTestId("prod-record-PRC-1007")).toBeVisible();
    await expect(page.getByTestId("prod-record-PRC-1007")).toContainText("410");

    // 3. Report a machine breakdown
    await page.goto("/maintenance");
    await page.getByTestId("open-report-breakdown-btn").click();
    await page.getByTestId("breakdown-machine-select").selectOption("MCH-STA-D");
    await page
      .getByTestId("breakdown-category-select")
      .selectOption("Servo Drive Overload");
    await page.getByTestId("breakdown-severity-select").selectOption("Critical");
    await page
      .getByTestId("breakdown-description-input")
      .fill("Delta pick-and-place axis Z servo overload fault during E2E test.");
    await page.getByTestId("submit-breakdown-btn").click();

    await expect(page.getByTestId("mnt-card-MNT-2004")).toBeVisible();

    // 4. Assign and resolve the maintenance request (Open -> Assigned -> Resolved)
    await page.getByTestId("mnt-card-MNT-2004").click();
    await page.getByTestId("mnt-next-status-select").selectOption("Assigned");
    await page.getByTestId("mnt-assignee-select").selectOption("Devon Vance");
    await page.getByTestId("submit-mnt-update-btn").click();
    await expect(page.getByTestId("mnt-card-MNT-2004")).toContainText(
      "Assigned"
    );

    await page.getByTestId("mnt-next-status-select").selectOption("Resolved");
    await page
      .getByTestId("mnt-root-cause-input")
      .fill("Misaligned partition insert caused gripper over-torque.");
    await page
      .getByTestId("mnt-corrective-action-input")
      .fill("Cleared partition guide, homed Z-axis, verified 20 test cycles.");
    await page.getByTestId("submit-mnt-update-btn").click();

    await expect(page.getByTestId("mnt-card-MNT-2004")).toContainText(
      "Resolved"
    );

    // 5. Record a quality defect inspection
    await page.goto("/quality");
    await page.getByTestId("qa-wo-select").selectOption("WO-2026-105");
    await page.getByTestId("qa-batch-input").fill("BCH-E2E-99");
    await page.getByTestId("qa-sample-input").fill("100");
    await page.getByTestId("qa-defect-qty-input").fill("8");
    await page
      .getByTestId("qa-defect-category-select")
      .selectOption("Packaging seal failure");
    await page
      .getByTestId("qa-notes-input")
      .fill("8% defect rate exceeds 2.5% AQL threshold");
    await page.getByTestId("submit-qa-inspection-btn").click();

    await expect(page.getByTestId("qa-row-QA-5006")).toBeVisible();
    await expect(page.getByTestId("qa-row-QA-5006")).toContainText("Fail");

    // 6. Verify that Dashboard data updated from shared application state AND persists after page reload
    await page.goto("/dashboard");
    // 3,858 initial + 410 newly recorded (400 good + 10 defective) = 4,268 total produced
    await expect(page.getByTestId("kpi-total-produced")).toContainText("4,268");
    await page.reload();
    await expect(page.getByTestId("kpi-total-produced")).toContainText("4,268");

    // 7. Run and pause the Digital Twin simulation & inspect stations
    await page.goto("/digital-twin");
    await expect(page.getByTestId("sim-status-badge")).toContainText("IDLE");

    await page.getByTestId("sim-speed-4x").click();
    await page.getByTestId("sim-start-btn").click();
    await expect(page.getByTestId("sim-status-badge")).toContainText("RUNNING");

    // Allow simulation loop to advance at least 1 tick
    await page.waitForTimeout(700);
    await page.getByTestId("sim-pause-btn").click();
    await expect(page.getByTestId("sim-status-badge")).toContainText("PAUSED");

    const clockText = await page.getByTestId("sim-clock-value").textContent();
    expect(parseFloat(clockText || "0")).toBeGreaterThan(0);

    // Click Station E selector and verify synchronized station inspector updates
    await page.getByTestId("select-station-MCH-STA-E").click();
    await expect(page.getByTestId("selected-station-panel")).toContainText(
      "Station E"
    );
  });
});
