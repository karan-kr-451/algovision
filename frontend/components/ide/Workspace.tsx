"use client";

import { useState } from "react";
import Editor from "./Editor";
import VisualizationPanel from "./VisualizationPanel";

const DEFAULT_STDIN_CODE = `# Read input from stdin, print the answer to stdout.\n`;

export default function Workspace({
  problemId,
  starterCode,
}: {
  problemId: string;
  starterCode: string | null;
}) {
  const [code, setCode] = useState(starterCode ?? DEFAULT_STDIN_CODE);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 border-b border-zinc-800">
        <Editor problemId={problemId} code={code} onChange={setCode} />
      </div>
      <div className="flex-1 min-h-0">
        <VisualizationPanel code={code} />
      </div>
    </div>
  );
}
