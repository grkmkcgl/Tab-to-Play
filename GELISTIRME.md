# Geliştirme notları

Bu repoda çalışırken bilinmesi gerekenler. Arayüz ve tüm kullanıcı metinleri Türkçe; commit mesajları da Türkçe (kısa başlık + nedenini anlatan gövde).

## Kurallar

- **Ağ yok.** Uygulama yalnızca kendi dosyalarını yükler. Tek dış bağlantı **Tab bul** penceresindeki linkler: `target="_blank" rel="noopener noreferrer"` ile DuckDuckGo'da `site:` filtreli arama açar (`FIND_SITES` / `findUrl` in `js/app.js`), içinde yalnızca kullanıcının yazdığı şarkı adı var; uygulama bu adreslere `fetch` etmez. Ultimate Guitar kendi arama sayfasında açılır (`search.php?search_type=title&value=<şarkı adı>`, yalnızca şarkı adıyla eşleşiyor, sanatçı eklenmez). GProTab ve 911tabs'in arama adres biçimi doğrulanamadığı için şimdilik DuckDuckGo'da `site:` araması. `index.html`'deki CSP (`default-src 'self'`) bunu zorlar; CDN, analitik, harici yazı tipi eklenmez. `script-src`/`worker-src`'deki `blob:` alphaTab'ın worker'ı içindir, `style-src 'unsafe-inline'` alphaTab'ın eklediği `<style>` içindir.
- **Şarkılar yalnızca cihazda** (IndexedDB). `localStorage` yalnızca cihaz tercihleri için (`ttp-prefs`). Cache Storage: uygulama dosyaları (`ttp-<sürüm>-<kapsam>`) ve Android paylaşımından gelen dosyalar için geçici kutu (`ttp-gelen`, içe aktarılınca boşalır).
- Test dosyaları yapaydır (`tests/fixtures.cjs`, `tools/ornek.cjs`). Repoya gerçek şarkı dosyası konmaz.

## Yapı

| Dosya | Ne yapar |
|---|---|
| `index.html` | İşaretleme, CSP, ikon sprite'ı, paneller ve diyaloglar |
| `css/app.css` | Koyu tema, telefon/tablet düzeni, alphaTab imleç renkleri |
| `js/app.js` | Kütüphane, içe aktarma, çalar, hız, döngü, antrenör, partiler, görünüm, yönlendirme (`#/`, `#/sarki/<id>`) |
| `js/db.js` | IndexedDB: `songs` (bilgi + şarkıya özel ayarlar), `files` (dosyanın kendisi) |
| `sw.js` | Çevrimdışı önbellek + Android paylaş hedefi (`POST paylas`) |
| `tools/build.mjs` | Yayın paketini (`_site`) hazırlar, `__SURUM__`'u yapı numarasıyla değiştirir |
| `lib/` | alphaTab, Bravura yazı tipi, Sonivox ses bankası (`npm run vendor` ile node_modules'tan kopyalanır) |
| `ornek.gp` | Örnek şarkı (`npm run ornek` üretir) |
| `tests/run.mjs` | Uçtan uca testler |

### Veri

- `songs` kaydı: `{id (SHA-256'nın ilk 12 baytı), file, title, artist, tracks:[{name, kind, tab}], bars, tempo, size, added, opened, fav, s}`.
- `s` (şarkıya özel): `speed`, `track` (gösterilen parti), `mute`/`solo`/`vol` (parti indeksine göre), `loop:{on, from, to}` (0'dan ölçü indeksi), `tr` (antrenör: `start, target, step, every`).
- `kind`: `gitar | bas | davul | diger` (program numarası, ad ve akorttan tahmin). `tab`: partinin telli akordu var mı. `openSong` dosyayı her açılışta yeniden okuyup `tracks`'i günceller, yani eski kayıtlar kendiliğinden düzelir.
- Cihaz tercihleri (`ttp-prefs`): `instrument, scale, layout, stave, follow, wake, metro, countIn, sort`.

## alphaTab (1.8.4) tuzakları

Hepsi kodda yorumla işaretli:

1. **`midiLoaded`'a abone olma.** Worker'lı çalarda `loadedMidiInfo` getter'ı kendini çağırıyor; abone olunca sonsuz döngü. Bunun yerine `playerReady` kullanılıyor (her şarkı yüklenişinde tetikleniyor).
2. **Tab'ı olmayan partiye `StaveProfile.Tab` verme.** Davul, piyano ya da akortsuz MusicXML partisi boş ya da bozuk çizilir (worker'da `addBars ... staves` hatası). `staveFor()` bu partilerde `Default` kullanır.
3. **`playbackRange` atamak imleci aralığın başına atar.** Notaya tek dokunuş alphaTab'da aralığı siler. Döngü açıksa `onRangeChanged` aralığı geri koyar ve dokunulan vuruş döngünün içindeyse oraya döner (`lastTap`).
4. **Çalmaya başladıktan hemen sonra durdurmak hata veriyor** (AudioWorklet modülü hazır olmadan `source.stop()`). `pause()`/`stop()`, `play()`'den sonraki ilk 500 ms içinde çağrılırsa ertelenir (`whenSafe`).
5. Parti sessiz/solo/ses değişiklikleri (`changeTrack*`) yalnızca sentezleyiciye gider, `track.playbackInfo`'ya yazılmaz. Durum `cur.s`'te tutulur ve her `playerReady`'de yeniden uygulanır.
6. Konum (`tickPosition`) bir iki tik sapabilir; testler `near()` ile karşılaştırır.
7. Sayfanın en altındaki "rendered by alphaTab" yazısı kütüphaneden gelir, ayarla kapatılamıyor.

## Test

```bash
npm install
npm test                 # 21 senaryo, ~45 sn
npm test -- partiler     # adında "partiler" geçenler
VERBOSE=1 npm test       # hata yığınlarıyla
```

- Playwright kendi Chromium'unu ister (`npx playwright install chromium`). Bulut ortamında `/opt/pw-browsers` hazırsa kurulum gerekmez.
- Her test temiz bir tarayıcı bağlamında (boş IndexedDB) çalışır. `App` yardımcısı tercihleri yazar, alphaTab'ın `changeTrackMute/Solo/Volume` çağrılarını `window.__calls`'a kaydeder, CSP ihlallerini ve uygulama dışı istekleri yakalar. Bunlardan biri olursa test kırmızı olur.
- Kapsanan senaryolar: ilk açılış ve enstrüman sorusu; gitarcı/davulcu için doğru parti; GP + MusicXML + bozuk + tekrar eklenen dosya; Türkçe arama, favori, sıralama, silme onayı; Tab bul (Ultimate Guitar'ın kendi araması, diğerlerinin adresleri, yeni sekme, referrer yok, boşken kapalı, kütüphane aramasından şarkı adı); güncellemede sürüm tutarlılığı (eski dosyaları tutan CDN taklidiyle sayfa ve betik aynı sürüm, eski önbellek silinir, internetsiz açılış); paylaşım (indirme yedeği); hız sınırları ve BPM; metronom/sayma kalıcılığı; döngü (ölçü, imleçten, içeri/dışarı dokunma, iki dokunuşla seçme, kaldırma); döngünün gerçekten tekrar etmesi ve antrenörün hızlandırması; partiler (sessiz, solo, ses, parti değiştirme, yeniden açılışta uygulanma); görünüm ayarları; şarkıya özel ayarların kalıcılığı; geri düğmesi; klavye/pedal; 360 px ekranda taşma olmaması; çevrimdışı açılış ve çalma; Android paylaş hedefi; CSP ağ kilidi.
- Kapsanmayanlar (elle denenmeli): gerçek iPhone/iPad/Android'de ses, ana ekrana ekleme, paylaş menüsü; Safari/WebKit.

## Sürüm yükseltme

- **Sürüm tutarlılığı:** GitHub Pages'in CDN'i her dosyayı ~10 dakika ayrı ayrı tutar; aynı adresli `app.js` eski, `index.html` yeni gelebiliyordu (düğme var, işlevi yok). Bu yüzden `index.html` css/js'i `?v=__SURUM__` ile ister, `app.js` de `db.js`'i öyle içe aktarır; `pages.yml` içindeki `node tools/build.mjs _site` `__SURUM__`'u çalıştırma numarası + commit ile değiştirir. Her yayın yeni adres demek, CDN eskisini veremez. Yerelde ve testlerde `__SURUM__` olduğu gibi kalır, o da tutarlıdır. Sürümlü yeni bir dosya eklenirse `tools/build.mjs`'teki `STAMPED` listesine de ekle.
- **alphaTab:** `package.json`'da sürümü değiştir, `npm install`, `npm run vendor`, `npm run ornek`, `npm test`. Sonra `sw.js`'teki `LIB_VERSION`'ı değiştir; kütüphane dosyaları ayrı önbellekte durur ve yalnızca bu değişince yeniden iner.
- `js/app.js`'teki `VERSION` elle artırılan sürüm; Ayarlar'da yapı numarasıyla birlikte gösterilir.
- Yeni bir uygulama dosyası eklenirse: `sw.js`'teki `APP_FILES`/`LIB_FILES` listesine ve `tools/build.mjs`'teki `PUBLISH` listesine ekle.

## Fikirler (henüz yok)

- İki cihazda birlikte çalma (biri çalar, ikisinin ekranı birlikte ilerler).
- Şarkının kendi ses kaydıyla eşleştirerek çalma (alphaTab'ın `EnabledExternalMedia` / backing track desteği).
- Daha gerçekçi ses için isteğe bağlı büyük ses bankası.
- Mikrofonla çalınan notayı kontrol etme.
