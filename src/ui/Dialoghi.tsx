import { useEffect, useRef, useState, type ReactNode } from "react";

function Finestra({ children, onAnnulla }: { children: ReactNode; onAnnulla: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      className="dialogo"
      onCancel={(e) => {
        e.preventDefault();
        onAnnulla();
      }}
    >
      {children}
    </dialog>
  );
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
        onSubmit={(e) => {
          e.preventDefault();
          props.onConferma(testo);
        }}
      >
        <h2>{props.titolo}</h2>
        <label>
          {props.etichetta}
          <input autoFocus value={testo} onChange={(e) => setTesto(e.target.value)} />
        </label>
        <div className="azioni">
          <button type="button" onClick={props.onAnnulla}>
            Annulla
          </button>
          <button type="submit" disabled={!testo.trim()}>
            OK
          </button>
        </div>
      </form>
    </Finestra>
  );
}

export function Conferma(props: {
  messaggio: string;
  etichettaConferma: string;
  onConferma: () => void;
  onAnnulla: () => void;
}) {
  return (
    <Finestra onAnnulla={props.onAnnulla}>
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
