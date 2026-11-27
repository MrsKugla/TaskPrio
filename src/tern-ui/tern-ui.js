/*
  tern-ui · comportamenti
  Ciò che il CSS non sa fare da solo, uguale in ogni pagina:
    · scelta (.t-select): un <select> diventa bottone, menu di vetro e ricerca, in ogni browser
    · passo (.t-step): i bottoni meno e più muovono il campo e si spengono ai limiti
    · cursore (.t-range): il tratto pieno segue il valore

  <script src="tern-ui/tern-ui.js"></script>
  Vale anche per ciò che la pagina aggiunge dopo. Se uno script cambia qualcosa senza che si veda
  (option.selected = true, per esempio), chiami TernUI.aggiorna(radice).
*/
(() => {
	/* ---------- Scelta ---------- */
	/*
	  Il <select> resta nella pagina, invisibile, ed è l'unica fonte del valore: moduli, <label>, required,
	  disabled, select.value e l'evento change funzionano come sempre. Accanto gli nasce un contenitore
	  con le sue stesse classi, che porta bottone, campo di ricerca e menu.

	  Tastiera. Chiusa: Invio, Spazio, frecce o una lettera la aprono. Aperta: frecce, Inizio e Fine si
	  muovono tra le voci; Invio sceglie; Esc chiude e lascia tutto com'era; Tab chiude e prosegue.
	  Scrivendo, l'elenco si restringe alle voci che contengono il testo, senza badare a maiuscole e accenti.

	  Resta il <select> del sistema, solo vestito: sui dispositivi a tocco, con multiple o size, con data-native.
	*/
	const NS = 'http://www.w3.org/2000/svg';
	const SPUNTA = '<path d="M13 4.25 6.12 11.12 3 8"/>';
	const LENTE = '<circle cx="7.38" cy="7.38" r="5"/><path d="m13.62 13.62-2.69-2.69"/>';
	const TESTI = Object.freeze({
		cerca: 'Cerca…',
		nessuna: 'Nessun risultato',
		vuota: 'Nessuna voce',
		di: 'di',
	});
	const VARIANTI = Object.freeze(['sm', 'lg', 'quiet', 'mono']);
	const SOGLIA_RICERCA = 8; // nella variante quieta il campo compare da tante voci in su
	const CAMPO_MIN = 232; // larghezza minima del campo di ricerca, come in Tern
	const STACCO = 4; // tra bottone e menu
	const MARGINE = 8; // tra menu e bordo della finestra
	const ALTEZZA_MAX = 312; // oltre, l'elenco scorre
	const PAGINA = 8; // voci saltate da PagSu e PagGiù
	const PAUSA_SALTO = 700; // ms dopo cui le lettere scritte senza ricerca si dimenticano

	const VALORE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
	const INDICE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');

	/** @type {WeakMap<HTMLSelectElement, { guscio: HTMLElement, sincronizza: () => void, allinea: () => void }>} */
	const scelte = new WeakMap();
	let contatore = 0;

	/**
	 * @param {string} nome
	 * @param {Record<string, string>} attributi
	 * @param {(Node | string)[]} figli
	 */
	const crea = (nome, attributi = {}, ...figli) => {
		const nodo = document.createElement(nome);
		for (const [chiave, valore] of Object.entries(attributi)) nodo.setAttribute(chiave, valore);
		nodo.append(...figli);
		return nodo;
	};

	/** @param {string} corpo il disegno, oppure il nome di un'icona di icons.js preceduto da # */
	const icona = (corpo) => {
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('class', 'ico');
		svg.setAttribute('viewBox', '0 0 16 16');
		svg.setAttribute('aria-hidden', 'true');
		if (corpo.startsWith('#')) {
			const usa = document.createElementNS(NS, 'use');
			usa.setAttribute('href', '#i-' + corpo.slice(1));
			svg.append(usa);
		} else svg.innerHTML = corpo;
		return svg;
	};

	/**
	 * Minuscole e senza accenti, con le posizioni per tornare al testo vero.
	 * @param {string} testo
	 * @returns {{ piegato: string, tratti: (readonly [number, number])[] }}
	 */
	const piega = (testo) => {
		let piegato = '';
		const tratti = [];
		let inizio = 0;
		for (const carattere of testo) {
			const reso = carattere.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
			const tratto = /** @type {const} */ ([inizio, inizio + carattere.length]);
			for (let k = 0; k < reso.length; k++) tratti.push(tratto);
			piegato += reso;
			inizio += carattere.length;
		}
		return { piegato, tratti };
	};

	/** Il nome che un lettore di schermo dà alla scelta: aria-label, oppure il testo della sua <label>. */
	const nomeDi = (/** @type {HTMLSelectElement} */ select) => {
		const scritto = select.getAttribute('aria-label');
		if (scritto) return scritto;
		const etichetta = select.labels[0];
		if (!etichetta) return '';
		const copia = /** @type {HTMLElement} */ (etichetta.cloneNode(true));
		for (const fuori of copia.querySelectorAll('select, .t-sel, .t-note')) fuori.remove();
		return (copia.textContent ?? '').replace(/\s+/g, ' ').trim();
	};

	/** Il bordo destro oltre il quale qualcosa verrebbe tagliato o farebbe scorrere un contenitore. */
	const limiteDestro = (/** @type {Element} */ nodo) => {
		let limite = document.documentElement.clientWidth;
		for (let su = nodo.parentElement; su; su = su.parentElement) {
			if (getComputedStyle(su).overflowX !== 'visible') {
				limite = Math.min(limite, su.getBoundingClientRect().right);
			}
		}
		return limite;
	};

	/** @param {HTMLSelectElement} select */
	const monta = (select) => {
		if (scelte.has(select)) return;
		if (select.multiple || select.size > 1 || select.dataset.native !== undefined) return;

		const id = 't-sel-' + ++contatore;
		const quieta = select.classList.contains('quiet');

		const ora = crea('span', { class: 't-sel-now', id: id + '-v' });
		const misura = crea('span', { class: 't-sel-size', 'aria-hidden': 'true' });
		const bottone = /** @type {HTMLButtonElement} */ (
			crea(
				'button',
				{
					type: 'button',
					class: 't-sel-btn',
					'aria-haspopup': 'listbox',
					'aria-expanded': 'false',
					'aria-controls': id + '-l',
					'aria-labelledby': `${id}-n ${id}-v`,
				},
				crea('span', { class: 't-sel-v' }, ora, misura),
			)
		);
		const campo = /** @type {HTMLInputElement} */ (
			crea('input', {
				type: 'text',
				role: 'combobox',
				tabindex: '-1',
				autocomplete: 'off',
				autocapitalize: 'off',
				spellcheck: 'false',
				'aria-autocomplete': 'list',
				'aria-expanded': 'false',
				'aria-controls': id + '-l',
				'aria-labelledby': id + '-n',
			})
		);
		const quante = crea('span', { class: 't-sel-count', 'aria-hidden': 'true' });
		// Il campo abita in uno di questi due posti: sopra il bottone, oppure in cima al menu (variante quieta)
		const sopra = crea('span', { class: 't-sel-search' }, icona(LENTE));
		const trova = crea('span', { class: 't-sel-find', hidden: '' }, icona(LENTE));
		const vuoto = crea('span', { class: 't-sel-empty', hidden: '' });
		// tabindex -1: un riquadro che scorre entrerebbe da solo nel giro del Tab, e il fuoco deve restare al campo
		const righe = crea('span', {
			class: 't-sel-rows',
			role: 'listbox',
			tabindex: '-1',
			id: id + '-l',
			'aria-labelledby': id + '-n',
		});
		const menu = crea('span', { class: 't-sel-menu', popover: 'manual' }, trova, righe);
		const nome = crea('span', { class: 't-sr', id: id + '-n' });
		const guscio = crea('span', { class: 't-sel' }, nome, bottone, sopra, menu);

		/**
		 * @typedef {{ indice: number, testo: string, piegato: string, tratti: (readonly [number, number])[],
		 *   spenta: boolean, riga: HTMLElement, scritta: HTMLElement }} Voce
		 */
		/** @type {Voce[]} */
		let voci = [];
		/** @type {Map<number, Voce>} le stesse voci, per indice nel <select> (le opzioni nascoste non hanno voce) */
		let perIndice = new Map();
		let aperta = false;
		let verso = /** @type {'giu' | 'su'} */ ('giu');
		let attiva = -1; // indice della voce su cui stanno frecce o mouse
		let giro = 0; // cambia a ogni apertura e chiusura: un'uscita in dissolvenza non chiude un menu già riaperto
		let salto = 0; // timer delle lettere scritte senza ricerca

		const conRicerca = () =>
			select.dataset.search !== 'false' &&
			(!quieta || select.dataset.search !== undefined || voci.length >= SOGLIA_RICERCA);
		const ricercaSubito = () =>
			select.dataset.search !== undefined && select.dataset.search !== 'false';

		/** Bottone e spunte seguono il <select>. */
		const allinea = () => {
			const scelta = select.selectedOptions[0];
			ora.textContent = scelta ? scelta.label : '';
			// Una prima voce vuota e disattivata è un invito («Scegli…»), non un valore
			ora.classList.toggle(
				'ph',
				!scelta || (scelta.value === '' && (scelta.disabled || scelta.hidden)),
			);
			const disegno = scelta?.dataset.icon;
			bottone.querySelector(':scope > .ico')?.remove();
			if (disegno) bottone.prepend(icona('#' + disegno));
			for (const voce of voci) {
				voce.riga.setAttribute('aria-selected', String(voce.indice === select.selectedIndex));
			}
		};

		/** @param {number} indice */
		const accendi = (indice) => {
			if (attiva !== indice) {
				perIndice.get(attiva)?.riga.classList.remove('active');
				attiva = indice;
				perIndice.get(attiva)?.riga.classList.add('active');
			}
			const riga = perIndice.get(attiva)?.riga;
			if (riga) campo.setAttribute('aria-activedescendant', riga.id);
			else campo.removeAttribute('aria-activedescendant');
		};

		/** Porta la voce attiva dentro la parte visibile dell'elenco, senza far scorrere la pagina. */
		const mostraAttiva = () => {
			const riga = perIndice.get(attiva)?.riga;
			if (!riga) return;
			const prima = riga.previousElementSibling;
			const cima = prima?.classList.contains('t-sel-group')
				? /** @type {HTMLElement} */ (prima).offsetTop
				: riga.offsetTop;
			const fondo = riga.offsetTop + riga.offsetHeight;
			if (cima < righe.scrollTop) righe.scrollTop = cima;
			else if (fondo > righe.scrollTop + righe.clientHeight)
				righe.scrollTop = fondo - righe.clientHeight;
		};

		/** @param {boolean} decidi se scegliere di nuovo tra sotto e sopra: solo all'apertura, non mentre si scrive */
		const colloca = (decidi = false) => {
			const cercando = guscio.classList.contains('searching');
			if (cercando) {
				const proprio = guscio.getBoundingClientRect();
				const largo = Math.max(proprio.width, CAMPO_MIN);
				guscio.classList.toggle('end', proprio.left + largo > limiteDestro(guscio) - STACCO);
			} else guscio.classList.remove('end');
			const ancora = (cercando ? sopra : guscio).getBoundingClientRect();
			const larghezza = document.documentElement.clientWidth;
			const altezza = window.innerHeight;
			const sotto = altezza - ancora.bottom - STACCO - MARGINE;
			const sopraSpazio = ancora.top - STACCO - MARGINE;

			menu.style.minWidth = Math.round(ancora.width) + 'px';
			menu.style.setProperty('--t-sel-max', ALTEZZA_MAX + 'px');
			const cornice = menu.offsetHeight - righe.offsetHeight;
			if (decidi) {
				const pieno = cornice + Math.min(righe.scrollHeight, ALTEZZA_MAX);
				verso = pieno > sotto && sopraSpazio > sotto ? 'su' : 'giu';
			}
			const spazio = verso === 'su' ? sopraSpazio : sotto;
			menu.classList.toggle('up', verso === 'su');
			menu.style.setProperty('--t-sel-max', Math.max(90, spazio - cornice) + 'px');
			const sinistra = Math.min(ancora.left, larghezza - MARGINE - menu.offsetWidth);
			menu.style.left = Math.max(MARGINE, sinistra) + 'px';
			if (verso === 'su') {
				menu.style.top = 'auto';
				menu.style.bottom = altezza - ancora.top + STACCO + 'px';
			} else {
				menu.style.bottom = 'auto';
				menu.style.top = ancora.bottom + STACCO + 'px';
			}
		};

		/** Le voci in cui ci si può fermare, nell'ordine in cui si vedono. */
		const percorribili = () => voci.filter((voce) => !voce.spenta && !voce.riga.hidden);

		/** @param {string} scritto */
		const filtra = (scritto) => {
			const chiave = conRicerca() ? piega(scritto.trim()).piegato : '';
			for (const voce of voci) {
				const dove = chiave === '' ? 0 : voce.piegato.indexOf(chiave);
				voce.riga.hidden = dove < 0;
				if (chiave === '' || dove < 0) voce.scritta.textContent = voce.testo;
				else {
					const [da] = voce.tratti[dove];
					const [, a] = voce.tratti[dove + chiave.length - 1];
					voce.scritta.replaceChildren(
						voce.testo.slice(0, da),
						crea('mark', {}, voce.testo.slice(da, a)),
						voce.testo.slice(a),
					);
				}
			}
			for (const gruppo of righe.querySelectorAll(':scope > [role="group"]')) {
				/** @type {HTMLElement} */ (gruppo).hidden = !gruppo.querySelector(
					'.t-sel-opt:not([hidden])',
				);
			}
			const rimaste = voci.filter((voce) => !voce.riga.hidden).length;
			vuoto.hidden = rimaste > 0;
			vuoto.textContent = voci.length > 0 ? TESTI.nessuna : TESTI.vuota;
			quante.textContent = chiave === '' ? '' : `${rimaste} ${TESTI.di} ${voci.length}`;
			const sulBottone = campo.parentElement === sopra && conRicerca();
			guscio.classList.toggle(
				'searching',
				aperta && sulBottone && (ricercaSubito() || scritto !== ''),
			);

			const ferme = percorribili();
			const scelta = ferme.find((voce) => voce.indice === select.selectedIndex);
			accendi((chiave === '' && scelta ? scelta : ferme[0])?.indice ?? -1);
			if (aperta) {
				colloca();
				if (chiave === '') mostraAttiva();
				else righe.scrollTop = 0;
			}
		};

		/** Senza ricerca, le lettere portano alla prima voce che comincia così, come in un <select>. */
		const salta = () => {
			const chiave = piega(campo.value).piegato;
			const trovata = percorribili().find((voce) => voce.piegato.startsWith(chiave));
			if (trovata) {
				accendi(trovata.indice);
				mostraAttiva();
			}
			clearTimeout(salto);
			salto = setTimeout(() => (campo.value = ''), PAUSA_SALTO);
		};

		/** @param {number} passi quante voci avanti (o indietro, se negativo) */
		const sposta = (passi) => {
			const ferme = percorribili();
			if (ferme.length === 0) return;
			const qui = ferme.findIndex((voce) => voce.indice === attiva);
			const partenza = qui < 0 ? (passi > 0 ? -1 : ferme.length) : qui;
			const meta = Math.max(0, Math.min(ferme.length - 1, partenza + passi));
			accendi(ferme[meta].indice);
			mostraAttiva();
		};

		const fuori = (/** @type {Event} */ evento) => {
			if (!guscio.contains(/** @type {Node} */ (evento.target))) chiudi(false);
		};
		const segue = (/** @type {Event} */ evento) => {
			if (evento.target !== righe) colloca();
		};

		const apri = () => {
			if (aperta || select.matches(':disabled')) return;
			aperta = true;
			giro++;
			campo.value = '';
			guscio.classList.add('open');
			bottone.setAttribute('aria-expanded', 'true');
			campo.setAttribute('aria-expanded', 'true');
			menu.classList.remove('out');
			if (!menu.matches(':popover-open')) menu.showPopover();
			filtra('');
			colloca(true);
			mostraAttiva();
			campo.focus({ preventScroll: true });
			document.addEventListener('pointerdown', fuori, true);
			window.addEventListener('scroll', segue, true);
			window.addEventListener('resize', segue);
		};

		/** @param {boolean} rifuoca se riportare il fuoco sul bottone: sì quando si chiude dalla scelta stessa */
		const chiudi = (rifuoca) => {
			if (!aperta) return;
			aperta = false;
			const mio = ++giro;
			clearTimeout(salto);
			document.removeEventListener('pointerdown', fuori, true);
			window.removeEventListener('scroll', segue, true);
			window.removeEventListener('resize', segue);
			guscio.classList.remove('open', 'searching', 'end');
			bottone.setAttribute('aria-expanded', 'false');
			campo.setAttribute('aria-expanded', 'false');
			campo.removeAttribute('aria-activedescendant');
			if (rifuoca) bottone.focus({ preventScroll: true });
			// Esce in dissolvenza; se intanto è stata riaperta, non la tocca
			menu.classList.add('out');
			const finito = () => {
				if (giro !== mio) return;
				menu.classList.remove('out');
				if (menu.matches(':popover-open')) menu.hidePopover();
			};
			const uscite = menu.getAnimations();
			if (uscite.length === 0) finito();
			else Promise.allSettled(uscite.map((uscita) => uscita.finished)).then(finito);
		};

		/** @param {number} indice */
		const scegli = (indice) => {
			const voce = perIndice.get(indice);
			if (!voce || voce.spenta) return;
			if (select.selectedIndex !== indice) {
				INDICE.set.call(select, indice);
				allinea();
				// Gli stessi eventi di una scelta fatta nel <select>: chi lo ascolta non deve sapere del menu
				select.dispatchEvent(new Event('input', { bubbles: true }));
				select.dispatchEvent(new Event('change', { bubbles: true }));
			}
			chiudi(true);
		};

		/** Rilegge tutto dal <select>: voci, gruppi, classi, stato. */
		const sincronizza = () => {
			nome.textContent = nomeDi(select);
			guscio.className = ['t-sel', select.className, aperta ? 'open' : '']
				.filter(Boolean)
				.join(' ');
			for (const variante of VARIANTI)
				menu.classList.toggle(variante, select.classList.contains(variante));
			const spenta = select.matches(':disabled');
			bottone.disabled = spenta;
			guscio.toggleAttribute('data-disabled', spenta);
			guscio.toggleAttribute('data-invalid', select.getAttribute('aria-invalid') === 'true');

			/** @type {Map<HTMLOptGroupElement, HTMLElement>} */
			const gruppi = new Map();
			/** @type {Voce[]} */
			const nuove = [];
			const figli = [];
			for (const [indice, opzione] of [...select.options].entries()) {
				if (opzione.hidden) continue;
				const sopraOpzione = opzione.parentElement;
				const gruppo = sopraOpzione instanceof HTMLOptGroupElement ? sopraOpzione : null;
				const testo = opzione.label;
				const scritta = crea('span', { class: 't-sel-text' }, testo);
				const riga = crea(
					'span',
					{ class: 't-sel-opt', role: 'option', id: `${id}-o${indice}`, 'data-i': String(indice) },
					crea('span', { class: 't-sel-ck' }, icona(SPUNTA)),
				);
				if (opzione.dataset.icon) riga.append(icona('#' + opzione.dataset.icon));
				riga.append(scritta);
				if (opzione.dataset.detail)
					riga.append(crea('span', { class: 't-sel-sub' }, opzione.dataset.detail));
				const spentaVoce = opzione.disabled || (gruppo?.disabled ?? false);
				if (spentaVoce) riga.setAttribute('aria-disabled', 'true');
				nuove.push({ indice, testo, ...piega(testo), spenta: spentaVoce, riga, scritta });

				if (!gruppo) figli.push(riga);
				else {
					let contenitore = gruppi.get(gruppo);
					if (!contenitore) {
						const titolo = `${id}-g${gruppi.size}`;
						contenitore = crea(
							'span',
							{ role: 'group', 'aria-labelledby': titolo },
							crea(
								'span',
								{ class: 't-sel-group', id: titolo, role: 'presentation' },
								gruppo.label,
							),
						);
						gruppi.set(gruppo, contenitore);
						figli.push(contenitore);
					}
					contenitore.append(riga);
				}
			}
			attiva = -1;
			voci = nuove;
			perIndice = new Map(nuove.map((voce) => [voce.indice, voce]));
			righe.replaceChildren(...figli, vuoto);
			misura.replaceChildren(...nuove.map((voce) => crea('span', {}, voce.testo)));

			// Il campo va dove serve: in cima al menu se la variante quieta ha la ricerca, altrimenti sopra il bottone
			const dimora = quieta && conRicerca() ? trova : sopra;
			trova.hidden = dimora !== trova;
			if (campo.parentElement !== dimora) {
				dimora.append(campo, quante);
				if (aperta) campo.focus({ preventScroll: true });
			}
			if (conRicerca()) campo.setAttribute('placeholder', TESTI.cerca);
			else campo.removeAttribute('placeholder');

			allinea();
			filtra(aperta ? campo.value : '');
		};

		// --- Eventi ---
		// Un clic su ciò che non prende il fuoco (voci, lente, bottone) non deve toglierlo al campo: chiuderebbe il menu
		guscio.addEventListener('mousedown', (evento) => {
			if (evento.target !== campo) evento.preventDefault();
		});
		// Dentro una <label> un clic qui arriverebbe anche al <select>, che ruberebbe il fuoco
		guscio.addEventListener('click', (evento) => evento.preventDefault());
		bottone.addEventListener('click', () => (aperta ? chiudi(true) : apri()));
		bottone.addEventListener('keydown', (evento) => {
			if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
			if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
				evento.preventDefault();
				apri();
			} else if (evento.key.length === 1 && evento.key !== ' ') {
				// Una lettera apre e va a finire nel campo, che prende il fuoco prima che il browser la scriva
				apri();
			}
		});
		sopra.addEventListener('click', () => campo.focus({ preventScroll: true }));
		trova.addEventListener('click', () => campo.focus({ preventScroll: true }));
		campo.addEventListener('input', () => (conRicerca() ? filtra(campo.value) : salta()));
		campo.addEventListener('keydown', (evento) => {
			if (evento.isComposing) return;
			const libero = campo.value === '' || !conRicerca(); // Inizio e Fine servono al testo, se ce n'è
			/** @type {Record<string, (() => void) | undefined>} */
			const tasti = {
				ArrowDown: () => sposta(1),
				ArrowUp: () => sposta(-1),
				PageDown: () => sposta(PAGINA),
				PageUp: () => sposta(-PAGINA),
				Home: libero ? () => sposta(-voci.length) : undefined,
				End: libero ? () => sposta(voci.length) : undefined,
				Enter: () => (attiva >= 0 ? scegli(attiva) : undefined),
				Escape: () => chiudi(true),
			};
			const azione = tasti[evento.key];
			if (azione) {
				evento.preventDefault();
				// Dentro una finestra, Esc chiude il menu e non la finestra
				evento.stopPropagation();
				azione();
			} else if (evento.key === 'Tab') {
				// Il fuoco torna al bottone, e da lì il browser lo porta avanti o indietro come farebbe comunque
				chiudi(true);
			}
		});
		guscio.addEventListener('focusout', (evento) => {
			if (!guscio.contains(/** @type {Node | null} */ (evento.relatedTarget))) chiudi(false);
		});
		menu.addEventListener('pointermove', (evento) => {
			const riga = /** @type {Element} */ (evento.target).closest('.t-sel-opt');
			if (riga instanceof HTMLElement && riga.getAttribute('aria-disabled') !== 'true') {
				accendi(Number(riga.dataset.i));
			}
		});
		menu.addEventListener('click', (evento) => {
			// Dentro una <label> un clic qui arriverebbe anche al <select>
			evento.preventDefault();
			const riga = /** @type {Element} */ (evento.target).closest('.t-sel-opt');
			if (riga instanceof HTMLElement) scegli(Number(riga.dataset.i));
		});

		// --- Il <select> ---
		const stile = select.getAttribute('style');
		if (stile) guscio.setAttribute('style', stile); // larghezze date a mano valgono per ciò che si vede
		select.dataset.tSelect = '';
		select.tabIndex = -1;
		select.setAttribute('aria-hidden', 'true');
		select.after(guscio);
		// Un clic sulla <label> porta il fuoco al <select>: lo passo al bottone
		select.addEventListener('focus', () => bottone.focus());
		select.addEventListener('change', allinea);
		select.form?.addEventListener('reset', () => setTimeout(allinea));
		// select.value = … non emette eventi: lo intercetto, così il bottone non resta indietro
		for (const [proprieta, vera] of /** @type {const} */ ([
			['value', VALORE],
			['selectedIndex', INDICE],
		])) {
			Object.defineProperty(select, proprieta, {
				configurable: true,
				enumerable: true,
				get() {
					return vera.get.call(this);
				},
				set(valore) {
					vera.set.call(this, valore);
					allinea();
				},
			});
		}

		sincronizza();
		let inAttesa = false;
		new MutationObserver(() => {
			if (inAttesa) return;
			inAttesa = true;
			queueMicrotask(() => {
				inAttesa = false;
				sincronizza();
			});
		}).observe(select, { subtree: true, childList: true, characterData: true, attributes: true });

		scelte.set(select, { guscio, sincronizza, allinea });
	};

	/** @param {ParentNode} radice */
	const montaScelte = (radice) => {
		// Sul tocco il selettore del sistema è più comodo di qualunque menu disegnato
		if (matchMedia('(pointer: coarse)').matches) return;
		if (!HTMLElement.prototype.hasOwnProperty('popover')) return;
		for (const select of radice.querySelectorAll('select.t-select')) {
			monta(/** @type {HTMLSelectElement} */ (select));
		}
	};

	/** Ciò che la pagina aggiunge, toglie o sposta dopo: la scelta segue il suo <select>. */
	const segueLaPagina = () => {
		new MutationObserver((cambi) => {
			for (const cambio of cambi) {
				for (const nodo of [...cambio.addedNodes, ...cambio.removedNodes]) {
					if (!(nodo instanceof Element)) continue;
					const dentro = nodo.matches('select.t-select')
						? [nodo]
						: [...nodo.querySelectorAll('select.t-select')];
					for (const select of /** @type {HTMLSelectElement[]} */ (dentro)) {
						const nota = scelte.get(select);
						if (!nota) {
							if (select.isConnected) montaScelte(select.parentElement ?? document);
						} else if (!select.isConnected) nota.guscio.remove();
						else if (select.nextElementSibling !== nota.guscio) select.after(nota.guscio);
					}
				}
			}
		}).observe(document.documentElement, { childList: true, subtree: true });
	};

	/* ---------- Cursore ---------- */
	/** @param {HTMLInputElement} cursore */
	const riempi = (cursore) => {
		// Senza attributi min e max il browser usa 0 e 100, ma le proprietà restano vuote
		const min = Number(cursore.min || 0);
		const max = Number(cursore.max || 100);
		const quota = max > min ? (Number(cursore.value) - min) / (max - min) : 0;
		cursore.style.setProperty('--p', quota * 100 + '%');
	};

	/* ---------- Passo ---------- */
	/** @param {HTMLInputElement} campo */
	const limiti = (campo) => {
		const valore = Number(campo.value);
		const fermo = campo.disabled || campo.readOnly;
		for (const bottone of campo.parentElement.querySelectorAll(':scope > button[data-step]')) {
			const limite = bottone.dataset.step === 'up' ? campo.max : campo.min;
			const oltre =
				bottone.dataset.step === 'up' ? valore >= Number(limite) : valore <= Number(limite);
			bottone.disabled = fermo || (limite !== '' && campo.value !== '' && oltre);
		}
	};

	/** @param {ParentNode} radice */
	const aggiorna = (radice = document) => {
		montaScelte(radice);
		for (const select of radice.querySelectorAll('select.t-select')) {
			scelte.get(/** @type {HTMLSelectElement} */ (select))?.sincronizza();
		}
		for (const cursore of radice.querySelectorAll('.t-range')) riempi(cursore);
		for (const campo of radice.querySelectorAll('.t-step > input')) limiti(campo);
	};

	document.addEventListener('click', (evento) => {
		const passo = evento.target.closest('.t-step');
		if (!passo) return;
		const campo = passo.querySelector(':scope > input');
		if (!campo) return;
		const bottone = evento.target.closest('.t-step > button[data-step]');
		// Un clic accanto al numero (sull'unità, nello spazio vuoto) porta a scriverlo
		if (!bottone) {
			if (evento.target !== campo) campo.focus();
			return;
		}
		if (bottone.dataset.step === 'up') campo.stepUp();
		else campo.stepDown();
		// Gli stessi eventi di chi scrive a mano: chi ascolta il campo non deve sapere dei bottoni
		campo.dispatchEvent(new Event('input', { bubbles: true }));
		campo.dispatchEvent(new Event('change', { bubbles: true }));
	});

	document.addEventListener('input', (evento) => {
		const campo = evento.target;
		if (!(campo instanceof HTMLInputElement)) return;
		if (campo.matches('.t-range')) riempi(campo);
		else if (campo.matches('.t-step > input')) limiti(campo);
	});

	const avvia = () => {
		aggiorna();
		segueLaPagina();
	};
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', avvia, { once: true });
	} else avvia();

	globalThis.TernUI = Object.freeze({ aggiorna });
})();
