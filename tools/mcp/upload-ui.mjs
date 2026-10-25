/** Optional owner-controlled page, no third-party scripts or token storage. */
export function uploadHtml(nonce) {
return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UCE private upload</title><style>
*{box-sizing:border-box}body{background:#f5f7fb;color:#172133;font:16px/1.5 system-ui,sans-serif}
main{max-width:640px;padding:25px;margin:4vh auto;background:white;border:1px solid #cbd5e1;border-radius:12px}
h1{font-size:1.6rem}label{display:block;font-weight:600;margin:18px 0 4px}
input[type=password],input[type=file]{display:block;width:100%;padding:11px;border:1px solid #64748b;border-radius:6px}
button{background:#1d438c;color:white;padding:13px;border:0;border-radius:6px;margin-top:14px;cursor:pointer}
button:disabled{opacity:.5}button:focus-visible,input:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
#result{background:#ecf3ff;border-radius:6px;padding:12px;overflow-wrap:anywhere;white-space:pre-wrap}
</style></head><body><main>
<h1>UCE · Private project ZIP upload</h1>
<p>For projects you own or have permission to analyze. Uploaded ZIPs are
validated, temporarily staged and deleted after analysis. Maximum 4 MiB.
Do not upload passwords, credentials or other sensitive secrets.</p>
<form id="upload">
<label for="token">Private bearer token (not saved)</label>
<input id="token" type="password" autocomplete="off" minlength="20" required>
<label for="project">Choose your project ZIP</label>
<input id="project" type="file" accept=".zip,application/zip" required>
<label><input id="consent" type="checkbox" required>
I authorize transferring these files to this server for UCE analysis.</label>
<button id="submit" type="submit">Upload project ZIP</button>
</form>
<p id="result" role="status" aria-live="polite">No upload has started.</p>
<p><small>Copy the resulting handle into the same authenticated ChatGPT or
Claude MCP connection and invoke <code>uce_analyze_upload</code>. Chat
attachments are not automatically available to an MCP tool. The handle
expires after approximately 15 minutes.</small></p>
</main><script nonce="${nonce}">
const form=document.getElementById('upload'),status=document.getElementById('result'),button=document.getElementById('submit');
form.addEventListener('submit',async(event)=>{
event.preventDefault();
if(!form.reportValidity())return;
const file=document.getElementById('project').files[0];
if(!file||file.size>4*1024*1024){status.textContent='ZIP missing or over 4 MiB';return;}
const token=document.getElementById('token').value;
button.disabled=true;status.textContent='Uploading securely to your UCE gateway…';
try{
const response=await fetch('/upload',{method:'POST',cache:'no-store',headers:{
Authorization:'Bearer '+token,'Content-Type':'application/zip',
'X-UCE-Upload-Consent':'true','X-UCE-Filename':'project.zip'},body:file});
const value=await response.json();
status.textContent=response.ok?'Upload staged! MCP uploadId: '+value.uploadId+
'\\nExpires in '+value.expiresInSeconds+' seconds.':'Upload rejected ('+
response.status+'): '+(value.error||'invalid archive');
}catch{status.textContent='Upload failed: check HTTPS, bearer access and origin allowlist.';}
finally{document.getElementById('token').value='';button.disabled=false;}
});
</script></body></html>`;
}
