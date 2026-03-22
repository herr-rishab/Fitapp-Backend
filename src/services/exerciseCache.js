// src/services/exerciseCache.js

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const BASE_URL = "https://exercisedb.dev/api/v1";

// Cache dosyası proje root'unda dursun diye ../../.. kullanıyoruz:
// src/services/exerciseCache.js -> root/exercises.db.json
const CACHE_FILE = path.join(__dirname, "../../..", "exercises.db.json");

// TTL: 30 gün (istersen değiştir)
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

// 429 / ağ hataları için retry
const MAX_RETRY = 8;
const BASE_WAIT_MS = 1200;

// ----------------------------
// küçük yardımcılar

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function now() {
  return Date.now();
}

function ensureCacheFile() {
  if (!fs.existsSync(CACHE_FILE)) {
    const initial = {
      meta: { createdAt: now(), updatedAt: now(), version: 1 },
      exercisesById: {},
      // bodyPart -> [id, id, ...]
      indexByBodyPart: {},
      // normalized query -> [id, id, ...]
      indexBySearch: {},
      // bu id'nin cache'e ne zaman yazıldığı
      cachedAtById: {}
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function loadDB() {
  ensureCacheFile();
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const db = JSON.parse(raw);
    // eski formatlardan dönüşüm için minimum güvence
    db.meta ||= { createdAt: now(), updatedAt: now(), version: 1 };
    db.exercisesById ||= {};
    db.indexByBodyPart ||= {};
    db.indexBySearch ||= {};
    db.cachedAtById ||= {};
    return db;
  } catch {
    // bozulmuş dosya varsa sıfırla
    const fresh = {
      meta: { createdAt: now(), updatedAt: now(), version: 1 },
      exercisesById: {},
      indexByBodyPart: {},
      indexBySearch: {},
      cachedAtById: {}
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

function saveDB(db) {
  db.meta.updatedAt = now();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(db, null, 2), "utf8");
}

function normalizeText(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function getBodyPartAliases(bodyPart) {
  const normalized = normalizeText(bodyPart);

  const aliases = {
    abs: ["waist"],
    core: ["waist"],
    arms: ["upper arms", "lower arms"],
    legs: ["upper legs", "lower legs"],
    glutes: ["upper legs"],
  };

  return aliases[normalized] || [normalized];
}

function matchesBodyPart(exercise, bodyPart) {
  if (!bodyPart) return true;

  const aliases = getBodyPartAliases(bodyPart);
  const bodyParts = (exercise.bodyParts || []).map(normalizeText);
  const muscles = [
    ...(exercise.targetMuscles || []),
    ...(exercise.secondaryMuscles || []),
  ].map(normalizeText);

  if (aliases.some((alias) => bodyParts.includes(alias))) {
    return true;
  }

  if (normalizeText(bodyPart) === "glutes") {
    return muscles.some((muscle) => muscle.includes("glute"));
  }

  return false;
}

function getId(ex) {
  // API bazen exerciseId, bazen id döndürebiliyor
  return String(ex?.exerciseId ?? ex?.id ?? "");
}

function isFresh(db, id, ttlMs) {
  const t = db.cachedAtById[String(id)];
  if (!t) return false;
  return now() - t < ttlMs;
}

async function safeGet(url, params = {}, retry = 0) {
  try {
    return await axios.get(url, { params, timeout: 15000 });
  } catch (err) {
    const status = err?.response?.status;

    const retryable =
      status === 429 ||
      status === 408 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      err.code === "ECONNABORTED" ||
      err.message?.includes("Network Error");

    if (retryable && retry < MAX_RETRY) {
      const wait = BASE_WAIT_MS * Math.pow(1.4, retry);
      const jitter = Math.floor(Math.random() * 250);
      const total = Math.floor(wait + jitter);

      console.warn(`HTTP ${status || "ERR"} → ${total}ms bekleniyor... (retry ${retry + 1}/${MAX_RETRY})`);
      await sleep(total);
      return safeGet(url, params, retry + 1);
    }

    throw err;
  }
}

// ----------------------------
// in-flight kilitleri (aynı anda tek fetch)

const inflightByKey = new Map();
/**
 * Aynı "key" ile aynı anda birden fazla çağrı gelirse,
 * sadece 1 tanesi API'ye gider, diğerleri onu await eder.
 */
function withInflight(key, fn) {
  if (inflightByKey.has(key)) return inflightByKey.get(key);

  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflightByKey.delete(key);
    }
  })();

  inflightByKey.set(key, p);
  return p;
}

// ----------------------------
// Enrichment (senin eski koddaki gibi)
function enrichExercise(ex) {
  const equipment = (ex.equipments?.[0] || ex.equipment || "").toLowerCase();

  let difficulty = "Easy";
  if (equipment.includes("barbell") || equipment.includes("cable")) difficulty = "Hard";
  else if (equipment.includes("dumbbell") || equipment.includes("machine")) difficulty = "Moderate";

  const setsMap = { Easy: 3, Moderate: 4, Hard: 5 };
  const repsMap = { Easy: 15, Moderate: 12, Hard: 8 };

  const MET = difficulty === "Easy" ? 4 : difficulty === "Moderate" ? 6 : 8;
  const caloriesPerMinute = (MET * 3.5 * 70) / 200;
  const calories = Math.round(caloriesPerMinute);

  return {
    ...ex,
    sets: setsMap[difficulty],
    reps: repsMap[difficulty],
    calories,
    difficulty,
    estimated: true
  };
}

// ----------------------------
// Remote endpoints (gerekirse burada düzenlersin)

// Not: /exercises?limit&offset zaten çalışıyor.
// byId endpoint projene göre /exercises/{id} veya /exercises/exercise/{id} olabilir.
// Tarayıcıdan test edip buna göre düzelt.
function remoteByIdUrl(id) {
  return `${BASE_URL}/exercises/${id}`;
}

async function remoteListPage(limit, offset) {
  // data bazen {data: []} bazen [] dönebiliyor
  const res = await safeGet(`${BASE_URL}/exercises`, { limit, offset });
  const chunk = Array.isArray(res.data?.data)
    ? res.data.data
    : Array.isArray(res.data)
    ? res.data
    : [];
  return chunk;
}

// ----------------------------
// PUBLIC: getExerciseById (read-through + TTL)

async function getExerciseById(id, opts = {}) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const key = `byId:${id}`;

  return withInflight(key, async () => {
    const db = loadDB();
    const sid = String(id);

    // 1) Lokal + taze mi?
    if (db.exercisesById[sid] && isFresh(db, sid, ttlMs)) {
      return db.exercisesById[sid];
    }

    // 2) Lokal var ama bayat -> API'den yenile (API patlarsa lokali döndür)
    if (db.exercisesById[sid] && !isFresh(db, sid, ttlMs)) {
      try {
        const res = await safeGet(remoteByIdUrl(sid));
        const ex = enrichExercise(res.data?.data ?? res.data);
        const exId = getId(ex) || sid;

        db.exercisesById[exId] = ex;
        db.cachedAtById[exId] = now();
        saveDB(db);

        return ex;
      } catch (e) {
        // API hata verirse eskiyi döndür
        return db.exercisesById[sid];
      }
    }

    // 3) Lokal yok -> API'den al ve yaz
    const res = await safeGet(remoteByIdUrl(sid));
    const ex = enrichExercise(res.data?.data ?? res.data);
    const exId = getId(ex) || sid;

    db.exercisesById[exId] = ex;
    db.cachedAtById[exId] = now();
    saveDB(db);

    return ex;
  });
}

// ----------------------------
// PUBLIC: getExercises (bodyPart + limit)
// Önce index'e bakar; index yoksa API'den sayfa sayfa az az çekip DB'yi büyütür.

async function getExercises(query = {}) {
  const bodyPart = query.bodyPart ? normalizeText(query.bodyPart) : null;
  const limit = query.limit ? Number(query.limit) : null;
  const ttlMs = query.ttlMs ?? DEFAULT_TTL_MS;

  const key = `list:${bodyPart || "all"}:${limit || "nolimit"}`;

  return withInflight(key, async () => {
    const db = loadDB();

    // 1) BodyPart varsa ve index doluysa direkt localden dön
    if (bodyPart && Array.isArray(db.indexByBodyPart[bodyPart]) && db.indexByBodyPart[bodyPart].length) {
      const ids = db.indexByBodyPart[bodyPart];
      const local = ids
        .map((id) => db.exercisesById[String(id)])
        .filter(Boolean);

      const sliced = limit ? local.slice(0, limit) : local;
      if (sliced.length) return sliced;
    }

    // 2) BodyPart yoksa ama localde veri varsa (her şey) hızlı dön
    if (!bodyPart) {
      const allLocal = Object.values(db.exercisesById);
      if (allLocal.length) {
        return limit ? allLocal.slice(0, limit) : allLocal;
      }
    }

    // 3) Lokal yetmiyorsa: API'den SAYFA SAYFA çek, DB'yi büyüt.
    //   Burada agresif çekmiyoruz. İhtiyaca göre çekiyoruz:
    //   - bodyPart arıyorsak: buldukça index oluşturup limit dolunca dur
    //   - bodyPart yoksa: limit varsa limit kadar dolunca dur, yoksa güvenli bir üst sınırla dur (ör: 500)

    const PAGE_LIMIT = 100;
    const REQUEST_DELAY_MS = 100;

    const targetCount = limit || (bodyPart ? 60 : 200); // güvenli varsayılan
    let collected = [];

    let offset = 0;
    let pages = 0;
    const maxPages = 20; // güvenlik: 2000 kayıt üst limit gibi

    while (collected.length < targetCount && pages < maxPages) {
      const chunk = await remoteListPage(PAGE_LIMIT, offset);
      if (!chunk.length) break;

      for (const raw of chunk) {
        const ex = enrichExercise(raw);
        const exId = getId(ex);
        if (!exId) continue;

        // DB'ye yaz (taze kabul edelim)
        if (!db.exercisesById[exId] || !isFresh(db, exId, ttlMs)) {
          db.exercisesById[exId] = ex;
          db.cachedAtById[exId] = now();
        }

        // index bodyPart
        if (Array.isArray(ex.bodyParts)) {
          for (const bp of ex.bodyParts) {
            const nbp = normalizeText(bp);
            db.indexByBodyPart[nbp] ||= [];
            if (!db.indexByBodyPart[nbp].includes(exId)) {
              db.indexByBodyPart[nbp].push(exId);
            }
          }
        }

        // filtre uygula
        if (bodyPart) {
          if (matchesBodyPart(ex, bodyPart)) collected.push(ex);
        } else {
          collected.push(ex);
        }

        if (collected.length >= targetCount) break;
      }

      offset += PAGE_LIMIT;
      pages += 1;

      saveDB(db);
      await sleep(REQUEST_DELAY_MS);
    }

    // son filtre + limit
    if (bodyPart) {
      collected = collected.filter((ex) => matchesBodyPart(ex, bodyPart));
    }

    return limit ? collected.slice(0, limit) : collected;
  });
}

// ----------------------------
// PUBLIC: getBodyParts
// Lokal index varsa ondan döner. Yoksa az sayfa çekip index oluşturur.

async function getBodyParts() {
  return withInflight("bodyparts", async () => {
    const db = loadDB();

    const keys = Object.keys(db.indexByBodyPart || {});
    if (keys.length) {
      // orijinal casing yok, ama endpoint için yeterli
      return keys;
    }

    // index yoksa az sayfa çekip oluştur
    await getExercises({ limit: 200 }); // index üretmek için yeterli
    const db2 = loadDB();
    return Object.keys(db2.indexByBodyPart || {});
  });
}

// ----------------------------
// PUBLIC: searchExercises
// Önce local arar. Bulamazsa API'den küçük bir miktar çekip cache'e yazar.
// Not: Remote search endpoint'i yoksa, getExercises ile daha çok veri çekilince local search doğal olarak zenginleşir.

async function searchExercises(q) {
  const query = normalizeText(q);
  if (!query) return [];

  const key = `search:${query}`;

  return withInflight(key, async () => {
    const db = loadDB();

    // 1) daha önce arandıysa index'ten dön
    const indexedIds = db.indexBySearch[query];
    if (Array.isArray(indexedIds) && indexedIds.length) {
      return indexedIds.map((id) => db.exercisesById[String(id)]).filter(Boolean);
    }

    // 2) local içinde ara
    const local = Object.values(db.exercisesById).filter((ex) =>
      normalizeText(ex.name).includes(query)
    );

    if (local.length) {
      db.indexBySearch[query] = local.map(getId).filter(Boolean);
      saveDB(db);
      return local;
    }

    // 3) localde yoksa: az sayfa çekerek "ısındır"
    // (Remote search endpoint'i kullanmak istersen burada ekleyebilirsin)
    const warmed = await getExercises({ limit: 250 });
    const db2 = loadDB();

    const found = Object.values(db2.exercisesById).filter((ex) =>
      normalizeText(ex.name).includes(query)
    );

    db2.indexBySearch[query] = found.map(getId).filter(Boolean);
    saveDB(db2);

    return found;
  });
}

// ----------------------------
// PUBLIC: getRandomExercise
// Lokal varsa lokalden random döner. Yoksa az veri çekip sonra random döner.

async function getRandomExercise() {
  return withInflight("random", async () => {
    const db = loadDB();
    const local = Object.values(db.exercisesById);

    if (local.length) {
      return local[Math.floor(Math.random() * local.length)];
    }

    // lokal boşsa az veri çek ve random döndür
    const warmed = await getExercises({ limit: 200 });
    if (warmed.length) return warmed[Math.floor(Math.random() * warmed.length)];

    // hâlâ yoksa (API sorunluysa) boş dön
    return null;
  });
}

// ----------------------------
// PUBLIC: recommendWorkout
// bodyPart filtre + local yoksa ısındırır + random seçer.

async function recommendWorkout(payload = {}) {
  const bodyPart = payload.bodyPart ? normalizeText(payload.bodyPart) : null;
  const limit = payload.limit ? Number(payload.limit) : 5;

  let pool = await getExercises({ bodyPart, limit: Math.max(limit * 6, 60) });
  if (!pool.length) {
    pool = (await getExercises({ limit: 250 })).filter((ex) => matchesBodyPart(ex, bodyPart));
  }
  if (!pool.length) pool = await getExercises({ limit: 200 });

  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, limit);

  return selected.map((ex) => ({
    ...ex,
    sets: Math.floor(Math.random() * 3) + 3,      // 3-5
    reps: Math.floor(Math.random() * 8) + 8,      // 8-15
    calories: Math.floor(Math.random() * 6) + 4,  // 4-10
    difficulty: ["Easy", "Moderate", "Hard"][Math.floor(Math.random() * 3)],
    estimated: true
  }));
}

// ----------------------------

module.exports = {
  getExercises,
  getExerciseById,
  searchExercises,
  getBodyParts,
  getRandomExercise,
  recommendWorkout,

  // debug/ops: istersen kullanırsın
  _cacheFile: CACHE_FILE
};
