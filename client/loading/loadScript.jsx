//list of facts 
const facts = [
    "Chewing gum is heavily restricted in Singapore, with exceptions for approved dental and medicinal gum",
    "fact 2",
    "fact 3",
    "fact 4",
    "fact 5"
]

//current fact index
let currentFact = 0;
const factText = document.getElementById("fact-text");

//time
setInterval(() => {
    currentFact = (currentFact + 1) % facts.length;
    factText.textContent = facts[currentFact];
}, 5000); //change every 5 secs