# tern-ui

Il linguaggio visivo di Tern, staccato dall'app per riusarlo negli strumenti interni: carta calda, isole arrotondate, linee quasi invisibili, Geist con un mono stretto, un solo accento azzurro.

Valori e regole vengono dai fogli di stile di **Tern 0.9.34**, estratti dall'eseguibile il 25/11/2026 (vedi [Provenienza](#provenienza)). I nomi dei token sono quelli di Tern.

## Uso

```html
<link rel="stylesheet" href="tern-ui/tern-ui.css" />
<script src="tern-ui/icons.js"></script>
<script src="tern-ui/tern-ui.js"></script>
```

Si apre anche da file, senza rete: caratteri e icone sono nella cartella. `gallery.html` mostra ogni componente in ogni stato; `gallery.html?tema=dark` la apre nello scuro.

Il tema segue il sistema. Per fissarlo: `<html data-theme="light">` oppure `data-theme="dark"`.

Serve un browser recente: il sistema usa `light-dark()`, i colori relativi (`rgb(from … r g b / 18%)`), `:has()`, `linear()`, l'attributo `popover` e, per ancorare i menu scritti a mano, `position-area`.

## File

| File | Contenuto |
| --- | --- |
| `tern-ui.css` | Unico punto d'ingresso: importa gli altri in ordine |
| `fonts.css` | Geist variabile e Ioskeley Mono Term 400 e 500 |
| `tokens.css` | Superfici, linee, inchiostro, accento, stati, raggi, ruoli del testo, misure, movimento, profondità, vetro, livelli, colori del codice |
| `base.css` | Reset, tipografia, fuoco, selezione, scrollbar, icone |
| `controls.css` | Bottoni e gruppi, campi, caselle, interruttori, segmenti, cursori |
| `nav.css` | Schede, barra laterale, elenchi, albero, briciole, pagine |
| `surfaces.css` | Card, righe di impostazioni, chip, tasti, tabelle, codice, avvisi, messaggi, avatar, numeri, stati vuoti, attese, board |
| `overlays.css` | Menu, suggerimenti, avvisi a comparsa, finestre, palette dei comandi |
| `layout.css` | Cornice a isole, testate, titoli, testo lungo, entrate |
| `icons.js` | 121 icone a tratto sulla griglia 16 |
| `tern-ui.js` | Ciò che il CSS non sa fare: la scelta con menu e ricerca, i bottoni del passo, il tratto pieno del cursore |
| `gallery.html` | Galleria di prova |
| `tools/` | `icone.json` e `icone.py` rigenerano `icons.js`; `prova-scelta.mjs` prova la scelta in Firefox e Chrome |

## Le regole che fanno lo stile

Chi aggiunge un componente parte da qui. Ogni regola è ricavata da come Tern scrive i suoi.

### Superfici

- **Un tavolo e delle isole.** Il fondo è `--page`; sopra poggiano isole `--panel` con raggio 12, staccate di 4–8 px. Le colonne non hanno fili in mezzo: le separa il tavolo che si vede tra una e l'altra.
- **Tre piani, non di più.** `--page` → `--panel` → `--card`. `--raise` serve a ciò che sporge da un piano (barre laterali nel chiaro, controlli in rilievo nello scuro).
- **Niente card dentro card.** Dentro un'isola il contenuto si raggruppa con un foglio di righe (`.t-rows`) o con un filo, non con un'altra cornice.

### Contorni e profondità

- **Ogni contorno è un anello, mai un bordo.** `box-shadow: inset 0 0 0 1px var(--l2)`. Le linee `--l1`…`--l4` sono inchiostro blu-notte al 6, 9, 14 e 22%: si adattano a qualsiasi fondo.
- **`--l1` divide, `--l2` contorna, `--l3` risponde, `--l4` aspetta.** Divisori interni; contorno a riposo; contorno al passaggio del mouse; caselle vuote.
- **Nel chiaro l'altezza è un'ombra corta sotto; nello scuro è un filo di luce in alto.** Le ombre sul nero non si vedono, quindi i controlli in rilievo prendono `inset 0 1px 0` bianco al 5–8% (`--hi`, `--hi-on`).
- **Solo ciò che galleggia ha un'ombra lunga**, ed è sempre di vetro: `--pop-bg`, sfocatura, anello, filo di luce, ombra (`--pop-shadow`).
- **Il tratteggio esiste in un posto solo:** dove si lascia cadere un file.

### Colore

- **Un accento, usato poco.** `--accent` per anelli, selezione e piccoli segni. La sfumatura `--grad` solo su: bottone primario (uno per vista), marchio, barretta della riga scelta nei pannelli di vetro.
- **Tre versioni di ogni colore.** Pieno (`--accent`, `--ok`, `--bad`…) per fondi tenui, anelli e icone; inchiostro (`--accent-ink`, `--ok-ink`…) per il testo; riempimento (`--accent-fill`, `--ok-fill`…) per un fondo pieno con testo bianco.
- **Le trasparenze dell'accento sono sempre le stesse:** 10–12% fondo di uno stato acceso, 18% alone del fuoco, 22–25% anello di uno stato acceso, 45–55% filo di un campo in scrittura.
- **Il tono è un attributo.** `data-tone="success"` imposta `--tc` e `--ti`; chip, card, avvisi, icone e pallini li leggono. Toni: `neutral`, `accent`, `info`, `success`, `warning`, `error`, `pending`, `muted`.
- **Quattro inchiostri.** `--t1` per leggere, `--t2` per testo secondario e controlli a riposo, `--t3` per etichette e icone, `--t4` solo per decorazione.

### Testo

- **Corpi piccoli e vicini.** Quasi tutto sta tra 11 e 14 px: la gerarchia la fanno peso e colore, non la dimensione. I ruoli sono in `tokens.css` (`--text-ui`, `--text-label`, `--text-meta`…).
- **Pesi: 400 si legge, 500 si preme, 550 intitola in piccolo, 600 intitola.** Il 550 esiste perché Geist è variabile.
- **La spaziatura si stringe col corpo:** −0,003em fino a 13,5 px, −0,014em sui titoli da 15, −0,02em a 22, −0,028em a 28. Il mono resta a 0.
- **Il mono è per ciò che si misura o si copia:** contatori, orari, codici, percorsi, tasti. Sempre con `tabular-nums`.
- **Le etichette non sono mai in maiuscolo.** Un'intestazione di gruppo è 12–12,5 px, peso 500, colore `--t3`.

### Misure

- **Altezze dei controlli: 22, 28, 32.** 22 nelle righe fitte, 28 di norma, 32 in finestre e pagine di impostazioni. Righe: 24 (albero), 28 (menu), 30 (barra laterale), 42 (palette).
- **Raggi: 6, 8, 12, 16**, e 999 per chip e pallini. Annidati, il raggio interno è quello esterno meno il margine: 9 con margine 2 contiene 7.
- **Icone: 16 di base, 14–15 accanto al testo, 12–13 nei controlli piccoli, 10–11 per spunte e croci** (con tratto 2, perché a quella misura 1,45 sparisce).
- **L'icona davanti a una parola rientra di 2 px:** otticamente pesa meno del testo.

### Stati

- **Il passaggio del mouse entra subito ed esce in 150 ms.** `transition: 0s` su `:hover`, `var(--dur-state) var(--ease)` a riposo.
- **Il clic stringe a 0,97** in 100 ms e torna in 300 ms con `--out`. Dove il bottone è incollato ad altri (gruppi uniti) non stringe: scurisce.
- **Due anelli di fuoco diversi.** Da tastiera: filo d'accento più alone al 18% (`--sel-ring`). Campo in scrittura: filo al 55% dentro e alone al 13% (`--field-ring`), più quieto perché ci resti a lungo.
- **Dentro un menu il fuoco non è un anello:** è lo stesso fondo del passaggio.
- **Disattivato è opacità 0,45**, senza cambiare colore.
- **«Scelto» dipende dalla forma della riga:** foglio bianco con anello nelle barre laterali; velo d'accento al 10% negli elenchi; velo più barra d'accento di 2 px nelle righe da bordo a bordo; fondo `--l1` più barretta sfumata nei pannelli di vetro.

### Movimento

- **Due curve.** `--ease` per i cambi di stato, `--out` per ciò che arriva o torna. Una terza, `--spring`, solo per pomelli e pollici che scorrono.
- **Ciò che galleggia cresce da 0,97** dal punto da cui nasce, in 220 ms. **Esce solo in dissolvenza, in 110 ms:** le uscite sono sempre più brevi delle entrate.
- **Ciò che arriva sale di 6 px** in 300 ms (`.t-in`). In un elenco le righe entrano in fila a 24 ms l'una. Una pagina non entra tutta insieme: si anima solo ciò che compare dopo.
- **Un messaggio arriva mettendosi a fuoco**, non scivolando.
- **Le pieghe aprono l'altezza** con `grid-template-rows: 0fr → 1fr`, non con `max-height`.
- Con «riduci il movimento» tutto diventa immediato; con «riduci la trasparenza» il vetro diventa pieno; con «più contrasto» inchiostri e linee si scuriscono.

### Parole

- **I bottoni dicono l'azione:** «Passa», «Elimina», «Riprova». Non «OK», non «Conferma».
- **In una finestra l'azione sta a destra**, per ultima; ciò che è accessorio a sinistra. Una conferma breve impila i bottoni, con l'annullamento sotto.
- **Un errore dice cosa non va e cosa fare:** «Manca il dominio dopo la chiocciola».
- **Uno stato vuoto dice cosa comparirà lì** e, se ha senso, offre l'azione per riempirlo.

## Componenti

Stato e variante si dichiarano con gli attributi che il browser e gli strumenti di accessibilità già capiscono (`aria-pressed`, `aria-selected`, `aria-current`, `aria-invalid`, `aria-busy`, `disabled`), non con classi inventate.

| Classe | In Tern | Note |
| --- | --- | --- |
| `.t-btn` (`.primary` `.quiet` `.danger` `.raised` `.icon` `.sm` `.lg`) | `.sf-button`, `.btn` | `aria-pressed="true"` acceso, `aria-busy="true"` in attesa |
| `.t-btns` (`.joined` `.toolbar`) | `.sf-buttons` | Gruppi |
| `.t-input` `.t-textarea` | `.sf-field`, `.fld` | `.lg`, `.mono`, `.num`; `aria-invalid="true"` |
| `.t-select` (`.lg` `.sm` `.quiet` `.mono`) | `.sel-btn`, `.kit-controlled-select`, `.sel-menu` | Vedi [Scelta](#scelta) |
| `.t-fld` + `.t-fld-unit` `.t-fld-x` | `.fld` | Campo con icona, unità, tasto, croce |
| `.t-find` | `.tn-vt-find` | Ricerca incassata |
| `.t-field` (`.row`) + `.t-label` `.t-note` | `.sf-field` | `.t-note.bad` per l'errore |
| `.t-form` | `.fm-row` | Modulo a due colonne |
| `.t-check` (`.round`) `.t-radio` `.t-switch` (`.sm`) `.t-opt` | `.sf-el[aria-checked]`, `.pf-sw` | Su `<input>` veri |
| `.t-seg` (`.lg` `.fill`) | `.mode-seg`, `.pf-seg` | Il pollice scorre da solo, fino a 6 voci |
| `.t-step` (`.lg` `.tight`) + `.t-step-unit` | `.pf-step` | Meno, valore, più: così Tern regola un numero. Il valore è un `<input type="number">` vero; serve `tern-ui.js` |
| `.t-range` (`.accent`) | `.sld` | In Tern quasi non compare: per un numero si usa il passo. Il tratto pieno segue `--p`, tenuto da `tern-ui.js` |
| `.t-pills` + `.t-pill`, `.t-links` + `.t-link` | `.sf-nav` | Schede |
| `.t-nav` + `.t-nav-head` `.t-nav-row` | `.nav-row` | Barra laterale; `.arrive` per la riga nuova |
| `.t-list` (`.dense` `.flush`) + `.t-group` `.t-row` | `.sf-item` | `.t-row-main` `-title` `-sub` `-side` |
| `.t-tree` + `.t-tree-row` `.t-tree-kids` | `.tree-row` | Su `<details>` |
| `.t-crumbs` (`.path`) + `.t-crumb` | `.sf-breadcrumb` | |
| `.t-pager` + `.t-page` | `.sf-pager` | |
| `.t-card` (`.solid` `.bare` `.selected`, `data-tone`) | `.sf-card` | `.t-card-head` `-body` `-foot`; su `<details>` si piega |
| `.t-rows` + `.t-set` (`.stack` `.compact`) | `.pf-rows`, `.pf-row` | Righe di impostazioni |
| `.t-chip` (`.plain` `.mono` `.hue`) | `.sf-badge`, `.bd-chip`, `.bd-tag` | Su `<button>` diventa una scelta |
| `.t-dot` (`.live`) `.t-count` `.t-pip` `.t-kbd` (`.sm`) `.t-kbds` | `.sdot`, `.kbd`, `.tn-ib-pip` | |
| `.t-kv` | `.sf-kv` | Su `<dl>` |
| `.t-table` (`.pick`) + `.t-table-frame` | `table.sf-el`, `.sf-tbl`, `.tbl` | `aria-sort` sulle colonne ordinabili |
| `.t-code` `.t-pre` `.t-codeblock` + `.tk-*` | `.sf-t-code`, `.code` | Colori della sintassi inclusi |
| `.t-callout` | `.callout` | Tono con `data-tone` |
| `.t-msg` (`.mine` `.theirs` `.arrive`) + `.t-reacts` `.t-react` | `.sf-message` | |
| `.t-avatar` (`.xs` `.sm` `.lg` `.square` `.blank`) + `.t-avatars` | `.sf-avatar` | Tinta con `--av-h` |
| `.t-stats` + `.t-stat` | `.sf-stats` | Una fila separata da fili |
| `.t-empty` (`.inline` `.drop` `.arrive`) | `.sf-empty` | |
| `.t-spin` `.t-dots` `.t-progress` `.t-skel` `.t-working` | `.sf-orbit`, `.sf-dots`, `.sf-progress`, `.sf-skeleton` | |
| `.t-lane` + `.t-tile` `.t-add` | `.bd-lane`, `.bd-card` | Board |
| `.t-pop` + `.t-menu` (`.dense`) `.t-mi` (`.rich` `.danger`) | `.pop`, `.sf-menu-pop` | Con l'attributo `popover` si ancora da solo |
| `.t-tip`, `[data-tip]` | `.tooltip` | |
| `.t-toasts` + `.t-toast` | `.toast` | |
| `.t-dialog` (`.sm` `.lg` `.danger` `.alert`) | `.mdl` | Su `<dialog>` |
| `.t-cmdk` | `.cmdk` | Palette dei comandi |
| `.t-app` `.t-bar` `.t-stage` `.t-island` `.t-side` `.t-scroll` `.t-grip` | `.tn-stage`, `.pf-nav`, `.sv-grip` | Cornice |
| `.t-head` `.t-title` `.t-h` `.t-sec` `.t-page-head` `.t-rule` | `.tn-head`, `.pf-head` | |
| `.t-prose` `.t-doc` | `.md`, `.doc` | Testo lungo |
| `.t-in` `.t-fold` | `bdIn`, `.tree-kids` | Entrata e piega |

Il sistema dà l'aspetto e gli stati. Aprire un menu, chiudere una finestra, spostare la scelta con le frecce resta alla pagina: `popover`, `<dialog>` e `<select>` del browser coprono quasi tutto.

### Scelta

Si scrive un `<select class="t-select">` normale. `tern-ui.js` lo sostituisce con un bottone e un menu di vetro, in ogni browser, e lo tiene nascosto come fonte del valore: `<label>`, moduli, `required`, `disabled`, `select.value` e l'evento `change` funzionano come sempre. Le voci aggiunte o tolte dopo si vedono da sole.

```html
<select class="t-select" name="fuso">
	<optgroup label="Europa">
		<option data-detail="UTC+1" data-icon="globe" selected>Roma</option>
	</optgroup>
</select>
```

- **Ricerca.** A menu aperto si scrive: il bottone diventa il campo, l'elenco si restringe alle voci che contengono il testo (senza badare a maiuscole e accenti), le lettere trovate si accendono. `data-search` mostra il campo già all'apertura, per gli elenchi lunghi; `data-search="false"` la toglie, e allora le lettere saltano alla prima voce che comincia così.
- **Variante quieta.** Il bottone è solo una parola, quindi il campo di ricerca sta in cima al menu, e solo da 8 voci in su.
- **Tastiera.** Chiusa: Invio, Spazio, frecce o una lettera la aprono. Aperta: frecce, PagSu, PagGiù, Inizio e Fine; Invio sceglie; Esc chiude senza cambiare; Tab chiude e prosegue.
- **Invito.** Una prima voce vuota, disattivata e nascosta (`<option value="" disabled selected hidden>Scegli…</option>`) si vede sul bottone in grigio e non compare nel menu.
- **Resta il `<select>` del sistema**, vestito allo stesso modo: sui dispositivi a tocco, con `multiple` o `size`, con `data-native`, e se lo script non è caricato.
- **Se uno script cambia `option.selected` direttamente**, senza passare da `select.value`, il bottone non lo sa: chiami `TernUI.aggiorna()`.

## Differenze da Tern

- **Contrasto.** Tern scrive alcuni testi sotto 4,5:1: i chip di tono nel chiaro, le schede non scelte, i segnaposto in `--t4`, i tasti nei menu, i numeri nel codice. Qui sono scuriti quanto basta; ogni punto ha un commento nel foglio. Tutto il testo della galleria supera 4,5:1 in entrambi i temi.
- **Molla.** Tern anima pomelli e pollici con `spring(0.35s, 0.15)`, che nei browser non esiste: `--spring` è la stessa molla campionata in una curva `linear()`.
- **Vetro a lente.** Le notifiche di Tern usano un filtro proprio (`analytic-lens`) che deforma ciò che sta dietro. Qui il vetro è la sfocatura normale.
- **Scelta.** In Tern mentre si cerca il testo è disegnato a mano, con un cursore finto e senza campo. Qui c'è un campo vero, perché copia, incolla, composizione dei caratteri e lettori di schermo funzionino. Dove compare la ricerca l'ho deciso io (sempre, tranne nella variante quieta sotto le 8 voci): dai fogli di Tern non si ricava.
- **Passo.** In Tern il valore al centro è testo fisso e l'altezza è 32. Qui è un campo in cui si può anche scrivere, e c'è una misura da 28 per stare accanto agli altri controlli.
- **Selezione del testo.** Tern la disattiva ovunque perché è un'app; qui resta attiva sul contenuto.
- **Icone.** Non uso i file di Tern. I disegni vengono da Lucide, ridotti alla griglia 16 con la stessa riduzione di Tern; per le icone che Tern stesso prende da Lucide il risultato coincide.
- **Escluso.** Temi a colori (`html.tn-themed`, che ricolora tutto dal tema del terminale), terminale, editor, git, sqlite, chat di omp, widget, versione per telefono, calendario, campo a caselle per i codici, carosello, grafici.

## Provenienza

Tern porta i fogli di stile in chiaro dentro `tern.exe`. L'estratto completo sta in `E:/Strumenti/_tern-extract/<versione>/` (222 fogli e 1.310 icone per la 0.9.34; c'è anche la 0.9.18), fuori da questa cartella: è codice di Tern, utile come riferimento ma non da ridistribuire. Questa cartella contiene solo valori e regole riscritti.

Per aggiornare dopo una nuova versione di Tern:

```sh
python E:/Strumenti/_tern-extract/estrai.py
```

Crea la cartella della nuova versione. Poi si confrontano `theme.css`, `kit-base.css`, `controls.css` e `surface*.css` con quelli della versione precedente. Tra la 0.9.18 e la 0.9.34 i token non sono cambiati.

Per aggiungere un'icona: una riga in `tools/icone.json` (nome nostro → nome in Lucide), poi `python tools/icone.py`.

Per riprovare la scelta nei browser: `cd tools && npm install` una volta, poi `node prova-scelta.mjs firefox` e `node prova-scelta.mjs chrome`.

## Licenze

- Geist: © Vercel, SIL Open Font License 1.1 (`fonts/Geist-LICENSE.txt`).
- Ioskeley Mono: © Renzhi Li e Ahmed Hatem, SIL Open Font License 1.1 (`fonts/IoskeleyMono-LICENSE.txt`). I file sono ridotti a latino, greco, cirillico, punteggiatura, frecce, operatori e riquadri.
- Icone: Lucide, licenza ISC (`LICENSE-icons.txt`).
