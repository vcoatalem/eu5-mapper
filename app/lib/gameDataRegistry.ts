import { ILocationDataMap } from "./types";

export class GameDataRegistry {
  private static instance: GameDataRegistry;
  private locationData: ILocationDataMap | null = null;
  private isLoading: boolean = true;
  private error: string | null = null;
  private loadPromise: Promise<void>;

  private constructor() {
    this.loadPromise = this.initializeData();
  }

  private async initializeData(): Promise<void> {
    try {
      await this.loadLocationData("test/00_default.txt");
      this.isLoading = false;
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to load game data";
      this.isLoading = false;
      console.error("[GameDataRegistry] Initialization error:", this.error);
    }
  }

  public static getInstance(): GameDataRegistry {
    if (!GameDataRegistry.instance) {
      GameDataRegistry.instance = new GameDataRegistry();
    }
    return GameDataRegistry.instance;
  }

  public async waitForInitialization(): Promise<void> {
    await this.loadPromise;
  }

  public isReady(): boolean {
    return !this.isLoading && !this.error;
  }

  public getError(): string | null {
    return this.error;
  }

  public getIsLoading(): boolean {
    return this.isLoading;
  }

  public setLocationData(data: ILocationDataMap): void {
    this.locationData = data;
    if (data) {
      console.log("[GameDataRegistry] Location data updated");
    } else {
      console.log("[GameDataRegistry] Location data cleared");
    }
  }

  public getLocationData(): ILocationDataMap | null {
    return this.locationData;
  }

  public hasLocationData(): boolean {
    return this.locationData !== null;
  }

  public async loadLocationData(
    dataPath: string = "test/00_default.txt"
  ): Promise<void> {
    try {
      const rawData = await this.fetchData(dataPath);
      if (!rawData) {
        throw new Error("Could not fetch game data");
      }
      const parsedData = this.parseLocationData(rawData);
      this.setLocationData(parsedData);
    } catch (error) {
      console.error("[GameDataRegistry] Failed to load location data:", error);
      throw error;
    }
  }

  private async fetchData(dataPath: string): Promise<string | null> {
    try {
      const response = await fetch(dataPath);
      const data = await response.text();
      return data;
    } catch (error) {
      console.error("[GameDataRegistry] Failed to fetch data:", error);
      return null;
    }
  }

  private parseLocationData(data: string): ILocationDataMap {
    const lines = data.split("\n");
    const res: ILocationDataMap = {};

    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      const [locationName, rest] = line.split("=");
      if (!locationName || !rest) continue;

      const hexCode = rest.split("#")[0].trim();
      if (!hexCode) continue;

      res[hexCode] = {
        name: locationName.trim(),
      };
    }

    return res;
  }

  public clear(): void {
    this.locationData = null;
    console.log("[GameDataRegistry] Location data cleared");
  }
}
