var visualizations = {};
var currentVisualization;
var allConnections = [];
// FIXME: Read this from config file
var uploadServer = 'http://collusiondb-development.herokuapp.com/shareData';
var uploadTimer;
var saveTimer;

// Constants for indexes of properties in array format
const SOURCE = 0;
const TARGET = 1;
const TIMESTAMP = 2;
const CONTENT_TYPE = 3;
const COOKIE = 4;
const SOURCE_VISITED = 5;
const SECURE = 6;
const SOURCE_PATH_DEPTH = 7;
const SOURCE_QUERY_DEPTH = 8;
const SOURCE_SUB = 9;
const TARGET_SUB = 10;
const METHOD = 11;
const STATUS = 12;
const CACHEABLE = 13;
const FROM_PRIVATE_MODE = 14;

window.addEventListener('load', function(evt){
    addon.emit("privateWindowCheck");
    // Wire up events
    document.querySelector('.btn_group.visualization').click();
    document.querySelector('[data-value=' + (localStorage.visualization || 'Graph') + ']').click();
    if ( localStorage.userHasOptedIntoSharing && localStorage.userHasOptedIntoSharing === 'true' ){
        startUploadTimer();
    }
    saveTimer = setInterval(saveConnections, 5 * 60 * 1000); // save to localStorage every 5 minutes
});


window.addEventListener('beforeunload', function(){
    saveConnections(allConnections);
}, false);


addon.on("isPrivateWindow", function(isPrivate){
    if ( !localStorage.privateBrowsingMsgShown ){
        if ( isPrivate ){
            alert("You've launched Collusion in a Private Browsing Window. Data collected under Private Browsing Windows will not be perserved or stored. It will not appear again once the Window is close.");
        }else{
            alert("Data collected under Private Browsing Windows will not be perserved or stored. It will not appear again once the Collusion tab is close.");
        }
    }
    
    localStorage.privateBrowsingMsgShown = true;
});

function initCap(str){
    return str[0].toUpperCase() + str.slice(1);
}


function switchVisualization(name){
    console.log('switchVisualizations(' + name + ')');
    saveConnections(allConnections);
    if (currentVisualization){
        if (currentVisualization === visualizations[name]) return;
        currentVisualization.emit('remove');
    }
    localStorage.visualization = initCap(name);
    currentVisualization = visualizations[name];
//    currentVisualization.emit('setFilter');
    resetAddtionalUI();
    
    addon.emit('uiready');
}


function resetAddtionalUI(){
    // toggle off info panel, settings page, help bubbles
    document.querySelector("#content").classList.remove("showinfo");
    document.querySelector(".settings-page").classList.add("hide");
    clearAllBubbles();
    // show vizcanvas again in case it is hidden
    document.querySelector(".vizcanvas").classList.remove("hide");
}


/****************************************
*   Save connections
*/
function saveConnections(){
    var lastSaved = localStorage.lastSaved || 0;
    var unSavedNonPrivateConn = excludePrivateConnection(allConnections).filter(function(connection){
        return ( connection[TIMESTAMP] > lastSaved);
    });
    if ( unSavedNonPrivateConn.length > 0 ){
        splitByDate(unSavedNonPrivateConn);
    }
    localStorage.lastSaved = Date.now();
    localStorage.totalNumConnections = allConnections.length;
}


function splitByDate(connections){
    for ( var i=0; i<connections.length; i++ ){
        var conn = connections[i];
        var key = dateAsKey( conn[TIMESTAMP] );
        if ( !localStorage.getItem(key) ){
            localStorage.dates = localStorage.dates ? (localStorage.dates + "," + key) : key;
            localStorage.setItem(key, "[" + JSON.stringify(conn) + "]");
        }else{
            localStorage.setItem(key, localStorage.getItem(key).slice(0,-1) + "," + JSON.stringify(conn) + "]");
        }
    }
}


function dateAsKey(timestamp){
    //timestamp in UNIX
    var date = new Date(timestamp);
    var yyyy = date.getFullYear();
    var mm = "00" + ( date.getMonth()+1 );
    var dd = "00" + date.getDate();
    return yyyy + "-" + mm.substr(-2,2) + "-" + dd.substr(-2,2);
}


/****************************************
*   Upload data
*/

function startSharing(){
    if (confirm('You are about to start uploading anonymized data to the Mozilla Collusion server. ' +
                'Your data will continue to be uploaded periodically until you turn off sharing. ' +
                'For more information about the data we upload, how it is anonymized, and what Mozilla\'s ' +
                'privacy policies are, please visit http://ItsOurData.com/privacy/.\n\nBy clicking Okay ' +
                'you are agreeing to share your data under those terms.')){
        sharingData();
        uploadButton.innerHTML = 'Stop Sharing';
        localStorage.userHasOptedIntoSharing = true;
    }
}

function stopSharing(){
    if (confirm('You are about to stop sharing data with the Mozilla Collusion server.\n\n' +
                    'By clicking Okay you will no longer be uploading data.')){
        uploadButton.innerHTML = '<i class="icon-arrow-up"></i>Share Data';
        localStorage.userHasOptedIntoSharing = false;
        if (uploadTimer){
            clearTimeout(uploadTimer);
            uploadTimer = null;
        }
    }
}

function sharingData(){
    console.log("Beginning Upload...");
    var lastUpload = localStorage.lastUpload || 0;
    var connections = allConnections.filter(function(connection){
        return ( connection[TIMESTAMP] ) > lastUpload;
    });
    var data = exportFormat(connections);
    var request = new XMLHttpRequest();
    request.open("POST", uploadServer, true);
    request.setRequestHeader("Collusion-Share-Data","collusion");
    request.setRequestHeader("Content-type","application/json");
    request.send(data);
    request.onload = function(){
        console.log(this.responseText);
        if (this.status === 200){
            localStorage.lastUpload = Date.now();
        }
    };
    request.onerror = function(){
        console.log("Share data attempt failed.");
    };
    startUploadTimer();
}

function startUploadTimer(){
    uploadTimer = setTimeout(sharingData, 10 * 60 * 1000); // upload every 10 minutes
}
