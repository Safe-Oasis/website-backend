const add3dHoverAnimation = (constrain, mouseOverContainer, ex1Layer) => {
    function transforms(x, y, el) {
        let box = el.getBoundingClientRect();
        let calcX = -(y - box.y - box.height / 2) / constrain;
        let calcY = (x - box.x - box.width / 2) / constrain;
        return 'perspective(100px) ' + '   rotateX(' + calcX + 'deg) ' + '   rotateY(' + calcY + 'deg) ';
    }

    function transformElement(el, xyEl) {
        el.style.transform = transforms.apply(null, xyEl);
    }

    mouseOverContainer.onmousemove = function (e) {
        let xy = [e.clientX, e.clientY];
        let position = xy.concat([ex1Layer]);
        window.requestAnimationFrame(function () {
            transformElement(ex1Layer, position);
        });
    };
};

window.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    const music = document.querySelector('#music');
    const playButton = document.querySelector('#play');
    const pauseButton = document.querySelector('#pause');
    const volumeInput = document.querySelector('#volume');

    playButton.onclick = () => {
        music.play();
        let vol = 0 + volumeInput.value / 100;
        music.volume = vol;
        playButton.style.display = 'none';
        pauseButton.style.display = 'block';
    };

    pauseButton.onclick = () => {
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

    window.addEventListener('keyup', (e) => {
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

    add3dHoverAnimation(220, document.getElementById('loginForm'), document.getElementById('ex1-layer'));
    add3dHoverAnimation(250, document.getElementById('player'), document.getElementById('container-player'));
});
