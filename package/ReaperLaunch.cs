// Launch REAPER at the same (normally unelevated) integrity level as Windows Explorer.
// An elevated Studio process must not pass its admin token to the audio editor:
// Windows blocks drag-and-drop from ordinary Explorer into elevated windows.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace FundiVoice {
    internal static class ReaperLaunch {
        const uint ProcessQueryLimitedInformation = 0x1000;
        const uint TokenAssignPrimary = 0x0001;
        const uint TokenDuplicate = 0x0002;
        const uint TokenQuery = 0x0008;
        const int TokenElevation = 20;
        const int SecurityImpersonation = 2;
        const int TokenPrimary = 1;
        const uint LogonWithProfile = 0x00000001;

        [StructLayout(LayoutKind.Sequential)]
        struct TokenElevationInfo {
            public int TokenIsElevated;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct StartupInfo {
            public int cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public int dwX;
            public int dwY;
            public int dwXSize;
            public int dwYSize;
            public int dwXCountChars;
            public int dwYCountChars;
            public int dwFillAttribute;
            public int dwFlags;
            public short wShowWindow;
            public short cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct ProcessInformation {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint dwProcessId;
            public uint dwThreadId;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool CloseHandle(IntPtr handle);

        [DllImport("user32.dll")]
        static extern IntPtr GetShellWindow();

        [DllImport("user32.dll")]
        static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool GetTokenInformation(IntPtr token, int informationClass,
            out TokenElevationInfo information, int length, out int returned);

        [DllImport("advapi32.dll", SetLastError = true)]
        static extern bool DuplicateTokenEx(IntPtr token, uint access, IntPtr attributes,
            int impersonationLevel, int tokenType, out IntPtr duplicated);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode,
            EntryPoint = "CreateProcessWithTokenW", SetLastError = true)]
        static extern bool CreateProcessWithToken(IntPtr token, uint logonFlags,
            string application, StringBuilder commandLine, uint creationFlags,
            IntPtr environment, string workingDirectory,
            ref StartupInfo startup, out ProcessInformation process);

        static Win32Exception LastError() {
            return new Win32Exception(Marshal.GetLastWin32Error());
        }

        static bool IsElevated(IntPtr process) {
            IntPtr token = IntPtr.Zero;
            try {
                if (!OpenProcessToken(process, TokenQuery, out token)) throw LastError();
                TokenElevationInfo info;
                int returned;
                if (!GetTokenInformation(token, TokenElevation, out info,
                    Marshal.SizeOf(typeof(TokenElevationInfo)), out returned)) throw LastError();
                return info.TokenIsElevated != 0;
            } finally {
                if (token != IntPtr.Zero) CloseHandle(token);
            }
        }

        // Never silently fall back to an elevated REAPER if Windows Explorer is unavailable.
        public static void Open(string executable, string project) {
            string workingDirectory = Path.GetDirectoryName(project);
            using (var current = Process.GetCurrentProcess()) {
                if (!IsElevated(current.Handle)) {
                    Process.Start(new ProcessStartInfo(executable, "\"" + project + "\"") {
                        UseShellExecute = false, WorkingDirectory = workingDirectory
                    });
                    return;
                }
            }

            IntPtr desktop = GetShellWindow();
            uint explorerId;
            if (desktop == IntPtr.Zero ||
                GetWindowThreadProcessId(desktop, out explorerId) == 0 ||
                explorerId == 0)
                throw new InvalidOperationException(
                    "Не найден обычный процесс Проводника Windows. Запусти Studio без прав администратора.");

            IntPtr explorer = IntPtr.Zero, explorerToken = IntPtr.Zero, userToken = IntPtr.Zero;
            try {
                explorer = OpenProcess(ProcessQueryLimitedInformation, false, explorerId);
                if (explorer == IntPtr.Zero) throw LastError();
                if (!OpenProcessToken(explorer, TokenQuery | TokenDuplicate, out explorerToken))
                    throw LastError();

                TokenElevationInfo shellElevation;
                int returned;
                if (!GetTokenInformation(explorerToken, TokenElevation, out shellElevation,
                    Marshal.SizeOf(typeof(TokenElevationInfo)), out returned)) throw LastError();
                if (shellElevation.TokenIsElevated != 0)
                    throw new InvalidOperationException(
                        "Проводник Windows тоже запущен от администратора. Нельзя безопасно открыть REAPER с обычными правами.");

                if (!DuplicateTokenEx(explorerToken, TokenAssignPrimary | TokenDuplicate | TokenQuery,
                    IntPtr.Zero, SecurityImpersonation, TokenPrimary, out userToken)) throw LastError();

                var startup = new StartupInfo { cb = Marshal.SizeOf(typeof(StartupInfo)) };
                ProcessInformation child;
                var commandLine = new StringBuilder("\"" + executable + "\" \"" + project + "\"");
                if (!CreateProcessWithToken(userToken, LogonWithProfile, executable, commandLine,
                    0, IntPtr.Zero, workingDirectory, ref startup, out child))
                    throw LastError();
                if (child.hThread != IntPtr.Zero) CloseHandle(child.hThread);
                if (child.hProcess != IntPtr.Zero) CloseHandle(child.hProcess);
            } finally {
                if (userToken != IntPtr.Zero) CloseHandle(userToken);
                if (explorerToken != IntPtr.Zero) CloseHandle(explorerToken);
                if (explorer != IntPtr.Zero) CloseHandle(explorer);
            }
        }
    }
}
