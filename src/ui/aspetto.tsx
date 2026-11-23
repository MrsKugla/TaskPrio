// Aspetto degli attributi della task (etichette, colori, icone), come in GLOSSARY.md e negli appunti v3.
import type { ReactNode } from "react";
import type { CostoFocus, CostoTempo, Priorita } from "../regole";

export const ETICHETTE_PRIORITA: Record<Priorita, string> = {
  alta: "Alta",
  prestoAlta: "Presto alta",
  media: "Media/subordinata",
  bassa: "Bassa",
};

export const ETICHETTE_FOCUS: Record<CostoFocus, string> = {
  neve: "Fiocco di neve",
  termometroBlu: "Termometro blu",
  termometroRosso: "Termometro rosso",
  fuoco: "Fuoco",
};

export const ETICHETTE_TEMPO: Record<CostoTempo, string> = {
  meno1h: "< 1h",
  da1a4h: "1–4h",
  da4a8h: "4–8h",
  oltre8h: "> 8h",
};

const PIENI_TEMPO: Record<CostoTempo, number> = { meno1h: 1, da1a4h: 2, da4a8h: 3, oltre8h: 4 };

// Pallini del costo tempo (●○○○ … ●●●●) disegnati in CSS: i caratteri ● e ○ hanno grandezze diverse a seconda del font.
export function Pallini({ tempo }: { tempo: CostoTempo }) {
  return (
    <span className="pallini" role="img" aria-label={`Costo tempo: ${ETICHETTE_TEMPO[tempo]}`} title={`Costo tempo: ${ETICHETTE_TEMPO[tempo]}`}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={n <= PIENI_TEMPO[tempo] ? "pallino pieno" : "pallino"} />
      ))}
    </span>
  );
}

function Termometro({ colore }: { colore: string }) {
  return (
    <svg viewBox="0 0 12 24" width="9" height="18" aria-hidden="true">
      <rect x="4" y="1" width="4" height="15" rx="2" fill="none" stroke="#52606d" strokeWidth="1.2" />
      <rect x="5.2" y="7" width="1.6" height="10" fill={colore} />
      <circle cx="6" cy="19" r="3.6" fill={colore} stroke="#52606d" strokeWidth="1.2" />
    </svg>
  );
}

const ICONE_FOCUS: Record<CostoFocus, ReactNode> = {
  neve: "❄",
  termometroBlu: <Termometro colore="#1c7ed6" />,
  termometroRosso: <Termometro colore="#e03131" />,
  fuoco: "🔥",
};

export function IconaFocus({ focus }: { focus: CostoFocus }) {
  return (
    <span className="icona-focus" role="img" aria-label={ETICHETTE_FOCUS[focus]} title={ETICHETTE_FOCUS[focus]}>
      {ICONE_FOCUS[focus]}
    </span>
  );
}
