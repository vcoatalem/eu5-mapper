import { IndexedDBReader } from "@/app/lib/indexeddb/indexeddb-reader";
import { IndexedDBWriter } from "@/app/lib/indexeddb/indexeddb-writer";
import {
  dbCountryModifiersTemplatesStoreName,
  dbDataKey,
  dbName,
  dbStoreNames,
  dbVersion,
} from "@/app/lib/indexeddb/indexeddb.const";
import { Observable } from "@/app/lib/observable";
import { GameDataLoaderHelper } from "@/app/lib/gameDataLoader.helper";
import { CountryModifierTemplate } from "@/app/lib/types/countryModifiers";

export interface ICountryModifiersTemplatesState {
  countryModifiersTemplates: Record<string, CountryModifierTemplate> | null;
  isLoadingCountryModifiersTemplate: boolean;
}

class CountryModifiersTemplatesController extends Observable<ICountryModifiersTemplatesState> {
  constructor() {
    super();
    this.subject = {
      countryModifiersTemplates: null,
      isLoadingCountryModifiersTemplate: true,
    };
  }

  private async loadCountryModifiersTemplateFromIndexedDB(): Promise<boolean> {
    const indexedDBReader = new IndexedDBReader(
      dbName,
      dbVersion,
      dbStoreNames,
    );

    return indexedDBReader
      .get(dbCountryModifiersTemplatesStoreName, dbDataKey)
      .then((countryModifiersTemplate) => {
        if (
          !countryModifiersTemplate ||
          Object.entries(countryModifiersTemplate).length === 0
        ) {
          return false;
        } else {
          console.log(
            "[CountryModifiersController] Country modifiers template found in indexedDB",
            countryModifiersTemplate,
          );
          this.subject.countryModifiersTemplates =
            countryModifiersTemplate as Record<string, CountryModifierTemplate>;
          this.subject.isLoadingCountryModifiersTemplate = false;
          this.notifyListeners();
          return true;
        }
      });
  }

  private async fetchCountryModifiersTemplates(
    version: string,
  ): Promise<boolean> {
    return GameDataLoaderHelper.loadManifestForVersion(version)
      .then((manifest) =>
        GameDataLoaderHelper.loadGameDataFileForVersion(
          version,
          "countryModifiersTemplate",
          manifest,
        ),
      )
      .then((countryModifiersTemplate) => {
        this.subject.countryModifiersTemplates = countryModifiersTemplate;
        this.subject.isLoadingCountryModifiersTemplate = false;
        this.notifyListeners();
        return true;
      })
      .catch((error) => {
        console.error(
          "[CountryModifiersController] Error loading country modifiers template",
          error,
        );
        return false;
      });
  }

  public async init(version: string): Promise<void> {
    const loadedFromIndexedDB =
      await this.loadCountryModifiersTemplateFromIndexedDB();
    if (loadedFromIndexedDB) {
      return;
    } else {
      const fetched = await this.fetchCountryModifiersTemplates(version);
      if (fetched) {
        const indexedDBWriter = new IndexedDBWriter(
          dbName,
          dbVersion,
          dbStoreNames,
        );
        indexedDBWriter
          .put(
            dbCountryModifiersTemplatesStoreName,
            dbDataKey,
            this.subject.countryModifiersTemplates,
          )
          .then(() => {
            console.log(
              "[CountryModifiersController] Country modifiers templates set from server and persisted to indexedDB",
            );
          })
          .catch((error: unknown) => {
            console.error(
              "[CountryModifiersController] Error persisting country modifiers templates to indexedDB",
              error,
            );
          });
        return;
      } else {
        this.subject.isLoadingCountryModifiersTemplate = false;
        this.notifyListeners();
        throw new Error("[CountryModifiersController] Could not set templates");
      }
    }
  }

  public addModifierTemplate(template: CountryModifierTemplate): void {
    if (!this.subject.countryModifiersTemplates) {
      return;
    }
    this.subject.countryModifiersTemplates[template.name] = template;
    this.notifyListeners();
  }
}

export const countryModifiersTemplatesController =
  new CountryModifiersTemplatesController();
