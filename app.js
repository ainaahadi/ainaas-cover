const audio = new Audio();
audio.preload = "metadata";

const state = {
  playlists: APP_DATA.playlists,
  currentPlaylistId: APP_DATA.playlists[0].id,
  currentTracks: [],
  filteredTracks: [],
  currentIndex: 0,
  isPlaying: false,
  shuffle: false,
  shuffledOrder: [],
  shufflePointer: 0,
  repeatMode: "off",
  queue: [],
  liked: new Set(JSON.parse(localStorage.getItem("likedTracks") || "[]")),
  muted: false,
  lastVolume: 0.8
};

const el = {
  playlistList: document.getElementById("playlistList"),
  playlistCover: document.getElementById("playlistCover"),
  playlistTitle: document.getElementById("playlistTitle"),
  playlistSubtitle: document.getElementById("playlistSubtitle"),
  playlistInfo: document.getElementById("playlistInfo"),
  trackList: document.getElementById("trackList"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  mainPlayBtn: document.getElementById("mainPlayBtn"),
  mainPlayIcon: document.getElementById("mainPlayIcon"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  shareBtn: document.getElementById("shareBtn"),
  playerCover: document.getElementById("playerCover"),
  playerTitle: document.getElementById("playerTitle"),
  playerArtist: document.getElementById("playerArtist"),
  playerLikeBtn: document.getElementById("playerLikeBtn"),
  prevBtn: document.getElementById("prevBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  nextBtn: document.getElementById("nextBtn"),
  repeatBtn: document.getElementById("repeatBtn"),
  seekBar: document.getElementById("seekBar"),
  currentTime: document.getElementById("currentTime"),
  duration: document.getElementById("duration"),
  volumeBar: document.getElementById("volumeBar"),
  muteBtn: document.getElementById("muteBtn"),
  queueBtn: document.getElementById("queueBtn"),
  queueDrawer: document.getElementById("queueDrawer"),
  queueList: document.getElementById("queueList"),
  closeQueueBtn: document.getElementById("closeQueueBtn"),
  toast: document.getElementById("toast")
};

function saveLikes() {
  localStorage.setItem("likedTracks", JSON.stringify([...state.liked]));
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(el.toast._timer);
  el.toast._timer = setTimeout(() => el.toast.classList.remove("show"), 1800);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function setPlaylist(id) {
  state.currentPlaylistId = id;
  const playlist = state.playlists.find((p) => p.id === id);
  state.currentTracks = playlist.tracks.slice();
  state.filteredTracks = state.currentTracks.slice();
  state.currentIndex = 0;
  state.queue = state.currentTracks.slice();
  renderHeader(playlist);
  renderTracks();
  renderQueue();
  updateActivePlaylist();
}

function renderHeader(playlist) {
  el.playlistCover.style.backgroundImage = `url(${playlist.cover})`;
  el.playlistTitle.textContent = playlist.title;
  el.playlistSubtitle.textContent = playlist.subtitle;
  el.playlistInfo.textContent = `${playlist.tracks.length} tracks • curated by Ainaa`;
}

function renderPlaylists() {
  el.playlistList.innerHTML = "";
  state.playlists.forEach((playlist) => {
    const item = document.createElement("button");
    item.className = "playlist-item";
    item.textContent = playlist.title;
    item.addEventListener("click", () => setPlaylist(playlist.id));
    el.playlistList.appendChild(item);
  });
  updateActivePlaylist();
}

function updateActivePlaylist() {
  [...el.playlistList.children].forEach((item, index) => {
    const playlist = state.playlists[index];
    item.classList.toggle("active", playlist.id === state.currentPlaylistId);
  });
}

function renderTracks() {
  el.trackList.innerHTML = "";
  const list = state.filteredTracks;
  if (list.length === 0) {
    el.emptyState.hidden = false;
    return;
  }
  el.emptyState.hidden = true;
  list.forEach((track, index) => {
    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.trackId = track.id;
    row.innerHTML = `
      <div>${index + 1}</div>
      <div class="track-title">
        <div class="track-thumb">${track.cover ? `<img src="${track.cover}" alt="">` : ""}</div>
        <div class="track-text">
          <h3>${track.title}</h3>
          <small>${track.artist}</small>
        </div>
      </div>
      <div>${track.album}</div>
      <div class="duration">${formatTime(track.durationSec)}</div>
      <div class="row-actions">
        <button class="play-row-btn" aria-label="Play">▶</button>
        <button class="like-row-btn" aria-label="Like">${state.liked.has(track.id) ? "❤" : "♡"}</button>
        <div class="menu">
          <button class="menu-btn" aria-label="More">⋯</button>
          <div class="menu-panel">
            <button class="play-next-btn">Play next</button>
          </div>
        </div>
      </div>
    `;
    row.addEventListener("click", (event) => {
      if (event.target.closest(".row-actions")) return;
      playTrackById(track.id);
    });
    row.querySelector(".play-row-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      playTrackById(track.id);
    });
    row.querySelector(".like-row-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLike(track.id);
      renderTracks();
      updatePlayerLike();
    });
    const menu = row.querySelector(".menu");
    row.querySelector(".menu-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      menu.classList.toggle("open");
    });
    row.querySelector(".play-next-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      addToQueueNext(track.id);
      menu.classList.remove("open");
      showToast("Added to play next");
    });
    el.trackList.appendChild(row);
  });
  highlightActiveRow();
}

function updatePlayerLike() {
  const current = state.filteredTracks[state.currentIndex];
  if (!current) return;
  el.playerLikeBtn.textContent = state.liked.has(current.id) ? "❤" : "♡";
}

function highlightActiveRow() {
  const current = state.filteredTracks[state.currentIndex];
  document.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("active", row.dataset.trackId === (current && current.id));
  });
}

function playTrackById(trackId) {
  const list = state.filteredTracks;
  const index = list.findIndex((t) => t.id === trackId);
  if (index === -1) return;
  state.currentIndex = index;
  loadTrack(list[index], true);
}

function loadTrack(track, autoplay = false) {
  if (!track) return;
  audio.src = track.src;
  audio.load();
  el.playerCover.style.backgroundImage = `url(${track.cover})`;
  el.playerTitle.textContent = track.title;
  el.playerArtist.textContent = track.artist;
  updatePlayerLike();
  highlightActiveRow();
  if (autoplay) {
    audio.play().catch(() => showToast("Audio failed to load"));
    state.isPlaying = true;
    updatePlayButtons();
  }
}

function updatePlayButtons() {
  el.playPauseBtn.textContent = state.isPlaying ? "⏸" : "▶";
  el.mainPlayIcon.textContent = state.isPlaying ? "⏸" : "▶";
}

function getNextIndex() {
  if (state.shuffle) {
    if (state.shuffledOrder.length === 0 || state.shufflePointer >= state.shuffledOrder.length) {
      state.shuffledOrder = shuffleIndices(state.filteredTracks.length);
      state.shufflePointer = 0;
    }
    return state.shuffledOrder[state.shufflePointer++];
  }
  return (state.currentIndex + 1) % state.filteredTracks.length;
}

function getPrevIndex() {
  if (audio.currentTime > 3) return state.currentIndex;
  if (state.shuffle) {
    state.shufflePointer = Math.max(0, state.shufflePointer - 2);
    return getNextIndex();
  }
  return (state.currentIndex - 1 + state.filteredTracks.length) % state.filteredTracks.length;
}

function nextTrack() {
  if (state.filteredTracks.length === 0) return;
  const nextIndex = getNextIndex();
  state.currentIndex = nextIndex;
  loadTrack(state.filteredTracks[nextIndex], true);
}

function prevTrack() {
  if (state.filteredTracks.length === 0) return;
  const prevIndex = getPrevIndex();
  state.currentIndex = prevIndex;
  loadTrack(state.filteredTracks[prevIndex], true);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  el.shuffleBtn.classList.toggle("active", state.shuffle);
  state.shuffledOrder = [];
  state.shufflePointer = 0;
}

function cycleRepeat() {
  const modes = ["off", "all", "one"];
  const index = modes.indexOf(state.repeatMode);
  state.repeatMode = modes[(index + 1) % modes.length];
  el.repeatBtn.textContent = state.repeatMode === "one" ? "🔂" : "🔁";
  showToast(`Repeat ${state.repeatMode}`);
}

function shuffleIndices(length) {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toggleLike(trackId) {
  if (state.liked.has(trackId)) {
    state.liked.delete(trackId);
  } else {
    state.liked.add(trackId);
  }
  saveLikes();
}

function addToQueueNext(trackId) {
  const track = state.currentTracks.find((t) => t.id === trackId);
  if (!track) return;
  const current = state.queue.findIndex((t) => t.id === currentTrack()?.id);
  state.queue.splice(current + 1, 0, track);
  renderQueue();
}

function renderQueue() {
  el.queueList.innerHTML = "";
  state.queue.forEach((track) => {
    const item = document.createElement("div");
    item.className = "queue-item";
    item.innerHTML = `<strong>${track.title}</strong><span class="muted">${track.artist}</span>`;
    item.addEventListener("click", () => playTrackById(track.id));
    el.queueList.appendChild(item);
  });
}

function currentTrack() {
  return state.filteredTracks[state.currentIndex];
}

function handleSearch() {
  const term = el.searchInput.value.trim().toLowerCase();
  const playlist = state.playlists.find((p) => p.id === state.currentPlaylistId);
  state.filteredTracks = playlist.tracks.filter((track) => {
    return [track.title, track.artist, track.album].some((field) =>
      field.toLowerCase().includes(term)
    );
  });
  state.currentIndex = 0;
  renderTracks();
}

function sharePlaylist() {
  const playlist = state.playlists.find((p) => p.id === state.currentPlaylistId);
  const current = currentTrack();
  const text = `PulseWave Playlist: ${playlist.title} — Now playing: ${current ? current.title : "None"}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard")).catch(() => {
      prompt("Copy this text:", text);
    });
  } else {
    prompt("Copy this text:", text);
  }
}

function toggleQueue() {
  const open = el.queueDrawer.classList.toggle("open");
  el.queueDrawer.setAttribute("aria-hidden", String(!open));
}

function togglePlay() {
  if (!audio.src) {
    const track = state.filteredTracks[state.currentIndex];
    if (track) loadTrack(track, true);
    return;
  }
  if (state.isPlaying) {
    audio.pause();
    state.isPlaying = false;
  } else {
    audio.play().catch(() => showToast("Audio failed to load"));
    state.isPlaying = true;
  }
  updatePlayButtons();
}

function updateTimeline() {
  const current = audio.currentTime || 0;
  const duration = audio.duration || 0;
  el.currentTime.textContent = formatTime(current);
  el.duration.textContent = formatTime(duration);
  el.seekBar.value = duration ? (current / duration) * 100 : 0;
}

function seekFromInput() {
  const duration = audio.duration || 0;
  audio.currentTime = (el.seekBar.value / 100) * duration;
}

function toggleMute() {
  if (state.muted) {
    audio.muted = false;
    audio.volume = state.lastVolume;
    el.volumeBar.value = state.lastVolume;
    state.muted = false;
    el.muteBtn.textContent = "🔊";
  } else {
    state.lastVolume = audio.volume;
    audio.muted = true;
    state.muted = true;
    el.muteBtn.textContent = "🔇";
  }
}

function initVolume() {
  audio.volume = parseFloat(el.volumeBar.value);
}

audio.addEventListener("ended", () => {
  if (state.repeatMode === "one") {
    audio.currentTime = 0;
    audio.play();
  } else if (state.repeatMode === "all" || state.currentIndex < state.filteredTracks.length - 1) {
    nextTrack();
  } else {
    state.isPlaying = false;
    updatePlayButtons();
  }
});

audio.addEventListener("error", () => {
  showToast("Audio failed to load");
  nextTrack();
});

audio.addEventListener("timeupdate", updateTimeline);

el.mainPlayBtn.addEventListener("click", togglePlay);
el.playPauseBtn.addEventListener("click", togglePlay);
el.prevBtn.addEventListener("click", prevTrack);
el.nextBtn.addEventListener("click", nextTrack);
el.shuffleBtn.addEventListener("click", toggleShuffle);
el.repeatBtn.addEventListener("click", cycleRepeat);
el.seekBar.addEventListener("input", seekFromInput);
el.volumeBar.addEventListener("input", (event) => {
  audio.volume = parseFloat(event.target.value);
  if (audio.volume > 0) {
    state.lastVolume = audio.volume;
    audio.muted = false;
    state.muted = false;
    el.muteBtn.textContent = "🔊";
  }
});
el.muteBtn.addEventListener("click", toggleMute);
el.queueBtn.addEventListener("click", toggleQueue);
el.closeQueueBtn.addEventListener("click", toggleQueue);
el.shareBtn.addEventListener("click", sharePlaylist);
el.searchInput.addEventListener("input", handleSearch);
el.playerLikeBtn.addEventListener("click", () => {
  const current = currentTrack();
  if (!current) return;
  toggleLike(current.id);
  updatePlayerLike();
  renderTracks();
});

document.addEventListener("click", (event) => {
  document.querySelectorAll(".menu.open").forEach((menu) => {
    if (!menu.contains(event.target)) menu.classList.remove("open");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && document.activeElement !== el.searchInput) {
    event.preventDefault();
    togglePlay();
  }
  if (event.code === "ArrowRight") {
    audio.currentTime = Math.min(audio.currentTime + 5, audio.duration || audio.currentTime);
  }
  if (event.code === "ArrowLeft") {
    audio.currentTime = Math.max(audio.currentTime - 5, 0);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    el.searchInput.focus();
  }
});

function bootstrap() {
  renderPlaylists();
  setPlaylist(state.currentPlaylistId);
  initVolume();
}

bootstrap();
