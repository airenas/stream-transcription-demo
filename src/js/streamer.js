import AudioResampler from './resampler'
import { Config, RTTranscriber } from './transcriber'
import videojs from 'video.js'

const version = process.env.BUILD_VERSION
console.log(`Version: ${version}`)

window.addEventListener('error', function (event) {
  console.error('An error occurred:', event.error.message)
})

document.addEventListener('DOMContentLoaded', function () {
  const divElement = document.getElementById('transcriber')
  const kaldiUrl = (divElement.getAttribute('kaldi_url') ?? '').trim().replace(/[/]*$/g, '')

  const pageData = {}
  pageData.recording = false
  pageData.debugVisible = true
  pageData.resVisible = true
  pageData.startButton = document.getElementById('start-button')
  pageData.stopButton = document.getElementById('stop-button')
  pageData.player = null
  pageData.source = null
  pageData.transcriberReady = false

  pageData.res = []
  pageData.partials = ''
  pageData.resultArea = document.getElementById('result-area')
  pageData.resultLine = document.getElementById('result-line')

  pageData.video = document.getElementById('video')
  const inputElement = document.getElementById('stream-url')

  const doUpper = false
  const doPrependSpace = false
  pageData.workers = 0

  pageData.infoArea = document.getElementById('info-area')
  pageData.infos = []
  initPanel(pageData)

  const addMsg = (isError, msg) => {
    if (isError) {
      pageData.debugVisible = true
    }
    pageData.infos.push({ err: isError, msg })
    updateInfo(pageData)
  }

  const cfg = new Config()
  cfg.server = kaldiUrl + '/speech'
  cfg.statusServer = kaldiUrl + '/status'
  cfg.sampleRate = 16000
  cfg.onPartialResults = (data) => {
    const hypText = prettyfyHyp(data[0].transcript, doUpper, doPrependSpace)
    pageData.partials = hypText
    updateRes(pageData)
  }
  cfg.onResults = (data) => {
    const hypText = prettyfyHyp(data[0].transcript, doUpper, doPrependSpace)
    pageData.res.push(hypText)
    pageData.partials = ''
    updateRes(pageData)
  }
  cfg.onEvent = (e, data) => {
    // console.log("onEvent " + data);
    // infos.push({err:false, msg: e})
    // updateInfo(infoArea, infos)
  }
  cfg.onServerStatus = (data) => {
    pageData.workers = data.num_workers_available
    console.log('onStatusEvent ' + pageData.workers)
    addMsg(false, `Workers available: ${pageData.workers}`)
    updateInfo(pageData)
    updateComponents(pageData)
  }
  cfg.onReadyForSpeech = () => {
    pageData.transcriberReady = true
    addMsg(false, 'Ready for speech')
  }
  cfg.onEndOfSpeech = () => {
    pageData.transcriberReady = false
    addMsg(false, 'Stop speech')
    stop(pageData)
  }
  cfg.onEndOfSession = () => {
    pageData.transcriberReady = false
    addMsg(false, 'Stop speech')
    stop(pageData)
  }
  cfg.onError = (et, data) => {
    pageData.transcriberReady = false
    addMsg(true, `Error ${et}`)
    stop(pageData)
  }

  addMsg(false, `Kaldi URL: ${cfg.server}`)
  addMsg(false, 'Waiting for server ready ...')

  pageData.transcriber = new RTTranscriber(cfg)

  pageData.video.style.display = 'none'

  updateComponents(pageData)

  pageData.startButton.addEventListener('click', async function () {
    console.log('start')
    const url = inputElement.value
    try {
      if (!pageData.audioContext) {
        pageData.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      }

      if (pageData.video.src === '') {
        const sourceElement = document.createElement('source')
        sourceElement.type = 'application/x-mpegURL'
        sourceElement.src = url
        pageData.video.appendChild(sourceElement)
        if (!pageData.player) {
          pageData.player = videojs('video', {
            suppressNotSupportedError: false,
            errorDisplay: true
          })
          pageData.player.on('error', (e) => {
            addMsg(true, `Can't play: ${url}`)
            pageData.url = ''
            stop(pageData)
          })
        }
        pageData.source = pageData.audioContext.createMediaElementSource(pageData.video)
      } else if (pageData.url !== url) {
        console.error(`Change url to ${url}`)
        pageData.player.src({ type: 'application/x-mpegURL', src: url })
      }

      const scriptPath = new URL('audio-processor.js', import.meta.url)
      await pageData.audioContext.audioWorklet.addModule(scriptPath.href)
      pageData.workletNode = new AudioWorkletNode(pageData.audioContext, 'streamer-audio-processor', { processorOptions: { sampleRate: pageData.audioContext.sampleRate, bufferInSec: 0.25 } })

      pageData.source.connect(pageData.audioContext.destination)
      pageData.source.connect(pageData.workletNode)
      const resampler = new AudioResampler(pageData.audioContext.sampleRate, cfg.sampleRate)
      let initialized = false

      pageData.workletNode.port.onmessage = (event) => {
        console.debug('Received worklet event')
        if (event.data.type === 'audioData') {
          const buffer = event.data.data
          if (buffer.length > 0 && pageData.transcriberReady) {
            const pcmData = resampler.downsampleAndConvertToPCM(buffer)
            pageData.transcriber.sendAudio(pcmData)
          }
          if (!pageData.transcriberReady && !initialized) {
            initialized = true
            pageData.res = []
            pageData.partials = ''
            pageData.transcriber.init()
            updateRes(pageData)
          }
        }
      }

      pageData.url = url
      pageData.player.play()
      pageData.recording = true
      updateComponents(pageData)
    } catch (error) {
      console.error(error)
      addMsg(true, `Can't play ${url}`)
      stop(pageData)
      pageData.url = ''
    }
  })

  pageData.stopButton.addEventListener('click', function () {
    console.log('stop')
    stop(pageData)
    // const bbf = bf.reduce((acc, ca) => { return acc.concat(Array.from(ca)) }, [])
    // const data = encodeWAV(bbf, 44100)
    // const blob = new Blob([data], { type: 'audio/wav' })
    // const downloadLink = document.createElement('a')
    // downloadLink.href = URL.createObjectURL(blob)
    // downloadLink.download = 'audio.wav'
    // downloadLink.textContent = 'Download WAV'
    // document.body.appendChild(downloadLink)
  })
})

function stop (pageData) {
  pageData.recording = false
  if (pageData.player) {
    pageData.player.pause()
    // pageData.player.dispose()
    // pageData.player = null
  }
  if (pageData.video) {
    pageData.video.pause()
  }
  if (pageData.source) {
    pageData.source.disconnect()
    // pageData.source = null
  }
  if (pageData.workletNode) {
    pageData.workletNode.disconnect()
    pageData.workletNode.port.close()
    pageData.workletNode = null
  }
  pageData.transcriberReady = false
  pageData.transcriber.stop()
  updateComponents(pageData)
};

function initPanel (pageData) {
  const panelHeader = document.getElementById('info-header')

  panelHeader.addEventListener('click', () => {
    pageData.debugVisible = !pageData.debugVisible
    updateInfo(pageData)
  })
  const resHeader = document.getElementById('res-header')

  resHeader.addEventListener('click', () => {
    pageData.resVisible = !pageData.resVisible
    updateRes(pageData)
  })
}

function capitaliseFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

function prettyfyHyp (text, doCapFirst, doPrependSpace) {
  if (doCapFirst) {
    text = capitaliseFirstLetter(text)
  }
  const tokens = text.split(' ')
  text = ''
  if (doPrependSpace) {
    text = ' '
  }
  let doCapitalizeNext = false
  tokens.forEach(function (token) {
    if (text.trim().length > 0) {
      text = text + ' '
    }
    if (doCapitalizeNext) {
      text = text + capitaliseFirstLetter(token)
    } else {
      text = text + token
    }
    if (token === '.' || /\n$/.test(token)) {
      doCapitalizeNext = true
    } else {
      doCapitalizeNext = false
    }
  })

  text = text.replace(/ ([,.!?:;])/g, '$1')
  text = text.replace(/ ?\n ?/g, '\n')
  text = text.replace(/_/g, ' ')
  return text
}

function updateRes (pageData) {
  if (pageData.resVisible) {
    pageData.resultArea.style.display = 'inline-block'
  } else {
    pageData.resultArea.style.display = 'none'
  }
  while (pageData.res.length > 3) {
    pageData.res.shift()
  }
  let html = ''
  pageData.res.forEach((s, index) => {
    const div = `<div class="res-div">${s}</div>`
    html += div
  })
  html += `<div class="partial-div">${pageData.partials}</div>`
  pageData.resultArea.innerHTML = html
  pageData.resultLine.innerHTML = makeString(pageData)
}

function makeString (pageData) {
  let res = pageData.res.join(' ') + ' ' + pageData.partials
  if (res.length > 150) {
    res = res.slice(-150)
  }
  return res
}

function updateInfo (pageData) {
  if (pageData.debugVisible) {
    pageData.infoArea.style.display = 'inline-block'
  } else {
    pageData.infoArea.style.display = 'none'
  }
  while (pageData.infos.length > 7) {
    pageData.infos.shift()
  }
  let html = ''
  pageData.infos.forEach((s, index) => {
    let cl = 'panel-content'
    if (s.err) {
      cl = 'panel-content-error'
    }
    const div = `<div class="${cl}">${s.msg}</div>`
    html += div
  })
  pageData.infoArea.innerHTML = html
}

function updateComponents (pageData) {
  pageData.startButton.disabled = pageData.workers === 0
  if (pageData.recording) {
    pageData.startButton.style.display = 'none'
    pageData.stopButton.style.display = 'inline-block'
  } else {
    pageData.stopButton.style.display = 'none'
    pageData.startButton.style.display = 'inline-block'
  }
}

// function floatTo16BitPCM (output, offset, input) {
//   for (let i = 0; i < input.length; i++, offset += 2) {
//     const s = Math.max(-1, Math.min(1, input[i]))
//     output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
//   }
// }

// function writeString (view, offset, string) {
//   for (let i = 0; i < string.length; i++) {
//     view.setUint8(offset + i, string.charCodeAt(i))
//   }
// }

// function encodeWAV (samples, sampleRate) {
//   const buffer = new ArrayBuffer(44 + samples.length * 2)
//   const view = new DataView(buffer)

//   /* RIFF identifier */
//   writeString(view, 0, 'RIFF')
//   /* file length */
//   view.setUint32(4, 32 + samples.length * 2, true)
//   /* RIFF type */
//   writeString(view, 8, 'WAVE')
//   /* format chunk identifier */
//   writeString(view, 12, 'fmt ')
//   /* format chunk length */
//   view.setUint32(16, 16, true)
//   /* sample format (raw) */
//   view.setUint16(20, 1, true)
//   /* channel count */
//   view.setUint16(22, 1, true)
//   /* sample rate */
//   view.setUint32(24, sampleRate, true)
//   /* byte rate (sample rate * block align) */
//   view.setUint32(28, sampleRate * 4, true)
//   /* block align (channel count * bytes per sample) */
//   view.setUint16(32, 4, true)
//   /* bits per sample */
//   view.setUint16(34, 16, true)
//   /* data chunk identifier */
//   writeString(view, 36, 'data')
//   /* data chunk length */
//   view.setUint32(40, samples.length * 2, true)

//   floatTo16BitPCM(view, 44, samples)

//   return view
// }
