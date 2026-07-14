"""
Drives a real Chromium browser against the running stack: opens a problem page,
types a traceable solution into Monaco, and verifies BOTH trigger paths from
spec §2.1 — explicit Visualize click AND debounced live-while-typing — render
real trace frames. Also exercises auto-play and the timeline scrubber.

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

ARRAY_CODE = """nums = [3, 1, 4, 1, 5]
total = 0
for i in range(5):
    total += nums[i]
"""

TREE_CODE = """class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

root = TreeNode(1, TreeNode(2), TreeNode(3))
x = root.val
"""


def get_problem_id(title):
    with urllib.request.urlopen(f"{PROBLEM_API}/problems") as resp:
        problems = json.load(resp)
    return next(p["id"] for p in problems if p["title"] == title)


def set_editor(page, code):
    page.evaluate(
        """(code) => {
            const models = window.monaco?.editor?.getModels?.() ?? [];
            if (models.length) models[0].setValue(code);
        }""",
        code,
    )


def main():
    problem_id = get_problem_id("Two Sum")
    failures = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.goto(f"{FRONTEND}/problems/{problem_id}", wait_until="networkidle")

        if not page.locator("h1", has_text="Two Sum").count():
            failures.append("problem title missing")

        page.wait_for_selector(".monaco-editor", timeout=20000)
        editor_text = page.locator(".view-lines").first.inner_text().replace(" ", " ")
        if "def twoSum" not in editor_text:
            failures.append("starter code not prefilled in Monaco")

        # --- Scenario 1: live-while-typing. Setting editor content counts as
        # typing; after the debounce a background trace should stream in with
        # NO Visualize click.
        set_editor(page, ARRAY_CODE)
        try:
            page.wait_for_selector("input[type=range]", timeout=90000)
            print("live-typing: frames appeared without clicking Visualize")
        except Exception:
            failures.append("live-typing produced no frames (timeline never appeared)")
        page.screenshot(path="live_typing.png")

        # --- Scenario 2: pointer overlay. The array code has i indexing nums —
        # a pointer chip should appear once trace completes.
        page.wait_for_timeout(2000)
        if page.locator("text=▲ i").count():
            print("pointer overlay: chip for i rendered under nums")
        else:
            failures.append("pointer chip for i not found")

        # --- Scenario 3: auto-play at 5x.
        play = page.get_by_role("button", name="Play")
        if play.count():
            page.locator("select[aria-label='Playback speed']").select_option("5")
            start = page.locator("text=/step \\d+/").first.inner_text()
            play.click()
            page.wait_for_timeout(1500)
            after = page.locator("text=/step \\d+/").first.inner_text()
            if start == after:
                failures.append(f"auto-play did not advance (stuck at {start})")
            else:
                print(f"auto-play: advanced {start} -> {after}")
        else:
            failures.append("play button missing")

        # --- Scenario 4: syntax-error typing keeps last good trace + shows note.
        set_editor(page, "for i in ran")
        page.wait_for_timeout(2000)
        if not page.locator("input[type=range]").count():
            failures.append("visualization blanked out on syntax error (must keep last good trace)")
        if page.locator("text=/syntax error/").count():
            print("live-typing: syntax-error note shown, last trace retained")
        else:
            failures.append("syntax-error note not shown")

        # --- Scenario 5: SVG tree layout via explicit Visualize on tree code.
        set_editor(page, TREE_CODE)
        page.get_by_role("button", name="Visualize").click()
        try:
            page.wait_for_selector("svg circle", timeout=120000)
            print(f"tree layout: {page.locator('svg circle').count()} SVG nodes rendered")
        except Exception:
            failures.append("binary tree SVG never rendered")
        page.wait_for_timeout(1000)
        page.screenshot(path="tree_layout.png")

        browser.close()

    if failures:
        print("FAILURES:")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("UI VERIFICATION PASSED — screenshots: live_typing.png, tree_layout.png")


if __name__ == "__main__":
    main()
