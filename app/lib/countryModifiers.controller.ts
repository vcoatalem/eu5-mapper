import { IndexedDBReader } from "@/app/lib/indexeddb/indexeddb-reader";
import { IndexedDBWriter } from "@/app/lib/indexeddb/indexeddb-writer";
import { dbCountryModifiersTemplatesStoreName, dbDataKey, dbName, dbStoreNames, dbVersion } from "@/app/lib/indexeddb/indexeddb.const";
import { Observable } from "@/app/lib/observable";
import { ICountryModifierTemplate } from "@/app/lib/types/general";
import { VersionResolver } from "@/app/lib/versionResolver";

export interface ICountryModifiersTemplatesState {
  countryModifiersTemplates: Record<string, ICountryModifierTemplate> | null;
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
    const indexedDBReader = new IndexedDBReader(dbName, dbVersion, dbStoreNames);

    return indexedDBReader.get(dbCountryModifiersTemplatesStoreName, dbDataKey).then((countryModifiersTemplate) => {
      if (!countryModifiersTemplate || Object.entries(countryModifiersTemplate).length === 0) {
        return false;
      }
      else {
        console.log("[CountryModifiersController] Country modifiers template found in indexedDB", countryModifiersTemplate);
        this.subject.countryModifiersTemplates = countryModifiersTemplate as Record<string, ICountryModifierTemplate>;
        this.subject.isLoadingCountryModifiersTemplate = false;
        this.notifyListeners();
        return true;
      }
    });
  }

  private async fetchCountryModifiersTemplates(version: string): Promise<boolean> {
    const versionResolver = new VersionResolver();
    return versionResolver.loadVersionsManifest().then(() => {
      return versionResolver.resolveFileVersion("countryModifiersTemplate", version).then((resolvedVersion) => {
        const countryModifiersTemplatePath = versionResolver.getFilePath("countryModifiersTemplate", resolvedVersion);
        return fetch(countryModifiersTemplatePath).then((res) => res.json()).then((countryModifiersTemplate) => {
          this.subject.countryModifiersTemplates = countryModifiersTemplate as Record<string, ICountryModifierTemplate>;
          this.subject.isLoadingCountryModifiersTemplate = false;
          this.notifyListeners();
          return true;
        }).catch((error) => {
          console.error("[CountryModifiersController] Error fetching country modifiers template from server", error);
          return false;
        });
      }).catch((error) => {
        console.error("[CountryModifiersController] Error resolving file version", error);
        return false;
      });
    }).catch((error) => {
      console.error("[CountryModifiersController] Error loading versions manifest", error);
      return false;
    });
  }

  public async init(version: string): Promise<void> {

    const loadedFromIndexedDB = await this.loadCountryModifiersTemplateFromIndexedDB();
    if (loadedFromIndexedDB) {
      return;
    }
    else {
      const fetched = await this.fetchCountryModifiersTemplates(version);
      if (fetched) {
        const indexedDBWriter = new IndexedDBWriter(dbName, dbVersion, dbStoreNames);
        indexedDBWriter.put(dbCountryModifiersTemplatesStoreName, dbDataKey, this.subject.countryModifiersTemplates).then(() => {
          console.log("[CountryModifiersController] Country modifiers templates set from server and persisted to indexedDB");
        }).catch((error: unknown) => {
          console.error("[CountryModifiersController] Error persisting country modifiers templates to indexedDB", error);
        });
        return;
      }
      else {
        throw new Error("[CountryModifiersController] Could not set templates");
      }
    }
  }

  public addModifierTemplate(template: ICountryModifierTemplate): void {
    if (!this.subject.countryModifiersTemplates) {
      return;
    }
    this.subject.countryModifiersTemplates[template.name] = template;
    this.notifyListeners();
  }
}

export const countryModifiersTemplatesController = new CountryModifiersTemplatesController();