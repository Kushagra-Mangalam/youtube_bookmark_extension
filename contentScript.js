(()=>{
    let youtubeLeftControls, youtubePlayer;
    let currentVideo ="";
    let currentVideoBookmarks = [];

    chrome.runtime.onMessage.addListener((obj,sender,response)=>{
        const {type,value,videoId}=obj;

        if(type==="NEW"){
            currentVideo = videoId;
            newVideoLoaded();
        }
    })

    const fetchBookmarks=()=>{
        return new Promise((resolve)=>{
            chrome.storage.sync.get([currentVideo],(obj)=>{
                resolve(obj[currentVideo]? JSON.parse(obj[currentVideo]):[]);
            })
        })
    }

    const newVideoLoaded=()=>{
        const bookmarkBtnExists=document.getElementsByClassName("bookmark-btn")[0];

        if(!bookmarkBtnExists){
            const bookmarkBtn=document.createElement("img");
            
            bookmarkBtn.src=chrome.runtime.getURL("assets/bookmark.png");
            bookmarkBtn.Btn.className="ytp-button"+"bookmark-btn";
            bookmarkBtn.title="click to bookmark current timestamp"

            youtubeLeftControls=document.getElementsByClassName("ytp-left-controls")[0];
            youtubePlayer=document.getElementsByClassName("video-stream")[0];

            youtubeLeftControls.appendChild(bookmarkBtn); 

            bookmarkBtn.addEventListner("click",addNewBookmarkEventHandler);
            
        }
    }

    const addNewBookmarkEventHandler = ()=>{
        const currentTime=youtubePlayer.currentTime;
        const newBookmark={
            time:currentTime,
            desc:"Bookmark at "+currentTime
        }

        chrome.storage.sync.set({
            [currentVideo]: JSON.stringify([...currentVideo,newBookmark].sort((a,b)=>a.time-b.time)) 
        })
    }

    newVideoLoaded();

})();

const getTime = t=>{
    var date = new Date(0);
    date.setSeconds(t);

    return date.toISOString().substr(11,8);
}