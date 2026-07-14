"""
Drives a real Chromium browser against the running stack: opens a problem page,
types a traceable solution into Monaco, clicks Visualize, waits for real trace
frames to render, screenshots the result, and asserts visualization elements
actually appeared in the DOM.

Prereqs: docker compose stack up, frontend dev server on :3000,
`pip install playwright && playwright install chromium`.

Usage: python verify_visualization.py
"""
import json
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

FRONTEND = "http://localhost:3000"
PROBLEM_API = "http://localhost:8002"

CODE = """nums = [3, 1, 4, 1, 5]
total = 0
for i in range(5):
    total += nums[i]
"""


def get_problem_id(title):
    with urllib.request.urlopen(f"{PROBLEM_API}/problems") as resp:
        problems = json.load(resp)
    return next(p["id"] for p in problems if p["title"] == title)


def main():
    problem_id = get_problem_id("Two Sum")
    failures = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.goto(f"{FRONTEND}/problems/{problem_id}", wait_until="networkidle")

        # Problem page basics
        if not page.locator("h1", has_text="Two Sum").count():
            failures.append("problem title missing")

        # Monaco editor loaded with starter code
        page.wait_for_selector(".monaco-editor", timeout=20000)
        # Monaco renders spaces as non-breaking spaces — normalize before matching
        editor_text = page.locator(".view-lines").first.inner_text().replace(" ", " ")
        if "def twoSum" not in editor_text:
            failures.append("starter code not prefilled in Monaco")

        # Replace editor content with a simple traceable script via Monaco's API
        page.evaluate(
            """(code) => {
                const models = window.monaco?.editor?.getModels?.() ?? [];
                if (models.length) models[0].setValue(code);
            }""",
            CODE,
        )
        time.sleep(0.5)
        if "nums" not in page.locator(".view-lines").first.inner_text().replace(" ", " "):
            failures.append("could not set editor content via monaco API")

        # Click Visualize, wait for frames to stream in from the real pipeline
        page.get_by_role("button", name="Visualize").click()
        try:
            page.wait_for_selector("input[type=range]", timeout=90000)
        except Exception:
            failures.append("timeline scrubber never appeared (no frames streamed)")

        page.wait_for_timeout(2000)
        page.screenshot(path="visualization_mid.png")

        # Array renderer: cells with values from nums should be visible
        step_label = page.locator("text=/step \\d+/")
        if not step_label.count():
            failures.append("step indicator missing")

        # Wait for trace completion (button back to 'Visualize'), then scrub timeline
        try:
            page.wait_for_selector("button:has-text('Visualize')", timeout=90000)
        except Exception:
            failures.append("trace never completed (button stuck on Tracing)")

        slider = page.locator("input[type=range]")
        if slider.count():
            frame_total = page.locator("text=/\\d+\\/\\d+/").first.inner_text()
            slider.fill("0")
            page.wait_for_timeout(300)
            first_step = page.locator("text=/step \\d+/").first.inner_text()
            page.screenshot(path="visualization_scrubbed.png")
            print(f"timeline: {frame_total}, scrubbed to: {first_step}")

        page.screenshot(path="visualization_final.png")
        browser.close()

    if failures:
        print("FAILURES:")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("UI VERIFICATION PASSED — screenshots: visualization_mid.png, visualization_scrubbed.png, visualization_final.png")


if __name__ == "__main__":
    main()
