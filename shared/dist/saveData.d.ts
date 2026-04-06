import { z } from "zod";
export declare const SaveParsingTaskName: z.ZodEnum<{
    version: "version";
    locationsIndexList: "locationsIndexList";
    countryCode: "countryCode";
    countryTags: "countryTags";
    countryCodeIndex: "countryCodeIndex";
    countryData: "countryData";
    ownedLocations: "ownedLocations";
    buildingsRaw: "buildingsRaw";
    buildings: "buildings";
}>;
export type SaveParsingTaskName = z.infer<typeof SaveParsingTaskName>;
export declare const SaveParsingTaskLabel: Record<SaveParsingTaskName, string>;
export declare const ZodSaveParsingTaskResult: z.ZodObject<{
    success: z.ZodBoolean;
    skipped: z.ZodOptional<z.ZodBoolean>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SaveParsingTaskResult = z.infer<typeof ZodSaveParsingTaskResult>;
export declare const ZodSaveData: z.ZodObject<{
    data: z.ZodObject<{
        version: z.ZodNullable<z.ZodString>;
        countryCode: z.ZodNullable<z.ZodString>;
        ownedLocations: z.ZodArray<z.ZodString>;
        locationBuildings: z.ZodRecord<z.ZodString, z.ZodObject<{
            name: z.ZodString;
            level: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    tasks: z.ZodRecord<z.ZodEnum<{
        version: "version";
        locationsIndexList: "locationsIndexList";
        countryCode: "countryCode";
        countryTags: "countryTags";
        countryCodeIndex: "countryCodeIndex";
        countryData: "countryData";
        ownedLocations: "ownedLocations";
        buildingsRaw: "buildingsRaw";
        buildings: "buildings";
    }>, z.ZodObject<{
        success: z.ZodBoolean;
        skipped: z.ZodOptional<z.ZodBoolean>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SaveData = z.infer<typeof ZodSaveData>;
