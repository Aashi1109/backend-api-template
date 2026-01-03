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

    // Special handling for package.json - parse JSON and merge scripts
    if (
      filePath.endsWith("package.json") &&
      marker.includes("WORKERS_SCRIPTS")
    ) {
      // Remove the marker from content before parsing (JSON doesn't support comments)
      // Remove marker line if it exists
      const markerRegex = new RegExp(
        `^\\s*${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
        "gm"
      );
      content = content.replace(markerRegex, "");

      const packageJson = JSON.parse(content);

      // Parse the code as a JSON object to extract scripts
      // The code should be a comma-separated list of key-value pairs
      try {
        // Wrap the code in braces to make it valid JSON
        const scriptsToAdd = JSON.parse(`{${code}}`);
        if (scriptsToAdd && typeof scriptsToAdd === "object") {
          // Merge scripts into package.json
          packageJson.scripts = {
            ...packageJson.scripts,
            ...scriptsToAdd,
          };
          await fs.writeFile(
            filePath,
            JSON.stringify(packageJson, null, 2) + "\n",
            "utf-8"
          );
          return true;
        }
      } catch (parseError) {
        // If parsing fails, throw error with helpful message
        throw new Error(
          `Failed to parse injection code for package.json: ${parseError.message}. Code: ${code}`
        );
      }
    }

    // Standard string replacement for other files
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
async function mergePackageJson(targetDir, dependencies, devDependencies = {}) {
  const packageJsonPath = path.join(targetDir, "package.json");

  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    // Merge dependencies
    packageJson.dependencies = {
      ...(packageJson.dependencies || {}),
      ...dependencies,
    };

    // Merge devDependencies
    if (devDependencies && Object.keys(devDependencies).length > 0) {
      packageJson.devDependencies = {
        ...(packageJson.devDependencies || {}),
        ...devDependencies,
      };
    }

    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n",
      "utf-8"
    );
  } catch (error) {
    console.error(
      chalk.red(`❌ Error updating package.json: ${error.message}`)
    );
    throw error;
  }
}

// Utility to process template variables in files
async function processTemplateVariables(filePath, variables) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return;
    }

    let content = await fs.readFile(filePath, "utf-8");
    let modified = false;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, value);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(filePath, content, "utf-8");
    }
  } catch (error) {
    // File might not exist or not be readable, ignore
  }
}

// Utility to process template variables in all files
async function processAllTemplateVariables(targetDir, variables) {
  const templateFiles = await glob(path.join(targetDir, "**/*"), {
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  });

  for (const file of templateFiles) {
    try {
      const stat = await fs.stat(file);
      if (stat.isFile()) {
        await processTemplateVariables(file, variables);
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
}

// Clean up injection markers
async function cleanupMarkers(targetDir, injectedMarkers) {
  const filesToClean = await glob(
    path.join(targetDir, "**/*.{ts,js,json,env*}"),
    {
      ignore: ["**/node_modules/**"],
    }
  );

  for (const file of filesToClean) {
    // Skip .env.example to preserve markers for future injections
    if (file.endsWith(".env.example")) {
      continue;
    }

    try {
      let content = await fs.readFile(file, "utf-8");
      let modified = false;

      // Special handling for package.json - need to parse and rewrite to remove markers
      if (file.endsWith("package.json")) {
        // Remove markers from content before parsing
        for (const marker of injectedMarkers) {
          const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`^\\s*${escapedMarker}\\s*$`, "gm");
          if (regex.test(content)) {
            content = content.replace(regex, "");
            modified = true;
          }
        }

        // If we modified content, parse JSON to validate and rewrite cleanly
        if (modified) {
          try {
            const packageJson = JSON.parse(content);
            await fs.writeFile(
              file,
              JSON.stringify(packageJson, null, 2) + "\n",
              "utf-8"
            );
          } catch (parseError) {
            // If parsing fails, just write the modified content as-is
            await fs.writeFile(file, content, "utf-8");
          }
        }
      } else {
        // Standard handling for other files
        for (const marker of injectedMarkers) {
          // Escape special regex characters in the marker
          const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Match the marker exactly, with optional leading/trailing whitespace
          // The marker includes the comment prefix (// or #)
          const regex = new RegExp(`^\\s*${escapedMarker}\\s*$`, "gm");

          if (regex.test(content)) {
            content = content.replace(regex, "");
            modified = true;
          }
        }

        if (modified) {
          await fs.writeFile(file, content, "utf-8");
        }
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }
}

// Main scaffold function
async function scaffold() {
  console.log(chalk.blue.bold("\n🚀 Backend Template Scaffold\n"));

  // Get current directory (where user invoked the command)
  const currentDir = process.cwd();

  // Validate we're not scaffolding inside the template itself
  if (currentDir.startsWith(TEMPLATE_ROOT)) {
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

  // Prompt for project name
  const projectAnswers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message:
        "Enter your project name (or '.' to scaffold in current directory):",
      default: path.basename(currentDir),
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return "Project name cannot be empty";
        }
        // Allow "." for current directory
        if (input === ".") {
          return true;
        }
        // Validate npm package name format
        if (
          !/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(input)
        ) {
          return "Invalid package name format (must be lowercase, alphanumeric, hyphens, underscores, dots)";
        }
        return true;
      },
    },
  ]);

  // Determine target directory and project name
  let targetDir;
  let projectName;

  if (projectAnswers.projectName === ".") {
    // Use current directory
    targetDir = currentDir;
    projectName = path.basename(currentDir);
  } else {
    // Create new directory with project name
    targetDir = path.resolve(currentDir, projectAnswers.projectName);
    projectName = projectAnswers.projectName;
  }

  // Check if directory already exists and is not empty
  try {
    const stats = await fs.stat(targetDir);
    if (stats.isDirectory()) {
      const entries = await fs.readdir(targetDir);
      // Fail if directory contains any files or subdirectories
      if (entries.length > 0) {
        console.error(
          chalk.red(
            `❌ Error: Directory "${targetDir}" is not empty. Please use an empty directory or choose a different name.`
          )
        );
        process.exit(1);
      }
    }
  } catch (error) {
    // Directory doesn't exist, create it
    if (error.code === "ENOENT") {
      await fs.mkdir(targetDir, { recursive: true });
    } else {
      throw error;
    }
  }

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

  // If user wants to install dependencies, ask which installer to use
  let installer = "pnpm";
  if (answers.installDeps) {
    const installerAnswer = await inquirer.prompt([
      {
        type: "list",
        name: "installer",
        message: "Which package manager would you like to use?",
        choices: [
          { name: "npm", value: "npm" },
          { name: "yarn", value: "yarn" },
          { name: "pnpm", value: "pnpm" },
        ],
        default: "pnpm",
      },
    ]);
    installer = installerAnswer.installer;
  }

  const selectedFeatures = answers.features;

  console.log(chalk.cyan("\n📦 Copying base template..."));
  // Copy base template (no exclusions - copy everything)
  await copyDirectory(BASE_TEMPLATE_DIR, targetDir, []);

  // Process template variables (replace {{PROJECT_NAME}} with actual project name)
  console.log(chalk.cyan("🔄 Processing template variables..."));
  await processAllTemplateVariables(targetDir, {
    PROJECT_NAME: projectName,
  });

  // Collect all dependencies and devDependencies
  const allDependencies = {};
  const allDevDependencies = {};
  const injectedMarkers = new Set(); // Track all markers that were injected

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
      if (feature.devDependencies) {
        Object.assign(allDevDependencies, feature.devDependencies);
      }

      // Apply code injections
      if (feature.injections && feature.injections.length > 0) {
        for (const injection of feature.injections) {
          const filePath = path.join(targetDir, injection.file);
          const injected = await injectCode(
            filePath,
            injection.marker,
            injection.code
          );
          if (injected) {
            // Track the marker that was injected
            injectedMarkers.add(injection.marker);
          }
        }
      }
    }
  }

  // Merge dependencies into package.json
  if (
    Object.keys(allDependencies).length > 0 ||
    Object.keys(allDevDependencies).length > 0
  ) {
    console.log(chalk.cyan("\n📝 Updating package.json with dependencies..."));
    await mergePackageJson(targetDir, allDependencies, allDevDependencies);
  }

  // Clean up injection markers (excluding .env.example to preserve markers)
  if (injectedMarkers.size > 0) {
    console.log(chalk.cyan("\n🧹 Cleaning up injection markers..."));
    await cleanupMarkers(targetDir, Array.from(injectedMarkers));
  }

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
    console.log(chalk.white(`Installing dependencies with ${installer}...\n`));
    const { spawn } = await import("child_process");

    // Determine install command based on installer
    const installCommand =
      installer === "yarn" ? "yarn" : installer === "pnpm" ? "pnpm" : "npm";
    const installArgs = installer === "yarn" ? [] : ["install"];

    return new Promise((resolve, reject) => {
      const installProcess = spawn(installCommand, installArgs, {
        cwd: targetDir,
        stdio: "inherit",
        shell: true,
      });

      installProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(
            chalk.red(`\n❌ Failed to install dependencies with ${installer}`)
          );
          reject(new Error(`${installer} install failed`));
        } else {
          console.log(
            chalk.green.bold("\n✅ Dependencies installed successfully!")
          );
          printNextSteps(installer);
          resolve();
        }
      });
    });
  } else {
    console.log(
      chalk.gray("  1. Install dependencies: npm install (or yarn/pnpm)")
    );
    printNextSteps();
  }
}

function printNextSteps(installer = "npm") {
  console.log(chalk.gray("  2. Configure environment variables in .env"));
  const devCommand =
    installer === "yarn"
      ? "yarn dev"
      : installer === "pnpm"
      ? "pnpm dev"
      : "npm run dev";
  console.log(chalk.gray(`  3. Start development: ${devCommand}`));
  console.log(chalk.blue("\nHappy coding! 🎉\n"));
}

// Run scaffold
scaffold().catch((error) => {
  console.error(chalk.red("\n❌ Error during scaffolding:"), error);
  process.exit(1);
});
