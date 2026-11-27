import { useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Icona, TERN } from "./schermo";

// Cornice di una sezione nel grafo: un nodo di React Flow largo quanto le sue task, disegnato sotto di loro.
// Solo l'etichetta si afferra (dragHandle): trascinandola si spostano tutte le task della sezione.
// Il resto della cornice lascia passare i clic al grafo, così dentro si crea, si seleziona e si sposta come fuori.
export type NodoSezione = Node<
  { nome: string; quante: number; onRinomina: (nome: string) => void; onElimina: () => void },
  "sezione"
>;

export const MANIGLIA_SEZIONE = "sezione-etichetta";

export function NodoSezione({ data: { nome, quante, onRinomina, onElimina } }: NodeProps<NodoSezione>) {
  // Nome in modifica dopo il doppio clic sull'etichetta; null quando non si modifica.
  const [bozza, setBozza] = useState<string | null>(null);
  const conferma = () => {
    if (bozza !== null && bozza.trim() && bozza.trim() !== nome) onRinomina(bozza);
    setBozza(null);
  };
  return (
    <div className={`sezione${TERN ? " t-lane" : ""}`}>
      <div
        className={`${MANIGLIA_SEZIONE}${TERN ? " t-lane-head" : ""}`}
        title="Trascina per spostare la sezione · doppio clic per rinominarla"
        onDoubleClick={(e) => {
          // Il doppio clic sul grafo crea una task: qui rinomina e basta.
          e.stopPropagation();
          setBozza(nome);
        }}
      >
        {bozza === null ? (
          <span className="sezione-nome">{nome}</span>
        ) : (
          <input
            className="sezione-campo t-input nodrag"
            autoFocus
            aria-label="Nome della sezione"
            value={bozza}
            onChange={(e) => setBozza(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={conferma}
            onKeyDown={(e) => {
              if (e.key === "Enter") conferma();
              if (e.key !== "Escape") return;
              // Esc annulla solo la modifica del nome, non chiude la tendina.
              e.stopPropagation();
              setBozza(null);
            }}
          />
        )}
        {TERN && <span className="t-count">{quante}</span>}
        <button
          className="sezione-elimina t-btn icon sm quiet nodrag"
          aria-label={`Togli la sezione «${nome}»`}
          title="Togli la sezione (le task restano)"
          onClick={(e) => {
            e.stopPropagation();
            onElimina();
          }}
        >
          {TERN ? <Icona nome="x" /> : "×"}
        </button>
      </div>
    </div>
  );
}
