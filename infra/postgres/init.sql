-- AlgoVision Postgres schema — Phase 1 subset of spec §5.1
-- MongoDB-shaped tables (visualization_sessions frames, notepad content) are NOT here;
-- those live in Mongo per §5.3 and are out of scope until Phase 3/5.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(255) NOT NULL,
    email         varchar(255) UNIQUE NOT NULL,
    password_hash varchar(255) NOT NULL,
    streak        int NOT NULL DEFAULT 0,
    rating        int NOT NULL DEFAULT 0,
    preferences   jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE difficulty_enum AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE visualization_tier_enum AS ENUM ('core', 'extended', 'conceptual');

CREATE TABLE problems (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title               varchar(255) NOT NULL,
    difficulty          difficulty_enum NOT NULL,
    pattern             varchar(100) NOT NULL,
    statement           text NOT NULL,
    constraints         text,
    examples            jsonb NOT NULL DEFAULT '[]',
    testcases           jsonb NOT NULL DEFAULT '[]',
    tags                text[] NOT NULL DEFAULT '{}',
    source              varchar(50) NOT NULL DEFAULT 'custom',
    visualization_tier  visualization_tier_enum NOT NULL DEFAULT 'core',
    visualization_meta  jsonb NOT NULL DEFAULT '{}',
    license             varchar(50) NOT NULL DEFAULT 'original',
    attribution_text    varchar(255),
    function_name       varchar(100),
    starter_code        text,
    hints               text[] NOT NULL DEFAULT '{}',
    follow_up           text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE solution_status_enum AS ENUM ('accepted', 'wrong_answer', 'tle', 'mle', 'runtime_error');

CREATE TABLE solutions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id),
    problem_id    uuid NOT NULL REFERENCES problems(id),
    language      varchar(50) NOT NULL,
    code          text NOT NULL,
    runtime_ms    int,
    memory_kb     int,
    status        solution_status_enum,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_progress (
    user_id       uuid NOT NULL REFERENCES users(id),
    pattern       varchar(100) NOT NULL,
    mastery_score float NOT NULL DEFAULT 0,
    attempts      int NOT NULL DEFAULT 0,
    accuracy      float NOT NULL DEFAULT 0,
    avg_speed_ms  int NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, pattern)
);

CREATE TYPE notepad_content_type_enum AS ENUM ('sketch', 'text');

CREATE TABLE notepads (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id),
    problem_id    uuid REFERENCES problems(id),   -- null = global scratchpad (spec §5.1)
    content_type  notepad_content_type_enum NOT NULL DEFAULT 'text',
    content       jsonb NOT NULL DEFAULT '{}',
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, problem_id, content_type)
);

-- streak bookkeeping: last day (UTC) an accepted submission landed
ALTER TABLE users ADD COLUMN last_accepted_date date;

CREATE INDEX idx_solutions_user_id ON solutions(user_id);
CREATE INDEX idx_solutions_problem_id ON solutions(problem_id);
CREATE INDEX idx_problems_pattern ON problems(pattern);
CREATE INDEX idx_problems_tier ON problems(visualization_tier);

-- Seed sample Tier 1 problems for the Phase 1 catalog. Two harnesses coexist:
-- function-signature (LeetCode-style — function_name/starter_code set, testcases
-- are {args, expected}) and stdin/stdout (function_name null, testcases are
-- {input, output}) — see judge-service and spec §6.6a.
INSERT INTO problems (title, difficulty, pattern, statement, constraints, examples, testcases, tags, source, visualization_tier, visualization_meta, function_name, starter_code, hints, follow_up) VALUES
('Two Sum', 'easy', 'hashing',
 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
 E'- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- -10^9 <= target <= 10^9\n- Only one valid answer exists.',
 '[{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."}, {"input": "nums = [3,2,4], target = 6", "output": "[1,2]", "explanation": null}, {"input": "nums = [3,3], target = 6", "output": "[0,1]", "explanation": null}]',
 '[{"args": [[2,7,11,15], 9], "expected": [0,1]}, {"args": [[3,2,4], 6], "expected": [1,2]}, {"args": [[3,3], 6], "expected": [0,1]}, {"args": [[2,5,5,11], 10], "expected": [1,2]}, {"args": [[0,4,3,0], 0], "expected": [0,3]}, {"args": [[-3,4,3,90], 0], "expected": [0,2]}, {"args": [[-1,-2,-3,-4,-5], -8], "expected": [2,4]}]',
 ARRAY['array','hashing'], 'custom', 'core', '{"array": true, "hashmap": true}',
 'twoSum', E'def twoSum(nums, target):\n    pass\n',
 ARRAY[
   'A really brute force way would be to search for all possible pairs of numbers, but that would be too slow.',
   'So, if we fix one of the numbers, say x, we have to scan the entire array to find the next number y = target - x. Can we change our array somehow so that this search becomes faster?',
   'Without changing the array, can we use additional space to speed up the search? A hash map lets you check whether the complement of the current number exists in O(1).'
 ],
 'Can you come up with an algorithm that is less than O(n^2) time complexity?'),
('Valid Parentheses', 'easy', 'stack',
 'Given a string s containing just the characters ()[]{}, determine if the input string is valid.',
 E'- 1 <= s.length <= 10^4\n- s consists of parentheses only ()[]{}.',
 '[{"input": "s = \"()\"", "output": "true", "explanation": null}, {"input": "s = \"()[]{}\"", "output": "true", "explanation": null}, {"input": "s = \"(]\"", "output": "false", "explanation": null}, {"input": "s = \"([)]\"", "output": "false", "explanation": "The brackets close in the wrong order — the ( opened before [ must also close after it."}]',
 '[{"args": ["()[]{}"], "expected": true}, {"args": ["(]"], "expected": false}, {"args": ["([)]"], "expected": false}, {"args": ["{[]}"], "expected": true}, {"args": ["((()))"], "expected": true}, {"args": ["]"], "expected": false}, {"args": ["([{}])"], "expected": true}, {"args": ["((("], "expected": false}]',
 ARRAY['stack','string'], 'custom', 'core', '{"stack": true}',
 'isValid', E'def isValid(s):\n    pass\n',
 ARRAY[
   'Use a stack of characters.',
   'When you encounter an opening bracket, push it onto the stack.',
   'When you encounter a closing bracket, check whether the top of the stack is the matching opening bracket. If it is, pop it; otherwise the string is invalid.'
 ], NULL),
('Reverse Linked List', 'easy', 'linked_list',
 'Given the head of a singly linked list, reverse the list, and return the reversed list. For judging, the list is passed as a Python list of values; return the reversed list of values.',
 E'- The number of nodes in the list is the range [0, 5000].\n- -5000 <= Node.val <= 5000',
 '[{"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]", "explanation": null}, {"input": "head = [1,2]", "output": "[2,1]", "explanation": null}, {"input": "head = []", "output": "[]", "explanation": null}]',
 '[{"args": [[1,2,3,4,5]], "expected": [5,4,3,2,1]}, {"args": [[1,2]], "expected": [2,1]}, {"args": [[]], "expected": []}, {"args": [[1]], "expected": [1]}, {"args": [[1,2,3]], "expected": [3,2,1]}, {"args": [[10,20,30,40,50,60]], "expected": [60,50,40,30,20,10]}, {"args": [[-1,-2,-3]], "expected": [-3,-2,-1]}]',
 ARRAY['linked_list'], 'custom', 'core', '{"linked_list": true}',
 'reverseList', E'def reverseList(values):\n    pass\n',
 '{}', 'A linked list can be reversed either iteratively or recursively. Could you implement both?'),
('Binary Tree Level Order Traversal', 'medium', 'trees',
 'Given the root of a binary tree, return the level order traversal of its nodes'' values. For judging, the tree is passed as a level-order list with None for missing nodes; return the list of levels.',
 E'- The number of nodes in the tree is in the range [0, 2000].\n- -1000 <= Node.val <= 1000',
 '[{"input": "root = [3,9,20,null,null,15,7]", "output": "[[3],[9,20],[15,7]]", "explanation": null}, {"input": "root = [1]", "output": "[[1]]", "explanation": null}, {"input": "root = []", "output": "[]", "explanation": null}]',
 '[{"args": [[3,9,20,null,null,15,7]], "expected": [[3],[9,20],[15,7]]}, {"args": [[1]], "expected": [[1]]}, {"args": [[]], "expected": []}, {"args": [[1,2,3,4,5,6,7]], "expected": [[1],[2,3],[4,5,6,7]]}, {"args": [[5,3,8,null,4,7,9]], "expected": [[5],[3,8],[4,7,9]]}, {"args": [[1,2]], "expected": [[1],[2]]}]',
 ARRAY['tree','bfs'], 'custom', 'core', '{"tree": true}',
 'levelOrder', E'def levelOrder(values):\n    pass\n', '{}', NULL),
('Climbing Stairs', 'easy', 'dp',
 'You are climbing a staircase. It takes n steps to reach the top. Each time you can climb 1 or 2 steps. In how many distinct ways can you climb to the top? Read n from stdin, print the answer.',
 E'- 1 <= n <= 45',
 '[{"input": "n = 2", "output": "2", "explanation": "There are two ways to climb to the top: 1 step + 1 step, or 2 steps."}, {"input": "n = 3", "output": "3", "explanation": "There are three ways to climb to the top: 1+1+1, 1+2, or 2+1."}]',
 '[{"input": "3\n", "output": "3\n"}, {"input": "4\n", "output": "5\n"}, {"input": "1\n", "output": "1\n"}, {"input": "5\n", "output": "8\n"}, {"input": "6\n", "output": "13\n"}, {"input": "10\n", "output": "89\n"}, {"input": "45\n", "output": "1836311903\n"}]',
 ARRAY['dp'], 'custom', 'core', '{"dp_1d": true}', NULL, NULL,
 ARRAY[
   'To reach step n, you must have come from step n-1 (then take 1 step) or step n-2 (then take 2 steps).',
   'That means the number of ways to reach step n is the sum of the ways to reach n-1 and n-2 — this is the Fibonacci recurrence.'
 ], NULL),
('A Plus B', 'easy', 'math',
 'Read two space-separated integers a and b from stdin, print their sum.',
 E'- -10^9 <= a, b <= 10^9',
 '[{"input": "1 2", "output": "3", "explanation": null}, {"input": "5 7", "output": "12", "explanation": null}, {"input": "-3 3", "output": "0", "explanation": null}]',
 '[{"input": "1 2\n", "output": "3\n"}, {"input": "5 7\n", "output": "12\n"}, {"input": "-3 3\n", "output": "0\n"}, {"input": "100 200\n", "output": "300\n"}, {"input": "-1000000000 1000000000\n", "output": "0\n"}, {"input": "999999999 1\n", "output": "1000000000\n"}, {"input": "0 0\n", "output": "0\n"}]',
 ARRAY['math'], 'custom', 'core', '{}', NULL, NULL, '{}', NULL);

-- Blind 75 batch 1 (15 problems) — see spec §6.6a: 'Blind 75' is a long-public
-- community list (not one company's paid curated product like NeetCode 150/250
-- would be), so it's catalogued here. Statements are original wording, not
-- reproduced from LeetCode. All 15 reference solutions verified via a real
-- /submissions call before being committed.
INSERT INTO problems (title, difficulty, pattern, statement, constraints, examples, testcases, tags, source, visualization_tier, visualization_meta, function_name, starter_code, hints, follow_up) VALUES

('Best Time to Buy and Sell Stock', 'easy', 'array',
 'You are given a list of daily stock prices, where the value at each position is the price on that day. You may complete at most one transaction: buy on one day and sell on a later day. Return the maximum profit you can achieve. If no profit is possible, return 0.',
 E'- 1 <= prices.length <= 10^5\n- 0 <= prices[i] <= 10^4',
 '[{"input": "prices = [7,1,5,3,6,4]", "output": "5", "explanation": "Buy on day 2 (price 1) and sell on day 5 (price 6), profit = 6 - 1 = 5."}, {"input": "prices = [7,6,4,3,1]", "output": "0", "explanation": "Prices only fall, so no transaction is profitable."}]',
 '[{"args": [[7,1,5,3,6,4]], "expected": 5}, {"args": [[7,6,4,3,1]], "expected": 0}, {"args": [[1,2]], "expected": 1}]',
 ARRAY['array','blind75'], 'blind75', 'core', '{"array": true}',
 'maxProfit', E'def maxProfit(prices):\n    pass\n',
 ARRAY['Track the lowest price seen so far as you scan left to right.', 'At each day, the best profit if you sold today is today''s price minus the lowest price seen before it.'],
 NULL),

('Contains Duplicate', 'easy', 'hashing',
 'Given a list of integers, return true if any value appears at least twice, and false if every element is distinct.',
 E'- 1 <= nums.length <= 10^5\n- -10^9 <= nums[i] <= 10^9',
 '[{"input": "nums = [1,2,3,1]", "output": "true", "explanation": "1 appears twice."}, {"input": "nums = [1,2,3,4]", "output": "false", "explanation": null}]',
 '[{"args": [[1,2,3,1]], "expected": true}, {"args": [[1,2,3,4]], "expected": false}, {"args": [[1,1,1,3,3,4,3,2,4,2]], "expected": true}]',
 ARRAY['hashing','blind75'], 'blind75', 'core', '{"hashmap": true}',
 'hasDuplicate', E'def hasDuplicate(nums):\n    pass\n',
 ARRAY['A set only keeps unique values — compare its size to the original list''s length.'],
 NULL),

('Product of Array Except Self', 'medium', 'array',
 'Given a list of integers nums, return a new list where each element at index i is the product of all elements in nums except nums[i]. You must do this without using division, and ideally in O(n) time.',
 E'- 2 <= nums.length <= 10^5\n- -30 <= nums[i] <= 30\n- The product of any prefix or suffix fits in a 32-bit integer.',
 '[{"input": "nums = [1,2,3,4]", "output": "[24,12,8,6]", "explanation": null}, {"input": "nums = [-1,1,0,-3,3]", "output": "[0,0,9,0,0]", "explanation": null}]',
 '[{"args": [[1,2,3,4]], "expected": [24,12,8,6]}, {"args": [[-1,1,0,-3,3]], "expected": [0,0,9,0,0]}, {"args": [[2,3]], "expected": [3,2]}]',
 ARRAY['array','blind75'], 'blind75', 'core', '{"array": true}',
 'productExceptSelf', E'def productExceptSelf(nums):\n    pass\n',
 ARRAY['For each index, the answer is (product of everything to its left) times (product of everything to its right).', 'Compute a running prefix-product array left to right, then fold in a running suffix-product right to left.'],
 'Can you solve it in O(n) time without using the division operation, using only the output array as extra space (not counting it)?'),

('Maximum Subarray', 'medium', 'array',
 'Given a list of integers, find the contiguous subarray (containing at least one number) with the largest sum, and return that sum.',
 E'- 1 <= nums.length <= 10^5\n- -10^4 <= nums[i] <= 10^4',
 '[{"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "The subarray [4,-1,2,1] has the largest sum, 6."}, {"input": "nums = [1]", "output": "1", "explanation": null}]',
 '[{"args": [[-2,1,-3,4,-1,2,1,-5,4]], "expected": 6}, {"args": [[1]], "expected": 1}, {"args": [[5,4,-1,7,8]], "expected": 23}]',
 ARRAY['array','blind75'], 'blind75', 'core', '{"array": true}',
 'maxSubArray', E'def maxSubArray(nums):\n    pass\n',
 ARRAY['At each position, decide whether extending the previous subarray is better than starting a new one here (Kadane''s algorithm).'],
 NULL),

('3Sum', 'medium', 'two_pointer',
 'Given a list of integers, return all unique triplets [a, b, c] such that a + b + c = 0. Each triplet''s three values must be in ascending order, and the returned list of triplets must itself be sorted in ascending order with no duplicate triplets (this fixed ordering makes the expected output unique for judging).',
 E'- 3 <= nums.length <= 3000\n- -10^5 <= nums[i] <= 10^5',
 '[{"input": "nums = [-1,0,1,2,-1,-4]", "output": "[[-1,-1,2],[-1,0,1]]", "explanation": null}, {"input": "nums = [0,1,1]", "output": "[]", "explanation": "No triplet sums to 0."}]',
 '[{"args": [[-1,0,1,2,-1,-4]], "expected": [[-1,-1,2],[-1,0,1]]}, {"args": [[0,1,1]], "expected": []}, {"args": [[0,0,0]], "expected": [[0,0,0]]}]',
 ARRAY['array','two_pointer','blind75'], 'blind75', 'core', '{"array": true}',
 'threeSum', E'def threeSum(nums):\n    pass\n',
 ARRAY['Sort the array first — this makes both skipping duplicates and the two-pointer scan possible.', 'Fix one number, then use two pointers moving inward from the two ends of the remaining sorted range to find pairs that complete the sum.'],
 NULL),

('Coin Change', 'medium', 'dp',
 'You are given a list of coin denominations and a target amount. Return the fewest number of coins needed to make up that amount using any combination of the given coins (unlimited supply of each). If the amount cannot be made up, return -1.',
 E'- 1 <= coins.length <= 12\n- 1 <= coins[i] <= 2^31 - 1\n- 0 <= amount <= 10^4',
 '[{"input": "coins = [1,2,5], amount = 11", "output": "3", "explanation": "11 = 5 + 5 + 1."}, {"input": "coins = [2], amount = 3", "output": "-1", "explanation": "3 cannot be made from only 2s."}]',
 '[{"args": [[1,2,5], 11], "expected": 3}, {"args": [[2], 3], "expected": -1}, {"args": [[1], 0], "expected": 0}]',
 ARRAY['dp','blind75'], 'blind75', 'core', '{"dp_1d": true}',
 'coinChange', E'def coinChange(coins, amount):\n    pass\n',
 ARRAY['Let dp[a] be the fewest coins needed for amount a. dp[0] = 0.', 'For each amount from 1 up to the target, try every coin and take the best dp[a - coin] + 1.'],
 NULL),

('House Robber', 'medium', 'dp',
 'You are a robber planning to rob houses along a street, where the value at each position is the amount of money in that house. You cannot rob two adjacent houses (it triggers an alarm). Return the maximum amount you can rob.',
 E'- 1 <= nums.length <= 100\n- 0 <= nums[i] <= 400',
 '[{"input": "nums = [1,2,3,1]", "output": "4", "explanation": "Rob house 0 (1) and house 2 (3): 1 + 3 = 4."}, {"input": "nums = [2,7,9,3,1]", "output": "12", "explanation": "Rob houses 0, 2, and 4: 2 + 9 + 1 = 12."}]',
 '[{"args": [[1,2,3,1]], "expected": 4}, {"args": [[2,7,9,3,1]], "expected": 12}, {"args": [[5]], "expected": 5}]',
 ARRAY['dp','blind75'], 'blind75', 'core', '{"dp_1d": true}',
 'rob', E'def rob(nums):\n    pass\n',
 ARRAY['At each house, you either skip it (keep the best total so far) or rob it (best total from two houses back, plus this house''s value).'],
 NULL),

('Number of Islands', 'medium', 'graph',
 'Given a 2D grid of 0s (water) and 1s (land), return the number of islands. An island is a group of 1s connected horizontally or vertically, surrounded by water.',
 E'- 1 <= grid.length, grid[i].length <= 300\n- Each cell is 0 or 1.',
 '[{"input": "grid = [[1,1,0,0],[1,1,0,0],[0,0,1,0],[0,0,0,1]]", "output": "3", "explanation": null}, {"input": "grid = [[1,0],[0,1]]", "output": "2", "explanation": "The two land cells are not adjacent, so they are separate islands."}]',
 '[{"args": [[[1,1,0,0],[1,1,0,0],[0,0,1,0],[0,0,0,1]]], "expected": 3}, {"args": [[[1,0],[0,1]]], "expected": 2}, {"args": [[[0,0],[0,0]]], "expected": 0}]',
 ARRAY['graph','blind75'], 'blind75', 'core', '{"graph": true}',
 'numIslands', E'def numIslands(grid):\n    pass\n',
 ARRAY['Scan every cell; whenever you find an unvisited land cell, that''s a brand new island — flood-fill (BFS or DFS) to mark every connected land cell as visited.'],
 NULL),

('Course Schedule', 'medium', 'graph',
 'There are numCourses courses, labeled 0 to numCourses - 1. You are given a list of prerequisite pairs [a, b] meaning you must take course b before course a. Return true if it is possible to finish all courses, and false if there is a cycle making it impossible.',
 E'- 1 <= numCourses <= 2000\n- 0 <= prerequisites.length <= 5000',
 '[{"input": "numCourses = 2, prerequisites = [[1,0]]", "output": "true", "explanation": "Take course 0, then course 1."}, {"input": "numCourses = 2, prerequisites = [[1,0],[0,1]]", "output": "false", "explanation": "Course 0 needs course 1 and course 1 needs course 0 — a cycle."}]',
 '[{"args": [2, [[1,0]]], "expected": true}, {"args": [2, [[1,0],[0,1]]], "expected": false}, {"args": [1, []], "expected": true}]',
 ARRAY['graph','blind75'], 'blind75', 'core', '{"graph": true}',
 'canFinish', E'def canFinish(numCourses, prerequisites):\n    pass\n',
 ARRAY['Model this as a directed graph: an edge from a course to each of its prerequisites.', 'The courses can all be finished exactly when this graph has no cycle — try a DFS that tracks nodes currently being visited on the current path.'],
 NULL),

('Merge Two Sorted Lists', 'easy', 'linked_list',
 'You are given two sorted lists of integers, representing two sorted linked lists in order. Merge them into a single sorted list and return it as a list of values.',
 E'- 0 <= list1.length, list2.length <= 50\n- -100 <= values <= 100',
 '[{"input": "list1 = [1,2,4], list2 = [1,3,4]", "output": "[1,1,2,3,4,4]", "explanation": null}, {"input": "list1 = [], list2 = []", "output": "[]", "explanation": null}]',
 '[{"args": [[1,2,4], [1,3,4]], "expected": [1,1,2,3,4,4]}, {"args": [[], []], "expected": []}, {"args": [[], [0]], "expected": [0]}]',
 ARRAY['linked_list','blind75'], 'blind75', 'core', '{"linked_list": true}',
 'mergeTwoLists', E'def mergeTwoLists(list1, list2):\n    pass\n',
 ARRAY['Walk both lists with two pointers, always taking the smaller current value next.', 'Once one list runs out, append whatever remains of the other.'],
 NULL),

('Maximum Depth of Binary Tree', 'easy', 'trees',
 'Given the root of a binary tree, return its maximum depth (the number of nodes along the longest path from the root down to the farthest leaf). For judging, the tree is passed as a level-order list with None for missing nodes.',
 E'- The number of nodes is in the range [0, 10^4].\n- -100 <= Node.val <= 100',
 '[{"input": "root = [3,9,20,null,null,15,7]", "output": "3", "explanation": null}, {"input": "root = [1,null,2]", "output": "2", "explanation": null}]',
 '[{"args": [[3,9,20,null,null,15,7]], "expected": 3}, {"args": [[1,null,2]], "expected": 2}, {"args": [[]], "expected": 0}]',
 ARRAY['tree','blind75'], 'blind75', 'core', '{"tree": true}',
 'maxDepth', E'def maxDepth(values):\n    pass\n',
 ARRAY['The depth of a tree is 1 plus the deeper of its two subtrees'' depths — this is naturally recursive.'],
 NULL),

('Same Tree', 'easy', 'trees',
 'Given the roots of two binary trees, return true if they are structurally identical and every corresponding node has the same value. Both trees are passed as level-order lists with None for missing nodes, for judging.',
 E'- The number of nodes in both trees is in the range [0, 100].\n- -10^4 <= Node.val <= 10^4',
 '[{"input": "p = [1,2,3], q = [1,2,3]", "output": "true", "explanation": null}, {"input": "p = [1,2], q = [1,null,2]", "output": "false", "explanation": "In p, 2 is a left child; in q, 2 is a right child."}]',
 '[{"args": [[1,2,3], [1,2,3]], "expected": true}, {"args": [[1,2], [1,null,2]], "expected": false}, {"args": [[1,2,1], [1,1,2]], "expected": false}]',
 ARRAY['tree','blind75'], 'blind75', 'core', '{"tree": true}',
 'isSameTree', E'def isSameTree(p, q):\n    pass\n',
 ARRAY['Compare the two roots'' values, then recursively check that both left subtrees match and both right subtrees match.'],
 NULL),

('Validate Binary Search Tree', 'medium', 'trees',
 'Given the root of a binary tree, determine if it is a valid binary search tree (BST): every node''s value is strictly greater than all values in its left subtree and strictly less than all values in its right subtree. For judging, the tree is passed as a level-order list with None for missing nodes.',
 E'- The number of nodes is in the range [1, 10^4].\n- -2^31 <= Node.val <= 2^31 - 1',
 '[{"input": "root = [2,1,3]", "output": "true", "explanation": null}, {"input": "root = [5,1,4,null,null,3,6]", "output": "false", "explanation": "Node 4 is in the root''s right subtree, so every value under it must exceed 5. Its child 3 does not, so the tree is invalid."}]',
 '[{"args": [[2,1,3]], "expected": true}, {"args": [[5,1,4,null,null,3,6]], "expected": false}, {"args": [[1]], "expected": true}]',
 ARRAY['tree','blind75'], 'blind75', 'core', '{"tree": true}',
 'isValidBST', E'def isValidBST(values):\n    pass\n',
 ARRAY['A node alone doesn''t tell you if the tree is valid — you need to track the valid (low, high) range allowed at each position as you recurse down.', 'The left child inherits the same lower bound but its parent''s value becomes the new upper bound; the right child is the mirror.'],
 NULL),

('Kth Largest Element in an Array', 'medium', 'heap',
 'Given a list of integers and an integer k, return the kth largest element in the list (the kth largest in sorted order, not the kth distinct value).',
 E'- 1 <= k <= nums.length <= 10^5\n- -10^4 <= nums[i] <= 10^4',
 '[{"input": "nums = [3,2,1,5,6,4], k = 2", "output": "5", "explanation": null}, {"input": "nums = [3,2,3,1,2,4,5,5,6], k = 4", "output": "4", "explanation": null}]',
 '[{"args": [[3,2,1,5,6,4], 2], "expected": 5}, {"args": [[3,2,3,1,2,4,5,5,6], 4], "expected": 4}, {"args": [[1], 1], "expected": 1}]',
 ARRAY['heap','blind75'], 'blind75', 'core', '{"array": true}',
 'findKthLargest', E'def findKthLargest(nums, k):\n    pass\n',
 ARRAY['A min-heap of size k, keeping only the k largest values seen so far, gives you the answer at its top once you''ve scanned everything.'],
 'Can you solve it without sorting the entire array, in better than O(n log n)?'),

('Longest Substring Without Repeating Characters', 'medium', 'sliding_window',
 'Given a string s, find the length of the longest substring without repeating characters.',
 E'- 0 <= s.length <= 5 * 10^4\n- s consists of English letters, digits, symbols and spaces.',
 '[{"input": "s = \"abcabcbb\"", "output": "3", "explanation": "The answer is \"abc\", with length 3."}, {"input": "s = \"bbbbb\"", "output": "1", "explanation": "The answer is \"b\", with length 1."}, {"input": "s = \"pwwkew\"", "output": "3", "explanation": "The answer is \"wke\", with length 3."}]',
 '[{"args": ["abcabcbb"], "expected": 3}, {"args": ["bbbbb"], "expected": 1}, {"args": ["pwwkew"], "expected": 3}]',
 ARRAY['string','sliding_window','blind75'], 'blind75', 'core', '{"array": true}',
 'lengthOfLongestSubstring', E'def lengthOfLongestSubstring(s):\n    pass\n',
 ARRAY['Keep a sliding window [start, i] with no repeats, and a map of each character''s most recent index.', 'When you see a character already in the window, jump start to just past its previous occurrence.'],
 NULL);
