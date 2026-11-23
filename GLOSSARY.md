# TaskPrio

Gestione delle priorità di task collegate tra loro, raggruppate per progetto.

## Struttura

**Progetto**:
Insieme di task, potenzialmente collegate tra loro.

**Task**:
Unità di lavoro di un progetto, con priorità, costo focus, costo tempo, rischi correlati.
_Avoid_: attività, compito, ticket

**Dipendenza**:
Legame per cui una task non può partire prima che un'altra sia conclusa ("task y dipende da task x").
_Avoid_: collegamento, task successiva

**Task bloccante**:
Task da cui dipendono altre task non ancora fatte; la sua priorità è sempre più alta di quella delle task che blocca, oppure alta se tra queste ce n'è una alta.

**Stato**:
Avanzamento di una task scelto a mano: da fare, in corso, fatta. Una task fatta è in sola lettura.
_Avoid_: status, fase

**Bloccata**:
Condizione calcolata di una task che dipende da un'altra non ancora fatta; non è uno stato scelto a mano.

**Atomica**:
Proprietà di una task autoconclusiva, fatta in un solo passaggio e senza test particolari.
_Avoid_: semplice (come priorità)

## Priorità

**Priorità**:
Urgenza di una task, in ordine decrescente: alta, presto alta, media/subordinata, bassa. Si sceglie a mano; le regole automatiche possono solo alzarla.

**Alta**:
Da fare il prima possibile.

**Media/subordinata**:
Da fare dopo le task alte; spesso dipende da una task alta, ma non è obbligatorio.

**Presto alta**:
Non urgente oggi, ma diventa alta da sola se resta da fare troppo a lungo dalla sua creazione.

**Bassa**:
Da fare quando le altre sono esaurite, o in un giorno cuscinetto.

## Vista

**Focus su una task**:
Vista del grafo ridotta a una task, alle sue dipendenze e ai suoi rischi.
_Avoid_: zoom, filtro

## Rischi

**Rischio**:
Cosa può andare storto realizzando una task; si verifica con uno o più test.
_Avoid_: bug, problema

**Test**:
Verifica di un rischio; ha esito passato o fallito.

**Piano B**:
Ciò che scatta quando un test fallisce: un altro test oppure un'azione. Ogni test ha il suo piano B; un piano B azione si promuove a task con un comando esplicito.
_Avoid_: fallback, alternativa

**Catena di verifica**:
Grafo di rischi, test e piani B di una task, visibile nel suo dettaglio.

## Stima

**Costo tempo**:
Durata stimata di una task, in quattro fasce: < 1h, 1–4h, 4–8h, > 8h.
_Avoid_: durata, effort

**Costo focus**:
Quanto una task tollera le interruzioni, in quattro livelli: fiocco di neve, termometro blu, termometro rosso, fuoco.
_Avoid_: difficoltà, concentrazione

**Checkpoint**:
Punto di una task in cui il lavoro si può sospendere senza perdere il filo; richiesto dalle task a termometro rosso.
