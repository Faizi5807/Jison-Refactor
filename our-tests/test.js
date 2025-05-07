const parser = require("./calc");

const testInputs = [
  "start: ADD 1 2 3", // Addition
  "LOD 5 start 8", // Load with label
  "JMP 0 1 2", // Jump
  "SUB 4 start 2", // Subtract with label
  "MUL 3 2 1", // Multiply
  "STR 7 8 9", // Store
  "BEQ 4 5 6", // Branch if equal
  "BLT 3 2 1", // Branch if less than
  "RDN 4", // Read number
  "PTN 5", // Print number
  "HLT 0", // Halt
];

console.log("Running tests with assembly-like inputs:\n");

testInputs.forEach((input, index) => {
  try {
    console.log(`Test #${index + 1} | Input: "${input}"`);
    const result = parser.parse(input);
    console.log("Parsed successfully:", result, "\n");
  } catch (e) {
    console.error(`Error in Test #${index + 1}: ${e.message}\n`);
  }
});
