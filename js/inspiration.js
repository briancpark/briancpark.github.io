function generateThought() {
    var thoughts = ["Placeholder for the number of days I coded",
                    "Let’s Make the World Better with Software",
                    "#QuantumSupremacy",
                    "#Quantum",
                    "#QuantumComputing",
                    "Student",
                    "Go Bears!",
                    "UC Berkeley",
                    "Not Your Average Techie",
                    "Artificial Intelligence",
                    "Machine Learning",
                    "Computer Science",
                    "안녕!",
                    "你好!",
                    "Software Engineer",
                    "Software Developer",
                    "❤️ open source",
                    "Coffee. Code. Sleep. Repeat.",
                    "#DarkModeEverything",
                    "hello world.",
                    "Hello World!",
                    "print(\"Hello World!\")"];

    index = Math.floor(Math.random() * thoughts.length);

    if (index == 0) {
        var daySinceFirstCode = new Date("01/22/2019");
        var todayDate = new Date();
        var time = todayDate.getTime() - daySinceFirstCode.getTime();
        var days = Math.floor(time / (1000 * 3600 * 24));
        document.write("Coded For " + days + " Days Straight");
    } else {
        document.write(thoughts[index]);
    }
}

generateThought()
