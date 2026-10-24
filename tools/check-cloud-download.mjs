// Guard against regression to direct R2 S3 HTTPS downloads on Windows.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files=readFileSync('package/StudioFiles.cs','utf8');
const net=readFileSync('package/FileTransfers.cs','utf8');
assert.ok(files.includes('R2Transfer.DownloadFromCloud(server,downloadPath,destination,name,size,job)'));
assert.ok(!files.includes('R2Transfer.Download(JsonData.S(response,"downloadUrl")'));
assert.ok(net.includes('CloudHttp.Server(server)'), 'Only authenticated Studio server can receive downloads');
assert.ok(net.includes('CreateVerified(target,"GET")'));
assert.ok(net.includes('fileId=[a-f0-9-]{36}'), 'Path is restricted to one file ticket');
assert.ok(net.includes('AllowAutoRedirect=false'), 'Reject redirects away from Fundi Voice');
console.log('PASS: protected downloads stream through Fundi Voice Cloud with original filename');
