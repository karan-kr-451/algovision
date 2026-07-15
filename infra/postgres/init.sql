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
