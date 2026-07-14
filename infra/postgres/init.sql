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

CREATE INDEX idx_solutions_user_id ON solutions(user_id);
CREATE INDEX idx_solutions_problem_id ON solutions(problem_id);
CREATE INDEX idx_problems_pattern ON problems(pattern);
CREATE INDEX idx_problems_tier ON problems(visualization_tier);

-- Seed sample Tier 1 problems for the Phase 1 catalog
-- testcases (stdin/stdout pairs) are only populated for problems the Phase 2 judge
-- can run — the LeetCode-style function-signature problems below are catalog/visualization
-- content only until they're adapted to a stdin/stdout harness.
INSERT INTO problems (title, difficulty, pattern, statement, constraints, examples, testcases, tags, source, visualization_tier, visualization_meta) VALUES
('Two Sum', 'easy', 'hashing',
 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
 '2 <= nums.length <= 10^4',
 '[{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}]',
 '[]',
 ARRAY['array','hashing'], 'custom', 'core', '{"array": true, "hashmap": true}'),
('Valid Parentheses', 'easy', 'stack',
 'Given a string s containing just the characters ()[]{}, determine if the input string is valid.',
 '1 <= s.length <= 10^4',
 '[{"input": "s = \"()[]{}\"", "output": "true"}]',
 '[]',
 ARRAY['stack','string'], 'custom', 'core', '{"stack": true}'),
('Reverse Linked List', 'easy', 'linked_list',
 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
 'The number of nodes in the list is the range [0, 5000].',
 '[{"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]"}]',
 '[]',
 ARRAY['linked_list'], 'custom', 'core', '{"linked_list": true}'),
('Binary Tree Level Order Traversal', 'medium', 'trees',
 'Given the root of a binary tree, return the level order traversal of its nodes'' values.',
 'The number of nodes in the tree is in the range [0, 2000].',
 '[{"input": "root = [3,9,20,null,null,15,7]", "output": "[[3],[9,20],[15,7]]"}]',
 '[]',
 ARRAY['tree','bfs'], 'custom', 'core', '{"tree": true}'),
('Climbing Stairs', 'easy', 'dp',
 'You are climbing a staircase. It takes n steps to reach the top. Each time you can climb 1 or 2 steps. In how many distinct ways can you climb to the top? Read n from stdin, print the answer.',
 '1 <= n <= 45',
 '[{"input": "n = 3", "output": "3"}]',
 '[{"input": "3\n", "output": "3\n"}, {"input": "4\n", "output": "5\n"}, {"input": "1\n", "output": "1\n"}]',
 ARRAY['dp'], 'custom', 'core', '{"dp_1d": true}'),
('A Plus B', 'easy', 'math',
 'Read two space-separated integers a and b from stdin, print their sum.',
 '-10^9 <= a, b <= 10^9',
 '[{"input": "1 2", "output": "3"}]',
 '[{"input": "1 2\n", "output": "3\n"}, {"input": "5 7\n", "output": "12\n"}, {"input": "-3 3\n", "output": "0\n"}]',
 ARRAY['math'], 'custom', 'core', '{}');
