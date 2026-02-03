import { CompactGraph } from "@/app/lib/graph";
import { ParserHelper } from "@/app/lib/parser.helper";
import { ILocationIdentifier } from "@/app/lib/types/general";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

export const readReferenceFile = async (
  path: string,
): Promise<{
  countryCode: string;
  version: string;
  rulerAdministrativeAbility: number;
  data: Record<ILocationIdentifier, number>;
}> => {
  const f = await fs.readFileSync(path, "utf-8");
  const lines = f.split("\n");
  const headerLine = lines[0];
  
  // Parse header: location,proximity,<COUNTRY_CODE>,version:<VERSION>,admin_ability:<ADMIN_ABILITY>
  const headerParts = headerLine.split(",");
  const countryCode = headerParts[2];
  const versionPart = headerParts[3]; // version:<value>
  const version = versionPart.split(":")[1];
  const adminAbilityPart = headerParts[4]; // admin_ability:<value>
  const rulerAdministrativeAbility = Number(adminAbilityPart.split(":")[1]);
  
  const data = lines
    .slice(1) // skip header
    .filter((line) => line.trim().length > 0) // ignore empty lines
    .map((line) => line.trim().split(",") as [string, string])
    .reduce(
      (acc, [location, proximity]) => {
        acc[location] = Number(proximity);
        return acc;
      },
      {} as Record<ILocationIdentifier, number>,
    );
  
  return {
    countryCode,
    version,
    rulerAdministrativeAbility,
    data,
  };
};

export const readAdjacencyFile = async (
  path: string,
): Promise<CompactGraph> => {
  const adjacencyData = await fs.readFileSync(path, "utf-8");
  return ParserHelper.parseAdjacencyCSV(adjacencyData);
};

/**
 * Recursively finds all CSV files in the references folder
 * @param referencesFolderPath - Optional path to the references folder. Defaults to tests/pathfinding/references
 * @returns Array of file paths to all CSV files found in the references folder
 */
export const getAllReferenceFilePaths = (
  referencesFolderPath?: string,
): string[] => {
  const basePath = referencesFolderPath || path.join(
    process.cwd(),
    "tests/pathfinding/references",
  );
  
  const csvFiles: string[] = [];
  
  const findCsvFiles = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        findCsvFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".csv")) {
        csvFiles.push(fullPath);
      }
    }
  };
  
  if (fs.existsSync(basePath)) {
    findCsvFiles(basePath);
  }
  
  return csvFiles.sort();
};

export async function generateHtmlReport(
  country: string,
  version: string,
  results: Array<{
    location: ILocationIdentifier;
    expected: number;
    actual: number;
    difference: number;
  }>,
  toleratedDifference: number,
  unrecognisedLocations: ILocationIdentifier[] = [],
): Promise<void> {
  const goodCount = results.filter((r) => Math.abs(r.difference) <= toleratedDifference)
    .length;
  const totalCount = results.length;
  const badCount = totalCount - goodCount;
  const successRate = totalCount > 0
    ? ((goodCount / totalCount) * 100).toFixed(2)
    : "0.00";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pathfinding Test Results</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .stats {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    
    .stat-card {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      padding: 15px 25px;
      border-radius: 8px;
      min-width: 150px;
    }
    
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .stat-label {
      font-size: 0.9em;
      opacity: 0.9;
    }
    
    .content {
      padding: 30px;
    }
    
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }
    
    thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.5px;
    }
    
    th:nth-child(1) { width: 40%; }
    th:nth-child(2) { width: 15%; }
    th:nth-child(3) { width: 15%; }
    th:nth-child(4) { width: 15%; }
    th:nth-child(5) { width: 15%; }
    
    tbody tr {
      border-bottom: 1px solid #e5e7eb;
      transition: background-color 0.2s;
    }
    
    tbody tr:hover {
      background-color: #f9fafb;
    }
    
    tbody tr.perfect {
      background-color: #d1fae5;
    }
    
    tbody tr.good {
      background-color: #dbeafe;
    }
    
    tbody tr.warning {
      background-color: #fef3c7;
    }
    
    tbody tr.bad {
      background-color: #fee2e2;
    }
    
    tbody tr.unrecognised {
      background-color: #f3f4f6;
      opacity: 0.7;
    }
    
    td {
      padding: 12px 15px;
    }
    
    .location-name {
      font-weight: 600;
      color: #1f2937;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    
    .value {
      font-weight: 500;
      color: #374151;
    }
    
    .difference {
      font-weight: 700;
      font-size: 1.1em;
    }
    
    .difference.perfect {
      color: #059669;
    }
    
    .difference.good {
      color: #2563eb;
    }
    
    .difference.warning {
      color: #d97706;
    }
    
    .difference.bad {
      color: #dc2626;
    }
    
    .difference.too-high {
      color: #dc2626;
    }
    
    .difference.too-low {
      color: #ea580c;
    }
    
    .difference-indicator {
      margin-left: 4px;
      font-size: 0.9em;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-badge.perfect {
      background: #d1fae5;
      color: #059669;
    }
    
    .status-badge.good {
      background: #dbeafe;
      color: #2563eb;
    }
    
    .status-badge.warning {
      background: #fef3c7;
      color: #d97706;
    }
    
    .status-badge.bad {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .status-badge.unrecognised {
      background: #f3f4f6;
      color: #6b7280;
    }
    
    .footer {
      padding: 20px 30px;
      background: #f9fafb;
      text-align: center;
      color: #6b7280;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧭 Pathfinding Test Results</h1>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-value">${totalCount}</div>
          <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #059669;">${goodCount}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #dc2626;">${badCount}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${successRate}%</div>
          <div class="stat-label">Success Rate</div>
        </div>
        ${unrecognisedLocations.length > 0 ? `
        <div class="stat-card">
          <div class="stat-value" style="color: #6b7280;">${unrecognisedLocations.length}</div>
          <div class="stat-label">Unrecognised</div>
        </div>
        ` : ""}
      </div>
    </div>
    
    <div class="content">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Difference (Actual - Expected)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${results
              .map((result) => {
                const absDiff = Math.abs(result.difference);
                const getStatus = (absDiff: number) => {
                  if (absDiff === 0) return "perfect";
                  if (absDiff <= toleratedDifference) return "good";
                  if (absDiff <= toleratedDifference * 2) return "warning";
                  return "bad";
                };
                
                const status = getStatus(absDiff);
                const statusLabel =
                  status === "perfect"
                    ? "Perfect"
                    : status === "good"
                      ? "Good"
                      : status === "warning"
                        ? "Warning"
                        : "Failed";
                
                // Determine if actual is too high or too low
                const diffClass = result.difference === 0
                  ? status
                  : result.difference > 0
                    ? "too-high"
                    : "too-low";
                
                const diffIndicator = result.difference === 0
                  ? ""
                  : result.difference > 0
                    ? '<span class="difference-indicator">↑</span>'
                    : '<span class="difference-indicator">↓</span>';
                
                const diffSign = result.difference > 0 ? "+" : "";
                
                return `
              <tr class="${status}">
                <td class="location-name">${escapeHtml(result.location)}</td>
                <td class="value">${result.expected}</td>
                <td class="value">${result.actual}</td>
                <td class="difference ${diffClass}">${diffSign}${result.difference.toFixed(2)}${diffIndicator}</td>
                <td><span class="status-badge ${status}">${statusLabel}</span></td>
              </tr>
            `;
              })
              .join("")}
            ${unrecognisedLocations.length > 0
              ? unrecognisedLocations
                  .map(
                    (location) => `
              <tr class="unrecognised">
                <td class="location-name">${escapeHtml(location)}</td>
                <td class="value">—</td>
                <td class="value">—</td>
                <td class="difference unrecognised">—</td>
                <td><span class="status-badge unrecognised">Unrecognised</span></td>
              </tr>
            `,
                  )
                  .join("")
              : ""}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="footer">
      Generated on ${new Date().toLocaleString()} | 
      Results sorted by difference (closest matches first)
      ${unrecognisedLocations.length > 0
        ? ` | ${unrecognisedLocations.length} unrecognised location(s) from reference file`
        : ""}
    </div>
  </div>
</body>
</html>`;

const outputFolder = path.join(
  process.cwd(),
  "tests/pathfinding/output/",
  version.replaceAll('.', '_'),
);
  const outputPath = path.join(
     outputFolder,
    `${country.toLowerCase()}.html`,
  );
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  await fsPromises.writeFile(outputPath, html, "utf-8");
  console.log(`\n📊 HTML report generated: ${outputPath}`);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
