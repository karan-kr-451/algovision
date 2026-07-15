"""
Auto-generates hidden testcases for our own custom problems via the
generator+oracle pattern real judges use (Codeforces/ICPC problem-setters:
a random input generator plus a known-correct reference solution as the
oracle — no hand-typing per case). Only usable where we have a verified-
correct reference solution ourselves; ingested problems (Codeforces) don't
qualify since nobody here solved those — see spec §6.6a.

Each generator retries until it produces an input satisfying the problem's
own stated constraints (e.g. Two Sum's "only one valid answer"). Dedups
against args already present so re-running is safe.

Usage: python ingestion/gen_testcases.py [count_per_problem]
"""
import json
import random
import sys

from psycopg2.extras import Json

from common import get_connection

SEED = 20260715  # fixed seed: generated sets are reproducible, not one-off noise
COUNT_PER_PROBLEM = int(sys.argv[1]) if len(sys.argv) > 1 else 8


# ---- oracles (verified-correct reference solutions, same ones already
# submitted and accepted against the hand-written testcases) ----

def oracle_two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return None


def oracle_valid_parentheses(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack


def oracle_reverse_list(values):
    return values[::-1]


def oracle_level_order(values):
    if not values:
        return []
    result, level = [], [0]
    while level:
        vals, nxt = [], []
        for i in level:
            if i < len(values) and values[i] is not None:
                vals.append(values[i])
                nxt.extend([2 * i + 1, 2 * i + 2])
        if vals:
            result.append(vals)
        level = nxt
    return result


def oracle_climbing_stairs(n):
    a, b = 1, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b


def oracle_a_plus_b(a, b):
    return a + b


# ---- generators: produce a random valid input, retrying on constraint
# violations (e.g. non-unique Two Sum answer) ----

def gen_two_sum(rng):
    for _ in range(50):
        n = rng.randint(2, 9)
        nums = [rng.randint(-30, 30) for _ in range(n)]
        i, j = rng.sample(range(n), 2)
        target = nums[i] + nums[j]
        pair_count = sum(
            1 for a in range(n) for b in range(a + 1, n) if nums[a] + nums[b] == target
        )
        if pair_count == 1:
            expected = oracle_two_sum(nums, target)
            return {"args": [nums, target], "expected": expected}
    return None


def gen_valid_parentheses(rng):
    length = rng.randint(1, 10)
    s = "".join(rng.choice("()[]{}") for _ in range(length))
    return {"args": [s], "expected": oracle_valid_parentheses(s)}


def gen_reverse_list(rng):
    n = rng.randint(0, 9)
    values = [rng.randint(-100, 100) for _ in range(n)]
    return {"args": [values], "expected": oracle_reverse_list(values)}


def gen_level_order(rng):
    n = rng.randint(0, 10)
    values = [rng.randint(-50, 50) if rng.random() > 0.2 else None for _ in range(n)]
    if values and values[0] is None:
        values[0] = rng.randint(-50, 50)  # a null root just means an empty tree
    return {"args": [values], "expected": oracle_level_order(values)}


def gen_climbing_stairs(rng):
    n = rng.randint(1, 45)
    return {"input": f"{n}\n", "output": f"{oracle_climbing_stairs(n)}\n"}


def gen_a_plus_b(rng):
    a = rng.randint(-10**9, 10**9)
    b = rng.randint(-10**9, 10**9)
    return {"input": f"{a} {b}\n", "output": f"{oracle_a_plus_b(a, b)}\n"}


GENERATORS = {
    "Two Sum": gen_two_sum,
    "Valid Parentheses": gen_valid_parentheses,
    "Reverse Linked List": gen_reverse_list,
    "Binary Tree Level Order Traversal": gen_level_order,
    "Climbing Stairs": gen_climbing_stairs,
    "A Plus B": gen_a_plus_b,
}


def dedup_key(tc):
    return json.dumps(tc.get("args", tc.get("input")), sort_keys=True)


def main():
    rng = random.Random(SEED)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for title, generator in GENERATORS.items():
                cur.execute("SELECT id, testcases FROM problems WHERE title = %s", (title,))
                row = cur.fetchone()
                if not row:
                    print(f"skip {title}: not found")
                    continue
                problem_id, existing = row
                seen = {dedup_key(tc) for tc in existing}

                new_cases = []
                attempts = 0
                while len(new_cases) < COUNT_PER_PROBLEM and attempts < COUNT_PER_PROBLEM * 20:
                    attempts += 1
                    tc = generator(rng)
                    if tc is None:
                        continue
                    key = dedup_key(tc)
                    if key in seen:
                        continue
                    seen.add(key)
                    new_cases.append(tc)

                if not new_cases:
                    print(f"{title}: no new cases generated")
                    continue

                cur.execute(
                    "UPDATE problems SET testcases = testcases || %s::jsonb WHERE id = %s",
                    (Json(new_cases), problem_id),
                )
                print(f"{title}: added {len(new_cases)} generated cases")
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
