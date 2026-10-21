// Şarkılar cihazda IndexedDB'de durur:
//   songs: şarkı bilgisi ve şarkıya özel ayarlar (hız, döngü, sessiz partiler…)
//   files: dosyanın kendisi (ArrayBuffer), listeyi açarken hepsini okumamak için ayrı tutulur.
// Egzersiz ilerlemesi (tempo, döngü, antrenör) ayrı bir veritabanında: tab-to-play-egzersiz / progress.
// Ayrı tutuldu ki şarkı veritabanının sürümü yükseltilmesin (eski sürüm başka sekmede açıksa
// yükseltme bekler ve uygulama açılmaz).
const DB_NAME = 'tab-to-play';
const DB_VERSION = 1;
let dbPromise = null;
let exPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Veritabanı başka bir sekmede açık'));
    });
  }
  return dbPromise;
}

function openExDb() {
  if (!exPromise) {
    exPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('tab-to-play-egzersiz', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('progress')) req.result.createObjectStore('progress', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return exPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('İşlem iptal edildi'));
  });
}

function result(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async allSongs() {
    const d = await openDb();
    return result(d.transaction('songs').objectStore('songs').getAll());
  },
  async getSong(id) {
    const d = await openDb();
    return result(d.transaction('songs').objectStore('songs').get(id));
  },
  async putSong(song) {
    const d = await openDb();
    const tx = d.transaction('songs', 'readwrite');
    tx.objectStore('songs').put(song);
    return done(tx);
  },
  async getFile(id) {
    const d = await openDb();
    return result(d.transaction('files').objectStore('files').get(id));
  },
  async addSong(song, bytes) {
    const d = await openDb();
    const tx = d.transaction(['songs', 'files'], 'readwrite');
    tx.objectStore('songs').put(song);
    tx.objectStore('files').put(bytes, song.id);
    return done(tx);
  },
  async deleteSong(id) {
    const d = await openDb();
    const tx = d.transaction(['songs', 'files'], 'readwrite');
    tx.objectStore('songs').delete(id);
    tx.objectStore('files').delete(id);
    return done(tx);
  },
  // Egzersiz ilerlemesi: { id, s, opened }
  async allEx() {
    const d = await openExDb();
    return result(d.transaction('progress').objectStore('progress').getAll());
  },
  async getEx(id) {
    const d = await openExDb();
    return result(d.transaction('progress').objectStore('progress').get(id));
  },
  async putEx(rec) {
    const d = await openExDb();
    const tx = d.transaction('progress', 'readwrite');
    tx.objectStore('progress').put(rec);
    return done(tx);
  },
};
