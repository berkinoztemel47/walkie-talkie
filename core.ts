/**
 * Walkie Talkie - micro:bit V2
 * Mikrofon ses seviyesini örnekler, belleğe kaydeder, PWM ile çalar.
 * Gönderme/alma taşıması radio.ts (radyo) veya bluetooth.ts (BLE UART) içindedir.
 */
//% weight=100 color=#E8590C icon="\uf2a0" block="Walkie Talkie"
//% groups=['Settings','Record','Play','Send','Receive','Live']
namespace walkie {
    export const CHUNK = 16
    export const MAX = 6000

    export let sampleHz = 1000
    export let toneHz = 300
    export let gate = 20
    export let vol = 2
    export let rec: Buffer = pins.createBuffer(MAX)
    export let recLen = 0
    export let liveRunning = false
    export let listening = false
    export let livePin: AnalogPin = AnalogPin.P0
    export let onRecv: () => void = null
    let playLock = false

    // ---------- Settings ----------

    /** Örnekleme hızı (Hz). Yüksek = daha detaylı ama daha az kayıt süresi */
    //% block="set sample rate to %hz Hz"
    //% hz.min=500 hz.max=4000 hz.defl=1000
    //% group="Settings" weight=100
    export function setSampleRate(hz: number): void {
        sampleHz = Math.max(500, Math.min(4000, hz))
    }

    /** Çalarken kullanılan taşıyıcı ses perdesi (Hz) */
    //% block="set playback pitch to %hz Hz"
    //% hz.min=100 hz.max=2000 hz.defl=300
    //% group="Settings" weight=90
    export function setPitch(hz: number): void {
        toneHz = Math.max(100, Math.min(2000, hz))
    }

    /** Bu seviyenin altındaki sesler sessizlik sayılır (gürültü kapısı) */
    //% block="set noise gate to %level"
    //% level.min=0 level.max=255 level.defl=20
    //% group="Settings" weight=80
    export function setNoiseGate(level: number): void {
        gate = Math.max(0, Math.min(255, level))
    }

    /** Çalma ses şiddeti 1-4 */
    //% block="set volume to %v"
    //% v.min=1 v.max=4 v.defl=2
    //% group="Settings" weight=70
    export function setVolume(v: number): void {
        vol = Math.max(1, Math.min(4, v))
    }

    // ---------- Record ----------

    /** Mikrofondan belirtilen süre (ms) kaydeder. Maks ~6000 örnek. */
    //% block="record microphone for %ms ms"
    //% ms.min=100 ms.max=6000 ms.defl=3000
    //% group="Record" weight=100
    export function record(ms: number): void {
        const n = Math.min(MAX, Math.idiv(ms * sampleHz, 1000))
        const per = Math.idiv(1000000, sampleHz)
        for (let i = 0; i < n; i++) {
            const t = control.micros()
            rec[i] = input.soundLevel()
            const rest = per - (control.micros() - t)
            if (rest > 0) control.waitMicros(rest)
        }
        recLen = n
    }

    /** Kaydı siler */
    //% block="clear recording"
    //% group="Record" weight=90
    export function clearRecording(): void {
        rec.fill(0)
        recLen = 0
    }

    /** Kaydın uzunluğu (milisaniye) */
    //% block="recording length (ms)"
    //% group="Record" weight=80
    export function recordingMs(): number {
        return Math.idiv(recLen * 1000, sampleHz)
    }

    // ---------- Play ----------

    /** Kaydı seçilen pinde PWM ile çalar (hoparlör/buzzer bağla) */
    //% block="play recording on %pin"
    //% pin.defl=AnalogPin.P0
    //% group="Play" weight=100
    export function play(pin: AnalogPin): void {
        setRecordingPlaybackState(true)
        playSamples(pin, rec, 0, recLen)
        setRecordingPlaybackState(false)
    }

    export function playSamples(pin: AnalogPin, buf: Buffer, start: number, len: number): void {
        pins.analogSetPeriod(pin, Math.idiv(1000000, toneHz))
        const per = Math.idiv(1000000, sampleHz)
        for (let i = 0; i < len; i++) {
            const t = control.micros()
            const v = buf[start + i]
            pins.analogWritePin(pin, v < gate ? 0 : Math.min(1000, v * vol))
            const rest = per - (control.micros() - t)
            if (rest > 0) control.waitMicros(rest)
        }
        pins.analogWritePin(pin, 0)
    }

    // ---------- Send ----------

    /** Kaydı karşı tarafa gönderir (radyo veya bluetooth sürümüne göre) */
    //% block="send recording"
    //% group="Send" weight=100
    export function sendRecording(): void {
        transportInit()
        const n = Math.idiv(recLen + CHUNK - 1, CHUNK)
        for (let s = 0; s < n; s++) {
            transportSendChunk(s, rec.slice(s * CHUNK, CHUNK))
            basic.pause(8)
        }
        transportSendEnd()
    }

    // ---------- Live (push to talk) ----------

    /** Basılı konuş: mikrofonu canlı olarak yayınlamaya başlar */
    //% block="start live talk"
    //% group="Live" weight=100
    export function startLive(): void {
        transportInit()
        if (liveRunning) return
        liveRunning = true
        listening = false
        control.inBackground(function () {
            const per = Math.idiv(1000000, sampleHz)
            const frame = pins.createBuffer(CHUNK)
            while (liveRunning) {
                for (let i = 0; i < CHUNK; i++) {
                    const t = control.micros()
                    frame[i] = input.soundLevel()
                    const rest = per - (control.micros() - t)
                    if (rest > 0) control.waitMicros(rest)
                }
                transportSendLive(frame)
            }
        })
    }

    /** Canlı yayını durdurur */
    //% block="stop live talk"
    //% group="Live" weight=90
    export function stopLive(): void {
        liveRunning = false
    }

    // ---------- Receive ----------

    /** Gelen canlı sesi seçilen pinde hemen çalar */
    //% block="listen live on %pin"
    //% pin.defl=AnalogPin.P0
    //% group="Receive" weight=100
    export function listenLive(pin: AnalogPin): void {
        transportInit()
        livePin = pin
        liveRunning = false
        listening = true
    }

    /** Canlı dinlemeyi durdurur */
    //% block="stop listening"
    //% group="Receive" weight=90
    export function stopListening(): void {
        listening = false
    }

    /** Tam bir kayıt alındığında çalışır */
    //% block="on recording received"
    //% group="Receive" weight=80
    export function onRecordingReceived(handler: () => void): void {
        transportInit()
        onRecv = handler
    }

    // ---------- Taşıma katmanının çağırdıkları ----------

    export function storeChunk(seq: number, data: Buffer): void {
        const off = seq * CHUNK
        if (off + CHUNK <= MAX) rec.write(off, data)
    }

    export function finishRecording(len: number, hz: number): void {
        recLen = Math.min(len, MAX)
        if (hz >= 500 && hz <= 4000) sampleHz = hz
        if (onRecv) onRecv()
    }

    export function playLive(data: Buffer): void {
        if (!listening || playLock) return
        playLock = true
        setRecordingPlaybackState(true)
        playSamples(livePin, data, 0, data.length)
        setRecordingPlaybackState(false)
        playLock = false
    }
}
