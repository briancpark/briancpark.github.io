/*
 * @author Brian Park
 * @link https://www.briancpark.com
 *
 */

//Add thoughts or inspirations as desired
function generateThought() {
    var thoughts = ["Placeholder for the number of days I coded",
        "Let’s Make the World Better with Software",
        "#QuantumSupremacy",
        "#GoQuantum",
        "#Quantum",
        "#QuantumComputing",
        "Student",
        "Aspiring Software Engineer",
        "Go Bears!",
        "UC Berkeley",
        "Not Your Average Techie",
        "#SWE",
        "#AI",
        "Artificial Intelligence",
        "Machine Learning",
        "Computer Science",
        "#ArtificialIntelligence",
        "#MachineLearning",
        "#ComputerScience",
        "#CS",
        "안녕!",
        "你好!",
        "#Linux",
        "#Processing",
        "Software Engineer",
        "Software Development",
        "#opensource",
        "O(1)",
        "Developer",
        "Coffee. Code. Sleep. Repeat.",
        "#quantum",
        "#QuantumGoldRush",
        "#DarkModeEverything"];

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

generateThought();

