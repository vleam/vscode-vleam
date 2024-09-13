import * as vscode from "vscode";
import { workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

const enum VleamCommands {
  RestartServer = "vleam.restartServer",
}

let client: LanguageClient | undefined;
let configureLang: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const onEnterRules = [...continueTypingCommentsOnNewline()];

  configureLang = vscode.languages.setLanguageConfiguration("gleam", {
    onEnterRules,
  });

  const restartCommand = vscode.commands.registerCommand(
    VleamCommands.RestartServer,
    async () => {
      if (!client) {
        vscode.window.showErrorMessage("vleam client not found");
        return;
      }

      try {
        if (client.isRunning()) {
          await client.restart();

          vscode.window.showInformationMessage("vleam server restarted.");
        } else {
          await client.start();
        }
      } catch (err) {
        client.error("Restarting client failed", err, "force");
      }
    },
  );

  context.subscriptions.push(restartCommand);

  client = await createLanguageClient();
  // Start the client. This will also launch the server
  client?.start();
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  configureLang?.dispose();

  return client?.stop();
}

async function createLanguageClient(): Promise<LanguageClient | undefined> {
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "vue" }],
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher("**/gleam.toml"),
        workspace.createFileSystemWatcher("**/manifest.toml"),
      ],
    },
  };

  const serverOptions: ServerOptions = {
    command: "npx",
    args: ["vleam", "lsp"],
    options: {
      env: Object.assign(process.env, {
        GLEAM_LOG: "info",
        GLEAM_LOG_NOCOLOUR: "1",
      }),
    },
  };

  return new LanguageClient(
    "vleam_language_server",
    "Vleam Language Server",
    serverOptions,
    clientOptions,
  );
}

/**
 * Returns the `OnEnterRule`s needed to configure typing comments on a newline.
 *
 * This makes it so when you press `Enter` while in a comment it will continue
 * the comment onto the next line.
 */
function continueTypingCommentsOnNewline(): vscode.OnEnterRule[] {
  const indentAction = vscode.IndentAction.None;

  return [
    {
      // Module doc single-line comment
      // e.g. ////|
      beforeText: /^\s*\/{4}.*$/,
      action: { indentAction, appendText: "//// " },
    },
    {
      // Doc single-line comment
      // e.g. ///|
      beforeText: /^\s*\/{3}.*$/,
      action: { indentAction, appendText: "/// " },
    },
  ];
}
