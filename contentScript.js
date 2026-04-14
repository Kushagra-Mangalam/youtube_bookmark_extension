(() => {
  const API_BASE = "http://127.0.0.1:8000";

  let youtubeLeftControls, youtubePlayer;
  let currentVideo = "";
  let currentVideoBookmarks = [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getTime = (t) => {
    const date = new Date(0);
    date.setSeconds(t);
    return date.toISOString().substr(11, 8);
  };

  // ── Authenticated Fetch (with token refresh) ─────────────────────────────

  async function authFetch(url, options = {}) {
    const { token } = await chrome.storage.local.get("token");
    if (!token) {
      console.warn("[YT Bookmarks] No token found. User not logged in.");
      return null;
    }

    options.headers = {
      ...options.headers,
      Authorization: "Bearer " + token,
    };

    let res = await fetch(url, options);

    // If 401, try refreshing the token
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const { token: newToken } = await chrome.storage.local.get("token");
        options.headers.Authorization = "Bearer " + newToken;
        res = await fetch(url, options);
      } else {
        console.warn("[YT Bookmarks] Token refresh failed. Session expired.");
        return null;
      }
    }

    return res;
  }

  async function tryRefreshToken() {
    const { refreshToken } = await chrome.storage.local.get("refreshToken");
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.access) {
        await chrome.storage.local.set({ token: data.access });
        if (data.refresh) {
          await chrome.storage.local.set({ refreshToken: data.refresh });
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchBookmarks = async () => {
    const res = await authFetch(
      `${API_BASE}/api/bookmarks/?videoId=${currentVideo}`
    );
    if (!res) return [];
    return await res.json();
  };

  const updateBadge = (bookmarks) => {
    chrome.runtime.sendMessage({
      type: "UPDATE_BADGE",
      count: bookmarks.length,
    });
  };

  // ── Context Modal ─────────────────────────────────────────────────────────

  const showContextModal = (capturedTime) => {
    youtubePlayer.pause();

    const existing = document.getElementById("yt-bm-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "yt-bm-modal-overlay";
    overlay.innerHTML = `
      <div id="yt-bm-modal">
        <div id="yt-bm-modal-header">
          <span id="yt-bm-modal-title">📌 Add Bookmark</span>
          <span id="yt-bm-modal-time">${getTime(capturedTime)}</span>
        </div>
        <input
          id="yt-bm-modal-input"
          type="text"
          placeholder="Add a note for this moment… (optional)"
          maxlength="120"
        />
        <div id="yt-bm-modal-actions">
          <button id="yt-bm-cancel">Cancel</button>
          <button id="yt-bm-save">Save Bookmark</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById("yt-bm-modal-input");
    setTimeout(() => input.focus(), 50);

    const closeModal = (resume = true) => {
      overlay.remove();
      if (resume) youtubePlayer.play();
    };

    const saveBookmark = async () => {
      const note = input.value.trim();
      const desc = note || "Bookmark at " + getTime(capturedTime);

      const res = await authFetch(`${API_BASE}/api/bookmarks/add/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: currentVideo,
          time: capturedTime,
          desc,
        }),
      });

      if (!res || !res.ok) {
        console.error("[YT Bookmarks] Failed to save bookmark");
        closeModal(true);
        return;
      }

      currentVideoBookmarks = await fetchBookmarks();
      chrome.runtime.sendMessage({
        type: "BOOKMARK_SAVED",
        videoId: currentVideo,
        bookmarks: currentVideoBookmarks,
      });
      updateBadge(currentVideoBookmarks);
      closeModal(true);
    };

    document.getElementById("yt-bm-save").addEventListener("click", saveBookmark);
    document.getElementById("yt-bm-cancel").addEventListener("click", () => closeModal(true));

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBookmark();
      if (e.key === "Escape") closeModal(true);
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(true);
    });
  };

  // ── Bookmark Button ───────────────────────────────────────────────────────

  const newVideoLoaded = async () => {
    const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];
    currentVideoBookmarks = await fetchBookmarks();
    updateBadge(currentVideoBookmarks);

    if (!bookmarkBtnExists) {
      const bookmarkBtn = document.createElement("img");
      bookmarkBtn.src = chrome.runtime.getURL("assets/bookmark.png");
      bookmarkBtn.className = "ytp-button bookmark-btn";
      bookmarkBtn.title = "Click to bookmark current timestamp";

      youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
      youtubePlayer = document.getElementsByClassName("video-stream")[0];

      youtubeLeftControls.appendChild(bookmarkBtn);
      bookmarkBtn.addEventListener("click", () => {
        // Bounce animation
        bookmarkBtn.classList.remove("yt-bm-clicked");
        void bookmarkBtn.offsetWidth; // force reflow so re-clicking resets it
        bookmarkBtn.classList.add("yt-bm-clicked");
        bookmarkBtn.addEventListener(
          "animationend",
          () => bookmarkBtn.classList.remove("yt-bm-clicked"),
          { once: true }
        );

        showContextModal(youtubePlayer.currentTime);
      });
    }
  };

  // ── Message Listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((obj, sender, response) => {
    const { type, value, videoId } = obj;

    if (type === "NEW") {
      currentVideo = videoId;
      newVideoLoaded();
    } else if (type === "PLAY") {
      youtubePlayer.currentTime = Number(value);
      youtubePlayer.play();
    } else if (type === "DELETE") {
      // Call backend API to delete
      (async () => {
        await authFetch(`${API_BASE}/api/bookmarks/delete/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: currentVideo,
            time: value,
          }),
        });
        currentVideoBookmarks = await fetchBookmarks();
        updateBadge(currentVideoBookmarks);
        response(currentVideoBookmarks);
      })();
      return true; // keep message channel open for async response
    } else if (type === "EDIT") {
      // Call backend API to edit
      (async () => {
        await authFetch(`${API_BASE}/api/bookmarks/edit/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: currentVideo,
            time: value.time,
            desc: value.desc,
          }),
        });
        currentVideoBookmarks = await fetchBookmarks();
        response(currentVideoBookmarks);
      })();
      return true; // keep message channel open for async response
    }
  });

  // ── Modal Styles ──────────────────────────────────────────────────────────

  const injectModalStyles = () => {
    if (document.getElementById("yt-bm-styles")) return;
    const style = document.createElement("style");
    style.id = "yt-bm-styles";
    style.textContent = `
      #yt-bm-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: yt-bm-fade-in 0.15s ease;
      }
      @keyframes yt-bm-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      #yt-bm-modal {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 20px 22px;
        width: 360px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: yt-bm-slide-up 0.18s ease;
        font-family: 'YouTube Sans', Roboto, sans-serif;
      }
      @keyframes yt-bm-slide-up {
        from { transform: translateY(16px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      #yt-bm-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      #yt-bm-modal-title {
        color: #fff;
        font-size: 15px;
        font-weight: 600;
      }
      #yt-bm-modal-time {
        background: #ff0000;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 20px;
        letter-spacing: 0.5px;
      }
      #yt-bm-modal-input {
        width: 100%;
        box-sizing: border-box;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        padding: 10px 12px;
        outline: none;
        transition: border-color 0.2s;
        margin-bottom: 14px;
      }
      #yt-bm-modal-input:focus { border-color: #ff0000; }
      #yt-bm-modal-input::placeholder { color: #777; }
      #yt-bm-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      #yt-bm-cancel {
        background: #2a2a2a;
        color: #aaa;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
      }
      #yt-bm-cancel:hover { background: #333; color: #fff; }
      #yt-bm-save {
        background: #ff0000;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      #yt-bm-save:hover { background: #cc0000; }

      .bookmark-btn {
        transition: transform 0.1s ease;
      }
      @keyframes yt-bm-bounce {
        0%   { transform: scale(1);    }
        30%  { transform: scale(0.75); }
        60%  { transform: scale(1.3);  }
        80%  { transform: scale(0.92); }
        100% { transform: scale(1);    }
      }
      .bookmark-btn.yt-bm-clicked {
        animation: yt-bm-bounce 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
      }
    `;
    document.head.appendChild(style);
  };

  injectModalStyles();
  setTimeout(newVideoLoaded, 1500);
})();