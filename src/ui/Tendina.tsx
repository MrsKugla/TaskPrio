import { useEffect, useState } from "react";
import {
  COSTI_FOCUS,
  COSTI_TEMPO,
  PRIORITA,
  STATI,
  bloccanti,
  cambiaStato,
  dipendenti,
  eliminaTask,
  modificaTask,
  motivoNonAtomica,
  riapri,
  type AttributiTask,
  type Esito,
  type EsitoStato,
  type OpzioniStato,
  type Progetto,
  type MotivoAumento,
  type PrioritaEffettiva,
  type Task,
} from "../regole";
import { ETICHETTE_FOCUS, ETICHETTE_PRIORITA, ETICHETTE_STATO, ETICHETTE_TEMPO, Etichetta, IconaFocus, Pallini } from "./aspetto";
import { CatenaVerifica } from "./CatenaVerifica";
import { Conferma } from "./Dialoghi";
import { Icona, TERN } from "./schermo";

type Props = {
  progetto: Progetto;
  task: Task;
  effettive: Map<string, PrioritaEffettiva>;
  applica: (esito: Esito) => boolean;
  onChiudi: () => void;
  onApri: (taskId: string) => void;
  inFocus: boolean;
  // null esce dal focus.
  onFocus: (taskId: string | null) => void;
};

function testoMotivo(motivo: MotivoAumento): string {
  return motivo.tipo === "blocca"
    ? `blocca: ${motivo.task.map((t) => t.titolo).join(", ")}`
    : `presto alta scaduta il ${new Date(motivo.il).toLocaleDateString("it-IT")}`;
}

// Elenco di task cliccabili: un clic apre quella task nella tendina.
function ElencoTask(props: {
  titolo: string;
  vuoto: string;
  task: Task[];
  effettive: Map<string, PrioritaEffettiva>;
  onApri: (id: string) => void;
}) {
  const { titolo, vuoto, task, effettive, onApri } = props;
  return (
    <section className="elenco-task">
      <h3 className="t-sec">{titolo}</h3>
      {task.length === 0 ? (
        <p className="vuoto-piccolo t-note">{vuoto}</p>
      ) : (
        <ul className="t-list">
          {task.map((t) => (
            <li key={t.id}>
              <button className="voce-task t-row" onClick={() => onApri(t.id)}>
                <span className={`campione t-dot priorita-${effettive.get(t.id)!.priorita}`} aria-hidden="true" />
                {TERN ? <span className="t-row-title">{t.titolo}</span> : t.titolo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Larghezza della tendina, scelta trascinando il bordo sinistro. Resta uguale passando da una task all'altra
// e alla riapertura: è una preferenza dello schermo, non un dato, quindi sta in localStorage e non nel backup.
const CHIAVE_LARGHEZZA = "larghezza-tendina";
const LARGHEZZA_MINIMA = 320;
const larghezzaMassima = () => Math.max(LARGHEZZA_MINIMA, Math.round(window.innerWidth * 0.7));
const limita = (px: number) => Math.min(larghezzaMassima(), Math.max(LARGHEZZA_MINIMA, Math.round(px)));
const larghezzaSalvata = () => limita(Number(localStorage.getItem(CHIAVE_LARGHEZZA)) || LARGHEZZA_MINIMA);

function ManigliaLarghezza({ larghezza, onCambia }: { larghezza: number; onCambia: (px: number) => void }) {
  const salva = (px: number) => {
    const nuova = limita(px);
    onCambia(nuova);
    localStorage.setItem(CHIAVE_LARGHEZZA, String(nuova));
  };
  return (
    <div
      className="maniglia-tendina"
      role="separator"
      aria-orientation="vertical"
      aria-label="Larghezza della tendina"
      aria-valuenow={larghezza}
      aria-valuemin={LARGHEZZA_MINIMA}
      aria-valuemax={larghezzaMassima()}
      tabIndex={0}
      title="Trascina per allargare · doppio clic per tornare stretta"
      onPointerDown={(e) => {
        e.preventDefault();
        const maniglia = e.currentTarget;
        maniglia.setPointerCapture(e.pointerId);
        // La tendina sta sul bordo destro: allargarla vuol dire spostare la maniglia verso sinistra.
        const destra = maniglia.parentElement!.getBoundingClientRect().right;
        const muovi = (ev: PointerEvent) => salva(destra - ev.clientX);
        const fine = () => {
          maniglia.removeEventListener("pointermove", muovi);
          maniglia.removeEventListener("pointerup", fine);
          maniglia.removeEventListener("pointercancel", fine);
        };
        maniglia.addEventListener("pointermove", muovi);
        maniglia.addEventListener("pointerup", fine);
        maniglia.addEventListener("pointercancel", fine);
      }}
      onDoubleClick={() => salva(LARGHEZZA_MINIMA)}
      onKeyDown={(e) => {
        const passo = e.shiftKey ? 80 : 20;
        if (e.key === "ArrowLeft") salva(larghezza + passo);
        else if (e.key === "ArrowRight") salva(larghezza - passo);
        else return;
        // Le frecce non devono arrivare al grafo né al cambio variante del prototipo.
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

export function Tendina({ progetto, task, effettive, applica, onChiudi, onApri, inFocus, onFocus }: Props) {
  // Il titolo si modifica in locale: un titolo vuoto non si salva e all'uscita dal campo torna quello salvato.
  // Chi usa la tendina le dà key={task.id}, così il campo riparte a ogni cambio di task.
  const [titolo, setTitolo] = useState(task.titolo);
  const [confermaElimina, setConfermaElimina] = useState(false);
  const [larghezza, setLarghezza] = useState(larghezzaSalvata);
  // Controsenso in attesa del «Sei sicura?»: confermando si ripete il comando con «confermato».
  const [controsenso, setControsenso] = useState<{ messaggio: string; conferma: () => void } | null>(null);

  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      // Esc in una finestra di dialogo chiude solo quella.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onChiudi();
    };
    window.addEventListener("keydown", suTasto);
    return () => window.removeEventListener("keydown", suTasto);
  }, [onChiudi]);

  const modifica = (modifiche: Partial<AttributiTask>) => applica(modificaTask(progetto, task.id, modifiche));

  const applicaStato = (comando: (opzioni: OpzioniStato) => EsitoStato) => {
    const esito = comando({});
    if (esito.tipo !== "richiedeConferma") {
      applica(esito);
      return;
    }
    setControsenso({
      messaggio: esito.controsenso,
      conferma: () => {
        const confermato = comando({ confermato: true });
        if (confermato.tipo !== "richiedeConferma") applica(confermato);
      },
    });
  };

  const fatta = task.stato === "fatta";
  const effettiva = effettive.get(task.id)!;
  const nonAtomica = motivoNonAtomica(task);

  return (
    <aside className="tendina t-island" aria-label="Dettagli della task" style={{ width: larghezza }}>
      <ManigliaLarghezza larghezza={larghezza} onCambia={setLarghezza} />
      <header className="t-head">
        <h2 className="title">Task</h2>
        <span className="azioni-tendina">
          {/* Il focus è una vista, non una modifica: si usa anche su una task fatta. */}
          <button
            className={`t-btn sm${inFocus ? " attiva" : ""}`}
            aria-pressed={inFocus}
            onClick={() => onFocus(inFocus ? null : task.id)}
            title={inFocus ? "Torna al grafo completo con i filtri di prima" : "Mostra solo questa task e le sue dipendenze"}
          >
            <Icona nome={inFocus ? "eye-off" : "eye"} />
            {inFocus ? "Esci dal focus" : "Focus"}
          </button>
          <button className="chiudi t-btn icon sm quiet" onClick={onChiudi} aria-label="Chiudi" title="Chiudi (Esc)">
            {TERN ? <Icona nome="x" /> : "×"}
          </button>
        </span>
      </header>

      {/* Una task fatta è in sola lettura: il fieldset disabilita tutti i campi finché non si usa «Riapri». */}
      <fieldset className="campi" disabled={fatta}>
        <fieldset>
          <legend className="t-sec">Stato</legend>
          {STATI.map((s) => (
            <label key={s} className="scelta t-opt">
              <input
                className="t-radio"
                type="radio"
                name="stato"
                checked={task.stato === s}
                onChange={() => applicaStato((opzioni) => cambiaStato(progetto, task.id, s, opzioni))}
              />
              {ETICHETTE_STATO[s]}
            </label>
          ))}
        </fieldset>

        <label className="t-field">
          <Etichetta>Titolo</Etichetta>
          <input
            className="t-input"
            value={titolo}
            onChange={(e) => {
              setTitolo(e.target.value);
              if (e.target.value.trim()) modifica({ titolo: e.target.value });
            }}
            onBlur={() => setTitolo(task.titolo)}
          />
        </label>

        <label className="t-field">
          <Etichetta>Descrizione</Etichetta>
          <textarea className="t-textarea" rows={5} value={task.descrizione} onChange={(e) => modifica({ descrizione: e.target.value })} />
        </label>

        <fieldset>
          <legend className="t-sec">Priorità scelta</legend>
          {effettiva.motivi.length > 0 && (
            // Avviso in linea di tern-ui, tinto dal colore della priorità alzata.
            <p className={`priorita-effettiva t-callout priorita-${effettiva.priorita}`} data-tone="warning">
              {TERN ? <Icona nome="arrow-up" /> : <span className="campione" aria-hidden="true" />}
              <span>
                {TERN ? "" : "↑ "}
                {ETICHETTE_PRIORITA[effettiva.priorita]} perché {effettiva.motivi.map(testoMotivo).join("; ")}
              </span>
            </p>
          )}
          {PRIORITA.map((p) => (
            <label key={p} className="scelta t-opt">
              <input className="t-radio" type="radio" name="priorita" checked={task.priorita === p} onChange={() => modifica({ priorita: p })} />
              <span className={`campione t-dot priorita-${p}`} aria-hidden="true" />
              {ETICHETTE_PRIORITA[p]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="t-sec">Costo focus</legend>
          {COSTI_FOCUS.map((f) => (
            <label key={f} className="scelta t-opt">
              <input className="t-radio" type="radio" name="costoFocus" checked={task.costoFocus === f} onChange={() => modifica({ costoFocus: f })} />
              <IconaFocus focus={f} />
              {ETICHETTE_FOCUS[f]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="t-sec">Costo tempo</legend>
          {COSTI_TEMPO.map((t) => (
            <label key={t} className="scelta t-opt">
              <input className="t-radio" type="radio" name="costoTempo" checked={task.costoTempo === t} onChange={() => modifica({ costoTempo: t })} />
              <Pallini tempo={t} />
              {ETICHETTE_TEMPO[t]}
            </label>
          ))}
        </fieldset>

        <label className="scelta t-opt" title={nonAtomica}>
          <input
            className="t-switch"
            role="switch"
            type="checkbox"
            checked={task.atomica}
            disabled={nonAtomica !== undefined}
            onChange={(e) => modifica({ atomica: e.target.checked })}
          />
          Atomica
        </label>
      </fieldset>

      {fatta && (
        <button className="riapri t-btn" onClick={() => applicaStato((opzioni) => riapri(progetto, task.id, opzioni))}>
          <Icona nome="undo" />
          Riapri
        </button>
      )}

      <ElencoTask titolo="Blocca" vuoto="Nessuna task dipende da questa." task={dipendenti(progetto, task.id)} effettive={effettive} onApri={onApri} />
      <ElencoTask titolo="Dipende da" vuoto="Non dipende da altre task." task={bloccanti(progetto, task.id)} effettive={effettive} onApri={onApri} />

      {/* Una task atomica non richiede test: non ha catena di verifica. */}
      {!task.atomica && <CatenaVerifica progetto={progetto} task={task} applica={applica} solaLettura={fatta} onApri={onApri} />}

      <button className="pericolo elimina-task t-btn danger" onClick={() => setConfermaElimina(true)}>
        <Icona nome="trash" />
        Elimina task
      </button>

      {confermaElimina && (
        <Conferma
          messaggio={`Eliminare la task «${task.titolo}»?`}
          etichettaConferma="Elimina"
          pericolo
          onAnnulla={() => setConfermaElimina(false)}
          onConferma={() => {
            setConfermaElimina(false);
            if (applica(eliminaTask(progetto, task.id))) onChiudi();
          }}
        />
      )}
      {controsenso && (
        <Conferma
          titolo="Controsenso"
          messaggio={controsenso.messaggio}
          etichettaConferma="Conferma"
          onAnnulla={() => setControsenso(null)}
          onConferma={() => {
            setControsenso(null);
            controsenso.conferma();
          }}
        />
      )}
    </aside>
  );
}
