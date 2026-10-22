# Geliştirme notları

Bu repoda çalışırken bilinmesi gerekenler. Arayüz ve tüm kullanıcı metinleri Türkçe; commit mesajları da Türkçe (kısa başlık + nedenini anlatan gövde).

## Çalışma kuralları

- **Repoda hiçbir yerde** (kod, yorum, belge, arayüz, commit mesajı) kodu yazmakta kullanılan araçların, benzer uygulamaların ya da ücretli tab sitelerinin adı geçmez.
- Commit'lere araç ya da oturum imzası (`Co-Authored-By`, oturum bağlantısı vb.) eklenmez. Yazar: `Görkem Kaçakgil <103423448+grkmkcgl@users.noreply.github.com>`.
- Arayüzde gizlilik ya da bağlantı açıklaması yazılmaz ("internete bağlanmaz", "yalnızca şarkı adı gider", "şu arama motorunda açılır" gibi). Arayüz kullanıcıya ne yapacağını söyler, uygulamanın içeride nasıl çalıştığını anlatmaz. Bu kurallar ve gizlilik ayrıntıları bu dosyada ve README'de kalır.
- `main`'e gönderilen her değişiklik testler geçerse doğrudan yayına çıkar (`pages.yml`). Göndermeden önce `npm test` tamamen yeşil olmalı. Diğer dallarda yalnızca testler çalışır (`test.yml`).

## Kurallar

- **Ağ yok.** Uygulama yalnızca kendi dosyalarını yükler. Tek dış bağlantı **Tab bul** penceresindeki linkler: `target="_blank" rel="noopener noreferrer"` ile DuckDuckGo'da `site:` filtreli arama açar (`FIND_SITES` / `findUrl` in `js/app.js`), içinde yalnızca kullanıcının yazdığı şarkı adı var; uygulama bu adreslere `fetch` etmez. Ultimate Guitar kendi arama sayfasında açılır (`search.php?search_type=title&value=<şarkı adı>`, yalnızca şarkı adıyla eşleşiyor, sanatçı eklenmez). GProTab ve 911tabs'in arama adres biçimi doğrulanamadığı için şimdilik DuckDuckGo'da `site:` araması. `index.html`'deki CSP (`default-src 'self'`) bunu zorlar; CDN, analitik, harici yazı tipi eklenmez. `script-src`/`worker-src`'deki `blob:` alphaTab'ın worker'ı içindir, `style-src 'unsafe-inline'` alphaTab'ın eklediği `<style>` içindir.
- **Şarkılar yalnızca cihazda** (IndexedDB). Egzersiz ilerlemesi de öyle (ayrı veritabanı, aşağıda). `localStorage` yalnızca cihaz tercihleri için (`ttp-prefs`). Cache Storage: uygulama dosyaları (`ttp-<sürüm>-<kapsam>`) ve Android paylaşımından gelen dosyalar için geçici kutu (`ttp-gelen`, içe aktarılınca boşalır).
- Test dosyaları yapaydır (`tests/fixtures.cjs`, `tools/ornek.cjs`). Repoya gerçek şarkı dosyası konmaz.

## Yapı

| Dosya | Ne yapar |
|---|---|
| `index.html` | İşaretleme, CSP, ikon sprite'ı, paneller ve diyaloglar |
| `css/app.css` | Koyu tema, telefon/tablet düzeni, alphaTab imleç renkleri |
| `js/app.js` | Kütüphane, içe aktarma, çalar, hız, döngü, antrenör, partiler, görünüm, egzersiz listesi, metronom ekranı, yönlendirme (`#/`, `#/sarki/<id>`, `#/egzersiz`, `#/egzersiz/<id>`, `#/metronom`) |
| `js/db.js` | IndexedDB: `songs` (bilgi + şarkıya özel ayarlar), `files` (dosyanın kendisi); egzersiz ilerlemesi ayrı veritabanında |
| `js/egzersiz.js` | Egzersizler (elektro gitar ve davul, üç seviye + Ölçüler): alphaTex olarak kodda üretilir |
| `js/metronom.js` | Tek başına metronom (Web Audio, ses dosyası yok) ve vuruşla tempo bulma (`tapper`) |
| `sw.js` | Çevrimdışı önbellek + Android paylaş hedefi (`POST paylas`) |
| `tools/build.mjs` | Yayın paketini (`_site`) hazırlar, `__SURUM__`'u yapı numarasıyla değiştirir |
| `lib/` | alphaTab, Bravura yazı tipi, Sonivox ses bankası (`npm run vendor` ile node_modules'tan kopyalanır) |
| `ornek.gp` | Örnek şarkı (`npm run ornek` üretir) |
| `tests/run.mjs` | Uçtan uca testler |

### Veri

- `songs` kaydı: `{id (SHA-256'nın ilk 12 baytı), file, title, artist, tracks:[{name, kind, tab}], bars, tempo, size, added, opened, fav, s}`.
- `s` (şarkıya özel): `speed`, `track` (gösterilen parti), `mute`/`solo`/`vol` (parti indeksine göre), `loop:{on, from, to}` (0'dan ölçü indeksi), `tr` (antrenör: `start, target, step, every`).
- `kind`: `gitar | bas | davul | diger` (program numarası, ad ve akorttan tahmin). `tab`: partinin telli akordu var mı. `openSong` dosyayı her açılışta yeniden okuyup `tracks`'i günceller, yani eski kayıtlar kendiliğinden düzelir.
- Cihaz tercihleri (`ttp-prefs`): `instrument, scale, layout, stave, follow, wake, metro, countIn, metroVol, sort`; egzersiz: `exMetro, exCountIn` (şarkılardan ayrı, varsayılan açık), `exInst, exLevel, exOlcu` (listede seçili olan; Ölçüler sekmesi `exOlcu`'da, `exLevel` hep eski üç seviyeden biri: aynı adresteki önizleme ile canlı site tercihleri paylaşır, eski sürüm `olcu`'yu bilmez); metronom ekranı: `mBpm, mBeats, mSub, mAccent, mVol`.
- Egzersiz ilerlemesi: veritabanı `tab-to-play-egzersiz`, depo `progress`, kayıt `{id, s, opened}` (`s` şarkılardaki gibi: `speed` = BPM, `loop`, `tr`, `mute`…). Şarkı veritabanının sürümünü yükseltmemek için ayrı: yükseltme, eski sürüm başka sekmede açıksa bekler.

## Egzersiz modu

- Egzersiz, çalarda şarkı gibi açılır (`showPlayer`); `cur.ex` egzersiz tanımını taşır, `#playerView.ex` sınıfı arayüzü değiştirir (`.ex-only` / `.song-only`).
- **Tempo = BPM:** her egzersiz `\tempo 100` yazılır (x/8 ölçülerde `\tempo 50`, aşağıda), hız yüzdesi doğrudan BPM olur (`s.speed` 72 → 72 BPM, `playbackSpeed` 0.72). Böylece tempo değişince nota yeniden çizilmez ve hız antrenörü olduğu gibi çalışır. Sınırlar 30–240 (`EX_BPM_MIN/MAX`). Notadaki tempo işareti (yanlış olarak 100 yazardı), başlık, akort ve dinamik işareti egzersizde gizlenir.
- **Ölçüler sekmesi:** `GUITAR_TS` / `DRUMS_TS` listeleri, `level: 'olcu'` (`meter()` ekler), zorluk `diff`'te. alphaTab'ın metronomu ölçünün alt sayısına göre tıklar (5/8'de her sekizlik). Bu yüzden x/8 ölçülerde `tempo: EIGHTH` (dörtlük = 50, sekizlik = 100): BPM yine metronomun dakikadaki tık sayısıdır, açıklamaya "Tempo dakikadaki sekizlik sayısı." eklenir. Ölçü değişimi olan egzersizlerde her ölçü kendi `\ts`'iyle başlar (`gBar(..., { ts })`), etiketi `tsLabel`; aynı egzersizde x/4 ile x/8 karıştırma (tık hızı değişir). `gBar(süre, gruplar, notalar)` grup başlarını vurgular (`{ac}`), ilk notanın üstüne grup yazısı (`3+2`) koyar ve nota sayısını denetler. Listede ölçü etiketi ölçü egzersizlerinde ve 4/4 olmayan diğer egzersizlerde görünür.
- **Eski egzersizlere dokunma:** ilerleme kimliğe (`id`) göre saklanır. Yeni egzersiz yeni kimlikle eklenir; eskilerin notası değişirse kayıtlı tempo başka bir notaya ait olur.
- Egzersiz döngüde açılır (bütün ölçüler), metronom ve sayma varsayılan açıktır. Metronom sesi `metroVol` (%20–200) hem şarkıda hem egzersizde geçerli.
- **Yeni egzersiz:** `js/egzersiz.js`'te `GUITAR` ya da `DRUMS` listesine `{id, level, title, desc, bpm, min, max, bars, prog?, ts?, tempo?}` (ölçü egzersizinde `level` yerine `diff`, gerekirse `tsLabel`) ekle. `bars` ölçü başına alphaTex dizisi (`:8 0.6 2.6 …`); yardımcılar: `bars()` (notaları ölçülere böler, triole/altılık), `acrossStrings()`, `rock8()`. Davul adları alphaTab'ın GP adlarının küçük harfli hâli (`kickhit`, `snarehit`, `hihatclosed`, `ridemiddle`, `crashhighhit`, `hightomhit`, `lowtomhit`, `lowfloortomhit`); dikkat: `highfloortomhit` en tiz tom (MIDI 50). Test, her egzersizin açıldığını ve ölçülerinin tam dolduğunu kontrol eder.
- **Metronom ekranı** (`Metronome`): AudioContext saatine ~150 ms ileri tık yazılır (arka planda 1,5 sn, zamanlayıcılar seyrekleştiği için); vuruş ışıkları aynı zamanlara göre `requestAnimationFrame` ile yanar. Ekrandan çıkınca durur.

## alphaTab (1.8.4) tuzakları

Hepsi kodda yorumla işaretli:

1. **`midiLoaded`'a abone olma.** Worker'lı çalarda `loadedMidiInfo` getter'ı kendini çağırıyor; abone olunca sonsuz döngü. Bunun yerine `playerReady` kullanılıyor (her şarkı yüklenişinde tetikleniyor).
2. **Tab'ı olmayan partiye `StaveProfile.Tab` verme.** Davul, piyano ya da akortsuz MusicXML partisi boş ya da bozuk çizilir (worker'da `addBars ... staves` hatası). `staveFor()` bu partilerde `Default` kullanır.
3. **`playbackRange` atamak imleci aralığın başına atar.** Notaya tek dokunuş alphaTab'da aralığı siler. Döngü açıksa `onRangeChanged` aralığı geri koyar ve dokunulan vuruş döngünün içindeyse oraya döner (`lastTap`).
4. **Çalmaya başladıktan hemen sonra durdurmak hata veriyor** (AudioWorklet modülü hazır olmadan `source.stop()`). `pause()`/`stop()`, `play()`'den sonraki ilk 500 ms içinde çağrılırsa ertelenir (`whenSafe`).
5. Parti sessiz/solo/ses değişiklikleri (`changeTrack*`) yalnızca sentezleyiciye gider, `track.playbackInfo`'ya yazılmaz. Durum `cur.s`'te tutulur ve her `playerReady`'de yeniden uygulanır.
6. Konum (`tickPosition`) bir iki tik sapabilir; testler `near()` ile karşılaştırır.
7. Sayfanın en altındaki "rendered by alphaTab" yazısı kütüphaneden gelir, ayarla kapatılamıyor.
8. **Seçim (döngü vurgusu) yeni çizimde eski vuruşlarla yeniden çiziliyor.** alphaTab son seçimi hatırlar ve her çizimden sonra yeniden çizer; başka nota ya da başka parti çizilince eski vuruşlar bulunamaz (`realBounds` hatası). `resetSelection()` çizimden önce seçimi yeni partinin tek bir vuruşuna çeker (tek vuruşluk seçim çizilmez). Ayrıca `playerReady` çizimden önce gelebilir: o anda `playbackRange` atamak aynı hatayı veriyor; aralık hatadan önce kurulduğu için `applyLoop` hatayı yutar, `highlightLoop` da çizim güncel değilse bekler.

## Test

```bash
npm install
npm test                 # 28 senaryo, ~75 sn
npm test -- partiler     # adında "partiler" geçenler
VERBOSE=1 npm test       # hata yığınlarıyla
```

- Playwright kendi Chromium'unu ister (`npx playwright install chromium`). Bulut ortamında `/opt/pw-browsers` hazırsa kurulum gerekmez.
- Her test temiz bir tarayıcı bağlamında (boş IndexedDB) çalışır. `App` yardımcısı tercihleri yazar, alphaTab'ın `changeTrackMute/Solo/Volume` çağrılarını `window.__calls`'a kaydeder, CSP ihlallerini ve uygulama dışı istekleri yakalar. Bunlardan biri olursa test kırmızı olur.
- Kapsanan senaryolar: ilk açılış ve enstrüman sorusu; gitarcı/davulcu için doğru parti; GP + MusicXML + bozuk + tekrar eklenen dosya; Türkçe arama, favori, sıralama, silme onayı; Tab bul (Ultimate Guitar'ın kendi araması, diğerlerinin adresleri, yeni sekme, referrer yok, boşken kapalı, kütüphane aramasından şarkı adı); güncellemede sürüm tutarlılığı (eski dosyaları tutan CDN taklidiyle sayfa ve betik aynı sürüm, eski önbellek silinir, internetsiz açılış); paylaşım (indirme yedeği); hız sınırları ve BPM; metronom/sayma kalıcılığı; döngü (ölçü, imleçten, içeri/dışarı dokunma, iki dokunuşla seçme, kaldırma); döngünün gerçekten tekrar etmesi ve antrenörün hızlandırması; partiler (sessiz, solo, ses, parti değiştirme, yeniden açılışta uygulanma); görünüm ayarları; şarkıya özel ayarların kalıcılığı; geri düğmesi; klavye/pedal; 360 px ekranda taşma olmaması; çevrimdışı açılış ve çalma (egzersiz dahil); Android paylaş hedefi; CSP ağ kilidi; egzersiz listesi (yalnızca elektro gitar ve davul, seviye ve Ölçüler sekmesi, seçimin kalıcılığı, toplam 58); ölçü egzersizleri (ölçü etiketleri, 5/8'de sekizlik tempo, ölçü değişimi, çalma); egzersizde BPM ile tempo (hazır tempolar, ±1/±5, sınırlar, vuruşla tempo), metronom/sayma varsayılan açık ve şarkılardan ayrı, metronom sesi, döngü, tempo işaretinin gizlenmesi, tempo saklanır ve listede görünür, sonra açılan şarkı etkilenmez; antrenörün BPM ile hedefe çıkması; 58 egzersizin hepsinin açılması, çizilmesi ve ölçülerinin tam olması; metronom ekranı (tempo, sınırlar, vuruşla tempo, ölçü/bölüm, triolede ara tıklar, vuruş ışıkları, boşluk tuşu, tercihlerin kalıcılığı, ekrandan çıkınca durma); 360 px'te egzersiz ekranları.
- Kapsanmayanlar (elle denenmeli): gerçek iPhone/iPad/Android'de ses, ana ekrana ekleme, paylaş menüsü; Safari/WebKit; metronomun ekran kapalıyken ya da uygulama arka plandayken düzenli çalması (tarayıcı zamanlayıcıları seyrekleştirir).

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
