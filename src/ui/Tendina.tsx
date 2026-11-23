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
  puoEssereAtomica,
  riapri,
  type AttributiTask,
  type Esito,
  type EsitoStato,
  type OpzioniStato,
  type Progetto,
  type Task,
} from "../regole";
import { ETICHETTE_FOCUS, ETICHETTE_PRIORITA, ETICHETTE_STATO, ETICHETTE_TEMPO, IconaFocus, Pallini } from "./aspetto";
import { Conferma } from "./Dialoghi";

type Props = {
  progetto: Progetto;
  task: Task;
  applica: (esito: Esito) => boolean;
  onChiudi: () => void;
  onApri: (taskId: string) => void;
};

// Elenco di task cliccabili: un clic apre quella task nella tendina.
function ElencoTask({ titolo, vuoto, task, onApri }: { titolo: string; vuoto: string; task: Task[]; onApri: (id: string) => void }) {
  return (
    <section className="elenco-task">
      <h3>{titolo}</h3>
      {task.length === 0 ? (
        <p className="vuoto-piccolo">{vuoto}</p>
      ) : (
        <ul>
          {task.map((t) => (
            <li key={t.id}>
              <button className="voce-task" onClick={() => onApri(t.id)}>
                <span className={`campione priorita-${t.priorita}`} aria-hidden="true" />
                {t.titolo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Tendina({ progetto, task, applica, onChiudi, onApri }: Props) {
  // Il titolo si modifica in locale: un titolo vuoto non si salva e all'uscita dal campo torna quello salvato.
  // Chi usa la tendina le dà key={task.id}, così il campo riparte a ogni cambio di task.
  const [titolo, setTitolo] = useState(task.titolo);
  const [confermaElimina, setConfermaElimina] = useState(false);
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

  return (
    <aside className="tendina" aria-label="Dettagli della task">
      <header>
        <h2>Task</h2>
        <button className="chiudi" onClick={onChiudi} aria-label="Chiudi" title="Chiudi (Esc)">
          ×
        </button>
      </header>

      {/* Una task fatta è in sola lettura: il fieldset disabilita tutti i campi finché non si usa «Riapri». */}
      <fieldset className="campi" disabled={fatta}>
        <fieldset>
          <legend>Stato</legend>
          {STATI.map((s) => (
            <label key={s} className="scelta">
              <input
                type="radio"
                name="stato"
                checked={task.stato === s}
                onChange={() => applicaStato((opzioni) => cambiaStato(progetto, task.id, s, opzioni))}
              />
              {ETICHETTE_STATO[s]}
            </label>
          ))}
        </fieldset>

        <label>
          Titolo
          <input
            value={titolo}
            onChange={(e) => {
              setTitolo(e.target.value);
              if (e.target.value.trim()) modifica({ titolo: e.target.value });
            }}
            onBlur={() => setTitolo(task.titolo)}
          />
        </label>

        <label>
          Descrizione
          <textarea rows={5} value={task.descrizione} onChange={(e) => modifica({ descrizione: e.target.value })} />
        </label>

        <fieldset>
          <legend>Priorità</legend>
          {PRIORITA.map((p) => (
            <label key={p} className="scelta">
              <input type="radio" name="priorita" checked={task.priorita === p} onChange={() => modifica({ priorita: p })} />
              <span className={`campione priorita-${p}`} aria-hidden="true" />
              {ETICHETTE_PRIORITA[p]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Costo focus</legend>
          {COSTI_FOCUS.map((f) => (
            <label key={f} className="scelta">
              <input type="radio" name="costoFocus" checked={task.costoFocus === f} onChange={() => modifica({ costoFocus: f })} />
              <IconaFocus focus={f} />
              {ETICHETTE_FOCUS[f]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Costo tempo</legend>
          {COSTI_TEMPO.map((t) => (
            <label key={t} className="scelta">
              <input type="radio" name="costoTempo" checked={task.costoTempo === t} onChange={() => modifica({ costoTempo: t })} />
              <Pallini tempo={t} />
              {ETICHETTE_TEMPO[t]}
            </label>
          ))}
        </fieldset>

        <label className="scelta" title={puoEssereAtomica(task.costoTempo) ? undefined : "Una task oltre le 4h non può essere atomica"}>
          <input
            type="checkbox"
            checked={task.atomica}
            disabled={!puoEssereAtomica(task.costoTempo)}
            onChange={(e) => modifica({ atomica: e.target.checked })}
          />
          Atomica
        </label>
      </fieldset>

      {fatta && (
        <button className="riapri" onClick={() => applicaStato((opzioni) => riapri(progetto, task.id, opzioni))}>
          Riapri
        </button>
      )}

      <ElencoTask titolo="Blocca" vuoto="Nessuna task dipende da questa." task={dipendenti(progetto, task.id)} onApri={onApri} />
      <ElencoTask titolo="Dipende da" vuoto="Non dipende da altre task." task={bloccanti(progetto, task.id)} onApri={onApri} />

      <button className="pericolo elimina-task" onClick={() => setConfermaElimina(true)}>
        Elimina task
      </button>

      {confermaElimina && (
        <Conferma
          messaggio={`Eliminare la task «${task.titolo}»?`}
          etichettaConferma="Elimina"
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
