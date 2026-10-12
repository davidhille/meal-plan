interface PuterAI {
  txt2img(
    prompt: string,
    options?: { model?: string; quality?: string }
  ): Promise<HTMLImageElement>;
}

interface Puter {
  ai: PuterAI;
}

declare const puter: Puter;
