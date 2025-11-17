import { readdirSync } from "node:fs";

/** Return the names of subdirectories at a given path. */
export const getDirectories = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

/** List route files within a directory. */
export const getRouteFiles = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => !dirent.isDirectory() && dirent.name.includes("route"))
    .map((dirent) => dirent.name);

/** Return all file names within a directory. */
export const getDirectoryFiles = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => !dirent.isDirectory())
    .map((dirent) => dirent.name);
