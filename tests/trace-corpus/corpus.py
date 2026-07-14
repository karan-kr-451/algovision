"""
Trace-pipeline test corpus: one representative script per Tier-1 shape family
(spec §6.4). The visualization is shape-driven, so the 200+ pattern taxonomy
collapses to these shape families for classifier testing — e.g. Two Pointers,
Sliding Window, Kadane and Dutch National Flag all exercise the same
array-with-index-pointers shape.

Each entry: (name, expected_renderers_that_must_appear, code).
Scripts are deliberately tiny — each trace step costs several real DAP
round-trips (see driver.py), so inputs are minimal while still exercising
the target shape.
"""

CORPUS = [
    # ---- 1. Arrays (traversal / two pointers / sliding window / Kadane / prefix sum share this shape)
    ("array_two_pointers", {"array"}, """\
nums = [1, 3, 5, 7, 9]
left, right = 0, 4
while left < right:
    total = nums[left] + nums[right]
    left += 1
    right -= 1
"""),
    ("array_kadane", {"array"}, """\
nums = [-2, 3, -1, 4]
best = cur = nums[0]
for i in range(1, 4):
    cur = max(nums[i], cur + nums[i])
    best = max(best, cur)
"""),
    ("array_prefix_sum", {"array"}, """\
nums = [2, 4, 6]
prefix = [0]
for n in nums:
    prefix.append(prefix[-1] + n)
"""),
    # ---- 2. Strings (sliding window over string)
    ("string_sliding_window", {"array", "scalar"}, """\
s = "abcabc"
seen = []
best = 0
for ch in s:
    if ch in seen:
        seen = seen[seen.index(ch) + 1:]
    seen.append(ch)
    best = max(best, len(seen))
"""),
    # ---- 3. Hashing (frequency counter dict)
    ("hashmap_freq_counter", {"hashmap"}, """\
s = "aabbc"
freq = {}
for ch in s:
    freq[ch] = freq.get(ch, 0) + 1
"""),
    # ---- 4. Stack (monotonic stack / next greater element)
    ("monotonic_stack", {"array"}, """\
nums = [2, 1, 3]
stack = []
result = [-1, -1, -1]
for i in range(3):
    while stack and nums[stack[-1]] < nums[i]:
        result[stack.pop()] = nums[i]
    stack.append(i)
"""),
    # ---- 5. Queue & Deque (sliding window maximum shape)
    ("deque_queue", {"queue"}, """\
from collections import deque
q = deque()
for i in [1, 2, 3]:
    q.append(i)
q.popleft()
"""),
    # ---- 6. Linked List (fast & slow pointer)
    ("linked_list_fast_slow", {"linked_list"}, """\
class Node:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

head = Node(1, Node(2, Node(3)))
slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
"""),
    # ---- 7. Trees (BFS level order)
    ("binary_tree_bfs", {"binary_tree"}, """\
class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

root = TreeNode(1, TreeNode(2), TreeNode(3))
order = []
queue = [root]
while queue:
    node = queue.pop(0)
    order.append(node.val)
    if node.left:
        queue.append(node.left)
    if node.right:
        queue.append(node.right)
"""),
    # ---- 8. Binary Search
    ("binary_search", {"array", "scalar"}, """\
nums = [1, 3, 5, 7, 9]
target = 7
lo, hi = 0, 4
while lo <= hi:
    mid = (lo + hi) // 2
    if nums[mid] == target:
        break
    elif nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
"""),
    # ---- 9. Recursion & Backtracking (subsets, choose-explore-unchoose)
    ("backtracking_subsets", {"array"}, """\
def subsets(nums, i, cur, out):
    if i == len(nums):
        out.append(cur[:])
        return
    subsets(nums, i + 1, cur, out)
    cur.append(nums[i])
    subsets(nums, i + 1, cur, out)
    cur.pop()

out = []
subsets([1, 2], 0, [], out)
"""),
    # ---- 10. Heap
    ("heap_push_pop", {"array"}, """\
import heapq
h = []
for x in [5, 1, 4]:
    heapq.heappush(h, x)
smallest = heapq.heappop(h)
"""),
    # ---- 11. Graphs (BFS over adjacency dict)
    ("graph_bfs", {"graph"}, """\
graph = {0: [1, 2], 1: [2], 2: []}
visited = []
queue = [0]
while queue:
    node = queue.pop(0)
    if node in visited:
        continue
    visited.append(node)
    for nxt in graph[node]:
        queue.append(nxt)
"""),
    # ---- 12. Trie (nested dict insert/search)
    ("trie_insert", {"hashmap", "object"}, """\
trie = {}
for word in ["ab", "ac"]:
    node = trie
    for ch in word:
        node = node.setdefault(ch, {})
    node["$"] = True
"""),
    # ---- 13. DP (2D grid)
    ("dp_2d_grid", {"dp_table"}, """\
dp = [[0] * 3 for _ in range(2)]
for i in range(2):
    for j in range(3):
        if i == 0 or j == 0:
            dp[i][j] = 1
        else:
            dp[i][j] = dp[i-1][j] + dp[i][j-1]
"""),
    # ---- 13b. DP (1D — coin change / climbing stairs shape)
    ("dp_1d", {"array"}, """\
dp = [1, 1, 0, 0]
for i in range(2, 4):
    dp[i] = dp[i-1] + dp[i-2]
"""),
    # ---- 14. Greedy (interval scheduling — sorted tuples)
    ("greedy_intervals", {"array"}, """\
intervals = [[1, 3], [2, 4], [5, 6]]
intervals.sort(key=lambda x: x[1])
count = 0
end = 0
for s, e in intervals:
    if s >= end:
        count += 1
        end = e
"""),
    # ---- 15. Bit Manipulation
    ("bit_xor", {"scalar"}, """\
nums = [4, 1, 2, 1, 2]
result = 0
for n in nums:
    result ^= n
"""),
    # ---- 16. Sorting (insertion sort — in-place array mutation)
    ("insertion_sort", {"array"}, """\
nums = [3, 1, 2]
for i in range(1, 3):
    key = nums[i]
    j = i - 1
    while j >= 0 and nums[j] > key:
        nums[j + 1] = nums[j]
        j -= 1
    nums[j + 1] = key
"""),
    # ---- Recursion depth tracking (fib)
    ("recursion_fib", {"scalar"}, """\
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

result = fib(3)
"""),
    # ---- Tier 2 (Phase 4): trie as dedicated renderer
    ("tier2_trie", {"trie"}, """\
trie = {}
for word in ["ab", "ac"]:
    node = trie
    for ch in word:
        node = node.setdefault(ch, {})
    node["$"] = True
"""),
    # ---- Tier 2 (Phase 4): weighted graph (Dijkstra-style adjacency)
    ("tier2_weighted_graph", {"weighted_graph"}, """\
graph = {0: {1: 4, 2: 1}, 1: {2: 2}, 2: {}}
dist = {0: 0}
for node in [0, 1, 2]:
    for nbr, w in graph.get(node, {}).items():
        cand = dist.get(node, 99) + w
        if cand < dist.get(nbr, 99):
            dist[nbr] = cand
"""),
]
