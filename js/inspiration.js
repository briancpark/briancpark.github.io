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
    'Addicted to making code go fast 🏎️💨',
    'Addicted to making code go brrr',
    'Addicted to making code go zoom zoom',
    'Addicted to making code go vroom vroom',
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
