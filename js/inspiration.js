const daySinceFirstCode = new Date('01/22/2019');
const todayDate = new Date();
const time = todayDate.getTime() - daySinceFirstCode.getTime();
const days = Math.floor(time / (1000 * 3600 * 24));
const codedDaysString = 'Coded For ' + days + ' Days Straight';

/* eslint-disable max-len */
const thoughts = [
    codedDaysString,
    'Let’s Make the World Better with Software',
    '안녕!',
    '你好!',
    'こんにちは!',
    'Software Engineer',
    '❤️ open source',
    'I ❤️ GitHub',
    'Coffee. Code. Sleep. Repeat.',
    '#DarkModeEverything',
    'On Claude 9',
    'Addicted to Claude Code',
    'Addicted to making code go fast',
    'Addicted to making code go fast, and coding fast with LLMs',
    'Addicted to making code go fast 🏎️💨',
    'Addicted to making code go brrr',
    'Addicted to making code go zoom zoom',
    'Addicted to making code go vroom vroom',
    'Code is cheap, show me the prompt',
    'This is Perlin Noise',
    'Perlin Noise',
    'Perlin Noise is Cool',
    'hello world.',
    'Hello World!',
];

// Shuffle the thoughts
thoughts.sort(function() {
    return 0.5 - Math.random();
});

const options = {
    strings: thoughts,
    typeSpeed: 25,
    backSpeed: 5,
    backDelay: 2000,
    loop: true,
    showCursor: false,
};

// eslint-disable-next-line no-unused-vars
const typed = new Typed('#quote', options);

// Heartbeat: each typed character pulses out particles from its own position,
// each deleted character despawns roaming particles (typed ones stick around).
(function() {
    const quote = document.getElementById('quote');
    if (!quote) return;
    const PARTICLES_PER_CHAR = 22;
    let lastLength = quote.textContent.length;

    function textRect(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return null;
        return rect;
    }

    const observer = new MutationObserver(() => {
        const newLength = quote.textContent.length;
        const delta = newLength - lastLength;
        if (delta === 0) return;
        lastLength = newLength;

        if (delta > 0 && typeof addParticles === 'function') {
            const rect = textRect(quote) || quote.getBoundingClientRect();
            const cx = rect.left + window.scrollX + rect.width / 2;
            const cy = rect.top + window.scrollY + rect.height / 2;
            // Spread across the text width so particles emerge from the
            // whole word, with a tighter vertical spread.
            const spreadX = Math.max(rect.width / 2, 20);
            const spreadY = Math.max(rect.height / 2, 10);
            addParticles(delta * PARTICLES_PER_CHAR, cx, cy, spreadX, spreadY);
        } else if (delta < 0 && typeof removeParticles === 'function') {
            removeParticles(-delta * PARTICLES_PER_CHAR);
        }
    });

    observer.observe(quote, {
        childList: true,
        subtree: true,
        characterData: true,
    });
})();
