window.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    const music = document.querySelector('#music');
    const playButton = document.querySelector('#play');
    const pauseButton = document.querySelector('#pause');
    const volumeInput = document.querySelector('#volume');

    console.log(music, playButton, pauseButton, volumeInput);

    playButton.onclick = () => {
        console.log('playButton.addEventListener');
        music.play();
        let vol = 0 + volumeInput.value / 100;
        music.volume = vol;
        playButton.style.display = 'none';
        pauseButton.style.display = 'block';
    };

    pauseButton.onclick = () => {
        console.log('pauseButton.addEventListener');
        music.pause();
        playButton.style.display = 'block';
        pauseButton.style.display = 'none';
    };

    try {
        let currentVol = 0 + localStorage.getItem('currentVolume') || 0.8;
        volumeInput.value = Math.round(currentVol * 100);
        const changeVolEvent = new Event('change');
        volumeInput.dispatchEvent(changeVolEvent);
    } catch (error) {}

    volumeInput.onchange = () => {
        try {
            let vol = 0 + volumeInput.value / 100;
            music.volume = vol;
            localStorage.setItem('currentVolume', vol);
        } catch (error) {}
    };

    let isTyping = false;
    let typingTimeout = null;
    document.querySelectorAll('input').forEach((element) => {
        element.addEventListener('keydown', async () => {
            if (typingTimeout != null) {
                clearTimeout(typingTimeout);
            }
            isTyping = true;
            typingTimeout = setTimeout(() => {
                isTyping = false;
                typingTimeout = null;
            }, 500);
        });
    });

    window.addEventListener('keydown', (e) => {
        if (e.key == ' ' && e.target == document.body) return e.preventDefault();
        if (e.key == 'ArrowUp' || e.key == 'ArrowDown') e.preventDefault();
    });

    document.addEventListener('keyup', (e) => {
        if (e.key == ' ' || e.key == 'p') {
            if (isTyping) return;
            if (playButton.style.display == 'none') {
                music.pause();
                playButton.style.display = 'block';
                pauseButton.style.display = 'none';
            } else {
                music.play();
                let vol = 0 + volumeInput.value / 100;
                music.volume = vol;
                playButton.style.display = 'none';
                pauseButton.style.display = 'block';
            }
        }

        if (e.key == 'ArrowUp') {
            if (isTyping) return;
            let vol = parseInt(volumeInput.value);
            const event = new Event('change');
            if (vol < 95) {
                volumeInput.value = vol + 5;
                volumeInput.dispatchEvent(event);
            } else if (vol < 100) {
                volumeInput.value = ++vol;
                volumeInput.dispatchEvent(event);
            }
        }

        if (e.key == 'ArrowDown') {
            if (isTyping) return;
            let vol = parseInt(volumeInput.value);
            const event = new Event('change');
            if (vol > 5) {
                volumeInput.value = vol - 5;
                volumeInput.dispatchEvent(event);
            } else if (vol > 0) {
                volumeInput.value = --vol;
                volumeInput.dispatchEvent(event);
            }
        }
    });
});
