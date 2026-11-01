import "dotenv/config";
import { pipeline } from "@huggingface/transformers";
const model = process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
if (model === "lexical") {
  console.log("Lexical analysis selected; no model download needed.");
  process.exit(0);
}
console.log(
  `Downloading ${model}, q8 weights (~23 MB plus tokenizer files). Model license: Apache-2.0 for the default MiniLM model. Review a different model's license before changing it.`,
);
const extractor = await pipeline("feature-extraction", model, {
  cache_dir: process.env.MODEL_CACHE_DIR || ".model-cache",
  dtype: "q8",
  device: "cpu",
  progress_callback: (e) => {
    if (e.status === "progress")
      process.stdout.write(`\r${e.file}: ${Math.round(e.progress)}%  `);
    else if (e.status === "done") console.log(`\n${e.file}: cached`);
  },
});
const output = await extractor(["Chat is discussing the next game"], {
  pooling: "mean",
  normalize: true,
});
if (output.dims[1] !== 384) throw new Error("Unexpected embedding dimensions");
console.log(
  "\nVerified a normalized 384-dimensional embedding. Restart the server to enable semantic grouping.",
);
