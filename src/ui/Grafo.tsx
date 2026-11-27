import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import {
  aggiungiDipendenza,
  bloccata,
  creaSezione,
  creaTask,
  eliminaSezione,
  eliminaTask,
  INGOMBRO_TASK,
  rimuoviDipendenza,
  rinominaSezione,
  riordina,
  spostaTask,
  type Esito,
  type Posizione,
  type PrioritaEffettiva,
  type Progetto,
  type Sezione,
  type Task,
} from "../regole";
import { Avviso, ChiediTesto, Conferma } from "./Dialoghi";
import { NodoTask } from "./NodoTask";
import { MANIGLIA_SEZIONE, NodoSezione } from "./NodoSezione";
import { Icona, TERN } from "./schermo";

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

const tipiNodo = { task: NodoTask, sezione: NodoSezione };
type Nodo = NodoTask | NodoSezione;

// Le cornici delle sezioni sono nodi anche loro: l'id dice quale sezione, senza confondersi con le task.
const PREFISSO_SEZIONE = "sezione:";
const idSezione = (s: Sezione) => PREFISSO_SEZIONE + s.id;
// Margine della cornice intorno alle task e spazio in alto per l'etichetta.
const MARGINE_SEZIONE = 18;
const ETICHETTA_SEZIONE = 30;

// Trascinamento di una sezione dalla sua etichetta: dove stavano la cornice e le sue task quando è partito.
type SezioneTrascinata = { id: string; cornice: Posizione; task: Map<string, Posizione> };

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
  // Task scelte insieme (Maiusc + trascinamento, o Ctrl + clic), da raggruppare in una sezione.
  const [scelte, setScelte] = useState<ReadonlySet<string>>(new Set());
  const [chiediNomeSezione, setChiediNomeSezione] = useState(false);
  const [sezioneDaTogliere, setSezioneDaTogliere] = useState<Sezione | null>(null);
  const [sezioneTrascinata, setSezioneTrascinata] = useState<SezioneTrascinata | null>(null);

  const posizioneDi = (t: Task) => trascinate.get(t.id) ?? t.posizione;

  const nodiTask = useMemo<NodoTask[]>(
    () =>
      progetto.task.map((t) => ({
        id: t.id,
        type: "task",
        position: trascinate.get(t.id) ?? t.posizione,
        measured: misure.get(t.id),
        dragging: trascinate.has(t.id),
        data: { task: t, effettiva: effettive.get(t.id)!, bloccata: bloccata(progetto, t.id) },
        selected: t.id === selezionataId || scelte.has(t.id),
        hidden: !visibili.has(t.id),
      })),
    [progetto, effettive, selezionataId, scelte, trascinate, misure, visibili],
  );

  // Cornice di ogni sezione: il riquadro delle sue task visibili, più margine ed etichetta. Senza task visibili non si vede.
  const nodiSezione = useMemo<NodoSezione[]>(
    () =>
      progetto.sezioni.flatMap((s) => {
        const dentro = progetto.task.filter((t) => t.sezioneId === s.id && visibili.has(t.id));
        if (dentro.length === 0) return [];
        const riquadri = dentro.map((t) => {
          const p = trascinate.get(t.id) ?? t.posizione;
          const m = misure.get(t.id) ?? { width: INGOMBRO_TASK.larghezza, height: INGOMBRO_TASK.altezza };
          return { x1: p.x, y1: p.y, x2: p.x + m.width, y2: p.y + m.height };
        });
        const x1 = Math.min(...riquadri.map((r) => r.x1)) - MARGINE_SEZIONE;
        const y1 = Math.min(...riquadri.map((r) => r.y1)) - MARGINE_SEZIONE - ETICHETTA_SEZIONE;
        const x2 = Math.max(...riquadri.map((r) => r.x2)) + MARGINE_SEZIONE;
        const y2 = Math.max(...riquadri.map((r) => r.y2)) + MARGINE_SEZIONE;
        return [
          {
            id: idSezione(s),
            type: "sezione",
            position: { x: x1, y: y1 },
            width: x2 - x1,
            height: y2 - y1,
            // Sotto le task e le frecce; si afferra solo dall'etichetta.
            zIndex: -1,
            dragHandle: `.${MANIGLIA_SEZIONE}`,
            selectable: false,
            deletable: false,
            focusable: false,
            connectable: false,
            dragging: sezioneTrascinata?.id === s.id,
            data: {
              nome: s.nome,
              quante: dentro.length,
              onRinomina: (nome: string) => applica(rinominaSezione(progetto, s.id, nome)),
              onElimina: () => setSezioneDaTogliere(s),
            },
          },
        ];
      }),
    [progetto, visibili, trascinate, misure, sezioneTrascinata, applica],
  );

  const nodi = useMemo<Nodo[]>(() => [...nodiSezione, ...nodiTask], [nodiSezione, nodiTask]);

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

  const suCambioNodi: OnNodesChange<Nodo> = (cambi) => {
    const dimensioni = cambi.getByType("dimensions").filter((c) => c.dimensions && !c.id.startsWith(PREFISSO_SEZIONE));
    if (dimensioni.length > 0) {
      setMisure((attuali) => {
        const aggiornate = new Map(attuali);
        for (const c of dimensioni) aggiornate.set(c.id, c.dimensions!);
        return aggiornate;
      });
    }

    // Le task scelte insieme: le cornici non si scelgono.
    const selezioni = cambi.getByType("select").filter((c) => !c.id.startsWith(PREFISSO_SEZIONE));
    if (selezioni.length > 0) {
      setScelte((attuali) => {
        const nuove = new Set(attuali);
        for (const c of selezioni) {
          if (c.selected) nuove.add(c.id);
          else nuove.delete(c.id);
        }
        return nuove;
      });
    }

    const tutti = cambi.getByType("position").filter((c) => c.position);
    // Una cornice trascinata sposta le sue task dello stesso tratto.
    const sezione = tutti.find((c) => c.id.startsWith(PREFISSO_SEZIONE));
    const spostamenti = tutti.filter((c) => !c.id.startsWith(PREFISSO_SEZIONE));
    if (sezione && sezioneTrascinata) {
      const dx = sezione.position!.x - sezioneTrascinata.cornice.x;
      const dy = sezione.position!.y - sezioneTrascinata.cornice.y;
      for (const [id, p] of sezioneTrascinata.task) {
        spostamenti.push({ type: "position", id, position: { x: p.x + dx, y: p.y + dy }, dragging: sezione.dragging });
      }
      if (!sezione.dragging) setSezioneTrascinata(null);
    }
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

  const suInizioTrascinamento: OnNodeDrag<Nodo> = (_, nodo) => {
    if (nodo.type !== "sezione") return;
    const sezioneId = nodo.id.slice(PREFISSO_SEZIONE.length);
    const task = progetto.task.filter((t) => t.sezioneId === sezioneId);
    setSezioneTrascinata({ id: sezioneId, cornice: nodo.position, task: new Map(task.map((t) => [t.id, posizioneDi(t)])) });
  };

  const raggruppa = (nome: string) => {
    const esito = creaSezione(progetto, [...scelte], nome);
    if (applica(esito)) {
      setChiediNomeSezione(false);
      setScelte(new Set());
    }
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
        // Un clic su una task la apre nella tendina; con Ctrl (o Maiusc + trascinamento) si scelgono più task insieme.
        onNodeClick={(e, nodo) => {
          if (nodo.type === "task" && !e.ctrlKey && !e.metaKey) onSeleziona(nodo.id);
        }}
        onPaneClick={() => setScelte(new Set())}
        onNodeDragStart={suInizioTrascinamento}
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
          const freccePrese = edges.filter((f) => frecceSelezionate.has(f.id));
          if (freccePrese.length > 0) return { nodes: [], edges: freccePrese };
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
        {/* Nello stile tern il grafo poggia sulla griglia a punti di tern-ui (--grid-dot); arcade resta a tinta unita. */}
        {TERN && <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />}
        <Controls showInteractive={false} />
        {/* Con più task scelte compare «Raggruppa»: le mette in una sezione nuova. */}
        {scelte.size > 1 && (
          <Panel position="top-center" className="azioni-scelte">
            <span className={TERN ? "t-count" : "conta-scelte"}>{scelte.size} task</span>
            <button className="t-btn sm primary" onClick={() => setChiediNomeSezione(true)}>
              <Icona nome="layers" />
              Raggruppa
            </button>
            <button className="t-btn icon sm quiet" aria-label="Annulla la scelta" onClick={() => setScelte(new Set())}>
              {TERN ? <Icona nome="x" /> : "×"}
            </button>
          </Panel>
        )}
        <Panel position="top-right">
          <button
            className="t-btn raised"
            disabled={progetto.task.length === 0}
            title="Ricalcola da capo la disposizione: ogni task a destra delle task da cui dipende"
            onClick={() => {
              if (applica({ tipo: "ok", progetto: riordina(progetto) })) setDaAdattare(true);
            }}
          >
            <Icona nome="refresh" />
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
          pericolo
          onAnnulla={() => setDaEliminare(null)}
          onConferma={() => {
            applica(daEliminare.reduce<Esito>((e, t) => (e.tipo === "ok" ? eliminaTask(e.progetto, t.id) : e), { tipo: "ok", progetto }));
            setDaEliminare(null);
          }}
        />
      )}
      {chiediNomeSezione && (
        <ChiediTesto
          titolo="Nuova sezione"
          etichetta={`Nome della sezione (${scelte.size} task)`}
          onAnnulla={() => setChiediNomeSezione(false)}
          onConferma={raggruppa}
        />
      )}
      {sezioneDaTogliere && (
        <Conferma
          titolo={`Togliere la sezione «${sezioneDaTogliere.nome}»?`}
          messaggio="Spariscono la cornice e il nome; le task restano dove sono."
          etichettaConferma="Togli"
          onAnnulla={() => setSezioneDaTogliere(null)}
          onConferma={() => {
            applica(eliminaSezione(progetto, sezioneDaTogliere.id));
            setSezioneDaTogliere(null);
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
            className="t-input"
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
