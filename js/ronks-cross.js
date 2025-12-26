			const API_BASE_URL = window.API_BASE_URL || 'https://f2.sqsp.ru';

			// Обновление года в подвале
			document.getElementById("year").textContent = new Date().getFullYear();

			const input = document.getElementById("part-number");
			const button = document.getElementById("search-button");
			const errorEl = document.getElementById("error");
			const tableEl = document.getElementById("tableContainer");
			const exampleButtons = document.querySelectorAll(".ronks-search-example");

			const PAGE_SIZE = 10;
			let allItems = [];
			let visibleCount = 0;
			let pendingScrollIndex = null;

			// --- Поставщики (suppliers.json) ---
			const SUPPLIERS_JSON_URL = 'suppliers.json';
			const SUPPLIERS_PAGE_SIZE = 10;

			let suppliers = [];
			let suppliersLoaded = false;
			let suppliersCurrentPage = 1;
			let suppliersPendingHighlightIndex = null;

			const suppliersMoreBtn = document.getElementById('suppliers-more-button');
			const suppliersWidget = document.getElementById('suppliers-widget');
			const supplierSearchInput = document.getElementById('supplier-search-input');
			const supplierSearchResult = document.getElementById('supplier-search-result');
			const suppliersTableContainer = document.getElementById('suppliers-table-container');
			const suppliersExampleButtons = document.querySelectorAll('.suppliers-example');

			function normalizePartNumber(value) {
				return (value || "").replace(/[^a-zA-Z0-9]/g, "");
			}

			if (button && input) {
				button.addEventListener("click", searchCrosses);
				input.addEventListener("keypress", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						searchCrosses();
					}
				});
			}

			if (exampleButtons.length && input) {
				exampleButtons.forEach((btn) => {
					btn.addEventListener("click", () => {
						const raw = btn.getAttribute("data-query") || btn.textContent.trim();
						const query = normalizePartNumber(raw);
						input.value = query;
						searchCrosses();
					});
				});
			}

			async function searchCrosses() {
				const rawPartNumber = input.value;
				const partNumber = normalizePartNumber(rawPartNumber);

				if (!partNumber) {
					if (input) {
						input.value = "";
					}
					if (errorEl) {
						errorEl.textContent = "Введите артикул";
						errorEl.classList.add("results-search-status--error");
					}
					if (tableEl) tableEl.innerHTML = "";
					return;
				}

				// показываем пользователю нормализованный артикул
				if (input) {
					input.value = partNumber;
				}

				if (errorEl) {
					errorEl.textContent = "";
					errorEl.classList.remove("results-search-status--error");
				}
				if (tableEl) tableEl.innerHTML = "<p>Загрузка...</p>";

				try {
					const apiUrl = `${API_BASE_URL}/api/analog?n=${encodeURIComponent(partNumber)}`;
					const res = await fetch(apiUrl);
					const data = await res.json();

					if (!res.ok) {
						const msg = (data && data.error) ? String(data.error) : "";
						// Специально обрабатываем кейс "Артикул не найден" –
						// просто показываем "Аналоги не найдены" в таблице без верхнего сообщения.
						if (msg.toLowerCase().includes("артикул") && msg.toLowerCase().includes("не найден")) {
							if (tableEl) tableEl.innerHTML = "<p>Аналоги не найдены.</p>";
							return;
						}
						throw new Error(msg || "Ошибка сервера");
					}

					if (!data.analogList || !data.analogList.a || !data.analogList.a.length) {
						if (errorEl) {
							errorEl.textContent = "Артикул не найден. Проверьте правильность ввода номера детали.";
							errorEl.classList.add("results-search-status--error");
						}
						if (tableEl) tableEl.innerHTML = "";
						return;
					}

					const rows = processAnalogData(data, partNumber);
					renderTable(rows);
				} catch (err) {
					console.error("Ошибка:", err);
					const message = (err && err.message) || "";
					const lowerMsg = message.toLowerCase();
					const isEmptyJson =
						lowerMsg.includes("json") ||
						lowerMsg.includes("unexpected end of") ||
						lowerMsg.includes("unexpected token");

					if (errorEl) {
						if (isEmptyJson) {
							errorEl.textContent =
								"Артикул не найден. Проверьте правильность ввода номера детали.";
						} else {
							errorEl.textContent = "Не удалось загрузить данные: " + message;
						}
						errorEl.classList.add("results-search-status--error");
					}
					if (tableEl) tableEl.innerHTML = "";
				}
			}

			function processAnalogData(data, originalPart) {
				const mfMap = new Map((data.manufacturerList?.mf || []).map((m) => [m.i, m.ds]));
				const prodMap = new Map((data.productList?.p || []).map((p) => [p.i, p]));

				const target = originalPart.toLowerCase();
				const analogs = (data.analogList?.a || []).filter((a) => a.ns?.toLowerCase() === target);

				const origProd = (data.productList?.p || []).find(
					(p) => p.ns?.toLowerCase() === target || p.n?.toLowerCase() === target
				);

				return analogs.map((a) => {
					const analogProd = prodMap.get(a.pai);
					return {
						origManuf: mfMap.get(a.mfi) || "—",
						origPart: originalPart,
						origDesc: origProd?.d || "",
						analogManuf: mfMap.get(a.mfai) || "—",
						analogPart: analogProd ? analogProd.n || analogProd.ns : a.nsa,
						analogDesc: analogProd?.d || ""
					};
				});
			}

			function renderTable(items) {
				allItems = items || [];

				if (!allItems.length) {
					if (tableEl) tableEl.innerHTML = "<p>Аналоги не найдены.</p>";
					return;
				}

				visibleCount = Math.min(PAGE_SIZE, allItems.length);
				renderTableSlice();
			}

			function renderTableSlice() {
				const slice = allItems.slice(0, visibleCount);

				if (!slice.length) {
					if (tableEl) tableEl.innerHTML = "<p>Аналоги не найдены.</p>";
					return;
				}

				const total = allItems.length;
				const tableHtml = `
			  <table>
				<thead>
				  <tr>
					<th>Оригинал: производитель</th>
					<th>Оригинал: номер</th>
					<th>Оригинал: описание</th>
					<th>Аналог: производитель</th>
					<th>Аналог: номер</th>
					<th>Аналог: описание</th>
				  </tr>
				</thead>
				<tbody>
				  ${slice
						.map(
							(i, index) => `
							<tr class="clickable-row" data-href="https://lk.ronks.ru" data-row-index="${index}">
							  <td>${escapeHtml(i.origManuf)}</td>
							  <td>${escapeHtml(i.origPart)}</td>
							  <td>${escapeHtml(i.origDesc)}</td>
							  <td>${escapeHtml(i.analogManuf)}</td>
							  <td>${escapeHtml(i.analogPart)}</td>
							  <td>${escapeHtml(i.analogDesc)}</td>
							</tr>
						  `
						)
						.join("")}
				</tbody>
			  </table>
			`;

				let controlsHtml = `<div class="more-results"><div class="more-results-top"><span class="results-counter">Показано ${visibleCount} из ${total}</span></div>`;

				if (total > 0) {
					const remainingNow = Math.max(total - visibleCount, 0);
					const toShowNow = Math.min(PAGE_SIZE, remainingNow);

					controlsHtml += `<div class="more-results-buttons">`;

					if (remainingNow > 0) {
						controlsHtml += `
					  <button
						  type="button"
						  class="more-results-button"
						  title="Показать ещё ${toShowNow} из ${total} вариантов"
					  >
						<span>Ещё ${toShowNow} из ${total} вариантов</span>
						<span>↓</span>
					  </button>
					`;
					}

					if (visibleCount > PAGE_SIZE) {
						controlsHtml += `
					  <button
						  type="button"
						  class="collapse-results-button"
						  title="Свернуть список до первых ${PAGE_SIZE} вариантов"
					  >
						<span>Свернуть</span>
						<span>↑</span>
					  </button>
					`;
					}

					// Кнопка "Сброс" на одном уровне с другими кнопками
					controlsHtml += `
					  <button
						  type="button"
						  class="reset-results-button"
						  id="reset-results-button"
						  title="Сбросить поиск и вернуться к исходному состоянию"
					  >
						<span>Сброс</span>
					  </button>
					`;

					controlsHtml += `</div>`; // .more-results-buttons
				}

				controlsHtml += "</div>";

				const searchHtml = `
			  <div class="results-search">
				<input
				  id="results-search-input"
				  type="text"
				  placeholder="Поиск по таблице (артикул, производитель, описание)"
				/>
				<button type="button" id="results-search-button">Найти</button>
				<span id="results-search-status" class="results-search-status"></span>
			  </div>
			`;

				if (tableEl) tableEl.innerHTML = searchHtml + tableHtml + controlsHtml;

				document.querySelectorAll(".clickable-row").forEach((row) => {
					row.addEventListener("click", () => {
						const url = row.dataset.href;
						if (url) {
							window.location.href = url;
						}
					});
				});

				const searchInput = document.getElementById("results-search-input");
				const searchButton = document.getElementById("results-search-button");

				if (searchInput && searchButton) {
					const triggerSearch = () => {
						const query = searchInput.value.trim();
						searchInResults(query);
					};

					searchButton.addEventListener("click", triggerSearch);
					searchInput.addEventListener("keypress", (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							triggerSearch();
						}
					});
				}

				const moreBtn = document.querySelector(".more-results-button");
				if (moreBtn) {
					moreBtn.addEventListener("click", () => {
						const remainingNow = Math.max(allItems.length - visibleCount, 0);
						if (remainingNow <= 0) return;
						const add = Math.min(PAGE_SIZE, remainingNow);
						visibleCount += add;
						renderTableSlice();
					});
				}

				const collapseBtn = document.querySelector(".collapse-results-button");
				if (collapseBtn) {
					collapseBtn.addEventListener("click", () => {
						visibleCount = Math.min(PAGE_SIZE, allItems.length);
						pendingScrollIndex = 0;
						renderTableSlice();
					});
				}

				const resetBtn = document.getElementById("reset-results-button");
				if (resetBtn) {
					resetBtn.addEventListener("click", () => {
						allItems = [];
						visibleCount = 0;
						pendingScrollIndex = null;
						if (input) input.value = "";
						if (errorEl) {
							errorEl.textContent = "";
							errorEl.classList.remove("results-search-status--error");
						}
					if (tableEl) tableEl.innerHTML = "";

					const searchSection = document.querySelector(".ronks-search");
					if (searchSection) {
						const rect = searchSection.getBoundingClientRect();
						const offset = 120; // примерно высота шапки
						const top = rect.top + window.scrollY - offset;
						window.scrollTo({ top: top < 0 ? 0 : top, behavior: "smooth" });
					}
				});
				}
				if (pendingScrollIndex !== null) {
					const row = document.querySelector(`tr[data-row-index="${pendingScrollIndex}"]`);
					if (row) {
						row.classList.add("highlight-row");
						row.scrollIntoView({ behavior: "smooth", block: "center" });
						setTimeout(() => {
							row.classList.remove("highlight-row");
						}, 2000);
					}
					pendingScrollIndex = null;
				}
			}

			function searchInResults(query) {
				if (!allItems.length) return;

				const statusEl = document.getElementById("results-search-status");
				if (statusEl) {
					statusEl.textContent = "";
					statusEl.classList.remove("results-search-status--error");
				}

				const trimmed = (query || "").trim();
				if (!trimmed) return;

				const q = trimmed.toLowerCase();
				const idx = allItems.findIndex((item) => {
					return [
						item.origManuf,
						item.origPart,
						item.origDesc,
						item.analogManuf,
						item.analogPart,
						item.analogDesc
					]
						.filter(Boolean)
						.some((val) => String(val).toLowerCase().includes(q));
				});

				if (idx === -1) {
					if (statusEl) {
						statusEl.textContent = "Ничего не найдено";
						statusEl.classList.add("results-search-status--error");
					}
					return;
				}

				visibleCount = Math.max(PAGE_SIZE, idx + 1);
				pendingScrollIndex = idx;
				renderTableSlice();
			}

			function escapeHtml(text) {
				const div = document.createElement("div");
				div.textContent = text == null ? "" : String(text);
				return div.innerHTML;
			}

			// =========================
			// Блок работы с поставщиками
			// =========================

			async function loadSuppliers() {
				if (suppliersLoaded) return;
				try {
					const res = await fetch(SUPPLIERS_JSON_URL);
					if (!res.ok) {
						throw new Error('Ошибка загрузки поставщиков');
					}
					const data = await res.json();
					const raw = Array.isArray(data) ? data : [];
					suppliers = raw.map((s) => ({
						...s,
						DisplayName: fixSuppliersEncoding(s.DisplayName)
					}));
					suppliersLoaded = true;
				} catch (e) {
					console.error(e);
					if (supplierSearchResult) {
						supplierSearchResult.textContent = 'Не удалось загрузить список поставщиков.';
					}
				}
			}

			function fixSuppliersEncoding(name) {
				if (name == null) return '';
				try {
					// Обратное преобразование типичного "кракозябров" от UTF-8/CP1251
					return decodeURIComponent(escape(String(name)));
				} catch (e) {
					return String(name);
				}
			}

			function renderSuppliersTable(page, highlightIndex) {
				if (!suppliersTableContainer || !suppliers.length) return;

				const total = suppliers.length;
				const totalPages = Math.ceil(total / SUPPLIERS_PAGE_SIZE) || 1;
				suppliersCurrentPage = Math.min(Math.max(page, 1), totalPages);

				const start = (suppliersCurrentPage - 1) * SUPPLIERS_PAGE_SIZE;
				const slice = suppliers.slice(start, start + SUPPLIERS_PAGE_SIZE);

				const rowsHtml = slice
					.map((s, idx) => {
						const globalIndex = start + idx;
						const name = s.DisplayName || '';
						const url = s.Url || '#';
						const reg = s.UrlReg || '#';
						const shortUrl = url
							.replace(/^https?:\/\//, '')
							.replace(/\/$/, '');
						const isHighlight =
							typeof highlightIndex === 'number' && globalIndex === highlightIndex;
						const rowClass = isHighlight ? ' highlight-row' : '';
						return `
							<tr class="suppliers-row${rowClass}" data-supplier-index="${globalIndex}">
							  <td>${s.Id || ''}</td>
							  <td>${escapeHtml(name)}</td>
							  <td><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortUrl)}</a></td>
							  <td><a href="${reg}" target="_blank" rel="noopener noreferrer">Регистрация</a></td>
							</tr>
						`;
					})
					.join('');

				const tableHtml = `
					<table class="suppliers-table">
					  <thead>
						<tr>
						  <th>ID</th>
						  <th>Наименование</th>
						  <th>Сайт</th>
						  <th>Регистрация</th>
						</tr>
					  </thead>
					  <tbody>
						${rowsHtml}
					  </tbody>
					</table>
					<div class="suppliers-pagination">
					  <button type="button" class="suppliers-page-button" data-page="prev" ${suppliersCurrentPage === 1 ? 'disabled' : ''}>
						Назад
					  </button>
					  <span>Страница ${suppliersCurrentPage} из ${totalPages}</span>
					  <button type="button" class="suppliers-page-button" data-page="next" ${suppliersCurrentPage === totalPages ? 'disabled' : ''}>
						Вперёд
					  </button>
					</div>
				`;

				suppliersTableContainer.innerHTML = tableHtml;

				// обработка пагинации
				const pagContainer = suppliersTableContainer.querySelector('.suppliers-pagination');
				if (pagContainer) {
					pagContainer.addEventListener(
						'click',
						(evt) => {
							const btn = evt.target.closest('button[data-page]');
							if (!btn) return;
							if (btn.dataset.page === 'prev') {
								renderSuppliersTable(suppliersCurrentPage - 1);
							} else if (btn.dataset.page === 'next') {
								renderSuppliersTable(suppliersCurrentPage + 1);
							}
						},
						{ once: true }
					);
				}

				// если есть индекс для подсветки, прокручиваем к строке и мигаем рамкой
				if (typeof highlightIndex === 'number') {
					const row = suppliersTableContainer.querySelector(
						`tr[data-supplier-index="${highlightIndex}"]`
					);
					if (row) {
						row.classList.add('highlight-row');
						row.scrollIntoView({ behavior: 'smooth', block: 'center' });
						setTimeout(() => row.classList.remove('highlight-row'), 2000);
					}
				}
			}

			async function handleSupplierSearch() {
				if (!supplierSearchInput || !supplierSearchResult) return;

				// Гарантируем, что данные поставщиков подгружены перед поиском
				await loadSuppliers();
				if (!suppliers.length) {
					supplierSearchResult.textContent = 'Поставщики не найдены.';
					if (suppliersTableContainer) suppliersTableContainer.innerHTML = '';
					return;
				}

				// Автоматически раскрываем виджет, даже если пользователь не нажимал кнопку
				if (suppliersWidget && suppliersWidget.hasAttribute('hidden')) {
					suppliersWidget.removeAttribute('hidden');
				}

				const query = supplierSearchInput.value.trim().toLowerCase();
				if (!query) {
					supplierSearchResult.textContent = '';
					if (suppliersTableContainer) {
						suppliersTableContainer.innerHTML = '';
					}
					return;
				}

				const idx = suppliers.findIndex((s) =>
					(s.DisplayName || '').toLowerCase().includes(query)
				);

				if (idx === -1) {
					supplierSearchResult.textContent = 'Поставщик не найден.';
					if (suppliersTableContainer) {
						suppliersTableContainer.innerHTML = '';
					}
					return;
				}

				const found = suppliers[idx];
				const name = found.DisplayName || '';
				const url = found.Url || '#';
				const shortUrl = url
					.replace(/^https?:\/\//, '')
					.replace(/\/$/, '');

				supplierSearchResult.innerHTML =
					`Найден поставщик: <strong>${escapeHtml(name)}</strong> — ` +
					`<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortUrl)}</a>`;

				// переходим на страницу с найденным поставщиком и подсвечиваем строку
				const page = Math.floor(idx / SUPPLIERS_PAGE_SIZE) + 1;
				renderSuppliersTable(page, idx);
			}

			if (suppliersMoreBtn && suppliersWidget) {
				suppliersMoreBtn.addEventListener('click', async (evt) => {
					if (evt && evt.preventDefault) evt.preventDefault();
					await loadSuppliers();

					if (suppliersWidget.hasAttribute('hidden')) {
						// При первом открытии сразу рендерим таблицу, если есть данные
						if (suppliers.length) {
							renderSuppliersTable(1);
						}
						suppliersWidget.removeAttribute('hidden');
					} else {
						suppliersWidget.setAttribute('hidden', '');
					}
				});
			}

			if (supplierSearchInput) {
				supplierSearchInput.addEventListener('input', () => {
					// не ждём результата, просто запускаем асинхронный поиск
					handleSupplierSearch();
				});
			}

			if (suppliersExampleButtons.length && supplierSearchInput) {
				suppliersExampleButtons.forEach((btn) => {
					btn.addEventListener('click', async () => {
						const value = btn.getAttribute('data-supplier') || btn.textContent.trim();
						supplierSearchInput.value = value;
						await handleSupplierSearch();
					});
				});
			}

			// Кнопки "Показать всех" больше нет
