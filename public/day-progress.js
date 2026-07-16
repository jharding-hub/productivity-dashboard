// ═══════════════════════════════════════════════════════════════════
// Centerpost — day-progress bar (R18 extraction)
// Zero dependency on app state; one soft typeof-guarded call to
// renderBannerBlocks (defined in legacy.js) -- safe because it's only
// checked at CALL time, well after legacy.js has finished loading, not at
// define time. Loaded before legacy.js, same as the other extracted files.
// ═══════════════════════════════════════════════════════════════════

var TL_START_H=5,TL_END_H=20;
function updateTimeLeft(){
  // Text overlay removed -- just update the day progress position
  updateDayProgress();
}

function updateDayProgress(){
  var now=new Date();
  var nowMin=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
  var startMin=TL_START_H*60,endMin=TL_END_H*60,totalMin=endMin-startMin;
  var elapsedEl=document.getElementById('dayProgressElapsed');
  var nowEl=document.getElementById('dayProgressNow');
  if(!elapsedEl||!nowEl)return;

  var elapsed=0;
  if(nowMin<startMin){
    // Before 5am -- show at start, no indicator
    elapsed=0;
    nowEl.style.left='0%';
    nowEl.style.display='none';
    nowEl.classList.remove('resting');
  }else if(nowMin>=endMin){
    // After 8pm -- full bar, moon at right edge (via CSS)
    elapsed=100;
    nowEl.style.left='';   // CSS handles position via .resting rule
    nowEl.style.display='flex';
    nowEl.classList.add('resting');
  }else{
    // During productive day -- sun follows progress
    var elapsedMin=nowMin-startMin;
    elapsed=(elapsedMin/totalMin)*100;
    nowEl.style.left=elapsed+'%';
    nowEl.style.display='block';
    nowEl.classList.remove('resting');
  }

  elapsedEl.style.width=elapsed+'%';
  // Render scheduled block overlays on the bar
  if(typeof renderBannerBlocks==='function')renderBannerBlocks();
}
