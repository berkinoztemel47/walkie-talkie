/**
 * Radyo taşıması (micro:bit <-> micro:bit)
 * Paket: [tip, seq/len (uint16 LE), veri...] toplam <= 19 bayt
 */
namespace walkie {
    const T_DATA = 0
    const T_END = 1
    const T_LIVE = 2
    let started = false

    /** Radyo grubu (kanal). İki micro:bit aynı kanalda olmalı. */
    //% block="set channel to %group"
    //% group.min=0 group.max=255 group.defl=1
    //% group="Settings" weight=95
    export function setChannel(group: number): void {
        transportInit()
        radio.setGroup(group)
    }

    export function transportInit(): void {
        if (started) return
        started = true
        radio.setTransmitPower(7)
        radio.onReceivedBuffer(function (b: Buffer) {
            const t = b[0]
            if (t == T_DATA) {
                storeChunk(b.getNumber(NumberFormat.UInt16LE, 1), b.slice(3, CHUNK))
            } else if (t == T_END) {
                finishRecording(b.getNumber(NumberFormat.UInt16LE, 1), b.getNumber(NumberFormat.UInt16LE, 3))
            } else if (t == T_LIVE) {
                playLive(b.slice(3, CHUNK))
            }
        })
    }

    export function transportSendChunk(seq: number, data: Buffer): void {
        const p = pins.createBuffer(3 + CHUNK)
        p[0] = T_DATA
        p.setNumber(NumberFormat.UInt16LE, 1, seq)
        p.write(3, data)
        radio.sendBuffer(p)
    }

    export function transportSendEnd(): void {
        const p = pins.createBuffer(5)
        p[0] = T_END
        p.setNumber(NumberFormat.UInt16LE, 1, recLen)
        p.setNumber(NumberFormat.UInt16LE, 3, sampleHz)
        for (let i = 0; i < 3; i++) { // kayıp olmasın diye 3 kez
            radio.sendBuffer(p)
            basic.pause(10)
        }
    }

    export function transportSendLive(data: Buffer): void {
        const p = pins.createBuffer(3 + CHUNK)
        p[0] = T_LIVE
        p.write(3, data)
        radio.sendBuffer(p)
    }
}
