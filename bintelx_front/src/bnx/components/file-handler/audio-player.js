// bnx/components/file-handler/audio-player.js
import { renderTemplate } from '@bnx/utils.js';
import audioPlayerTpl from './audio-player.tpls';

function formatTime(s) {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Renderiza HTML de audio player para un archivo
 */
export function renderAudioPlayer(data) {
    return renderTemplate(audioPlayerTpl, {
        fileName: data.fileName || data.original_name || data.name || 'Audio',
        fileUrl: data.fileUrl || `/api/files/documents/${data.document_id}/download?inline`,
        mimeType: data.mimeType || data.mime_type || 'audio/mpeg',
        fileSize: data.fileSize || ''
    });
}

/**
 * Bind eventos play/pause/seek en un elemento .fh-audio-player
 */
export function bindAudioPlayer(player) {
    const audio = player.querySelector('audio');
    if (!audio || audio._bound) return;
    audio._bound = true;

    const playIcon = player.querySelector('.fh-audio-icon-play');
    const pauseIcon = player.querySelector('.fh-audio-icon-pause');
    const spinner = player.querySelector('.fh-audio-spinner');
    const progress = player.querySelector('.fh-audio-progress');
    const thumb = player.querySelector('.fh-audio-thumb');
    const timeEl = player.querySelector('.fh-audio-time');
    const seekbar = player.querySelector('.fh-audio-seekbar');
    const toggleBtn = player.querySelector('.fh-audio-toggle');

    function showIcon(state) {
        playIcon.classList.toggle('hidden', state !== 'play');
        pauseIcon.classList.toggle('hidden', state !== 'pause');
        if (spinner) spinner.classList.toggle('hidden', state !== 'loading');
    }

    audio.addEventListener('loadedmetadata', () => {
        timeEl.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        if (!audio.duration || !isFinite(audio.duration)) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${pct}%`;
        if (thumb) thumb.style.left = `${pct}%`;
        timeEl.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    audio.addEventListener('waiting', () => showIcon('loading'));
    audio.addEventListener('canplay', () => showIcon(audio.paused ? 'play' : 'pause'));

    audio.addEventListener('play', () => {
        showIcon('pause');
        toggleBtn.title = 'Pausar';
    });

    audio.addEventListener('pause', () => {
        showIcon('play');
        toggleBtn.title = 'Reproducir';
    });

    audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        showIcon('play');
        progress.style.width = '0%';
        if (thumb) thumb.style.left = '0%';
        timeEl.textContent = formatTime(audio.duration);
        toggleBtn.title = 'Reproducir';
    });

    toggleBtn.addEventListener('click', () => {
        // Pause all other players in the document
        document.querySelectorAll('.fh-audio-player audio').forEach(a => {
            if (a !== audio && !a.paused) a.pause();
        });
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    });

    seekbar.addEventListener('click', (e) => {
        if (!audio.duration) return;
        const rect = seekbar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = pct * audio.duration;
    });
}

/**
 * Inicializa todos los audio players dentro de un contenedor
 */
export function initAudioPlayers(container) {
    container.querySelectorAll('.fh-audio-player').forEach(bindAudioPlayer);
}
