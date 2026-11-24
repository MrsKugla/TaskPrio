import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import {
  aggiungiDipendenza,
  bloccata,
  creaTask,
  eliminaTask,
  rimuoviDipendenza,
  riordina,
  spostaTask,
  type Esito,
  type Posizione,
  type PrioritaEffettiva,
  type Progetto,
  type Task,
} from "../regole";
import { Avviso, Conferma } from "./Dialoghi";
import { NodoTask } from "./NodoTask";

type Props = {
  progetto: Progetto;
  effettive: Map<string, PrioritaEffettiva>;
  applica: (esito: Esito) => boolean;
  selezionataId: string | null;
  onSeleziona: (taskId: string) => void;
  // Task da mostrare: le altre restano nel progetto ma sono nascoste, con le loro frecce.
  visibili: ReadonlySet<string>;
  // Cambia entrando e uscendo dal focus: il grafo si inquadra di nuovo.
  focusId: string | null;
};

const tipiNodo = { task: NodoTask };

// Freccia dalla task che dipende (source) alla task da cui dipende (target): la freccia indica la dipendenza.
const idFreccia = (bloccanteId: string, dipendenteId: string) => `${bloccanteId}->${dipendenteId}`;

// Task in attesa di titolo: posizione nel grafo e punto dello schermo dove mostrare il campo.
type Bozza = { posizione: Posizione; schermo: { x: number; y: number } };
type Misura = { width: number; height: number };

function GrafoInterno({ progetto, effettive, applica, selezionataId, onSeleziona, visibili, focusId }: Props) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [titolo, setTitolo] = useState("");
  const [cerchio, setCerchio] = useState<Task[] | null>(null);
  // Task da eliminare con Canc, in attesa del «Sei sicura?».
  const [daEliminare, setDaEliminare] = useState<Task[] | null>(null);
  // Le frecce nascono dal progetto, quindi la selezione va tenuta a parte.
  const [frecceSelezionate, setFrecceSelezionate] = useState<ReadonlySet<string>>(new Set());
  // Durante il trascinamento la posizione vive solo qui: il progetto si aggiorna e si salva una volta, al rilascio.
  const [trascinate, setTrascinate] = useState<ReadonlyMap<string, Posizione>>(new Map());
  // Misure dei nodi rilevate da React Flow: ripassate nei nodi, così ricostruirli non le azzera e le frecce restano agganciate.
  const [misure, setMisure] = useState<ReadonlyMap<string, Misura>>(new Map());
  const [daAdattare, setDaAdattare] = useState(false);

  const nodi = useMemo<NodoTask[]>(
    () =>
      progetto.task.map((t) => ({
        id: t.id,
        type: "task",
        position: trascinate.get(t.id) ?? t.posizione,
        measured: misure.get(t.id),
        dragging: trascinate.has(t.id),
        data: { task: t, effettiva: effettive.get(t.id)!, bloccata: bloccata(progetto, t.id) },
        selected: t.id === selezionataId,
        hidden: !visibili.has(t.id),
      })),
    [progetto, effettive, selezionataId, trascinate, misure, visibili],
  );

  // Entrando e uscendo dal focus cambiano le task visibili: si inquadrano quelle nuove.
  const [focusPrecedente, setFocusPrecedente] = useState(focusId);
  if (focusId !== focusPrecedente) {
    setFocusPrecedente(focusId);
    setDaAdattare(true);
  }

  // Dopo «Riordina» e al cambio di focus si inquadra il grafo, quando React Flow ha già i nodi nuovi.
  useEffect(() => {
    if (!daAdattare) return;
    setDaAdattare(false);
    fitView({ duration: 300 });
  }, [daAdattare, fitView]);

  const frecce = useMemo<Edge[]>(
    () =>
      progetto.dipendenze.map(({ bloccanteId, dipendenteId }) => {
        const id = idFreccia(bloccanteId, dipendenteId);
        return {
          id,
          source: dipendenteId,
          target: bloccanteId,
          selected: frecceSelezionate.has(id),
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        };
      }),
    [progetto.dipendenze, frecceSelezionate],
  );

  const suCambioNodi: OnNodesChange<NodoTask> = (cambi) => {
    const dimensioni = cambi.getByType("dimensions").filter((c) => c.dimensions);
    if (dimensioni.length > 0) {
      setMisure((attuali) => {
        const aggiornate = new Map(attuali);
        for (const c of dimensioni) aggiornate.set(c.id, c.dimensions!);
        return aggiornate;
      });
    }

    const spostamenti = cambi.getByType("position").filter((c) => c.position);
    if (spostamenti.length === 0) return;
    // Rilascio del trascinamento o spostamento con le frecce della tastiera: si salva.
    const finiti = spostamenti.filter((c) => !c.dragging);
    if (finiti.length > 0) {
      applica(
        finiti.reduce<Esito>(
          (e, c) => (e.tipo === "ok" ? spostaTask(e.progetto, c.id, c.position!) : e),
          { tipo: "ok", progetto },
        ),
      );
    }
    setTrascinate((attuali) => {
      const aggiornate = new Map(attuali);
      for (const c of spostamenti) {
        if (c.dragging) aggiornate.set(c.id, c.position!);
        else aggiornate.delete(c.id);
      }
      return aggiornate;
    });
  };

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
      (e, f) => (e.tipo === "ok" ? rimuoviDipendenza(e.progetto, f.target, f.source) : e),
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
        onNodesChange={suCambioNodi}
        onEdgesChange={suCambioFrecce}
        onEdgesDelete={suEliminaFrecce}
        onConnect={({ source, target }) => collega(target, source)}
        // Canc sulle tastiere italiane è «Delete». Con una finestra di dialogo aperta non si elimina nulla.
        deleteKeyCode={["Delete", "Backspace"]}
        // La task aperta nella tendina resta selezionata anche cliccando una freccia: con frecce selezionate,
        // Canc elimina solo quelle. Senza, Canc sulla task apre il «Sei sicura?» e ferma l'eliminazione immediata.
        onBeforeDelete={async ({ nodes, edges }) => {
          if (document.querySelector("dialog[open]")) return false;
          const scelte = edges.filter((f) => frecceSelezionate.has(f.id));
          if (scelte.length > 0) return { nodes: [], edges: scelte };
          if (nodes.length === 0) return true;
          const ids = new Set(nodes.map((n) => n.id));
          setDaEliminare(progetto.task.filter((t) => ids.has(t.id)));
          return false;
        }}
        // Rotella del mouse, due dita o pizzico sul touchpad zoomano; trascinare lo sfondo sposta il grafo.
        // Lo zoom minimo predefinito (0,5) non basta a inquadrare un progetto con molte task.
        zoomOnDoubleClick={false}
        minZoom={0.1}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <button
            disabled={progetto.task.length === 0}
            title="Ricalcola da capo la disposizione: ogni task a destra delle task da cui dipende"
            onClick={() => {
              if (applica({ tipo: "ok", progetto: riordina(progetto) })) setDaAdattare(true);
            }}
          >
            Riordina
          </button>
        </Panel>
      </ReactFlow>
      {daEliminare && (
        <Conferma
          messaggio={
            daEliminare.length === 1
              ? `Eliminare la task «${daEliminare[0].titolo}»?`
              : `Eliminare ${daEliminare.length} task: ${daEliminare.map((t) => `«${t.titolo}»`).join(", ")}?`
          }
          etichettaConferma="Elimina"
          onAnnulla={() => setDaEliminare(null)}
          onConferma={() => {
            applica(daEliminare.reduce<Esito>((e, t) => (e.tipo === "ok" ? eliminaTask(e.progetto, t.id) : e), { tipo: "ok", progetto }));
            setDaEliminare(null);
          }}
        />
      )}
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
