import { fetchProblem } from "@/lib/api";
import Workspace from "@/components/ide/Workspace";
import NotepadPanel from "@/components/notepad/NotepadPanel";
import { DifficultyPill, PatternChip } from "@/components/ui";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await fetchProblem(id);

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-1/2 overflow-y-auto border-r border-hairline px-8 py-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">{problem.title}</h1>
          <DifficultyPill difficulty={problem.difficulty} />
          <PatternChip pattern={problem.pattern} />
        </div>
        <p className="mt-5 whitespace-pre-wrap text-ink-muted leading-relaxed">{problem.statement}</p>
        {problem.constraints && (
          <>
            <h2 className="mt-8 text-sm font-medium text-ink">Constraints</h2>
            <p className="mt-2 text-ink-subtle text-sm whitespace-pre-wrap font-mono">
              {problem.constraints}
            </p>
          </>
        )}
        {problem.attribution_text && (
          <p className="mt-8 text-xs text-ink-subtle">
            Source: {problem.attribution_text} ({problem.license})
          </p>
        )}
        <div className="mt-10 rounded-[10px] border border-hairline bg-surface-1 overflow-hidden">
          <NotepadPanel problemId={problem.id} />
        </div>
      </div>
      <div className="w-1/2 flex flex-col min-h-0">
        <Workspace problemId={problem.id} starterCode={problem.starter_code} />
      </div>
    </div>
  );
}
