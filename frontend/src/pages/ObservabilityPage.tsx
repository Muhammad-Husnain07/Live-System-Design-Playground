import { useParams } from "react-router-dom";

export default function ObservabilityPage() {
  const { id } = useParams();

  return (
    <div className="h-screen bg-surface-950 text-surface-100 flex flex-col">
      <header className="border-b border-surface-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Observability</h1>
        <span className="text-sm text-surface-400">{id}</span>
      </header>
      <main className="flex-1 flex items-center justify-center text-surface-400">
        Metrics & dashboards — coming soon
      </main>
    </div>
  );
}
