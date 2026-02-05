const required = ["OPENAI_API_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log("Missing env vars:", missing.join(", "));
  process.exit(1);
}
console.log("All required env vars are set.");
