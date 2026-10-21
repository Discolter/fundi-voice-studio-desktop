package main

import (
	"archive/zip"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// This is a PUBLIC release-only repository. Never embed a GitHub token or cloud password.
const releaseBase = "https://github.com/Discolter/fundi-voice-studio-desktop/releases"
const releaseManifest = releaseBase + "/latest/download/studio-update.json"
const maxBundleSize int64 = 40 << 20
const maxUncompressedSize int64 = 60 << 20
const publicKeyB64 = "BRf9Kn1b8MVwv8GhlnPOjCTlWCS5sAIeecGg/vuFrak="

var semver = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$`)

// Release signature authenticates version + artifact hash, independent of GitHub TLS.
// The private key remains in the owner's GitHub Actions secret, never in this program.
type Manifest struct {
	Version   string `json:"version"`
	Sha256    string `json:"sha256"`
	Signature string `json:"signature"`
	Bytes     int64  `json:"bytes"`
}

func signedData(m Manifest) []byte {
	return []byte("fundi-studio-v1\n" + m.Version + "\n" + strings.ToLower(m.Sha256) + "\n")
}
func verifyManifest(m Manifest) error {
	if !semver.MatchString(m.Version) || len(m.Sha256) != 64 || m.Bytes < 1 || m.Bytes > maxBundleSize {
		return errors.New("Некорректный файл версии")
	}
	if _, err := hex.DecodeString(m.Sha256); err != nil {
		return errors.New("Некорректная контрольная сумма")
	}
	pub, err := base64.StdEncoding.DecodeString(publicKeyB64)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return errors.New("Не настроен ключ проверки")
	}
	sig, err := base64.StdEncoding.DecodeString(m.Signature)
	if err != nil || !ed25519.Verify(ed25519.PublicKey(pub), signedData(m), sig) {
		return errors.New("Цифровая подпись обновления не совпадает")
	}
	return nil
}
func compareVersion(left, right string) int {
	if !semver.MatchString(left) {
		return -1
	}
	if !semver.MatchString(right) {
		return 1
	}
	a, b := strings.Split(left, "."), strings.Split(right, ".")
	for i := 0; i < 3; i++ {
		x, _ := strconv.ParseUint(a[i], 10, 64)
		y, _ := strconv.ParseUint(b[i], 10, 64)
		if x < y {
			return -1
		}
		if x > y {
			return 1
		}
	}
	return 0
}
func fetchManifest(client *http.Client) (Manifest, error) {
	var m Manifest
	req, err := http.NewRequest(http.MethodGet, releaseManifest, nil)
	if err != nil {
		return m, err
	}
	req.Header.Set("User-Agent", "FundiVoiceStudio-Updater/1.0")
	response, err := client.Do(req)
	if err != nil {
		return m, err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return m, fmt.Errorf("GitHub update HTTP %d", response.StatusCode)
	}
	if response.ContentLength > 32768 {
		return m, errors.New("Файл описания слишком велик")
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, 32769))
	if err != nil {
		return m, err
	}
	if len(raw) > 32768 {
		return m, errors.New("Файл описания слишком велик")
	}
	if err = json.Unmarshal(raw, &m); err != nil {
		return m, err
	}
	return m, verifyManifest(m)
}
func downloadPackage(client *http.Client, m Manifest, filename string) error {
	url := releaseBase + "/download/v" + m.Version + "/studio-app.zip"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "FundiVoiceStudio-Updater/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("Не удалось получить пакет обновления (HTTP %d)", resp.StatusCode)
	}
	if resp.ContentLength > maxBundleSize {
		return errors.New("Архив обновления превышает лимит")
	}
	out, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	success := false
	defer func() {
		_ = out.Close()
		if !success {
			_ = os.Remove(filename)
		}
	}()
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(out, h), io.LimitReader(resp.Body, maxBundleSize+1))
	if err != nil {
		return err
	}
	if n != m.Bytes || n > maxBundleSize {
		return errors.New("Размер файла обновления неверен")
	}
	actual := hex.EncodeToString(h.Sum(nil))
	expected, _ := hex.DecodeString(strings.ToLower(m.Sha256))
	got, _ := hex.DecodeString(actual)
	if subtle.ConstantTimeCompare(got, expected) != 1 {
		return errors.New("Пакет обновления повреждён (SHA-256)")
	}
	if err = out.Sync(); err != nil {
		return err
	}
	success = true
	return nil
}
func safeZIPPath(p string) bool {
	if p == "" || strings.HasPrefix(p, "/") || strings.Contains(p, "\\") || strings.Contains(p, ":") || strings.ContainsRune(p, '\x00') {
		return false
	}
	clean := path.Clean(p)
	return p == clean && clean != "." && clean != ".." && !strings.HasPrefix(clean, "../")
}
func unpackVerified(zipPath, stage string) error {
	archive, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer archive.Close()
	if len(archive.File) > 300 {
		return errors.New("Архив содержит слишком много файлов")
	}
	var size int64
	for _, f := range archive.File {
		if !safeZIPPath(strings.TrimSuffix(f.Name, "/")) {
			return fmt.Errorf("Недопустимый путь: %s", f.Name)
		}
		if f.Mode()&os.ModeSymlink != 0 || f.Mode()&os.ModeType != 0 && !f.FileInfo().IsDir() {
			return errors.New("Архив содержит ссылку или специальный файл")
		}
		size += int64(f.UncompressedSize64)
		if size > maxUncompressedSize {
			return errors.New("Распакованный архив слишком велик")
		}
	}
	for _, f := range archive.File {
		dest := filepath.Join(stage, filepath.FromSlash(f.Name))
		if f.FileInfo().IsDir() {
			if err = os.MkdirAll(dest, 0755); err != nil {
				return err
			}
			continue
		}
		if err = os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			_ = in.Close()
			return err
		}
		n, copyErr := io.Copy(out, io.LimitReader(in, maxUncompressedSize+1))
		_ = in.Close()
		closeErr := out.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if n != int64(f.UncompressedSize64) {
			return errors.New("Ошибка распаковки файла")
		}
	}
	// Fail closed on truncated or incorrect release content.
	for _, relative := range []string{"Launch.ps1", "LocalServer.cs", "CloudCommon.cs", "web/index.html", "web/app.js", "VERSION.txt"} {
		if info, err := os.Stat(filepath.Join(stage, filepath.FromSlash(relative))); err != nil || info.IsDir() {
			return fmt.Errorf("В обновлении отсутствует %s", relative)
		}
	}
	return nil
}
func currentVersion(root string) (string, string) {
	raw, err := os.ReadFile(filepath.Join(root, "current-version.txt"))
	if err == nil {
		v := strings.TrimSpace(string(raw))
		if semver.MatchString(v) {
			d := filepath.Join(root, "versions", v)
			if _, err := os.Stat(filepath.Join(d, "Launch.ps1")); err == nil {
				return v, d
			}
		}
	}
	legacy := strings.TrimSpace(readSmallFile(filepath.Join(root, "VERSION.txt")))
	if !semver.MatchString(legacy) {
		legacy = "1.8.0"
	}
	return legacy, root
}
func readSmallFile(path string) string {
	b, _ := os.ReadFile(path)
	if len(b) > 64 {
		return ""
	}
	return string(b)
}
func writeCurrentVersion(root, version string) error {
	tmp := filepath.Join(root, "current-version.next")
	if err := os.WriteFile(tmp, []byte(version+"\n"), 0600); err != nil {
		return err
	}
	if err := os.Rename(tmp, filepath.Join(root, "current-version.txt")); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}
func installDownloaded(root string, m Manifest, client *http.Client) error {
	if err := verifyManifest(m); err != nil {
		return err
	}
	current, _ := currentVersion(root)
	if compareVersion(m.Version, current) <= 0 {
		return nil
	}
	updates := filepath.Join(root, ".updates")
	if err := os.MkdirAll(updates, 0700); err != nil {
		return err
	}
	versionDir := filepath.Join(root, "versions", m.Version)
	if _, err := os.Stat(filepath.Join(versionDir, "Launch.ps1")); err == nil {
		return writeCurrentVersion(root, m.Version)
	}
	name := filepath.Join(updates, "update-"+m.Version+".zip")
	// No partial/resumed untrusted files: create a fresh download and verify before extraction.
	_ = os.Remove(name)
	if err := downloadPackage(client, m, name); err != nil {
		return err
	}
	defer os.Remove(name)
	stage, err := os.MkdirTemp(updates, "stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	if err := unpackVerified(name, stage); err != nil {
		return err
	}
	installedVersion := strings.TrimSpace(readSmallFile(filepath.Join(stage, "VERSION.txt")))
	if installedVersion != m.Version {
		return errors.New("Версия внутри пакета не совпадает с подписанным релизом")
	}
	if err := os.MkdirAll(filepath.Dir(versionDir), 0700); err != nil {
		return err
	}
	if err := os.Rename(stage, versionDir); err != nil {
		return err
	}
	// Atomic pointer swap. Previous application stays untouched for rollback.
	return writeCurrentVersion(root, m.Version)
}
func checkAndUpdate(root string) (updated bool, err error) {
	client := &http.Client{Timeout: 8 * time.Second}
	m, err := fetchManifest(client)
	if err != nil {
		return false, err
	}
	current, _ := currentVersion(root)
	if compareVersion(m.Version, current) <= 0 || strings.TrimSpace(readSmallFile(filepath.Join(root, "bad-version.txt"))) == m.Version {
		return false, nil
	}
	client.Timeout = 150 * time.Second
	if err = installDownloaded(root, m, client); err != nil {
		return false, err
	}
	return true, nil
}
