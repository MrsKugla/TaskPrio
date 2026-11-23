import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type OnEdgesChange,
} from "@xyflow/react";
import { aggiungiDipendenza, bloccata, creaTask, rimuoviDipendenza, type Esito, type Posizione, type Progetto, type Task } from "../regole";
import { Avviso } from "./Dialoghi";
import { NodoTask } from "./NodoTask";

type Props = {
  progetto: Progetto;
  applica: (esito: Esito) => boolean;
  selezionataId: string | null;
  onSeleziona: (taskId: string) => void;
};

const tipiNodo = { task: NodoTask };

// Freccia dalla task bloccante (source) alla task che dipende da lei (target).
const idFreccia = (bloccanteId: string, dipendenteId: string) => `${bloccanteId}->${dipendenteId}`;

// Task in attesa di titolo: posizione nel grafo e punto dello schermo dove mostrare il campo.
type Bozza = { posizione: Posizione; schermo: { x: number; y: number } };

function GrafoInterno({ progetto, applica, selezionataId, onSeleziona }: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [titolo, setTitolo] = useState("");
  const [cerchio, setCerchio] = useState<Task[] | null>(null);
  // Le frecce nascono dal progetto, quindi la selezione va tenuta a parte.
  const [frecceSelezionate, setFrecceSelezionate] = useState<ReadonlySet<string>>(new Set());

  const nodi = useMemo<NodoTask[]>(
    () =>
      progetto.task.map((t) => ({
        id: t.id,
        type: "task",
        position: t.posizione,
        data: { task: t, bloccata: bloccata(progetto, t.id) },
        selected: t.id === selezionataId,
        // Una task si elimina solo dalla tendina, con conferma: Canc vale solo per le frecce.
        deletable: false,
      })),
    [progetto, selezionataId],
  );

  const frecce = useMemo<Edge[]>(
    () =>
      progetto.dipendenze.map(({ bloccanteId, dipendenteId }) => {
        const id = idFreccia(bloccanteId, dipendenteId);
        return {
          id,
          source: bloccanteId,
          target: dipendenteId,
          selected: frecceSelezionate.has(id),
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        };
      }),
    [progetto.dipendenze, frecceSelezionate],
  );

  const suCambioFrecce: OnEdgesChange = (cambi) => {
    const selezioni = cambi.getByType("select");
    setFrecceSelezionate((attuali) => {
      const selezione = new Set(attuali);
      for (const c of selezioni) {
        if (c.selected) selezione.add(c.id);
        else selezione.delete(c.id);
      }
      return selezione;
    });
  };

  const suEliminaFrecce = (eliminate: Edge[]) => {
    const esito = eliminate.reduce<Esito>(
      (e, f) => (e.tipo === "ok" ? rimuoviDipendenza(e.progetto, f.source, f.target) : e),
      { tipo: "ok", progetto },
    );
    applica(esito);
    setFrecceSelezionate(new Set());
  };

  const collega = (bloccanteId: string, dipendenteId: string) => {
    const esito = aggiungiDipendenza(progetto, bloccanteId, dipendenteId);
    if (esito.tipo === "rifiutato" && esito.cerchio) setCerchio(esito.cerchio);
    else applica(esito);
  };

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
      <ReactFlow
        nodes={nodi}
        edges={frecce}
        nodeTypes={tipiNodo}
        onNodeClick={(_, nodo) => onSeleziona(nodo.id)}
        onEdgesChange={suCambioFrecce}
        onEdgesDelete={suEliminaFrecce}
        onConnect={({ source, target }) => collega(source, target)}
        // Canc sulle tastiere italiane è «Delete». Con una finestra di dialogo aperta non si elimina nulla.
        deleteKeyCode={["Delete", "Backspace"]}
        onBeforeDelete={async () => !document.querySelector("dialog[open]")}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      {cerchio && (
        <Avviso
          messaggio="Dipendenza rifiutata: chiuderebbe un cerchio tra queste task, dove ognuna blocca la successiva e l'ultima la prima."
          elenco={cerchio.map((t) => t.titolo)}
          onChiudi={() => setCerchio(null)}
        />
      )}
      {bozza && (
        <form
          className="bozza-task"
          style={{ left: bozza.schermo.x, top: bozza.schermo.y }}
          onSubmit={(e) => {
            e.preventDefault();
            const esito = creaTask(progetto, { titolo, posizione: bozza.posizione }, new Date());
            if (applica(esito) && esito.tipo === "ok") {
              chiudiBozza();
              onSeleziona(esito.progetto.task[esito.progetto.task.length - 1].id);
            }
          }}
        >
          <input
            autoFocus
            aria-label="Titolo della task"
            placeholder="Titolo della task"
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              // Esc chiude solo il campo, non la tendina aperta.
              e.stopPropagation();
              chiudiBozza();
            }}
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
