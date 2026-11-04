/**
 * Mini Zeka - Walkie Talkie entegrasyonu (micro:bit V2)
 *
 * Kaynak Mini Zeka'daki mood/drives/novelty yaklaşımının micro:bit
 * belleğine uygun hafif sürümüdür. Büyük Float32Array MLP ve replay
 * belleği doğrudan taşınmamıştır: micro:bit V2'nin RAM'i bu ağ için
 * yeterli değildir.
 *
 * ÖNEMLİ: MakeCode soundLevel() gerçek ses dalga biçimi/PCM vermez.
 * Bu motor duyguya göre ton ve ritim üretir; anlaşılır Türkçe TTS değildir.
 */
namespace walkie {
    export type MiniMood = "idle" | "curious" | "happy" | "sleepy" | "alert" | "explore"

    let brainEnabled = false
    let mood: MiniMood = "idle"
    let previousEnergy = 0
    let previousMotion = 0
    let silenceMs = 0
    let noveltyAverage = 0
    let rewardAverage = 0
    let step = 0

    // Homeostasis benzeri beş iç dürtü: enerji, etkileşim, dinlenme,
    // merak ve uyarılma. Değerler 0..100 aralığındadır.
    let energyDrive = 50
    let interactionDrive = 50
    let restDrive = 50
    let curiosityDrive = 50
    let alertDrive = 50

    let speakOnChange = true
    let speechVolume = 120

    //% block="Mini Zeka'yı başlat"
    //% group="Mini Zeka" weight=100
    export function startMiniBrain(): void {
        if (brainEnabled) return
        brainEnabled = true
        previousEnergy = input.lightLevel()
        previousMotion = input.acceleration(Dimension.Strength)
        silenceMs = control.millis()

        control.inBackground(function () {
            while (brainEnabled) {
                updateMiniBrain()
                basic.pause(250)
            }
        })
    }

    //% block="Mini Zeka'yı durdur"
    //% group="Mini Zeka" weight=90
    export function stopMiniBrain(): void {
        brainEnabled = false
    }

    //% block="Mini Zeka konuşma sesini aç %enabled"
    //% group="Mini Zeka" weight=80
    export function setMiniSpeech(enabled: boolean): void {
        speakOnChange = enabled
    }

    //% block="Mini Zeka ses düzeyi %v"
    //% v.min=0 v.max=255 v.defl=120
    //% group="Mini Zeka" weight=70
    export function setMiniSpeechVolume(v: number): void {
        speechVolume = Math.max(0, Math.min(255, v))
        music.setVolume(speechVolume)
    }

    //% block="Mini Zeka ruh hâli"
    //% group="Mini Zeka" weight=60
    export function miniMoodName(): string {
        return mood
    }

    function updateMiniBrain(): void {
        const light = input.lightLevel()
        const motion = input.acceleration(Dimension.Strength)
        const energy = light / 255
        let novelty = Math.abs(light - previousEnergy) / 255
                    + Math.abs(motion - previousMotion) / 1024
        novelty = Math.min(1, novelty)
        noveltyAverage = noveltyAverage * 0.8 + novelty * 0.2

        if (Math.abs(motion - previousMotion) > 55 || novelty > 0.28) {
            silenceMs = 0
        } else {
            silenceMs += 250
        }

        // Yavaş homeostatik güncelleme
        energyDrive += (50 - energyDrive) * 0.04 - energy * 0.7
        interactionDrive += (50 - interactionDrive) * 0.04 - (silenceMs / 1000) * 0.025
        restDrive += (50 - restDrive) * 0.04 - (1 - energy) * 0.6
        curiosityDrive += (50 - curiosityDrive) * 0.04 + novelty * 1.2
        alertDrive += (50 - alertDrive) * 0.04 + (novelty > 0.7 ? 2 : 0)

        energyDrive = clampDrive(energyDrive)
        interactionDrive = clampDrive(interactionDrive)
        restDrive = clampDrive(restDrive)
        curiosityDrive = clampDrive(curiosityDrive)
        alertDrive = clampDrive(alertDrive)

        // Basit ödül göstergesi; her döngüde yumuşatılır.
        const balance = 1 - (
            Math.abs(energyDrive - 50) +
            Math.abs(interactionDrive - 50) +
            Math.abs(restDrive - 50) +
            Math.abs(curiosityDrive - 50) +
            Math.abs(alertDrive - 50)
        ) / 250
        const reward = balance * 0.6 + noveltyAverage * 0.4 - 0.15
        rewardAverage = rewardAverage * 0.95 + reward * 0.05
        step++

        const next = chooseMood(energy, novelty, silenceMs)
        if (next != mood) {
            mood = next
            showMoodIcon()
            if (speakOnChange && !liveRunning && !listening && !isPlayingRecording()) {
                speakMood(next)
            }
        }

        previousEnergy = light
        previousMotion = motion
    }

    function clampDrive(v: number): number {
        return Math.max(0, Math.min(100, v))
    }

    function chooseMood(energy: number, novelty: number, quiet: number): MiniMood {
        if (novelty > 0.72 || alertDrive > 72) return "alert"
        if (novelty > 0.28 || curiosityDrive > 62) return "curious"
        if (energy > 0.65 && interactionDrive < 48) return "happy"
        if (quiet > 12000 || restDrive < 35) return "sleepy"
        if (novelty > 0.12) return "explore"
        return "idle"
    }

    function showMoodIcon(): void {
        if (mood == "happy") basic.showIcon(IconNames.Happy)
        else if (mood == "sleepy") basic.showIcon(IconNames.Asleep)
        else if (mood == "alert") basic.showIcon(IconNames.Surprised)
        else if (mood == "curious") basic.showIcon(IconNames.QuestionMark)
        else if (mood == "explore") basic.showIcon(IconNames.Diamond)
        else basic.showIcon(IconNames.SmallDiamond)
    }

    // Ton dizileri, ruh hâline göre perde ve ritim değiştirir.
    // Gerçek fonem/Türkçe kelime üretimi değildir.
    function speakMood(m: MiniMood): void {
        music.setVolume(speechVolume)
        if (m == "happy") {
            playTonePair(660, 880, 90)
        } else if (m == "curious") {
            playTonePair(440, 740, 110)
        } else if (m == "alert") {
            playTonePair(880, 660, 65)
        } else if (m == "sleepy") {
            playTonePair(330, 260, 180)
        } else if (m == "explore") {
            playTonePair(520, 780, 80)
        } else {
            music.playTone(392, 100)
        }
    }

    function playTonePair(a: number, b: number, duration: number): void {
        music.playTone(a, duration)
        music.playTone(b, duration)
    }

    let recordingPlayback = false

    function isPlayingRecording(): boolean {
        return recordingPlayback
    }

    // Dışarıdan çekilen kayıt çalınırken Mini Zeka'nın tonlarını engelle.
    export function setRecordingPlaybackState(active: boolean): void {
        recordingPlayback = active
    }
}
