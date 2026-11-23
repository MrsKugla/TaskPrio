import type { Node, NodeProps } from "@xyflow/react";
import type { Task } from "../regole";
import { ETICHETTE_PRIORITA, IconaFocus, Pallini } from "./aspetto";

export type NodoTask = Node<{ task: Task }, "task">;

export function NodoTask({ data: { task }, selected }: NodeProps<NodoTask>) {
  return (
    <div
      className={`nodo-task priorita-${task.priorita}${selected ? " selezionato" : ""}`}
      title={`Priorità: ${ETICHETTE_PRIORITA[task.priorita]}`}
    >
      <div className="nodo-titolo">
        {task.titolo}
        {task.atomica && (
          <span className="simbolo-atomica" role="img" aria-label="Atomica" title="Atomica">
            ◆
          </span>
        )}
      </div>
      <div className="nodo-costi">
        <IconaFocus focus={task.costoFocus} />
        <Pallini tempo={task.costoTempo} />
      </div>
    </div>
  );
}
