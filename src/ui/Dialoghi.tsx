import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icona, TERN } from "./schermo";

// Nello stile tern la finestra è quella di tern-ui: testata con icona e titolo, corpo, piede con le azioni a destra.
// Le classi tern-ui sono innocue nello stile arcade, che non le conosce; la struttura cambia solo in tern.
function Finestra(props: { children: ReactNode; onAnnulla: () => void; variante?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      className={`dialogo t-dialog ${props.variante ?? "sm"}`}
      onCancel={(e) => {
        e.preventDefault();
        props.onAnnulla();
      }}
    >
      {props.children}
    </dialog>
  );
}

function Testata({ titolo, icona }: { titolo?: string; icona: string }) {
  if (!TERN) return titolo ? <h2>{titolo}</h2> : null;
  if (!titolo) return null;
  return (
    <header className="t-dialog-head">
      <span className="t-dialog-ic">
        <Icona nome={icona} />
      </span>
      <div className="t-dialog-titles">
        <h2 className="t-dialog-title">{titolo}</h2>
      </div>
    </header>
  );
}

// In tern il contenuto sta nel corpo e i bottoni nel piede; in arcade restano come prima.
function Corpo({ children }: { children: ReactNode }) {
  return TERN ? <div className="t-dialog-body">{children}</div> : <>{children}</>;
}

function Azioni({ children }: { children: ReactNode }) {
  return <div className={TERN ? "azioni t-dialog-foot" : "azioni"}>{children}</div>;
}

export function ChiediTesto(props: {
  titolo: string;
  etichetta: string;
  iniziale?: string;
  onConferma: (testo: string) => void;
  onAnnulla: () => void;
}) {
  const [testo, setTesto] = useState(props.iniziale ?? "");
  return (
    <Finestra onAnnulla={props.onAnnulla}>
      <form
        method="dialog"
        style={TERN ? { display: "contents" } : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          props.onConferma(testo);
        }}
      >
        <Testata titolo={props.titolo} icona={props.iniziale === undefined ? "plus" : "pen"} />
        <Corpo>
          <label className="t-field">
            {TERN ? <span className="t-label">{props.etichetta}</span> : props.etichetta}
            <input className="t-input lg" autoFocus value={testo} onChange={(e) => setTesto(e.target.value)} />
          </label>
        </Corpo>
        <Azioni>
          <button type="button" className="t-btn lg quiet" onClick={props.onAnnulla}>
            Annulla
          </button>
          <button type="submit" className="t-btn lg primary" disabled={!testo.trim()}>
            {TERN ? (props.iniziale === undefined ? "Crea" : "Rinomina") : "OK"}
          </button>
        </Azioni>
      </form>
    </Finestra>
  );
}

export function Conferma(props: {
  titolo?: string;
  messaggio: string;
  etichettaConferma: string;
  // Conferma di un'eliminazione: in tern l'avviso è rosso, con il cestino.
  pericolo?: boolean;
  onConferma: () => void;
  onAnnulla: () => void;
}) {
  // Nello stile tern la conferma è l'avviso breve di tern-ui: icona grande, testo centrato, bottoni impilati.
  if (TERN) {
    const elimina = props.pericolo === true;
    return (
      <Finestra onAnnulla={props.onAnnulla} variante={elimina ? "alert danger" : "alert"}>
        <AvvisoTern
          icona={elimina ? "trash" : "warn"}
          titolo={props.titolo ?? props.messaggio}
          sotto={props.titolo ? props.messaggio : undefined}
        >
          <button autoFocus className="t-btn quiet" onClick={props.onAnnulla}>
            Annulla
          </button>
          <button className={`t-btn ${elimina ? "danger" : "primary"}`} onClick={props.onConferma}>
            {props.etichettaConferma}
          </button>
        </AvvisoTern>
      </Finestra>
    );
  }
  return (
    <Finestra onAnnulla={props.onAnnulla}>
      {props.titolo && <h2>{props.titolo}</h2>}
      <p>{props.messaggio}</p>
      <div className="azioni">
        <button autoFocus onClick={props.onAnnulla}>
          Annulla
        </button>
        <button className="pericolo" onClick={props.onConferma}>
          {props.etichettaConferma}
        </button>
      </div>
    </Finestra>
  );
}

// Avviso che si può solo chiudere, con un elenco facoltativo (es. le task di un cerchio).
export function Avviso(props: { messaggio: string; elenco?: string[]; onChiudi: () => void }) {
  const elenco = props.elenco && (
    <ol>
      {props.elenco.map((voce, i) => (
        <li key={i}>{voce}</li>
      ))}
    </ol>
  );
  if (TERN) {
    return (
      <Finestra onAnnulla={props.onChiudi}>
        <Testata titolo="Avviso" icona="info" />
        <Corpo>
          <p>{props.messaggio}</p>
          {elenco}
        </Corpo>
        <Azioni>
          <button autoFocus className="t-btn lg primary" onClick={props.onChiudi}>
            Chiudi
          </button>
        </Azioni>
      </Finestra>
    );
  }
  return (
    <Finestra onAnnulla={props.onChiudi}>
      <p>{props.messaggio}</p>
      {elenco}
      <div className="azioni">
        <button autoFocus onClick={props.onChiudi}>
          OK
        </button>
      </div>
    </Finestra>
  );
}

function AvvisoTern(props: { icona: string; titolo: string; sotto?: string; children: ReactNode }) {
  return (
    <>
      <header className="t-dialog-head">
        <span className="t-dialog-ic">
          <Icona nome={props.icona} />
        </span>
        <div className="t-dialog-titles">
          <h2 className="t-dialog-title">{props.titolo}</h2>
          {props.sotto && <p className="t-dialog-sub">{props.sotto}</p>}
        </div>
      </header>
      <footer className="t-dialog-foot">{props.children}</footer>
    </>
  );
}
