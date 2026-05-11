import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptsDir);
const distDir = join(repoRoot, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const runtimeModules = readdirSync(repoRoot)
  .filter((entry) => entry.endsWith(".ts"))
  .filter((entry) => !entry.endsWith(".test.ts"))
  .filter((entry) => entry !== "vitest.config.ts");

function rewriteTsImportSpecifiers(outputText) {
  return outputText
    .replace(/from "(\.[^"]+)\.ts"/g, 'from "$1.js"')
    .replace(/from '(\.[^']+)\.ts'/g, "from '$1.js'")
    .replace(/import\("(\.[^"]+)\.ts"\)/g, 'import("$1.js")')
    .replace(/import\('(\.[^']+)\.ts'\)/g, "import('$1.js')");
}

for (const entry of runtimeModules) {
  const sourcePath = join(repoRoot, entry);
  const outputPath = join(distDir, `${basename(entry, ".ts")}.js`);
  const source = readFileSync(sourcePath, "utf-8");
  const output = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      esModuleInterop: true,
      sourceMap: false,
    },
  });

  writeFileSync(outputPath, rewriteTsImportSpecifiers(output.outputText), "utf-8");
}

copyFileSync(join(repoRoot, "app-bridge.bundle.js"), join(distDir, "app-bridge.bundle.js"));

writeFileSync(
  join(distDir, "index.d.ts"),
  `import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

export type McpServerLifecycle = "lazy" | "eager" | "keep-alive";

export type McpServerAuth = "oauth" | "bearer" | false;

export interface McpOAuthConfig {
  grantType?: "authorization_code" | "client_credentials";
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}

export interface McpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  auth?: McpServerAuth;
  bearerToken?: string;
  bearerTokenEnv?: string;
  oauth?: McpOAuthConfig | false;
  lifecycle?: McpServerLifecycle;
  idleTimeout?: number;
  exposeResources?: boolean;
  directTools?: boolean | string[];
  excludeTools?: string[];
  debug?: boolean;
}

export interface McpSettings {
  toolPrefix?: "server" | "none" | "short";
  idleTimeout?: number;
  directTools?: boolean;
  disableProxyTool?: boolean;
  autoAuth?: boolean;
  authRequiredMessage?: string;
  sampling?: boolean;
  samplingAutoApprove?: boolean;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerEntry>;
  imports?: Array<"cursor" | "claude-code" | "claude-desktop" | "codex" | "windsurf" | "vscode">;
  settings?: McpSettings;
}

export interface McpAdapterOptions {
  configPath?: string;
  config?: McpConfig;
}

export declare function createMcpAdapter(options?: McpAdapterOptions): ExtensionFactory;

declare const mcpAdapter: ExtensionFactory;
export default mcpAdapter;
`,
  "utf-8",
);
