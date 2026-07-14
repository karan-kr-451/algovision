import { fetchProblem } from "@/lib/api";
import Workspace from "@/components/ide/Workspace";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await fetchProblem(id);

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-1/2 overflow-y-auto border-r border-zinc-800 px-6 py-6">
        <h1 className="text-xl font-semibold">{problem.title}</h1>
        <div className="text-xs uppercase text-zinc-400 mt-1">
          {problem.difficulty} · {problem.pattern} · {problem.visualization_tier}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-zinc-200">{problem.statement}</p>
        {problem.constraints && (
          <>
            <h2 className="mt-6 font-medium">Constraints</h2>
            <p className="mt-1 text-zinc-400 text-sm whitespace-pre-wrap">
              {problem.constraints}
            </p>
          </>
        )}
        {problem.attribution_text && (
          <p className="mt-6 text-xs text-zinc-500">
            Source: {problem.attribution_text} ({problem.license})
          </p>
        )}
      </div>
      <div className="w-1/2 flex flex-col min-h-0">
        <Workspace problemId={problem.id} starterCode={problem.starter_code} />
      </div>
    </div>
  );
}
