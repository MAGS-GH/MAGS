import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

// Run against a dedicated, published QA tenant with two qualified staff, a
// service on the first row, and bookable days outside its change deadline.
const [origin, slug] = process.argv.slice(2);
if (!origin || !/^qa-[a-z0-9-]+$/.test(slug ?? ""))
  throw new Error("Angiv værtsnavn og en særskilt qa-salon.");
const browser = await chromium.launch();
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 820 },
  ]) {
    const page = await browser.newPage({
      viewport,
      locale: "da-DK",
      timezoneId: "Europe/Copenhagen",
    });
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(new URL("/s/" + slug, origin).href);
    await page.getByRole("heading", { name: "Vælg behandling" }).waitFor();
    await page.locator(".service-pick").first().click();
    const days = page.getByLabel("Dag", { exact: true });
    await days.locator("option").nth(3).waitFor({ state: "attached" });
    await days.selectOption({ index: 3 });
    await page.locator(".slot-grid button").first().click();
    await page.getByRole("heading", { name: "Vælg din frisør" }).waitFor();
    await page.locator(".staff-card").last().click();
    await page.getByLabel("Dit navn").fill("MAGS bookingprøve");
    await page.getByLabel("Telefonnummer").fill("+45 00000000");
    await page
      .getByRole("button", { name: "Bekræft booking", exact: true })
      .click();
    await page.getByRole("heading", { name: "Din aftale er booket" }).waitFor();
    const first = await page.locator(".receipt-lines").innerText();
    assert.ok(new URL(page.url()).hash.length > 32);
    const saved = page.waitForEvent("download");
    await page.getByRole("button", { name: "Gem i kalender" }).click();
    const file = await (await saved).path();
    assert.match(await readFile(file, "utf8"), /BEGIN:VEVENT/);
    await page.reload();
    await page.getByRole("button", { name: "Flyt aftale" }).click();
    await page.locator(".slot-grid button").last().click();
    await page.getByLabel("Dag", { exact: true }).selectOption({ index: 4 });
    assert.equal(
      await page.getByRole("button", { name: "Bekræft ny tid" }).count(),
      0,
    );
    await page.locator(".slot-grid button").last().click();
    await page.getByRole("button", { name: "Bekræft ny tid" }).click();
    await page.getByText("Din aftale er flyttet.", { exact: true }).waitFor();
    assert.notEqual(await page.locator(".receipt-lines").innerText(), first);
    await page
      .getByRole("button", { name: "Aflys aftale", exact: true })
      .click();
    await page.getByRole("button", { name: "Ja, aflys aftalen" }).click();
    await page.getByRole("heading", { name: "Aftalen er aflyst" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS ${viewport.width}px: booking, kalenderfil, genåbning, flytning og aflysning.`,
    );
  }
} finally {
  await browser.close();
}
