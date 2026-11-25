// Intensità dell'effetto CRT, da 0 (spento) a 100, nel menu a sinistra.
// Trascinando l'effetto cambia subito (onCambia); si salva solo al rilascio (onSalva), non a ogni passo dello slider.
export function RegolaCrt(props: { valore: number; onCambia: (crt: number) => void; onSalva: () => void }) {
  return (
    <label className="regola-crt">
      CRT
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={props.valore}
        onChange={(e) => props.onCambia(Number(e.target.value))}
        onPointerUp={props.onSalva}
        onKeyUp={props.onSalva}
        aria-valuetext={props.valore === 0 ? "spento" : `${props.valore}%`}
      />
      <output>{props.valore === 0 ? "OFF" : props.valore}</output>
    </label>
  );
}
