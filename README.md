# 🔖 Kush YT Bookmarks — Chrome Extension

Save timestamps on any YouTube video with a single click. Bookmarks are synced to the cloud via the YTMarker's backend, so they show up on the [YTMarker's website](https://youtube-bookmark-frontend.vercel.app/) too.

---

## ✨ Features

- **One-click bookmarking** — Adds a 🔖 button to YouTube's video player controls
- **Custom notes** — Add a description to each bookmark via a sleek modal
- **Popup viewer** — View, play, edit, and delete bookmarks from the extension popup
- **Cloud sync** — Bookmarks are stored in the backend, not just locally
- **Auto token refresh** — JWT tokens refresh automatically so you stay logged in
- **Export** — Copy all bookmarks to clipboard in one click

---

## 🚀 How to Load the Extension

### Step 1 — Download the extension

Clone or download this repository to your local machine:

```bash
git clone https://github.com/kushwanthreddy/Youtube_bookmark.git
```

Or download as ZIP and extract it to a folder.

### Step 2 — Open Chrome Extensions page

1. Open **Google Chrome**
2. Type `chrome://extensions/` in the address bar and press **Enter**

### Step 3 — Enable Developer Mode

Toggle the **"Developer mode"** switch in the **top-right corner** of the extensions page.

### Step 4 — Load the extension

1. Click the **"Load unpacked"** button (top-left)
2. Navigate to the folder where you downloaded/cloned this repo (the folder containing `manifest.json`)
3. Select the folder and click **"Select Folder"**

### Step 5 — Pin the extension

1. Click the **puzzle piece icon** (🧩) in Chrome's toolbar
2. Find **"kush YT Bookmarks"** in the list
3. Click the **pin icon** (📌) to keep it visible in your toolbar

---

## 🔑 How to Use

### Login

1. Click the extension icon in the toolbar
2. Enter your **email** and **password** (same account as the YTMarker's website)
3. Click **Login**

### Add a Bookmark

1. Go to any YouTube video
2. Click the **🔖 bookmark button** in the video player controls (bottom-left, next to the volume)
3. A modal appears — optionally add a note, then click **Save Bookmark**

### View Bookmarks

1. Click the extension icon while on a YouTube video page
2. Your bookmarks for that video are listed with timestamps
3. Click **▶ play** to jump to that timestamp
4. Click the bookmark text to **edit** it
5. Click **🗑 delete** to remove it

### Export

Click **"Copy All"** to copy all bookmarks for the current video to your clipboard.

### Logout

Click the **Logout** button in the popup header to sign out.

---

## 📁 Project Structure

```
Youtube_bookmark/
├── manifest.json       # Extension configuration
├── background.js       # Service worker (badge updates, tab events)
├── contentScript.js    # Injected into YouTube pages (bookmark button + modal)
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic (auth, CRUD, rendering)
├── popup.css           # Popup styles
├── utils.js            # Helper utilities
└── assets/             # Icons and images
    ├── ext-icon.png
    ├── bookmark.png
    ├── play.png
    ├── delete.png
    └── save.png
```

---

## ⚙️ Configuration

The extension connects to the backend at `http://127.0.0.1:8000` by default (local development). To point it to the production backend, update the `API_BASE` constant in:

- `popup.js` (line 3)
- `contentScript.js` (line 2)

```js
const API_BASE = "https://youtube-bookmark-backend.onrender.com";
```

---

## 🛠 Troubleshooting

| Issue | Fix |
|---|---|
| Extension doesn't appear | Make sure Developer Mode is ON and you loaded the correct folder |
| Login fails | Ensure the backend server is running (`python manage.py runserver`) |
| Bookmarks don't save | Check the browser console (F12) for 401 errors — try logging out and back in |
| Bookmark button missing on YouTube | Refresh the YouTube page or reload the extension |

---

## 📄 License

MIT
