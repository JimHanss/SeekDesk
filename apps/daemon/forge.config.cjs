/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseVersion, FuseV1Options } = require("@electron/fuses");

const macosSigningIdentity = process.env.SEEKDESK_MACOS_SIGNING_IDENTITY?.trim();

module.exports = {
  packagerConfig: {
    name: "SeekDesk Daemon",
    executableName: "SeekDeskDaemon",
    appBundleId: "com.seekdesk.daemon",
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
    ...(macosSigningIdentity
      ? { osxSign: { identity: macosSigningIdentity, continueOnError: false } }
      : {}),
    icon: path.resolve(__dirname, "assets", "icon"),
    extraResource: [path.resolve(__dirname, "assets")],
    protocols: [
      {
        name: "SeekDesk Daemon Pairing",
        schemes: ["seekdesk"]
      }
    ]
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      if (packageResult.platform !== "darwin" || macosSigningIdentity) {
        return;
      }
      for (const outputPath of packageResult.outputPaths) {
        const appPath = outputPath.endsWith(".app")
          ? outputPath
          : path.join(outputPath, "SeekDesk Daemon.app");
        execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath], {
          stdio: "inherit"
        });
      }
    }
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "seekdesk_daemon",
        authors: "SeekDesk",
        description: "Secure local coding runtime for SeekDesk",
        setupExe: "SeekDesk-Daemon-Setup.exe",
        setupIcon: path.resolve(__dirname, "assets", "icon.ico")
      }
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "SeekDesk Daemon",
        icon: path.resolve(__dirname, "assets", "icon.icns"),
        format: "ULFO"
      }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"]
    }
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        concurrent: false,
        build: [
          {
            entry: "src/desktop/main.ts",
            config: "vite.main.config.mjs",
            target: "main"
          },
          {
            entry: "src/desktop/preload.ts",
            config: "vite.preload.config.mjs",
            target: "preload"
          }
        ],
        renderer: [
          {
            name: "main_window",
            config: "vite.renderer.config.mjs"
          }
        ]
      }
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
