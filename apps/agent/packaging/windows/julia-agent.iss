#define MyAppName "Julia Agent"
#define MyAppPublisher "Yulia"
#define MyAppURL "https://github.com/kubefox-bot/julia-shell"
#define MyAppExeName "julia-agent.exe"

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif

[Setup]
AppId={{D2FA762F-0666-4929-B094-36DB2B648930}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\JuliaAgent
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=.
OutputBaseFilename=julia-agent-windows-x64-installer
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "dist\julia-agent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\start-agent.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\.env.example"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Julia Agent"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Julia Agent"; Filename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Julia Agent"; Flags: nowait postinstall skipifsilent
