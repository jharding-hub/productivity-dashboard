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
  // Before the early return below: not every page with a bar has the sun
  // cursor on it, and those bars still want the sky.
  applySkyGradient();
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

// ═══════════════════════════════════════════════════════════════════
// REAL-SKY BANNER (opt-in: add ?sky=1 to the URL)
// ═══════════════════════════════════════════════════════════════════
// The banner's default gradient is a fixed, stylised sunrise→dusk wash. This
// paints the *actual* sky instead: the sun's elevation is computed for every
// point across the 5am–8pm window from the date and latitude, so the bar
// darkens at both ends through autumn, and jumps an hour when the clocks
// change. No network call, no API key, no location permission.
//
// Deliberately NOT changed here: the 5am–8pm window itself (TL_START_H/
// TL_END_H). That is a work-day frame, not a daylight frame, and it is baked
// into the hour markers and the scheduled-block overlay maths in three files.
//
// Themed bars keep their own look -- Starry, Galaxy and Storm override
// .day-progress-bar's background on purpose, and a real sky on top of them
// would stop them being themes. Only Dark (no data-theme), Light and Sunny
// get the sky.

var SKY_THEMES=[null,'light','sunny'];

// Representative latitude per IANA zone. Sunrise moves ~1 minute per 12km of
// latitude at mid-latitudes, so a city-level guess is far more precision than
// a 15-hour bar can show. Anything unlisted falls back to its region.
var SKY_TZ_LAT={
  'America/New_York':40.7,'America/Detroit':42.3,'America/Toronto':43.7,
  'America/Chicago':41.9,'America/Winnipeg':49.9,'America/Mexico_City':19.4,
  'America/Denver':39.7,'America/Phoenix':33.4,'America/Edmonton':53.5,
  'America/Los_Angeles':34.1,'America/Vancouver':49.3,'America/Anchorage':61.2,
  'America/Halifax':44.6,'America/St_Johns':47.6,'America/Bogota':4.7,
  'America/Lima':-12.0,'America/Sao_Paulo':-23.5,'America/Argentina/Buenos_Aires':-34.6,
  'America/Santiago':-33.4,'America/Caracas':10.5,'America/Panama':9.0,
  'America/Havana':23.1,'America/Puerto_Rico':18.5,'America/Guatemala':14.6,
  'Pacific/Honolulu':21.3,
  'Europe/London':51.5,'Europe/Dublin':53.3,'Europe/Lisbon':38.7,
  'Europe/Madrid':40.4,'Europe/Paris':48.9,'Europe/Brussels':50.8,
  'Europe/Amsterdam':52.4,'Europe/Berlin':52.5,'Europe/Zurich':47.4,
  'Europe/Rome':41.9,'Europe/Vienna':48.2,'Europe/Prague':50.1,
  'Europe/Warsaw':52.2,'Europe/Stockholm':59.3,'Europe/Oslo':59.9,
  'Europe/Copenhagen':55.7,'Europe/Helsinki':60.2,'Europe/Athens':38.0,
  'Europe/Bucharest':44.4,'Europe/Kyiv':50.5,'Europe/Kiev':50.5,
  'Europe/Moscow':55.8,'Europe/Istanbul':41.0,'Atlantic/Reykjavik':64.1,
  'Asia/Jerusalem':31.8,'Asia/Dubai':25.2,'Asia/Karachi':24.9,
  'Asia/Kolkata':22.6,'Asia/Calcutta':22.6,'Asia/Dhaka':23.8,
  'Asia/Bangkok':13.8,'Asia/Jakarta':-6.2,'Asia/Singapore':1.4,
  'Asia/Manila':14.6,'Asia/Hong_Kong':22.3,'Asia/Shanghai':31.2,
  'Asia/Taipei':25.0,'Asia/Seoul':37.6,'Asia/Tokyo':35.7,
  'Asia/Riyadh':24.7,'Asia/Tehran':35.7,'Asia/Almaty':43.2,
  'Africa/Cairo':30.0,'Africa/Lagos':6.5,'Africa/Nairobi':-1.3,
  'Africa/Johannesburg':-26.2,'Africa/Casablanca':33.6,'Africa/Accra':5.6,
  'Australia/Perth':-31.9,'Australia/Adelaide':-34.9,'Australia/Brisbane':-27.5,
  'Australia/Sydney':-33.9,'Australia/Melbourne':-37.8,'Australia/Hobart':-42.9,
  'Australia/Darwin':-12.5,'Pacific/Auckland':-36.9,'Pacific/Fiji':-18.1
};
var SKY_REGION_LAT={America:40,Europe:50,Asia:30,Africa:5,Australia:-33,Pacific:-15,Atlantic:40,Indian:-10};

function _skyLatitude(){
  var tz='';
  try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){}
  if(SKY_TZ_LAT[tz]!==undefined)return SKY_TZ_LAT[tz];
  var region=tz.split('/')[0];
  if(SKY_REGION_LAT[region]!==undefined)return SKY_REGION_LAT[region];
  return 40;   // mid-northern default: wrong by minutes, never by seasons
}

// Sun elevation in degrees at `minutes` past local midnight. NOAA's general
// solar position equations. Longitude is assumed to be the zone's central
// meridian, which is what makes this work without a location: it can be up to
// ~30 min out at the edge of a wide zone, and is exact at its centre.
// Daylight saving needs no special case -- the gap between the zone's standard
// offset and today's actual offset IS the shift.
function _skyElevation(lat,date,minutes){
  var y=date.getFullYear();
  var stdOffset=-Math.max(new Date(y,0,1).getTimezoneOffset(),new Date(y,6,1).getTimezoneOffset())/60;
  var curOffset=-date.getTimezoneOffset()/60;
  var n=Math.floor((date-new Date(y,0,0))/86400000);
  var hour=minutes/60;
  var g=2*Math.PI/365*(n-1+(hour-12)/24);
  var eqTime=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)
            -0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  var decl=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)
          -0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)
          -0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  var trueSolar=minutes+eqTime+4*(15*stdOffset)-60*curOffset;
  var hourAngle=(trueSolar/4-180)*Math.PI/180;
  var latRad=lat*Math.PI/180;
  var cosZenith=Math.sin(latRad)*Math.sin(decl)
               +Math.cos(latRad)*Math.cos(decl)*Math.cos(hourAngle);
  return 90-Math.acos(Math.max(-1,Math.min(1,cosZenith)))*180/Math.PI;
}

// Elevation → sky colour. The only part of this that is taste rather than
// arithmetic. Anchors run night → astronomical/nautical/civil twilight →
// the horizon oranges around 0° → daytime blue as the sun climbs.
var SKY_RAMP=[[-90,[4,6,14]],[-18,[7,11,28]],[-12,[13,21,51]],[-6,[30,43,94]],
              [-3,[69,65,124]],[-1,[141,86,116]],[-0.5,[200,106,79]],[0,[227,126,60]],
              [3,[242,169,92]],[7,[233,199,141]],[12,[185,204,217]],[20,[142,181,217]],
              [35,[108,164,213]],[50,[80,147,206]],[90,[61,132,199]]];

function _skyColor(elev){
  if(elev<=SKY_RAMP[0][0])elev=SKY_RAMP[0][0];
  for(var i=1;i<SKY_RAMP.length;i++){
    if(elev<=SKY_RAMP[i][0]){
      var a=SKY_RAMP[i-1],b=SKY_RAMP[i];
      var t=(elev-a[0])/(b[0]-a[0]);
      return 'rgb('+Math.round(a[1][0]+(b[1][0]-a[1][0])*t)+','
                   +Math.round(a[1][1]+(b[1][1]-a[1][1])*t)+','
                   +Math.round(a[1][2]+(b[1][2]-a[1][2])*t)+')';
    }
  }
  var last=SKY_RAMP[SKY_RAMP.length-1][1];
  return 'rgb('+last[0]+','+last[1]+','+last[2]+')';
}

// 61 samples at 15-minute steps across the banner window.
function skyGradientFor(lat,date){
  var startMin=TL_START_H*60,endMin=TL_END_H*60,steps=60,stops=[];
  for(var i=0;i<=steps;i++){
    var m=startMin+(endMin-startMin)*i/steps;
    stops.push(_skyColor(_skyElevation(lat,date,m))+' '+(i/steps*100).toFixed(2)+'%');
  }
  return 'linear-gradient(to right,'+stops.join(',')+')';
}

function _skyEnabled(){
  try{ return new URLSearchParams(location.search).get('sky')==='1'; }
  catch(e){ return false; }
}

var _skyCacheKey='',_skyCacheValue='';

// Global -- legacy.js's applyTheme() calls this typeof-guarded when the theme
// changes, and updateDayProgress() calls it on every tick (the gradient itself
// is only recomputed when the day or the theme actually changes).
function applySkyGradient(){
  var bars=document.querySelectorAll('.day-progress-bar');
  if(!bars.length)return;
  var theme=document.body?document.body.getAttribute('data-theme'):null;
  if(!_skyEnabled()||SKY_THEMES.indexOf(theme)<0){
    // Hand the bar back to the stylesheet -- a theme that paints its own bar
    // must not be left wearing an inline sky from before the switch.
    for(var j=0;j<bars.length;j++)bars[j].style.background='';
    _skyCacheKey='';
    return;
  }
  var now=new Date();
  var lat=_skyLatitude();
  var key=now.getFullYear()+'-'+now.getMonth()+'-'+now.getDate()+'|'+lat;
  if(key!==_skyCacheKey){
    _skyCacheKey=key;
    _skyCacheValue=skyGradientFor(lat,now);
  }
  for(var i=0;i<bars.length;i++)bars[i].style.background=_skyCacheValue;
}
