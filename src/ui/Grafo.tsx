import { useMemo, useState } from "react";
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type Node } from "@xyflow/react";
import { creaTask, type Esito, type Posizione, type Progetto } from "../regole";

type Props = { progetto: Progetto; applica: (esito: Esito) => boolean };

// Task in attesa di titolo: posizione nel grafo e punto dello schermo dove mostrare il campo.
type Bozza = { posizione: Posizione; schermo: { x: number; y: number } };

function GrafoInterno({ progetto, applica }: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [titolo, setTitolo] = useState("");

  const nodi = useMemo<Node[]>(
    () => progetto.task.map((t) => ({ id: t.id, position: t.posizione, data: { label: t.titolo } })),
    [progetto.task],
  );

  const chiudiBozza = () => {
    setBozza(null);
    setTitolo("");
  };

  return (
    <div
      className="grafo"
      onDoubleClick={(e) => {
        // Solo lo spazio vuoto: React Flow dà la classe react-flow__pane allo sfondo.
        if (!(e.target as Element).classList.contains("react-flow__pane")) return;
        const area = e.currentTarget.getBoundingClientRect();
        setBozza({
          posizione: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
          schermo: { x: e.clientX - area.left, y: e.clientY - area.top },
        });
      }}
    >
      <ReactFlow nodes={nodi} zoomOnDoubleClick={false} nodesDraggable={false} nodesConnectable={false} fitView>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      {bozza && (
        <form
          className="bozza-task"
          style={{ left: bozza.schermo.x, top: bozza.schermo.y }}
          onSubmit={(e) => {
            e.preventDefault();
            if (applica(creaTask(progetto, { titolo, posizione: bozza.posizione }, new Date()))) chiudiBozza();
          }}
        >
          <input
            autoFocus
            aria-label="Titolo della task"
            placeholder="Titolo della task"
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && chiudiBozza()}
            onBlur={chiudiBozza}
          />
        </form>
      )}
    </div>
  );
}

export function Grafo(props: Props) {
  return (
    <ReactFlowProvider>
      <GrafoInterno {...props} />
    </ReactFlowProvider>
  );
}
