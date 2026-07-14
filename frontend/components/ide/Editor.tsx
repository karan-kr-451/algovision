"use client";

import MonacoEditor from "@monaco-editor/react";
import { useState } from "react";

const DEFAULT_CODE = `def solve():\n    pass\n`;

export default function Editor() {
  const [code, setCode] = useState(DEFAULT_CODE);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-sm text-zinc-400">Python</span>
        <button
          className="text-sm bg-zinc-100 text-zinc-900 px-3 py-1 rounded hover:bg-white"
          title="Ctrl+Enter"
        >
          Run
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
      </div>
    </div>
  );
}
