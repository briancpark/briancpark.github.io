function generateThought() {
    var thoughts = ["Placeholder for the number of days I coded",
                    "Let’s Make the World Better with Software",
                    "#QuantumSupremacy",
                    "#Quantum",
                    "#QuantumComputing",
                    "Student",
                    "Aspiring Software Engineer",
                    "Go Bears!",
                    "UC Berkeley",
                    "Not Your Average Techie",
                    "Artificial Intelligence",
                    "Machine Learning",
                    "Computer Science",
                    "안녕!",
                    "你好!",
                    "#Processing",
                    "Software Engineering",
                    "Software Development",
                    "#opensource",
                    "Coffee. Code. Sleep. Repeat.",
                    "#DarkModeEverything"];

    index = Math.floor(Math.random() * thoughts.length);

    if (index == 0) {
        var daySinceFirstCode = new Date("01/22/2019");
        var todayDate = new Date();
        var time = todayDate.getTime() - daySinceFirstCode.getTime();
        var days = Math.floor(time / (1000 * 3600 * 24));
        return "Coded For " + days + " Days Straight";
    } else {
        return thoughts[index];
    }
}

