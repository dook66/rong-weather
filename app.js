const SUPABASE_URL = "https://rkfugxqcckxerykeyfnf.supabase.co";
const SUPABASE_KEY = "sb_publishable_PLMzRmp66QGL1X5OvhZ1Ow_mgO-2jSa";
const STORAGE_KEY = "rong-weather-station-v3-drafts";
const IS_ADMIN = new URLSearchParams(window.location.search).get("admin") === "1";

const weathers = [
  { name: "晴", title: "晴朗", copy: "荣今天有光，适合把好事情记下来。" },
  { name: "云", title: "多云", copy: "有些事被遮住了，但荣的天空仍然有层次。" },
  { name: "雾", title: "起雾", copy: "看不清也没关系，荣只需要确认下一步。" },
  { name: "雨", title: "下雨", copy: "今天湿度偏高，荣可以少消耗一点。" },
  { name: "雷", title: "雷阵雨", copy: "能量很强，先让它安全地经过身体。" },
  { name: "风", title: "有风", copy: "有变化在路上，荣可以松开一点点手。" },
  { name: "雪", title: "下雪", copy: "世界变安静了，荣慢一点也很好。" }
];

const shareLines = {
  晴: ["今天有光落在荣这里，适合把值得的事认真收藏。", "荣今天的天空比较亮，适合向前走，也适合奖励自己。", "晴天不一定代表万事顺利，但代表荣还有清楚的方向。"],
  云: ["荣今天的云层有点厚，但它们也在替天空保存柔软。", "多云的日子不用急着放晴，荣只需要保持自己的节奏。", "有些光被遮住了，但荣的天气仍然有层次。"],
  雾: ["雾里的荣不需要看见全部，只需要确认下一步。", "今天能见度有限，荣可以慢一点，稳一点。", "雾不是迷路，它只是提醒荣把速度降下来。"],
  雨: ["荣今天的心里在下雨，适合少消耗，多照顾自己。", "雨天也有秩序，荣只要撑住自己的伞。", "湿度偏高的一天，荣可以把要求放轻一点。"],
  雷: ["荣今天的能量很强，先让情绪安全地经过身体。", "雷声不是坏事，它说明荣心里有东西正在释放。", "今天的天气很有力量，荣需要空间，也需要边界。"],
  风: ["荣今天有风，变化在路上，手可以松一点。", "风会带走一些旧东西，也会把新的方向吹近荣。", "今天的荣适合调整姿势，等风过去，也借风前进。"],
  雪: ["荣今天的世界安静下来，慢一点也完全可以。", "下雪的日子适合收声，荣不用立刻回答所有事。", "雪把很多声音盖住了，荣可以听见自己。"]
};

const tags = ["Codex", "学习", "创作", "家", "赚钱", "松弛", "困", "想很多"];
const state = { weather: "晴", tags: new Set(), records: {} };
const $ = (selector) => document.querySelector(selector);

const form = $("#entry-form");
const note = $("#note");
const moodColor = $("#mood-color");
const energy = $("#energy");
const energyValue = $("#energy-value");
const weatherOptions = $("#weather-options");
const tagOptions = $("#tag-options");
const weekGrid = $("#week-grid");
const historyList = $("#history-list");
const saveStatus = $("#save-status");

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatDate(key) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${key}T12:00:00`));
}

function readDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeDrafts(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeRemoteRecord(row) {
  return {
    note: row.note || "",
    color: row.color || "#4f8fce",
    energy: Number(row.energy || 6),
    weather: row.weather || "晴",
    tags: Array.isArray(row.tags) ? row.tags : [],
    savedAt: row.saved_at || row.updated_at || new Date().toISOString()
  };
}

async function fetchPublicRecords() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rong_weather_records?select=*&order=weather_date.desc`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`读取公开天气失败：${response.status}`);
  }

  const rows = await response.json();
  return rows.reduce((records, row) => {
    records[row.weather_date] = normalizeRemoteRecord(row);
    return records;
  }, {});
}

async function publishRecord(key, record, password) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/publish-weather`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, weather_date: key, ...record })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `发布失败：${response.status}`);
  }
  return result;
}

function getWeather(name) {
  return weathers.find((weather) => weather.name === name) || weathers[0];
}

function stableIndex(seed, size) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return hash % size;
}

function getShareLine(record, key = todayKey()) {
  const lines = shareLines[record.weather] || shareLines.晴;
  return lines[stableIndex(`${key}-${record.weather}`, lines.length)];
}

function buildShareText(record, key = todayKey()) {
  if (!record) return "还没有今日公开记录。";
  const tagText = record.tags.length ? `｜${record.tags.join("、")}` : "";
  const noteText = record.note ? `\n\n荣的短句：${record.note}` : "";
  return `天气概况：${record.weather}｜精力 ${record.energy}/10${tagText}\n\n今日分享语句：${getShareLine(record, key)}${noteText}`;
}

function createChip(label, pressed, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chip";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(pressed));
  button.addEventListener("click", onClick);
  return button;
}

function renderChoices() {
  weatherOptions.replaceChildren();
  weathers.forEach((weather) => {
    weatherOptions.append(createChip(weather.name, state.weather === weather.name, () => {
      state.weather = weather.name;
      renderChoices();
      updateCurrentPreview();
    }));
  });

  tagOptions.replaceChildren();
  tags.forEach((tag) => {
    tagOptions.append(createChip(tag, state.tags.has(tag), () => {
      if (state.tags.has(tag)) state.tags.delete(tag);
      else state.tags.add(tag);
      renderChoices();
    }));
  });
}

function recentKeys() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return todayKey(date);
  });
}

function latestRecord(records) {
  const entries = Object.entries(records).sort((a, b) => b[0].localeCompare(a[0]));
  return entries[0] || [];
}

function updateCurrentPreview(record) {
  const weather = getWeather(record?.weather || state.weather);
  $("#weather-mark").textContent = weather.name;
  $("#current-title").textContent = record ? weather.title : "还没有公开记录";
  $("#current-copy").textContent = record?.note || weather.copy;
  $("#current-card").style.background = `linear-gradient(145deg, ${record?.color || moodColor.value}33, rgba(255, 250, 241, 0.96))`;
}

function summarize(records) {
  const list = Object.values(records);
  $("#total-days").textContent = list.length;

  if (!list.length) {
    $("#avg-energy").textContent = "--";
    $("#common-weather").textContent = "--";
    $("#weekly-note").textContent = "荣还没有发布公开天气。";
    return;
  }

  const avg = list.reduce((sum, item) => sum + Number(item.energy), 0) / list.length;
  $("#avg-energy").textContent = avg.toFixed(1);
  const counts = list.reduce((map, item) => {
    map[item.weather] = (map[item.weather] || 0) + 1;
    return map;
  }, {});
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  $("#common-weather").textContent = common;

  const recent = recentKeys().map((key) => records[key]).filter(Boolean);
  const recentAvg = recent.length ? recent.reduce((sum, item) => sum + Number(item.energy), 0) / recent.length : avg;
  const trend = recentAvg >= 7 ? "荣这周风向不错，能量在回升。" : recentAvg >= 4 ? "荣这周天气有起伏，但气压还算稳定。" : "荣最近云层厚一点，先减少消耗。";
  $("#weekly-note").textContent = `最近公开记录里最常出现的是「${common}」，${trend}`;
}

function renderWeek(records) {
  weekGrid.replaceChildren();
  recentKeys().forEach((key) => {
    const record = records[key];
    const day = document.createElement("article");
    day.className = `day ${record ? "has-record" : ""}`;
    if (record) day.style.background = `linear-gradient(160deg, ${record.color}36, #fffaf1 70%)`;
    day.innerHTML = `
      <small>${formatDate(key)}</small>
      <strong>${record ? `${record.weather} / ${record.energy}` : "未发布"}</strong>
      <p>${record ? record.note || getShareLine(record, key) : "等待荣发布。"}</p>
    `;
    weekGrid.append(day);
  });
}

function renderHistory(records) {
  const entries = Object.entries(records).sort((a, b) => b[0].localeCompare(a[0]));
  historyList.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有公开档案。荣发布一次天气后，这里会出现公开记录。";
    historyList.append(empty);
    return;
  }

  entries.forEach(([key, record]) => {
    const item = document.createElement("article");
    item.className = "record";
    item.innerHTML = `
      <time>${formatDate(key)}</time>
      <div>
        <strong>${record.weather} · 精力 ${record.energy} · ${record.tags.join("、") || "无标签"}</strong>
        <p>${record.note || getShareLine(record, key)}</p>
      </div>
    `;
    historyList.append(item);
  });
}

function loadAdminDraft(records) {
  const drafts = readDrafts();
  const record = drafts[todayKey()] || records[todayKey()] || latestRecord(records)[1];
  state.tags = new Set(record?.tags || []);
  state.weather = record?.weather || "晴";
  note.value = record?.note || "";
  moodColor.value = record?.color || "#4f8fce";
  energy.value = record?.energy || 6;
  energyValue.textContent = energy.value;
  renderChoices();
}

function render(records) {
  state.records = records;
  const [latestKey, latest] = latestRecord(records);
  $("#share-text").textContent = buildShareText(records[todayKey()] || latest, records[todayKey()] ? todayKey() : latestKey);
  updateCurrentPreview(records[todayKey()] || latest);
  summarize(records);
  renderWeek(records);
  renderHistory(records);
  if (IS_ADMIN) loadAdminDraft(records);
}

function showStatus(message) {
  saveStatus.textContent = message;
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 2500);
}

async function refreshPublicRecords() {
  try {
    render(await fetchPublicRecords());
  } catch (error) {
    render({});
    $("#weekly-note").textContent = error.message;
  }
}

document.body.classList.toggle("admin-mode", IS_ADMIN);
$("#today-label").textContent = formatDate(todayKey());

energy.addEventListener("input", () => {
  energyValue.textContent = energy.value;
});

moodColor.addEventListener("input", () => updateCurrentPreview());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = todayKey();
  const record = {
    note: note.value.trim(),
    color: moodColor.value,
    energy: Number(energy.value),
    weather: state.weather,
    tags: Array.from(state.tags),
    savedAt: new Date().toISOString()
  };

  const drafts = readDrafts();
  drafts[key] = record;
  writeDrafts(drafts);

  try {
    await publishRecord(key, record, $("#publish-password").value);
    showStatus("已发布：荣今天的公开天气已更新。");
    await refreshPublicRecords();
  } catch (error) {
    showStatus(error.message);
  }
});

$("#clear-today").addEventListener("click", () => {
  const drafts = readDrafts();
  delete drafts[todayKey()];
  writeDrafts(drafts);
  loadAdminDraft(state.records);
  showStatus("已清空本地草稿，公开记录不会被删除。");
});

$("#copy-share").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#share-text").textContent);
  $("#copy-share").textContent = "已复制";
  setTimeout(() => {
    $("#copy-share").textContent = "复制分享文案";
  }, 1300);
});

$("#export-data").addEventListener("click", () => {
  const data = JSON.stringify(readDrafts(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rong-weather-drafts-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$("#import-data").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const records = JSON.parse(await file.text());
    if (!records || Array.isArray(records) || typeof records !== "object") throw new Error("Invalid backup file");
    writeDrafts(records);
    loadAdminDraft(state.records);
    showStatus("已导入本地草稿。");
  } catch {
    showStatus("导入失败：请选择正确的 JSON 备份。");
  } finally {
    event.target.value = "";
  }
});

refreshPublicRecords();
