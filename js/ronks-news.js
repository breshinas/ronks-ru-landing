// News feed module for ronks-ru-landing
(function () {
  "use strict";

  var NEWS_JSON_URL = "news.json";
  var NEWS_PER_PAGE = 3;
  var newsList = document.getElementById("news-list");
  var loadMoreBtn = document.getElementById("news-load-more");
  var newsItems = [];
  var visibleCount = 0;

  // Fetch news from JSON file
  function fetchNews() {
    if (!newsList) return;

    fetch(NEWS_JSON_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then(function (data) {
        newsItems = data.sort(function (a, b) {
          // Sort by date (newest first)
          return new Date(b.date) - new Date(a.date);
        });
        renderNews();
        setupLoadMore();
      })
      .catch(function (error) {
        console.error("Error loading news:", error);
        if (newsList) {
          newsList.innerHTML =
            '<li class="col-xs-12"><p class="text-center">Ошибка загрузки новостей. Пожалуйста, попробуйте позже.</p></li>';
        }
      });
  }

  // Render news cards
  function renderNews() {
    if (!newsList) return;

    var html = "";
    var itemsToRender = newsItems.slice(0, visibleCount + NEWS_PER_PAGE);

    itemsToRender.forEach(function (item) {
      var imageAlt = "Новость Ronks";
      var imageSrc = item.image || "";

      // Format date
      var dateObj = new Date(item.date);
      var formattedDate = dateObj.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      html += "<li>";
      html += "    <div class='news-card'>";
      if (imageSrc) {
        html += "        <div class='news-image-wrap'>";
        html +=
          "            <img src='" + imageSrc + "' alt='" + imageAlt + "'>";
        html += "        </div>";
      }
      html += "        <div class='news-content'>";
      if (item.tag) {
        html += "            <span class='news-tag'>" + item.tag + "</span>";
      }
      html +=
        "            <h3 class='news-title'><a href='" +
        item.link +
        "' target='_blank'>" +
        item.title +
        "</a></h3>";
      html += "            <p class='news-excerpt'>" + item.excerpt + "</p>";
      html += "            <div class='news-meta'>";
      html +=
        "                <span class='news-date'>" + formattedDate + "</span>";
      html +=
        "                <a href='" +
        item.link +
        "' class='news-link' target='_blank'>в личный кабинет &rarr;</a>";
      html += "            </div>";
      html += "        </div>";
      html += "    </div>";
      html += "</li>";
    });

    newsList.innerHTML = html;
  }

  // Setup Load More button
  function setupLoadMore() {
    if (!loadMoreBtn) return;

    visibleCount = NEWS_PER_PAGE;

    // Initial check: if there are fewer or equal items to page size, hide button
    if (newsItems.length <= NEWS_PER_PAGE) {
      loadMoreBtn.style.display = "none";
    }

    loadMoreBtn.addEventListener("click", function (e) {
      if (e) e.preventDefault();
      visibleCount += NEWS_PER_PAGE;
      renderNews();

      // Hide button if all items are shown
      if (visibleCount >= newsItems.length) {
        loadMoreBtn.style.display = "none";
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchNews);
  } else {
    fetchNews();
  }
})();
