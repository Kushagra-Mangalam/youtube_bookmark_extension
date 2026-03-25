import { getActiveTabURL } from "./utils.js";

const addNewBookmark=(bookmarksElement,bookmark)=>{
    const bookmarkTitleElement=document.createElement("div");
    const newBookmarkElement=document.createElement("div");
    const controlsElement=document.createElement("div");

    bookmarkTitleElement.textContent=bookmark.desc;
    bookmarkTitleElement.className="bookmark-title";

    controlsElement.className="bookmark-controls";

    newBookmarkElement.id="bookmark-"+bookmark.time;
    newBookmarkElement.className="bookmark";
    newBookmarkElement.setAttribute("timestamp",bookmark.time);

    setBookmarkAttributes("play",onPlay,controlsElement);
    setBookmarkAttributes("delete",onDelete,controlsElement);

    newBookmarkElement.appendChild(bookmarkTitleElement);
    newBookmarkElement.appendChild(controlsElement);
    bookmarksElement.appendChild(newBookmarkElement);


};

const viewBookmarks = (currentVideoBookmarks) =>{
    const bookmarksElement=document.getElementById("bookmarks");
    bookmarksElement.innerHTML="";

    if(currentVideoBookmarks.length > 0){
        for(let i=0 ;i<currentVideoBookmarks.length;i++){
            const bookmark=currentVideoBookmarks[i];
            addNewBookmark(bookmarksElement,bookmark);
        }
    }else{
        bookmarksElement.innerHTML = `<div class="title">No bookmarks found.</div>`;
    }
}

const onPlay= async e=>{
    const bookmarkTime = e.target.parentNode.getAttribute("timestamp");
    const activeTab=await getActiveTabURL();
    
    chrome.tabs.sendMessage(activeTab.id,{
        type:"PLAY",
        timestamp:bookmarkTime
    })
}


const onDelete = async e =>{
    const bookmarkTime = e.target.parentNode.getAttribute("timestamp");
    const activeTab=await getActiveTabURL();
    const bookmarkElementToDelete = document.getElementById("bookmark-"+bookmarkTime);
    
    bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);
    
    chrome.tabs.sendMessage(activeTab.id,{
        type:"DELETE",
        timestamp:bookmarkTime
    },viewBookmarks)
}

const setBookmarkAttributes = (src,addEventListener,controlParentElement) =>{
    const controlElement=document.createElement("img");

    controlElement.src="assets/"+src+".png";
    controlElement.title=src;
    controlElement.addEventListener("click",addEventListener);
    controlParentElement.appendChild(controlElement);
}

document.addEventListener("DOM contentLoaded",async ()=>{
    const activeTab = await getActiveTabURL();
    const queryParameters=activeTab.url.split("?")[1];
    const urlParameters=new URLSearchParams(queryParameters);

    const currentVideo=urlParameters.get("v");
    
    if(activeTab.url.includes("youtube.com/watch") && currentVideo){
        chrome.storage.sync.get([currentVideo] , (data) =>{
            const currentVideoBookmarks=data[currentVideo]? JSON.parse(data[currentVideo]):[];

            viewBookmarks(currentVideoBookmarks);

        })
    }else{
        const container=document.getElementsByClassName("container")[0];
        container.innerHTML="<div class='title'>This is not a youtube video page.</div>";
    }
    
})

