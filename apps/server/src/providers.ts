import type { EmbeddingProvider } from "./analysis.ts";
/** Loaded only inside the analysis worker. Never switches an existing centroid's space. */
export class MiniLMProvider implements EmbeddingProvider {
  readonly name: string;
  private constructor(
    model: string,
    private extractor: any,
  ) {
    this.name = "Semantic grouping · " + model;
  }
  static async load(model: string, cacheDir: string) {
    const { pipeline } = await import("@huggingface/transformers");
    const extractor = await pipeline("feature-extraction", model, {
      cache_dir: cacheDir,
      local_files_only: true,
      dtype: "q8",
      device: "cpu",
    });
    return new MiniLMProvider(model, extractor);
  }
  async embed(texts: string[]): Promise<number[][]> {
    const output = await this.extractor(texts, {
      pooling: "mean",
      normalize: true,
    });
    return output.tolist();
  }
}
