import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { Task } from "../regole";
import { ETICHETTE_PRIORITA, ETICHETTE_STATO, IconaFocus, Pallini } from "./aspetto";

export type NodoTask = Node<{ task: Task; bloccata: boolean }, "task">;

export function NodoTask({ id, data: { task, bloccata }, selected }: NodeProps<NodoTask>) {
  // Durante un trascinamento partito da un'altra task, tutto il nodo diventa il punto d'arrivo.
  const bersaglio = useConnection((c) => c.inProgress && c.fromNode.id !== id);
  return (
    <div
      className={`nodo-task priorita-${task.priorita} stato-${task.stato}${selected ? " selezionato" : ""}`}
      title={`Priorità: ${ETICHETTE_PRIORITA[task.priorita]} · Stato: ${ETICHETTE_STATO[task.stato]}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        className={`arrivo-dipendenza${bersaglio ? " attivo" : ""}`}
      />
      <div className="nodo-titolo">
        {task.titolo}
        <span className="simboli">
          {bloccata && (
            <span role="img" aria-label="Bloccata" title="Bloccata: dipende da una task non fatta">
              🔒
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
        position={Position.Right}
        isConnectableEnd={false}
        className="partenza-dipendenza"
        title="Trascina su un'altra task: quella dipenderà da questa"
      />
    </div>
  );
}
