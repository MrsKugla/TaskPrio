import { useEffect, useState } from "react";
import {
  COSTI_FOCUS,
  COSTI_TEMPO,
  PRIORITA,
  eliminaTask,
  modificaTask,
  puoEssereAtomica,
  type AttributiTask,
  type Esito,
  type Progetto,
  type Task,
} from "../regole";
import { ETICHETTE_FOCUS, ETICHETTE_PRIORITA, ETICHETTE_TEMPO, IconaFocus, Pallini } from "./aspetto";
import { Conferma } from "./Dialoghi";

type Props = {
  progetto: Progetto;
  task: Task;
  applica: (esito: Esito) => boolean;
  onChiudi: () => void;
};

export function Tendina({ progetto, task, applica, onChiudi }: Props) {
  // Il titolo si modifica in locale: un titolo vuoto non si salva e all'uscita dal campo torna quello salvato.
  // Chi usa la tendina le dà key={task.id}, così il campo riparte a ogni cambio di task.
  const [titolo, setTitolo] = useState(task.titolo);
  const [confermaElimina, setConfermaElimina] = useState(false);

  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      // Esc in una finestra di dialogo chiude solo quella.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onChiudi();
    };
    window.addEventListener("keydown", suTasto);
    return () => window.removeEventListener("keydown", suTasto);
  }, [onChiudi]);

  const modifica = (modifiche: Partial<AttributiTask>) => applica(modificaTask(progetto, task.id, modifiche));

  return (
    <aside className="tendina" aria-label="Dettagli della task">
      <header>
        <h2>Task</h2>
        <button className="chiudi" onClick={onChiudi} aria-label="Chiudi" title="Chiudi (Esc)">
          ×
        </button>
      </header>

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
    </aside>
  );
}
