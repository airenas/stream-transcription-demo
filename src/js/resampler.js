export default class AudioResampler {
    constructor(fromRate, toRate) {
        this.fromRate = fromRate;
        this.toRate = toRate;
    }

    // copied from https://github.com/mattdiamond/Recorderjs/issues/186
    downsampleAndConvertToPCM(buffer) {
        if (this.fromRate == this.toRate) {
            return buffer;
        }
        if (this.fromRate < this.toRate) {
            throw "downsampling rate must be smaller than original sample rate";
        }
        var sampleRateRatio = this.fromRate / this.toRate;
        var newLength = Math.round(buffer.length / sampleRateRatio);
        var result = new Int16Array(newLength);
        var offsetResult = 0;
        var offsetBuffer = 0;
        while (offsetResult < result.length) {
            var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            // Use average value of skipped samples
            var accum = 0, count = 0;
            for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = this.toInt16Value(accum / count);
            // Or you can simply get rid of the skipped samples:
            // result[offsetResult] = buffer[nextOffsetBuffer];
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }

    convertToPCM(buffer) {
        const res = new Int16Array(buffer.length);
        for (var i = 0; i < buffer.length; i++) {
            res[i] = this.toInt16Value(buffer[i]);
        }
        return res
    }

    toInt16Value(n) {
        n = n < 0 ? n * 32768 : n * 32767;
        return Math.max(-32768, Math.min(32768, n));
    }
}
