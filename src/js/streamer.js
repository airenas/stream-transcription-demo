import AudioResampler from "./resampler";
import {Config, RTTranscriber} from "./transcriber";
import videojs from "video.js";


const options = {sampleRate: 16000};

window.addEventListener('error', function (event) {
    console.error('An error occurred:', event.error.message);
});

document.addEventListener("DOMContentLoaded", function () {
    const pageData = {};
    pageData.recording = false;
    pageData.debugVisible = true;
    pageData.startButton = document.getElementById("start-button");
    pageData.stopButton = document.getElementById("stop-button");
    pageData.player = null;
    pageData.source = null;
    pageData.transcriberReady = false;
    
    pageData.res = []
    pageData.partials = ""
    pageData.resultArea = document.getElementById("result-area");
    
    
    pageData.video = document.getElementById("video");
    const inputElement = document.getElementById("stream-url");
    
    var capturer = null;
    var audioContext = null;
    var doUpper = true;
    var doPrependSpace = true;
    pageData.workers = 0;
    
    pageData.infoArea = document.getElementById("info-area");
    pageData.infos = []
    initPanel(pageData);

    const addMsg = (is_error, msg) => {
        if (is_error) {
            pageData.debugVisible = true; 
        }
        pageData.infos.push({err:is_error, msg: msg})
        updateInfo(pageData)
    }

    const cfg = new Config();
    cfg.onPartialResults = (data) => {
        console.log("onPartialResults " + data);
        var hypText = prettyfyHyp(data[0].transcript, doUpper, doPrependSpace);
        console.log(hypText);
        pageData.partials = hypText;
        updateRes(pageData);
    };
    cfg.onResults = (data) => {
        console.log("onResults " + data);
        var hypText = prettyfyHyp(data[0].transcript, doUpper, doPrependSpace);
        console.log(hypText);
        pageData.res.push(hypText);
        pageData.partials = "";
        updateRes(pageData);
    };
    cfg.onEvent = (e, data) => {
        //console.log("onEvent " + data);
        //infos.push({err:false, msg: e})
        //updateInfo(infoArea, infos)
    };
    cfg.onServerStatus = (data) => {
        pageData.workers = data.num_workers_available;
        console.log("onStatusEvent " + pageData.workers);
        addMsg(false, `Workers available: ${pageData.workers}`)
        updateInfo(pageData)
        updateComponents(pageData);
    };
    cfg.onReadyForSpeech = () => {
        pageData.transcriberReady = true;
        addMsg(false, `Ready for speech`)
    };
    cfg.onEndOfSpeech = () => {
        pageData.transcriberReady = false;
        addMsg(false, `Stop speech`)
        stop(pageData);
    };
    cfg.onEndOfSession = () => {
        pageData.transcriberReady = false;
        addMsg(false, `Stop speech`)
        stop(pageData);
    };
    cfg.onError = (et, data) => {
        pageData.transcriberReady = false;
        addMsg(true, `Error ${et}`)
        stop(pageData);
    };

    addMsg(false, "Waiting for server ready ...");

    pageData.transcriber = new RTTranscriber(cfg);
    
    pageData.video.style.display = "none";
    
    updateComponents(pageData);
    
    pageData.startButton.addEventListener("click", function () {
        console.log("start");
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            if (pageData.video.src === "") {
                const sourceElement = document.createElement("source");
                sourceElement.type = "application/x-mpegURL";
                sourceElement.src = inputElement.value;
                pageData.video.appendChild(sourceElement);
                if (!pageData.player) {
                    pageData.player = videojs("video", {
                        suppressNotSupportedError: false,
                        errorDisplay: true
                    });
                    pageData.player.on('error', (e) => {
                        addMsg(true, `Can't play: ${inputElement.value}`);
                        stop(pageData);
                    });
                } 
            } else if (pageData.video.src.source !== inputElement.value) {
                console.error(`Change url ${inputElement.value}`);
                pageData.player.src({ type: 'application/x-mpegURL', src: inputElement.value });
            }

            pageData.source = audioContext.createMediaElementSource(pageData.video);
            pageData.source.connect(audioContext.destination);
        
            
            var bufferSize = 1024 * 8;
            capturer = audioContext.createScriptProcessor(bufferSize, 1, 1);
            pageData.source.connect(capturer);
            var resampler = new AudioResampler(audioContext.sampleRate, options.sampleRate);
            var initialized = false;

            
            capturer.onaudioprocess = function (e) {
                var buffer = e.inputBuffer.getChannelData(0);
                if (buffer.length > 0 && pageData.transcriberReady) {
                    const pcmData = resampler.downsampleAndConvertToPCM(buffer);
                    pageData.transcriber.sendAudio(pcmData);
                }
                if (!pageData.transcriberReady && !initialized) {
                    initialized = true;
                    pageData.transcriber.init();
                    if (pageData.res.length > 0) {
                        pageData.res.push("------------");
                    }
                    pageData.partials = "";
                    updateRes(pageData);
                }
            }
            pageData.player.play();
            pageData.recording = true;
            updateComponents(pageData);
        } catch (error) {
            console.error(error)
            addMsg(true, `Can't play ${inputElement.value}`);
            stop(pageData);
            return;
        }
    });

    pageData.stopButton.addEventListener("click", function () {
        console.log("stop");
        stop(pageData);
    });
});

function stop(pageData) {
    pageData.recording = false;
    pageData.source.disconnect();
    if (pageData.player) {
        pageData.player.pause();
    }
    pageData.transcriber.stop();
    pageData.transcriberReady = false;
    updateComponents(pageData);
};

function initPanel(pageData) {
    const panelHeader = document.getElementById("info-header");
    
    panelHeader.addEventListener('click', () => {
        pageData.debugVisible = !pageData.debugVisible;
        updateInfo(pageData);
    });
}

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function prettyfyHyp(text, doCapFirst, doPrependSpace) {
	if (doCapFirst) {
		text = capitaliseFirstLetter(text);
	}
	const tokens = text.split(" ");
	text = "";
	if (doPrependSpace) {
		text = " ";
	}
	var doCapitalizeNext = false;
	tokens.map(function(token) {
		if (text.trim().length > 0) {
			text = text + " ";
		}
		if (doCapitalizeNext) {
			text = text + capitaliseFirstLetter(token);
		} else {
			text = text + token;
		}
		if (token == "." ||  /\n$/.test(token)) {							
			doCapitalizeNext = true;
		} else {
			doCapitalizeNext = false;
		}						
	});
	
	text = text.replace(/ ([,.!?:;])/g,  "\$1");
	text = text.replace(/ ?\n ?/g,  "\n");
	text = text.replace(/_/g,  " ");
	return text;
}

function updateRes(pageData) {
	while (pageData.res.length > 3) {
        pageData.res.shift();
    }
    var html = ''
    pageData.res.forEach(( s, index ) => {
        const div = `<div class="res-div">${s}</div>`;
        html += div;
    });
    html += `<div class="partial-div">${pageData.partials}</div>`;
    pageData.resultArea.innerHTML = html;    
}

function updateInfo(pageData) {
	if (pageData.debugVisible) {
        pageData.infoArea.style.display = "inline-block";
    } else {
        pageData.infoArea.style.display = "none";
    }
    while (pageData.infos.length > 7) {
        pageData.infos.shift();
    }
    var html = ''
    pageData.infos.forEach(( s, index ) => {
        var cl = "panel-content";
        if (s.err) {
            cl = "panel-content-error";
        }
        const div = `<div class="${cl}">${s.msg}</div>`;
        html += div;
    });
    pageData.infoArea.innerHTML = html;    
}

function updateComponents(pageData) {
	pageData.startButton.disabled = pageData.workers == 0;
    if (pageData.recording) {
        pageData.startButton.style.display = "none";
        pageData.stopButton.style.display = "inline-block";
    } else {
        pageData.stopButton.style.display = "none";
        pageData.startButton.style.display = "inline-block";
    }
}

