// Route history for the local Studio, compatible with Chromium/Edge app mode.
// Browser Back/Forward, mouse X1/X2 and keyboard browser navigation share this stack.
// Only navigation state is captured; editing changes and draft forms are not undone.
const NAV_KEY='__fundiStudioRoute_v1';
const routeKey=value=>JSON.stringify(value);
export function createStudioNavigation({read,restore,win,canNavigate=()=>true}){
  let initialized=false,restoring=false,index=0,max=0;
  const url=()=>win.location.pathname+win.location.search;
  const entry=(route,i)=>({[NAV_KEY]:{index:i,route}});
  function record(){
    if(restoring)return;
    const route=read(),previous=win.history.state?.[NAV_KEY];
    if(!initialized){
      initialized=true;
      const original=win.history.state;
      win.history.replaceState({...((original&&typeof original==='object')?original:{}),...entry(route,0)},'',url());
      return;
    }
    if(previous&&routeKey(previous.route)===routeKey(route))return;
    index++;max=index;
    win.history.pushState(entry(route,index),'',url());
  }
  function onPopState(event){
    const found=event.state?.[NAV_KEY];
    if(!found||!Number.isSafeInteger(found.index)||found.index<0||typeof found.route!=='object'||!found.route)return;
    // An open edit dialog takes precedence; never discard unsaved form data.
    if(!canNavigate()){
      if(found.index!==index)win.history.go(index-found.index);
      return;
    }
    index=found.index;
    restoring=true;
    try{restore(found.route);}finally{restoring=false;}
  }
  function move(direction){
    if(!initialized||!canNavigate())return false;
    if(direction<0&&index===0)return false;
    if(direction>0&&index>=max)return false;
    win.history.go(direction<0?-1:1);
    return true;
  }
  win.addEventListener('popstate',onPopState);
  return {
    record,back:()=>move(-1),forward:()=>move(1),
    status:()=>({index,max,canBack:index>0,canForward:index<max}),
    dispose:()=>win.removeEventListener('popstate',onPopState)
  };
}
