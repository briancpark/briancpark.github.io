function generateThought() {
    var thoughts = ["Placeholder for the number of days I coded",
        "Let’s Make the World Better with Software",
        "Student",
        "Go Bears!",
        "UC Berkeley",
        "Not Your Average Techie",
        "Artificial Intelligence",
        "Machine Learning",
        "Kaggler",
        "Computer Science",
        "안녕!",
        "你好!",
        "Software Engineer",
        "Software Developer",
        "❤️ open source",
        "Coffee. Code. Sleep. Repeat.",
        "#DarkModeEverything",
        "Computer Architecture",
        "#ComputerArchitecture",
        "RISC-V",
        "#parallelism",
        "Linux Enthusiast",
        "macOS",
        "Educator",
        "NumS",
        "",
        "SWE Intern @ ",
        "Python",
        "C",
        "C++",
        "Class of 2022",
        "UC Berkeley 2022",
        "ARM",
        "Apple Intern",
        "hello world.",
        "Hello World!",
        "he/him/his",
        "North Carolina State University",
        "NCSU",
        "NCSU 2024",
        "print(\"Hello World!\")",
        "Peak Performance",
        "Performance Addict",
        "Speed",
        "High Performance Computing",
        "High Performance",
        "My name is Speed",
        "My name is <i>Speed</i>",
        "I am Speed",
        "I am <i>Speed</i>",
        "AVX-512",
        "AVX2",
        "<tt>ZMM0</tt>",
        "<tt>XMM0</tt>",
        "<tt>YMM0</tt>",
        "<tt>vector</tt>",
        "<tt>malloc</tt>",
        "<tt>mkl_malloc</tt>",
        "<tt>#pragma omp for</tt>",
        "<tt>_mm512_fmadd_pd</tt>",
        "<tt>MPI_Send</tt>",
        "<tt>MPI_Recv</tt>",
        "<tt>MPI_Recv</tt>",
        "<tt>cudaMalloc</tt>",
        "GEMM",
        "NCCL",
        "MPI",
        "OpenMP",
        "SIMD",
        "GPU",
        "CUDA",
        "ASM",
        "Slurm",
        "HPC",
        "NEON"
    ];

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
