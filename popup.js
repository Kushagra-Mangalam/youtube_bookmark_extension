import { getActiveTabURL } from "./utils.js";

let currentVideoId = "";
let activeTab = null;

// ── Render ────────────────────────────────────────────────────────────────

const addNewBookmark = (bookmarks, bookmark) => {
  const newBookmarkElement = document.createElement("div");
  newBookmarkElement.id = "bookmark-" + bookmark.time;
  newBookmarkElement.className = "bookmark";
  newBookmarkElement.setAttribute("timestamp", bookmark.time);

  // Left side: timestamp pill + description
  const infoEl = document.createElement("div");
  infoEl.className = "bookmark-info";

  const timeEl = document.createElement("span");
  timeEl.className = "bookmark-time";
  timeEl.textContent = getTime(bookmark.time);

  const descEl = document.createElement("div");
  descEl.className = "bookmark-title";
  descEl.textContent = bookmark.desc;
  descEl.title = "Click to edit";
  descEl.addEventListener("click", () => onEdit(descEl, newBookmarkElement));

  infoEl.appendChild(timeEl);
  infoEl.appendChild(descEl);

  // Right side: controls (play + delete only)
  const controlsEl = document.createElement("div");
  controlsEl.className = "bookmark-controls";

  setBookmarkAttributes("play",   onPlay,   controlsEl);
  setBookmarkAttributes("delete", onDelete, controlsEl);

  newBookmarkElement.appendChild(infoEl);
  newBookmarkElement.appendChild(controlsEl);
  bookmarks.appendChild(newBookmarkElement);
};

const viewBookmarks = (currentBookmarks = []) => {
  const bookmarksElement = document.getElementById("bookmarks");
  bookmarksElement.innerHTML = "";

  if (currentBookmarks.length > 0) {
    currentBookmarks.forEach((bookmark) =>
      addNewBookmark(bookmarksElement, bookmark)
    );
  } else {
    bookmarksElement.innerHTML = '<i class="empty-msg">No bookmarks yet — click the 🔖 button while watching!</i>';
  }

  // Update export button visibility
  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) exportBtn.style.display = currentBookmarks.length > 0 ? "block" : "none";
};

// ── Toast ─────────────────────────────────────────────────────────────────

const showToast = (message, isError = false) => {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.textContent = message;
  if (isError) toast.classList.add("toast-error");
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
};

// ── Helpers ───────────────────────────────────────────────────────────────

const getTime = (t) => {
  const date = new Date(0);
  date.setSeconds(t);
  return date.toISOString().substr(11, 8);
};

const setBookmarkAttributes = (src, eventListener, controlParentElement) => {
  const controlElement = document.createElement("img");
  controlElement.src = "assets/" + src + ".png";
  controlElement.title = src;
  controlElement.addEventListener("click", eventListener);
  controlParentElement.appendChild(controlElement);
};

// ── Actions ───────────────────────────────────────────────────────────────

const onPlay = async (e) => {
  const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
  chrome.tabs.sendMessage(activeTab.id, {
    type: "PLAY",
    value: Number(bookmarkTime),
  });
};

const onDelete = async (e) => {
  const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
  const el = document.getElementById("bookmark-" + bookmarkTime);
  el.parentNode.removeChild(el);

  chrome.tabs.sendMessage(
    activeTab.id,
    { type: "DELETE", value: bookmarkTime },
    (updatedBookmarks) => {
      viewBookmarks(updatedBookmarks);
      showToast("🗑️ Bookmark deleted");
    }
  );
};

const onEdit = (descEl, bookmarkEl) => {
  if (bookmarkEl.querySelector(".bookmark-edit-input")) return; // already editing

  const bookmarkTime = bookmarkEl.getAttribute("timestamp");
  const currentDesc = descEl.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentDesc;
  input.className = "bookmark-edit-input";
  input.maxLength = 120;

  descEl.replaceWith(input);
  input.focus();
  input.select();

  const commitEdit = () => {
    const newDesc = input.value.trim() || currentDesc;
    const newDescEl = document.createElement("div");
    newDescEl.className = "bookmark-title";
    newDescEl.textContent = newDesc;
    newDescEl.title = "Click to edit";
    newDescEl.addEventListener("click", () => onEdit(newDescEl, bookmarkEl));
    input.replaceWith(newDescEl);

    if (newDesc !== currentDesc) {
      chrome.tabs.sendMessage(
        activeTab.id,
        { type: "EDIT", value: { time: bookmarkTime, desc: newDesc } },
        () => showToast("✏️ Bookmark updated")
      );
    }
  };

  input.addEventListener("blur", commitEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = currentDesc;
      input.blur();
    }
  });
};

// ── Export ────────────────────────────────────────────────────────────────

const onExport = () => {
  chrome.storage.sync.get([currentVideoId], (data) => {
    const bookmarks = data[currentVideoId]
      ? JSON.parse(data[currentVideoId])
      : [];

    if (!bookmarks.length) return;

    const text = bookmarks
      .map((b) => `[${getTime(b.time)}] ${b.desc}`)
      .join("\n");

    const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
    const full = `Bookmarks for: ${videoUrl}\n\n${text}`;

    navigator.clipboard.writeText(full).then(() => {
      showToast("📋 Copied to clipboard!");
    });
  });
};

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  activeTab = await getActiveTabURL();
  const queryParameters = activeTab.url.split("?")[1];
  const urlParameters = new URLSearchParams(queryParameters);
  currentVideoId = urlParameters.get("v");

  if (activeTab.url.includes("youtube.com/watch") && currentVideoId) {
    // Wire up export button
    const exportBtn = document.getElementById("export-btn");
    exportBtn.addEventListener("click", onExport);

    chrome.storage.sync.get([currentVideoId], (data) => {
      const bookmarks = data[currentVideoId]
        ? JSON.parse(data[currentVideoId])
        : [];
      viewBookmarks(bookmarks);
    });

    // Live-refresh when a bookmark is saved while popup is open
    chrome.runtime.onMessage.addListener((message) => {
      if (
        message.type === "BOOKMARK_SAVED" &&
        message.videoId === currentVideoId
      ) {
        viewBookmarks(message.bookmarks);
        showToast("✅ Bookmark saved!");
      }
    });
  } else {
    const container = document.getElementsByClassName("container")[0];
    container.innerHTML =
      '<div class="title">This is not a YouTube video page.</div>';
  }
});