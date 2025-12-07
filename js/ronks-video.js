// Инициализация модального видео Ronks
(function () {
	"use strict";

	var modal = document.getElementById("ronks-video-modal");
	if (!modal) return;

	var player = document.getElementById("ronks-video-player");
	var triggers = document.querySelectorAll(".js-ronks-video-trigger");
	var closeElements = modal.querySelectorAll("[data-ronks-video-close]");

	function openModal(src) {
		if (!player) return;
		if (src) {
			player.pause();
			player.setAttribute("src", src);
			player.load();
		}

		modal.classList.add("ronks-video-modal--open");
		modal.setAttribute("aria-hidden", "false");
		player.play().catch(function () {
			// Автовоспроизведение может быть заблокировано браузером — просто игнорируем
		});
	}

	function closeModal() {
		if (!player) return;
		player.pause();
		player.currentTime = 0;
		modal.classList.remove("ronks-video-modal--open");
		modal.setAttribute("aria-hidden", "true");
	}

	// Открытие по клику на иконку воспроизведения
	Array.prototype.forEach.call(triggers, function (trigger) {
		trigger.addEventListener("click", function (evt) {
			var src = trigger.getAttribute("data-video-src");
			if (!src) return;
			if (evt && evt.preventDefault) evt.preventDefault();
			openModal(src);
		});
	});

	// Закрытие по крестику и фону
	Array.prototype.forEach.call(closeElements, function (el) {
		el.addEventListener("click", function (evt) {
			if (evt && evt.preventDefault) evt.preventDefault();
			closeModal();
		});
	});

	// Закрытие по Esc
	document.addEventListener("keydown", function (evt) {
		if (evt.key === "Escape" || evt.key === "Esc") {
			if (modal.classList.contains("ronks-video-modal--open")) {
				closeModal();
			}
		}
	});
})();