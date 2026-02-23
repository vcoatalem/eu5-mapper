import { CompactGraph } from "@/app/lib/graph";
import { ParserHelper } from "@/app/lib/parser.helper";
import { ILocationIdentifier } from "@/app/lib/types/general";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import crypto from "crypto";

export const readReferenceFile = async (
  path: string,
): Promise<{
  countryCode: string;
  version: string;
  rulerAdministrativeAbility: number;
  modifiers: string[];
  data: Record<ILocationIdentifier, number>;
}> => {
  const f = await fs.readFileSync(path, "utf-8");
  const lines = f.split("\n");
  const headerLine = lines[0];

  const headerParts = headerLine.split(",");
  const countryCode = headerParts[2];
  const versionPart = headerParts[3]; // version:<value>
  const version = versionPart.split(":")[1];
  const fifthColumn = headerParts[4]; // admin_ability:<value>;modifiers:<mod1>|<mod2>|...
  const [adminAbilityPart, modifiersPart] = fifthColumn.split(";");
  const rulerAdministrativeAbility = Number(adminAbilityPart.split(":")[1]);
  const modifiersRaw = modifiersPart?.startsWith("modifiers:")
    ? modifiersPart.slice("modifiers:".length)
    : modifiersPart ?? "";
  const modifiers = modifiersRaw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

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
    modifiers,
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
  const basePath =
    referencesFolderPath ||
    path.join(process.cwd(), "tests/pathfinding/references");

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
  const totalCount = results.length;

  const goodCount = results.filter(
    (r) => Math.abs(r.difference) <= toleratedDifference,
  ).length;
  const badCount = totalCount - goodCount;
  const successRate =
    totalCount > 0 ? ((goodCount / totalCount) * 100).toFixed(2) : "0.00";

  let signCorrectCount = 0;
  for (const r of results) {
    const expectedPositive = r.expected > 0;
    const actualPositive = r.actual > 0;
    if (expectedPositive === actualPositive) {
      signCorrectCount += 1;
    }
  }
  const signAccuracyStr =
    totalCount > 0
      ? ((signCorrectCount / totalCount) * 100).toFixed(2)
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

    th.sortable {
      cursor: pointer;
      user-select: none;
      position: relative;
    }

    th.sortable::after {
      content: '▲▼';
      font-size: 0.7em;
      opacity: 0.6;
      margin-left: 6px;
    }

    th.sortable[data-sort-dir="asc"]::after {
      content: '▲';
    }

    th.sortable[data-sort-dir="desc"]::after {
      content: '▼';
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="text-align: left; margin-bottom: 20px;">
        <a href="index.html" style="color: white; text-decoration: none; font-size: 1em; padding: 10px 20px; background: rgba(255, 255, 255, 0.2); border-radius: 6px; display: inline-block; transition: background 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">← Back to Index</a>
      </div>
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
          <div class="stat-label">Proximity Accuracy</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${signAccuracyStr}%</div>
          <div class="stat-label">Sign Accuracy</div>
        </div>
        ${
          unrecognisedLocations.length > 0
            ? `
        <div class="stat-card">
          <div class="stat-value" style="color: #6b7280;">${unrecognisedLocations.length}</div>
          <div class="stat-label">Unrecognised</div>
        </div>
        `
            : ""
        }
      </div>
    </div>
    
    <div class="content">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="sortable" data-sort-type="string">Location</th>
              <th class="sortable" data-sort-type="number" data-default-sort="desc">Expected</th>
              <th class="sortable" data-sort-type="number">Actual</th>
              <th class="sortable" data-sort-type="number">Difference (Actual - Expected)</th>
              <th class="sortable" data-sort-type="string">Status</th>
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

                const diffIndicator =
                  result.difference === 0
                    ? ""
                    : result.difference > 0
                      ? '<span class="difference-indicator">↑</span>'
                      : '<span class="difference-indicator">↓</span>';

                const diffSign = result.difference > 0 ? "+" : "";

                // Compute color for difference text based on absolute difference of the error:
                // 0 .. toleratedDifference     -> green -> yellow
                // toleratedDifference .. 20    -> yellow -> red
                // > 20                         -> dark purple
                const clampedAbsDiff = Math.max(0, absDiff);
                let redComponent: number;
                let greenComponent: number;
                let blueComponent = 0;

                const greenToYellowMax = toleratedDifference;
                const yellowToRedMax = 20;

                if (clampedAbsDiff <= greenToYellowMax) {
                  // 0..toleratedDifference: darker green -> darker yellow for better contrast on light backgrounds
                  const denom = greenToYellowMax > 0 ? greenToYellowMax : 1;
                  const t = clampedAbsDiff / denom; // 0..1
                  const baseRed = Math.round(255 * t); // 0 -> 255
                  const baseGreen = 255; // always 255
                  const factor = 0.7; // darken
                  redComponent = Math.round(baseRed * factor);
                  greenComponent = Math.round(baseGreen * factor);
                } else if (clampedAbsDiff <= yellowToRedMax) {
                  // toleratedDifference..20: darker yellow -> darker red
                  const span = Math.max(1, yellowToRedMax - greenToYellowMax);
                  const t = (clampedAbsDiff - greenToYellowMax) / span; // 0..1
                  const baseRed = 255; // always 255
                  const baseGreen = Math.round(255 * (1 - t)); // 255 -> 0
                  const factor = 0.7; // darken
                  redComponent = Math.round(baseRed * factor);
                  greenComponent = Math.round(baseGreen * factor);
                } else {
                  // > 20: dark purple to highlight very bad differences
                  redComponent = 88;
                  greenComponent = 0;
                  blueComponent = 135;
                }

                const differenceColor = `rgb(${redComponent}, ${greenComponent}, ${blueComponent})`;

                return `
              <tr class="${status}">
                <td class="location-name">${escapeHtml(result.location)}</td>
                <td class="value" data-value="${result.expected}">${result.expected}</td>
                <td class="value" data-value="${result.actual}">${result.actual}</td>
                <td class="difference" data-value="${absDiff}" style="color: ${differenceColor};">${diffSign}${result.difference.toFixed(2)}${diffIndicator}</td>
                <td><span class="status-badge ${status}">${statusLabel}</span></td>
              </tr>
            `;
              })
              .join("")}
            ${
              unrecognisedLocations.length > 0
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
                : ""
            }
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="footer">
      Generated on ${new Date().toLocaleString()} | 
      Click any column header to sort. Default view is sorted by expected value (descending).
      ${
        unrecognisedLocations.length > 0
          ? ` | ${unrecognisedLocations.length} unrecognised location(s) from reference file`
          : ""
      }
    </div>
  </div>
  <script>
    (function () {
      const table = document.querySelector('table');
      if (!table) return;

      const getCellValue = (row, index) => {
        const cell = row.children[index];
        if (!cell) return '';
        const dataValue = cell.getAttribute('data-value');
        if (dataValue !== null) return dataValue;
        return (cell.textContent || '').trim();
      };

      const compareValues = (a, b, type, asc) => {
        if (type === 'number') {
          const numA = parseFloat(a);
          const numB = parseFloat(b);
          const valA = isNaN(numA) ? Number.NEGATIVE_INFINITY : numA;
          const valB = isNaN(numB) ? Number.NEGATIVE_INFINITY : numB;
          return asc ? valA - valB : valB - valA;
        } else {
          const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' });
          return asc ? cmp : -cmp;
        }
      };

      const tbody = table.tBodies[0];
      const allRows = Array.from(tbody.querySelectorAll('tr'));

      const getDataRows = () => allRows.filter(r => !r.classList.contains('unrecognised'));
      const getUnrecognisedRows = () => allRows.filter(r => r.classList.contains('unrecognised'));

      const headers = table.querySelectorAll('thead th.sortable');
      headers.forEach((th, index) => {
        th.addEventListener('click', () => {
          const type = th.getAttribute('data-sort-type') || 'string';
          const currentDir = th.getAttribute('data-sort-dir');
          const asc = currentDir !== 'asc';

          headers.forEach(h => h.removeAttribute('data-sort-dir'));
          th.setAttribute('data-sort-dir', asc ? 'asc' : 'desc');

          const dataRows = getDataRows();
          const unrecRows = getUnrecognisedRows();

          dataRows.sort((rowA, rowB) => {
            const aVal = getCellValue(rowA, index);
            const bVal = getCellValue(rowB, index);
            return compareValues(aVal, bVal, type, asc);
          });

          dataRows.forEach(r => tbody.appendChild(r));
          unrecRows.forEach(r => tbody.appendChild(r));
        });
      });

      // Apply default sort by "Expected" column (descending) if specified
      const defaultHeader = Array.from(headers).find(h => h.getAttribute('data-default-sort'));
      if (defaultHeader) {
        const defaultDir = defaultHeader.getAttribute('data-default-sort') || 'desc';
        defaultHeader.setAttribute('data-sort-dir', defaultDir === 'asc' ? 'desc' : 'asc');
        defaultHeader.click();
      }
    })();
  </script>
</body>
</html>`;

  const outputFolder = path.join(
    process.cwd(),
    "tests/pathfinding/output/",
    version.replaceAll(".", "_"),
  );
  const outputPath = path.join(outputFolder, `${country.toLowerCase()}.html`);
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  await fsPromises.writeFile(outputPath, html, "utf-8");
  console.log(`\n📊 HTML report generated: ${outputPath}`);

  // Generate metadata JSON file for index generation
  const metadataPath = path.join(outputFolder, `${country.toLowerCase()}.json`);
  const metadata = {
    country,
    version,
    totalCount,
    goodCount,
    badCount,
    successRate: parseFloat(successRate),
    averageAbsoluteDifference:
      totalCount > 0
        ? results.reduce((sum, r) => sum + Math.abs(r.difference), 0) /
          totalCount
        : 0,
    // How often proximity is correct within tolerance
    proximityCorrectCount: goodCount,
    // How often sign bucket (zero/unreachable vs > 0) is correct
    signCorrectCount,
    signAccuracy: parseFloat(signAccuracyStr),
    unrecognisedCount: unrecognisedLocations.length,
    reportPath: `${country.toLowerCase()}.html`,
  };
  await fsPromises.writeFile(
    metadataPath,
    JSON.stringify(metadata, null, 2),
    "utf-8",
  );
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

interface ReportMetadata {
  country: string;
  version: string;
  totalCount: number;
  goodCount: number;
  badCount: number;
  successRate: number;
  averageAbsoluteDifference: number;
  proximityCorrectCount: number;
  signCorrectCount: number;
  signAccuracy: number;
  unrecognisedCount: number;
  reportPath: string;
}

export async function generateIndexFile(): Promise<void> {
  const outputBasePath = path.join(process.cwd(), "tests/pathfinding/output");

  if (!fs.existsSync(outputBasePath)) {
    console.log(
      "No output directory found. Run tests first to generate reports.",
    );
    return;
  }

  // Scan all version directories
  const versionDirs = fs
    .readdirSync(outputBasePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  // Generate an index file for each version folder
  for (const versionDir of versionDirs) {
    const versionPath = path.join(outputBasePath, versionDir);
    const jsonFiles = fs
      .readdirSync(versionPath)
      .filter((file) => file.endsWith(".json"));

    const reports: ReportMetadata[] = [];

    for (const jsonFile of jsonFiles) {
      const metadataPath = path.join(versionPath, jsonFile);
      try {
        const metadataContent = await fsPromises.readFile(
          metadataPath,
          "utf-8",
        );
        const metadata: ReportMetadata = JSON.parse(metadataContent);
        reports.push(metadata);
      } catch (error) {
        console.warn(`Failed to read metadata file ${metadataPath}:`, error);
      }
    }

    // Sort by country
    reports.sort((a, b) => a.country.localeCompare(b.country));

    // Generate index HTML and deterministic hash for this version
    if (reports.length > 0) {
      const version = reports[0].version; // All reports in a version folder should have the same version

      // Compute deterministic SHA-256 hash over all report metadata for this version
      const hashPayload = reports.map((report) => ({
        country: report.country,
        version: report.version,
        totalCount: report.totalCount,
        goodCount: report.goodCount,
        badCount: report.badCount,
        successRate: report.successRate,
        averageAbsoluteDifference: report.averageAbsoluteDifference,
        proximityCorrectCount: report.proximityCorrectCount,
        signCorrectCount: report.signCorrectCount,
        signAccuracy: report.signAccuracy,
        unrecognisedCount: report.unrecognisedCount,
      }));

      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(hashPayload))
        .digest("hex");

      const hashFilePath = path.join(versionPath, "pathfinding.sha256");
      await fsPromises.writeFile(hashFilePath, hash + "\n", "utf-8");
      console.log(
        `\n🔐 Pathfinding hash for version ${version}: ${hash} (saved to ${hashFilePath})`,
      );

      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pathfinding Test Reports Index - Version ${version}</title>
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
    
    .content {
      padding: 30px;
    }
    
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
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
    
    tbody tr {
      border-bottom: 1px solid #e5e7eb;
      transition: background-color 0.2s;
    }
    
    tbody tr:hover {
      background-color: #f9fafb;
    }
    
    td {
      padding: 12px 15px;
    }
    
    .country-link {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    
    .country-link:hover {
      text-decoration: underline;
    }
    
    .score {
      font-weight: 700;
      font-size: 1.1em;
    }
    
    .score.excellent {
      color: #059669;
    }
    
    .score.good {
      color: #2563eb;
    }
    
    .score.fair {
      color: #d97706;
    }
    
    .score.poor {
      color: #dc2626;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
    }
    
    .badge.success {
      background: #d1fae5;
      color: #059669;
    }
    
    .badge.warning {
      background: #fef3c7;
      color: #d97706;
    }
    
    .badge.error {
      background: #fee2e2;
      color: #dc2626;
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
      <h1>📊 Pathfinding Test Reports Index</h1>
      <p style="margin-top: 10px; opacity: 0.9;">Version ${version}</p>
    </div>
    
    <div class="content">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>Proximity Accuracy</th>
              <th>Sign Accuracy</th>
              <th>Average Difference</th>
              <th>Total Tests</th>
              <th>Proximity Correct</th>
              <th>Sign Correct</th>
              <th>Unrecognised</th>
            </tr>
          </thead>
          <tbody>
            ${reports
              .map((report) => {
                const getScoreClass = (avgDiff: number) => {
                  if (avgDiff <= 2) return "excellent";
                  if (avgDiff <= 5) return "good";
                  if (avgDiff <= 10) return "fair";
                  return "poor";
                };

                const getSuccessBadge = (rate: number) => {
                  if (rate >= 90)
                    return '<span class="badge success">Excellent</span>';
                  if (rate >= 70)
                    return '<span class="badge success">Good</span>';
                  if (rate >= 50)
                    return '<span class="badge warning">Fair</span>';
                  return '<span class="badge error">Poor</span>';
                };

                const getSignBadge = (rate: number) => {
                  if (rate >= 95)
                    return '<span class="badge success">Very Reliable</span>';
                  if (rate >= 85)
                    return '<span class="badge success">Reliable</span>';
                  if (rate >= 70)
                    return '<span class="badge warning">Mixed</span>';
                  return '<span class="badge error">Unreliable</span>';
                };

                const reportUrl = report.reportPath; // Just the filename since it's in the same directory
                const scoreClass = getScoreClass(
                  report.averageAbsoluteDifference,
                );

                return `
                  <tr>
                    <td>
                      <a href="${escapeHtml(reportUrl)}" class="country-link">
                        ${escapeHtml(report.country.toUpperCase())}
                      </a>
                    </td>
                    <td>${getSuccessBadge(report.successRate)} ${report.successRate.toFixed(2)}%</td>
                    <td>${getSignBadge(report.signAccuracy)} ${report.signAccuracy.toFixed(2)}%</td>
                    <td class="score ${scoreClass}">${report.averageAbsoluteDifference.toFixed(2)}</td>
                    <td>${report.totalCount}</td>
                    <td style="color: #059669; font-weight: 600;">${report.proximityCorrectCount}</td>
                    <td style="color: #2563eb; font-weight: 600;">${report.signCorrectCount}</td>
                    <td>${report.unrecognisedCount}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="footer">
      Generated on ${new Date().toLocaleString()} | 
      Average Difference: lower is better | 
      run SHA: ${hash}
    </div>
  </div>
</body>
</html>`;

      const indexPath = path.join(versionPath, "index.html");
      await fsPromises.writeFile(indexPath, indexHtml, "utf-8");
      console.log(`\n📑 Index file generated: ${indexPath}`);
    }
  }

  // Generate root index.html linking to each version's index
  if (versionDirs.length > 0) {
    const sortedVersionDirs = [...versionDirs].sort((a, b) => {
      // Sort by version: compare as "1_0_11" -> [1, 0, 11]
      const partsA = a.split("_").map(Number);
      const partsB = b.split("_").map(Number);
      const len = Math.max(partsA.length, partsB.length);
      for (let i = 0; i < len; i++) {
        const va = partsA[i] ?? 0;
        const vb = partsB[i] ?? 0;
        if (va !== vb) return vb - va; // descending (newest first)
      }
      return 0;
    });

    const rootIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pathfinding Test Reports – Versions</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 800px;
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
    .header h1 { font-size: 2em; font-weight: 700; }
    .content { padding: 30px; }
    .version-list { list-style: none; }
    .version-list li {
      border-bottom: 1px solid #e5e7eb;
      padding: 14px 0;
    }
    .version-list li:last-child { border-bottom: none; }
    .version-link {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.1em;
    }
    .version-link:hover { text-decoration: underline; }
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
      <h1>🧭 Pathfinding Test Reports</h1>
      <p style="margin-top: 10px; opacity: 0.9;">Select a version to view reports</p>
    </div>
    <div class="content">
      <ul class="version-list">
        ${sortedVersionDirs
          .map(
            (dir) =>
              `<li><a href="${escapeHtml(dir + "/index.html")}" class="version-link">${escapeHtml(dir.replaceAll("_", "."))}</a></li>`,
          )
          .join("\n")}
      </ul>
    </div>
    <div class="footer">
      Generated on ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;

    const rootIndexPath = path.join(outputBasePath, "index.html");
    await fsPromises.writeFile(rootIndexPath, rootIndexHtml, "utf-8");
    console.log(`\n📑 Root index file generated: ${rootIndexPath}`);
  }
}
