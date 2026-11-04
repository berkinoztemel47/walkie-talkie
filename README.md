# Walkie Talkie (micro:bit V2)

Mikrofondan ses seviyesini örnekler, micro:bit belleğine kaydeder, PWM ile hoparlörde çalar ve **radyo** (micro:bit ↔ micro:bit) veya **Bluetooth UART** (micro:bit ↔ telefon/PC) ile gönderir.

> ⚠️ **Sınırlar (dürüst not):** MakeCode ham mikrofon (PCM) örneklerine erişim vermez, sadece `input.soundLevel()` (0-255 zarf/şiddet) verir. Bu yüzden ses "robot ses" gibi çıkar: konuşmanın şiddet zarfı, sabit perdeli bir PWM taşıyıcısını modüle eder. Anlaşılır ritim/şiddet iletilir, kelime netliği sınırlıdır. Gerçek PCM için C++ (PDM) eklentisi gerekir. Sadece **micro:bit V2** (mikrofonlu).

## Kullanım
1. MakeCode → Eklentiler → bu reponun URL'sini yapıştır.
2. İki micro:bit'e de aynı kanal: `set channel to 1`.
3. Verici: `record microphone for 3000 ms` → `send recording`.
4. Alıcı: `on recording received` içine `play recording on P0`.
5. Canlı mod: verici `start live talk` / `stop live talk`, alıcı `listen live on P0`.

Hoparlör/buzzer P0 ile GND arasına (küçük seri direnç önerilir).

## Bloklar
| Grup | Blok |
|---|---|
| Settings | set sample rate · set playback pitch · set noise gate · set volume · set channel (radyo) |
| Record | record microphone for ms · clear recording · recording length |
| Play | play recording on pin |
| Send | send recording |
| Live | start live talk · stop live talk |
| Receive | listen live on pin · stop listening · on recording received |

## Radyo / Bluetooth sürümü
Micro:bit'te MakeCode `radio` ve `bluetooth`'u aynı projede kullanmaya izin vermez, bu yüzden iki sürüm var:
- **Radyo (varsayılan):** `pxt.json` + `core.ts` + `radio.ts`
- **Bluetooth:** yeni bir branch aç (`bluetooth`), `pxt-bluetooth.json` dosyasını `pxt.json` olarak yeniden adlandır. Telefon/PC tarafı Nordic UART'a `'0'..'o'` karakterleri + `#` ayırıcı ile ses gönderir/alır; kayıt sonu `$#`.

## Lisans
MIT

## Desteklenen hedef
```package
walkie-talkie=github:berkinoztemel47/walkie-takie
```


## Mini Zeka entegrasyonu

Bu sürüm `brain.ts` dosyasıyla Mini Zeka'nın hafifletilmiş ruh hâli motorunu ekler.
Işık, hareket ve sessizlik değişimlerinden `idle / curious / happy / sleepy /
alert / explore` durumlarından birini seçer. Ruh hâli değişince P0 hoparlörde
farklı perde ve ritimde kısa tonlar üretir.

**Bellek ve çalışma zamanı notu:** Paylaşılan özgün Mini Zeka kodundaki büyük
`Float32Array` MLP + replay ağı micro:bit V2'nin RAM sınırlarını aşabilecek
boyuttadır. Ayrıca MakeCode `control.setInterval(..., 250)` değeri 250
milisaniyedir; 250 mikrosaniyelik 4 kHz ses örnekleme sağlamaz. Bu nedenle
özgün ağın tamamı birebir kopyalanmadı; aynı sensör/drive/mood fikrini kullanan
hafif bir motor hazırlandı.

**Konuşma sınırı:** Walkie Talkie'nin mikrofon yolu `input.soundLevel()` kullanır.
Bu, sesin PCM dalga biçimini veya konuşma fonemlerini vermez. Mini Zeka'nın
tonları da Türkçe kelime söylemez; yalnızca ruh hâlini farklı seslerle belli
eder. Anlaşılır Türkçe konuşma için ayrı bir TTS/önceden kaydedilmiş ses çözümü
veya ham PCM erişimi sağlayan daha düşük seviyeli C++ uygulaması gerekir.

### Entegre demo
`test.ts` dosyasını örnek olarak kullan:
- Başlangıçta `walkie.startMiniBrain()` Mini Zeka'yı çalıştırır.
- A: kayıt alır ve çalar.
- B: kaydı telsizle gönderir.
- A+B: canlı gönderimi açıp kapatır.
- Logo: canlı dinlemeyi başlatır.
- Canlı gönderim/dinleme sırasında Mini Zeka ton üretimi durdurulur; böylece
  telsiz sesiyle aynı P0 pininde çakışma azaltılır.
