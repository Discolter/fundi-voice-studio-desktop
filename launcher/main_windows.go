//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const createNoWindow = 0x08000000

func message(text string, flags uintptr) {
	title, _ := syscall.UTF16PtrFromString("Fundi Voice Studio")
	body, _ := syscall.UTF16PtrFromString(text)
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), flags)
}
func running() bool {
	name, _ := syscall.UTF16PtrFromString(`Local\FundiVoiceStudio-` + os.Getenv("USERNAME"))
	kernel := syscall.NewLazyDLL("kernel32.dll")
	handle, _, _ := kernel.NewProc("OpenMutexW").Call(0x00100000, 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return false
	}
	kernel.NewProc("CloseHandle").Call(handle)
	return true
}
func launch(dir string) error {
	script := filepath.Join(dir, "Launch.ps1")
	if _, err := os.Stat(script); err != nil {
		return fmt.Errorf("Не найден Launch.ps1: %w", err)
	}
	powershell := filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	cmd := exec.Command(powershell, "-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", script)
	cmd.Dir = dir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}
func logEvent(err error) {
	if err == nil {
		return
	}
	dataDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "FundiVoice")
	_ = os.MkdirAll(dataDir, 0700)
	f, e := os.OpenFile(filepath.Join(dataDir, "launcher.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if e == nil {
		_, _ = fmt.Fprintln(f, err)
		_ = f.Close()
	}
}
func main() {
	exe, err := os.Executable()
	if err != nil {
		message("Не удалось определить путь лаунчера.", 0x10)
		return
	}
	root := filepath.Dir(exe)
	_, initialDir := currentVersion(root)
	if running() {
		message("Studio уже открыта. Закрой её через меню у часов Windows, если хочешь перезапустить.", 0x40)
		return
	}
	oldVersion, _ := currentVersion(root)
	updated, updateError := checkAndUpdate(root)
	if updateError != nil {
		logEvent(fmt.Errorf("Update check: %s", updateError.Error()))
	}
	current, newDir := currentVersion(root)
	if err = launch(newDir); err == nil && updated {
		// Verify the new engine actually reached its single-instance mutex.
		// Compilation/startup failure must not mark the new version as working.
		healthy := false
		for i := 0; i < 40; i++ {
			if running() {
				healthy = true
				break
			}
			time.Sleep(500 * time.Millisecond)
		}
		if !healthy {
			err = fmt.Errorf("new Studio process did not become ready")
		}
	}
	if err != nil {
		logEvent(fmt.Errorf("Studio start %s: %w", current, err))
		// Restore old known working version if a new package cannot start.
		if updated && strings.TrimSpace(oldVersion) != "" {
			// Do not retry the same broken signed release on every launch.
			_ = os.WriteFile(filepath.Join(root, "bad-version.txt"), []byte(current+"\n"), 0600)
			if oldVersion == "1.8.0" {
				_ = os.Remove(filepath.Join(root, "current-version.txt"))
			} else {
				_ = writeCurrentVersion(root, oldVersion)
			}
			if e := launch(initialDir); e == nil {
				message("Новое обновление не запустилось. Восстановлена предыдущая версия Studio.", 0x30)
				return
			}
		}
		message("Не удалось открыть Studio:\n"+err.Error(), 0x10)
		return
	}
	// Offline use is supported: when GitHub is unavailable, open installed Studio.
	// No GitHub credentials are ever requested or stored.
}
