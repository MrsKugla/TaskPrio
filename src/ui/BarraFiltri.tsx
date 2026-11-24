import type { ReactNode } from "react";
import { COSTI_FOCUS, COSTI_TEMPO, PRIORITA, STATI, type Filtri, type Task } from "../regole";
import { ETICHETTE_PRIORITA, ETICHETTE_STATO, ETICHETTE_TEMPO, IconaFocus } from "./aspetto";

type Props = {
  filtri: Filtri;
  onCambia: (filtri: Filtri) => void;
  // Task in focus: i filtri restano visibili ma fermi, così all'uscita tornano quelli di prima.
  focus: Task | null;
  onEsciDalFocus: () => void;
};

type Gruppo = Exclude<keyof Filtri, "nascondiFatte">;

// Un gruppo di caselle: nessuna spuntata = nessun filtro su quel gruppo.
function GruppoFiltro<T extends string>(props: {
  legenda: string;
  valori: readonly T[];
  scelti: T[];
  onCambia: (scelti: T[]) => void;
  etichetta: (valore: T) => ReactNode;
}) {
  const { legenda, valori, scelti, onCambia, etichetta } = props;
  return (
    <fieldset className="gruppo-filtro">
      <legend>{legenda}</legend>
      {valori.map((v) => (
        <label key={v} className="scelta">
          <input
            type="checkbox"
            checked={scelti.includes(v)}
            onChange={(e) => onCambia(e.target.checked ? [...scelti, v] : scelti.filter((s) => s !== v))}
          />
          {etichetta(v)}
        </label>
      ))}
    </fieldset>
  );
}

export function BarraFiltri({ filtri, onCambia, focus, onEsciDalFocus }: Props) {
  const cambia = <G extends Gruppo>(gruppo: G) => (scelti: Filtri[G]) => onCambia({ ...filtri, [gruppo]: scelti });
  return (
    <div className="barra-filtri">
      {/* Il fieldset disabilitato ferma tutti i filtri durante il focus. */}
      <fieldset className="filtri" disabled={focus !== null}>
        <GruppoFiltro
          legenda="Priorità"
          valori={PRIORITA}
          scelti={filtri.priorita}
          onCambia={cambia("priorita")}
          etichetta={(p) => (
            <>
              <span className={`campione priorita-${p}`} aria-hidden="true" />
              {ETICHETTE_PRIORITA[p]}
            </>
          )}
        />
        <GruppoFiltro
          legenda="Costo focus"
          valori={COSTI_FOCUS}
          scelti={filtri.costoFocus}
          onCambia={cambia("costoFocus")}
          // Le icone hanno già l'etichetta per i lettori di schermo e nel tooltip.
          etichetta={(f) => <IconaFocus focus={f} />}
        />
        <GruppoFiltro
          legenda="Costo tempo"
          valori={COSTI_TEMPO}
          scelti={filtri.costoTempo}
          onCambia={cambia("costoTempo")}
          etichetta={(t) => ETICHETTE_TEMPO[t]}
        />
        <GruppoFiltro
          legenda="Stato"
          valori={STATI}
          scelti={filtri.stato}
          onCambia={cambia("stato")}
          etichetta={(s) => ETICHETTE_STATO[s]}
        />
        <label className="scelta">
          <input
            type="checkbox"
            checked={filtri.nascondiFatte}
            onChange={(e) => onCambia({ ...filtri, nascondiFatte: e.target.checked })}
          />
          Nascondi fatte
        </label>
      </fieldset>
      {focus && (
        <button className="esci-focus" onClick={onEsciDalFocus} title="Torna al grafo completo con i filtri di prima">
          Esci dal focus su «{focus.titolo}»
        </button>
      )}
    </div>
  );
}
