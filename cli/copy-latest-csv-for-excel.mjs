// Copies a chosen audit CSV into the Excel folder with consistent naming.
// Usage:
//   node cli/copy-latest-csv-for-excel.mjs \
//     [--sourceDir audits_analysis] \
//     [--destDir excel] \
//     [--destName cyprus-accessibility-analysis-for-excel.csv]
// Run the script from a terminal (TTY) so the interactive prompt works.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { stdin as input, stdout as output, exit } from 'node:process';
import readline from 'node:readline/promises';
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow overriding paths/names via CLI flags so the script is reusable.
const {
  values: {
    config: configPathArg,
    sourceDir: sourceDirArg,
    destDir: destDirArg,
    destName: destNameArg
  }
} = parseArgs({
  allowPositionals: false,
  options: {
    config: { type: 'string' },
    sourceDir: { type: 'string' },
    destDir: { type: 'string' },
    destName: { type: 'string' }
  }
});

const cwd = process.cwd();

/**
 * Load JSON config from given path
 * 
 * @param {string} configPath Path to JSON config file 
 * @returns {Promise<Object>} The parsed JSON configuration object
 */
async function loadConfig(configPath) {
  if (!configPath) {
    return {};
  }

  const resolvedPath = path.resolve(cwd, configPath);

  const raw = await fs.readFile(resolvedPath, 'utf-8');
  return JSON.parse(raw);
}


const config = await loadConfig(
  configPathArg ?? 'analysis-config.json'
);

const copyConfig = config.copyLatestCsv ?? {};

const sourceDir = path.resolve(
  cwd,
  sourceDirArg ?? copyConfig.sourceDir ?? 'reports/aggregated_analysis'
);

const destinationDir = path.resolve(
  cwd,
  destDirArg ?? copyConfig.destDir ?? 'excel_analysis/aggregated_analysis'
);

const destinationName =
  destNameArg ?? copyConfig.destName ?? 'aggregated-analysis.csv';

async function listCsvFiles(directory) {
  // Enumerate CSV files once so the same list can be reused in prompts.
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const csvFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(directory, entry.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!csvFiles.length) {
    throw new Error(`No CSV files found in ${directory}`);
  }

  return csvFiles;
}

async function askUserToSelectFile(files) {
  // Interactive use only; piping input would skip the selection question.
  if (!input.isTTY) {
    throw new Error('Interactive selection requires a TTY stdin. Re-run this script from a terminal.');
  }

  console.log('Available CSV files:\n');
  files.forEach((file, index) => {
    const label = `[${index + 1}] ${file.name}`;
    console.log(label);
  });
  console.log();

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const answer = await rl.question('Choose a file by number: ');
      const selectedIndex = Number.parseInt(answer, 10);

      if (Number.isInteger(selectedIndex) && selectedIndex >= 1 && selectedIndex <= files.length) {
        return files[selectedIndex - 1];
      }

      console.log(`Please enter a number between 1 and ${files.length}.`);
    }
  } finally {
    rl.close();
  }
}

async function copyCsvToExcelFolder(file) {
  // Always ensure the excel folder exists before copying.
  await fs.mkdir(destinationDir, { recursive: true });
  const destinationPath = path.join(destinationDir, destinationName);
  await fs.copyFile(file.absolutePath, destinationPath);

  return destinationPath;
}

async function main() {
  try {
    const csvFiles = await listCsvFiles(sourceDir);
    const selectedFile = await askUserToSelectFile(csvFiles);

    const copiedPath = await copyCsvToExcelFolder(selectedFile);

    console.log(`\nCopied ${selectedFile.name} -> ${copiedPath}`);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    exit(1);
  }
}

main();
