// copied amd updated from https://github.com/Kaljurand/dictate.js/blob/master/lib/dictate.js

// Server status codes
// from https://github.com/alumae/kaldi-gstreamer-server
const SERVER_STATUS_CODE = {
  0: 'Success', // Usually used when recognition results are sent
  1: 'No speech', // Incoming audio contained a large portion of silence or non-speech
  2: 'Aborted', // Recognition was aborted for some reason
  9: 'No available' // Recognizer processes are currently in use and recognition cannot be performed
}

const ERR_NETWORK = 2
// const ERR_AUDIO = 3
const ERR_SERVER = 4
const ERR_CLIENT = 5

const MSG_SEND = 5
const MSG_SEND_EMPTY = 6
const MSG_SEND_EOS = 7
const MSG_WEB_SOCKET = 8
const MSG_WEB_SOCKET_OPEN = 9
const MSG_WEB_SOCKET_CLOSE = 10
// const MSG_STOP = 11
// const MSG_SERVER_CHANGED = 12
// const MSG_AUDIOCONTEXT_RESUMED = 13

export class Config {
  constructor () {
    this.server = 'ws://localhost:8082/client/ws/speech'
    this.statusServer = 'ws://localhost:8082/client/ws/status'
    this.sampleRate = 16000
    this.contentType = 'content-type=audio/x-raw,+layout=(string)interleaved,+rate=(int)16000,+format=(string)S16LE,+channels=(int)1'
    this.onError = (et, e) => { console.error(et, e) }
    this.onReadyForSpeech = () => { console.log('onReadyForSpeech') }
    this.onEndOfSpeech = () => { console.log('onEndOfSpeech') }
    this.onPartialResults = (data) => { console.log('onPartialResults ' + data) }
    this.onResults = (data) => { console.log('onResults ' + data) }
    this.onServerStatus = (data) => { console.log('onServerStatus ' + data) }
    this.onEndOfSession = () => { console.log('onEndOfSession') }
    this.onEvent = (e, data) => { console.log('onEvent ' + e) }
    this.rafCallback = (time) => { console.log('rafCallback') }
  }
}

export class RTTranscriber {
  constructor (cfg) {
    this.config = cfg || {}
    this.ws = null
    this.statusReconnectInterval = 1000
    createStatusWebSocket(this)
  }

  sendAudio (pcmData) {
    console.debug('sendAudio ' + pcmData.length)
    this.socketSend(pcmData)
  }

  init () {
    this.ws = this.createWebSocket()
  }

  createWebSocket () {
    const url = this.config.server + '?' + this.config.contentType
    console.log('open url ' + url)
    const ws = new WebSocket(url)
    const config = this.config
    const self = this

    ws.onmessage = function (e) {
      console.debug('on message')
      const data = e.data
      config.onEvent(MSG_WEB_SOCKET, data)
      if (data instanceof Object && !(data instanceof Blob)) {
        config.onError(ERR_SERVER, 'WebSocket: onEvent: got Object that is not a Blob')
      } else if (data instanceof Blob) {
        config.onError(ERR_SERVER, 'WebSocket: got Blob')
      } else {
        const res = JSON.parse(data)
        if (res.status === 0) {
          if (res.result) {
            if (res.result.final) {
              config.onResults(res.result.hypotheses)
            } else {
              config.onPartialResults(res.result.hypotheses)
            }
          }
        } else {
          config.onError(ERR_SERVER, 'Server error: ' + res.status + ': ' + self.getDescription(res.status))
        }
      }
    }

    // Start recording only if the socket becomes open
    ws.onopen = function (e) {
      console.log('on open')
      config.onReadyForSpeech()
      config.onEvent(MSG_WEB_SOCKET_OPEN, e)
    }

    ws.onclose = function (e) {
      console.log('on close')
      config.onEndOfSession()
      config.onEvent(MSG_WEB_SOCKET_CLOSE, e.code + '/' + e.reason + '/' + e.wasClean)
    }

    ws.onerror = function (e) {
      console.log('on error')
      const data = e.data
      config.onError(ERR_NETWORK, data)
    }
    console.log('exit ws create')
    return ws
  }

  getDescription (code) {
    if (code in SERVER_STATUS_CODE) {
      return SERVER_STATUS_CODE[code]
    }
    return 'Unknown error'
  }

  socketSend (item) {
    if (this.ws) {
      const state = this.ws.readyState
      if (state === 1) {
        // If item is an audio blob
        if (item instanceof Blob) {
          if (item.size > 0) {
            this.ws.send(item)
            this.config.onEvent(MSG_SEND, 'Send: blob: ' + item.type + ', ' + item.size)
          } else {
            this.config.onEvent(MSG_SEND_EMPTY, 'Send: blob: ' + item.type + ', EMPTY')
          }
          // Otherwise it's the EOS tag (string)
        } else {
          this.ws.send(item)
          this.config.onEvent(MSG_SEND_EOS, 'Send tag: ' + item)
        }
      } else {
        this.config.onError(ERR_NETWORK, 'WebSocket: readyState!=1: ' + state + ': failed to send: ' + item)
      }
    } else {
      this.config.onError(ERR_CLIENT, 'No web socket connection: failed to send: ' + item)
    }
  }

  stop () {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

function createStatusWebSocket (self) {
  const ws = new WebSocket(self.config.statusServer)
  ws.onmessage = function (evt) {
    self.config.onServerStatus(JSON.parse(evt.data))
  }

  ws.onopen = (event) => {
    self.statusReconnectInterval = 1000
  }

  ws.onclose = (event) => {
    setTimeout(createStatusWebSocket, self.statusReconnectInterval, self)
    self.statusReconnectInterval = Math.min(self.statusReconnectInterval * 2, 30000)
  }

  ws.onerror = () => {
    self.config.onServerStatus({ num_workers_available: 0 })
  }
}
