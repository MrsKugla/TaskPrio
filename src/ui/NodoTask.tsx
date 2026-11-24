import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import { haRischiAperti, type PrioritaEffettiva, type Task } from "../regole";
import { ETICHETTE_PRIORITA, ETICHETTE_STATO, IconaFocus, Pallini } from "./aspetto";

export type NodoTask = Node<{ task: Task; effettiva: PrioritaEffettiva; bloccata: boolean }, "task">;

export function NodoTask({ id, data: { task, effettiva, bloccata }, selected }: NodeProps<NodoTask>) {
  // Durante un trascinamento partito da un'altra task, tutto il nodo diventa il punto d'arrivo.
  const bersaglio = useConnection((c) => c.inProgress && c.fromNode.id !== id);
  const alzata = effettiva.motivi.length > 0;
  const priorita = alzata
    ? `${ETICHETTE_PRIORITA[effettiva.priorita]} (scelta: ${ETICHETTE_PRIORITA[task.priorita]})`
    : ETICHETTE_PRIORITA[task.priorita];
  return (
    <div
      className={`nodo-task priorita-${effettiva.priorita} stato-${task.stato}${selected ? " selezionato" : ""}`}
      title={`${task.titolo}\nPriorità: ${priorita} · Stato: ${ETICHETTE_STATO[task.stato]}`}
    >
      <Handle
        type="target"
        position={Position.Right}
        isConnectableStart={false}
        className={`arrivo-dipendenza${bersaglio ? " attivo" : ""}`}
      />
      <div className="nodo-titolo">
        <span className="testo-titolo">{task.titolo}</span>
        <span className="simboli">
          {alzata && (
            <span className="simbolo-alzata" role="img" aria-label="Priorità alzata" title="Priorità alzata dalle regole">
              ↑
            </span>
          )}
          {bloccata && (
            <span role="img" aria-label="Bloccata" title="Bloccata: dipende da una task non fatta">
              🔒
            </span>
          )}
          {haRischiAperti(task) && (
            <span className="simbolo-rischi" role="img" aria-label="Rischi aperti" title="Rischi aperti: ci sono rischi senza test o con test non ancora passati">
              ⚠
            </span>
          )}
          {task.atomica && (
            <span className="simbolo-atomica" role="img" aria-label="Atomica" title="Atomica">
              ◆
            </span>
          )}
        </span>
      </div>
      <div className="nodo-costi">
        <IconaFocus focus={task.costoFocus} />
        <Pallini tempo={task.costoTempo} />
      </div>
      <Handle
        type="source"
        position={Position.Left}
        isConnectableEnd={false}
        className="partenza-dipendenza"
        title="Trascina sulla task da cui questa dipende"
      />
    </div>
  );
}
