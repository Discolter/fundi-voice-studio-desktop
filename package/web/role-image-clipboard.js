// Clipboard image bytes only: never fetch arbitrary URLs or parse copied HTML.
export function roleImageFromClipboard(clipboard){
  if(!clipboard)return null;
  const permitted=/^image\/(?:png|jpeg|webp)$/i;
  for(const item of Array.from(clipboard.items||[])){
    if(item.kind!=='file'||!permitted.test(item.type||''))continue;
    const file=item.getAsFile?.();
    if(file&&file.size>0&&permitted.test(file.type||item.type))return file;
  }
  for(const file of Array.from(clipboard.files||[])){
    if(file&&file.size>0&&permitted.test(file.type||''))return file;
  }
  return null;
}
