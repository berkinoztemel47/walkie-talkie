// Walkie Talkie + Mini Zeka demo
// A: 3 sn kaydet ve çal
// B: kaydı gönder
// A+B: canlı konuşmayı aç/kapat
// Logo: canlı dinlemeyi aç
// Mini Zeka: ruh hâli değiştikçe kısa ton dizisi üretir.

walkie.setChannel(1)
walkie.setMiniSpeech(true)
walkie.setMiniSpeechVolume(120)
walkie.startMiniBrain()

let talking = false

input.onButtonPressed(Button.A, function () {
    basic.showIcon(IconNames.SmallDiamond)
    walkie.record(3000)
    walkie.play(AnalogPin.P0)
    basic.clearScreen()
})

input.onButtonPressed(Button.B, function () {
    walkie.sendRecording()
    basic.showIcon(IconNames.Yes)
})

input.onButtonPressed(Button.AB, function () {
    talking = !talking
    if (talking) {
        walkie.stopMiniBrain()
        walkie.startLive()
        basic.showIcon(IconNames.Square)
    } else {
        walkie.stopLive()
        walkie.startMiniBrain()
        basic.clearScreen()
    }
})

input.onLogoEvent(TouchButtonEvent.Pressed, function () {
    walkie.stopMiniBrain()
    walkie.listenLive(AnalogPin.P0)
    basic.showIcon(IconNames.Heart)
})

walkie.onRecordingReceived(function () {
    walkie.play(AnalogPin.P0)
})
