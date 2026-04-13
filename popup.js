import { getActiveTabURL } from "./utils.js";

let currentVideoId = "";
let activeTab = null;

// ── Authentication ─────────────────────────────────────────────────────────

/**
 * Handles the login process and stores the token in local storage.
 */
function setupLoginListener() {
  const loginBtn = document.getElementById("login-btn");
  if (!loginBtn) return;

  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.token && data.token.access) {
        // Save the access token and reload to show the main container
        await chrome.storage.local.set({ token: data.token.access });
        location.reload();
      } else {
        alert(data.error || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("Could not connect to the authentication server.");
    }
  });
}

// ── Data Fetching ──────────────────────────────────────────────────────────

/**
 * Fetches bookmarks for the current video from the backend.
 */
const fetchBookmarks = async () => {
  const { token } = await chrome.storage.local.get("token");

  const res = await fetch(
    `http://127.0.0.1:8000/api/bookmarks/?videoId=${currentVideoId}`,
    {
      headers: {
        Authorization: "Bearer " + token,
      },
    }
  );
  return await res.json();
};

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

  // Right side: controls (play + delete)
  const controlsEl = document.createElement("div");
  controlsEl.className = "bookmark-controls";

  setBookmarkAttributes("play", onPlay, controlsEl);
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
  const { token } = await chrome.storage.local.get("token");

  await fetch("http://127.0.0.1:8000/api/bookmarks/delete/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      videoId: currentVideoId,
      time: bookmarkTime,
    }),
  });

  const updated = await fetchBookmarks();
  viewBookmarks(updated);
};

const onEdit = (descEl, bookmarkEl) => {
  if (bookmarkEl.querySelector(".bookmark-edit-input")) return;

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

  const commitEdit = async () => {
    const newDesc = input.value.trim() || currentDesc;
    const newDescEl = document.createElement("div");
    newDescEl.className = "bookmark-title";
    newDescEl.textContent = newDesc;
    newDescEl.title = "Click to edit";
    newDescEl.addEventListener("click", () => onEdit(newDescEl, bookmarkEl));
    input.replaceWith(newDescEl);

    if (newDesc !== currentDesc) {
      const { token } = await chrome.storage.local.get("token");

      try {
        await fetch("http://127.0.0.1:8000/api/bookmarks/edit/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            videoId: currentVideoId,
            time: bookmarkTime,
            desc: newDesc,
          }),
        });
        showToast("✏️ Bookmark updated");
        chrome.tabs.sendMessage(activeTab.id, {
          type: "EDIT",
          value: { time: bookmarkTime, desc: newDesc },
        });
      } catch (e) {
        showToast("Error updating bookmark", true);
      }
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

const onExport = () => {
  // Fetches from backend to ensure data is synced
  fetchBookmarks().then((bookmarks) => {
    if (!bookmarks || !bookmarks.length) return;

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

// ── Initialization ────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const { token } = await chrome.storage.local.get("token");
  const authContainer = document.getElementById("auth-container");
  const mainContainer = document.getElementById("main-container");

  if (!token) {
    // Show login view
    if (authContainer) authContainer.style.display = "block";
    if (mainContainer) mainContainer.style.display = "none";
    setupLoginListener();
  } else {
    // Show main view
    if (authContainer) authContainer.style.display = "none";
    if (mainContainer) mainContainer.style.display = "block";

    activeTab = await getActiveTabURL();
    const queryParameters = activeTab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);
    currentVideoId = urlParameters.get("v");

    if (activeTab.url.includes("youtube.com/watch") && currentVideoId) {
      const exportBtn = document.getElementById("export-btn");
      if (exportBtn) exportBtn.addEventListener("click", onExport);

      const bookmarks = await fetchBookmarks();
      viewBookmarks(bookmarks);

      // Listen for background messages to update list live
      chrome.runtime.onMessage.addListener(async (message) => {
        if (
          message.type === "BOOKMARK_SAVED" &&
          message.videoId === currentVideoId
        ) {
          const updated = await fetchBookmarks();
          viewBookmarks(updated);
          showToast("Bookmark saved");
        }
      });
    } else {
      const container = document.getElementById("bookmarks");
      if (container) {
        container.innerHTML = '<div class="title">This is not a YouTube video page.</div>';
      }
      const exportBtn = document.getElementById("export-btn");
      if (exportBtn) exportBtn.style.display = "none";
    }
  }
});