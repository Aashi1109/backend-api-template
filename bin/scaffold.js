#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import chalk from "chalk";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the template root directory
const TEMPLATE_ROOT = path.resolve(__dirname, "..");
const BASE_TEMPLATE_DIR = path.join(TEMPLATE_ROOT, "templates", "base");
const MODULES_DIR = path.join(TEMPLATE_ROOT, "templates", "modules");
const FEATURES_CONFIG_PATH = path.join(
  TEMPLATE_ROOT,
  "templates",
  "features-config.json"
);

// Utility to recursively copy directory
async function copyDirectory(src, dest, excludePaths = []) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded paths
    if (excludePaths.some((exclude) => srcPath.includes(exclude))) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, excludePaths);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Utility to copy files matching glob pattern
async function copyModuleFiles(modulePath, targetDir, filePatterns) {
  for (const pattern of filePatterns) {
    const fullPattern = path.join(modulePath, pattern);
    const files = await glob(fullPattern, { nodir: false });

    for (const file of files) {
      const relativePath = path.relative(modulePath, file);
      const destPath = path.join(targetDir, "src", relativePath);

      const stat = await fs.stat(file);
      if (stat.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(file, destPath);
      }
    }
  }
}

// Utility to inject code at marker
async function injectCode(filePath, marker, code) {
  try {
    let content = await fs.readFile(filePath, "utf-8");

    if (content.includes(marker)) {
      // Replace marker with code + marker (keep marker for potential future injections)
      content = content.replace(marker, `${code}\n  ${marker}`);
      await fs.writeFile(filePath, content, "utf-8");
      return true;
    }
    return false;
  } catch (error) {
    // File might not exist (e.g., .env.example)
    if (error.code === "ENOENT") {
      // Create file with the code
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${marker}\n${code}\n`, "utf-8");
      return true;
    }
    throw error;
  }
}

// Utility to merge package.json
async function mergePackageJson(targetDir, dependencies) {
  const packageJsonPath = path.join(targetDir, "package.json");

  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    // Merge dependencies
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...dependencies,
    };

    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n",
      "utf-8"
    );
  } catch (error) {
    console.warn(chalk.yellow("⚠ Warning: Could not update package.json"));
  }
}

// Clean up injection markers
async function cleanupMarkers(targetDir) {
  const filesToClean = await glob(
    path.join(targetDir, "**/*.{ts,js,json,env*}"),
    {
      ignore: ["**/node_modules/**"],
    }
  );

  for (const file of filesToClean) {
    let content = await fs.readFile(file, "utf-8");
    let modified = false;

    // Remove all INJECT markers
    const markerRegex = /^\s*(?:\/\/|#)\s*INJECT:[A-Z_]+\s*$/gm;
    if (markerRegex.test(content)) {
      content = content.replace(markerRegex, "");
      modified = true;
    }

    if (modified) {
      await fs.writeFile(file, content, "utf-8");
    }
  }
}

// Main scaffold function
async function scaffold() {
  console.log(chalk.blue.bold("\n🚀 Backend Template Scaffold\n"));

  // Get current directory (where user invoked the command)
  const targetDir = process.cwd();

  // Validate we're not scaffolding inside the template itself
  if (targetDir.startsWith(TEMPLATE_ROOT)) {
    console.error(
      chalk.red("❌ Error: Cannot scaffold inside the template directory")
    );
    process.exit(1);
  }

  // Load features configuration
  const featuresConfigContent = await fs.readFile(
    FEATURES_CONFIG_PATH,
    "utf-8"
  );
  const featuresConfig = JSON.parse(featuresConfigContent);

  // Prepare choices for inquirer
  const featureChoices = Object.entries(featuresConfig).map(
    ([key, feature]) => ({
      name: `${feature.name} - ${chalk.gray(feature.description)}`,
      value: key,
      checked: false,
    })
  );

  // Prompt user for feature selection
  const answers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "features",
      message: "Select features to include:",
      choices: featureChoices,
      pageSize: 15,
    },
    {
      type: "confirm",
      name: "installDeps",
      message: "Install dependencies after scaffolding?",
      default: true,
    },
  ]);

  const selectedFeatures = answers.features;

  console.log(chalk.cyan("\n📦 Copying base template..."));
  // Copy base template
  await copyDirectory(BASE_TEMPLATE_DIR, targetDir, [
    "node_modules",
    "dist",
    "build",
  ]);

  // Collect all dependencies
  const allDependencies = {};

  // Process selected features
  if (selectedFeatures.length > 0) {
    console.log(chalk.cyan("\n✨ Adding selected features...\n"));

    for (const featureKey of selectedFeatures) {
      const feature = featuresConfig[featureKey];
      console.log(chalk.green(`  ✓ ${feature.name}`));

      // Copy feature files
      if (feature.files && feature.files.length > 0) {
        await copyModuleFiles(MODULES_DIR, targetDir, feature.files);
      }

      // Collect dependencies
      if (feature.dependencies) {
        Object.assign(allDependencies, feature.dependencies);
      }

      // Apply code injections
      if (feature.injections && feature.injections.length > 0) {
        for (const injection of feature.injections) {
          const filePath = path.join(targetDir, injection.file);
          await injectCode(filePath, injection.marker, injection.code);
        }
      }
    }
  }

  // Merge dependencies into package.json
  if (Object.keys(allDependencies).length > 0) {
    console.log(chalk.cyan("\n📝 Updating package.json with dependencies..."));
    await mergePackageJson(targetDir, allDependencies);
  }

  // Clean up injection markers
  console.log(chalk.cyan("\n🧹 Cleaning up markers..."));
  await cleanupMarkers(targetDir);

  // Summary
  console.log(chalk.green.bold("\n✅ Scaffolding complete!\n"));
  console.log(chalk.white("Features installed:"));
  if (selectedFeatures.length === 0) {
    console.log(chalk.gray("  - Base template only"));
  } else {
    selectedFeatures.forEach((key) => {
      console.log(chalk.gray(`  - ${featuresConfig[key].name}`));
    });
  }

  // Next steps
  console.log(chalk.blue.bold("\n📋 Next steps:\n"));

  if (answers.installDeps) {
    console.log(chalk.white("Installing dependencies...\n"));
    const { spawn } = await import("child_process");

    return new Promise((resolve, reject) => {
      const npm = spawn("npm", ["install"], {
        cwd: targetDir,
        stdio: "inherit",
        shell: true,
      });

      npm.on("close", (code) => {
        if (code !== 0) {
          console.error(chalk.red("\n❌ Failed to install dependencies"));
          reject(new Error("npm install failed"));
        } else {
          console.log(
            chalk.green.bold("\n✅ Dependencies installed successfully!")
          );
          printNextSteps();
          resolve();
        }
      });
    });
  } else {
    console.log(chalk.gray("  1. Install dependencies: npm install"));
    printNextSteps();
  }
}

function printNextSteps() {
  console.log(chalk.gray("  2. Configure environment variables in .env"));
  console.log(chalk.gray("  3. Start development: npm run dev"));
  console.log(chalk.blue("\nHappy coding! 🎉\n"));
}

// Run scaffold
scaffold().catch((error) => {
  console.error(chalk.red("\n❌ Error during scaffolding:"), error);
  process.exit(1);
});
