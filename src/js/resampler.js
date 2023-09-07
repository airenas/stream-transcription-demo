export default class AudioResampler {
  constructor (fromRate, toRate) {
    this.fromRate = fromRate
    this.toRate = toRate
  }

  // copied from https://github.com/mattdiamond/Recorderjs/issues/186
  downsampleAndConvertToPCM (buffer) {
    if (this.fromRate === this.toRate) {
      return buffer
    }
    if (this.fromRate < this.toRate) {
      throw new Error('downsampling rate must be smaller than original sample rate')
    }
    const sampleRateRatio = this.fromRate / this.toRate
    const newLength = Math.round(buffer.length / sampleRateRatio)
    const result = new Int16Array(newLength)
    let offsetResult = 0
    let offsetBuffer = 0
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
      // Use average value of skipped samples
      let accum = 0; let count = 0
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i]
        count++
      }
      result[offsetResult] = this.toInt16Value(accum / count)
      // Or you can simply get rid of the skipped samples:
      // result[offsetResult] = buffer[nextOffsetBuffer];
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    return result
  }

  convertToPCM (buffer) {
    const res = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      res[i] = this.toInt16Value(buffer[i])
    }
    return res
  }

  toInt16Value (n) {
    n = n < 0 ? n * 32768 : n * 32767
    return Math.max(-32768, Math.min(32768, n))
  }
}
