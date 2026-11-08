package main

import (
	"archive/zip"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestVersions(t *testing.T) {
	if compareVersion("1.10.0", "1.9.9") <= 0 {
		t.Fatal("semver mismatch")
	}
	if compareVersion("1.8.0", "1.8.0") != 0 {
		t.Fatal("same version mismatch")
	}
	if compareVersion("1.7.0", "1.8.0") >= 0 {
		t.Fatal("downgrade mismatch")
	}
}
func TestZIPTraversal(t *testing.T) {
	for _, p := range []string{"../evil", "/root/file", "C:/Windows/file", "foo\\bar", "foo/../../evil", "", "a//b"} {
		if safeZIPPath(p) {
			t.Fatalf("Accepted path %q", p)
		}
	}
	for _, p := range []string{"web/app.js", "Launch.ps1", "README.md"} {
		if !safeZIPPath(p) {
			t.Fatalf("Rejected valid path %q", p)
		}
	}
}
func TestCorruptBundleRejected(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "invalid.zip")
	f, _ := os.Create(p)
	z := zip.NewWriter(f)
	entry, _ := z.Create("../escape.txt")
	_, _ = entry.Write([]byte("no"))
	_ = z.Close()
	_ = f.Close()
	if err := unpackVerified(p, filepath.Join(dir, "stage")); err == nil {
		t.Fatal("zip-slip allowed")
	}
}
func TestManifestVerification(t *testing.T) {
	pub, err := base64.StdEncoding.DecodeString(publicKeyB64)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		t.Fatal("public key")
	}
	m := Manifest{Version: "1.9.0", Sha256: hex.EncodeToString(sha256.New().Sum(nil)), Bytes: 512}
	if err := verifyManifest(m); err == nil {
		t.Fatal("accepted unsigned manifest")
	}
	_, private, _ := ed25519.GenerateKey(rand.Reader)
	m.Signature = base64.StdEncoding.EncodeToString(ed25519.Sign(private, signedData(m)))
	if err := verifyManifest(m); err == nil {
		t.Fatal("accepted wrong key")
	}
}
func TestInvalidZipNoPointerChange(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "VERSION.txt"), []byte("1.8.0\n"), 0600)
	if v, _ := currentVersion(dir); v != "1.8.0" {
		t.Fatalf("want bootstrap, got %s", v)
	}
	if err := writeCurrentVersion(dir, "1.9.0"); err != nil {
		t.Fatal(err)
	}
	if v, _ := currentVersion(dir); v != "1.8.0" {
		t.Fatal("missing stage selected")
	}
}


func TestStudioVersionRetentionPreservesData(t *testing.T) {
 root := t.TempDir()
 for _, version := range []string{"1.8.85", "1.8.84", "1.8.83", "1.8.82", "1.8.81"} {
  dir := filepath.Join(root, "versions", version)
  if err := os.MkdirAll(dir, 0755); err != nil { t.Fatal(err) }
  if err := os.WriteFile(filepath.Join(dir, "Launch.ps1"), []byte("launch"), 0600); err != nil { t.Fatal(err) }
 }
 data := filepath.Join(root, "workspace.json")
 if err := os.WriteFile(data, []byte("private workspace"), 0600); err != nil { t.Fatal(err) }
 if err := pruneVersions(root, "1.8.85"); err != nil { t.Fatal(err) }
 for _, version := range []string{"1.8.85", "1.8.84", "1.8.83", "1.8.82"} {
  if _, err := os.Stat(filepath.Join(root, "versions", version)); err != nil { t.Fatalf("Retained version missing: %s", version) }
 }
 if _, err := os.Stat(filepath.Join(root, "versions", "1.8.81")); !os.IsNotExist(err) { t.Fatal("Old package was not pruned") }
 if value, err := os.ReadFile(data); err != nil || string(value) != "private workspace" { t.Fatal("Personal data changed during version cleanup") }
}
func TestStudioCachedPackageNeedsMatchingHash(t *testing.T) {
 root := t.TempDir()
 dir := filepath.Join(root,"versions","1.8.85")
 _ = os.MkdirAll(dir,0755)
 hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
 if isPreviouslyVerified(root,"1.8.85",hash) { t.Fatal("Unverified cache accepted") }
 _ = os.WriteFile(filepath.Join(dir,".verified-sha256"),[]byte(hash+"\n"),0600)
 if !isPreviouslyVerified(root,"1.8.85",hash) { t.Fatal("Verified cache rejected") }
 if isPreviouslyVerified(root,"1.8.85","ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") { t.Fatal("Different package hash accepted") }
}
