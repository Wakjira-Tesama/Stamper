const fs = require('fs');
const { execSync } = require('child_process');

const startDate = new Date('2026-03-02T09:00:00');
const endDate = new Date('2026-03-08T09:00:00'); // Stop at current date roughly
const repoPath = process.cwd();

const commitMessages = [
    "Initial commit",
    "Add dashboard layout",
    "Implement signature storage logic",
    "Fix Word to PDF conversion alignment",
    "Update UI styling for staff dashboard",
    "Add messaging system between staff and admin",
    "Refactor stamp handling components",
    "Improve OCR accuracy for handwritten signatures",
    "Add persistent signature library feature",
    "Fix layout issues on mobile devices",
    "Optimize bundle size for faster loading",
    "Add unit tests for signature validation",
    "Update README with installation instructions",
    "Implement departmental message filtering",
    "Fix crash in WordEditor component",
    "Add glassmorphism effects to sidebar",
    "Improve error handling for file uploads",
    "Update dependencies to latest versions",
    "Refactor state management using Context API",
    "Add dark mode support to Dashboard",
    "Fix accessibility issues in forms",
    "Add custom hooks for stamp retrieval",
    "Improve performance of PDF rendering",
    "Add search functionality to signature library",
    "Fix bug in signature scaling",
    "Update tailwind configuration",
    "Add tooltips for better UX",
    "Implement session persistence for logins",
    "Add export to PNG feature",
    "Improve document preview performance",
    "Refactor navigation component",
    "Add support for more image formats",
    "Fix z-index issues in modals",
    "Update type definitions for stamps",
    "Improve security of API endpoints",
    "Add loading skeletons for better UX",
    "Fix memory leak in Dashboard",
    "Add confirmation dialogs for deletions",
    "Update favicon and brand assets",
    "Improve logging for backend errors"
];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Initial commit logic - add all files
try {
    execSync('git add .', { cwd: repoPath });
} catch (e) {
    console.error("Git add failed", e.message);
}

let currentDate = new Date(startDate);
const now = new Date();

while (currentDate <= endDate && currentDate <= now) {
    const dailyCommits = getRandomInt(8, 17);
    console.log(`Generating ${dailyCommits} commits for ${currentDate.toDateString()}`);

    // Create a list of times and sort them to ensure chronological order within the day
    let times = [];
    for (let i = 0; i < dailyCommits; i++) {
        times.push({
            h: getRandomInt(9, 21),
            m: getRandomInt(0, 59),
            s: getRandomInt(0, 59)
        });
    }
    times.sort((a, b) => (a.h * 100 + a.m) - (b.h * 100 + b.m));

    for (let i = 0; i < dailyCommits; i++) {
        const time = times[i];
        const commitDate = new Date(currentDate);
        commitDate.setHours(time.h, time.m, time.s);

        if (commitDate > now) break;

        const dateStr = commitDate.toISOString();
        const message = getRandomElement(commitMessages);
        
        const dummyContent = `Update at ${dateStr}: ${message}\n`;
        fs.appendFileSync(`${repoPath}/.git_history_dummy`, dummyContent);
        
        try {
            execSync('git add .git_history_dummy', { cwd: repoPath });
            const env = { 
                ...process.env, 
                GIT_AUTHOR_DATE: dateStr, 
                GIT_COMMITTER_DATE: dateStr 
            };
            execSync(`git commit -m "${message}"`, { cwd: repoPath, env, stdio: 'inherit' });
        } catch (e) {
            console.error(`Commit failed at ${dateStr}`, e.message);
        }
    }

    currentDate.setDate(currentDate.getDate() + 1);
}

console.log("Finished generating commits.");
