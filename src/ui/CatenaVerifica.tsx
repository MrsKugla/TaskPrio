import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import {
  ESITI,
  aggiungiRischio,
  aggiungiTest,
  eliminaRischio,
  eliminaTest,
  impostaEsito,
  impostaPianoB,
  modificaRischio,
  modificaTest,
  pianiBDaEseguire,
  rimuoviPianoB,
  spostaNodoCatena,
  type Esito,
  type EsitoTest,
  type RifNodoCatena as RifNodo,
  type Posizione,
  type Progetto,
  type Rischio,
  type Task,
  type Test,
} from "../regole";
import { ETICHETTE_ESITO } from "./aspetto";
import { Conferma } from "./Dialoghi";

type Props = {
  progetto: Progetto;
  task: Task;
  applica: (esito: Esito) => boolean;
  // Task fatta: la catena si guarda e si dispone, ma non si modifica.
  solaLettura: boolean;
};

type DatiNodo =
  | { tipo: "task"; titolo: string }
  | { tipo: "rischio"; rischio: Rischio }
  | { tipo: "test"; test: Test; daEseguire: boolean; solaLettura: boolean; onEsito: (esito: EsitoTest) => void }
  | { tipo: "azione"; testo: string; daEseguire: boolean };
type NodoCatena = Node<DatiNodo, "catena">;
type Misura = { width: number; height: number };

// Id dei nodi nel grafo: il piano B azione non ha un id suo e usa quello del test.
const idNodo = (rif: RifNodo) => `${rif.tipo}:${rif.id}`;
function rifDa(id: string): RifNodo | null {
  const [tipo, ...resto] = id.split(":");
  return tipo === "rischio" || tipo === "test" || tipo === "azione" ? { tipo, id: resto.join(":") } : null;
}

// La task sta ferma a sinistra, da dove parte la catena.
const POSIZIONE_TASK: Posizione = { x: 0, y: 0 };

function NodoCatena({ data, selected }: NodeProps<NodoCatena>) {
  const selezione = selected ? " selezionato" : "";
  if (data.tipo === "task") {
    return (
      <div className="nodo-catena catena-task" title={data.titolo}>
        <span className="testo-titolo">{data.titolo}</span>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  }
  if (data.tipo === "rischio") {
    return (
      <div className={`nodo-catena catena-rischio${selezione}`} title={data.rischio.descrizione || data.rischio.titolo}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <span className="tipo-nodo">Rischio</span>
        <span className="testo-titolo">{data.rischio.titolo}</span>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  }
  if (data.tipo === "azione") {
    return (
      <div className={`nodo-catena catena-azione${data.daEseguire ? " da-eseguire" : ""}${selezione}`} title={data.testo}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <span className="tipo-nodo">Piano B · azione</span>
        <span className="testo-titolo">{data.testo}</span>
      </div>
    );
  }
  const { test, daEseguire, solaLettura, onEsito } = data;
  // Un clic sull'esito già scelto lo toglie: il test torna da provare.
  const scegli = (esito: EsitoTest) => onEsito(test.esito === esito ? "daProvare" : esito);
  return (
    <div
      className={`nodo-catena catena-test esito-${test.esito}${daEseguire ? " da-eseguire" : ""}${selezione}`}
      title={`${test.titolo}\nEsito: ${ETICHETTE_ESITO[test.esito]}`}
    >
      {/* Arrivo grande quanto il nodo: qui finisce il trascinamento che lo rende piano B di un altro test. */}
      <Handle type="target" position={Position.Left} isConnectableStart={false} className="arrivo-piano-b" />
      <span className="tipo-nodo">Test</span>
      <span className="testo-titolo">{test.titolo}</span>
      <span className="esiti nodrag">
        <button
          className={test.esito === "passato" ? "scelto" : ""}
          disabled={solaLettura}
          aria-pressed={test.esito === "passato"}
          title="Passato"
          onClick={(e) => {
            e.stopPropagation();
            scegli("passato");
          }}
        >
          ✓
        </button>
        <button
          className={test.esito === "fallito" ? "scelto" : ""}
          disabled={solaLettura}
          aria-pressed={test.esito === "fallito"}
          title="Fallito"
          onClick={(e) => {
            e.stopPropagation();
            scegli("fallito");
          }}
        >
          ✗
        </button>
      </span>
      <Handle
        type="source"
        position={Position.Right}
        isConnectableEnd={false}
        isConnectable={!solaLettura}
        className="partenza-piano-b"
        title="Trascina su un altro test dello stesso rischio per farne il piano B"
      />
    </div>
  );
}

const tipiNodo = { catena: NodoCatena };

// Titolo modificato in locale: vuoto non si salva e all'uscita dal campo torna quello salvato.
function CampoTitolo(props: { etichetta: string; valore: string; onSalva: (titolo: string) => void }) {
  const [testo, setTesto] = useState(props.valore);
  return (
    <label>
      {props.etichetta}
      <input
        value={testo}
        onChange={(e) => {
          setTesto(e.target.value);
          if (e.target.value.trim()) props.onSalva(e.target.value);
        }}
        onBlur={() => setTesto(props.valore)}
      />
    </label>
  );
}

// Campo con «Aggiungi»: si svuota dopo un'aggiunta riuscita.
function Aggiungi(props: { segnaposto: string; onAggiungi: (titolo: string) => boolean }) {
  const [testo, setTesto] = useState("");
  return (
    <form
      className="aggiungi"
      onSubmit={(e) => {
        e.preventDefault();
        if (props.onAggiungi(testo)) setTesto("");
      }}
    >
      <input aria-label={props.segnaposto} placeholder={props.segnaposto} value={testo} onChange={(e) => setTesto(e.target.value)} />
      <button type="submit" disabled={!testo.trim()}>
        Aggiungi
      </button>
    </form>
  );
}

// Modifica del nodo selezionato, sotto il grafo. Senza selezione si aggiunge un rischio.
function Dettaglio(props: Props & { selezione: RifNodo | null; onSeleziona: (rif: RifNodo | null) => void }) {
  const { progetto, task, applica, solaLettura, selezione, onSeleziona } = props;
  const [daEliminare, setDaEliminare] = useState<{ messaggio: string; esito: () => Esito } | null>(null);

  const rischio = selezione?.tipo === "rischio" ? task.rischi.find((r) => r.id === selezione.id) : undefined;
  const rischioDelTest = selezione && selezione.tipo !== "rischio" ? task.rischi.find((r) => r.test.some((t) => t.id === selezione.id)) : undefined;
  const test = rischioDelTest?.test.find((t) => t.id === selezione!.id);

  let contenuto;
  if (rischio) {
    contenuto = (
      <>
        <CampoTitolo
          key={`titolo-${rischio.id}`}
          etichetta="Rischio"
          valore={rischio.titolo}
          onSalva={(titolo) => applica(modificaRischio(progetto, task.id, rischio.id, { titolo }))}
        />
        <label>
          Descrizione
          <textarea
            rows={3}
            value={rischio.descrizione}
            onChange={(e) => applica(modificaRischio(progetto, task.id, rischio.id, { descrizione: e.target.value }))}
          />
        </label>
        <Aggiungi segnaposto="Nuovo test" onAggiungi={(titolo) => applica(aggiungiTest(progetto, task.id, rischio.id, { titolo }))} />
        <button
          type="button"
          className="pericolo"
          onClick={() =>
            setDaEliminare({
              messaggio: `Eliminare il rischio «${rischio.titolo}» e i suoi test?`,
              esito: () => eliminaRischio(progetto, task.id, rischio.id),
            })
          }
        >
          Elimina rischio
        </button>
      </>
    );
  } else if (test && rischioDelTest && selezione?.tipo === "azione" && test.pianoB?.tipo === "azione") {
    contenuto = (
      <>
        <CampoTitolo
          key={`azione-${test.id}`}
          etichetta={`Piano B di «${test.titolo}»`}
          valore={test.pianoB.testo}
          onSalva={(testo) => applica(impostaPianoB(progetto, task.id, test.id, { tipo: "azione", testo }))}
        />
        <button type="button" className="pericolo" onClick={() => applica(rimuoviPianoB(progetto, task.id, test.id)) && onSeleziona(null)}>
          Togli piano B
        </button>
      </>
    );
  } else if (test && rischioDelTest) {
    const altri = rischioDelTest.test.filter((t) => t.id !== test.id);
    const piano = test.pianoB;
    contenuto = (
      <>
        <CampoTitolo
          key={`test-${test.id}`}
          etichetta={`Test di «${rischioDelTest.titolo}»`}
          valore={test.titolo}
          onSalva={(titolo) => applica(modificaTest(progetto, task.id, test.id, { titolo }))}
        />
        <fieldset>
          <legend>Esito</legend>
          {ESITI.map((e) => (
            <label key={e} className="scelta">
              <input type="radio" name="esito" checked={test.esito === e} onChange={() => applica(impostaEsito(progetto, task.id, test.id, e))} />
              {ETICHETTE_ESITO[e]}
            </label>
          ))}
        </fieldset>
        <label>
          Piano B
          <select
            value={piano ? (piano.tipo === "test" ? piano.testId : "azione") : ""}
            onChange={(e) => {
              const valore = e.target.value;
              if (valore === "") applica(rimuoviPianoB(progetto, task.id, test.id));
              else if (valore === "azione") {
                // L'azione nasce col titolo del test: si rinomina subito dal suo nodo.
                if (applica(impostaPianoB(progetto, task.id, test.id, { tipo: "azione", testo: `Se «${test.titolo}» fallisce` }))) {
                  onSeleziona({ tipo: "azione", id: test.id });
                }
              } else applica(impostaPianoB(progetto, task.id, test.id, { tipo: "test", testId: valore }));
            }}
          >
            <option value="">Nessuno</option>
            <option value="azione">Azione…</option>
            {altri.map((t) => (
              <option key={t.id} value={t.id}>
                Test: {t.titolo}
              </option>
            ))}
          </select>
        </label>
        {piano?.tipo === "azione" && (
          <CampoTitolo
            key={`azione-${test.id}`}
            etichetta="Azione"
            valore={piano.testo}
            onSalva={(testo) => applica(impostaPianoB(progetto, task.id, test.id, { tipo: "azione", testo }))}
          />
        )}
        <button
          type="button"
          className="pericolo"
          onClick={() =>
            setDaEliminare({ messaggio: `Eliminare il test «${test.titolo}»?`, esito: () => eliminaTest(progetto, task.id, test.id) })
          }
        >
          Elimina test
        </button>
      </>
    );
  } else {
    contenuto = (
      <>
        <Aggiungi segnaposto="Nuovo rischio" onAggiungi={(titolo) => applica(aggiungiRischio(progetto, task.id, { titolo }))} />
        <p className="vuoto-piccolo">
          Clic su un nodo per modificarlo; ✓ e ✗ sul test ne segnano l'esito. Trascina dal pallino di un test su un altro test dello
          stesso rischio per farne il piano B.
        </p>
      </>
    );
  }

  return (
    <fieldset className="dettaglio-catena" disabled={solaLettura}>
      {contenuto}
      {daEliminare && (
        <Conferma
          messaggio={daEliminare.messaggio}
          etichettaConferma="Elimina"
          onAnnulla={() => setDaEliminare(null)}
          onConferma={() => {
            setDaEliminare(null);
            if (applica(daEliminare.esito())) onSeleziona(null);
          }}
        />
      )}
    </fieldset>
  );
}

function GrafoCatena(
  props: Props & { selezione: RifNodo | null; onSeleziona: (rif: RifNodo | null) => void; schermoIntero: boolean; onSchermoIntero: () => void },
) {
  const { progetto, task, applica, solaLettura, selezione, onSeleziona, schermoIntero, onSchermoIntero } = props;
  // Come nel grafo delle task: la posizione trascinata vive qui e si salva al rilascio; le misure si ripassano ai nodi.
  const [trascinate, setTrascinate] = useState<ReadonlyMap<string, Posizione>>(new Map());
  const [misure, setMisure] = useState<ReadonlyMap<string, Misura>>(new Map());
  const [frecceSelezionate, setFrecceSelezionate] = useState<ReadonlySet<string>>(new Set());

  const nodi = useMemo<NodoCatena[]>(() => {
    // Il piano B di un test fallito è da eseguire: si evidenzia il test o l'azione a cui punta.
    const daEseguire = new Set(pianiBDaEseguire(task).map((p) => idNodo(p.bersaglio)));
    const nodo = (id: string, posizione: Posizione, data: DatiNodo): NodoCatena => ({
      id,
      type: "catena",
      position: trascinate.get(id) ?? posizione,
      measured: misure.get(id),
      dragging: trascinate.has(id),
      selected: selezione !== null && idNodo(selezione) === id,
      deletable: false,
      data,
    });
    return [
      { ...nodo("task", POSIZIONE_TASK, { tipo: "task", titolo: task.titolo }), draggable: false, selectable: false },
      ...task.rischi.flatMap((r) => [
        nodo(idNodo({ tipo: "rischio", id: r.id }), r.posizione, { tipo: "rischio", rischio: r }),
        ...r.test.flatMap((t) => [
          nodo(idNodo({ tipo: "test", id: t.id }), t.posizione, {
            tipo: "test",
            test: t,
            daEseguire: daEseguire.has(idNodo({ tipo: "test", id: t.id })),
            solaLettura,
            onEsito: (esito) => applica(impostaEsito(progetto, task.id, t.id, esito)),
          }),
          ...(t.pianoB?.tipo === "azione"
            ? [
                nodo(idNodo({ tipo: "azione", id: t.id }), t.pianoB.posizione, {
                  tipo: "azione",
                  testo: t.pianoB.testo,
                  daEseguire: daEseguire.has(idNodo({ tipo: "azione", id: t.id })),
                }),
              ]
            : []),
        ]),
      ]),
    ];
  }, [progetto, task, applica, solaLettura, selezione, trascinate, misure]);

  const frecce = useMemo<Edge[]>(() => {
    const daEseguire = new Set(pianiBDaEseguire(task).map((p) => p.testId));
    const freccia = (source: string, target: string, piano?: string): Edge => {
      const id = `${source}->${target}`;
      return {
        id,
        source,
        target,
        // Solo le frecce del piano B si eliminano con Canc: le altre sono la struttura della catena.
        deletable: piano !== undefined && !solaLettura,
        selectable: piano !== undefined,
        selected: frecceSelezionate.has(id),
        className: piano ? `freccia-piano-b${daEseguire.has(piano) ? " da-eseguire" : ""}` : undefined,
        animated: piano !== undefined && daEseguire.has(piano),
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        label: piano ? "piano B" : undefined,
      };
    };
    return task.rischi.flatMap((r) => {
      const rid = idNodo({ tipo: "rischio", id: r.id });
      return [
        freccia("task", rid),
        ...r.test.flatMap((t) => {
          const tid = idNodo({ tipo: "test", id: t.id });
          const piano = t.pianoB;
          return [
            freccia(rid, tid),
            ...(piano ? [freccia(tid, idNodo(piano.tipo === "test" ? { tipo: "test", id: piano.testId } : { tipo: "azione", id: t.id }), t.id)] : []),
          ];
        }),
      ];
    });
  }, [task, solaLettura, frecceSelezionate]);

  const suCambioNodi: OnNodesChange<NodoCatena> = (cambi) => {
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
    const finiti = spostamenti.filter((c) => !c.dragging);
    if (finiti.length > 0) {
      applica(
        finiti.reduce<Esito>((e, c) => {
          const rif = rifDa(c.id);
          return e.tipo === "ok" && rif ? spostaNodoCatena(e.progetto, task.id, rif, c.position!) : e;
        }, { tipo: "ok", progetto }),
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
      const nuova = new Set(attuali);
      for (const c of selezioni) {
        if (c.selected) nuova.add(c.id);
        else nuova.delete(c.id);
      }
      return nuova;
    });
  };

  // Una freccia del piano B parte sempre dal suo test: eliminarla toglie il piano B.
  const suEliminaFrecce = (eliminate: Edge[]) => {
    applica(
      eliminate.reduce<Esito>((e, f) => {
        const rif = rifDa(f.source);
        return e.tipo === "ok" && rif?.tipo === "test" ? rimuoviPianoB(e.progetto, task.id, rif.id) : e;
      }, { tipo: "ok", progetto }),
    );
    setFrecceSelezionate(new Set());
  };

  return (
    <div className="grafo-catena">
      <ReactFlow
        nodes={nodi}
        edges={frecce}
        nodeTypes={tipiNodo}
        onNodeClick={(_, nodo) => onSeleziona(rifDa(nodo.id))}
        onPaneClick={() => onSeleziona(null)}
        onNodesChange={suCambioNodi}
        onEdgesChange={suCambioFrecce}
        onEdgesDelete={suEliminaFrecce}
        onConnect={({ source, target }) => {
          const da = rifDa(source);
          const a = rifDa(target);
          if (da?.tipo === "test" && a?.tipo === "test") applica(impostaPianoB(progetto, task.id, da.id, { tipo: "test", testId: a.id }));
        }}
        deleteKeyCode={["Delete", "Backspace"]}
        onBeforeDelete={async () => !document.querySelector("dialog[open]")}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <Background />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <button onClick={onSchermoIntero} title={schermoIntero ? "Torna alla tendina (Esc)" : "Allarga a tutto schermo"}>
            {schermoIntero ? "Riduci" : "Tutto schermo"}
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function CatenaVerifica(props: Props) {
  const [selezione, setSelezione] = useState<RifNodo | null>(null);
  const [schermoIntero, setSchermoIntero] = useState(false);

  useEffect(() => {
    if (!schermoIntero) return;
    // Esc riduce la catena prima di chiudere la tendina: il listener in cattura arriva prima di quello della tendina.
    const suTasto = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      e.stopPropagation();
      setSchermoIntero(false);
    };
    window.addEventListener("keydown", suTasto, true);
    return () => window.removeEventListener("keydown", suTasto, true);
  }, [schermoIntero]);

  return (
    <section className={`catena${schermoIntero ? " a-tutto-schermo" : ""}`} aria-label="Catena di verifica">
      <h3>Catena di verifica</h3>
      {/* La key rimonta il grafo al cambio di dimensione, così si inquadra di nuovo. */}
      <ReactFlowProvider key={schermoIntero ? "grande" : "piccolo"}>
        <GrafoCatena
          {...props}
          selezione={selezione}
          onSeleziona={setSelezione}
          schermoIntero={schermoIntero}
          onSchermoIntero={() => setSchermoIntero((s) => !s)}
        />
      </ReactFlowProvider>
      <Dettaglio {...props} selezione={selezione} onSeleziona={setSelezione} />
    </section>
  );
}
