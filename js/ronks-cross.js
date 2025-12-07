			const API_BASE_URL = window.API_BASE_URL || 'https://f2.sqsp.ru';

			// Обновление года в подвале
			document.getElementById("year").textContent = new Date().getFullYear();

			const input = document.getElementById("part-number");
			const button = document.getElementById("search-button");
			const errorEl = document.getElementById("error");
			const tableEl = document.getElementById("tableContainer");

			const PAGE_SIZE = 10;
			let allItems = [];
			let visibleCount = 0;
			let pendingScrollIndex = null;

			if (button && input) {
				button.addEventListener("click", searchCrosses);
				input.addEventListener("keypress", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						searchCrosses();
					}
				});
			}

			async function searchCrosses() {
				const partNumber = input.value.trim();

				if (!partNumber) {
					if (errorEl) {
						errorEl.textContent = "Введите артикул";
						errorEl.classList.add("results-search-status--error");
					}
					if (tableEl) tableEl.innerHTML = "";
					return;
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
						throw new Error(data.error || "Ошибка сервера");
					}

					if (!data.analogList || !data.analogList.a || !data.analogList.a.length) {
						if (tableEl) tableEl.innerHTML = "<p>Аналоги не найдены.</p>";
						return;
					}

					const rows = processAnalogData(data, partNumber);
					renderTable(rows);
				} catch (err) {
					console.error("Ошибка:", err);
					if (errorEl) {
						errorEl.textContent = "Не удалось загрузить данные: " + err.message;
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

				let controlsHtml = `<div class="more-results"><span class="results-counter">Показано ${visibleCount} из ${total}</span>`;

				if (total > PAGE_SIZE) {
					const remainingNow = Math.max(total - visibleCount, 0);
					const toShowNow = Math.min(PAGE_SIZE, remainingNow);

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
